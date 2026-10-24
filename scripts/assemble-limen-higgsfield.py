"""Assemble six downloaded Higgsfield clips into the 16:9 LIMEN landing film.

Usage: python3 scripts/assemble-limen-higgsfield.py /path/to/clips
Required: clip-01.mp4 ... clip-06.mp4. Optional: narration.wav.
Generates a silent visual cut unless narration.wav is provided.
"""

import argparse
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("clips", type=Path)
    parser.add_argument("--output", type=Path, default=Path("artifacts/trader-dashboard/public/videos/limen-higgsfield-landing.mp4"))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    candidates = sorted((root / "node_modules/.pnpm").glob("ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg"))
    ffmpeg = shutil.which("ffmpeg") or next((str(p) for p in candidates if p.is_file()), None)
    if not ffmpeg:
        parser.error("FFmpeg non disponibile")
    clips = [args.clips / f"clip-{i:02}.mp4" for i in range(1, 7)]
    missing = [str(p) for p in clips if not p.is_file()]
    if missing:
        parser.error("Clip mancanti: " + ", ".join(missing))
    if args.output.exists():
        parser.error("Il file di destinazione esiste già; scegliere --output per conservarlo")
    durations = [6, 7, 8, 8, 11, 5]
    for clip, minimum in zip(clips, durations):
        probe = subprocess.run([ffmpeg, "-hide_banner", "-i", str(clip)], capture_output=True, text=True)
        match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe.stderr)
        if not match:
            parser.error(f"Durata non leggibile: {clip}")
        hours, minutes, seconds = map(float, match.groups())
        if hours * 3600 + minutes * 60 + seconds < minimum - 0.05:
            parser.error(f"Clip troppo breve: {clip}; servono almeno {minimum} secondi")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="limen-higgsfield-") as tmp:
        temp = Path(tmp)
        for index, (clip, seconds) in enumerate(zip(clips, durations), 1):
            subprocess.run([
                ffmpeg, "-v", "error", "-i", str(clip), "-an",
                "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=24",
                "-t", str(seconds), "-c:v", "libx264", "-crf", "19", "-preset", "medium",
                "-pix_fmt", "yuv420p", str(temp / f"{index}.mp4"),
            ], check=True)
        listing = temp / "clips.txt"
        listing.write_text("".join(f"file '{i}.mp4'\n" for i in range(1, 7)))
        command = [ffmpeg, "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing)]
        narration = args.clips / "narration.wav"
        if narration.is_file():
            command += ["-i", str(narration), "-map", "0:v:0", "-map", "1:a:0", "-af", "apad,loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k"]
        command += ["-c:v", "copy", "-t", "45", "-movflags", "+faststart", str(args.output)]
        subprocess.run(command, check=True)
    print(f"Creato: {args.output.resolve()}")
    print("Verificare visivamente continuità, mani, volti e sincronizzazione prima della pubblicazione.")


if __name__ == "__main__":
    main()
