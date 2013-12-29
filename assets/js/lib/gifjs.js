// Wrapped in define for require by cdary - 2013-12-29
define(function(require, exports, module) {
    require('gif_js/gif');

    /**
     * Hacky workaround for gif.js's odd build and my perceived inability to set `this` scope for gif.js in require
     * TODO: There just has, HAS, to be a better way to do this.
    **/
    var ret = {
        "GIF": window.GIF
    };
    delete window.GIF;
    
    return ret;
});