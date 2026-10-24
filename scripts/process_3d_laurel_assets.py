#!/usr/bin/env python3
"""
process_3d_laurel_assets.py
Elabora le sculture 3D fotorealistiche generate per il Limen Protocol:
1. Estrazione alpha-channel morbido con rimozione accurata del fondo scuro
2. De-fringing dorato e preservazione dei riflessi speculari radenti
3. Crop del bounding box e generazione di Left Wing, Right Wing (specchiato/sagomato) e Crown Crest
4. Export in WebP ad alta compressione lossless/near-lossless e fallback PNG
"""

import os
from PIL import Image, ImageOps
import numpy as np

def extract_clean_alpha(img_path, threshold=10.0, softness=24.0):
    im = Image.open(img_path).convert("RGB")
    arr = np.array(im, dtype=np.float32)
    
    # Luminanza pesata per toni dorati
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    
    # Alpha con curva morbida
    alpha = np.clip((lum - threshold) / softness, 0.0, 1.0)
    
    # Unsharp/smooth transizione
    alpha = alpha ** 1.15
    
    # Color de-contamination: dove alpha < 1, neutralizza il nero scuro per non creare aloni grigiastri
    rgb = arr.copy()
    mask = (alpha > 0.05) & (alpha < 0.95)
    # Scaliamo i colori scuri di bordo verso il tono d'oro medio per fondersi perfettamente
    gold_tone = np.array([197.0, 160.0, 89.0])
    for c in range(3):
        rgb[:, :, c] = np.where(mask, np.maximum(rgb[:, :, c], gold_tone[c] * 0.35), rgb[:, :, c])
        
    rgba = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    
    # Auto-crop al bounding box
    bbox = out.getbbox()
    if bbox:
        # Aggiungi un piccolo padding di 4px
        pad = 6
        w, h = out.size
        crop_box = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad)
        )
        out = out.crop(crop_box)
        
    return out

def main():
    brain_dir = "/Users/gazz/.gemini/antigravity/brain/695e09c2-cd4e-49c9-bf92-07d30c4bcb50"
    target_dir = "/Users/gazz/Desktop/TraderLoadingsLOCALE/artifacts/trader-dashboard/public/images/pricing"
    os.makedirs(target_dir, exist_ok=True)
    
    branch_src = os.path.join(brain_dir, "single_roman_laurel_branch_1792626958877.jpg")
    wreath_src = os.path.join(brain_dir, "roman_imperial_laurel_branch_1792626934000.jpg")
    
    print("=== ELABORAZIONE ASSET 3D FOTOREALISTICI LIMEN ===")
    
    # 1. Ramo Singolo (Base per le due ali)
    print("1. Elaborazione Ramo d'Alloro 3D...")
    branch_rgba = extract_clean_alpha(branch_src, threshold=8.0, softness=22.0)
    
    # Ramo Sinistro: orientamento naturale
    left_wing = branch_rgba.resize((int(branch_rgba.width * 0.8), int(branch_rgba.height * 0.8)), Image.Resampling.LANCZOS)
    # Se il ramo punta in alto a destra, orientalo ad abbracciare verso l'interno (destra)
    left_png = os.path.join(target_dir, "pricing-laurel-left.png")
    left_webp = os.path.join(target_dir, "pricing-laurel-left.webp")
    left_wing.save(left_png, "PNG", optimize=True)
    left_wing.save(left_webp, "WEBP", quality=95, method=6)
    print(f"✓ Salvato Ramo Sinistro: {left_png} ({left_wing.size})")
    
    # Ramo Destro: specchiato orizzontalmente per abbracciare l'angolo destro
    right_wing = ImageOps.mirror(left_wing)
    right_png = os.path.join(target_dir, "pricing-laurel-right.png")
    right_webp = os.path.join(target_dir, "pricing-laurel-right.webp")
    right_wing.save(right_png, "PNG", optimize=True)
    right_wing.save(right_webp, "WEBP", quality=95, method=6)
    print(f"✓ Salvato Ramo Destro: {right_png} ({right_wing.size})")
    
    # 2. Corona d'Alloro Superiore (Wreath Crest)
    print("2. Elaborazione Corona d'Alloro Trionfale Superiore...")
    crown_rgba = extract_clean_alpha(wreath_src, threshold=9.0, softness=20.0)
    # Riscalatura proporzionata per il medaglione superiore
    crown_scaled = crown_rgba.resize((480, int(480 * crown_rgba.height / crown_rgba.width)), Image.Resampling.LANCZOS)
    crown_png = os.path.join(target_dir, "pricing-laurel-crown.png")
    crown_webp = os.path.join(target_dir, "pricing-laurel-crown.webp")
    crown_scaled.save(crown_png, "PNG", optimize=True)
    crown_scaled.save(crown_webp, "WEBP", quality=95, method=6)
    print(f"✓ Salvato Corona Trionfale: {crown_png} ({crown_scaled.size})")

    # Copia anche in brain dir per visualizzazione immediata negli artefatti
    left_wing.save(os.path.join(brain_dir, "pricing-laurel-left.png"), "PNG")
    right_wing.save(os.path.join(brain_dir, "pricing-laurel-right.png"), "PNG")
    crown_scaled.save(os.path.join(brain_dir, "pricing-laurel-crown.png"), "PNG")
    
    print("=== TUTTI GLI ASSET 3D FOTOREALISTICI SONO STATI GENERATI! ===")

if __name__ == "__main__":
    main()
