/**
 * Required Elements - the four things a pattern has to state before anyone else can work it.
 *
 * The rule being checked throughout: each element is satisfied by the metadata form OR by the
 * pattern's own front matter, and `source` reports which one answered. A tick whose provenance is
 * unknown is a tick the designer has to re-check by hand, which is the whole thing this replaces.
 *
 * Deliberately an engine-level suite: requiredElements reads text and touches no DOM, so it is
 * exercised directly rather than through the editor.
 */
boot();

var E = window.CrochetMathEngine;

function req(opts) { return E.requiredElements(opts); }
function item(result, key) {
    return result.items.filter(function (i) { return i.key === key; })[0] || {};
}
function present(result, key) { return item(result, key).present; }
function source(result, key) { return item(result, key).source; }

print('\n1. Nothing stated at all');
var empty = req({ sourceText: 'Row 1: ch 10\nRow 2: sc in each ch across (10)' });
no('not complete', empty.complete);
ck('all four reported missing', empty.missing.length, 4);
ck('and they are the four we name', empty.missing.join(','), 'hook,yarnWeight,gauge,abbreviations');
ck('every item carries a hint', empty.items.filter(function (i) { return !!i.hint; }).length, 4);
ck('a missing item has no source', source(empty, 'hook'), 'null');

print('\n2. Satisfied from the metadata form');
var form = req({
    sourceText: 'Row 1: ch 10',
    metadata: { hook: '4.0mm (G)', yarnWeight: '4 - Medium' },
    gauge: { stitches: 14, rows: 10 }
});
ok('hook read', present(form, 'hook'));
ck('and attributed to the form', source(form, 'hook'), 'form');
ok('yarn read', present(form, 'yarnWeight'));
ok('gauge read', present(form, 'gauge'));
ck('gauge attributed to the form', source(form, 'gauge'), 'form');
no('but the abbreviations key has no form to come from', present(form, 'abbreviations'));
no('so it is still incomplete', form.complete);

print('\n3. A gauge needs both halves of the swatch');
// Stitches with no rows cannot produce a row gauge, so it is not a measurement anyone can work from.
var halfGauge = req({ sourceText: 'Row 1: ch 10', gauge: { stitches: 14, rows: 0 } });
no('stitches without rows is not a gauge', present(halfGauge, 'gauge'));

print('\n4. Satisfied from the pattern text');
var stated = [
    'Hook: 5.0mm (H/8)',
    'Yarn: Worsted Weight (Category 4), approx. 400 yards',
    'Gauge: 14 hdc x 10 rows = 4 in.',
    '',
    'Abbreviations',
    'ch = chain',
    'hdc = half double crochet',
    'sc = single crochet',
    '',
    'Row 1: ch 11',
    'Row 2: hdc in 2nd ch from hook, hdc in each ch across (10)'
].join('\n');
var text = req({ sourceText: stated });
ok('hook read off the pattern', present(text, 'hook'));
ck('and attributed to the pattern', source(text, 'hook'), 'pattern');
ok('yarn read off the pattern', present(text, 'yarnWeight'));
ok('gauge read off the pattern', present(text, 'gauge'));
ck('gauge attributed to the pattern', source(text, 'gauge'), 'pattern');
ok('abbreviations key found', present(text, 'abbreviations'));
ok('so the pattern is complete', text.complete);
ck('with nothing missing', text.missing.length, 0);

print('\n5. An abbreviations key needs more than one entry');
// One line under the heading is as likely to be a stray sentence as a definition.
var oneEntry = req({ sourceText: 'Abbreviations\nch = chain\n\nRow 1: ch 11' });
no('a single entry is not a key', present(oneEntry, 'abbreviations'));
var twoEntries = req({ sourceText: 'Abbreviations\nch = chain\nsc = single crochet\n\nRow 1: ch 11' });
ok('two entries is', present(twoEntries, 'abbreviations'));

print('\n6. The key ends where the work starts');
// Definitions below the first row belong to no block, and counting them would let a pattern satisfy
// the check with text it never wrote as a key.
var runOn = req({ sourceText: [
    'Abbreviations',
    'ch = chain',
    'Row 1: ch 11',
    'sc = single crochet'
].join('\n') });
no('an entry after the work does not count toward the key', present(runOn, 'abbreviations'));

print('\n7. A gauge label with nothing measurable under it');
// "Gauge: work evenly" is a gauge label and not a gauge.
var vague = req({ sourceText: 'Gauge: work evenly to maintain drape\nRow 1: ch 11' });
no('an unmeasurable gauge statement does not count', present(vague, 'gauge'));

print('\n8. A gauge stated without its label');
// How a Gauge block writes it once the heading above has already said what it is.
var unlabelled = req({ sourceText: 'Gauge\n16 sc x 18 rows = 4 in.\n\nRow 1: ch 11' });
ok('read anyway', present(unlabelled, 'gauge'));

print('\n9. The form and the pattern agreeing does not double-count');
var both = req({
    sourceText: 'Hook: 5.0mm (H/8)\nRow 1: ch 11',
    metadata: { hook: '4.0mm (G)' }
});
ok('still just present', present(both, 'hook'));
// The form is read first, so it is the one reported - and reporting one of the two is the point.
ck('one source, not two', source(both, 'hook'), 'form');

print('\n10. Called with nothing at all');
// The badge asks on every render, including before a pattern exists.
var bare = E.requiredElements();
no('not complete', bare.complete);
ck('and it still describes all four', bare.items.length, 4);

endSuite();
