"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SIMULATED_LINES = [
	{ value: "[DOX] subject ........ YOU", tone: "danger" },
	{ value: "[DOX] address ........ 127.0.0.1  [LOOPBACK / SIMULATED]", tone: "" },
	{ value: "[DOX] location ....... THE VOID  [FICTIONAL]", tone: "" },
	{ value: "[DOX] camera ........ NOT ACCESSED", tone: "muted" },
	{ value: "[DOX] microphone .... NOT ACCESSED", tone: "muted" },
	{ value: "[DOX] filesystem ..... NOT ACCESSED", tone: "muted" },
	{ value: "[DOX] outbound data .. 0 BYTES", tone: "danger" },
	{ value: "[DOX] uplink ......... DISCONNECTED", tone: "danger" },
];

export default function GenerationOneEasterEgg() {
	const [stage, setStage] = useState(0);

	useEffect(() => {
		const timers = [
			window.setTimeout(() => setStage(1), 1900),
			window.setTimeout(() => setStage(2), 4100),
			window.setTimeout(() => setStage(3), 6200),
			window.setTimeout(() => setStage(4), 9800),
		];
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, []);

	return (
		<main className={`kd-v1-root ${stage >= 4 ? "is-revealed" : ""}`}>
			<section className="kd-v1-screen" aria-labelledby="kd-v1-title">
				<p className="kd-v1-eyebrow">K8D / ARCHIVE ACCESS / GENERATION 1</p>
				<h1 className="kd-v1-status" id="kd-v1-title" aria-live="polite">
					{stage === 0 && "Nothing happened here..."}
					{stage === 1 && "you weren't supposed to be here."}
					{stage === 2 && "DOX PROTOCOL // STARTED"}
					{stage >= 3 && "IDENTITY TRACE / COMPLETE"}
				</h1>
				<p className="kd-v1-subline">
					{stage === 0 && "There is nothing to see in this archive."}
					{stage === 1 && "This route was not included in the public index."}
					{stage === 2 && "Initialising a completely fictional terminal sequence..."}
					{stage >= 3 && "SIMULATION OUTPUT — STATIC / LOCAL TO THIS PAGE"}
				</p>

				{stage >= 3 && (
					<div className="kd-v1-terminal" role="log" aria-label="Fictional simulated trace output">
						{SIMULATED_LINES.map((line, index) => (
							<span
								className={`kd-v1-terminal-line ${line.tone ? "is-" + line.tone : ""}`}
								key={line.value}
								style={{ animationDelay: `${index * 85}ms` }}
							>
								{line.value}
							</span>
						))}
					</div>
					)}

				{stage >= 4 && (
					<div className="kd-v1-reveal">
						<strong>Relax. You found the easter egg.</strong>
						This was a scripted visual joke. No personal information was collected, recorded, or sent.
						Camera, microphone, files, and location were never accessed.
					</div>
				)}

				{stage >= 4 && (
					<nav className="kd-v1-links" aria-label="Return to supported documentation">
						<Link href="/nextjs-engine/docs/3">Generation 3 documentation ↗</Link>
						<Link href="/nextjs-engine/docs/2">Generation 2 archive ↗</Link>
						<Link href="/nextjs-engine">Engine overview ↗</Link>
					</nav>
				)}
			</section>
		</main>
	);
}
