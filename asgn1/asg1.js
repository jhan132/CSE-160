// asg1.js — Assignment 1: Painting
// CSE-160 Web Graphics

// ─── GLSL shaders ────────────────────────────────────────────────────────────
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }
`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// ─── Globals ──────────────────────────────────────────────────────────────────
var gl;
var a_Position, u_FragColor, u_Size;
var shapesList = [];

// Current UI state
var g_color = [1.0, 0.5, 0.78, 1.0];
var g_size = 10;
var g_segments = 12;
var g_mode = 'point'; // 'point' | 'triangle' | 'circle'

// ─── Shape classes ────────────────────────────────────────────────────────────
class Point {
  constructor(pos, color, size) {
    this.pos = pos;
    this.color = color;
    this.size = size;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_Size, this.size);
    drawSinglePoint(this.pos);
  }
}

class Triangle {
  constructor(pos, color, size) {
    this.pos = pos;   // [x, y] center
    this.color = color;
    this.size = size;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_Size, this.size);
    drawSingleTriangle(this.pos, this.size);
  }
}

class Circle {
  constructor(pos, color, size, segments) {
    this.pos = pos;
    this.color = color;
    this.size = size;
    this.segments = segments;
  }
  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_Size, this.size);
    drawSingleCircle(this.pos, this.size, this.segments);
  }
}

// ─── WebGL helpers ────────────────────────────────────────────────────────────
function setupWebGL() {
  var canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) { alert('WebGL not supported'); return false; }
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return canvas;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to init shaders');
    return false;
  }
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  return true;
}

function drawSinglePoint(pos) {
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.POINTS, 0, 1);
}

function drawSingleTriangle(pos, size) {
  var s = size / 400;
  var x = pos[0], y = pos[1];
  var verts = new Float32Array([
    x,     y + s,
    x - s, y - s,
    x + s, y - s
  ]);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function drawSingleCircle(pos, size, segs) {
  var r = size / 400;
  var x = pos[0], y = pos[1];
  var verts = [];
  for (var i = 0; i < segs; i++) {
    var a1 = (i / segs) * Math.PI * 2;
    var a2 = ((i + 1) / segs) * Math.PI * 2;
    verts.push(x, y);
    verts.push(x + r * Math.cos(a1), y + r * Math.sin(a1));
    verts.push(x + r * Math.cos(a2), y + r * Math.sin(a2));
  }
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, segs * 3);
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (var i = 0; i < shapesList.length; i++) {
    shapesList[i].render();
  }
}

// ─── Click / Drag handling ────────────────────────────────────────────────────
function click(ev, canvas) {
  var rect = canvas.getBoundingClientRect();
  var x = ((ev.clientX - rect.left) / canvas.width) * 2 - 1;
  var y = -((ev.clientY - rect.top) / canvas.height) * 2 + 1;
  var pos = [x, y];

  var color = g_color.slice();
  if (g_mode === 'point') {
    shapesList.push(new Point(pos, color, g_size));
  } else if (g_mode === 'triangle') {
    shapesList.push(new Triangle(pos, color, g_size));
  } else if (g_mode === 'circle') {
    shapesList.push(new Circle(pos, color, g_size, g_segments));
  }
  renderAllShapes();
}

// ─── Picture: "JH" built from triangles ──────────────────────────────────────
function drawMyPicture() {
  shapesList = [];

  // Background sky — big blue triangles scattered
  var bg = [
    [[-0.9, 0.9], [0.1, 0.9], [-0.9, -0.2], [0.19, 0.53, 0.89, 1.0], 60],
    [[0.1, 0.9], [0.9, 0.9], [0.9, -0.2],   [0.13, 0.45, 0.78, 1.0], 60],
    [[-0.9, -0.2], [0.9, -0.2], [-0.0, -0.9],[0.08, 0.28, 0.55, 1.0], 60],
  ];

  // Helper: push a raw triangle by 3 vertices
  function rawTri(x1, y1, x2, y2, x3, y3, color) {
    var verts = new Float32Array([x1,y1, x2,y2, x3,y3]);
    // We'll store as a special "RawTriangle"
    shapesList.push({ render: function() {
      gl.uniform4f(u_FragColor, ...color);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_Position);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }});
  }

  // ── Background panels ──
  rawTri(-1,-1, 1,-1, -1,1, [0.05, 0.05, 0.18, 1.0]);
  rawTri( 1,-1, 1, 1, -1,1, [0.05, 0.05, 0.18, 1.0]);

  // ── Letter J ──
  // Top bar of J
  rawTri(-0.65, 0.75, -0.15, 0.75, -0.65, 0.55, [0.95, 0.78, 0.20, 1.0]);
  rawTri(-0.15, 0.75, -0.15, 0.55, -0.65, 0.55, [0.95, 0.78, 0.20, 1.0]);
  // Stem of J (right side going down)
  rawTri(-0.28, 0.55, -0.15, 0.55, -0.28,-0.20, [0.95, 0.78, 0.20, 1.0]);
  rawTri(-0.15, 0.55, -0.15,-0.20, -0.28,-0.20, [0.95, 0.78, 0.20, 1.0]);
  // Curve of J (bottom left hook)
  rawTri(-0.55,-0.20, -0.28,-0.20, -0.55,-0.40, [0.95, 0.78, 0.20, 1.0]);
  rawTri(-0.28,-0.20, -0.28,-0.40, -0.55,-0.40, [0.95, 0.78, 0.20, 1.0]);
  rawTri(-0.55,-0.40, -0.28,-0.40, -0.55,-0.55, [0.90, 0.72, 0.15, 1.0]);
  rawTri(-0.28,-0.40, -0.15,-0.55, -0.55,-0.55, [0.90, 0.72, 0.15, 1.0]);

  // ── Letter H ──
  // Left pillar of H
  rawTri(0.10, 0.75, 0.28, 0.75, 0.10,-0.55, [0.30, 0.85, 0.70, 1.0]);
  rawTri(0.28, 0.75, 0.28,-0.55, 0.10,-0.55, [0.30, 0.85, 0.70, 1.0]);
  // Right pillar of H
  rawTri(0.55, 0.75, 0.72, 0.75, 0.55,-0.55, [0.30, 0.85, 0.70, 1.0]);
  rawTri(0.72, 0.75, 0.72,-0.55, 0.55,-0.55, [0.30, 0.85, 0.70, 1.0]);
  // Crossbar of H
  rawTri(0.28, 0.18, 0.55, 0.18, 0.28,-0.02, [0.25, 0.75, 0.60, 1.0]);
  rawTri(0.55, 0.18, 0.55,-0.02, 0.28,-0.02, [0.25, 0.75, 0.60, 1.0]);

  // ── Decorative star triangles around initials ──
  var starColor = [1.0, 0.42, 0.55, 1.0];
  var s = 0.06;
  // small triangle stars
  [[-0.8, 0.5], [-0.75, -0.7], [0.85, 0.6], [0.82, -0.7], [-0.05, 0.85], [0.40, -0.75]].forEach(function(p) {
    rawTri(p[0], p[1]+s, p[0]-s, p[1]-s, p[0]+s, p[1]-s, starColor);
  });

  // ── Ground line accent ──
  rawTri(-1.0, -0.70, 1.0, -0.70, -1.0, -0.80, [0.30, 0.55, 0.90, 1.0]);
  rawTri( 1.0, -0.70, 1.0, -0.80, -1.0, -0.80, [0.30, 0.55, 0.90, 1.0]);

  renderAllShapes();
}

// ─── UI wiring ────────────────────────────────────────────────────────────────
function setupUI(canvas) {
  // Mode buttons
  var btnPoint    = document.getElementById('btnPoint');
  var btnTriangle = document.getElementById('btnTriangle');
  var btnCircle   = document.getElementById('btnCircle');

  function setMode(m) {
    g_mode = m;
    [btnPoint, btnTriangle, btnCircle].forEach(b => b.classList.remove('active'));
    if (m === 'point')    btnPoint.classList.add('active');
    if (m === 'triangle') btnTriangle.classList.add('active');
    if (m === 'circle')   btnCircle.classList.add('active');
  }
  btnPoint.onclick    = () => setMode('point');
  btnTriangle.onclick = () => setMode('triangle');
  btnCircle.onclick   = () => setMode('circle');

  // Clear
  document.getElementById('btnClear').onclick = function() {
    shapesList = [];
    renderAllShapes();
  };

  // Picture
  document.getElementById('btnPicture').onclick = drawMyPicture;

  // Color sliders
  function updateColor() {
    g_color = [
      parseInt(document.getElementById('rSlider').value) / 255,
      parseInt(document.getElementById('gSlider').value) / 255,
      parseInt(document.getElementById('bSlider').value) / 255,
      1.0
    ];
  }
  document.getElementById('rSlider').oninput = updateColor;
  document.getElementById('gSlider').oninput = updateColor;
  document.getElementById('bSlider').oninput = updateColor;

  // Size slider
  var sizeSlider = document.getElementById('sizeSlider');
  var sizeVal    = document.getElementById('sizeVal');
  sizeSlider.oninput = function() {
    g_size = parseInt(this.value);
    sizeVal.textContent = g_size;
  };

  // Segment slider
  var segSlider = document.getElementById('segSlider');
  var segVal    = document.getElementById('segVal');
  segSlider.oninput = function() {
    g_segments = parseInt(this.value);
    segVal.textContent = g_segments;
  };

  // Mouse events
  var isDown = false;
  canvas.onmousedown = function(ev) {
    isDown = true;
    click(ev, canvas);
  };
  canvas.onmousemove = function(ev) {
    if (ev.buttons === 1) click(ev, canvas);
  };
  canvas.onmouseup = function() { isDown = false; };
}

// ─── Entry point ──────────────────────────────────────────────────────────────
function main() {
  var canvas = setupWebGL();
  if (!canvas) return;
  if (!connectVariablesToGLSL()) return;
  setupUI(canvas);
  renderAllShapes();
}

// ─── Minimal shader init (replaces cuon-utils dependency) ────────────────────
function initShaders(gl, vshader, fshader) {
  var program = createProgram(gl, vshader, fshader);
  if (!program) return false;
  gl.useProgram(program);
  gl.program = program;
  return true;
}

function createProgram(gl, vshader, fshader) {
  var vs = loadShader(gl, gl.VERTEX_SHADER, vshader);
  var fs = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
  if (!vs || !fs) return null;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Link error: ' + gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

function loadShader(gl, type, src) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader error: ' + gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
