// Sphere.js - CSE-160 Assignment 4
// Generated with a latitude/longitude loop (asgn4 step 3: "write a loop, and
// use some trig to calculate the vertex locations").
//
// The sphere is centered on the origin, so for every vertex Normal = Position
// (asgn4 step 3: "spheres are convenient objects in that if they are centered
// on the origin, then Normal = Position"). We just normalize the position.
//
// Radius is 0.5 so an un-scaled sphere is a unit-diameter ball, matching the
// [0,1] cube footprint. Scale it up in the model matrix as needed.

class Sphere {
  constructor() {
    this.matrix         = new Matrix4();
    this.color          = [1, 0.2, 0.2, 1];
    this.textureNum     = -1;
    this.texColorWeight = 0.0;
    this.emissive       = 0;
  }

  static initBuffers(gl) {
    const DIV = 24;          // segments around / down
    const R   = 0.5;
    const positions = [];
    const normals   = [];
    const uvs       = [];

    // grid of (x,y,z) on the unit sphere
    const grid = [];
    for (let j = 0; j <= DIV; j++) {
      const aj = j * Math.PI / DIV;     // 0..PI  (latitude)
      const sj = Math.sin(aj), cj = Math.cos(aj);
      const row = [];
      for (let i = 0; i <= DIV; i++) {
        const ai = i * 2 * Math.PI / DIV; // 0..2PI (longitude)
        const si = Math.sin(ai), ci = Math.cos(ai);
        row.push({
          x: si * sj, y: cj, z: ci * sj,
          u: i / DIV, v: j / DIV
        });
      }
      grid.push(row);
    }

    // two triangles per quad (non-indexed list for drawArrays)
    const pushVert = (p) => {
      positions.push(p.x * R, p.y * R, p.z * R);
      normals.push(p.x, p.y, p.z);   // already unit length -> Normal = Position
      uvs.push(p.u, p.v);
    };
    for (let j = 0; j < DIV; j++) {
      for (let i = 0; i < DIV; i++) {
        const a = grid[j][i],   b = grid[j + 1][i];
        const c = grid[j + 1][i + 1], d = grid[j][i + 1];
        pushVert(a); pushVert(b); pushVert(d);
        pushVert(b); pushVert(c); pushVert(d);
      }
    }

    Sphere.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    Sphere.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    Sphere.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    Sphere.numVerts = positions.length / 3;
  }

  render(gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.positionBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.uvBuffer);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_TexCoord);

    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(this.matrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    gl.uniform4f(u_BaseColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_WhichTexture, this.textureNum);
    gl.uniform1f(u_TexColorWeight, this.texColorWeight);
    gl.uniform1i(u_Emissive, this.emissive);

    gl.drawArrays(gl.TRIANGLES, 0, Sphere.numVerts);
  }
}
