// app/not-found.tsx — Custom Three.js 404 fake-out page for Kastrick Documentation.

import React from "react";
import projectsConfig from "@/data/projects.json";
import DocsNotFoundScene, { type DocsProjectSummary } from "@/components/DocsNotFoundScene";

export default function NotFound() {
	const projects: DocsProjectSummary[] = projectsConfig.projects.map((project) => ({
		id: project.id,
		name: project.name,
		established: Boolean(project.established),
		status: project.status,
		description: project.description,
		accentColor: project.accentColor,
	}));

	return <DocsNotFoundScene projects={projects} />;
}
