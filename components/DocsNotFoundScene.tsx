"use client";

/**
 * DocsNotFoundScene.tsx
 *
 * Interactive Three.js 404 fake-out scene for Kastrick Documentation (K8D).
 * Sequence on load:
 * 1. Intense build-up: the 3D K8D server rack vibrates aggressively while its
 *    status LED climbs toward critical red and warning sparks fly out.
 * 2. The fake-out: right before detonation, the LED ticks cleanly into bright
 *    green, the rack freezes steady, and a glowing 3D green outline pops around it.
 * 3. Popup appears: "hay the server didn't explode!" / "this doesn't exist.. maybe these do?"
 *    with smart fuzzy-matched page suggestions loaded from static docs-search-index JSON files.
 */

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface DocsProjectSummary {
	id: string;
	name: string;
	established: boolean;
	status: string;
	description: string;
	accentColor?: string;
}

interface SearchIndexPage {
	projectId: string;
	projectName: string;
	slug: string;
	title: string;
	section: string;
}

interface SuggestionItem {
	href: string;
	title: string;
	projectName: string;
	section: string;
	badge?: string;
}

interface DocsNotFoundSceneProps {
	projects: DocsProjectSummary[];
}

interface SparkItem {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	life: number;
	maxLife: number;
}

const SCENE_CSS = `
	html,
	body {
		margin: 0 !important;
		overflow: hidden !important;
		background: #06080e !important;
	}
	.kd-404-stage {
		position: fixed;
		inset: 0;
		z-index: 9999;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
		background: #06080e;
		color: #f4f7fb;
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
	}
	.kd-404-webgl {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 1;
	}
	.kd-404-vignette {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background:
			radial-gradient(ellipse at 50% 48%, transparent 45%, rgba(4, 6, 10, 0.72) 100%),
			linear-gradient(180deg, rgba(5, 7, 12, 0.45) 0%, transparent 18%, transparent 80%, rgba(4, 6, 10, 0.75) 100%);
	}
	.kd-404-hud {
		position: absolute;
		z-index: 4;
		left: max(1.2rem, env(safe-area-inset-left));
		top: max(1.1rem, env(safe-area-inset-top));
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.68rem 0.92rem;
		border-radius: 12px;
		border: 1px solid rgba(56, 189, 248, 0.2);
		background: rgba(9, 11, 16, 0.78);
		backdrop-filter: blur(14px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
		pointer-events: none;
		max-width: min(400px, calc(100vw - 2.4rem));
	}
	.kd-404-hud-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}
	.kd-404-led {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ff4d63;
		box-shadow: 0 0 12px rgba(255, 77, 99, 0.95);
		transition: background 0.14s ease, box-shadow 0.14s ease;
	}
	.kd-404-led.is-safe {
		background: #34d399;
		box-shadow: 0 0 14px rgba(52, 211, 153, 0.95);
	}
	.kd-404-hud-title {
		color: #38bdf8;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.kd-404-hud-status {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.73rem;
		font-weight: 700;
		color: #ff8596;
		letter-spacing: 0.04em;
	}
	.kd-404-hud-status.is-safe {
		color: #7df0b2;
	}
	.kd-404-popup-wrap {
		position: absolute;
		inset: 0;
		z-index: 6;
		display: grid;
		place-items: center;
		padding: 1.2rem;
		pointer-events: none;
		opacity: 0;
		transform: translateY(18px) scale(0.94);
		transition: opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.46s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.kd-404-popup-wrap.is-visible {
		opacity: 1;
		transform: translateY(0) scale(1);
		pointer-events: auto;
	}
	.kd-404-popup {
		width: min(520px, 100%);
		max-height: min(84vh, 640px);
		overflow-y: auto;
		padding: 1.45rem 1.55rem;
		border-radius: 18px;
		border: 1px solid rgba(52, 211, 153, 0.42);
		background: linear-gradient(165deg, rgba(11, 16, 22, 0.92), rgba(7, 10, 14, 0.96));
		backdrop-filter: blur(20px);
		box-shadow:
			0 26px 72px rgba(0, 0, 0, 0.74),
			0 0 42px rgba(52, 211, 153, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.kd-404-badge-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.kd-404-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		padding: 0.3rem 0.68rem;
		border-radius: 999px;
		border: 1px solid rgba(52, 211, 153, 0.45);
		background: rgba(52, 211, 153, 0.14);
		color: #7df0b2;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.69rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.kd-404-path {
		padding: 0.24rem 0.56rem;
		border-radius: 7px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: #93c5fd;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.72rem;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kd-404-popup h1 {
		margin: 0;
		font-size: clamp(1.26rem, 2.5vw, 1.56rem);
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #f8fafc;
	}
	.kd-404-subtitle {
		margin: 0;
		color: rgba(203, 213, 225, 0.82);
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.kd-404-not-est {
		padding: 0.65rem 0.85rem;
		border-radius: 10px;
		border: 1px solid rgba(167, 139, 250, 0.35);
		background: rgba(167, 139, 250, 0.1);
		color: #ddd6fe;
		font-size: 0.8rem;
		line-height: 1.45;
	}
	.kd-404-suggestions {
		display: grid;
		gap: 0.5rem;
	}
	.kd-404-suggestion {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.68rem 0.85rem;
		border-radius: 11px;
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(16, 22, 32, 0.78);
		color: #eef2f7;
		text-decoration: none;
		transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}
	.kd-404-suggestion:hover {
		transform: translateY(-1px);
		border-color: rgba(52, 211, 153, 0.55);
		background: rgba(18, 34, 34, 0.86);
	}
	.kd-404-suggestion-main {
		display: flex;
		flex-direction: column;
		gap: 0.16rem;
		min-width: 0;
	}
	.kd-404-suggestion-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: #f8fafc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kd-404-suggestion-meta {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.69rem;
		color: rgba(148, 163, 184, 0.85);
	}
	.kd-404-suggestion-arrow {
		color: #34d399;
		font-weight: 700;
		flex-shrink: 0;
	}
	.kd-404-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-top: 0.2rem;
	}
	.kd-404-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		padding: 0.6rem 1.05rem;
		border-radius: 10px;
		border: 1px solid rgba(52, 211, 153, 0.45);
		background: linear-gradient(180deg, rgba(52, 211, 153, 0.24), rgba(52, 211, 153, 0.1));
		color: #ecfdf5;
		font: 700 0.82rem/1 Inter, ui-sans-serif, system-ui, sans-serif;
		text-decoration: none;
		cursor: pointer;
		transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}
	.kd-404-btn:hover {
		transform: translateY(-1px);
		border-color: rgba(52, 211, 153, 0.82);
	}
	.kd-404-btn-ghost {
		border-color: rgba(255, 255, 255, 0.14);
		background: rgba(15, 20, 29, 0.84);
		color: #cbd5e1;
	}
	.kd-404-btn-ghost:hover {
		border-color: rgba(56, 189, 248, 0.55);
		color: #ffffff;
	}
`;

/** Clamp numeric value between 0 and 1. */
function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/** Score a search-index page against tokens extracted from the missing URL path. */
function scorePageMatch(page: SearchIndexPage, tokens: string[], rawPath: string): number {
	const haystack = `${page.projectId} ${page.slug} ${page.title} ${page.section}`.toLowerCase();
	let score = 0;
	if (rawPath.startsWith(`/${page.projectId}`)) {
		score += 4;
	}
	for (const token of tokens) {
		if (page.slug.toLowerCase().includes(token)) score += 6;
		if (page.title.toLowerCase().includes(token)) score += 5;
		if (page.section.toLowerCase().includes(token)) score += 2;
		if (haystack.includes(token)) score += 1;
	}
	return score;
}

/** Create a crisp glowing OLED blade label texture. */
function createBladeTexture(label: string, colorHex: string, borderHex: string): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 64;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#070b12";
		ctx.fillRect(0, 0, 256, 64);
		ctx.strokeStyle = borderHex;
		ctx.lineWidth = 4;
		ctx.strokeRect(4, 4, 248, 56);
		ctx.fillStyle = colorHex;
		ctx.font = "900 28px ui-monospace, SFMono-Regular, Consolas, monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(label, 128, 34);
	}
	const tex = new THREE.CanvasTexture(canvas);
	tex.needsUpdate = true;
	return tex;
}

export default function DocsNotFoundScene({ projects }: DocsNotFoundSceneProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const replayRef = useRef<(() => void) | null>(null);

	const [pathname, setPathname] = useState("/404");
	const [stabilized, setStabilized] = useState(false);
	const [showPopup, setShowPopup] = useState(false);
	const [statusText, setStatusText] = useState("CRITICAL VIBRATION // 94% OVERLOAD");
	const [notEstProject, setNotEstProject] = useState<DocsProjectSummary | null>(null);
	const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

	// Load static search indexes and compute closest-match suggestions for the missing URL.
	useEffect(() => {
		const currentPath = window.location?.pathname || "/404";
		setPathname(currentPath);

		const lowerPath = currentPath.toLowerCase();
		const matchedNotEst = projects.find(
			(project) => !project.established && lowerPath.startsWith(`/${project.id.toLowerCase()}`),
		);
		setNotEstProject(matchedNotEst ?? null);

		const tokens = lowerPath
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length >= 2 && token !== "doc" && token !== "docs");

		const fallbackItems: SuggestionItem[] = projects
			.filter((project) => project.established)
			.map((project) => ({
				href: `/${project.id}`,
				title: `${project.name} Documentation`,
				projectName: project.name,
				section: "Project Home",
			}));

		let cancelled = false;
		const loadSuggestions = async (): Promise<void> => {
			try {
				const establishedIds = projects.filter((p) => p.established).map((p) => p.id);
				const responses = await Promise.all(
					establishedIds.map((id) =>
						fetch(`/docs-search-index/${id}.json`)
							.then((res) => (res.ok ? res.json() : null))
							.catch(() => null),
					),
				);
				const allPages: SearchIndexPage[] = [];
				for (const payload of responses) {
					if (payload && Array.isArray(payload.pages)) {
						allPages.push(...payload.pages);
					}
				}
				if (cancelled) return;

				const ranked = allPages
					.map((page) => ({ page, score: scorePageMatch(page, tokens, lowerPath) }))
					.filter((item) => item.score > 0)
					.sort((a, b) => b.score - a.score)
					.slice(0, 4)
					.map(({ page }) => ({
						href: `/${page.projectId}/${page.slug}`,
						title: page.title,
						projectName: page.projectName,
						section: page.section || "Documentation",
					}));

				setSuggestions(ranked.length > 0 ? ranked : fallbackItems);
			} catch {
				if (!cancelled) setSuggestions(fallbackItems);
			}
		};

		loadSuggestions();
		return () => {
			cancelled = true;
		};
	}, [projects]);

	// Initialize and animate the Three.js aggressive-vibration -> green-outline fake-out scene.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: true,
				alpha: false,
				powerPreference: "high-performance",
			});
		} catch {
			setStabilized(true);
			setShowPopup(true);
			setStatusText("STABILIZED // HTTP 404");
			return;
		}

		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(window.innerWidth, window.innerHeight, false);
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.15;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x06080e);
		scene.fog = new THREE.FogExp2(0x060912, 0.068);

		const camera = new THREE.PerspectiveCamera(
			window.innerWidth <= 900 ? 54 : 44,
			Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
			0.1,
			90,
		);

		// Room lights.
		const ambient = new THREE.AmbientLight(0x3a5272, 0.72);
		scene.add(ambient);

		const overhead = new THREE.SpotLight(0x9be2ff, 48, 24, Math.PI * 0.36, 0.55, 1.3);
		overhead.position.set(0, 7.8, 2.2);
		overhead.target.position.set(0, 1.85, 0);
		scene.add(overhead, overhead.target);

		// Dynamic status light that ramps from orange -> almost crimson red, then snaps to emerald green.
		const statusLight = new THREE.PointLight(0xff4d3b, 4, 12, 1.5);
		statusLight.position.set(0, 2.1, 1.4);
		scene.add(statusLight);

		const geometries: THREE.BufferGeometry[] = [];
		const materials: THREE.Material[] = [];
		const textures: THREE.Texture[] = [];
		const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
			geometries.push(g);
			return g;
		};
		const trackMat = <T extends THREE.Material>(m: T): T => {
			materials.push(m);
			return m;
		};

		// Dark reflective grid floor.
		const floor = new THREE.Mesh(
			trackGeo(new THREE.PlaneGeometry(46, 46)),
			trackMat(new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25, metalness: 0.5 })),
		);
		floor.rotation.x = -Math.PI * 0.5;
		scene.add(floor);

		const floorGrid = new THREE.GridHelper(36, 36, 0x1e3a5f, 0x101c2e);
		floorGrid.position.y = 0.01;
		scene.add(floorGrid);

		// Hero K8D Server Rack Group.
		const rackGroup = new THREE.Group();
		scene.add(rackGroup);

		const chassisGeo = trackGeo(new THREE.BoxGeometry(1.94, 3.74, 1.32));
		const chassisMat = trackMat(
			new THREE.MeshStandardMaterial({ color: 0x101724, roughness: 0.4, metalness: 0.78 }),
		);
		const chassis = new THREE.Mesh(chassisGeo, chassisMat);
		chassis.position.set(0, 1.87, 0);
		rackGroup.add(chassis);

		// Glowing 3D neon green outline + soft aura shell that POPS on fake-out!
		const edgesGeo = trackGeo(new THREE.EdgesGeometry(chassisGeo));
		const greenOutlineMat = trackMat(
			new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0 }),
		);
		const greenOutline = new THREE.LineSegments(edgesGeo, greenOutlineMat);
		greenOutline.position.copy(chassis.position);
		greenOutline.scale.setScalar(1.015);
		rackGroup.add(greenOutline);

		const greenAuraMat = trackMat(
			new THREE.MeshBasicMaterial({
				color: 0x34d399,
				transparent: true,
				opacity: 0,
				side: THREE.BackSide,
			}),
		);
		const greenAura = new THREE.Mesh(chassisGeo, greenAuraMat);
		greenAura.position.copy(chassis.position);
		greenAura.scale.set(1.06, 1.03, 1.06);
		rackGroup.add(greenAura);

		// Expanding emerald stabilization shockwave ring on the floor.
		const safeRingMat = trackMat(
			new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0, side: THREE.DoubleSide }),
		);
		const safeRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(0.95, 1.12, 48)), safeRingMat);
		safeRing.rotation.x = -Math.PI * 0.5;
		safeRing.position.set(0, 0.04, 0);
		scene.add(safeRing);

		// 6 Server Blades on front face + hero status LED that almost turns red, then ticks green!
		const bladeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x162131, roughness: 0.38, metalness: 0.72 }));
		const heroBladeMat = trackMat(
			new THREE.MeshStandardMaterial({
				color: 0x26121a,
				emissive: 0xff3b2f,
				emissiveIntensity: 0.5,
				roughness: 0.35,
				metalness: 0.68,
			}),
		);
		const heroLedMat = trackMat(
			new THREE.MeshStandardMaterial({
				color: 0xff6b35,
				emissive: 0xff4526,
				emissiveIntensity: 3.0,
			}),
		);
		const smallLedMat = trackMat(
			new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.8 }),
		);

		const bladeGeo = trackGeo(new THREE.BoxGeometry(1.64, 0.44, 0.14));
		const labelGeo = trackGeo(new THREE.PlaneGeometry(0.54, 0.18));

		for (let index = 0; index < 6; index += 1) {
			const isHero = index === 2;
			const bladeY = 3.22 - index * 0.54;
			const blade = new THREE.Mesh(bladeGeo, isHero ? heroBladeMat : bladeMat);
			blade.position.set(0, bladeY, 0.65);
			rackGroup.add(blade);

			// Status LED indicator.
			const led = new THREE.Mesh(
				trackGeo(new THREE.SphereGeometry(isHero ? 0.085 : 0.04, 14, 14)),
				isHero ? heroLedMat : smallLedMat,
			);
			led.position.set(-0.62, 0, 0.09);
			blade.add(led);

			const tex = createBladeTexture(
				isHero ? "K8D-404" : `DOC-0${index + 1}`,
				isHero ? "#f8fafc" : "#38bdf8",
				isHero ? "#ff5a6e" : "#1f3550",
			);
			textures.push(tex);
			const label = new THREE.Mesh(labelGeo, trackMat(new THREE.MeshBasicMaterial({ map: tex })));
			label.position.set(0.42, 0, 0.075);
			blade.add(label);
		}

		// Warning sparks spitting out during the intense vibration build-up.
		const MAX_SPARKS = 140;
		const sparkPositions = new Float32Array(MAX_SPARKS * 3);
		const sparkGeo = trackGeo(new THREE.BufferGeometry());
		sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
		const sparkMat = trackMat(
			new THREE.PointsMaterial({
				color: 0xffb347,
				size: 0.095,
				transparent: true,
				opacity: 0.95,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
		);
		scene.add(new THREE.Points(sparkGeo, sparkMat));
		const sparks: SparkItem[] = [];

		const spawnWarningSparks = (count: number): void => {
			for (let index = 0; index < count; index += 1) {
				if (sparks.length >= MAX_SPARKS) sparks.shift();
				const angle = (Math.random() - 0.5) * Math.PI * 1.4;
				const speed = 1.6 + Math.random() * 4.2;
				sparks.push({
					x: (Math.random() - 0.5) * 1.2,
					y: 2.14 + (Math.random() - 0.5) * 0.6,
					z: 0.76,
					vx: Math.sin(angle) * speed,
					vy: 0.6 + Math.random() * 2.6,
					vz: 1.0 + Math.cos(angle) * speed * 0.7,
					life: 0,
					maxLife: 0.4 + Math.random() * 0.55,
				});
			}
		};

		const FAKEOUT_AT = 2.65;
		const POPUP_AT = 3.15;

		let startedAt = performance.now();
		let lastTime = startedAt;
		let snappedGreen = false;
		let popupShown = false;
		let rafId = 0;

		const amberColor = new THREE.Color(0xff9f1c);
		const nearRedColor = new THREE.Color(0xff2438);
		const emeraldColor = new THREE.Color(0x34d399);
		const safeBladeColor = new THREE.Color(0x0c241e);
		const hotBladeColor = new THREE.Color(0x3b0b14);
		const tmpColor = new THREE.Color();

		const resetSequence = (): void => {
			startedAt = performance.now();
			lastTime = startedAt;
			snappedGreen = false;
			popupShown = false;
			sparks.length = 0;
			setStabilized(false);
			setShowPopup(false);
			setStatusText("CRITICAL VIBRATION // 94% OVERLOAD");

			rackGroup.position.set(0, 0, 0);
			rackGroup.rotation.set(0, 0, 0);
			greenOutlineMat.opacity = 0;
			greenAuraMat.opacity = 0;
			safeRingMat.opacity = 0;
			heroBladeMat.color.copy(hotBladeColor);
			heroBladeMat.emissive.copy(amberColor);
			heroLedMat.color.copy(amberColor);
			heroLedMat.emissive.copy(amberColor);
			statusLight.color.copy(amberColor);
		};

		replayRef.current = resetSequence;
		resetSequence();

		const handleResize = (): void => {
			const w = Math.max(1, window.innerWidth);
			const h = Math.max(1, window.innerHeight);
			camera.aspect = w / h;
			camera.fov = w <= 900 ? 54 : 44;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h, false);
		};
		window.addEventListener("resize", handleResize);

		const animate = (now: number): void => {
			rafId = window.requestAnimationFrame(animate);
			const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
			lastTime = now;
			const elapsed = (now - startedAt) / 1000;

			const baseCamZ = window.innerWidth <= 900 ? 7.4 : 5.75;
			let camShakeX = 0;
			let camShakeY = 0;

			if (!snappedGreen && elapsed < FAKEOUT_AT) {
				// Phase 1: Aggressive escalating vibration + LED ramping almost all the way to RED.
				const tension = clamp01(elapsed / FAKEOUT_AT);
				const ramp = Math.pow(tension, 1.55);

				// Escalating violent jitter on the server rack.
				const jitterPos = 0.02 + ramp * 0.16;
				const jitterRot = 0.01 + ramp * 0.085;
				rackGroup.position.set(
					(Math.random() - 0.5) * jitterPos,
					Math.abs(Math.sin(elapsed * 55)) * ramp * 0.08,
					(Math.random() - 0.5) * jitterPos,
				);
				rackGroup.rotation.set(
					(Math.random() - 0.5) * jitterRot,
					(Math.random() - 0.5) * jitterRot,
					(Math.random() - 0.5) * jitterRot,
				);

				// Intense camera micro-shake as tension peaks.
				camShakeX = (Math.random() - 0.5) * ramp * 0.14;
				camShakeY = (Math.random() - 0.5) * ramp * 0.14;

				// LED climbs from amber to 98% red — right on the brink of exploding!
				tmpColor.lerpColors(amberColor, nearRedColor, Math.min(0.96, ramp));
				heroLedMat.color.copy(tmpColor);
				heroLedMat.emissive.copy(tmpColor);
				heroLedMat.emissiveIntensity = 2.6 + ramp * 6.5 + Math.sin(elapsed * 42) * 1.2;
				heroBladeMat.emissive.copy(tmpColor);
				heroBladeMat.emissiveIntensity = 0.4 + ramp * 3.2;
				statusLight.color.copy(tmpColor);
				statusLight.intensity = 3.5 + ramp * 18;

				if (Math.random() < 0.25 + ramp * 0.55) {
					spawnWarningSparks(3);
				}
			} else {
				// Phase 2: THE FAKE-OUT! Snap instantly to emerald green & pop glowing green outline!
				if (!snappedGreen) {
					snappedGreen = true;
					setStabilized(true);
					setStatusText("TICK -> GREEN // SERVER DIDN'T EXPLODE");
					rackGroup.position.set(0, 0, 0);
					rackGroup.rotation.set(0, 0, 0);
					heroBladeMat.color.copy(safeBladeColor);
					heroBladeMat.emissive.copy(emeraldColor);
					heroBladeMat.emissiveIntensity = 0.9;
					heroLedMat.color.copy(emeraldColor);
					heroLedMat.emissive.copy(emeraldColor);
					heroLedMat.emissiveIntensity = 4.2;
					statusLight.color.copy(emeraldColor);
					statusLight.intensity = 14;
				}

				const sinceSafe = Math.max(0, elapsed - FAKEOUT_AT);
				const popBounce = 1 + Math.exp(-sinceSafe * 9) * Math.sin(sinceSafe * 24) * 0.045;
				rackGroup.scale.setScalar(popBounce);

				// Crisp glowing green outline & soft pulsing aura around the whole rack.
				greenOutlineMat.opacity = 0.92 + Math.sin(elapsed * 5) * 0.08;
				greenAuraMat.opacity = 0.12 + Math.sin(elapsed * 4) * 0.04;
				statusLight.intensity = 8.5 + Math.sin(elapsed * 4.5) * 1.8;

				// Expanding green stabilization ring across the floor.
				const ringT = clamp01(sinceSafe / 0.85);
				safeRing.scale.setScalar(1 + ringT * 5.8);
				safeRingMat.opacity = Math.max(0, (1 - ringT) * 0.8);

				if (!popupShown && elapsed >= POPUP_AT) {
					popupShown = true;
					setShowPopup(true);
				}
			}

			// Gentle zoom-in during tension, then slight relief pull-back after green snap.
			const zoomOffset = snappedGreen ? 0.35 : -clamp01(elapsed / FAKEOUT_AT) * 0.65;
			camera.position.set(camShakeX, 2.25 + camShakeY, baseCamZ + zoomOffset);
			camera.lookAt(0, 1.95, 0);

			// Update remaining sparks.
			for (let index = sparks.length - 1; index >= 0; index -= 1) {
				const s = sparks[index];
				s.life += dt;
				if (s.life >= s.maxLife) {
					sparks.splice(index, 1);
					continue;
				}
				s.vy -= 11 * dt;
				s.x += s.vx * dt;
				s.y += s.vy * dt;
				s.z += s.vz * dt;
				if (s.y < 0.03) {
					s.y = 0.03;
					s.vy *= -0.4;
				}
			}
			for (let index = 0; index < MAX_SPARKS; index += 1) {
				const offset = index * 3;
				if (index < sparks.length) {
					sparkPositions[offset] = sparks[index].x;
					sparkPositions[offset + 1] = sparks[index].y;
					sparkPositions[offset + 2] = sparks[index].z;
				} else {
					sparkPositions[offset] = 0;
					sparkPositions[offset + 1] = -999;
					sparkPositions[offset + 2] = 0;
				}
			}
			sparkGeo.attributes.position.needsUpdate = true;

			renderer.render(scene, camera);
		};

		rafId = window.requestAnimationFrame(animate);

		return () => {
			window.cancelAnimationFrame(rafId);
			window.removeEventListener("resize", handleResize);
			replayRef.current = null;
			geometries.forEach((g) => g.dispose());
			materials.forEach((m) => m.dispose());
			textures.forEach((t) => t.dispose());
			renderer.dispose();
		};
	}, []);

	const handleReplay = useCallback(() => {
		replayRef.current?.();
	}, []);

	return (
		<section className="kd-404-stage" role="main" aria-labelledby="kd-404-title">
			<style>{SCENE_CSS}</style>
			<canvas ref={canvasRef} className="kd-404-webgl" aria-hidden="true" />
			<div className="kd-404-vignette" aria-hidden="true" />

			<header className="kd-404-hud" aria-hidden="true">
				<div className="kd-404-hud-row">
					<span className={`kd-404-led${stabilized ? " is-safe" : ""}`} />
					<strong className="kd-404-hud-title">KASTRICK DOCS // K8D NODE</strong>
				</div>
				<span className={`kd-404-hud-status${stabilized ? " is-safe" : ""}`}>{statusText}</span>
			</header>

			<div className={`kd-404-popup-wrap${showPopup ? " is-visible" : ""}`}>
				<div className="kd-404-popup" role="dialog" aria-modal="false" aria-labelledby="kd-404-title">
					<div className="kd-404-badge-row">
						<span className="kd-404-badge">HTTP 404 · SAFE RECOVERY</span>
						<span className="kd-404-path">{pathname}</span>
					</div>

					<h1 id="kd-404-title">hay the server didn&apos;t explode!</h1>
					<p className="kd-404-subtitle">this doesn&apos;t exist.. maybe these do?</p>

					{notEstProject && (
						<div className="kd-404-not-est">
							<strong>{notEstProject.name}</strong> is currently marked <code>NOT_EST</code> — its documentation is planned but not published yet.
						</div>
					)}

					<div className="kd-404-suggestions">
						{suggestions.map((item) => (
							<Link key={item.href} href={item.href} className="kd-404-suggestion">
								<div className="kd-404-suggestion-main">
									<span className="kd-404-suggestion-title">{item.title}</span>
									<span className="kd-404-suggestion-meta">
										{item.projectName} · {item.section}
									</span>
								</div>
								<span className="kd-404-suggestion-arrow" aria-hidden="true">→</span>
							</Link>
						))}
					</div>

					<div className="kd-404-actions">
						<Link href="/" className="kd-404-btn">← Back to Docs Home</Link>
						<button type="button" className="kd-404-btn kd-404-btn-ghost" onClick={handleReplay}>
							Replay fake-out
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}
