// app/[project]/[slug]/page.tsx — Static /<project>/<slug> documentation page.
// Built with NES (Next.js Engine Schema) mounting our custom "kastrick-doc-shell"
// component via createPage({ schema, registry }).

import React from "react";
import { notFound } from "next/navigation";
import { createPage, defineSchema } from "@/engine";
import { getDocsRegistry } from "@/components/EngineDocsComponents";
import { getProject, loadManifest, readPageMarkdown, renderMarkdown } from "@/lib/content";

export function generateStaticParams() {
	const manifest = loadManifest();
	const params: Array<{ project: string; slug: string }> = [];

	for (const project of manifest.projects) {
		if (project.pages.length === 0) {
			params.push({ project: project.id, slug: "overview" });
		} else {
			for (const page of project.pages) {
				params.push({ project: project.id, slug: page.slug });
			}
		}
	}
	return params;
}

export default async function ProjectDocPage({
	params,
}: {
	params: Promise<{ project: string; slug: string }>;
}) {
	const { project: projectId, slug } = await params;
	const manifest = loadManifest();
	const project = getProject(projectId);
	if (!project) {
		notFound();
	}

	const page = project.pages.find((p) => p.slug === slug) ?? null;
	const rawMarkdown = page ? readPageMarkdown(page.localFile) : "";
	const htmlContent = page ? renderMarkdown(rawMarkdown) : "";

	const schema = defineSchema({
		meta: {
			title: `${page?.title ?? project.name} — ${project.name} · Kastrick Docs`,
			description: project.description,
		},
		root: {
			type: "kastrick-doc-shell" as never,
			props: {
				manifestJson: JSON.stringify(manifest),
				projectJson: JSON.stringify(project),
				track: page?.track ?? "docs",
				pageJson: page ? JSON.stringify(page) : "",
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
