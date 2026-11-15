"""
Build the low-poly GLB props used by the Three.js world.

Run from the repository root:

    blender -b --factory-startup --python scripts/models/build_models.py

The script is deterministic: it rebuilds `src/assets/models/*.glb` from
scratch, then renders a preview of each asset into /tmp/opencode. No external
textures or assets are used, so the files are small and licence-clean.

Conventions:
  * 1 Blender unit = 1 metre = 1 Three.js unit.
  * Models face -Y in Blender, which becomes +Z after the glTF Y-up export.
  * Everything is flat shaded to match the game's low-poly look.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "src", "assets", "models")
PREVIEW_DIR = "/tmp/opencode"


# ---------------------------------------------------------------------------
# Scene and materials
# ---------------------------------------------------------------------------


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def srgb_channel(value):
    value /= 255.0
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def rgba(hex_color, alpha=1.0):
    value = hex_color.lstrip("#")
    return (
        srgb_channel(int(value[0:2], 16)),
        srgb_channel(int(value[2:4], 16)),
        srgb_channel(int(value[4:6], 16)),
        alpha,
    )


def make_material(
    name,
    color,
    metallic=0.0,
    roughness=0.6,
    emission=None,
    emission_strength=0.0,
):
    material = bpy.data.materials.new(name)
    if material.node_tree is None:
        material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = rgba(color)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength_input = bsdf.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = rgba(emission)
        if strength_input:
            strength_input.default_value = emission_strength
    return material


class Palette:
    """Shared material set, keyed by the names the game relies on."""

    def __init__(self):
        self.white = make_material("SuitWhite", "#dfe4ea", roughness=0.5)
        self.white_dark = make_material("SuitShade", "#bcc3cb", roughness=0.6)
        self.panel = make_material("PanelGrey", "#7d8794", metallic=0.15, roughness=0.55)
        self.dark = make_material("DarkMetal", "#2b323f", metallic=0.35, roughness=0.5)
        self.black = make_material("Rubber", "#181b20", roughness=0.85)
        self.metal = make_material("Metal", "#8c96a5", metallic=0.55, roughness=0.4)
        self.orange = make_material("SafetyOrange", "#f18a2e", roughness=0.5)
        self.amber = make_material("Amber", "#ffb347", roughness=0.45)
        self.gold = make_material("GoldFoil", "#c99b4e", metallic=0.45, roughness=0.38)
        self.solar = make_material("SolarBlue", "#17456b", metallic=0.2, roughness=0.4)
        self.glass = make_material("VisorGlass", "#1d323c", metallic=0.35, roughness=0.15)
        self.visor = make_material(
            "VisorGold", "#d6a34a", metallic=0.35, roughness=0.2, emission="#2a1700", emission_strength=0.6
        )
        self.glow_white = make_material(
            "GlowWhite", "#fff4dc", emission="#fff4dc", emission_strength=4.0, roughness=0.4
        )
        self.glow_teal = make_material(
            "GlowTeal", "#4de2ff", emission="#4de2ff", emission_strength=3.0, roughness=0.4
        )
        self.glow_red = make_material(
            "GlowRed", "#ff5a6a", emission="#ff5a6a", emission_strength=5.0, roughness=0.4
        )


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def _finish(obj, name, material, smooth=False):
    obj.name = name
    obj.data.name = f"{name}_mesh"
    if material is not None:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    return obj


def box(name, size, location, material, rotation=(0, 0, 0), bevel=0.0, segments=2):
    """Axis-aligned (or Euler-rotated) box with an optional low-poly bevel."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return _finish(obj, name, material)


def cylinder(
    name,
    radius,
    depth,
    location,
    material,
    axis="Z",
    verts=16,
    rotation=None,
    bevel=0.0,
):
    rotations = {
        "Z": (0, 0, 0),
        "X": (0, math.pi / 2, 0),
        "Y": (math.pi / 2, 0, 0),
    }
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation if rotation is not None else rotations[axis],
    )
    obj = bpy.context.active_object
    if bevel > 0:
        modifier = obj.modifiers.new("bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return _finish(obj, name, material)


def cone(name, radius_bottom, radius_top, depth, location, material, verts=16, rotation=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=location,
        rotation=rotation if rotation is not None else (0, 0, 0),
    )
    return _finish(bpy.context.active_object, name, material)


def sphere(name, radius, location, material, segments=16, rings=8, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=location,
    )
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, name, material)


def torus(
    name,
    major_radius,
    minor_radius,
    location,
    material,
    rotation=(0, 0, 0),
    major_segments=18,
    minor_segments=6,
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    return _finish(bpy.context.active_object, name, material)


def tube(name, start, end, radius, material, verts=8):
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    length = direction.length
    if length <= 0:
        raise ValueError(f"zero-length tube: {name}")
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts,
        radius=radius,
        depth=length,
        location=(start + end) / 2,
    )
    obj = bpy.context.active_object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return _finish(obj, name, material)


def hose(name, points, radius, material, samples=8):
    """Smooth polyline tube, used for suit hoses."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.fill_mode = "FULL"
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for index, point in enumerate(points):
        spline.points[index].co = (*point, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    return _finish(obj, name, material)


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    bpy.ops.object.material_slot_remove_unused()
    return obj


def empty(name, location):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.empty_display_size = 0.2
    return obj


def parent_keep(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


# ---------------------------------------------------------------------------
# Export and preview
# ---------------------------------------------------------------------------


def _ensure_ctypes_for_exporter():
    """
    This machine's Blender uses a uv-built Python 3.14 without `_ctypes`.

    The glTF exporter imports ctypes at module level only for its optional Draco
    path, which this script disables. A tiny stub keeps the import working
    without touching the Python installation. On a normal Blender build the
    real ctypes module is used instead.
    """
    try:
        import ctypes  # noqa: F401
        return
    except Exception:
        pass
    import types

    stub = types.ModuleType("ctypes")
    names = [
        "CDLL",
        "POINTER",
        "Structure",
        "Union",
        "byref",
        "c_bool",
        "c_char_p",
        "c_double",
        "c_float",
        "c_int",
        "c_int32",
        "c_size_t",
        "c_uint",
        "c_uint8",
        "c_uint32",
        "c_uint64",
        "c_ulong",
        "c_void_p",
        "cast",
        "cdll",
        "create_string_buffer",
        "string_at",
    ]
    for name in names:
        setattr(stub, name, object)
    sys.modules["ctypes"] = stub


def export_glb(path):
    _ensure_ctypes_for_exporter()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_draco_mesh_compression_enable=False,
    )
    size = os.path.getsize(path)
    print(f"EXPORTED {os.path.relpath(path, ROOT)} ({size / 1024:.1f} KiB)")


def _aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def preview(path, camera_location, target, lens=55, resolution=720):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene = bpy.context.scene
    engines = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else engines[0]
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 48

    world = bpy.data.worlds.new("PreviewWorld")
    if world.node_tree is None:
        world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba("#0b1220")
    background.inputs["Strength"].default_value = 0.8
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.01))
    _finish(bpy.context.active_object, "PreviewGround", make_material("PreviewGround", "#2a2f38", roughness=0.95))

    bpy.ops.object.light_add(type="SUN", location=(6, -8, 12))
    sun = bpy.context.active_object
    sun.data.energy = 3.2
    sun.data.angle = 0.12
    _aim(sun, (0, 0, 1.5))

    bpy.ops.object.light_add(type="AREA", location=(-7, -5, 7))
    fill = bpy.context.active_object
    fill.data.energy = 420
    fill.data.size = 6
    fill.data.color = (0.55, 0.72, 1.0)
    _aim(fill, target)

    bpy.ops.object.light_add(type="AREA", location=(3, 7, 6))
    rim = bpy.context.active_object
    rim.data.energy = 320
    rim.data.size = 5
    rim.data.color = (0.65, 0.82, 1.0)
    _aim(rim, target)

    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.active_object
    camera.data.lens = lens
    _aim(camera, target)
    scene.camera = camera

    bpy.ops.render.render(write_still=True)
    print(f"PREVIEW {path}")


# ---------------------------------------------------------------------------
# Rover
# ---------------------------------------------------------------------------


def build_rover(palette):
    body = []

    # Main chassis and gold-foil side panels.
    body.append(box("Chassis", (1.68, 2.9, 0.32), (0, 0, 0.72), palette.white, bevel=0.07))
    body.append(box("Skirt", (1.5, 2.7, 0.2), (0, 0, 0.52), palette.dark, bevel=0.04))
    body.append(box("Deck", (1.62, 2.2, 0.06), (0, -0.15, 0.91), palette.panel, bevel=0.02))
    for side in (-1, 1):
        body.append(box(f"FoilSide{side}", (0.035, 2.55, 0.22), (side * 0.855, 0, 0.7), palette.gold))
    body.append(box("FoilFront", (1.55, 0.035, 0.22), (0, -1.465, 0.7), palette.gold))

    # Nose and bumpers.
    body.append(box("Nose", (1.5, 0.5, 0.3), (0, -1.55, 0.84), palette.white, bevel=0.07))
    body.append(box("FrontBumper", (1.62, 0.12, 0.16), (0, -1.82, 0.58), palette.orange, bevel=0.03))
    body.append(box("RearBumper", (1.62, 0.12, 0.16), (0, 1.5, 0.58), palette.orange, bevel=0.03))
    body.append(box("NoseStripe", (0.95, 0.03, 0.06), (0, -1.805, 0.93), palette.orange))

    # Headlights.
    for side in (-1, 1):
        body.append(box(f"LampHousing{side}", (0.28, 0.06, 0.16), (side * 0.54, -1.8, 0.9), palette.dark))
        body.append(box(f"Headlight{side}", (0.22, 0.02, 0.1), (side * 0.54, -1.836, 0.9), palette.glow_white))

    # Six wheels with tread blocks and orange hubs.
    wheel_centers = [(-1.05, -0.98), (0.05, -0.98), (1.15, -0.98), (-1.05, 0.98), (0.05, 0.98), (1.15, 0.98)]
    for axle_y, side in wheel_centers:
        x = side
        body.append(cylinder(f"Tire_{axle_y}_{side}", 0.37, 0.28, (x, axle_y, 0.37), palette.black, axis="X", verts=14))
        body.append(cylinder(f"Hub_{axle_y}_{side}", 0.13, 0.3, (x, axle_y, 0.37), palette.orange, axis="X", verts=12))
        body.append(cylinder(f"HubCap_{axle_y}_{side}", 0.055, 0.32, (x, axle_y, 0.37), palette.dark, axis="X", verts=10))
        for tread in range(12):
            angle = tread * math.pi * 2 / 12
            body.append(
                box(
                    f"Tread_{axle_y}_{side}_{tread}",
                    (0.3, 0.09, 0.07),
                    (x, axle_y + math.sin(angle) * 0.355, 0.37 + math.cos(angle) * 0.355),
                    palette.black,
                    rotation=(angle, 0, 0),
                )
            )
        # Fender over each wheel, plus the rocker arm linking the axles.
        body.append(box(f"Fender_{axle_y}_{side}", (0.3, 0.78, 0.07), (x, axle_y, 0.8), palette.white, bevel=0.03))
        body.append(box(f"FenderEdge_{axle_y}_{side}", (0.31, 0.78, 0.03), (x, axle_y, 0.845), palette.orange))
        body.append(tube(f"Strut_{axle_y}_{side}", (x, axle_y, 0.44), (x, axle_y, 0.37), 0.055, palette.metal))
    for side in (-1, 1):
        body.append(tube(f"RockerA{side}", (side * 0.92, -1.05, 0.44), (side * 0.92, 0.05, 0.44), 0.045, palette.dark))
        body.append(tube(f"RockerB{side}", (side * 0.92, 0.05, 0.44), (side * 0.92, 1.15, 0.44), 0.045, palette.dark))
        body.append(box(f"Step{side}", (0.16, 1.0, 0.06), (side * 0.87, -0.55, 0.46), palette.dark))

    # Cargo bed at the back.
    body.append(box("BedFloor", (1.56, 0.82, 0.06), (0, 1.04, 0.98), palette.dark))
    for side in (-1, 1):
        body.append(box(f"BedWallSide{side}", (0.06, 0.82, 0.3), (side * 0.78, 1.04, 1.1), palette.white, bevel=0.02))
    body.append(box("BedWallRear", (1.56, 0.06, 0.3), (0, 1.43, 1.1), palette.white, bevel=0.02))
    body.append(box("CrateA", (0.5, 0.52, 0.4), (-0.37, 1.06, 1.22), palette.panel, bevel=0.03))
    body.append(box("CrateB", (0.5, 0.52, 0.32), (0.37, 1.06, 1.18), palette.gold, bevel=0.03))
    for name, x in (("StrapA", -0.37), ("StrapB", 0.37)):
        body.append(box(name, (0.08, 0.54, 0.41), (x, 1.06, 1.22), palette.orange))
    body.append(box("SampleCase", (0.26, 0.26, 0.18), (0.0, 1.3, 1.17), palette.white, bevel=0.02))

    # Seats and dashboard.
    for side in (-1, 1):
        x = side * 0.38
        body.append(box(f"SeatBase{side}", (0.44, 0.46, 0.1), (x, -0.34, 0.99), palette.dark, bevel=0.03))
        body.append(
            box(
                f"SeatBack{side}",
                (0.44, 0.12, 0.5),
                (x, -0.06, 1.26),
                palette.dark,
                rotation=(0.12, 0, 0),
                bevel=0.03,
            )
        )
        body.append(box(f"SeatHead{side}", (0.26, 0.1, 0.16), (x, -0.02, 1.57), palette.dark, bevel=0.03))
        body.append(box(f"SeatStripe{side}", (0.1, 0.015, 0.34), (x, -0.125, 1.28), palette.orange))
    body.append(box("Dashboard", (1.35, 0.16, 0.22), (0, -1.0, 1.02), palette.dark, bevel=0.03))
    body.append(box("DashScreen", (0.52, 0.02, 0.09), (0, -1.09, 1.06), palette.glow_teal))
    body.append(box("DashButtonA", (0.05, 0.02, 0.04), (-0.36, -1.09, 1.05), palette.amber))
    body.append(box("DashButtonB", (0.05, 0.02, 0.04), (-0.27, -1.09, 1.05), palette.glow_white))

    # Roll cage: a strong silhouette cue seen from the tilted camera.
    cage_top = 1.94
    for x in (-0.82, 0.82):
        for y in (-0.98, 0.52):
            body.append(tube(f"CagePost{x}_{y}", (x, y, 0.92), (x, y, cage_top), 0.035, palette.orange))
    for x in (-0.82, 0.82):
        body.append(tube(f"CageRail{x}", (x, -0.98, cage_top), (x, 0.52, cage_top), 0.035, palette.orange))
    body.append(tube("CageFront", (-0.82, -0.98, cage_top), (0.82, -0.98, cage_top), 0.035, palette.orange))
    body.append(tube("CageRear", (-0.82, 0.52, cage_top), (0.82, 0.52, cage_top), 0.035, palette.orange))
    body.append(tube("CageBraceL", (-0.82, -0.98, 1.45), (0.82, -0.98, 1.45), 0.025, palette.metal))
    for side in (-1, 1):
        body.append(box(f"CageLight{side}", (0.1, 0.08, 0.06), (side * 0.82, -0.98, 1.98), palette.amber))

    # Sensor mast with stereo cameras and a front work light.
    body.append(tube("Mast", (0.62, -1.18, 0.9), (0.62, -1.18, 2.08), 0.04, palette.metal))
    body.append(box("MastBar", (0.56, 0.05, 0.05), (0.62, -1.18, 2.05), palette.metal))
    for side, x in ((-1, 0.4), (1, 0.84)):
        body.append(box(f"CamHousing{side}", (0.15, 0.2, 0.13), (x, -1.24, 2.02), palette.dark, bevel=0.02))
        body.append(box(f"CamLens{side}", (0.09, 0.02, 0.07), (x, -1.345, 2.02), palette.glow_teal))
    body.append(box("WorkLightHousing", (0.24, 0.08, 0.14), (0.62, -1.23, 1.72), palette.dark))
    body.append(box("WorkLight", (0.18, 0.02, 0.08), (0.62, -1.28, 1.72), palette.glow_white))

    # Whip antenna at the rear.
    body.append(tube("Whip", (-0.76, 1.22, 1.08), (-0.76, 1.22, 1.98), 0.012, palette.metal))
    body.append(sphere("WhipTip", 0.035, (-0.76, 1.22, 2.0), palette.orange, segments=8, rings=4))

    rover_body = join(body, "RoverBody")

    # Dish on a rear pivot, high enough to clear the cage and read from the
    # follow camera.
    dish_pivot = empty("RoverDish", (-0.55, 1.45, 2.05))
    dish_parts = [
        box("DishBracket", (0.16, 0.16, 0.12), (-0.55, 1.45, 0.66), palette.dark, bevel=0.02),
        tube("DishMast", (-0.55, 1.45, 0.62), (-0.55, 1.45, 2.0), 0.04, palette.metal),
        cone("DishBowl", 0.38, 0.1, 0.14, (-0.55, 1.52, 2.06), palette.white_dark, verts=16, rotation=(-0.55, 0, 0)),
        torus("DishRim", 0.36, 0.025, (-0.55, 1.52, 2.06), palette.metal, rotation=(-0.55, 0, 0), major_segments=16),
        tube("DishFeed", (-0.55, 1.52, 2.06), (-0.55, 1.69, 2.21), 0.018, palette.dark),
        sphere("DishFeedTip", 0.045, (-0.55, 1.69, 2.21), palette.orange, segments=8, rings=4),
    ]
    dish_mesh = join(dish_parts, "RoverDishMesh")
    parent_keep(dish_mesh, dish_pivot)

    beacon = sphere("RoverBeacon", 0.065, (0.62, -1.18, 2.2), palette.glow_red, segments=8, rings=4)

    return rover_body, dish_pivot, beacon


# ---------------------------------------------------------------------------
# Lander
# ---------------------------------------------------------------------------


def build_lander(palette):
    body = []

    # Descent stage with a gold thermal blanket.
    body.append(cylinder("DescentStage", 2.05, 1.55, (0, 0, 2.15), palette.white_dark, verts=16, bevel=0.05))
    body.append(cylinder("FoilBand", 2.08, 0.62, (0, 0, 1.76), palette.gold, verts=16))
    body.append(cylinder("StageRing", 2.03, 0.12, (0, 0, 2.96), palette.dark, verts=16))
    for index, angle in enumerate((0.4, 1.9, 3.6, 5.0)):
        x = math.cos(angle) * 1.98
        y = math.sin(angle) * 1.98
        body.append(
            box(
                f"EquipmentBay{index}",
                (0.55, 0.22, 0.32),
                (x, y, 2.35),
                palette.panel,
                rotation=(0, 0, angle + math.pi / 2),
                bevel=0.02,
            )
        )
        body.append(
            box(
                f"EquipmentVent{index}",
                (0.35, 0.03, 0.16),
                (math.cos(angle) * 2.1, math.sin(angle) * 2.1, 2.35),
                palette.dark,
                rotation=(0, 0, angle + math.pi / 2),
            )
        )

    # Cargo module with a framed front door and an emblem.
    body.append(box("CargoModule", (2.7, 2.5, 1.9), (0, 0, 3.98), palette.white, bevel=0.12, segments=3))
    body.append(box("RoofDeck", (2.5, 2.3, 0.1), (0, 0, 4.98), palette.panel, bevel=0.03))
    body.append(box("Door", (1.5, 0.05, 1.25), (0, -1.285, 3.9), palette.dark, bevel=0.02))
    for side in (-1, 1):
        body.append(box(f"DoorFrameVertical{side}", (0.09, 0.07, 1.4), (side * 0.79, -1.3, 3.9), palette.orange))
    body.append(box("DoorFrameTop", (1.66, 0.07, 0.09), (0, -1.3, 4.6), palette.orange))
    body.append(box("DoorFrameBottom", (1.66, 0.07, 0.09), (0, -1.3, 3.2), palette.orange))
    for index, z in enumerate((3.42, 3.62, 3.82, 4.02, 4.22)):
        body.append(box(f"DoorHazard{index}", (1.3, 0.02, 0.08), (0, -1.315, z), palette.orange))
    body.append(cylinder("DoorHandle", 0.09, 0.05, (0.52, -1.32, 3.85), palette.metal, axis="Y", verts=12))
    body.append(cylinder("EmblemDisc", 0.34, 0.04, (0, -1.315, 4.38), palette.white_dark, axis="Y", verts=24))
    body.append(torus("EmblemRing", 0.21, 0.025, (0, -1.34, 4.38), palette.orange, rotation=(math.pi / 2, 0, 0), major_segments=20))

    # Side equipment and a porthole on each side.
    for side in (-1, 1):
        body.append(
            box(
                f"SideRack{side}",
                (0.1, 0.62, 0.42),
                (side * 1.39, 0.35, 3.62),
                palette.panel,
                bevel=0.02,
            )
        )
        body.append(
            cylinder(
                f"Porthole{side}",
                0.2,
                0.04,
                (side * 1.375, -0.45, 4.28),
                palette.glass,
                axis="X",
                verts=16,
            )
        )
        body.append(
            torus(
                f"PortholeRing{side}",
                0.2,
                0.028,
                (side * 1.4, -0.45, 4.28),
                palette.orange,
                rotation=(0, math.pi / 2, 0),
                major_segments=16,
            )
        )

    # Deployed solar wings.
    for side in (-1, 1):
        body.append(tube(f"WingArm{side}", (side * 1.25, 0.2, 5.02), (side * 1.85, 0.2, 5.02), 0.045, palette.metal))
        body.append(
            box(
                f"WingFrame{side}",
                (2.1, 1.5, 0.05),
                (side * 2.55, 0.2, 5.02),
                palette.metal,
                bevel=0.02,
            )
        )
        body.append(box(f"WingPanel{side}", (2.0, 1.4, 0.03), (side * 2.55, 0.2, 5.055), palette.solar))
        for index in range(1, 4):
            body.append(
                box(
                    f"WingRib{side}_{index}",
                    (0.02, 1.4, 0.02),
                    (side * (2.55 - 0.5 + index * 0.33), 0.2, 5.075),
                    palette.metal,
                )
            )

    # Engine bell under the descent stage.
    body.append(cone("EngineBell", 0.95, 0.55, 0.9, (0, 0, 0.95), palette.dark, verts=16))
    body.append(torus("EngineRim", 0.92, 0.045, (0, 0, 0.52), palette.metal, major_segments=18))

    # Four splayed legs with braces and footpads.
    for index, angle in enumerate((math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4)):
        attach = Vector((math.cos(angle) * 1.55, math.sin(angle) * 1.55, 2.45))
        foot = Vector((math.cos(angle) * 3.0, math.sin(angle) * 3.0, 0.12))
        mid = attach.lerp(foot, 0.45)
        knee = Vector((math.cos(angle) * 1.75, math.sin(angle) * 1.75, 1.9))
        body.append(tube(f"LegMain{index}", attach, foot, 0.09, palette.metal))
        body.append(tube(f"LegBrace{index}", knee, mid, 0.055, palette.metal))
        body.append(sphere(f"LegJoint{index}", 0.12, attach, palette.dark, segments=10, rings=5))
        body.append(cylinder(f"FootPad{index}", 0.42, 0.12, (foot.x, foot.y, 0.06), palette.dark, verts=14))
        body.append(cylinder(f"FootDisc{index}", 0.3, 0.02, (foot.x, foot.y, 0.13), palette.panel, verts=14))

    # Front ladder up to the cargo door.
    for side in (-1, 1):
        body.append(
            tube(
                f"LadderRail{side}",
                (side * 0.28, -2.35, 0.12),
                (side * 0.28, -1.42, 3.36),
                0.03,
                palette.metal,
            )
        )
    for index in range(10):
        fraction = index / 9
        y = -2.35 + ( -1.42 + 2.35 ) * fraction
        z = 0.12 + (3.36 - 0.12) * fraction
        body.append(tube(f"LadderRung{index}", (-0.28, y, z), (0.28, y, z), 0.022, palette.metal))

    # Aft plumbing.
    body.append(tube("PlumbingA", (-0.55, 1.88, 1.3), (-0.55, 1.88, 2.9), 0.04, palette.metal))
    body.append(tube("PlumbingB", (0.55, 1.88, 1.3), (0.55, 1.88, 2.9), 0.04, palette.metal))
    body.append(box("AftBox", (0.9, 0.3, 0.45), (0, 1.95, 2.15), palette.panel, bevel=0.03))

    # A dark blast ring grounds the lander on the regolith.
    body.append(torus("BlastRing", 3.35, 0.09, (0, 0, 0.02), palette.dark, major_segments=28))

    lander_body = join(body, "LanderBody")

    dish_pivot = empty("LanderDish", (1.05, 0.25, 5.62))
    dish_parts = [
        tube("LanderDishMast", (1.05, 0.25, 4.98), (1.05, 0.25, 5.52), 0.05, palette.metal),
        cone("LanderDishBowl", 0.46, 0.12, 0.16, (1.05, 0.38, 5.58), palette.white_dark, verts=18, rotation=(-0.6, 0, 0)),
        torus("LanderDishRim", 0.44, 0.03, (1.05, 0.38, 5.58), palette.metal, rotation=(-0.6, 0, 0), major_segments=18),
        tube("LanderDishFeed", (1.05, 0.38, 5.58), (1.05, 0.58, 5.76), 0.02, palette.dark),
        sphere("LanderDishTip", 0.05, (1.05, 0.58, 5.76), palette.orange, segments=8, rings=4),
    ]
    dish_mesh = join(dish_parts, "LanderDishMesh")
    parent_keep(dish_mesh, dish_pivot)

    beacon = sphere("LanderBeacon", 0.08, (-1.05, 0.3, 5.15), palette.glow_red, segments=8, rings=4)
    return lander_body, dish_pivot, beacon


# ---------------------------------------------------------------------------
# Astronaut
# ---------------------------------------------------------------------------


def build_astronaut(palette):
    root = empty("AstronautRoot", (0, 0, 0))
    torso_pivot = empty("Torso", (0, 0, 0.92))

    torso_parts = []
    # Chest, pelvis and orange harness.
    torso_parts.append(box("Chest", (0.54, 0.36, 0.58), (0, 0, 1.14), palette.white, bevel=0.09, segments=3))
    torso_parts.append(box("Pelvis", (0.46, 0.33, 0.22), (0, 0, 0.86), palette.white_dark, bevel=0.06))
    torso_parts.append(box("Belt", (0.5, 0.37, 0.08), (0, 0, 0.94), palette.orange, bevel=0.02))
    torso_parts.append(box("ChestPanel", (0.34, 0.05, 0.25), (0, -0.195, 1.18), palette.dark, bevel=0.02))
    torso_parts.append(box("ChestDisplay", (0.24, 0.02, 0.055), (0, -0.225, 1.24), palette.glow_teal))
    torso_parts.append(box("ChestPatch", (0.09, 0.015, 0.1), (0.16, -0.205, 1.08), palette.orange))
    for side in (-1, 1):
        torso_parts.append(box(f"Harness{side}", (0.05, 0.02, 0.44), (side * 0.15, -0.2, 1.17), palette.orange))
        torso_parts.append(box(f"Pouch{side}", (0.12, 0.08, 0.14), (side * 0.27, 0.08, 0.9), palette.white_dark, bevel=0.02))

    # Shoulder yoke and arms' attachment points.
    for side in (-1, 1):
        torso_parts.append(box(f"Shoulder{side}", (0.2, 0.36, 0.18), (side * 0.34, 0, 1.34), palette.white, bevel=0.05))
        torso_parts.append(box(f"ShoulderStripe{side}", (0.21, 0.36, 0.035), (side * 0.34, 0, 1.43), palette.orange))
        torso_parts.append(sphere(f"ShoulderJoint{side}", 0.11, (side * 0.39, 0, 1.26), palette.white_dark, segments=10, rings=5))

    # Neck ring and helmet.
    torso_parts.append(torus("NeckRing", 0.19, 0.038, (0, 0, 1.44), palette.dark, major_segments=18))
    torso_parts.append(sphere("Helmet", 0.3, (0, 0, 1.66), palette.white, segments=20, rings=12, scale=(1.0, 0.98, 1.0)))
    torso_parts.append(sphere("Visor", 1.0, (0, -0.155, 1.66), palette.visor, segments=20, rings=12, scale=(0.235, 0.16, 0.19)))
    torso_parts.append(torus("VisorRim", 0.225, 0.022, (0, -0.2, 1.66), palette.dark, rotation=(math.pi / 2, 0, 0), major_segments=20))
    for side in (-1, 1):
        torso_parts.append(box(f"HelmetLamp{side}", (0.08, 0.06, 0.05), (side * 0.26, -0.14, 1.79), palette.glow_white))
        torso_parts.append(box(f"HelmetLampHousing{side}", (0.11, 0.08, 0.08), (side * 0.26, -0.12, 1.79), palette.white_dark))

    # PLSS backpack with two tanks: the most visible shape from the camera.
    # Keep the PLSS light: the follow camera usually sees the astronaut from
    # behind, where the suit is backlit by the outpost.
    torso_parts.append(box("Backpack", (0.56, 0.3, 0.64), (0, 0.29, 1.16), palette.white, bevel=0.06))
    for side in (-1, 1):
        torso_parts.append(
            cylinder(f"Tank{side}", 0.075, 0.52, (side * 0.16, 0.45, 1.16), palette.white_dark, verts=10)
        )
        torso_parts.append(torus(f"TankBand{side}", 0.08, 0.018, (side * 0.16, 0.45, 1.25), palette.orange, major_segments=12))
        torso_parts.append(tube(f"BackpackStrut{side}", (side * 0.26, 0.3, 1.4), (side * 0.32, 0.17, 1.22), 0.025, palette.metal))
    torso_parts.append(box("BackpackTop", (0.4, 0.16, 0.06), (0, 0.32, 1.5), palette.orange, bevel=0.02))
    torso_parts.append(box("BackpackBadge", (0.16, 0.02, 0.1), (0, 0.446, 1.32), palette.orange))

    # Suit hoses from the backpack to the chest panel.
    torso_parts.append(
        hose(
            "HoseL",
            [(-0.26, 0.34, 1.24), (-0.35, 0.2, 1.12), (-0.31, -0.05, 1.05), (-0.2, -0.19, 1.13)],
            0.022,
            palette.dark,
        )
    )
    torso_parts.append(
        hose(
            "HoseR",
            [(0.26, 0.34, 1.24), (0.35, 0.2, 1.12), (0.31, -0.05, 1.05), (0.2, -0.19, 1.13)],
            0.022,
            palette.dark,
        )
    )
    torso_parts.append(tube("AntennaRod", (0.2, 0.4, 1.46), (0.2, 0.4, 1.83), 0.012, palette.metal))

    torso_mesh = join(torso_parts, "TorsoMesh")
    parent_keep(torso_mesh, torso_pivot)

    chest_light = box("ChestLight", (0.2, 0.012, 0.045), (0, -0.238, 1.24), palette.glow_teal)
    parent_keep(chest_light, torso_pivot)

    antenna_light = sphere("AntennaLight", 0.04, (0.2, 0.4, 1.86), palette.glow_red, segments=8, rings=4)
    parent_keep(antenna_light, torso_pivot)

    # Arms: shoulder pivots, rigid low-poly segments.
    arms = []
    for side in (-1, 1):
        pivot = empty(f"Arm{'L' if side < 0 else 'R'}", (side * 0.39, 0, 1.26))
        parts = []
        parts.append(cylinder(f"UpperArm{side}", 0.075, 0.3, (side * 0.39, 0, 1.1), palette.white, verts=10))
        parts.append(torus(f"ArmBand{side}", 0.078, 0.022, (side * 0.39, 0, 1.02), palette.orange, major_segments=12))
        parts.append(sphere(f"Elbow{side}", 0.08, (side * 0.39, 0, 0.94), palette.white_dark, segments=10, rings=5))
        parts.append(cylinder(f"Forearm{side}", 0.068, 0.28, (side * 0.39, 0, 0.8), palette.white, verts=10))
        parts.append(torus(f"Cuff{side}", 0.075, 0.02, (side * 0.39, 0, 0.69), palette.orange, major_segments=12))
        parts.append(box(f"Glove{side}", (0.15, 0.16, 0.16), (side * 0.39, 0, 0.62), palette.dark, bevel=0.04))
        arm_mesh = join(parts, f"Arm{'L' if side < 0 else 'R'}_Mesh")
        parent_keep(arm_mesh, pivot)
        arms.append(pivot)

    # Legs: hip pivots, boots resting exactly on the floor.
    legs = []
    for side in (-1, 1):
        pivot = empty(f"Leg{'L' if side < 0 else 'R'}", (side * 0.17, 0, 0.8))
        parts = []
        parts.append(sphere(f"Hip{side}", 0.12, (side * 0.17, 0, 0.79), palette.white_dark, segments=10, rings=5))
        parts.append(cylinder(f"Thigh{side}", 0.1, 0.34, (side * 0.17, 0, 0.61), palette.white, verts=10))
        parts.append(sphere(f"Knee{side}", 0.105, (side * 0.17, 0, 0.43), palette.white_dark, segments=10, rings=5))
        parts.append(box(f"KneePad{side}", (0.12, 0.05, 0.12), (side * 0.17, -0.09, 0.43), palette.orange, bevel=0.02))
        parts.append(cylinder(f"Shin{side}", 0.085, 0.3, (side * 0.17, 0, 0.27), palette.white, verts=10))
        parts.append(box(f"ShinStripe{side}", (0.06, 0.03, 0.16), (side * 0.17, -0.08, 0.27), palette.orange))
        parts.append(box(f"Boot{side}", (0.18, 0.29, 0.15), (side * 0.17, -0.045, 0.075), palette.dark, bevel=0.035))
        parts.append(box(f"BootCap{side}", (0.16, 0.06, 0.08), (side * 0.17, -0.16, 0.06), palette.orange, bevel=0.02))
        leg_mesh = join(parts, f"Leg{'L' if side < 0 else 'R'}_Mesh")
        parent_keep(leg_mesh, pivot)
        legs.append(pivot)

    # Assemble the root.
    parent_keep(torso_pivot, root)
    for obj in arms + legs:
        parent_keep(obj, root)

    return root, torso_pivot, arms, legs, chest_light, antenna_light


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def build_rover_asset():
    reset_scene()
    palette = Palette()
    build_rover(palette)
    os.makedirs(OUT_DIR, exist_ok=True)
    export_glb(os.path.join(OUT_DIR, "rover.glb"))
    preview(
        os.path.join(PREVIEW_DIR, "preview_rover.png"),
        camera_location=(5.4, -6.8, 4.4),
        target=(0, 0, 0.95),
        lens=58,
    )


def build_lander_asset():
    reset_scene()
    palette = Palette()
    build_lander(palette)
    os.makedirs(OUT_DIR, exist_ok=True)
    export_glb(os.path.join(OUT_DIR, "lander.glb"))
    preview(
        os.path.join(PREVIEW_DIR, "preview_lander.png"),
        camera_location=(8.5, -12.5, 9.0),
        target=(0, 0, 2.8),
        lens=52,
    )


def build_astronaut_asset():
    reset_scene()
    palette = Palette()
    build_astronaut(palette)
    os.makedirs(OUT_DIR, exist_ok=True)
    export_glb(os.path.join(OUT_DIR, "astronaut.glb"))
    preview(
        os.path.join(PREVIEW_DIR, "preview_astronaut.png"),
        camera_location=(2.7, -4.0, 2.4),
        target=(0, 0, 1.0),
        lens=62,
    )


def main():
    requested = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    builders = {
        "rover": build_rover_asset,
        "lander": build_lander_asset,
        "astronaut": build_astronaut_asset,
    }
    names = requested or list(builders)
    for name in names:
        if name not in builders:
            raise SystemExit(f"unknown model: {name}")
        print(f"=== BUILD {name} ===")
        builders[name]()
    print("=== DONE ===")


if __name__ == "__main__":
    main()
