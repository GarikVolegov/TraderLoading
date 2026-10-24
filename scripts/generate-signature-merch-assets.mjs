import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage, GlobalFonts } = canvasModule;

GlobalFonts.registerFromPath("/System/Library/Fonts/Supplemental/SnellRoundhand.ttc", "Snell Roundhand");

const outputDir = path.resolve("design-mockups/limen-uniform-printful");
const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/fb175fd8-73ed-48f5-a362-a72330aad517");
const merchPublicDir = path.resolve("artifacts/trader-dashboard/public/images/merch");
fs.mkdirSync(merchPublicDir, { recursive: true });

async function generateSignatureAssets() {
  console.log("Generating Limen Golden Signature assets...");

  // 1. Generate 300 DPI Master PNG for Printful Left Chest (1200 x 600 px)
  // Target embroidery print area on Printful: 4" x 2" (10 x 5 cm)
  const masterCanvas = createCanvas(1200, 600);
  const mctx = masterCanvas.getContext("2d");

  // Pure gold embroidery color
  const gold = "#C5A059";
  mctx.font = "bold 165px 'Snell Roundhand', cursive";
  mctx.fillStyle = gold;
  mctx.textAlign = "center";
  mctx.textBaseline = "middle";

  // Signature "Limen"
  mctx.fillText("Limen", 600, 260);

  // Sartorial paraph flourish underline
  mctx.strokeStyle = gold;
  mctx.lineWidth = 7;
  mctx.lineCap = "round";
  mctx.beginPath();
  mctx.moveTo(380, 340);
  mctx.bezierCurveTo(520, 385, 680, 335, 810, 360);
  mctx.stroke();

  // Diamond keystone flourish terminal dot
  mctx.fillStyle = gold;
  mctx.beginPath();
  mctx.moveTo(825, 360);
  mctx.lineTo(836, 349);
  mctx.lineTo(847, 360);
  mctx.lineTo(836, 371);
  mctx.closePath();
  mctx.fill();

  const pngPath = path.join(outputDir, "limen_signature_gold_300dpi.png");
  fs.writeFileSync(pngPath, masterCanvas.toBuffer("image/png"));
  fs.writeFileSync(path.join(brainDir, "limen_signature_gold_300dpi.png"), masterCanvas.toBuffer("image/png"));
  console.log("Saved 300 DPI Golden Signature PNG:", pngPath);

  // 2. Generate clean SVG vector version
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600" fill="none">
  <!-- LIMEN PROTOCOL // GOLDEN CHEST SIGNATURE -->
  <!-- Target: Left Chest (4" x 2" / 10 x 5 cm) -->
  <!-- Thread: Antique Gold (#C5A059) Satin Stitch -->
  <text x="600" y="270" text-anchor="middle" font-family="'Snell Roundhand', 'Brush Script MT', cursive" font-size="165" font-weight="bold" fill="#C5A059">Limen</text>
  <path d="M 380 340 C 520 385 680 335 810 360" stroke="#C5A059" stroke-width="7" stroke-linecap="round" fill="none" />
  <polygon points="825,360 836,349 847,360 836,371" fill="#C5A059" />
</svg>`;
  fs.writeFileSync(path.join(outputDir, "limen_signature_gold.svg"), svgContent);

  // 3. Composite Left Chest Signature onto Sport Grey Hoodie Mockup
  const baseImg = await loadImage(path.join(outputDir, "mockup_hoodie_front_sportgrey.jpg"));
  const frontCanvas = createCanvas(1024, 1024);
  const fctx = frontCanvas.getContext("2d");
  fctx.drawImage(baseImg, 0, 0);

  // Clean the center chest completely with clean fleece from flanks
  const tileW = 460;
  const tileH = 430;
  const tileCanvas = createCanvas(tileW, tileH);
  const tctx = tileCanvas.getContext("2d");
  tctx.drawImage(baseImg, 140, 260, tileW / 2, tileH, 0, 0, tileW / 2, tileH);
  tctx.drawImage(baseImg, 715, 260, tileW / 2, tileH, tileW / 2, 0, tileW / 2, tileH);
  tctx.drawImage(baseImg, 180, 320, 100, 100, (tileW / 2) - 50, 160, 100, 100);
  tctx.drawImage(baseImg, 180, 420, 100, 100, (tileW / 2) - 50, 240, 100, 100);

  // Feathered mask
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
  fctx.drawImage(tileCanvas, 282, 215);

  // Position on LEFT CHEST (Petto Sinistro dell'indossatore = lato destro dello spettatore, x: ~580-680, y: ~360-440)
  // Or left side of garment (petto sinistro = x: 570-750, y: 370-460)
  const sigW = 190;
  const sigH = 95;
  const sigX = 590; // Left chest of wearer (right side of flat-lay)
  const sigY = 380;

  // 3D embroidery shadow on heather fleece
  fctx.save();
  fctx.shadowColor = "rgba(10, 15, 25, 0.55)";
  fctx.shadowBlur = 8;
  fctx.shadowOffsetX = 2;
  fctx.shadowOffsetY = 4;
  fctx.drawImage(masterCanvas, sigX, sigY, sigW, sigH);
  fctx.restore();

  // Specular golden thread sheen
  fctx.save();
  fctx.shadowColor = "rgba(255, 245, 200, 0.5)";
  fctx.shadowBlur = 3;
  fctx.shadowOffsetX = -1;
  fctx.shadowOffsetY = -1;
  fctx.drawImage(masterCanvas, sigX, sigY, sigW, sigH);
  fctx.restore();

  // Main embroidery layer
  fctx.drawImage(masterCanvas, sigX, sigY, sigW, sigH);

  // Also composite the Aureus on the left wrist cuff of the front view!
  // Left wrist of wearer (right side of flat lay): x: 740, y: 790
  const aureusImg = await loadImage(path.join(outputDir, "limen_wrist_roman_aureus_300dpi.png"));
  const aurSize = 65;
  fctx.save();
  fctx.shadowColor = "rgba(10, 15, 25, 0.55)";
  fctx.shadowBlur = 6;
  fctx.shadowOffsetX = 2;
  fctx.shadowOffsetY = 3;
  fctx.drawImage(aureusImg, 725, 785, aurSize, aurSize);
  fctx.restore();
  fctx.drawImage(aureusImg, 725, 785, aurSize, aurSize);

  const frontSportGreyMockupPath = path.join(outputDir, "mockup_hoodie_front_signature_sportgrey.jpg");
  fs.writeFileSync(frontSportGreyMockupPath, frontCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_front_signature_sportgrey.jpg"), frontCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-front-sportgrey.jpg"), frontCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  console.log("Saved Front Signature Sport Grey Mockup:", frontSportGreyMockupPath);

  // 4. Publish Back Mockup to Merch App public images
  const backMockupBuf = fs.readFileSync(path.join(outputDir, "mockup_hoodie_back_trajan_column.jpg"));
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-back-trajan.jpg"), backMockupBuf);

  // 5. Publish Wrist Mockup to Merch App public images
  const wristMockupBuf = fs.readFileSync(path.join(outputDir, "mockup_wrist_aureus_cuff.jpg"));
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-wrist-aureus.jpg"), wristMockupBuf);

  // 6. Generate Obsidian Black Hoodie Mockup (Front & Back)
  // Convert Sport Grey fabric tone to luxury matte Obsidian Black while preserving natural fleece folds & shadows
  const blackFrontCanvas = createCanvas(1024, 1024);
  const bfctx = blackFrontCanvas.getContext("2d");
  bfctx.drawImage(frontCanvas, 0, 0);

  // Color transform hoodie fabric to deep obsidian black
  // Draw obsidian shade multiply layer over hoodie body
  bfctx.save();
  bfctx.globalCompositeOperation = "multiply";
  bfctx.fillStyle = "#18181C";
  // Fill hoodie silhouette with dark tone
  bfctx.fillRect(0, 0, 1024, 1024);
  bfctx.restore();

  // Second pass for deep black matte finish
  bfctx.save();
  bfctx.globalCompositeOperation = "color-burn";
  bfctx.fillStyle = "#222226";
  bfctx.fillRect(0, 0, 1024, 1024);
  bfctx.restore();

  // Re-stamp golden signature & aureus on the black hoodie with vivid golden luminescence
  bfctx.save();
  bfctx.shadowColor = "rgba(197, 160, 89, 0.4)";
  bfctx.shadowBlur = 8;
  bfctx.drawImage(masterCanvas, sigX, sigY, sigW, sigH);
  bfctx.drawImage(aureusImg, 725, 785, aurSize, aurSize);
  bfctx.restore();
  bfctx.drawImage(masterCanvas, sigX, sigY, sigW, sigH);
  bfctx.drawImage(aureusImg, 725, 785, aurSize, aurSize);

  const frontBlackMockupPath = path.join(outputDir, "mockup_hoodie_front_signature_black.jpg");
  fs.writeFileSync(frontBlackMockupPath, blackFrontCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_front_signature_black.jpg"), blackFrontCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-front-black.jpg"), blackFrontCanvas.toBuffer("image/jpeg", { quality: 0.98 }));
  console.log("Saved Front Signature Black Mockup:", frontBlackMockupPath);
}

generateSignatureAssets().catch(err => {
  console.error("Error generating signature assets:", err);
  process.exit(1);
});
