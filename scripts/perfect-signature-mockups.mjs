import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const outputDir = path.resolve("design-mockups/limen-uniform-printful");
const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/fb175fd8-73ed-48f5-a362-a72330aad517");
const merchPublicDir = path.resolve("artifacts/trader-dashboard/public/images/merch");

async function perfectMockups() {
  console.log("Refining front signature mockups and colorways...");

  const baseImg = await loadImage(path.join(outputDir, "mockup_hoodie_front_sportgrey.jpg"));
  const sigImg = await loadImage(path.join(outputDir, "limen_signature_gold_300dpi.png"));
  const aureusImg = await loadImage(path.join(outputDir, "limen_wrist_roman_aureus_300dpi.png"));

  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImg, 0, 0);

  // 1. Seamless inpaint of center chest:
  // Use horizontal scanline cloning with feathered overlap to erase the old central graphic without leaving any vertical seam
  const chestLeft = 320;
  const chestTop = 270;
  const chestW = 384;
  const chestH = 340;

  // We sample 40px horizontal bands from the completely clean flanks
  for (let y = 0; y < chestH; y += 20) {
    // Left flank sample
    ctx.drawImage(baseImg, 180, chestTop + y, 192, 25, chestLeft, chestTop + y, 192, 25);
    // Right flank sample
    ctx.drawImage(baseImg, 710, chestTop + y, 192, 25, chestLeft + 192, chestTop + y, 192, 25);
  }

  // Soft horizontal blur across center vertical seam
  ctx.save();
  ctx.filter = "blur(8px)";
  ctx.fillStyle = "rgba(182, 185, 192, 0.4)";
  ctx.fillRect(chestLeft + 140, chestTop, 100, chestH);
  ctx.restore();

  // Overlay fine heather fleece noise to restore micro-fiber weave
  ctx.save();
  for (let y = chestTop; y < chestTop + chestH; y += 3) {
    ctx.fillStyle = (y % 6 === 0) ? "rgba(255, 255, 255, 0.12)" : "rgba(30, 30, 35, 0.05)";
    ctx.fillRect(chestLeft, y, chestW, 1.5);
  }
  ctx.restore();

  // 2. Composite Left Chest Signature
  const sigW = 195;
  const sigH = 98;
  const sigX = 590; // Left chest of wearer
  const sigY = 385;

  // 3D embroidery shadow
  ctx.save();
  ctx.shadowColor = "rgba(10, 15, 25, 0.55)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
  ctx.restore();

  // Specular golden sheen
  ctx.save();
  ctx.shadowColor = "rgba(255, 245, 200, 0.45)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = -1;
  ctx.shadowOffsetY = -1;
  ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
  ctx.restore();

  // Main stitch layer
  ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);

  // 3. Composite Aureus Coin on left wrist
  const aurSize = 64;
  const aurX = 726;
  const aurY = 786;
  ctx.save();
  ctx.shadowColor = "rgba(10, 15, 25, 0.55)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.drawImage(aureusImg, aurX, aurY, aurSize, aurSize);
  ctx.restore();
  ctx.drawImage(aureusImg, aurX, aurY, aurSize, aurSize);

  // Save pristine Sport Grey Front Mockup
  const sportGreyBuf = canvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(outputDir, "mockup_hoodie_front_signature_sportgrey.jpg"), sportGreyBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_front_signature_sportgrey.jpg"), sportGreyBuf);
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-front-sportgrey.jpg"), sportGreyBuf);
  console.log("Saved pristine Sport Grey Mockup");

  // 4. Generate Luxury Obsidian Black Hoodie Mockup
  // Pixel-by-pixel luminance remapping for fleece fabric (tones down heather grey into deep rich matte black)
  const blackCanvas = createCanvas(1024, 1024);
  const bctx = blackCanvas.getContext("2d");
  bctx.drawImage(canvas, 0, 0);

  const imgData = bctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;

  // Remap hoodie pixels (the hoodie is light/mid grey r:140-220, g:140-220, b:140-220; the slate background is dark slate r:40-90, g:40-90, b:40-90; the gold signature is r:180-220, g:150-180, b:70-110)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Is it golden embroidery? (high red/green, low blue: r > 150, g > 120, b < 130 and r > b + 40)
    const isGold = (r > 140 && g > 110 && b < 130 && r > b + 30);
    // Is it hoodie fleece? (neutral light grey: r > 110 && g > 110 && b > 110 && Math.abs(r-g) < 25 && Math.abs(g-b) < 25)
    const isFleece = (r > 105 && g > 105 && b > 105 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);

    if (!isGold && isFleece) {
      // Map grey luminance to deep obsidian black (25 to 55) preserving relative fold contrast
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      const blackLum = Math.round(18 + (lum - 105) * 0.32);
      data[i] = Math.max(16, Math.min(blackLum, 65));
      data[i + 1] = Math.max(16, Math.min(blackLum + 1, 68));
      data[i + 2] = Math.max(20, Math.min(blackLum + 4, 75));
    }
  }
  bctx.putImageData(imgData, 0, 0);

  // Overlay vivid golden embroidery pass on black for luxury tactile pop
  bctx.save();
  bctx.shadowColor = "rgba(197, 160, 89, 0.45)";
  bctx.shadowBlur = 8;
  bctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
  bctx.drawImage(aureusImg, aurX, aurY, aurSize, aurSize);
  bctx.restore();
  bctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
  bctx.drawImage(aureusImg, aurX, aurY, aurSize, aurSize);

  const blackBuf = blackCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(outputDir, "mockup_hoodie_front_signature_black.jpg"), blackBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_front_signature_black.jpg"), blackBuf);
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-front-black.jpg"), blackBuf);
  console.log("Saved pristine Obsidian Black Mockup");

  // 5. Generate Obsidian Black Back Mockup (Trajan Column on Black)
  const backBaseImg = await loadImage(path.join(outputDir, "mockup_hoodie_back_trajan_column.jpg"));
  const blackBackCanvas = createCanvas(1024, 1024);
  const bbctx = blackBackCanvas.getContext("2d");
  bbctx.drawImage(backBaseImg, 0, 0);

  const backImgData = bbctx.getImageData(0, 0, 1024, 1024);
  const bdata = backImgData.data;

  for (let i = 0; i < bdata.length; i += 4) {
    const r = bdata[i];
    const g = bdata[i + 1];
    const b = bdata[i + 2];
    const isGold = (r > 140 && g > 110 && b < 130 && r > b + 30);
    const isFleece = (r > 105 && g > 105 && b > 105 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);

    if (!isGold && isFleece) {
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      const blackLum = Math.round(18 + (lum - 105) * 0.32);
      bdata[i] = Math.max(16, Math.min(blackLum, 65));
      bdata[i + 1] = Math.max(16, Math.min(blackLum + 1, 68));
      bdata[i + 2] = Math.max(20, Math.min(blackLum + 4, 75));
    }
  }
  bbctx.putImageData(backImgData, 0, 0);

  const colImg = await loadImage(path.join(outputDir, "limen_back_trajan_column_300dpi.png"));
  bbctx.save();
  bbctx.shadowColor = "rgba(197, 160, 89, 0.35)";
  bbctx.shadowBlur = 10;
  bbctx.drawImage(colImg, (1024 - 310) / 2, 220, 310, 640);
  bbctx.restore();
  bbctx.drawImage(colImg, (1024 - 310) / 2, 220, 310, 640);

  const backBlackBuf = blackBackCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(outputDir, "mockup_hoodie_back_black.jpg"), backBlackBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_back_black.jpg"), backBlackBuf);
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-back-black.jpg"), backBlackBuf);
  console.log("Saved Obsidian Black Back Mockup");

  // 6. Generate Dark Heather (Charcoal) Hoodie Mockup
  const heatherCanvas = createCanvas(1024, 1024);
  const hctx = heatherCanvas.getContext("2d");
  hctx.drawImage(canvas, 0, 0);

  const heatherImgData = hctx.getImageData(0, 0, 1024, 1024);
  const hdata = heatherImgData.data;

  for (let i = 0; i < hdata.length; i += 4) {
    const r = hdata[i];
    const g = hdata[i + 1];
    const b = hdata[i + 2];
    const isGold = (r > 140 && g > 110 && b < 130 && r > b + 30);
    const isFleece = (r > 105 && g > 105 && b > 105 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);

    if (!isGold && isFleece) {
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      const darkLum = Math.round(42 + (lum - 105) * 0.45);
      hdata[i] = Math.max(30, Math.min(darkLum - 2, 95));
      hdata[i + 1] = Math.max(30, Math.min(darkLum - 1, 98));
      hdata[i + 2] = Math.max(34, Math.min(darkLum + 3, 105));
    }
  }
  hctx.putImageData(heatherImgData, 0, 0);

  hctx.save();
  hctx.shadowColor = "rgba(197, 160, 89, 0.4)";
  hctx.shadowBlur = 8;
  hctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
  hctx.drawImage(aureusImg, aurX, aurY, aurSize, aurSize);
  hctx.restore();
  hctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
  hctx.drawImage(aureusImg, aurX, aurY, aurSize, aurSize);

  const heatherBuf = heatherCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(outputDir, "mockup_hoodie_front_signature_darkheather.jpg"), heatherBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_hoodie_front_signature_darkheather.jpg"), heatherBuf);
  fs.writeFileSync(path.join(merchPublicDir, "hoodie-front-darkheather.jpg"), heatherBuf);
  console.log("Saved Dark Heather Front Mockup");
}

perfectMockups().catch(err => {
  console.error("Error in perfectMockups:", err);
  process.exit(1);
});
