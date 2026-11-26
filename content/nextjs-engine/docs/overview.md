# Next.js Engine (Generation 3)

> **Rebase Notice:** Next.js Engine documentation is currently undergoing a full Generation 3 rebase on `main-3`. Details below reflect the current alpha architecture and may change as the rebase progresses.

Next.js Engine (NE) is a schema-driven compiler and runtime for React 19 and Next.js 16. Typed page schemas compile into explicit server-first execution plans while isolating browser-only behavior into targeted client islands.

## Compiler & Rendering

- `compilePage()` builds the compiled execution plan, feature manifest, fallback plan, assets, and diagnostics.
- `createPage()` renders through the Generation 3 server-first pipeline.
- Interactive components hydrate only inside targeted client islands.

## Core Subsystems

- **EngineTheme:** Validated theme definitions, qualified IDs, `.etr` artifacts, declarative templates, and font compilation.
- **EngineLink:** Unified anchor component handling external links, `next/link` internal navigation, and lazy `EngineTransitions+` links.
- **EngineSEO:** Generates metadata and crawler/social outputs from declared site and page schemas.
- **NENC:** Connects named commands to server-owned handlers while keeping auth, validation, and secrets strictly on the server.
- **EngineDebug:** Development route, preview, runtime, scheduler, and viewport inspection.

```ts
import { createComponent, registerComponent } from "nextjs-engine";

const SiteLink = createComponent({
	mode: "custom",
	id: "site-link",
	theme: "site.link",
	component: SiteLinkImplementation,
	props: { href: { type: "string", required: true, maxLength: 2048 } },
	slots: ["children"],
	strictProps: true,
});

registerComponent("site-link", SiteLink);
```
