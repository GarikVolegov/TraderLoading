import os
import sys
import bpy

script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.append(script_dir)

import build_blender_pants_scene as builder

def render_all():
    print("=== STARTING FULL BLENDER PBR APPAREL RENDERING ===")
    
    workspace_dir = "/Users/gazz/Desktop/TraderLoadingsLOCALE"
    merch_dir = os.path.join(workspace_dir, "artifacts/trader-dashboard/public/images/merch")
    mockups_dir = os.path.join(workspace_dir, "design-mockups/limen-uniform-printful")
    brain_dir = "/Users/gazz/.gemini/antigravity/brain/bbf333e5-8675-4528-9904-e22fffe3e883"
    svg_path = os.path.join(mockups_dir, "limen_pant_ordo_blender.svg")

    os.makedirs(merch_dir, exist_ok=True)
    os.makedirs(mockups_dir, exist_ok=True)
    os.makedirs(brain_dir, exist_ok=True)

    # 1. SPORT GREY FRONT VIEW
    print("\n--- 1. Rendering Sport Grey Pant (Flat Lay) ---")
    builder.clear_scene()
    builder.setup_render_engine()
    builder.create_studio_backdrop()
    fleece_grey = builder.create_fleece_material("sport_grey")
    gold_mat = builder.create_gold_embroidery_material()
    builder.build_sweatpants_mesh(fleece_grey)
    builder.build_insignia_3d_crest(svg_path, gold_mat)
    builder.setup_studio_lighting()
    cam_front, cam_macro = builder.setup_cameras()

    scene = bpy.context.scene
    scene.camera = cam_front
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1600
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 98

    grey_path = os.path.join(merch_dir, "pant-front-sportgrey.jpg")
    scene.render.filepath = grey_path
    bpy.ops.render.render(write_still=True)
    print(f"✓ Saved Sport Grey: {grey_path}")

    # Copia nei mockups e brain
    import shutil
    shutil.copyfile(grey_path, os.path.join(mockups_dir, "mockup_pant_front_sportgrey.jpg"))
    shutil.copyfile(grey_path, os.path.join(brain_dir, "pant-front-sportgrey.jpg"))

    # 2. MACRO CLOSE-UP DETAIL (Camera Macro, Sport Grey, 1200x1200)
    print("\n--- 2. Rendering Macro Close-up 3D Embroidery Detail ---")
    scene.camera = cam_macro
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    macro_path = os.path.join(merch_dir, "pant-macro-ordo.jpg")
    scene.render.filepath = macro_path
    bpy.ops.render.render(write_still=True)
    print(f"✓ Saved Macro Detail: {macro_path}")
    shutil.copyfile(macro_path, os.path.join(mockups_dir, "mockup_pant_macro_ordo.jpg"))
    shutil.copyfile(macro_path, os.path.join(brain_dir, "pant-macro-ordo.jpg"))

    # 3. OBSIDIAN BLACK FRONT VIEW
    print("\n--- 3. Rendering Obsidian Black Pant (Flat Lay) ---")
    builder.clear_scene()
    builder.setup_render_engine()
    builder.create_studio_backdrop()
    fleece_black = builder.create_fleece_material("black")
    gold_mat = builder.create_gold_embroidery_material()
    builder.build_sweatpants_mesh(fleece_black)
    builder.build_insignia_3d_crest(svg_path, gold_mat)
    builder.setup_studio_lighting()
    cam_front, _ = builder.setup_cameras()

    scene = bpy.context.scene
    scene.camera = cam_front
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1600
    black_path = os.path.join(merch_dir, "pant-front-black.jpg")
    scene.render.filepath = black_path
    bpy.ops.render.render(write_still=True)
    print(f"✓ Saved Obsidian Black: {black_path}")
    shutil.copyfile(black_path, os.path.join(mockups_dir, "mockup_pant_front_black.jpg"))
    shutil.copyfile(black_path, os.path.join(brain_dir, "pant-front-black.jpg"))

    # 4. DARK HEATHER FRONT VIEW
    print("\n--- 4. Rendering Dark Heather Pant (Flat Lay) ---")
    builder.clear_scene()
    builder.setup_render_engine()
    builder.create_studio_backdrop()
    fleece_heather = builder.create_fleece_material("dark_heather")
    gold_mat = builder.create_gold_embroidery_material()
    builder.build_sweatpants_mesh(fleece_heather)
    builder.build_insignia_3d_crest(svg_path, gold_mat)
    builder.setup_studio_lighting()
    cam_front, _ = builder.setup_cameras()

    scene = bpy.context.scene
    scene.camera = cam_front
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1600
    heather_path = os.path.join(merch_dir, "pant-front-darkheather.jpg")
    scene.render.filepath = heather_path
    bpy.ops.render.render(write_still=True)
    print(f"✓ Saved Dark Heather: {heather_path}")
    shutil.copyfile(heather_path, os.path.join(mockups_dir, "mockup_pant_front_darkheather.jpg"))
    shutil.copyfile(heather_path, os.path.join(brain_dir, "pant-front-darkheather.jpg"))

    print("\n=== ALL 4 BLENDER 3D PANTS RENDERS COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    render_all()
