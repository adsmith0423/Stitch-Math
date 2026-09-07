boot();

var E = window.CrochetMathEngine;

function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function text() { return $('bulk-input').value; }
function tally() { return $('lint-side-tally').textContent; }

// The class actually carried by the copy of line N. This is the assertion that matters: a suggestion
// counted in the sidebar but underlined on the wrong row is worse than no underline at all, and a
// tally-only check passes either way.
function cue(i) {
    var span = $('lint-mirror').children[i];
    return span ? span.className.replace('lint-line', '').trim() : '(no line)';
}
function mirrored(i) {
    var span = $('lint-mirror').children[i];
    return span ? span.textContent : '(no line)';
}
function item(i) { return $('lint-item-' + i); }
// The buttons actually offered on a card. Read off the element rather than by id: the stub's
// getElementById CREATES anything it is asked for, so `!!$('lint-side-0-apply-1')` is true whether the
// button was rendered or not, and an assertion written that way cannot fail.
function actions(el) {
    if (!el || !el.children.length) return '';
    var last = el.children[el.children.length - 1];
    return last.children.map(function (b) { return b.textContent; }).join(',');
}
function itemActions(i) { return actions(item(i)); }
// The flattened text of one sidebar entry, for reading its title and its diff.
function itemText(i) {
    var el = item(i);
    if (!el || !el.children.length) return '';
    return el.children.map(function (c) {
        return c.children.length
            ? c.children.map(function (g) { return g.textContent; }).join(' ~ ')
            : c.textContent;
    }).join(' | ');
}

print('\n1. The engine hands back edits, not only sentences');
// buildFixes reads the same diagnosis context buildResolutions does, so the linter cannot offer a
// correction the matrix has not already explained.
var repeatFix = E.evaluateStep(0, 8, '[sc, inc] x 3', 1, 9, 0, 0).fixes;
ck('a short repeat produces one fix', repeatFix.length, 1);
ck('flagged as arithmetic', repeatFix[0].severity, 'math');
ck('and it names the number in the text', repeatFix[0].edit.target, 'multiplier');
ck('from the count the row states', repeatFix[0].edit.from, 3);
ck('to the one it has stitches for', repeatFix[0].edit.to, 4);

var countFix = E.evaluateStep(0, 12, 'sc in each st across', 1, 10, 0, 0).fixes;
ck('a written count that disagrees is a fix too', countFix[0].edit.target, 'statedCount');
ck('rewriting 10', countFix[0].edit.from, 10);
ck('to the 12 the stitches make', countFix[0].edit.to, 12);

var bracketFix = E.evaluateStep(0, 8, '[sc, inc x 3', 1, 9, 0, 0).fixes;
ck('an unclosed bracket is a syntax fix', bracketFix[0].severity, 'syntax');
ck('repaired by inserting the closer', bracketFix[0].edit.target, 'insert');
ck('which is the "]" it opened with', bracketFix[0].edit.text, ']');

// The row was read as best it could be, so its total came from a partial reading of the text.
// Offering to write that total into the pattern would replace a note that says "check this" with a
// number that is wrong - and buildResolutions already refuses to give deficit advice for the same
// reason after an unknown token.
ck('and no count fix rides along with it', bracketFix.length, 1);

print('\n2. An unknown term is advice, never an edit');
var unknownFix = E.evaluateStep(0, 8, 'frobnicate 8', 1, 8, 0, 0).fixes;
ck('the unknown term is reported', unknownFix.length, 1);
ck('as a syntax finding', unknownFix[0].severity, 'syntax');
// Guessing which stitch a designer meant and rewriting it silently is a worse failure than the
// underline it would replace.
ck('with nothing to apply', String(unknownFix[0].edit), 'null');

print('\n3. Notation faults carry a position, so a repair can be located');
var faults = E.notationFaults('[sc, inc) x 3');
ck('the mismatched closer is found', faults[0].kind, 'mismatched');
ck('it names the character', faults[0].char, ')');
ck('and which one it is', faults[0].occurrence, 0);
ck('and what belonged there', faults[0].expected, ']');

print('\n4. The cue lands on the row it belongs to');
load(['Ch 12 (12)', 'Row 2: sc in each st across (10)']);
ck('one suggestion is counted', tally(), '1 suggestion available');
ck('the foundation row is left alone', cue(0), '');
ck('and the row that miscounts is waved in coral', cue(1), 'lint-mark-math');

print('\n5. A phrasing fault reads teal, not coral');
load(['Ch 8 (8)', 'Row 2: [sc, inc x 3 (9)']);
ck('the unclosed bracket is a syntax cue', cue(1), 'lint-mark-syntax');
load(['Ch 8 (8)', 'Row 2: frobnicate 8 (8)']);
ck('so is an unknown term', cue(1), 'lint-mark-syntax');

print('\n6. Blank lines do not shift the cues');
// splitPatternLines drops blanks and joins wrapped fragments, so position in the step list says
// nothing about position in the box. Every step carries the raw line it came from instead.
load(['Ch 12 (12)', '', 'Row 2: sc in each st across (10)', '']);
ck('the copy has a line for every line typed', $('lint-mirror').children.length, 4);
ck('including the empty ones', mirrored(1), '');
ck('the blank line is not marked', cue(1), '');
ck('and the fault is on line 3, not line 2', cue(2), 'lint-mark-math');
ck('with nothing on the line above it', cue(0), '');

print('\n7. One line that becomes several rows still gets one suggestion');
// "Rows 2-4" is one line the parser expands into three steps. All three report the same fault about
// the same text, and three identical entries for one line is not what the writer needs to see.
load(['Ch 10 (10)', 'Rows 2-4: sc in each st across (8)']);
ck('the three rows report one finding', tally(), '1 suggestion available');
ck('on the single line that produced them', cue(1), 'lint-mark-math');

print('\n8. Accepting a fix rewrites the line and re-validates it');
load(['Ch 12 (12)', 'Row 2: sc in each st across (10)']);
ok('the sidebar offers the correction', /missing|more than/.test(itemText(0)));
ok('and shows what it would become', /\(12\)/.test(itemText(0)));
$('lint-side-0-apply-1').fire('click');
ck('the line is corrected in place', text(), 'Ch 12 (12)\nRow 2: sc in each st across (12)');
// Straight back through handleBulkSubmit, so an accepted fix is read exactly like a typed one.
ck('and nothing is left to suggest', tally(), 'No suggestions');
ck('the cue is gone with it', cue(1), '');

print('\n9. The row label survives the correction');
// The edit is applied to the line as written, not to a line rebuilt from the parsed step - which is
// what the inline editor does, and why it drops "Row 2:".
load(['Ch 8 (8)', 'Row 2: [sc, inc] x 3 (9)']);
$('lint-side-0-apply-1').fire('click');
ok('the repeat count is the only thing that moved', /^Row 2: \[sc, inc\] x 4 \(9\)$/.test(text().split('\n')[1]));

print('\n10. Ignore clears the cue and leaves the text alone');
load(['Ch 12 (12)', 'Row 2: sc in each st across (10)']);
var before = text();
$('lint-side-0-ignore-1').fire('click');
ck('the suggestion is gone', tally(), 'No suggestions');
ck('and so is the underline', cue(1), '');
// The whole contract of Ignore: the pattern is untouched.
ck('the pattern is byte-for-byte what it was', text(), before);

print('\n11. A dismissal belongs to the file it was made against');
$('new-file-btn').fire('click');
load(['Ch 12 (12)', 'Row 2: sc in each st across (10)']);
ck('the same fault is raised again on a new file', tally(), '1 suggestion available');

print('\n12. Accept all works bottom-up, one edit per line');
load([
    'Ch 12 (12)',
    'Row 2: sc in each st across (10)',
    'Row 3: sc in each st across (11)'
]);
ck('both rows are flagged', tally(), '2 suggestions available');
ck('row 2 is waved', cue(1), 'lint-mark-math');
ck('row 3 as well', cue(2), 'lint-mark-math');
$('lint-accept-all').fire('click');
ck('both counts are corrected in one press', text(),
    'Ch 12 (12)\nRow 2: sc in each st across (12)\nRow 3: sc in each st across (12)');
ck('and the pattern is clean', tally(), 'No suggestions');

print('\n13. Reject all dismisses without writing');
load([
    'Ch 12 (12)',
    'Row 2: sc in each st across (10)',
    'Row 3: sc in each st across (11)'
]);
var untouched = text();
$('lint-reject-all').fire('click');
ck('every suggestion is cleared', tally(), 'No suggestions');
ck('and the pattern is unchanged', text(), untouched);

print('\n14. The tooltip opens against the line the caret is on');
$('new-file-btn').fire('click');
load(['Ch 12 (12)', 'Row 2: sc in each st across (10)']);
// The cue sits behind the textarea and can never be clicked, so the caret is what says which line
// the reader means.
$('bulk-input').selectionStart = text().indexOf('Row 2') + 3;
$('bulk-input').fire('click');
no('the card is open', $('lint-tip').classList.contains('hidden'));
ok('and it names the row in plain words', /stitches/.test($('lint-tip').children.map(function (c) {
    return c.textContent || '';
}).join(' ')));
ck('with a fix to accept and a way to dismiss it', actions($('lint-tip')), 'Suggest a fix,Ignore');

// A caret on a line with nothing to say closes the card rather than leaving a stale one open.
$('bulk-input').selectionStart = 2;
$('bulk-input').fire('click');
ok('a clean line closes the card', $('lint-tip').classList.contains('hidden'));

print('\n15. The sidebar collapses without losing the count');
load(['Ch 12 (12)', 'Row 2: sc in each st across (10)']);
ok('it starts collapsed', $('lint-side').classList.contains('is-collapsed'));
$('lint-side-toggle').fire('click');
no('opening it clears the rail', $('lint-side').classList.contains('is-collapsed'));
ck('and the tally is still the tally', tally(), '1 suggestion available');
$('lint-side-toggle').fire('click');
ok('and it collapses again', $('lint-side').classList.contains('is-collapsed'));

print('\n16. An empty pattern says so');
$('new-file-btn').fire('click');
ck('no pattern, no suggestions', tally(), 'No suggestions');
ck('and no cues', $('lint-mirror').children.length, 1);

print('\n17. A failure does not hide the rows under it');
// Row 2 does not balance, which blocks Rows 3 and 4 in the matrix. The linter still reads them: a
// blocked row is one whose INPUT count is provisional, not one nobody has parsed.
$('new-file-btn').fire('click');
load([
    'Ch 12 (12)',
    'Row 2: sc in 6 sts (6)',
    'Row 3: [sc, inc x 3 (9)',
    'Row 4: sc in each st across (5)'
]);
ck('all three rows are reported', tally(), '3 suggestions available');
ck('the row that fails is marked', cue(1), 'lint-mark-math');
ck('the blocked row with bad punctuation too', cue(2), 'lint-mark-syntax');
ck('and the blocked row that miscounts', cue(3), 'lint-mark-math');

print('\n18. The cause is reported before its symptoms');
// The row that blocks the rest used to be the one thing the linter said nothing about: an
// under-consuming row has no single safe edit, so it produced no fix and no cue at all.
ck('the first entry is the failing row', item(0).children[0].textContent, 'Row 2');
ok('it says what does not balance', /works 6 of the 12 stitches below it/.test(itemText(0)));
ok('and hands over the engine\'s own advice', /Extend this row by 6, or reduce the previous row to 6/.test(itemText(0)));
// "Extend this row, or shrink the one above" is a choice, and a button cannot make it.
ck('with nothing to press but Ignore', itemActions(0), 'Ignore');

print('\n19. What a blocked row says about its own text is trusted');
// An unclosed bracket is true whatever happens above it, so the repair applies with no caveat.
ok('the bracket repair is offered in full', /never closes/.test(itemText(1)));
ck('and can be taken', itemActions(1), 'Suggest a fix,Ignore');
no('with no dependency to warn about', /Counted from before/.test(itemText(1)));

print('\n20. Its arithmetic says what it is resting on');
// Row 4 was measured against the last count actually produced, which is not the count it will be
// worked into once Row 2 is fixed.
ok('the count fix is still offered', /makes 7 stitches more than the 5 it states/.test(itemText(2)));
ok('and names the row it depends on', /Counted from before Row 2, which does not add up yet/.test(itemText(2)));
ck('it can still be taken one at a time', itemActions(2), 'Suggest a fix,Ignore');

print('\n21. But a bulk accept leaves the dependent ones alone');
// Accept all is the one action where no diff is read before it is written, so it takes only the
// corrections that stand on their own.
var beforeBatch = text();
$('lint-accept-all').fire('click');
ck('the bracket is closed', text().split('\n')[2], 'Row 3: [sc, inc x 3] (9)');
ck('and the dependent count is untouched', text().split('\n')[3], beforeBatch.split('\n')[3]);

print('\n23. A style suggestion reads gold, not coral or teal');
// The Row-1 assumed-skip disclosure, ported from a plain note into a real finding: "Ch 7" alone,
// answered only by the row below stating a bare count. The edit lands on Row 2, the line it actually
// rewrites - not Row 1, which never changes.
$('new-file-btn').fire('click');
load(['ch 7', 'Row 2: 6 sc', 'Row 3: inc x 6 (12)']);
ck('one suggestion is counted', tally(), '1 suggestion available');
ck('the bare chain itself carries no cue', cue(0), '');
ck('the row it warns about is waved gold', cue(1), 'lint-mark-style');
ck('and the row after is unaffected', cue(2), '');

print('\n24. The card teaches, it does not only correct');
ok('it says what is being assumed', /assumption/.test(itemText(0)));
ok('and offers the standardized rewrite', /sc in 2nd ch from hook, 5 sc/.test(itemText(0)));
ok('with the general lesson attached', /translations|screen readers/.test(itemText(0)));
ck('under its own button, not the math/syntax one', itemActions(0), 'Accept Suggested Formatting,Ignore');

print('\n25. Accepting it rewrites the line and clears itself');
$('lint-side-0-apply-1').fire('click');
ck('Row 2 now states its own start', text(),
   'ch 7\nRow 2: sc in 2nd ch from hook, 5 sc\nRow 3: inc x 6 (12)');
ck('and the pattern is clean throughout', tally(), 'No suggestions');

print('\n26. An unrecognised stitch still teaches, with nothing to press but Ignore');
// ldc is a real stitch (linked dc, cost 1) but not one the standing-chain-height table covers, so the
// guess refuses rather than invents a number - the same unconfident 0 an ordinary un-flagged row
// already gets. Chosen at 6 chains rather than 7 so that refusal still balances the row: this isolates
// the style finding on its own, with no arithmetic fault riding along to complicate the assertion.
$('new-file-btn').fire('click');
load(['ch 6', 'Row 2: 6 ldc', 'Row 3: inc x 6 (12)']);
ck('exactly the one finding', tally(), '1 suggestion available');
ck('waved gold, not coral', cue(1), 'lint-mark-style');
ok('it says the assumption plainly, with no stitch to name',
   /which chain the next row starts in/.test(itemText(0)));
ck('but there is nothing to auto-write for it', itemActions(0), 'Ignore');

print('\n27. The shipped Row 1 note and the new style fix coexist');
// The plain-language disclosure in the matrix (evaluation.notes, tested in test-inference.js) and this
// linter finding (evaluation.fixes) are two different systems reading the same underlying signal -
// one replacing the other would be a regression neither suite alone would catch.
$('new-file-btn').fire('click');
load(['ch 7', 'Row 2: 6 sc', 'Row 3: inc x 6 (12)']);
ck('the linter still finds it', tally(), '1 suggestion available');
ok('and the matrix note is unaffected by it existing',
   /how many chains the next row skips/.test($('step-sequence-body').children[0].children[5].innerHTML));

print('\n28. Mixed severity on one line reads as the more urgent of the two');
// Row 2 carries both findings at once here: the assumed-skip style suggestion (its count is genuinely
// unstated) and a stated count that disagrees with what the stitches add up to. The line must read
// as the arithmetic fault, not whichever finding happened to be pushed onto it first.
$('new-file-btn').fire('click');
load(['ch 7', 'Row 2: 6 sc (7)', 'Row 3: inc x 6 (12)']);
ck('two findings land on the one line', tally(), '2 suggestions available');
ck('and it reads coral, not gold', cue(1), 'lint-mark-math');

print('\n29. Repeat shorthand, spelled out');
// The long form names every position outright instead of leaving it to the brackets.
ck('the motivating example', E.buildRepeatPhrasing('2 sc, inc', 6),
   '*sc in next 2 sts, 2 sc in next st; rep from * 5 more times');
ck('a single-stitch clause stays singular', E.buildRepeatPhrasing('sc, inc', 6),
   '*sc in next st, 2 sc in next st; rep from * 5 more times');
// Chains consume no stitches, so there are no positions to name and "ch 1" is already explicit.
ck('a chain is left as written', E.buildRepeatPhrasing('dc, ch 1', 12),
   '*dc in next st, ch 1; rep from * 11 more times');
ck('a decrease names the positions it takes together', E.buildRepeatPhrasing('sc2tog, 2 sc', 6),
   '*sc2tog over next 2 sts, sc in next 2 sts; rep from * 5 more times');
// The stitch an increase doubles comes from the row it sits in when the abbreviation names none.
ck('a bare inc borrows the row\'s own stitch', E.buildRepeatPhrasing('2 hdc, inc', 6),
   '*hdc in next 2 sts, 2 hdc in next st; rep from * 5 more times');
ck('and takes its own where it has one', E.buildRepeatPhrasing('2 sc, hdc inc', 6),
   '*sc in next 2 sts, 2 hdc in next st; rep from * 5 more times');

print('\n30. ...and everything it refuses to rewrite');
// Nothing in the bracket says which stitch is doubled, so spelling it out would invent one.
ck('a bare inc with no stitch to borrow', E.buildRepeatPhrasing('inc, inc', 6), null);
// A clause that already states its target is specific about a position, and rewriting around it
// risks moving that position - one unreadable clause abandons the whole line.
ck('a clause that names its own target', E.buildRepeatPhrasing('3 dc in same st, sk 1', 9), null);
ck('an unknown stitch', E.buildRepeatPhrasing('frobnicate, sc', 6), null);
ck('a repeat that runs once', E.buildRepeatPhrasing('sc, inc', 1), null);
// "2 sc2tog" is two decreases over four positions; "sc2tog over next 4 sts" would be one decrease
// taking four together, which is a different stitch.
ck('a multiplied decrease', E.buildRepeatPhrasing('2 sc2tog', 6), null);

print('\n31. The rewrite is checked against the parser, not trusted');
// The whole guarantee: a standardization must change the wording and nothing else. Each pair is read
// back through the tokenizer and must agree on both stitches consumed and stitches produced.
['[2 sc, inc] x 6', '[dc, ch 1] x 12', '[pc, ch 1, sk 1] x 12', '[sc2tog, 2 sc] x 6',
 '[fpdc, bpdc] x 12', '[dc, ch 2, sk 2] x 8'].forEach(function (before) {
    var after = E.standardizeRepeatText(before);
    var a = E.parseInstructions(before, 0);
    var b = E.parseInstructions(after, 0);
    ck('same stitches in and out: ' + before, a.totalCost + '/' + a.totalYield, b.totalCost + '/' + b.totalYield);
});
// The case that shaped the phrasing. "sk 2" is two skips, but the natural plural of "sk next st"
// reads back as ONE - only a count sitting against the abbreviation is multiplied - so the phrasing
// has to be the form the parser agrees with, and the check is what caught it.
ok('a plural skip keeps its count', /sk 2 sts/.test(E.standardizeRepeatText('[dc, ch 2, sk 2] x 8')));

// A chain-only body used to be refused here, because expandAsteriskRepeats sized "rep from * N more
// times" as N passes for a costless body and N+1 for one holding a worked stitch. That was a real
// bug in the expander rather than anything about phrasing, and it is fixed - see test-repeat.js §7.
// Pinned from this side too: the rewrite this feature offers is only correct because that is.
ck('a chain-only repeat now rewrites', E.buildRepeatPhrasing('ch 2', 6),
   '*ch 2; rep from * 5 more times');
ck('a chain beside a stitch as well', E.buildRepeatPhrasing('dc, ch 2', 6),
   '*dc in next st, ch 2; rep from * 5 more times');

// The check's own second catch, fixed at source rather than left to it: picot makes no countable
// stitch AND takes no position, so reading every zero-yield entry as a skip rewrote a decoration
// into an instruction to miss a stitch. Only sk/skip are skips; the rest are refused.
ck('a picot is not rewritten as a skip', E.buildRepeatPhrasing('picot, sc', 6), null);
ck('while a real skip still is', E.buildRepeatPhrasing('sk 1, sc', 6),
   '*sk next st, sc in next st; rep from * 5 more times');

print('\n31b. ...and that holds for every stitch in the dictionary');
// The strongest form of the guarantee, and the reason it is swept rather than sampled: both of the
// divergences above were found this way and neither was in a hand-picked list. Every clause the
// generator will accept, single and paired, is read back through the tokenizer - if a phrasing
// branch is ever added that the parser disagrees with, this fails whether or not anyone thought to
// write a case for it.
var swept = 0, bad = [];
Object.keys(E.STITCH_PRIMITIVES).forEach(function (k) {
    [1, 2].forEach(function (n) {
        ['', ', sc'].forEach(function (tail) {
            var body = (n > 1 ? n + ' ' : '') + k + tail;
            var out = E.buildRepeatPhrasing(body, 6);
            if (out === null) return;          // refused is always safe
            swept++;
            var a = E.parseInstructions('[' + body + '] x 6', 0);
            var b = E.parseInstructions(out, 0);
            if (a.totalCost !== b.totalCost || a.totalYield !== b.totalYield) bad.push(body + ' -> ' + out);
        });
    });
});
ok('a broad sweep actually ran', swept > 300);
ck('every accepted rewrite preserves the stitches', bad.join(' | '), '');

print('\n32. What must never be read as a repeat');
// A bare number in brackets at the end of a row is a stated stitch count, and a comma-list is a size
// run. Reading either as a repeat would rewrite a number the pattern meant as an answer.
ck('a stated count', E.standardizeRepeatText('Row 5: [sc, inc] (18)'), null);
ck('a size list', E.standardizeRepeatText('Row 4: dc x 6 (8, 10)'), null);
ck('a row with no repeat at all', E.standardizeRepeatText('Row 2: sc in each st across (24)'), null);
// A group holding a group is left alone whole rather than read half-way and rebuilt wrong.
ck('a nested group', E.standardizeRepeatText('Row 6: [(3 dc, ch 2, 3 dc) in next sp, sc] x 4'), null);

print('\n33. Raised once for the pattern, not once per row');
// Bracket shorthand is correct and used consistently by the patterns that use it at all, so a card on
// every repeat row would be a preference pushed over and over rather than a convention pointed out.
$('new-file-btn').fire('click');
load(['Ch 12 (12)',
      'Row 2: [sc, inc] x 6 (18)',
      'Row 3: [2 sc, inc] x 6 (24)',
      'Row 4: [fpdc, bpdc] x 12 (24)']);
ck('three repeat rows, one suggestion', tally(), '1 suggestion available');
ck('on the first of them', cue(1), 'lint-mark-style');
no('and not on the ones after', cue(2) || cue(3));
ok('the card teaches the convention', /bracket shorthand/.test(itemText(0)));
ok('with the lesson attached', /beginner-friendly/.test(itemText(0)));

print('\n34. Standardize All answers for the whole pattern');
// The writer is being asked about a convention for the pattern, so the answer applies to the pattern
// - "Accept all" would spell out only the row the card happens to sit on.
ck('the bulk action counts every rewritable row', $('lint-standardize-all').textContent, 'Standardize All (3)');
$('lint-standardize-all').fire('click');
ck('every repeat is spelled out', text(),
   'Ch 12 (12)\n'
   + 'Row 2: *sc in next st, 2 sc in next st; rep from * 5 more times (18)\n'
   + 'Row 3: *sc in next 2 sts, 2 sc in next st; rep from * 5 more times (24)\n'
   + 'Row 4: *fpdc in next st, bpdc in next st; rep from * 11 more times (24)');
ck('and the pattern is clean afterwards', tally(), 'No suggestions');

print('\n35. A single repeat gets no bulk action');
// With one rewritable row "Standardize All" and "Accept all" would do the same thing under two names.
$('new-file-btn').fire('click');
load(['Ch 12 (12)', 'Row 2: [sc, inc] x 6 (18)']);
ck('the suggestion is still raised', tally(), '1 suggestion available');
// Read off the rendered batch row rather than by id - the stub invents any element asked for by id,
// so $('lint-standardize-all') is truthy whether it was built or not.
ck('but the bulk button is not offered',
   $('lint-side-body').children[0].children.map(function (b) { return b.textContent; }).join(','),
   'Accept all (1),Reject all');

print("\n36. Folding back the other way: beginner phrasing to bracket shorthand");
// buildRepeatShorthand is the reverse of §29's buildRepeatPhrasing - same examples, opposite direction.
ck('the motivating example, reversed', E.buildRepeatShorthand('sc in next 2 sts, 2 sc in next st', 6),
   '[2 sc, inc] x 6');
ck('a single-stitch clause stays singular', E.buildRepeatShorthand('sc in next st, 2 sc in next st', 6),
   '[sc, inc] x 6');
ck('a chain is left as written', E.buildRepeatShorthand('dc in next st, ch 1', 12),
   '[dc, ch 1] x 12');
ck('a decrease folds back to its own abbreviation', E.buildRepeatShorthand('sc2tog over next 2 sts, sc in next 2 sts', 6),
   '[sc2tog, 2 sc] x 6');
// The stitch an increase doubles is read off the OTHER clauses in the same body, same as forward.
ck("a bare inc's doubled stitch matches the row's own", E.buildRepeatShorthand('hdc in next 2 sts, 2 hdc in next st', 6),
   '[2 hdc, inc] x 6');
ck('and gets a named abbreviation where it does not', E.buildRepeatShorthand('sc in next 2 sts, 2 hdc in next st', 6),
   '[2 sc, hdc-inc] x 6');
// Every OTHER cost0/yield1 key (unlike ch/chain) only parses as shorthand with the count first, so
// the fold-back has to put it back there rather than leaving the long form's trailing count in place.
ck('a foundation stitch puts its count back in front', E.buildRepeatShorthand('fdc 2', 6), '[2 fdc] x 6');

print("\n36b. ...and that holds for every stitch in the dictionary, both ways");
// §31b's sweep, extended one leg further: every phrasing the forward direction will accept is folded
// back and re-checked against the parser, AND fed back into buildRepeatPhrasing itself - not just
// arithmetically equal, but recognised as real, re-enterable shorthand.
var swept2 = 0, bad2 = [];
Object.keys(E.STITCH_PRIMITIVES).forEach(function (k) {
    [1, 2].forEach(function (n) {
        ['', ', sc'].forEach(function (tail) {
            var body = (n > 1 ? n + ' ' : '') + k + tail;
            var longForm = E.buildRepeatPhrasing(body, 6);
            if (longForm === null) return;
            swept2++;
            var m = longForm.match(/^\*(.+); rep from \* (\d+) more times$/);
            var shorthand = E.buildRepeatShorthand(m[1], parseInt(m[2], 10) + 1);
            if (!shorthand) { bad2.push('refused: ' + body); return; }
            var a = E.parseInstructions('[' + body + '] x 6', 0);
            var b = E.parseInstructions(shorthand, 0);
            if (a.totalCost !== b.totalCost || a.totalYield !== b.totalYield) {
                bad2.push('stitches drifted: ' + body + ' -> ' + shorthand);
            }
            var innerBody = shorthand.slice(1, shorthand.indexOf('] x'));
            if (E.buildRepeatPhrasing(innerBody, 6) === null) {
                bad2.push('not re-enterable: ' + body + ' -> ' + shorthand);
            }
        });
    });
});
ok('a broad sweep actually ran', swept2 > 300);
ck('every fold-back preserves the stitches and re-enters cleanly', bad2.join(' | '), '');

print('\n37. condenseRepeatText answers standardizeRepeatText on every line');
[
    '[2 sc, inc] x 6', '[dc, ch 1] x 12', '[pc, ch 1, sk 1] x 12', '[sc2tog, 2 sc] x 6',
    '[fpdc, bpdc] x 12', '[dc, ch 2, sk 2] x 8'
].forEach(function (shorthand) {
    var beginner = E.standardizeRepeatText(shorthand);
    var back = E.condenseRepeatText(beginner);
    ok('folds back to something', back !== null);
    var a = E.parseInstructions(shorthand, 0);
    var b = E.parseInstructions(back, 0);
    ck('same stitches in and out: ' + shorthand, a.totalCost + '/' + a.totalYield, b.totalCost + '/' + b.totalYield);
});
ck('text with nothing to fold back is left alone', E.condenseRepeatText('Row 2: sc in each st across (24)'), null);

print('\n38. The beginner-phrasing checkbox switches the whole pattern, and switches back');
$('new-file-btn').fire('click');
load(['Ch 12 (12)', 'Row 2: [sc, inc] x 6 (18)', 'Row 3: [2 sc, inc] x 6 (24)']);
no('starts unticked', $('toggle-beginner-phrasing').checked);
$('toggle-beginner-phrasing').checked = true;
$('toggle-beginner-phrasing').fire('change');
ck('every repeat is spelled out', text(),
   'Ch 12 (12)\n'
   + 'Row 2: *sc in next st, 2 sc in next st; rep from * 5 more times (18)\n'
   + 'Row 3: *sc in next 2 sts, 2 sc in next st; rep from * 5 more times (24)');
ck('and the linter agrees nothing is left to suggest', tally(), 'No suggestions');
$('toggle-beginner-phrasing').checked = false;
$('toggle-beginner-phrasing').fire('change');
ck('unticking folds every repeat back to brackets', text(),
   'Ch 12 (12)\nRow 2: [sc, inc] x 6 (18)\nRow 3: [2 sc, inc] x 6 (24)');
// A pattern already in the target format is a no-op, not an error - nothing to change, nothing changes.
var beforeNoop = text();
$('toggle-beginner-phrasing').checked = false;
$('toggle-beginner-phrasing').fire('change');
ck('re-firing the same mode again changes nothing', text(), beforeNoop);

print('\n22. Fixing the cause re-reads everything under it');
$('new-file-btn').fire('click');
load(['Ch 12 (12)', 'Row 2: sc in 6 sts (6)', 'Row 3: sc in each st across (5)']);
ok('the downstream count is provisional', /Counted from before Row 2/.test(itemText(1)));
// Correct the cause by hand, the way a designer would after reading it.
$('bulk-input').value = 'Ch 12 (12)\nRow 2: sc in 12 sts (12)\nRow 3: sc in each st across (5)';
$('bulk-parse-btn').fire('click');
ck('with the cause fixed only one row is left', tally(), '1 suggestion available');
no('and it no longer depends on anything', /Counted from before/.test(itemText(0)));
ck('so a bulk accept will take it', itemText(0).indexOf('(12)') >= 0, true);

endSuite();
