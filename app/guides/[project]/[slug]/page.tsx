// app/guides/[project]/[slug]/page.tsx — Static per-build Guides track route.

import React from "react";
import { notFound } from "next/navigation";
import DocsShell from "@/components/DocsShell";
import { getProject, loadManifest, readPageMarkdown, renderMarkdown } from "@/lib/content";

export function generateStaticParams() {
	const manifest = loadManifest();
	const params: Array<{ project: string; slug: string }> = [];

	for (const project of manifest.projects) {
		const guidePages = project.pages.filter((p) => p.track === "guides");
		if (guidePages.length === 0) {
			params.push({ project: project.id, slug: "overview" });
		} else {
			for (const page of guidePages) {
				params.push({ project: project.id, slug: page.slug });
			}
		}
	}
	return params;
}

export default async function ProjectGuidePage({
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

	const page = project.pages.find((p) => p.track === "guides" && p.slug === slug) ?? null;
	const rawMarkdown = page ? readPageMarkdown(page.localFile) : "";
	const htmlContent = page ? renderMarkdown(rawMarkdown) : "";

	return (
		<DocsShell
			manifest={manifest}
			project={project}
			track="guides"
			page={page}
			htmlContent={htmlContent}
			rawMarkdown={rawMarkdown}
		/>
	);
}
