/* ========================================================================== */
/*  src/example/app/page.tsx — EngineManim smoke test                        */
/*  Draws "Kastrick" as one continuous stroke path via type:"manim"           */
/*                                                                            */
/*  Single Path mobject — entire word in one SVG d string.                   */
/*  M and L are identical in the compiler (both push x,y).                   */
/*  "Travel" lines between letters act like pen-stroke connections.           */
/* ========================================================================== */

import { createPage, defineSchema } from "@/engine";

/*
 * Coordinate system — canvas 600 × 280 CSS px
 * Letters: y 80 → 200 (120 px tall), centered across 600 px
 *
 * Slots (x):  K=92–132  A=140–182  S=190–232  T=240–282
 *             R=290–332  I=340  C=350–392  K=400–440
 *
 * Single connected stroke traces every letter without lifting the pen.
 * Double-trace return paths on K/R spines keep the shapes correct.
 */
const KASTRICK_PATH =
	/* K1 — spine down, mid, upper arm, back, lower arm */
	"M92,80 L92,200 L92,140 L132,80 L92,140 L132,200 " +
	/* A  — connect, left up, right down, crossbar R→L  */
	"L140,200 L161,80 L182,200 L174,152 L148,152 " +
	/* S  — travel to top-right, two cubic segments     */
	"L232,90 C232,68 190,68 190,130 C190,178 232,178 232,200 " +
	/* T  — travel to bar, bar L→R, back to centre, stem */
	"L240,80 L282,80 L261,80 L261,200 " +
	/* R  — travel to top, spine, back, bump, leg       */
	"L290,80 L290,200 L290,80 C330,80 330,140 290,140 L332,200 " +
	/* I  — travel to top, stem                         */
	"L340,80 L340,200 " +
	/* C  — travel to top-right, arc (two cubics)       */
	"L392,90 C392,68 350,68 350,140 C350,212 392,212 392,190 " +
	/* K2 — travel to top, spine, mid, upper, back, lower */
	"L400,80 L400,200 L400,140 L440,80 L400,140 L440,200";

export default createPage({
	schema: defineSchema({
		meta: {
			title:       "EngineManim — Kastrick",
			description: "Smoke test: single-path Create animation of the word Kastrick.",
		},
		theme: {
			vars: {
				"--e-bg":     "#070b12",
				"--e-accent": "#60a5fa",
			},
			globalStyles: `
				*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
				body { background: #070b12; }
			`,
		},
		root: {
			type:  "section",
			props: {
				fullViewport: true,
				bg:           "#070b12",
				display:      "flex",
				flexDir:      "column",
				align:        "center",
				justify:      "center",
				gap:          "2rem",
			},
			children: [
				/* Label */
				{
					type:  "text",
					props: {
						content:  "EngineManim — draw-on test",
						variant:  "caption",
						color:    "rgba(255,255,255,.3)",
						align:    "center",
						style:    { letterSpacing: ".15em", textTransform: "uppercase" },
					},
				},

				/* Canvas wrapper — centres the fixed-size canvas */
				{
					type:  "box",
					props: {
						style: {
							borderRadius: "4px",
							border:       "1px solid rgba(255,255,255,.06)",
							background:   "#070b12",
							overflow:     "hidden",
						},
					},
					children: [
						{
							type:  "manim",
							props: {
								width:  600,
								height: 280,
								cprop: {
									manim: {
										settings: {
											loop:       true,
											fpsLimit:   60,
											background: "#070b12",
										},

										mobjects: [
											{
												id:          "word",
												type:        "Path",
												d:           KASTRICK_PATH,
												strokeColor: "#60a5fa",
												strokeWidth: 2.5,
											},
										],

										timeline: [
											/*
											 * Create — draws the whole path left-to-right
											 * over 3 s using the progressive point reveal.
											 */
											{
												action:     "Create",
												target:     "word",
												durationMs: 3000,
												easing:     "ease-in-out",
											},
											/*
											 * FadeOut — delay holds the final frame for 1.5 s
											 * (early-return in render loop preserves canvas),
											 * then fades to transparent over 0.8 s.
											 */
											{
												action:     "FadeOut",
												target:     "word",
												durationMs: 800,
												delay:      1500,
												easing:     "ease-in",
											},
										],
									},
								},
							},
						},
					],
				},

				/* Sub-label */
				{
					type:  "text",
					props: {
						content: "Single Path · Create 3 s · hold 1.5 s · FadeOut 0.8 s · loop",
						variant: "caption",
						color:   "rgba(255,255,255,.2)",
						align:   "center",
					},
				},
			],
		},
	}),
});