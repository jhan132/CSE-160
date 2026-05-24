// asg4.js - CSE-160 Assignment 4 (Lighting)
// Joonhee Han - built on top of the asg3 virtual world.
//
// Adds to the asg3 world: per-vertex normals, normal visualization, a sphere,
// an animated movable point light with a color slider + visible marker, a
// spotlight, a Phong shader (ambient + diffuse + specular computed in the
// fragment shader, in world coordinates), lighting on/off, and a loaded .obj.

// ============================================================
// Shaders
// ============================================================
// Vertex shader: transforms to clip space and forwards world-space position
// and world-space normal to the fragment shader (asgn4 step 6: get lighting
// and normals "both into World Coordinates", using a normal matrix).
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_TexCoord;
  attribute vec3 a_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_NormalMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;

  varying vec2 v_TexCoord;
  varying vec3 v_Normal;     // world-space normal
  varying vec3 v_VertPos;    // world-space vertex position

  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_TexCoord  = a_TexCoord;
    // normal transformed by the normal matrix (inverse transpose of model)
    v_Normal    = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 0.0)));
    // world-space position (no view/projection) for the light vector
    v_VertPos   = vec3(u_ModelMatrix * a_Position);
  }
`;

// Fragment shader: builds the material color exactly like asg3 (texture or
// solid blended by u_TexColorWeight), then applies Phong shading. The only
// thing passed in as the "diffuse color" is that material color; ambient and
// specular coefficients are hard-coded (asgn4 step 6).
const FSHADER_SOURCE = `
  precision mediump float;

  varying vec2 v_TexCoord;
  varying vec3 v_Normal;
  varying vec3 v_VertPos;

  uniform vec4 u_BaseColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform int   u_WhichTexture;
  uniform float u_TexColorWeight;

  uniform int  u_NormalViz;     // 1 = visualize normals as color
  uniform int  u_LightOn;       // 0 = lighting off (show flat material)
  uniform int  u_Emissive;      // 1 = always flat (sky, light markers)

  // point light
  uniform vec3 u_LightPos;
  uniform vec3 u_CameraPos;
  uniform vec3 u_LightColor;

  // spot light
  uniform int  u_SpotOn;
  uniform vec3 u_SpotPos;
  uniform vec3 u_SpotDir;       // direction the cone points (normalized)
  uniform vec3 u_SpotColor;
  uniform float u_SpotCutoff;   // cosine of the cone half-angle

  void main() {
    // ---- material / diffuse color (same blend as asg3) ----
    vec4 texColor = vec4(1.0, 1.0, 1.0, 1.0);
    if (u_WhichTexture == 0)      texColor = texture2D(u_Sampler0, v_TexCoord);
    else if (u_WhichTexture == 1) texColor = texture2D(u_Sampler1, v_TexCoord);
    else if (u_WhichTexture == 2) texColor = texture2D(u_Sampler2, v_TexCoord);
    else if (u_WhichTexture == 3) texColor = texture2D(u_Sampler3, v_TexCoord);
    vec4 mat = (1.0 - u_TexColorWeight) * u_BaseColor + u_TexColorWeight * texColor;

    vec3 N = normalize(v_Normal);

    // ---- normal visualization (asgn4 step 2) ----
    if (u_NormalViz == 1) {
      gl_FragColor = vec4((N + 1.0) / 2.0, 1.0);
      return;
    }

    // ---- lighting off, or emissive object -> flat material ----
    if (u_LightOn == 0 || u_Emissive == 1) {
      gl_FragColor = mat;
      return;
    }

    // ---- Phong: ambient + diffuse + specular ----
    vec3 diffuseColor = mat.rgb;
    vec3 V = normalize(u_CameraPos - v_VertPos);

    // point light
    vec3 L = normalize(u_LightPos - v_VertPos);
    vec3 R = reflect(-L, N);
    float nDotL = max(dot(N, L), 0.0);
    float spec  = pow(max(dot(R, V), 0.0), 32.0);

    vec3 ambient  = 0.3 * diffuseColor;
    vec3 diffuse  = u_LightColor * diffuseColor * nDotL;
    vec3 specular = u_LightColor * spec * 0.8;
    vec3 color = ambient + diffuse + specular;

    // spot light (adds on top, only inside the cone)
    if (u_SpotOn == 1) {
      vec3 toFrag = normalize(v_VertPos - u_SpotPos);
      float cosAngle = dot(toFrag, normalize(u_SpotDir));
      if (cosAngle > u_SpotCutoff) {
        vec3 Ls = -toFrag;                 // fragment -> spot
        vec3 Rs = reflect(-Ls, N);
        float sDotL = max(dot(N, Ls), 0.0);
        float sSpec = pow(max(dot(Rs, V), 0.0), 32.0);
        float edge  = smoothstep(u_SpotCutoff, u_SpotCutoff + 0.04, cosAngle);
        vec3 sDiffuse  = u_SpotColor * diffuseColor * sDotL;
        vec3 sSpecular = u_SpotColor * sSpec * 0.8;
        color += edge * (sDiffuse + sSpecular);
      }
    }

    gl_FragColor = vec4(color, mat.a);
  }
`;

// ============================================================
// Globals
// ============================================================
let gl, canvas, camera;

let a_Position, a_TexCoord, a_Normal;
let u_ModelMatrix, u_NormalMatrix, u_ViewMatrix, u_ProjectionMatrix;
let u_BaseColor, u_WhichTexture, u_TexColorWeight;
let u_Sampler0, u_Sampler1, u_Sampler2, u_Sampler3;
let u_NormalViz, u_LightOn, u_Emissive;
let u_LightPos, u_CameraPos, u_LightColor;
let u_SpotOn, u_SpotPos, u_SpotDir, u_SpotColor, u_SpotCutoff;

// world data (unchanged from asg3)
const MAP_SIZE = 32;
let map = [];
let gems = [];

// reusable drawables
let drawCube = null, groundCube = null, skyCube = null, markerCube = null;
let sphere = null;
let model = null;

// scene spheres (a few, so lighting is easy to read)
let sceneSpheres = [];

// lighting state (asgn4 globals)
let g_lightPos     = [16, 5, 20];
let g_lightColor   = [1.0, 1.0, 1.0];
let g_lightOn      = true;
let g_animateLight = true;
let g_normalViz    = false;

let g_spotOn     = true;
let g_spotPos    = [16, 8, 21];
let g_spotDir    = [0, -1, 0];
let g_spotColor  = [1.0, 1.0, 0.85];
const SPOT_CUTOFF = Math.cos(25 * Math.PI / 180);

// keys / stats / game (unchanged from asg3)
let keys = {};
let fpsEl, lastFrameTime = 0, frameCount = 0, fpsTimer = 0;
let totalGems = 0, collected = 0, gameMessage = "";
let g_time = 0;

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

  Cube.initBuffers(gl);
  Sphere.initBuffers(gl);

  drawCube   = new Cube();
  groundCube = new Cube();
  skyCube    = new Cube();
  markerCube = new Cube();
  sphere     = new Sphere();

  // a few colored spheres placed in front of the spawn point
  sceneSpheres = [
    { pos: [16, 1.5, 22], scale: 2.0, color: [0.85, 0.15, 0.15, 1] }, // red (like the intro image)
    { pos: [13, 1.2, 19], scale: 1.4, color: [0.2, 0.5, 0.9, 1] },    // blue
    { pos: [19, 1.2, 19], scale: 1.4, color: [0.3, 0.8, 0.4, 1] },    // green
  ];

  // OBJ model (see models/torus.obj). Swap this path for any converted model.
  model = new Model();
  model.color = [0.85, 0.78, 0.55, 1];
  model.loadFromOBJ(gl, 'models/torus.obj');

  initTextures();
  buildMap();

  camera = new Camera(canvas);
  setupInput();
  setupUI();

  fpsEl = document.getElementById('fps');
  // tick() starts once all textures finish loading (see loadTexture)
}

function getAttribsAndUniforms() {
  a_Position         = gl.getAttribLocation(gl.program, 'a_Position');
  a_TexCoord         = gl.getAttribLocation(gl.program, 'a_TexCoord');
  a_Normal           = gl.getAttribLocation(gl.program, 'a_Normal');

  u_ModelMatrix      = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_NormalMatrix     = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');

  u_BaseColor        = gl.getUniformLocation(gl.program, 'u_BaseColor');
  u_WhichTexture     = gl.getUniformLocation(gl.program, 'u_WhichTexture');
  u_TexColorWeight   = gl.getUniformLocation(gl.program, 'u_TexColorWeight');
  u_Sampler0         = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1         = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2         = gl.getUniformLocation(gl.program, 'u_Sampler2');
  u_Sampler3         = gl.getUniformLocation(gl.program, 'u_Sampler3');

  u_NormalViz        = gl.getUniformLocation(gl.program, 'u_NormalViz');
  u_LightOn          = gl.getUniformLocation(gl.program, 'u_LightOn');
  u_Emissive         = gl.getUniformLocation(gl.program, 'u_Emissive');
  u_LightPos         = gl.getUniformLocation(gl.program, 'u_LightPos');
  u_CameraPos        = gl.getUniformLocation(gl.program, 'u_CameraPos');
  u_LightColor       = gl.getUniformLocation(gl.program, 'u_LightColor');

  u_SpotOn           = gl.getUniformLocation(gl.program, 'u_SpotOn');
  u_SpotPos          = gl.getUniformLocation(gl.program, 'u_SpotPos');
  u_SpotDir          = gl.getUniformLocation(gl.program, 'u_SpotDir');
  u_SpotColor        = gl.getUniformLocation(gl.program, 'u_SpotColor');
  u_SpotCutoff       = gl.getUniformLocation(gl.program, 'u_SpotCutoff');

  if (a_Position < 0 || a_TexCoord < 0 || a_Normal < 0) {
    console.log('attrib lookup failed'); return false;
  }
  return true;
}

// ============================================================
// Textures (unchanged from asg3 - procedural 64x64 patterns)
// ============================================================
let g_texturesReady = 0;
const TOTAL_TEXTURES = 4;

function initTextures() {
  const texture0 = gl.createTexture();
  const texture1 = gl.createTexture();
  const texture2 = gl.createTexture();
  const texture3 = gl.createTexture();
  if (!texture0 || !texture1 || !texture2 || !texture3) {
    console.log('Failed to create texture object'); return false;
  }
  const image0 = new Image(), image1 = new Image();
  const image2 = new Image(), image3 = new Image();
  image0.onload = function() { loadTexture(gl, texture0, u_Sampler0, image0, 0); };
  image1.onload = function() { loadTexture(gl, texture1, u_Sampler1, image1, 1); };
  image2.onload = function() { loadTexture(gl, texture2, u_Sampler2, image2, 2); };
  image3.onload = function() { loadTexture(gl, texture3, u_Sampler3, image3, 3); };
  image0.src = makePattern(genDirt).toDataURL();
  image1.src = makePattern(genStone).toDataURL();
  image2.src = makePattern(genGrass).toDataURL();
  image3.src = makePattern(genGem).toDataURL();
  return true;
}

function loadTexture(gl, texture, u_Sampler, image, texUnit) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.activeTexture(gl.TEXTURE0 + texUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.uniform1i(u_Sampler, texUnit);
  g_texturesReady++;
  if (g_texturesReady === TOTAL_TEXTURES) requestAnimationFrame(tick);
}

function makePattern(genFn) {
  const SIZE = 64;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  genFn(c.getContext('2d'), SIZE);
  return c;
}

function genDirt(ctx, S) {
  ctx.fillStyle = '#7a4a26'; ctx.fillRect(0, 0, S, S);
  const palette = ['#5a3318', '#8b5a2b', '#6b3e1f', '#4a2308', '#9b6a3c'];
  for (let i = 0; i < 600; i++) {
    const x = (Math.random() * S) | 0, y = (Math.random() * S) | 0;
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect(x, y, 2, 2);
  }
}

function genStone(ctx, S) {
  ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, S, S);
  const palette = ['#777', '#888', '#aaa', '#666', '#bbb'];
  for (let i = 0; i < 500; i++) {
    const x = (Math.random() * S) | 0, y = (Math.random() * S) | 0;
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * S, Math.random() * S);
    ctx.lineTo(Math.random() * S, Math.random() * S);
    ctx.stroke();
  }
}

function genGrass(ctx, S) {
  ctx.fillStyle = '#4a8a32'; ctx.fillRect(0, 0, S, S);
  const palette = ['#3a7022', '#5a9a40', '#386818', '#6caa50', '#2a5810'];
  for (let i = 0; i < 800; i++) {
    const x = (Math.random() * S) | 0, y = (Math.random() * S) | 0;
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect(x, y, 2, 2);
  }
}

function genGem(ctx, S) {
  const grad = ctx.createRadialGradient(S/2, S/2, 2, S/2, S/2, S/1.4);
  grad.addColorStop(0, '#fff4a0'); grad.addColorStop(0.4, '#ffd840'); grad.addColorStop(1, '#a07020');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() * S) | 0, y = (Math.random() * S) | 0;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = '#806010'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2);
}

// ============================================================
// World building (unchanged from asg3)
// ============================================================
function buildMap() {
  for (let i = 0; i < MAP_SIZE; i++) map[i] = new Array(MAP_SIZE).fill(0);
  for (let i = 0; i < MAP_SIZE; i++) {
    map[0][i] = 4; map[MAP_SIZE - 1][i] = 4; map[i][0] = 4; map[i][MAP_SIZE - 1] = 4;
  }
  for (let i = 3; i <= 7; i++) { map[i][3] = 2; map[i][7] = 2; }
  for (let j = 3; j <= 7; j++) { map[3][j] = 2; map[7][j] = 2; }
  map[7][5] = 0;
  for (let i = 24; i <= 28; i++) { map[i][3] = 3; map[i][7] = 3; }
  for (let j = 3; j <= 7; j++) { map[24][j] = 3; map[28][j] = 3; }
  map[26][3] = 0;
  map[14][14] = 4; map[14][17] = 4; map[17][14] = 4; map[17][17] = 4;
  map[15][14] = 1; map[16][14] = 1; map[15][17] = 1; map[16][17] = 1;
  map[14][15] = 1; map[14][16] = 1; map[17][15] = 1; map[17][16] = 1;
  const pillars = [[10,22,3],[22,11,2],[9,12,4],[21,25,3],[6,22,2],[25,18,3],[12,26,2],[18,8,4]];
  for (const [x, z, h] of pillars) map[x][z] = h;
  for (let i = 0; i < 4; i++) map[3 + i][22] = i + 1;
  for (let j = 11; j <= 17; j++) map[10][j] = 2; map[10][14] = 0;
  for (let i = 11; i <= 16; i++) map[i][20] = 2; map[13][20] = 0;
  const gemSpots = [{x:5,z:5},{x:26,z:5},{x:16,z:16},{x:15,z:25},{x:25,z:25},{x:5,z:20},{x:13,z:13},{x:28,z:14}];
  for (const g of gemSpots) gems.push({ x: g.x, z: g.z, collected: false });
  totalGems = gems.length;
}

// ============================================================
// Input (unchanged from asg3)
// ============================================================
function setupInput() {
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'q' || e.key === 'Q') camera.panLeft();
    if (e.key === 'e' || e.key === 'E') camera.panRight();
    if (e.key === 'f' || e.key === 'F') addBlockInFront();
    if (e.key === 'g' || e.key === 'G') deleteBlockInFront();
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('click', () => { canvas.requestPointerLock(); });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      const sens = 0.15;
      camera.panLeft(-e.movementX * sens);
      camera.panUp(-e.movementY * sens);
    }
  });
}

function processHeldKeys() {
  if (keys['w']) camera.moveForward();
  if (keys['s']) camera.moveBackwards();
  if (keys['a']) camera.moveLeft();
  if (keys['d']) camera.moveRight();
}

function getBlockInFrontPos() {
  const f = camera.getForward();
  const px = camera.eye.elements[0] + f.elements[0] * 1.5;
  const pz = camera.eye.elements[2] + f.elements[2] * 1.5;
  return { ix: Math.floor(px), iz: Math.floor(pz) };
}

function addBlockInFront() {
  const { ix, iz } = getBlockInFrontPos();
  if (ix < 0 || ix >= MAP_SIZE || iz < 0 || iz >= MAP_SIZE) return;
  if (map[ix][iz] < 4) {
    map[ix][iz] += 1; gameMessage = "Block placed!";
    setTimeout(() => { if (gameMessage === "Block placed!") gameMessage = ""; }, 1200);
  }
}

function deleteBlockInFront() {
  const { ix, iz } = getBlockInFrontPos();
  if (ix < 0 || ix >= MAP_SIZE || iz < 0 || iz >= MAP_SIZE) return;
  if (map[ix][iz] > 0) {
    map[ix][iz] -= 1; gameMessage = "Block removed!";
    setTimeout(() => { if (gameMessage === "Block removed!") gameMessage = ""; }, 1200);
  }
}

// ============================================================
// UI wiring for the ASG4 lighting controls
// ============================================================
function setupUI() {
  const lightBtn  = document.getElementById('toggleLight');
  const normalBtn = document.getElementById('toggleNormal');
  const spotBtn   = document.getElementById('toggleSpot');
  const animBtn   = document.getElementById('toggleAnim');

  lightBtn.onclick  = () => { g_lightOn = !g_lightOn;   lightBtn.textContent  = 'Lighting: ' + (g_lightOn ? 'ON' : 'OFF'); };
  normalBtn.onclick = () => { g_normalViz = !g_normalViz; normalBtn.textContent = 'Normals: ' + (g_normalViz ? 'ON' : 'OFF'); };
  spotBtn.onclick   = () => { g_spotOn = !g_spotOn;     spotBtn.textContent   = 'Spotlight: ' + (g_spotOn ? 'ON' : 'OFF'); };
  animBtn.onclick   = () => { g_animateLight = !g_animateLight; animBtn.textContent = 'Animate Light: ' + (g_animateLight ? 'ON' : 'OFF'); };

  // light position sliders
  document.getElementById('lightX').oninput = (e) => { g_lightPos[0] = +e.target.value; };
  document.getElementById('lightY').oninput = (e) => { g_lightPos[1] = +e.target.value; };
  document.getElementById('lightZ').oninput = (e) => { g_lightPos[2] = +e.target.value; };

  // light color sliders (0..100 -> 0..1)
  document.getElementById('lightR').oninput = (e) => { g_lightColor[0] = e.target.value / 100; };
  document.getElementById('lightG').oninput = (e) => { g_lightColor[1] = e.target.value / 100; };
  document.getElementById('lightB').oninput = (e) => { g_lightColor[2] = e.target.value / 100; };
}

// ============================================================
// Gem game (unchanged from asg3)
// ============================================================
function checkGems() {
  if (collected === totalGems) return;
  const ex = camera.eye.elements[0], ez = camera.eye.elements[2];
  for (const g of gems) {
    if (g.collected) continue;
    const dx = (g.x + 0.5) - ex, dz = (g.z + 0.5) - ez;
    if (dx*dx + dz*dz < 1.0) {
      g.collected = true; collected++;
      if (collected === totalGems) gameMessage = "🎉 ALL GEMS COLLECTED!";
      else {
        gameMessage = `Gem ${collected}/${totalGems}!`;
        setTimeout(() => { if (gameMessage.startsWith("Gem ")) gameMessage = ""; }, 1500);
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

  frameCount++; fpsTimer += dt;
  if (fpsTimer > 0.5) {
    if (fpsEl) fpsEl.textContent = `FPS: ${(frameCount / fpsTimer).toFixed(0)}`;
    frameCount = 0; fpsTimer = 0;
  }

  processHeldKeys();
  checkGems();
  g_time += dt;

  // animate the point light in a circle when enabled (asgn4 step 5)
  if (g_animateLight) {
    g_lightPos[0] = 16 + Math.cos(g_time * 0.8) * 5;
    g_lightPos[2] = 20 + Math.sin(g_time * 0.8) * 5;
  }

  renderScene();

  const px = camera.eye.elements[0].toFixed(1);
  const pz = camera.eye.elements[2].toFixed(1);
  document.getElementById('pos').textContent = `(${px}, ${pz})`;
  document.getElementById('msg').textContent = gameMessage;

  requestAnimationFrame(tick);
}

// push per-frame lighting uniforms once
function sendLightingUniforms() {
  gl.uniform1i(u_NormalViz, g_normalViz ? 1 : 0);
  gl.uniform1i(u_LightOn, g_lightOn ? 1 : 0);

  gl.uniform3f(u_LightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  gl.uniform3f(u_CameraPos, camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]);
  gl.uniform3f(u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);

  gl.uniform1i(u_SpotOn, g_spotOn ? 1 : 0);
  gl.uniform3f(u_SpotPos, g_spotPos[0], g_spotPos[1], g_spotPos[2]);
  gl.uniform3f(u_SpotDir, g_spotDir[0], g_spotDir[1], g_spotDir[2]);
  gl.uniform3f(u_SpotColor, g_spotColor[0], g_spotColor[1], g_spotColor[2]);
  gl.uniform1f(u_SpotCutoff, SPOT_CUTOFF);
}

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
  sendLightingUniforms();

  // === sky === (flat, unlit)
  skyCube.color = [0.45, 0.7, 1.0, 1.0];
  skyCube.textureNum = -1; skyCube.texColorWeight = 0.0; skyCube.emissive = 1;
  skyCube.matrix.setIdentity();
  skyCube.matrix.translate(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE / 2);
  skyCube.matrix.scale(500, 500, 500);
  skyCube.matrix.translate(-0.5, -0.5, -0.5);
  gl.disable(gl.DEPTH_TEST);
  skyCube.render(gl);
  gl.enable(gl.DEPTH_TEST);

  // === ground === (grass texture, lit)
  groundCube.textureNum = 2; groundCube.texColorWeight = 1.0; groundCube.emissive = 0;
  groundCube.color = [0.4, 0.7, 0.3, 1.0];
  groundCube.matrix.setIdentity();
  groundCube.matrix.translate(MAP_SIZE / 2, 0, MAP_SIZE / 2);
  groundCube.matrix.scale(MAP_SIZE, 0.01, MAP_SIZE);
  groundCube.matrix.translate(-0.5, 0, -0.5);
  groundCube.render(gl);

  // === walls === (textured, lit)
  drawCube.texColorWeight = 1.0; drawCube.emissive = 0;
  for (let x = 0; x < MAP_SIZE; x++) {
    for (let z = 0; z < MAP_SIZE; z++) {
      const h = map[x][z];
      if (h === 0) continue;
      const isOuter = (x === 0 || x === MAP_SIZE - 1 || z === 0 || z === MAP_SIZE - 1);
      drawCube.textureNum = isOuter ? 1 : 0;
      drawCube.color = [1, 1, 1, 1];
      for (let y = 0; y < h; y++) {
        drawCube.matrix.setIdentity();
        drawCube.matrix.translate(x, y, z);
        drawCube.render(gl);
      }
    }
  }

  // === gems === (gold texture, hover + rotate, lit)
  drawCube.textureNum = 3; drawCube.texColorWeight = 1.0;
  for (const g of gems) {
    if (g.collected) continue;
    drawCube.matrix.setIdentity();
    drawCube.matrix.translate(g.x + 0.5, 1.0 + Math.sin(g_time * 2 + g.x) * 0.15, g.z + 0.5);
    drawCube.matrix.rotate(g_time * 60, 0, 1, 0);
    drawCube.matrix.scale(0.3, 0.3, 0.3);
    drawCube.matrix.translate(-0.5, -0.5, -0.5);
    drawCube.render(gl);
  }

  // === spheres === (solid color, lit - easiest place to read the lighting)
  sphere.textureNum = -1; sphere.texColorWeight = 0.0; sphere.emissive = 0;
  for (const s of sceneSpheres) {
    sphere.color = s.color;
    sphere.matrix.setIdentity();
    sphere.matrix.translate(s.pos[0], s.pos[1], s.pos[2]);
    sphere.matrix.scale(s.scale, s.scale, s.scale);
    sphere.render(gl);
  }

  // === OBJ model === (lit, slow spin)
  if (model && model.ready) {
    model.emissive = 0; model.textureNum = -1; model.texColorWeight = 0.0;
    model.matrix.setIdentity();
    model.matrix.translate(22, 2.2, 19);
    model.matrix.rotate(g_time * 30, 0, 1, 0);
    model.matrix.scale(1.1, 1.1, 1.1);
    model.render(gl);
  }

  // === bat (animal) ===
  drawBat();

  // === light markers (drawn last, emissive so they glow at the light spots) ===
  // point light marker - tinted by the current light color
  markerCube.emissive = 1; markerCube.textureNum = -1; markerCube.texColorWeight = 0.0;
  markerCube.color = [g_lightColor[0], g_lightColor[1], g_lightColor[2], 1.0];
  markerCube.matrix.setIdentity();
  markerCube.matrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  markerCube.matrix.scale(0.4, 0.4, 0.4);
  markerCube.matrix.translate(-0.5, -0.5, -0.5);
  markerCube.render(gl);

  // spotlight marker
  if (g_spotOn) {
    markerCube.color = [g_spotColor[0], g_spotColor[1], g_spotColor[2], 1.0];
    markerCube.matrix.setIdentity();
    markerCube.matrix.translate(g_spotPos[0], g_spotPos[1], g_spotPos[2]);
    markerCube.matrix.scale(0.35, 0.35, 0.35);
    markerCube.matrix.translate(-0.5, -0.5, -0.5);
    markerCube.render(gl);
  }
}

// ============================================================
// Bat - asg3 animal (now lit, since cubes carry normals)
// ============================================================
function drawBat() {
  const orbitR = 8;
  const cx = MAP_SIZE / 2 + Math.cos(g_time * 0.4) * orbitR;
  const cz = MAP_SIZE / 2 + Math.sin(g_time * 0.4) * orbitR;
  const cy = 4 + Math.sin(g_time * 1.2) * 0.5;
  const facing = g_time * 0.4 * 180 / Math.PI + 90;
  const wingFlap = Math.sin(g_time * 8) * 30;

  drawCube.textureNum = -1; drawCube.texColorWeight = 0.0; drawCube.emissive = 0;
  drawCube.color = [0.25, 0.15, 0.35, 1.0];
  drawCube.matrix.setIdentity();
  drawCube.matrix.translate(cx, cy, cz);
  drawCube.matrix.rotate(facing, 0, 1, 0);
  let body = new Matrix4(drawCube.matrix);
  drawCube.matrix.scale(0.4, 0.4, 0.6);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl);

  drawCube.color = [0.2, 0.1, 0.3, 1.0];
  drawCube.matrix.set(body);
  drawCube.matrix.translate(0, 0.05, 0.3);
  drawCube.matrix.scale(0.3, 0.3, 0.3);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl);

  drawCube.color = [0.35, 0.2, 0.4, 1.0];
  drawCube.matrix.set(body);
  drawCube.matrix.translate(-0.2, 0, 0);
  drawCube.matrix.rotate(wingFlap, 0, 0, 1);
  drawCube.matrix.translate(-0.5, -0.05, 0);
  drawCube.matrix.scale(0.5, 0.05, 0.4);
  drawCube.render(gl);

  drawCube.matrix.set(body);
  drawCube.matrix.translate(0.2, 0, 0);
  drawCube.matrix.rotate(-wingFlap, 0, 0, 1);
  drawCube.matrix.translate(0, -0.05, 0);
  drawCube.matrix.scale(0.5, 0.05, 0.4);
  drawCube.render(gl);

  drawCube.color = [1, 0.9, 0.8, 1.0];
  drawCube.matrix.set(body);
  drawCube.matrix.translate(-0.06, 0.07, 0.45);
  drawCube.matrix.scale(0.04, 0.04, 0.04);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl);

  drawCube.matrix.set(body);
  drawCube.matrix.translate(0.06, 0.07, 0.45);
  drawCube.matrix.scale(0.04, 0.04, 0.04);
  drawCube.matrix.translate(-0.5, -0.5, -0.5);
  drawCube.render(gl);
}
