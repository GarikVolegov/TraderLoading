import os
import sys
import math
import bpy

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup_render_engine():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.use_raytracing = True
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False

def create_studio_backdrop():
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, -0.5, -0.02))
    floor = bpy.context.active_object
    floor.name = "Studio_Basalt_Floor"

    mat = bpy.data.materials.new(name="Basalt_Slate_Material")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.055, 0.058, 0.065, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.88
    bsdf.inputs['Specular IOR Level'].default_value = 0.2

    noise = nodes.new(type='ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 55.0
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.7

    bump = nodes.new(type='ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.05
    bump.inputs['Distance'].default_value = 0.01

    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    floor.data.materials.append(mat)
    return floor

def create_fleece_material(color_type="sport_grey"):
    mat = bpy.data.materials.new(name=f"Heavyweight_Fleece_{color_type}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    mapping = nodes.new(type='ShaderNodeMapping')
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    if color_type == "sport_grey":
        # Heather Titanium Grey con micro-mélange organico
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 350.0
        noise.inputs['Detail'].default_value = 10.0
        links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

        color_ramp = nodes.new(type='ShaderNodeValToRGB')
        color_ramp.color_ramp.elements[0].position = 0.32
        color_ramp.color_ramp.elements[0].color = (0.72, 0.73, 0.76, 1.0)
        color_ramp.color_ramp.elements[1].position = 0.68
        color_ramp.color_ramp.elements[1].color = (0.42, 0.43, 0.46, 1.0)

        links.new(noise.outputs['Fac'], color_ramp.inputs['Fac'])
        links.new(color_ramp.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.75
        bsdf.inputs['Sheen Weight'].default_value = 0.70
        bsdf.inputs['Sheen Tint'].default_value = (0.95, 0.95, 1.0, 1.0)
    elif color_type == "black":
        # Obsidian Black
        bsdf.inputs['Base Color'].default_value = (0.028, 0.028, 0.035, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.82
        bsdf.inputs['Sheen Weight'].default_value = 0.55
        bsdf.inputs['Sheen Tint'].default_value = (0.35, 0.35, 0.40, 1.0)
    elif color_type == "dark_heather":
        # Dark Heather Grafite d'Ordine
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 320.0
        noise.inputs['Detail'].default_value = 8.0
        links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

        color_ramp = nodes.new(type='ShaderNodeValToRGB')
        color_ramp.color_ramp.elements[0].position = 0.35
        color_ramp.color_ramp.elements[0].color = (0.17, 0.175, 0.19, 1.0)
        color_ramp.color_ramp.elements[1].position = 0.65
        color_ramp.color_ramp.elements[1].color = (0.09, 0.095, 0.11, 1.0)

        links.new(noise.outputs['Fac'], color_ramp.inputs['Fac'])
        links.new(color_ramp.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.80
        bsdf.inputs['Sheen Weight'].default_value = 0.60
        bsdf.inputs['Sheen Tint'].default_value = (0.55, 0.55, 0.60, 1.0)

    # Micro-grana trama maglia pettinata pesante 400 gsm
    knit_wave = nodes.new(type='ShaderNodeTexWave')
    knit_wave.wave_type = 'RINGS'
    knit_wave.rings_direction = 'SPHERICAL'
    knit_wave.inputs['Scale'].default_value = 450.0
    knit_wave.inputs['Distortion'].default_value = 3.5
    knit_wave.inputs['Detail'].default_value = 4.0
    links.new(mapping.outputs['Vector'], knit_wave.inputs['Vector'])

    bump = nodes.new(type='ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    bump.inputs['Distance'].default_value = 0.004

    links.new(knit_wave.outputs['Color'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return mat

def create_gold_embroidery_material():
    mat = bpy.data.materials.new(name="Madeira_Classic_Gold_Embroidery")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')

    # Oro Madeira Classic Gold puro con saturazione imperiale
    bsdf.inputs['Base Color'].default_value = (0.86, 0.70, 0.32, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.92
    bsdf.inputs['Roughness'].default_value = 0.24
    bsdf.inputs['Anisotropic'].default_value = 0.75
    bsdf.inputs['Anisotropic Rotation'].default_value = 0.3

    # Striature diagonali del punto raso (satin stitch thread ridges)
    wave = nodes.new(type='ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'DIAGONAL'
    wave.inputs['Scale'].default_value = 240.0
    wave.inputs['Distortion'].default_value = 0.8
    wave.inputs['Detail'].default_value = 4.0

    bump = nodes.new(type='ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.16
    bump.inputs['Distance'].default_value = 0.002

    links.new(wave.outputs['Color'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return mat

def create_insignia_text_element(body, font, size, location, parent, gold_mat, letter_spacing=1.0):
    txt_curve = bpy.data.curves.new(f"Text_{body[:8]}", type='FONT')
    txt_curve.body = body
    txt_curve.font = font
    txt_curve.size = size
    txt_curve.space_character = letter_spacing
    txt_curve.align_x = 'CENTER'
    txt_curve.align_y = 'CENTER'
    txt_curve.extrude = 0.0022
    txt_curve.bevel_depth = 0.0006
    txt_curve.bevel_resolution = 2

    txt_obj = bpy.data.objects.new(f"Insignia_Text_{body[:8]}", txt_curve)
    bpy.context.collection.objects.link(txt_obj)
    txt_obj.location = location
    txt_obj.parent = parent
    txt_obj.data.materials.append(gold_mat)
    return txt_obj

def build_insignia_3d_crest(svg_path, gold_mat):
    initial_objects = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=svg_path)
    curves = [o for o in bpy.data.objects if o not in initial_objects and o.type == 'CURVE']

    # Rig parent per l'insegna d'Ordine
    rig = bpy.data.objects.new("Limen_Insignia_Rig", None)
    bpy.context.collection.objects.link(rig)

    # Posizionamento sul fianco sinistro
    rig.location = (-0.145, -0.32, 0.023)
    rig.rotation_euler = (0.015, 0.01, math.radians(-3.5))

    # Scala dell'emblema (da SVG ~0.20m a 0.092m di larghezza reale)
    scale = 0.44
    rig.scale = (scale, scale, scale)

    # Centro geometrico dell'SVG
    cx, cy = 0.1129, 0.1693

    for c in curves:
        c.location.x -= cx
        c.location.y -= cy
        c.parent = rig
        c.data.extrude = 0.0020
        c.data.bevel_depth = 0.0007
        c.data.bevel_resolution = 2
        c.data.materials.clear()
        c.data.materials.append(gold_mat)

    # Aggiungiamo la tipografia lapidaria romana in 3D con rilievo satinato
    font_path = "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf"
    roman_font = bpy.data.fonts.load(font_path) if os.path.exists(font_path) else None

    if roman_font:
        # In coordinate locali dell'Insignia Rig (dopo centering: y=-0.1693 a +0.1693):
        # 1. Trabeazione Superiore
        create_insignia_text_element(
            "LIMEN PROTOCOL", roman_font, 0.0135,
            (0, 0.092, 0.0022), rig, gold_mat, letter_spacing=1.35
        )

        # 2. Gradi I-V lungo gli assi
        create_insignia_text_element(
            "V · APEX", roman_font, 0.0085,
            (-0.038, 0.065, 0.0022), rig, gold_mat, letter_spacing=1.1
        )
        create_insignia_text_element(
            "IV · ORDO", roman_font, 0.0085,
            (0.038, 0.065, 0.0022), rig, gold_mat, letter_spacing=1.1
        )
        create_insignia_text_element(
            "III · CONSTANTIA", roman_font, 0.0078,
            (-0.038, -0.052, 0.0022), rig, gold_mat, letter_spacing=1.05
        )
        create_insignia_text_element(
            "II · REGULA", roman_font, 0.0078,
            (0.038, -0.052, 0.0022), rig, gold_mat, letter_spacing=1.05
        )
        create_insignia_text_element(
            "I · LIMEN (VARCO)", roman_font, 0.0088,
            (0, -0.076, 0.0022), rig, gold_mat, letter_spacing=1.15
        )

        # 3. Cartiglio Principale Cardo & Decumanus
        create_insignia_text_element(
            "CARDO ET DECUMANUS", roman_font, 0.0125,
            (0, -0.108, 0.0022), rig, gold_mat, letter_spacing=1.25
        )

        # 4. Motto Lapidario Inferiore
        create_insignia_text_element(
            "ORDO · CONSTANTIA · REGULA", roman_font, 0.0082,
            (0, -0.128, 0.0022), rig, gold_mat, letter_spacing=1.15
        )

    return rig

def build_sweatpants_mesh(fleece_material):
    mesh = bpy.data.meshes.new("Limen_Pant_Mesh")
    obj = bpy.data.objects.new("Limen_Relaxed_Pant", mesh)
    bpy.context.collection.objects.link(obj)

    verts = []
    faces = []

    # Sezioni del Bacino (y da 0.0 a -0.22)
    pelvis_profiles = [
        (0.00, 0.225, 0.016),
        (-0.05, 0.235, 0.019),
        (-0.12, 0.255, 0.023),
        (-0.22, 0.270, 0.025),
    ]

    pelvis_verts_idx = []
    for (y, half_w, z_base) in pelvis_profiles:
        row = []
        for col in range(9):
            t = (col / 8.0) * 2.0 - 1.0
            x = t * half_w
            z_curve = z_base * (1.0 - 0.25 * (t ** 2))
            z_fold = 0.003 * math.sin(t * math.pi * 3.0) * math.cos(y * 8.0)
            row.append(len(verts))
            verts.append((x, y, z_curve + z_fold))
        pelvis_verts_idx.append(row)

    for r in range(len(pelvis_profiles) - 1):
        for c in range(8):
            v1 = pelvis_verts_idx[r][c]
            v2 = pelvis_verts_idx[r][c + 1]
            v3 = pelvis_verts_idx[r + 1][c + 1]
            v4 = pelvis_verts_idx[r + 1][c]
            faces.append((v1, v2, v3, v4))

    # Gamba Sinistra (x < 0)
    leg_left_profiles = [
        (-0.22, -0.135, 0.135, 0.025),
        (-0.34, -0.140, 0.130, 0.023),
        (-0.46, -0.145, 0.126, 0.021),
        (-0.60, -0.150, 0.122, 0.020),
        (-0.76, -0.155, 0.120, 0.018),
        (-0.92, -0.160, 0.118, 0.016),
        (-1.08, -0.165, 0.118, 0.015),
    ]

    leg_l_verts_idx = []
    for idx_row, (y, cx, hw, zb) in enumerate(leg_left_profiles):
        row = []
        for col in range(7):
            t = (col / 6.0) * 2.0 - 1.0
            x = cx + t * hw
            z_curve = zb * (1.0 - 0.3 * (t ** 2))
            z_crease = 0.004 * math.sin(t * math.pi * 2.0 + idx_row * 0.8)
            row.append(len(verts))
            verts.append((x, y, z_curve + z_crease))
        leg_l_verts_idx.append(row)

    for r in range(len(leg_left_profiles) - 1):
        for c in range(6):
            v1 = leg_l_verts_idx[r][c]
            v2 = leg_l_verts_idx[r][c + 1]
            v3 = leg_l_verts_idx[r + 1][c + 1]
            v4 = leg_l_verts_idx[r + 1][c]
            faces.append((v1, v2, v3, v4))

    # Gamba Destra (x > 0)
    leg_right_profiles = [
        (-0.22, 0.135, 0.135, 0.025),
        (-0.34, 0.140, 0.130, 0.023),
        (-0.46, 0.145, 0.126, 0.021),
        (-0.60, 0.150, 0.122, 0.020),
        (-0.76, 0.155, 0.120, 0.018),
        (-0.92, 0.160, 0.118, 0.016),
        (-1.08, 0.165, 0.118, 0.015),
    ]

    leg_r_verts_idx = []
    for idx_row, (y, cx, hw, zb) in enumerate(leg_right_profiles):
        row = []
        for col in range(7):
            t = (col / 6.0) * 2.0 - 1.0
            x = cx + t * hw
            z_curve = zb * (1.0 - 0.3 * (t ** 2))
            z_crease = 0.0035 * math.cos(t * math.pi * 2.5 + idx_row * 0.7)
            row.append(len(verts))
            verts.append((x, y, z_curve + z_crease))
        leg_r_verts_idx.append(row)

    for r in range(len(leg_right_profiles) - 1):
        for c in range(6):
            v1 = leg_r_verts_idx[r][c]
            v2 = leg_r_verts_idx[r][c + 1]
            v3 = leg_r_verts_idx[r + 1][c + 1]
            v4 = leg_r_verts_idx[r + 1][c]
            faces.append((v1, v2, v3, v4))

    last_pelvis = pelvis_verts_idx[-1]
    for c in range(4):
        faces.append((last_pelvis[c], last_pelvis[c+1], leg_l_verts_idx[0][c+2], leg_l_verts_idx[0][c+1]))
    for c in range(4):
        faces.append((last_pelvis[c+4], last_pelvis[c+5], leg_r_verts_idx[0][c+2], leg_r_verts_idx[0][c+1]))
    faces.append((last_pelvis[4], leg_r_verts_idx[0][1], leg_l_verts_idx[0][5]))

    mesh.from_pydata(verts, [], faces)
    mesh.update()

    for p in mesh.polygons:
        p.use_smooth = True

    subsurf = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    subsurf.levels = 2
    subsurf.render_levels = 2

    solidify = obj.modifiers.new(name="Solidify", type='SOLIDIFY')
    solidify.thickness = 0.005

    obj.data.materials.append(fleece_material)

    create_drawstrings(obj)
    create_pocket_welts(fleece_material)

    return obj

def create_drawstrings(pant_obj):
    gold_mat = bpy.data.materials.get("Madeira_Classic_Gold_Embroidery") or create_gold_embroidery_material()
    cord_mat = bpy.data.materials.new(name="Drawstring_Cord_Cotton")
    cord_mat.use_nodes = True
    c_bsdf = cord_mat.node_tree.nodes.get("Principled BSDF")
    if c_bsdf:
        c_bsdf.inputs['Base Color'].default_value = (0.86, 0.86, 0.89, 1.0)
        c_bsdf.inputs['Roughness'].default_value = 0.9

    for eyelet_x in [-0.022, 0.022]:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.0055, minor_radius=0.0018,
            location=(eyelet_x, -0.028, 0.023),
            rotation=(0, 0, 0)
        )
        eyelet = bpy.context.active_object
        eyelet.data.materials.append(gold_mat)

    # Cordino sinistro
    curve_data_l = bpy.data.curves.new('Drawstring_L', type='CURVE')
    curve_data_l.dimensions = '3D'
    curve_data_l.bevel_depth = 0.0032
    curve_data_l.bevel_resolution = 4
    polyline_l = curve_data_l.splines.new('BEZIER')
    polyline_l.bezier_points.add(3)

    pts_l = [
        ((-0.022, -0.028, 0.024), (0, 0.01, 0), (-0.01, -0.02, 0)),
        ((-0.038, -0.08, 0.026), (0.01, 0.03, 0), (-0.01, -0.04, 0)),
        ((-0.052, -0.16, 0.025), (0.005, 0.03, 0), (-0.005, -0.03, 0)),
        ((-0.045, -0.23, 0.023), (0, 0.03, 0), (0, -0.02, 0)),
    ]
    for idx, (co, h_l, h_r) in enumerate(pts_l):
        bp = polyline_l.bezier_points[idx]
        bp.co = co
        bp.handle_left = (co[0] + h_l[0], co[1] + h_l[1], co[2] + h_l[2])
        bp.handle_right = (co[0] + h_r[0], co[1] + h_r[1], co[2] + h_r[2])

    obj_l = bpy.data.objects.new('Drawstring_Cord_Left', curve_data_l)
    bpy.context.collection.objects.link(obj_l)
    obj_l.data.materials.append(cord_mat)

    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.0038, depth=0.022,
        location=(-0.045, -0.24, 0.023),
        rotation=(0.1, 0, 0)
    )
    aglet_l = bpy.context.active_object
    aglet_l.data.materials.append(gold_mat)

    # Cordino destro
    curve_data_r = bpy.data.curves.new('Drawstring_R', type='CURVE')
    curve_data_r.dimensions = '3D'
    curve_data_r.bevel_depth = 0.0032
    curve_data_r.bevel_resolution = 4
    polyline_r = curve_data_r.splines.new('BEZIER')
    polyline_r.bezier_points.add(3)

    pts_r = [
        ((0.022, -0.028, 0.024), (0, 0.01, 0), (0.01, -0.02, 0)),
        ((0.042, -0.075, 0.026), (-0.01, 0.03, 0), (0.01, -0.04, 0)),
        ((0.060, -0.155, 0.025), (-0.005, 0.03, 0), (0.005, -0.03, 0)),
        ((0.055, -0.225, 0.023), (0, 0.03, 0), (0, -0.02, 0)),
    ]
    for idx, (co, h_l, h_r) in enumerate(pts_r):
        bp = polyline_r.bezier_points[idx]
        bp.co = co
        bp.handle_left = (co[0] + h_l[0], co[1] + h_l[1], co[2] + h_l[2])
        bp.handle_right = (co[0] + h_r[0], co[1] + h_r[1], co[2] + h_r[2])

    obj_r = bpy.data.objects.new('Drawstring_Cord_Right', curve_data_r)
    bpy.context.collection.objects.link(obj_r)
    obj_r.data.materials.append(cord_mat)

    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.0038, depth=0.022,
        location=(0.055, -0.235, 0.023),
        rotation=(-0.08, 0, 0)
    )
    aglet_r = bpy.context.active_object
    aglet_r.data.materials.append(gold_mat)

def create_pocket_welts(fleece_mat):
    curve_l = bpy.data.curves.new('Pocket_Welt_L', type='CURVE')
    curve_l.dimensions = '3D'
    curve_l.bevel_depth = 0.0045
    spline_l = curve_l.splines.new('BEZIER')
    spline_l.bezier_points.add(1)
    spline_l.bezier_points[0].co = (-0.235, -0.08, 0.023)
    spline_l.bezier_points[1].co = (-0.175, -0.20, 0.024)
    obj_l = bpy.data.objects.new('Pocket_Welt_Left', curve_l)
    bpy.context.collection.objects.link(obj_l)
    obj_l.data.materials.append(fleece_mat)

    curve_r = bpy.data.curves.new('Pocket_Welt_R', type='CURVE')
    curve_r.dimensions = '3D'
    curve_r.bevel_depth = 0.0045
    spline_r = curve_r.splines.new('BEZIER')
    spline_r.bezier_points.add(1)
    spline_r.bezier_points[0].co = (0.235, -0.08, 0.023)
    spline_r.bezier_points[1].co = (0.175, -0.20, 0.024)
    obj_r = bpy.data.objects.new('Pocket_Welt_Right', curve_r)
    bpy.context.collection.objects.link(obj_r)
    obj_r.data.materials.append(fleece_mat)

def setup_studio_lighting():
    # Key Light diffusa dall'alto a 45 gradi
    key_light_data = bpy.data.lights.new(name="Studio_Key_Light", type='AREA')
    key_light_data.energy = 95.0
    key_light_data.size = 2.4
    key_light_data.color = (1.0, 0.98, 0.95)
    key_light = bpy.data.objects.new(name="Studio_Key_Light", object_data=key_light_data)
    key_light.location = (-1.1, 0.3, 1.8)
    key_light.rotation_euler = (math.radians(25), math.radians(-30), math.radians(20))
    bpy.context.collection.objects.link(key_light)

    # Rim Light fredda per bordo sartoriale
    fill_light_data = bpy.data.lights.new(name="Studio_Rim_Light", type='AREA')
    fill_light_data.energy = 50.0
    fill_light_data.size = 2.6
    fill_light_data.color = (0.88, 0.92, 1.0)
    fill_light = bpy.data.objects.new(name="Studio_Rim_Light", object_data=fill_light_data)
    fill_light.location = (1.4, -1.2, 1.5)
    fill_light.rotation_euler = (math.radians(-30), math.radians(35), math.radians(-15))
    bpy.context.collection.objects.link(fill_light)

    # Spot dorato calibrato direttamente sul ricamo per far brillare il filo Madeira
    spot_data = bpy.data.lights.new(name="Gold_Accent_Spot", type='SPOT')
    spot_data.energy = 42.0
    spot_data.spot_size = math.radians(38)
    spot_data.spot_blend = 0.35
    spot_data.color = (1.0, 0.88, 0.62)
    spot = bpy.data.objects.new(name="Gold_Accent_Spot", object_data=spot_data)
    spot.location = (-0.55, -0.12, 1.15)
    spot.rotation_euler = (math.radians(22), math.radians(-26), 0)
    bpy.context.collection.objects.link(spot)

def setup_cameras():
    # Camera Front Flatlay
    cam_front_data = bpy.data.cameras.new("Camera_Front")
    cam_front_data.lens = 75.0
    cam_front = bpy.data.objects.new("Camera_Front", cam_front_data)
    cam_front.location = (0, -0.54, 2.22)
    cam_front.rotation_euler = (0, 0, 0)
    bpy.context.collection.objects.link(cam_front)

    # Camera Macro Close-Up
    cam_macro_data = bpy.data.cameras.new("Camera_Macro")
    cam_macro_data.lens = 110.0
    cam_macro_data.dof.use_dof = True
    cam_macro_data.dof.focus_distance = 0.44
    cam_macro_data.dof.aperture_fstop = 3.5
    cam_macro = bpy.data.objects.new("Camera_Macro", cam_macro_data)
    cam_macro.location = (-0.145, -0.56, 0.30)
    cam_macro.rotation_euler = (math.radians(48), 0, 0)
    bpy.context.collection.objects.link(cam_macro)

    return cam_front, cam_macro
