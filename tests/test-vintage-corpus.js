boot();

var E = CrochetMathEngine;
var FIXTURE = JSON.parse(readFile('tests/fixtures-vintage.json'));
var ROWS = FIXTURE.rows.map(function (r) { return r.row; });

// 479 rows lifted verbatim from public-domain American Thread and Spool Cotton pattern books. Unlike the
// hand-written corpora these were not chosen to be parseable, so most of them are not - the point is to
// measure honestly and notice when that measurement moves.
print('\n1. The corpus is real and intact');
ck('rows loaded', ROWS.length, 479);
ok('drawn from several books', Object.keys(FIXTURE.rows.reduce(function (m, r) { m[r.book] = 1; return m; }, {})).length >= 4);
ok('no knitting rows crept in', !ROWS.some(function (l) { return /\bk\s*\d+\b|\bpurl\b|seed st/i.test(l); }));

print('\n2. How much of it the tokenizer can read');
var clean = ROWS.filter(function (l) { return !(E.parseInstructions(l).unknownTokens || []).length; });
var pct = Math.round(clean.length / ROWS.length * 100);
// A floor, not a target. If this drops, something that used to be understood is not any more; if it climbs
// a long way, check the gain is real and not a loosened check. Was 108 (23%) before non-stitch prose was
// catalogued; the rest of the jump came from clearing Windows-1252 OCR escapes out of the fixture, which
// had been merging into numbers - "Row '973 s c" was parsing as 973 stitches.
ck('at least 185 rows read cleanly (currently ' + clean.length + ', ' + pct + '%)', clean.length >= 185, true);
ok('and not implausibly many', clean.length < ROWS.length);

print('\n3. What blocks the rest');
// Prose is no longer the main blocker - the words are still there but the parser reads past them. What
// remains is dominated by two deliberate exclusions: "ending to correspond", not a modern crochet term, and
// pattern-defined stitches (shell, rice, petal), which belong in the custom dictionary.
var blocked = ROWS.filter(function (l) { return (E.parseInstructions(l).unknownTokens || []).length; });
var DEFINED = /\b(shell|rice|petal|leaf|star)\b/i;
var CORRESPOND = /correspond/i;
var byDefined = blocked.filter(function (l) { return DEFINED.test(l); }).length;
var byCorrespond = blocked.filter(function (l) { return CORRESPOND.test(l); }).length;
var byEither = blocked.filter(function (l) { return DEFINED.test(l) || CORRESPOND.test(l); }).length;
ok('"ending to correspond" is a top blocker (' + byCorrespond + ' rows)', byCorrespond > 80);
ok('pattern-defined stitches are the other (' + byDefined + ' rows)', byDefined > 60);
ok('together they account for over half of what is left ('
   + byEither + ' of ' + blocked.length + ')', byEither > blocked.length / 2);

print('\n4. Bulk and single-row input agree');
// The two ways into the app must produce the same arithmetic - a divergence would mean the answer depends
// on where you typed. The cell is built with appendChild and carries a trend badge, so textContent alone
// reads empty under the stub, which would make every comparison below pass on ''.
function firstCalc() {
    var tr = $('step-sequence-body').children[0];
    if (!tr) return 'none';
    var c = tr.children[4];
    if (!c) return 'none';
    var text = ((c.innerHTML || '') + (c.textContent || '')).replace(/<[^>]*>/g, ' ').trim();
    var m = text.match(/-?\d+/);
    return m ? m[0] : 'none';
}
var sample = clean.slice(0, 60);
var bulk = sample.map(function (line) {
    $('bulk-input').value = line;
    $('bulk-parse-btn').fire('click');
    return firstCalc();
});
var single = sample.map(function (line) {
    $('new-file-btn').fire('click');
    $('tokens-input').value = line;
    $('initial-chain-input').value = '0';
    $('multiplier-input').value = '1';
    $('expected-yield-input').value = '0';
    $('row-form').fire('submit');
    return firstCalc();
});
var mismatches = [];
for (var i = 0; i < sample.length; i++) {
    if (bulk[i] !== single[i]) mismatches.push(sample[i].slice(0, 50) + ' (bulk ' + bulk[i] + ', single ' + single[i] + ')');
}
ck('every sampled row agrees across both paths', mismatches.join(' | ') || 'all agree', 'all agree');
ok('and the sample was not empty', sample.length >= 50);

print('\n5. Nothing in the corpus crashes the parser');
// Real text carries OCR debris, stray punctuation and fragments. None of it should
// throw - an unreadable row is a reported failure, not an exception.
var threw = [];
ROWS.forEach(function (line) {
    try {
        E.parseInstructions(line);
        E.evaluateStep(0, 40, line, 1, 0);
    } catch (e) { threw.push(line.slice(0, 40) + ' -> ' + e); }
});
ck('no row throws', threw.slice(0, 3).join(' | ') || 'none', 'none');

print('\n6. A readable row still measures correctly through the app');
$('new-file-btn').fire('click');
$('bulk-input').value = 'Ch 21, s c in 2nd st from hook, 1 s c in each remaining st of ch';
$('bulk-parse-btn').fire('click');
ck('a vintage foundation row still counts', firstCalc(), 20);

endSuite();
