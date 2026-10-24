import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas } = canvasModule;

const outputDir = path.resolve("design-mockups/limen-uniform-printful");
fs.mkdirSync(outputDir, { recursive: true });

console.log("Generating embroidery master assets for Printful Gildan 18500...");

/**
 * 1. Left Chest Emblem (Petto Sinistro) - Standard Embroidery (up to 4" x 4" / 1200 x 1200 px at 300 DPI)
 * Dimensions: 1200 x 1200 px (300 DPI = 4 x 4 inches)
 * Palette:
 * - Printful Thread: Old Gold (#C5A059)
 * - Printful Thread: Pitch Black (#111111)
 */
function generateLeftChest() {
  const size = 1200;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  const centerX = size / 2;
  const sigilCenterY = 480;

  // Draw Architectural Portal Sigil
  // Scale factor: sigil width ~ 460px
  ctx.save();
  ctx.translate(centerX, sigilCenterY);

  const gold = "#C5A059";
  const black = "#111111";

  // Base threshold plinth
  ctx.lineWidth = 14;
  ctx.strokeStyle = black;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ground line (threshold)
  ctx.beginPath();
  ctx.moveTo(-200, 190);
  ctx.lineTo(200, 190);
  ctx.stroke();

  // Sub-base line
  ctx.lineWidth = 10;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.moveTo(-160, 210);
  ctx.lineTo(160, 210);
  ctx.stroke();

  // Outer Sanctuary Arch / Portico
  ctx.lineWidth = 16;
  ctx.strokeStyle = black;
  ctx.beginPath();
  ctx.moveTo(-170, 190);
  ctx.lineTo(-170, -20);
  ctx.lineTo(0, -180);
  ctx.lineTo(170, -20);
  ctx.lineTo(170, 190);
  ctx.stroke();

  // Lintel crossbeam
  ctx.lineWidth = 12;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.moveTo(-190, -20);
  ctx.lineTo(190, -20);
  ctx.stroke();

  // Inner sanctum arch
  ctx.lineWidth = 12;
  ctx.strokeStyle = black;
  ctx.beginPath();
  ctx.moveTo(-95, 190);
  ctx.lineTo(-95, 70);
  ctx.lineTo(0, 15);
  ctx.lineTo(95, 70);
  ctx.lineTo(95, 190);
  ctx.stroke();

  // Central Sacred Rhombus (Keystone)
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(46, 105);
  ctx.lineTo(0, 150);
  ctx.lineTo(-46, 105);
  ctx.closePath();
  ctx.fill();

  // Inner core eye
  ctx.fillStyle = black;
  ctx.beginPath();
  ctx.arc(0, 105, 12, 0, Math.PI * 2);
  ctx.fill();

  // Central Vertical Axis Line
  ctx.strokeStyle = gold;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, -180);
  ctx.lineTo(0, 10);
  ctx.stroke();

  ctx.restore();

  // Typography below Sigil
  // "L I M E N"
  ctx.fillStyle = black;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 88px 'Copperplate', 'Times New Roman', serif";
  
  // Tracked out letters for luxury aesthetic
  const text = "L  I  M  E  N";
  ctx.fillText(text, centerX, 810);

  // Subtitle: "P R O T O C O L"
  ctx.fillStyle = gold;
  ctx.font = "600 32px 'Copperplate', 'Times New Roman', sans-serif";
  ctx.fillText("·  P R O T O C O L  ·", centerX, 880);

  // Bottom micro-detail: "ORDINE OPERATIVO"
  ctx.fillStyle = "#555555";
  ctx.font = "500 22px 'Courier New', monospace";
  ctx.fillText("NULLA DIES SINE LINEA", centerX, 930);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(outputDir, "limen_embroidery_chest_sportgrey.png"), buffer);
  console.log("Saved limen_embroidery_chest_sportgrey.png");
}

/**
 * 2. Center Chest Statement - Embroidery Plus (Large Area, 3000 x 1800 px at 300 DPI = 10" x 6")
 */
function generateLargeCenterChest() {
  const width = 3000;
  const height = 1800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const gold = "#C5A059";
  const black = "#111111";

  // Center Sigil Emblem
  ctx.save();
  ctx.translate(centerX, 620);

  // Heavy embroidery lines for Printful
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Outer Diamond
  ctx.lineWidth = 26;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.moveTo(0, -280);
  ctx.lineTo(280, 0);
  ctx.lineTo(0, 280);
  ctx.lineTo(-280, 0);
  ctx.closePath();
  ctx.stroke();

  // Inscribed Square (Threshold Frame)
  ctx.lineWidth = 22;
  ctx.strokeStyle = black;
  ctx.strokeRect(-160, -160, 320, 320);

  // Axis of Discipline (Vertical Spine)
  ctx.lineWidth = 18;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.moveTo(0, -340);
  ctx.lineTo(0, -170);
  ctx.moveTo(0, 170);
  ctx.lineTo(0, 340);
  ctx.stroke();

  // Central Sovereign Core
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = black;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  // Left & Right Guard Flares
  ctx.fillStyle = gold;
  ctx.fillRect(-370, -4, 60, 8);
  ctx.fillRect(310, -4, 60, 8);

  ctx.restore();

  // Large Bold Roman Caps: "L  I  M  E  N"
  ctx.fillStyle = black;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 165px 'Copperplate', 'Times New Roman', serif";
  ctx.fillText("L   I   M   E   N", centerX, 1140);

  // Subtitle Banner
  ctx.fillStyle = gold;
  ctx.font = "bold 46px 'Copperplate', 'Times New Roman', sans-serif";
  ctx.fillText("P  R  O  T  O  C  O  L", centerX, 1260);

  // Technical Metadata Line
  ctx.fillStyle = "#333333";
  ctx.font = "600 28px 'Courier New', monospace";
  ctx.fillText("SOGLIA OPERATIVA  //  ZERO RUMORE COGNITIVO  //  MMXXIV", centerX, 1340);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(outputDir, "limen_embroidery_center_large_plus.png"), buffer);
  console.log("Saved limen_embroidery_center_large_plus.png");
}

/**
 * 3. Wrist / Cuff Micro Embroidery (Polsino) - 600 x 600 px (2" x 2" at 300 DPI)
 */
function generateWristEmblem() {
  const size = 600;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const gold = "#C5A059";
  const black = "#111111";

  // Compact Sigil
  ctx.save();
  ctx.translate(center, center - 45);

  ctx.lineWidth = 14;
  ctx.strokeStyle = black;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Diamond
  ctx.beginPath();
  ctx.moveTo(0, -120);
  ctx.lineTo(120, 0);
  ctx.lineTo(0, 120);
  ctx.lineTo(-120, 0);
  ctx.closePath();
  ctx.stroke();

  // Inscribed Gold Core
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Micro letters: "TL" (Trans-Limen) or "LIMEN"
  ctx.fillStyle = black;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 44px 'Copperplate', 'Times New Roman', serif";
  ctx.fillText("· LIMEN ·", center, center + 140);

  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(path.join(outputDir, "limen_embroidery_wrist_cuff.png"), buffer);
  console.log("Saved limen_embroidery_wrist_cuff.png");
}

generateLeftChest();
generateLargeCenterChest();
generateWristEmblem();
console.log("All master PNG embroidery files generated successfully.");
