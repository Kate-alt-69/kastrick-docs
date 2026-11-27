#!/usr/bin/env python3
"""
sync_docs.py — Per-build static documentation fetcher, structurer & link rewriter.

1. Downloads one zipball per established repo from codeload.github.com.
2. Respects each project's authoritative docsPaths + excludePaths (e.g. RBE `doc/`
   excluding legacy `docs/`, Next.js Engine `docs/3/` excluding legacy Gen 2 trees).
3. Maps each file's repository folder hierarchy into clean `section` groups using
   per-project `sectionMap` rules so the website mirrors the repository's structure.
4. Rewrites relative Markdown links into `/<project>/<slug>` and EngineScroll `#-es` hashes.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import posixpath
import re
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = REPO_ROOT / "data" / "projects.json"
CONTENT_DIR = REPO_ROOT / "content"
MANIFEST_FILE = CONTENT_DIR / "manifest.json"
USER_AGENT = "kastrick-docs-builder/1.4 (+https://github.com/Kate-alt-69/kastrick-docs)"

HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*$", re.MULTILINE)
MD_LINK_RE = re.compile(r"(?<!!)\[([^\]]+)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")

IGNORED_DIRS = {
	".git",
	".github",
	"_ignore",
	"node_modules",
	"target",
	"dist",
	".next",
	"test",
	"tests",
	"tmp-noop",
	"never-again",
}

IGNORED_FILES = {
	"claud.md",
	"claude.md",
	"agents.md",
	"todo.md",
	"changelog.md",
	"code_of_conduct.md",
	"license.md",
}

SEARCH_INDEX_FILE = REPO_ROOT / "public" / "docs-search-index.json"


def searchable_markdown(markdown: str) -> str:
	"""Convert Markdown to compact searchable text while retaining prose and code."""
	text = re.sub(
		r"(?s)\x60{3}[^\n]*\n(.*?)\x60{3}",
		lambda match: "\n" + match.group(1) + "\n",
		markdown,
	)
	text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
	text = re.sub(r"(?m)^\s*(?:[-*+]\s+|\d+[.)]\s+)", "", text)
	text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
	text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
	text = re.sub(r"\x60([^\x60]*)\x60", r"\1", text)
	text = re.sub(r"[*_~|]", " ", text)
	return re.sub(r"\s+", " ", text).strip()


def write_search_index(projects: list[dict[str, Any]], generated_at: str) -> int:
	"""Write a lazily-loaded full-text index from the exact Markdown used by the build."""
	entries: list[dict[str, str]] = []
	for project in projects:
		for page in project.get("pages", []):
			local_file = REPO_ROOT / page["localFile"]
			if not local_file.is_file():
				continue
			markdown = local_file.read_text(encoding="utf-8")
			entries.append({
				"projectId": project["id"],
				"projectName": project["name"],
				"track": page["track"],
				"slug": page["slug"],
				"title": page["title"],
				"section": page.get("section", "Documentation"),
				"text": searchable_markdown(markdown),
			})

	SEARCH_INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
	payload = {"generatedAt": generated_at, "pages": entries}
	SEARCH_INDEX_FILE.write_text(
		json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
		encoding="utf-8",
	)
	return len(entries)

def slugify(text: str) -> str:
	"""Convert a heading or file stem into a clean URL-safe slug."""
	cleaned = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
	return re.sub(r"[\s_-]+", "-", cleaned) or "overview"


def extract_title_and_toc(markdown: str, fallback_title: str) -> tuple[str, list[dict[str, Any]]]:
	"""Extract the H1 page title and H2/H3 outline entries from Markdown text."""
	title = fallback_title
	toc: list[dict[str, Any]] = []
	for match in HEADING_RE.finditer(markdown):
		level = len(match.group(1))
		text = re.sub(r"`([^`]+)`", r"\1", match.group(2)).strip()
		if level == 1 and title == fallback_title:
			title = text
		elif level in (2, 3):
			toc.append({"level": level, "text": text, "id": slugify(text)})
	return title, toc


def classify_track(repo_path: str, guides_paths: list[str]) -> str:
	"""Classify a Markdown file into either the 'guides' or 'docs' track."""
	lower = repo_path.lower()
	for gp in guides_paths:
		prefix = gp.strip("/").lower()
		if lower == prefix or lower.startswith(prefix + "/"):
			return "guides"
	if "/guides/" in lower or lower.startswith("guides/"):
		return "guides"
	return "docs"


def resolve_section(repo_path: str, section_map: dict[str, str], track: str) -> str:
	"""Resolve a human-readable sidebar section from an exact page rule or folder hierarchy."""
	normalized_path = repo_path.strip("/")
	exact_section = section_map.get(normalized_path)
	if exact_section:
		return exact_section

	parent = posixpath.dirname(normalized_path).strip("/")
	if parent:
		# Match longest configured folder prefix (e.g. docs/3/ne/compiler before docs/3/ne).
		sorted_keys = sorted(section_map.keys(), key=len, reverse=True)
		for key in sorted_keys:
			k = key.strip("/")
			if not k.endswith(".md") and (parent == k or parent.startswith(k + "/")):
				return section_map[key]
		# Fallback to clean title-cased folder name.
		leaf = parent.split("/")[-1]
		return leaf.replace("-", " ").replace("_", " ").replace(".", " ").title()
	return "Guides" if track == "guides" else "Overview"


def should_include_markdown(
	rel_path: str,
	allowed_prefixes: list[str],
	exclude_prefixes: list[str],
) -> bool:
	"""Check allowed paths and exclude legacy/internal directories."""
	parts = [p.lower() for p in Path(rel_path).parts]
	if any(part in IGNORED_DIRS for part in parts[:-1]):
		return False
	if parts[-1] in IGNORED_FILES:
		return False
	lower = rel_path.lower()
	for ex in exclude_prefixes:
		ex_clean = ex.strip("/").lower()
		if ex_clean and (lower == ex_clean or lower.startswith(ex_clean + "/")):
			return False
	if "*" in allowed_prefixes:
		return True
	return any(
		lower == p.strip("/").lower() or lower.startswith(p.strip("/").lower() + "/")
		for p in allowed_prefixes
	)


def rewrite_markdown_links(
	markdown: str,
	current_repo_path: str,
	project_id: str,
	repo: str,
	branch: str,
	path_to_slug: dict[str, str],
) -> str:
	"""Rewrite relative Markdown links to /<project>/<slug> and EngineScroll #-es anchors."""
	current_dir = posixpath.dirname(current_repo_path)

	def replace_link(match: re.Match[str]) -> str:
		label = match.group(1)
		href = match.group(2)

		if href.startswith(("http://", "https://", "mailto:", "tel:")):
			return match.group(0)

		if href.startswith("#"):
			anchor = slugify(href[1:])
			return f"[{label}](#-es?move={anchor}&offset=-84&duration=550)"

		target_part, _, fragment = href.partition("#")
		normalized = posixpath.normpath(posixpath.join(current_dir, target_part)).lstrip("/")

		candidates = [
			normalized,
			f"{normalized}/README.md",
			f"{normalized}/readme.md",
			f"{normalized}/index.md",
		]
		matched_slug = next((path_to_slug[c.lower()] for c in candidates if c.lower() in path_to_slug), None)

		if matched_slug:
			route = f"/{project_id}/{matched_slug}"
			if fragment:
				route += f"#-es?move={slugify(fragment)}&offset=-84&duration=550"
			return f"[{label}]({route})"

		gh_url = f"https://github.com/{repo}/blob/{branch}/{normalized}"
		if fragment:
			gh_url += f"#{fragment}"
		return f"[{label}]({gh_url})"

	return MD_LINK_RE.sub(replace_link, markdown)


def download_branch_zip(repo: str, branch: str, token: str | None) -> bytes | None:
	"""Download a repository branch archive in one HTTP request via codeload."""
	urls = [f"https://codeload.github.com/{repo}/zip/refs/heads/{branch}"]
	if token:
		urls.insert(0, f"https://api.github.com/repos/{repo}/zipball/{branch}")

	for url in urls:
		headers = {"User-Agent": USER_AGENT}
		if token and "api.github.com" in url:
			headers["Authorization"] = f"Bearer {token}"
		req = urllib.request.Request(url, headers=headers)
		try:
			with urllib.request.urlopen(req, timeout=45) as resp:
				return resp.read()
		except (urllib.error.HTTPError, urllib.error.URLError) as exc:
			print(f"[sync_docs] Archive fetch failed for {repo}@{branch} ({url}): {exc}")
	return None


def fetch_repo_markdown(
	project: dict[str, Any],
	token: str | None,
) -> list[dict[str, Any]]:
	"""Fetch authoritative Markdown docs for a project, preserving repo section hierarchy."""
	repo = project["repo"]
	branches = [project.get("branch", "main")]
	fallback = project.get("fallbackBranch")
	if fallback and fallback not in branches:
		branches.append(fallback)

	archive_bytes: bytes | None = None
	used_branch = branches[0]
	for branch in branches:
		archive_bytes = download_branch_zip(repo, branch, token)
		if archive_bytes is not None:
			used_branch = branch
			break

	if archive_bytes is None:
		return []

	docs_prefixes = [p.strip("/") for p in project.get("docsPaths", ["doc", "docs", "README.md"])]
	guides_prefixes = [p.strip("/") for p in project.get("guidesPaths", ["guides"])]
	exclude_prefixes = [p.strip("/") for p in project.get("excludePaths", [])]
	section_map: dict[str, str] = project.get("sectionMap", {})
	allowed_prefixes = docs_prefixes + guides_prefixes

	raw_entries: list[tuple[str, str, str, str, str]] = []
	seen_slugs: set[str] = set()
	path_to_slug: dict[str, str] = {}

	with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zf:
		for member in sorted(zf.namelist()):
			if member.endswith("/") or not member.lower().endswith(".md"):
				continue
			parts = member.split("/", 1)
			if len(parts) < 2:
				continue
			rel_path = parts[1]

			if not should_include_markdown(rel_path, allowed_prefixes, exclude_prefixes):
				continue

			content = zf.read(member).decode("utf-8", errors="replace")
			track = classify_track(rel_path, guides_prefixes)
			section = resolve_section(rel_path, section_map, track)

			stem = Path(rel_path).stem
			parent_str = str(Path(rel_path).parent).replace("\\", "/")
			if parent_str == ".":
				parent_str = ""
			parent_slug = slugify(parent_str) if parent_str else ""

			if stem.lower() in ("readme", "index"):
				slug = "overview" if parent_slug in ("", "doc", "docs", "docs-3", "guides") else parent_slug
			else:
				slug = slugify(stem)

			if slug in seen_slugs:
				slug = slugify(rel_path[:-3].replace("/", "-"))
			seen_slugs.add(slug)
			path_to_slug[rel_path.lower()] = slug
			raw_entries.append((rel_path, track, section, slug, content))

	pages: list[dict[str, Any]] = []
	for rel_path, track, section, slug, raw_md in raw_entries:
		rewritten = rewrite_markdown_links(
			raw_md,
			rel_path,
			project["id"],
			repo,
			used_branch,
			path_to_slug,
		)
		stem = Path(rel_path).stem
		fallback_title = "Overview" if slug == "overview" else stem.replace("-", " ").replace("_", " ").title()
		title, toc = extract_title_and_toc(rewritten, fallback_title)

		out_file = CONTENT_DIR / project["id"] / track / f"{slug}.md"
		out_file.parent.mkdir(parents=True, exist_ok=True)
		out_file.write_text(rewritten, encoding="utf-8")

		pages.append({
			"slug": slug,
			"track": track,
			"section": section,
			"title": title,
			"sourcePath": rel_path,
			"sourceBranch": used_branch,
			"localFile": str(out_file.relative_to(REPO_ROOT)).replace("\\", "/"),
			"toc": toc,
		})

	print(f"[sync_docs] Synced {len(pages)} structured static pages for {project['name']}.")
	return pages


def index_local_content(project: dict[str, Any]) -> list[dict[str, Any]]:
	"""Index already-present static Markdown files in content/<project>/ for offline builds."""
	pages: list[dict[str, Any]] = []
	project_dir = CONTENT_DIR / project["id"]
	if not project_dir.exists():
		return pages

	for track in ("docs", "guides"):
		track_dir = project_dir / track
		if not track_dir.exists():
			continue
		for md_file in sorted(track_dir.glob("*.md")):
			content = md_file.read_text(encoding="utf-8")
			slug = md_file.stem
			fallback_title = slug.replace("-", " ").title()
			title, toc = extract_title_and_toc(content, fallback_title)
			pages.append({
				"slug": slug,
				"track": track,
				"section": "Guides" if track == "guides" else "Core Architecture",
				"title": title,
				"sourcePath": f"{track}/{md_file.name}",
				"sourceBranch": project.get("branch", "main"),
				"localFile": str(md_file.relative_to(REPO_ROOT)).replace("\\", "/"),
				"toc": toc,
			})
	return pages


def main() -> int:
	parser = argparse.ArgumentParser(
		description="Fetch live per-build static Markdown docs structured by repo hierarchy."
	)
	parser.add_argument("--offline", action="store_true", help="Skip GitHub fetches and index local content/.")
	args = parser.parse_args()

	token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
	registry = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))

	manifest: dict[str, Any] = {
		"generatedAt": datetime.now(timezone.utc).isoformat(),
		"license": registry["license"],
		"projects": [],
	}

	for project in registry["projects"]:
		if not project.get("established", False):
			print(f"[sync_docs] Skipping {project['name']} ({project['repo']}) — marked NOT_EST.")
			manifest["projects"].append({
				**project,
				"syncedSha": None,
				"pages": [],
			})
			continue

		pages: list[dict[str, Any]] = []
		if not args.offline:
			print(f"[sync_docs] Fetching live build-time docs for {project['name']} ({project['repo']})...")
			pages = fetch_repo_markdown(project, token)

		if not pages:
			print(f"[sync_docs] Using local static snapshot for {project['name']}.")
			pages = index_local_content(project)

		manifest["projects"].append({
			**project,
			"syncedSha": None,
			"pages": pages,
		})

	CONTENT_DIR.mkdir(parents=True, exist_ok=True)
	MANIFEST_FILE.write_text(json.dumps(manifest, indent="\t") + "\n", encoding="utf-8")
	print(f"[sync_docs] Wrote static manifest to {MANIFEST_FILE.relative_to(REPO_ROOT)}.")

	search_count = write_search_index(manifest["projects"], manifest["generatedAt"])
	print(f"[sync_docs] Wrote full-text search index with {search_count} pages to {SEARCH_INDEX_FILE.relative_to(REPO_ROOT)}.")
	return 0


if __name__ == "__main__":
	sys.exit(main())
