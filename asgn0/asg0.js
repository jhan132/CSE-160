function main() {
  var canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Failed to retrieve the canvas element');
    return;
  }

  var v1 = new Vector3([2.25, 2.25, 0]);
  drawVector(v1, "red");
}

function drawVector(v, color) {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var scale = 20;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + v.elements[0] * scale, cy - v.elements[1] * scale);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function handleDrawOperationEvent() {
  var canvas = document.getElementById('example');
  var ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var v1x = parseFloat(document.getElementById('v1x').value);
  var v1y = parseFloat(document.getElementById('v1y').value);
  var v2x = parseFloat(document.getElementById('v2x').value);
  var v2y = parseFloat(document.getElementById('v2y').value);
  var scalar = parseFloat(document.getElementById('scalar').value);
  var op = document.getElementById('operation').value;

  var v1 = new Vector3([v1x, v1y, 0]);
  var v2 = new Vector3([v2x, v2y, 0]);

  drawVector(v1, "red");
  drawVector(v2, "blue");

  if (op === "add") {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.add(v2);
    drawVector(v3, "green");

  } else if (op === "sub") {
    var v3 = new Vector3([v1x, v1y, 0]);
    v3.sub(v2);
    drawVector(v3, "green");

  } else if (op === "mul") {
    var v3 = new Vector3([v1x, v1y, 0]);
    var v4 = new Vector3([v2x, v2y, 0]);
    v3.mul(scalar);
    v4.mul(scalar);
    drawVector(v3, "green");
    drawVector(v4, "green");

  } else if (op === "div") {
    var v3 = new Vector3([v1x, v1y, 0]);
    var v4 = new Vector3([v2x, v2y, 0]);
    v3.div(scalar);
    v4.div(scalar);
    drawVector(v3, "green");
    drawVector(v4, "green");

  } else if (op === "magnitude") {
    console.log("Magnitude v1: " + v1.magnitude());
    console.log("Magnitude v2: " + v2.magnitude());

  } else if (op === "normalize") {
    var v3 = new Vector3([v1x, v1y, 0]);
    var v4 = new Vector3([v2x, v2y, 0]);
    v3.normalize();
    v4.normalize();
    drawVector(v3, "green");
    drawVector(v4, "green");

  } else if (op === "angleBetween") {
    var angle = Math.acos(Vector3.dot(v1, v2) / (v1.magnitude() * v2.magnitude()));
    console.log("Angle: " + (angle * 180 / Math.PI));

  } else if (op === "area") {
    var cross = Vector3.cross(v1, v2);
    console.log("Area of the triangle: " + cross.magnitude() / 2);
  }
}