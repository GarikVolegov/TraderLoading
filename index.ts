import dotenv from "dotenv";
import { config, higgsfield } from "@higgsfield/client/v2";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

dotenv.config({ path: ".env.local" });

const credentials = process.env.HF_CREDENTIALS || process.env.HF_KEY;

if (!credentials || !credentials.trim()) {
  console.error("Error: HF_CREDENTIALS is not set in .env.local.");
  process.exit(1);
}

config({
  credentials: credentials.trim(),
});

/**
 * 4 Scene con Movimento Organico e Verbi di Azione Fisica
 * (Per eliminare l'effetto "foto con zoom" 2.5D e forzare la simulazione dinamica 3D in Kling 3.0 4K)
 */
export const SCENES_V2 = {
  scene1: {
    id: 1,
    name: "Scena 1: Il Volto e il Risveglio Fisico (00:00 - 00:03)",
    outputFilename: "limen-v2-act1.mp4",
    prompt:
      "Cinematic dynamic shot of a young man blinking and slowly opening his intense, focused eyes. His chest rises and falls with calm, deep breathing. Cold blue reflections shift across his skin as warm sunlight sweeps horizontally across his face. Natural organic facial micro-movements, realistic skin texture, 24fps film motion.",
  },
  scene2: {
    id: 2,
    name: "Scena 2: La Camminata verso il Portale (00:03 - 00:07)",
    outputFilename: "limen-v2-act2.mp4",
    prompt:
      "Full-body tracking shot following directly behind a cloaked figure walking forward with heavy, confident strides. The fabric of his dark cloak billows and ripples realistically in a strong atmospheric draft. In front of him, a colossal vertical stone portal emits shimmering, pulsing volumetric god rays. Wet ground reflecting moving water ripples under his steps.",
  },
  scene3: {
    id: 3,
    name: "Scena 3: Il Flusso dell'Acqua e i Grafici Vivi (00:07 - 00:11)",
    outputFilename: "limen-v2-act3.mp4",
    prompt:
      "Cinematic slow-motion shot of dark water continuously rippling and flowing across a shallow indoor pool. In the center, a towering monolithic black glass terminal. On the glass display, golden financial candlesticks and structural geometric vectors physically draw and animate upward in real-time, pulsing with energy. Floating ambient dust drifting through sharp sunlight beams.",
  },
  scene4: {
    id: 4,
    name: "Scena 4: Il Metallo Fuso / Luce che Scolpisce il Sigillo (00:11 - 00:15)",
    outputFilename: "limen-v2-act4.mp4",
    prompt:
      "Macro dynamic animation of a minimalist geometric gold portal emblem emerging from textured obsidian stone. Liquid gold energy flows through carved geometric channels to form the emblem. A brilliant ray of light tracks dynamically across the polished edges, generating shifting specular flares and moving deep shadows.",
  },
};

export async function generateKlingV2(sceneKey: keyof typeof SCENES_V2, duration = 5) {
  const scene = SCENES_V2[sceneKey];
  if (!scene) {
    console.error(`Scena sconosciuta: ${sceneKey}`);
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log(`[KLING 3.0 4K TEXT-TO-VIDEO] Generazione Movimento Organico`);
  console.log(`Scena: ${scene.name}`);
  console.log(`Destinazione: ${scene.outputFilename}`);
  console.log(`Prompt: "${scene.prompt}"`);
  console.log(`Parametri: 4K UHD, 16:9, Duration: ${duration}s, Sound: ON, CFG: 0.5`);
  console.log("=======================================================\n");

  try {
    const result = await higgsfield.subscribe(
      "kling-video/v3.0/4k/text-to-video",
      {
        input: {
          prompt: scene.prompt,
          duration: duration,
          sound: "on",
          cfg_scale: 0.5,
          multi_shots: false,
          aspect_ratio: "16:9",
        },
        withPolling: true,
      }
    );

    console.log(`Stato generazione: ${result.status}`);

    if (result.status === "completed") {
      const videoUrl =
        result.video?.url ||
        (result as any).videos?.[0]?.url ||
        (result as any).output?.url ||
        (result as any).url;

      console.log(`\n🎉 VIDEO COMPLETATO CON SUCCESSO!\nURL: ${videoUrl}\n`);

      if (videoUrl) {
        const saveDir = path.resolve("artifacts/trader-dashboard/public/videos");
        if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
        }
        const destPath = path.join(saveDir, scene.outputFilename);
        console.log(`Download e salvataggio locale in: ${destPath}...`);

        const protocol = videoUrl.startsWith("https") ? https : http;
        const fileStream = fs.createWriteStream(destPath);

        await new Promise((resolve, reject) => {
          protocol.get(videoUrl, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                const redirectProto = redirectUrl.startsWith("https") ? https : http;
                redirectProto.get(redirectUrl, (res2) => {
                  res2.pipe(fileStream);
                  fileStream.on("finish", () => {
                    fileStream.close();
                    console.log(`✅ File ${scene.outputFilename} salvato localmente!`);
                    resolve(true);
                  });
                }).on("error", reject);
                return;
              }
            }
            response.pipe(fileStream);
            fileStream.on("finish", () => {
              fileStream.close();
              console.log(`✅ File ${scene.outputFilename} salvato localmente!`);
              resolve(true);
            });
          }).on("error", reject);
        });

        // Copia anche su Desktop per ispezione immediata
        try {
          const desktopCopy = path.join("/Users/gazz/Desktop", scene.outputFilename);
          fs.copyFileSync(destPath, desktopCopy);
          console.log(`✅ Copia speculare creata su Scrivania: ${desktopCopy}`);
        } catch (e: any) {
          console.warn("Impossibile copiare su Desktop:", e.message);
        }
      }

      return videoUrl;
    } else if (result.status === "failed") {
      console.error("❌ Generazione fallita:", (result as any).error || result);
      process.exit(1);
    } else if (result.status === "nsfw") {
      console.error("⚠️ Richiesta bloccata dai filtri di moderazione (NSFW).");
      process.exit(1);
    } else {
      console.error(`Stato imprevisto: ${result.status}`);
      process.exit(1);
    }
  } catch (error: any) {
    if (error?.message?.includes("credits") || error?.status === 403) {
      console.error("\n❌ ERRORE: Crediti insufficienti sull'account Higgsfield.");
    } else {
      console.error("Errore durante la generazione:", error?.message || error);
    }
    process.exit(1);
  }
}

// Argomento da riga di comando per eseguire una specifica scena (es. 1, 2, 3, 4 o all)
const targetArg = process.argv[2] || "1";

if (targetArg === "all") {
  (async () => {
    for (const key of Object.keys(SCENES_V2) as (keyof typeof SCENES_V2)[]) {
      await generateKlingV2(key, 5);
    }
    console.log("\n🚀 Tutte e 4 le scene sono state generate con successo!");
  })();
} else {
  const keyMap: Record<string, keyof typeof SCENES_V2> = {
    "1": "scene1",
    "2": "scene2",
    "3": "scene3",
    "4": "scene4",
    scene1: "scene1",
    scene2: "scene2",
    scene3: "scene3",
    scene4: "scene4",
  };
  const selectedKey = keyMap[targetArg] || "scene1";
  generateKlingV2(selectedKey, 5);
}
