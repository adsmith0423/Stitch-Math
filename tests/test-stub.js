// Extras that app.js touches beyond the base dom.js stub. Loaded after dom.js.
El.prototype.setAttribute = function (k, v) { (this.attrs = this.attrs || {})[k] = String(v); };
El.prototype.getAttribute = function (k) { return (this.attrs || {})[k]; };
El.prototype.removeAttribute = function (k) { if (this.attrs) delete this.attrs[k]; };
El.prototype.querySelector = function () { return null; };
El.prototype.querySelectorAll = function () { return []; };
El.prototype.focus = function () {};
El.prototype.click = function () {};
El.prototype.scrollIntoView = function () {};
El.prototype.remove = function () {};
El.prototype.closest = function () { return null; };
El.prototype.insertBefore = function (c) { this.children.push(c); return c; };
El.prototype.removeChild = function (c) {
    var i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    return c;
};

// Export suites read the generated file text out of BLOBS.
var BLOBS = [];
if (typeof Blob === 'undefined') {
    var Blob = function (parts) {
        this.parts = parts || [];
        BLOBS.push(String((parts || [])[0]));
    };
}
if (typeof URL === 'undefined') {
    var URL = { createObjectURL: function () { return 'blob:stub'; }, revokeObjectURL: function () {} };
}
if (typeof requestAnimationFrame === 'undefined') {
    var requestAnimationFrame = function (fn) { fn(); };
}
if (typeof setTimeout === 'undefined') {
    var setTimeout = function (fn) { fn(); return 0; };
    var clearTimeout = function () {};
}
