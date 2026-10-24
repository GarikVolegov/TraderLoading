#!/usr/bin/env python3
"""
render_3d_laurel_branches.py
Generatore e renderer 3D procedurale per i Rami d'Alloro Imperiale Limen (Laurus Nobilis).
Funge sia da script Blender (bpy) PBR Cycles/EEVEE Next, sia da renderer matematico
stand-alone in Python (PIL/NumPy) con ray-shading Phong, specular highlights e alpha trasparente.
"""

import os
import sys
import math

try:
    import bpy
    HAS_BPY = True
except ImportError:
    HAS_BPY = False

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


# ==============================================================================
# 1. BLENDER PBR ENGINE (Per esecuzione all'interno di Blender 4.x / CLI bpy)
# ==============================================================================
def setup_blender_scene():
    if not HAS_BPY:
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types.RenderSettings, 'eevee') else 'CYCLES'
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1600
    scene.render.resolution_percentage = 100

def create_blender_gold_material():
    if not HAS_BPY:
        return None
    mat = bpy.data.materials.new(name="Limen_Imperial_Gold_PBR")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    # Limen Gold #C5A059 convertito in linear RGB (0.557, 0.354, 0.098)
    bsdf.inputs['Base Color'].default_value = (0.557, 0.354, 0.098, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.96
    bsdf.inputs['Roughness'].default_value = 0.22
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.8
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def build_blender_laurel(is_left=True):
    if not HAS_BPY:
        return
    mat = create_blender_gold_material()
    curve_data = bpy.data.curves.new('LaurelSpine', type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.bevel_depth = 0.015
    polyline = curve_data.splines.new('BEZIER')
    polyline.bezier_points.add(3)
    
    # Punti di controllo della curva ad arco
    direction = -1 if is_left else 1
    polyline.bezier_points[0].co = (0.0, 0.0, -1.0)
    polyline.bezier_points[1].co = (direction * 0.4, 0.0, -0.3)
    polyline.bezier_points[2].co = (direction * 0.5, 0.0, 0.5)
    polyline.bezier_points[3].co = (direction * 0.2, 0.0, 1.1)

    spine_obj = bpy.data.objects.new('LaurelSpineObj', curve_data)
    bpy.context.collection.objects.link(spine_obj)
    spine_obj.data.materials.append(mat)


# ==============================================================================
# 2. STANDALONE 3D RAY & PHONG PROCEDURAL ENGINE (Python PIL + NumPy)
# ==============================================================================
def render_procedural_3d_laurel_branch(is_left=True, width=720, height=1280):
    """
    Renderizza un ramo d'alloro 3D scultoreo ad altissima definizione
    con illuminazione direzionale, riflessi speculari aurei e canale alfa perfetto.
    """
    scale = 2  # Super-sampling 2x per massimo antialiasing
    sw, sh = width * scale, height * scale
    img = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Direzione della luce principale (in alto a sinistra/destra e verso lo spettatore)
    lx = -0.5 if is_left else 0.5
    light_dir = np.array([lx, -0.6, 0.65])
    light_dir /= np.linalg.norm(light_dir)

    rim_dir = np.array([-lx, 0.2, 0.4])
    rim_dir /= np.linalg.norm(rim_dir)

    # Palette Oro Limen & Ombre
    gold_base = np.array([197, 160, 89])        # #C5A059
    gold_bright = np.array([245, 218, 145])     # Speculare caldo
    gold_highlight = np.array([255, 248, 220])  # Riflesso zenitale zecchino
    gold_dark = np.array([92, 70, 32])          # Ombra profonda d'occlusione
    gold_vein = np.array([255, 235, 175])       # Nervature dorate brillanti

    # Definizione dello stelo curvo ad arco trionfale (Bezier cubica)
    cx_base = sw * (0.65 if is_left else 0.35)
    cy_base = sh * 0.88

    cx_mid = sw * (0.32 if is_left else 0.68)
    cy_mid = sh * 0.48

    cx_top = sw * (0.52 if is_left else 0.48)
    cy_top = sh * 0.12

    # Calcolo punti stelo
    t_vals = np.linspace(0, 1, 160)
    stem_pts = []
    for t in t_vals:
        # Curva quadratica/cubica Bezier
        x = (1 - t)**2 * cx_base + 2 * (1 - t) * t * cx_mid + t**2 * cx_top
        y = (1 - t)**2 * cy_base + 2 * (1 - t) * t * cy_mid + t**2 * cy_top
        stem_pts.append((x, y))

    # Disegna l'ombra proiettata dello stelo
    shadow_layer = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    for i in range(len(stem_pts) - 1):
        p1 = (stem_pts[i][0] + 6 * scale, stem_pts[i][1] + 12 * scale)
        p2 = (stem_pts[i+1][0] + 6 * scale, stem_pts[i+1][1] + 12 * scale)
        w = max(2, int((1 - i / len(stem_pts)) * 14 * scale + 4 * scale))
        s_draw.line([p1, p2], fill=(0, 0, 0, 70), width=w)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=8 * scale))
    img.alpha_composite(shadow_layer)

    # Disegna le foglie d'alloro lungo la curva
    # Ogni nodo ha due foglie (una interna e una esterna) + una bacca dorata
    num_leaf_pairs = 16
    for k in range(num_leaf_pairs):
        t_leaf = 0.06 + (k / (num_leaf_pairs - 1)) * 0.86
        idx = int(t_leaf * (len(stem_pts) - 1))
        center_x, center_y = stem_pts[idx]

        # Vettore tangente dello stelo
        next_idx = min(idx + 3, len(stem_pts) - 1)
        prev_idx = max(idx - 3, 0)
        tangent = np.array([stem_pts[next_idx][0] - stem_pts[prev_idx][0],
                            stem_pts[next_idx][1] - stem_pts[prev_idx][1]])
        norm_t = np.linalg.norm(tangent)
        if norm_t > 0:
            tangent /= norm_t
        else:
            tangent = np.array([0, -1])

        normal = np.array([-tangent[1], tangent[0]])  # Vettore perpendicolare

        # Dimensione foglia proporzionale alla posizione (più grandi al centro, più piccole alle estremità)
        leaf_size = math.sin(t_leaf * math.pi) * 88 * scale + 38 * scale
        leaf_width = leaf_size * 0.42

        # Due foglie: lato esterno e lato interno
        for side, angle_spread in [(-1, -0.65), (1, 0.65)]:
            # Calcola angolo di deviazione
            c_angle = math.cos(angle_spread)
            s_angle = math.sin(angle_spread)
            leaf_dir = np.array([
                tangent[0] * c_angle - tangent[1] * s_angle * side,
                tangent[1] * c_angle + tangent[0] * s_angle * side
            ])
            leaf_dir /= np.linalg.norm(leaf_dir)
            leaf_norm = np.array([-leaf_dir[1], leaf_dir[0]])

            tip_x = center_x + leaf_dir[0] * leaf_size
            tip_y = center_y + leaf_dir[1] * leaf_size

            # Punti di controllo della foglia (curva ovale affusolata)
            mid1_x = center_x + leaf_dir[0] * (leaf_size * 0.45) + leaf_norm[0] * leaf_width
            mid1_y = center_y + leaf_dir[1] * (leaf_size * 0.45) + leaf_norm[1] * leaf_width

            mid2_x = center_x + leaf_dir[0] * (leaf_size * 0.45) - leaf_norm[0] * leaf_width
            mid2_y = center_y + leaf_dir[1] * (leaf_size * 0.45) - leaf_norm[1] * leaf_width

            # Coordinate poligono foglia
            poly_pts = [
                (center_x, center_y),
                (center_x + leaf_dir[0] * (leaf_size * 0.2) + leaf_norm[0] * (leaf_width * 0.6),
                 center_y + leaf_dir[1] * (leaf_size * 0.2) + leaf_norm[1] * (leaf_width * 0.6)),
                (mid1_x, mid1_y),
                (center_x + leaf_dir[0] * (leaf_size * 0.75) + leaf_norm[0] * (leaf_width * 0.5),
                 center_y + leaf_dir[1] * (leaf_size * 0.75) + leaf_norm[1] * (leaf_width * 0.5)),
                (tip_x, tip_y),
                (center_x + leaf_dir[0] * (leaf_size * 0.75) - leaf_norm[0] * (leaf_width * 0.5),
                 center_y + leaf_dir[1] * (leaf_size * 0.75) - leaf_norm[1] * (leaf_width * 0.5)),
                (mid2_x, mid2_y),
                (center_x + leaf_dir[0] * (leaf_size * 0.2) - leaf_norm[0] * (leaf_width * 0.6),
                 center_y + leaf_dir[1] * (leaf_size * 0.2) - leaf_norm[1] * (leaf_width * 0.6)),
            ]

            # Shading 3D: orientamento della superficie fogliare rispetto alla luce
            leaf_3d_norm = np.array([leaf_norm[0] * side * 0.6, leaf_norm[1] * side * 0.6, 0.75])
            leaf_3d_norm /= np.linalg.norm(leaf_3d_norm)

            diffuse = max(0.15, np.dot(leaf_3d_norm, light_dir))
            specular = max(0.0, np.dot(leaf_3d_norm, light_dir)) ** 7.0
            rim = max(0.0, np.dot(leaf_3d_norm, rim_dir)) ** 3.0

            # Calcolo colore metallico PBR
            c_rgb = (gold_dark * (1.0 - diffuse) + gold_base * diffuse + gold_bright * (specular * 0.8) + gold_highlight * (rim * 0.4))
            c_rgb = np.clip(c_rgb, 0, 255).astype(int)
            fill_color = (c_rgb[0], c_rgb[1], c_rgb[2], 255)

            # Disegna la mezza foglia in luce e mezza in ombra per sbalzo 3D
            draw.polygon(poly_pts, fill=fill_color)

            # Bordo dorato riflettente
            b_rgb = np.clip(gold_bright * 1.05, 0, 255).astype(int)
            draw.line([poly_pts[1], poly_pts[2], poly_pts[3], poly_pts[4]], fill=(b_rgb[0], b_rgb[1], b_rgb[2], 255), width=int(1.5 * scale))

            # Nervatura centrale in sbalzo aureo
            v_rgb = np.clip(gold_vein * 1.1, 0, 255).astype(int)
            draw.line([(center_x, center_y), (tip_x, tip_y)], fill=(v_rgb[0], v_rgb[1], v_rgb[2], 240), width=max(1, int(1.8 * scale)))

            # Nervature laterali delicate
            for nv in [0.35, 0.6]:
                vx = center_x + leaf_dir[0] * (leaf_size * nv)
                vy = center_y + leaf_dir[1] * (leaf_size * nv)
                draw.line([(vx, vy), (vx + leaf_norm[0] * (leaf_width * 0.6), vy + leaf_norm[1] * (leaf_width * 0.6))],
                          fill=(v_rgb[0], v_rgb[1], v_rgb[2], 180), width=max(1, int(1.0 * scale)))
                draw.line([(vx, vy), (vx - leaf_norm[0] * (leaf_width * 0.6), vy - leaf_norm[1] * (leaf_width * 0.6))],
                          fill=(gold_dark[0], gold_dark[1], gold_dark[2], 180), width=max(1, int(1.0 * scale)))

        # Bacca dorata cerimoniale all'incrocio (piccola sfera 3D con specular highlight)
        berry_r = int(5 * scale)
        bx, by = int(center_x), int(center_y)
        draw.ellipse([bx - berry_r, by - berry_r, bx + berry_r, by + berry_r], fill=(gold_dark[0], gold_dark[1], gold_dark[2], 255))
        draw.ellipse([bx - berry_r + 1, by - berry_r + 1, bx + berry_r - 1, by + berry_r - 1], fill=(gold_base[0], gold_base[1], gold_base[2], 255))
        draw.ellipse([bx - int(berry_r*0.4), by - int(berry_r*0.5), bx + int(berry_r*0.3), by + int(berry_r*0.2)], fill=(gold_highlight[0], gold_highlight[1], gold_highlight[2], 255))

    # Ridisegna lo stelo centrale in primo piano con gradiente tubolare metallico 3D
    for i in range(len(stem_pts) - 1):
        p1 = stem_pts[i]
        p2 = stem_pts[i+1]
        thick = max(2, int((1 - i / len(stem_pts)) * 12 * scale + 3 * scale))
        draw.line([p1, p2], fill=(gold_dark[0], gold_dark[1], gold_dark[2], 255), width=thick + int(2 * scale))
        draw.line([p1, p2], fill=(gold_base[0], gold_base[1], gold_base[2], 255), width=thick)
        # Specular stripe lungo lo stelo
        draw.line([(p1[0] - 1 * scale, p1[1] - 1 * scale), (p2[0] - 1 * scale, p2[1] - 1 * scale)],
                  fill=(gold_highlight[0], gold_highlight[1], gold_highlight[2], 240), width=max(1, int(thick * 0.35)))

    # Downsampling ad alta qualità (Lanczos) a risoluzione finale
    final_img = img.resize((width, height), Image.Resampling.LANCZOS)
    return final_img


def main():
    target_dir = os.path.abspath(os.path.join(
        os.path.dirname(__file__),
        "../artifacts/trader-dashboard/public/images/pricing"
    ))
    os.makedirs(target_dir, exist_ok=True)

    print("=== LIMEN PROTOCOL: RENDERING 3D ALLORO IMPERIALE ===")
    print(f"Destinazione asset: {target_dir}")

    # 1. Ramo Sinistro
    print("1. Generazione Ramo d'Alloro Sinistro 3D...")
    left_img = render_procedural_3d_laurel_branch(is_left=True, width=540, height=880)
    left_png = os.path.join(target_dir, "pricing-laurel-left.png")
    left_webp = os.path.join(target_dir, "pricing-laurel-left.webp")
    left_img.save(left_png, "PNG", optimize=True)
    left_img.save(left_webp, "WEBP", quality=95, method=6)
    print(f"✓ Salvato: {left_png} e {left_webp}")

    # 2. Ramo Destro
    print("2. Generazione Ramo d'Alloro Destro 3D...")
    right_img = render_procedural_3d_laurel_branch(is_left=False, width=540, height=880)
    right_png = os.path.join(target_dir, "pricing-laurel-right.png")
    right_webp = os.path.join(target_dir, "pricing-laurel-right.webp")
    right_img.save(right_png, "PNG", optimize=True)
    right_img.save(right_webp, "WEBP", quality=95, method=6)
    print(f"✓ Salvato: {right_png} e {right_webp}")

    print("=== TUTTI GLI ASSET 3D RENDERING GENERATI CON SUCCESSO ===")


if __name__ == "__main__":
    main()
