# CSE-160 Assignment 5 - Three.js World

My Assignment 3 first-person virtual world, re-created in Three.js (r184).

## What carried over from Assignment 3
- Same 32x32 grid world and the same layout: outer stone walls, the house
  (with doorway), the stone tower (with entrance), the central plaza with
  corner pillars, the eight scattered pillars, the staircase, and the maze walls.
- The same 8 collectible gems in the same spots, hovering and spinning.
- The same orbiting bat creature with flapping wings, built from boxes.
- Same first-person controls: WASD to move, mouse to look. Same spawn point.

## New for Assignment 5
- Real lighting with shadows: Ambient + Hemisphere + Directional (sun) + Point (torch).
- A cubemap skybox (6 faces generated from ray directions, so no seams).
- A loaded custom textured 3D model: a treasure chest (models/chest.glb,
  loaded with GLTFLoader) sitting in the tower.
- Everything uses MeshStandardMaterial so it responds to the lights.

## Wow / Extra Feature
The gem game: 8 gems are scattered through the world; walk into one to collect
it. The HUD tracks your count and position, and you get a message when you
grab the last one. (Same mechanic as my A3 world.)

## Rubric checklist
- Basic scene + animated shape + directional light + perspective camera ... yes
- Textured primary shape ... yes (dirt/stone walls, grass ground)
- Custom textured 3D model ... yes (models/chest.glb via GLTFLoader)
- Camera controls with the mouse ... yes (first-person: WASD + PointerLock look)
- 3+ light types ... yes (Ambient, Hemisphere, Directional, Point)
- Skybox ... yes (CubeTexture)
- 20+ primary shapes ... yes (100+ wall cubes, 8 gems, ground, bat parts)
- Extra feature ... yes (gem collection game)

## Running it
Serve the folder over http (VS Code Live Server) and open asgn5.html. Click the
screen to lock the mouse for looking around (press Esc to release). Opening the
file directly with file:// will not work - it needs to be served.

## Files
- asgn5.html ........ page + import map + HUD
- src/main.js ....... all scene code (world, gems, bat, lights, model, controls)
- models/chest.glb .. custom textured model
