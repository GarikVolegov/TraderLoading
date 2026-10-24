import asyncio
import os
import subprocess
import edge_tts

VIDEOS_DIR = os.path.abspath("artifacts/trader-dashboard/public/videos")
TEMP_DIR = os.path.abspath("temp_production")
os.makedirs(TEMP_DIR, exist_ok=True)

VOICE = "it-IT-GiuseppeMultilingualNeural"
RATE = "-10%"
PITCH = "-3Hz"

SCRIPT_ACTS = [
    {
        "id": "act1",
        "video": os.path.join(VIDEOS_DIR, "limen-act1.mp4"),
        "text": "Cerchiamo il controllo là fuori... dimenticando chi governa dentro.",
        "sub_line1": "Cerchiamo il controllo là fuori...",
        "sub_line2": "dimenticando chi governa dentro.",
    },
    {
        "id": "act2",
        "video": os.path.join(VIDEOS_DIR, "limen-act2.mp4"),
        "text": "Il mercato non è una scommessa. È lo specchio inflessibile della tua anima.",
        "sub_line1": "Il mercato non è una scommessa.",
        "sub_line2": "È lo specchio inflessibile della tua anima.",
    },
    {
        "id": "act3",
        "video": os.path.join(VIDEOS_DIR, "limen-act3.mp4"),
        "text": "Quando spegni il rumore... il caos svela la sua geometria sacra.",
        "sub_line1": "Quando spegni il rumore...",
        "sub_line2": "il caos svela la sua geometria sacra.",
    },
    {
        "id": "act4",
        "video": os.path.join(VIDEOS_DIR, "limen-act4.mp4"),
        "text": "LIMEN Protocol. Oltre la Deriva. Varca la Soglia.",
        "sub_line1": "LIMEN PROTOCOL",
        "sub_line2": "Oltre la Deriva. Varca la Soglia.",
    },
]

async def generate_voiceovers():
    print("\n--- 1. GENERAZIONE VOICEOVER NEURALI (ITALIANO) ---")
    for act in SCRIPT_ACTS:
        audio_path = os.path.join(TEMP_DIR, f"{act['id']}_voice.mp3")
        sub_path = os.path.join(TEMP_DIR, f"{act['id']}.vtt")
        print(f"Generazione voce per {act['id']}: '{act['text']}'")
        
        communicate = edge_tts.Communicate(
            act["text"],
            VOICE,
            rate=RATE,
            pitch=PITCH
        )
        await communicate.save(audio_path)
        act["audio_path"] = audio_path
        print(f"✓ Audio generato: {audio_path}")

if __name__ == "__main__":
    asyncio.run(generate_voiceovers())
