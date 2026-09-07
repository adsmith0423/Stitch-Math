boot();

function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function cellsOf(tr) { return tr.children.map(function (c) { return (c.textContent || (c.innerHTML || '').replace(/<[^>]*>/g, '')).trim(); }); }
function matrix() { return $('step-sequence-body').children.map(cellsOf); }
function labels() { return matrix().map(function (c) { return c[0]; }); }
function statusOf(i) { var c = matrix()[i]; return (c[5] || '').slice(0, 12); }
function numbering(mode) { $('meta-row-numbering').value = mode; $('meta-row-numbering').fire('change'); }

var BODY_SLEEVE = [
    "BODY",
    "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
    "Row 2: ch 1, turn, sc in each st across (10)",
    "SLEEVE",
    "Row 1: ch 7, sc in 2nd ch from hook and in each ch across (6)",
    "Row 2: ch 1, turn, sc in each st across (6)"
];

print('\n1. A section title is a marker, not a row');
numbering('restart');
load(BODY_SLEEVE);
ck('six lines, six matrix rows', matrix().length, 6);
ok('the title is rendered as a divider', /--- BODY ---/.test(matrix()[0][0]));
no('and is never marked failed', /FAIL|Unrecognized/.test(matrix()[0].join(' ')));
ck('every worked row passes', matrix().filter(function (c) { return /✓/.test(c[5] || ''); }).length, 4);

print('\n2. Each piece starts from nothing');
// The sleeve's ch 7 must be measured from 0, not from the body's last count of 10.
ck('sleeve row 1 yields 6', matrix()[4][4].replace(/[^0-9].*$/, ''), '6');
ck('body row 1 yields 10', matrix()[1][4].replace(/[^0-9].*$/, ''), '10');

print('\n3. A broken piece does not blank the next one');
load([
    "BODY",
    "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
    "Row 2: ch 1, turn, sc in next 40 sts (40)",
    "SLEEVE",
    "Row 1: ch 7, sc in 2nd ch from hook and in each ch across (6)",
    "Row 2: ch 1, turn, sc in each st across (6)"
]);
ok('the bad body row fails', /FAIL/.test(statusOf(2)));
no('the sleeve is not blocked', /BLOCKED/.test(matrix()[4].join(' ')));
no('nor its second row', /BLOCKED/.test(matrix()[5].join(' ')));
ok('sleeve row 1 still validates', /✓/.test(matrix()[4][5] || ''));

print('\n4. Numbering restarts or continues, as asked');
numbering('restart');
load(BODY_SLEEVE);
ck('restart', labels().join('|'), '--- BODY ---|Row 1|Row 2|--- SLEEVE ---|Row 1|Row 2');
numbering('continue');
load(BODY_SLEEVE);
ck('continue', labels().join('|'), '--- BODY ---|Row 1|Row 2|--- SLEEVE ---|Row 3|Row 4');
numbering('restart');

print('\n5. The export and the print area agree with the matrix');
load(BODY_SLEEVE);
// The print rows are built by assigning innerHTML, so children is empty - the mirror
// of the matrix, which is built with appendChild and reads empty from innerHTML.
var printed = $('print-table-body').children.map(function (tr) {
    return (tr.innerHTML.match(/<td[^>]*>([^<]*)</) || [, ''])[1].trim();
});
ck('print area restarts too', printed.join('|'),
   '--- BODY ---|Row 1|Row 2|--- SLEEVE ---|Row 1|Row 2');
var EXPORTED = '';
Blob = function (parts) { EXPORTED = String(parts[0]); };
$('project-name').value = 'sectioned';
$('export-txt-btn').fire('click');
ok('export carries the section titles', /--- BODY ---/.test(EXPORTED) && /--- SLEEVE ---/.test(EXPORTED));
ok('export restarts numbering', /--- SLEEVE ---\s*\nRow 1:/.test(EXPORTED));
numbering('continue');
load(BODY_SLEEVE);
$('export-txt-btn').fire('click');
ok('and follows continue mode too', /--- SLEEVE ---\s*\nRow 3:/.test(EXPORTED));
numbering('restart');

print('\n6. What counts as a section title');
var E = CrochetMathEngine;
[['--- Sleeve ---', 'Sleeve'], ['=== Sleeve ===', 'Sleeve'], ['# Sleeve', 'Sleeve'],
 ['SLEEVE', 'SLEEVE'], ['Sleeve:', 'Sleeve'], ['Sleeve (make 2)', 'Sleeve']
].forEach(function (c) {
    var r = E.parseSectionHeader(c[0]);
    ck('"' + c[0] + '" is a section', r.isSection && r.title, c[1]);
});

print('\n7. What must NOT be mistaken for one');
// A stray section would silently reset the running stitch count - the dangerous direction.
[
    'BACK: Ch 52 (56, 60), s c in 2nd st from hook, 1 s c in each remaining st of ch',
    'Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)',
    'sc in each st acroos',
    'Join yarn',
    'Ch 20',
    'Rnd 1: 6 sc in mr (6)'
].forEach(function (line) {
    no('"' + line.slice(0, 42) + '" stays a row', E.parseSectionHeader(line).isSection);
});

print('\n8. Single-section patterns are untouched');
load([
    "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
    "Row 2: ch 1, turn, sc in each st across (10)"
]);
ck('no divider row appears', matrix().length, 2);
ck('numbering unchanged', labels().join('|'), 'Row 1|Row 2');

print('\n9. Round-trip and persistence');
load(BODY_SLEEVE);
window.enableInlineEdit(1); window.cancelInlineEdit();
ck('titles survive the trip back to the textarea', $('bulk-input').value.split('\n').length, 6);
ok('BODY still there', /^BODY$/m.test($('bulk-input').value));
$('project-name').value = 'sectioned';
$('save-btn').fire('click');
$('new-file-btn').fire('click');
ck('new file clears it', matrix().length, 0);
$('load-select').value = 'sectioned';
$('load-btn').fire('click');
ck('load restores all six rows', matrix().length, 6);
ok('including the dividers', /--- BODY ---/.test(matrix()[0][0]));

print('\n10. Collapsing repeats never folds across a boundary');
$('toggle-collapse-repeats').checked = true;
$('toggle-collapse-repeats').fire('change');
load([
    "BODY",
    "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
    "Row 2: ch 1, turn, sc in each st across (10)",
    "SLEEVE",
    "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
    "Row 2: ch 1, turn, sc in each st across (10)"
]);
// Identical instructions either side of the divider must stay in their own pieces.
ck('both dividers still present', matrix().filter(function (c) { return /---/.test(c[0]); }).length, 2);
ok('no group spans the boundary', matrix().every(function (c) { return !/Row 2.*Row 1/.test(c[0]); }));
$('toggle-collapse-repeats').checked = false;
$('toggle-collapse-repeats').fire('change');

print('\n11. Pattern Structure panel');
var STRUCT = readFile('index.html').slice(readFile('index.html').indexOf('id="structure-section"'));
STRUCT = STRUCT.slice(0, STRUCT.indexOf('</section>'));
['meta-size', 'meta-row-numbering']
    .forEach(function (id) { ok(id + ' lives in Pattern Structure', STRUCT.indexOf('id="' + id + '"') !== -1); });
// Repeat Style was dropped from the app entirely, not moved off this panel.
no('the repeat style dropdown is gone altogether', /id="meta-repeat-convention"/.test(readFile('index.html')));
// Sizing type and Construction Style went the same way as Repeat Style, for a different reason: both
// are read off the pattern text now, so a box restating them could only ever contradict it.
no('the sizing type dropdown is gone altogether', /id="meta-size-type"/.test(readFile('index.html')));
no('the construction dropdown is gone altogether', /id="meta-construction"/.test(readFile('index.html')));
no('and so is the turning-chain box', /id="skipped-chains"/.test(readFile('index.html')));
// Sliced to color-panel rather than structure-section, which now lives on a different tab entirely and
// would sweep in everything written between the two.
var META = readFile('index.html');
META = META.slice(META.indexOf('<h2>Pattern Metadata</h2>'), META.indexOf('id="color-panel"'));
no('meta-row-numbering no longer in Pattern Metadata', META.indexOf('id="meta-row-numbering"') !== -1);
ok('metadata keeps designer, hook and yarn weight',
   /meta-designer/.test(META) && /meta-hook/.test(META) && /meta-yarn-weight/.test(META));
// Row Numbering used to be bound to Construction Style in a .form-pair, because grid auto-placement
// alone could not promise they shared a line - the size picker is hidden for a one-size pattern, which
// shifts everything after it by one cell. With Construction gone there is nothing to pair it with, and
// a one-child .form-pair would hold a two-column grid open around a single field.
no('the emptied pair is gone rather than left holding one field',
   /<div class="form-pair">[\s\S]{0,400}?id="meta-row-numbering"/.test(STRUCT));

print('\n12. A section always starts a new piece');
// This was a "Pattern is worked in sections / parts" tickbox, on by default; unticking it kept the titles
// as dividers without resetting anything. The control is gone and on is now the only behaviour, so what it
// used to do is pinned here instead.
no('the tickbox is gone from the markup', /id="meta-has-sections"/.test(readFile('index.html')));
load(BODY_SLEEVE);
ck('titles still shown as dividers', matrix().filter(function (c) { return /---/.test(c[0]); }).length, 2);
ck('and numbering restarts at each one', labels().join('|'),
   '--- BODY ---|Row 1|Row 2|--- SLEEVE ---|Row 1|Row 2');

print('\n13. Sizing, and the picker that follows it');
// There was a "Sizing" dropdown here whose value this section used to read. It is gone: a pattern
// writing "ch 41 (45, 49)" has already said it is graded, and the only remaining question - WHICH of
// the sizes to check - is what the picker is for. The picker's own visibility is now the whole tell.
ok('picker hidden when nothing is graded', $('size-picker-group').classList.contains('hidden'));
load(['Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)']);
no('a graded pattern reveals the picker', $('size-picker-group').classList.contains('hidden'));
ck('picker lists the real sizes', $('meta-size').innerHTML.split('<option').length - 1, 3);
no('the old "Single size" wording is gone', /Single size/.test($('meta-size').innerHTML));
load(['Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)']);
ok('picker hidden again', $('size-picker-group').classList.contains('hidden'));

print('\n14. The two input panels are one');
var H = readFile('index.html');
ck('a single Pattern Input panel', (H.match(/<h2>Pattern Input<\/h2>/g) || []).length, 1);
no('no separate Bulk Import panel', /<h2>Bulk Row\/Round Import<\/h2>/.test(H));
no('no separate Single Row panel', /<h2>Single Row\/Round Input<\/h2>/.test(H));
ok('both controls survive in it', /id="bulk-input"/.test(H) && /id="row-form"/.test(H));

print('\n15. Construction is read, not asked for');
// The panel used to open on "-- Select One --" and wait. It reads the pattern's own labels instead:
// two or more "Rnd" lines outnumbering "Row" lines is a pattern worked in the round, and a closing
// slip stitch is what separates joined from spiral.
var E15 = CrochetMathEngine;
ck('rows read as flat', E15.inferPatternSettings('Row 1: sc\nRow 2: sc').construction, 'Rows (Flat)');
ck('joined rounds read as joined',
   E15.inferPatternSettings('Rnd 1: sc, join with sl st\nRnd 2: sc, join with sl st').construction,
   'Rounds (Joined)');
ck('unjoined rounds read as a spiral',
   E15.inferPatternSettings('Rnd 1: sc\nRnd 2: sc').construction, 'Rounds (Spiral)');
// Nothing to read is not the same as reading "flat". An empty document is marked unconfident so the
// health panel says it assumed rather than found.
no('an empty document is not claimed as a finding',
   E15.inferPatternSettings('').notices[0].confident);

print('\n16. The Sections counter');
function sectionStat() { return $('stat-sections').textContent; }
load(["Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)"]);
// An empty page has no pattern, so nothing to count. The floor of 1 is only for a
// pattern that exists but names no sections.
load([]);
ck('an empty page counts 0', sectionStat(), '0');
load(["Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)"]);
ck('a pattern with no titles counts as one piece', sectionStat(), '1');
load(BODY_SLEEVE);
ck('two titles count as two', sectionStat(), '2');
load(["BODY", "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
      "SLEEVE", "Row 1: ch 7, sc in 2nd ch from hook and in each ch across (6)",
      "COLLAR", "Row 1: ch 5, sc in 2nd ch from hook and in each ch across (4)"]);
ck('three titles count as three', sectionStat(), '3');
$('new-file-btn').fire('click');
ck('New File resets it to 0', sectionStat(), '0');
ok('the card sits with the other two', /stat-total-stitches[\s\S]*stat-difficulty[\s\S]*stat-sections/.test(readFile('index.html')));

print('\n17. Pattern Input wording and actions');
var IH = readFile('index.html');
ok('summary names the foundation row', /<summary>Add foundation row \/ single row<\/summary>/.test(IH));
ok('label reads # of Initial Chains', /# of Initial Chains \(Step 1 only\):/.test(IH));
ok('label reads Row Instructions', /<label for="tokens-input">Row Instructions:/.test(IH));
ok('label reads Expected Stitch Count', /<label for="expected-yield-input">Expected Stitch Count:/.test(IH));
no('the old wording is gone', /Initial Foundation Chain|Pattern Instructions:|Expected Final Stitch Count/.test(IH));
// The four whole-pattern buttons moved inside the panel, after the collapsible.
var panel = IH.slice(IH.indexOf('<h2>Pattern Input</h2>'));
panel = panel.slice(0, panel.indexOf('</section>'));
['delete-last-btn', 'clear-all-btn', 'export-txt-btn', 'export-pdf-btn']
    .forEach(function (id) { ok(id + ' is inside Pattern Input', panel.indexOf('id="' + id + '"') !== -1); });
ok('they sit after the collapsible, not in it',
   panel.indexOf('</details>') < panel.indexOf('id="delete-last-btn"'));
ok('grouped as pattern-actions', /class="form-controls pattern-actions"/.test(IH));
ok('and styled distinctly', /\.pattern-actions \{/.test(readFile('style.css')));
// They must still work from their new home.
load(BODY_SLEEVE);
var before = matrix().length;
$('delete-last-btn').fire('click');
ok('Undo Last Row still works', matrix().length < before);

print('\n18. Special Stitches counter, and one bullet per fault');
// Special = foundation, extended, linked, picot and anything custom - the stitches that
// are not plain fabric. It is a count in the dashboard now, not a bar.
$('custom-st-name').value = 'wibble'; $('custom-st-def').value = 'x';
$('custom-st-cost').value = '1'; $('custom-st-yield').value = '1';
$('custom-stitch-form').fire('submit');
load(["Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
      "Row 2: ch 1, turn, wibble x 10 (10)"]);
ck('custom stitches count as special', $('stat-special').textContent, '10');
load(["Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
      "Row 2: ch 1, turn, sc in each st across (10)"]);
ck('plain fabric has none', $('stat-special').textContent, '0');
no('and special is no longer drawn as a bar', /bar-special/.test($('complexity-content').innerHTML));
ok('the other three still are', /bar-repetitive/.test($('complexity-content').innerHTML));

// Two separate formatting faults must read as two bullets, not one run-on sentence.
load(["Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
      "sc in each st across",
      "sc in next 5 sts, inc in next 5 sts"]);
var panel = $('cumulative-status').innerHTML;
ok('the faults are a list', /check-detail-list/.test(panel));
var items = (panel.match(/<ul class="check-detail check-detail-list">([\s\S]*?)<\/ul>/) || [, ''])[1];
ck('one bullet each', (items.match(/<li>/g) || []).length, 2);
ok('stitch count fault listed', /without a stitch count/.test(items));
ok('row label fault listed', /without a row label/.test(items));
// A check with a single detail stays a plain line rather than a one-item list.
load(["Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
      "Row 2: ch 1, turn, sc in each st across (10)"]);
no('a single detail is not bulleted', /check-detail-list/.test($('cumulative-status').innerHTML));

endSuite();
