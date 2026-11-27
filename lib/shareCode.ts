// lib/shareCode.ts — Deterministic 8-character Base62 share code encoder/decoder.
// Packs project index, track (docs/guides), page index, exact line/anchor index,
// and scroll level percentage (0-100) into an 8-char /share/<8char> token with a
// lightweight checksum — no database required.

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
	pageIdx: number;    // 0..127 (7 bits)
	lineIdx: number;    // 0 = top, 1..2047 = L# line, 2048..4095 = TOC heading index
	levelPct: number;   // 0..100 (7 bits)
}

/** Compute an 11-bit integrity checksum for a packed 31-bit payload. */
function computeChecksum(packed: bigint): bigint {
	const mixed = (packed * BigInt(2654435761)) ^ (packed >> BigInt(11));
	return mixed & BigInt(0x7ff);
}

/** Encode a SharePayload into a fixed 8-character Base62 code. */
export function encodeShareCode(payload: SharePayload): string {
	const p = BigInt(payload.projectIdx & 0xf);
	const t = BigInt(payload.trackIdx & 0x1);
	const pg = BigInt(payload.pageIdx & 0x7f);
	const ln = BigInt(payload.lineIdx & 0xfff);
	const lvl = BigInt(Math.max(0, Math.min(100, Math.round(payload.levelPct))) & 0x7f);

	const body =
		(p << BigInt(27)) |
		(t << BigInt(26)) |
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

	const levelPct = Number(body & BigInt(0x7f));
	const lineIdx = Number((body >> BigInt(7)) & BigInt(0xfff));
	const pageIdx = Number((body >> BigInt(19)) & BigInt(0x7f));
	const trackIdx = Number((body >> BigInt(26)) & BigInt(0x1));
	const projectIdx = Number((body >> BigInt(27)) & BigInt(0xf));

	return { projectIdx, trackIdx, pageIdx, lineIdx, levelPct };
}
