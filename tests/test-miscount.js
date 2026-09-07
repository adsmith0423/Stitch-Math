boot();

var E = window.CrochetMathEngine;
function unit(s) { var r = E.parseInstructions(s); return r.totalCost + '/' + r.totalYield; }

function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
// innerHTML on the matrix cells only returns markup that was assigned, and these are built with
// appendChild, so both halves are read and joined. See tests/test-counting.js.
function cell(row, col) {
    var td = $('step-sequence-body').children[row].children[col];
    return ((td.innerHTML || '') + ' ' + (td.textContent || '')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function calculated(row) { return parseInt(cell(row, 4), 10); }
function status(row) { return cell(row, 5); }
function causesOf(row) {
    var html = $('step-sequence-body').children[row].children[5].innerHTML;
    var out = [], re = /<span class="cause-tier[^"]*">([^<]+)<\/span><span class="cause-name">([^<]+)<\/span><span class="cause-evidence">([^<]*)<\/span>/g, m;
    while ((m = re.exec(html))) out.push({ tier: m[1], cause: m[2], evidence: m[3] });
    return out;
}

// Three patterns whose stated count is wrong, each in a different way. All three are readable rows with
// no unknown token - the failure is arithmetic, so nothing about the text flags them, and getting the
// number silently wrong is the only outcome worse than getting it loudly wrong.

print('\n1. A mid-row increase written without the words "each of"');
// "2 sc in next 10 sts" is two stitches into every one of ten positions: 10 in, 20 out. Only the "each of"
// spelling was read that way; without the words the phrase folded to a bare run count and the leading 2
// fell off, so the row consumed and made the same 40 - a row that grows by 10 reported as one that grows
// by nothing, exactly the reading that looks correct from outside.
ck('2 sc in next 10 sts is 10 in, 20 out', unit('2 sc in next 10 sts'), '10/20');
ck('2 dc in next 5 sts', unit('2 dc in next 5 sts'), '5/10');
ck('3 sc in next 4 sts', unit('3 sc in next 4 sts'), '4/12');
// The words are still allowed, and still mean the same thing.
ck('the "each of" spelling is unchanged', unit('2 sc in each of next 10 sts'), '10/20');
ck('and the ripple peak it was written for', unit('2 hdc in each of next 2 sts'), '2/4');
// The other count-lead words reach the same rule.
ck('"in last 4 sts"', unit('2 sc in last 4 sts'), '4/8');
ck('"in rem 6 sts"', unit('2 sc in rem 6 sts'), '6/12');
// One position with several stitches in it is a different phrase and keeps its answer.
ck('2 sc in next st still costs 1', unit('2 sc in next st'), '1/2');
// A plain run has no multiplier to keep and must not acquire one.
ck('a plain run is unchanged', unit('sc in next 10 sts'), '10/10');
ck('and a plain run into the chain', unit('hdc in next 3 ch'), '3/3');
ck('a leading 1 stays 1-for-1', unit('1 s c in each of next 2 s c'), '2/2');

print('   ...and the row it was hiding in');
// Row 1 makes 40. Row 2 works all 40 and makes 50, but claims 45. The row is VALID - it works exactly
// what is under it - so the error is entirely in the written count, and the note is its only surface.
load([
    'Row 1: Ch 41, sc in 2nd ch from hook and each ch across (40 sts)',
    'Row 2: Ch 1, turn, sc in next 10 sts, 2 sc in next 10 sts, sc in next 20 sts (45 sts)'
]);
ck('Row 1 makes the 40 it says', calculated(0), 40);
ck('Row 2 makes 50, not the 45 it claims', calculated(1), 50);
ck('and the discrepancy is named', /Written count 45, calculated 50 \(\+5\)/.test(status(1)), true);
no('the row itself is not failed - it works all 40', /FAIL/.test(status(1)));
// 10 + 20 + 20 is the whole of it: the count has to come from the increase, not from the engine reading
// one of the plain runs long.
ck('it consumes exactly what Row 1 made', E.evaluateStep(0, 40,
    'Ch 1, turn, sc in next 10 sts, 2 sc in next 10 sts, sc in next 20 sts', 1, 45).totalCost, 40);

print('\n2. A joined round whose stated count leaves out the spaces');
// "sl st to top of ch-3" is the round saying its opening chain is a stitch: the top of a chain is only
// somewhere to join if the chain stands in the place of one. Rounds that count their chain and never write
// "(counts as dc)" are the majority, so reading only the parenthetical left every one a stitch short.
ck('the join implies the standing chain',
    E.impliedStandingChain('Ch 3, 3 dc in ring, ch 2, sl st to top of ch-3 to join'), 3);
ck('however the join is worded',
    E.impliedStandingChain('Ch 3, dc in each st around, join with sl st in top of beg ch-3'), 3);
ck('a ch-4 round for tr', E.impliedStandingChain('Ch 4, tr in each st around, sl st to top of ch-4'), 4);
// Nothing is inferred where the pattern has not said it.
ck('a round that joins to a stitch is not inferring anything',
    E.impliedStandingChain('Ch 3, dc in each st around, sl st to first dc'), 0);
ck('nor one that names a chain it did not open with',
    E.impliedStandingChain('Ch 2, dc in each st around, sl st to top of ch-3'), 0);
ck('nor one with no join at all', E.impliedStandingChain('Ch 3, dc in each st across'), 0);
// The pattern's own word outranks the inference, both ways round.
ck('an explicit "counts as" is left to the rule that handles it',
    E.impliedStandingChain('Ch 3 (counts as dc), dc in each st around, sl st to top of ch-3'), 0);
ck('and so is an explicit denial',
    E.impliedStandingChain('Ch 3 (does not count as a st), dc in each st around, sl st to top of ch-3'), 0);

print('   the round counts its sixteen dc');
// Ring on its own line, then four four-dc clusters: the ch-3 plus 3 dc, then three repeats of 4 dc.
// Sixteen stitches, and four ch-2 spaces between them.
load([
    'Round 1: Ch 4, sl st to form ring',
    'Round 2: Ch 3, 3 dc in ring, *ch 2, 4 dc in ring; rep from * 3 times, ch 2, sl st to top of ch-3 to join (16 sts)'
]);
ck('Round 2 counts 16', calculated(1), 16);
no('and is not failed', /FAIL/.test(status(1)));
no('nor given a count note, because the count agrees', /Written count/.test(status(1)));
// Stitch Math counts a ring round the way the designer counts it - the stitches worked into the ring, not
// the spaces between them - which keeps the granny corpora reading straight. That leaves the spaces
// unmentioned anywhere, and they are what the round above puts its corners into, so the round says so.
ck('the spaces it also made are named',
    /Also makes 4 ch-2 spaces\. The written count of 16 counts stitches only\./.test(status(1)), true);
// One short of the round is what the missing standing chain used to produce.
ck('without the join the chain is not a stitch', E.evaluateStep(0, 4,
    'Ch 3, 3 dc in ring, *ch 2, 4 dc in ring; rep from * 3 times, ch 2', 1, 0).calculatedYield, 15);

print('   and the note is raised only where something is actually omitted');
// A row that makes no chain space has nothing to report.
ck('a plain row is silent', E.chainSpaceNotes('Ch 1, turn, sc in each st across', 20, 20).length, 0);
// A turning chain is not a space, and neither is a chain the round works INTO - that one was made by the
// round below and is counted there.
ck('a turning chain is not counted as a space',
    E.chainSpaceNotes('Ch 3, turn, dc in each st across', 20, 20).length, 0);
ck('nor a chain space the round works into',
    E.chainSpaceNotes('Ch 3, 3 dc in next ch-2 sp, 3 dc in next ch-2 sp', 6, 6).length, 0);
// With a disagreement on the table the count note is the more urgent thing to read.
ck('a disagreeing count suppresses it',
    E.chainSpaceNotes('Ch 3, 3 dc in ring, ch 2, 3 dc in ring, ch 2', 8, 9).length, 0);
ck('and so does no stated count at all',
    E.chainSpaceNotes('Ch 3, 3 dc in ring, ch 2, 3 dc in ring, ch 2', 8, 0).length, 0);

print('\n3. A repeat that cannot divide the stitches it is given');
// "*fpdc in next 2 sts, bpdc in next 2 sts; rep from * across" takes 4 stitches a pass. Row 1 leaves 18,
// and the ch-2 says outright that it is not one of them, so 18 is all the repeat has: four whole passes
// and two stitches with nowhere to go. A real failure - the row cannot be worked as written.
load([
    'Row 1: Ch 19, hdc in 2nd ch from hook and each ch across (18 sts)',
    'Row 2: Ch 2 (does not count as st), turn, *fpdc in next 2 sts, bpdc in next 2 sts; rep from * across (18 sts)'
]);
ck('Row 1 makes the 18 it says', calculated(0), 18);
ok('Row 2 is failed', /FAIL/.test(status(1)));
ck('and says how many it left', /Used 16 stitches out of 18 available/.test(status(1)), true);
// The reader is sent to the repeat, not to the row below: extending Row 1 by one would not help, because
// the next pass needs four.
var c = causesOf(1);
ck('the top cause is the indivisibility', c[0].cause, 'Stitch count is not one the repeat divides');
ck('at the top tier', c[0].tier, 'MOST LIKELY');
ck('and the evidence counts the passes',
    /4 stitches a pass and 18 are left for it, which is 4 whole passes and 2 over/.test(c[0].evidence), true);
// The fix names counts the row can actually be worked over.
ck('the resolution names them',
    /fits a multiple of 4 stitches - 16 or 20, not 18/.test(status(1)), true);
// The standing chain having declined to be a stitch is load-bearing: counted as one, the repeat would have
// 19 to divide and the arithmetic under test would be a different sum.
ck('the ch-2 declined to be a stitch', unit('Ch 2 (does not count as st)'), '0/0');
// The two counts the advice points at have to work, or the advice is wrong.
var REP = '*fpdc in next 2 sts, bpdc in next 2 sts; rep from * across';
ok('16 is valid', E.evaluateStep(0, 16, REP, 1, 0, 0).costIsValid);
ok('20 is valid', E.evaluateStep(0, 20, REP, 1, 0, 0).costIsValid);
no('18 is not', E.evaluateStep(0, 18, REP, 1, 0, 0).costIsValid);

endSuite();
