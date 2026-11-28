// components/DocsShell.tsx — Native 3-column Kastrick Documentation shell.
// Includes:
//   - Top Projects dropdown (RBE, Next.js Engine, PackageX, PackX, PackageX SDKs, Kastrick's Utility)
//   - Docs / Guides dual tracks & Ctrl/Cmd+K instant search
//   - Right-side reading context, section outline, and /share/<code> short-link sharing
//   - EngineScroll #-es?move=<target>&offset=-84&duration=550 share URL resolution
//   - In-app Pinning/Bookmarks + Android-style floating text-selection pill (Copy | Pin | Notebook)
//   - Verbatim CC BY-ND 4.0 .md download & GitHub Issue edit links

"use client";

import { track as trackEvent } from "@vercel/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DocPageMeta, DocTrack, DocsManifest, ProjectRecord } from "@/lib/content";
import { encodeShareCode, SHARE_HEADING_ANCHOR_BASE, SHARE_LINK_ORIGIN } from "@/lib/shareCode";

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

interface DocsSearchEntry {
	projectId: string;
	projectName: string;
	track: DocTrack;
	generation?: string;
	generationLabel?: string;
	slug: string;
	title: string;
	section: string;
	text: string;
}

interface DocsSearchResult extends DocsSearchEntry {
	score: number;
	snippet: string;
}

function isDocsSearchEntry(value: unknown): value is DocsSearchEntry {
	if (!value || typeof value !== "object") return false;
	const item = value as Partial<DocsSearchEntry>;
	return typeof item.projectId === "string" &&
		typeof item.projectName === "string" &&
		(item.track === "docs" || item.track === "guides") &&
		(item.generation === undefined || item.generation === null || typeof item.generation === "string") &&
		(item.generationLabel === undefined || item.generationLabel === null || typeof item.generationLabel === "string") &&
		typeof item.slug === "string" &&
		typeof item.title === "string" &&
		typeof item.section === "string" &&
		typeof item.text === "string";
}

function getSearchSnippet(text: string, tokens: string): string {
	const terms = tokens.split(/\s+/).filter(Boolean);
	const lower = text.toLowerCase();
	const positions = terms
		.map((term) => lower.indexOf(term.toLowerCase()))
		.filter((position) => position >= 0);
	if (!positions.length) return text.slice(0, 180);
	const first = Math.min(...positions);
	const start = Math.max(0, first - 76);
	const end = Math.min(text.length, start + 190);
	return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
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
	const activeGeneration = page?.generation ?? project.generations?.[0]?.id ?? null;
	const activeGenerationRecord = project.generations?.find((generation) => generation.id === activeGeneration);
	const [projectsOpen, setProjectsOpen] = useState(false);
	const [pagesOpen, setPagesOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchPinned, setSearchPinned] = useState(false);
	const [searchScope, setSearchScope] = useState<"project" | "all">("project");
	const [searchIndex, setSearchIndex] = useState<DocsSearchEntry[]>([]);
	const [loadedSearchProjects, setLoadedSearchProjects] = useState<string[]>([]);
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
	const [searchLoadNonce, setSearchLoadNonce] = useState(0);
	const [highlightTerm, setHighlightTerm] = useState("");
	const [bookmarksOpen, setBookmarksOpen] = useState(false);
	const [notebookOpen, setNotebookOpen] = useState(false);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [toast, setToast] = useState<string | null>(null);
	const [scrollPct, setScrollPct] = useState(0);
	const [articleProgress, setArticleProgress] = useState(0);
	const [activeTocId, setActiveTocId] = useState("");
	const [lastAnchor, setLastAnchor] = useState("top");
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
	const mobileNavRef = useRef<HTMLElement | null>(null);
	const articleRef = useRef<HTMLElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const searchPanelRef = useRef<HTMLDivElement | null>(null);
	const openSearchResultRef = useRef<(result: DocsSearchResult) => void>(() => {});

	const notify = (msg: string) => {
		setToast(msg);
		setTimeout(() => setToast(null), 2000);
	};

	const closeSearch = () => {
		setSearchOpen(false);
		setSearchPinned(false);
		try {
			sessionStorage.removeItem("kastrick-docs-search-pinned");
			sessionStorage.removeItem("kastrick-docs-search-query");
			sessionStorage.removeItem("kastrick-docs-search-scope");
		} catch {
			// Search remains usable when session storage is unavailable.
		}
	};

	const toggleSearchPin = () => {
		const next = !searchPinned;
		setSearchPinned(next);
		try {
			if (next) {
				sessionStorage.setItem("kastrick-docs-search-pinned", "1");
				sessionStorage.setItem("kastrick-docs-search-query", query);
				sessionStorage.setItem("kastrick-docs-search-scope", searchScope);
			} else {
				sessionStorage.removeItem("kastrick-docs-search-pinned");
				sessionStorage.removeItem("kastrick-docs-search-query");
				sessionStorage.removeItem("kastrick-docs-search-scope");
			}
		} catch {
			// Pinning still works for the current page without session storage.
		}
	};

	const openSearchResult = (result: DocsSearchResult) => {
		const term = query.trim();
		if (!term) return;
		setHighlightTerm(term);
		if (searchPinned) {
			try {
				sessionStorage.setItem("kastrick-docs-search-pinned", "1");
				sessionStorage.setItem("kastrick-docs-search-query", term);
				sessionStorage.setItem("kastrick-docs-search-scope", searchScope);
			} catch {
				// The search panel remains pinned for the current render.
			}
		} else {
			setSearchOpen(false);
		}
		window.dispatchEvent(new Event("kd:navigation-start"));
		router.push(
			"/" + result.projectId + "/" + result.slug + "?kd-find=" + encodeURIComponent(term),
		);
	};
	openSearchResultRef.current = openSearchResult;


	useEffect(() => {
		try {
			if (sessionStorage.getItem("kastrick-docs-search-pinned") === "1") {
				setSearchPinned(true);
				setSearchOpen(true);
				setQuery(sessionStorage.getItem("kastrick-docs-search-query") ?? "");
				setSearchScope(sessionStorage.getItem("kastrick-docs-search-scope") === "all" ? "all" : "project");
			}
		} catch {
			// Search works without persisted panel state.
		}
	}, []);

	useEffect(() => {
		if (!searchPinned) return;
		try {
			sessionStorage.setItem("kastrick-docs-search-query", query);
			sessionStorage.setItem("kastrick-docs-search-scope", searchScope);
		} catch {
			// The current search query remains in React state.
		}
	}, [searchPinned, query, searchScope]);

	useEffect(() => {
		if (!searchOpen) return;
		const targetIds = searchScope === "project"
			? [project.id]
			: manifest.projects.filter((item) => item.pages.length > 0).map((item) => item.id);
		const missingIds = targetIds.filter((id) => !loadedSearchProjects.includes(id));
		if (!missingIds.length) return;

		let cancelled = false;
		setSearchLoading(true);
		setSearchError("");
		Promise.all(missingIds.map(async (id) => {
			const response = await fetch(
				"/docs-search-index/" + encodeURIComponent(id) + ".json?v=" + encodeURIComponent(manifest.generatedAt),
				{ cache: "force-cache" },
			);
			if (!response.ok) throw new Error("Search index unavailable for " + id + ".");
			const payload: unknown = await response.json();
			if (!payload || typeof payload !== "object" || !("pages" in payload) || !Array.isArray(payload.pages)) {
				throw new Error("Search index for " + id + " has an invalid format.");
			}
			return payload.pages.filter(isDocsSearchEntry) as DocsSearchEntry[];
		})).then((loaded) => {
			if (cancelled) return;
			setSearchIndex((current) => {
				const seen = new Set(current.map((item) => item.projectId + "/" + item.track + "/" + (item.generation ?? "") + "/" + item.slug));
				return [
					...current,
					...loaded.flat().filter((item) => {
						const key = item.projectId + "/" + item.track + "/" + (item.generation ?? "") + "/" + item.slug;
						if (seen.has(key)) return false;
						seen.add(key);
						return true;
					}),
				];
			});
			setLoadedSearchProjects((current) => [...new Set([...current, ...missingIds])]);
		}).catch((error: unknown) => {
			if (!cancelled) {
				setSearchError(error instanceof Error ? error.message : "Could not load the documentation search index.");
			}
		}).finally(() => {
			if (!cancelled) setSearchLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [searchOpen, searchScope, project.id, manifest.projects, loadedSearchProjects, searchLoadNonce]);

	useEffect(() => {
		if (!searchOpen || searchPinned) return;
		const onOutside = (event: PointerEvent) => {
			if (searchPanelRef.current && !searchPanelRef.current.contains(event.target as Node)) {
				setSearchOpen(false);
			}
		};
		document.addEventListener("pointerdown", onOutside);
		return () => document.removeEventListener("pointerdown", onOutside);
	}, [searchOpen, searchPinned]);

	// Dismiss the compact mobile navigation when the user taps outside it.
	useEffect(() => {
		if (!mobileNavOpen) return;
		const onPointerDown = (event: PointerEvent) => {
			if (mobileNavRef.current && !mobileNavRef.current.contains(event.target as Node)) {
				setMobileNavOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [mobileNavOpen]);

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

	// Track the current article section and scroll depth for precise short-share links.
	useEffect(() => {
		const onScroll = () => {
			const doc = document.documentElement;
			const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
			setScrollPct(maxScroll > 0
				? Math.max(0, Math.min(100, Math.round((window.scrollY / maxScroll) * 100)))
				: 0);

			const article = articleRef.current;
			if (article) {
				const articleTop = article.getBoundingClientRect().top + window.scrollY;
				const articleHeight = Math.max(1, article.scrollHeight);
				const consumed = ((window.scrollY + window.innerHeight - articleTop) / articleHeight) * 100;
				const nextProgress = Math.max(0, Math.min(100, Math.round(consumed)));
				setArticleProgress((current) => current === nextProgress ? current : nextProgress);
			}

			const headings = article?.querySelectorAll<HTMLElement>("h2[id], h3[id]");
			if (headings?.length) {
				let currentHeading = "";
				for (const heading of Array.from(headings)) {
					if (heading.getBoundingClientRect().top <= 150) {
						currentHeading = heading.id;
					} else {
						break;
					}
				}
				const nextHeading = currentHeading;
				setActiveTocId((current) => current === nextHeading ? current : nextHeading);
			} else {
				setActiveTocId("");
			}

			const anchors = article?.querySelectorAll("h2[id], h3[id], p[id], li[id]");
			if (anchors) {
				for (const el of Array.from(anchors)) {
					const rect = el.getBoundingClientRect();
					if (rect.top >= 56 && rect.top <= window.innerHeight * 0.65) {
						setLastAnchor((current) => current === el.id ? current : el.id);
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
		if (observer && articleRef.current) observer.observe(articleRef.current);
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			observer?.disconnect();
		};
	}, [page?.slug]);


	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const term = highlightTerm.trim() || (params.get("kd-find") ?? "").trim();
		const article = articleRef.current;
		if (!term || !article) return;

		const tokens = [...new Set(term.split(/\s+/).filter(Boolean))]
			.sort((a, b) => b.length - a.length);
		if (!tokens.length) return;
		const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
		const textNodes: Text[] = [];
		let current: Node | null;
		while ((current = walker.nextNode())) {
			const parent = current.parentElement;
			if (!parent || parent.closest("script, style, textarea, button, .kd-search-skip")) continue;
			if (current.nodeValue) textNodes.push(current as Text);
		}

		const marks: HTMLElement[] = [];
		for (const node of textNodes) {
			const value = node.nodeValue ?? "";
			const lower = value.toLowerCase();
			const ranges: Array<{ start: number; end: number }> = [];
			for (const token of tokens) {
				const needle = token.toLowerCase();
				let offset = 0;
				while (needle && offset < lower.length) {
					const index = lower.indexOf(needle, offset);
					if (index < 0) break;
					ranges.push({ start: index, end: index + needle.length });
					offset = index + needle.length;
				}
			}
			ranges.sort((a, b) => a.start - b.start || b.end - a.end);
			if (!ranges.length) continue;

			const fragment = document.createDocumentFragment();
			let cursor = 0;
			for (const range of ranges) {
				if (range.start < cursor) continue;
				if (range.start > cursor) fragment.append(document.createTextNode(value.slice(cursor, range.start)));
				const mark = document.createElement("mark");
				mark.className = "kd-search-hit";
				mark.textContent = value.slice(range.start, range.end);
				fragment.append(mark);
				marks.push(mark);
				cursor = range.end;
			}
			if (cursor < value.length) fragment.append(document.createTextNode(value.slice(cursor)));
			node.parentNode?.replaceChild(fragment, node);
		}
		const first = marks[0];
		let frame = 0;
		if (first) {
			first.classList.add("kd-search-hit-current");
			frame = window.requestAnimationFrame(() => {
				first.scrollIntoView({
					behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
					block: "center",
				});
			});
		}

		// Remove the one-shot query after applying highlights.
		if (params.has("kd-find")) {
			params.delete("kd-find");
			const nextUrl = window.location.pathname +
				(params.toString() ? "?" + params.toString() : "") +
				window.location.hash;
			window.history.replaceState(window.history.state, "", nextUrl);
		}

		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			for (const mark of marks) {
				mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
			}
		};
	}, [page?.slug, project.id, highlightTerm]);

	// Listen for Ctrl/Cmd+K, Escape, and EngineScroll #-es hash navigation.
	useEffect(() => {
		executeEngineScrollHash();
		const onHash = () => {
			executeEngineScrollHash();
		};
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && ["k", "f"].includes(e.key.toLowerCase())) {
				e.preventDefault();
				setSearchOpen(true);
				window.requestAnimationFrame(() => document.getElementById("kd-doc-search-input")?.focus());
			} else if (e.key === "Escape") {
				setSearchOpen(false);
				setSearchPinned(false);
				try {
					sessionStorage.removeItem("kastrick-docs-search-pinned");
					sessionStorage.removeItem("kastrick-docs-search-query");
					sessionStorage.removeItem("kastrick-docs-search-scope");
				} catch {}
				setProjectsOpen(false);
				setBookmarksOpen(false);
				setNotebookOpen(false);
				setMobileNavOpen(false);
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
		() => project.pages.filter((p) =>
			p.track === track && (!activeGeneration || p.generation === activeGeneration)
		),
		[project.pages, track, activeGeneration],
	);

	const sidebarGroups = useMemo(() => {
		const grouped = trackPages.reduce<Record<string, DocPageMeta[]>>((acc, item) => {
			const section = item.section || (track === "guides" ? "Guides" : "Documentation");
			(acc[section] ||= []).push(item);
			return acc;
		}, {});
		const sectionOrder = new Map((activeGenerationRecord?.sectionOrder ?? project.sectionOrder ?? []).map((section, index) => [section, index]));

		return Object.entries(grouped)
			.map(([sectionName, items]) => ({ sectionName, items }))
			.sort((a, b) => {
				const aOrder = sectionOrder.get(a.sectionName);
				const bOrder = sectionOrder.get(b.sectionName);
				if (aOrder !== undefined || bOrder !== undefined) {
					return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
				}
				return a.sectionName.localeCompare(b.sectionName);
			});
	}, [trackPages, track, project.sectionOrder, activeGenerationRecord]);

	const outlineItems = useMemo(() => {
		let sectionNumber = 0;
		let subsectionNumber = 0;
		return (page?.toc ?? []).map((item) => {
			if (item.level <= 2) {
				sectionNumber += 1;
				subsectionNumber = 0;
				return { ...item, number: String(sectionNumber).padStart(2, "0") };
			}
			subsectionNumber += 1;
			return {
				...item,
				number: String(sectionNumber).padStart(2, "0") + "." + subsectionNumber,
			};
		});
	}, [page?.toc]);

	const pageReadingStats = useMemo(() => {
		const wordCount = rawMarkdown.trim()
			? rawMarkdown.trim().split(/\s+/).filter(Boolean).length
			: 0;
		return {
			wordCount,
			readingMinutes: Math.max(1, Math.ceil(wordCount / 220)),
		};
	}, [rawMarkdown]);


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
		const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
		if (!tokens.length) return [];

		const pool = searchScope === "project"
			? searchIndex.filter((item) => item.projectId === project.id)
			: searchIndex;
		const hits: DocsSearchResult[] = [];

		for (const item of pool) {
			const title = (item.title + " " + item.section + " " + item.projectName).toLowerCase();
			const body = item.text.toLowerCase();
			if (!tokens.every((token) => title.includes(token) || body.includes(token))) continue;

			const titleMatches = tokens.every((token) => title.includes(token));
			const score =
				(titleMatches ? 1000 : 0) +
				tokens.reduce((total, token) => total + (title.includes(token) ? 90 : 30), 0) +
				(item.projectId === project.id ? 40 : 0) +
				(item.track === track ? 10 : 0) +
				(item.generation === activeGeneration ? 25 : 0);
			hits.push({
				...item,
				score,
				snippet: getSearchSnippet(item.text, query.trim()),
			});
		}

		return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 30);
	}, [searchIndex, query, searchScope, project.id, track, activeGeneration]);

	useEffect(() => {
		setSelectedSearchIndex(0);
	}, [query, searchScope]);

	useEffect(() => {
		if (!searchOpen) return;
		const onSearchKeys = (event: KeyboardEvent) => {
			if (document.activeElement !== searchInputRef.current) return;
			if (event.key === "ArrowDown" && searchResults.length) {
				event.preventDefault();
				setSelectedSearchIndex((current) => Math.min(searchResults.length - 1, current + 1));
			} else if (event.key === "ArrowUp" && searchResults.length) {
				event.preventDefault();
				setSelectedSearchIndex((current) => Math.max(0, current - 1));
			} else if (event.key === "Enter" && searchResults[selectedSearchIndex]) {
				event.preventDefault();
				openSearchResultRef.current(searchResults[selectedSearchIndex]);
			}
		};
		document.addEventListener("keydown", onSearchKeys);
		return () => document.removeEventListener("keydown", onSearchKeys);
	}, [searchOpen, searchResults, selectedSearchIndex]);


	// Create a compact /share/<code> link for the current page, reading anchor, and scroll depth.
	const handleShareCurrentPage = async () => {
		const projectIdx = manifest.projects.findIndex((item) => item.id === project.id);
		const pageIdx = trackPages.findIndex((item) => item.slug === page?.slug);
		if (projectIdx < 0 || projectIdx > 15 || trackPages.length === 0 || pageIdx > 511) {
			notify("This page cannot be shared with a short link");
			return;
		}

		const generationIdx = activeGeneration
			? Math.max(0, project.generations?.findIndex((item) => item.id === activeGeneration) ?? 0)
			: 0;
		const lineMatch = lastAnchor.match(/^L(\\d+)$/);
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
			generationIdx,
			pageIdx: Math.max(0, pageIdx),
			lineIdx,
			levelPct: scrollPct,
		});
		const shareUrl = `${SHARE_LINK_ORIGIN}/share/${code}`;
		const recordShare = () => {
			try {
				trackEvent("doc_share_create", {
					code,
					project: project.id,
					track,
					generation: activeGeneration ?? "unversioned",
					slug: page?.slug ?? "overview",
					levelPct: scrollPct,
				});
			} catch {
				// Sharing must not depend on analytics availability.
			}
		};

		if (typeof navigator.share === "function") {
			try {
				await navigator.share({ title: page?.title ?? project.name, url: shareUrl });
				recordShare();
				notify(`Shared /share/${code}`);
				return;
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
			}
		}

		try {
			if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
			await navigator.clipboard.writeText(shareUrl);
			recordShare();
			notify(`Copied /share/${code} (Level ${scrollPct}%)`);
		} catch {
			notify("Could not copy this share link in the current browser");
		}
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
		? `[DSE] ${project.name} /${page?.slug ?? "overview"}: ${page?.title ?? "Documentation"}`
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
													<span className="kd-badge-notest">{[item.generationLabel, item.track.toUpperCase()].filter(Boolean).join(" · ")}</span>
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
				<div className="kd-search-center" ref={searchPanelRef}>
					<div className="kd-search-field">
						<span className="kd-search-field-icon" aria-hidden="true">⌕</span>
						<input
							ref={searchInputRef}
							id="kd-doc-search-input"
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onFocus={() => setSearchOpen(true)}
							onKeyDown={(event) => {
								if (event.key === "Escape") closeSearch();
							}}
							placeholder="Search documentation, error codes, and commands..."
							aria-label="Search all documentation text"
							aria-expanded={searchOpen}
							aria-controls="kd-search-floating"
							aria-activedescendant={searchResults[selectedSearchIndex] ? "kd-search-result-" + selectedSearchIndex : undefined}
						/>
						<kbd>Ctrl/⌘ K</kbd>
					</div>

					{searchOpen && (
						<section className="kd-search-floating" id="kd-search-floating" role="dialog" aria-label="Documentation search">
							<div className="kd-search-toolbar">
								<div className="kd-search-scopes" aria-label="Search scope">
									<button type="button" className={searchScope === "project" ? "active" : ""} aria-pressed={searchScope === "project"} onClick={() => setSearchScope("project")}>
										{project.name}
									</button>
									<button type="button" className={searchScope === "all" ? "active" : ""} aria-pressed={searchScope === "all"} onClick={() => setSearchScope("all")}>
										All projects
									</button>
								</div>
								<button type="button" className="kd-search-pin" aria-pressed={searchPinned} onClick={toggleSearchPin} title="Keep this search panel open while navigating">
									{searchPinned ? "Pinned" : "Keep open"}
								</button>
								<button type="button" className="kd-search-close" onClick={closeSearch} aria-label="Close documentation search">×</button>
							</div>

							<div className="kd-search-result-list" role="listbox" aria-label="Matching documentation pages">
								{searchLoading && <div className="kd-search-state">Loading {searchScope === "project" ? project.name : "project"} documentation index…</div>}
								{searchError && (
									<div className="kd-search-state kd-search-error">
										<span>{searchError}</span>
										<button type="button" onClick={() => setSearchLoadNonce((value) => value + 1)}>Retry</button>
									</div>
								)}
								{!searchLoading && !searchError && !query.trim() && (
									<div className="kd-search-state">
										Search titles, headings, documentation text, error codes, and code examples.
									</div>
								)}
								{query.trim() && searchResults.map((result, index) => (
									<button
										key={result.projectId + "/" + result.track + "/" + (result.generation ?? "") + "/" + result.slug}
										type="button"
										id={"kd-search-result-" + index}
										role="option"
										aria-selected={selectedSearchIndex === index}
										className={"kd-search-result" + (selectedSearchIndex === index ? " is-selected" : "")}
										onMouseEnter={() => setSelectedSearchIndex(index)}
										onClick={() => openSearchResult(result)}
									>
										<span className="kd-search-result-top">
											<strong>{result.title}</strong>
											<small>{result.projectName} · {result.generationLabel ? result.generationLabel + " · " : ""}{result.section} · {result.track.toUpperCase()}</small>
										</span>
										<span className="kd-search-result-snippet">{result.snippet}</span>
									</button>
								))}
								{query.trim() && !searchLoading && !searchError && !searchResults.length && (
									<div className="kd-search-state">No documentation text matched “{query.trim()}”.</div>
								)}
							</div>
							<div className="kd-search-footer">
								<span><kbd>↑</kbd><kbd>↓</kbd> Select</span>
								<span><kbd>Enter</kbd> Open and highlight</span>
								<span><kbd>Ctrl/⌘ K</kbd> / <kbd>Ctrl/⌘ F</kbd> Focus</span>
								<span><kbd>Esc</kbd> Close</span>
							</div>
						</section>
					)}
				</div>

				<div className="kd-topbar-right">
					<button type="button" className="kd-btn-secondary" onClick={() => setBookmarksOpen(true)}>
						Pinned ({bookmarks.length})
					</button>
					<button type="button" className="kd-btn-secondary" onClick={() => setNotebookOpen(true)}>
						Notebook ({notebook.length})
					</button>
					<a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="kd-repo-link">
						GitHub
					</a>
				</div>
			</header>

			<div className="kd-grid">
				<aside ref={mobileNavRef} className="kd-sidebar" aria-label="Documentation navigation">
					<button
						type="button"
						className="kd-mobile-nav-trigger"
						aria-expanded={mobileNavOpen}
						aria-controls="kd-sidebar-content"
						onClick={() => setMobileNavOpen((open) => !open)}
					>
						<span className="kd-mobile-nav-copy">
							<span className="kd-mobile-nav-label">{project.name}{activeGenerationRecord ? " · " + activeGenerationRecord.label : ""} documentation</span>
							<strong className="kd-mobile-nav-current">{page?.title ?? project.name}</strong>
						</span>
						<span className="kd-mobile-nav-action">{mobileNavOpen ? "Close" : "Browse"}</span>
					</button>

					<div id="kd-sidebar-content" className={`kd-sidebar-content ${mobileNavOpen ? "is-open" : ""}`}>
						<div className="kd-sidebar-project">
							<strong>{project.name}</strong>
							<span>{activeGenerationRecord ? activeGenerationRecord.label + " / " : ""}{track === "docs" ? "Documentation" : "Guides"}</span>
						</div>
						{project.generations && project.generations.length > 1 && (
							<div className="kd-generation-switch" role="group" aria-label="Documentation generation">
								{project.generations.map((generation) => {
									const targetPage = track === "docs"
										? project.pages.find((p) => p.generation === generation.id && p.slug === generation.defaultSlug)
											?? project.pages.find((p) => p.generation === generation.id && p.track === track)
										: project.pages.find((p) => p.generation === generation.id && p.track === track)
										?? project.pages.find((p) => p.generation === generation.id);
									const href = targetPage
									? `/${project.id}/${targetPage.slug}`
									: `/${project.id}/${generation.defaultSlug}`;
									return (
										<Link
											key={generation.id}
											href={href}
											className={`kd-generation-btn ${activeGeneration === generation.id ? "active" : ""}`}
											aria-current={activeGeneration === generation.id ? "page" : undefined}
											onClick={() => setMobileNavOpen(false)}
										>
											<strong>{generation.label}</strong>
											<small>{generation.version}</small>
										</Link>
									);
								})}
							</div>
						)}
						<div className="kd-track-switch" role="group" aria-label="Documentation track">
							{(["docs", "guides"] as DocTrack[]).map((t) => {
								const targetPage = project.pages.find((p) => p.track === t && (!activeGeneration || p.generation === activeGeneration));
								const href = targetPage
									? `/${project.id}/${targetPage.slug}`
									: activeGenerationRecord ? `/${project.id}/${activeGenerationRecord.defaultSlug}` : `/${project.id}`;
								return (
									<Link
									key={t}
									href={href}
									className={`kd-track-btn ${track === t ? "active" : ""}`}
									onClick={() => setMobileNavOpen(false)}
								>
									{t === "docs" ? "Docs" : "Guides"}
								</Link>
								);
							})}
						</div>

						<nav className="kd-sidebar-navigation" aria-label={`${project.name} ${track === "docs" ? "documentation" : "guides"}`}>
							<div className="kd-nav-groups" key={page?.slug ?? "overview"}>
								{sidebarGroups.map(({ sectionName, items }) => (
									<details
										key={sectionName}
										className="kd-nav-group"
										open={items.some((item) => item.slug === page?.slug)}
									>
										<summary className="kd-nav-group-title">
											<span>{sectionName}</span>
											<span className="kd-nav-group-count">{items.length}</span>
										</summary>
										<ul className="kd-nav-list">
											{items.map((item) => (
												<li key={item.slug}>
													<Link
														href={`/${project.id}/${item.slug}`}
														className={`kd-nav-link ${page?.slug === item.slug ? "active" : ""}`}
														onClick={() => setMobileNavOpen(false)}
													>
														{item.title}
													</Link>
												</li>
											))}
										</ul>
									</details>
								))}
							</div>
						</nav>
					</div>
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
					<div className="kd-toc-layout">
						<div className="kd-toc-row">
							<div className="kd-toc-panel" key={page?.slug ?? project.id}>
								<section className="kd-toc-summary" aria-label="Page reading details">
									<div className="kd-toc-panel-heading">
										<h2 className="kd-toc-title">On this page</h2>
										<span className="kd-toc-count">{outlineItems.length}</span>
									</div>
									<p className="kd-toc-page-title">{page?.title ?? project.name}</p>
									<div className="kd-toc-meta">
										<span>{pageReadingStats.readingMinutes} min read</span>
										<span aria-hidden="true">·</span>
										<span>{outlineItems.length} sections</span>
									</div>
									<div className="kd-toc-progress">
										<div className="kd-toc-progress-label">
											<span>Reading</span>
											<strong>{articleProgress}%</strong>
										</div>
										<div
											className="kd-toc-progress-track"
											role="progressbar"
											aria-label="Article reading progress"
											aria-valuemin={0}
											aria-valuemax={100}
											aria-valuenow={articleProgress}
										>
											<span style={{ width: articleProgress + "%" }} />
										</div>
									</div>
									<button
										type="button"
										className="kd-btn-secondary kd-toc-share-button"
										onClick={handleShareCurrentPage}
										aria-label="Create and share a short link to this reading position"
									>
										Share
									</button>
								</section>

								<nav className="kd-toc-outline" aria-label="Page sections">
									<div className="kd-toc-outline-label">Contents</div>
									{outlineItems.length > 0 ? (
										<ol className="kd-toc-list">
											{outlineItems.map((item, index) => (
												<li
													key={item.id}
													className={"level-" + item.level + (item.id === activeTocId ? " active" : "")}
														style={{ animationDelay: Math.min(index * 34, 340) + "ms" }}
												>
													<a
														href={"#-es?move=" + encodeURIComponent(item.id) + "&offset=-84&duration=550"}
														className={item.id === activeTocId ? "active" : ""}
														aria-current={item.id === activeTocId ? "location" : undefined}
													>
														<span className="kd-toc-number" aria-hidden="true">{item.number}</span>
														<span className="kd-toc-label">{item.text}</span>
													</a>
												</li>
											))}
										</ol>
									) : (
										<p className="kd-toc-empty">No section headings on this page.</p>
									)}
								</nav>
							</div>

						</div>
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
						<a
							href={issueUrl}
							target="_blank"
							rel="noopener noreferrer"
							title={project.issueTemplate ? "Open the Document Suggested Edit form for this page" : "Suggest an edit in the source repository"}
						>
							{project.issueTemplate ? "Suggest a documentation edit ↗" : "Suggest an edit ↗"}
						</a>
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


			{toast && <div className="kd-toast">{toast}</div>}
		</div>
	);
}
