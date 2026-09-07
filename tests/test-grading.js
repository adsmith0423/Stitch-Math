boot();
var A = CrochetAnalyticsEngine;

function sizes() {
    return Array.prototype.slice.call(arguments).map(function (n, i) {
        return { label: ['Small', 'Medium', 'Large'][i] || ('Size ' + (i + 1)), stitches: n, allValid: true };
    });
}

print('\n1. CheckSizeGrading in isolation');
ck('a single size is not graded at all', A.CheckSizeGrading(null), null);
ck('one size returns nothing', A.CheckSizeGrading(sizes(40)), null);

var even = A.CheckSizeGrading(sizes(80, 88, 96));
ck('even grading passes', even.state, 'pass');
ok('and says so with the counts', /80, 88, 96/.test(even.detail));

var backwards = A.CheckSizeGrading(sizes(80, 88, 84));
ck('a size that shrinks fails', backwards.state, 'fail');
ok('names the pair', /Medium → Large/.test(backwards.detail));
ok('shows the counts that prove it', /80, 88, 84/.test(backwards.detail));

var identical = A.CheckSizeGrading(sizes(80, 88, 88));
ck('two identical sizes fail', identical.state, 'fail');
ok('says they come out the same', /come out the same size/.test(identical.detail));

var uneven = A.CheckSizeGrading(sizes(80, 82, 96));
ck('uneven steps warn rather than fail', uneven.state, 'warn');
ok('quotes the steps', /2, 14/.test(uneven.detail));

var mild = A.CheckSizeGrading(sizes(80, 86, 96));
ck('6 then 10 is within tolerance', mild.state, 'pass');

var broken = sizes(80, 88, 96); broken[1].allValid = false;
var b = A.CheckSizeGrading(broken);
ck('a size that does not validate blocks comparison', b.state, 'warn');
ok('and names it', /Medium/.test(b.detail));
ck('without deducting twice for the same fault', b.deduct, 0);

print('\n2. It reaches the health panel');
function health(sizeList) {
    return A.CalculatePatternHealth({
        rows: [{ label: 'Row 1', status: 'valid', step: { sourceLine: 'Row 1: sc in each st across (10)', expectedYield: 10 }, evaluation: { calculatedYield: 10, unknownTokens: [] } }],
        stitchTotals: { sc: 10 },
        sizes: sizeList
    });
}
var single = health(null);
no('no grading check on a single-size pattern', single.checks.some(function (c) { return c.name === 'Size grading'; }));

var graded = health(sizes(80, 88, 96));
ok('grading check present for three sizes', graded.checks.some(function (c) { return c.name === 'Size grading'; }));

var bad = health(sizes(80, 88, 84));
var badCheck = bad.checks.filter(function (c) { return c.name === 'Size grading'; })[0];
ck('a broken grade fails the check', badCheck.state, 'fail');
ok('and costs score', bad.score < graded.score);

print('\n3. End to end, through the app');
function content(el) { return (el.innerHTML || '') + (el.textContent || ''); }
function loadPattern(text) { $('bulk-input').value = text; $('bulk-parse-btn').fire('click'); }
function healthText() { return content($('cumulative-status')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '); }

$('meta-construction').value = 'Rows (Flat)';
$('meta-construction').fire('change');

// Three sizes, graded 40 / 44 / 48.
loadPattern([
    'Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
ck('three sizes detected', $('meta-size').innerHTML.split('<option').length - 1, 3);
ok('graded evenly', /Size grading/.test(healthText()));
ok('reports 40, 44, 48', /40, 44, 48/.test(healthText()));
ok('and passes', /3 sizes grade evenly/.test(healthText()));

// The live view must be untouched by the extra parses. The matrix rows are built with
// appendChild, so innerHTML is empty under the stub - text() flattens the children.
ok('still showing the selected size', /ch 41/.test($('step-sequence-body').text()));
no('and not one of the sizes it measured', /ch 45|ch 49/.test($('step-sequence-body').text()));
ck('size selector unmoved', $('meta-size').value, '0');

// A typo in the middle size.
loadPattern([
    'Row 1: ch 41 (49, 45), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
ok('shrinking grade is caught', /sizes get smaller as they go up/.test(healthText()));

// Switching size still works after all the swapping.
$('meta-size').value = '1';
$('meta-size').fire('change');
ck('size index followed', $('meta-size').value, '1');
ok('and the matrix rebuilt at that size', /ch 49/.test($('step-sequence-body').text()));

print('\n4. Single-size patterns are unaffected');
$('meta-size').value = '0'; $('meta-size').fire('change');
loadPattern([
    'Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
no('no grading check appears', /Size grading/.test(healthText()));
ok('and the pattern still scores well', /Excellent|Good/.test(healthText()));

print('\n4b. A trailing stitch count is not a size group across lines');
// isSizeGroup asks whether anything follows on the LINE. Counting over the whole document made "x 6 (18)"
// on any row but the last look like a size, so a plain single-size pattern reported two sizes and then
// failed its own grading check.
loadPattern([
    'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
    'Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)',
    'Row 3: ch 1, turn, [sc in next 2 sts, inc in next st] x 6 (24)'
].join('\n'));
// The size picker only appears once there is more than one size to pick between, so a hidden picker
// is how a single-size pattern reads now that the type selector is gone.
ok('reported as one size fits all', $('size-picker-group').classList.contains('hidden'));
no('no grading check invented', /Size grading/.test(healthText()));
ok('and it still scores 100', /health-number">100</.test(content($('cumulative-status'))));

// A genuine multi-size line must still be detected when it is not the last line.
loadPattern([
    'Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
ck('a real size group mid-document still counts', $('meta-size').innerHTML.split('<option').length - 1, 3);

print('\n4c. The grading cache never serves a stale answer');
// Grading is memoised because it costs a full re-parse per size on every render. A
// stale hit would report the previous pattern's grading against the current one.
loadPattern([
    'Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
ok('starts clean', /grade evenly/.test(healthText()));
loadPattern([
    'Row 1: ch 41 (49, 45), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
ok('editing the text re-grades', /get smaller as they go up/.test(healthText()));
loadPattern([
    'Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
ok('and editing it back re-grades again', /grade evenly/.test(healthText()));

// A view toggle must not change the verdict (it is the case the cache exists for).
var before = healthText().match(/Size grading[^✓✗⚠]*/)[0];
$('toggle-trend-markers').fire('change');
ck('a view toggle leaves the grading identical', healthText().match(/Size grading[^✓✗⚠]*/)[0], before);
$('toggle-trend-markers').fire('change');

// Repeat convention changes stitch counts, so it must bust the cache. There is no UI control for it
// any more, so it is driven straight through the engine and the health panel is forced to re-read.
CrochetMathEngine.setRepeatConvention('inclusive');
$('bulk-parse-btn').fire('click');
ck('the engine setting took', CrochetMathEngine.getRepeatConvention(), 'inclusive');
ok('repeat convention still reports a grading', /Size grading/.test(healthText()));
CrochetMathEngine.setRepeatConvention('exact');
$('bulk-parse-btn').fire('click');

print('\n5. The text export carries it');
var EXPORTED = '';
Blob = function (parts) { EXPORTED = String(parts[0]); };
loadPattern([
    'Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)',
    'Row 2: ch 1, turn, sc in each st across (40)'
].join('\n'));
$('project-name').value = 'graded';
$('export-txt-btn').fire('click');
ok('grading line exported', /Size grading/.test(EXPORTED));

endSuite();
