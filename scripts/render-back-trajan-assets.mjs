import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const outputDir = path.resolve("design-mockups/limen-uniform-printful");
const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/fb175fd8-73ed-48f5-a362-a72330aad517");

async function renderCleanBack() {
  console.log("Rendering truly seamless Trajan Column back assets...");

  const svgPath = path.join(outputDir, "limen_back_trajan_column.svg");
  const svgBuf = fs.readFileSync(svgPath);
  const columnImg = await loadImage(svgBuf);

  // 1. Transparent 300 DPI Master PNG for Printful Upload (1500 x 3000 px)
  const masterCanvas = createCanvas(1500, 3000);
  const mctx = masterCanvas.getContext("2d");
  mctx.drawImage(columnImg, 0, 0, 1500, 3000);

  const pngPath = path.join(outputDir, "limen_back_trajan_column_300dpi.png");
  fs.writeFileSync(pngPath, masterCanvas.toBuffer("image/png"));
  fs.writeFileSync(path.join(brainDir, "limen_back_trajan_column_300dpi.png"), masterCanvas.toBuffer("image/png"));
  console.log("Saved clean 300 DPI Master PNG:", pngPath);

  // 2. High-Res Fabric Swatch Preview (900 x 1800 px)
  const prevCanvas = createCanvas(900, 1800);
  const pctx = prevCanvas.getContext("2d");
  pctx.fillStyle = "#E2E4E8";
  pctx.fillRect(0, 0, 900, 1800);

  for (let y = 0; y < 1800; y += 4) {
    pctx.fillStyle = (y % 8 === 0) ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)";
    pctx.fillRect(0, y, 900, 2);
  }

  pctx.save();
  pctx.shadowColor = "rgba(10, 15, 25, 0.5)";
  pctx.shadowBlur = 12;
  pctx.shadowOffsetX = 2;
  pctx.shadowOffsetY = 6;
  pctx.drawImage(columnImg, 50, 40, 800, 1600);
  pctx.restore();

  pctx.drawImage(columnImg, 50, 40, 800, 1600);

  const prevPath = path.join(outputDir, "limen_back_trajan_column_preview.png");
  fs.writeFileSync(prevPath, prevCanvas.toBuffer("image/png"));
  fs.writeFileSync(path.join(brainDir, "limen_back_trajan_column_preview.png"), prevCanvas.toBuffer("image/png"));
  console.log("Saved preview PNG:", prevPath);

  // 3. Mockup using the original studio base with feathered tile
  const baseImg = await loadImage(path.join(outputDir, "mockup_hoodie_front_sportgrey.jpg"));
  const mockupCanvas = createCanvas(1024, 1024);
  const bctx = mockupCanvas.getContext("2d");
  bctx.drawImage(baseImg, 0, 0);

  // Clean feathered tile over center
  const tileW = 460;
  const tileH = 430;
  const tileCanvas = createCanvas(tileW, tileH);
  const tctx = tileCanvas.getContext("2d");

  // Sample pure fleece from flanks
  tctx.drawImage(baseImg, 140, 260, tileW / 2, tileH, 0, 0, tileW / 2, tileH);
  tctx.drawImage(baseImg, 715, 260, tileW / 2, tileH, tileW / 2, 0, tileW / 2, tileH);
  tctx.drawImage(baseImg, 180, 320, 100, 100, (tileW / 2) - 50, 160, 100, 100);
  tctx.drawImage(baseImg, 180, 420, 100, 100, (tileW / 2) - 50, 240, 100, 100);

  // Feathered alpha mask
  const maskCanvas = createCanvas(tileW, tileH);
  const mctx2 = maskCanvas.getContext("2d");
  const gradX = mctx2.createLinearGradient(0, 0, tileW, 0);
  gradX.addColorStop(0, "rgba(0,0,0,0)");
  gradX.addColorStop(0.12, "rgba(0,0,0,1)");
  gradX.addColorStop(0.88, "rgba(0,0,0,1)");
  gradX.addColorStop(1, "rgba(0,0,0,0)");
  mctx2.fillStyle = gradX;
  mctx2.fillRect(0, 0, tileW, tileH);

  mctx2.globalCompositeOperation = "destination-in";
  const gradY = mctx2.createLinearGradient(0, 0, 0, tileH);
  gradY.addColorStop(0, "rgba(0,0,0,0)");
  gradY.addColorStop(0.12, "rgba(0,0,0,1)");
  gradY.addColorStop(0.92, "rgba(0,0,0,1)");
  gradY.addColorStop(1, "rgba(0,0,0,0)");
  mctx2.fillStyle = gradY;
  mctx2.fillRect(0, 0, tileW, tileH);

  tctx.globalCompositeOperation = "destination-in";
  tctx.drawImage(maskCanvas, 0, 0);

  // Stamp feathered clean tile
  bctx.drawImage(tileCanvas, 282, 215);

  // Erase the cords at the top neck with a small feathered patch
  const cordTile = createCanvas(180, 90);
  const cctx = cordTile.getContext("2d");
  cctx.drawImage(baseImg, 180, 320, 90, 90, 0, 0, 90, 90);
  cctx.drawImage(baseImg, 720, 320, 90, 90, 90, 0, 90, 90);

  bctx.save();
  bctx.globalAlpha = 0.9;
  bctx.drawImage(cordTile, 275, 185);
  bctx.drawImage(cordTile, 580, 185);
  bctx.restore();

  // Draw the Trajan Column down the back spine
  const colW = 310;
  const colH = 640;
  const colX = (1024 - colW) / 2;
  const colY = 220;

  // Layer 1: Ambient Drop Shadow on knit fleece
  bctx.save();
  bctx.shadowColor = "rgba(15, 18, 24, 0.65)";
  bctx.shadowBlur = 12;
  bctx.shadowOffsetX = 2;
  bctx.shadowOffsetY = 6;
  bctx.drawImage(columnImg, colX, colY, colW, colH);
  bctx.restore();

  // Layer 2: 3D stitch thread sheen highlight
  bctx.save();
  bctx.shadowColor = "rgba(255, 248, 220, 0.4)";
  bctx.shadowBlur = 3;
  bctx.shadowOffsetX = -1;
  bctx.shadowOffsetY = -1;
  bctx.drawImage(columnImg, colX, colY, colW, colH);
  bctx.restore();

  // Layer 3: Main crisp stitch layer
  bctx.drawImage(columnImg, colX, colY, colW, colH);

  const backMockupPath = path.join(outputDir, "mockup_hoodie_back_trajan_column.jpg");
  fs.writeFileSync(backMockupPath, mockupCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_back_trajan_column.jpg"), mockupCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  console.log("Saved pristine Back Hoodie Mockup:", backMockupPath);
}

renderCleanBack().catch(err => {
  console.error("Error in renderCleanBack:", err);
  process.exit(1);
});
