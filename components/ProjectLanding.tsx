import Link from "next/link";
import type { CSSProperties } from "react";
import type { DocPageMeta, DocGeneration, ProjectRecord } from "@/lib/content";

interface ProjectLandingProps {
	project: ProjectRecord;
}

function groupPages(pages: DocPageMeta[]) {
	const groups = new Map<string, DocPageMeta[]>();
	for (const page of pages) {
		const title = page.section?.trim() || "Documentation";
		const group = groups.get(title) ?? [];
		group.push(page);
		groups.set(title, group);
	}
	return [...groups.entries()];
}

function PageRow({
	projectId,
	page,
	index,
}: {
	projectId: string;
	page: DocPageMeta;
	index: number;
}) {
	return (
		<Link className="kd-project-page-row" href={`/${projectId}/${page.slug}`}>
			<span className="kd-project-page-index">{String(index + 1).padStart(2, "0")}</span>
			<span className="kd-project-page-copy">
				<strong>{page.title}</strong>
				<small>{page.sourcePath}</small>
			</span>
			<span className="kd-project-page-arrow" aria-hidden="true">→</span>
		</Link>
	);
}

function GenerationLibrary({
	projectId,
	generation,
	pages,
}: {
	projectId: string;
	generation: DocGeneration;
	pages: DocPageMeta[];
}) {
	const docsPages = pages.filter((page) => page.track === "docs");
	const guidePages = pages.filter((page) => page.track === "guides");
	const docsGroups = groupPages(docsPages);
	const defaultPage = pages.find((page) => page.slug === generation.defaultSlug) ?? docsPages[0];

	return (
		<section className="kd-generation-panel" id={`generation-${generation.id}`}>
			<header className="kd-generation-panel-head">
				<div>
					<p className="kd-generation-kicker">SOURCE BRANCH / {generation.branch}</p>
					<h3>{generation.label}</h3>
					<span>{generation.version} · {pages.length} indexed {pages.length === 1 ? "page" : "pages"}</span>
				</div>
				<div className="kd-generation-actions">
					{defaultPage && (
						<Link className="kd-project-button kd-project-button-primary" href={`/${projectId}/${defaultPage.slug}`}>
							Read documentation <span aria-hidden="true">→</span>
						</Link>
					)}
					{guidePages[0] && (
						<Link className="kd-project-button kd-project-button-secondary" href={`/${projectId}/${guidePages[0].slug}`}>
							Browse guides
						</Link>
					)}
				</div>
			</header>

			<div className="kd-project-library-grid">
				<section className="kd-project-lane" aria-label={generation.label + " reference documentation"}>
					<div className="kd-project-lane-heading">
						<div><span className="kd-project-lane-number">01</span><h3>Reference</h3></div>
						<span>{docsPages.length} {docsPages.length === 1 ? "page" : "pages"}</span>
					</div>
					{docsPages.length > 0 ? docsGroups.map(([section, sectionPages]) => (
						<div className="kd-project-page-group" key={section}>
							<h4>{section}</h4>
							<div className="kd-project-page-list">
								{sectionPages.map((page, index) => (
									<PageRow key={page.slug} projectId={projectId} page={page} index={index} />
								))}
							</div>
						</div>
					)) : <p className="kd-project-lane-empty">No reference pages have been indexed for this generation.</p>}
				</section>

				<section className="kd-project-lane" aria-label={generation.label + " practical guides"}>
					<div className="kd-project-lane-heading">
						<div><span className="kd-project-lane-number">02</span><h3>Guides</h3></div>
						<span>{guidePages.length} {guidePages.length === 1 ? "page" : "pages"}</span>
					</div>
					{guidePages.length > 0 ? (
						<div className="kd-project-page-list">
							{guidePages.map((page, index) => (
								<PageRow key={page.slug} projectId={projectId} page={page} index={index} />
							))}
						</div>
					) : <p className="kd-project-lane-empty">No practical guides are published for this generation.</p>}
				</section>
			</div>
		</section>
	);
}

export default function ProjectLanding({ project }: ProjectLandingProps) {
	const docsPages = project.pages.filter((page) => page.track === "docs");
	const guidePages = project.pages.filter((page) => page.track === "guides");
	const docsGroups = groupPages(docsPages);
	const isPending = !project.established;
	const stateLabel = isPending
		? "In preparation"
		: project.status.toLowerCase() === "alpha"
			? "Alpha"
			: "Published";
	const versionLabel = project.version && project.version !== "NOT_EST" ? project.version : "Not specified";
	const accentStyle = {
		"--kd-project-accent": project.accentColor || "#38bdf8",
	} as CSSProperties;

	return (
		<div className="kd-project-root kd-classic-project-root" data-project={project.id} style={accentStyle}>
			<header className="kd-topbar kd-project-topbar kd-classic-project-topbar">
				<div className="kd-topbar-left">
					<Link href="/" className="kd-brand" title="Kastrick Documentation">K8D</Link>
					<nav className="kd-project-crumbs" aria-label="Breadcrumb">
						<Link href="/">Documentation</Link>
						<span aria-hidden="true">/</span>
						<span aria-current="page">{project.name}</span>
					</nav>
				</div>
				<div className="kd-topbar-right">
					<a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="kd-repo-link">
						Source repository ↗
					</a>
					<Link href="/" className="kd-btn-secondary">All projects</Link>
				</div>
			</header>

			<main className="kd-project-main kd-classic-project-main">
				<section className="kd-classic-project-hero" aria-labelledby="kd-project-title">
					<div className="kd-classic-project-copy">
						<p className="kd-classic-project-eyebrow">PROJECT DOCUMENTATION</p>
						<h1 id="kd-project-title">{project.name}</h1>
						<p className="kd-classic-project-description">{project.description}</p>
						<div className="kd-classic-project-tags">
							<span className={`kd-classic-project-state ${isPending ? "is-pending" : ""}`}>{stateLabel}</span>
							{project.badge && project.badge !== "NOT_EST" && <span>{project.badge}</span>}
							{versionLabel !== "Not specified" && <span>{versionLabel}</span>}
						</div>
						<div className="kd-classic-project-actions">
							{project.generations?.length ? project.generations.map((generation, index) => {
								const target = project.pages.find((page) => page.generation === generation.id && page.slug === generation.defaultSlug)
									?? project.pages.find((page) => page.generation === generation.id && page.track === "docs")
									?? project.pages.find((page) => page.generation === generation.id);
								return (
									<Link
										key={generation.id}
										className={index === 0 ? "kd-project-button kd-project-button-primary" : "kd-project-button kd-project-button-secondary"}
										href={target ? `/${project.id}/${target.slug}` : `/${project.id}${generation.defaultSlug ? `/${generation.defaultSlug}` : ""}`}
									>
										{index === 0 ? "Read " : "Browse "}{generation.label} <span aria-hidden="true">→</span>
									</Link>
								);
							}) : docsPages[0] ? (
								<Link className="kd-project-button kd-project-button-primary" href={`/${project.id}/${docsPages[0].slug}`}>
									Read documentation <span aria-hidden="true">→</span>
								</Link>
							) : guidePages[0] ? (
								<Link className="kd-project-button kd-project-button-primary" href={`/${project.id}/${guidePages[0].slug}`}>
									Read guides <span aria-hidden="true">→</span>
								</Link>
							) : null}
							{!project.generations?.length && docsPages[0] && guidePages[0] && (
								<Link className="kd-project-button kd-project-button-secondary" href={`/${project.id}/${guidePages[0].slug}`}>
									Browse guides
								</Link>
							)}
							<a className="kd-classic-project-site-link" href={project.originalSiteUrl} target="_blank" rel="noopener noreferrer">
								Project website ↗
							</a>
						</div>
					</div>

					<aside className="kd-classic-project-overview" aria-label="Documentation overview">
						<h2>In this index</h2>
						<dl>
							<div><dt>Reference pages</dt><dd>{docsPages.length}</dd></div>
							<div><dt>Practical guides</dt><dd>{guidePages.length}</dd></div>
							{project.generations && project.generations.length > 0 && (
								<div><dt>Source generations</dt><dd>{project.generations.length}</dd></div>
							)}
							<div><dt>Configured branch</dt><dd><code>{project.branch}</code></dd></div>
						</dl>
						<a href={project.repoUrl} target="_blank" rel="noopener noreferrer">View source repository ↗</a>
					</aside>
				</section>

				{project.rebaseNotice && (
					<aside className="kd-project-notice" role="note">
						<span className="kd-project-notice-label">Documentation note</span>
						<p>{project.rebaseNotice}</p>
					</aside>
				)}

				<section className="kd-project-library kd-classic-project-library" aria-labelledby="kd-project-library-title">
					<header className="kd-classic-library-heading">
						<div>
							<p className="kd-project-section-kicker">DOCUMENTATION INDEX</p>
							<h2 id="kd-project-library-title">Browse documentation</h2>
						</div>
						<p>Reference material and practical guides, organized by topic and source generation.</p>
					</header>

					{docsPages.length === 0 && guidePages.length === 0 ? (
						<div className="kd-project-empty">
							<span className="kd-project-empty-code">DOCUMENTATION NOT YET PUBLISHED</span>
							<h3>{isPending ? "This project is being prepared." : "No pages were indexed in this build."}</h3>
							<p>
								{isPending
									? "This project is registered in the documentation directory. Its page index will appear here when the documentation source is ready."
									: "Documentation sync is enabled, but no reference pages or guides were returned in the current build."}
								{" "}You can still visit the source repository for the latest project information.
							</p>
							<a href={project.repoUrl} target="_blank" rel="noopener noreferrer">Visit {project.repo} ↗</a>
						</div>
					) : project.generations?.length ? (
						<div className="kd-generation-library">
							{project.generations.map((generation) => (
								<GenerationLibrary
									key={generation.id}
									projectId={project.id}
									generation={generation}
									pages={project.pages.filter((page) => page.generation === generation.id)}
								/>
							))}
						</div>
					) : (
						<div className="kd-project-library-grid">
							<section className="kd-project-lane" id="project-docs" aria-labelledby="kd-project-docs-title">
								<div className="kd-project-lane-heading">
									<div><span className="kd-project-lane-number">01</span><h3 id="kd-project-docs-title">Reference</h3></div>
									<span>{docsPages.length} {docsPages.length === 1 ? "page" : "pages"}</span>
								</div>
								{docsPages.length > 0 ? docsGroups.map(([section, pages]) => (
									<div className="kd-project-page-group" key={section}>
										<h4>{section}</h4>
										<div className="kd-project-page-list">
											{pages.map((page, index) => (
												<PageRow key={page.slug} projectId={project.id} page={page} index={index} />
											))}
										</div>
									</div>
								)) : <p className="kd-project-lane-empty">No reference pages have been indexed.</p>}
							</section>

							<section className="kd-project-lane" id="project-guides" aria-labelledby="kd-project-guides-title">
								<div className="kd-project-lane-heading">
									<div><span className="kd-project-lane-number">02</span><h3 id="kd-project-guides-title">Guides</h3></div>
									<span>{guidePages.length} {guidePages.length === 1 ? "page" : "pages"}</span>
								</div>
								{guidePages.length > 0 ? (
									<div className="kd-project-page-list">
										{guidePages.map((page, index) => (
											<PageRow key={page.slug} projectId={project.id} page={page} index={index} />
										))}
									</div>
								) : <p className="kd-project-lane-empty">No practical guides have been indexed.</p>}
							</section>
						</div>
					)}
				</section>

				<footer className="kd-project-footer">
					<Link href="/">← All documentation</Link>
					<span>Documentation is synced from the configured source repository at build time.</span>
				</footer>
			</main>
		</div>
	);
}
