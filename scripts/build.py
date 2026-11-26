#!/usr/bin/env python3
"""
build.py — Cross-platform Python build runner for kastrick-docs.

Orchestrates the full Generation 3 Next.js Engine static build pipeline:
	1. Removes stale legacy route directories that conflict with `output: "export"`.
	2. Syncs src/engine/ and bin/ to the latest GREEN-CI commit of Kastrick8/nextjs-engine.
	3. Fetches live Markdown docs/guides from established repos into static content/.
	4. Runs Gen 3 production preparation (`scripts/gen3-prepare-production.js`).
	5. Runs TypeScript type-checking (`npm run type-check`).
	6. Runs Generation 3 `node bin/ne.js build` (EngineCompiler + Next.js static export).
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

STALE_ROUTE_DIRS = [
	REPO_ROOT / "app" / "share" / "[code]",
	REPO_ROOT / "app" / "docs",
	REPO_ROOT / "app" / "guides",
]


def cleanup_stale_routes() -> None:
	"""Delete leftover legacy route folders that break Next.js static export."""
	for target in STALE_ROUTE_DIRS:
		if target.exists():
			print(f"[build] Removing stale route directory: {target.relative_to(REPO_ROOT)}")
			shutil.rmtree(target)


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
	parser = argparse.ArgumentParser(description="Build kastrick-docs statically with Next.js Engine Gen 3.")
	parser.add_argument("--offline", action="store_true", help="Skip all remote GitHub sync steps.")
	parser.add_argument("--skip-engine-sync", action="store_true", help="Skip nextjs-engine GREEN-CI sync.")
	parser.add_argument("--force-engine-sync", action="store_true", help="Force engine re-download.")
	args = parser.parse_args()

	cleanup_stale_routes()

	py = sys.executable
	npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
	node_cmd = "node.exe" if os.name == "nt" else "node"

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

	prep_script = REPO_ROOT / "scripts" / "gen3-prepare-production.js"
	if prep_script.exists():
		if not run_step("Prepare Generation 3 Production Boundary", [node_cmd, str(prep_script)]):
			return 1

	if not run_step("TypeScript Type Check", [npm_cmd, "run", "type-check"]):
		return 1

	ne_cli = REPO_ROOT / "bin" / "ne.js"
	if ne_cli.exists():
		if not run_step("Next.js Engine Gen 3 Build (ne build / EngineCompiler)", [node_cmd, str(ne_cli), "build"]):
			return 1
	else:
		if not run_step("Next.js Static Export Build", [npm_cmd, "exec", "next", "build"]):
			return 1

	print("\n[build] Static documentation build completed cleanly in ./out.")
	return 0


if __name__ == "__main__":
	sys.exit(main())
