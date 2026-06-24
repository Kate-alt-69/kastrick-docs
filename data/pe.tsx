/* ========================================================================== */
/*  ProductExplorer (PE) — Reusable documentation explorer component          */
/*  Dark-themed, tree-driven, fully self-contained.                           */
/* ========================================================================== */

"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

/* ========================================================================== */
/*  Types                                                                     */
/* ========================================================================== */

export type PENodeType = "root" | "product" | "folder" | "page";

export interface PETreeNode {
	id:          string;
	name:        string;
	slug:        string;
	path:        string;
	type:        PENodeType;
	title?:      string;
	description?: string;
	icon?:       string;
	badge?:      string;
	order?:      number;
	hidden?:     boolean;
	parent?:     PETreeNode;
	children:    PETreeNode[];
	previous?:   PETreeNode;
	next?:       PETreeNode;
}

export interface ProductExplorerMetadata {
	title:       string;
	description?: string;
	icon?:       string;
	badge?:      string;
	order?:      number;
	author?: {
		name:         string;
		avatar?:      string;
		organization?: string;
	};
	version?:    string;
	status?:     "stable" | "beta" | "alpha" | "deprecated";
	updated?:    string;
	created?:    string;
}

export interface ProductExplorerProps {
	/* Tree — pass your own or omit for a blank scaffold */
	tree?:            PETreeNode;

	/* Called when the user clicks a tree node */
	onNavigate?:      (node: PETreeNode) => void;

	/* Page header */
	title?:           string;
	description?:     string;
	metadata?:        ProductExplorerMetadata;

	/* Main content area */
	children?:        React.ReactNode;

	/* Layout toggles */
	showExplorer?:    boolean;
	showOutline?:     boolean;
	showHeader?:      boolean;
	showFooter?:      boolean;

	/* Panel widths */
	explorerWidth?:   number;
	outlineWidth?:    number;
}

/* ========================================================================== */
/*  Context                                                                   */
/* ========================================================================== */

interface PECtx {
	tree:     PETreeNode;
	current:  PETreeNode;
	expanded: Set<string>;
	selected: string;
	select:   (node: PETreeNode) => void;
	toggle:   (id: string) => void;
}

const PEContext = createContext<PECtx | null>(null);

function usePE(): PECtx {
	const ctx = useContext(PEContext);
	if (!ctx) throw new Error("PE components must be inside <ProductExplorer>");
	return ctx;
}

/* ========================================================================== */
/*  Tree Builder Helpers  (public API — use to define trees outside the comp) */
/* ========================================================================== */

export function createNode(data: Partial<PETreeNode>): PETreeNode {
	return {
		id:       data.id ?? crypto.randomUUID(),
		name:     data.name ?? "",
		slug:     data.slug ?? "",
		path:     data.path ?? "",
		type:     data.type ?? "page",
		children: data.children ?? [],
		...data,
	};
}

export function definePERoot(
	id: string,
	title: string,
	children: PETreeNode[],
): PETreeNode {
	return createNode({ id, title, name: id, type: "root", slug: `/${id}`, path: `/${id}`, children });
}

export function definePEProduct(
	id: string,
	title: string,
	opts: Partial<Omit<PETreeNode, "id" | "title" | "type" | "children">> = {},
	children: PETreeNode[] = [],
): PETreeNode {
	return createNode({ id, title, name: id, type: "product", slug: `/${id}`, path: `/${id}`, children, ...opts });
}

export function definePEFolder(
	id: string,
	title: string,
	opts: Partial<Omit<PETreeNode, "id" | "title" | "type" | "children">> = {},
	children: PETreeNode[] = [],
): PETreeNode {
	return createNode({ id, title, name: id, type: "folder", slug: `/${id}`, path: `/${id}`, children, ...opts });
}

export function definePEPage(
	id: string,
	title: string,
	opts: Partial<Omit<PETreeNode, "id" | "title" | "type" | "children">> = {},
): PETreeNode {
	return createNode({ id, title, name: id, type: "page", slug: `/${id}`, path: `/${id}`, children: [], ...opts });
}

/* ========================================================================== */
/*  Tree Utilities (internal)                                                 */
/* ========================================================================== */

function walkTree(node: PETreeNode, cb: (n: PETreeNode) => void): void {
	cb(node);
	for (const child of node.children) walkTree(child, cb);
}

function flattenTree(root: PETreeNode): PETreeNode[] {
	const out: PETreeNode[] = [];
	walkTree(root, (n) => out.push(n));
	return out;
}

function sortChildren(node: PETreeNode): void {
	node.children.sort((a, b) => {
		const ao = a.order ?? Number.MAX_SAFE_INTEGER;
		const bo = b.order ?? Number.MAX_SAFE_INTEGER;
		if (ao !== bo) return ao - bo;
		return (a.title ?? a.name).localeCompare(b.title ?? b.name);
	});
	node.children.forEach(sortChildren);
}

function assignParents(node: PETreeNode, parent?: PETreeNode): void {
	node.parent = parent;
	node.children.forEach((c) => assignParents(c, node));
}

function assignLinearNavigation(root: PETreeNode): void {
	const pages = flattenTree(root).filter((n) => n.type === "page");
	for (let i = 0; i < pages.length; i++) {
		pages[i].previous = pages[i - 1];
		pages[i].next     = pages[i + 1];
	}
}

function buildBreadcrumbs(node: PETreeNode): PETreeNode[] {
	const result: PETreeNode[] = [];
	let cur: PETreeNode | undefined = node;
	while (cur) {
		result.unshift(cur);
		cur = cur.parent;
	}
	return result;
}

function expandParents(node: PETreeNode, set: Set<string>): void {
	let cur = node.parent;
	while (cur) {
		set.add(cur.id);
		cur = cur.parent;
	}
}

/** Assigns parents, sorts children, links prev/next — call once before render. */
export function finalizeTree(root: PETreeNode): void {
	assignParents(root);
	sortChildren(root);
	assignLinearNavigation(root);
}

/* ========================================================================== */
/*  Main Component                                                            */
/* ========================================================================== */

export default function ProductExplorer({
	tree:        treeProp,
	onNavigate,
	title,
	description,
	metadata,
	children,
	showExplorer  = true,
	showOutline   = true,
	showHeader    = true,
	showFooter    = true,
	explorerWidth = 310,
	outlineWidth  = 300,
}: ProductExplorerProps) {

	/* Finalize once — stable as long as treeProp ref is stable */
	const root = useMemo<PETreeNode>(() => {
		const t = treeProp ?? createNode({
			type:     "root",
			id:       "docs",
			name:     "docs",
			title:    "Documentation",
			slug:     "/docs",
			path:     "/docs",
			children: [],
		});
		finalizeTree(t);
		return t;
	}, [treeProp]);

	const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.id]));
	const [selected, setSelected] = useState<string>(root.id);

	const current = useMemo(
		() => flattenTree(root).find((n) => n.id === selected) ?? root,
		[root, selected],
	);

	const select = useCallback((node: PETreeNode): void => {
		setSelected(node.id);
		setExpanded((prev) => {
			const next = new Set(prev);
			next.add(node.id);
			expandParents(node, next);
			return next;
		});
		onNavigate?.(node);
	}, [onNavigate]);

	const toggle = useCallback((id: string): void => {
		setExpanded((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	}, []);

	const ctx = useMemo<PECtx>(
		() => ({ tree: root, current, expanded, selected, select, toggle }),
		[root, current, expanded, selected, select, toggle],
	);

	return (
		<PEContext.Provider value={ctx}>
			<style suppressHydrationWarning>{PE_CSS}</style>

			<div
				className="pe-root"
				style={{
					"--pe-left":  `${explorerWidth}px`,
					"--pe-right": `${outlineWidth}px`,
				} as React.CSSProperties}
			>
				{showExplorer && <ExplorerPane />}

				<div className="pe-content">
					{showHeader && (
						<HeaderPane
							title={title}
							description={description}
							metadata={metadata}
						/>
					)}

					<main className="pe-document">
						{children}
					</main>

					{showFooter && <FooterPane />}
				</div>

				{showOutline && <OutlinePane />}
			</div>
		</PEContext.Provider>
	);
}

/* ========================================================================== */
/*  Icon & Label Helpers                                                      */
/* ========================================================================== */

function nodeIcon(node: PETreeNode): string {
	if (node.icon) return node.icon;
	switch (node.type) {
		case "root":    return "🏠";
		case "product": return "📦";
		case "folder":  return "📁";
		default:        return "📄";
	}
}

function nodeLabel(node: PETreeNode): string {
	return node.title ?? node.name ?? "Untitled";
}

/* ========================================================================== */
/*  Explorer Node                                                             */
/* ========================================================================== */

function ExplorerNode({ node, depth }: { node: PETreeNode; depth: number }) {
	const { expanded, selected, select, toggle } = usePE();

	const isExpanded  = expanded.has(node.id);
	const isSelected  = selected === node.id;
	const hasChildren = node.children.length > 0;

	function handleClick(): void {
		if (hasChildren) toggle(node.id);
		select(node);
	}

	return (
		<div>
			<button
				type="button"
				className={["pe-node", isSelected && "selected"].filter(Boolean).join(" ")}
				style={{ paddingLeft: `${depth * 18}px` }}
				onClick={handleClick}
			>
				<span className="pe-arrow">
					{hasChildren ? (isExpanded ? "▼" : "▶") : ""}
				</span>

				<span className="pe-icon">{nodeIcon(node)}</span>

				<span className="pe-title">{nodeLabel(node)}</span>

				{node.badge && (
					<span className="pe-badge">{node.badge}</span>
				)}
			</button>

			{isExpanded && hasChildren && node.children.map((child) => (
				<ExplorerNode key={child.id} node={child} depth={depth + 1} />
			))}
		</div>
	);
}

/* ========================================================================== */
/*  Explorer Pane                                                             */
/* ========================================================================== */

function ExplorerPane() {
	const { tree } = usePE();

	return (
		<aside className="pe-explorer">
			<div className="pe-sidebar-header">
				<h3>{tree.title ?? "Documentation"}</h3>
			</div>

			<div className="pe-sidebar-body">
				<ExplorerNode node={tree} depth={0} />
			</div>
		</aside>
	);
}

/* ========================================================================== */
/*  Breadcrumb Bar                                                            */
/* ========================================================================== */

function BreadcrumbItem({ node, active = false }: { node: PETreeNode; active?: boolean }) {
	const { select } = usePE();

	return (
		<button
			type="button"
			className={["pe-breadcrumb-item", active && "active"].filter(Boolean).join(" ")}
			onClick={() => select(node)}
		>
			<span>{nodeIcon(node)}</span>
			<span>{nodeLabel(node)}</span>
		</button>
	);
}

function BreadcrumbDivider() {
	return (
		<span className="pe-breadcrumb-divider" aria-hidden>▶</span>
	);
}

function BreadcrumbBar() {
	const { current } = usePE();
	const breadcrumbs = buildBreadcrumbs(current);

	return (
		<nav className="pe-breadcrumbs" aria-label="Breadcrumb">
			{breadcrumbs.map((node, i) => (
				<React.Fragment key={node.id}>
					<BreadcrumbItem
						node={node}
						active={i === breadcrumbs.length - 1}
					/>
					{i < breadcrumbs.length - 1 && <BreadcrumbDivider />}
				</React.Fragment>
			))}
		</nav>
	);
}

/* ========================================================================== */
/*  Header Pane                                                               */
/* ========================================================================== */

function HeaderMetadata({ meta }: { meta?: ProductExplorerMetadata }) {
	if (!meta) return null;

	return (
		<div className="pe-meta">
			{meta.author?.avatar && (
				<img className="pe-avatar" src={meta.author.avatar} alt={meta.author.name} />
			)}

			<div className="pe-meta-info">
				{meta.author && (
					<div className="pe-meta-row">
						<span className="pe-meta-label">Author</span>
						<span>{meta.author.name}</span>
					</div>
				)}
				{meta.version && (
					<div className="pe-meta-row">
						<span className="pe-meta-label">Version</span>
						<span>{meta.version}</span>
					</div>
				)}
				{meta.status && (
					<div className="pe-meta-row">
						<span className="pe-meta-label">Status</span>
						<span className={`pe-status ${meta.status}`}>{meta.status}</span>
					</div>
				)}
				{meta.updated && (
					<div className="pe-meta-row">
						<span className="pe-meta-label">Updated</span>
						<span>{meta.updated}</span>
					</div>
				)}
			</div>
		</div>
	);
}

function HeaderPane({
	title,
	description,
	metadata,
}: {
	title?:       string;
	description?: string;
	metadata?:    ProductExplorerMetadata;
}) {
	return (
		<header className="pe-header">
			<BreadcrumbBar />

			<div className="pe-header-content">
				{title && <h1>{title}</h1>}
				{description && <p>{description}</p>}
				<HeaderMetadata meta={metadata} />
			</div>
		</header>
	);
}

/* ========================================================================== */
/*  Outline & Footer (Placeholders — extend as needed)                       */
/* ========================================================================== */

function OutlinePane() {
	return <aside className="pe-outline" />;
}

function FooterPane() {
	const { current } = usePE();
	const prev = current.previous;
	const next = current.next;

	if (!prev && !next) return null;

	return (
		<footer className="pe-footer">
			<div className="pe-footer-nav">
				{prev && (
					<div className="pe-footer-prev">
						<span className="pe-footer-label">← Previous</span>
						<span className="pe-footer-title">{nodeLabel(prev)}</span>
					</div>
				)}
				{next && (
					<div className="pe-footer-next">
						<span className="pe-footer-label">Next →</span>
						<span className="pe-footer-title">{nodeLabel(next)}</span>
					</div>
				)}
			</div>
		</footer>
	);
}

/* ========================================================================== */
/*  All CSS (consolidated — one injection, SSR-safe via suppressHydrationWarning) */
/* ========================================================================== */

const PE_CSS = `

/* ── Layout ──────────────────────────────────────────────────────────────── */

.pe-root {
	display: grid;
	grid-template-columns: var(--pe-left) minmax(0,1fr) var(--pe-right);
	min-height: calc(100svh - var(--header-height, 0px));
	background: var(--e-bg, #070b12);
	color: white;
	font-family: inherit;
}

.pe-explorer {
	position: sticky;
	top: var(--header-height, 0px);
	height: calc(100svh - var(--header-height, 0px));
	overflow-y: auto;
	border-right: 1px solid rgba(255,255,255,.06);
	padding: 1.75rem 1.25rem;
	scrollbar-width: thin;
	scrollbar-color: rgba(255,255,255,.1) transparent;
}

.pe-content {
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.pe-header {
	padding: 2.5rem 3rem 2rem;
	border-bottom: 1px solid rgba(255,255,255,.05);
}

.pe-document {
	flex: 1;
	padding: 2.5rem 3rem;
	max-width: 1100px;
	width: 100%;
}

.pe-outline {
	position: sticky;
	top: var(--header-height, 0px);
	height: calc(100svh - var(--header-height, 0px));
	overflow-y: auto;
	padding: 1.75rem 1.25rem;
	border-left: 1px solid rgba(255,255,255,.06);
}

.pe-footer {
	padding: 2rem 3rem;
	border-top: 1px solid rgba(255,255,255,.05);
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

.pe-sidebar-header {
	padding-bottom: 1rem;
	border-bottom: 1px solid rgba(255,255,255,.06);
	margin-bottom: 1rem;
}

.pe-sidebar-header h3 {
	font-size: .78rem;
	font-weight: 700;
	letter-spacing: .1em;
	text-transform: uppercase;
	color: rgba(255,255,255,.45);
}

.pe-sidebar-body {
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.pe-node {
	width: 100%;
	display: flex;
	align-items: center;
	gap: .6rem;
	padding: .55rem .75rem;
	border: 1px solid transparent;
	background: transparent;
	color: rgba(255,255,255,.72);
	cursor: pointer;
	border-radius: 10px;
	transition: background .18s, color .18s, border-color .18s;
	font-size: .875rem;
	text-align: left;
}

.pe-node:hover {
	background: rgba(255,255,255,.045);
	color: white;
}

.pe-node.selected {
	background: rgba(96,165,250,.12);
	border-color: rgba(96,165,250,.22);
	color: #93c5fd;
}

.pe-arrow {
	width: 14px;
	flex-shrink: 0;
	opacity: .5;
	font-size: .7rem;
}

.pe-icon {
	width: 18px;
	text-align: center;
	flex-shrink: 0;
	font-size: .9rem;
}

.pe-title {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pe-badge {
	flex-shrink: 0;
	font-size: .65rem;
	padding: .12rem .4rem;
	border-radius: 999px;
	background: rgba(96,165,250,.16);
	color: #60a5fa;
	font-weight: 700;
	letter-spacing: .02em;
}

/* ── Breadcrumbs ─────────────────────────────────────────────────────────── */

.pe-breadcrumbs {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: .25rem;
	margin-bottom: 1.75rem;
	font-size: .85rem;
}

.pe-breadcrumb-item {
	display: flex;
	align-items: center;
	gap: .45rem;
	padding: .35rem .65rem;
	border: none;
	border-radius: 999px;
	cursor: pointer;
	background: transparent;
	color: rgba(255,255,255,.5);
	transition: background .18s, color .18s;
	font-size: inherit;
}

.pe-breadcrumb-item:hover {
	background: rgba(255,255,255,.05);
	color: white;
}

.pe-breadcrumb-item.active {
	background: rgba(96,165,250,.12);
	color: #60a5fa;
	font-weight: 600;
}

.pe-breadcrumb-divider {
	color: rgba(255,255,255,.25);
	font-size: .65rem;
	user-select: none;
}

/* ── Header Content ──────────────────────────────────────────────────────── */

.pe-header-content {
	display: flex;
	flex-direction: column;
	gap: .85rem;
}

.pe-header-content h1 {
	font-size: clamp(2rem, 4.5vw, 3.5rem);
	font-weight: 900;
	line-height: 1.08;
	letter-spacing: -.02em;
}

.pe-header-content > p {
	max-width: 800px;
	font-size: 1.05rem;
	line-height: 1.75;
	color: rgba(255,255,255,.6);
}

/* ── Metadata Card ───────────────────────────────────────────────────────── */

.pe-meta {
	margin-top: 1.5rem;
	display: flex;
	align-items: flex-start;
	gap: 1.5rem;
	padding: 1.25rem 1.5rem;
	border-radius: 16px;
	border: 1px solid rgba(255,255,255,.06);
	background: rgba(255,255,255,.02);
	backdrop-filter: blur(12px);
}

.pe-avatar {
	width: 64px;
	height: 64px;
	border-radius: 999px;
	object-fit: cover;
	border: 2px solid rgba(255,255,255,.08);
	flex-shrink: 0;
}

.pe-meta-info {
	display: flex;
	flex-wrap: wrap;
	column-gap: 2rem;
	row-gap: .75rem;
	flex: 1;
}

.pe-meta-row {
	display: flex;
	align-items: center;
	gap: .6rem;
	font-size: .88rem;
}

.pe-meta-label {
	color: rgba(255,255,255,.4);
	font-weight: 600;
}

.pe-status {
	padding: .18rem .55rem;
	border-radius: 999px;
	font-size: .75rem;
	font-weight: 700;
	text-transform: capitalize;
}
.pe-status.stable     { background: rgba(52,211,153,.14); color: #34d399; }
.pe-status.beta       { background: rgba(96,165,250,.14); color: #60a5fa; }
.pe-status.alpha      { background: rgba(251,191,36,.14); color: #fbbf24; }
.pe-status.deprecated { background: rgba(239,68,68,.14);  color: #ef4444; }

/* ── Footer Nav ──────────────────────────────────────────────────────────── */

.pe-footer-nav {
	display: flex;
	justify-content: space-between;
	gap: 1rem;
}

.pe-footer-prev,
.pe-footer-next {
	display: flex;
	flex-direction: column;
	gap: .35rem;
}

.pe-footer-next { text-align: right; }

.pe-footer-label {
	font-size: .8rem;
	color: rgba(255,255,255,.4);
	font-weight: 600;
}

.pe-footer-title {
	font-size: .95rem;
	color: #60a5fa;
	font-weight: 600;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */

@media (max-width: 1200px) {
	.pe-root { grid-template-columns: 280px minmax(0,1fr); }
	.pe-outline { display: none; }
}

@media (max-width: 900px) {
	.pe-root { grid-template-columns: 1fr; }
	.pe-explorer { display: none; }
	.pe-header { padding: 1.75rem; }
	.pe-document { padding: 1.75rem; }
	.pe-footer { padding: 1.5rem 1.75rem; }
}

@media (max-width: 900px) {
	.pe-meta { flex-direction: column; }
}

`;