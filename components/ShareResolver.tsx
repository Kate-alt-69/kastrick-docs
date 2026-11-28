"use client";

import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
	buildEngineScrollTarget,
	CANONICAL_DOCS_ORIGIN,
	encodePageShareCode,
	SHARE_LINK_ORIGIN,
	decodeLegacyShareCode,
} from "@/lib/shareCode";
import { decodeShareState, ENGINE_SCROLL_PRESETS } from "@/lib/shareState";
import type { ShareRegistry, ShareRegistryDocument } from "@/lib/content";

interface ShareTargetPage {
	slug: string;
	track: "docs" | "guides";
	generation?: string;
	toc: Array<{ id: string }>;
}

interface ShareTargetProject {
	id: string;
	generations?: Array<{ id: string }>;
	pages: ShareTargetPage[];
}

interface ResolvedShareTarget {
	projectId: string;
	slug: string;
	track: "docs" | "guides";
	generation: string;
	anchor: string;
	destination: string;
	format: "positional-v1" | "fnv-v2" | "state-v1";
}

interface ShareResolverProps {
	projects: ShareTargetProject[];
	registryRevision: string;
}

function buildStateDestination(
	document: ShareRegistryDocument,
	decoded: NonNullable<ReturnType<typeof decodeShareState>>["state"],
): string {
	const target = decoded.target;
	let move = "top";
	let fallbackPercent: number | undefined;

	switch (target.mode) {
		case "top":
		case "bottom":
			move = target.mode;
			break;
		case "anchor": {
			const resolvedAnchor = document.anchorsById[String(target.anchorId)];
			const percent = target.scrollPercent ?? 0;
			if (resolvedAnchor) {
				move = resolvedAnchor;
			} else if (percent > 0) {
				move = "percent";
				fallbackPercent = percent;
			}
			break;
		}
		case "line":
			move = "L" + target.line;
			break;
		case "percent":
			move = "percent";
			fallbackPercent = target.scrollPercent;
			break;
	}

	const duration = ENGINE_SCROLL_PRESETS.duration[decoded.engineScroll.duration];
	const alignment = ["clear", "tight", "center", "flush"][decoded.engineScroll.alignment];
	const params = new URLSearchParams({
		move,
		duration: String(duration),
		align: alignment,
		highlight: decoded.engineScroll.highlight ? "1" : "0",
	});
	if (fallbackPercent !== undefined) params.set("percent", String(fallbackPercent));
	return "/" + document.projectId + "/" + document.slug + "#-es?" + params.toString();
}

function isShareRegistry(value: unknown, revision: string): value is ShareRegistry {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ShareRegistry>;
	return candidate.schemaVersion === 1 &&
		candidate.revision === revision &&
		!!candidate.documentsById &&
		typeof candidate.documentsById === "object";
}

export default function ShareResolver({ projects, registryRevision }: ShareResolverProps) {
	const router = useRouter();
	const [status, setStatus] = useState<"loading" | "invalid">("loading");
	const [message, setMessage] = useState("Reading the shared page and EngineScroll target.");

	// Current deterministic FNV tokens are rebuilt from the static page manifest.
	const fnvLookup = useMemo(() => {
		const map = new Map<string, ResolvedShareTarget>();
		for (const project of projects) {
			for (const page of project.pages) {
				const anchors = ["top", ...page.toc.map((heading) => heading.id)];
				for (const anchor of anchors) {
					if (!anchor) continue;
					const code = encodePageShareCode(project.id, page.slug, anchor);
					if (map.has(code)) continue;
					map.set(code, {
						projectId: project.id,
						slug: page.slug,
						track: page.track,
						generation: page.generation ?? "unversioned",
						anchor,
						destination: buildEngineScrollTarget(project.id, page.slug, anchor),
						format: "fnv-v2",
					});
				}
			}
		}
		return map;
	}, [projects]);

	useEffect(() => {
		let cancelled = false;

		const resolve = async () => {
			const params = new URLSearchParams(window.location.search);
			const fromQuery = params.get("c") ?? params.get("code") ?? "";
			const fromHash = window.location.hash.replace(/^#/, "");
			const pathMatch = window.location.pathname.match(/\/share\/([A-Za-z0-9]{8}|[A-Za-z0-9]{10})\/?$/);
			const code = (fromQuery || fromHash || pathMatch?.[1] || "").trim();
			let resolved: ResolvedShareTarget | undefined;

			if (code.length === 10) {
				const decoded = decodeShareState(code);
				if (decoded) {
					const response = await fetch("/share/registry." + encodeURIComponent(registryRevision) + ".json", {
						cache: "force-cache",
					});
					if (!response.ok) throw new Error("The shared registry snapshot is unavailable.");
					const registryPayload: unknown = await response.json();
					if (!isShareRegistry(registryPayload, registryRevision)) {
						throw new Error("The shared registry snapshot does not match this deployment.");
					}
					const document = registryPayload.documentsById[decoded.where];
					if (document) {
						const destination = buildStateDestination(document, decoded.state);
						let anchor = "top";
						if (decoded.state.target.mode === "bottom") anchor = "bottom";
						else if (decoded.state.target.mode === "line") anchor = "L" + decoded.state.target.line;
						else if (decoded.state.target.mode === "percent") anchor = "percent:" + decoded.state.target.scrollPercent;
						else if (decoded.state.target.mode === "anchor") {
							anchor = document.anchorsById[String(decoded.state.target.anchorId)]
								?? "percent:" + (decoded.state.target.scrollPercent ?? 0);
						}
						resolved = {
							projectId: document.projectId,
							slug: document.slug,
							track: document.track,
							generation: document.generation,
							anchor,
							destination,
							format: "state-v1",
						};
					}
				}
			} else if (code.length === 8) {
				// Prefer the FNV generation; only then try the original positional encoding.
				resolved = fnvLookup.get(code);
				if (!resolved) {
					const legacy = decodeLegacyShareCode(code);
					if (legacy) {
						const project = projects[legacy.projectIdx];
						const trackName = legacy.trackIdx === 1 ? "guides" : "docs";
						const trackPages = project?.pages.filter((page) => page.track === trackName) ?? [];
						const targetPage = trackPages[legacy.pageIdx];
						if (project && targetPage) {
							let anchor = "top";
							if (legacy.lineIdx >= 2048) {
								const heading = targetPage.toc[legacy.lineIdx - 2048];
								if (!heading) {
									if (!cancelled) {
										setStatus("invalid");
										setMessage("The heading referenced by this archived share link no longer exists.");
									}
									return;
								}
								anchor = heading.id;
							} else if (legacy.lineIdx > 0) {
								anchor = "L" + legacy.lineIdx;
							}
							resolved = {
								projectId: project.id,
								slug: targetPage.slug,
								track: trackName,
								generation: targetPage.generation ?? "unversioned",
								anchor,
								destination: buildEngineScrollTarget(project.id, targetPage.slug, anchor),
								format: "positional-v1",
							};
						}
					}
				}
			}

			if (cancelled) return;
			if (!resolved) {
				setStatus("invalid");
				setMessage("That share code is invalid, retired, or no longer exists in the generated registry.");
				return;
			}

			try {
				track("doc_share_open", {
					code,
					format: resolved.format,
					project: resolved.projectId,
					track: resolved.track,
					generation: resolved.generation,
					page: resolved.slug,
					anchor: resolved.anchor,
				});
			} catch {
				// Analytics must never prevent a share link from resolving.
			}

			if (window.location.hostname === new URL(SHARE_LINK_ORIGIN).hostname) {
				window.location.replace(new URL(resolved.destination, CANONICAL_DOCS_ORIGIN).toString());
				return;
			}
			router.replace(resolved.destination);
		};

		void resolve().catch((error: unknown) => {
			if (cancelled) return;
			setStatus("invalid");
			setMessage(error instanceof Error ? error.message : "Could not load the share registry.");
		});
		return () => { cancelled = true; };
	}, [fnvLookup, projects, registryRevision, router]);

	return (
		<main className="kd-share-resolver">
			<div className="kd-share-resolver-card">
				{status === "loading" ? (
					<>
						<div className="kd-share-loader" role="status" aria-label="Loading shared documentation">
							<span className="kd-share-loader-orbit kd-share-loader-orbit-one" />
							<span className="kd-share-loader-orbit kd-share-loader-orbit-two" />
							<span className="kd-share-loader-core" />
							<span className="kd-share-loader-spark kd-share-loader-spark-one" />
							<span className="kd-share-loader-spark kd-share-loader-spark-two" />
						</div>
						<p className="kd-share-eyebrow">KASTRICK DOCS / SHARE</p>
						<h1>Please wait<span className="kd-share-ellipsis" aria-hidden="true">...</span></h1>
						<p className="kd-share-message">{message}</p>
						<div className="kd-share-progress" aria-hidden="true"><span /></div>
						<p className="kd-share-footnote">Taking you to the exact EngineScroll section</p>
					</>
				) : (
					<>
						<div className="kd-share-error-mark" aria-hidden="true">!</div>
						<p className="kd-share-eyebrow">KASTRICK DOCS / SHARE</p>
						<h1>Link not found</h1>
						<p className="kd-share-message">{message}</p>
						<a className="kd-share-back-link" href="/">Back to documentation home ↗</a>
					</>
				)}
			</div>
		</main>
	);
}
