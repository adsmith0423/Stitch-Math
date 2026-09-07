boot();

var E = window.CrochetMathEngine;
function kinds(s) { return E.notationFaults(s).map(function (x) { return x.kind; }).join(','); }
function firstMessage(s) { var r = E.notationFaults(s); return r.length ? r[0].message : ''; }

function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
// The panel writes these strings through an HTML escape, and the messages under test are full of
// quotation marks - naming the delimiter is the point of them. Unescaped here so every assertion can be
// written the way the reader sees it.
function plain(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ').trim();
}
function cell(row, col) {
    var td = $('step-sequence-body').children[row].children[col];
    return plain((td.innerHTML || '') + ' ' + (td.textContent || ''));
}
function calculated(row) { return parseInt(cell(row, 4), 10); }
function written(row) { return parseInt(cell(row, 3), 10); }
function status(row) { return cell(row, 5); }
function health() {
    var el = $('cumulative-status');
    return plain((el.innerHTML || '') + ' ' + (el.textContent || ''));
}
function causesOf(row) {
    var html = $('step-sequence-body').children[row].children[5].innerHTML;
    var out = [], re = /<span class="cause-tier[^"]*">([^<]+)<\/span><span class="cause-name">([^<]+)<\/span><span class="cause-evidence">([^<]*)<\/span>/g, m;
    while ((m = re.exec(html))) out.push({ tier: plain(m[1]), cause: plain(m[2]), evidence: plain(m[3]) });
    return out;
}

// Six patterns that are malformed rather than miscounted. The arithmetic is not the point in any of them
// - the point is that a row can be punctuated wrong, or numbered wrong, and still produce a number,
// because every expander drops what it cannot read and carries on. That recovery is correct; doing it
// silently is not.

print('\n0. A stated count survives the full stop after it');
// "(21 sts)." is how most published patterns end a row, and the count regex was anchored hard to the end
// of the line without allowing for the stop. It cost twice: the count was never read, so the row went
// unchecked against the designer's number, AND "(21 sts)" was left in the instruction, where it tokenized
// as twenty-one worked stitches. Every test below is written with the stop, because that is how the
// patterns they come from are written.
load([
    'Row 1: Ch 11, sc in 2nd ch from hook and each ch across (10 sts).',
    'Row 2: Ch 1, turn, sc in each st across (10 sts).'
]);
ck('the count is read through the stop', written(1), 10);
ck('and does not leak into the instruction', calculated(1), 10);
no('so the row is not failed', /FAIL/.test(status(1)));
ck('the instruction kept none of it', /21|10 sts/.test(cell(1, 1)), false);

print('\n1. A bracket that never closes');
ck('an unclosed paren is found', kinds('sc in first st, (sk 1, 3 dc in next st, sk 1, sc in next st, rep to end'), 'unclosed');
ck('and named', firstMessage('(sc in next st'), '"(" is never closed');
ck('an unclosed square bracket too', kinds('[sc in next 2 sts'), 'unclosed');
ck('a stray closer is found', kinds('sc in next st) twice'), 'unopened');
ck('and named', firstMessage('sc in next st)'), '")" closes a group that was never opened');
// Balanced notation of either kind, nested or not, is silent.
ck('a balanced pair is clean', kinds('(3 dc, ch 2, 3 dc) in corner ch-2 sp'), '');
ck('a balanced bracket is clean', kinds('[sc in next st, inc in next st] x 6'), '');
ck('and nesting is clean', kinds('[sc, (inc, sc) x 2] x 3'), '');

print('   ...and the row it breaks is sent to the right place');
// The group is dropped, so the row reads as five stitches against twenty-one. The arithmetic can only
// report the shortfall, which comes out as "the previous row count is wrong" - and Row 1 is fine. The
// bracket has to outrank it, or the reader is sent to a row with nothing to fix.
load([
    'Row 1: Ch 22, sc in 2nd ch from hook and each ch across (21 sts).',
    'Row 2: Ch 1, turn, sc in first st, (sk 1, 3 dc in next st, sk 1, sc in next st, rep to end (21 sts).'
]);
ok('Row 2 is failed', /FAIL/.test(status(1)));
var c8 = causesOf(1);
ck('the top cause is the notation', c8[0].cause, 'Notation is malformed');
ck('at the top tier', c8[0].tier, 'MOST LIKELY');
ck('and it names the bracket', c8[0].evidence, '"(" is never closed');
ck('the previous-row guess is demoted below it',
    c8.findIndex(function (x) { return x.cause === 'Previous row count is wrong'; }) > 0, true);
ok('and the health panel says so', /Notation Row 2: "\(" is never closed/.test(health()));

print('\n2. A "rep from *" with no marker to repeat from');
ck('the orphan is found', kinds('sc in first st, ch 1, sk 1, sc in next st; rep from * to end'), 'orphan-repeat');
ck('and named', firstMessage('sc in next st; rep from * to end'),
    'a "rep from *" has no earlier "*" in the row to repeat from');
// A marker that IS placed, in either of the two spellings patterns use.
ck('a placed marker is clean', kinds('*sc in first st, ch 1, sk 1, sc in next st; rep from * to end'), '');
ck('and a double-asterisk marker is clean', kinds('** ch 1, 3 dc in next ch-1 sp; rep from ** across'), '');
ck('a row with no repeat clause at all is clean', kinds('sc in each st across'), '');

print('   ...on a row whose arithmetic happens to come out right');
// The case worth the most: "to end" lets the last clause absorb the remaining stitches, so the row lands
// on 15 of 15 and passes. Nothing about the count is wrong. Before the check, the worst-formed row in the
// pattern scored a flat 100.
load([
    'Row 1: Ch 16, sc in 2nd ch from hook and each ch across (15 sts).',
    'Row 2: Ch 1, turn, sc in first st, ch 1, sk 1, sc in next st; rep from * to end (15 sts).'
]);
ck('the row still counts 15', calculated(1), 15);
no('and is not failed - the arithmetic is not what is wrong', /FAIL/.test(status(1)));
ok('but the row says the notation is malformed',
    /Malformed notation: a "rep from \*" has no earlier "\*" in the row to repeat from/.test(status(1)));
ok('and the health panel fails the notation check', /✗ Notation/.test(health()));
ck('so the pattern no longer scores full marks', /100 \/ 100/.test(health()), false);

print('\n3. A stitch abbreviation that is not one');
load([
    'Row 1: Ch 11, sc in 2nd ch from hook and each ch across (10 sts).',
    'Row 2: Ch 1, turn, zvp in each st across (10 sts).'
]);
ok('the row is failed', /FAIL/.test(status(1)));
ok('the token is named on its own', /"zvp" is not in the stitch dictionary/.test(status(1)));
var c10 = causesOf(1);
ck('the top cause is the typo', c10[0].cause, 'Typo or unknown stitch');
ck('at the top tier', c10[0].tier, 'MOST LIKELY');
ok('the health panel fails terminology', /Terminology unrecognized: "zvp"/.test(health()));
// The row is punctuated perfectly well - only the word is wrong - so the notation check must stay quiet
// and leave the diagnosis to the dictionary.
ok('and passes notation', /✓ Notation/.test(health()));
ck('nothing structural is reported', kinds('Ch 1, turn, zvp in each st across'), '');

print('\n4. A row that turns without a turning chain');
// "Turn, dc in each st across" works fourteen dc into fourteen stitches, so the count is right and the row
// is valid. What is missing is the chain that lifts the hook to the height of a dc, which cannot be a
// failure - failing it would claim the arithmetic is wrong when it is not.
//
// The first version of this section asserted only the health-panel line and passed while the row itself
// showed a bare tick. The pattern-level warning says "not documented on any row", which cannot name the
// row it means and sits under an "Excellent 97/100" banner, so a reader working down the matrix saw
// nothing. Both halves are pinned now: the row says it, and the panel says it.
load([
    'Row 1: Ch 15, hdc in 2nd ch from hook and each ch across (14 sts).',
    'Row 2: Turn, dc in each st across (14 sts).'
]);
ck('the row counts its 14', calculated(1), 14);
no('and is valid', /FAIL/.test(status(1)));
ok('the row itself carries the note',
    /This row turns and works dc, which usually stands on a ch 3, but no turning chain is written/.test(status(1)));
ok('and the pattern-level warning is still raised', /Turning chain not documented/.test(health()));
// Unit form, so the rule is pinned apart from the page.
ck('a taller stitch asks for a taller chain',
    /stands on a ch 4/.test(E.turningChainNote('Turn, tr in each st across')[0] || ''), true);
ck('hdc asks for ch 2',
    /stands on a ch 2/.test(E.turningChainNote('Turn, hdc in each st across')[0] || ''), true);
// The same pattern written with the chain is silent, which is what says the check is reading the row
// rather than always firing.
load([
    'Row 1: Ch 15, hdc in 2nd ch from hook and each ch across (14 sts).',
    'Row 2: Ch 3, turn, dc in each st across (14 sts).'
]);
no('a documented turning chain draws no note', /no turning chain is written/.test(status(1)));
no('nor a pattern-level warning', /Turning chain not documented/.test(health()));
// sc is worked flush and most designers never write its ch 1, so asking for one would be asking for
// something that would be wrong to add.
ck('single crochet is left alone', E.turningChainNote('Turn, sc in each st across').length, 0);
// The end-of-row convention - "...dc in each st across, ch 3, turn." - puts the chain and the turn on the
// row BEFORE, so the row after says neither and must not be flagged. This is what keeps the note off
// correctly written work; without it every other row of that whole style would carry one.
ck('a row that does not turn is left alone', E.turningChainNote('dc in each st across').length, 0);
ck('and the row that does turn has its chain',
    E.turningChainNote('dc in each st across, ch 3, turn').length, 0);

print('\n5. A group opened with one delimiter and closed with another');
ck('the mismatch is found', kinds('*[sc in next 2 sts, 2 sc in next st) twice, sc in next 4 sts; rep from * once'), 'mismatched');
ck('and named', firstMessage('[sc in next st)'), 'a group opened with "[" is closed with ")"');
ck('the other way round too', firstMessage('(sc in next st]'), 'a group opened with "(" is closed with "]"');
// Written correctly it is silent - the expander never checked which closer it got, so both spellings
// produced the same count and the fault left no trace in the arithmetic.
ck('the same row with matching brackets is clean',
    kinds('*[sc in next 2 sts, 2 sc in next st] twice, sc in next 4 sts; rep from * once'), '');
ck('and both forms still count the same',
    E.evaluateStep(0, 20, '*[sc in next 2 sts, 2 sc in next st) twice, sc in next 4 sts; rep from * once', 1, 0).calculatedYield,
    E.evaluateStep(0, 20, '*[sc in next 2 sts, 2 sc in next st] twice, sc in next 4 sts; rep from * once', 1, 0).calculatedYield);

print('   ...and it outranks the arithmetic on the failing row');
load([
    'Row 1: Ch 21, sc in 2nd ch from hook and each ch across (20 sts).',
    'Row 2: Ch 1, turn, *[sc in next 2 sts, 2 sc in next st) twice, sc in next 4 sts; rep from * once (24 sts).'
]);
ok('Row 2 is failed', /FAIL/.test(status(1)));
var c12 = causesOf(1);
ck('the top cause is the notation', c12[0].cause, 'Notation is malformed');
ck('naming both delimiters', c12[0].evidence, 'a group opened with "[" is closed with ")"');
ck('and the previous-row guess sits below it',
    c12.findIndex(function (x) { return x.cause === 'Previous row count is wrong'; }) > 0, true);

print('\n6. A gap in the row numbering');
// The matrix renumbers what it is given, so "Row 3" after "Row 1" is relabelled Row 2 and the gap closes
// on screen. The number the pattern wrote is the only trace left of a row that was either dropped in
// editing or numbered wrong, and the reader cannot tell which.
load([
    'Row 1: Ch 11, sc in 2nd ch from hook and each ch across (10 sts).',
    'Row 3: Ch 1, turn, sc in each st across (10 sts).'
]);
ok('the gap is reported', /row numbering skips 1 to 3/.test(health()));
no('and the rows themselves are fine', /FAIL/.test(status(0)) || /FAIL/.test(status(1)));
// Consecutive numbering says nothing.
load([
    'Row 1: Ch 11, sc in 2nd ch from hook and each ch across (10 sts).',
    'Row 2: Ch 1, turn, sc in each st across (10 sts).',
    'Row 3: Ch 1, turn, sc in each st across (10 sts).'
]);
no('consecutive rows draw no warning', /row numbering skips/.test(health()));
// A range covers every number in it: after "Rows 2-4" the next row is 5, and comparing against the 2
// would invent a gap in a pattern that has none.
load([
    'Row 1: Ch 11, sc in 2nd ch from hook and each ch across (10 sts).',
    'Rows 2-4: Ch 1, turn, sc in each st across (10 sts).',
    'Row 5: Ch 1, turn, sc in each st across (10 sts).'
]);
no('a range is not mistaken for a gap', /row numbering skips/.test(health()));

endSuite();
