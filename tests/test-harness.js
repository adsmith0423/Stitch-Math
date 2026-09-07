// Minimal browser-ish shims so validator.js + tests.js can run under jsc.
var window = this;
if (typeof console === 'undefined') { var console = {}; }
console.clear = function () {};
console.group = function () { print.apply(null, arguments); };
console.groupCollapsed = function () { print.apply(null, arguments); };
console.groupEnd = function () {};
console.log = function () {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        if (typeof a === 'string' && (a.indexOf('color:') === 0 || a.indexOf('font-weight') === 0)) continue;
        out.push(typeof a === 'object' ? JSON.stringify(a) : String(a));
    }
    print(out.join(' ').replace(/%c/g, ''));
};
console.error = console.log;
