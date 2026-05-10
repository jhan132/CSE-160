// Cube.js
// Unit cube spanning (0,0,0) -> (1,1,1) with proper UVs per face.
// Shared VBO across all cube instances (perf!).

class Cube {
  constructor() {
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.textureNum = -1;       // -1 = use base color only
    this.texColorWeight = 0.0;  // 0 = solid color, 1 = texture only
  }

  // Static buffer setup - call once at startup
  static buffer = null;
  static stride = 5 * 4; // 5 floats per vertex (x,y,z,u,v) * 4 bytes

  static initBuffer(gl) {
    if (Cube.buffer !== null) return;

    // 36 verts: 6 faces * 2 triangles * 3 verts. Each vert = pos(3) + uv(2)
    const v = new Float32Array([
      // Front (+z)
      0,0,1, 0,0,   1,0,1, 1,0,   1,1,1, 1,1,
      0,0,1, 0,0,   1,1,1, 1,1,   0,1,1, 0,1,
      // Back (-z)
      1,0,0, 0,0,   0,0,0, 1,0,   0,1,0, 1,1,
      1,0,0, 0,0,   0,1,0, 1,1,   1,1,0, 0,1,
      // Top (+y)
      0,1,1, 0,0,   1,1,1, 1,0,   1,1,0, 1,1,
      0,1,1, 0,0,   1,1,0, 1,1,   0,1,0, 0,1,
      // Bottom (-y)
      0,0,0, 0,0,   1,0,0, 1,0,   1,0,1, 1,1,
      0,0,0, 0,0,   1,0,1, 1,1,   0,0,1, 0,1,
      // Right (+x)
      1,0,1, 0,0,   1,0,0, 1,0,   1,1,0, 1,1,
      1,0,1, 0,0,   1,1,0, 1,1,   1,1,1, 0,1,
      // Left (-x)
      0,0,0, 0,0,   0,0,1, 1,0,   0,1,1, 1,1,
      0,0,0, 0,0,   0,1,1, 1,1,   0,1,0, 0,1
    ]);

    Cube.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  }

  // Bind the shared cube VBO + attribs once before drawing many cubes
  static bindForDraw(gl, a_Position, a_TexCoord) {
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.buffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, Cube.stride, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, Cube.stride, 3 * 4);
    gl.enableVertexAttribArray(a_TexCoord);
  }

  render(gl, u_ModelMatrix, u_BaseColor, u_WhichTexture, u_TexColorWeight) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    gl.uniform4f(u_BaseColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_WhichTexture, this.textureNum);
    gl.uniform1f(u_TexColorWeight, this.texColorWeight);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}
