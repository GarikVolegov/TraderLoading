import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const brainDir = "/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883";
const publicMerchDir = path.resolve("artifacts/trader-dashboard/public/images/merch");
const designMockupDir = path.resolve("design-mockups/limen-uniform-printful");

async function main() {
  console.log("Loading source assets...");
  const blankGreyPath = path.join(brainDir, "blank_hoodie_front_grey_studio_1792532634199.jpg");
  const blankBlackPath = path.join(brainDir, "blank_hoodie_front_black_studio_1792532655583.jpg");
  const sigImgPath = path.join(publicMerchDir, "limen_signature_gold_300dpi.png");
  const aureusImgPath = path.join(publicMerchDir, "limen_wrist_roman_aureus_300dpi.png");

  const [blankGrey, blankBlack, sigImg, aureusImg] = await Promise.all([
    loadImage(blankGreyPath),
    loadImage(blankBlackPath),
    loadImage(sigImgPath),
    loadImage(aureusImgPath),
  ]);

  console.log("Assets loaded. Compositing Sport Grey Front Mockup...");

  // Coordinates on Sport Grey studio flat lay:
  // Signature: 180w x 90h, x=595, y=390
  // Aureus coin on left wrist: 62w x 62h, x=740, y=755
  function compositeArtwork(ctx, sigX, sigY, sigW, sigH, aurX, aurY, aurW, aurH, isBlack = false) {
    // 1. Drop shadow for embroidery stitch relief
    ctx.save();
    ctx.shadowColor = isBlack ? "rgba(0, 0, 0, 0.9)" : "rgba(15, 20, 30, 0.55)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
    ctx.drawImage(aureusImg, aurX, aurY, aurW, aurH);
    ctx.restore();

    // 2. Specular golden sheen (simulates Madeira metallic embroidery thread under studio keylight)
    ctx.save();
    ctx.shadowColor = "rgba(255, 240, 180, 0.45)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = -1;
    ctx.shadowOffsetY = -1;
    ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
    ctx.drawImage(aureusImg, aurX, aurY, aurW, aurH);
    ctx.restore();

    // 3. Crisp embroidery layer
    ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
    ctx.drawImage(aureusImg, aurX, aurY, aurW, aurH);
  }

  // --- 1. SPORT GREY ---
  const greyCanvas = createCanvas(1024, 1024);
  const gctx = greyCanvas.getContext("2d");
  gctx.drawImage(blankGrey, 0, 0);
  compositeArtwork(gctx, 595, 390, 180, 90, 740, 755, 62, 62, false);

  const greyBuffer = greyCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(publicMerchDir, "hoodie-front-sportgrey.jpg"), greyBuffer);
  fs.writeFileSync(path.join(designMockupDir, "mockup_hoodie_front_signature_sportgrey.jpg"), greyBuffer);
  console.log("-> Saved hoodie-front-sportgrey.jpg (100% blemish-free studio blank + golden embroidery)");

  // --- 2. OBSIDIAN BLACK ---
  const blackCanvas = createCanvas(1024, 1024);
  const bctx = blackCanvas.getContext("2d");
  bctx.drawImage(blankBlack, 0, 0);
  // On black blank: x=590, y=410, wrist: x=730, y=760
  compositeArtwork(bctx, 590, 410, 180, 90, 730, 760, 62, 62, true);

  const blackBuffer = blackCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(publicMerchDir, "hoodie-front-black.jpg"), blackBuffer);
  fs.writeFileSync(path.join(designMockupDir, "mockup_hoodie_front_signature_black.jpg"), blackBuffer);
  console.log("-> Saved hoodie-front-black.jpg (100% pure obsidian studio blank + golden embroidery)");

  // --- 3. DARK HEATHER (CHARCOAL) ---
  // Create Dark Heather by toning the grey blank into deep graphite slate before compositing
  const heatherCanvas = createCanvas(1024, 1024);
  const hctx = heatherCanvas.getContext("2d");
  hctx.drawImage(blankGrey, 0, 0);

  const imgData = hctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Is it fleece (mid-to-high luminance with low color delta)?
    const isFleece = (r > 70 && g > 70 && b > 70 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);
    if (isFleece) {
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      // Remap to charcoal (40 to 90)
      const charcoalLum = Math.round(38 + (lum - 70) * 0.38);
      data[i] = Math.max(28, Math.min(charcoalLum, 95));
      data[i + 1] = Math.max(28, Math.min(charcoalLum + 1, 98));
      data[i + 2] = Math.max(32, Math.min(charcoalLum + 4, 105));
    }
  }
  hctx.putImageData(imgData, 0, 0);

  compositeArtwork(hctx, 595, 390, 180, 90, 740, 755, 62, 62, true);
  const heatherBuffer = heatherCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(publicMerchDir, "hoodie-front-darkheather.jpg"), heatherBuffer);
  fs.writeFileSync(path.join(designMockupDir, "mockup_hoodie_front_signature_darkheather.jpg"), heatherBuffer);
  console.log("-> Saved hoodie-front-darkheather.jpg");

  console.log("All front mockups successfully regenerated with pristine studio quality!");
}

main().catch((err) => {
  console.error("Error compositing merch:", err);
  process.exit(1);
});
