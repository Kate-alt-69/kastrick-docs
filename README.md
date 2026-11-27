# Kastrick Docs

Official static documentation and guides hub for the **Kastrick** ecosystem. The site is powered by **Next.js Engine Generation 3 (NES)** and publishes Engine generations as separate documentation archives.

## Projects Covered

| Project | Repository | Status |
|---------|------------|--------|
| **RBE** | [Kastrick8/RBE](https://github.com/Kastrick8/RBE) | Active |
| **Next.js Engine** | [Kastrick8/nextjs-engine](https://github.com/Kastrick8/nextjs-engine) | Gen 3 Alpha · Gen 2 stable archive |
| **PackageX** | `Package-X/packagex` | `NOT_EST` |
| **PackX** | `Package-X/packx` | `NOT_EST` |
| **PackageX SDKs** | `Package-X/packagex` | `NOT_EST` |
| **Kastrick's Utility** | `Kastrick8/kastricks_utility` | `NOT_EST` |

## Features

- **Generation-aware static sync (`scripts/sync_docs.py`):** Downloads each configured source generation from its own branch. Next.js Engine Gen 3 is sourced from `main-3` (`docs/3/`) and the stable Gen 2 archive from `main-2` (`docs/2/`); each gets separate page metadata, search entries, and Docs/Guides navigation. Relative links are rewritten to `/<project>/<source-path>` and EngineScroll `#-es` anchors before static export.
- **Automatic GREEN-CI Engine Sync (`scripts/sync_engine.py`):** Tracks the latest passing CI commit on `Kastrick8/nextjs-engine` and updates `src/engine/` atomically.
- **EngineScroll Share URLs & `/share/<8char>`:** Click the vertical scroll-progress battery on the right rail to generate a deterministic 8-character Base62 share link encoding project, generation, track, page, line, and scroll level. Existing pre-generation links remain readable as Gen 3.
- **Pinning & Notebook:** Save highlighted passages locally, search and filter notes across projects, jump back to their source location, copy quotes, edit annotations, and export the Notebook as Markdown.

## Next.js Engine documentation generations

The Next.js Engine project index publishes two independently generated tracks:

- **Generation 3:** `main-3` → `docs/3/` (current alpha documentation).
- **Generation 2:** `main-2` → `docs/2/` (stable 2.x archive).

Each generation has its own Reference/Docs and Guides groups. The generation selector changes the active source track; it does not combine Gen 2 and Gen 3 pages into one tree.

## Local Development

Install dependencies and run the live Next.js development server:

```bash
npm install
npm run dev
```

To generate the production static export (engine sync → docs sync → type-check → Next.js export):

```bash
npm run build
```

Preview that generated static site locally:

```bash
npm run start
```

The preview server serves the exported HTML from `out/` (or `dist/` when that folder contains an `index.html`). It resolves extensionless routes such as `/rbe/vault` to their exported HTML files. Set `KASTRICK_DOCS_STATIC_DIR` to serve an export from a different directory, or `PORT` to change the default port `3000`.

For offline builds using local snapshots:

```bash
npm run build:offline
```

## License

Documentation content is licensed under **[CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/)**. You may download and share the documentation verbatim for any purpose (including commercial). To suggest corrections or edits, please open a GitHub Issue on the corresponding project repository.
