"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const configuredRoot = process.env.KASTRICK_DOCS_STATIC_DIR;
const staticCandidates = configuredRoot
	? [path.resolve(projectRoot, configuredRoot)]
	: [path.join(projectRoot, "out"), path.join(projectRoot, "dist")];

function findStaticRoot() {
	for (const candidate of staticCandidates) {
		try {
			if (fs.statSync(path.join(candidate, "index.html")).isFile()) {
				return candidate;
			}
		} catch {
			// This candidate is not an exported static site.
		}
	}
	const expected = configuredRoot
		? path.resolve(projectRoot, configuredRoot)
		: path.join(projectRoot, "out");
	throw new Error(
		"Static export not found. Run npm run build first. Expected an index.html at " +
		expected +
		". Set KASTRICK_DOCS_STATIC_DIR to use a different export directory.",
	);
}

const staticRoot = findStaticRoot();
const mimeTypes = {
	".avif": "image/avif",
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".mp4": "video/mp4",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".wasm": "application/wasm",
	".webm": "video/webm",
	".webmanifest": "application/manifest+json; charset=utf-8",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".xml": "application/xml; charset=utf-8",
};

function resolveRequestPath(requestUrl) {
	let pathname;
	try {
		pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
	} catch {
		return null;
	}

	if (pathname.includes("\0") || pathname.includes("\\")) return null;
	const segments = pathname.split("/").filter(Boolean);
	if (segments.some((segment) => segment === "." || segment === "..")) return null;

	// Static export emits the resolver as /share.html or /share/index.html.
	// Keep the browser URL intact so ShareResolver can read the 8-char path token.
	const isShareCodePath = /^\\/share\\/[A-Za-z0-9]{8}\\/?$/.test(pathname);
	const relativePath = isShareCodePath ? "share" : segments.join(path.sep);
	const basePath = path.resolve(staticRoot, relativePath);
	const rootPrefix = staticRoot.endsWith(path.sep) ? staticRoot : staticRoot + path.sep;
	if (basePath !== staticRoot && !basePath.startsWith(rootPrefix)) return null;

	const candidates = [];
	if (isShareCodePath) {
		candidates.push(path.join(staticRoot, "share.html"));
		candidates.push(path.join(staticRoot, "share", "index.html"));
	} else if (pathname.endsWith("/")) {
		candidates.push(path.join(basePath, "index.html"));
		if (relativePath) candidates.push(basePath + ".html");
	} else if (relativePath) {
		candidates.push(basePath, basePath + ".html", path.join(basePath, "index.html"));
	} else {
		candidates.push(path.join(staticRoot, "index.html"));
	}
	return candidates;
}

async function findFile(candidates) {
	for (const candidate of candidates) {
		try {
			const stats = await fs.promises.stat(candidate);
			if (stats.isFile()) return { file: candidate, stats };
		} catch {
			// Try the next static-export filename convention.
		}
	}
	return null;
}

const server = http.createServer(async (request, response) => {
	if (request.method !== "GET" && request.method !== "HEAD") {
		response.writeHead(405, { Allow: "GET, HEAD" });
		response.end("Method Not Allowed");
		return;
	}

	const candidates = resolveRequestPath(request.url || "/");
	if (!candidates) {
		response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Bad Request");
		return;
	}

	const resolved = await findFile(candidates);
	if (!resolved) {
		const notFound = await findFile([path.join(staticRoot, "404.html")]);
		if (notFound) {
			response.writeHead(404, {
				"Content-Type": "text/html; charset=utf-8",
				"Content-Length": notFound.stats.size,
				"X-Content-Type-Options": "nosniff",
				"Cache-Control": "no-cache",
			});
			if (request.method === "HEAD") response.end();
			else fs.createReadStream(notFound.file).pipe(response);
			return;
		}
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Not Found");
		return;
	}

	const extension = path.extname(resolved.file).toLowerCase();
	response.writeHead(200, {
		"Content-Type": mimeTypes[extension] || "application/octet-stream",
		"Content-Length": resolved.stats.size,
		"Last-Modified": resolved.stats.mtime.toUTCString(),
		"X-Content-Type-Options": "nosniff",
		"Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
	});

	if (request.method === "HEAD") {
		response.end();
		return;
	}

	const stream = fs.createReadStream(resolved.file);
	stream.on("error", () => {
		if (!response.headersSent) response.writeHead(500);
		response.end("Internal Server Error");
	});
	stream.pipe(response);
});

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
	throw new Error("PORT must be a valid TCP port between 1 and 65535.");
}

server.listen(port, host, () => {
	process.stdout.write(
		"[kastrick-docs] Serving static export from " +
		path.relative(projectRoot, staticRoot) +
		" at http://" + host + ":" + port + "\n",
	);
});
