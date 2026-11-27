"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type ProgressPhase = "idle" | "loading" | "complete";

export default function NavigationProgress() {
	const pathname = usePathname();
	const [phase, setPhase] = useState<ProgressPhase>("idle");
	const fallbackTimer = useRef<number | null>(null);

	useEffect(() => {
		if (fallbackTimer.current !== null) {
			window.clearTimeout(fallbackTimer.current);
			fallbackTimer.current = null;
		}
		setPhase((current) => current === "loading" ? "complete" : current);
	}, [pathname]);

	useEffect(() => {
		if (phase !== "complete") return;
		const timer = window.setTimeout(() => setPhase("idle"), 320);
		return () => window.clearTimeout(timer);
	}, [phase]);

	useEffect(() => {
		const start = () => {
			if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
			setPhase("loading");
			fallbackTimer.current = window.setTimeout(() => setPhase("complete"), 8000);
		};
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const target = event.target instanceof Element ? event.target : null;
			const anchor = target?.closest<HTMLAnchorElement>("a[href]");
			if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
			const destination = new URL(anchor.href, window.location.href);
			if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
			start();
		};
		const onPopState = () => start();
		const onProgrammaticNavigation = () => start();
		document.addEventListener("click", onClick, true);
		window.addEventListener("popstate", onPopState);
		window.addEventListener("kd:navigation-start", onProgrammaticNavigation);
		return () => {
			document.removeEventListener("click", onClick, true);
			window.removeEventListener("popstate", onPopState);
			window.removeEventListener("kd:navigation-start", onProgrammaticNavigation);
			if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
		};
	}, []);

	if (phase === "idle") return null;

	return (
		<div className={"kd-route-progress" + (phase === "complete" ? " is-complete" : "")} role="progressbar" aria-label="Loading documentation page">
			<span />
		</div>
	);
}
