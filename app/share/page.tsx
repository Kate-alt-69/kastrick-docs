// app/share/page.tsx — Static share resolver entry point.
// Build-time project/page metadata is passed to a small client component so
// /share/<code> can resolve a project, track, page, and exact reading anchor.

import React from "react";
import ShareResolver from "@/components/ShareResolver";
import { loadManifest } from "@/lib/content";

export default function SharePage() {
	const manifest = loadManifest();
	const projects = manifest.projects.map((project) => ({
		id: project.id,
		pages: project.pages.map((page) => ({
			slug: page.slug,
			track: page.track,
			toc: page.toc.map((item) => ({ id: item.id })),
		})),
	}));

	return <ShareResolver projects={projects} />;
}
