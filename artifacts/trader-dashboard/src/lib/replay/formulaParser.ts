// ─── Custom-indicator formula parser ─────────────────────────────────────────
// A tiny recursive-descent parser + series evaluator for the terminal's custom
// indicator. Replaces the mockup's `new Function(...)` evaluation: no eval, no
// CSP concerns, no injection surface — only whitelisted identifiers
// (c o h l v i hl2 ohlc4) and functions (ema/sma/rsi) can appear.
//
// Grammar:
//   expr    := term (('+'|'-') term)*
//   term    := unary (('*'|'/') unary)*
//   unary   := '-' unary | primary
//   primary := NUMBER | IDENT | FN '(' expr (',' NUMBER)? ')' | '(' expr ')'
// `ema(14)` is sugar for `ema(c, 14)`. Periods must be integer literals 1..500.
import { ema, rsi, sma } from "../../components/chartIndicatorEngine";
import type { ReplayCandle } from "./types";

export type FormulaErrorCode =
  | "empty"
  | "unexpected_char"
  | "unexpected_token"
  | "unknown_identifier"
  | "unknown_function"
  | "bad_period"
  | "bad_args"
  | "unbalanced_paren";

export class FormulaError extends Error {
  readonly code: FormulaErrorCode;
  readonly position: number;

  constructor(code: FormulaErrorCode, position: number) {
    super(`formula error: ${code} at ${position}`);
    this.name = "FormulaError";
    this.code = code;
    this.position = position;
  }
}

const IDENTIFIERS = ["c", "o", "h", "l", "v", "i", "hl2", "ohlc4"] as const;
export type FormulaIdentifier = (typeof IDENTIFIERS)[number];

const FUNCTIONS = ["ema", "sma", "rsi"] as const;
export type FormulaFunction = (typeof FUNCTIONS)[number];

const MAX_PERIOD = 500;

export type FormulaAst =
  | { kind: "number"; value: number }
  | { kind: "ident"; name: FormulaIdentifier }
  | { kind: "unary"; op: "-"; operand: FormulaAst }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: FormulaAst; right: FormulaAst }
  | { kind: "call"; fn: FormulaFunction; series: FormulaAst; period: number };

type Token =
  | { type: "number"; value: number; pos: number }
  | { type: "ident"; name: string; pos: number }
  | { type: "op"; op: "+" | "-" | "*" | "/"; pos: number }
  | { type: "lparen" | "rparen" | "comma"; pos: number };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", pos: i });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", pos: i });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", pos: i });
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", op: ch, pos: i });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
      const raw = src.slice(start, i);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new FormulaError("unexpected_char", start);
      tokens.push({ type: "number", value, pos: start });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i += 1;
      tokens.push({ type: "ident", name: src.slice(start, i), pos: start });
      continue;
    }
    throw new FormulaError("unexpected_char", i);
  }
  return tokens;
}

export function parseFormula(src: string): FormulaAst {
  const trimmed = src.trim();
  if (trimmed === "") throw new FormulaError("empty", 0);
  const tokens = tokenize(src);
  if (tokens.length === 0) throw new FormulaError("empty", 0);

  let index = 0;
  const peek = (): Token | undefined => tokens[index];
  const next = (): Token | undefined => tokens[index++];
  const posOf = (token: Token | undefined): number => token?.pos ?? src.length;

  function parseExpr(): FormulaAst {
    let left = parseTerm();
    for (;;) {
      const token = peek();
      if (token?.type === "op" && (token.op === "+" || token.op === "-")) {
        index += 1;
        left = { kind: "binary", op: token.op, left, right: parseTerm() };
      } else {
        return left;
      }
    }
  }

  function parseTerm(): FormulaAst {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (token?.type === "op" && (token.op === "*" || token.op === "/")) {
        index += 1;
        left = { kind: "binary", op: token.op, left, right: parseUnary() };
      } else {
        return left;
      }
    }
  }

  function parseUnary(): FormulaAst {
    const token = peek();
    if (token?.type === "op" && token.op === "-") {
      index += 1;
      return { kind: "unary", op: "-", operand: parseUnary() };
    }
    return parsePrimary();
  }

  function parseCall(fnName: string, fnPos: number): FormulaAst {
    if (!(FUNCTIONS as readonly string[]).includes(fnName)) {
      throw new FormulaError("unknown_function", fnPos);
    }
    const fn = fnName as FormulaFunction;
    index += 1; // consume '('
    if (peek()?.type === "rparen") throw new FormulaError("bad_args", posOf(peek()));

    const first = parseExpr();
    let series: FormulaAst;
    let periodToken: Token | undefined;

    const separator = peek();
    if (separator?.type === "comma") {
      index += 1;
      periodToken = next();
      series = first;
    } else {
      // single-arg sugar: fn(period) → fn(close, period)
      if (first.kind !== "number") throw new FormulaError("bad_args", posOf(separator));
      series = { kind: "ident", name: "c" };
      periodToken = { type: "number", value: first.value, pos: fnPos };
    }

    if (periodToken?.type !== "number") throw new FormulaError("bad_period", posOf(periodToken));
    const period = periodToken.value;
    if (!Number.isInteger(period) || period < 1 || period > MAX_PERIOD) {
      throw new FormulaError("bad_period", periodToken.pos);
    }

    const closing = next();
    if (closing?.type !== "rparen") {
      throw new FormulaError(closing == null ? "unbalanced_paren" : "bad_args", posOf(closing));
    }
    return { kind: "call", fn, series, period };
  }

  function parsePrimary(): FormulaAst {
    const token = next();
    if (token == null) throw new FormulaError("unexpected_token", src.length);
    if (token.type === "number") return { kind: "number", value: token.value };
    if (token.type === "lparen") {
      const inner = parseExpr();
      const closing = next();
      if (closing?.type !== "rparen") throw new FormulaError("unbalanced_paren", posOf(closing));
      return inner;
    }
    if (token.type === "ident") {
      if (peek()?.type === "lparen") return parseCall(token.name, token.pos);
      if ((IDENTIFIERS as readonly string[]).includes(token.name)) {
        return { kind: "ident", name: token.name as FormulaIdentifier };
      }
      throw new FormulaError("unknown_identifier", token.pos);
    }
    throw new FormulaError("unexpected_token", token.pos);
  }

  const ast = parseExpr();
  if (index < tokens.length) throw new FormulaError("unexpected_token", posOf(peek()));
  return ast;
}

type SeriesOrScalar = { series: (number | null)[] } | { scalar: number };

function identSeries(name: FormulaIdentifier, candles: ReplayCandle[]): (number | null)[] {
  switch (name) {
    case "c":
      return candles.map((k) => k.close);
    case "o":
      return candles.map((k) => k.open);
    case "h":
      return candles.map((k) => k.high);
    case "l":
      return candles.map((k) => k.low);
    case "v":
      return candles.map((k) => k.volume ?? 0);
    case "i":
      return candles.map((_, i) => i);
    case "hl2":
      return candles.map((k) => (k.high + k.low) / 2);
    case "ohlc4":
      return candles.map((k) => (k.open + k.high + k.low + k.close) / 4);
  }
}

/** Apply an engine fn over the contiguous non-null tail, re-aligned to length. */
function applyOverTail(
  fn: (values: number[], period: number) => (number | null)[],
  input: (number | null)[],
  period: number,
): (number | null)[] {
  const indices: number[] = [];
  const compact: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const v = input[i];
    if (v != null) {
      indices.push(i);
      compact.push(v);
    }
  }
  const applied = fn(compact, period);
  const out: (number | null)[] = new Array(input.length).fill(null);
  for (let j = 0; j < indices.length; j++) out[indices[j]] = applied[j] ?? null;
  return out;
}

const ENGINE_FNS: Record<FormulaFunction, (values: number[], period: number) => (number | null)[]> = {
  ema,
  sma,
  rsi,
};

function combine(
  left: SeriesOrScalar,
  right: SeriesOrScalar,
  length: number,
  op: (a: number, b: number) => number,
): SeriesOrScalar {
  const finite = (value: number): number | null => (Number.isFinite(value) ? value : null);
  if ("scalar" in left && "scalar" in right) {
    const value = op(left.scalar, right.scalar);
    return Number.isFinite(value) ? { scalar: value } : { series: new Array(length).fill(null) };
  }
  const at = (side: SeriesOrScalar, i: number): number | null =>
    "scalar" in side ? side.scalar : side.series[i];
  const series: (number | null)[] = new Array(length);
  for (let i = 0; i < length; i++) {
    const a = at(left, i);
    const b = at(right, i);
    series[i] = a == null || b == null ? null : finite(op(a, b));
  }
  return { series };
}

function evalNode(node: FormulaAst, candles: ReplayCandle[]): SeriesOrScalar {
  switch (node.kind) {
    case "number":
      return { scalar: node.value };
    case "ident":
      return { series: identSeries(node.name, candles) };
    case "unary": {
      const operand = evalNode(node.operand, candles);
      if ("scalar" in operand) return { scalar: -operand.scalar };
      return { series: operand.series.map((v) => (v == null ? null : -v)) };
    }
    case "binary": {
      const ops: Record<typeof node.op, (a: number, b: number) => number> = {
        "+": (a, b) => a + b,
        "-": (a, b) => a - b,
        "*": (a, b) => a * b,
        "/": (a, b) => a / b,
      };
      return combine(
        evalNode(node.left, candles),
        evalNode(node.right, candles),
        candles.length,
        ops[node.op],
      );
    }
    case "call": {
      const seriesArg = evalNode(node.series, candles);
      const input =
        "scalar" in seriesArg
          ? (new Array(candles.length).fill(seriesArg.scalar) as number[])
          : seriesArg.series;
      return { series: applyOverTail(ENGINE_FNS[node.fn], input, node.period) };
    }
  }
}

/** Evaluate a parsed formula over the candles, aligned to their length. */
export function evaluateFormula(ast: FormulaAst, candles: ReplayCandle[]): (number | null)[] {
  const result = evalNode(ast, candles);
  if ("scalar" in result) {
    const value = Number.isFinite(result.scalar) ? result.scalar : null;
    return candles.map(() => value);
  }
  return result.series;
}
