// Model.js - CSE-160 Assignment 4
// Minimal Wavefront .obj loader (asgn4 step 11: "create a Model.js class
// similar to the one you implemented in the lab ... parse .obj files the
// same way as in the lab").
//
// Handles: v (positions), vn (normals), vt (texcoords), and f faces in any of
// the forms  f v v v  |  f v/vt v/vt ...  |  f v//vn ...  |  f v/vt/vn ...
// Faces with more than 3 verts are fan-triangulated. If the file has no
// normals, per-face normals are computed (edge1 x edge2).
//
// Models exported from Blender per "Converting 3D Models for use in the 160
// Loader" (Forward Z, Up Y, Triangulated Mesh + Normals) load directly.

class Model {
  constructor() {
    this.matrix         = new Matrix4();
    this.color          = [0.8, 0.8, 0.85, 1];
    this.textureNum     = -1;
    this.texColorWeight = 0.0;
    this.emissive       = 0;
    this.ready          = false;
    this.numVerts       = 0;
  }

  // Asynchronously fetch + parse an .obj file, then build buffers.
  loadFromOBJ(gl, url) {
    const req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.onreadystatechange = () => {
      if (req.readyState === 4) {
        if (req.status === 200 || req.status === 0) {
          this.parse(gl, req.responseText);
        } else {
          console.log('Model: could not load ' + url + ' (status ' + req.status + ')');
        }
      }
    };
    req.send();
  }

  parse(gl, text) {
    const positions = [];   // raw v
    const normals   = [];   // raw vn
    const texcoords = [];   // raw vt

    const outPos  = [];
    const outNorm = [];
    const outUV   = [];

    const lines = text.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line === '' || line[0] === '#') continue;
      const parts = line.split(/\s+/);
      const tag = parts[0];

      if (tag === 'v') {
        positions.push([+parts[1], +parts[2], +parts[3]]);
      } else if (tag === 'vn') {
        normals.push([+parts[1], +parts[2], +parts[3]]);
      } else if (tag === 'vt') {
        texcoords.push([+parts[1], +parts[2]]);
      } else if (tag === 'f') {
        // collect the verts of this face, then fan-triangulate
        const face = parts.slice(1).map((tok) => {
          const idx = tok.split('/');
          // OBJ indices are 1-based; allow blanks (e.g. v//vn)
          const vi = parseInt(idx[0], 10) - 1;
          const ti = idx[1] ? parseInt(idx[1], 10) - 1 : -1;
          const ni = idx[2] ? parseInt(idx[2], 10) - 1 : -1;
          return { vi, ti, ni };
        });

        for (let k = 1; k < face.length - 1; k++) {
          const tri = [face[0], face[k], face[k + 1]];

          // if no normals supplied, compute one for this triangle
          let faceNormal = null;
          if (tri[0].ni < 0) {
            const p0 = positions[tri[0].vi];
            const p1 = positions[tri[1].vi];
            const p2 = positions[tri[2].vi];
            const e1 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]];
            const e2 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]];
            faceNormal = [
              e1[1]*e2[2] - e1[2]*e2[1],
              e1[2]*e2[0] - e1[0]*e2[2],
              e1[0]*e2[1] - e1[1]*e2[0],
            ];
            const len = Math.hypot(faceNormal[0], faceNormal[1], faceNormal[2]) || 1;
            faceNormal = faceNormal.map((c) => c / len);
          }

          for (const vert of tri) {
            const p = positions[vert.vi];
            outPos.push(p[0], p[1], p[2]);

            if (vert.ni >= 0) {
              const n = normals[vert.ni];
              outNorm.push(n[0], n[1], n[2]);
            } else {
              outNorm.push(faceNormal[0], faceNormal[1], faceNormal[2]);
            }

            if (vert.ti >= 0 && texcoords[vert.ti]) {
              const t = texcoords[vert.ti];
              outUV.push(t[0], t[1]);
            } else {
              outUV.push(0, 0);
            }
          }
        }
      }
    }

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outPos), gl.STATIC_DRAW);

    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outNorm), gl.STATIC_DRAW);

    this.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(outUV), gl.STATIC_DRAW);

    this.numVerts = outPos.length / 3;
    this.ready = true;
    console.log('Model loaded: ' + this.numVerts + ' vertices');
  }

  render(gl) {
    if (!this.ready) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_TexCoord);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
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

    gl.drawArrays(gl.TRIANGLES, 0, this.numVerts);
  }
}
