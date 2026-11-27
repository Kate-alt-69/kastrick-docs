// app/[project]/[...slug]/page.tsx — Static nested documentation routes.
// Public paths mirror the source documentation tree, e.g. /rbe/doc/x.route.

import React from "react";
import { notFound } from "next/navigation";
import { createPage, defineSchema } from "@/engine";
import { getDocsRegistry } from "@/components/EngineDocsComponents";
import { getProject, loadManifest, readPageMarkdown, renderMarkdown } from "@/lib/content";

export function generateStaticParams() {
	const manifest = loadManifest();
	const params: Array<{ project: string; slug: string[] }> = [];

	for (const project of manifest.projects) {
		if (project.pages.length === 0) {
			params.push({ project: project.id, slug: ["overview"] });
		} else {
			for (const page of project.pages) {
				params.push({
					project: project.id,
					slug: page.slug.split("/").filter(Boolean),
				});
			}
		}
	}
	return params;
}

export default async function ProjectDocPage({
	params,
}: {
	params: Promise<{ project: string; slug: string[] }>;
}) {
	const { project: projectId, slug: slugSegments } = await params;
	const slug = slugSegments.join("/");
	const manifest = loadManifest();
	const project = getProject(projectId);
	if (!project) {
		notFound();
	}

	const page = project.pages.find((item) => item.slug === slug) ?? null;
	if (!page) {
		notFound();
	}

	const rawMarkdown = readPageMarkdown(page.localFile);
	const htmlContent = renderMarkdown(rawMarkdown);

	const schema = defineSchema({
		meta: {
			title: `${page.title} — ${project.name} · Kastrick Docs`,
			description: project.description,
		},
		root: {
			type: "kastrick-doc-shell" as never,
			props: {
				manifestJson: JSON.stringify(manifest),
				projectJson: JSON.stringify(project),
				track: page.track,
				pageJson: JSON.stringify(page),
				htmlContent,
				rawMarkdown,
			} as never,
		},
	});

	const EnginePage = createPage({
		schema,
		registry: getDocsRegistry(),
	});
	return <EnginePage />;
}
