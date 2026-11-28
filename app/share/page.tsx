// app/share/page.tsx — Static share resolver entry point.
// The immutable snapshot itself is fetched by the client from the revisioned CDN URL.

import React from "react";
import ShareResolver from "@/components/ShareResolver";
import { loadManifest, loadShareRegistry } from "@/lib/content";

export default function SharePage() {
	const manifest = loadManifest();
	const registry = loadShareRegistry();
	const projects = manifest.projects.map((project) => ({
		id: project.id,
		generations: project.generations?.map((generation) => ({ id: generation.id })),
		pages: project.pages.map((item) => ({
			slug: item.slug,
			track: item.track,
			generation: item.generation,
			toc: item.toc.map((heading) => ({ id: heading.id })),
		})),
	}));

	return <ShareResolver projects={projects} registryRevision={registry.revision} />;
}
