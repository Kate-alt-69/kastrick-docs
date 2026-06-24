"use client";

import { createComponent, defineSchema } from "#module/engine";

const SiteChromeSchema = defineSchema({
	theme: {
		vars: {
			"--header-height": "84px",
			"--header-bg": "rgba(7,11,18,.72)",
			"--header-border": "rgba(255,255,255,.08)",
			"--header-shadow": "0 24px 60px rgba(0,0,0,.45)",
			"--header-blur": "blur(30px) saturate(180%)",
		},
	},

	root: {
		type: "box",

		props: {
			display: "flex",
			flexDir: "column",
			minHeight: "100svh",
			bg: "#070b12",
			color: "#ffffff",
		},

		children: [
			{
				type: "section",

				key: "site-header",

				props: {
					position: "sticky",
					top: 0,
					zIndex: 9999,

					h: "var(--header-height)",

					bg: "var(--header-bg)",

					backdrop: "var(--header-blur)",

					boxShadow: "var(--header-shadow)",

					borderBottom:
						"1px solid var(--header-border)",

					contentMaxWidth: "1500px",

					display: "flex",

					align: "center",
				},

				children: [
					{
						type: "stack",

						props: {
							direction: "horizontal",

							justify: "space-between",

							align: "center",

							px: {
								xs: "1.25rem",
								md: "2.5rem",
							},
						},

						children: [
							{
								type: "link",

								props: {
									href: "/",

									content: "Kastrick",

									cprop: {
										link: {
											transition: "instant",
										},

										styles: {
											fontSize: "1.55rem",

											fontWeight: 900,

											letterSpacing: "-0.05em",

											color: "#fff",

											textDecoration: "none",
										},
									},
								},
							},

							{
								type: "stack",

								props: {
									direction: "horizontal",

									gap: ".5rem",

									align: "center",

									display: {
										xs: "none",
										md: "flex",
									},
								},

								children: [
									{
										type: "EngineLink",

										props: {
											href: "/",

											content: "Documentation",
										},
									},

									{
										type: "EngineLink",

										props: {
											href: "/product",

											content: "Products",
										},
									},

									{
										type: "EngineLink",

										props: {
											href: "/credit",

											content: "Credits",
										},
									},

									{
										type: "EngineLink",

										props: {
											href: "https://github.com/Kate-alt-69/kastrick",

											content: "GitHub",
										},
									},
								],
							},
						],
					},
				],
			},

			{
				type: "slot",

				props: {
					name: "children",
				},
			},

			{
				type: "section",

				key: "site-footer",

				props: {
					bg: "#05070d",

					contentMaxWidth: "1500px",

					borderTop: "1px solid rgba(255,255,255,.08)",

					py: "5rem",
				},

				children: [
					{
						type: "stack",

						props: {
							gap: "1rem",

							align: "center",
						},

						children: [
							{
								type: "heading",

								props: {
									level: 2,

									content: "KASTRICK - DOCS",
								},
							},

							{
								type: "text",

								props: {
									content: "Official documentation for the Kastrick ecosystem.",

									color: "rgba(255,255,255,.65)",
								},
							},

							{
								type: "text",

								props: {
									content:	"Built entirely using the Nextjs Engine.",

									color: "rgba(255,255,255,.45)",
								},
							},
						],
					},
				],
			},
		],
	},
});

export default createComponent({
	schema: SiteChromeSchema,
});