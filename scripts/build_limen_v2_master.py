import asyncio
import os
import subprocess
import shutil
import edge_tts

TEMP_DIR = os.path.abspath("temp_production")
os.makedirs(TEMP_DIR, exist_ok=True)
VIDEOS_DIR = os.path.abspath("artifacts/trader-dashboard/public/videos")

FFMPEG_BIN = os.path.abspath("node_modules/.pnpm/ffmpeg-static@5.3.0/node_modules/ffmpeg-static/ffmpeg")
VOICE = "it-IT-GiuseppeMultilingualNeural"
RATE = "-12%"
PITCH = "-12Hz"

CLIPS = [
    os.path.join(VIDEOS_DIR, "limen-v2-act1.mp4"),
    os.path.join(VIDEOS_DIR, "limen-v2-act2.mp4"),
    os.path.join(VIDEOS_DIR, "limen-v2-act3.mp4"),
    os.path.join(VIDEOS_DIR, "limen-v2-act4.mp4"),
]

VOICE_SCRIPT = [
    {
        "id": "act1",
        "text": "Cerchiamo risposte nel rumore...",
        "start": 0.80,
    },
    {
        "id": "act2",
        "text": "...dimenticando chi governa dentro.",
        "start": 4.90,
    },
    {
        "id": "act3",
        "text": "Oltre la Soglia... il caos svela la sua geometria.",
        "start": 9.20,
    },
    {
        "id": "act4",
        "text": "Limen. Se non sai dove si trova la liquidità... la liquidità sei tu.",
        "start": 13.60,
    },
]

SUBTITLES = [
    {
        "start": 0.80,
        "end": 3.80,
        "text": "Cerchiamo risposte nel rumore...",
    },
    {
        "start": 4.90,
        "end": 7.90,
        "text": "...dimenticando chi governa dentro.",
    },
    {
        "start": 9.20,
        "end": 13.20,
        "text": "Oltre la Soglia... il caos svela la sua geometria.",
    },
    {
        "start": 13.60,
        "end": 19.80,
        "text": "{\\b1\\c&H59A0C5&}LIMEN{\\c\\b0}\\N{\\fs62\\c&HE8E8EE&}Se non sai dove si trova la liquidità... la liquidità sei tu.{\\c}",
    },
]

def format_ass_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

async def generate_speech_audio():
    print("\n--- 1. SINTESI VOCALE SAGGIA & PROFONDA (-12Hz) AL MILLISECONDO ---")
    generated = []
    for item in VOICE_SCRIPT:
        out_mp3 = os.path.join(TEMP_DIR, f"speech_{item['id']}_v2.mp3")
        print(f"[{item['id']}] Sintesi: \"{item['text']}\" (Rate: {RATE}, Pitch: {PITCH})...")
        comm = edge_tts.Communicate(item["text"], VOICE, rate=RATE, pitch=PITCH)
        await comm.save(out_mp3)
        
        # Misura durata esatta
        cmd = [FFMPEG_BIN, "-i", out_mp3]
        res = subprocess.run(cmd, capture_output=True, text=True)
        import re
        m = re.search(r'Duration: (\d{2}):(\d{2}):([\d.]+)', res.stderr)
        dur = float(m.group(1))*3600 + float(m.group(2))*60 + float(m.group(3))
        print(f"✓ {item['id']} generato ({dur:.2f}s)")
        generated.append({
            "path": out_mp3,
            "start": item["start"],
            "dur": dur,
        })
    return generated

def build_ass_file():
    ass_path = os.path.join(TEMP_DIR, "limen_v2_subtitles_corrected.ass")
    content = """[Script Info]
Title: LIMEN Master V2 Corrected Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 3840
PlayResY: 2160

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: LimenVoice,Cinzel,72,&H00F0F0F5,&H000000FF,&H000A0A0C,&H80000000,-1,0,0,0,100,100,2.5,0,1,3.5,6.0,2,150,150,140,1
Style: LimenBrand,Cinzel,82,&H0059A0C5,&H000000FF,&H000A0A0C,&HA0000000,-1,0,0,0,105,105,4.0,0,1,4.0,8.0,2,150,150,135,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for sub in SUBTITLES:
        start_str = format_ass_time(sub["start"])
        end_str = format_ass_time(sub["end"])
        style = "LimenBrand" if "LIMEN" in sub["text"] else "LimenVoice"
        events.append(f"Dialogue: 0,{start_str},{end_str},{style},,0,0,0,,{sub['text']}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(content + "\n".join(events) + "\n")
    print(f"✓ File sottotitoli ASS creato: {ass_path}")
    return ass_path

def main():
    print("=======================================================")
    print("LIMEN PROTOCOL — MASTER FILM DEFINITIVO V2 (4K UHD 24FPS)")
    print("=======================================================")

    # 1. Genera tracce audio e sottotitoli
    speech_tracks = asyncio.run(generate_speech_audio())
    ass_path = build_ass_file()

    xfade_duration = 0.60
    # Video 1, 2, 3: 5.04s ciascuno
    # Video 4: 5.04s + 2.0s pad freeze = 7.04s
    offset1 = 5.04 - xfade_duration          # 4.44s
    offset2 = offset1 + 5.04 - xfade_duration # 8.88s
    offset3 = offset2 + 5.04 - xfade_duration # 13.32s
    total_duration = offset3 + 7.04           # 20.36s

    print(f"\n--- 2. CREAZIONE DELLA COLONNA SONORA MASTER PROFONDA (-12Hz + SUB-BASS 432Hz) ---")
    
    cmd_inputs = []
    for c in CLIPS:
        cmd_inputs.extend(["-i", c])
    for s in speech_tracks:
        cmd_inputs.extend(["-i", s["path"]])

    # Genera drone 54Hz e drone 432Hz per l'intera durata (20.36s)
    cmd_inputs.extend([
        "-f", "lavfi", "-t", str(total_duration),
        "-i", "sine=frequency=54:sample_rate=44100",
        "-f", "lavfi", "-t", str(total_duration),
        "-i", "sine=frequency=432:sample_rate=44100"
    ])

    # EQ profonda di classe studio: +7dB a 95Hz (sub-bass), +3.5dB a 200Hz (presenza toracica), +2dB a 3.4kHz
    eq_voice = "equalizer=f=95:width_type=o:width=1.0:g=7.0,equalizer=f=200:width_type=o:width=1.0:g=3.5,equalizer=f=3400:width_type=o:width=1.0:g=2.0,volume=1.40"

    filter_graph = (
        # Ritardi precisi per ogni frase
        f"[4:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=800|800,{eq_voice}[v1];"
        f"[5:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=4900|4900,{eq_voice}[v2];"
        f"[6:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=9200|9200,{eq_voice}[v3];"
        f"[7:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=13600|13600,{eq_voice}[v4];"
        f"[v1][v2][v3][v4]amix=inputs=4:duration=longest:dropout_transition=2[all_voices];"
        # Kling ambient acrossfades
        f"[0:a][1:a]acrossfade=d={xfade_duration}[kling01];"
        f"[kling01][2:a]acrossfade=d={xfade_duration}[kling02];"
        f"[kling02][3:a]acrossfade=d={xfade_duration},volume=0.20[kling_amb];"
        # Droni sub-bass
        f"[8:a]volume=0.30,lowpass=f=90[sub54];"
        f"[9:a]volume=0.06,lowpass=f=600[sine432];"
        # Mix completo: all_voices + sub54 + sine432 + kling_amb
        f"[all_voices][sub54][sine432][kling_amb]amix=inputs=4:duration=first:dropout_transition=3[aout];"
        # Estensione video Atto 4 con freeze finale di 2.0s su sigillo d'oro
        f"[3:v]tpad=stop_mode=clone:stop_duration=2.0[v3_padded];"
        # Video crossfades a 24fps nativi
        f"[0:v][1:v]xfade=transition=fade:duration={xfade_duration}:offset={offset1:.2f}[v01];"
        f"[v01][2:v]xfade=transition=fade:duration={xfade_duration}:offset={offset2:.2f}[v02];"
        f"[v02][v3_padded]xfade=transition=fade:duration={xfade_duration}:offset={offset3:.2f}[vbase];"
        f"[vbase]ass={ass_path}[vout]"
    )

    final_master_path = os.path.join(VIDEOS_DIR, "limen-master-narrated.mp4")
    hero_path = os.path.join(VIDEOS_DIR, "limen-scene1.mp4")
    desktop_copy = "/Users/gazz/Desktop/LIMEN-Master-Film-Completo.mp4"

    cmd_master = [
        FFMPEG_BIN, "-y",
    ] + cmd_inputs + [
        "-filter_complex", filter_graph,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "medium",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "320k",
        "-movflags", "+faststart",
        final_master_path
    ]

    print("\n--- 3. RENDERING IN CORSO DEL FILM MASTER 4K (circa 20-30s)... ---")
    res = subprocess.run(cmd_master, capture_output=True, text=True)
    if res.returncode != 0:
        print("Errore FFMPEG:", res.stderr)
        raise RuntimeError("Master rendering failed")

    # Copie speculari per landing page e desktop
    shutil.copyfile(final_master_path, hero_path)
    shutil.copyfile(final_master_path, desktop_copy)

    stat = os.stat(final_master_path)
    size_mb = stat.st_size / (1024 * 1024)
    print("\n=======================================================")
    print(f"🎉 MASTER TRAILER DEFINITIVO V2 COMPLETATO CON SUCCESSO!")
    print(f"📁 Percorso Locale: {final_master_path}")
    print(f"🖥️ Copia Desktop:   {desktop_copy}")
    print(f"🌐 Hero Landing:    {hero_path}")
    print(f"⏱️ Durata:          {total_duration:.2f} secondi (24 fps Nativi, zero judder)")
    print(f"📦 Dimensione:      {size_mb:.2f} MB (4K UHD 3840x2160)")
    print("=======================================================")

if __name__ == "__main__":
    main()
