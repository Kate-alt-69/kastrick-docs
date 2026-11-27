"use client";

import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
	CANONICAL_DOCS_ORIGIN,
	decodeShareCode,
	SHARE_HEADING_ANCHOR_BASE,
	SHARE_LINK_ORIGIN,
} from "@/lib/shareCode";

interface ShareTargetPage {
	slug: string;
	track: "docs" | "guides";
	toc: Array<{ id: string }>;
}

interface ShareTargetProject {
	id: string;
	pages: ShareTargetPage[];
}

interface ShareResolverProps {
	projects: ShareTargetProject[];
}

export default function ShareResolver({ projects }: ShareResolverProps) {
	const router = useRouter();
	const [status, setStatus] = useState<"loading" | "invalid">("loading");
	const [message, setMessage] = useState("Reading the shared page and scroll position.");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const fromQuery = params.get("c") ?? params.get("code") ?? "";
		const fromHash = window.location.hash.replace(/^#/, "");
		const pathMatch = window.location.pathname.match(/\/share\/([A-Za-z0-9]{8})\/?$/);
		const code = (fromQuery || fromHash || pathMatch?.[1] || "").trim();

		const decoded = decodeShareCode(code);
		if (!decoded) {
			setStatus("invalid");
			setMessage("That share code is invalid or has expired.");
			return;
		}

		const project = projects[decoded.projectIdx];
		if (!project) {
			setStatus("invalid");
			setMessage("The project referenced by this share link could not be found.");
			return;
		}

		const trackName = decoded.trackIdx === 1 ? "guides" : "docs";
		const trackPages = project.pages.filter((page) => page.track === trackName);
		const targetPage = trackPages[decoded.pageIdx];
		if (!targetPage) {
			setStatus("invalid");
			setMessage("The page referenced by this share link is no longer in the documentation index.");
			return;
		}

		let targetAnchor = "top";
		if (decoded.lineIdx >= SHARE_HEADING_ANCHOR_BASE) {
			const heading = targetPage.toc[decoded.lineIdx - SHARE_HEADING_ANCHOR_BASE];
			if (!heading) {
				setStatus("invalid");
				setMessage("The heading referenced by this share link could not be found.");
				return;
			}
			targetAnchor = heading.id;
		} else if (decoded.lineIdx > 0) {
			targetAnchor = "L" + decoded.lineIdx;
		}

		try {
			track("doc_share_open", {
				code,
				project: project.id,
				track: trackName,
				page: targetPage.slug,
				line: targetAnchor,
				levelPct: decoded.levelPct,
			});
		} catch {
			// Analytics must never prevent a share link from resolving.
		}

		const destination =
			"/" + project.id + "/" + targetPage.slug +
			"#-es?move=" + encodeURIComponent(targetAnchor) +
			"&offset=-84&duration=550";

		// Vercel also redirects /share/<code> at the edge. Keep this fallback so
		// query-style or client-routed share links opened on the short host still
		// land on the canonical documentation domain.
		if (window.location.hostname === new URL(SHARE_LINK_ORIGIN).hostname) {
			window.location.replace(new URL(destination, CANONICAL_DOCS_ORIGIN).toString());
			return;
		}

		router.replace(destination);
	}, [projects, router]);

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
						<p className="kd-share-footnote">Taking you to the exact reading spot</p>
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
