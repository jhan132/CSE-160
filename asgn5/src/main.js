import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// This is my Assignment 3 virtual world, re-created in Three.js.
// Same 32x32 grid, same house/tower/plaza/pillars/maze layout,
// same 8 collectible gems and the orbiting bat. A5 adds real
// lighting + shadows, a cubemap skybox, and a loaded .glb model.
// ============================================================

const MAP_SIZE = 32;
const MODEL_URL = window.EMBEDDED_MODEL || 'models/chest.glb';

// ----- renderer -----
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ----- scene + camera -----
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ec4e0, 30, 80);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(16, 1.6, 28);   // same spawn as A3 (eye at 16,1.6,28 looking -z)

// ----- first-person controls (re-creates A3's WASD + mouse look) -----
const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');

// Hide the overlay and try to lock the mouse. Pointer lock can be blocked in a
// sandboxed preview iframe, so we hide the overlay regardless and fall back to
// click-drag look below. On a served page (GitHub Pages) the lock succeeds and
// you get proper first-person mouse-look.
function start() { overlay.style.display = 'none'; try { controls.lock(); } catch (e) {} }
overlay.addEventListener('click', start);
canvas.addEventListener('click', () => { try { controls.lock(); } catch (e) {} });

// Drag-to-look fallback for when pointer lock isn't active
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
let _drag = false, _px = 0, _py = 0;
canvas.addEventListener('pointerdown', (e) => { if (!controls.isLocked) { _drag = true; _px = e.clientX; _py = e.clientY; } });
addEventListener('pointerup', () => { _drag = false; });
addEventListener('pointermove', (e) => {
  if (!_drag || controls.isLocked) return;
  _euler.setFromQuaternion(camera.quaternion);
  _euler.y -= (e.clientX - _px) * 0.004;
  _euler.x -= (e.clientY - _py) * 0.004;
  _euler.x = Math.max(-1.4, Math.min(1.4, _euler.x));
  camera.quaternion.setFromEuler(_euler);
  _px = e.clientX; _py = e.clientY;
});

const keys = {};
addEventListener('keydown', (e) => keys[e.code] = true);
addEventListener('keyup', (e) => keys[e.code] = false);

// ============================================================
// Procedural textures (canvas) -- same look as A3's generators
// ============================================================
function makeTexture(draw, repeat = 1) {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d'), S);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function speckle(ctx, S, base, palette, count, sz) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.fillRect((Math.random() * S) | 0, (Math.random() * S) | 0, sz, sz);
  }
}
const dirtTex = makeTexture((c, S) => speckle(c, S, '#7a4a26', ['#5a3318', '#8b5a2b', '#6b3e1f', '#4a2308', '#9b6a3c'], 600, 2));
const stoneTex = makeTexture((c, S) => {
  speckle(c, S, '#9a9a9a', ['#777', '#888', '#aaa', '#666', '#bbb'], 500, 3);
  c.strokeStyle = '#444'; c.lineWidth = 1;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(Math.random()*S, Math.random()*S); c.lineTo(Math.random()*S, Math.random()*S); c.stroke(); }
});
const grassTex = makeTexture((c, S) => speckle(c, S, '#4a8a32', ['#3a7022', '#5a9a40', '#386818', '#6caa50', '#2a5810'], 800, 2), MAP_SIZE / 2);

// ============================================================
// Cubemap skybox -- 6 faces drawn from real ray directions so
// the edges line up (no seams), with a sun glow.
// ============================================================
function buildSkybox() {
  const N = 256;
  const sun = new THREE.Vector3(0.6, 0.5, 0.4).normalize();
  const zenith = [0.16, 0.34, 0.62], horizon = [0.70, 0.82, 0.92], ground = [0.42, 0.46, 0.40];
  const dirFns = [
    (s, t) => [1, -t, -s], (s, t) => [-1, -t, s],   // +X, -X
    (s, t) => [s, 1, t],   (s, t) => [s, -1, -t],   // +Y, -Y
    (s, t) => [s, -t, 1],  (s, t) => [-s, -t, -1],  // +Z, -Z
  ];
  const faces = dirFns.map((fn) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), d = img.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const s = (x + 0.5) / N * 2 - 1, t = (y + 0.5) / N * 2 - 1;
      let v = fn(s, t); const len = Math.hypot(v[0], v[1], v[2]);
      v = [v[0]/len, v[1]/len, v[2]/len];
      const e = v[1], top = e >= 0 ? e : 0;
      const col = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        const up = horizon[i] * (1 - top) + zenith[i] * top;
        const dn = horizon[i] * (1 + Math.min(0, e)) + ground[i] * (-Math.min(0, e));
        col[i] = e >= 0 ? up : dn;
      }
      const sd = Math.max(0, v[0]*sun.x + v[1]*sun.y + v[2]*sun.z);
      const glow = Math.pow(sd, 90) * 1.3;
      const o = (y * N + x) * 4;
      d[o]   = Math.min(255, (col[0] + glow) * 255);
      d[o+1] = Math.min(255, (col[1] + glow * 0.95) * 255);
      d[o+2] = Math.min(255, (col[2] + glow * 0.8) * 255);
      d[o+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  });
  const tex = new THREE.CubeTexture(faces);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
scene.background = buildSkybox();

// ============================================================
// Lights -- A5 requires 3+ types incl. a directional light
// ============================================================
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x4a5a30, 0.6));

const sun = new THREE.DirectionalLight(0xfff1d4, 1.15);
sun.position.set(40, 55, 25);
sun.target.position.set(16, 0, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

// a warm point light (torch) near the plaza
const torch = new THREE.PointLight(0xffaa55, 30, 18, 2);
torch.position.set(16, 3, 16);
torch.castShadow = true;
scene.add(torch);

// ============================================================
// Ground (grass)
// ============================================================
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(MAP_SIZE, 0.2, MAP_SIZE),
  new THREE.MeshStandardMaterial({ map: grassTex })
);
ground.position.set(MAP_SIZE / 2, -0.1, MAP_SIZE / 2);
ground.receiveShadow = true;
scene.add(ground);

// ============================================================
// World map -- identical layout to A3's buildMap()
// ============================================================
const map = [];
function buildMap() {
  for (let i = 0; i < MAP_SIZE; i++) map[i] = new Array(MAP_SIZE).fill(0);
  for (let i = 0; i < MAP_SIZE; i++) { map[0][i] = 4; map[MAP_SIZE-1][i] = 4; map[i][0] = 4; map[i][MAP_SIZE-1] = 4; }
  // house
  for (let i = 3; i <= 7; i++) { map[i][3] = 2; map[i][7] = 2; }
  for (let j = 3; j <= 7; j++) { map[3][j] = 2; map[7][j] = 2; }
  map[7][5] = 0;
  // tower
  for (let i = 24; i <= 28; i++) { map[i][3] = 3; map[i][7] = 3; }
  for (let j = 3; j <= 7; j++) { map[24][j] = 3; map[28][j] = 3; }
  map[26][3] = 0;
  // plaza
  map[14][14] = 4; map[14][17] = 4; map[17][14] = 4; map[17][17] = 4;
  map[15][14] = 1; map[16][14] = 1; map[15][17] = 1; map[16][17] = 1;
  map[14][15] = 1; map[14][16] = 1; map[17][15] = 1; map[17][16] = 1;
  // pillars
  for (const [x, z, h] of [[10,22,3],[22,11,2],[9,12,4],[21,25,3],[6,22,2],[25,18,3],[12,26,2],[18,8,4]]) map[x][z] = h;
  // staircase
  for (let i = 0; i < 4; i++) map[3+i][22] = i + 1;
  // maze walls
  for (let j = 11; j <= 17; j++) map[10][j] = 2; map[10][14] = 0;
  for (let i = 11; i <= 16; i++) map[i][20] = 2; map[13][20] = 0;
}
buildMap();

// build wall cubes (outer = stone, inner = dirt), shadows on
const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTex });
const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
let blockCount = 0;
for (let x = 0; x < MAP_SIZE; x++) {
  for (let z = 0; z < MAP_SIZE; z++) {
    const h = map[x][z];
    if (h === 0) continue;
    const isOuter = (x === 0 || x === MAP_SIZE - 1 || z === 0 || z === MAP_SIZE - 1);
    const mat = isOuter ? stoneMat : dirtMat;
    for (let y = 0; y < h; y++) {
      const m = new THREE.Mesh(cubeGeo, mat);
      m.position.set(x + 0.5, y + 0.5, z + 0.5);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m); blockCount++;
    }
  }
}

// ============================================================
// Collectible gems (8) -- hover + spin, walk into them to collect
// ============================================================
const gemSpots = [[5,5],[26,5],[16,16],[15,25],[25,25],[5,20],[13,13],[28,14]];
const gemGeo = new THREE.OctahedronGeometry(0.35);
const gemMat = new THREE.MeshStandardMaterial({ color: 0xffd840, emissive: 0xa07020, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.2 });
const gems = [];
for (const [x, z] of gemSpots) {
  const g = new THREE.Mesh(gemGeo, gemMat.clone());
  g.position.set(x + 0.5, 1.0, z + 0.5);
  g.castShadow = true;
  g.userData = { gx: x, gz: z, collected: false };
  scene.add(g);
  gems.push(g);
}
let collected = 0;
const totalGems = gems.length;
const countEl = document.getElementById('count');
const msgEl = document.getElementById('msg');
const posEl = document.getElementById('pos');
document.getElementById('total').textContent = totalGems;

function checkGems() {
  if (collected === totalGems) return;
  const ex = camera.position.x, ez = camera.position.z;
  for (const g of gems) {
    if (g.userData.collected) continue;
    const dx = (g.userData.gx + 0.5) - ex, dz = (g.userData.gz + 0.5) - ez;
    if (dx*dx + dz*dz < 1.0) {
      g.userData.collected = true; g.visible = false; collected++;
      countEl.textContent = collected;
      if (collected === totalGems) { msgEl.textContent = '\u2728 ALL GEMS COLLECTED!'; msgEl.style.opacity = 1; }
      else { msgEl.textContent = `Gem ${collected}/${totalGems}!`; msgEl.style.opacity = 1;
             clearTimeout(msgEl._t); msgEl._t = setTimeout(() => msgEl.style.opacity = 0, 1400); }
    }
  }
}

// ============================================================
// Bat -- same orbiting + flapping creature as A3 (built from boxes)
// ============================================================
const bat = new THREE.Group();
const batBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x402659 }));
const batHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x331a4d }));
batHead.position.set(0, 0.05, 0.3);
const wingMat = new THREE.MeshStandardMaterial({ color: 0x593366, side: THREE.DoubleSide });
function makeWing(side) {
  const pivot = new THREE.Group();              // pivot at the shoulder so it flaps
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.4), wingMat);
  w.position.x = side * 0.25;
  pivot.add(w); pivot.position.x = side * 0.2;
  return pivot;
}
const leftWing = makeWing(-1), rightWing = makeWing(1);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfff0cc, emissive: 0xffeeaa, emissiveIntensity: 0.5 });
for (const ex of [-0.06, 0.06]) {
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
  eye.position.set(ex, 0.12, 0.45); bat.add(eye);
}
bat.add(batBody, batHead, leftWing, rightWing);
bat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
scene.add(bat);

// ============================================================
// Custom textured model -- treasure chest, loaded from .glb,
// placed inside the tower (the "treasure room")
// ============================================================
new GLTFLoader().load(MODEL_URL, (gltf) => {
  const chest = gltf.scene;
  chest.scale.setScalar(1.1);
  chest.position.set(26.5, 0.1, 5.5);
  chest.rotation.y = -Math.PI / 2;
  chest.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(chest);
});

// ============================================================
// Loop
// ============================================================
addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // WASD movement (works whether or not the pointer is locked)
  const sp = 6 * dt;
  if (keys['KeyW']) controls.moveForward(sp);
  if (keys['KeyS']) controls.moveForward(-sp);
  if (keys['KeyA']) controls.moveRight(-sp);
  if (keys['KeyD']) controls.moveRight(sp);
  camera.position.y = 1.6;                                   // keep eye height
  camera.position.x = Math.max(1.2, Math.min(MAP_SIZE - 1.2, camera.position.x));
  camera.position.z = Math.max(1.2, Math.min(MAP_SIZE - 1.2, camera.position.z));
  posEl.textContent = `(${camera.position.x.toFixed(1)}, ${camera.position.z.toFixed(1)})`;

  checkGems();

  // gems hover + spin
  for (const g of gems) {
    if (g.userData.collected) continue;
    g.position.y = 1.0 + Math.sin(t * 2 + g.userData.gx) * 0.15;
    g.rotation.y = t * 1.0;
  }

  // bat orbit + flap (same params as A3)
  const r = 8;
  bat.position.set(MAP_SIZE/2 + Math.cos(t*0.4)*r, 4 + Math.sin(t*1.2)*0.5, MAP_SIZE/2 + Math.sin(t*0.4)*r);
  bat.rotation.y = -t * 0.4 + Math.PI / 2;
  const flap = Math.sin(t * 8) * 0.5;
  leftWing.rotation.z = flap;
  rightWing.rotation.z = -flap;

  // torch flicker
  torch.intensity = 30 + Math.sin(t * 10) * 5;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
