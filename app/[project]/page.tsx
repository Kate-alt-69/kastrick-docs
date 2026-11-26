// app/[project]/page.tsx — Static /<project> landing page built with NES
// (Next.js Engine Schema). Shows the project's original kastrick.vercel.app link
// alongside all statically synced Markdown docs & guides under /<project>/<slug>.

import React from "react";
import { notFound } from "next/navigation";
import { createPage, defineSchema } from "@/engine";
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

	const docsPages = project.pages.filter((p) => p.track === "docs");
	const guidePages = project.pages.filter((p) => p.track === "guides");
	const firstPage = project.pages[0];

	const children: Array<Record<string, unknown>> = [
		{
			type: "stack",
			props: { gap: "0.85rem", mb: "2rem" },
			children: [
				{
					type: "text",
					props: {
						content: `KASTRICK DOCS / ${project.id.toUpperCase()} · ${project.badge}`,
						color: "#38bdf8",
						fontSize: "0.75rem",
						fontWeight: 700,
						letterSpacing: "0.08em",
					},
				},
				{
					type: "heading",
					props: {
						level: 1,
						content: project.name,
						color: "#fafafa",
					},
				},
				{
					type: "text",
					props: {
						content: `This part of the documentation land is for ${project.name}. View more on the original site (${project.originalSiteUrl}) or explore the static documentation right here.`,
						color: "#d4d4d8",
						maxWidth: "760px",
					},
				},
				{
					type: "stack",
					props: { direction: "row", gap: "0.75rem", pt: "0.5rem" },
					children: [
						...(firstPage
							? [
									{
										type: "button",
										props: {
											label: "Start Reading Here",
											href: `/${project.id}/${firstPage.slug}`,
											variant: "primary",
										},
									},
								]
							: []),
						{
							type: "button",
							props: {
								label: `Original Site (${project.name}) ↗`,
								href: project.originalSiteUrl,
								variant: "outline",
							},
						},
						{
							type: "button",
							props: {
								label: "GitHub Repo ↗",
								href: project.repoUrl,
								variant: "outline",
							},
						},
						{
							type: "button",
							props: {
								label: "← All Projects",
								href: "/",
								variant: "outline",
							},
						},
					],
				},
			],
		},
	];

	if (project.rebaseNotice) {
		children.push({
			type: "card",
			props: {
				p: "1.25rem",
				mb: "2rem",
				bg: "rgba(245, 158, 11, 0.12)",
				border: "2px solid rgba(245, 158, 11, 0.45)",
				borderRadius: "12px",
			},
			children: [
				{
					type: "text",
					props: {
						content: project.rebaseNotice,
						color: "#fde68a",
						fontSize: "0.92rem",
					},
				},
			],
		});
	}

	if (!project.established) {
		children.push({
			type: "card",
			props: {
				p: "1.75rem",
				bg: "#111114",
				border: "1px dashed rgba(255,255,255,0.18)",
				borderRadius: "14px",
			},
			children: [
				{
					type: "stack",
					props: { gap: "0.65rem" },
					children: [
						{
							type: "heading",
							props: { level: 2, content: "Status: NOT_EST", color: "#fafafa" },
						},
						{
							type: "text",
							props: {
								content: `${project.description} Once ${project.repo} is established, the build pipeline will automatically download its Markdown documentation and generate static pages under /${project.id}/<doc>.`,
								color: "#a1a1aa",
							},
						},
					],
				},
			],
		});
	} else {
		const buildTrackGrid = (label: string, items: typeof docsPages) => ({
			type: "stack",
			props: { gap: "1rem", mb: "2rem" },
			children: [
				{
					type: "heading",
					props: { level: 2, content: label, color: "#fafafa" },
				},
				{
					type: "grid",
					props: { columns: { xs: 1, md: 2, lg: 3 }, gap: "1rem" },
					children: items.map((item) => ({
						type: "card",
						key: item.slug,
						props: {
							p: "1.15rem",
							bg: "#111114",
							border: "1px solid rgba(255,255,255,0.08)",
							borderRadius: "12px",
						},
						children: [
							{
								type: "stack",
								props: { gap: "0.5rem" },
								children: [
									{
										type: "text",
										props: { content: item.title, color: "#fafafa", fontWeight: 600 },
									},
									{
										type: "text",
										props: {
											content: `/${project.id}/${item.slug} · ${item.sourcePath}`,
											color: "#71717a",
											fontSize: "0.75rem",
										},
									},
									{
										type: "button",
										props: {
											label: "Open Page →",
											href: `/${project.id}/${item.slug}`,
											variant: "outline",
										},
									},
								],
							},
						],
					})),
				},
			],
		});

		const groupedDocs = docsPages.reduce<Record<string, typeof docsPages>>((acc, item) => {
			const sec = item.section || "Documentation";
			(acc[sec] ||= []).push(item);
			return acc;
		}, {});
		for (const [sectionTitle, items] of Object.entries(groupedDocs)) {
			children.push(buildTrackGrid(sectionTitle, items));
		}
		if (guidePages.length > 0) {
			children.push(buildTrackGrid("Guides", guidePages));
		}
	}

	const schema = defineSchema({
		meta: {
			title: `${project.name} — Kastrick Docs`,
			description: project.description,
		},
		root: {
			type: "section",
			props: {
				contentMaxWidth: "1120px",
				px: { xs: "1.25rem", md: "2rem" },
				py: { xs: "3rem", md: "4rem" },
			},
			children: children as never,
		},
	});

	const EnginePage = createPage({ schema });
	return <EnginePage />;
}
