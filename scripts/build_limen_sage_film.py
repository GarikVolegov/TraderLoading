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
RATE = "-18%"
PITCH = "-5Hz"

# Definizione delle frasi singole e delle pause esatte (in secondi)
ACTS_SPEECH = [
    {
        "id": "act1",
        "video": os.path.join(VIDEOS_DIR, "limen-act1.mp4"),
        "phrases": [
            {"text": "Cerchiamo il controllo... là fuori.", "pause_after": 0.95},
            {"text": "Dimenticando... chi governa dentro.", "pause_after": 0.60},
        ]
    },
    {
        "id": "act2",
        "video": os.path.join(VIDEOS_DIR, "limen-act2.mp4"),
        "phrases": [
            {"text": "Il mercato... non è una scommessa.", "pause_after": 1.05},
            {"text": "È lo specchio inflessibile... della tua anima.", "pause_after": 0.60},
        ]
    },
    {
        "id": "act3",
        "video": os.path.join(VIDEOS_DIR, "limen-act3.mp4"),
        "phrases": [
            {"text": "Quando spegni il rumore...", "pause_after": 1.00},
            {"text": "il caos svela... la sua geometria sacra.", "pause_after": 0.60},
        ]
    },
    {
        "id": "act4",
        "video": os.path.join(VIDEOS_DIR, "limen-act4.mp4"),
        "phrases": [
            {"text": "LIMEN Protocol.", "pause_after": 1.10},
            {"text": "Oltre la Deriva.", "pause_after": 0.85},
            {"text": "Varca la Soglia.", "pause_after": 1.00},
        ]
    },
]

def format_ass_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

async def generate_speech_tracks():
    print("\n--- 1. GENERAZIONE TRACCE VOCALI SAGGE CON PAUSE METRICHE ---")
    act_durations = []
    
    for act_idx, act in enumerate(ACTS_SPEECH):
        phrase_files = []
        for p_idx, p in enumerate(act["phrases"]):
            p_file = os.path.join(TEMP_DIR, f"{act['id']}_p{p_idx}.mp3")
            print(f"[{act['id']}] Sintesi frase {p_idx+1}: \"{p['text']}\"")
            comm = edge_tts.Communicate(p["text"], VOICE, rate=RATE, pitch=PITCH)
            await comm.save(p_file)
            phrase_files.append((p_file, p["pause_after"]))

        # Concatena le frasi inserendo le pause di silenzio calibrate
        inputs = []
        filter_parts = []
        concat_inputs = []
        in_idx = 0

        for p_file, pause in phrase_files:
            inputs.extend(["-i", p_file])
            filter_parts.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[a{in_idx}]")
            concat_inputs.append(f"[a{in_idx}]")
            in_idx += 1

            if pause > 0:
                inputs.extend(["-f", "lavfi", "-t", str(pause), "-i", "anullsrc=r=44100:cl=stereo"])
                filter_parts.append(f"[{in_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[a{in_idx}]")
                concat_inputs.append(f"[a{in_idx}]")
                in_idx += 1

        filter_graph = ";".join(filter_parts) + f";{''.join(concat_inputs)}concat=n={len(concat_inputs)}:v=0:a=1[outa]"
        act_voice_mp3 = os.path.join(TEMP_DIR, f"{act['id']}_voice_master.mp3")

        cmd = [FFMPEG_BIN, "-y"] + inputs + ["-filter_complex", filter_graph, "-map", "[outa]", act_voice_mp3]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Errore concat voce {act['id']}:", res.stderr)
            raise RuntimeError("Voice concat failed")

        # Rileva la durata esatta della voce per questo atto
        probe_cmd = [FFMPEG_BIN, "-i", act_voice_mp3]
        p_res = subprocess.run(probe_cmd, capture_output=True, text=True)
        import re
        m = re.search(r'Duration: (\d{2}):(\d{2}):([\d.]+)', p_res.stderr)
        dur = float(m.group(1))*3600 + float(m.group(2))*60 + float(m.group(3))
        print(f"✓ Traccia vocale {act['id']} pronta (Durata: {dur:.2f}s)")
        act["voice_path"] = act_voice_mp3
        act["duration"] = dur
        act_durations.append(dur)

    return act_durations

def build_ass_subtitles(timeline_cues):
    print("\n--- 2. GENERAZIONE SOTTOTITOLI CINEMATOGRAFICI ASS (4K ORO E AVORIO) ---")
    header = """[Script Info]
Title: LIMEN PROTOCOL Sage Master Trailer
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 3840
PlayResY: 2160

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: LimenSage,Georgia,74,&H00F4F4F6,&H0059A0C5,&H00000000,&H90000000,1,0,0,0,100,100,3.5,0,1,4.5,6,2,120,120,180,1
Style: LimenBrand,Georgia,88,&H0059A0C5,&H00F4F4F6,&H00000000,&H90000000,1,0,0,0,100,100,6.0,0,1,5.5,8,2,120,120,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for cue in timeline_cues:
        st = format_ass_time(cue["start"])
        et = format_ass_time(cue["end"])
        style = cue.get("style", "LimenSage")
        text = cue["text"]
        events.append(f"Dialogue: 0,{st},{et},{style},,0,0,0,,{text}")

    full_ass = header + "\n".join(events) + "\n"
    ass_path = os.path.join(TEMP_DIR, "limen_sage.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(full_ass)
    print(f"✓ File ASS generato con successo: {ass_path}")
    return ass_path

def produce_master_film():
    act_durations = asyncio.run(generate_speech_tracks())
    
    # Prepariamo ogni clip visivo allungandolo dolcemente con slow-motion cinematografico
    # per coprire esattamente la durata della voce narrante con le sue pause!
    processed_clips = []
    current_time_offset = 0.0
    timeline_cues = []

    # Definiamo i testi dei sottotitoli con le relative durate interne
    SUBTITLE_DEFINITIONS = [
        # Act 1
        [
            {"text": "CERCHIAMO IL CONTROLLO LÀ FUORI...", "start_rel": 0.4, "dur": 3.0},
            {"text": "DIMENTICANDO CHI {\\c&H59A0C5&}GOVERNA DENTRO{\\c}.", "start_rel": 4.1, "dur": 3.3},
        ],
        # Act 2
        [
            {"text": "IL MERCATO NON È UNA SCOMMESSA.", "start_rel": 0.4, "dur": 3.0},
            {"text": "È LO SPECCHIO {\\c&H59A0C5&}INFLESSIBILE{\\c} DELLA TUA ANIMA.", "start_rel": 4.2, "dur": 3.5},
        ],
        # Act 3
        [
            {"text": "QUANDO SPEGNI IL RUMORE...", "start_rel": 0.4, "dur": 2.7},
            {"text": "IL CAOS SVELA LA SUA {\\c&H59A0C5&}GEOMETRIA SACRA{\\c}.", "start_rel": 3.8, "dur": 3.4},
        ],
        # Act 4
        [
            {"text": "{\\c&H59A0C5&}LIMEN PROTOCOL{\\c}", "start_rel": 0.4, "dur": 2.2, "style": "LimenBrand"},
            {"text": "OLTRE LA DERIVA.", "start_rel": 3.4, "dur": 2.1},
            {"text": "{\\c&H59A0C5&}VARCA LA SOGLIA{\\c}.", "start_rel": 6.1, "dur": 2.5, "style": "LimenBrand"},
        ],
    ]

    print("\n--- 3. ADATTAMENTO CLIP 4K E MIX AUDIO MASTER ---")
    xfade_duration = 0.45
    timeline_start = 0.0

    for idx, act in enumerate(ACTS_SPEECH):
        target_dur = act["duration"]
        # Rallenta il video di Kling da 5.04s a target_dur
        speed_factor = target_dur / 5.04
        out_clip = os.path.join(TEMP_DIR, f"{act['id']}_sage_mixed.mp4")

        print(f"\nAdattamento {act['id']}: Durata video estesa a {target_dur:.2f}s (Rallentamento: {speed_factor:.2f}x)...")

        # Audio filter: voce con EQ calda da studio (bassi profondi a 100Hz, presenza a 3.2kHz), Kling ambient a volume 0.25
        filter_graph = (
            f"[0:v]setpts={speed_factor}*PTS,fps=24[v];"
            f"[0:a]volume=0.25[bg];"
            f"[1:a]equalizer=f=110:width_type=o:width=1.2:g=4.5,equalizer=f=3300:width_type=o:width=1.0:g=2.0,volume=1.15[vo];"
            f"[bg][vo]amix=inputs=2:duration=first:dropout_transition=2[a]"
        )

        cmd = [
            FFMPEG_BIN, "-y",
            "-i", act["video"],
            "-i", act["voice_path"],
            "-filter_complex", filter_graph,
            "-map", "[v]",
            "-map", "[a]",
            "-t", str(target_dur),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "17",
            "-c:a", "aac",
            "-b:a", "256k",
            out_clip
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Errore clip {act['id']}:", res.stderr)
            raise RuntimeError(f"Clip processing failed for {act['id']}")

        processed_clips.append(out_clip)

        # Registra i sottotitoli sulla timeline assoluta
        for sub in SUBTITLE_DEFINITIONS[idx]:
            cue = {
                "start": timeline_start + sub["start_rel"],
                "end": timeline_start + sub["start_rel"] + sub["dur"],
                "text": sub["text"],
                "style": sub.get("style", "LimenSage"),
            }
            timeline_cues.append(cue)

        # Prossimo offset considerando la transizione xfade
        timeline_start += (target_dur - xfade_duration)

    # 4. Genera il file ASS con i timestamp assoluti sincronizzati
    ass_path = build_ass_subtitles(timeline_cues)

    # 5. Montaggio finale a 4K con dissolvenze incrociate e sottotitoli impressi
    print("\n--- 4. RENDERING DEL MASTER TRAILER COMPLETO (4K UHD) ---")
    final_out = os.path.join(VIDEOS_DIR, "limen-master-narrated.mp4")

    # Calcola gli offset esatti per i 4 video
    offset1 = act_durations[0] - xfade_duration
    offset2 = offset1 + act_durations[1] - xfade_duration
    offset3 = offset2 + act_durations[2] - xfade_duration
    total_expected = offset3 + act_durations[3]
    print(f"Durata totale prevista del film master: {total_expected:.2f} secondi")

    filter_concat = (
        f"[0:v][1:v]xfade=transition=fade:duration={xfade_duration}:offset={offset1:.2f}[v01];"
        f"[v01][2:v]xfade=transition=fade:duration={xfade_duration}:offset={offset2:.2f}[v02];"
        f"[v02][3:v]xfade=transition=fade:duration={xfade_duration}:offset={offset3:.2f}[vbase];"
        f"[vbase]ass={ass_path}[vout];"
        f"[0:a][1:a]acrossfade=d={xfade_duration}[a01];"
        f"[a01][2:a]acrossfade=d={xfade_duration}[a02];"
        f"[a02][3:a]acrossfade=d={xfade_duration}[aout]"
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

    print("Rendering in corso... (circa 30-45 secondi per 4K 24fps)")
    res_final = subprocess.run(cmd_final, capture_output=True, text=True)
    if res_final.returncode != 0:
        print("Errore nel render finale:", res_final.stderr)
        raise RuntimeError("Master film render failed")

    stat = os.stat(final_out)
    print(f"\n🎉 OPERA CINEMATOGRAFICA DEFINITIVA COMPLETATA CON SUCCESSO!")
    print(f"File: {final_out}")
    print(f"Dimensione: {stat.st_size / (1024*1024):.2f} MB")

    # Sincronizza anche su limen-scene1.mp4 per la visualizzazione immediata sulla Landing Page
    hero_path = os.path.join(VIDEOS_DIR, "limen-scene1.mp4")
    shutil.copyfile(final_out, hero_path)
    print(f"✓ Aggiornato hero video in: {hero_path}")

if __name__ == "__main__":
    produce_master_film()
