# Authored 3D models

These GLB files are generated, not hand-edited:

```bash
npm run models
```

The source of truth is `scripts/models/build_models.py`, which uses Blender bpy
to build each asset from primitives and exports it with the glTF exporter.

Blender may print `ERROR Draco mesh compression is not available`; it is
harmless here because the exports do not use Draco. On this machine the build
also patches around a Blender Python build that lacks `_ctypes` (see the
exporter helper in the script).

- `rover.glb` — six-wheel utility rover, parked outside the airlock.
- `lander.glb` — cargo lander with solar wings and a blast ring.
- `astronaut.glb` — rigid-pivot character (Torso, ArmL/R, LegL/R) used by
  `src/world/astronaut.js`.

Conventions: 1 unit = 1 metre, models face -Y in Blender / +Z in Three.js, flat
shading, no textures. Names such as `RoverDish`, `LanderDish`, `RoverBeacon`,
`LanderBeacon`, `ChestLight` and `AntennaLight` are part of the runtime contract
and must be preserved when rebuilding.

The assets are original work for this project; no third-party models or
textures are included.
