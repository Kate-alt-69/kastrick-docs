import Link from "next/link";
import type { CSSProperties } from "react";
import LandingMotion from "@/components/LandingMotion";

export interface LandingProject {
	id: string;
	name: string;
	description: string;
	repo: string;
	repoUrl: string;
	originalSiteUrl: string;
	established: boolean;
	status: string;
	badge: string;
	version: string;
	accentColor: string;
	referenceCount: number;
	guideCount: number;
	pageCount: number;
	generationLabels: string[];
	startHref: string;
	guideHref?: string;
}

export interface LandingSiteData {
	license: { name: string; url: string };
	projects: LandingProject[];
}

const projectKinds: Record<string, string> = {
	rbe: "SYSTEMS / RUST",
	"nextjs-engine": "WEB PLATFORM",
	packagex: "INSTALLATION INFRASTRUCTURE",
	packx: "BUILD TOOLING",
	"packagex-sdks": "DEVELOPER TOOLING",
	"kastricks-utility": "CREATOR SOFTWARE",
};

function statusLabel(project: LandingProject): string {
	if (!project.established) return "In preparation";
	if (project.status.toLowerCase() === "alpha") return "Alpha";
	if (project.status.toLowerCase() === "active") return "Active";
	return "Published";
}

function ProjectCard({ project, index }: { project: LandingProject; index: number }) {
	const accentStyle = { "--project-accent": project.accentColor } as CSSProperties;

	return (
		<article className="kd-home2-project-card" style={accentStyle}>
			<div className="kd-home2-card-top">
				<div className="kd-home2-project-index">
					<span>{String(index + 1).padStart(2, "0")}</span>
					<span>{projectKinds[project.id] ?? "KASTRICK PROJECT"}</span>
				</div>
				<span className="kd-home2-status">{statusLabel(project)}</span>
			</div>

			<div className="kd-home2-project-heading">
				<h3><Link href={`/${project.id}`}>{project.name}</Link></h3>
				{project.badge && <span className="kd-home2-project-badge">{project.badge}</span>}
			</div>

			<p className="kd-home2-project-description">{project.description}</p>

			{project.generationLabels.length > 0 && (
				<div className="kd-home2-generation-list" aria-label="Published documentation generations">
					{project.generationLabels.map((label) => <span key={label}>{label}</span>)}
				</div>
			)}

			<div className="kd-home2-project-meta">
				<span><strong>{project.referenceCount}</strong> {project.referenceCount === 1 ? "reference" : "references"}</span>
				<span><strong>{project.guideCount}</strong> {project.guideCount === 1 ? "guide" : "guides"}</span>
				<span><strong>{project.pageCount}</strong> {project.pageCount === 1 ? "page" : "pages"}</span>
			</div>

			<footer className="kd-home2-project-actions">
				<Link href={project.startHref} className="kd-home2-card-primary">
					Open documentation <span aria-hidden="true">↗</span>
				</Link>
				<a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="kd-home2-card-source">
					Source <span aria-hidden="true">↗</span>
				</a>
			</footer>
		</article>
	);
}

function InPreparationCard({ project }: { project: LandingProject }) {
	const accentStyle = { "--project-accent": project.accentColor } as CSSProperties;

	return (
		<article className="kd-home2-upcoming-card" style={accentStyle}>
			<div className="kd-home2-upcoming-marker" aria-hidden="true" />
			<div className="kd-home2-upcoming-copy">
				<div className="kd-home2-upcoming-title">
					<h3><Link href={`/${project.id}`}>{project.name}</Link></h3>
					<span>In preparation</span>
				</div>
				<p>{project.description}</p>
				<small>{project.repo}</small>
			</div>
			<a href={project.repoUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${project.name} source repository`}>
				↗
			</a>
		</article>
	);
}

export default function LandingHero({ data }: { data: LandingSiteData }) {
	const published = data.projects.filter((project) => project.established);
	const upcoming = data.projects.filter((project) => !project.established);
	const totalPages = published.reduce((sum, project) => sum + project.pageCount, 0);
	const featured = published.find((project) => project.id === "nextjs-engine") ?? published[0];
	const firstGuideProject = published.find((project) => project.guideHref);
	const featuredGuideHref = firstGuideProject?.guideHref ?? featured?.startHref ?? "#ecosystem";

	return (
		<div className="kd-doc-home-root kd-home2-root">
			<header className="kd-home2-topbar">
				<div className="kd-home2-nav-inner">
					<Link href="/" className="kd-home2-brand" aria-label="Kastrick documentation home">
						<span className="kd-home2-brand-mark">K</span>
						<span className="kd-home2-brand-copy">
							<strong>KASTRICK</strong>
						<small>ENGINEERING LIBRARY</small>
						</span>
					</Link>

					<nav className="kd-home2-nav" aria-label="Main navigation">
						<a href="#ecosystem">Ecosystem</a>
						<a href="#library">Documentation</a>
						<a href="#approach">How it works</a>
					</nav>

					<div className="kd-home2-nav-actions">
						<a href="https://kastrick.vercel.app" target="_blank" rel="noopener noreferrer" className="kd-home2-site-link">
							Kastrick site <span aria-hidden="true">↗</span>
						</a>
						<a href="https://github.com/Kate-alt-69/kastrick-docs" target="_blank" rel="noopener noreferrer" className="kd-home2-github-link">
							GitHub <span aria-hidden="true">↗</span>
						</a>
					</div>
				</div>
			</header>

			<main className="kd-home2-main">
				<section className="kd-home2-hero" aria-labelledby="kd-home2-title">
					<div className="kd-home2-hero-copy">
						<p className="kd-home2-eyebrow"><span /> THE KASTRICK ECOSYSTEM / TECHNICAL LIBRARY</p>
						<h1 id="kd-home2-title">
							The tools behind the work. <em>All in one place.</em>
						</h1>
						<p className="kd-home2-hero-lead">
							Explore the systems, runtimes, build tools, and creator software taking shape across Kastrick — with the technical context to understand how they fit together.
						</p>
						<div className="kd-home2-hero-actions">
							<a href="#ecosystem" className="kd-home2-button-primary">
								Explore the ecosystem <span aria-hidden="true">↓</span>
							</a>
							{featured && (
								<Link href={featured.startHref} className="kd-home2-button-secondary">
									Read the documentation <span aria-hidden="true">↗</span>
								</Link>
							)}
						</div>

						<div className="kd-home2-hero-proof">
							<span><i aria-hidden="true" /> Source-linked</span>
							<span>Version-aware references</span>
							<span>Docs and practical guides</span>
						</div>
					</div>

					<aside className="kd-home2-visual" aria-label="Abstract engineering system map">
						<div className="kd-home2-visual-grid" />
						<div className="kd-home2-visual-head">
							<span>ENGINEERING / MAP 01</span>
							<span>FIG. 01</span>
						</div>
						<div className="kd-home2-motion-stage" aria-hidden="true">
							<LandingMotion />
						</div>
						<span className="kd-home2-visual-node kd-home2-node-runtime">RUNTIME</span>
						<span className="kd-home2-visual-node kd-home2-node-compiler">COMPILER</span>
						<span className="kd-home2-visual-node kd-home2-node-tooling">TOOLING</span>
						<div className="kd-home2-visual-foot">
							<span>01 — SYSTEMS</span>
							<span>02 — INTERFACES</span>
							<span>03 — WORKFLOWS</span>
						</div>
					</aside>
				</section>

				<section className="kd-home2-stats" aria-label="Documentation overview">
					<div><strong>{published.length.toString().padStart(2, "0")}</strong><span>Published projects</span></div>
					<div><strong>{totalPages.toString().padStart(2, "0")}</strong><span>Indexed pages</span></div>
					<div><strong>{data.projects.length.toString().padStart(2, "0")}</strong><span>Projects tracked</span></div>
					<p>The documentation stays connected to the projects it describes.</p>
				</section>

				<section id="ecosystem" className="kd-home2-section" aria-labelledby="kd-home2-ecosystem-title">
					<div className="kd-home2-section-heading">
						<div>
							<p className="kd-home2-section-kicker">01 / THE ECOSYSTEM</p>
							<h2 id="kd-home2-ecosystem-title">Built for different layers of the stack.</h2>
						</div>
						<p>Each project has its own purpose, source repository, and documentation path. Start with what you need; follow the connections from there.</p>
					</div>

					<div className="kd-home2-project-grid">
						{published.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />)}
					</div>
				</section>

				{upcoming.length > 0 && (
					<section className="kd-home2-section kd-home2-upcoming-section" aria-labelledby="kd-home2-upcoming-title">
						<div className="kd-home2-section-heading kd-home2-section-heading-compact">
							<div>
								<p className="kd-home2-section-kicker">02 / ON THE WORKBENCH</p>
								<h2 id="kd-home2-upcoming-title">More is taking shape.</h2>
							</div>
							<p>These projects are part of the wider ecosystem. Their documentation will grow alongside the work.</p>
						</div>
						<div className="kd-home2-upcoming-grid">
							{upcoming.map((project) => <InPreparationCard key={project.id} project={project} />)}
						</div>
					</section>
				)}

				<section id="library" className="kd-home2-section" aria-labelledby="kd-home2-library-title">
					<div className="kd-home2-section-heading">
						<div>
							<p className="kd-home2-section-kicker">03 / THE LIBRARY</p>
							<h2 id="kd-home2-library-title">Find the right way in.</h2>
						</div>
						<p>Move from a high-level overview to the detail you need without losing the thread.</p>
					</div>

					<div className="kd-home2-entry-grid">
						<Link href={featured?.startHref ?? "#ecosystem"} className="kd-home2-entry-card">
							<span className="kd-home2-entry-number">01</span>
							<div><h3>Reference</h3><p>APIs, architecture, configuration, and the details that make a system predictable.</p></div>
							<span className="kd-home2-entry-arrow" aria-hidden="true">↗</span>
						</Link>
						<Link href={featuredGuideHref} className="kd-home2-entry-card">
							<span className="kd-home2-entry-number">02</span>
							<div><h3>Guides</h3><p>Practical routes through common tasks, setup work, and real implementation choices.</p></div>
							<span className="kd-home2-entry-arrow" aria-hidden="true">↗</span>
						</Link>
						<a href={featured?.repoUrl ?? "https://github.com/Kate-alt-69/kastrick-docs"} target="_blank" rel="noopener noreferrer" className="kd-home2-entry-card">
							<span className="kd-home2-entry-number">03</span>
							<div><h3>Source</h3><p>Trace the documentation back to the repository and the work it describes.</p></div>
							<span className="kd-home2-entry-arrow" aria-hidden="true">↗</span>
						</a>
					</div>
				</section>

				<section id="approach" className="kd-home2-bottom-cta">
					<div>
						<p className="kd-home2-section-kicker">A BETTER PLACE TO START</p>
						<h2>Understand the system before you change it.</h2>
						<p>Browse the project index, choose a generation where it matters, and keep the source close while you work.</p>
					</div>
					<Link href={featured?.startHref ?? "#ecosystem"} className="kd-home2-button-primary">
						Open the library <span aria-hidden="true">↗</span>
					</Link>
				</section>
			</main>

			<footer className="kd-home2-footer">
				<div className="kd-home2-footer-inner">
					<Link href="/" className="kd-home2-footer-brand">KASTRICK <span>/ DOCS</span></Link>
					<p>Documentation licensed under <a href={data.license.url} target="_blank" rel="noopener noreferrer">{data.license.name}</a>. Source repositories remain the place for code and suggested changes.</p>
					<div>
						<a href="https://kastrick.vercel.app" target="_blank" rel="noopener noreferrer">Kastrick ↗</a>
						<a href="https://github.com/Kate-alt-69/kastrick-docs" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
