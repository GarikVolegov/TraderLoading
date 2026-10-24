import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const outputDir = path.resolve("design-mockups/limen-uniform-printful");
const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/fb175fd8-73ed-48f5-a362-a72330aad517");

async function main() {
  console.log("Generating classical temple master assets and composite mockup...");

  // 1. Render SVG to 300 DPI Master PNG (2400 x 2400 px, 8" x 8" equivalent)
  const svgPath = path.join(outputDir, "limen_classical_temple_crest.svg");
  const svgBuffer = fs.readFileSync(svgPath);
  const templeImg = await loadImage(svgBuffer);

  const masterSize = 2400;
  const masterCanvas = createCanvas(masterSize, masterSize);
  const masterCtx = masterCanvas.getContext("2d");

  masterCtx.clearRect(0, 0, masterSize, masterSize);
  masterCtx.drawImage(templeImg, 0, 0, masterSize, masterSize);

  const masterBuffer = masterCanvas.toBuffer("image/png");
  const masterPngPath = path.join(outputDir, "limen_classical_temple_crest_300dpi.png");
  fs.writeFileSync(masterPngPath, masterBuffer);
  console.log("Saved master PNG:", masterPngPath);

  // Also create a Left-Chest compact edition (1200 x 1200 px)
  const chestCanvas = createCanvas(1200, 1200);
  const chestCtx = chestCanvas.getContext("2d");
  chestCtx.clearRect(0, 0, 1200, 1200);
  chestCtx.drawImage(templeImg, 0, 0, 1200, 1200);
  const chestPngPath = path.join(outputDir, "limen_classical_temple_chest_300dpi.png");
  fs.writeFileSync(chestPngPath, chestCanvas.toBuffer("image/png"));
  console.log("Saved chest PNG:", chestPngPath);

  // 2. Composite onto the real Gildan 18500 Sport Grey Hoodie Mockup
  const baseMockupPath = path.join(outputDir, "mockup_hoodie_front_sportgrey.jpg");
  const baseImg = await loadImage(fs.readFileSync(baseMockupPath));

  const mockupW = baseImg.width;
  const mockupH = baseImg.height;
  const compositeCanvas = createCanvas(mockupW, mockupH);
  const ctx = compositeCanvas.getContext("2d");

  // Draw base hoodie
  ctx.drawImage(baseImg, 0, 0, mockupW, mockupH);

  // Position and size for chest embroidery
  // On 1024x1024 hoodie, chest area is roughly x: 340-684, y: 310-590
  const crestW = 390;
  const crestH = 390;
  const crestX = (mockupW - crestW) / 2;
  const crestY = 325;

  // Mask out the previous flat graphic on the base image cleanly with clone / heather texture
  // Sample background sport grey fleece color and texture
  ctx.save();
  // Create subtle radial patch that blends with heather fleece weave
  const patchGrad = ctx.createRadialGradient(mockupW / 2, 450, 40, mockupW / 2, 450, 240);
  patchGrad.addColorStop(0, "rgba(182, 185, 192, 0.98)");
  patchGrad.addColorStop(0.7, "rgba(180, 183, 190, 0.95)");
  patchGrad.addColorStop(1, "rgba(178, 181, 188, 0)");
  ctx.fillStyle = patchGrad;
  ctx.beginPath();
  ctx.ellipse(mockupW / 2, 455, 195, 160, 0, 0, Math.PI * 2);
  ctx.fill();

  // Add subtle fleece noise/grain over patch
  ctx.restore();

  // Now draw the Classical Temple Crest with 3D embroidery effect:
  // Layer 1: Ambient Drop Shadow on fleece fabric
  ctx.save();
  ctx.shadowColor = "rgba(10, 10, 15, 0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(templeImg, crestX, crestY, crestW, crestH);
  ctx.restore();

  // Layer 2: 3D stitch relief / thread volume
  ctx.save();
  ctx.shadowColor = "rgba(255, 235, 180, 0.25)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = -1;
  ctx.shadowOffsetY = -1;
  ctx.drawImage(templeImg, crestX, crestY, crestW, crestH);
  ctx.restore();

  // Layer 3: Main crisp stitch layer
  ctx.drawImage(templeImg, crestX, crestY, crestW, crestH);

  // Save the new composite mockup
  const finalMockupBuffer = compositeCanvas.toBuffer("image/jpeg");
  const finalMockupPath = path.join(outputDir, "mockup_hoodie_classical_temple.jpg");
  fs.writeFileSync(finalMockupPath, finalMockupBuffer);

  // Copy also to brain directory for artifacts
  const brainMockupPath = path.join(brainDir, "mockup_hoodie_classical_temple.jpg");
  fs.writeFileSync(brainMockupPath, finalMockupBuffer);

  console.log("New Classical Temple Hoodie Mockup successfully generated!");
  console.log("Path:", finalMockupPath);
}

main().catch(err => {
  console.error("Error in main:", err);
  process.exit(1);
});
