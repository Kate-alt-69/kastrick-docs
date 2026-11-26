# EngineScroll & Shareable Point URLs

`EngineScroll` is Next.js Engine's point-based scroll runtime, navigator, timeline, and URL protocol. It lets any documentation heading, paragraph, or line be linked and resolved directly to an exact point in the page.

## URL Protocol (`#-es`)

Defined in `src/engine/core/enginescroll/EngineScrollURL.ts`, the `#-es` hash protocol resolves scroll targets on page load and on `hashchange`:

```text
/docs/nextjs-engine/enginescroll#-es?move=line-14&offset=-84&duration=550
```

## Supported Parameters

- `move` — Target to resolve: `"top"`, `"bottom"`, `"current"`, a numeric scroll point (e.g. `120.5`), a registered `EngineScrollPoints` name, or a DOM element ID (such as `line-14` or `url-protocol-es`).
- `offset` — Optional numeric point offset (default `0`) applied after target resolution to clear sticky headers.
- `duration` — Optional non-negative animation duration in milliseconds (default `550`).

## Resolution Order (`EngineScrollTargetResolver`)

1. Numeric coordinates and keywords (`top`, `bottom`, `current`) resolve immediately to scroll points.
2. Named `#targets` check `EngineScrollPointManager` registered points first.
3. Unregistered `#targets` fall back to live DOM lookup via `document.getElementById(id)` and compute `(rect.top + window.scrollY) / pointSpacing + offset`.
4. After `EngineScrollNavigator.move(...)` succeeds, `EngineScrollURL.clean()` tidies the hash via `history.replaceState`.
