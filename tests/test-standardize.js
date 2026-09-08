/**
 * The shorthand standardizer - longhand a beginner writes, and the abbreviation the industry prints.
 *
 * "chain 3" is clear, correct, and read by the engine without complaint. It is also not how a
 * published pattern is written, and a student who never has the difference pointed out submits work
 * that reads as unfinished for a reason nobody ever told them.
 *
 * Two things this must never do, both covered below: suggest a US abbreviation inside a UK pattern
 * (section 4), and correct an abbreviations key, where the long form is the whole point (section 5).
 */
boot();

var E = window.CrochetMathEngine;

function ids(text, mode) {
    return E.buildShorthandFixes(text, mode).map(function (f) { return f.id; }).join(',');
}
function firstFix(text, mode) { return E.buildShorthandFixes(text, mode)[0] || {}; }

function load(mode, lines) {
    $('meta-terminology').value = mode || '';
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}
function cue(i) {
    var span = $('lint-mirror').children[i];
    return span ? span.className.replace('lint-line', '').trim() : '(no line)';
}
/**
 * Every sidebar card's flattened text. Walked by hand rather than read off textContent: the stub does
 * not recurse into children, so a card whose text lives in its <p> elements reads as empty and an
 * assertion written the easy way passes whatever is on screen.
 */
function sidebarText() {
    return $('lint-side-body').children.map(function (card) {
        return card.children.map(function (part) {
            return part.children.length
                ? part.children.map(function (g) { return g.textContent; }).join(' ')
                : part.textContent;
        }).join(' | ');
    }).join(' || ');
}

print('\n1. A counted chain');
ck('chain 3 is flagged', ids('chain 3, dc in each st across', ''), 'shorthand-chain-count');
var chainFix = firstFix('chain 3, dc in each st across', '');
ck('it is a style note', chainFix.severity, 'style');
ck('rewriting to the abbreviation', chainFix.edit.to, 'ch 3');
ck('from the text as written', chainFix.edit.from, 'chain 3');
ck('and the number is carried through', firstFix('chain 26', '').edit.to, 'ch 26');

print('\n2. Verb phrasing');
ck('make an increase', firstFix('make an increase in next st', '').edit.to, 'inc');
ck('make a decrease', firstFix('make a decrease over next 2 sts', '').edit.to, 'dec');

print('\n3. Long stitch names that abbreviate the same in both systems');
ck('double crochet', firstFix('double crochet in each st across', '').edit.to, 'dc');
ck('treble crochet', firstFix('treble crochet in each st across', '').edit.to, 'tr');
ck('slip stitch', firstFix('slip stitch to first dc', '').edit.to, 'sl st');
// No dialect on these entries, so they are offered whatever the project declares.
ck('offered in UK mode too', firstFix('double crochet in each st across', 'uk').edit.to, 'dc');

print('\n4. Dialect-specific names wait to be told which system this is');
// Suggesting "sc" inside a UK pattern would teach the exact error the dialect check exists to catch.
ck('single crochet in US mode', firstFix('single crochet in each st', 'us').edit.to, 'sc');
ck('single crochet in UK mode is NOT suggested', ids('single crochet in each st', 'uk'), '');
ck('nor with no system declared', ids('single crochet in each st', ''), '');
ck('half double crochet in US mode', firstFix('half double crochet in each st', 'us').edit.to, 'hdc');
ck('half double crochet in UK mode is NOT suggested', ids('half double crochet in each st', 'uk'), '');
ck('half treble in UK mode', firstFix('half treble in each st', 'uk').edit.to, 'htr');
ck('half treble in US mode is NOT suggested', ids('half treble in each st', 'us'), '');

print('\n5. The longer name wins');
// "half double crochet" must not be rewritten to "half dc" by the "double crochet" rule.
ck('read as one term', firstFix('half double crochet in each st', 'us').edit.to, 'hdc');

print('\n6. Text already in shorthand is left alone');
ck('ch 3', ids('ch 3, dc in each st across', ''), '');
ck('a bare inc', ids('[sc, inc] x 6', ''), '');
ck('sl st', ids('sl st to first dc', ''), '');

print('\n7. End to end: the row is underlined and the fix applies');
// A row whose arithmetic is sound, so the cue shown is the style one. A row carrying any math finding
// would correctly show lint-mark-math instead - a style suggestion never outranks an arithmetic fault,
// and the stated count is what decides it here: the opening chain is a turning chain and is not
// counted, so this round makes 6, not 7.
load('', ['Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: chain 1, double crochet in each st around (6)']);
ck('no row failed', $('step-sequence-body').children.filter(function (tr) {
    return tr.children.length >= 6 && /FAIL/.test(tr.children[5].innerHTML);
}).length, 0);
ck('the row carries a style cue', cue(1), 'lint-mark-style');
ok('the sidebar names the chain', sidebarText().indexOf('"chain 1"') >= 0);
ok('and the stitch', sidebarText().indexOf('"double crochet"') >= 0);

print('\n8. Applying rewrites the line the designer wrote');
// The apply button lives on the sidebar card; find it by the label renderFixCard gives a style fix.
var applied = false;
$('lint-side-body').children.forEach(function (card) {
    var flat = card.children.map(function (part) { return part.textContent; }).join(' ');
    if (applied || flat.indexOf('"chain 1"') < 0) return;
    var actions = card.children[card.children.length - 1];
    actions.children.forEach(function (b) {
        if (!applied && b.textContent === 'Accept Suggested Formatting') { b.fire('click'); applied = true; }
    });
});
ok('an apply button was offered and pressed', applied);
ok('the line now reads ch 1', $('bulk-input').value.indexOf('ch 1, double crochet') >= 0);
ok('and the long form is gone', $('bulk-input').value.indexOf('chain 1') < 0);

print('\n9. An abbreviations key is never corrected');
// "hdc = half double crochet" is the long form written on purpose. Those lines are filed as
// documentation, and collectFindings skips them - so the standardizer cannot reach them.
load('us', [
    'Abbreviations',
    'ch = chain',
    'hdc = half double crochet',
    'sc = single crochet',
    '',
    'Row 1: ch 11',
    'Row 2: hdc in 3rd ch from hook, hdc in each ch across (10)'
]);
ck('the key line is not underlined', cue(2), '');
ck('nor the one below it', cue(3), '');
no('and nothing in the sidebar mentions it', sidebarText().indexOf('"half double crochet"') >= 0);

print('\n10. "*" is a multiplier too');
// "(2 sc, inc) * 6" is ordinary amigurumi notation and expandBracketRepeats has always counted it,
// but the STYLE layer could not see it - so a pattern written that way silently got no
// beginner-phrasing offer and, worse, no "this repeat runs the wrong number of times" correction.
ok('bracket shorthand is recognised with x', !!E.buildRepeatPhrasingFix('[2 sc, inc] x 6'));
ok('and with *', !!E.buildRepeatPhrasingFix('(2 sc, inc) * 6'));
ok('and in brackets with *', !!E.buildRepeatPhrasingFix('[2 sc, inc] * 6'));
ok('standardizeRepeatText rewrites it', !!E.standardizeRepeatText('(2 sc, inc) * 6'));

print('\n10b. A stated count is still not a repeat');
// The guard that keeps the multiplier alternation honest: a bare "(24)" is an answer, not a group,
// and "(56, 60)" is a size list. Reading either as a repeat would rewrite a number the pattern meant.
ck('a stated count', String(E.buildRepeatPhrasingFix('sc in each st around (24)')), 'null');
ck('a size list', String(E.buildRepeatPhrasingFix('ch 52 (56, 60)')), 'null');
ck('an open asterisk repeat is left to its own expander',
   String(E.buildRepeatPhrasingFix('* 2 sc, inc; rep from * around')), 'null');

print('\n10c. The repeat-times math fix now resolves in * notation');
// Not a style point: without a repeat unit the row fell through to a raw stitch deficit and the
// correction could not be offered at all.
var starFix = E.evaluateStep(0, 18, '(2 sc, inc) * 5', 1, 0, 0, 0).fixes
    .filter(function (f) { return f.id === 'repeat-times'; })[0];
ok('the fix is offered', !!starFix);
ck('it targets the multiplier', starFix.edit.target, 'multiplier');
ck('from the number in the text', starFix.edit.from, 5);
ck('to the one the row has stitches for', starFix.edit.to, 6);
// applyLintEdit has to find "* 5" in the raw line. A word boundary before "*" never matches, so
// written the obvious way this resolved to null and the button silently became advice.
// Rnd 3 produces 18, so Rnd 4's repeat is one pass short - the same numbers the direct call above
// used, rather than a second fixture free to disagree with it.
load('', ['Rnd 1: 6 sc in magic ring (6)',
          'Rnd 2: inc in each st around (12)',
          'Rnd 3: (1 sc, inc) * 6 (18)',
          'Rnd 4: (2 sc, inc) * 5 (24)']);
var applied = false;
$('lint-side-body').children.forEach(function (card) {
    var flat = card.children.map(function (p) { return p.textContent; }).join(' ');
    if (applied || flat.indexOf('This repeat runs') < 0) return;
    var actions = card.children[card.children.length - 1];
    actions.children.forEach(function (b) {
        if (!applied && b.textContent === 'Suggest a fix') { b.fire('click'); applied = true; }
    });
});
ok('an apply button was offered and pressed', applied);
ok('and the multiplier was rewritten', $('bulk-input').value.indexOf('(2 sc, inc) * 6') >= 0);

print('\n11. The counts never move');
// Every finding here is a style note. None of them can fail a row.
ck('no row failed', $('step-sequence-body').children.filter(function (tr) {
    return tr.children.length >= 6 && /FAIL/.test(tr.children[5].innerHTML);
}).length, 0);

endSuite();
