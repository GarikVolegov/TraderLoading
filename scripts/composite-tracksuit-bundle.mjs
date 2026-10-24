import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const canvasModule = req(path.resolve("artifacts/api-server/node_modules/@napi-rs/canvas"));
const { createCanvas, loadImage } = canvasModule;

const merchDir = path.resolve("artifacts/trader-dashboard/public/images/merch");
const brainDir = path.resolve("/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883");

async function createTracksuitComposites() {
  console.log("Generating L'Uniforme Completa (Hoodie + Pant Bundle) Studio Composites...");

  const colorways = [
    {
      id: "sportgrey",
      hoodie: path.join(merchDir, "hoodie-front-sportgrey.jpg"),
      pant: path.join(merchDir, "pant-front-sportgrey.jpg"),
      out: "uniforme-completa-sportgrey.jpg",
      tag: "L'UNIFORME COMPLETA · SPORT GREY TITANIO",
    },
    {
      id: "black",
      hoodie: path.join(merchDir, "hoodie-front-black.jpg"),
      pant: path.join(merchDir, "pant-front-black.jpg"),
      out: "uniforme-completa-black.jpg",
      tag: "L'UNIFORME COMPLETA · OBSIDIAN BLACK",
    },
    {
      id: "darkheather",
      hoodie: path.join(merchDir, "hoodie-front-darkheather.jpg"),
      pant: path.join(merchDir, "pant-front-darkheather.jpg"),
      out: "uniforme-completa-darkheather.jpg",
      tag: "L'UNIFORME COMPLETA · DARK HEATHER GRAFITE",
    },
  ];

  for (const c of colorways) {
    if (!fs.existsSync(c.hoodie) || !fs.existsSync(c.pant)) {
      console.warn(`Skipping ${c.id}, missing source files.`);
      continue;
    }

    const hoodieImg = await loadImage(c.hoodie);
    const pantImg = await loadImage(c.pant);

    // Canvas da studio lussuoso 1600x1200 (proporzione 4:3 paesaggio)
    // Layout side-by-side: Sinistra Felpa d'Ordine, Destra Pantalone Sartoriale
    const W = 1600;
    const H = 1200;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Sfondo pietra basalto scura / obsidian
    ctx.fillStyle = "#0A0A0C";
    ctx.fillRect(0, 0, W, H);

    // Gradiente radiale di luce da studio al centro
    const radial = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 900);
    radial.addColorStop(0, "rgba(25, 27, 33, 0.95)");
    radial.addColorStop(0.65, "rgba(14, 15, 18, 0.98)");
    radial.addColorStop(1, "rgba(8, 8, 10, 1.0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, W, H);

    // Micro-texture di ardesia / pietra
    for (let y = 0; y < H; y += 4) {
      if (y % 8 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
        ctx.fillRect(0, y, W, 2);
      }
    }

    // Posizionamento Hoodie (Sinistra)
    // Hoodie originale è 1024x1024. Ridimensioniamo a ~740x740 centrato verticalmente
    const hW = 760;
    const hH = 760;
    const hX = 50;
    const hY = (H - hH) / 2 + 30;

    // Ombra morbida della hoodie sulla pietra
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 20;
    ctx.drawImage(hoodieImg, hX, hY, hW, hH);
    ctx.restore();
    ctx.drawImage(hoodieImg, hX, hY, hW, hH);

    // Posizionamento Pantalone (Destra)
    // Pantalone originale è 1200x1600. Ridimensioniamo a ~760x1013
    const pW = 750;
    const pH = 1000;
    const pX = 810;
    const pY = (H - pH) / 2 + 35;

    // Ombra del pantalone sulla pietra
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 20;
    ctx.drawImage(pantImg, pX, pY, pW, pH);
    ctx.restore();
    ctx.drawImage(pantImg, pX, pY, pW, pH);

    // Badge d'Ordine Superiore
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 12, 0.88)";
    ctx.strokeStyle = "rgba(197, 160, 89, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(40, 36, 420, 36, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#C5A059";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText(c.tag, 55, 59);
    ctx.restore();

    // Badge d'Ordine Inferiore: "SET COMPLETO FELPA & PANTALONE · VENDUTI ASSIEME"
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 12, 0.88)";
    ctx.strokeStyle = "rgba(197, 160, 89, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(W - 480, H - 70, 440, 36, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#F4F4F6";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText("SET COMPLETO D'ORDINE · HOODIE & PANTS BUNDLE", W - 465, H - 47);
    ctx.restore();

    const buf = canvas.toBuffer("image/jpeg", { quality: 0.96 });
    const outMerch = path.join(merchDir, c.out);
    fs.writeFileSync(outMerch, buf);
    fs.writeFileSync(path.join(brainDir, c.out), buf);
    console.log(`✓ Created ${c.out} (${buf.length} bytes)`);
  }

  console.log("=== ALL TRACKSUIT COMPOSITES GENERATED SUCCESSFULLY ===");
}

createTracksuitComposites().catch((err) => {
  console.error("Error in createTracksuitComposites:", err);
  process.exit(1);
});
