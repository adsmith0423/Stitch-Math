boot();

var E = CrochetMathEngine;
// cost/yield as a pair, because these three bugs each moved one side of it while leaving the other
// looking perfectly reasonable.
function unit(s) { var r = E.parseInstructions(s); return r.totalCost + '/' + r.totalYield; }
function unknown(s) { return (E.parseInstructions(s).unknownTokens || []).join(','); }

// Three ways a published pattern counts that the engine used to get wrong. None of them raised an error:
// the number was simply untrue, which is the failure mode worth the most tests.

print('\n1. "N sts in EACH of the next M" works N into every one of M positions');
// The peak of a ripple row. Consumes 2 and makes 4; the leading 2 used to be read as the number of
// positions instead, so the row came out 2 short per repeat.
ck('2 hdc in each of next 2 sts', unit('2 hdc in each of next 2 sts'), '2/4');
ck('and from the first sts', unit('2 hdc in each of first 2 sts'), '2/4');
ck('3 dc in each of next 4 sts', unit('3 dc in each of next 4 sts'), '4/12');
// The vintage books write the same phrase with a leading 1, which must stay 1-for-1.
ck('1 s c in each of next 2 s c is unchanged', unit('1 s c in each of next 2 s c'), '2/2');
ck('and the plain run is unchanged', unit('hdc in next 3 sts'), '3/3');
// One position, several stitches into it - a different phrase with a different answer.
ck('2 hdc in next st still costs 1', unit('2 hdc in next st'), '1/2');

print('\n2. A run worked into the foundation chain counts its chains');
// Row 1 of nearly every piece is written "in next N ch". The noun was missing from the run rule, so the
// whole run read as a single stitch.
ck('hdc in next 3 ch', unit('hdc in next 3 ch'), '3/3');
ck('dc in next 5 chains', unit('dc in next 5 chains'), '5/5');
ck('2 hdc in each of next 2 ch', unit('2 hdc in each of next 2 ch'), '2/4');
// Position-into-the-chain phrasing is not a run and must not be swept up by it.
ck('"in 2nd ch from hook" is still one stitch', unit('sc in 2nd ch from hook'), '1/1');

print('\n3. A bracketed group counts a word multiplier');
// "(hdc2tog) twice" is how every ripple sleeve cap is written.
ck('(hdc2tog) twice', unit('(hdc2tog) twice'), '4/2');
ck('(sc, inc) twice', unit('(sc, inc) twice'), '4/6');
ck('(hdc2tog) thrice', unit('(hdc2tog) thrice'), '6/3');
ck('(hdc2tog) once', unit('(hdc2tog) once'), '2/1');
ck('digits still work', unit('(hdc2tog) x 2'), '4/2');
ck('and a bare group is worked once', unit('(hdc2tog)'), '2/1');

print('\n4. The Ripple pattern repeat unit now derives cleanly');
// The pattern states its own answer - "worked over a multiple of 12 sts" - so the derived cost is
// checkable against the designer's number, in both the chain form (Row 1) and the stitch form (Row 2 on).
var RIPPLE_CH = 'hdc2tog, hdc in next 3 ch, 2 hdc in each of next 2 ch, hdc in next 3 ch, hdc2tog';
var RIPPLE_ST = 'hdc2tog, hdc in next 3 sts, 2 hdc in each of next 2 sts, hdc in next 3 sts, hdc2tog';
ck('Row 1 unit is 12 in, 12 out', unit(RIPPLE_CH), '12/12');
ck('Row 2 unit is 12 in, 12 out', unit(RIPPLE_ST), '12/12');
ck('nothing in it is unreadable', unknown(RIPPLE_ST), '');
// A ripple keeps its stitch count: what goes in comes out, or the fabric would not lie flat. That is the
// property the pattern's own "multiple of 12" asserts.
ck('the repeat is count-neutral', E.parseInstructions(RIPPLE_ST).totalCost, E.parseInstructions(RIPPLE_ST).totalYield);

print('\n5. Every group worked into a ring is counted, not just the first');
// A chain ring is scaffolding, so the round is whatever is worked into it. Reading only the first group
// reported a granny square's opening round as 2 stitches instead of 11, and the round above then failed
// asking for 22 against 2 - which looks, from outside, like the ring itself being rejected.
function yieldOf(s) { return E.evaluateStep(0, 0, s, 1, 0).calculatedYield; }
ck('four groups into one ring',
   yieldOf('ch 4, sl st to join, ch 3, 2 dc in ring, ch 2, [3 dc in ring, ch 2] x 3, sl st to top of ch-3'), 11);
ck('however the ring is worded',
   yieldOf('ch 4, sl st to first ch to form ring, ch 3, 2 dc in ring, ch 2, [3 dc in ring, ch 2] x 3, sl st to top'), 11);
// The standing chain is worked into the ring like everything else, so a granny square's opening round
// comes out at the 12 it says it is rather than 11.
ck('and the standing chain counts as one of them',
   yieldOf('ch 4, sl st to join, ch 3 (counts as dc), 2 dc in ring, ch 2, [3 dc in ring, ch 2] x 3, sl st to top of ch-3'), 12);
ck('a simple ring gains it too',
   yieldOf('ch 6, join to form a ring, ch 3 (counts as dc), 15 dc in ring'), 16);
// A single group is the case this was always right about, and must stay right.
ck('one group is unchanged', yieldOf('ch 6, join to form a ring, ch 3, 15 dc in ring'), 15);
ck('so is a ring worked in sc', yieldOf('ch 5, sl st in first ch to form a ring, 12 sc in ring'), 12);
ck('and the vintage "from hook" form', yieldOf('ch 2, 6 sc in 2nd ch from hook'), 6);
// The guard that keeps a foundation row out of the ring path: a long chain is not a ring.
ck('a long chain is still a foundation row',
   yieldOf('ch 25, sc in 2nd ch from hook and in each ch across'), 24);

print('\n6. A standing chain is one stitch, not its chains');
// "ch 3 (counts as dc)" is three chains tall and one stitch wide. Counted as three it put every joined
// round and every granny square two over, compounding round by round.
ck('ch 3 counts as dc', unit('ch 3 (counts as dc)'), '0/1');
ck('ch 2 counts as hdc', unit('ch 2 (counts as hdc)'), '0/1');
ck('ch 4 counts as tr', unit('ch 4 (counts as tr)'), '0/1');
ck('and it costs nothing - it substitutes, it does not consume', unit('ch 3 (counts as dc)'), '0/1');
// A granny round opens with a chain that is BOTH the first stitch and the space beside it.
ck('ch 4 counts as dc plus a ch-1 space', unit('ch 4 (counts as dc, ch 1)'), '0/2');
// The negative form was already handled and must stay handled.
ck('a chain that says it is NOT a stitch still makes nothing', unit('ch 2 (does not count as a st)'), '0/0');
// A bare chain is still its own chains: no claim was made about it.
ck('a plain ch 3 is unchanged', unit('ch 3'), '0/3');
// The pattern is followed even when it pairs them unconventionally, and says so.
ck('an odd pairing is still counted as one', unit('ch 5 (counts as dc)'), '0/1');
ck('and it is mentioned', /usually ch 3/.test(E.standingChainNotes('ch 5 (counts as dc)').join(' ')), true);
ck('a conventional pairing says nothing', E.standingChainNotes('ch 3 (counts as dc)').length, 0);
ck('the table knows the usual heights', E.STANDING_CHAIN_HEIGHTS.dc + '/' + E.STANDING_CHAIN_HEIGHTS.tr, '3/4');

print('\n7. A chain space costs the chains it was made from, once');
// It is one place to put the hook however many stitches go into it - and what it costs is what the round
// below banked when it made it, so the two rounds balance.
ck('3 dc into a ch-1 space', unit('3 dc in next ch-1 sp'), '1/3');
ck('3 dc into a ch-2 space', unit('3 dc in next ch-2 sp'), '2/3');
// Every granny square corner.
ck('a whole corner group costs the corner once', unit('(3 dc, ch 2, 3 dc) in corner ch-2 sp'), '2/8');
ck('however the corner is worded', unit('(3 dc, ch 2, 3 dc) in next ch-2 sp'), '2/8');
ck('and into the same space', unit('(2 dc, ch 2, 3 dc) in same ch-2 sp'), '2/7');
// Most granny patterns never say "sp" at all - requiring the word left every one of these
// un-folded, so the group fell to the generic bracket expander instead and its ch-2 was charged
// as 2 real stitches on top of the 6 dc.
ck('"in each corner" needs no "sp" to be read as the space',
   unit('(3 dc, ch 2, 3 dc) in each corner'), '2/8');
ck('square brackets fold the same way', unit('[sc, ch 1, sc] in each corner'), '2/3');
// The bracket form used to skip the fold entirely, even with "sp" present: the guard only
// checked for '(', so a corner written with brackets never reached this logic at all.
ck('"[...]" with "sp" used to be skipped outright, not just unworded',
   unit('[3 dc, ch 2, 3 dc] in corner ch-2 sp'), '2/8');
// "corner st"/"corner stitch" names a real stitch AT the corner, not the space the round below
// made, and must keep costing what the stitch costs.
ck('"in corner st" is a stitch, not a space', unit('(sc, sc) in corner st'), '2/2');
// The older spelling, without the hyphen.
ck('"ch 1 space" spelled out', unit('2 dc in next ch 1 space'), '1/2');
// Working into stitches is untouched by any of this.
ck('into one stitch is unchanged', unit('3 dc in next st'), '1/3');
ck('a group into one stitch is unchanged', unit('(hdc, dc, hdc) in next st'), '1/3');

print('\n8. A round worked into chain spaces may pass over the stitches between them');
// How a granny square is built: round 2 works only into the four corner spaces of round 1 and skips all
// twelve dc. The engine requires a row to consume what the row below made, which reported that correct
// round as "12 stitches still unworked". A row that went into chain spaces is excused that half only.
function step(instr, available) { return E.evaluateStep(0, available, instr, 1, 0); }
var grannyRnd2 = 'sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, (3 dc, ch 2, 3 dc) in next ch-2 sp] x 3, ch 1, sl st to top';
ok('a granny round that skips the stitches is valid', step(grannyRnd2, 11).costIsValid);
ck('and is not accused of leaving stitches unworked',
   /out of \d+ available/.test(String(step(grannyRnd2, 11).reason)), false);
// A corner named without "sp" used to be read as 6 real stitches rather than the space's cost
// of 2, so a round that only worked its four corners came back "under-consuming" even though it
// was built exactly like every other granny round.
ok('a corner named without "sp" is excused the same way',
   step('(3 dc, ch 2, 3 dc) in each corner', 8).costIsValid);
// The other half of the check is untouched: no round can work more than is there.
ok('working more than exists is still caught',
   !step('3 dc in next ch-2 sp, 3 dc in next ch-2 sp, 3 dc in next ch-2 sp', 2).costIsValid);
// A row that works into stitches is held to the count exactly as before.
ok('an ordinary short row still fails', !step('sc in next 3 sts', 20).costIsValid);
ck('and says so', /Used 3 stitches out of 20 available/.test(String(step('sc in next 3 sts', 20).reason)), true);

print('\n9. A granny square panel, round by round');
// A whole seven-round panel, written the way a designer writes one: the ring on its own line, corners
// named four different ways, and the repeat spelled with "x 4", "3 more times" and "to end" in different
// rounds. Every round is checked against the count the designer wrote beside it.
function panel(instr, available) { return E.evaluateStep(0, available, instr, 1, 0); }
var ROUNDS = [
    ['[3 dc into ring, ch 2] x 4', 4, 20],
    ['* (3 dc, ch 2, 3 dc) in ch-2 corner sp, ch 1; repeat from * 3 more times', 20, 36],
    ['[(3 dc, ch 2, 3 dc) in corner sp, ch 1, 3 dc in next ch-1 sp, ch 1] x 4', 36, 52],
    ['* (3 dc, ch 2, 3 dc) in corner sp, ch 1, (3 dc in next ch-1 sp, ch 1) 2 times; repeat from * 3 more times', 52, 68],
    ['[(3 dc, ch 2, 3 dc) in corner sp, ch 1, [3 dc in next ch-1 sp, ch 1] x 3] x 4', 68, 84]
];
ROUNDS.forEach(function (r, i) {
    var got = panel(r[0], r[1]);
    ck('round ' + (i + 1) + ' counts ' + r[2], got.calculatedYield, r[2]);
    ok('round ' + (i + 1) + ' is valid', got.costIsValid);
});
// "repeat from * to end" closes the round, it does not run until the stitches are gone. The repeat takes
// in one corner and a square has four, so it goes round four times - sized by stitches it went round
// fourteen and made 350.
var toEnd = E.evaluateStep(0, 84,
    '* (3 dc, ch 2, 3 dc) in corner sp, ch 1, (3 dc in next ch-1 sp, ch 1) 4 times; repeat from * to end',
    1, 0, 4);
ck('round 6 counts 100', toEnd.calculatedYield, 100);
ok('and is valid', toEnd.costIsValid);
// Told nothing about corners, it falls back to the stitch count as it always did.
ok('with no corner count to go on it still resolves to something',
   E.evaluateStep(0, 84, '* sc in next st; repeat from * to end', 1, 0, 0).calculatedYield > 0);
// A ring holds as many stitches as the pattern puts into it, so the round worked into it is not measured
// against the ring's own four chains.
ok('a round worked into a ring is not held to the ring\'s chain count',
   panel('[3 dc into ring, ch 2] x 4', 4).costIsValid);
// Corners are named four ways across these rounds and all mean the same place.
ck('"in ch-2 corner sp"', unit('(3 dc, ch 2, 3 dc) in ch-2 corner sp'), '2/8');
ck('"in corner ch-2 sp"', unit('(3 dc, ch 2, 3 dc) in corner ch-2 sp'), '2/8');
ck('"in corner sp" takes the width the round below made',
   unit('(3 dc, ch 2, 3 dc) in corner sp'), '2/8');
ck('"in next ch-1 sp"', unit('3 dc in next ch-1 sp'), '1/3');

print('\n10. The tokenizer pipeline runs in a fixed order, on purpose');
// parseInstructions is documented as an ordering contract right above its definition - each of these is
// one of the numbered dependencies there, isolated to the smallest phrase that fails if the two steps
// involved are ever swapped.
//
// (2) resolveStandingChains must resolve "counts as" before stripNonStitchProse's counts-as rule removes
// the wording and leaves a bare chain count behind.
ck('a standing chain resolves before its note is stripped', unit('ch 3 (counts as dc)'), '0/1');
// (3) stripColorReferences must remove the colour code before stripJoiningSlipStitches looks for "join
// ... with sl st" - with the code still in the middle, neither rule's job gets done: the code is reported
// unknown, and the join is counted as a stitch.
ck('a colour code comes off before the joining rule looks for its phrase',
   unit('Join C with sl st in seam'), '0/0');
ck('and neither half is left over', E.parseInstructions('Join C with sl st in seam').unknownTokens.length, 0);
// (5) expandIntoOneGroups must fold a group-into-a-space before expandBracketRepeats tears it apart on
// its internal commas.
ck('a corner group folds to one token before generic brackets expand it',
   unit('(3 dc, ch 2, 3 dc) in corner ch-2 sp'), '2/8');
// (6) expandRepeatFromBeginning must rewrite "repeat from beg" into the asterisk form before
// expandAsteriskRepeats runs, or there is no "*" for it to find.
ck('"repeat from beg" is rewritten before the asterisk expander looks for one',
   E.evaluateStep(0, 40, 's c in next s c, 2 s c in next s c, repeat from beg all around', 1, 0).calculatedYield, 60);
// (1) expandPatternStitchUsage reads "to last N sts" as one phrase before cleanModifiers strips the bare
// word "last" out from under it.
E.clearPatternStitches();
E.addPatternStitch('Ripple Pattern', 'hdc2tog, hdc in next 3 sts, 2 hdc in each of next 2 sts, hdc in next 3 sts, hdc2tog', { multiple: 12 });
ck('"as established to last N sts" survives the word-cleanup step',
   E.evaluateStep(0, 70, 'work in Ripple pattern as established to last 5 sts, hdc in last 5 sts', 1, 0).calculatedYield, 65);
E.clearPatternStitches();

print('\n11. A foundation row that never says which chain to start in');
// "Ch 16, sc in each ch across" is a foundation row with the one number missing that decides its count.
// Left to the tokenizer it read as 16 chains AND a stitch worked into them - 17 against nothing - and
// failed a row that is merely vague.
function found(instr, skip) { return E.parseFoundationRow(instr, 0, skip); }
ck('it is recognised as a foundation row', found('ch 16, sc in each ch across', 0).isFoundationRow, true);
ck('and says the skip was not stated', found('ch 16, sc in each ch across', 0).skipStated, false);
// parseFoundationRow still takes the skip as an argument - the caller decides. What has changed is who
// the caller is: it used to be an "Initial Turning Chains" box the reader had to fill, and is now
// inferUnstatedSkip reading the row's own opening stitch. The argument contract is unchanged.
ck('with a skip of 0, every chain is worked', found('ch 16, sc in each ch across', 0).count, 16);
ck('a skip of 1 skips one', found('ch 16, sc in each ch across', 1).count, 15);
ck('a skip of 3 skips three', found('ch 16, sc in each ch across', 3).count, 13);
ck('the "in" is still optional', found('ch 16, sc each ch across', 1).count, 15);
ck('so is the long form of the noun', found('ch 16, sc in each chain across', 1).count, 15);
// A row that states its own starting chain has answered the question, and the pattern's word outranks
// anything inferred - otherwise a reading taken from one row silently re-counts rows that were correct.
var stated = found('ch 16, sc in 2nd ch from hook and each ch across', 3);
ck('a stated start is not overridden', stated.count, 15);
ck('and is marked as stated', stated.skipStated, true);
ck('a stated 3rd ch from hook holds too',
   found('ch 16, dc in 3rd ch from hook and each ch across', 1).count, 14);
// The phrase that makes it a foundation row is working into the CHAIN. Everything below opens with a
// chain and works into fabric, and must stay an ordinary row.
no('"in each st across" is not a foundation row', found('ch 1, sc in each st across', 2).isFoundationRow);
no('nor a turned row', found('ch 1, turn, sc in each st across', 2).isFoundationRow);
no('nor a round worked into ch-1 spaces', found('ch 1, sc in each ch-1 sp around', 2).isFoundationRow);
no('nor into ch-2 spaces', found('ch 1, sc in each ch-2 sp around', 2).isFoundationRow);
// A skip that would consume the whole chain is not a reading of the row, it is a typo.
no('a skip as long as the chain is refused', found('ch 16, sc in each ch across', 16).isFoundationRow);

print('\n11b. ...and the number now comes off the row itself, not a box');
// There was an "Initial Turning Chains" box here, and this section drove it. It asked the reader for
// something the row already implies: a stitch stands on a chain as tall as itself, so an unstated
// foundation skips exactly that chain. sc goes into the 2nd ch from hook, hdc the 3rd, dc the 4th -
// i.e. the skip IS the height. Every stated foundation row across the corpora pairs them that way.
function skipOf(line) { return E.inferUnstatedSkip(line); }
ck('sc stands on ch 1, so one is skipped', skipOf('Row 1: ch 16, sc in each ch across').value, 1);
ck('hdc stands on ch 2', skipOf('Row 1: ch 21, hdc in each ch across').value, 2);
ck('dc stands on ch 3', skipOf('Row 1: ch 21, dc in each ch across').value, 3);
ck('tr stands on ch 4', skipOf('ch 30, tr in each ch across').value, 4);
// The row label has to come off first. By the time parseFoundationRow sees an instruction the label is
// long gone, stripped upstream - but this reads the raw document, where it is still there, and
// stripRowPreamble alone cannot cross the digit in "Row 1".
ck('a labelled row reads the same as a bare one',
   skipOf('Row 1: ch 21, dc in each ch across').value, skipOf('ch 21, dc in each ch across').value);
// A row that states its own ordinal never reaches the inference at all.
ck('a stated start is left alone',
   skipOf('Row 1: Ch 16, sc in 2nd ch from hook and each ch across').value, 0);
// Not every line that mentions a chain is a foundation row.
ck('an ordinary turned row is not one', skipOf('Row 2: ch 1, turn, sc in each st across').value, 0);
ck('nor is a mesh round', skipOf('Rnd 3: ch 1, sc in each ch-1 sp around').value, 0);
// "ldc" is not in STANDING_CHAIN_HEIGHTS and \bdc\b does not fire inside it. Guessing a height from a
// prefix would start inventing stitches the table never claimed, so this is refused and marked
// unconfident rather than answered wrongly - under-skipping shows as a visible mismatch, over-skipping
// silently invents agreement.
var unknown = skipOf('Row 1: ch 21, ldc in each ch across');
ck('a stitch the height table does not know is refused', unknown.value, 0);
no('and is not claimed as a finding', unknown.confident);

print('\n11c. The inferred skip reaches the matrix');
// The box had only ever been wired to the OTHER shape a foundation takes - a bare "Ch 16" on its own
// line, subtracted from the row after it - so on a one-line foundation row nothing the reader set
// changed any number on screen. Both shapes are pinned here.
function firstRowYield(line) {
    $('bulk-input').value = line;
    $('bulk-parse-btn').fire('click');
    var cell = $('step-sequence-body').children[0].children[4];
    return parseInt(((cell.innerHTML || '') + (cell.textContent || '')).replace(/<[^>]*>/g, '').trim(), 10);
}
ck('one-line sc foundation skips its one chain',
   firstRowYield('Row 1: Ch 16, sc in each ch across'), 15);
ck('a dc foundation skips three',
   firstRowYield('Row 1: Ch 21, dc in each ch across'), 18);
ck('a stated start still wins over the inference',
   firstRowYield('Row 1: Ch 16, sc in 2nd ch from hook and each ch across'), 15);
// The shape that already worked, which this must not disturb: the chain on its own line, with the skip
// coming off the row that works back along it.
$('bulk-input').value = 'Ch 16\nRow 2: sc in each ch across';
$('bulk-parse-btn').fire('click');
var twoLine = $('step-sequence-body').children.map(function (tr) {
    return parseInt((tr.children[4].innerHTML || '').replace(/<[^>]*>/g, '').trim(), 10);
});
ck('a bare chain line still yields its chains', twoLine[0], 16);
// Nothing on the bare "Ch 16" line names a stitch, and the row below it does not open with its own
// chain, so no foundation row is found and the skip stays 0 rather than being guessed.
ck('and the row above it takes no inferred skip', twoLine[1], 16);

print('\n12. Chain-space counting convention: discount excludes a space entirely, cost and yield alike');
// Off by default - every corner test above stays exactly as written under 'count'.
ck('default convention is count', E.getChainSpaceConvention(), 'count');
E.setChainSpaceConvention('discount');
// "(dc, ch 2, dc) in corner ch-2 sp" - the pattern class from the raglan yoke whose own "Stitch
// Counts" note says the ch-2 corner spaces are not counted, only the dc's are. Yield drops from 4
// (2 dc + 2 chain) to 2 (2 dc only) - and cost drops to 0, not the space's declared width: the round
// below never banked the space as a real stitch either, under this same convention, so there is
// nothing left to spend back. Leaving cost at the declared width (what the first version of this
// shipped with) reserved exactly as much from the row as discounting the yield gained, and every
// round came out flat instead of growing - wrong for a raglan yoke or a granny square, which is
// what corners are FOR. See section 13 for the multi-round shape this is really guarding.
ck('a two-sided corner costs nothing and yields only its two dc',
   unit('(dc, ch 2, dc) in corner ch-2 sp'), '0/2');
// The classic 3-dc granny corner: 6 dc stay, the ch-2 does not, on either side of the ledger.
ck('a six-dc corner keeps its six dc and loses only the chain',
   unit('(3 dc, ch 2, 3 dc) in corner ch-2 sp'), '0/6');
// A group with no chain in its own body - working INTO a space an earlier round made, not creating
// one - has nothing to discount from its yield, but the space itself is still free to enter.
ck('working into an existing space costs nothing here either, though nothing was discounted from it',
   unit('3 dc in next ch-2 sp'), '0/3');
// A raglan/yoke opens its very first round straight from the foundation chain, with no earlier round
// to have named a space yet: "(dc, ch 2, dc) in first ch" is how nearly every one is written. The
// chain it creates is a corner exactly as much as one written "in ch-2 sp" - it just has no name to
// be worked into a second time, so this counted as an ordinary single-position group before and its
// chain was never discounted, leaving every round after it off by the same constant amount forever
// (see section 13). Cost stays 1: this consumes one link of the foundation chain, not the chain's own
// width, and that is true under either convention.
ck('a corner opened straight from the foundation chain is discounted the same way',
   unit('(dc, ch 2, dc) in first ch'), '1/2');
// An undeclared space ("in next sp", no "ch-N" to give its width) is corner-shaped too and is
// discounted the same way - the pre-existing "which width?" limitation is unrelated to this.
ck('a bare, undeclared space is discounted as well', unit('(dc, ch 2, dc) in next sp'), '1/2');
// Deliberately NOT extended to a chain worked into a real STITCH: "(sc, ch 3, sc) in next st" is at
// least as often a picot or a button loop as a future corner, and unlike a stated width there is no
// text signal here to tell the two apart. Guessing wrong would silently under-count a real picot row.
ck('a chain looped off a real stitch is left alone - could be a picot, not a corner',
   unit('(sc, ch 3, sc) in next st'), '1/5');
E.setChainSpaceConvention('count');
ck('back to count, the same corner is unchanged from section 7',
   unit('(dc, ch 2, dc) in corner ch-2 sp'), '2/4');
ck('and the foundation-anchored corner is unchanged too', unit('(dc, ch 2, dc) in first ch'), '1/4');

print('\n13. Discount still excuses a round for working into spaces, and grows a corner round correctly');
E.setChainSpaceConvention('discount');
// The exemption in section 8 must survive discount even though the space's own cost is now 0: it is
// tracked from the space's declared width, not the (zeroed) real cost, precisely so this stays true.
ok('a granny round that skips the stitches between corners is still excused, not just cheap',
   step('(3 dc, ch 2, 3 dc) in each corner', 8).costIsValid);
// The whole raglan yoke, round by round, exactly as it is written and exactly as section 7's
// motivating pattern used it: round 1 opens from the foundation chain with no ch-2 sp wording yet,
// every round after works into a named one. Every written count in this list is what the pattern
// itself states beside each round - the bug this section exists to catch is that fixing only the
// CH_SPACE_TARGET rounds (2 onward) and leaving round 1 out left every round after it wrong by the
// same constant amount, because round 1's uncorrected total became round 2's starting budget and a
// corner round's growth rate turns out to be identical either way - only the base shifts.
ck('round 1 opens the yoke at 56, corners included, foundation-anchored',
   E.evaluateStep(0, 52,
     '(dc, ch 2, dc) in first ch, dc in next 16 chs, (dc, ch 2, dc) in next ch, dc in next 8 chs, ' +
     '(dc, ch 2, dc) in next ch, dc in next 16 chs, (dc, ch 2, dc) in next ch, dc in next 8 chs',
     1, 0).calculatedYield, 56);
var discountRound = '*(dc, ch 2, dc) in ch-2 sp, dc in each st across to next ch-2 sp; rep from * 3 more times';
var d2 = E.evaluateStep(0, 56, discountRound, 1, 0, 4);
ck('round 2 grows from round 1\'s real total, not the uncorrected one', d2.calculatedYield, 64);
ok('and is valid', d2.costIsValid);
var d3 = E.evaluateStep(0, d2.calculatedYield, discountRound, 1, 0, 4);
ck('round 3 keeps growing by the same amount', d3.calculatedYield, 72);
var d4 = E.evaluateStep(0, d3.calculatedYield, discountRound, 1, 0, 4);
ck('round 4', d4.calculatedYield, 80);
var d5 = E.evaluateStep(0, d4.calculatedYield, discountRound, 1, 0, 4);
ck('round 5 - matches every written count in the pattern this convention was built for', d5.calculatedYield, 88);
E.setChainSpaceConvention('count');

endSuite();
