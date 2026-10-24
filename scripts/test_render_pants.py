import os
import sys
import math
import bpy

# Add directory of build_blender_pants_scene to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.append(script_dir)

import build_blender_pants_scene as builder

def test_render():
    print("Initializing test render...")
    builder.clear_scene()
    builder.setup_render_engine()
    builder.create_studio_backdrop()
    
    fleece_mat = builder.create_fleece_material("sport_grey")
    gold_mat = builder.create_gold_embroidery_material()
    
    pant_obj = builder.build_sweatpants_mesh(fleece_mat)
    
    svg_path = "/Users/gazz/Desktop/TraderLoadingsLOCALE/design-mockups/limen-uniform-printful/limen_pant_ordo_blender.svg"
    emb_rig = builder.import_and_emboss_embroidery(svg_path, gold_mat)
    
    builder.setup_studio_lighting()
    cam_front, cam_macro = builder.setup_cameras()
    
    scene = bpy.context.scene
    scene.camera = cam_front
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.filepath = "/tmp/test_blender_pant_front.jpg"
    
    print("Rendering front view test...")
    bpy.ops.render.render(write_still=True)
    print("✓ Test render completed at /tmp/test_blender_pant_front.jpg")

if __name__ == "__main__":
    test_render()
