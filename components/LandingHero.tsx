// components/LandingHero.tsx — Public-ready "Learn About Kastrick" landing page
// rendered inside NES (Next.js Engine Schema) via the "kastrick-landing" custom component.

"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import type { DocsManifest } from "@/lib/content";

interface LandingHeroProps {
	manifest: DocsManifest;
}

export default function LandingHero({ manifest }: LandingHeroProps) {
	const [projectsOpen, setProjectsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const onOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setProjectsOpen(false);
			}
		};
		document.addEventListener("mousedown", onOutside);
		return () => document.removeEventListener("mousedown", onOutside);
	}, []);

	const established = manifest.projects.filter((p) => p.established);
	const upcoming = manifest.projects.filter((p) => !p.established);

	return (
		<div className="kd-landing-root">
			<header className="kd-topbar">
				<div className="kd-topbar-left">
					<Link href="/" className="kd-brand" title="Kastrick Docs">
						K8D
					</Link>
					<div className="kd-dropdown" ref={dropdownRef}>
						<button
							type="button"
							className="kd-dropdown-trigger"
							onClick={() => setProjectsOpen((o) => !o)}
						>
							Projects ▾
						</button>
						{projectsOpen && (
							<div className="kd-dropdown-menu">
								{manifest.projects.map((proj) => (
									<Link
										key={proj.id}
										href={`/${proj.id}`}
										className="kd-dropdown-item"
										onClick={() => setProjectsOpen(false)}
									>
										<div className="kd-dropdown-item-head">
											<span>{proj.name}</span>
											{!proj.established && <span className="kd-badge-notest">NOT_EST</span>}
										</div>
										<small>{proj.description}</small>
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
				<div className="kd-topbar-right">
					<a
						href="https://kastrick.vercel.app"
						target="_blank"
						rel="noopener noreferrer"
						className="kd-repo-link"
					>
						kastrick.vercel.app ↗
					</a>
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

			<main className="kd-landing-main">
				{/* Hero Section */}
				<section className="kd-landing-hero">
					<div className="kd-landing-eyebrow">
						KASTRICK DOCUMENTATION · {manifest.license.name}
					</div>
					<h1 className="kd-landing-title">Learn About Kastrick</h1>
					<p className="kd-landing-subtitle">
						Official documentation, architecture references, and practical guides for the
						Kastrick ecosystem. Built statically per release from live project repositories
						using Next.js Engine (NES).
					</p>
					<div className="kd-landing-cta">
						<Link href="/rbe" className="kd-btn-primary">
							Explore RBE Docs →
						</Link>
						<Link href="/nextjs-engine/docs/3" className="kd-btn-secondary">
							Next.js Engine · Gen 3
						</Link>
						<Link href="/nextjs-engine/docs/2" className="kd-btn-secondary">
							Next.js Engine · Gen 2 archive
						</Link>
						<a
							href="https://kastrick.vercel.app"
							target="_blank"
							rel="noopener noreferrer"
							className="kd-btn-secondary"
						>
							Visit Kastrick ↗
						</a>
					</div>
				</section>

				{/* Core Capabilities Strip */}
				<section className="kd-landing-pillars" aria-label="Documentation highlights">
					<div className="kd-pillar-card">
						<h3>Docs &amp; Guides Split</h3>
						<p>
							Switch cleanly between deep technical references (APIs, compilers, internals)
							and task-focused guides showing how to get features running fast.
						</p>
					</div>
					<div className="kd-pillar-card">
						<h3>EngineScroll Share Links</h3>
						<p>
							Share exact headings, lines, or reading progress via <code>#-es</code> anchors
							and compact <code>/share/&lt;8char&gt;</code> level codes.
						</p>
					</div>
					<div className="kd-pillar-card">
						<h3>Pin &amp; Notebook Markings</h3>
						<p>
							Bookmark pages or highlight any text inside the docs to copy, pin, or save
							annotated quotes directly into your local Notebook.
						</p>
					</div>
				</section>

				{/* Established Projects */}
				<section className="kd-landing-section">
					<div className="kd-section-head">
						<h2>Active Documentation</h2>
						<span>Pulled statically from live repositories on every build</span>
					</div>
					<div className="kd-landing-grid">
						{established.map((project) => {
							const firstPage = project.generations?.[0]
								? project.pages.find((page) => page.slug === project.generations?.[0]?.defaultSlug) ?? project.pages[0]
								: project.pages[0];
							return (
								<article key={project.id} className="kd-landing-card">
									<div className="kd-landing-card-top">
										<div>
											<h3>{project.name}</h3>
											<span className="kd-card-repo">{project.repo}</span>
										</div>
										<span className="kd-badge-live">{project.badge}</span>
									</div>
									<p>{project.description}</p>
									{project.rebaseNotice && (
										<div className="kd-card-warn">
											Note: Currently undergoing a full Generation 3 documentation rebase.
										</div>
									)}
									<div className="kd-landing-card-actions">
										<Link href={`/${project.id}`} className="kd-btn-primary">
											Project Overview
										</Link>
										{firstPage && (
											<Link
												href={`/${project.id}/${firstPage.slug}`}
												className="kd-btn-secondary"
											>
												Start Reading
											</Link>
										)}
										<a
											href={project.originalSiteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="kd-card-ext"
										>
											Original Site ↗
										</a>
									</div>
								</article>
							);
						})}
					</div>
				</section>

				{/* Upcoming / NOT_EST Projects */}
				<section className="kd-landing-section">
					<div className="kd-section-head">
						<h2>Upcoming Ecosystem (NOT_EST)</h2>
						<span>Pre-wired routes ready to auto-publish once each repository is established</span>
					</div>
					<div className="kd-landing-grid kd-landing-grid-compact">
						{upcoming.map((project) => (
							<article key={project.id} className="kd-landing-card kd-landing-card-muted">
								<div className="kd-landing-card-top">
									<div>
										<h3>{project.name}</h3>
										<span className="kd-card-repo">{project.repo}</span>
									</div>
									<span className="kd-badge-notest">NOT_EST</span>
								</div>
								<p>{project.description}</p>
								<div className="kd-landing-card-actions">
									<Link href={`/${project.id}`} className="kd-btn-secondary">
										View Status
									</Link>
									<a
										href={project.originalSiteUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="kd-card-ext"
									>
										Original Site ↗
									</a>
								</div>
							</article>
						))}
					</div>
				</section>
			</main>

			<footer className="kd-landing-footer">
				<div className="kd-landing-footer-inner">
					<p>
						Documentation licensed under{" "}
						<a href={manifest.license.url} target="_blank" rel="noopener noreferrer">
							{manifest.license.name}
						</a>{" "}
						— Verbatim download &amp; sharing allowed (commercial use permitted). Suggest edits
						via GitHub Issues on the source repository.
					</p>
					<span>© {new Date().getFullYear()} Kastrick Platform</span>
				</div>
			</footer>
		</div>
	);
}
