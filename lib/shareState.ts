/**
 * Version 1 self-contained share state.
 *
 * URL shape: /share/<4-char WHERE><6-char STATE>
 * STATE (35 bits): version(2), target mode(3), payload(19),
 * EngineScroll options(6), checksum(5).
 */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = 62n;
const VERSION = 1;
const MAX_STATE = (1n << 35n) - 1n;

export type ShareTarget =
  | { mode: "top" | "bottom" }
  | { mode: "anchor"; anchorId: number; scrollPercent?: number }
  | { mode: "line"; line: number }
  | { mode: "percent"; scrollPercent: number };

export interface EngineScrollOptions {
  duration: 0 | 1 | 2 | 3;
  alignment: 0 | 1 | 2 | 3;
  highlight: boolean;
  reserved?: boolean;
}

export interface DecodedShareState {
  version: 1;
  target: ShareTarget;
  engineScroll: EngineScrollOptions;
}

const DEFAULT_ENGINE_SCROLL: EngineScrollOptions = {
  duration: 2,
  alignment: 0,
  highlight: true,
  reserved: false,
};

function encodeBase62(value: bigint, width: number): string {
  let n = value;
  let result = "";
  for (let i = 0; i < width; i += 1) {
    result = ALPHABET[Number(n % BASE)] + result;
    n /= BASE;
  }
  if (n !== 0n) throw new RangeError("Value does not fit the requested Base62 width");
  return result;
}

function decodeBase62(input: string): bigint | null {
  let value = 0n;
  for (const character of input) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) return null;
    value = value * BASE + BigInt(digit);
  }
  return value;
}

function checksumBody(value: bigint, where: string): bigint {
  // Include WHERE so a typo in either half is checked; this is not authentication.
  let crc = 0x1f;
  const bits = [...where].flatMap((character) => {
    const digit = ALPHABET.indexOf(character);
    return Array.from({ length: 6 }, (_, index) => (digit >> (5 - index)) & 1);
  });
  for (let bit = 29; bit >= 0; bit -= 1) {
    bits.push(Number((value >> BigInt(bit)) & 1n));
  }
  for (const incoming of bits) {
    const feedback = ((crc >> 4) & 1) ^ incoming;
    crc = (crc << 1) & 0x1f;
    if (feedback) crc ^= 0x05;
  }
  return BigInt(crc);
}

function packTarget(target: ShareTarget): { mode: number; payload: bigint } {
  switch (target.mode) {
    case "top": return { mode: 0, payload: 0n };
    case "bottom": return { mode: 1, payload: 0n };
    case "anchor": {
      if (!Number.isInteger(target.anchorId) || target.anchorId < 0 || target.anchorId > 4095) {
        throw new RangeError("anchorId must be an integer from 0 to 4095");
      }
      const percent = target.scrollPercent ?? 0;
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new RangeError("scrollPercent must be between 0 and 100");
      }
      return { mode: 2, payload: (BigInt(target.anchorId) << 7n) | BigInt(Math.round(percent)) };
    }
    case "line": {
      if (!Number.isInteger(target.line) || target.line < 1 || target.line > 524287) {
        throw new RangeError("line must be an integer from 1 to 524287");
      }
      return { mode: 3, payload: BigInt(target.line) };
    }
    case "percent": {
      if (!Number.isFinite(target.scrollPercent) || target.scrollPercent < 0 || target.scrollPercent > 100) {
        throw new RangeError("scrollPercent must be between 0 and 100");
      }
      return { mode: 4, payload: BigInt(Math.round(target.scrollPercent)) };
    }
  }
}

function packEngineScroll(options: EngineScrollOptions): bigint {
  if (![0, 1, 2, 3].includes(options.duration) || ![0, 1, 2, 3].includes(options.alignment)) {
    throw new RangeError("EngineScroll presets must be integers from 0 to 3");
  }
  if (options.reserved) throw new RangeError("The reserved EngineScroll bit must remain zero in v1");
  return (BigInt(options.duration) << 4n)
    | (BigInt(options.alignment) << 2n)
    | (options.highlight ? 2n : 0n);
}

export function encodeShareState(
  where: string,
  target: ShareTarget,
  options: EngineScrollOptions = DEFAULT_ENGINE_SCROLL,
): string {
  if (where.length !== 4 || !/^[0-9A-Za-z]{4}$/.test(where)) {
    throw new TypeError("WHERE must be exactly four Base62 characters");
  }
  const { mode, payload } = packTarget(target);
  const engine = packEngineScroll(options);
  const body = (BigInt(VERSION) << 28n) | (BigInt(mode) << 25n) | (payload << 6n) | engine;
  const packed = (body << 5n) | checksumBody(body, where);
  return where + encodeBase62(packed, 6);
}

export function decodeShareState(code: string): { where: string; state: DecodedShareState } | null {
  if (code.length !== 10 || !/^[0-9A-Za-z]{10}$/.test(code)) return null;
  const packed = decodeBase62(code.slice(4));
  if (packed === null || packed >= (1n << 35n)) return null;
  const checksum = packed & 0x1fn;
  const body = packed >> 5n;
  if (checksumBody(body, code.slice(0, 4)) !== checksum) return null;

  const version = Number((body >> 28n) & 0x3n);
  if (version !== VERSION) return null;
  const mode = Number((body >> 25n) & 0x7n);
  const payload = (body >> 6n) & 0x7ffffn;
  const engine = Number(body & 0x3fn);
  const duration = ((engine >> 4) & 0x3) as 0 | 1 | 2 | 3;
  const alignment = ((engine >> 2) & 0x3) as 0 | 1 | 2 | 3;
  const highlight = (engine & 0x2) !== 0;
  const reserved = (engine & 0x1) !== 0;
  if (reserved) return null;

  let target: ShareTarget;
  if (mode === 0 && payload === 0n) target = { mode: "top" };
  else if (mode === 1 && payload === 0n) target = { mode: "bottom" };
  else if (mode === 2) {
    const scrollPercent = Number(payload & 0x7fn);
    if (scrollPercent > 100) return null;
    target = { mode: "anchor", anchorId: Number(payload >> 7n), scrollPercent };
  } else if (mode === 3 && payload > 0n) target = { mode: "line", line: Number(payload) };
  else if (mode === 4 && payload <= 100n) target = { mode: "percent", scrollPercent: Number(payload) };
  else return null;

  return {
    where: code.slice(0, 4),
    state: { version: 1, target, engineScroll: { duration, alignment, highlight, reserved } },
  };
}

export function base62DocumentId(value: number): string {
  if (!Number.isInteger(value) || value < 0 || BigInt(value) >= 62n ** 4n) {
    throw new RangeError("Document ID must fit in four Base62 characters");
  }
  return encodeBase62(BigInt(value), 4);
}

export const ENGINE_SCROLL_PRESETS = {
  duration: [0, 250, 550, 900] as const,
  alignment: ["clear-sticky-header", "tight", "center", "flush"] as const,
};
export const ENGINE_SCROLL_DEFAULTS = DEFAULT_ENGINE_SCROLL;
