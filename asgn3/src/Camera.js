// Camera.js
// First-person camera w/ keyboard + mouse controls.
// Based on Matsuda Ch.7 (PerspectiveView_mvp.js), specifically the
// approach of passing View and Projection matrices as separate uniforms
// to the vertex shader (instead of pre-multiplying on JS side).
// Method spec follows the asgn3 instructions:
//   moveForward:  f = at - eye, normalize, scale by speed, eye += f, at += f
//   panLeft:      rotate (at-eye) by alpha around up vector

class Camera {
  constructor(canvas) {
    this.fov = 60;
    this.eye = new Vector3([16, 1.6, 28]);
    this.at  = new Vector3([16, 1.6, 27]);
    this.up  = new Vector3([0, 1, 0]);

    this.viewMatrix = new Matrix4();
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
      this.up.elements[0],  this.up.elements[1],  this.up.elements[2]
    );

    this.projectionMatrix = new Matrix4();
    this.projectionMatrix.setPerspective(
      this.fov,
      canvas.width / canvas.height,
      0.1, 1000
    );

    this.speed = 0.25;
    this.alpha = 4; // degrees per QE press
  }

  updateView() {
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
      this.up.elements[0],  this.up.elements[1],  this.up.elements[2]
    );
  }

  // f = at - eye, normalize, scale, then eye += f and at += f
  moveForward() {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.normalize();
    f.mul(this.speed);
    this.eye.add(f);
    this.at.add(f);
    this.updateView();
  }

  // backward = eye - at
  moveBackwards() {
    let b = new Vector3();
    b.set(this.eye);
    b.sub(this.at);
    b.normalize();
    b.mul(this.speed);
    this.eye.add(b);
    this.at.add(b);
    this.updateView();
  }

  // s = up x f for left
  moveLeft() {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    let s = Vector3.cross(this.up, f);
    s.normalize();
    s.mul(this.speed);
    this.eye.add(s);
    this.at.add(s);
    this.updateView();
  }

  // s = f x up for right
  moveRight() {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    let s = Vector3.cross(f, this.up);
    s.normalize();
    s.mul(this.speed);
    this.eye.add(s);
    this.at.add(s);
    this.updateView();
  }

  // rotate `at` around the up vector by alpha degrees
  panLeft(alphaOverride) {
    let alpha = (alphaOverride === undefined) ? this.alpha : alphaOverride;
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    let rotMat = new Matrix4();
    rotMat.setRotate(alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
    let f_prime = rotMat.multiplyVector3(f);

    // at = eye + f_prime
    this.at.set(this.eye);
    this.at.add(f_prime);
    this.updateView();
  }

  panRight(alphaOverride) {
    let alpha = (alphaOverride === undefined) ? this.alpha : alphaOverride;
    this.panLeft(-alpha);
  }

  // Look up/down: rotate around the side vector instead of up
  panUp(amount) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    // clamp pitch so we don't flip
    let curPitch = Math.asin(f.elements[1] / f.magnitude()) * 180 / Math.PI;
    let newPitch = curPitch + amount;
    if (newPitch > 85)  amount = 85 - curPitch;
    if (newPitch < -85) amount = -85 - curPitch;

    let side = Vector3.cross(f, this.up);
    side.normalize();

    let rotMat = new Matrix4();
    rotMat.setRotate(amount, side.elements[0], side.elements[1], side.elements[2]);
    let f_prime = rotMat.multiplyVector3(f);

    this.at.set(this.eye);
    this.at.add(f_prime);
    this.updateView();
  }

  panDown(amount) { this.panUp(-amount); }

  // helper: where am I looking? returns a forward unit vector (for add/delete blocks)
  getForward() {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.normalize();
    return f;
  }
}
