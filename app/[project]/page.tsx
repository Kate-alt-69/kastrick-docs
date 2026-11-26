// app/[project]/page.tsx — Shared project landing route rendered through NES.

import React from "react";
import { notFound } from "next/navigation";
import { createPage, defineSchema } from "@/engine";
import { getDocsRegistry } from "@/components/EngineDocsComponents";
import { getProject, loadManifest } from "@/lib/content";

export function generateStaticParams() {
	return loadManifest().projects.map((project) => ({ project: project.id }));
}

export default async function ProjectLandingPage({
	params,
}: {
	params: Promise<{ project: string }>;
}) {
	const { project: projectId } = await params;
	const project = getProject(projectId);
	if (!project) {
		notFound();
	}

	const schema = defineSchema({
		meta: {
			title: `${project.name} — Kastrick Docs`,
			description: project.description,
		},
		root: {
			type: "kastrick-project-landing" as never,
			props: {
				projectJson: JSON.stringify(project),
			} as never,
		},
	});

	const EnginePage = createPage({
		schema,
		registry: getDocsRegistry(),
	});
	return <EnginePage />;
}
