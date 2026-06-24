/* ========================================================================== */
/*  app/docs/page.tsx — Kastrick Documentation                               */
/*  Styled to match kastrick.dev aesthetic.                                  */
/*  Add nodes + content entries to extend coverage.                          */
/* ========================================================================== */

"use client";

import React, { useCallback, useState } from "react";

import ProductExplorer, {
	type PETreeNode,
	definePEFolder,
	definePEPage,
	definePEProduct,
	definePERoot,
} from "@/data/pe";

/* ========================================================================== */
/*  Documentation Tree                                                        */
/* ========================================================================== */

const DOCS_TREE = definePERoot("docs", "Documentation", [

	definePEProduct("engine", "Next.js Engine", {
		icon:        "⚡",
		badge:       "v1.1",
		description: "Schema-driven rendering engine built on top of Next.js.",
		order:       0,
	}, [

		definePEFolder("gs", "Getting Started", { icon: "🚀", order: 0 }, [
			definePEPage("what-is",     "What Is the Engine?",  { order: 0, description: "High-level overview of what the engine is and why it exists." }),
			definePEPage("installation","Installation",          { order: 1, description: "Add the engine to a new or existing Next.js project." }),
			definePEPage("quick-start", "Quick Start",           { order: 2, description: "Build your first schema-driven page in five minutes." }),
		]),

		definePEFolder("concepts", "Core Concepts", { icon: "🧠", order: 1 }, [
			definePEPage("schema",     "Schema System",    { order: 0, description: "How the declarative schema maps to React components." }),
			definePEPage("responsive", "Responsive System",{ order: 1, description: "CSS-var based responsiveness — zero JS at runtime." }),
			definePEPage("lazy",       "Lazy Loading",     { order: 2, description: "Auto lazy-mount, content-visibility and rootMargin strategy." }),
			definePEPage("styling",    "Styling Engine",   { order: 3, description: "StyleCollector, static class generation and CSS tiers." }),
			definePEPage("seo",        "Metadata & SEO",   { order: 4, description: "generateEngineMetadata and Next.js App Router integration." }),
		]),

		definePEFolder("comps", "Components", { icon: "🧩", order: 2 }, [
			definePEPage("primitives", "Primitives",        { order: 0, description: "Box, Stack, Grid, Text, Heading, Button, Card, Spacer, Divider." }),
			definePEPage("nav",        "EngineNav",         { order: 1, description: "Full nav bar with sticky, logo, items, dropdowns, mobile menu." }),
			definePEPage("hero",       "EngineHero",        { order: 2, description: "Layout-heavy hero sections with parallax and overlay support." }),
			definePEPage("forms",      "EngineForms",       { order: 3, description: "Form, Input, Textarea, Checkbox and Label primitives." }),
			definePEPage("suspense",   "EngineSuspense",    { order: 4, description: "Schema-native Suspense with skeleton, shimmer, spinner presets." }),
			definePEPage("markdown",   "EngineMarkdown",    { order: 5, description: "Markdown renderer with animations and heading anchor slugs." }),
			definePEPage("image",      "EngineImage",       { order: 6, description: "Smart lazy image with AVIF/WebP, blur-up and quality presets." }),
			definePEPage("video",      "EngineVideo",       { order: 7, description: "Lazy video — src never loads until 800px from viewport." }),
			definePEPage("canvas",     "EngineCanvas",      { order: 8, description: "GPU-accelerated canvas with adaptive DPR and RAF loop." }),
		]),

		definePEFolder("anim", "Animation", { icon: "✨", order: 3 }, [
			definePEPage("manim",   "EngineManim 2D",  { order: 0, description: "Declarative 2D Manim-style animation on HTML Canvas." }),
			definePEPage("manim3d", "EngineManim 3D",  { order: 1, description: "Three.js GLTF/OBJ renderer with DSL bone animation." }),
		]),

		definePEFolder("net", "Networking", { icon: "🌐", order: 4 }, [
			definePEPage("resolver",  "EngineAPIResolver",  { order: 0, description: "Centralized fetch orchestrator with auth, versioning, and overrides." }),
			definePEPage("apiconfig", "EngineAPIConfig",    { order: 1, description: ".api file format, TOML-inspired syntax, env var substitution." }),
		]),

		definePEFolder("mobile", "Mobile & Device", { icon: "📱", order: 5 }, [
			definePEPage("device",   "EngineDevice",         { order: 0, description: "Server + client device detection for 12+ brands." }),
			definePEPage("patcher",  "EngineMobilePatcher",  { order: 1, description: "Server-side schema patching based on UA device type." }),
			definePEPage("browser",  "EngineBrowser",        { order: 2, description: "Clipboard, interactions, media, speech and network subsystems." }),
		]),

		definePEFolder("ref", "Reference", { icon: "📚", order: 6 }, [
			definePEPage("css-props",    "CSS Props",         { order: 0, description: "All 60+ passthrough CSS properties and shorthand aliases." }),
			definePEPage("create-page",  "createPage API",    { order: 1, description: "Full API reference for the top-level page factory." }),
			definePEPage("schema-types", "Schema Types",      { order: 2, description: "TypeScript interfaces for every schema node and prop type." }),
			definePEPage("analyzer",     "Schema Analyzer",   { order: 3, description: "Static analyzer — diagnostics, did-you-mean, a11y and perf warnings." }),
		]),

	]),

]);

/* ========================================================================== */
/*  Content Map                                                               */
/* ========================================================================== */

const CONTENT: Record<string, React.ReactNode> = {

	"what-is": (
		<DocSection>
			<DocLead>
				A schema-driven rendering layer that sits on top of Next.js. Instead of
				writing raw HTML or JSX, you define pages as plain TypeScript objects. The
				engine converts that definition into a fully-optimised Next.js page.
			</DocLead>

			<DocH2>What it handles automatically</DocH2>
			<DocGrid>
				<DocFeature icon="⚡" title="Zero config performance">
					React.memo, next/image, IntersectionObserver, content-visibility — applied
					to every element, every time.
				</DocFeature>
				<DocFeature icon="🎨" title="CSS-only responsive">
					Responsive values compile to CSS custom properties with @media overrides.
					No JS reads window.innerWidth.
				</DocFeature>
				<DocFeature icon="🦥" title="Smart lazy loading">
					Videos never fetch until 800px from viewport. Images lazy-load based on
					their pixel area. Sections mount only when near the fold.
				</DocFeature>
				<DocFeature icon="🔍" title="SEO built-in">
					generateEngineMetadata() produces title, OG, Twitter and canonical from
					the same schema object.
				</DocFeature>
			</DocGrid>

			<DocH2>Core principle</DocH2>
			<DocP>
				Raw React gives you nothing for free. Every optimization has to be applied
				manually. The engine applies all of them automatically — every element, every
				render, with no configuration required.
			</DocP>

			<DocCode>{`// One call. Every optimization applied automatically.
export default createPage({ schema: HomeSchema });`}</DocCode>
		</DocSection>
	),

	"installation": (
		<DocSection>
			<DocLead>
				The engine ships as part of the <code>nextjs-engine</code> package. Clone
				the repo or copy <code>src/engine/</code> into your project, then add the
				tsconfig path alias.
			</DocLead>

			<DocH2>tsconfig.json</DocH2>
			<DocCode>{`{
  "compilerOptions": {
    "paths": {
      "@/engine": ["./src/engine/index.ts"],
      "@/*": ["./*"]
    },
    "baseUrl": "."
  }
}`}</DocCode>

			<DocH2>next.config.js</DocH2>
			<DocCode>{`const withEngineAPI = require("./src/engine/plugins/engineApiPlugin");

module.exports = withEngineAPI({
  reactStrictMode: true,
});`}</DocCode>

			<DocH2>app/layout.tsx</DocH2>
			<DocCode>{`import { EngineGlobalStyles } from "@/engine";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <EngineGlobalStyles />
        {children}
      </body>
    </html>
  );
}`}</DocCode>
		</DocSection>
	),

	"quick-start": (
		<DocSection>
			<DocLead>
				A complete page in under 30 lines. The engine handles every optimization.
			</DocLead>

			<DocCode>{`import { createPage, defineSchema } from "@/engine";

const MySchema = defineSchema({
  meta: {
    title: "My Page",
    description: "Built with the engine.",
  },
  theme: {
    vars: {
      "--e-bg":     "#070b12",
      "--e-accent": "#60a5fa",
    },
    globalStyles: \`body { background: var(--e-bg); color: white; }\`,
  },
  root: {
    type: "section",
    props: { contentMaxWidth: "1100px", py: { xs: "4rem", md: "8rem" } },
    children: [
      {
        type: "heading",
        props: {
          level: 1,
          content: "Hello, Engine",
          gradient: "linear-gradient(135deg, #60a5fa, #a78bfa)",
          align: "center",
        },
      },
      {
        type: "text",
        props: {
          variant: "lead",
          content: "No HTML. No JSX. No manual optimization.",
          align: "center",
          color: "rgba(255,255,255,.6)",
        },
      },
    ],
  },
});

export default createPage({ schema: MySchema });`}</DocCode>
		</DocSection>
	),

	"schema": (
		<DocSection>
			<DocLead>
				Every node follows a simple shape: <code>type</code>, optional <code>props</code>,
				optional <code>children</code>. The engine walks the tree and maps each type to
				a React component.
			</DocLead>

			<DocCode>{`{
  type:     "card",          // component to render
  key:      "feature-1",    // stable React key
  props: {
    variant: "filled",
    p:       "1.5rem",
    cprop: {
      onHover: { transform: "scale(1.02)" },
    },
  },
  children: [
    { type: "text", props: { variant: "h4", content: "Title" } },
    { type: "text", props: { content: "Body text here." } },
  ],
}`}</DocCode>

			<DocH2>defineSchema</DocH2>
			<DocP>
				Wrap your schema in <code>defineSchema()</code> for full TypeScript
				type-checking across every node, prop and theme field.
			</DocP>
		</DocSection>
	),

	"responsive": (
		<DocSection>
			<DocLead>
				Any prop that accepts <code>{"ResponsiveValue<T>"}</code> can take either a
				plain value or a breakpoint map. The engine compiles it to CSS custom
				properties — zero JS at runtime.
			</DocLead>

			<DocCode>{`// You write this in your schema:
props: { px: { xs: "1rem", md: "2rem", xl: "3rem" } }

// The engine generates this CSS once:
:root { --e-px-a1b2: 1rem }
@media(min-width:768px)  { :root { --e-px-a1b2: 2rem } }
@media(min-width:1280px) { :root { --e-px-a1b2: 3rem } }

// And applies this inline style:
style={{ paddingLeft: "var(--e-px-a1b2)", paddingRight: "var(--e-px-a1b2)" }}`}</DocCode>

			<DocH2>Breakpoints</DocH2>
			<DocTable
				headers={["Key", "Min Width"]}
				rows={[
					["xs", "0px (base)"],
					["sm", "640px"],
					["md", "768px"],
					["lg", "1024px"],
					["xl", "1280px"],
					["2xl", "1536px"],
				]}
			/>
		</DocSection>
	),

};

/* ========================================================================== */
/*  Docs Content Components                                                   */
/* ========================================================================== */

function DocSection({ children }: { children: React.ReactNode }) {
	return <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>{children}</div>;
}

function DocLead({ children }: { children: React.ReactNode }) {
	return (
		<p style={{
			fontSize:   "1.15rem",
			lineHeight: 1.75,
			color:      "rgba(255,255,255,.72)",
			maxWidth:   "800px",
		}}>
			{children}
		</p>
	);
}

function DocP({ children }: { children: React.ReactNode }) {
	return (
		<p style={{
			fontSize:   "1rem",
			lineHeight: 1.8,
			color:      "rgba(255,255,255,.65)",
			maxWidth:   "760px",
		}}>
			{children}
		</p>
	);
}

function DocH2({ children }: { children: React.ReactNode }) {
	return (
		<h2 style={{
			fontSize:     "1.35rem",
			fontWeight:   700,
			color:        "#fff",
			paddingBottom: ".75rem",
			borderBottom: "1px solid rgba(255,255,255,.06)",
		}}>
			{children}
		</h2>
	);
}

function DocCode({ children }: { children: string }) {
	return (
		<pre style={{
			background:  "rgba(255,255,255,.035)",
			border:      "1px solid rgba(255,255,255,.08)",
			borderRadius: "14px",
			padding:     "1.5rem",
			fontSize:    ".85rem",
			lineHeight:  1.7,
			overflowX:   "auto",
			color:       "#e2e8f0",
			fontFamily:  "'JetBrains Mono', 'Fira Code', monospace",
		}}>
			<code>{children}</code>
		</pre>
	);
}

function DocGrid({ children }: { children: React.ReactNode }) {
	return (
		<div style={{
			display:             "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
			gap:                 "1rem",
		}}>
			{children}
		</div>
	);
}

function DocFeature({
	icon,
	title,
	children,
}: {
	icon:     string;
	title:    string;
	children: React.ReactNode;
}) {
	return (
		<div style={{
			padding:      "1.25rem 1.5rem",
			background:   "rgba(255,255,255,.03)",
			border:       "1px solid rgba(255,255,255,.07)",
			borderRadius: "14px",
		}}>
			<div style={{ fontSize: "1.5rem", marginBottom: ".65rem" }}>{icon}</div>
			<div style={{ fontWeight: 700, marginBottom: ".45rem", color: "#fff" }}>{title}</div>
			<div style={{ fontSize: ".88rem", lineHeight: 1.65, color: "rgba(255,255,255,.55)" }}>{children}</div>
		</div>
	);
}

function DocTable({
	headers,
	rows,
}: {
	headers: string[];
	rows:    string[][];
}) {
	const thStyle: React.CSSProperties = {
		padding:     ".65rem 1rem",
		textAlign:   "left",
		fontSize:    ".8rem",
		fontWeight:  700,
		color:       "rgba(255,255,255,.45)",
		letterSpacing: ".06em",
		textTransform: "uppercase",
		borderBottom: "1px solid rgba(255,255,255,.08)",
	};
	const tdStyle: React.CSSProperties = {
		padding:    ".65rem 1rem",
		fontSize:   ".88rem",
		color:      "rgba(255,255,255,.72)",
		borderBottom: "1px solid rgba(255,255,255,.04)",
	};

	return (
		<div style={{ overflowX: "auto" }}>
			<table style={{
				width:          "100%",
				borderCollapse: "collapse",
				background:     "rgba(255,255,255,.02)",
				border:         "1px solid rgba(255,255,255,.07)",
				borderRadius:   "12px",
				overflow:       "hidden",
			}}>
				<thead>
					<tr>
						{headers.map((h) => (
							<th key={h} style={thStyle}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, i) => (
						<tr key={i}>
							{row.map((cell, j) => (
								<td key={j} style={{ ...tdStyle, ...(j === 0 ? { color: "#60a5fa", fontFamily: "monospace" } : {}) }}>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ComingSoon({ node }: { node: PETreeNode }) {
	return (
		<div style={{
			display:        "flex",
			flexDirection:  "column",
			alignItems:     "center",
			justifyContent: "center",
			gap:            "1rem",
			padding:        "5rem 2rem",
			textAlign:      "center",
		}}>
			<div style={{ fontSize: "3rem" }}>🚧</div>
			<h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>
				{node.title ?? "Coming Soon"}
			</h2>
			<p style={{ color: "rgba(255,255,255,.5)", maxWidth: "500px", lineHeight: 1.7 }}>
				{node.description ?? "This page is being written. Check back soon."}
			</p>
		</div>
	);
}

function IntroContent() {
	return (
		<div style={{
			display:        "flex",
			flexDirection:  "column",
			alignItems:     "center",
			justifyContent: "center",
			gap:            "2rem",
			padding:        "6rem 2rem",
			textAlign:      "center",
			maxWidth:       "700px",
			margin:         "0 auto",
		}}>
			<div style={{ fontSize: "4rem" }}>⚡</div>

			<h1 style={{
				fontSize:    "clamp(2.5rem, 5vw, 4rem)",
				fontWeight:  900,
				lineHeight:  1.05,
				background:  "linear-gradient(135deg, #60a5fa, #a78bfa)",
				WebkitBackgroundClip: "text",
				WebkitTextFillColor: "transparent",
			}}>
				Kastrick Docs
			</h1>

			<p style={{
				fontSize:   "1.15rem",
				lineHeight: 1.75,
				color:      "rgba(255,255,255,.6)",
			}}>
				Official documentation for the Kastrick ecosystem — the Next.js Engine,
				backend APIs, and every tool in the stack.
			</p>

			<div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
				<DocPill icon="⚡" label="Next.js Engine" />
				<DocPill icon="🌐" label="Backend APIs" />
				<DocPill icon="📱" label="Mobile" />
				<DocPill icon="✨" label="Animation" />
			</div>
		</div>
	);
}

function DocPill({ icon, label }: { icon: string; label: string }) {
	return (
		<div style={{
			display:      "flex",
			alignItems:   "center",
			gap:          ".5rem",
			padding:      ".5rem 1rem",
			borderRadius: "999px",
			border:       "1px solid rgba(255,255,255,.1)",
			background:   "rgba(255,255,255,.04)",
			fontSize:     ".9rem",
			color:        "rgba(255,255,255,.7)",
		}}>
			<span>{icon}</span>
			<span>{label}</span>
		</div>
	);
}

/* ========================================================================== */
/*  Page                                                                      */
/* ========================================================================== */

export default function DocsPage() {
	const [current, setCurrent] = useState<PETreeNode | null>(null);

	const handleNavigate = useCallback((node: PETreeNode) => {
		setCurrent(node);
	}, []);

	const title       = current?.title       ?? undefined;
	const description = current?.description ?? undefined;
	const content     = current
		? (CONTENT[current.id] ?? <ComingSoon node={current} />)
		: <IntroContent />;

	return (
		<ProductExplorer
			tree={DOCS_TREE}
			title={title}
			description={description}
			onNavigate={handleNavigate}
			metadata={current?.type === "page" ? {
				title:   current.title ?? "",
				status:  "stable",
				updated: "2026",
				author:  { name: "Kastrick" },
			} : undefined}
		>
			{content}
		</ProductExplorer>
	);
}