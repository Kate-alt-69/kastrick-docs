import test from "node:test";
import assert from "node:assert/strict";
import { decodeShareState, encodeShareState } from "../lib/shareState.ts";
import { decodeLegacyShareCode, encodeLegacyShareCode } from "../lib/shareCode.ts";

test("state-v1 creates a ten-character self-contained token", () => {
	const code = encodeShareState("A0bZ", { mode: "anchor", anchorId: 4095, scrollPercent: 73 }, {
		duration: 3, alignment: 2, highlight: true,
	});
	assert.equal(code.length, 10);
	assert.match(code, /^[0-9A-Za-z]{10}$/);
	assert.deepEqual(decodeShareState(code), {
		where: "A0bZ",
		state: {
			version: 1,
			target: { mode: "anchor", anchorId: 4095, scrollPercent: 73 },
			engineScroll: { duration: 3, alignment: 2, highlight: true, reserved: false },
		},
	});
});

test("all target modes round-trip with EngineScroll presets", () => {
	const options = { duration: 1, alignment: 3, highlight: false };
	const targets = [
		{ mode: "top" },
		{ mode: "bottom" },
		{ mode: "anchor", anchorId: 321, scrollPercent: 12 },
		{ mode: "line", line: 524287 },
		{ mode: "percent", scrollPercent: 100 },
	];
	for (const target of targets) {
		const decoded = decodeShareState(encodeShareState("0000", target, options));
		assert.ok(decoded);
		assert.deepEqual(decoded.state.target, target);
		assert.deepEqual(decoded.state.engineScroll, { ...options, reserved: false });
	}
});

test("checksum protects WHERE and STATE", () => {
	const code = encodeShareState("ABcd", { mode: "top" });
	const changedWhere = (code[0] === "0" ? "1" : "0") + code.slice(1);
	assert.equal(decodeShareState(changedWhere), null);
	const changedState = code.slice(0, 9) + (code[9] === "0" ? "1" : "0");
	assert.equal(decodeShareState(changedState), null);
});

test("invalid values and the reserved bit are rejected", () => {
	assert.equal(decodeShareState("123456789"), null);
	assert.equal(decodeShareState("12345678901"), null);
	assert.throws(() => encodeShareState("ABcd", { mode: "anchor", anchorId: 1, scrollPercent: 101 }));
	assert.throws(() => encodeShareState("ABcd", { mode: "line", line: 0 }));
	assert.throws(() => encodeShareState("ABcd", { mode: "percent", scrollPercent: -1 }));
	assert.throws(() => encodeShareState("ABcd", { mode: "top" }, {
		duration: 0, alignment: 0, highlight: true, reserved: true,
	}));
});

test("the original positional eight-character codec round-trips archived payloads", () => {
	const payload = { projectIdx: 2, trackIdx: 1, pageIdx: 12, lineIdx: 2060, levelPct: 62 };
	const code = encodeLegacyShareCode(payload);
	assert.equal(code.length, 8);
	assert.deepEqual(decodeLegacyShareCode(code), payload);
});
