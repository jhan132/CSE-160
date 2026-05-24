# CSE 160 — Assignment 4 (Lighting)

Built on top of the Assignment 3 virtual world. Just open `index.html` through a
local server (lighting + the OBJ loader use `fetch`/`XMLHttpRequest`, so opening
the file directly with `file://` may block the `.obj` load — use a server).

```
# from inside this folder:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

```
index.html                  canvas + all lighting UI + script includes
asg4.js                     shaders, world, light, spotlight, render loop, UI
Cube.js                     unit cube [0,1]^3 with position/uv/NORMAL buffers
Sphere.js                   lat/long sphere, Normal = Position
Model.js                    .obj loader (v / vt / vn / f, triangulated)
Camera.js                   first-person camera (unchanged from asg3)
models/torus.obj            sample model the loader reads on startup
lib/                        webgl-utils, webgl-debug, cuon-utils, cuon-matrix
```

## Controls

- **WASD** move, **mouse** (click canvas first) look, **Q/E** turn, **F/G** add/remove block.
- Right panel: toggle **Lighting**, **Normals**, **Spotlight**, **Animate Light**;
  sliders for **light X/Y/Z** and **light color R/G/B**.

## How each rubric item is covered

- **Sphere** — `Sphere.js`, three colored spheres in front of spawn.
- **Lighting (ambient+diffuse+specular) + color slider** — Phong is computed in the
  fragment shader in world coordinates (`asg4.js` FSHADER); the R/G/B sliders drive
  `u_LightColor`.
- **Light marker** — small emissive cube rendered at the light position (and the spot).
- **Lighting on/off button** — `u_LightOn`.
- **Light moves over time + slider** — circular orbit in `tick()` plus the X/Y/Z sliders.
- **Spotlight** — cone test in the fragment shader (`u_Spot*`), with its own toggle.
- **Normal visualization button** — `u_NormalViz` outputs `(N+1)/2` as color.
- **OBJ loaded** — `Model.js` loads `models/torus.obj` and is lit like everything else.
- **World integrated** — the asg3 map, bat, gems, and textures all carry normals now
  and are lit by the same shader.

## Swapping in a different .obj

Drop a converted model into `models/` and change the path in `asg4.js`:

```js
model.loadFromOBJ(gl, 'models/torus.obj');   // <- your file here
```

Export it from Blender per the "Converting 3D Models for use in the 160 Loader"
guide: **Forward Axis = Z, Up Axis = Y**, and under Geometry check only
**Normals + Triangulated Mesh + Apply Modifiers** (everything in Grouping /
Materials / Animation unchecked). If the lighting looks inverted, Edit Mode →
Mesh → Normals → Recalculate Outside, then re-export.

## Submitting

- Zip the whole folder as `Joonhee_Han_Assignment_4.zip` for Canvas.
- Host on GitHub Pages (your `jhan132.github.io/CSE-160` repo) and paste the live
  link as a comment on the Canvas submission.
```
