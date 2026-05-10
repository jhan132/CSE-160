// asg3.js - CSE-160 Assignment 3
// Joonhee Han - Virtual world (Hard)

// Vertex shader - based on PerspectiveView_mvp pattern (Matsuda Ch.7)
// passes u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix to gl_Position
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_TexCoord;
  varying vec2 v_TexCoord;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_TexCoord = a_TexCoord;
  }
`;

// Fragment shader - extends MultiTexture.js pattern (Matsuda Ch.5)
// u_TexColorWeight blends base color and texture color (per asgn3 instructions)
const FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_TexCoord;
  uniform vec4 u_BaseColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform int u_WhichTexture;
  uniform float u_TexColorWeight;
  void main() {
    vec4 texColor = vec4(1.0, 1.0, 1.0, 1.0);
    if (u_WhichTexture == 0)      texColor = texture2D(u_Sampler0, v_TexCoord);
    else if (u_WhichTexture == 1) texColor = texture2D(u_Sampler1, v_TexCoord);
    else if (u_WhichTexture == 2) texColor = texture2D(u_Sampler2, v_TexCoord);
    else if (u_WhichTexture == 3) texColor = texture2D(u_Sampler3, v_TexCoord);
    gl_FragColor = (1.0 - u_TexColorWeight) * u_BaseColor + u_TexColorWeight * texColor;
  }
`;

// ----- globals -----
let gl;
let canvas;
let camera;

let a_Position, a_TexCoord;
let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_BaseColor, u_WhichTexture, u_TexColorWeight;
let u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3;

// world data
const MAP_SIZE = 32;
let map = [];          // map[x][z] = wall height 0..4
let gems = [];         // [{x, z, collected}]
let userCubes = [];    // blocks added by player at runtime

// reusable cube for drawing (avoid new() in loop)
let drawCube = null;
let groundCube = null;
let skyCube = null;

// keys held down
let keys = {};

// stats
let fpsEl;
let lastFrameTime = 0;
let frameCount = 0;
let fpsTimer = 0;

// game state
let totalGems = 0;
let collected = 0;
let gameMessage = "";

// bat animal
let batTime = 0;

function main() {
  canvas = document.getElementById('webgl');
  gl = getWebGLContext(canvas, false);
  if (!gl) { console.log('no webgl'); return; }

  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('shader init failed'); return;
  }

  if (!getAttribsAndUniforms()) return;

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.5, 0.7, 1.0, 1.0);

  Cube.initBuffer(gl);
  Cube.bindForDraw(gl, a_Position, a_TexCoord);

  drawCube   = new Cube();
  groundCube = new Cube();
  skyCube    = new Cube();

  initTextures();

  buildMap();

  camera = new Camera(canvas);

  setupInput();

  fpsEl = document.getElementById('fps');

  // Note: tick() is started by loadTexture() once all textures finish loading
  // (matches the async pattern from Matsuda's TexturedQuad.js)
}

function getAttribsAndUniforms() {
  a_Position        = gl.getAttribLocation(gl.program, 'a_Position');
  a_TexCoord        = gl.getAttribLocation(gl.program, 'a_TexCoord');
  u_ModelMatrix     = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix      = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix= gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_BaseColor       = gl.getUniformLocation(gl.program, 'u_BaseColor');
  u_WhichTexture    = gl.getUniformLocation(gl.program, 'u_WhichTexture');
  u_TexColorWeight  = gl.getUniformLocation(gl.program, 'u_TexColorWeight');
  u_Sampler0        = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1        = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2        = gl.getUniformLocation(gl.program, 'u_Sampler2');
  u_Sampler3        = gl.getUniformLocation(gl.program, 'u_Sampler3');

  if (a_Position < 0 || a_TexCoord < 0) {
    console.log('attrib lookup failed'); return false;
  }
  return true;
}

// ============================================================
// Texture loading - follows MultiTexture.js pattern from Matsuda Ch.5
// (Listing 5.7, pages 184-187 in the textbook). Each texture goes
// through Image() with .onload calling loadTexture(), exactly like
// the book example. The image data itself is generated procedurally
// via canvas.toDataURL() so we don't need to ship .jpg/.png files.
// ============================================================
let g_texturesReady = 0;
const TOTAL_TEXTURES = 4;

function initTextures() {
  // Create texture objects (matches book line 105-106 in MultiTexture.js)
  const texture0 = gl.createTexture();
  const texture1 = gl.createTexture();
  const texture2 = gl.createTexture();
  const texture3 = gl.createTexture();
  if (!texture0 || !texture1 || !texture2 || !texture3) {
    console.log('Failed to create texture object');
    return false;
  }

  // Create Image objects (book line 121-122)
  const image0 = new Image();
  const image1 = new Image();
  const image2 = new Image();
  const image3 = new Image();

  // Register event handlers (book line 128-129)
  image0.onload = function() { loadTexture(gl, texture0, u_Sampler0, image0, 0); };
  image1.onload = function() { loadTexture(gl, texture1, u_Sampler1, image1, 1); };
  image2.onload = function() { loadTexture(gl, texture2, u_Sampler2, image2, 2); };
  image3.onload = function() { loadTexture(gl, texture3, u_Sampler3, image3, 3); };

  // Tell the browser to load images. Book uses .src = '../resources/file.jpg'.
  // We instead supply data URLs from a procedurally drawn 64x64 canvas
  // (still satisfies the "square + power of 2" requirement from the spec).
  image0.src = makePattern(genDirt).toDataURL();
  image1.src = makePattern(genStone).toDataURL();
  image2.src = makePattern(genGrass).toDataURL();
  image3.src = makePattern(genGem).toDataURL();
  return true;
}

// Same signature as Matsuda's loadTexture (book line 138)
function loadTexture(gl, texture, u_Sampler, image, texUnit) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);             // book line 139
  // Activate the corresponding texture unit
  gl.activeTexture(gl.TEXTURE0 + texUnit);
  // Bind the texture object to the target (book line 149)
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Set texture parameters. Book uses LINEAR; I use NEAREST for pixel-art look.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  // Set the texture image (book line 154)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  // Pass texture unit to the sampler (book line 156)
  gl.uniform1i(u_Sampler, texUnit);

  g_texturesReady++;
  if (g_texturesReady === TOTAL_TEXTURES) {
    // All textures loaded - kick off render loop (similar to book's pattern
    // of only drawing once everything's ready)
    requestAnimationFrame(tick);
  }
}

function makePattern(genFn) {
  const SIZE = 64;  // power of 2, square - per assignment spec
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d');
  genFn(ctx, SIZE);
  return c;
}

function genDirt(ctx, S) {
  ctx.fillStyle = '#7a4a26';
  ctx.fillRect(0, 0, S, S);
  const palette = ['#5a3318', '#8b5a2b', '#6b3e1f', '#4a2308', '#9b6a3c'];
  for (let i = 0; i < 600; i++) {
    const x = (Math.random() * S) | 0;
    const y = (Math.random() * S) | 0;
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect(x, y, 2, 2);
  }
}

function genStone(ctx, S) {
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, S, S);
  const palette = ['#777', '#888', '#aaa', '#666', '#bbb'];
  for (let i = 0; i < 500; i++) {
    const x = (Math.random() * S) | 0;
    const y = (Math.random() * S) | 0;
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect(x, y, 3, 3);
  }
  // crack lines
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * S, Math.random() * S);
    ctx.lineTo(Math.random() * S, Math.random() * S);
    ctx.stroke();
  }
}

function genGrass(ctx, S) {
  ctx.fillStyle = '#4a8a32';
  ctx.fillRect(0, 0, S, S);
  const palette = ['#3a7022', '#5a9a40', '#386818', '#6caa50', '#2a5810'];
  for (let i = 0; i < 800; i++) {
    const x = (Math.random() * S) | 0;
    const y = (Math.random() * S) | 0;
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect(x, y, 2, 2);
  }
}

function genGem(ctx, S) {
  // glowing gold - center radial bright, edges darker
  const grad = ctx.createRadialGradient(S/2, S/2, 2, S/2, S/2, S/1.4);
  grad.addColorStop(0, '#fff4a0');
  grad.addColorStop(0.4, '#ffd840');
  grad.addColorStop(1, '#a07020');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  // sparkle pixels
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() * S) | 0;
    const y = (Math.random() * S) | 0;
    ctx.fillRect(x, y, 2, 2);
  }
  // border
  ctx.strokeStyle = '#806010';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, S - 2, S - 2);
}

// ============================================================
// World building
// ============================================================
function buildMap() {
  // start with empty 32x32
  for (let i = 0; i < MAP_SIZE; i++) {
    map[i] = new Array(MAP_SIZE).fill(0);
  }

  // outer perimeter walls
  for (let i = 0; i < MAP_SIZE; i++) {
    map[0][i] = 4;
    map[MAP_SIZE - 1][i] = 4;
    map[i][0] = 4;
    map[i][MAP_SIZE - 1] = 4;
  }

  // small "house" in upper-left quadrant (with doorway)
  for (let i = 3; i <= 7; i++) {
    map[i][3] = 2;
    map[i][7] = 2;
  }
  for (let j = 3; j <= 7; j++) {
    map[3][j] = 2;
    map[7][j] = 2;
  }
  map[7][5] = 0; // doorway

  // tower in opposite corner
  for (let i = 24; i <= 28; i++) {
    map[i][3] = 3;
    map[i][7] = 3;
  }
  for (let j = 3; j <= 7; j++) {
    map[24][j] = 3;
    map[28][j] = 3;
  }
  map[26][3] = 0; // entrance

  // central square plaza with corner pillars
  map[14][14] = 4; map[14][17] = 4;
  map[17][14] = 4; map[17][17] = 4;
  map[15][14] = 1; map[16][14] = 1;
  map[15][17] = 1; map[16][17] = 1;
  map[14][15] = 1; map[14][16] = 1;
  map[17][15] = 1; map[17][16] = 1;

  // some scattered pillars
  const pillars = [
    [10, 22, 3], [22, 11, 2], [9, 12, 4], [21, 25, 3],
    [6, 22, 2],  [25, 18, 3], [12, 26, 2], [18, 8, 4]
  ];
  for (const [x, z, h] of pillars) map[x][z] = h;

  // staircase block
  for (let i = 0; i < 4; i++) {
    map[3 + i][22] = i + 1;
  }

  // some short walls forming a chunk of maze
  for (let j = 11; j <= 17; j++) map[10][j] = 2;
  map[10][14] = 0; // gap
  for (let i = 11; i <= 16; i++) map[i][20] = 2;
  map[13][20] = 0; // gap

  // gems (collectibles for the game)
  const gemSpots = [
    {x: 5,  z: 5},   // inside the house
    {x: 26, z: 5},   // inside the tower
    {x: 16, z: 16},  // center plaza
    {x: 15, z: 25},
    {x: 25, z: 25},
    {x: 5,  z: 20},
    {x: 13, z: 13},
    {x: 28, z: 14}
  ];
  for (const g of gemSpots) {
    gems.push({ x: g.x, z: g.z, collected: false });
  }
  totalGems = gems.length;
}

// ============================================================
// Input
// ============================================================
function setupInput() {
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    // Q/E rotate (per rubric)
    if (e.key === 'q' || e.key === 'Q') camera.panLeft();
    if (e.key === 'e' || e.key === 'E') camera.panRight();
    // F = add block, G = delete block
    if (e.key === 'f' || e.key === 'F') addBlockInFront();
    if (e.key === 'g' || e.key === 'G') deleteBlockInFront();
  });
  document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  // Mouse rotation w/ pointer lock for proper FPS feel
  canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      const sens = 0.15;
      // horizontal mouse = panLeft/Right, vertical = panUp/Down
      camera.panLeft(-e.movementX * sens);
      camera.panUp(-e.movementY * sens);
    }
  });
}

// poll keys each frame for smooth movement
function processHeldKeys() {
  if (keys['w']) camera.moveForward();
  if (keys['s']) camera.moveBackwards();
  if (keys['a']) camera.moveLeft();
  if (keys['d']) camera.moveRight();
}

// add/delete block in front of camera
function getBlockInFrontPos() {
  const f = camera.getForward();
  // step ~1.5 units in front
  const px = camera.eye.elements[0] + f.elements[0] * 1.5;
  const pz = camera.eye.elements[2] + f.elements[2] * 1.5;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  return { ix, iz };
}

function addBlockInFront() {
  const { ix, iz } = getBlockInFrontPos();
  if (ix < 0 || ix >= MAP_SIZE || iz < 0 || iz >= MAP_SIZE) return;
  if (map[ix][iz] < 4) {
    map[ix][iz] += 1;
    gameMessage = "Block placed!";
    setTimeout(() => { if (gameMessage === "Block placed!") gameMessage = ""; }, 1200);
  }
}

function deleteBlockInFront() {
  const { ix, iz } = getBlockInFrontPos();
  if (ix < 0 || ix >= MAP_SIZE || iz < 0 || iz >= MAP_SIZE) return;
  if (map[ix][iz] > 0) {
    map[ix][iz] -= 1;
    gameMessage = "Block removed!";
    setTimeout(() => { if (gameMessage === "Block removed!") gameMessage = ""; }, 1200);
  }
}

// ============================================================
// Gem game
// ============================================================
function checkGems() {
  if (collected === totalGems) return;
  const ex = camera.eye.elements[0];
  const ez = camera.eye.elements[2];
  for (const g of gems) {
    if (g.collected) continue;
    const dx = (g.x + 0.5) - ex;
    const dz = (g.z + 0.5) - ez;
    if (dx*dx + dz*dz < 1.0) {
      g.collected = true;
      collected++;
      if (collected === totalGems) {
        gameMessage = "🎉 ALL GEMS COLLECTED!";
      } else {
        gameMessage = `Gem ${collected}/${totalGems}!`;
        setTimeout(() => {
          if (gameMessage.startsWith("Gem ")) gameMessage = "";
        }, 1500);
      }
    }
  }
  document.getElementById('gemCount').textContent = `${collected} / ${totalGems}`;
}

// ============================================================
// Render loop
// ============================================================
function tick(time) {
  if (!lastFrameTime) lastFrameTime = time;
  const dt = (time - lastFrameTime) / 1000;
  lastFrameTime = time;

  // FPS counter
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer > 0.5) {
    if (fpsEl) fpsEl.textContent = `FPS: ${(frameCount / fpsTimer).toFixed(0)}`;
    frameCount = 0;
    fpsTimer = 0;
  }

  processHeldKeys();
  checkGems();

  batTime += dt;

  renderScene();

  // HUD update
  const px = camera.eye.elements[0].toFixed(1);
  const pz = camera.eye.elements[2].toFixed(1);
  document.getElementById('pos').textContent = `(${px}, ${pz})`;
  document.getElementById('msg').textContent = gameMessage;

  requestAnimationFrame(tick);
}

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  // === sky cube === (solid blue color, no texture)
  skyCube.color = [0.45, 0.7, 1.0, 1.0];
  skyCube.textureNum = -1;
  skyCube.texColorWeight = 0.0;
  skyCube.matrix.setIdentity();
  skyCube.matrix.translate(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2);
  skyCube.matrix.scale(500, 500, 500);
  skyCube.matrix.translate(-0.5, -0.5, -0.5);
  // disable depth so sky is always behind everything
  gl.disable(gl.DEPTH_TEST);
  skyCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);
  gl.enable(gl.DEPTH_TEST);

  // === ground === (flattened cube, grass texture)
  groundCube.textureNum = 2; // grass
  groundCube.texColorWeight = 1.0;
  groundCube.color = [0.4, 0.7, 0.3, 1.0];
  groundCube.matrix.setIdentity();
  groundCube.matrix.translate(MAP_SIZE / 2, 0, MAP_SIZE / 2);
  groundCube.matrix.scale(MAP_SIZE, 0.01, MAP_SIZE);
  groundCube.matrix.translate(-0.5, 0, -0.5);
  groundCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);

  // === walls === (textured cubes from map)
  drawCube.texColorWeight = 1.0;
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      const h = map[x][z];
      if (h === 0) continue;
      // pick texture by location for variety (multi-texture rubric)
      // outer walls -> stone, inner -> dirt
      const isOuter = (x === 0 || x === MAP_SIZE - 1 || z === 0 || z === MAP_SIZE - 1);
      drawCube.textureNum = isOuter ? 1 : 0;
      drawCube.color = [1, 1, 1, 1];
      for (let y = 0; y < h; y++) {
        drawCube.matrix.setIdentity();
        drawCube.matrix.translate(x, y, z);
        drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);
      }
    }
  }

  // === gems === (gold texture, hover and rotate)
  drawCube.textureNum = 3;
  drawCube.texColorWeight = 1.0;
  for (const g of gems) {
    if (g.collected) continue;
    drawCube.matrix.setIdentity();
    drawCube.matrix.translate(g.x + 0.5, 1.0 + Math.sin(batTime * 2 + g.x) * 0.15, g.z + 0.5);
    drawCube.matrix.rotate(batTime * 60, 0, 1, 0);
    drawCube.matrix.scale(0.3, 0.3, 0.3);
    drawCube.matrix.translate(-0.5, -0.5, -0.5);
    drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);
  }

  // === bat (animal) ===
  drawBat();
}

// ============================================================
// Bat - simplified version of asg2 animal flying around
// 5 cubes: body, head, 2 wings (with flapping). Solid colors.
// ============================================================
function drawBat() {
  // bat orbits center of world
  const orbitR = 8;
  const cx = MAP_SIZE / 2 + Math.cos(batTime * 0.4) * orbitR;
  const cz = MAP_SIZE / 2 + Math.sin(batTime * 0.4) * orbitR;
  const cy = 4 + Math.sin(batTime * 1.2) * 0.5;
  const facing = batTime * 0.4 * 180 / Math.PI + 90;
  const wingFlap = Math.sin(batTime * 8) * 30;

  // body - dark purple
  drawCube.textureNum = -1;
  drawCube.texColorWeight = 0.0;
  drawCube.color = [0.25, 0.15, 0.35, 1.0];
  drawCube.matrix.setIdentity();
  drawCube.matrix.translate(cx, cy, cz);
  drawCube.matrix.rotate(facing, 0, 1, 0);
  // body
  let body = new Matrix4(drawCube.matrix);
  drawCube.matrix.scale(0.4, 0.4, 0.6);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);

  // head
  drawCube.color = [0.2, 0.1, 0.3, 1.0];
  drawCube.matrix.set(body);
  drawCube.matrix.translate(0, 0.05, 0.3);
  drawCube.matrix.scale(0.3, 0.3, 0.3);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);

  // left wing
  drawCube.color = [0.35, 0.2, 0.4, 1.0];
  drawCube.matrix.set(body);
  drawCube.matrix.translate(-0.2, 0, 0);
  drawCube.matrix.rotate(wingFlap, 0, 0, 1);
  drawCube.matrix.translate(-0.5, -0.05, 0);
  drawCube.matrix.scale(0.5, 0.05, 0.4);
  drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);

  // right wing (opposite flap)
  drawCube.matrix.set(body);
  drawCube.matrix.translate(0.2, 0, 0);
  drawCube.matrix.rotate(-wingFlap, 0, 0, 1);
  drawCube.matrix.translate(0, -0.05, 0);
  drawCube.matrix.scale(0.5, 0.05, 0.4);
  drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);

  // little eye dots (white)
  drawCube.color = [1, 0.9, 0.8, 1.0];
  drawCube.matrix.set(body);
  drawCube.matrix.translate(-0.06, 0.07, 0.45);
  drawCube.matrix.scale(0.04, 0.04, 0.04);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);

  drawCube.matrix.set(body);
  drawCube.matrix.translate(0.06, 0.07, 0.45);
  drawCube.matrix.scale(0.04, 0.04, 0.04);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight);
}
