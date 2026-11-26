// app/page.tsx — Kastrick Documentation Hub landing page.
// Statically generated from content/manifest.json with direct entry points
// into each project's Docs and Guides tracks.

import Link from "next/link";
import React from "react";
import { loadManifest } from "@/lib/content";

export default function HomePage() {
	const manifest = loadManifest();

	return (
		<main className="kd-home">
			<section className="kd-home-hero">
				<span className="kd-pill">Static Per-Build Documentation · {manifest.license.name}</span>
				<h1>Kastrick Documentation</h1>
				<p>
					Official documentation and practical guides for the Kastrick ecosystem. Built statically
					from live project repositories on every release — downloadable verbatim, with edits
					tracked via GitHub Issues.
				</p>
			</section>

			<section className="kd-home-grid">
				{manifest.projects.map((project) => {
					const firstDoc = project.pages.find((p) => p.track === "docs");
					const firstGuide = project.pages.find((p) => p.track === "guides");
					const docsHref = firstDoc
						? `/docs/${project.id}/${firstDoc.slug}`
						: `/docs/${project.id}/overview`;
					const guidesHref = firstGuide
						? `/guides/${project.id}/${firstGuide.slug}`
						: `/guides/${project.id}/overview`;

					return (
						<article key={project.id} className="kd-project-card">
							<div className="kd-card-head">
								<h2>{project.name}</h2>
								<span className={project.established ? "kd-badge-live" : "kd-badge-notest"}>
									{project.badge}
								</span>
							</div>
							<p>{project.description}</p>
							{project.rebaseNotice && (
								<p className="kd-card-note">Note: Docs currently undergoing a rebase.</p>
							)}
							<div className="kd-card-actions">
								<Link href={docsHref} className="kd-btn-primary">
									Open Docs
								</Link>
								<Link href={guidesHref} className="kd-btn-secondary">
									Open Guides
								</Link>
								<a
									href={project.repoUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="kd-link-muted"
								>
									{project.repo}
								</a>
							</div>
						</article>
					);
				})}
			</section>
		</main>
	);
}
