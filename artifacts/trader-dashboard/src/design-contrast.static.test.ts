import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

function tokenHsl(name: string): [number, number, number] {
  const m = css.match(new RegExp(`${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  assert.ok(m, `cannot read HSL token ${name}`);
  return [Number(m![1]), Number(m![2]) / 100, Number(m![3]) / 100];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function luminance(name: string): number {
  const [r, g, b] = hslToRgb(tokenHsl(name)).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: Array<[string, string, number]> = [
  ["--text-hi", "--surface-0", 4.5],
  ["--text-hi", "--surface-1", 4.5],
  ["--text-lo", "--surface-1", 4.5],
  ["--accent-jade", "--surface-1", 4.5],
  ["--accent-jade", "--surface-0", 4.5],
];
for (const [fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= min, `${fg} on ${bg} contrast ${ratio.toFixed(2)} < ${min}`);
}

console.log("design contrast static checks passed");
