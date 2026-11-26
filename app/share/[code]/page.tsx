// app/share/[code]/page.tsx — Resolves /share/<8char> URLs to the exact
// documentation page + EngineScroll #-es line/level and records a Vercel
// Analytics event so share counts are tracked automatically.

"use client";

import { track } from "@vercel/analytics";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import projectsData from "@/data/projects.json";
import { decodeShareCode } from "@/lib/shareCode";

export default function ShareResolverPage() {
	const params = useParams<{ code: string }>();
	const router = useRouter();
	const [status, setStatus] = useState("Resolving EngineScroll share point...");

	useEffect(() => {
		const code = typeof params?.code === "string" ? params.code : "";
		const decoded = decodeShareCode(code);
		if (!decoded) {
			setStatus("Invalid or unrecognized 8-character share code.");
			return;
		}

		const project = projectsData.projects[decoded.projectIdx];
		if (!project) {
			setStatus("Target project not found for this share code.");
			return;
		}

		const trackName = decoded.trackIdx === 1 ? "guides" : "docs";
		const targetAnchor = decoded.lineIdx > 0 ? `L${decoded.lineIdx}` : "top";

		// Record share resolution in Vercel Analytics for per-page share metrics.
		try {
			track("doc_share_open", {
				code,
				project: project.id,
				track: trackName,
				line: targetAnchor,
				levelPct: decoded.levelPct,
			});
		} catch {
			// Ignore analytics errors when blocked by browser privacy extensions.
		}

		const destination = `/${trackName}/${project.id}/overview#-es?move=${encodeURIComponent(targetAnchor)}&offset=-84&duration=550`;
		router.replace(destination);
	}, [params, router]);

	return (
		<main className="kd-share-resolve">
			<p>{status}</p>
		</main>
	);
}
