import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/fb175fd8-73ed-48f5-a362-a72330aad517");
const merchDir = path.resolve("artifacts/trader-dashboard/public/images/merch");
const designDir = path.resolve("design-mockups/limen-uniform-printful");

async function generatePantMockups() {
  console.log("Generating Limen Heavyweight Relaxed Pant Mockups...");

  const baseImg = await loadImage(path.join(brainDir, "sport_grey_straight_leg_sweatpants_flatlay_1792461796165.jpg"));
  const ordoImg = await loadImage(path.join(designDir, "limen_pant_ordo_geometrico_300dpi.png"));

  const W = baseImg.width;
  const H = baseImg.height;

  // 1. Sport Grey Mockup
  const greyCanvas = createCanvas(W, H);
  const gctx = greyCanvas.getContext("2d");
  gctx.drawImage(baseImg, 0, 0);

  // Posizione: fianco sinistro (lungo la linea della tasca / coscia superiore)
  // Per 896x1200: x: 310, y: 340, w: 80, h: 215
  const embW = 82;
  const embH = 220;
  const embX = 312;
  const embY = 335;

  // Ombra 3D filo satinato
  gctx.save();
  gctx.shadowColor = "rgba(10, 15, 25, 0.65)";
  gctx.shadowBlur = 6;
  gctx.shadowOffsetX = 1.5;
  gctx.shadowOffsetY = 3.5;
  gctx.drawImage(ordoImg, embX, embY, embW, embH);
  gctx.restore();

  // Riflesso dorato metallizzato Madeira
  gctx.save();
  gctx.shadowColor = "rgba(255, 245, 200, 0.45)";
  gctx.shadowBlur = 2.5;
  gctx.shadowOffsetX = -0.8;
  gctx.shadowOffsetY = -0.8;
  gctx.drawImage(ordoImg, embX, embY, embW, embH);
  gctx.restore();

  // Livello ricamo
  gctx.drawImage(ordoImg, embX, embY, embW, embH);

  const greyBuf = greyCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(merchDir, "pant-front-sportgrey.jpg"), greyBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_pant_front_sportgrey.jpg"), greyBuf);
  console.log("✓ Saved Sport Grey Pant Mockup");

  // 2. Obsidian Black Mockup
  const blackCanvas = createCanvas(W, H);
  const bctx = blackCanvas.getContext("2d");
  bctx.drawImage(baseImg, 0, 0);

  const imgData = bctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Se è tessuto felpato (grigio neutro > 95)
    const isFleece = (r > 90 && g > 90 && b > 90 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22);

    if (isFleece) {
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const blackLum = Math.round(18 + (lum - 90) * 0.32);
      data[i] = Math.max(16, Math.min(blackLum, 65));
      data[i + 1] = Math.max(16, Math.min(blackLum + 1, 68));
      data[i + 2] = Math.max(20, Math.min(blackLum + 4, 75));
    }
  }
  bctx.putImageData(imgData, 0, 0);

  // Overlay ricamo dorato brillante su nero ossidiana
  bctx.save();
  bctx.shadowColor = "rgba(197, 160, 89, 0.45)";
  bctx.shadowBlur = 8;
  bctx.shadowOffsetY = 3;
  bctx.drawImage(ordoImg, embX, embY, embW, embH);
  bctx.restore();

  bctx.save();
  bctx.shadowColor = "rgba(255, 245, 200, 0.5)";
  bctx.shadowBlur = 3;
  bctx.drawImage(ordoImg, embX, embY, embW, embH);
  bctx.restore();

  bctx.drawImage(ordoImg, embX, embY, embW, embH);

  const blackBuf = blackCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(merchDir, "pant-front-black.jpg"), blackBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_pant_front_black.jpg"), blackBuf);
  console.log("✓ Saved Obsidian Black Pant Mockup");

  // 3. Dark Heather Mockup (Grafite d'Ordine)
  const heatherCanvas = createCanvas(W, H);
  const hctx = heatherCanvas.getContext("2d");
  hctx.drawImage(baseImg, 0, 0);

  const hImgData = hctx.getImageData(0, 0, W, H);
  const hdata = hImgData.data;

  for (let i = 0; i < hdata.length; i += 4) {
    const r = hdata[i];
    const g = hdata[i + 1];
    const b = hdata[i + 2];
    const isFleece = (r > 90 && g > 90 && b > 90 && Math.abs(r - g) < 22 && Math.abs(g - b) < 22);

    if (isFleece) {
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const darkLum = Math.round(42 + (lum - 90) * 0.44);
      hdata[i] = Math.max(30, Math.min(darkLum - 2, 95));
      hdata[i + 1] = Math.max(30, Math.min(darkLum - 1, 98));
      hdata[i + 2] = Math.max(34, Math.min(darkLum + 3, 105));
    }
  }
  hctx.putImageData(hImgData, 0, 0);

  hctx.save();
  hctx.shadowColor = "rgba(197, 160, 89, 0.4)";
  hctx.shadowBlur = 8;
  hctx.shadowOffsetY = 3;
  hctx.drawImage(ordoImg, embX, embY, embW, embH);
  hctx.restore();
  hctx.drawImage(ordoImg, embX, embY, embW, embH);

  const heatherBuf = heatherCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(merchDir, "pant-front-darkheather.jpg"), heatherBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_pant_front_darkheather.jpg"), heatherBuf);
  console.log("✓ Saved Dark Heather Pant Mockup");

  // 4. Macro Dettaglio Ricamo (Close-Up Texture & Gold Thread)
  const macroCanvas = createCanvas(1024, 1024);
  const mctx = macroCanvas.getContext("2d");

  // Sfondo felpa melange zoom
  mctx.fillStyle = "#D6D8DC";
  mctx.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 3) {
    mctx.fillStyle = (y % 6 === 0) ? "rgba(255, 255, 255, 0.18)" : "rgba(35, 38, 45, 0.08)";
    mctx.fillRect(0, y, 1024, 1.8);
  }

  // Luce radente diagonale da studio
  const grad = mctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, "rgba(255,255,255,0.25)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, 1024, 1024);

  // Ingrandimento Cardo & Decumanus al centro
  const macroW = 320;
  const macroH = 850;
  const macroX = (1024 - macroW) / 2;
  const macroY = (1024 - macroH) / 2;

  mctx.save();
  mctx.shadowColor = "rgba(10, 15, 25, 0.6)";
  mctx.shadowBlur = 14;
  mctx.shadowOffsetX = 3;
  mctx.shadowOffsetY = 6;
  mctx.drawImage(ordoImg, macroX, macroY, macroW, macroH);
  mctx.restore();

  mctx.save();
  mctx.shadowColor = "rgba(255, 245, 200, 0.45)";
  mctx.shadowBlur = 4;
  mctx.shadowOffsetX = -1;
  mctx.shadowOffsetY = -1;
  mctx.drawImage(ordoImg, macroX, macroY, macroW, macroH);
  mctx.restore();

  mctx.drawImage(ordoImg, macroX, macroY, macroW, macroH);

  const macroBuf = macroCanvas.toBuffer("image/jpeg", { quality: 0.98 });
  fs.writeFileSync(path.join(merchDir, "pant-macro-ordo.jpg"), macroBuf);
  fs.writeFileSync(path.join(brainDir, "mockup_pant_macro_ordo.jpg"), macroBuf);
  console.log("✓ Saved Macro Ordo Geometrico Detail Mockup");
}

generatePantMockups().catch(err => {
  console.error("Error in generatePantMockups:", err);
  process.exit(1);
});
