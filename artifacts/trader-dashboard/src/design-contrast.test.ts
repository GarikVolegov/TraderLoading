import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Check the actual default theme, including aliases and translucent backgrounds.
// These are the shared opaque surfaces; images and per-view opacity need visual QA.
const css = readFileSync(new URL("./styles/tokens.css", import.meta.url), "utf8");
const root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
assert.ok(root, "Default theme must define :root");
const tokens = new Map([...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
type RGB = readonly [number, number, number];

function color(token: string, visited = new Set<string>()): RGB {
  assert.ok(!visited.has(token), `Cyclic color alias: ${token}`);
  visited.add(token);
  const value = tokens.get(token);
  assert.ok(value, `Missing color token: ${token}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (alias) return color(alias[1], visited);
  const hsl = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  assert.ok(hsl, `Unsupported HSL token: ${token} = ${value}`);
  const hue = Number(hsl[1]) / 60;
  const saturation = Number(hsl[2]) / 100;
  const lightness = Number(hsl[3]) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(hue % 2 - 1));
  const offset = lightness - chroma / 2;
  const sectors: RGB[] = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary], [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]];
  return sectors[Math.floor(hue) % 6].map(channel => channel + offset) as unknown as RGB;
}

function composite(foreground: RGB, background: RGB, alpha: number): RGB {
  return foreground.map((channel, index) => alpha * channel + (1 - alpha) * background[index]) as unknown as RGB;
}

function luminance(rgb: RGB): number {
  const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: RGB, second: RGB): number {
  const [low, high] = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
}

assert.equal(contrast([0, 0, 0], [1, 1, 1]), 21);
assert.equal(contrast([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]), 1);
let checked = 0;
let minimumText = Infinity;
for (const surface of ["--background", "--card", "--secondary", "--muted"]) {
  const background = color(surface);
  for (const foreground of ["--foreground", "--muted-foreground"]) {
    const ratio = contrast(color(foreground), background);
    assert.ok(ratio >= 4.5, `${foreground} on ${surface}: ${ratio} < 4.5`);
    minimumText = Math.min(minimumText, ratio);
    checked++;
  }
  for (const [fill, label, alpha] of [
    ["--primary", "--primary-foreground", 1],
    ["--primary", "--primary-foreground", 0.9],
    ["--destructive", "--destructive-foreground", 1],
    ["--destructive", "--destructive-foreground", 0.95],
  ] as const) {
    const ratio = contrast(color(label), composite(color(fill), background, alpha));
    assert.ok(ratio >= 4.5, `${label} on ${fill} at ${alpha} over ${surface}: ${ratio} < 4.5`);
    minimumText = Math.min(minimumText, ratio);
    checked++;
  }
  assert.ok(contrast(color("--ring"), background) >= 3, `Focus ring on ${surface} must remain distinct`);
  checked++;
}

for (const surface of ["--background", "--card", "--secondary"]) {
  const ratio = contrast(color("--primary"), composite(color("--primary"), color(surface), 0.1));
  assert.ok(ratio >= 4.5, `Active navigation label on ${surface}: ${ratio} < 4.5`);
  minimumText = Math.min(minimumText, ratio);
  checked++;
}
console.log(`Theme contrast checks passed: ${checked} pairs, minimum text contrast ${minimumText.toFixed(3)}:1`);
