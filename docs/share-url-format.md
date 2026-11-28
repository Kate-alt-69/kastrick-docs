# Share URL format

## Dispatch and compatibility

Three share formats coexist and are dispatched by exact token length:

- **8 characters, positional v1:** original bit-packed format (project index, track, page index, line/heading index, reading percentage, 11-bit checksum).
- **8 characters, deterministic v2:** FNV-derived links from the later static manifest. The resolver rebuilds this lookup from current page data.
- **10 characters, state v1:** self-contained format, `WHERE(4) + STATE(6)`.

Neither eight-character format is reinterpreted as the ten-character format. New share buttons emit ten-character links only.

## WHERE

Four Base62 characters represent a stable document identity. The build derives the value from a namespaced SHA-256 digest of:

`project | generation | track | sourcePath`

The value is collision-checked on every build. A collision fails the build rather than silently pointing at another page. A slug change does not change source identity. For a source-path move, add the previous identity to that document's `aliases` array in `data/share-registry.json`; the old WHERE resolves to the current destination.

Removed documents can be preserved as tombstones mapping a retired WHERE to a live fallback WHERE. Published IDs are not intentionally reused.

## STATE v1

STATE is a 35-bit unsigned integer encoded as six Base62 characters:

| Bits | Width | Meaning |
|---|---:|---|
| 34..33 | 2 | Format version (1) |
| 32..30 | 3 | Target mode: 0 top, 1 bottom, 2 semantic anchor, 3 line, 4 percentage |
| 29..11 | 19 | Mode-specific target payload |
| 10..5 | 6 | EngineScroll settings |
| 4..0 | 5 | Checksum |

Payload:
- Top/bottom: all 19 bits are zero.
- Semantic anchor: 12-bit stable anchor ID followed by a 7-bit reading percentage (0..100). The anchor wins while it exists; the percentage is the fallback if its old heading ID no longer resolves.
- Line: positive 19-bit line number (1..524287).
- Percentage: 7-bit percentage (0..100); unused high bits must be zero.

EngineScroll settings:
- Duration: 2 bits — 0 instant, 1 250ms, 2 550ms, 3 900ms.
- Alignment: 2 bits — 0 clear sticky header, 1 tight, 2 center, 3 flush.
- Arrival highlight: 1 bit.
- Reserved: 1 bit, required to be zero in v1.

Clear-sticky-header measures visible sticky/fixed header geometry when the link opens; it does not use a hard-coded pixel offset. The 5-bit CRC-style checksum covers all 24 WHERE bits plus the 30 STATE body bits. It detects common typos; it is not authentication.

## Stable heading IDs and overrides

Heading IDs are derived deterministically per document and collision-checked. To lock an explicit ID, add an `anchorIds` mapping. To retain a renamed heading's former ID, add an `anchorAliases` entry mapping the previous heading slug to the current heading slug. Aliases can point to `top` when no useful heading remains.

The top-level shape of `data/share-registry.json` is:

```json
{
  "schemaVersion": 1,
  "documents": {
    "project|generation|track|source/path.md": {
      "where": "optional explicit ID",
      "aliases": ["previous|document|identity"],
      "anchorIds": { "section": 1234 },
      "anchorAliases": { "old-heading": "new-heading" }
    }
  },
  "tombstones": {
    "OLD0": "LIVE"
  }
}
```

The build emits:
- `public/share/registry.<revision>.json`: immutable registry snapshot.
- `public/share/registry.json`: small mutable pointer to the current revision.
- Per-page share identity/anchor IDs in `content/manifest.json`.
- New state links in the existing migration manifest alongside FNV links.

## Vercel and static CDN caching

This repository uses Next.js static export. A static page cannot query Edge Config at request time, so no unrelated Vercel project or runtime store is attached. Vercel serves each revisioned registry snapshot with a one-year immutable CDN cache. The pointer is shared-cache revalidated every 60 seconds and may be served stale for five minutes while revalidating. A resolver checks this pointer first, then fetches the selected revisioned snapshot with immutable caching. The revision embedded by the static build is used only if the pointer is temporarily unavailable.

The existing eight-character redirects remain in place. Ten-character short-host redirects and rewrites are additive.
