boot();

/*
 * CrochetMathEngine.inferPatternSettings and its three parts - validator.js section 8.
 *
 * These settings were form controls until the engine learned to read them off the pattern: a "Sizing"
 * dropdown, a "Construction Style" dropdown, and an "Initial Turning Chains" box. Each restated
 * something the text already said, and each could be set to contradict it.
 *
 * The load-bearing cases here are the ambiguous ones. A detection that fires on a clean fixture proves
 * very little - what matters is that it stays quiet on a line that merely looks similar, and that when
 * it falls back to a default it says so rather than passing the guess off as a reading.
 */

var E = CrochetMathEngine;
function infer(text) { return E.inferPatternSettings(text); }
function noticeFor(text, setting) {
    return infer(text).notices.filter(function (n) { return n.setting === setting; })[0] || null;
}

print('\n1. Counting the sizes');
// The array length inside the parentheses, plus the base size written outside them.
// Mid-line, because a lone "(56)" at the END of a row is that row's own stitch count, not a size.
// Section 2 pins that discriminator; here it just has to not get in the way.
ck('two sizes', E.countSizeVariants('Row 1: ch 52 (56), sc in each ch across').count, 2);
ck('three', E.countSizeVariants('Row 1: ch 52 (56, 60)').count, 3);
ck('four', E.countSizeVariants('Row 1: ch 52 (56, 60, 64)').count, 4);
ck('a plain pattern is one size', E.countSizeVariants('Row 1: ch 52').count, 1);
ck('and so is an empty document', E.countSizeVariants('').count, 1);
// The widest group in the document wins: a row that only varies in some sizes still belongs to a
// pattern graded to the full set.
ck('the widest group decides', E.countSizeVariants('Row 1: ch 52 (56, 60, 64)\nRow 2: dc 8 (9)').count, 4);

print('\n2. ...without eating a stitch count');
// "[sc, inc] x 3 (18)" ends in a multiplier and then an ordinary written count. Reading that as a size
// loses the count entirely, which is the bug this discriminator exists for.
ck('a trailing count is not a size', E.countSizeVariants('Row 2: [sc, inc] x 3 (18)').count, 1);
ck('nor is a note', E.countSizeVariants('Row 2: sc in each st across (12 loops)').count, 1);
// A list is always sizes - no stitch count is ever written "(18, 20)" - and a single value is a size
// only mid-line, where something follows it on the row.
ck('a bracketed list is always sizes', E.countSizeVariants('Row 2: [sc, inc] x 3 (18, 20)').count, 3);
ck('a single value mid-line is a size',
   E.countSizeVariants('work until there are 23 (27) sts on the hook').count, 2);
// Counted a line at a time. Over a whole document the text after any match is non-empty, so every
// trailing count on every row but the last would read as a size.
ck('a multi-row document does not smear',
   E.countSizeVariants('Row 1: sc in each st (12)\nRow 2: sc in each st (12)\nRow 3: sc (12)').count, 1);

print('\n3. Construction: rows, joined rounds, spirals');
ck('rows read as flat', infer('Row 1: sc\nRow 2: sc\nRow 3: sc').construction, 'Rows (Flat)');
ck('joined rounds close with a slip stitch',
   infer('Rnd 1: 12 dc in ring, sl st to top of ch-3\nRnd 2: 2 dc in each st, join with sl st').construction,
   'Rounds (Joined)');
ck('an unjoined round is a spiral',
   infer('Rnd 1: 6 sc in magic ring\nRnd 2: inc in each st (12)').construction, 'Rounds (Spiral)');
// "Do not join" outranks a slip stitch appearing somewhere in the document: amigurumi says it outright.
ck('"do not join" wins over a stray sl st',
   infer('Rnd 1: 6 sc in ring, sl st to join\nRnd 2: inc in each st\nDo not join.').construction,
   'Rounds (Spiral)');
ck('so does working in a spiral',
   infer('Rnd 1: sc, join with sl st\nRnd 2: sc\nContinue working in a spiral.').construction,
   'Rounds (Spiral)');
// Both spellings of the label.
ck('"Round" spelled out reads the same as "Rnd"',
   infer('Round 1: 6 sc in ring\nRound 2: inc in each st').construction, 'Rounds (Spiral)');

print('\n4. ...and the cases that must stay flat');
// One round is not a pattern worked in the round; a garment yoke opens with a round and works flat.
ck('a single round is not enough', infer('Rnd 1: 6 sc in ring\nRow 2: sc\nRow 3: sc').construction, 'Rows (Flat)');
ck('rows outnumbering rounds stays flat',
   infer('Rnd 1: sc\nRnd 2: sc\nRow 3: sc\nRow 4: sc\nRow 5: sc').construction, 'Rows (Flat)');
// The label has to open the line. "Work 3 rounds even" is an instruction, not five rounds.
ck('the word mid-line is not a label',
   infer('Row 1: sc\nRow 2: work 3 rounds even, then 2 rounds more').construction, 'Rows (Flat)');

print('\n5. The foundation skip');
// A stitch stands on a chain as tall as itself, and that chain is the one skipped: sc into the 2nd ch
// from hook, hdc the 3rd, dc the 4th. The skip IS the height, not the height less one - every stated
// foundation row across the corpora pairs them that way.
ck('sc skips one', E.inferUnstatedSkip('Row 1: ch 16, sc in each ch across').value, 1);
ck('hdc skips two', E.inferUnstatedSkip('Row 1: ch 21, hdc in each ch across').value, 2);
ck('dc skips three', E.inferUnstatedSkip('Row 1: ch 21, dc in each ch across').value, 3);
ck('tr skips four', E.inferUnstatedSkip('Row 1: ch 30, tr in each ch across').value, 4);
// The tallest stitch on the row decides - a row of dc with an sc at each end stands on a dc's chain.
ck('the tallest stitch on the row decides',
   E.inferUnstatedSkip('Row 1: ch 21, sc in each ch across to last st, dc in last ch').value, 3);
// Wording that varies in print and must still be read.
ck('the "in" is optional', E.inferUnstatedSkip('ch 16, sc each ch across').value, 1);
ck('so is the long form of the noun', E.inferUnstatedSkip('ch 16, sc in each chain across').value, 1);
// Where the boundary actually is, and why it must not move on its own: the unstated branch requires
// WORKS_INTO_CHAIN, which wants "each ch" adjacent. "each remaining ch" does not match, so this is not
// an unstated foundation row - and parseFoundationRow says the same. The two read the same document
// and have to agree about what is in it, so they are pinned together rather than separately.
no('"each remaining ch" is not an unstated foundation row',
   E.parseFoundationRow('ch 16, 1 sc in each remaining ch', 0, 1).isFoundationRow);
ck('and the inference agrees with it',
   E.inferUnstatedSkip('ch 16, 1 sc in each remaining ch').value, 0);
// The form that wording really appears in states its own ordinal, so it never reaches the inference.
ok('the American Thread form is a foundation row on its own terms',
   E.parseFoundationRow('ch 52, s c in 2nd st from hook, 1 s c in each remaining st of ch', 0, 0).isFoundationRow);

print('\n5b. The foundation chain alone on its own line, with the row below it working back in');
// "Ch 7" followed by a row that just states a count - no "each...across", no stated ordinal - is the
// other shape a foundation takes in print: an amigurumi or doily opener where the chain and the row
// worked into it are typed as two separate lines rather than one.
ck('a bare chain line, worked by the row after it', E.inferUnstatedSkip('Ch 7\nRow 2: 6 sc').value, 1);
ck('and the height table still decides the skip', E.inferUnstatedSkip('Ch 21\nRow 2: 18 dc').value, 3);
// Only trusted as the very first line of content. A bare "Ch 2" further down the pattern is an ordinary
// turning chain into stitches that already exist, not a foundation - reading it the same way would
// invent a skip on fabric the piece already has.
ck('a bare chain later in the pattern is not a foundation',
   E.inferUnstatedSkip('Row 1: sc\nCh 2\nRow 3: dc in each st across').value, 0);
// A row that states its own ordinal has already answered, even split across the line below - and
// unlike the single-line shape, THIS function is the only thing that ever reads it: the chain and
// the row are separate steps, so parseFoundationRow never sees the two together. Read as a skip of
// 1, not 0 - "2nd ch from hook" means one chain was skipped to get there.
var statedBelow = E.inferUnstatedSkip('Ch 7\nRow 2: sc in 2nd ch from hook, 5 sc');
ck('a stated ordinal on the row below is read, not ignored', statedBelow.value, 1);
ok('and trusted outright', statedBelow.confident);
// "Each ch across" on the row below is the OTHER convention - every chain worked, nothing skipped -
// and must not be reread as a skip just because the wording moved to the next line.
ck('"each ch across" on the row below is left alone',
   E.inferUnstatedSkip('Ch 16\nRow 2: sc in each ch across').value, 0);
// A stitch the height table does not know refuses rather than guesses, same as the same-line shape.
var bareUnknown = E.inferUnstatedSkip('Ch 7\nRow 2: 6 ldc');
ck('an unknown stitch on the row below refuses too', bareUnknown.value, 0);
no('and is not confident', bareUnknown.confident);
// Nothing to read into when the chain is the last line of the document.
ck('a trailing bare chain with no row after it', E.inferUnstatedSkip('Row 1: sc\nCh 7').value, 0);

print('\n5c. Flagging the two-line shape for disclosure, separately from the skip itself');
// The pattern text never actually says which chain Row 2 starts in, whether or not the height table
// could work out a number - so `twoLine` is what tells the app "warn about this", independent of
// `value`/`confident`, which are about the SKIP.
ok('a resolved skip is flagged', E.inferUnstatedSkip('Ch 7\nRow 2: 6 sc').twoLine);
// The unconfident refusal is flagged too - this is the row that most needs the reader told the number
// is a guess, since here the engine could not even make one.
ok('an unresolved skip is flagged too', E.inferUnstatedSkip('Ch 7\nRow 2: 6 ldc').twoLine);
// Every shape that already settles the question on its own must NOT be flagged: it would tell a
// reader who already wrote the pattern correctly that something is wrong.
no('the one-line shape is not flagged - there is nothing to combine',
   E.inferUnstatedSkip('Row 1: ch 21, dc in each ch across').twoLine);
no('a stated ordinal on the row below is not flagged',
   E.inferUnstatedSkip('Ch 7\nRow 2: sc in 2nd ch from hook, 5 sc').twoLine);
no('"each ch across" on the row below is not flagged',
   E.inferUnstatedSkip('Ch 16\nRow 2: sc in each ch across').twoLine);
no('a bare chain later in the pattern is not flagged',
   E.inferUnstatedSkip('Row 1: sc\nCh 2\nRow 3: dc in each st across').twoLine);
no('a document with no foundation chain at all is not flagged', E.inferUnstatedSkip('sc in each st').twoLine);
// inferPatternSettings carries the same flag through, under its own name.
ok('inferPatternSettings surfaces it too', infer('Ch 7\nRow 2: 6 sc').unstatedSkipTwoLine);
no('and stays false when nothing needs disclosing',
   infer('Row 1: ch 21, dc in each ch across').unstatedSkipTwoLine);

print('\n5d. Naming the stitch a guessed skip was read off, for the linter to word a fix with');
// The chain height alone is not enough to word "sc in 2nd ch from hook" - the linter needs the
// stitch name too, and it only exists on the two-line shape (the same-line shape never reaches this
// function at all - see section 6).
ck('the stitch the guess was read off', E.inferUnstatedSkip('Ch 7\nRow 2: 6 sc').stitch, 'sc');
ck('a taller stitch names itself too', E.inferUnstatedSkip('Ch 21\nRow 2: 18 dc').stitch, 'dc');
ck('an unrecognised stitch names none', E.inferUnstatedSkip('Ch 7\nRow 2: 6 ldc').stitch, null);
ck('inferPatternSettings surfaces the stitch too', infer('Ch 7\nRow 2: 6 sc').unstatedSkipStitch, 'sc');
ck('and null when nothing needs disclosing',
   infer('Row 1: ch 21, dc in each ch across').unstatedSkipStitch, null);

print('\n5e. The disclosure as a linter fix, not only a sentence in the matrix');
// buildUnstatedSkipFix is always called once the two-line shape is already known to be in play, so it
// always returns a finding - "the pattern doesn't say" is worth surfacing even without a stitch to
// name or a safe rewrite to offer.
var resolvedFix = E.buildUnstatedSkipFix('sc', 1, '6 sc');
ck('flagged as a style suggestion, not an error', resolvedFix.severity, 'style');
ok('the lesson explains why the convention matters', resolvedFix.lesson.length > 0);
ck('and it is a general sentence, not this row\'s numbers',
   /translations|screen readers/.test(resolvedFix.lesson), true);
ck('the auto-fix names the starting chain', resolvedFix.edit.target, 'foundationOrdinal');
ck('using the stitch the guess named', resolvedFix.edit.stitch, 'sc');
ck('the ordinal a ch-1 skip means', resolvedFix.edit.ordinal, '2nd');
ck('and the count actually written', resolvedFix.edit.count, 6);

// A taller stitch reaches a different chain.
ck('hdc skips to the 3rd chain', E.buildUnstatedSkipFix('hdc', 2, '10 hdc').edit.ordinal, '3rd');

// No stitch was recognised - there is nothing to write into the pattern, only something to say about
// it. Advisory only, same reasoning buildFixes already uses for an unknown token.
var unresolvedFix = E.buildUnstatedSkipFix(null, 0, '6 ldc');
ck('still a real finding', unresolvedFix.severity, 'style');
ck('but nothing to apply', unresolvedFix.edit, null);

// A stitch was resolved, but the next row's own text is not the narrow shape this can rewrite safely
// - a bracket, a second stitch, anything past a bare leading count. Left to the reader rather than
// guessed at.
ck('a stitch resolved but the text does not match stays advisory',
   E.buildUnstatedSkipFix('sc', 1, 'sc across').edit, null);
ck('and a bracketed row is left alone too',
   E.buildUnstatedSkipFix('sc', 1, '[sc, inc] x 3').edit, null);

print('\n6. ...and the rows it must not touch');
// A row that states its own ordinal has answered the question; parseFoundationRow reads the number
// straight off it and never consults this. Inferring anything here would fight the pattern.
ck('a stated 2nd ch from hook', E.inferUnstatedSkip('Row 1: ch 16, sc in 2nd ch from hook and each ch across').value, 0);
ck('a stated 4th ch from hook', E.inferUnstatedSkip('Row 1: ch 21, dc in 4th ch from hook and in each ch across').value, 0);
// The phrase that makes a row a foundation row is working into the CHAIN. These all open with a chain
// and work into fabric that already exists.
ck('an ordinary turned row', E.inferUnstatedSkip('Row 2: ch 1, turn, sc in each st across').value, 0);
ck('a mesh round worked into ch-1 spaces', E.inferUnstatedSkip('Rnd 3: ch 1, sc in each ch-1 sp around').value, 0);
ck('a row that does not open with its own chain', E.inferUnstatedSkip('sc in each ch across').value, 0);
ck('an empty document', E.inferUnstatedSkip('').value, 0);
// The first foundation row in the document is the one read; a later row cannot change it.
ck('the first foundation row wins',
   E.inferUnstatedSkip('Row 1: ch 16, sc in each ch across\nRow 9: ch 21, dc in each ch across').value, 1);

print('\n7. Nothing is applied silently');
// Every inferred setting reports the value AND the text it was read from. A setting that changes the
// reader's numbers without saying so is worse than the box it replaced.
var joined = noticeFor('Rnd 1: 12 dc in ring, sl st to top of ch-3\nRnd 2: dc, join with sl st', 'construction');
ck('construction is always reported', joined.value, 'Rounds (Joined)');
ok('and names what it read', /Round.*label/.test(joined.basis));
ok('and is marked as found', joined.confident);

var graded = noticeFor('Row 1: ch 52 (56, 60), sc in each ch across', 'sizeCount');
ck('a graded pattern says how many sizes', graded.value, '3 sizes');
ok('and quotes the list it found them in', /52 \(56, 60\)/.test(graded.basis));
// One size is the unremarkable case; announcing it on every pattern would bury the lines that matter.
ck('a one-size pattern says nothing about sizing', noticeFor('Row 1: ch 52', 'sizeCount'), null);

var skipped = noticeFor('Row 1: ch 21, dc in each ch across', 'unstatedSkip');
ck('an inferred skip is reported', skipped.value, '3');
ok('and explains the convention', /stands on a ch 3/.test(skipped.basis));
// A skip of 0 changes no number, so it is not worth a line.
ck('a skip of nothing is not reported',
   noticeFor('Row 1: ch 16, sc in 2nd ch from hook and each ch across', 'unstatedSkip'), null);

print('\n8. A default is marked as a default, not passed off as a reading');
// The fallback cases: no signal found, prevalence default used. This is exactly when the reader most
// needs to know, so `confident` is false and the panel words it as an assumption.
var empty = noticeFor('', 'construction');
ck('an empty document still defaults to flat', empty.value, 'Rows (Flat)');
no('but does not claim to have read it', empty.confident);
ck('and offers no basis to quote', empty.basis, '');
var unlabelled = noticeFor('sc in each st across\nsc in each st across', 'construction');
no('nor does a document with no row labels at all', unlabelled.confident);
// A stitch the height table does not know: \bdc\b does not fire inside "ldc", and inventing a
// prefix-stripping rule would start guessing at stitches the table never claimed to cover.
var ldc = E.inferUnstatedSkip('Row 1: ch 21, ldc in each ch across');
ck('an unknown stitch refuses rather than guesses', ldc.value, 0);
no('and says it was not confident', ldc.confident);

print('\n9. The whole shape, on one pattern');
var all = infer([
    'Rnd 1: ch 4, 12 dc in ring, sl st to top of ch-3 (12)',
    'Rnd 2: ch 3, 2 dc in each st around, join with sl st (24)',
    'Rnd 3: ch 3, [dc in next st, 2 dc in next] x 12, join with sl st (36)'
].join('\n'));
ck('sizes', all.sizeCount, 1);
ck('construction', all.construction, 'Rounds (Joined)');
ck('skip', all.unstatedSkip, 0);
ck('one notice, for the construction', all.notices.length, 1);

print('\n10. ...and it reaches the reader, on both surfaces');
/*
 * Everything above is the engine. None of it is delivered unless the page says it: a setting that
 * silently changes the reader's numbers is worse than the box it replaced, so the disclosure is the
 * feature, not a nicety. Pinned on the health panel AND the text export, because the export is the
 * copy that leaves the app and reaches a tester who never saw the panel.
 */
function load(text) { $('bulk-input').value = text; $('bulk-parse-btn').fire('click'); }
function panel() { return $('cumulative-status').innerHTML; }
function exported() {
    var out = '';
    Blob = function (parts) { out = String(parts[0]); };
    $('export-txt-btn').fire('click');
    return out;
}

load([
    'Row 1: ch 52 (56, 60), dc in each ch across (49)',
    'Row 2: ch 3, turn, dc in each st across (49)'
].join('\n'));
ok('the panel says what it read', /READ FROM YOUR PATTERN|Read from your pattern/i.test(panel()));
ok('the sizing it found', /Sizing:[\s\S]{0,60}3 sizes/.test(panel()));
ok('the construction it found', /Construction:[\s\S]{0,60}Rows \(Flat\)/.test(panel()));
ok('and the skip it worked out', /Starting chains skipped:[\s\S]{0,40}<strong>3<\/strong>/.test(panel()));
var txt = exported();
ok('the export carries the same reading', /Read from the pattern: Construction = Rows \(Flat\)/.test(txt));
ok('including the skip', /Read from the pattern: Starting chains skipped = 3/.test(txt));

// The whole point of inferring the skip rather than defaulting it to 0: "ch 52, dc in each ch across"
// is 49 dc, because the first three chains stand the first dc up. Defaulted to 0 this row calculated
// 52 against a written 49 and was flagged - a correct row reported as a fault.
ck('and the row it makes right passes',
   $('step-sequence-body').children[0].children[5].innerHTML.indexOf('FAIL'), -1);
ck('with the count the designer wrote',
   $('step-sequence-body').children[0].children[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(/\s/)[0], 49);
// This is the one-line shape - chain and row on the same line - so there is nothing to combine and
// nothing to state "at the start of the next row" that is not already right there. Row 1 gets no
// disclosure note for it.
no('the one-line shape does not get the two-line disclosure',
   /how many chains the next/.test($('step-sequence-body').children[0].children[5].innerHTML));

// An assumption is worded as one. This document names no stitch the height table knows and carries no
// row labels, so both readings are fallbacks.
load('sc in each st across\nsc in each st across');
ok('an assumed reading is marked as assumed', /does not say/.test(panel()));
ok('and carries the unsure class', /infer-unsure/.test(panel()));

// The two-line foundation shape reaching the matrix: "Ch 7" then a row that just says "6 sc" used to
// fail every row under it on a phantom one-stitch deficit - the skip existed on paper (the first chain
// off the hook stands for the row above) but nowhere in the reading.
load([
    'ch 7',
    'Row 2: 6 sc',
    'Row 3: inc x 6 (12)'
].join('\n'));
ck('the foundation row still passes', $('step-sequence-body').children[0].children[5].innerHTML.indexOf('FAIL'), -1);
ck('the row worked back into it passes too',
   $('step-sequence-body').children[1].children[5].innerHTML.indexOf('FAIL'), -1);
ck('with the 1 chain it skipped', $('step-sequence-body').children[1].children[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(/\s/)[0], '6');
ok('and the reading is disclosed', /Starting chains skipped:[\s\S]{0,40}<strong>1<\/strong>/.test(panel()));
// The pattern itself never says which chain Row 2 starts in - that is a real gap in what was
// written, not just a number the app worked out - so Row 1 carries its own warning about it, distinct
// from the health-panel notice above (which reports what the reading settled on, not that the reading
// was needed at all).
var row1Status = $('step-sequence-body').children[0].children[5].innerHTML;
ok('Row 1 warns that the skip is assumed', /how many chains the next row skips/.test(row1Status));
ok('and offers both fixes', /2nd ch from hook/.test(row1Status) && /combine this chain/.test(row1Status));
no('the row it warns about is not itself marked FAIL', /FAIL/.test(row1Status));
// Row 2, which the warning is ABOUT, carries no such note itself - the fact belongs to the chain
// above it, not to the row spending it.
no('Row 2 does not repeat the warning',
   /how many chains the next row skips/.test($('step-sequence-body').children[1].children[5].innerHTML));

endSuite();
