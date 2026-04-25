// Cylinder.js - non-cube primitive (rubric: 0.5pts)
// generates a cylinder centered on Y axis from y=0 to y=1, radius 0.5

class Cylinder {
  constructor() {
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.segments = 12;
  }

  render() {
    const rgba = this.color;
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    const r = 0.5;
    const seg = this.segments;
    const step = (Math.PI * 2) / seg;

    // side faces
    for (let i = 0; i < seg; i++) {
      const a1 = i * step;
      const a2 = (i + 1) * step;
      const x1 = r * Math.cos(a1), z1 = r * Math.sin(a1);
      const x2 = r * Math.cos(a2), z2 = r * Math.sin(a2);

      // alternate shade so its visible
      const s = (i % 2 === 0) ? 1.0 : 0.85;
      gl.uniform4f(u_FragColor, rgba[0]*s, rgba[1]*s, rgba[2]*s, rgba[3]);

      drawTriangle3D([x1,0,z1,  x2,0,z2,  x2,1,z2]);
      drawTriangle3D([x1,0,z1,  x2,1,z2,  x1,1,z1]);
    }

    // top cap
    gl.uniform4f(u_FragColor, rgba[0]*0.9, rgba[1]*0.9, rgba[2]*0.9, rgba[3]);
    for (let i = 0; i < seg; i++) {
      const a1 = i * step;
      const a2 = (i + 1) * step;
      drawTriangle3D([
        0, 1, 0,
        r*Math.cos(a1), 1, r*Math.sin(a1),
        r*Math.cos(a2), 1, r*Math.sin(a2)
      ]);
    }

    // bottom cap
    gl.uniform4f(u_FragColor, rgba[0]*0.7, rgba[1]*0.7, rgba[2]*0.7, rgba[3]);
    for (let i = 0; i < seg; i++) {
      const a1 = i * step;
      const a2 = (i + 1) * step;
      drawTriangle3D([
        0, 0, 0,
        r*Math.cos(a2), 0, r*Math.sin(a2),
        r*Math.cos(a1), 0, r*Math.sin(a1)
      ]);
    }
  }
}
