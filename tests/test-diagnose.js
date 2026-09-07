boot();
function load(lines){ $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function causesOf(rowIdx){
    var html = $('step-sequence-body').children[rowIdx].children[5].innerHTML;
    var out = [], re = /<span class="cause-tier[^"]*">([^<]+)<\/span><span class="cause-name">([^<]+)<\/span><span class="cause-evidence">([^<]*)<\/span>/g, m;
    while ((m = re.exec(html))) out.push({ tier: m[1], cause: m[2], evidence: m[3] });
    return out;
}

print('\n1. Dropped increase upstream is diagnosed on the row it breaks');
// Row 2 should be [sc, inc] x 6 -> 18, but was written [sc, sc] x 6 -> 12.
// Row 2 itself balances (12 in, 12 out); Row 3 is the row that fails.
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, sc in next st] x 6 (18)",
 "Row 3: ch 1, turn, [sc in next 2 sts, inc in next st] x 6 (24)"
]);
var c = causesOf(2);
ck('a diagnosis was produced', c.length > 0, true);
ck('top cause blames Row 2', /Row 2/.test(c[0].cause), true);
ck('names it a missing increase', /Missing increase/.test(c[0].cause), true);
ck('tier MOST LIKELY', c[0].tier, 'MOST LIKELY');
ck('evidence is specific', /short 6 over 6 repeats, exactly 1 per repeat/.test(c[0].evidence), true);
ck('exactly one MOST LIKELY', c.filter(function(x){return x.tier==='MOST LIKELY';}).length, 1);
ck('no percentages anywhere', /\d+%/.test(JSON.stringify(c)), false);

print('\n2. Wrong repeat count on the failing row itself');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 4 (18)"
]);
var c2 = causesOf(1);
ck('top cause is repeat count', c2[0].cause, 'Incorrect repeat count');
ck('evidence cites whole repeats', /whole repeat/.test(c2[0].evidence), true);

print('\n3. Unknown token ranks typo top');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, sc x 4, wibblestitch, sc x 7 (12)"
]);
var c3 = causesOf(1);
ck('top cause is typo', c3[0].cause, 'Typo or unknown stitch');
ck('evidence names the token', /wibblestitch/.test(c3[0].evidence), true);

print('\n4. Clean rows carry no diagnosis');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)"
]);
ck('valid row has no causes', causesOf(1).length, 0);

print('\n5. Blocked rows are not given a diagnosis');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, sc x 60 (60)",
 "Row 3: ch 1, turn, sc in each st across (60)"
]);
ck('failed row has causes', causesOf(1).length > 0, true);
ck('blocked row has none', causesOf(2).length, 0);

print('\n6. Every cause carries evidence, capped at four');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 4 (18)"
]);
var c6 = causesOf(1);
ck('at most 4', c6.length <= 4, true);
ck('all have evidence', c6.every(function(x){return x.evidence.length > 0;}), true);

print('\n7. A row whose stitch count the repeat cannot divide');
// "*sk 2 sts, 3 dc in next st; rep from * to end" takes 3 stitches a pass, and the "2 dc in first st"
// ahead of it takes 1 - so the row works over 1 + a multiple of 3 and nothing else. Against 20 it runs 6
// times and strands 1. The old diagnosis said "previous row count is wrong, extend this row by 1", which
// sent the reader to the wrong row and asked for something the row cannot do: the next pass needs 3.
var E = window.CrochetMathEngine;
var INDIV = '2 dc in first st, *sk 2 sts, 3 dc in next st; rep from * to end';
function fixFor(avail) { return (E.evaluateStep(0, avail, INDIV, 1, 0, 0).resolutions || [])[0] || ''; }

print('   the repeat unit is derived from an open-ended repeat at all');
var unit = E.analyzeRepeatUnit(INDIV, 1, E.parseInstructions(INDIV, 20), 20);
ck('one pass costs 3', unit.cost, 3);
ck('the row works 1 outside the repeat', unit.restCost, 1);
ck('and it fits 6 times into 20', unit.times, 6);
ck('marked open-ended', unit.openEnded, true);

print('   and the failure names the reason');
load([
 "Row 1: Ch 23, dc in 4th ch from hook and each ch across. (20 sts)",
 "Row 2: Ch 3, turn, 2 dc in first st, *sk 2 sts, 3 dc in next st; rep from * to end. (21 sts)"
]);
function calcOf(r){ return $('step-sequence-body').children[r].children[4].innerHTML.replace(/<[^>]*>/g,'').trim().split(/\s/)[0]; }
ck('Row 1 makes the 20 it says', calcOf(0), 20);
var c7 = causesOf(1);
ck('the top cause is the indivisibility', c7[0].cause, 'Stitch count is not one the repeat divides');
ck('and it outranks the previous-row guess', c7[0].tier, 'MOST LIKELY');
ck('which is still offered, lower down',
   c7.some(function(x){ return x.cause === 'Previous row count is wrong'; }), true);

print('   the fix names the counts that would work');
ck('20 is diagnosed', /fits 1 \+ a multiple of 3 stitches - 19 or 22, not 20/.test(fixFor(20)), true);
ck('and the passes counted', /runs 6 times and leaves 1 unworked/.test(fixFor(20)), true);
ck('21 strands 2', /19 or 22, not 21.*leaves 2 unworked/.test(fixFor(21)), true);
ck('23 moves to the next window', /22 or 25, not 23/.test(fixFor(23)), true);
// The two counts the row actually fits must pass, or the advice above is wrong.
ck('19 is valid', E.evaluateStep(0, 19, INDIV, 1, 0, 0).costIsValid, true);
ck('22 is valid', E.evaluateStep(0, 22, INDIV, 1, 0, 0).costIsValid, true);

// A repeat with nothing outside it reads as a plain multiple, without the "0 stitches
// are worked outside it" the first wording produced.
var PLAIN = '*sk 2 sts, 3 dc in next st; rep from * to end';
ck('a bare repeat says "a multiple of 3"',
   /takes 3 stitches a pass, so this row fits a multiple of 3 stitches - 18 or 21, not 20/
   .test((E.evaluateStep(0, 20, PLAIN, 1, 0, 0).resolutions || [])[0] || ''), true);

// A granny round's repeat closes on corners, not stitches, so stitches left between
// them are expected and this diagnosis must not fire on them.
var GRANNY = 'ch 3, 2 dc in same sp, ch 1, *3 dc in next ch-1 sp, ch 1; rep from * around';
var g = E.evaluateStep(0, 12, GRANNY, 1, 0, 4);
ck('a corner-counted round is left alone', (g.resolutions || []).length, 0);

print('\n9. The upstream cause, at the engine level');
// It used to live in app.js, where it walked the rendered rows and could not be reached without a DOM.
// Now it is a pure function on the engine, so the rule can be stated directly instead of inferred from
// what a table happened to render.
// Short by 5 over 6 repeats: a real shortfall, but not one that divides, so it is reported as a total
// rather than as a dropped increase. The per-repeat case is asserted separately at the end.
var PREV_SHORT = { label: 'Row 2', instructionString: '[sc, sc] x 6', multiplier: 1,
                   expectedYield: 18, calculatedYield: 13 };

// The case it exists for: the row above fell short of its own written count.
var up = E.applyUpstreamCause({ unknownTokens: [], likelyCauses: [
    { cause: 'Previous row count is wrong', evidence: 'x', tier: 'MOST LIKELY' }] }, PREV_SHORT);
ck('the upstream row is named first', up[0].cause, 'Row 2 is short 5 stitches');
ck('at the top tier', up[0].tier, 'MOST LIKELY');
ok('with its own arithmetic as the evidence', /produced 13 but its count says 18/.test(up[0].evidence));
ck('and what was top before is demoted rather than dropped', up[1].tier, 'POSSIBLE');

// The bug this function was rewritten for. A row that could not be READ tells you nothing about the
// row above it: it worked 0 stitches because the tokenizer stopped, not because it was starved. The
// engine already scores an unknown token at 100 so nothing outranks it, and this must not override it.
var typo = { unknownTokens: ['dubble crochet'], likelyCauses: [
    { cause: 'Typo or unknown stitch', evidence: 'x', tier: 'MOST LIKELY' }] };
var kept = E.applyUpstreamCause(typo, PREV_SHORT);
ck('an unreadable row keeps its own diagnosis', kept[0].cause, 'Typo or unknown stitch');
ck('at the top tier still', kept[0].tier, 'MOST LIKELY');
ck('and gains no upstream guess at all', kept.length, 1);

// Same reasoning, reached the other way: unknownTokens is empty but the engine has already said the
// punctuation is malformed, so every number below it measures a row nobody typed.
var bad = E.applyUpstreamCause({ unknownTokens: [], likelyCauses: [
    { cause: 'Notation is malformed', evidence: 'x', tier: 'MOST LIKELY' }] }, PREV_SHORT);
ck('malformed notation is left in front too', bad[0].cause, 'Notation is malformed');
ck('and nothing is prepended', bad.length, 1);

// The signal only exists when the previous row missed its OWN count. A row that made what it promised
// says nothing about the row below, however that row fails.
var honest = { label: 'Row 2', instructionString: 'sc in each st across', multiplier: 1,
               expectedYield: 12, calculatedYield: 12 };
var none = E.applyUpstreamCause({ unknownTokens: [], likelyCauses: [
    { cause: 'Previous row count is wrong', evidence: 'x', tier: 'MOST LIKELY' }] }, honest);
ck('a row that made its count is not blamed', none[0].cause, 'Previous row count is wrong');
ck('and the list is untouched', none.length, 1);

// One short per repeat is the classic dropped increase, and naming it beats naming the total.
var perRep = E.applyUpstreamCause({ unknownTokens: [], likelyCauses: [] },
    { label: 'Row 2', instructionString: '[sc, sc] x 6', multiplier: 1,
      expectedYield: 18, calculatedYield: 12 });
ok('six short over six repeats reads as one per repeat',
   /exactly 1 per repeat/.test(perRep[0].evidence));

endSuite();
