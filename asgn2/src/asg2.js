// asg2.js 
// CSE-160 Assignment 2 
// Bat
// Joonhee Han

// shaders
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotation;
  void main() {
    gl_Position = u_GlobalRotation * u_ModelMatrix * a_Position;
  }
`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// globals
let canvas;
let gl;
let a_Position;
let u_FragColor;
let u_ModelMatrix;
let u_GlobalRotation;

// global UI state
let g_globalAngleY = 0;     
let g_globalAngleX = 0;     
let g_shoulderAngle = 0;
let g_forearmAngle = 0;
let g_wingtipAngle = 0;
let g_allJointsAngle = 0;
let g_headAngle = 0;
let g_earWiggle = 0;        
let g_footSwing = 0;        
let g_tailSwing = 0;        

let g_animOn = false;
let g_pokeOn = false;       
let g_pokeStart = 0;
let g_startTime = performance.now() / 1000.0;
let g_seconds = 0;

let g_mouseDown = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get WebGL context');
    return;
  }
  gl.enable(gl.DEPTH_TEST);
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to init shaders');
    return;
  }
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotation = gl.getUniformLocation(gl.program, 'u_GlobalRotation');

  const id = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, id.elements);
  gl.uniformMatrix4fv(u_GlobalRotation, false, id.elements);
}

// UI 
function addActionsForHtmlUI() {
  document.getElementById('globalRot').addEventListener('input', function() {
    g_globalAngleY = parseFloat(this.value);
    renderScene();
  });
  document.getElementById('shoulder').addEventListener('input', function() {
    g_shoulderAngle = parseFloat(this.value);
    renderScene();
  });
  document.getElementById('forearm').addEventListener('input', function() {
    g_forearmAngle = parseFloat(this.value);
    renderScene();
  });
  document.getElementById('wingtip').addEventListener('input', function() {
    g_wingtipAngle = parseFloat(this.value);
    renderScene();
  });
  document.getElementById('allJoints').addEventListener('input', function() {
    g_allJointsAngle = parseFloat(this.value);
    renderScene();
  });
  document.getElementById('head').addEventListener('input', function() {
    g_headAngle = parseFloat(this.value);
    renderScene();
  });

  document.getElementById('animOn').onclick = function() { g_animOn = true; };
  document.getElementById('animOff').onclick = function() { g_animOn = false; };

  canvas.onmousedown = function(ev) {
    if (ev.shiftKey) {
      g_pokeOn = true;
      g_pokeStart = g_seconds;
      return;
    }
    g_mouseDown = true;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
  };
  canvas.onmouseup = function() { g_mouseDown = false; };
  canvas.onmouseleave = function() { g_mouseDown = false; };
  canvas.onmousemove = function(ev) {
    if (!g_mouseDown) return;
    const dx = ev.clientX - g_lastMouseX;
    const dy = ev.clientY - g_lastMouseY;
    g_globalAngleY += dx * 0.5;
    g_globalAngleX += dy * 0.5;
    if (g_globalAngleX > 80) g_globalAngleX = 80;
    if (g_globalAngleX < -80) g_globalAngleX = -80;
    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
  };
}

// animation
function updateAnimationAngles() {
  if (!g_animOn) {
    g_earWiggle = 0;
    g_footSwing = 0;
    g_tailSwing = 0;
    return;
  }
  const t = g_seconds;

  g_shoulderAngle = 30 * Math.sin(t * 4.0);
  g_forearmAngle = -20 + 25 * Math.sin(t * 4.0 + 0.5);
  g_wingtipAngle = 15 * Math.sin(t * 4.0 + 1.0);
  g_headAngle = 8 * Math.sin(t * 2.0);
  g_earWiggle = 5 * Math.sin(t * 6.0);
  g_footSwing = 6 * Math.sin(t * 4.0);
  g_tailSwing = 8 * Math.sin(t * 3.0);

  document.getElementById('shoulder').value = g_shoulderAngle;
  document.getElementById('forearm').value = g_forearmAngle;
  document.getElementById('wingtip').value = g_wingtipAngle;
  document.getElementById('head').value = g_headAngle;

  if (g_pokeOn) {
    const dt = g_seconds - g_pokeStart;
    if (dt > 1.5) {
      g_pokeOn = false;
    } else {
      g_globalAngleY = (g_globalAngleY + 12) % 360;
      g_shoulderAngle = 50 * Math.sin(t * 18);
      g_forearmAngle = -30 + 40 * Math.sin(t * 18);
    }
  }
}

// rendering
// fps counter 
let g_frameTimes = [];
let g_lastFrameMs = 0;
function updateFPS() {
  const now = performance.now();
  g_frameTimes.push(now);
  while (g_frameTimes.length > 0 && g_frameTimes[0] < now - 1000) {
    g_frameTimes.shift();
  }
  const fps = g_frameTimes.length;
  // show both fps and ms/frame 
  document.getElementById('fps').textContent =
    'FPS: ' + fps + '   |   frame: ' + g_lastFrameMs.toFixed(2) + ' ms';
}

function renderScene() {
  const startMs = performance.now();

  const globalRot = new Matrix4();
  globalRot.rotate(g_globalAngleX, 1, 0, 0);
  globalRot.rotate(g_globalAngleY, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotation, false, globalRot.elements);

  gl.clearColor(0.05, 0.05, 0.15, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // color
  const bodyColor = [0.25, 0.15, 0.20, 1.0];   
  const wingColor = [0.18, 0.10, 0.15, 1.0];   
  const wingTipColor = [0.30, 0.20, 0.25, 1.0];
  const earColor  = [0.20, 0.12, 0.16, 1.0];
  const eyeColor  = [1.0, 0.8, 0.0, 1.0];      
  const footColor = [0.15, 0.08, 0.10, 1.0];

  // BODY 
  const body = new Cylinder();
  body.color = bodyColor;
  body.matrix.translate(0, -0.2, 0);
  body.matrix.scale(0.35, 0.5, 0.35);
  body.render();

  // HEAD
  const head = new Cube();
  head.color = bodyColor;
  head.matrix.translate(0, 0.3, 0);
  head.matrix.rotate(g_headAngle, 0, 1, 0);
  head.matrix.translate(-0.2, 0, -0.15);
  head.matrix.scale(0.4, 0.3, 0.3);
  head.render();

  // EARS 
  const earL = new Cube();
  earL.color = earColor;
  earL.matrix.translate(0, 0.3, 0);
  earL.matrix.rotate(g_headAngle, 0, 1, 0);  
  earL.matrix.translate(-0.15, 0.25, -0.05);
  earL.matrix.rotate(-15 - g_earWiggle, 0, 0, 1);
  earL.matrix.scale(0.08, 0.25, 0.08);
  earL.render();

  const earR = new Cube();
  earR.color = earColor;
  earR.matrix.translate(0, 0.3, 0);
  earR.matrix.rotate(g_headAngle, 0, 1, 0);
  earR.matrix.translate(0.07, 0.25, -0.05);
  earR.matrix.rotate(15 + g_earWiggle, 0, 0, 1);
  earR.matrix.scale(0.08, 0.25, 0.08);
  earR.render();

  // EYES 
  const eyeL = new Cube();
  eyeL.color = eyeColor;
  eyeL.matrix.translate(0, 0.3, 0);
  eyeL.matrix.rotate(g_headAngle, 0, 1, 0);
  eyeL.matrix.translate(-0.13, 0.12, -0.16);
  eyeL.matrix.scale(0.06, 0.06, 0.02);
  eyeL.render();

  const eyeR = new Cube();
  eyeR.color = eyeColor;
  eyeR.matrix.translate(0, 0.3, 0);
  eyeR.matrix.rotate(g_headAngle, 0, 1, 0);
  eyeR.matrix.translate(0.07, 0.12, -0.16);
  eyeR.matrix.scale(0.06, 0.06, 0.02);
  eyeR.render();

  // WINGS 3-level joint
  // joint 1 = shoulder 
  // joint 2 = forearm 
  // joint 3 = wing tip
  // 'allJoints' adds an offset

  drawWing(-1, bodyColor, wingColor, wingTipColor);  // left
  drawWing( 1, bodyColor, wingColor, wingTipColor);  // right

  // TAIL
  const tail = new Cube();
  tail.color = bodyColor;
  tail.matrix.translate(0, -0.25, 0.15);
  tail.matrix.rotate(g_tailSwing, 0, 1, 0);
  tail.matrix.translate(-0.05, 0, 0);
  tail.matrix.rotate(20, 1, 0, 0);
  tail.matrix.scale(0.1, 0.1, 0.25);
  tail.render();

  // FEET 
  const footL = new Cube();
  footL.color = footColor;
  footL.matrix.translate(-0.11, -0.2, 0.05);
  footL.matrix.rotate(g_footSwing, 1, 0, 0);
  footL.matrix.translate(-0.04, -0.15, 0);
  footL.matrix.scale(0.08, 0.15, 0.08);
  footL.render();

  const footR = new Cube();
  footR.color = footColor;
  footR.matrix.translate(0.11, -0.2, 0.05);
  footR.matrix.rotate(-g_footSwing, 1, 0, 0);
  footR.matrix.translate(-0.04, -0.15, 0);
  footR.matrix.scale(0.08, 0.15, 0.08);
  footR.render();

  // capture frame timing
  g_lastFrameMs = performance.now() - startMs;
  updateFPS();
}

// helper to draw one wing with the 3-deep joint chain
function drawWing(side, bodyColor, wingColor, tipColor) {
  // UPPER WING
  const upper = new Cube();
  upper.color = wingColor;
  upper.matrix.translate(side * 0.15, 0.05, 0);
  if (side < 0) upper.matrix.rotate(180, 0, 1, 0);
  upper.matrix.rotate(-(g_shoulderAngle + g_allJointsAngle), 0, 0, 1);
  upper.matrix.rotate(-10, 0, 1, 0);
  const shoulderMat = new Matrix4(upper.matrix);
  upper.matrix.translate(0, -0.04, -0.075);
  upper.matrix.scale(0.4, 0.08, 0.15);
  upper.render();

  // FOREARM (joint 2) 
  const fore = new Cube();
  fore.color = wingColor;
  fore.matrix = new Matrix4(shoulderMat);
  fore.matrix.translate(0.4, 0, 0);
  fore.matrix.rotate(-(g_forearmAngle + g_allJointsAngle), 0, 0, 1);
  const foreMat = new Matrix4(fore.matrix);
  fore.matrix.translate(0, -0.03, -0.09);
  fore.matrix.scale(0.35, 0.06, 0.18);
  fore.render();

  // WING TIP (joint 3)
  const tip = new Cube();
  tip.color = tipColor;
  tip.matrix = new Matrix4(foreMat);
  tip.matrix.translate(0.35, 0, 0);
  tip.matrix.rotate(-(g_wingtipAngle + g_allJointsAngle), 0, 0, 1);
  tip.matrix.translate(0, -0.025, -0.10);
  tip.matrix.scale(0.25, 0.05, 0.20);
  tip.render();
}

// main loop 
function tick() {
  g_seconds = performance.now() / 1000.0 - g_startTime;
  updateAnimationAngles();
  renderScene();
  requestAnimationFrame(tick);
}

// entry 
function main() {
  setupWebGL();
  connectVariablesToGLSL();
  addActionsForHtmlUI();

  gl.clearColor(0.05, 0.05, 0.15, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  renderScene();
  tick();
}
