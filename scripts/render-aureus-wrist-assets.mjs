import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const outputDir = path.resolve("design-mockups/limen-uniform-printful");
const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/fb175fd8-73ed-48f5-a362-a72330aad517");

async function renderAureusWrist() {
  console.log("Rendering Roman Aureus Wrist assets...");

  const svgPath = path.join(outputDir, "limen_wrist_roman_aureus.svg");
  const svgBuf = fs.readFileSync(svgPath);
  const coinImg = await loadImage(svgBuf);

  // 1. Transparent 300 DPI Master PNG for Printful Upload (900 x 900 px)
  const masterCanvas = createCanvas(900, 900);
  const mctx = masterCanvas.getContext("2d");
  mctx.drawImage(coinImg, 0, 0, 900, 900);

  const pngPath = path.join(outputDir, "limen_wrist_roman_aureus_300dpi.png");
  fs.writeFileSync(pngPath, masterCanvas.toBuffer("image/png"));
  fs.writeFileSync(path.join(brainDir, "limen_wrist_roman_aureus_300dpi.png"), masterCanvas.toBuffer("image/png"));
  console.log("Saved transparent 300 DPI wrist PNG:", pngPath);

  // Also replace limen_embroidery_wrist_cuff.png so Printful clients have it updated
  fs.writeFileSync(path.join(outputDir, "limen_embroidery_wrist_cuff.png"), masterCanvas.toBuffer("image/png"));
  fs.writeFileSync(path.join(brainDir, "limen_embroidery_wrist_cuff.png"), masterCanvas.toBuffer("image/png"));

  // 2. High-Res Fabric Preview on Heather Sport Grey (900 x 900 px)
  const prevCanvas = createCanvas(900, 900);
  const pctx = prevCanvas.getContext("2d");
  pctx.fillStyle = "#E2E4E8";
  pctx.fillRect(0, 0, 900, 900);

  // Fleece heather grain
  for (let y = 0; y < 900; y += 4) {
    pctx.fillStyle = (y % 8 === 0) ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)";
    pctx.fillRect(0, y, 900, 2);
  }

  // Soft drop shadow
  pctx.save();
  pctx.shadowColor = "rgba(10, 15, 25, 0.45)";
  pctx.shadowBlur = 12;
  pctx.shadowOffsetX = 3;
  pctx.shadowOffsetY = 6;
  pctx.drawImage(coinImg, 50, 50, 800, 800);
  pctx.restore();

  // Subtle metallic thread sheen
  pctx.save();
  pctx.shadowColor = "rgba(255, 248, 220, 0.35)";
  pctx.shadowBlur = 3;
  pctx.shadowOffsetX = -1;
  pctx.shadowOffsetY = -1;
  pctx.drawImage(coinImg, 50, 50, 800, 800);
  pctx.restore();

  pctx.drawImage(coinImg, 50, 50, 800, 800);

  const prevPath = path.join(outputDir, "limen_wrist_roman_aureus_preview.png");
  fs.writeFileSync(prevPath, prevCanvas.toBuffer("image/png"));
  fs.writeFileSync(path.join(brainDir, "limen_wrist_roman_aureus_preview.png"), prevCanvas.toBuffer("image/png"));
  console.log("Saved wrist preview PNG:", prevPath);

  // 3. Close-up Sleeve Mockup: The Aureus embroidered on the sleeve above cuff ribbing
  // Load base hoodie image to sample authentic sleeve cuff
  const baseImg = await loadImage(path.join(outputDir, "mockup_hoodie_front_sportgrey.jpg"));
  const sleeveCanvas = createCanvas(900, 900);
  const sctx = sleeveCanvas.getContext("2d");

  // Crop left sleeve and cuff area from baseImg (x: 100 to 360, y: 650 to 950) and scale up
  sctx.drawImage(baseImg, 100, 640, 260, 260, 0, 0, 900, 900);

  // Position the 4.5 cm Aureus Coin neatly on the sleeve forearm
  const coinW = 320;
  const coinH = 320;
  const coinX = 290;
  const coinY = 280;

  // Layer 1: Ambient Drop Shadow on the knit fleece
  sctx.save();
  sctx.shadowColor = "rgba(15, 18, 24, 0.65)";
  sctx.shadowBlur = 10;
  sctx.shadowOffsetX = 2;
  sctx.shadowOffsetY = 5;
  sctx.drawImage(coinImg, coinX, coinY, coinW, coinH);
  sctx.restore();

  // Layer 2: 3D stitch highlight
  sctx.save();
  sctx.shadowColor = "rgba(255, 248, 220, 0.4)";
  sctx.shadowBlur = 2.5;
  sctx.shadowOffsetX = -1;
  sctx.shadowOffsetY = -1;
  sctx.drawImage(coinImg, coinX, coinY, coinW, coinH);
  sctx.restore();

  // Layer 3: Main crisp stitch layer
  sctx.drawImage(coinImg, coinX, coinY, coinW, coinH);

  const sleeveMockupPath = path.join(outputDir, "mockup_wrist_aureus_cuff.jpg");
  fs.writeFileSync(sleeveMockupPath, sleeveCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  fs.writeFileSync(path.join(brainDir, "mockup_wrist_aureus_cuff.jpg"), sleeveCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  console.log("Saved Sleeve Macro Mockup:", sleeveMockupPath);
}

renderAureusWrist().catch(err => {
  console.error("Error rendering Aureus wrist:", err);
  process.exit(1);
});
