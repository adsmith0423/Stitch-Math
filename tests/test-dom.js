// Minimal DOM/browser stub so app.js can run headlessly under jsc.
var window = this;

if (typeof structuredClone === 'undefined') {
    var structuredClone = function (o) { return JSON.parse(JSON.stringify(o)); };
}

var ALERTS = [];
function alert(msg) { ALERTS.push(String(msg)); }
function confirm() { return true; }

var localStorage = (function () {
    var store = {};
    return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
    };
})();

function El(tag, id) {
    this.tagName = (tag || 'div').toUpperCase();
    this._id = '';
    this.id = id || '';
    this.value = '';
    this.checked = false;
    this.selectedIndex = 0;
    this.children = [];
    this._text = '';
    this._html = '';
    this.style = {};
    this.listeners = {};
    this.className = '';
    this.dataset = {};

    // Backed by className, like the real thing. It used to be three no-ops with
    // contains() hard-wired to false, so any assertion about a class passed without
    // proving anything, and classList.toggle threw outright.
    var self = this;
    function classes() { return self.className.split(/\s+/).filter(Boolean); }
    this.classList = {
        add: function () {
            var list = classes();
            for (var i = 0; i < arguments.length; i++) {
                if (list.indexOf(arguments[i]) < 0) list.push(arguments[i]);
            }
            self.className = list.join(' ');
        },
        remove: function () {
            var drop = Array.prototype.slice.call(arguments);
            self.className = classes().filter(function (c) { return drop.indexOf(c) < 0; }).join(' ');
        },
        contains: function (c) { return classes().indexOf(c) >= 0; },
        toggle: function (c, force) {
            var on = (force === undefined) ? !this.contains(c) : !!force;
            if (on) this.add(c); else this.remove(c);
            return on;
        }
    };
}
El.prototype.addEventListener = function (ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
};
El.prototype.fire = function (ev) {
    (this.listeners[ev] || []).forEach(function (fn) { fn({ preventDefault: function () {} }); });
};
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.append = function () {
    for (var i = 0; i < arguments.length; i++) this.children.push(arguments[i]);
};
El.prototype.replaceChildren = function () {
    this.children = [];
    for (var i = 0; i < arguments.length; i++) this.children.push(arguments[i]);
};
El.prototype.reset = function () {};
// Flattened visible text, for assertions.
El.prototype.text = function () {
    if (this.children.length === 0) return this._text || this._html.replace(/<[^>]*>/g, '');
    return this.children.map(function (c) { return c.text(); }).join(' | ');
};
Object.defineProperty(El.prototype, 'textContent', {
    get: function () { return this._text; },
    set: function (v) { this._text = String(v); this.children = []; }
});
Object.defineProperty(El.prototype, 'innerHTML', {
    get: function () { return this._html; },
    set: function (v) { this._html = String(v); this.children = []; }
});
Object.defineProperty(El.prototype, 'innerText', {
    get: function () { return this._text; },
    set: function (v) { this._text = String(v); }
});

var REGISTRY = {};

// An element built with createElement and given an id is findable by that id, the way it
// is in a browser once it is in the document. Without this, code that builds a control
// and then reads it back through getElementById silently talked to a different object,
// so any wiring done that way looked fine and did nothing.
Object.defineProperty(El.prototype, 'id', {
    get: function () { return this._id; },
    set: function (value) {
        this._id = value || '';
        if (this._id) REGISTRY[this._id] = this;
    }
});
var DOM_READY = [];
// Listeners bound to the document itself, kept rather than dropped so that a shortcut
// wired up there can be fired at from a test. DOMContentLoaded stays separate because
// boot() replays it on demand instead of on registration.
var DOC_LISTENERS = {};
var document = {
    getElementById: function (id) {
        if (!REGISTRY[id]) REGISTRY[id] = new El('div', id);
        return REGISTRY[id];
    },
    createElement: function (tag) { return new El(tag); },
    addEventListener: function (ev, fn) {
        if (ev === 'DOMContentLoaded') { DOM_READY.push(fn); return; }
        (DOC_LISTENERS[ev] = DOC_LISTENERS[ev] || []).push(fn);
    }
};

// Dispatch a document-level event. `props` supplies whatever the handler reads off it
// (key, metaKey, ...); prevented() afterwards reports whether it called preventDefault.
function fireDocument(ev, props) {
    var e = { type: ev, defaultPrevented: false };
    for (var k in (props || {})) e[k] = props[k];
    e.preventDefault = function () { e.defaultPrevented = true; };
    (DOC_LISTENERS[ev] || []).forEach(function (fn) { fn(e); });
    return e;
}

function $(id) { return document.getElementById(id); }
function boot() { DOM_READY.forEach(function (fn) { fn(); }); }
