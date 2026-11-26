#!/usr/bin/env python3
"""
sync_docs.py — Per-build static documentation fetcher for kastrick-docs.

Pulls live Markdown docs and guides from each established project repository
defined in data/projects.json at BUILD TIME (never at runtime in the browser),
writes them into content/<project>/{docs,guides}/, and compiles a static
content/manifest.json used by Next.js generateStaticParams().

Projects marked established=false (status: "NOT_EST") are skipped during
remote sync and registered cleanly as NOT_EST placeholders.

Usage:
	python3 scripts/sync_docs.py
	python3 scripts/sync_docs.py --offline
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_FILE = REPO_ROOT / "data" / "projects.json"
CONTENT_DIR = REPO_ROOT / "content"
MANIFEST_FILE = CONTENT_DIR / "manifest.json"
USER_AGENT = "kastrick-docs-builder/1.0 (+https://github.com/Kate-alt-69/kastrick-docs)"

HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*$", re.MULTILINE)


def build_headers(token: str | None) -> dict[str, str]:
	"""Build GitHub API request headers with optional token authentication."""
	headers = {
		"Accept": "application/vnd.github+json",
		"User-Agent": USER_AGENT,
		"X-GitHub-Api-Version": "2022-11-28",
	}
	if token:
		headers["Authorization"] = f"Bearer {token}"
	return headers


def github_get_json(url: str, token: str | None) -> Any:
	"""Fetch and decode JSON from the GitHub REST API."""
	req = urllib.request.Request(url, headers=build_headers(token))
	with urllib.request.urlopen(req, timeout=25) as resp:
		return json.loads(resp.read().decode("utf-8"))


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
			toc.append({
				"level": level,
				"text": text,
				"id": slugify(text),
			})
	return title, toc


def classify_track(repo_path: str, guides_paths: list[str]) -> str:
	"""Classify a fetched Markdown file into either the 'guides' or 'docs' track."""
	lower = repo_path.lower()
	for gp in guides_paths:
		prefix = gp.strip("/").lower()
		if lower.startswith(prefix + "/") or lower == prefix:
			return "guides"
	if "/guides/" in lower or lower.startswith("guides/"):
		return "guides"
	return "docs"


def fetch_repo_markdown(
	project: dict[str, Any],
	token: str | None,
) -> tuple[str | None, list[dict[str, Any]]]:
	"""
	Fetch live Markdown files from an established GitHub repository using the
	Git Trees API and return (commit_sha, fetched_pages).
	"""
	repo = project["repo"]
	branches = [project.get("branch", "main")]
	fallback = project.get("fallbackBranch")
	if fallback and fallback not in branches:
		branches.append(fallback)

	tree_payload = None
	used_branch = None
	for branch in branches:
		url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
		try:
			tree_payload = github_get_json(url, token)
			used_branch = branch
			break
		except (urllib.error.HTTPError, urllib.error.URLError) as exc:
			print(f"[sync_docs] Could not read tree {repo}@{branch}: {exc}")

	if not tree_payload:
		return None, []

	docs_prefixes = [p.strip("/") for p in project.get("docsPaths", ["docs", "README.md"])]
	guides_prefixes = [p.strip("/") for p in project.get("guidesPaths", ["guides"])]
	allowed_prefixes = docs_prefixes + guides_prefixes

	pages: list[dict[str, Any]] = []
	for item in tree_payload.get("tree", []):
		if item.get("type") != "blob":
			continue
		rel_path = item.get("path", "")
		if not rel_path.lower().endswith(".md"):
			continue

		# Keep only documentation/guide Markdown files declared in projects.json.
		matches_prefix = any(
			rel_path == p or rel_path.startswith(p + "/")
			for p in allowed_prefixes
		)
		if not matches_prefix:
			continue

		blob_url = item.get("url")
		if not blob_url:
			continue
		try:
			blob = github_get_json(blob_url, token)
			raw_b64 = blob.get("content", "")
			content = base64.b64decode(raw_b64).decode("utf-8", errors="replace")
		except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as exc:
			print(f"[sync_docs] Skipping {repo}/{rel_path}: {exc}")
			continue

		track = classify_track(rel_path, guides_prefixes)
		stem = Path(rel_path).stem
		slug = "overview" if stem.lower() in ("readme", "index") else slugify(stem)
		fallback_title = "Overview" if slug == "overview" else stem.replace("-", " ").replace("_", " ").title()
		title, toc = extract_title_and_toc(content, fallback_title)

		out_file = CONTENT_DIR / project["id"] / track / f"{slug}.md"
		out_file.parent.mkdir(parents=True, exist_ok=True)
		out_file.write_text(content, encoding="utf-8")

		pages.append({
			"slug": slug,
			"track": track,
			"title": title,
			"sourcePath": rel_path,
			"sourceBranch": used_branch,
			"localFile": str(out_file.relative_to(REPO_ROOT)).replace("\\", "/"),
			"toc": toc,
		})

	return tree_payload.get("sha"), pages


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
				"title": title,
				"sourcePath": f"{track}/{md_file.name}",
				"sourceBranch": project.get("branch", "main"),
				"localFile": str(md_file.relative_to(REPO_ROOT)).replace("\\", "/"),
				"toc": toc,
			})
	return pages


def main() -> int:
	parser = argparse.ArgumentParser(
		description="Fetch live per-build static Markdown docs for established Kastrick projects."
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
		pid = project["id"]
		if not project.get("established", False):
			print(f"[sync_docs] Skipping {project['name']} ({project['repo']}) — marked NOT_EST.")
			manifest["projects"].append({
				**project,
				"syncedSha": None,
				"pages": [],
			})
			continue

		sha: str | None = None
		pages: list[dict[str, Any]] = []
		if not args.offline:
			print(f"[sync_docs] Fetching live build-time docs for {project['name']} ({project['repo']})...")
			sha, pages = fetch_repo_markdown(project, token)

		if not pages:
			print(f"[sync_docs] Using local static snapshot for {project['name']}.")
			pages = index_local_content(project)

		manifest["projects"].append({
			**project,
			"syncedSha": sha,
			"pages": pages,
		})

	CONTENT_DIR.mkdir(parents=True, exist_ok=True)
	MANIFEST_FILE.write_text(json.dumps(manifest, indent="\t") + "\n", encoding="utf-8")
	print(f"[sync_docs] Wrote static manifest to {MANIFEST_FILE.relative_to(REPO_ROOT)}.")
	return 0


if __name__ == "__main__":
	sys.exit(main())
