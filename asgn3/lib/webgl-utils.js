// webgl-utils.js
// Stripped Khronos helper for WebGL setup
WebGLUtils = function() {
  var setupWebGL = function(canvas, opt_attribs) {
    function showLink(str) { console.log('WebGL not supported: ' + str); }
    if (!window.WebGLRenderingContext) { showLink('no WebGL'); return null; }
    var ctx = create3DContext(canvas, opt_attribs);
    if (!ctx) showLink('failed to create context');
    return ctx;
  };

  var create3DContext = function(canvas, opt_attribs) {
    var names = ['webgl', 'experimental-webgl'];
    var context = null;
    for (var i = 0; i < names.length; ++i) {
      try { context = canvas.getContext(names[i], opt_attribs); } catch (e) {}
      if (context) break;
    }
    return context;
  };

  return { create3DContext: create3DContext, setupWebGL: setupWebGL };
}();
