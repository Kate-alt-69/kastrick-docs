// lib/shareCode.ts — Deterministic 8-character Base62 share code generator.
// Derives static /share/<8char> codes purely from page data (projectId, slug, and
// anchor/parameter) using an embedded zero-dependency 64-bit FNV-1a hash so adding,
// removing, or reordering other pages never invalidates existing share links.
// Legacy bit-packed index codes are intentionally unsupported.

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);
const FNV_OFFSET_BASIS = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const MASK_64 = BigInt("0xffffffffffffffff");
const MASK_46 = (BigInt(1) << BigInt(46)) - BigInt(1);

/** Public short-link host used when copying generated documentation share URLs. */
export const SHARE_LINK_ORIGIN = "https://k8d.vercel.app";

/** Canonical site that owns documentation pages and resolves shared targets. */
export const CANONICAL_DOCS_ORIGIN = "https://kastrick-docs.vercel.app";

/** Default EngineScroll top offset (px) to clear the sticky documentation header. */
export const ENGINE_SCROLL_OFFSET = -84;

/** Default EngineScroll smooth-scroll duration (ms). */
export const ENGINE_SCROLL_DURATION = 550;

export interface StaticShareEntry {
	code: string;
	shareUrl: string;
	anchor: string;
	title: string;
	targetUrl: string;
}

/** Normalize a documentation slug by trimming leading and trailing slashes. */
export function normalizeShareSlug(slug: string): string {
	return slug.trim().replace(/^\/+|\/+$/g, "");
}

/**
 * Resolve the canonical static anchor parameter for a page so every generated
 * share link matches a static entry in public/share/manifest.json.
 */
export function normalizeShareAnchor(
	anchor: string | null | undefined,
	toc: Array<{ id: string }>,
): string {
	const cleaned = (anchor ?? "").trim();
	if (!cleaned || cleaned === "top") {
		return "top";
	}
	const matchingHeading = toc.find((item) => item.id === cleaned);
	return matchingHeading ? matchingHeading.id : "top";
}

/** Build the canonical EngineScroll destination URL for a page and anchor parameter. */
export function buildEngineScrollTarget(
	projectId: string,
	slug: string,
	anchor = "top",
): string {
	const normalizedSlug = normalizeShareSlug(slug);
	const normalizedAnchor = (anchor || "top").trim() || "top";
	return (
		"/" +
		projectId.trim() +
		"/" +
		normalizedSlug +
		"#-es?move=" +
		encodeURIComponent(normalizedAnchor) +
		"&offset=" +
		ENGINE_SCROLL_OFFSET +
		"&duration=" +
		ENGINE_SCROLL_DURATION
	);
}

/**
 * Deterministically hash pure page data (projectId, slug, anchor) into a fixed
 * 8-character Base62 share code. Matches encode_page_share_code() in scripts/sync_docs.py
 * bit-for-bit with zero external dependencies.
 */
export function encodePageShareCode(
	projectId: string,
	slug: string,
	anchor = "top",
): string {
	const key =
		"k8d-v2|" +
		projectId.trim().toLowerCase() +
		"|" +
		normalizeShareSlug(slug) +
		"|" +
		((anchor || "top").trim() || "top");

	const bytes = new TextEncoder().encode(key);
	let hash = FNV_OFFSET_BASIS;
	for (let index = 0; index < bytes.length; index += 1) {
		hash ^= BigInt(bytes[index]);
		hash = (hash * FNV_PRIME) & MASK_64;
	}

	// Fold 64-bit hash into 46 bits (fits cleanly inside 8 Base62 characters: 62^8 > 2^47).
	let value = (hash ^ (hash >> BigInt(18))) & MASK_46;
	let out = "";
	for (let index = 0; index < 8; index += 1) {
		const rem = Number(value % BASE);
		out = ALPHABET[rem] + out;
		value = value / BASE;
	}
	return out;
}

/** Build all static /share/<8char> entries for a page (top + every TOC heading parameter). */
export function buildPageShareEntries(
	projectId: string,
	slug: string,
	toc: Array<{ id: string; text?: string }>,
): StaticShareEntry[] {
	const seenAnchors = new Set<string>();
	const entries: StaticShareEntry[] = [];

	const addEntry = (anchor: string, title: string): void => {
		if (seenAnchors.has(anchor)) return;
		seenAnchors.add(anchor);
		const code = encodePageShareCode(projectId, slug, anchor);
		entries.push({
			code,
			shareUrl: `${SHARE_LINK_ORIGIN}/share/${code}`,
			anchor,
			title,
			targetUrl: buildEngineScrollTarget(projectId, slug, anchor),
		});
	};

	addEntry("top", "Top of page");
	for (const heading of toc) {
		if (!heading?.id) continue;
		addEntry(heading.id, heading.text ?? heading.id);
	}
	return entries;
}


/**
 * The first published share format packed positional indexes into eight Base62
 * characters. Keep this decoder indefinitely for archived links; new links must
 * use encodeShareState from shareState.ts instead.
 */
export interface LegacySharePayload {
	projectIdx: number;
	trackIdx: number;
	pageIdx: number;
	lineIdx: number;
	levelPct: number;
}

const LEGACY_MASK_11 = 0x7ff;

function legacyChecksum(packed: bigint): bigint {
	const mixed = (packed * BigInt(2654435761)) ^ (packed >> 11n);
	return mixed & BigInt(LEGACY_MASK_11);
}

export function decodeLegacyShareCode(code: string): LegacySharePayload | null {
	if (code.length !== 8 || !/^[0-9A-Za-z]{8}$/.test(code)) return null;
	let value = 0n;
	for (const character of code) {
		const digit = ALPHABET.indexOf(character);
		if (digit < 0) return null;
		value = value * BASE + BigInt(digit);
	}
	const checksum = value & BigInt(LEGACY_MASK_11);
	const body = value >> 11n;
	if (legacyChecksum(body) !== checksum) return null;
	const levelPct = Number(body & 0x7fn);
	const lineIdx = Number((body >> 7n) & 0xfffn);
	const pageIdx = Number((body >> 19n) & 0x7fn);
	const trackIdx = Number((body >> 26n) & 0x1n);
	const projectIdx = Number((body >> 27n) & 0xfn);
	return { projectIdx, trackIdx, pageIdx, lineIdx, levelPct };
}

/** Test/migration helper reproducing the original positional encoder exactly. */
export function encodeLegacyShareCode(payload: LegacySharePayload): string {
	const project = BigInt(payload.projectIdx & 0xf);
	const track = BigInt(payload.trackIdx & 0x1);
	const page = BigInt(payload.pageIdx & 0x7f);
	const line = BigInt(payload.lineIdx & 0xfff);
	const level = BigInt(Math.max(0, Math.min(100, Math.round(payload.levelPct))) & 0x7f);
	const body = (project << 27n) | (track << 26n) | (page << 19n) | (line << 7n) | level;
	let value = (body << 11n) | legacyChecksum(body);
	let output = "";
	for (let index = 0; index < 8; index += 1) {
		output = ALPHABET[Number(value % BASE)] + output;
		value /= BASE;
	}
	return output;
}
