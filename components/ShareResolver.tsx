"use client";

/**
 * ShareResolver.tsx
 *
 * Resolves static /share/<8char> links against build-time page data only.
 * Builds a deterministic Map<code, target> from each page's top anchor and
 * every TOC heading parameter, then redirects using EngineScroll.
 * Legacy positional bit-packed codes are intentionally rejected.
 */

import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
	buildEngineScrollTarget,
	CANONICAL_DOCS_ORIGIN,
	encodePageShareCode,
	SHARE_LINK_ORIGIN,
} from "@/lib/shareCode";

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
}

interface ShareResolverProps {
	projects: ShareTargetProject[];
}

export default function ShareResolver({ projects }: ShareResolverProps) {
	const router = useRouter();
	const [status, setStatus] = useState<"loading" | "invalid">("loading");
	const [message, setMessage] = useState("Reading the shared page and EngineScroll target.");

	// Build a static O(1) lookup table purely from page data (projectId + slug + anchor).
	const shareLookup = useMemo(() => {
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
					});
				}
			}
		}
		return map;
	}, [projects]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const fromQuery = params.get("c") ?? params.get("code") ?? "";
		const fromHash = window.location.hash.replace(/^#/, "");
		const pathMatch = window.location.pathname.match(/\/share\/([A-Za-z0-9]{8})\/?$/);
		const code = (fromQuery || fromHash || pathMatch?.[1] || "").trim();

		const resolved = code.length === 8 ? shareLookup.get(code) : undefined;
		if (!resolved) {
			setStatus("invalid");
			setMessage("That share code is invalid, retired, or no longer exists in the static manifest.");
			return;
		}

		try {
			track("doc_share_open", {
				code,
				project: resolved.projectId,
				track: resolved.track,
				generation: resolved.generation,
				page: resolved.slug,
				anchor: resolved.anchor,
			});
		} catch {
			// Analytics must never prevent a share link from resolving.
		}

		// Redirect to canonical docs host if opened on the short-link origin.
		if (window.location.hostname === new URL(SHARE_LINK_ORIGIN).hostname) {
			window.location.replace(new URL(resolved.destination, CANONICAL_DOCS_ORIGIN).toString());
			return;
		}

		router.replace(resolved.destination);
	}, [router, shareLookup]);

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
						<div className="kd-share-progress" aria-hidden="true">
							<span />
						</div>
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
