boot();

var E = CrochetMathEngine;
function load(text) { $('bulk-input').value = text; $('bulk-parse-btn').fire('click'); }
function body() { return $('step-sequence-body').children; }
function classes() { return body().map(function (tr) { return tr.className; }); }
function cell(tr, i) { var c = tr.children[i]; return ((c.innerHTML || '') + (c.textContent || '')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function calc(r) { return cell(body()[r], 4).split(' ')[0]; }
function reset() { $('new-file-btn').fire('click'); }

// Reading a pattern as it is actually published: wrapped into columns, with the front matter, the
// abbreviation list and the copyright line still attached.

print('\n1. Wrapped lines are rejoined into rows');
reset();
// Four instructions spread over ten physical lines, exactly as the column breaks leave them. Lifted from
// the Kingbird cardigan.
load('BODY\n'
   + 'Row 1 (RS): With B, dc in 3rd ch from hook (2 skipped ch do not count as a\n'
   + 'st) and in each ch across – you will have 95 sts in\n'
   + 'this row.\n'
   + 'Row 2: With B, ch 2 (does not count as a st in this row and in all following\n'
   + 'rows), turn, hdc in each st across.\n'
   + 'Row 3: With B, ch 2, turn, hdc in each st across, and keep going to the end\n'
   + 'of the row.\n'
   + 'Row 4: With B, ch 2, turn, hdc in each st across; leave rem sts unworked for\n'
   + 'back and left front.');
ck('ten lines make four rows', classes().filter(function (c) { return /^row-/.test(c); }).length, 4);
ok('and no fragment is a row of its own',
   !body().some(function (tr) { return tr.children.length > 1 && /^this row|^of the row/.test(cell(tr, 1)); }));

print('\n2. A pattern typed one row per line is left alone');
reset();
// The reflow must not fire here. Lowercase and unlabelled is the shape most likely to look wrapped by any
// shallow measure, so it is the one worth pinning.
load('ch 20\nsc in each ch across\nch 1, turn\nsc in each st across');
ck('four lines stay four rows', body().length, 4);
reset();
load('Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)\nRow 2: ch 1, turn, sc in each st across (24)');
ck('labelled rows stay separate', body().length, 2);
ck('and still validate', calc(1), 24);

print('\n3. Text that makes no fabric becomes a note, and never blocks');
reset();
load('BODY\n'
   + 'Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)\n'
   + '©2024 Lion Brand Yarn Company, all rights reserved.\n'
   + 'For thousands of free patterns, visit our website www.LionBrand.com\n'
   + 'Move neck shaping marker as each row is worked.\n'
   + 'Row 2: ch 1, turn, sc in each st across (20)');
ck('three lines are notes', classes().filter(function (c) { return c === 'note-row'; }).length, 3);
ck('nothing failed', classes().filter(function (c) { return c === 'row-failed'; }).length, 0);
ck('nothing blocked', classes().filter(function (c) { return c === 'row-blocked'; }).length, 0);
// The point of the whole thing: a note between two rows is invisible to the count.
ck('the row after the notes still counts from the row before', calc(body().length - 1), 20);

print('\n4. A labelled row is work whatever it says');
// The one thing the classifier must not do. If prose swallowed a mistyped stitch the count would be wrong
// with nothing shown, which is worse than a failure.
ck('a misspelled stitch under a row label is work', E.classifyPatternLine('Row 4: dubble crochet in each st across').kind, 'work');
ck('and an unlabelled line with stitches is work', E.classifyPatternLine('sc in each st across').kind, 'work');
ck('a bare foundation chain is work', E.classifyPatternLine('Ch 20').kind, 'work');
ck('assembly is not', E.classifyPatternLine('Sew shoulder seams.').kind, 'note');
reset();
load('Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)\nRow 2: dubble crochet in each st across');
ck('and it still fails on the page', classes()[1], 'row-failed');

print('\n5. Colourwork letters');
reset();
// The foundation row of every piece in a colourwork pattern. Recognised on first paste, before anything is
// entered in the dictionary.
ck('"With A, ch 146" reads with an empty dictionary', E.parseInstructions('With A, ch 146').unknownTokens.length, 0);
ck('"and change to B in last dc" reads', E.parseInstructions('and change to B in last dc').unknownTokens.length, 0);
ck('"Join C with sl st in seam" reads', E.parseInstructions('Join C with sl st in seam').unknownTokens.length, 0);
// A bare "a" after "with" is only a colour at a clause break. Here it is the English article, and eating
// it would stop the joining slip stitch being recognised.
ck('"join with a sl st in first sc" counts nothing', E.parseInstructions('join with a sl st in first sc').totalYield, 0);
ck('a named colour reads once registered',
   (E.addColorCode('A', 'Creamsicle'), E.parseInstructions('With Creamsicle, ch 146').unknownTokens.length), 0);
ck('the code is stored uppercase', Object.keys(E.COLOR_CODES).join(','), 'A');
ck('a code must be a letter', E.addColorCode('teal', 'Teal').success, false);
E.removeColorCode('A');
ck('and removing it empties the dictionary', Object.keys(E.COLOR_CODES).length, 0);

print('\n6. A gauge statement fills the gauge calculator');
reset();
load('GAUGE\n9 hdc + 8 rows = about 4 in. (10 cm).\nBE SURE TO CHECK YOUR GAUGE.');
ck('stitches', $('gauge-stitches').value, 9);
ck('rows', $('gauge-rows').value, 8);
ck('a swatch stated once is square', $('gauge-width').value + '×' + $('gauge-height').value, '4×4');
ck('unit', $('gauge-unit').value, 'in');
ck('and the gauge line is not validated', classes()[1], 'note-row');
// Half a gauge is still worth having, and the half that is not a stitch count must not become one: a
// ripple is not a stitch.
var ripple = E.parseGaugeStatement('1 ripple = about 3 in. (7.5 cm), measured from peak to peak; 11 rows = about 5 in. (12.5 cm)');
ck('rows read from a ripple gauge', ripple.rows, 11);
ck('and no stitch count invented', ripple.stitches, undefined);
reset();
$('gauge-stitches').value = '16';
load('GAUGE\n9 hdc + 8 rows = about 4 in. (10 cm).');
ck('a measured stitch count is never overwritten', $('gauge-stitches').value, 16);
ck('but the empty fields still fill', $('gauge-rows').value, 8);

print('\n7. A pattern stitch is read from its own definition');
reset();
E.clearPatternStitches();
var RIPPLE = 'hdc2tog, hdc in next 3 sts, 2 hdc in each of next 2 sts, hdc in next 3 sts, hdc2tog';
var added = E.addPatternStitch('Ripple Pattern', RIPPLE, { multiple: 12 });
ck('priced from the repeat', added.cost + '/' + added.yield, '12/12');
// The designer states the multiple as well. Two figures agreeing is what makes it safe to take
// automatically - and disagreeing, neither is trustworthy.
ck('a stated multiple that disagrees is refused', E.addPatternStitch('Bad', RIPPLE, { multiple: 10 }).success, false);
ck('the name line parses', JSON.stringify(E.parsePatternStitchName('Ripple Pattern (worked over a multiple of 12 sts)')),
   '{"name":"Ripple Pattern","multiple":12}');
ck('"over next 60 sts" costs 60 and makes 60', E.evaluateStep(0, 60, 'work in Ripple pattern as established over next 60 sts', 1, 0).calculatedYield, 60);
ck('"to last 5 sts" leaves the last 5',
   E.evaluateStep(0, 70, 'Ch 2 (does not count as a st), turn, hdc in first 5 sts, work in Ripple pattern as established to last 5 sts, hdc in last 5 sts', 1, 0).calculatedYield, 70);
E.clearPatternStitches();
ck('and without the definition the row is not guessed at',
   E.parseInstructions('work in Ripple pattern as established over next 60 sts').unknownTokens.length > 0, true);

print('\n8. Row labels published patterns actually use');
ok('Row 1 (RS):', E.looksLikeRowLabel('Row 1 (RS):'));
ok('Row 3 (Decrease Row):', E.looksLikeRowLabel('Row 3 (Decrease Row):'));
ok('Next 4 Rnds:', E.looksLikeRowLabel('Next 4 Rnds:'));
ok('Last Row', E.looksLikeRowLabel('Last Row'));
ok('2nd Round.', E.looksLikeRowLabel('2nd Round.'));
// "56 rows in Body Stripe Sequence." is prose. Read as a label for row 56 it tears the sentence off the
// line above and validates the remains as a row.
ok('but "56 rows in Body Stripe Sequence." is not', !E.looksLikeRowLabel('56 rows in Body Stripe Sequence.'));
reset();
load('Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)\nRow 2 (RS): ch 1, turn, sc in each st across (20)');
ck('the side marker does not leak into the instruction', /RS/.test(cell(body()[1], 1)), false);
ck('and the row still counts', calc(1), 20);

print('\n9. Right and wrong side');
ck('(RS) counts nothing', E.parseInstructions('(RS)').totalYield, 0);
ck('from RS', E.parseInstructions('From RS, sc in each st across').unknownTokens.length, 0);
ck('with RS facing you', E.parseInstructions('with RS facing you, sc in each st across').unknownTokens.length, 0);
ck('rightside', E.parseInstructions('rightside').unknownTokens.length, 0);
ck('wrongside', E.parseInstructions('wrongside').unknownTokens.length, 0);

print('\n9b. "beg" names the first stitch or space, not a stitch of its own');
// It has no cost or yield of its own - "3 dc in beg ch-sp" spends nothing on "beg", the ch-sp is what is
// worked into. Bare, it used to fail as an unknown token.
ck('bare "beg" counts nothing and is not unknown', E.parseInstructions('beg').totalYield, 0);
ck('and does not fail', E.parseInstructions('beg').unknownTokens.length, 0);
ck('"beginning" too', E.parseInstructions('beginning').unknownTokens.length, 0);
ck('as its own segment among real stitches', E.parseInstructions('sc, beg, dc').unknownTokens.length, 0);
ck('naming the first chain space', E.parseInstructions('3 dc in beg ch-sp').unknownTokens.length, 0);
ck('naming the top of a foundation chain', E.parseInstructions('dc in top of beg ch-3').unknownTokens.length, 0);
// The vintage repeat-from-beginning feature depends on this literal phrase surviving into
// expandRepeatFromBeginning, which runs after this strip - "beg" must not be eaten out from under it.
var repeatFromBeg = 's c in next s c, 2 s c in next s c, repeat from beg all around';
ck('"repeat from beg" still drives the vintage repeat', E.evaluateStep(0, 40, repeatFromBeg, 1, 0).calculatedYield, 60);
ck('"rep from the beginning" too',
   E.evaluateStep(0, 40, 's c in next s c, 2 s c in next s c, rep from the beginning all around', 1, 0).calculatedYield, 60);
// And the definition itself, in an abbreviation list, is untouched.
ck('"beg = begin(ning)" is left whole', E.parseAbbreviationEntry('beg = begin(ning)').term, 'beg');

print('\n10. A turning chain the pattern says is not a stitch');
// It opens nearly every row of a modern garment pattern, and counting it put every row two stitches over.
ck('in rows', E.evaluateStep(0, 20, 'Ch 2 (does not count as a st), turn, hdc in each st across', 1, 0).calculatedYield, 20);
ck('in rounds', E.evaluateStep(0, 34, 'Ch 2 (does not count as a st in this rnd), hdc in each st around', 1, 0).calculatedYield, 34);
// A chain the pattern says DOES stand in for a stitch is now counted as that one stitch rather than as its
// three chains - three tall, one wide. This assertion was pinned at 23 so that changing it would be a
// decision; it was.
ck('a chain that counts as a stitch is worth one stitch', E.evaluateStep(0, 20, 'Ch 3 (counts as dc), turn, dc in each st across', 1, 0).calculatedYield, 21);

print('\n11. A foundation chain written on its own line');
// "With B, ch 97." then "Row 1 (RS): dc in 3rd ch from hook and in each ch across". The chain is on the
// line before, so the row has to take its count from there.
ck('the row works the whole chain', E.evaluateStep(0, 97, 'dc in 3rd ch from hook and in each ch across', 1, 0).calculatedYield, 95);
ok('and reports valid', E.evaluateStep(0, 97, 'dc in 3rd ch from hook and in each ch across', 1, 0).costIsValid);
ck('the combined form is unchanged', E.evaluateStep(0, 0, 'ch 25, sc in 2nd ch from hook and in each ch across', 1, 0).calculatedYield, 24);

print('\n12. An abbreviation list only files what the rows needed');
reset();
localStorage.setItem('stitchmath_custom_stitches', '{}');
load('ABBREVIATIONS\n'
   + 'beg = begin(ning)\n'
   + 'rep = repeat\n'
   + 'zigzag = a stitch this pattern made up\n'
   + '\nBODY\n'
   + 'Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)\n'
   + 'Row 2: ch 1, turn, zigzag in each st across');
var filed = JSON.parse(localStorage.getItem('stitchmath_custom_stitches') || '{}');
ok('the made-up stitch the rows used is filed', filed.zigzag);
ok('"beg" is not - it is a word, not a stitch', !filed.beg);
ok('nor "rep"', !filed.rep);
// A definition says what a stitch is, never how many it takes or makes. Guessing would be a wrong count
// presented as a right one.
ck('and it is filed without a cost', filed.zigzag && filed.zigzag.cost, null);
ck('so the row that uses it still fails', classes()[classes().length - 1], 'row-failed');

endSuite();
