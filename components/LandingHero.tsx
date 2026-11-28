"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import type { DocsManifest, DocPageMeta, ProjectRecord } from "@/lib/content";

interface LandingHeroProps {
	manifest: DocsManifest;
}

function getStartingPage(project: ProjectRecord): DocPageMeta | undefined {
	const currentGeneration = project.generations?.[0];
	if (currentGeneration) {
		return project.pages.find((page) =>
			page.generation === currentGeneration.id && page.slug === currentGeneration.defaultSlug
		) ?? project.pages.find((page) =>
			page.generation === currentGeneration.id && page.track === "docs"
		);
	}
	return project.pages.find((page) => page.track === "docs") ?? project.pages[0];
}

function ProjectCounts({ project }: { project: ProjectRecord }) {
	const references = project.pages.filter((page) => page.track === "docs").length;
	const guides = project.pages.filter((page) => page.track === "guides").length;

	return (
		<div className="kd-home-project-counts" aria-label="Documentation counts">
			<span><strong>{references}</strong> {references === 1 ? "reference" : "references"}</span>
			<span><strong>{guides}</strong> {guides === 1 ? "guide" : "guides"}</span>
			{project.generations && project.generations.length > 0 && (
				<span><strong>{project.generations.length}</strong> {project.generations.length === 1 ? "generation" : "generations"}</span>
			)}
		</div>
	);
}

export default function LandingHero({ manifest }: LandingHeroProps) {
	const [projectsOpen, setProjectsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const onOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setProjectsOpen(false);
			}
		};
		document.addEventListener("mousedown", onOutside);
		return () => document.removeEventListener("mousedown", onOutside);
	}, []);

	const established = manifest.projects.filter((project) => project.established);
	const upcoming = manifest.projects.filter((project) => !project.established);
	const totalPages = established.reduce((count, project) => count + project.pages.length, 0);

	return (
		<div className="kd-doc-home-root">
			<header className="kd-topbar kd-doc-home-topbar">
				<div className="kd-topbar-left">
					<Link href="/" className="kd-brand" title="Kastrick Documentation">K8D</Link>
					<span className="kd-doc-home-wordmark">Kastrick Documentation</span>
					<div className="kd-dropdown" ref={dropdownRef}>
						<button
							type="button"
							className="kd-dropdown-trigger"
							aria-expanded={projectsOpen}
							onClick={() => setProjectsOpen((open) => !open)}
						>
							Projects <span aria-hidden="true">⌄</span>
						</button>
						{projectsOpen && (
							<div className="kd-dropdown-menu">
								{manifest.projects.map((project) => (
									<Link
										key={project.id}
										href={`/${project.id}`}
										className="kd-dropdown-item"
										onClick={() => setProjectsOpen(false)}
									>
										<div className="kd-dropdown-item-head">
											<span>{project.name}</span>
											{!project.established && <span className="kd-badge-notest">Planned</span>}
										</div>
										<small>{project.description}</small>
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
				<div className="kd-topbar-right">
					<a
						href="https://github.com/Kate-alt-69/kastrick-docs"
						target="_blank"
						rel="noopener noreferrer"
						className="kd-btn-secondary"
					>
						GitHub
					</a>
				</div>
			</header>

			<main className="kd-doc-home-main">
				<section className="kd-doc-home-intro" aria-labelledby="kd-doc-home-title">
					<div className="kd-doc-home-intro-copy">
						<p className="kd-doc-home-eyebrow">KASTRICK / DOCUMENTATION</p>
						<h1 id="kd-doc-home-title">Documentation</h1>
						<p className="kd-doc-home-lead">
							Technical reference, architecture notes, and practical guides for projects across the Kastrick ecosystem.
						</p>
						<div className="kd-doc-home-actions">
							<a href="#projects" className="kd-doc-home-primary">Browse projects <span aria-hidden="true">↓</span></a>
							<a href="https://kastrick.vercel.app" target="_blank" rel="noopener noreferrer" className="kd-doc-home-text-link">
								Kastrick website ↗
							</a>
						</div>
					</div>
					<aside className="kd-doc-home-overview" aria-label="Documentation library summary">
						<p className="kd-doc-home-overview-title">LIBRARY OVERVIEW</p>
						<div><strong>{established.length}</strong><span>Published projects</span></div>
						<div><strong>{totalPages}</strong><span>Indexed pages</span></div>
						<div><strong>{upcoming.length}</strong><span>Projects in preparation</span></div>
					</aside>
				</section>

				<section id="projects" className="kd-doc-home-section" aria-labelledby="kd-doc-home-projects">
					<header className="kd-doc-home-section-head">
						<div>
							<p className="kd-doc-home-eyebrow">PROJECT DIRECTORY</p>
							<h2 id="kd-doc-home-projects">Browse documentation</h2>
						</div>
						<p>Choose a project to browse its reference pages and task-based guides.</p>
					</header>

					<div className="kd-doc-home-project-grid">
						{established.map((project) => {
							const startPage = getStartingPage(project);
							return (
								<article key={project.id} className="kd-home-project-card">
									<div className="kd-home-project-card-head">
										<div>
											<p className="kd-home-project-kicker">PROJECT DOCUMENTATION</p>
											<h3><Link href={`/${project.id}`}>{project.name}</Link></h3>
											<span className="kd-home-project-repo">{project.repo}</span>
										</div>
										<span className="kd-home-project-status">{project.badge || "Published"}</span>
									</div>
									<p className="kd-home-project-description">{project.description}</p>
									<ProjectCounts project={project} />
									{project.rebaseNotice && <p className="kd-home-project-note">{project.rebaseNotice}</p>}
									<div className="kd-home-project-actions">
										<Link href={`/${project.id}`} className="kd-doc-home-primary">Browse documentation <span aria-hidden="true">→</span></Link>
										{startPage && (
											<Link href={`/${project.id}/${startPage.slug}`} className="kd-doc-home-secondary">
												Start reading
											</Link>
										)}
									</div>
								</article>
							);
						})}
					</div>
				</section>

				{upcoming.length > 0 && (
					<section className="kd-doc-home-section kd-doc-home-upcoming" aria-labelledby="kd-doc-home-upcoming">
						<header className="kd-doc-home-section-head">
							<div>
								<p className="kd-doc-home-eyebrow">IN PREPARATION</p>
								<h2 id="kd-doc-home-upcoming">More projects</h2>
							</div>
							<p>These project indexes are registered and will populate as documentation becomes available.</p>
						</header>
						<div className="kd-doc-home-upcoming-list">
							{upcoming.map((project) => (
								<article key={project.id} className="kd-home-upcoming-row">
									<div>
										<h3><Link href={`/${project.id}`}>{project.name}</Link></h3>
										<p>{project.description}</p>
										<span>{project.repo}</span>
									</div>
									<div className="kd-home-upcoming-actions">
										<span>Not yet published</span>
										<Link href={`/${project.id}`}>Project details →</Link>
									</div>
								</article>
							))}
						</div>
					</section>
				)}
			</main>

			<footer className="kd-doc-home-footer">
				<div className="kd-doc-home-footer-inner">
					<p>
						Documentation licensed under{" "}
						<a href={manifest.license.url} target="_blank" rel="noopener noreferrer">{manifest.license.name}</a>.
						Content is shared verbatim; suggested changes belong in the source project repository.
					</p>
					<span>© {new Date().getFullYear()} Kastrick</span>
				</div>
			</footer>
		</div>
	);
}
