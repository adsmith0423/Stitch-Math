/**
 * US / UK terminology - the strict mode, and the thing it must not do.
 *
 * The check exists because the two systems reuse each other's abbreviations for different stitches: a
 * UK "dc" is a US "sc". That ambiguity is invisible to the arithmetic - every basic is cost 1 /
 * yield 1, so a row reads the same either way and will never fail for it - which is exactly why it
 * has to be said out loud.
 *
 * The most important assertions in this file are the NEGATIVE ones in section 3. Flagging dc and tr
 * would put an underline on essentially every pattern ever written, and a linter that cries wolf on
 * correct work is worse than no linter.
 */
boot();

var E = window.CrochetMathEngine;

function terms(text, mode) {
    return E.dialectFaults(text, mode).map(function (f) { return f.term; }).join(',');
}

/** Load a pattern with a terminology set, through the button the user presses. */
function load(mode, lines) {
    $('meta-terminology').value = mode;
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}
/** The class the linter's copy of line N carries - which severity, if any, is underlined there. */
function cue(i) {
    var span = $('lint-mirror').children[i];
    return span ? span.className.replace('lint-line', '').trim() : '(no line)';
}
function tally() { return $('lint-side-tally').textContent; }

print('\n1. A US term in a pattern declared UK');
ck('sc is flagged', terms('sc in each st around', 'uk'), 'sc');
ck('and named as US', E.dialectFaults('sc in each st around', 'uk')[0].belongsTo, 'us');
ck('with the UK equivalent given', E.dialectFaults('sc in each st around', 'uk')[0].equivalent, 'dc');
ck('hdc is flagged', terms('hdc in each st across', 'uk'), 'hdc');
ck('so is the long form', terms('half double crochet in each st', 'uk'), 'half double crochet');

print('\n2. A UK term in a pattern declared US');
ck('htr is flagged', terms('htr in each st across', 'us'), 'htr');
ck('and named as UK', E.dialectFaults('htr in each st across', 'us')[0].belongsTo, 'uk');
ck('with the US equivalent given', E.dialectFaults('htr in each st across', 'us')[0].equivalent, 'hdc');
ck('miss is flagged', terms('miss 1 st, dc in next st', 'us'), 'miss');

print('\n3. The colliding terms are flagged in NEITHER');
// dc, tr and dtr are valid in both systems and merely name different stitches in each. A pattern
// using them is not thereby wrong, and flagging them would underline every pattern ever written.
ck('dc is not a fault in UK mode', terms('dc in each st across', 'uk'), '');
ck('dc is not a fault in US mode', terms('dc in each st across', 'us'), '');
ck('tr is not a fault in UK mode', terms('tr in each st across', 'uk'), '');
ck('tr is not a fault in US mode', terms('tr in each st across', 'us'), '');
ck('dtr is not a fault either way', terms('dtr in each st', 'uk') + terms('dtr in each st', 'us'), '');
// "skip" is used throughout modern UK publishing, so it is not exclusive to US.
ck('skip is not a fault in UK mode', terms('sk 1, dc in next st', 'uk'), '');

print('\n4. Off finds nothing at all');
ck('empty mode', terms('sc in each st around, htr in next', ''), '');
ck('unset mode', terms('sc in each st around, htr in next'), '');
ck('a nonsense mode is not a dialect', terms('sc in each st around', 'fr'), '');

print('\n5. A term is matched whole, never inside another');
// \bsc\b does not fire inside fpsc, and the hyphen has to count as part of the word too.
ck('sc does not fire inside fpsc', terms('fpdc in each st around', 'uk'), '');
ck('fpsc is flagged as itself', terms('fpsc in each st around', 'uk'), 'fpsc');
ck('sc-inc is not read as a bare sc', terms('sc-inc in each st around', 'uk').indexOf('sc,') < 0, 'true');

print('\n6. The longest term wins, and is reported once');
// "half double crochet" is one fault, not three overlapping ones.
ck('reported once', E.dialectFaults('half double crochet in each st', 'uk').length, 1);
ck('as the whole term', terms('half double crochet in each st', 'uk'), 'half double crochet');

print('\n7. Two different faults on one row are both found, in order');
ck('both, left to right', terms('sc in first st, hdc in each st across', 'uk'), 'sc,hdc');

print('\n8. The fix teaches and does not rewrite');
var fix = E.buildTerminologyFix(E.dialectFaults('sc in each st around', 'uk')[0], 'uk');
ck('filed as a style note, not an error', fix.severity, 'style');
ck('has no automatic edit', String(fix.edit), 'null');
ok('names the term', fix.title.indexOf('"sc"') >= 0);
ok('names the declared system', fix.title.indexOf('UK') >= 0);
ok('and carries a lesson', fix.lesson.length > 0);

print('\n9. End to end: the row is underlined, and still passes');
load('uk', ['Row 1: ch 11', 'Row 2: sc in 2nd ch from hook, sc in each ch across (10)']);
ck('the row carries a style cue', cue(1), 'lint-mark-style');
ok('and a suggestion is offered', tally().indexOf('No suggestions') < 0);
// The whole point: the arithmetic is untouched. A dialect fault is never a failing row.
ck('no row failed', $('step-sequence-body').children.filter(function (tr) {
    return tr.children.length >= 6 && /FAIL/.test(tr.children[5].innerHTML);
}).length, 0);

print('\n10. Turning it off clears the cue and changes no number');
var withUk = $('step-sequence-body').children.map(function (tr) {
    return tr.children.length >= 6 ? tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim() : '';
}).join('|');
load('', ['Row 1: ch 11', 'Row 2: sc in 2nd ch from hook, sc in each ch across (10)']);
ck('the cue is gone', cue(1), '');
var withOff = $('step-sequence-body').children.map(function (tr) {
    return tr.children.length >= 6 ? tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim() : '';
}).join('|');
ck('and every calculated count is identical', withOff, withUk);

print('\n11. Standing chain heights follow the terminology');
// The one place terminology reaches past the linter, and it can only ever change a NOTE.
E.setTerminology('us');
ck('US: dc stands on ch 3', E.standingChainHeights().dc, 3);
E.setTerminology('uk');
ck('UK: dc stands on ch 1', E.standingChainHeights().dc, 1);
ck('UK: tr stands on ch 3', E.standingChainHeights().tr, 3);
E.setTerminology('');
ck('off reads the US table, as this app always has', E.standingChainHeights().dc, 3);

endSuite();
