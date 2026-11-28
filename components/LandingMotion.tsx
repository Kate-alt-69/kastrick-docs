"use client";

import { useEffect, useState } from "react";
import { EngineManim, type ManimConfig } from "@/engine";

const NETWORK_PATH =
	"M 240 42 " +
	"L 334 96 L 334 204 L 240 258 L 146 204 L 146 96 Z " +
	"L 240 150 L 334 204 L 240 150 L 146 204 " +
	"L 240 258 L 240 150 L 334 96 L 240 150 L 146 96";

const NETWORK_PATH_ALT =
	"M 240 28 " +
	"L 350 106 L 318 224 L 210 260 L 130 174 L 162 62 Z " +
	"L 240 150 L 318 224 L 240 150 L 130 174 " +
	"L 210 260 L 240 150 L 350 106 L 240 150 L 162 62";

const animation: ManimConfig = {
	settings: {
		loop: true,
		fpsLimit: 30,
		background: "transparent",
	},
	mobjects: [
		{
			id: "network",
			type: "Path",
			d: NETWORK_PATH,
			strokeColor: "#83dcff",
			strokeWidth: 2,
		},
		{
			id: "network-alt",
			type: "Path",
			d: NETWORK_PATH_ALT,
			strokeColor: "#83dcff",
			strokeWidth: 2,
		},
	],
	timeline: [
		{ action: "Create", target: "network", durationMs: 2200, easing: "ease-in-out" },
		{ action: "Wait", durationMs: 1400 },
		{ action: "Transform", origin: "network", target: "network-alt", durationMs: 1600, easing: "ease-in-out" },
		{ action: "Wait", durationMs: 1100 },
		{ action: "Transform", origin: "network-alt", target: "network", durationMs: 1600, easing: "ease-in-out" },
		{ action: "Wait", durationMs: 900 },
	],
};

export default function LandingMotion() {
	const [shouldAnimate, setShouldAnimate] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setShouldAnimate(!media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);

	if (!shouldAnimate) {
		return (
			<div className="kd-home2-motion-fallback" aria-hidden="true">
				<svg viewBox="0 0 480 300" role="presentation">
					<path d={NETWORK_PATH} />
				</svg>
			</div>
		);
	}

	return (
		<EngineManim
			width={480}
			height={300}
			cprop={{ manim: animation }}
			className="kd-home2-motion-canvas"
			style={{ width: "min(100%, 480px)", height: "auto", aspectRatio: "8 / 5" }}
		/>
	);
}
