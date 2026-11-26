// components/DocsShell.tsx — Native 3-column Kastrick Documentation shell.
// Includes:
//   - Top Projects dropdown (RBE, Next.js Engine, PackageX, PackX, PackageX SDKs, Kastrick's Utility)
//   - Docs / Guides dual tracks & Ctrl/Cmd+K instant search
//   - Right-side vertical scroll-progress Battery ("Click to Share") emitting /share/<8char> URLs
//   - EngineScroll #-es?move=<target>&offset=-84&duration=550 share URL resolution
//   - In-app Pinning/Bookmarks + Android-style floating text-selection pill (Copy | Pin | Notebook)
//   - Verbatim CC BY-ND 4.0 .md download & GitHub Issue edit links

"use client";

import { track as trackEvent } from "@vercel/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DocPageMeta, DocTrack, DocsManifest, ProjectRecord } from "@/lib/content";
import { decodeShareCode, encodeShareCode, SHARE_HEADING_ANCHOR_BASE } from "@/lib/shareCode";

interface DocsShellProps {
	manifest: DocsManifest;
	project: ProjectRecord;
	track: DocTrack;
	page: DocPageMeta | null;
	htmlContent: string;
	rawMarkdown: string;
}

interface BookmarkItem {
	key: string;
	projectId: string;
	projectName: string;
	track: DocTrack;
	slug: string;
	anchor: string;
	title: string;
}

interface NotebookItem {
	id: string;
	quote: string;
	note: string;
	projectId: string;
	projectName: string;
	track: DocTrack;
	slug: string;
	pageTitle: string;
	anchor: string;
	createdAt?: number;
}

function isNotebookItem(value: unknown): value is NotebookItem {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<NotebookItem>;
	return typeof item.id === "string" &&
		typeof item.quote === "string" &&
		typeof item.note === "string" &&
		typeof item.projectId === "string" &&
		typeof item.projectName === "string" &&
		(item.track === "docs" || item.track === "guides") &&
		typeof item.slug === "string" &&
		typeof item.pageTitle === "string" &&
		typeof item.anchor === "string";
}

function notebookSourceHref(item: NotebookItem): string {
	const anchor = item.anchor
		? "#-es?move=" + encodeURIComponent(item.anchor) + "&offset=-84&duration=550"
		: "";
	return "/" + item.projectId + "/" + item.slug + anchor;
}

function formatNotebookDate(timestamp?: number): string {
	if (!timestamp || !Number.isFinite(timestamp)) return "Saved previously";
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

const ES_PROTOCOL = "#-es?";
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

/** Parse and execute an EngineScroll #-es share URL against the live DOM. */
function executeEngineScrollHash(rawHash?: string): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	const hash = rawHash ?? window.location.hash;
	if (!hash.startsWith(ES_PROTOCOL)) {
		return null;
	}
	const params = new URLSearchParams(hash.slice(ES_PROTOCOL.length));
	const move = params.get("move");
	if (!move) {
		return null;
	}
	const offset = Number(params.get("offset") ?? "-84");
	const safeOffset = Number.isFinite(offset) ? offset : -84;
	const targetId = move.startsWith("#") ? move.slice(1) : move;

	if (targetId === "top") {
		window.scrollTo({ top: Math.max(0, safeOffset), behavior: "smooth" });
		return "top";
	}
	if (targetId === "bottom") {
		window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
		return "bottom";
	}
	const numeric = Number(targetId);
	if (!Number.isNaN(numeric) && targetId.trim() !== "") {
		window.scrollTo({ top: Math.max(0, numeric + safeOffset), behavior: "smooth" });
		return targetId;
	}

	const el = document.getElementById(decodeURIComponent(targetId));
	if (!el) {
		return null;
	}
	const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY + safeOffset);
	window.scrollTo({ top, behavior: "smooth" });
	// Clear any previous highlight so multiple headings never stay highlighted or stack.
	document.querySelectorAll(".kd-share-highlight").forEach((node) => {
		node.classList.remove("kd-share-highlight");
	});
	void el.offsetWidth;
	el.classList.add("kd-share-highlight");
	clearTimeout(highlightTimer);
	highlightTimer = setTimeout(() => {
		el.classList.remove("kd-share-highlight");
	}, 2200);
	return targetId;
}

export default function DocsShell({
	manifest,
	project,
	track,
	page,
	htmlContent,
	rawMarkdown,
}: DocsShellProps) {
	const router = useRouter();
	const [projectsOpen, setProjectsOpen] = useState(false);
	const [pagesOpen, setPagesOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [bookmarksOpen, setBookmarksOpen] = useState(false);
	const [notebookOpen, setNotebookOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [toast, setToast] = useState<string | null>(null);
	const [scrollPct, setScrollPct] = useState(0);
	const [showBattery, setShowBattery] = useState(false);
	const [lastAnchor, setLastAnchor] = useState("top");
	const [shortShareUrl, setShortShareUrl] = useState("");
	const [shortCodeInput, setShortCodeInput] = useState("");
	const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
	const [notebook, setNotebook] = useState<NotebookItem[]>([]);
	const [notebookQuery, setNotebookQuery] = useState("");
	const [notebookScope, setNotebookScope] = useState<"all" | "project">("all");
	const [selectionBar, setSelectionBar] = useState<{
		visible: boolean;
		left: number;
		top: number;
		text: string;
		anchor: string;
	}>({ visible: false, left: 0, top: 0, text: "", anchor: "" });

	const dropdownRef = useRef<HTMLDivElement | null>(null);
	const articleRef = useRef<HTMLElement | null>(null);

	const notify = (msg: string) => {
		setToast(msg);
		setTimeout(() => setToast(null), 2000);
	};

	// Load persisted pins and notebook markings from localStorage.
	useEffect(() => {
		try {
			const rawPins = localStorage.getItem("kastrick-docs-pins");
			if (rawPins) setBookmarks(JSON.parse(rawPins));
			const rawNotes = localStorage.getItem("kastrick-docs-notebook");
			if (rawNotes) {
				const parsed: unknown = JSON.parse(rawNotes);
				if (Array.isArray(parsed)) setNotebook(parsed.filter(isNotebookItem));
			}
		} catch {
			// Ignore storage failures in restricted contexts.
		}
	}, []);

	const persistBookmarks = (next: BookmarkItem[]) => {
		setBookmarks(next);
		try {
			localStorage.setItem("kastrick-docs-pins", JSON.stringify(next));
		} catch {}
	};

	const persistNotebook = (next: NotebookItem[]) => {
		setNotebook(next);
		try {
			localStorage.setItem("kastrick-docs-notebook", JSON.stringify(next));
		} catch {}
	};

	// Close Projects dropdown on outside click.
	useEffect(() => {
		const onOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setProjectsOpen(false);
				setPagesOpen(false);
				setPagesOpen(false);
			}
		};
		document.addEventListener("mousedown", onOutside);
		return () => document.removeEventListener("mousedown", onOutside);
	}, []);

	// Keep the share battery only on pages with enough scroll depth to make it useful.
	useEffect(() => {
		const onScroll = () => {
			const doc = document.documentElement;
			const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
			const readingContentBottom = articleRef.current
				? articleRef.current.getBoundingClientRect().bottom + window.scrollY
				: 0;
			const usefulScrollDepth = Math.max(220, Math.round(window.innerHeight * 0.32));
			setShowBattery(readingContentBottom - window.innerHeight > usefulScrollDepth);
			setScrollPct(maxScroll > 0
				? Math.max(0, Math.min(100, Math.round((window.scrollY / maxScroll) * 100)))
				: 0);
			const headings = articleRef.current?.querySelectorAll("h2[id], h3[id], p[id], li[id]");
			if (headings) {
				for (const el of Array.from(headings)) {
					const rect = el.getBoundingClientRect();
					if (rect.top >= 56 && rect.top <= window.innerHeight * 0.65) {
						setLastAnchor(el.id);
						break;
					}
				}
			}
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);
		const observer = typeof ResizeObserver !== "undefined"
			? new ResizeObserver(onScroll)
			: null;
		if (observer) observer.observe(document.documentElement);
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			observer?.disconnect();
		};
	}, [page?.slug]);

	// Listen for Ctrl/Cmd+K, Escape, and EngineScroll #-es hash navigation.
	useEffect(() => {
		executeEngineScrollHash();
		const onHash = () => {
			executeEngineScrollHash();
		};
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setSearchOpen((prev) => !prev);
			} else if (e.key === "Escape") {
				setSearchOpen(false);
				setProjectsOpen(false);
				setBookmarksOpen(false);
				setNotebookOpen(false);
				setShareOpen(false);
				setSelectionBar((prev) => ({ ...prev, visible: false }));
			}
		};
		window.addEventListener("hashchange", onHash);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("hashchange", onHash);
			window.removeEventListener("keydown", onKey);
		};
	}, [page?.slug]);

	// Android-style floating text selection pill (Copy | Pin | Notebook).
	useEffect(() => {
		const updateSelection = () => {
			const sel = window.getSelection();
			if (!sel || sel.isCollapsed) {
				setSelectionBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
				return;
			}
			const text = sel.toString().trim();
			if (text.length < 2 || !sel.anchorNode || !articleRef.current?.contains(sel.anchorNode)) {
				setSelectionBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
				return;
			}
			const rect = sel.getRangeAt(0).getBoundingClientRect();
			const parentEl =
				sel.anchorNode.nodeType === 1
					? (sel.anchorNode as HTMLElement)
					: sel.anchorNode.parentElement;
			const anchorEl = parentEl?.closest("[id]");
			const left = Math.max(12, Math.min(window.innerWidth - 220, rect.left + rect.width / 2 - 95));
			const top = Math.max(64, rect.top - 44);
			setSelectionBar({
				visible: true,
				left,
				top,
				text,
				anchor: anchorEl?.id ?? lastAnchor,
			});
		};
		document.addEventListener("mouseup", updateSelection);
		document.addEventListener("keyup", updateSelection);
		return () => {
			document.removeEventListener("mouseup", updateSelection);
			document.removeEventListener("keyup", updateSelection);
		};
	}, [lastAnchor]);

	// Wire code block copy buttons inside static Markdown HTML.
	useEffect(() => {
		const onClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target || !target.matches(".kd-copy-btn")) {
				return;
			}
			const code = target.closest(".kd-code-wrap")?.querySelector("code")?.textContent ?? "";
			navigator.clipboard?.writeText(code).catch(() => {});
			notify("Code copied");
		};
		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);

	const trackPages = useMemo(
		() => project.pages.filter((p) => p.track === track),
		[project.pages, track],
	);

	const filteredNotebook = useMemo(() => {
		const search = notebookQuery.trim().toLowerCase();
		return notebook.filter((item) => {
			if (notebookScope === "project" && item.projectId !== project.id) return false;
			if (!search) return true;
			return [
				item.quote,
				item.note,
				item.projectName,
				item.pageTitle,
				item.slug,
			].some((value) => value.toLowerCase().includes(search));
		});
	}, [notebook, notebookQuery, notebookScope, project.id]);

	const searchResults = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return [];
		}
		const hits: Array<{ project: ProjectRecord; page: DocPageMeta }> = [];
		for (const proj of manifest.projects) {
			for (const p of proj.pages) {
				if (p.title.toLowerCase().includes(q) || proj.name.toLowerCase().includes(q)) {
					hits.push({ project: proj, page: p });
				}
			}
		}
		return hits.slice(0, 12);
	}, [manifest.projects, query]);

	// Click vertical Battery bar -> generate /share/<8char> with level + track in Vercel Analytics.
	const handleBatteryShare = () => {
		const projectIdx = Math.max(
			0,
			manifest.projects.findIndex((p) => p.id === project.id),
		);
		const pageIdx = Math.max(
			0,
			trackPages.findIndex((p) => p.slug === page?.slug),
		);
		const lineMatch = lastAnchor.match(/^L(\d+)$/);
		const headingIdx = page?.toc.findIndex((item) => item.id === lastAnchor) ?? -1;
		const parsedLine = lineMatch ? Number(lineMatch[1]) : 0;
		const lineIdx = parsedLine > 0
			? Math.min(parsedLine, SHARE_HEADING_ANCHOR_BASE - 1)
			: headingIdx >= 0
				? SHARE_HEADING_ANCHOR_BASE + headingIdx
				: 0;
		const code = encodeShareCode({
			projectIdx,
			trackIdx: track === "guides" ? 1 : 0,
			pageIdx,
			lineIdx,
			levelPct: scrollPct,
		});
		const url = `${window.location.origin}/share/${code}`;
		setShortShareUrl(url);
		setShortCodeInput(code);
		setShareOpen(true);
		navigator.clipboard?.writeText(url).catch(() => {});
		try {
			trackEvent("doc_share_create", {
				code,
				project: project.id,
				track,
				slug: page?.slug ?? "overview",
				levelPct: scrollPct,
			});
		} catch {}
		notify(`Copied /share/${code} (Level ${scrollPct}%)`);
	};

	const handleResolveShortCode = () => {
		const cleaned = shortCodeInput.trim().replace(/^.*\/share\//i, "").slice(0, 8);
		const decoded = decodeShareCode(cleaned);
		if (!decoded) {
			notify("Invalid 8-character share code");
			return;
		}
		setShareOpen(false);
		router.push(`/share/${cleaned}`);
	};

	const togglePin = (anchor: string, title: string) => {
		const slug = page?.slug ?? "overview";
		const key = `${project.id}:${track}:${slug}:${anchor}`;
		const exists = bookmarks.some((b) => b.key === key);
		if (exists) {
			persistBookmarks(bookmarks.filter((b) => b.key !== key));
			notify("Removed from Pinned");
		} else {
			persistBookmarks([
				{ key, projectId: project.id, projectName: project.name, track, slug, anchor, title },
				...bookmarks,
			]);
			notify(`Pinned "${title}"`);
		}
	};

	const saveSelectionToNotebook = () => {
		if (!selectionBar.text) return;
		const next: NotebookItem[] = [
			{
				id: `nb-${Date.now()}`,
				quote: selectionBar.text,
				note: "",
				projectId: project.id,
				projectName: project.name,
				track,
				slug: page?.slug ?? "overview",
				pageTitle: page?.title ?? project.name,
				anchor: selectionBar.anchor,
				createdAt: Date.now(),
			},
			...notebook,
		];
		persistNotebook(next);
		setSelectionBar((prev) => ({ ...prev, visible: false }));
		notify("Saved highlight to Notebook");
	};

	const updateNotebookNote = (id: string, note: string) => {
		persistNotebook(notebook.map((item) => item.id === id ? { ...item, note } : item));
	};

	const removeNotebookItem = (id: string) => {
		persistNotebook(notebook.filter((item) => item.id !== id));
		notify("Removed from Notebook");
	};

	const copyNotebookQuote = (quote: string) => {
		if (!navigator.clipboard) {
			notify("Clipboard access is unavailable");
			return;
		}
		void navigator.clipboard.writeText(quote)
			.then(() => notify("Quote copied"))
			.catch(() => notify("Could not access the clipboard"));
	};

	const handleExportNotebook = () => {
		const markdown = [
			"# Kastrick Docs Notebook",
			"\nExported " + new Date().toLocaleString(),
			...notebook.map((item) => {
				const source = window.location.origin + notebookSourceHref(item);
				const quote = item.quote.split("\n").map((line) => "> " + line).join("\n");
				return [
					"## " + item.pageTitle,
					"**" + item.projectName + "** · " + item.track.toUpperCase(),
					quote,
					item.note ? "**My note**\n\n" + item.note : "",
					"[Open source](" + source + ")",
					formatNotebookDate(item.createdAt),
				].filter(Boolean).join("\n\n");
			}),
		].join("\n\n---\n\n");
		const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "kastrick-docs-notebook.md";
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		notify("Exported " + notebook.length + " Notebook entries");
	};

	const handleDownloadMarkdown = () => {
		const filename = `${project.id}-${track}-${page?.slug ?? "overview"}.md`;
		const header = `<!-- Source: ${project.repoUrl} | License: ${manifest.license.name} (${manifest.license.url}) -->\n\n`;
		const blob = new Blob([header + rawMarkdown], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		notify(`Downloaded ${filename}`);
	};

	const issueTitle = project.issueTemplate
		? `[DSE] ${project.name}: ${page?.title ?? "Documentation"}`
		: `[Docs] ${project.name} (${track}): ${page?.title ?? "General"}`;
	const issueParams = new URLSearchParams({ title: issueTitle });
	if (project.issueTemplate) {
		issueParams.set("template", project.issueTemplate);
	}
	const issueUrl = `${project.repoUrl}/issues/new?${issueParams.toString()}`;

	return (
		<div className="kd-root">
			<header className="kd-topbar kd-doc-header">
				<div className="kd-topbar-left" ref={dropdownRef}>
					<Link href="/" className="kd-brand kd-doc-brand" title="Kastrick Documentation">
						<span className="kd-doc-brand-full">
							<span className="kd-doc-brand-name">Kastrick</span>
							<span className="kd-doc-brand-subtitle">(Docs)</span>
						</span>
						<span className="kd-doc-brand-compact" aria-hidden="true">K8D</span>
					</Link>

					{/* Interactive Path Hierarchy: / <project> / <slug> */}
					<nav className="kd-path-bar" aria-label="Documentation path">
						<div className="kd-dropdown">
							<button
								type="button"
								className="kd-slash-btn"
								title="Switch project"
								onClick={() => {
									setPagesOpen(false);
									setProjectsOpen((o) => !o);
								}}
							>
								/
							</button>
							<Link href={`/${project.id}`} className="kd-path-seg">
								{project.id}
							</Link>
							{projectsOpen && (
								<div className="kd-dropdown-menu">
									{manifest.projects.map((proj) => (
										<Link
											key={proj.id}
											href={`/${proj.id}`}
											className={`kd-dropdown-item ${proj.id === project.id ? "active" : ""}`}
											onClick={() => setProjectsOpen(false)}
										>
											<div className="kd-dropdown-item-head">
												<span>/{proj.id} · {proj.name}</span>
												{!proj.established && <span className="kd-badge-notest">NOT_EST</span>}
											</div>
											<small>{proj.description}</small>
										</Link>
									))}
								</div>
							)}
						</div>

						{page && (
							<div className="kd-dropdown">
								<button
									type="button"
									className="kd-slash-btn"
									title={`Browse /${project.id} pages`}
									onClick={() => {
										setProjectsOpen(false);
										setPagesOpen((o) => !o);
									}}
								>
									/
								</button>
								<button
									type="button"
									className="kd-path-seg kd-path-seg-active"
									onClick={() => {
										setProjectsOpen(false);
										setPagesOpen((o) => !o);
									}}
								>
									{page.slug} ▾
								</button>
								{pagesOpen && (
									<div className="kd-dropdown-menu kd-pages-menu">
										<Link
											href={`/${project.id}`}
											className="kd-dropdown-item"
											onClick={() => setPagesOpen(false)}
										>
											<div className="kd-dropdown-item-head">
												<span>/{project.id}</span>
												<span className="kd-badge-notest">INDEX</span>
											</div>
											<small>Project landing &amp; full page list</small>
										</Link>
										{project.pages.map((item) => (
											<Link
												key={item.slug}
												href={`/${project.id}/${item.slug}`}
												className={`kd-dropdown-item ${item.slug === page.slug ? "active" : ""}`}
												onClick={() => setPagesOpen(false)}
											>
												<div className="kd-dropdown-item-head">
													<span>/{project.id}/{item.slug}</span>
													<span className="kd-badge-notest">{item.track.toUpperCase()}</span>
												</div>
												<small>{item.title}</small>
											</Link>
										))}
									</div>
								)}
							</div>
						)}
					</nav>
				</div>
				<div className="kd-topbar-right">
					<button type="button" className="kd-btn-secondary" onClick={() => setBookmarksOpen(true)}>
						Pinned ({bookmarks.length})
					</button>
					<button type="button" className="kd-btn-secondary" onClick={() => setNotebookOpen(true)}>
						Notebook ({notebook.length})
					</button>
					<button type="button" className="kd-search-trigger" onClick={() => setSearchOpen(true)}>
						Search... <kbd>⌘K</kbd>
					</button>
					<a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="kd-repo-link">
						GitHub
					</a>
				</div>
			</header>

			<div className="kd-grid">
				<aside className="kd-sidebar">
					<div className="kd-track-switch">
						{(["docs", "guides"] as DocTrack[]).map((t) => {
							const targetPage = project.pages.find((p) => p.track === t);
							const href = targetPage
								? `/${project.id}/${targetPage.slug}`
								: `/${project.id}`;
							return (
								<Link key={t} href={href} className={`kd-track-btn ${track === t ? "active" : ""}`}>
									{t === "docs" ? "Docs" : "Guides"}
								</Link>
							);
						})}
					</div>
					{Object.entries(
						trackPages.reduce<Record<string, DocPageMeta[]>>((acc, item) => {
							const sec = item.section || (track === "guides" ? "Guides" : "Documentation");
							(acc[sec] ||= []).push(item);
							return acc;
						}, {}),
					).map(([sectionName, items]) => (
						<div key={sectionName} className="kd-nav-group">
							<div className="kd-nav-group-title">{sectionName}</div>
							<ul className="kd-nav-list">
								{items.map((item) => (
									<li key={item.slug}>
										<Link
											href={`/${project.id}/${item.slug}`}
											className={`kd-nav-link ${page?.slug === item.slug ? "active" : ""}`}
										>
											{item.title}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</aside>

				<main className="kd-main">
					<div className="kd-page-actions">
						<button
							type="button"
							className="kd-btn-secondary"
							onClick={() => togglePin("", page?.title ?? project.name)}
						>
							Pin Page
						</button>
					</div>

					{project.rebaseNotice && (
						<div className="kd-banner-warning" role="alert">
							<strong>Documentation Warning:</strong> {project.rebaseNotice}
						</div>
					)}

					{!project.established ? (
						<section className="kd-notest-card">
							<span className="kd-badge-notest">NOT_EST</span>
							<h1>{project.name}</h1>
							<p>{project.description}</p>
						</section>
					) : (
						<article
							ref={articleRef}
							className="kd-article"
							dangerouslySetInnerHTML={{ __html: htmlContent }}
						/>
					)}


				</main>

				<aside className="kd-toc" aria-label="On this page">
					<div className="kd-toc-row">
						<div>
							<div className="kd-toc-title">On This Page</div>
							<ul>
								{(page?.toc ?? []).map((item) => (
									<li key={item.id} className={`level-${item.level}`}>
										<a href={`#-es?move=${encodeURIComponent(item.id)}&offset=-84&duration=550`}>
											{item.text}
										</a>
									</li>
								))}
							</ul>
						</div>

						{/* Right-side vertical scroll-progress Battery ("Click to Share") */}
						{showBattery && (
						<div className="kd-battery-wrap">
							<span className="kd-battery-tooltip">Click to Share</span>
							<button
								type="button"
								className="kd-battery-btn"
								onClick={handleBatteryShare}
								aria-label="Click to Share current scroll level"
							>
								<span className="kd-battery-cap" />
								<span className="kd-battery-body">
									<span
										className="kd-battery-fill"
										style={{ height: `${Math.max(8, scrollPct)}%` }}
									/>
								</span>
								<span className="kd-battery-pct">{scrollPct}%</span>
							</button>
						</div>
						)}
					</div>
				</aside>
			</div>

			<footer className="kd-doc-site-footer">
				<div className="kd-doc-footer-inner">
					<div className="kd-doc-footer-brand">
						<Link href="/" className="kd-doc-footer-wordmark">
							<span>Kastrick</span>
							<small>(Docs)</small>
						</Link>
						<p>Project documentation, references, and practical guides.</p>
					</div>
					<div className="kd-doc-footer-links">
						{project.established && (
							<button type="button" className="kd-btn-secondary" onClick={handleDownloadMarkdown}>
								Download page (.md)
							</button>
						)}
						<a href={issueUrl} target="_blank" rel="noopener noreferrer">{project.issueTemplate ? "Suggest a documentation edit ↗" : "Suggest an edit ↗"}</a>
						<a href={project.repoUrl} target="_blank" rel="noopener noreferrer">Source repository ↗</a>
						<a href={manifest.license.url} target="_blank" rel="noopener noreferrer">{manifest.license.name}</a>
					</div>
					<div className="kd-doc-footer-meta">
						<span>/{project.id}/{page?.slug ?? "overview"}</span>
						<span>© {new Date().getFullYear()} Kastrick Platform</span>
					</div>
				</div>
			</footer>

			{/* Android-style floating text selection action pill */}
			{selectionBar.visible && (
				<div
					className="kd-selection-pill"
					style={{ left: `${selectionBar.left}px`, top: `${selectionBar.top}px` }}
					onMouseDown={(e) => e.preventDefault()}
				>
					<button
						type="button"
						onClick={() => {
							navigator.clipboard?.writeText(selectionBar.text).catch(() => {});
							setSelectionBar((prev) => ({ ...prev, visible: false }));
							notify("Copied selected text");
						}}
					>
						Copy
					</button>
					<button
						type="button"
						onClick={() => {
							togglePin(selectionBar.anchor, selectionBar.text.slice(0, 48));
							setSelectionBar((prev) => ({ ...prev, visible: false }));
						}}
					>
						Pin
					</button>
					<button type="button" onClick={saveSelectionToNotebook}>
						Notebook
					</button>
				</div>
			)}

			{shareOpen && (
				<div className="kd-modal-backdrop" onClick={() => setShareOpen(false)}>
					<div className="kd-modal" onClick={(e) => e.stopPropagation()}>
						<h3>Share Point (/share/&lt;8char&gt;)</h3>
						<input type="text" readOnly value={shortShareUrl} className="kd-search-input" />
						<div className="kd-footer-actions">
							<input
								type="text"
								value={shortCodeInput}
								onChange={(e) => setShortCodeInput(e.target.value)}
								placeholder="Paste 8-char code"
								className="kd-search-input"
							/>
							<button type="button" className="kd-btn-primary" onClick={handleResolveShortCode}>
								Resolve
							</button>
						</div>
					</div>
				</div>
			)}

			{bookmarksOpen && (
				<div className="kd-modal-backdrop" onClick={() => setBookmarksOpen(false)}>
					<div className="kd-modal" onClick={(e) => e.stopPropagation()}>
						<h3>Pinned Docs &amp; Guides</h3>
						<ul className="kd-search-results">
							{bookmarks.map((b) => (
								<li key={b.key}>
									<Link
										href={`/${b.projectId}/${b.slug}${b.anchor ? `#-es?move=${encodeURIComponent(b.anchor)}&offset=-84&duration=550` : ""}`}
										onClick={() => setBookmarksOpen(false)}
									>
										<strong>{b.title}</strong>
										<span>
											{b.projectName} · {b.track.toUpperCase()}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{notebookOpen && (
				<div className="kd-modal-backdrop kd-notebook-backdrop" onClick={() => setNotebookOpen(false)}>
					<section
						className="kd-modal kd-notebook-modal"
						role="dialog"
						aria-modal="true"
						aria-labelledby="kd-notebook-title"
						onClick={(e) => e.stopPropagation()}
					>
						<header className="kd-notebook-header">
							<div>
								<div className="kd-notebook-eyebrow">PERSONAL RESEARCH</div>
								<h3 id="kd-notebook-title">Notebook <span>{notebook.length} saved</span></h3>
							</div>
							<button type="button" className="kd-notebook-close" onClick={() => setNotebookOpen(false)}>
								Close <span aria-hidden="true">×</span>
							</button>
						</header>

						<div className="kd-notebook-toolbar">
							<input
								type="search"
								value={notebookQuery}
								onChange={(e) => setNotebookQuery(e.target.value)}
								placeholder="Search quotes, notes, projects..."
								className="kd-search-input"
								aria-label="Search Notebook"
							/>
							<div className="kd-notebook-filters" aria-label="Filter Notebook entries">
								<button
									type="button"
									className={notebookScope === "all" ? "active" : ""}
									aria-pressed={notebookScope === "all"}
									onClick={() => setNotebookScope("all")}
								>
									All projects
								</button>
								<button
									type="button"
									className={notebookScope === "project" ? "active" : ""}
									aria-pressed={notebookScope === "project"}
									onClick={() => setNotebookScope("project")}
								>
									This project
								</button>
							</div>
							<button
								type="button"
								className="kd-btn-secondary kd-notebook-export"
								onClick={handleExportNotebook}
								disabled={notebook.length === 0}
							>
								Export .md
							</button>
						</div>

						<div className="kd-notebook-list">
							{filteredNotebook.length === 0 ? (
								<div className="kd-notebook-empty">
									<strong>{notebook.length === 0 ? "Nothing saved yet" : "No matching highlights"}</strong>
									<p>
										{notebook.length === 0
											? "Select a passage in any documentation page and choose Notebook to keep it here."
											: "Try a different search or switch the project filter."}
									</p>
								</div>
							) : (
								filteredNotebook.map((item) => (
									<article key={item.id} className="kd-notebook-entry">
										<div className="kd-notebook-entry-top">
											<span>{item.projectName} <i>·</i> {item.track.toUpperCase()}</span>
											<button
												type="button"
												className="kd-notebook-remove"
												onClick={() => removeNotebookItem(item.id)}
												aria-label={"Remove highlight from " + item.pageTitle}
											>
												Remove
											</button>
										</div>
										<blockquote className="kd-notebook-quote">{item.quote}</blockquote>
										<div className="kd-notebook-source">
											<Link href={notebookSourceHref(item)} onClick={() => setNotebookOpen(false)}>
												{item.pageTitle} <span aria-hidden="true">↗</span>
											</Link>
											<time>{formatNotebookDate(item.createdAt)}</time>
										</div>
										<textarea
											value={item.note}
											onChange={(e) => updateNotebookNote(item.id, e.target.value)}
											placeholder="Add your note or context..."
											rows={2}
											aria-label={"Note for " + item.pageTitle}
										/>
										<div className="kd-notebook-entry-actions">
											<button type="button" onClick={() => copyNotebookQuote(item.quote)}>Copy quote</button>
											<Link href={notebookSourceHref(item)} onClick={() => setNotebookOpen(false)}>
												Open source
											</Link>
										</div>
									</article>
								))
							)}
						</div>
					</section>
				</div>
			)}

			{searchOpen && (
				<div className="kd-modal-backdrop" onClick={() => setSearchOpen(false)}>
					<div className="kd-modal" onClick={(e) => e.stopPropagation()}>
						<input
							type="search"
							autoFocus
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search Kastrick Docs & Guides..."
							className="kd-search-input"
						/>
						<ul className="kd-search-results">
							{searchResults.map(({ project: proj, page: item }) => (
								<li key={`${proj.id}-${item.track}-${item.slug}`}>
									<Link
										href={`/${proj.id}/${item.slug}`}
										onClick={() => setSearchOpen(false)}
									>
										<strong>{item.title}</strong>
										<span>
											{proj.name} · {item.track.toUpperCase()}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{toast && <div className="kd-toast">{toast}</div>}
		</div>
	);
}
