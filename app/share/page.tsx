// app/share/page.tsx — Static /share resolver for /share/<8char> URLs.
// Works cleanly with Next.js `output: "export"` via vercel.json rewrite
// (`/share/:code` -> `/share?c=:code`) or hash (`/share#<8char>`).
// Decodes the 8-char Base62 payload, logs a Vercel Analytics event, and
// redirects to `/<project>/<slug>#-es?move=<target>&offset=-84&duration=550`.

"use client";

import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import projectsData from "@/data/projects.json";
import { decodeShareCode } from "@/lib/shareCode";

export default function ShareResolverPage() {
	const router = useRouter();
	const [status, setStatus] = useState("Resolving EngineScroll share point...");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const fromQuery = params.get("c") ?? params.get("code") ?? "";
		const fromHash = window.location.hash.replace(/^#/, "");
		const pathMatch = window.location.pathname.match(/\/share\/([A-Za-z0-9]{8})/);
		const code = (fromQuery || fromHash || pathMatch?.[1] || "").slice(0, 8);

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

		try {
			track("doc_share_open", {
				code,
				project: project.id,
				track: trackName,
				line: targetAnchor,
				levelPct: decoded.levelPct,
			});
		} catch {
			// Ignore analytics errors if blocked by privacy extensions.
		}

		const destination = `/${project.id}/overview#-es?move=${encodeURIComponent(targetAnchor)}&offset=-84&duration=550`;
		router.replace(destination);
	}, [router]);

	return (
		<main style={{ padding: "4rem 1.5rem", textAlign: "center", color: "#a1a1aa" }}>
			<p>{status}</p>
		</main>
	);
}
