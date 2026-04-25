// webgl-debug.js - minimal stub
WebGLDebugUtils = function() {
  var makeDebugContext = function(ctx) {
    return ctx;  // no-op for production, just pass through
  };
  return { makeDebugContext: makeDebugContext };
}();
