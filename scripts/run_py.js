#!/usr/bin/env node
// scripts/run_py.js — Cross-platform Python launcher for npm scripts.
// Resolves python3 / python / py -3 cleanly across Windows cmd.exe, PowerShell,
// macOS, Linux, and Vercel build containers.

const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const candidates =
	process.platform === "win32"
		? [
				{ cmd: "python", prefix: [] },
				{ cmd: "py", prefix: ["-3"] },
				{ cmd: "python3", prefix: [] },
			]
		: [
				{ cmd: "python3", prefix: [] },
				{ cmd: "python", prefix: [] },
			];

for (const candidate of candidates) {
	const probe = spawnSync(candidate.cmd, [...candidate.prefix, "--version"], {
		stdio: "ignore",
	});
	if (!probe.error && probe.status === 0) {
		const run = spawnSync(candidate.cmd, [...candidate.prefix, ...args], {
			stdio: "inherit",
		});
		process.exit(run.status ?? 1);
	}
}

console.error("[run_py] Could not find Python 3 on PATH (tried python, python3, py -3).");
process.exit(1);
