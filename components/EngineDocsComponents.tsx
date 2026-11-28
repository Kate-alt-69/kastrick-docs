// components/EngineDocsComponents.tsx — Registers Kastrick Docs custom components
// with Next.js Engine Generation 3 using createComponent({ mode: "custom" }) and
// a scoped createEngineComponentRegistry() for server-first static rendering.

import React from "react";
import { createComponent, createEngineComponentRegistry } from "@/engine";
import DocsShell from "@/components/DocsShell";
import LandingHero, { type LandingSiteData } from "@/components/LandingHero";
import ProjectLanding from "@/components/ProjectLanding";
import type { DocPageMeta, DocTrack, DocsManifest, ProjectRecord } from "@/lib/content";

interface DocShellNodeProps {
	manifestJson: string;
	projectJson: string;
	track: DocTrack;
	pageJson: string;
	htmlContent: string;
	rawMarkdown: string;
}

interface LandingNodeProps {
	landingDataJson: string;
}

interface ProjectLandingNodeProps {
	projectJson: string;
}

/** Adapter bridging serializable NES schema props into DocsShell. */
function KastrickDocShellAdapter({
	manifestJson,
	projectJson,
	track,
	pageJson,
	htmlContent,
	rawMarkdown,
}: DocShellNodeProps) {
	const manifest = JSON.parse(manifestJson) as DocsManifest;
	const project = JSON.parse(projectJson) as ProjectRecord;
	const page = pageJson ? (JSON.parse(pageJson) as DocPageMeta) : null;

	return (
		<DocsShell
			manifest={manifest}
			project={project}
			track={track}
			page={page}
			htmlContent={htmlContent}
			rawMarkdown={rawMarkdown}
		/>
	);
}

/** Adapter bridging the small public landing payload into LandingHero. */
function KastrickLandingAdapter({ landingDataJson }: LandingNodeProps) {
	const landingData = JSON.parse(landingDataJson) as LandingSiteData;
	return <LandingHero data={landingData} />;
}

/** Adapter for each source-driven project index page. */
function KastrickProjectLandingAdapter({ projectJson }: ProjectLandingNodeProps) {
	const project = JSON.parse(projectJson) as ProjectRecord;
	return <ProjectLanding project={project} />;
}

/** Official Next.js Engine Gen 3 custom component for static repository docs. */
export const KastrickDocShellComponent = createComponent({
	mode: "custom",
	id: "kastrick-doc-shell",
	component: KastrickDocShellAdapter as unknown as React.ComponentType<Record<string, unknown>>,
	props: {
		manifestJson: { type: "string", required: true },
		projectJson: { type: "string", required: true },
		track: { type: "string", required: true, enum: ["docs", "guides"] },
		pageJson: { type: "string", required: false },
		htmlContent: { type: "string", required: true },
		rawMarkdown: { type: "string", required: true },
	},
	strictProps: false,
});

/** Official Next.js Engine Gen 3 custom component for the public landing page. */
export const KastrickLandingComponent = createComponent({
	mode: "custom",
	id: "kastrick-landing",
	component: KastrickLandingAdapter as unknown as React.ComponentType<Record<string, unknown>>,
	props: {
		landingDataJson: { type: "string", required: true },
	},
	strictProps: false,
});

/** Shared NES component used by every /<project> landing page. */
export const KastrickProjectLandingComponent = createComponent({
	mode: "custom",
	id: "kastrick-project-landing",
	component: KastrickProjectLandingAdapter as unknown as React.ComponentType<Record<string, unknown>>,
	props: {
		projectJson: { type: "string", required: true },
	},
	strictProps: false,
});

/** Build a scoped EngineComponentRegistry containing Kastrick Docs custom nodes. */
export function getDocsRegistry() {
	const registry = createEngineComponentRegistry();
	registry.registerComponent("kastrick-doc-shell", KastrickDocShellComponent);
	registry.registerComponent("kastrick-landing", KastrickLandingComponent);
	registry.registerComponent("kastrick-project-landing", KastrickProjectLandingComponent);
	return registry;
}
