# Share URL format

## Current and compatibility formats

- Legacy positional links remain exactly eight Base62 characters and must continue through their historical decoder/mapping.
- The deterministic FNV links introduced by the static manifest remain exactly eight characters and must continue through their historical lookup.
- New links are exactly ten Base62 characters: `WHERE(4) + STATE(6)`. Length is the dispatch boundary; never reinterpret an eight-character token as the new format.

## WHERE

Four Base62 characters represent a permanent document identity (62^4 = 14,776,336 possible IDs). IDs are allocated once and never recycled. The registry key is the canonical document identity (project, generation, track and stable source identity), not a mutable page index or current slug. Slug changes update the destination while preserving WHERE. Removed documents become tombstones or explicit aliases.

## STATE v1

STATE is a 35-bit unsigned integer, encoded as six Base62 characters:

| Bits | Width | Meaning |
|---|---:|---|
| 34..33 | 2 | Format version (1) |
| 32..30 | 3 | Target mode: 0 top, 1 bottom, 2 semantic anchor, 3 line, 4 percentage |
| 29..11 | 19 | Mode-specific target payload |
| 10..5 | 6 | EngineScroll settings |
| 4..0 | 5 | Checksum |

Payload interpretation:
- Top/bottom: all 19 bits must be zero.
- Semantic anchor: 12-bit stable anchor ID followed by 7-bit scroll percentage (0..100).
- Line: positive 19-bit line number (1..524287).
- Percentage: 7-bit percentage (0..100); unused high payload bits must be zero.

EngineScroll settings:
- duration: 2 bits — 0 instant, 1 250ms, 2 550ms, 3 900ms.
- alignment: 2 bits — 0 clear sticky header, 1 tight, 2 center, 3 flush.
- highlight: 1 bit.
- reserved: 1 bit, must be zero until assigned by a later format revision.

The clear-sticky-header alignment is resolved at runtime from the actual sticky header geometry, not a fixed pixel constant. A 5-bit checksum covers WHERE plus the 30 STATE body bits. It detects common typos but is not cryptographic authentication.

## Registry lifecycle

- Registry changes are append-only for allocated IDs. Never reuse published WHERE or anchor IDs.
- Anchor IDs are stable within a document and resolve through aliases after heading renames.
- Deleted anchors fall back to the nearest surviving parent, then document top.
- Document moves update the registry destination; replacement content must be explicitly aliased or archived.
- Build output is a snapshot of the authoritative registry and carries its registry revision. Builds must fail if their registry snapshot is stale or internally inconsistent.
- The static export is served with CDN caching. Registry changes produce a new versioned snapshot URL; immutable cache headers are safe because each revision has a distinct path. A mutable pointer may use short-lived revalidation.

## Vercel deployment

This repository currently exports a static Next.js site. Static exports cannot read Edge Config at request time. The supported design is to maintain the registry as versioned source data, publish a versioned static snapshot during the build, and let Vercel's CDN cache that immutable artifact globally. If a future deployment uses server functions, Edge Config can be added as the shared runtime source; it must be connected to the actual docs Vercel project before relying on it.
