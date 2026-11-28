// app/page.tsx — Public landing page for the Kastrick engineering ecosystem.

import { createPage, defineSchema } from "@/engine";
import { getDocsRegistry } from "@/components/EngineDocsComponents";
import type { LandingSiteData } from "@/components/LandingHero";
import { loadManifest } from "@/lib/content";

const source = loadManifest();

/**
 * Keep the public landing-page payload intentionally small. Documentation
 * reader state (including share identities and anchor mappings) belongs to
 * the reader, not to the site-wide homepage.
 */
const landingData: LandingSiteData = {
	license: {
		name: source.license.name,
		url: source.license.url,
	},
	projects: source.projects.map((project) => {
		const currentGeneration = project.generations?.[0];
		const startPage = currentGeneration
			? project.pages.find((page) =>
				page.generation === currentGeneration.id && page.slug === currentGeneration.defaultSlug
			)
				?? project.pages.find((page) =>
					page.generation === currentGeneration.id && page.track === "docs"
				)
			: project.pages.find((page) => page.track === "docs") ?? project.pages[0];
		const firstGuide = project.pages.find((page) => page.track === "guides");

		return {
			id: project.id,
			name: project.name,
			description: project.description,
			repo: project.repo,
			repoUrl: project.repoUrl,
			originalSiteUrl: project.originalSiteUrl,
			established: project.established,
			status: project.status,
			badge: project.badge === "NOT_EST" ? "" : project.badge,
			version: project.version === "NOT_EST" ? "" : project.version,
			accentColor: project.accentColor ?? "#70d9ff",
			referenceCount: project.pages.filter((page) => page.track === "docs").length,
			guideCount: project.pages.filter((page) => page.track === "guides").length,
			pageCount: project.pages.length,
			generationLabels: project.generations?.map((generation) => generation.label) ?? [],
			startHref: startPage ? `/${project.id}/${startPage.slug}` : `/${project.id}`,
			guideHref: firstGuide ? `/${project.id}/${firstGuide.slug}` : undefined,
		};
	}),
};

const HomeSchema = defineSchema({
	meta: {
		title: "Kastrick — Engineering, made readable",
		description:
			"Explore the Kastrick engineering ecosystem: systems software, web tooling, packaging infrastructure, creator utilities, and the documentation behind them.",
	},
	root: {
		type: "kastrick-landing" as never,
		props: {
			landingDataJson: JSON.stringify(landingData),
		} as never,
	},
});

export default createPage({
	schema: HomeSchema,
	registry: getDocsRegistry(),
});
