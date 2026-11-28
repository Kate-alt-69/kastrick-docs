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

SEARCH_INDEX_DIR = REPO_ROOT / "public" / "docs-search-index"


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
	text = re.sub(r"[*~|]", " ", text)
	return re.sub(r"\s+", " ", text).strip()


def write_search_index(projects: list[dict[str, Any]], generated_at: str) -> int:
	"""Write one lazily-loaded full-text index per established project."""
	SEARCH_INDEX_DIR.mkdir(parents=True, exist_ok=True)
	total_pages = 0

	for project in projects:
		entries: list[dict[str, str]] = []
		for page in project.get("pages", []):
			local_file = REPO_ROOT / page["localFile"]
			if not local_file.is_file():
				continue
			markdown = local_file.read_text(encoding="utf-8")
			entries.append({
				"projectId": project["id"],
				"projectName": project["name"],
				"track": page["track"],
				"generation": page.get("generation"),
				"generationLabel": page.get("generationLabel"),
				"slug": page["slug"],
				"title": page["title"],
				"section": page.get("section", "Documentation"),
				"text": searchable_markdown(markdown),
			})

		if not entries:
			continue

		payload = {
			"generatedAt": generated_at,
			"projectId": project["id"],
			"pages": entries,
		}
		index_file = SEARCH_INDEX_DIR / (project["id"] + ".json")
		index_file.write_text(
			json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
			encoding="utf-8",
		)
		total_pages += len(entries)

	return total_pages




DOCS_PUBLIC_ORIGIN = "https://k8d.vercel.app"
DOCS_CANONICAL_ORIGIN = "https://kastrick-docs.vercel.app"
LEGACY_SITE_ORIGIN = "https://kastrick.vercel.app"
MIGRATION_MANIFEST_FILE = REPO_ROOT / "public" / "share" / "manifest.json"


def legacy_paths_for_page(project_id: str, source_path: str) -> list[str]:
	"""Return canonical destinations for URLs emitted by the former Kastrick docs viewer."""
	if project_id == "rbe" and source_path.startswith("doc/"):
		relative = source_path[len("doc/"):]
		if relative.lower() == "readme.md":
			suffix = ""
		elif relative.lower().endswith("/readme.md"):
			suffix = relative[:-len("/README.md")]
		else:
			suffix = relative[:-3] if relative.lower().endswith(".md") else relative
		return ["/project/rbe/doc" + ("/" + suffix if suffix else "")]

	if project_id == "nextjs-engine" and source_path.startswith("docs/"):
		relative = source_path[len("docs/"):]
		suffix = relative[:-3] if relative.lower().endswith(".md") else relative
		paths = [
			"/project/nextjs-engine/doc/" + suffix,
			"/product/nextjs-engine/doc/" + suffix,
		]
		if source_path.startswith("docs/3/engine-components/"):
			component_suffix = source_path[len("docs/3/"):]
			component_suffix = component_suffix[:-3] if component_suffix.lower().endswith(".md") else component_suffix
			paths.extend([
				"/project/nextjs-engine/doc/" + component_suffix,
				"/product/nextjs-engine/doc/" + component_suffix,
			])

		gen3_aliases = {
			"docs/3/index.md": ["gen3/overview"],
			"docs/3/compiler-deep-dive.md": ["gen3/phase-a-b", "gen3/build-compiler"],
			"docs/3/networking-credentials-security.md": ["gen3/phase-c-network"],
			"docs/3/compatibility-debugging-hardening.md": ["gen3/phase-d-hardening", "gen3/release-hardening"],
			"docs/3/compiler-rendering-runtime.md": ["gen3/server-first-parity"],
			"docs/3/ne/debug/index.md": ["gen3/engine-debug-isolation"],
		}
		for alias in gen3_aliases.get(source_path, []):
			paths.extend([
				"/project/nextjs-engine/doc/" + alias,
				"/product/nextjs-engine/doc/" + alias,
			])
		if source_path == "docs/3/index.md":
			paths.extend([
				"/project/nextjs-engine/doc/index",
				"/product/nextjs-engine/doc/index",
			])
		return paths

	return []



SHARE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
SHARE_FNV_OFFSET = 0xCBF29CE484222325
SHARE_FNV_PRIME = 0x100000001B3
SHARE_MASK_64 = 0xFFFFFFFFFFFFFFFF
SHARE_MASK_46 = (1 << 46) - 1
ENGINE_SCROLL_OFFSET = -84
ENGINE_SCROLL_DURATION = 550


def encode_page_share_code(project_id: str, slug: str, anchor: str = "top") -> str:
	"""Derive a deterministic 8-char Base62 share code purely from page data (matches lib/shareCode.ts)."""
	clean_slug = slug.strip().strip("/")
	clean_anchor = (anchor or "top").strip() or "top"
	key = f"k8d-v2|{project_id.strip().lower()}|{clean_slug}|{clean_anchor}".encode("utf-8")

	h = SHARE_FNV_OFFSET
	for byte in key:
		h ^= byte
		h = (h * SHARE_FNV_PRIME) & SHARE_MASK_64

	value = (h ^ (h >> 18)) & SHARE_MASK_46
	base = len(SHARE_ALPHABET)
	chars = []
	for _ in range(8):
		chars.append(SHARE_ALPHABET[value % base])
		value //= base
	return "".join(reversed(chars))


def build_engine_scroll_target(project_id: str, slug: str, anchor: str = "top") -> str:
	"""Build the canonical EngineScroll destination URL for a page and anchor parameter."""
	clean_slug = slug.strip().strip("/")
	clean_anchor = (anchor or "top").strip() or "top"
	encoded_anchor = urllib.parse.quote(clean_anchor, safe="")
	return f"/{project_id.strip()}/{clean_slug}#-es?move={encoded_anchor}&offset={ENGINE_SCROLL_OFFSET}&duration={ENGINE_SCROLL_DURATION}"


def build_page_share_links(project_id: str, slug: str, toc: list[dict[str, Any]]) -> list[dict[str, str]]:
	"""Create static /share/<8char> entries for the page top and every TOC heading parameter."""
	seen: set[str] = set()
	links: list[dict[str, str]] = []

	def add_link(anchor: str, title: str) -> None:
		if not anchor or anchor in seen:
			return
		seen.add(anchor)
		code = encode_page_share_code(project_id, slug, anchor)
		links.append({
			"code": code,
			"shareUrl": f"{DOCS_PUBLIC_ORIGIN}/share/{code}",
			"anchor": anchor,
			"title": title,
			"targetUrl": build_engine_scroll_target(project_id, slug, anchor),
		})

	add_link("top", "Top of page")
	for heading in toc:
		hid = str(heading.get("id", "")).strip()
		htitle = str(heading.get("text", hid)).strip() or hid
		add_link(hid, htitle)
	return links

def write_migration_manifest(projects: list[dict[str, Any]], generated_at: str) -> int:
	"""Publish the old Kastrick documentation URL map for the main site to consume."""
	project_entries: list[dict[str, Any]] = []
	redirects_by_source: dict[str, dict[str, str]] = {}
	share_codes: dict[str, dict[str, Any]] = {}

	for project in projects:
		if not project.get("established", False) or not project.get("pages"):
			continue
		pages: list[dict[str, Any]] = []
		for page in project.get("pages", []):
			source_path = page.get("sourcePath", "")
			slug = page.get("slug", "")
			if not slug:
				continue
			path = "/" + project["id"] + "/" + slug.strip("/")
			legacy_paths = legacy_paths_for_page(project["id"], source_path)
			share_links = build_page_share_links(project["id"], slug, page.get("toc", []))
			primary_share = share_links[0]
			entry = {
				"sourcePath": source_path,
				"path": path,
				"url": DOCS_PUBLIC_ORIGIN + path,
				"title": page.get("title", ""),
				"section": page.get("section", "Documentation"),
				"track": page.get("track", "docs"),
				"shareCode": primary_share["code"],
				"shareUrl": primary_share["shareUrl"],
				"shareTargetUrl": primary_share["targetUrl"],
				"shareLinks": share_links,
				"legacyPaths": legacy_paths,
			}
			pages.append(entry)
			for link in share_links:
				share_codes[link["code"]] = {
					"projectId": project["id"],
					"slug": slug.strip("/"),
					"track": page.get("track", "docs"),
					"generation": page.get("generation"),
					"anchor": link["anchor"],
					"title": link["title"],
					"path": path,
					"shareUrl": link["shareUrl"],
					"targetUrl": link["targetUrl"],
				}
			for legacy_path in legacy_paths:
				previous = redirects_by_source.get(legacy_path)
				if previous and previous["to"] != entry["url"]:
					raise ValueError(
						f"Legacy docs URL {legacy_path} maps to two targets: "
						f"{previous['to']} and {entry['url']}"
					)
				redirects_by_source[legacy_path] = {
					"from": legacy_path,
					"to": entry["url"],
					"projectId": project["id"],
					"sourcePath": source_path,
				}
		project_entries.append({
			"id": project["id"],
			"name": project["name"],
			"pages": pages,
		})

	engine_index = next(
		(
			page for project in project_entries if project["id"] == "nextjs-engine"
			for page in project["pages"] if page["sourcePath"] == "docs/3/index.md"
		),
		None,
	)
	engine_fallback = engine_index["url"] if engine_index else DOCS_PUBLIC_ORIGIN + "/nextjs-engine/docs/3/index"
	engine_migration = DOCS_PUBLIC_ORIGIN + "/nextjs-engine/docs/3/migration-from-2x"
	engine_gen2_index = next(
		(
			page for project in project_entries if project["id"] == "nextjs-engine"
			for page in project["pages"] if page["sourcePath"] == "docs/2/index.md"
		),
		None,
	)
	engine_gen2_fallback = engine_gen2_index["url"] if engine_gen2_index else DOCS_PUBLIC_ORIGIN + "/nextjs-engine/docs/2"
	engine_v1_trap = DOCS_PUBLIC_ORIGIN + "/nextjs-engine/v1"
	for legacy_root in (
		"/project/nextjs-engine/doc",
		"/product/nextjs-engine/doc",
	):
		redirects_by_source[legacy_root] = {
			"from": legacy_root,
			"to": engine_fallback,
			"projectId": "nextjs-engine",
			"sourcePath": "docs/3/index.md",
		}

	prefix_fallbacks = [
		{"fromPrefix": "/project/rbe/doc", "to": DOCS_PUBLIC_ORIGIN + "/rbe/doc", "mode": "append-suffix", "projectId": "rbe"},
		{"fromPrefix": "/project/nextjs-engine/doc/1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc/v1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/v1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc/gen1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/gen1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc/gen-1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/gen-1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc/docs/1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/docs/1", "to": engine_v1_trap, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc/2", "to": engine_gen2_fallback, "mode": "append-suffix", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/2", "to": engine_gen2_fallback, "mode": "append-suffix", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc/gen3", "to": engine_fallback, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc/gen3", "to": engine_fallback, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/project/nextjs-engine/doc", "to": engine_fallback, "mode": "fixed", "projectId": "nextjs-engine"},
		{"fromPrefix": "/product/nextjs-engine/doc", "to": engine_fallback, "mode": "fixed", "projectId": "nextjs-engine"},
	]
	payload = {
		"schemaVersion": 2,
		"generatedAt": generated_at,
		"legacyOrigin": LEGACY_SITE_ORIGIN,
		"docsOrigin": DOCS_PUBLIC_ORIGIN,
		"canonicalDocsOrigin": DOCS_CANONICAL_ORIGIN,
		"manifestUrl": DOCS_PUBLIC_ORIGIN + "/share/manifest.json",
		"projects": project_entries,
		"shareCodes": share_codes,
		"redirects": sorted(redirects_by_source.values(), key=lambda item: item["from"]),
		"prefixFallbacks": prefix_fallbacks,
	}
	MIGRATION_MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
	MIGRATION_MANIFEST_FILE.write_text(
		json.dumps(payload, ensure_ascii=False, indent="  ") + "\n",
		encoding="utf-8",
	)
	return len(payload["redirects"])


def slugify(text: str) -> str:
	"""Convert a heading or file stem into a clean URL-safe slug."""
	cleaned = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
	return re.sub(r"[\s_-]+", "-", cleaned) or "overview"


def route_path_from_markdown(source_path: str) -> str:
	"""Preserve the source document path as the public route, omitting only .md."""
	normalized = source_path.replace("\\", "/").strip("/")
	without_extension = normalized[:-3] if normalized.lower().endswith(".md") else normalized
	leaf = posixpath.basename(without_extension).lower()
	if leaf in ("readme", "index"):
		parent = posixpath.dirname(without_extension).strip("/")
		return parent or "overview"
	return without_extension


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


def fetch_repo_markdown_source(
	project: dict[str, Any],
	token: str | None,
	generation: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
	"""Fetch one source branch, optionally annotating pages with a generation."""
	source = {**project, **(generation or {})}
	repo = project["repo"]
	branches = [source.get("branch", "main")]
	fallback = source.get("fallbackBranch")
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

	docs_prefixes = [p.strip("/") for p in source.get("docsPaths", ["doc", "docs", "README.md"])]
	guides_prefixes = [p.strip("/") for p in source.get("guidesPaths", ["guides"])]
	exclude_prefixes = [p.strip("/") for p in source.get("excludePaths", [])]
	section_map: dict[str, str] = source.get("sectionMap", {})
	allowed_prefixes = docs_prefixes + guides_prefixes
	generation_id = generation.get("id") if generation else None
	generation_label = generation.get("label") if generation else None

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
			slug = route_path_from_markdown(rel_path)

			if slug in seen_slugs:
				# Keep ambiguous README/file collisions on their full source path.
				slug = posixpath.splitext(rel_path)[0]
				if slug in seen_slugs:
					raise ValueError(f"Duplicate documentation route `/{project['id']}/{slug}` from {rel_path}")
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
		if stem.lower() in ("readme", "index"):
			title_stem = posixpath.basename(slug) if slug != "overview" else "Overview"
		else:
			title_stem = stem
		fallback_title = title_stem.replace("-", " ").replace("_", " ").replace(".", " ").title()
		title, toc = extract_title_and_toc(rewritten, fallback_title)

		out_file = CONTENT_DIR / project["id"] / track / (slug + ".md")
		out_file.parent.mkdir(parents=True, exist_ok=True)
		out_file.write_text(rewritten, encoding="utf-8")

		page = {
			"slug": slug,
			"track": track,
			"section": section,
			"title": title,
			"sourcePath": rel_path,
			"sourceBranch": used_branch,
			"localFile": str(out_file.relative_to(REPO_ROOT)).replace(chr(92), "/"),
			"toc": toc,
		}
		if generation_id is not None:
			page["generation"] = generation_id
			page["generationLabel"] = generation_label or ("Generation " + str(generation_id))
		pages.append(page)

	print(f"[sync_docs] Synced {len(pages)} {generation_label + ' ' if generation_label else ''}pages for {project['name']} from {used_branch}.")
	return pages


def fetch_repo_markdown(
	project: dict[str, Any],
	token: str | None,
) -> list[dict[str, Any]]:
	"""Fetch each documentation generation independently, with per-generation local fallback."""
	generations = project.get("generations", [])
	if not generations:
		return fetch_repo_markdown_source(project, token)

	pages: list[dict[str, Any]] = []
	missing_generations: list[dict[str, Any]] = []
	for generation in generations:
		generation_pages = fetch_repo_markdown_source(project, token, generation)
		if not generation_pages:
			missing_generations.append(generation)
			print(
				f"[sync_docs] No pages returned for {project['name']} "
				f"{generation.get('label', generation.get('id', 'generation'))} "
				f"from {generation.get('branch', project.get('branch', 'main'))}."
			)
		pages.extend(generation_pages)

	if missing_generations:
		cached_pages = index_local_content(project)
		for generation in missing_generations:
			generation_id = generation.get("id")
			fallback_pages = [page for page in cached_pages if page.get("generation") == generation_id]
			if fallback_pages:
				print(
					f"[sync_docs] Retaining {len(fallback_pages)} cached "
					f"{generation.get('label', 'generation')} pages because its source branch was unavailable."
				)
				pages.extend(fallback_pages)

	return pages


def index_local_content(project: dict[str, Any]) -> list[dict[str, Any]]:
	"""Index local snapshots, reusing source-path metadata from the previous manifest."""
	pages: list[dict[str, Any]] = []
	project_dir = CONTENT_DIR / project["id"]
	if not project_dir.exists():
		return pages

	previous_by_file: dict[str, dict[str, Any]] = {}
	if MANIFEST_FILE.is_file():
		try:
			previous_manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
			for previous_project in previous_manifest.get("projects", []):
				if previous_project.get("id") == project["id"]:
					for previous_page in previous_project.get("pages", []):
						previous_by_file[previous_page.get("localFile", "")] = previous_page
		except (OSError, json.JSONDecodeError, TypeError):
			previous_by_file = {}

	for track in ("docs", "guides"):
		track_dir = project_dir / track
		if not track_dir.exists():
			continue
		for md_file in sorted(track_dir.rglob("*.md")):
			local_file = str(md_file.relative_to(REPO_ROOT)).replace("\\", "/")
			previous = previous_by_file.get(local_file, {})
			source_path = previous.get("sourcePath") or str(md_file.relative_to(track_dir)).replace("\\", "/")
			slug = previous.get("slug") or route_path_from_markdown(source_path)
			content = md_file.read_text(encoding="utf-8")
			stem = Path(source_path).stem
			if stem.lower() in ("readme", "index"):
				title_stem = posixpath.basename(slug) if slug != "overview" else "Overview"
			else:
				title_stem = stem
			fallback_title = title_stem.replace("-", " ").replace("_", " ").replace(".", " ").title()
			title, toc = extract_title_and_toc(content, fallback_title)
			generation = next(
				(
					item for item in project.get("generations", [])
					if any(
						source_path == prefix.strip("/") or source_path.startswith(prefix.strip("/") + "/")
						for prefix in item.get("docsPaths", []) + item.get("guidesPaths", [])
					)
				),
				None,
			)
			section_map = generation.get("sectionMap", {}) if generation else project.get("sectionMap", {})
			page = {
				"slug": slug,
				"track": track,
				"section": previous.get("section") or resolve_section(source_path, section_map, track),
				"title": title,
				"sourcePath": source_path,
				"sourceBranch": previous.get("sourceBranch") or (generation or project).get("branch", "main"),
				"localFile": local_file,
				"toc": toc,
			}
			generation_id = previous.get("generation") or (generation.get("id") if generation else None)
			if generation_id is not None:
				page["generation"] = generation_id
				page["generationLabel"] = previous.get("generationLabel") or generation.get("label", "Generation " + str(generation_id))
			pages.append(page)
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
	print(f"[sync_docs] Wrote per-project full-text search indexes for {search_count} pages to {SEARCH_INDEX_DIR.relative_to(REPO_ROOT)}/.")

	redirect_count = write_migration_manifest(manifest["projects"], manifest["generatedAt"])
	print(f"[sync_docs] Wrote documentation migration manifest with {redirect_count} exact redirects to {MIGRATION_MANIFEST_FILE.relative_to(REPO_ROOT)}.")
	return 0


if __name__ == "__main__":
	sys.exit(main())
