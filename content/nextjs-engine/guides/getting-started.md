# Getting Started with Next.js Engine

> **Rebase Notice:** Setup instructions are actively being updated as part of the Generation 3 rebase.

This guide walks through pinning a Generation 3 snapshot and wiring up your first compiled page.

## Syncing the Latest GREEN-CI Build

In `kastrick-docs`, run the automated Python sync script to pull the latest passing CI commit from `Kastrick8/nextjs-engine`:

```bash
python3 scripts/sync_engine.py
```

## Verifying Your Local Build

Run the cross-platform build script to sync the engine, pull static per-build docs, type-check, and export static HTML:

```bash
python3 scripts/build.py
```
