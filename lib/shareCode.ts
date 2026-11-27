// lib/shareCode.ts — Deterministic 8-character Base62 share code encoder/decoder.
// Packs project, generation, track, page, exact line/anchor, and scroll level into
// an 8-character Base62 /share/<code> token with a lightweight checksum.

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);

/** Public short-link host used when copying generated documentation share URLs. */
export const SHARE_LINK_ORIGIN = "https://k8d.vercel.app";

/** Canonical site that owns documentation pages and resolves shared targets. */
export const CANONICAL_DOCS_ORIGIN = "https://kastrick-docs.vercel.app";

/** Values at or above this number represent page.toc heading indexes; lower values are L# anchors. */
export const SHARE_HEADING_ANCHOR_BASE = 2048;

export interface SharePayload {
	projectIdx: number; // 0..15  (4 bits)
	trackIdx: number;   // 0..1   (1 bit: 0 = docs, 1 = guides)
	generationIdx: number; // 0 = Generation 3; 1 = archived Generation 2
	pageIdx: number;    // 0..511 (9 bits)
	lineIdx: number;    // 0 = top, 1..2047 = L# line, 2048..4095 = TOC heading index
	levelPct: number;   // 0..100 (7 bits)
}

/** Compute an 11-bit integrity checksum for a packed generation-aware payload. */
function computeChecksum(packed: bigint): bigint {
	const mixed = (packed * BigInt(2654435761)) ^ (packed >> BigInt(11));
	return mixed & BigInt(0x7ff);
}

/** Encode a SharePayload into a fixed 8-character Base62 code. */
export function encodeShareCode(payload: SharePayload): string {
	const p = BigInt(payload.projectIdx & 0xf);
	const t = BigInt(payload.trackIdx & 0x1);
	const generation = BigInt(payload.generationIdx & 0x1);
	const pg = BigInt(payload.pageIdx & 0x1ff);
	const ln = BigInt(payload.lineIdx & 0xfff);
	const lvl = BigInt(Math.max(0, Math.min(100, Math.round(payload.levelPct))) & 0x7f);

	// Bit 34 marks the generation-aware layout. New codes support up to 512 pages per generation; older 8-character codes never
	// used this bit, so existing shared links continue to resolve as Gen 3.
	const body =
		(BigInt(1) << BigInt(34)) |
		(p << BigInt(30)) |
		(t << BigInt(29)) |
		(generation << BigInt(28)) |
		(pg << BigInt(19)) |
		(ln << BigInt(7)) |
		lvl;

	const checksum = computeChecksum(body);
	let value = (body << BigInt(11)) | checksum;

	let out = "";
	for (let i = 0; i < 8; i++) {
		const rem = Number(value % BASE);
		out = ALPHABET[rem] + out;
		value = value / BASE;
	}
	return out;
}

/** Decode an 8-character Base62 share code back into its exact page + level target. */
export function decodeShareCode(code: string): SharePayload | null {
	if (!code || code.length !== 8) {
		return null;
	}
	let value = BigInt(0);
	for (const ch of code) {
		const idx = ALPHABET.indexOf(ch);
		if (idx < 0) {
			return null;
		}
		value = value * BASE + BigInt(idx);
	}

	const checksum = value & BigInt(0x7ff);
	const body = value >> BigInt(11);
	if (computeChecksum(body) !== checksum) {
		return null;
	}

	const hasGenerationMarker = (body & (BigInt(1) << BigInt(34))) !== BigInt(0);
	const levelPct = Number(body & BigInt(0x7f));
	const lineIdx = Number((body >> BigInt(7)) & BigInt(0xfff));
	const pageIdx = Number((body >> BigInt(19)) & BigInt(hasGenerationMarker ? 0x1ff : 0x7f));
	const trackIdx = Number((body >> BigInt(hasGenerationMarker ? 29 : 26)) & BigInt(0x1));
	const projectIdx = Number((body >> BigInt(hasGenerationMarker ? 30 : 27)) & BigInt(0xf));
	const generationIdx = hasGenerationMarker
		? Number((body >> BigInt(28)) & BigInt(0x1))
		: 0;

	return { projectIdx, trackIdx, generationIdx, pageIdx, lineIdx, levelPct };
}
