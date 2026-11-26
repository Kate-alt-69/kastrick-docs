#!/usr/bin/env python3
"""
build.py — Cross-platform Python build runner for kastrick-docs.

Orchestrates the full static documentation build pipeline:
	1. Syncs src/engine/ to the latest GREEN-CI commit of Kastrick8/nextjs-engine.
	2. Fetches live Markdown docs/guides from established repos into static content/.
	3. Runs TypeScript type-checking (`npm run type-check`).
	4. Runs `next build` to emit a 100% static site in ./dist.

Usage:
	python3 scripts/build.py
	python3 scripts/build.py --offline
	python3 scripts/build.py --skip-engine-sync
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def run_step(label: str, cmd: list[str]) -> bool:
	"""Execute a build pipeline command and stream output cleanly."""
	print(f"\n[build] === {label} ===")
	print(f"[build] $ {' '.join(cmd)}")
	result = subprocess.run(cmd, cwd=REPO_ROOT, check=False)
	if result.returncode != 0:
		print(f"[build] Step failed ({label}) with exit code {result.returncode}.")
		return False
	return True


def main() -> int:
	parser = argparse.ArgumentParser(description="Build kastrick-docs statically.")
	parser.add_argument("--offline", action="store_true", help="Skip all remote GitHub sync steps.")
	parser.add_argument("--skip-engine-sync", action="store_true", help="Skip nextjs-engine GREEN-CI sync.")
	parser.add_argument("--force-engine-sync", action="store_true", help="Force engine re-download.")
	args = parser.parse_args()

	py = sys.executable
	npm_cmd = "npm.cmd" if os.name == "nt" else "npm"

	if not args.offline and not args.skip_engine_sync:
		engine_cmd = [py, "scripts/sync_engine.py", "--skip-typecheck"]
		if args.force_engine_sync:
			engine_cmd.append("--force")
		if not run_step("Sync Next.js Engine (Latest GREEN-CI)", engine_cmd):
			return 1

	docs_cmd = [py, "scripts/sync_docs.py"]
	if args.offline:
		docs_cmd.append("--offline")
	if not run_step("Sync Static Build-Time Docs", docs_cmd):
		return 1

	if not run_step("TypeScript Type Check", [npm_cmd, "run", "type-check"]):
		return 1

	if not run_step("Next.js Static Export Build", [npm_cmd, "exec", "next", "build"]):
		return 1

	print("\n[build] Static documentation build completed cleanly in ./dist.")
	return 0


if __name__ == "__main__":
	sys.exit(main())
