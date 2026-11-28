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
			<span className="kd-project-page-arrow" aria-hidden="true">↗</span>
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
	const firstDoc = defaultPage;
	const firstGuide = guidePages[0];

	return (
		<section className="kd-generation-panel" id={`generation-${generation.id}`}>
			<header className="kd-generation-panel-head">
				<div>
					<p className="kd-generation-kicker">SOURCE TRACK / {generation.branch}</p>
					<h3>{generation.label}</h3>
					<span>{generation.version}</span>
				</div>
				<div className="kd-generation-actions">
					{firstDoc && (
						<Link className="kd-project-button kd-project-button-primary" href={`/${projectId}/${firstDoc.slug}`}>
							Open {generation.label} docs <span aria-hidden="true">→</span>
						</Link>
					)}
					{firstGuide && (
						<Link className="kd-project-button kd-project-button-secondary" href={`/${projectId}/${firstGuide.slug}`}>
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
					)) : <p className="kd-project-lane-empty">No reference pages were returned from {generation.branch}.</p>}
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
					) : <p className="kd-project-lane-empty">No guides are published for this generation.</p>}
				</section>
			</div>
		</section>
	);
}

export default function ProjectLanding({ project }: ProjectLandingProps) {
	const docsPages = project.pages.filter((page) => page.track === "docs");
	const guidePages = project.pages.filter((page) => page.track === "guides");
	const docsGroups = groupPages(docsPages);
	const state = !project.established
		? "pending"
		: project.status.toLowerCase() === "alpha"
			? "alpha"
			: "active";
	const stateLabel = state === "pending" ? "Sync pending" : state === "alpha" ? "Alpha" : "Active";
	const versionLabel = project.version && project.version !== "NOT_EST" ? project.version : "Not set";
	const accentStyle = {
		"--kd-project-accent": project.accentColor || "#38bdf8",
	} as CSSProperties;
	const firstDoc = docsPages[0];
	const firstGuide = guidePages[0];

	return (
		<div className="kd-project-root" data-project={project.id} style={accentStyle}>
			<header className="kd-topbar kd-project-topbar">
				<div className="kd-topbar-left">
					<Link href="/" className="kd-brand" title="Kastrick Docs">K8D</Link>
					<nav className="kd-project-crumbs" aria-label="Project breadcrumb">
						<Link href="/">Projects</Link>
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

			<main className="kd-project-main">
				<section className="kd-project-hero" aria-labelledby="kd-project-title">
					<div className="kd-project-hero-copy">
						<div className="kd-project-kicker">
							<span className="kd-project-kicker-mark" aria-hidden="true" />
							PROJECT INDEX <span>/</span> {project.id.toUpperCase()}
						</div>

						<div className="kd-project-tags">
							{project.badge && project.badge !== "NOT_EST" && (
								<span className="kd-project-tag">{project.badge}</span>
							)}
							<span className={`kd-project-state kd-project-state-${state}`}>{stateLabel}</span>
							{versionLabel !== "Not set" && <span className="kd-project-version">{versionLabel}</span>}
						</div>

						<h1 id="kd-project-title" className="kd-project-title">{project.name}</h1>
						<p className="kd-project-description">{project.description}</p>

						<div className="kd-project-actions">
							{project.generations?.length ? project.generations.map((generation) => {
								const target = project.pages.find((page) => page.generation === generation.id && page.slug === generation.defaultSlug)
									?? project.pages.find((page) => page.generation === generation.id && page.track === "docs")
									?? project.pages.find((page) => page.generation === generation.id);
								return (
									<Link
									key={generation.id}
									className="kd-project-button kd-project-button-secondary"
									href={target ? `/${project.id}/${target.slug}` : `/${project.id}/${generation.defaultSlug}`}
								>
									{generation.label} <span aria-hidden="true">→</span>
								</Link>
								);
							}) : firstDoc ? (
								<Link className="kd-project-button kd-project-button-primary" href={`/${project.id}/${firstDoc.slug}`}>
									Read documentation <span aria-hidden="true">→</span>
								</Link>
							) : firstGuide ? (
								<Link className="kd-project-button kd-project-button-primary" href={`/${project.id}/${firstGuide.slug}`}>
									Read guides <span aria-hidden="true">→</span>
								</Link>
							) : (
								<a className="kd-project-button kd-project-button-primary" href={project.repoUrl} target="_blank" rel="noopener noreferrer">
									Open source repository <span aria-hidden="true">↗</span>
								</a>
							)}
							{!project.generations?.length && firstDoc && firstGuide && (
								<Link className="kd-project-button kd-project-button-secondary" href={`/${project.id}/${firstGuide.slug}`}>
									Browse guides
								</Link>
							)}
							<a className="kd-project-text-link" href={project.originalSiteUrl} target="_blank" rel="noopener noreferrer">
								Project site ↗
							</a>
						</div>
					</div>

					<aside className="kd-project-source-panel" aria-label="Source details">
						<div className="kd-project-panel-heading">
							<span>Source details</span>
							<span className="kd-project-panel-dot" aria-hidden="true" />
						</div>
						<a className="kd-project-repo" href={project.repoUrl} target="_blank" rel="noopener noreferrer">
							<strong>{project.repo}</strong>
							<span>Open on GitHub ↗</span>
						</a>
						<dl className="kd-project-facts">
							<div>
								<dt>Configured branch</dt>
								<dd><code>{project.branch}</code></dd>
							</div>
							<div>
								<dt>Documentation sync</dt>
								<dd>{project.established ? "Enabled" : "Pending"}</dd>
							</div>
							<div>
								<dt>Published version</dt>
								<dd>{versionLabel}</dd>
							</div>
						</dl>
					</aside>
				</section>

				<section className="kd-project-statbar" aria-label="Documentation counts">
					<div>
						<strong>{docsPages.length}</strong>
						<span>Reference pages</span>
					</div>
					<div>
						<strong>{guidePages.length}</strong>
						<span>Practical guides</span>
					</div>
					<div>
						<strong>{docsPages.length + guidePages.length}</strong>
						<span>Pages in this index</span>
					</div>
					<div className="kd-project-stat-repo">
						<span>Source</span>
						<strong>{project.repo}</strong>
					</div>
				</section>

				{project.rebaseNotice && (
					<aside className="kd-project-notice" role="note">
						<span className="kd-project-notice-label">Documentation note</span>
						<p>{project.rebaseNotice}</p>
					</aside>
				)}

				<section className="kd-project-library" aria-labelledby="kd-project-library-title">
					<div className="kd-project-library-heading">
						<div>
							<p className="kd-project-section-kicker">THE INDEX</p>
							<h2 id="kd-project-library-title">Documentation library</h2>
						</div>
						<p>Browse by reference material or by task.</p>
					</div>

					{docsPages.length === 0 && guidePages.length === 0 ? (
						<div className="kd-project-empty">
							<span className="kd-project-empty-code">NO PAGES INDEXED</span>
							<h3>Documentation is not published here yet.</h3>
							<p>
								This project is registered in the Kastrick index. Its documentation sync is
								{project.established ? " enabled, but no pages were returned in the current build." : " pending."}
								{" "}The source repository remains available below.
							</p>
							<a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
								Visit {project.repo} ↗
							</a>
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
						) : <div className="kd-project-library-grid">
							<section className="kd-project-lane" id="project-docs" aria-labelledby="kd-project-docs-title">
								<div className="kd-project-lane-heading">
									<div>
										<span className="kd-project-lane-number">01</span>
										<h3 id="kd-project-docs-title">Reference</h3>
									</div>
									<span>{docsPages.length} {docsPages.length === 1 ? "page" : "pages"}</span>
								</div>
								{docsPages.length > 0 ? (
									docsGroups.map(([section, pages]) => (
										<div className="kd-project-page-group" key={section}>
											<h4>{section}</h4>
											<div className="kd-project-page-list">
												{pages.map((page, index) => (
													<PageRow key={page.slug} projectId={project.id} page={page} index={index} />
												))}
											</div>
										</div>
									))
								) : (
									<p className="kd-project-lane-empty">No reference pages have been indexed.</p>
								)}
							</section>

							<section className="kd-project-lane" id="project-guides" aria-labelledby="kd-project-guides-title">
								<div className="kd-project-lane-heading">
									<div>
										<span className="kd-project-lane-number">02</span>
										<h3 id="kd-project-guides-title">Guides</h3>
									</div>
									<span>{guidePages.length} {guidePages.length === 1 ? "page" : "pages"}</span>
								</div>
								{guidePages.length > 0 ? (
									<div className="kd-project-page-list">
										{guidePages.map((page, index) => (
											<PageRow key={page.slug} projectId={project.id} page={page} index={index} />
										))}
									</div>
								) : (
									<p className="kd-project-lane-empty">No practical guides have been indexed.</p>
								)}
							</section>
						</div>
					}
				</section>

				<footer className="kd-project-footer">
					<Link href="/">← Back to all projects</Link>
					<span>Documentation is synced from the configured source repository at build time.</span>
				</footer>
			</main>
		</div>
	);
}
