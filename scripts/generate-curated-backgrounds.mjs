import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas } = canvasModule;

const desktopDir = path.resolve("artifacts/trader-dashboard/public/images/backgrounds/desktop");
const mobileDir = path.resolve("artifacts/trader-dashboard/public/images/backgrounds/mobile");

fs.mkdirSync(desktopDir, { recursive: true });
fs.mkdirSync(mobileDir, { recursive: true });

// Seeded pseudorandom number generator for reproducible procedural textures
function createRng(seed = 123456789) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NERO OSSIDIANA (Pure Obsidian Black - #0A0A0C matching --surface-0)
// ─────────────────────────────────────────────────────────────────────────────
function renderNeroOssidiana(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  // Deep obsidian pure dark
  ctx.fillStyle = "#0A0A0C";
  ctx.fillRect(0, 0, w, h);
  return canvas.toBuffer("image/webp");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ORDO GEOMETRICO (Limen Architectural Matrix & Fibonacci Golden Spiral)
// ─────────────────────────────────────────────────────────────────────────────
function renderOrdoGeometrico(w, h, isMobile) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const rng = createRng(42);

  // Background
  ctx.fillStyle = "#08090C";
  ctx.fillRect(0, 0, w, h);

  // Subtle ambient radial glow in Limen Gold
  const cx = isMobile ? w * 0.5 : w * 0.55;
  const cy = isMobile ? h * 0.42 : h * 0.48;
  const maxR = Math.max(w, h) * 0.65;
  const radial = ctx.createRadialGradient(cx, cy, 50, cx, cy, maxR);
  radial.addColorStop(0, "rgba(197, 160, 89, 0.06)");
  radial.addColorStop(0.5, "rgba(197, 160, 89, 0.015)");
  radial.addColorStop(1, "rgba(8, 9, 12, 0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);

  // Grid system
  const step = isMobile ? 64 : 80;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Major golden grid lines every 4 steps
  ctx.strokeStyle = "rgba(197, 160, 89, 0.045)";
  for (let x = 0; x <= w; x += step * 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step * 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Grid intersection crosshairs (+)
  const crossSize = 3;
  ctx.strokeStyle = "rgba(197, 160, 89, 0.16)";
  for (let x = step * 2; x < w; x += step * 4) {
    for (let y = step * 2; y < h; y += step * 4) {
      ctx.beginPath();
      ctx.moveTo(x - crossSize, y);
      ctx.lineTo(x + crossSize, y);
      ctx.moveTo(x, y - crossSize);
      ctx.lineTo(x, y + crossSize);
      ctx.stroke();
    }
  }

  // Golden ratio concentric circles
  const phi = 1.61803398875;
  const radii = [
    step * 1.5,
    step * 1.5 * phi,
    step * 1.5 * phi * phi,
    step * 1.5 * phi * phi * phi,
    step * 1.5 * Math.pow(phi, 4),
  ];

  radii.forEach((r, idx) => {
    if (r > Math.max(w, h)) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (idx % 2 === 1) {
      ctx.setLineDash([4, 8]);
      ctx.strokeStyle = "rgba(197, 160, 89, 0.05)";
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(197, 160, 89, 0.08)";
    }
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Architectural isometric 30° / 60° diagonal lines
  ctx.strokeStyle = "rgba(197, 160, 89, 0.035)";
  ctx.lineWidth = 1;
  const angle = Math.PI / 6; // 30 degrees
  for (let offset = -h; offset < w + h; offset += step * 6) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + Math.tan(angle) * h, h);
    ctx.stroke();
  }

  // Golden logarithmic spiral
  ctx.strokeStyle = "rgba(197, 160, 89, 0.14)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const spiralA = 4;
  const spiralB = 0.30635; // golden spiral growth
  let first = true;
  for (let theta = 0; theta < Math.PI * 6.5; theta += 0.04) {
    const r = spiralA * Math.exp(spiralB * theta);
    if (r > Math.max(w, h) * 0.65) break;
    const sx = cx + r * Math.cos(theta);
    const sy = cy + r * Math.sin(theta);
    if (first) {
      ctx.moveTo(sx, sy);
      first = false;
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  ctx.stroke();

  // Outer dark vignette to guarantee low contrast at edges
  const edgeVignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
  edgeVignette.addColorStop(0, "rgba(8, 9, 12, 0)");
  edgeVignette.addColorStop(1, "rgba(6, 7, 9, 0.75)");
  ctx.fillStyle = edgeVignette;
  ctx.fillRect(0, 0, w, h);

  return canvas.toBuffer("image/webp");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AUREUS NOIR (Burnished Gold Atmospheric Vignette on Obsidian)
// ─────────────────────────────────────────────────────────────────────────────
function renderAureusNoir(w, h, isMobile) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const rng = createRng(108);

  // Deep obsidian base
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, w, h);

  // Primary warm burnished gold atmospheric pool (top-right for desktop, top for mobile)
  const g1x = isMobile ? w * 0.7 : w * 0.85;
  const g1y = isMobile ? h * 0.2 : h * 0.25;
  const g1r = Math.max(w, h) * 0.6;
  const g1 = ctx.createRadialGradient(g1x, g1y, 40, g1x, g1y, g1r);
  g1.addColorStop(0, "rgba(212, 175, 55, 0.11)");
  g1.addColorStop(0.35, "rgba(197, 160, 89, 0.05)");
  g1.addColorStop(0.7, "rgba(139, 30, 30, 0.02)"); // Limen crimson faint undertone
  g1.addColorStop(1, "rgba(7, 7, 9, 0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // Secondary soft bronze pool in bottom-left
  const g2x = isMobile ? w * 0.2 : w * 0.15;
  const g2y = isMobile ? h * 0.85 : h * 0.8;
  const g2 = ctx.createRadialGradient(g2x, g2y, 20, g2x, g2y, g1r * 0.8);
  g2.addColorStop(0, "rgba(180, 140, 65, 0.07)");
  g2.addColorStop(0.5, "rgba(197, 160, 89, 0.02)");
  g2.addColorStop(1, "rgba(7, 7, 9, 0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  // Fine brushed horizontal metallic strokes
  ctx.lineWidth = 1;
  const strokeCount = isMobile ? 350 : 500;
  for (let i = 0; i < strokeCount; i++) {
    const y = rng() * h;
    const startX = rng() * w * 0.7;
    const len = 80 + rng() * 320;
    const alpha = 0.01 + rng() * 0.025;
    ctx.strokeStyle = `rgba(197, 160, 89, ${alpha.toFixed(4)})`;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + len, y);
    ctx.stroke();
  }

  // Soft atmospheric gold bokeh embers
  const emberCount = isMobile ? 40 : 65;
  for (let i = 0; i < emberCount; i++) {
    const bx = rng() * w;
    const by = rng() * h;
    const br = 2 + rng() * 12;
    const bAlpha = 0.03 + rng() * 0.08;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0, `rgba(230, 195, 110, ${bAlpha.toFixed(3)})`);
    bg.addColorStop(0.6, `rgba(197, 160, 89, ${(bAlpha * 0.4).toFixed(3)})`);
    bg.addColorStop(1, "rgba(197, 160, 89, 0)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heavy vignette to preserve center contrast
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, "rgba(7, 7, 9, 0)");
  vignette.addColorStop(0.8, "rgba(5, 5, 7, 0.6)");
  vignette.addColorStop(1, "rgba(3, 3, 5, 0.9)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  return canvas.toBuffer("image/webp");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CYBER MATRIX (Institutional Terminal Grid & Quantitative Depth)
// ─────────────────────────────────────────────────────────────────────────────
function renderCyberMatrix(w, h, isMobile) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const rng = createRng(777);

  // Midnight slate/obsidian canvas
  ctx.fillStyle = "#05070B";
  ctx.fillRect(0, 0, w, h);

  // Subtle cyan & gold ambient horizon glow
  const horizonY = isMobile ? h * 0.58 : h * 0.54;
  const glowH = ctx.createRadialGradient(w / 2, horizonY, 20, w / 2, horizonY, w * 0.7);
  glowH.addColorStop(0, "rgba(16, 185, 129, 0.045)"); // Jade/Emerald accent
  glowH.addColorStop(0.4, "rgba(59, 130, 246, 0.025)");
  glowH.addColorStop(1, "rgba(5, 7, 11, 0)");
  ctx.fillStyle = glowH;
  ctx.fillRect(0, 0, w, h);

  // Horizon line
  ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(w, horizonY);
  ctx.stroke();

  // Perspective grid receding downwards from horizon
  const floorLines = 18;
  for (let i = 1; i <= floorLines; i++) {
    const t = Math.pow(i / floorLines, 2.2);
    const y = horizonY + t * (h - horizonY);
    const alpha = (0.015 + t * 0.05).toFixed(3);
    ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Perspective grid rays converging at center horizon
  const rayCount = isMobile ? 14 : 28;
  for (let i = 0; i <= rayCount; i++) {
    const bottomX = (i / rayCount) * w * 1.6 - w * 0.3;
    ctx.strokeStyle = "rgba(16, 185, 129, 0.035)";
    ctx.beginPath();
    ctx.moveTo(w / 2, horizonY);
    ctx.lineTo(bottomX, h);
    ctx.stroke();
  }

  // Upper sky terminal depth: faint technical level lines
  const skyLines = [0.12, 0.22, 0.32, 0.42];
  skyLines.forEach((ratio) => {
    const y = h * ratio;
    ctx.strokeStyle = "rgba(197, 160, 89, 0.04)";
    ctx.setLineDash([2, 10]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    // Small numerical coordinates on the edge
    ctx.fillStyle = "rgba(197, 160, 89, 0.14)";
    ctx.font = "10px monospace";
    ctx.fillText(`TL.ORD.${(ratio * 1000).toFixed(0)}`, 24, y - 4);
  });
  ctx.setLineDash([]);

  // Terminal data node points on grid intersections
  const nodeCount = isMobile ? 25 : 50;
  for (let i = 0; i < nodeCount; i++) {
    const nx = rng() * w;
    const ny = horizonY + rng() * (h - horizonY);
    const isGold = rng() > 0.65;
    ctx.fillStyle = isGold ? "rgba(197, 160, 89, 0.2)" : "rgba(16, 185, 129, 0.25)";
    ctx.beginPath();
    ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette
  const vig = ctx.createLinearGradient(0, 0, 0, h);
  vig.addColorStop(0, "rgba(4, 6, 9, 0.7)");
  vig.addColorStop(0.3, "rgba(4, 6, 9, 0)");
  vig.addColorStop(0.7, "rgba(4, 6, 9, 0)");
  vig.addColorStop(1, "rgba(3, 4, 7, 0.85)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  return canvas.toBuffer("image/webp");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FINANCIAL NOCTURNE (Midnight Trading Towers & Cinematic Golden Bokeh)
// ─────────────────────────────────────────────────────────────────────────────
function renderNocturneCity(w, h, isMobile) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const rng = createRng(999);

  // Pure dark midnight background
  ctx.fillStyle = "#040508";
  ctx.fillRect(0, 0, w, h);

  // Nocturnal sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  skyGrad.addColorStop(0, "rgba(7, 9, 15, 0.9)");
  skyGrad.addColorStop(0.5, "rgba(12, 14, 22, 0.6)");
  skyGrad.addColorStop(1, "rgba(5, 6, 9, 0)");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Distant building silhouettes (Layer 1 - deep background)
  const bldgCountL1 = isMobile ? 12 : 24;
  const baseGround = h * 0.92;
  ctx.fillStyle = "#090B12";
  for (let i = 0; i < bldgCountL1; i++) {
    const bw = (w / bldgCountL1) * (1 + rng() * 0.6);
    const bx = (i / bldgCountL1) * w * 1.1 - w * 0.05;
    const bh = (h * 0.25) + rng() * (h * 0.35);
    ctx.fillRect(bx, baseGround - bh, bw, bh + h * 0.2);
  }

  // Midground building silhouettes (Layer 2)
  const bldgCountL2 = isMobile ? 8 : 16;
  ctx.fillStyle = "#0D101A";
  const towers = [];
  for (let i = 0; i < bldgCountL2; i++) {
    const bw = (w / bldgCountL2) * (0.8 + rng() * 0.5);
    const bx = (i / bldgCountL2) * w * 1.05 - w * 0.02;
    const bh = (h * 0.2) + rng() * (h * 0.28);
    ctx.fillRect(bx, baseGround - bh, bw, bh + h * 0.2);
    towers.push({ bx, bw, by: baseGround - bh, bh });
  }

  // Windows & office illuminated grids inside towers
  towers.forEach((tw) => {
    const winCols = Math.floor(tw.bw / 12);
    const winRows = Math.floor(tw.bh / 16);
    for (let c = 1; c < winCols - 1; c++) {
      for (let r = 1; r < winRows - 1; r++) {
        if (rng() > 0.18) continue; // Sparse nocturnal lights
        const wx = tw.bx + c * 12;
        const wy = tw.by + r * 16;
        const isAmber = rng() > 0.4;
        const alpha = 0.08 + rng() * 0.25;
        ctx.fillStyle = isAmber
          ? `rgba(212, 175, 55, ${alpha.toFixed(3)})`
          : `rgba(220, 230, 250, ${alpha.toFixed(3)})`;
        ctx.fillRect(wx, wy, 4, 6);
      }
    }
  });

  // Wet rain-slicked asphalt / dark water reflection at bottom
  const reflectGrad = ctx.createLinearGradient(0, baseGround - 20, 0, h);
  reflectGrad.addColorStop(0, "rgba(5, 6, 9, 0.4)");
  reflectGrad.addColorStop(0.3, "rgba(10, 12, 18, 0.8)");
  reflectGrad.addColorStop(1, "rgba(4, 5, 7, 0.98)");
  ctx.fillStyle = reflectGrad;
  ctx.fillRect(0, baseGround - 20, w, h - (baseGround - 20));

  // Vertical light reflection streaks on wet street
  for (let i = 0; i < (isMobile ? 20 : 45); i++) {
    const rx = rng() * w;
    const ry = baseGround + rng() * (h - baseGround);
    const rw = 2 + rng() * 8;
    const rh = 15 + rng() * 60;
    const isGold = rng() > 0.35;
    ctx.fillStyle = isGold
      ? "rgba(197, 160, 89, 0.04)"
      : "rgba(16, 185, 129, 0.03)";
    ctx.fillRect(rx, ry, rw, rh);
  }

  // Soft cinematic out-of-focus bokeh lights in upper sky & midground
  const bokehCount = isMobile ? 35 : 65;
  for (let i = 0; i < bokehCount; i++) {
    const bx = rng() * w;
    const by = rng() * (h * 0.75);
    const br = 6 + rng() * 26;
    const isGold = rng() > 0.3;
    const bColor = isGold ? "212, 175, 55" : "190, 215, 255";
    const bAlpha = 0.02 + rng() * 0.055;

    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0, `rgba(${bColor}, ${bAlpha.toFixed(3)})`);
    bg.addColorStop(0.7, `rgba(${bColor}, ${(bAlpha * 0.35).toFixed(3)})`);
    bg.addColorStop(1, `rgba(${bColor}, 0)`);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark exposure overlay to guarantee perfect readability of UI
  const darkMask = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  darkMask.addColorStop(0, "rgba(4, 5, 8, 0.35)");
  darkMask.addColorStop(0.7, "rgba(4, 5, 8, 0.65)");
  darkMask.addColorStop(1, "rgba(3, 4, 6, 0.92)");
  ctx.fillStyle = darkMask;
  ctx.fillRect(0, 0, w, h);

  return canvas.toBuffer("image/webp");
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PIETRA ANTRACITE (Dark Monolithic Slate & Subtle Gold Vein)
// ─────────────────────────────────────────────────────────────────────────────
function renderPietraAntracite(w, h, isMobile) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const rng = createRng(54321);

  // Base stone charcoal / anthracite
  ctx.fillStyle = "#0A0B0F";
  ctx.fillRect(0, 0, w, h);

  // Diagonal raking light from top-left (chiseled stone sheen)
  const raking = ctx.createLinearGradient(0, 0, w, h);
  raking.addColorStop(0, "rgba(38, 42, 54, 0.35)");
  raking.addColorStop(0.35, "rgba(20, 22, 28, 0.15)");
  raking.addColorStop(0.7, "rgba(10, 11, 15, 0.2)");
  raking.addColorStop(1, "rgba(6, 7, 9, 0.5)");
  ctx.fillStyle = raking;
  ctx.fillRect(0, 0, w, h);

  // Micro mineral grain texture
  const grainCount = isMobile ? 12000 : 25000;
  for (let i = 0; i < grainCount; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const isLight = rng() > 0.5;
    const alpha = 0.012 + rng() * 0.025;
    ctx.fillStyle = isLight
      ? `rgba(255, 255, 255, ${alpha.toFixed(3)})`
      : `rgba(0, 0, 0, ${(alpha * 1.5).toFixed(3)})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Geological strata fractures at -30 degree angle
  const strataCount = isMobile ? 18 : 32;
  const angle = -Math.PI / 6;
  ctx.lineWidth = 1;
  for (let i = 0; i < strataCount; i++) {
    const offset = (i / strataCount) * (w + h) - h * 0.3;
    const alpha = 0.015 + rng() * 0.035;
    ctx.strokeStyle = `rgba(180, 190, 210, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + Math.sin(angle) * h * 1.5, h);
    ctx.stroke();
  }

  // Subtle golden quartz fracture vein (Limen signature)
  const veinStartX = isMobile ? w * 0.2 : w * 0.35;
  const veinStartY = 0;
  ctx.strokeStyle = "rgba(197, 160, 89, 0.09)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(veinStartX, veinStartY);

  let curX = veinStartX;
  let curY = veinStartY;
  const steps = isMobile ? 30 : 45;
  const stepY = h / steps;
  for (let s = 1; s <= steps; s++) {
    curY += stepY;
    curX += (rng() - 0.45) * 45;
    ctx.lineTo(curX, curY);
  }
  ctx.stroke();

  // Subtle golden glow along fracture center
  ctx.strokeStyle = "rgba(212, 175, 55, 0.04)";
  ctx.lineWidth = 6;
  ctx.stroke();

  // Vignette to guarantee edge darkness
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, "rgba(8, 9, 13, 0)");
  vig.addColorStop(0.85, "rgba(5, 6, 8, 0.7)");
  vig.addColorStop(1, "rgba(3, 4, 5, 0.95)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  return canvas.toBuffer("image/webp");
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTE RENDERING
// ─────────────────────────────────────────────────────────────────────────────
const presets = [
  { id: "nero-ossidiana", fn: renderNeroOssidiana },
  { id: "ordo-geometrico", fn: renderOrdoGeometrico },
  { id: "aureus-noir", fn: renderAureusNoir },
  { id: "cyber-matrix", fn: renderCyberMatrix },
  { id: "nocturne-city", fn: renderNocturneCity },
  { id: "pietra-antracite", fn: renderPietraAntracite },
];

console.log("Generating 6 desktop backgrounds (2560x1440)...");
for (const p of presets) {
  const buf = p.fn(2560, 1440, false);
  const outPath = path.join(desktopDir, `${p.id}.webp`);
  fs.writeFileSync(outPath, buf);
  console.log(`  ✓ desktop/${p.id}.webp (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log("Generating 6 mobile backgrounds (1170x2532)...");
for (const p of presets) {
  const buf = p.fn(1170, 2532, true);
  const outPath = path.join(mobileDir, `${p.id}.webp`);
  fs.writeFileSync(outPath, buf);
  console.log(`  ✓ mobile/${p.id}.webp (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log("Done! All curated backgrounds generated successfully.");
