// webgl-debug.js - minimal stub (production passthrough)
WebGLDebugUtils = function() {
  var makeDebugContext = function(ctx) {
    return ctx;
  };
  return { makeDebugContext: makeDebugContext };
}();
