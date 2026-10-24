import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const VIDEOS_DIR = path.resolve("artifacts/trader-dashboard/public/videos");

const ACT_FILES = [
  "limen-act1.mp4",
  "limen-act2.mp4",
  "limen-act3.mp4",
  "limen-act4.mp4",
];

export async function mergeLimenTrailer(mode: "direct" | "crossfade" = "crossfade") {
  console.log("\n=======================================================");
  console.log(`[LIMEN TRAILER ENGINE] Avvio unione video master (Modalità: ${mode.toUpperCase()})...`);
  console.log("=======================================================\n");

  if (!ffmpegPath) {
    throw new Error("FFmpeg binary non trovato in ffmpeg-static.");
  }

  // 1. Verifica la presenza di tutti e 4 i capitoli
  for (const file of ACT_FILES) {
    const fullPath = path.join(VIDEOS_DIR, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File mancante per il montaggio: ${fullPath}`);
    }
    const stats = fs.statSync(fullPath);
    console.log(`✓ Rilevato ${file} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const outputFull = path.join(VIDEOS_DIR, "limen-trailer-full.mp4");
  const outputHero = path.join(VIDEOS_DIR, "limen-scene1.mp4");
  const outputTrailer = path.join(VIDEOS_DIR, "limen-trailer.mp4");

  if (mode === "direct") {
    // Concat demuxer (lossless stream copy, nessun calo di qualità 4K)
    const listFile = path.join(VIDEOS_DIR, "concat_list.txt");
    const listContent = ACT_FILES.map((f) => `file '${f}'`).join("\n");
    fs.writeFileSync(listFile, listContent);

    console.log("\nEsecuzione concatenazione lossless ad altissima fedeltà 4K...");
    const args = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      "-movflags", "+faststart",
      outputFull,
    ];

    const proc = spawnSync(ffmpegPath, args, { stdio: "inherit" });
    if (proc.status !== 0) {
      throw new Error(`FFmpeg fallito con codice ${proc.status}`);
    }

    if (fs.existsSync(listFile)) {
      fs.unlinkSync(listFile);
    }
  } else {
    // Crossfade cinematografico fluido (0.5s dissolve tra gli atti con audio mixato)
    console.log("\nEsecuzione render master con dissolvenze incrociate (xfade 0.5s)...");

    // Filtergraph complesso per 4 stream video con xfade e audio acrossfade
    // Clip 1: [0:v], Clip 2: [1:v], Clip 3: [2:v], Clip 4: [3:v]
    // Durata approssimativa di ciascun clip Kling: 5.0 secondi
    // offset 1: 4.5s
    // offset 2: 8.5s
    // offset 3: 12.5s
    const filterComplex = [
      "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5[v01]",
      "[v01][2:v]xfade=transition=fade:duration=0.5:offset=8.5[v02]",
      "[v02][3:v]xfade=transition=fade:duration=0.5:offset=12.5[outv]",
      "[0:a][1:a]acrossfade=d=0.5[a01]",
      "[a01][2:a]acrossfade=d=0.5[a02]",
      "[a02][3:a]acrossfade=d=0.5[outa]",
    ].join(";");

    const args = [
      "-y",
      "-i", path.join(VIDEOS_DIR, ACT_FILES[0]),
      "-i", path.join(VIDEOS_DIR, ACT_FILES[1]),
      "-i", path.join(VIDEOS_DIR, ACT_FILES[2]),
      "-i", path.join(VIDEOS_DIR, ACT_FILES[3]),
      "-filter_complex", filterComplex,
      "-map", "[outv]",
      "-map", "[outa]",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "18", // Master visual quality
      "-c:a", "aac",
      "-b:a", "256k",
      "-movflags", "+faststart",
      outputFull,
    ];

    const proc = spawnSync(ffmpegPath, args, { stdio: "inherit" });
    if (proc.status !== 0) {
      console.warn("Avviso: Modalità xfade fallita o stream audio disallineati, ricado su concatenazione lossless...");
      return mergeLimenTrailer("direct");
    }
  }

  // Sincronizza anche su limen-scene1.mp4 e limen-trailer.mp4
  fs.copyFileSync(outputFull, outputHero);
  fs.copyFileSync(outputFull, outputTrailer);

  const statsFinal = fs.statSync(outputFull);
  console.log(`\n🎉 MASTER TRAILER COMPLETATO CON SUCCESSO!`);
  console.log(`File: ${outputFull}`);
  console.log(`Dimensione: ${(statsFinal.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Aggiornato ${outputHero} e ${outputTrailer}`);
  console.log("=======================================================\n");
}

mergeLimenTrailer("crossfade").catch((err) => {
  console.error("Errore durante il merge:", err);
  process.exit(1);
});
