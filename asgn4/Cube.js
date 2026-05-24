// Cube.js - CSE-160 Assignment 4
// Unit cube spanning [0,1]^3 (corner at origin), same footprint as the
// asg3 cube so the existing world (walls/ground/bat/gems) renders identically.
//
// ASG4 change: each vertex now carries a NORMAL (asgn4 instruction step 2 -
// "create another buffer to pass a Normal for each vertex"). Normals are the
// per-face outward directions, typed in by hand as the instructions suggest.
//
// Buffers are static (built once) and shared by every Cube instance, matching
// the GPU-buffer optimization from the earlier lab (don't re-upload per draw).

class Cube {
  constructor() {
    this.matrix         = new Matrix4();
    this.color          = [1, 1, 1, 1];
    this.textureNum     = -1;   // -1 = use solid color, 0..3 = sampler
    this.texColorWeight = 0.0;  // 0 = pure color, 1 = pure texture
    this.emissive       = 0;    // 1 = draw flat / unlit (sky, light markers)
  }

  // Build the shared vertex / uv / normal buffers. Call once after GL is ready.
  static initBuffers(gl) {
    // 6 faces * 2 triangles * 3 verts = 36 vertices.
    // Vertices go from (0,0,0) to (1,1,1).
    const V = [
      // front (+Z)
      0,0,1,  1,0,1,  1,1,1,   0,0,1,  1,1,1,  0,1,1,
      // back (-Z)
      1,0,0,  0,0,0,  0,1,0,   1,0,0,  0,1,0,  1,1,0,
      // right (+X)
      1,0,1,  1,0,0,  1,1,0,   1,0,1,  1,1,0,  1,1,1,
      // left (-X)
      0,0,0,  0,0,1,  0,1,1,   0,0,0,  0,1,1,  0,1,0,
      // top (+Y)
      0,1,1,  1,1,1,  1,1,0,   0,1,1,  1,1,0,  0,1,0,
      // bottom (-Y)
      0,0,0,  1,0,0,  1,0,1,   0,0,0,  1,0,1,  0,0,1,
    ];

    const N = [
      // front (+Z)
      0,0,1, 0,0,1, 0,0,1,  0,0,1, 0,0,1, 0,0,1,
      // back (-Z)
      0,0,-1, 0,0,-1, 0,0,-1,  0,0,-1, 0,0,-1, 0,0,-1,
      // right (+X)
      1,0,0, 1,0,0, 1,0,0,  1,0,0, 1,0,0, 1,0,0,
      // left (-X)
      -1,0,0, -1,0,0, -1,0,0,  -1,0,0, -1,0,0, -1,0,0,
      // top (+Y)
      0,1,0, 0,1,0, 0,1,0,  0,1,0, 0,1,0, 0,1,0,
      // bottom (-Y)
      0,-1,0, 0,-1,0, 0,-1,0,  0,-1,0, 0,-1,0, 0,-1,0,
    ];

    // one (0,0)-(1,1) square per face
    const faceUV = [0,0, 1,0, 1,1,  0,0, 1,1, 0,1];
    const UV = [];
    for (let f = 0; f < 6; f++) UV.push(...faceUV);

    Cube.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);

    Cube.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(UV), gl.STATIC_DRAW);

    Cube.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N), gl.STATIC_DRAW);

    Cube.numVerts = 36;
  }

  render(gl) {
    // position
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.positionBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    // uv
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.uvBuffer);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_TexCoord);
    // normal
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    // model + normal matrices (normal matrix = inverse transpose of model)
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(this.matrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    // per-object material state
    gl.uniform4f(u_BaseColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_WhichTexture, this.textureNum);
    gl.uniform1f(u_TexColorWeight, this.texColorWeight);
    gl.uniform1i(u_Emissive, this.emissive);

    gl.drawArrays(gl.TRIANGLES, 0, Cube.numVerts);
  }
}
