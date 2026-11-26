#!/usr/bin/env python3
"""
sync_engine.py — Automatic GREEN-CI Next.js Engine synchronizer for kastrick-docs.

Queries GitHub Actions on Kastrick8/nextjs-engine to locate the latest commit
whose CI workflow completed with conclusion == "success", compares its SHA
against .engine-sync.json, and atomically updates src/engine/ when newer.

Usage:
	python3 scripts/sync_engine.py
	python3 scripts/sync_engine.py --check
	python3 scripts/sync_engine.py --force --branch main-3
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
LOCK_FILE = REPO_ROOT / ".engine-sync.json"
ENGINE_DIR = REPO_ROOT / "src" / "engine"

DEFAULT_REPO = "Kastrick8/nextjs-engine"
DEFAULT_BRANCH = "main-3"
FALLBACK_BRANCH = "main"
USER_AGENT = "kastrick-docs-engine-sync/1.0 (+https://github.com/Kate-alt-69/kastrick-docs)"


def build_headers(token: str | None) -> dict[str, str]:
	"""Build GitHub REST API request headers with optional bearer auth."""
	headers = {
		"Accept": "application/vnd.github+json",
		"User-Agent": USER_AGENT,
		"X-GitHub-Api-Version": "2022-11-28",
	}
	if token:
		headers["Authorization"] = f"Bearer {token}"
	return headers


def github_get_json(url: str, token: str | None) -> dict[str, Any]:
	"""Perform a GET request against the GitHub API and return parsed JSON."""
	req = urllib.request.Request(url, headers=build_headers(token))
	with urllib.request.urlopen(req, timeout=25) as resp:
		return json.loads(resp.read().decode("utf-8"))


def find_latest_green_commit(
	repo: str,
	branch: str,
	fallback_branch: str,
	token: str | None,
) -> dict[str, Any] | None:
	"""
	Find the most recent commit on `branch` (or `fallback_branch`) that has a
	completed GitHub Actions workflow run with conclusion == "success".
	"""
	branches_to_try = [branch]
	if fallback_branch and fallback_branch != branch:
		branches_to_try.append(fallback_branch)

	for target_branch in branches_to_try:
		url = (
			f"https://api.github.com/repos/{repo}/actions/runs"
			f"?branch={target_branch}&status=completed&per_page=20"
		)
		try:
			payload = github_get_json(url, token)
		except urllib.error.HTTPError as exc:
			print(f"[sync_engine] HTTP {exc.code} querying {target_branch}: {exc.reason}")
			continue
		except urllib.error.URLError as exc:
			print(f"[sync_engine] Network error querying {target_branch}: {exc.reason}")
			return None

		runs = payload.get("workflow_runs", [])
		for run in runs:
			# Accept only verified green CI runs (never cancelled/skipped/failed).
			if run.get("conclusion") == "success" and run.get("head_sha"):
				return {
					"repo": repo,
					"branch": target_branch,
					"sha": run["head_sha"],
					"run_id": run.get("id"),
					"workflow_name": run.get("name", "CI"),
					"html_url": run.get("html_url", f"https://github.com/{repo}/actions"),
					"completed_at": run.get("updated_at") or run.get("created_at"),
				}

	return None


def load_lockfile() -> dict[str, Any]:
	"""Load the local .engine-sync.json lockfile if present."""
	if not LOCK_FILE.exists():
		return {}
	try:
		return json.loads(LOCK_FILE.read_text(encoding="utf-8"))
	except (OSError, json.JSONDecodeError):
		return {}


def save_lockfile(data: dict[str, Any]) -> None:
	"""Persist updated sync metadata to .engine-sync.json using tab indentation."""
	LOCK_FILE.write_text(json.dumps(data, indent="\t") + "\n", encoding="utf-8")


def download_and_extract_engine(repo: str, sha: str, token: str | None) -> bool:
	"""
	Download the zip archive for the verified green commit SHA and atomically
	replace src/engine/ if the archive contains a valid engine directory.
	"""
	archive_url = f"https://api.github.com/repos/{repo}/zipball/{sha}"
	req = urllib.request.Request(archive_url, headers=build_headers(token))

	with urllib.request.urlopen(req, timeout=60) as resp:
		raw_bytes = resp.read()

	with tempfile.TemporaryDirectory(prefix="kastrick_engine_sync_") as tmp_str:
		tmp_dir = Path(tmp_str)
		with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
			zf.extractall(tmp_dir)

		# GitHub zipballs unpack into a single top-level directory (<org>-<repo>-<sha>).
		extracted_roots = [p for p in tmp_dir.iterdir() if p.is_dir()]
		if not extracted_roots:
			print("[sync_engine] Archive was empty; aborting update.")
			return False

		repo_root = extracted_roots[0]
		candidate_paths = [
			repo_root / "src" / "engine",
			repo_root / "src",
		]
		source_engine = next((p for p in candidate_paths if p.exists() and p.is_dir()), None)
		if source_engine is None:
			print("[sync_engine] No src/engine directory found in archive; keeping current copy.")
			return False

		backup_dir = tmp_dir / "engine_backup"
		if ENGINE_DIR.exists():
			shutil.copytree(ENGINE_DIR, backup_dir)

		try:
			if ENGINE_DIR.exists():
				shutil.rmtree(ENGINE_DIR)
			ENGINE_DIR.parent.mkdir(parents=True, exist_ok=True)
			shutil.copytree(source_engine, ENGINE_DIR)
		except OSError as exc:
			print(f"[sync_engine] Failed to replace src/engine: {exc}; restoring backup.")
			if ENGINE_DIR.exists():
				shutil.rmtree(ENGINE_DIR)
			if backup_dir.exists():
				shutil.copytree(backup_dir, ENGINE_DIR)
			return False

	return True


def run_typecheck() -> bool:
	"""Run TypeScript type checking after syncing to verify compatibility."""
	npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
	try:
		result = subprocess.run(
			[npm_cmd, "run", "type-check"],
			cwd=REPO_ROOT,
			check=False,
		)
		return result.returncode == 0
	except FileNotFoundError:
		print("[sync_engine] npm not found on PATH; skipping post-sync type-check.")
		return True


def parse_args() -> argparse.Namespace:
	"""Parse CLI flags for manual or CI invocation."""
	parser = argparse.ArgumentParser(
		description="Sync src/engine/ to the latest GREEN-CI commit of Kastrick8/nextjs-engine."
	)
	parser.add_argument("--repo", default=DEFAULT_REPO, help="Target GitHub repo (owner/name).")
	parser.add_argument("--branch", default=DEFAULT_BRANCH, help="Primary branch to track.")
	parser.add_argument("--fallback-branch", default=FALLBACK_BRANCH, help="Fallback branch.")
	parser.add_argument("--check", action="store_true", help="Check only; do not modify files.")
	parser.add_argument("--force", action="store_true", help="Force re-download even if SHA matches.")
	parser.add_argument("--skip-typecheck", action="store_true", help="Skip npm run type-check.")
	return parser.parse_args()


def main() -> int:
	args = parse_args()
	token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
	current_lock = load_lockfile()

	print(f"[sync_engine] Checking latest GREEN-CI build for {args.repo} ({args.branch})...")
	green_run = find_latest_green_commit(args.repo, args.branch, args.fallback_branch, token)

	if green_run is None:
		print(
			"[sync_engine] Could not fetch a green CI run (offline, rate-limited, or no runs yet). "
			"Keeping existing local engine snapshot."
		)
		return 0

	latest_sha = green_run["sha"]
	pinned_sha = current_lock.get("sha")
	short_latest = latest_sha[:8]
	short_pinned = pinned_sha[:8] if pinned_sha else "none"

	print(
		f"[sync_engine] Latest GREEN-CI commit: {short_latest} "
		f"(branch: {green_run['branch']}, workflow: {green_run['workflow_name']})"
	)

	if pinned_sha == latest_sha and not args.force:
		print(f"[sync_engine] Already up to date at {short_pinned}.")
		return 0

	if args.check:
		print(f"[sync_engine] Update available: {short_pinned} -> {short_latest}")
		return 0

	print(f"[sync_engine] Updating engine: {short_pinned} -> {short_latest}...")
	ok = download_and_extract_engine(args.repo, latest_sha, token)
	if not ok:
		return 1

	green_run["synced_at"] = datetime.now(timezone.utc).isoformat()
	save_lockfile(green_run)
	print(f"[sync_engine] Synced successfully and updated {LOCK_FILE.name}.")

	if not args.skip_typecheck:
		if not run_typecheck():
			print("[sync_engine] Warning: type-check reported errors after engine sync.")
			return 1

	return 0


if __name__ == "__main__":
	sys.exit(main())
