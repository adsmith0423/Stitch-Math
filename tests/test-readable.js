/**
 * Readable mode - the third appearance, and the only one with a measurable promise attached.
 *
 * THE RULE THIS SUITE EXISTS TO ENFORCE. Every colour pair Readable declares carries text at 7:1
 * or better - AAA at any size, not just at large. That number is not a comment here: the contrast
 * is recomputed from the hex values in style.css on every run, so a pair edited to look nicer and
 * read worse fails the build rather than shipping.
 *
 * What this suite CANNOT see is what the browser actually paints - a token can be perfect and a
 * rule can still put pale text on a pale panel. tests/browser/contrast.spec.mjs walks the rendered
 * page in a real browser and checks every visible text node; it needs a layout engine, so it lives
 * with the storage suite rather than here. Both are release blockers.
 */
boot();

var CSS = readFile('style.css');
var HTML = readFile('index.html');
var SRC = readFile('app.js');

/* ---- Contrast, computed rather than asserted from memory ---------------------------------- */
function channel(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
    var v = hex.replace('#', '');
    return 0.2126 * channel(parseInt(v.substr(0, 2), 16))
         + 0.7152 * channel(parseInt(v.substr(2, 2), 16))
         + 0.0722 * channel(parseInt(v.substr(4, 2), 16));
}
function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    var hi = Math.max(x, y), lo = Math.min(x, y);
    return (hi + 0.05) / (lo + 0.05);
}

/** The Readable token block, as a name -> hex map. Parsed, not transcribed. */
function readableTokens() {
    var start = CSS.indexOf(':root[data-theme="readable"] {');
    var body = CSS.slice(start, CSS.indexOf('\n}', start));
    var map = {};
    body.replace(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g, function (all, name, hex) {
        map[name] = hex.toUpperCase();
        return all;
    });
    return map;
}
var T = readableTokens();

print('\n1. The block exists and was read');
ok('there is a readable block in the stylesheet', CSS.indexOf(':root[data-theme="readable"] {') !== -1);
ok('and it declares a good number of colours, it declares ' + Object.keys(T).length,
   Object.keys(T).length >= 30);
ok('including the ground and the ink', !!T['--sea-0'] && !!T['--ink'] && !!T['--paper']);

print('\n2. EVERY declared pair carries text at AAA');
// The pastel pairs: a fill and the ink that reads on it. A rule that paints one paints both, so
// these are the pairs the page actually puts together - checked in that combination, not against
// some notional white.
['mint', 'lavender', 'pink', 'butter', 'sky', 'peach', 'aqua', 'coral'].forEach(function (hue) {
    var fill = T['--' + hue], ink = T['--' + hue + '-ink'];
    ok(hue + ' declares both halves of its pair', !!fill && !!ink);
    if (!fill || !ink) return;
    var r = contrast(ink, fill);
    ok(hue + ' ink on ' + hue + ' fill is AAA, it is ' + r.toFixed(2) + ':1', r >= 7);
});
// Body text on both surfaces the app uses: the cream ground and the white panel.
[['--ink', '--sea-0'], ['--ink', '--paper'], ['--ink-soft', '--sea-0'], ['--ink-soft', '--paper']].forEach(function (pair) {
    var r = contrast(T[pair[0]], T[pair[1]]);
    ok(pair[0] + ' on ' + pair[1] + ' is AAA, it is ' + r.toFixed(2) + ':1', r >= 7);
});
// The status colours, which sit on the panel.
['--danger-text', '--success-text', '--warning-text', '--primary'].forEach(function (name) {
    var r = contrast(T[name], T['--paper']);
    ok(name + ' on paper is AAA, it is ' + r.toFixed(2) + ':1', r >= 7);
});
// A border is not text, so 3:1 is the bar it has to clear - but it has to clear it, because with
// the shadows gone the line is the only thing separating a panel from the page.
ok('the border reads against the ground, at ' + contrast(T['--border'], T['--sea-0']).toFixed(2) + ':1',
   contrast(T['--border'], T['--sea-0']) >= 3);

print('\n3. The type scale is a token, and Readable moves it');
// 200-odd font-sizes were written out as 13px and 14px before this. A theme that wants the whole
// page a step larger cannot do it one rule at a time.
['--fs-xs', '--fs-sm', '--fs-nav', '--fs-base', '--fs-md', '--fs-lg'].forEach(function (name) {
    ok(name + ' is defined', new RegExp('\\' + name + ':\\s*\\d+px').test(CSS));
    ok('and Readable raises it', new RegExp('\\' + name + ':\\s*\\d+px').test(
        CSS.slice(CSS.indexOf(':root[data-theme="readable"] {'))));
});
function px(name, scope) {
    var m = scope.match(new RegExp('\\' + name + ':\\s*(\\d+)px'));
    return m ? Number(m[1]) : 0;
}
var DAY = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('\n}', CSS.indexOf(':root {')));
var READ = CSS.slice(CSS.indexOf(':root[data-theme="readable"] {'));
READ = READ.slice(0, READ.indexOf('\n}'));
['--fs-xs', '--fs-sm', '--fs-nav', '--fs-base'].forEach(function (name) {
    ok(name + ' is larger than by day (' + px(name, DAY) + ' -> ' + px(name, READ) + ')',
       px(name, READ) > px(name, DAY));
});
ok('and the smallest text on the page is at least 15px, it is ' + px('--fs-xs', READ),
   px('--fs-xs', READ) >= 15);
// No stragglers among the sizes that MATTER. The seven raw values left are display figures - the
// health number at 34, the tile counts at 30, a close glyph at 19 - and they are already far above
// the size anyone struggles with; a theme moving them up buys nothing. Everything a sentence is set
// in has to be a token, or Readable cannot lift it.
var raw = (CSS.match(/font-size: \d+px/g) || []).map(function (m) { return Number(m.match(/\d+/)[0]); });
var small = raw.filter(function (n) { return n < 19; });
ck('no text size below 19px is hard-coded' + (small.length ? ' (' + small.join(', ') + ')' : ''),
   small.length, 0);
ok('and the raw ones left are all display figures, smallest is ' + Math.min.apply(null, raw.concat([99])),
   raw.every(function (n) { return n >= 19; }));

print('\n4. What Readable takes away');
ok('the rounded display face is dropped for the body face',
   /:root\[data-theme="readable"\][\s\S]*?font-family: var\(--font-body\)/.test(CSS));
ok('the washes are cleared', /--wash-teal: transparent/.test(READ));
ok('the blur is off', /--glass-blur: none/.test(READ));
['--glass-shadow', '--gum-sheen', '--btn-shadow', '--btn-gloss'].forEach(function (name) {
    ok(name + ' is switched off', new RegExp('\\' + name + ': none').test(READ));
});
ok('nothing transitions', /:root\[data-theme="readable"\] \*,[\s\S]{0,200}transition: none !important/.test(CSS));
ok('and nothing animates', /:root\[data-theme="readable"\] \*,[\s\S]{0,200}animation: none !important/.test(CSS));

print('\n5. What Readable adds');
ok('figures are tabular, lining and slash-zeroed',
   /font-variant-numeric: lining-nums tabular-nums slashed-zero/.test(READ));
ok('links are underlined rather than only coloured',
   /:root\[data-theme="readable"\] a,[\s\S]{0,220}text-decoration: underline/.test(CSS));
ok('the focus ring is 3px', /:root\[data-theme="readable"\] :focus-visible \{[^}]*outline: 3px/.test(CSS));
ok('controls are at least 44px tall', /min-height: 44px/.test(CSS));
ok('and prose stops at a measure', /:root\[data-theme="readable"\][\s\S]{0,400}max-width: 68ch/.test(CSS));

print('\n6. The bare-control rules sit UNDER the class layer');
// html:where([data-theme="readable"]) button scores 0,0,2 - above `button {}` and below any class.
// Written as :root[data-theme="readable"] button it scored 0,1,1, boxed every borderless button on
// the page and pushed the lint rail's badge out of its own rail.
ok('they are written with html:where(), not :root',
   /html:where\(\[data-theme="readable"\]\) button/.test(CSS));
no('and not as a plain descendant of :root', /:root\[data-theme="readable"\] button \{/.test(CSS));

print('\n7. It is a fourth word everywhere the other three are known');
ok('app.js knows it', /THEME_MODES = \['system', 'day', 'night', 'readable'\]/.test(SRC));
ok('the head script knows it', /readable/.test(HTML.slice(0, HTML.indexOf('</head>'))));
ok('and the select offers it', /<option value="readable">/.test(HTML));
// Not reachable from the OS: no system signal means "the most legible page you have".
ok('applyTheme resolves it on its own', /mode === 'readable' \? 'readable'/.test(SRC));
no('and system never resolves to it', /system[^\n]*readable/.test(SRC.slice(SRC.indexOf('function applyTheme'))));

print('\n8. Choosing it, through the control the designer uses');
$('theme-mode').value = 'readable'; $('theme-mode').fire('change');
ck('the document says so', document.documentElement.dataset.theme, 'readable');
ck('and it is remembered', JSON.parse(localStorage.getItem('stitchmath_view_prefs')).theme, 'readable');
// An appearance is about the room, not the file.
$('new-file-btn').fire('click');
ck('New File keeps it', JSON.parse(localStorage.getItem('stitchmath_view_prefs')).theme, 'readable');
ck('and the document stays readable', document.documentElement.dataset.theme, 'readable');
$('theme-mode').value = 'night'; $('theme-mode').fire('change');
ck('switching away resolves to dark again', document.documentElement.dataset.theme, 'dark');
$('theme-mode').value = 'readable'; $('theme-mode').fire('change');
ck('and back', document.documentElement.dataset.theme, 'readable');
// A hand-edited store cannot pick a look the stylesheet does not have. Asserted on what gets
// APPLIED rather than on what the select reads back: this suite boots repeatedly into one module
// scope, so the in-memory preference survives a boot in a way it never does in a browser, and a
// test written against the select would be testing the harness.
localStorage.setItem('stitchmath_view_prefs', JSON.stringify({ theme: 'enormous' }));
boot();
ok('an unknown word is never applied to the document',
   ['light', 'dark', 'readable'].indexOf(document.documentElement.dataset.theme) !== -1);
ok('and is never written back to the store',
   ['system', 'day', 'night', 'readable']
       .indexOf(JSON.parse(localStorage.getItem('stitchmath_view_prefs')).theme) !== -1);
$('theme-mode').value = 'system'; $('theme-mode').fire('change');

print('\n9. The sidebar is a surface, in every appearance');
/*
 * The rail has to read as a different surface from the page it navigates. It did not: a gradient
 * behind a backdrop blur picked up whatever wash was behind it, and Readable had no rail colour at
 * all - the base rule used the `background` SHORTHAND for its gradient, which resets
 * background-color to transparent, so overriding background-image alone left the rail painted with
 * the ground.
 *
 * Checked as lightness rather than contrast: two surfaces that touch do not need 4.5:1, they need
 * to look like two surfaces. L* is the perceptual scale, and the step is asserted in it - by Y
 * alone night's old rail looked fine (0.008 against 0.011) while being invisible on screen.
 */
function lstar(hex) {
    var y = luminance(hex);
    return y > 0.008856 ? 116 * Math.pow(y, 1 / 3) - 16 : 903.3 * y;
}
var SIDEBAR_RULE = CSS.slice(CSS.indexOf('\n#app-sidebar {'));
SIDEBAR_RULE = SIDEBAR_RULE.slice(0, SIDEBAR_RULE.indexOf('\n}'));
ok('the rail paints a background-COLOR, so it can never inherit the ground',
   /background-color: var\(--sidebar-bg\)/.test(SIDEBAR_RULE));
no('and not the shorthand, which resets the colour to transparent',
   /\n\s*background:/.test(SIDEBAR_RULE));
no('there is no blur on it', /backdrop-filter/.test(SIDEBAR_RULE));
no('--sidebar-bg-deep is retired, not left dangling', /--sidebar-bg-deep/.test(CSS));

// The rail paints the PAGE's blooms at the page's anchors, attached the same way, so the two resolve
// the same gradients against the same viewport and a bloom crosses the edge unbroken. A rail with a
// gradient on its own axis is what "does not match the main section" meant. The one bloom it leaves
// out is the sun: anchored bottom-right, it reaches the rail's foot on narrow viewports and in the
// drawer, and the rail is never yellow.
ok('the rail paints the page\'s wash stack, minus the sun',
   /background-image:[\s\S]{0,120}var\(--rail-washes\)/.test(SIDEBAR_RULE));
var RAIL_WASHES = CSS.slice(CSS.indexOf('--rail-washes:'));
RAIL_WASHES = RAIL_WASHES.slice(0, RAIL_WASHES.indexOf(';'));
var PAGE_WASHES = CSS.slice(CSS.indexOf('--page-washes:'));
PAGE_WASHES = PAGE_WASHES.slice(0, PAGE_WASHES.indexOf(';'));
no('no sun bloom on the rail', /--wash-sun/.test(RAIL_WASHES));
['--wash-teal', '--wash-coral', '--wash-depth'].forEach(function (bloom) {
    var onPage = PAGE_WASHES.match(new RegExp('radial-gradient\\([^)]*var\\(' + bloom + '\\)[^)]*\\)'));
    ok(bloom + ' sits on the rail exactly where it sits on the page',
       !!onPage && RAIL_WASHES.indexOf(onPage[0]) !== -1);
});
ok('and attaches it fixed, as the workspace does', /background-attachment: fixed/.test(SIDEBAR_RULE));
// Anchored to the line start: "#app-shell {" also matches inside the Readable override
// ':root[data-theme="readable"] #app-shell {', which sets background-image: none and would have
// this assertion reading the wrong rule.
var SHELL_RULE = CSS.slice(CSS.indexOf('\n#app-shell {'));
SHELL_RULE = SHELL_RULE.slice(0, SHELL_RULE.indexOf('\n}'));
ok('the workspace reads the same token, so there is one stack and not two',
   /background-image: var\(--page-washes\)/.test(SHELL_RULE));
no('and neither writes the gradients out by hand', /radial-gradient/.test(SIDEBAR_RULE + SHELL_RULE));
// Sharing the washes is what flattens the step: the teal bloom sits on the rail at 0.65 alpha and
// swallowed the base difference, measuring 0.4 L* at the foot of the day rail. The scrim is the
// topmost layer for that reason - it deepens by the same amount wherever a bloom happens to fall.
ok('a deepening scrim sits OVER the washes',
   /background-image:\s*\n\s*linear-gradient\(var\(--rail-deepen\), var\(--rail-deepen\)\),\s*\n\s*var\(--rail-washes\)/.test(SIDEBAR_RULE));

/** Each appearance's own rail and its own ground, read out of its own token block. */
function scopeOf(selector) {
    var at = CSS.indexOf(selector);
    return at === -1 ? '' : CSS.slice(at, CSS.indexOf('\n}', at));
}
function tokenIn(scope, name) {
    var m = scope.match(new RegExp('\\' + name + ':\\s*(#[0-9A-Fa-f]{6})'));
    return m ? m[1] : null;
}
[['day', ':root {'], ['night', ':root[data-theme="dark"] {'],
 ['readable', ':root[data-theme="readable"] {']].forEach(function (pair) {
    var scope = scopeOf(pair[1]);
    var rail = tokenIn(scope, '--sidebar-bg');
    var ground = tokenIn(scope, '--sea-0');
    ok(pair[0] + ' declares both a rail and a ground', !!rail && !!ground);
    if (!rail || !ground) return;
    var step = lstar(ground) - lstar(rail);
    ok(pair[0] + ' rail is darker than its ground, by ' + step.toFixed(1) + ' L*', step > 0);
    // Enough to see, not so much that the rail becomes a second colour rather than a shade.
    ok(pair[0] + ' step is visible (>= 3.5 L*), it is ' + step.toFixed(1), step >= 3.5);
    ok(pair[0] + ' step is still a shade (<= 9 L*), it is ' + step.toFixed(1), step <= 9);
    ok(pair[0] + ' declares its own scrim strength', tokenIn(scope, '--rail-deepen') !== null
       || /--rail-deepen:\s*(transparent|rgba)/.test(scope));
});
// The rail carries text, so its own ink still has to read on it.
ok('readable rail ink is AAA on the rail, at '
   + contrast(tokenIn(scopeOf(':root[data-theme="readable"] {'), '--sidebar-ink'),
              tokenIn(scopeOf(':root[data-theme="readable"] {'), '--sidebar-bg')).toFixed(2) + ':1',
   contrast(tokenIn(scopeOf(':root[data-theme="readable"] {'), '--sidebar-ink'),
            tokenIn(scopeOf(':root[data-theme="readable"] {'), '--sidebar-bg')) >= 7);

print('\n10. Print is paper, whatever the room looks like');
var PRINT = CSS.slice(CSS.indexOf('@media print {'));
PRINT = PRINT.slice(0, PRINT.indexOf('\n}'));
no('print knows nothing about the theme', /data-theme/.test(PRINT));
