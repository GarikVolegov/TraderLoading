import os
import subprocess

TEMP_DIR = os.path.abspath("temp_production")
os.makedirs(TEMP_DIR, exist_ok=True)
VIDEOS_DIR = os.path.abspath("artifacts/trader-dashboard/public/videos")

FFMPEG_BIN = os.path.abspath("node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg")

# 1. Scrivi il file dei sottotitoli in formato ASS con styling cinematografico in oro e bianco
ASS_CONTENT = """[Script Info]
Title: LIMEN PROTOCOL Master Cinematic Trailer
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 3840
PlayResY: 2160

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: LimenCinema,Georgia,72,&H00F4F4F6,&H0059A0C5,&H00000000,&H90000000,1,0,0,0,100,100,3,0,1,4,6,2,120,120,180,1
Style: LimenBrand,Georgia,84,&H0059A0C5,&H00F4F4F6,&H00000000,&H90000000,1,0,0,0,100,100,6,0,1,5,7,2,120,120,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.40,0:00:02.50,LimenCinema,,0,0,0,,CERCHIAMO IL CONTROLLO LÀ FUORI...
Dialogue: 0,0:00:02.60,0:00:04.90,LimenCinema,,0,0,0,,DIMENTICANDO CHI {\c&H59A0C5&}GOVERNA DENTRO{\c}.
Dialogue: 0,0:00:05.30,0:00:07.40,LimenCinema,,0,0,0,,IL MERCATO NON È UNA SCOMMESSA.
Dialogue: 0,0:00:07.50,0:00:10.50,LimenCinema,,0,0,0,,È LO SPECCHIO {\c&H59A0C5&}INFLESSIBILE{\c} DELLA TUA ANIMA.
Dialogue: 0,0:00:10.90,0:00:13.10,LimenCinema,,0,0,0,,QUANDO SPEGNI IL RUMORE...
Dialogue: 0,0:00:13.20,0:00:15.80,LimenCinema,,0,0,0,,IL CAOS SVELA LA SUA {\c&H59A0C5&}GEOMETRIA SACRA{\c}.
Dialogue: 0,0:00:16.30,0:00:18.40,LimenBrand,,0,0,0,,{\c&H59A0C5&}LIMEN PROTOCOL{\c}
Dialogue: 0,0:00:18.50,0:00:21.30,LimenCinema,,0,0,0,,OLTRE LA DERIVA. {\c&H59A0C5&}VARCA LA SOGLIA{\c}.
"""

ASS_FILE = os.path.join(TEMP_DIR, "limen_subtitles.ass")
with open(ASS_FILE, "w", encoding="utf-8") as f:
    f.write(ASS_CONTENT)

print(f"✓ Creato file sottotitoli ASS: {ASS_FILE}")

# 2. Definisci i parametri dei 4 atti
ACTS_CONFIG = [
    {
        "id": "act1",
        "video": os.path.join(VIDEOS_DIR, "limen-act1.mp4"),
        "voice": os.path.join(TEMP_DIR, "act1_voice.mp3"),
        "target_dur": 5.04,
        "speed_factor": 1.0,
    },
    {
        "id": "act2",
        "video": os.path.join(VIDEOS_DIR, "limen-act2.mp4"),
        "voice": os.path.join(TEMP_DIR, "act2_voice.mp3"),
        "target_dur": 5.75,
        "speed_factor": 5.75 / 5.04, # Rallenta leggermente per dare solennità visiva alla voce
    },
    {
        "id": "act3",
        "video": os.path.join(VIDEOS_DIR, "limen-act3.mp4"),
        "voice": os.path.join(TEMP_DIR, "act3_voice.mp3"),
        "target_dur": 5.25,
        "speed_factor": 5.25 / 5.04,
    },
    {
        "id": "act4",
        "video": os.path.join(VIDEOS_DIR, "limen-act4.mp4"),
        "voice": os.path.join(TEMP_DIR, "act4_voice.mp3"),
        "target_dur": 5.60,
        "speed_factor": 5.60 / 5.04,
    },
]

# 3. Pre-mix per ciascun atto: Video adattato a 4K con Voiceover e Audio Kling di sottofondo bilanciato
processed_clips = []
for act in ACTS_CONFIG:
    out_clip = os.path.join(TEMP_DIR, f"{act['id']}_mixed.mp4")
    print(f"\nProcessing {act['id']}: video slowed by {act['speed_factor']:.2f}x to {act['target_dur']:.2f}s...")
    
    # Filter: rallenta il video con setpts, mixa l'audio Kling a volume 0.35 con la voce narrante a volume 1.05
    filter_graph = (
        f"[0:v]setpts={act['speed_factor']}*PTS,fps=24[v];"
        f"[0:a]volume=0.35[bg];"
        f"[1:a]volume=1.05[vo];"
        f"[bg][vo]amix=inputs=2:duration=first:dropout_transition=2[a]"
    )
    
    cmd = [
        FFMPEG_BIN, "-y",
        "-i", act["video"],
        "-i", act["voice"],
        "-filter_complex", filter_graph,
        "-map", "[v]",
        "-map", "[a]",
        "-t", str(act["target_dur"]),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "17",
        "-c:a", "aac",
        "-b:a", "256k",
        out_clip
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Errore in {act['id']}:", res.stderr)
        raise RuntimeError(f"FFmpeg failed for {act['id']}")
    print(f"✓ Generato {out_clip}")
    processed_clips.append(out_clip)

# 4. Concatena i 4 clip con transizioni xfade (0.4s) e brucia i sottotitoli in 4K
final_out = os.path.join(VIDEOS_DIR, "limen-master-narrated.mp4")
print("\n--- ASSEMBLAGGIO FINALE CON TRANSIZIONI XFADE E SOTTOTITOLI 4K ---")

# Timestamps dei clip concatenati con xfade:
# clip 0: 5.04s
# clip 1: 5.75s, offset = 5.04 - 0.4 = 4.64s
# clip 2: 5.25s, offset = 4.64 + 5.75 - 0.4 = 9.99s
# clip 3: 5.60s, offset = 9.99 + 5.25 - 0.4 = 14.84s
# Total duration = 14.84 + 5.60 = 20.44s
filter_concat = (
    "[0:v][1:v]xfade=transition=fade:duration=0.4:offset=4.64[v01];"
    "[v01][2:v]xfade=transition=fade:duration=0.4:offset=9.99[v02];"
    "[v02][3:v]xfade=transition=fade:duration=0.4:offset=14.84[vbase];"
    f"[vbase]ass={ASS_FILE}[vout];"
    "[0:a][1:a]acrossfade=d=0.4[a01];"
    "[a01][2:a]acrossfade=d=0.4[a02];"
    "[a02][3:a]acrossfade=d=0.4[aout]"
)

cmd_final = [
    FFMPEG_BIN, "-y",
    "-i", processed_clips[0],
    "-i", processed_clips[1],
    "-i", processed_clips[2],
    "-i", processed_clips[3],
    "-filter_complex", filter_concat,
    "-map", "[vout]",
    "-map", "[aout]",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "256k",
    "-movflags", "+faststart",
    final_out
]

print("Rendering master finale in corso (può richiedere circa 20-30 secondi)...")
res_final = subprocess.run(cmd_final, capture_output=True, text=True)
if res_final.returncode != 0:
    print("Errore render finale:", res_final.stderr)
    raise RuntimeError("FFmpeg master render failed")

print(f"\n🎉 MASTER TRAILER NARRATO E SOTTOTITOLATO COMPLETATO!")
print(f"File: {final_out}")
stat = os.stat(final_out)
print(f"Dimensione: {stat.st_size / (1024*1024):.2f} MB")

# Sincronizza su limen-scene1.mp4 per la Landing Page
hero_path = os.path.join(VIDEOS_DIR, "limen-scene1.mp4")
import shutil
shutil.copyfile(final_out, hero_path)
print(f"✓ Aggiornato hero video: {hero_path}")
