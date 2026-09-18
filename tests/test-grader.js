boot();
var A = CrochetAnalyticsEngine;

// The charts. 30 sizes x 9 measurements were transcribed by hand from the PDF, so these check the shape
// and the progression rather than trusting the typing.
print('\n1. Every chart is complete');
var GARMENT = ['baby', 'child', 'youth', 'woman', 'man'];
GARMENT.forEach(function (key) {
    var chart = A.CYC_BODY_MEASUREMENTS[key];
    var missing = [];
    chart.sizes.forEach(function (entry) {
        A.MEASUREMENT_POINTS.forEach(function (pt) {
            var m = entry[1][pt];
            if (!m || typeof m.min !== 'number' || typeof m.max !== 'number') missing.push(entry[0] + '.' + pt);
            else if (m.min > m.max) missing.push(entry[0] + '.' + pt + ' (min > max)');
        });
    });
    ck(key + ' has all 9 points on every size', missing.join(', ') || 'none', 'none');
});
ck('30 garment sizes in total',
   GARMENT.reduce(function (n, k) { return n + A.CYC_BODY_MEASUREMENTS[k].sizes.length; }, 0), 30);

print('\n2. Measurements never shrink as the size goes up');
// A transposed or mistyped digit almost always breaks the progression, which makes this a real check on
// 270 hand-copied numbers rather than a restatement of them.
GARMENT.forEach(function (key) {
    var chart = A.CYC_BODY_MEASUREMENTS[key];
    var breaks = [];
    ['chest', 'waist', 'hip', 'upperArm', 'armholeDepth', 'crossBack', 'armLength', 'backNeckToWrist']
        .forEach(function (pt) {
            for (var i = 1; i < chart.sizes.length; i++) {
                var prev = chart.sizes[i - 1][1][pt], cur = chart.sizes[i][1][pt];
                if (cur.min < prev.min || cur.max < prev.max) {
                    breaks.push(pt + ' ' + chart.sizes[i - 1][0] + '->' + chart.sizes[i][0]);
                }
            }
        });
    ck(key + ' progresses upward', breaks.join(', ') || 'none', 'none');
});

print('\n3. Spot values, read off the printed page');
function at(cat, size, pt) {
    var hit = A.CYC_BODY_MEASUREMENTS[cat].sizes.filter(function (s) { return s[0] === size; })[0];
    var m = hit[1][pt];
    return m.min === m.max ? String(m.min) : m.min + '-' + m.max;
}
ck('Woman Medium bust', at('woman', 'Medium', 'chest'), '36-38');
ck('Woman Medium waist', at('woman', 'Medium', 'waist'), '28-30');
ck('Woman Medium hip', at('woman', 'Medium', 'hip'), '38-40');
ck('Woman Medium armhole depth', at('woman', 'Medium', 'armholeDepth'), '7-7.5');
ck('Man Large chest', at('man', 'Large', 'chest'), '42-44');
ck('Man Large upper arm', at('man', 'Large', 'upperArm'), '15');
ck('Man Large armhole depth', at('man', 'Large', 'armholeDepth'), '9.5-10');
ck('Child 6 chest', at('child', '6', 'chest'), '25');
ck('Child 6 cross back', at('child', '6', 'crossBack'), '10.25');
ck('Baby 3 months chest', at('baby', '3 months', 'chest'), '16');
ck('Youth 16 hip', at('youth', '16', 'hip'), '35.5');

print('\n4. The Man chart measures back length differently');
// Row 3 is "Back Hip Length" on the Man chart and "Back Waist Length" everywhere else. A real difference
// in what is measured, not a typo to normalise away.
ck('man', A.CYC_BODY_MEASUREMENTS.man.backLengthLabel, 'Back Hip Length');
ck('woman', A.CYC_BODY_MEASUREMENTS.woman.backLengthLabel, 'Back Waist Length');
ck('child', A.CYC_BODY_MEASUREMENTS.child.backLengthLabel, 'Back Waist Length');

print('\n5. Known disagreements in the source are recorded, not silently fixed');
ok('the discrepancy list exists', A.CHART_CM_DISCREPANCIES.length > 0);
// Every listed cell must still be in the charts, or the note has gone stale.
var stale = A.CHART_CM_DISCREPANCIES.filter(function (d) {
    var chart = A.CYC_BODY_MEASUREMENTS[d[0]];
    var hit = chart && chart.sizes.filter(function (s) { return s[0] === d[1]; })[0];
    if (!hit) return true;
    var m = hit[1][d[2]];
    return !m || (m.min !== d[3] && m.max !== d[3]);
});
ck('every recorded discrepancy still matches a real cell', stale.length, 0);

print('\n6. Existing size matching is unchanged by the new chart shape');
var sized = A.CalculateFinishedSize({
    rows: [{ label: 'Row 1', status: 'valid', step: {}, evaluation: { calculatedYield: 168 } }],
    gauge: { unit: 'in', stitchDensity: 4, rowDensity: 3 },
    category: 'woman', piece: 'round'
});
ok('still measures a pattern', sized.available);
ck('42 in from 168 sts at 4 sts/in', sized.circumferenceInches, 42);
ok('and still matches sizes', sized.matches.length > 0);

// ---------------------------------------------------------------------------
print('\n7. Ease is never inferred silently');
// ---------------------------------------------------------------------------
var r = A.ResolveEase({ body: 38, finished: 42 });
ck('body + finished gives ease', r.easeInches, 4);
ck('as a percentage of the body measurement', r.easePercent, 10.5);
ck('and says which value was derived', r.derived, 'ease');

ck('body + ease gives finished', A.ResolveEase({ body: 38, ease: { value: 4, mode: 'in' } }).finished, 42);
ck('finished + ease gives body', A.ResolveEase({ finished: 42, ease: { value: 4, mode: 'in' } }).body, 38);
ck('and marks that one derived', A.ResolveEase({ finished: 42, ease: { value: 4, mode: 'in' } }).derived, 'body');

var one = A.ResolveEase({ body: 38 });
no('one value alone resolves nothing', one.complete);
ck('and names what is missing', one.missing.join(','), 'finished,ease');
ck('no ease figure is produced', one.easeInches, 'null');

// The case the requirement is really about.
var clash = A.ResolveEase({ body: 38, finished: 42, ease: { value: 2, mode: 'in' } });
no('three values that disagree do not resolve', clash.complete);
ok('the disagreement is reported', !!clash.conflict);
ck('the stated ease is kept as stated', clash.conflict.statedEase, 2);
ck('alongside what the measurements imply', clash.conflict.impliedEase, 4);
ck('and neither is overwritten', clash.easeInches, 'null');
ok('three that agree resolve fine', A.ResolveEase({ body: 38, finished: 42, ease: { value: 4, mode: 'in' } }).complete);

print('\n8. Negative, zero and percentage ease');
var neg = A.ResolveEase({ body: 38, finished: 36 });
ck('negative ease is a value, not an error', neg.easeInches, -2);
ck('and its percentage is negative too', neg.easePercent, -5.3);
ck('zero ease resolves', A.ResolveEase({ body: 38, finished: 38 }).easeInches, 0);
ck('percentage mode: 38 at +10%', A.ResolveEase({ body: 38, ease: { value: 10, mode: 'percent' } }).finished, 41.8);
// What the grader applies follows the unit the ease was typed in: a percentage stays a percentage
// and scales with every size; inches, or an ease derived from body and finished, stay one figure.
var pct = A.ResolveEase({ body: 38, ease: { value: 10, mode: 'percent' } });
ck('a typed percentage is applied as one', pct.easeApplied.mode + ':' + pct.easeApplied.value, 'percent:10');
ok('and scales with size', pct.easeScales);
var derivedEase = A.ResolveEase({ body: 38, finished: 42 });
ck('a derived ease is applied as the inches it is', derivedEase.easeApplied.mode + ':' + derivedEase.easeApplied.value, 'in:4');
no('and is not read as a percentage', derivedEase.easeScales);
ck('ApplyEase with no ease returns the body measurement', A.ApplyEase(38, null), 38);
ck('ApplyEase in cm', A.ApplyEase(38, { value: 5.08, mode: 'cm' }), 40);

print('\n9. Gauge conversion');
ck('42 in at 4 sts/in', A.MeasurementToStitches(42, 4), 168);
ck('20 in at 3 rows/in', A.MeasurementToRows(20, 3), 60);
ck('a zero gauge yields nothing rather than Infinity', A.MeasurementToStitches(42, 0), 'null');
ck('and so does a missing measurement', A.MeasurementToStitches(null, 4), 'null');
// The same width entered either way must grade the same.
ck('42 in and 106.68 cm agree',
   A.MeasurementToStitches(42, 4), A.MeasurementToStitches(106.68 / 2.54, 4));

print('\n10. Washed gauge wins when both are given');
var both = A.EffectiveGauge({ washed: { stitchesPerInch: 4, rowsPerInch: 3 }, unwashed: { stitchesPerInch: 5, rowsPerInch: 4 } });
ck('stitches come from the washed swatch', both.stitchesPerInch, 4);
ck('and it says so', both.source, 'washed');
ck('unwashed is used when it is all there is',
   A.EffectiveGauge({ unwashed: { stitchesPerInch: 5, rowsPerInch: 4 } }).stitchesPerInch, 5);

// Chosen per axis, not per swatch. A designer who washed a swatch and measured only its stitch gauge
// keeps the unwashed row gauge rather than losing row gauge altogether.
var split = A.EffectiveGauge({ washed: { stitchesPerInch: 4 }, unwashed: { stitchesPerInch: 5, rowsPerInch: 3 } });
ck('the washed stitch gauge is used', split.stitchesPerInch, 4);
ck('and the unwashed row gauge alongside it', split.rowsPerInch, 3);
ck('each axis says where it came from', split.stitchSource + '/' + split.rowSource, 'washed/unwashed');

// The case that used to be misreported: a washed ROW gauge with no washed stitch gauge was labelled
// unwashed while the washed row figure was the one actually in use.
var rowsWashed = A.EffectiveGauge({ washed: { rowsPerInch: 3 }, unwashed: { stitchesPerInch: 5, rowsPerInch: 4 } });
ck('the washed row gauge is used', rowsWashed.rowsPerInch, 3);
ck('and is no longer called unwashed', rowsWashed.rowSource, 'washed');
ck('while the stitch axis is honestly unwashed', rowsWashed.stitchSource, 'unwashed');

print('\n10b. A section can name its own gauge');
var perSection = { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 }, sections: { sleeve: { stitchesPerInch: 5 } } };
ck('the whole garment gauge is unchanged', A.EffectiveGauge(perSection).stitchesPerInch, 4);
ck('the sleeve works denser', A.EffectiveGauge(perSection, { section: 'sleeve' }).stitchesPerInch, 5);
ck('and says so', A.EffectiveGauge(perSection, { section: 'sleeve' }).stitchSource, 'section');
// One axis overridden must not discard the other.
ck('the row gauge is inherited, not lost',
   A.EffectiveGauge(perSection, { section: 'sleeve' }).rowsPerInch, 3);
ck('a section with no entry falls back',
   A.EffectiveGauge(perSection, { section: 'collar' }).stitchesPerInch, 4);
ck('and every existing one-argument call is untouched',
   JSON.stringify(A.EffectiveGauge({ washed: { stitchesPerInch: 4, rowsPerInch: 3 } })),
   '{"stitchesPerInch":4,"rowsPerInch":3,"stitchSource":"washed","rowSource":"washed","source":"washed"}');

print('\n11. The row-gauge warning means something when it appears');
function rowsOf() {
    var counts = Array.prototype.slice.call(arguments);
    return counts.map(function (n, i) {
        return { label: 'Row ' + (i + 1), status: 'valid', step: {}, evaluation: { calculatedYield: n } };
    });
}
var shaped = rowsOf(10, 12, 14);
var flat = rowsOf(10, 10, 10);
var stitchOnly = { unwashed: { stitchesPerInch: 4 } };
var withRows = { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } };

no('shaping without row gauge is flagged', A.CheckGaugeCompleteness({ rows: shaped, gauge: stitchOnly }).ok);
ok('and the warning says why', /row gauge/.test(A.CheckGaugeCompleteness({ rows: shaped, gauge: stitchOnly }).warning));
ok('shaping with row gauge is fine', A.CheckGaugeCompleteness({ rows: shaped, gauge: withRows }).ok);
ok('no shaping, no row gauge, no warning', A.CheckGaugeCompleteness({ rows: flat, gauge: stitchOnly }).ok);
ok('an empty pattern raises nothing', A.CheckGaugeCompleteness({ rows: [], gauge: stitchOnly }).ok);

print('\n12. Grading across sizes');
var graded = A.GradeSizes({
    category: 'woman', point: 'chest',
    ease: { value: 4, mode: 'in' },
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } }
});
ck('one row per size', graded.length, 9);
var medium = graded.filter(function (g) { return g.size === 'Medium'; })[0];
ck('Medium grades from the chart midpoint', medium.body, 37);
ck('plus the ease', medium.target, 41);
ck('into stitches', medium.stitches, 164);
// Chest is a circumference. "123 rows of bust" is not a measurement, so it is not produced at all rather
// than printed alongside the real number.
ck('and no row count, because chest is a width', medium.rows, 'null');
ck('the axis is recorded', medium.axis, 'width');
ok('and is marked as coming from the chart', medium.fromChart);

// A designer override replaces the standard for that size only.
var over = A.GradeSizes({
    category: 'woman', point: 'chest', ease: { value: 4, mode: 'in' },
    gauge: { unwashed: { stitchesPerInch: 4 } },
    overrides: { Medium: { chest: 40 } }
});
var overMedium = over.filter(function (g) { return g.size === 'Medium'; })[0];
ck('the override is used', overMedium.body, 40);
no('and it is no longer the standard value', overMedium.fromChart);
ck('other sizes are untouched',
   over.filter(function (g) { return g.size === 'Large'; })[0].body, 41);

print('\n13. Ease can differ by section');
var sleeve = A.GradeSizes({
    category: 'woman', point: 'chest', section: 'SLEEVE',
    ease: { value: 4, mode: 'in' },
    sectionEase: { SLEEVE: { value: 0, mode: 'in' } },
    gauge: { unwashed: { stitchesPerInch: 4 } }
});
ck('the sleeve takes its own ease', sleeve.filter(function (g) { return g.size === 'Medium'; })[0].target, 37);
var bodyPiece = A.GradeSizes({
    category: 'woman', point: 'chest', section: 'BODY',
    ease: { value: 4, mode: 'in' },
    sectionEase: { SLEEVE: { value: 0, mode: 'in' } },
    gauge: { unwashed: { stitchesPerInch: 4 } }
});
ck('a section with no override falls back to the overall ease',
   bodyPiece.filter(function (g) { return g.size === 'Medium'; })[0].target, 41);

print('\n14. Lengths take no bust ease, and produce rows not stitches');
// A +4 in bust ease said nothing about how deep an armhole should be, but it was being added to every
// vertical measurement: armhole depth graded from 7.25 to 11.25 in.
var whole = A.GradeGarment({
    category: 'woman', ease: { value: 4, mode: 'in' },
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } }
});
function pointAt(garment, point, size) {
    var row = garment.filter(function (r) { return r.point === point; })[0];
    return row.sizes.filter(function (c) { return c.size === size; })[0];
}
ck('armhole depth is not eased', pointAt(whole, 'armholeDepth', 'Medium').target, 7.3);
ck('back length is not eased', pointAt(whole, 'backLength', 'Medium').target, 17.3);
ck('arm length is not eased', pointAt(whole, 'armLength', 'Medium').target, 17);
ck('cross back is not eased either', pointAt(whole, 'crossBack', 'Medium').target, 15.8);
// ...but the fix must not disable ease everywhere.
ck('chest still takes it', pointAt(whole, 'chest', 'Medium').target, 41);
ck('waist still takes it', pointAt(whole, 'waist', 'Medium').target, 33);
ck('hip still takes it', pointAt(whole, 'hip', 'Medium').target, 43);
ck('upper arm still takes it', pointAt(whole, 'upperArm', 'Medium').target, 15);

ck('a length gives rows', pointAt(whole, 'armholeDepth', 'Medium').rows, 22);
ck('and no stitches', pointAt(whole, 'armholeDepth', 'Medium').stitches, 'null');
ck('a width gives stitches', pointAt(whole, 'chest', 'Medium').stitches, 164);
ck('and no rows', pointAt(whole, 'chest', 'Medium').rows, 'null');
ck('every point is covered', whole.length, 9);

print('\n14b. A per-measurement ease is a default, not a lock');
var eased = A.GradeGarment({
    category: 'woman', ease: { value: 4, mode: 'in' },
    pointEase: { armholeDepth: { value: 1, mode: 'in' } },
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } }
});
ck('the armhole override is honoured', pointAt(eased, 'armholeDepth', 'Medium').target, 8.3);
ck('and nothing else moves', pointAt(eased, 'backLength', 'Medium').target, 17.3);

print('\n14c. Flat pieces are half a circumference');
var flat = A.GradeGarment({
    category: 'woman', ease: { value: 4, mode: 'in' }, piece: 'half',
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } }
});
var flatChest = pointAt(flat, 'chest', 'Medium');
ck('the finished circumference is unchanged', flatChest.target, 41);
ck('but each piece is half of it', flatChest.across, 20.5);
ck('so the stitch count halves', flatChest.stitches, 82);
// A length is the same however the piece is worked.
ck('lengths are untouched by the piece choice',
   pointAt(flat, 'armholeDepth', 'Medium').rows, pointAt(whole, 'armholeDepth', 'Medium').rows);
// Only the body circumferences are shared between a front and a back. A sleeve is one piece around
// the arm, and the cross back is measured flat across one piece already - halving either grades a
// sleeve to fit half an arm.
ck('the upper arm is the whole arm', pointAt(flat, 'upperArm', 'Medium').across, 15);
ck('so the sleeve count is the whole arm', pointAt(flat, 'upperArm', 'Medium').stitches, 60);
ck('and the cross back is the span it is',
   pointAt(flat, 'crossBack', 'Medium').across, pointAt(flat, 'crossBack', 'Medium').target);
ck('the cell says what share it carries', pointAt(flat, 'chest', 'Medium').share, 0.5);
ck('and a sleeve carries all of it', pointAt(flat, 'upperArm', 'Medium').share, 1);

print('\n14d. Through the panel');
function setVal(id, v) { $(id).value = String(v); $(id).fire('input'); }
function summary() { return $('grade-summary').innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function tables() { return $('grade-tables').children; }
// The tables are appended, so the host reads empty from innerHTML - see CONTRIBUTING.
function tableText(i) { return tables()[i].innerHTML; }
// One row's own markup, so a check about a length cannot accidentally match a stitch count sitting in
// some other row of the same table.
function rowHtml(text, label) {
    var m = text.match(new RegExp('<tr>\\s*<th scope="row">' + label + '[\\s\\S]*?</tr>'));
    return m ? m[0] : '';
}

setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);

ok('body line shows both units', /Body[^|]*38\.0 in \/ 96\.5 cm/.test(summary()));
ok('finished line shows both units', /Finished[^|]*42\.0 in \/ 106\.7 cm/.test(summary()));
ok('ease in both units and as a percent', /\+4 in \/ \+10\.2 cm \/ \+10\.5%/.test(summary()));
ok('marked derived', /derived/.test(summary()));
ok('and fixed across sizes, being inches', /fixed across sizes/.test(summary()));
ok('gauge quoted per 4 in', /16 sts × 12 rows per 4 in/.test(summary()));

$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
ck('always one table', tables().length, 1);
ok('measurements run down the side', /scope="row">Chest \/ Bust/.test(tableText(0)));
ok('sizes run across the top', /<th>Medium<\/th>/.test(tableText(0)));
// Fixed at half per piece: the +4 in bust ease grades to 41 in finished, 20.5 in for one of the two
// pieces, 82 sts at 4 sts/in.
ok('a width cell shows stitches for one piece', /82 sts/.test(tableText(0)));
ok('and the target in both units', /41\.0 in \/ 104\.1 cm/.test(tableText(0)));
ok('and what the full circumference is too, also in both units',
   /\(20\.5 in \/ 52\.1 cm per piece\)/.test(tableText(0)));
ok('a length cell shows rows', /22 rows/.test(tableText(0)));
no('and no stitch count on a length row', /\bsts\b/.test(rowHtml(tableText(0), 'Armhole Depth')));

print('\n14e. The pattern\'s own sections and pieces play no part');
// Slimmed down: grading no longer varies by which piece you are looking at, so it no longer matters what
// the pattern text says either. One chart, one ease, one piece convention, whatever the sections.
var before = tableText(0);
$('bulk-input').value = ['BODY', 'Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)',
                         'SLEEVE', 'Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)'].join('\n');
$('bulk-parse-btn').fire('click');
ck('still one table', tables().length, 1);
// The numbers, not the markup: a pattern on the page gives the grader a base size to mark, and the
// column class that marks it is the one thing about the table that is allowed to change.
function unmarked(html) { return html.replace(/ class="grade-base-col"/g, ''); }
ck('and the same numbers', unmarked(tableText(0)), unmarked(before));
ok('with the size nearest its widest row marked as the base', /class="grade-base-col">X-Small/.test(tableText(0)));
ok('no section name leaks into it', !/BODY|SLEEVE/.test(tableText(0)));

ok('the per-section ease controls are gone',
   !/id="grade-section-ease"/.test(readFile('index.html')));
ok('and so is the per-piece choice',
   !/id="grade-piece"/.test(readFile('index.html')));

// Deselecting a size drops it from the table.
$('grade-size-x-small').checked = false;
$('grade-size-x-small').fire('change');
no('the deselected size is gone', /<th>X-Small<\/th>/.test(tableText(0)));
ok('the others remain', /<th>Medium<\/th>/.test(tableText(0)));
$('grade-size-x-small').checked = true;
$('grade-size-x-small').fire('change');

// The panel must not blank the summary when the numbers disagree.
setVal('grade-ease', 2);
ok('a disagreement is shown', /do not agree/.test(summary()));
ok('the stated ease is still visible', /\+2/.test(summary()));
ok('and so is the implied one', /\+4/.test(summary()));
setVal('grade-ease', '');

print('\n14f. Per-measurement ease reaches the table too');
$('grade-pe-armholedepth').value = '1';
$('grade-pe-armholedepth').fire('input');
ok('armhole depth deepens by an inch', /25 rows/.test(tableText(0)));
$('grade-pe-armholedepth').value = '';
$('grade-pe-armholedepth').fire('input');
ok('and goes back when cleared', /22 rows/.test(tableText(0)));

print('\n14g. Ease typed as a percentage scales with size, and the pattern says its sizes');
// Sister Mountain: ease should scale - 10% is 2.9 in on an X-Small and 4.9 in on a 2X. The grader
// follows the unit typed: a percentage scales, inches do not, and the summary says which.
setVal('grade-finished', '');
$('grade-ease-mode').value = 'percent'; $('grade-ease-mode').fire('change');
setVal('grade-ease', 10);
ok('a percentage scales with size', /scales with size/.test(summary()));
ok('so the Medium is 37 + 10%', /40\.7 in/.test(chestMedium()));
ok('and the 2X is 49 + 10%, not 37 + 10%', /53\.9 in/.test(rowHtml(tableText(0), 'Chest / Bust')));
// What the pattern will say about its sizes, in the words a tech editor checks for.
function statement() { return $('grade-sizing-statement').text().replace(/\s+/g, ' '); }
setVal('grade-base-name', 'Medium');
ok('the sample size is named', /Sample shown in Medium/.test(statement()));
ok('with the ease it is worn with', /worn with \+3\.7 in \/ \+10% ease \(classic fit\)/.test(statement()));
ok('and that it scales', /scaling with size/.test(statement()));
ok('every size\'s finished measurement', /Finished bust: 31\.9 \(36\.3, 40\.7, 45\.1/.test(statement()));
ok('the body measurements graded from', /Graded from a body bust of 29 \(33, 37, 41/.test(statement()));
ok('and how to choose', /Choose your size by your bust and upper arm; sizes are graded from the Craft Yarn Council Woman chart/.test(statement()));
BLOBS.length = 0; $('export-txt-btn').fire('click');
ok('the pattern export carries the sizes', /FINISHED SIZES:\n- Sample shown in Medium/.test(BLOBS[0]));
BLOBS.length = 0; $('export-editing').fire('click');
ok('and the editing report opens with them', /Sizing statement:\n  Sample shown in Medium/.test(BLOBS[0]));
setVal('grade-base-name', '');
// With no name typed the base is read off the pattern on the page - the 40-stitch BODY from 14e is
// nearest an X-Small - and the sample line follows it.
ok('the sample line follows the base size', /Sample shown in X-Small/.test(statement()));
ok('and the sizes are still stated', /Finished bust:/.test(statement()));
$('grade-ease-mode').value = 'in'; $('grade-ease-mode').fire('change');
setVal('grade-ease', ''); setVal('grade-finished', 42);
ok('back to inches, fixed across sizes', /fixed across sizes/.test(summary()));

print('\n15. The other sizing panel is untouched');
ok('Garment Size Comparison is still on the page', /id="finished-size-panel"/.test(readFile('index.html')));
ok('and the grader is its own panel', /id="grader-section"/.test(readFile('index.html')));

print('\n16. Grading to a stitch multiple');
// The default is off. A repeat belongs to a section of a pattern; this grades a measurement across sizes,
// which is not the same thing.
function chestAt(size, rounding) {
    var g = A.GradeSizes({
        category: 'woman', point: 'chest', sizes: [size], piece: 'half',
        ease: { value: 4, mode: 'in' },
        gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } },
        rounding: rounding
    });
    return g[0];
}
var plainCell = chestAt('Medium');
ck('with no rounding the count is unchanged', plainCell.stitches, 82);
ck('and no fit fields are invented', 'fits' in plainCell, false);
ck('nor a graded measurement', 'gradedInches' in plainCell, false);

// Medium chest 37 + 4 ease = 41 in finished, 20.5 in per piece, 82 sts at 4 sts/in. 82 does not fit a
// 6 + 1 repeat: 79 and 85 are the counts either side.
var fittedCell = chestAt('Medium', { repeat: { multiple: 6, plus: 1 } });
ck('fitted to the repeat it moves', fittedCell.stitches, 85);
ck('the measurement it really gives', fittedCell.gradedInches, 21.25);
ck('and what that cost', fittedCell.differenceInches, 0.75);
ok('now it fits', fittedCell.fits);
ok('with the alternatives listed', fittedCell.options.length > 0);
ck('the target it was grading to is untouched', fittedCell.target, 41);
ck('and so is the per-piece measurement', fittedCell.across, 20.5);

// Enforcement lands on the per-piece count, not the circumference. 85 sts a piece is 170 around; fitting
// 164 to 6 + 1 would give 163, which cannot be halved at all.
ok('the fitted count is a whole repeat per piece',
   (fittedCell.stitches - 1) % 6 === 0);

ck('rounding down instead', chestAt('Medium', { repeat: { multiple: 6, plus: 1 }, strategy: 'down' }).stitches, 79);
ck('rounding up instead', chestAt('Medium', { repeat: { multiple: 6, plus: 1 }, strategy: 'up' }).stitches, 85);

// Lengths have no stitch multiple to fit, and must not acquire one.
var lengthCell = A.GradeSizes({
    category: 'woman', point: 'armholeDepth', sizes: ['Medium'], piece: 'half',
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } },
    rounding: { repeat: { multiple: 6, plus: 1 } }
})[0];
ck('a length still reports rows', lengthCell.rows, 22);
ck('and no stitches', lengthCell.stitches, 'null');
ck('and was never fitted', 'fits' in lengthCell, false);

print('\n16b. Rounding is per point, and rows can round to even');
// A grading spreadsheet fits each measurement to the repeat of the piece worked to it, and shows the
// measurement the rounded count really gives beside the target - the "rounding effects" column.
function cellAt(point, size, rounding) {
    return A.GradeSizes({
        category: 'woman', point: point, sizes: [size], piece: 'half',
        ease: { value: 4, mode: 'in' },
        gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } },
        rounding: rounding
    })[0];
}
var perPoint = { byPoint: { chest: { multiple: 6, plus: 1 } }, strategy: 'nearest', parity: 'any' };
ck('a named point is fitted to its repeat', cellAt('chest', 'Medium', perPoint).stitches, 85);
ck('and reports the circumference that count really gives',
   cellAt('chest', 'Medium', perPoint).actualTarget, 42.5);
ck('a point the caller did not name is left alone',
   'fits' in cellAt('upperArm', 'Medium', perPoint), false);
var wholeStitches = cellAt('upperArm', 'Medium', { byPoint: { upperArm: null }, strategy: 'nearest', parity: 'any' });
ck('a point fitted to whole stitches keeps the plain count', wholeStitches.stitches, 60);
ok('but still reports what it measures', 'gradedInches' in wholeStitches);
ck('a fitted cell names the repeat it landed on', cellAt('chest', 'Medium', perPoint).repeat.label, '6 + 1');
ck('and a whole-stitch fit names none', wholeStitches.repeat, 'null');

// Rows round to even so every new action starts on the right side. 6.25 in at 3 rows/in is 18.75:
// nearest is 19, nearest even is 18, and the cell says what that measures.
var evenRows = cellAt('armholeDepth', 'X-Small', { rowParity: 'even' });
ck('a length rounds to an even row count', evenRows.rows, 18);
ck('and reports what that measures', evenRows.gradedInches, 6);
// The target is the chart's 6.25 in midpoint as ApplyEase reports it, to a tenth: 6.3.
ck('and how far off the target that is', evenRows.differenceInches, -0.3);
ck('while nearest-row rounding gives the odd count', cellAt('armholeDepth', 'X-Small', { rowParity: 'any' }).rows, 19);
ck('a length never acquires a repeat', 'fits' in evenRows, false);
ck('MeasurementToRows never goes below two rows', A.MeasurementToRows(0.1, 3, 'even'), 2);

// A locked measurement carries the base's fitted figures with it, fit fields included.
var fittedGarment = A.GradeGarment({
    category: 'woman', piece: 'half', ease: { value: 4, mode: 'in' },
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } },
    rounding: perPoint
});
var lockedChest = A.ApplyDimensionModes({ garment: fittedGarment, modes: { chest: 'locked' }, baseSize: 'Medium' })
    .find(function (r) { return r.point === 'chest'; });
ck('a locked size takes the base\'s fitted count', pointAt([lockedChest], 'chest', '2X').stitches, 85);
ck('and the base\'s actual measurement', pointAt([lockedChest], 'chest', '2X').actualTarget, 42.5);

print('\n17. A section can grade at its own gauge');
var denser = A.GradeSizes({
    category: 'woman', point: 'chest', sizes: ['Medium'], piece: 'half',
    ease: { value: 4, mode: 'in' },
    section: 'sleeve',
    gauge: { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 }, sections: { sleeve: { stitchesPerInch: 5 } } }
})[0];
ck('20.5 in at 5 sts/in', denser.stitches, 103);
ck('and it says the gauge came from the section', denser.gaugeSource, 'section');
ck('while the whole garment is still at 4', chestAt('Medium').stitches, 82);

print('\n18. The section panel, through the page');
// Its own host below the graded table. Everything in it is read out of the pattern.
function sectionRows() {
    var host = $('grade-sections');
    var wrap = host.children[2];
    return wrap && wrap.children[0] ? wrap.children[0].children[1].children : [];
}
// Every cell is built with createElement, so innerHTML reads empty - see CONTRIBUTING. text() flattens the
// row and joins with " | ", which is also the column separator here.
function sectionText(i) {
    return sectionRows()[i].text().replace(/\s+/g, ' ');
}

setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
$('bulk-input').value = ['BODY',
    'Worked over a multiple of 6 + 1.',
    'Row 1: ch 44, sc in 2nd ch from hook and in each ch across (43)',
    'Row 2: ch 1, turn, sc in each st across (43)',
    'SLEEVE',
    'Worked over a multiple of 4 sts plus 2.',
    'Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)'].join('\n');
$('bulk-parse-btn').fire('click');

ck('a row per section the pattern names', sectionRows().length, 2);
ok('named from the pattern', /BODY/.test(sectionText(0)) && /SLEEVE/.test(sectionText(1)));
// Counts are derived from the same evaluation the matrix is drawn from, never typed.
ok('the body starts and ends on 43 across two rows', /43 → 43 over 2/.test(sectionText(0)));
ok('the sleeve on 20 across one', /20 → 20 over 1/.test(sectionText(1)));
// And what those counts come out at, at the piece's own gauge.
ok('the body measures 10.75 in wide', /10\.8 in/.test(sectionText(0)));
ok('the multiple was read out of the prose', /from the pattern/.test(sectionText(0)));
// 43 = 6 x 7 + 1.
ok('43 fits a 6 + 1 repeat', /43 over 6 \+ 1: fits/.test(sectionText(0)));
// 20 is not 4n + 2; 18 and 22 are the counts either side.
ok('20 does not fit 4 + 2', /20 over 4 \+ 2: does not fit/.test(sectionText(1)));
ok('the nearest valid counts are offered', /18 = /.test(sectionText(1)) && /22 = /.test(sectionText(1)));
ok('each with what it measures, in both units', /22 = 5\.5 in \/ 14\.0 cm/.test(sectionText(1)));
ok('and what it costs', /\(\+0\.5 in\)/.test(sectionText(1)));
ok('with the rounding spelled out rather than applied',
   /Rounds to 22: 5\.0 in \/ 12\.7 cm becomes 5\.5 in \/ 14\.0 cm, a difference of \+0\.5 in/.test(sectionText(1)));

print('\n18b. The designer overrides a detected multiple');
$('grade-sm-body').value = '5';
$('grade-sm-body').fire('input');
ok('the entered multiple wins', /43 over 5: does not fit/.test(sectionText(0)));
no('and it no longer claims to quote the pattern', /from the pattern/.test(sectionText(0)));
ok('it says the figure is the designer\'s', /yours/.test(sectionText(0)));
ok('the other section is unaffected', /from the pattern/.test(sectionText(1)));

print('\n18c. Rounding strategy changes what is recommended');
$('grade-rounding').value = 'down';
$('grade-rounding').fire('change');
ok('down takes the count below', /Rounds to 40/.test(sectionText(0)));
ok('and reports a negative difference', /difference of -0\.75 in/.test(sectionText(0)));
$('grade-rounding').value = 'up';
$('grade-rounding').fire('change');
ok('up takes the count above', /Rounds to 45/.test(sectionText(0)));
$('grade-rounding').value = 'nearest';
$('grade-rounding').fire('change');

print('\n18d. A section can be given its own gauge');
$('grade-sg-sleeve').value = '5';
$('grade-sg-sleeve').fire('input');
// 20 sts at 5 sts/in is 4.0 in, and 22 is 4.4 in.
ok('the sleeve measures at its own gauge', /22 = 4\.4 in/.test(sectionText(1)));
ok('the body is still at the project gauge', /45 = 11\.3 in/.test(sectionText(0)));
$('grade-sg-sleeve').value = '';
$('grade-sg-sleeve').fire('input');
ok('clearing it hands the section back', /22 = 5\.5 in/.test(sectionText(1)));
$('grade-sm-body').value = '';
$('grade-sm-body').fire('input');

print('\n18e. None of it reaches the graded table');
// The table grades the whole garment against one chart. A repeat belongs to one piece of a pattern, so
// nothing READ from the pattern text may appear in it: a section's detected multiple reaches the table
// only once the designer has typed what piece the section is (18f), never on the strength of its
// heading. Nothing here is typed, so nothing reaches it.
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
ok('still exactly one table', tables().length === 1);
no('no section name in it', /BODY|SLEEVE/.test(tableText(0)));
no('no repeat in it', /over 6 \+ 1|does not fit/.test(tableText(0)));
no('and no rounding note', /Rounds to|rounded to/.test(tableText(0)));
no('and no actual measurement', /grade-actual/.test(tableText(0)));

print('\n18f. A typed piece\'s repeat reaches the point it is worked to');
// BODY is 6 + 1 and SLEEVE 4 + 2, from 18. Typed as a body, the bust, waist and hip are fitted to
// 6 + 1 and the table says what each rounded count really measures; the upper arm is untouched until
// the sleeve is typed too. The counts come from the same RoundStitchCount the section panel uses.
function pointCell(label, size) {
    var row = rowHtml(tableText(0), label);
    var cols = row.match(/<td>[\s\S]*?<\/td>/g) || [];
    var at = ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X', '3X', '4X', '5X'].indexOf(size);
    return (cols[at] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
$('grade-sy-body').value = 'body'; $('grade-sy-body').fire('change');
ok('the bust is fitted to the body\'s repeat', /85 sts/.test(pointCell('Chest / Bust', 'Medium')));
ok('and shows the circumference it really gives', /→ 42\.5 in/.test(pointCell('Chest / Bust', 'Medium')));
ok('with the cost per piece', /\+0\.8 in .* per piece/.test(pointCell('Chest / Bust', 'Medium')));
ok('the hip too', /(\d+) sts/.test(pointCell('Hip', 'Medium')) && ((parseInt(pointCell('Hip', 'Medium').match(/(\d+) sts/)[1], 10) - 1) % 6 === 0));
ok('and the table says which piece decided it', /Chest \/ Bust rounded to BODY's 6 \+ 1/.test(tableText(0)));
no('the upper arm is untouched', /grade-actual/.test(rowHtml(tableText(0), 'Upper Arm')));
ok('and is still the plain count', /60 sts/.test(pointCell('Upper Arm', 'Medium')));
$('grade-sy-sleeve').value = 'sleeve'; $('grade-sy-sleeve').fire('change');
// 15 in at 4 sts/in is 60; 4n + 2 either side is 58 or 62, a tie, and a tie goes to the larger.
ok('typing the sleeve fits the upper arm to its repeat', /62 sts/.test(pointCell('Upper Arm', 'Medium')));
ok('naming the sleeve', /Upper Arm rounded to SLEEVE's 4 \+ 2/.test(tableText(0)));
ok('still exactly one table', tables().length === 1);
$('grade-sy-body').value = ''; $('grade-sy-body').fire('change');
$('grade-sy-sleeve').value = ''; $('grade-sy-sleeve').fire('change');
ok('untyping hands the bust back to the plain count', /82 sts/.test(pointCell('Chest / Bust', 'Medium')));
no('with nothing to say about rounding', /grade-actual|rounded to/.test(tableText(0)));

// Rows round to even on request, and the table says what that measures.
$('grade-row-parity').value = 'even'; $('grade-row-parity').fire('change');
ok('an even row count for the armhole', /18 rows/.test(pointCell('Armhole Depth', 'X-Small')));
ok('with the measurement it really gives', /→ 6\.0 in/.test(pointCell('Armhole Depth', 'X-Small')));
$('grade-row-parity').value = 'any'; $('grade-row-parity').fire('change');
ok('nearest-row rounding again', /19 rows/.test(pointCell('Armhole Depth', 'X-Small')));

print('\n19. A swatch measured in centimetres grades the same garment');
// The gauge inputs carry their own unit, but everything the grader works in is inches. A per-centimetre
// density used to be handed over as though per-inch, grading a 16-sts-per-10-cm fabric as 16 per 10 in
// and losing a third of every count.
function chestMedium() {
    var row = tableText(0).match(/<tr><th scope="row">Chest[\s\S]*?<\/tr>/)[0];
    return row.match(/<td>[\s\S]*?<\/td>/g)[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
ok('4 sts per in gives 82 sts for a Medium piece', /82 sts/.test(chestMedium()));

// The same fabric and the same +4 in of ease, both written in centimetres.
setVal('gauge-width', 10); setVal('gauge-height', 10);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('gauge-unit').value = 'cm'; $('gauge-unit').fire('change');
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 96.52); setVal('grade-finished', 106.68);
$('grade-chart').fire('change');
ok('the finished measurement is unchanged', /41\.0 in \/ 104\.1 cm/.test(chestMedium()));
// 16 sts per 10 cm is 4.06 per in, a shade finer than 4, so one stitch more.
ok('and the count agrees to a stitch', /83 sts/.test(chestMedium()));
no('not the third of a count it used to lose', /3[01] sts/.test(chestMedium()));

print('\n20. A washed swatch outranks the unwashed one');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('gauge-unit').value = 'in'; $('gauge-unit').fire('change');
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('grade-chart').fire('change');
ok('unwashed grades at 4 sts per in', /82 sts/.test(chestMedium()));

// 18 sts over the same 4 in swatch after blocking is 4.5 per in: 20.5 x 4.5 = 92. No other control is
// touched: editing the swatch must reach the grader by itself, or it goes on quoting counts worked out
// from the previous gauge.
setVal('gauge-washed-stitches', 18);
ok('the washed count is used straight away', /92 sts/.test(chestMedium()));
ok('and the summary says which swatch', /washed/.test(summary()));

// Only the stitch axis was measured after washing; the row gauge must not be lost.
ok('the row gauge survives', /22 rows/.test(tableText(0)));
setVal('gauge-washed-stitches', '');
ok('clearing it goes back to the unwashed swatch', /82 sts/.test(chestMedium()));
no('and the summary stops claiming washed', /washed/.test(summary()));

print('\n21. A standard chart is a baseline, not the truth about any one body');
function pointRow(label) {
    var m = tableText(0).match(new RegExp('<tr><th scope="row">' + label + '[\\s\\S]*?</tr>'));
    return m ? m[0].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : '';
}
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');

// The published figure is the placeholder, never the value: a box the designer filled in has to read
// differently from one the chart filled in, or neither can win cleanly.
ck('the chart figure is offered, not imposed', $('grade-ov-medium-chest').placeholder, '36-38');
ck('and the box itself is empty', $('grade-ov-medium-chest').value, '');
ok('Medium grades from the chart midpoint', /41\.0 in \/ 104\.1 cm/.test(pointRow('Chest / Bust')));

$('grade-ov-medium-chest').value = '40';
$('grade-ov-medium-chest').fire('input');
ok('an overridden measurement is used', /44\.0 in \/ 111\.8 cm/.test(pointRow('Chest / Bust')));
ok('and converts at the same gauge', /88 sts/.test(pointRow('Chest / Bust')));
ok('the sizes either side are untouched', /37\.0 in/.test(pointRow('Chest / Bust')) && /45\.0 in/.test(pointRow('Chest / Bust')));
$('grade-ov-medium-chest').value = '';
$('grade-ov-medium-chest').fire('input');
ok('clearing it hands the size back to the chart', /41\.0 in \/ 104\.1 cm/.test(pointRow('Chest / Bust')));

print('\n22. Custom and made-to-measure sizing');
$('grade-chart').value = 'custom'; $('grade-chart').fire('change');
ok('an unnamed custom chart says what it needs', /Name at least one custom size/.test($('grade-tables').innerHTML));
ck('and grades nothing yet', tables().length, 0);

setVal('grade-custom-sizes', 'Mine');
ck('naming one size gives one table', tables().length, 1);
// The column may carry the base-size class: with a pattern on the page, the one custom size is the
// size it is nearest to.
ok('the size is named as the designer named it', /<th[^>]*>Mine<\/th>/.test(tableText(0)));
// Nothing is published for a custom chart, so every measurement starts empty.
ck('no measurement is invented', $('grade-ov-mine-chest').placeholder, '');
ok('and nothing is graded until one is given', /&mdash;/.test(pointRow('Chest / Bust')));

$('grade-ov-mine-chest').value = '41';
$('grade-ov-mine-chest').fire('input');
ok('a width becomes stitches', /90 sts/.test(pointRow('Chest / Bust')));
ok('with the ease applied', /45\.0 in \/ 114\.3 cm/.test(pointRow('Chest / Bust')));

$('grade-ov-mine-armholedepth').value = '8';
$('grade-ov-mine-armholedepth').fire('input');
ok('a length becomes rows', /24 rows/.test(pointRow('Armhole Depth')));
no('and takes no ease', /12\.0 in/.test(pointRow('Armhole Depth')));

setVal('grade-custom-sizes', 'S, M, L');
ck('several names grade as a run of sizes', tableText(0).match(/<th(?: class="[^"]*")?>/g).length, 4);
ok('each one named', /<th[^>]*>S<\/th>/.test(tableText(0)) && /<th[^>]*>L<\/th>/.test(tableText(0)));

// The published charts must never be edited to accommodate a custom one.
setVal('grade-custom-sizes', '');
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
ck('Woman still has its nine sizes', A.CYC_BODY_MEASUREMENTS.woman.sizes.length, 9);
ck('and Medium is still the standard 36-38',
   A.CYC_BODY_MEASUREMENTS.woman.sizes.filter(function (s) { return s[0] === 'Medium'; })[0][1].chest.min
   + '-' + A.CYC_BODY_MEASUREMENTS.woman.sizes.filter(function (s) { return s[0] === 'Medium'; })[0][1].chest.max,
   '36-38');

print('\n23. The grader survives a save, and does not survive a New File');
// None of this used to persist, so a reopened project came back holding the previous project's ease,
// chart and overrides.
$('bulk-input').value = ['BODY',
    'Worked over a multiple of 6 + 1.',
    'Row 1: ch 44, sc in 2nd ch from hook and in each ch across (43)'].join('\n');
$('bulk-parse-btn').fire('click');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
setVal('gauge-washed-stitches', 18);
$('btn-calculate-gauge').fire('click');
setVal('grade-base-name', 'Medium');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
$('grade-rounding').value = 'up'; $('grade-rounding').fire('change');
$('grade-row-parity').value = 'even'; $('grade-row-parity').fire('change');
setVal('grade-sample-yards', 900);
setVal('grade-neck-depth', 3.5);
setVal('grade-con-neck', 22);
$('grade-ov-medium-chest').value = '40';
$('grade-ov-medium-chest').fire('input');
$('grade-sm-body').value = '8';
$('grade-sm-body').fire('input');

$('project-name').value = 'grader-roundtrip';
$('save-btn').fire('click');

$('new-file-btn').fire('click');
ck('New File clears the base size name', $('grade-base-name').value, '');
ck('and the body measurement', $('grade-body').value, '');
ck('and the finished measurement', $('grade-finished').value, '');
ck('and the chart', $('grade-chart').value, '');
ck('and the rounding choice', $('grade-rounding').value, 'nearest');
ck('and the row parity', $('grade-row-parity').value, 'any');
ck('and the sample yardage', $('grade-sample-yards').value, '');
ck('and the neck depth', $('grade-neck-depth').value, '');
ck('and the neck circumference', $('grade-con-neck').value, '');
ck('and the custom size names', $('grade-custom-sizes').value, '');
ck('and the washed gauge', $('gauge-washed-stitches').value, '');
// The pattern is gone, so the panel has nothing to describe and says so.
ok('the section panel is back to its placeholder',
   /Validate a pattern/.test($('grade-sections').text()));
// These are built at run time, so they are in neither index.html nor the static clear list - which means
// test-newfile.js, which harvests the page, cannot see them at all.
ck('the overridden measurement is cleared too', $('grade-ov-medium-chest').value, '');
ck('and the section multiple', $('grade-sm-body').value, '');

$('load-select').value = 'grader-roundtrip';
$('load-btn').fire('click');
ck('loading restores the base size name', $('grade-base-name').value, 'Medium');
ck('and the body measurement', $('grade-body').value, '38');
ck('and the finished measurement', $('grade-finished').value, '42');
ck('and the chart', $('grade-chart').value, 'woman');
ck('and the rounding choice', $('grade-rounding').value, 'up');
ck('and the row parity', $('grade-row-parity').value, 'even');
ck('and the sample yardage', $('grade-sample-yards').value, '900');
ck('and the neck depth', $('grade-neck-depth').value, '3.5');
ck('and the neck circumference', $('grade-con-neck').value, '22');
ck('and the washed swatch', $('gauge-washed-stitches').value, '18');
ck('and the overridden measurement', $('grade-ov-medium-chest').value, '40');
ck('and the section multiple', $('grade-sm-body').value, '8');
ok('the graded table reflects the restored override', /44\.0 in \/ 111\.8 cm/.test(tableText(0)));
ok('and the section panel the restored multiple', /43 over 8/.test(sectionText(0)));

// A save written before the grader existed must open, not throw.
var raw = JSON.parse(localStorage.getItem('stitchmath_saves'));
delete raw['grader-roundtrip'].grading;
localStorage.setItem('stitchmath_saves', JSON.stringify(raw));
$('new-file-btn').fire('click');
$('load-select').value = 'grader-roundtrip';
$('load-btn').fire('click');
ck('an older save opens with an empty grader', $('grade-chart').value, '');
no('and nothing broke', /NaN|undefined/.test($('grade-summary').innerHTML));

print('\n24. Ease per measurement carries its own unit');
$('new-file-btn').fire('click');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');

// Waist Medium is 29 in. The overall ease is +4 in, so it grades to 33.
ok('the overall ease reaches the waist', /33\.0 in/.test(pointRow('Waist')));
// 5.08 cm is 2 in, given in a different unit from the overall figure.
$('grade-pe-waist').value = '5.08';
$('grade-pe-waist-mode').value = 'cm';
$('grade-pe-waist').fire('input');
ok('a per-measurement ease in cm is read as cm', /31\.0 in/.test(pointRow('Waist')));
no('and is not mistaken for inches', /34\.1 in/.test(pointRow('Waist')));
ok('the bust keeps the overall ease in inches', /41\.0 in/.test(pointRow('Chest / Bust')));

$('grade-pe-waist-mode').value = 'percent';
$('grade-pe-waist').value = '10';
$('grade-pe-waist').fire('input');
// 29 in plus 10 per cent is 31.9.
ok('and as a percentage of that measurement', /31\.9 in/.test(pointRow('Waist')));
$('grade-pe-waist').value = '';
$('grade-pe-waist').fire('input');
ok('cleared, it goes back to the overall ease', /33\.0 in/.test(pointRow('Waist')));

print('\n25. Construction is part of what a base size is');
no('nothing is claimed when there is no pattern to read', /Construction/.test(summary()));
// There was a Construction Style dropdown feeding this. It is read off the pattern's own labels now,
// so the way to change what the grader reports is to change the pattern - which is the point: the
// summary can no longer disagree with the document it is summarising.
$('bulk-input').value = 'Rnd 1: 6 sc in magic ring (6)\nRnd 2: inc in each st (12)\nRnd 3: sc in each st (12)';
$('bulk-parse-btn').fire('click');
ok('the construction it was read as is shown', /Construction: Rounds \(Spiral\)/.test(summary()));
ok('alongside the gauge', /Gauge:/.test(summary()));
// Not asked for a second time, and now not asked for at all.
no('and there is no dropdown to ask it with', /id="meta-construction"/.test(readFile('index.html')));

print('\n26. The schematic, and the working behind a measurement');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');

ok('a schematic is drawn', $('grade-schematic').children.length > 0);
ok('with a hit target on the bust', !!$('grade-pt-chest'));
ok('and on the armhole', !!$('grade-pt-armholedepth'));
ok('it opens on something rather than a blank box',
   /Chest \/ Bust/.test($('grade-point-detail').children[0].textContent));

function detail() { return $('grade-point-detail').text().replace(/\s+/g, ' '); }
$('grade-pt-chest').fire('click');
// The panel shows the engine's own trace rather than a second set of lines built here, so every step it
// lists is a step the grader actually took.
ok('the body measurement it started from', /Body chest \/ bust/.test(detail()));
ok('the ease applied', /Selected ease/.test(detail()));
ok('the finished circumference', /Finished circumference/.test(detail()));
ok('how much of it this piece carries', /Piece allocation/.test(detail()));
ok('the target for the piece', /Target chest \/ bust width/.test(detail()));
ok('the gauge used', /Gauge/.test(detail()));
ok('the count before rounding', /Raw count/.test(detail()));
ok('the count after', /Final count/.test(detail()));
ok('what that count actually measures', /Actual chest \/ bust width/.test(detail()));
ok('and the ease it really produces', /Actual total ease/.test(detail()));

// Medium: 37 in body, +4 ease, 41 in finished, half of it is 20.5 in, 82 sts at 4/in.
ok('Medium starts from the chart midpoint', /37 in/.test(detail()));
ok('half the circumference per piece', /50%/.test(detail()));
ok('and 82 stitches come out of it', /82 sts/.test(detail()));

// Clicking another point moves the panel to it.
$('grade-pt-armholedepth').fire('click');
ok('the panel follows the click', /Armhole Depth/.test($('grade-point-detail').children[0].textContent));
ok('a length reports rows, not stitches', /rows\/in/.test(detail()));
no('a length is not divided between two pieces', /Piece allocation/.test(detail()));
no('and carries no stitch multiple', /Required multiple/.test(detail()));
// The X-Small armhole targets 6.3 in, which at 3 rows per in is 18.9 - not a number of rows anyone works,
// which is the whole reason the rounded line sits beside it.
ok('the count before rounding is shown', /18\.9 rows/.test(detail()));
ok('and what it rounded to', /19 rows/.test(detail()));
ok('with what that actually measures', /Actual armhole depth/.test(detail()));
ok('and how far off the target that lands', /Actual difference/.test(detail()));

print('\n27. How a measurement grades');
ok('every measurement offers the four modes',
   /graded/.test($('grade-dm-chest').text()) && /locked/.test($('grade-dm-chest').text())
   && /derived/.test($('grade-dm-chest').text()) && /manual/.test($('grade-dm-chest').text()));
ok('and every measurement says what a change to it reaches',
   /reaches Waist, Hip, Cross Back/.test($('grade-custom-chart').text())
   && /reaches Center Back Neck-to-Wrist/.test($('grade-custom-chart').text()));
ok('and a derived one names its source',
   /from Chest \/ Bust/.test($('grade-custom-chart').text()));

setVal('grade-base-name', 'Medium');
$('grade-dm-armholedepth').value = 'locked';
$('grade-dm-armholedepth').fire('change');
var armRow = tableText(0).match(/<tr><th scope="row">Armhole Depth[\s\S]*?<\/tr>/)[0];
ok('a locked measurement says so in the table', /locked/.test(armRow));
ck('and holds one value in every size',
   (armRow.match(/22 rows/g) || []).length, 9);
no('while the bust still grades',
   /locked/.test(tableText(0).match(/<tr><th scope="row">Chest \/ Bust[\s\S]*?<\/tr>/)[0]));
$('grade-dm-armholedepth').value = 'graded';
$('grade-dm-armholedepth').fire('change');
ok('unlocking grades it again',
   /19 rows/.test(tableText(0).match(/<tr><th scope="row">Armhole Depth[\s\S]*?<\/tr>/)[0]));

print('\n28. The grading report');
function report() { return $('grade-report').text().replace(/\s+/g, ' '); }
ok('a grading report is shown', /Grading report/.test(report()));
ok('with the increments between sizes', /X-Small→Small/.test(report()));
ok('the bust grading by four inches', /\+4"/.test(report()));

// A three-size pattern whose top two sizes come out identical. 43 fits a 6 + 1 repeat; 50 does not, and
// the top two sizes are the same size.
$('bulk-input').value = ['BACK', 'Worked over a multiple of 6 + 1.',
    'Row 1: ch 44 (51, 51), sc in 2nd ch from hook and in each ch across (43, 50, 50)',
    'Row 2: ch 1, turn, sc in each st across (43, 50, 50)'].join('\n');
$('bulk-parse-btn').fire('click');
ok('every size the pattern writes is compiled', /Consumed/.test(report()));
ok('with what it starts and ends on', /Starts/.test(report()) && /Ends/.test(report()));
ok('two sizes finishing the same is caught', /come out identical/.test(report()));
ok('naming them', /Medium.*and Large.*finish on the same count/.test(report()));
// The stitch multiple has to hold in every size, not only the base one.
ok('a size breaking the repeat is caught', /breaks the stitch multiple/.test(report()));
ok('and it is reported, never corrected',
   /50 sts does not fit 6 \+ 1/.test(report()));

print('\n29. The section model and the modes survive a save');
$('bulk-input').value = ['BACK',
    'Row 1: ch 44, sc in 2nd ch from hook and in each ch across (43)',
    'Row 2: ch 1, turn, sc in each st across (43)',
    'SLEEVE',
    'Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)'].join('\n');
$('bulk-parse-btn').fire('click');
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');

// What kind of piece each section is, what it joins to, and how it shapes: the three things about a
// garment that cannot be read out of the pattern text.
$('grade-sy-back').value = 'back'; $('grade-sy-back').fire('change');
$('grade-sj-back').value = 'sleeve'; $('grade-sj-back').fire('change');
$('grade-sh-back').value = 'raglan'; $('grade-sh-back').fire('change');
$('grade-dm-armholedepth').value = 'locked'; $('grade-dm-armholedepth').fire('change');

$('project-name').value = 'garment-model';
$('save-btn').fire('click');
$('new-file-btn').fire('click');
ck('New File clears the piece type', $('grade-sy-back').value, '');
ck('and the dimension mode', $('grade-dm-armholedepth').value, '');

$('load-select').value = 'garment-model';
$('load-btn').fire('click');
ck('the piece type comes back', $('grade-sy-back').value, 'back');
ck('and what it joins to', $('grade-sj-back').value, 'sleeve');
ck('and how it shapes', $('grade-sh-back').value, 'raglan');
ck('and the dimension mode', $('grade-dm-armholedepth').value, 'locked');
ok('with the locked measurement still locked',
   /locked/.test(tableText(0).match(/<tr><th scope="row">Armhole Depth[\s\S]*?<\/tr>/)[0]));

print('\n30. Motifs, generation and export, through the page');
$('new-file-btn').fire('click');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('bulk-input').value = ['BACK', 'Worked over a multiple of 6 + 1.',
    'Row 1: ch 68, sc in 2nd ch from hook and in each ch across (67)',
    'Row 2: ch 1, turn, sc in each st across (67)'].join('\n');
$('bulk-parse-btn').fire('click');
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');

// Motifs grade against the same finished measurement the tables use.
setVal('motif-size', 4);
setVal('motif-join', 0.25);
var motif = $('motif-output').text().replace(/\s+/g, ' ');
ok('a motif layout is offered per size', /Medium/.test(motif));
// Medium is 20.5 in per piece; five 4 in motifs with four quarter-inch joins is 21 in.
ok('five motifs across a Medium', / 5 \| 21\.0 in/.test(motif));
ok('with the difference from the target', /\+0\.5 in/.test(motif));
ok('and the border that would close it', /-0\.3 in/.test(motif));
ck('no motif size, no layout',
   (function () { setVal('motif-size', ''); var t = $('motif-output').text(); setVal('motif-size', 4); 
                  return /Enter the size of one motif/.test(t); })(), true);

print('\n31. Confidence, yarn and time per size');
var gen = $('gen-output').text().replace(/\s+/g, ' ');
ok('a confidence figure per size', /\d+%/.test(gen));
ok('with the main issue named', /unresolved warning|nothing outstanding|extrapolated/.test(gen));
ok('yarn per size', /yd/.test(gen));
// Derived from each size's own generated counts, so the percentages differ by size.
ok('and how much more than the base size', /\+\d+(\.\d+)?%/.test(gen));

print('\n31b. Yardage measured from the sample');
// Until the designer says what the sample used, the yards come from the yarn-weight table and the
// panel says so. Given the figure, every size is measured from it: 900 yd over the stitches the
// pattern works is one figure a stitch, and the base size - those same stitches - comes back as the
// 900 yd it used plus the 15% buffer, 1035.
ok('the table is the source until a sample is given', /from the yarn-weight table/.test(gen));
setVal('grade-sample-yards', 900);
gen = $('gen-output').text().replace(/\s+/g, ' ');
ok('then the sample is', /Yarn: from your sample, [\d.]+ yd per stitch/.test(gen));
ok('and the base size is measured from it', /X-Small \| \d+% \| 1035 yd/.test(gen));
setVal('grade-sample-yards', '');
gen = $('gen-output').text().replace(/\s+/g, ' ');
ok('clearing it goes back to the table', /from the yarn-weight table/.test(gen));

print('\n32. Generated multi-size instructions');
ok('the pattern is restated across the sizes', /Row 1: /.test(gen));
ok('in parenthetical notation', /67 \(/.test(gen));
$('gen-notation').value = 'bracket'; $('gen-notation').fire('change');
ok('brackets when asked for', /67 \[/.test($('gen-output').text()));
$('gen-notation').value = 'parenthetical'; $('gen-notation').fire('change');
// Every generated count has to hold the repeat the written one held.
var counts = ($('gen-output').text().match(/67 \(([^)]+)\)/) || [, ''])[1]
    .split(',').map(function (n) { return parseInt(n, 10); });
ok('every generated count fits the 6 + 1 repeat',
   counts.length > 0 && counts.every(function (n) { return (n - 1) % 6 === 0; }));

// A construction the generator has not been built for says so rather than guessing.
$('gen-construction').value = 'raglan'; $('gen-construction').fire('change');
ok('a construction the generator has not been built for explains itself', /Not generated/.test($('gen-output').text()));
ok('naming what it would need', /yoke depth and four seam lines/.test($('gen-output').text()));
$('gen-construction').value = 'drop'; $('gen-construction').fire('change');
ok('and drop shoulder generates again', /Row 1: /.test($('gen-output').text()));

print('\n33. A pattern written in a size other than the first');
// The 67-stitch pattern above happened to grade as an X-Small, so its written count and the first
// size's target were the same number and either reading looked right. This one is a Medium: 80 sts
// where the chart grades Medium at 82, Large at 90. Every count the generator writes has to be the
// WRITTEN count scaled by the ratio between sizes - the Medium column verbatim - and not the chart's
// target restated on every row, which is what put 82 where the designer wrote 80 and gave a decrease
// row the same count as the straight rows around it.
function genText() { return $('gen-output').text(); }
function genRow(n) { return (genText().match(new RegExp('Row ' + n + ':[^\\n]*')) || [''])[0]; }
function genNote() { return (genText().match(/Graded as[^\n]*/) || [''])[0].replace(/\s+/g, ' '); }
// The base size as the page shows it: the marked column of the graded table.
function baseCol() { return (tableText(0).match(/class="grade-base-col">([^<]*)</) || [, ''])[1]; }
$('bulk-input').value = ['BACK',
    'Row 1: ch 81, sc in 2nd ch from hook and in each ch across (80)',
    'Row 2: ch 1, turn, sc in each st across (80)',
    'Row 3: ch 1, turn, sc2tog, sc in each st across to last 2 sts, sc2tog (78)',
    'Row 4: ch 1, turn, sc in each st across (78)',
    'SLEEVE',
    'Row 1: ch 33, sc in 2nd ch from hook and in each ch across (32)',
    'Row 2: ch 1, turn, 2 sc in first st, sc in each st across to last st, 2 sc in last st (34)'].join('\n');
$('bulk-parse-btn').fire('click');

// Nothing typed: the base is read off the pattern, and the reading is said.
ck('nothing typed reads the size off the widest row', baseCol(), 'Medium');
ok('and says so under the run', /Read as Medium: its widest row is 80 sts/.test(genNote()));
ok('with the way to change it', /Type the base size name/.test(genNote()));

setVal('grade-base-name', 'Medium');
ok('naming it is the answer, not a reading', /Written in Medium, as named/.test(genNote()));
ok('the written size is written back verbatim', /\(64 \(72, 80, 88, 96, 103, 111, 119, 127\)\)/.test(genRow(1)));
ok('so 80 is 80 in the Medium column, not the chart\'s 82', /72, 80, 88/.test(genRow(1)));
ok('a straight row stays at the row above', genRow(2).slice(-40) === genRow(1).slice(-40));
ok('a decrease of two is two in every size', /\(62 \(70, 78, 86, 94, 101, 109, 117, 125\)\)/.test(genRow(3)));
ok('and the row after the decrease holds', genRow(4).slice(-40) === genRow(3).slice(-40));
// The sleeve is a second piece, scaled from its own first row and then chained.
var sleeve = genText().split('SLEEVE')[1] || '';
ok('the sleeve scales from its own first row', /\(26 \(29, 32, 35, 38, 41, 44, 48, 51\)\)/.test(sleeve));
ok('and its increase of two is two in every size', /\(28 \(31, 34, 37, 40, 43, 46, 50, 53\)\)/.test(sleeve));

// Yarn and time compare against the size the pattern is written in, not the first size graded.
var confidence = genText().split('Generated instructions')[0].replace(/\s+/g, ' ');
ok('the Medium is the yardage base', /Medium \| \d+% \| \d+ yd \| \d+ \| [\d.]+ \| 0% /.test(confidence));
ok('and X-Small needs less', /X-Small \| \d+% \| \d+ yd \| \d+ \| [\d.]+ \| -\d/.test(confidence));

// The name in any spelling a designer uses.
setVal('grade-base-name', 'L');
ck('"L" is Large', baseCol(), 'Large');
ok('and the run is written from Large', /\(59 \(66, 73, 80, 87, 94, 101, 108, 116\)\)/.test(genRow(1)));
setVal('grade-base-name', 'XXL');
ck('"XXL" is 2X', baseCol(), '2X');
setVal('grade-base-name', 'extra large');
ck('"extra large" is X-Large', baseCol(), 'X-Large');
setVal('grade-base-name', 'med');
ck('"med" is Medium', baseCol(), 'Medium');

// A typo does not silently become a size.
setVal('grade-base-name', 'Medum');
ok('a name that is no size is reported', /"Medum" is not a size on this chart/.test(genNote()));
ok('alongside what was used instead', /Read as Medium/.test(genNote()));

// A base size that is on the chart but not being graded is not quietly swapped for another.
setVal('grade-base-name', 'Medium');
$('grade-size-medium').checked = false; $('grade-size-medium').fire('change');
ok('the run is not generated', /Not generated: Medium is not among the sizes being graded/.test(genText()));
ok('and says what to do', /Tick it under "Sizes to grade"/.test(genText()));
ck('so the export has nothing to offer', $('export-instructions').text(), 'nothing to export');
$('grade-size-medium').checked = true; $('grade-size-medium').fire('change');
ok('ticking it back generates again', /72, 80, 88/.test(genRow(1)));

// A pattern that already writes several sizes is generated from the one being validated.
setVal('grade-base-name', '');
$('bulk-input').value = ['BACK',
    'Row 1: ch 65 (73, 81), sc in 2nd ch from hook and in each ch across (64, 72, 80)',
    'Row 2: ch 1, turn, sc in each st across (64, 72, 80)'].join('\n');
$('bulk-parse-btn').fire('click');
ok('the first written size is the base by default, being the one validated',
   /Written in Small, the size being validated/.test(genNote()));
$('meta-size').value = '1'; $('meta-size').fire('change');
ck('validating the second size makes it the base', baseCol(), 'Medium');
ok('and the run is generated from its counts', /\(58 \(65, 72, 79, 86, 93, 100, 107, 114\)\)/.test(genRow(1)));
ok('saying which', /Written in Medium, the size being validated/.test(genNote()));
$('meta-size').value = '0'; $('meta-size').fire('change');

print('\n33b. A tapered sleeve is regraded as a rule, by its own measurements');
// Written in Medium: 32 sts, increase 2 every 4th row 7 times from Row 3 - 46 sts on Row 27 - then two
// rows straight. Every size used to get the same +14 over the same rows; a Large sleeve never reached a
// Large upper arm. Now the run is a rule whose three numbers all grade.
var taper = ['BACK',
    'Row 1: ch 81, sc in 2nd ch from hook and in each ch across (80)',
    'Row 2: ch 1, turn, sc in each st across (80)',
    'SLEEVE',
    'Row 1: ch 33, sc in 2nd ch from hook and in each ch across (32)',
    'Row 2: ch 1, turn, sc in each st across (32)'];
(function () {
    var c = 32;
    for (var r = 3; r <= 27; r++) {
        if ((r - 3) % 4 === 0) { c += 2; taper.push('Row ' + r + ': ch 1, turn, 2 sc in first st, sc in each st across to last st, 2 sc in last st (' + c + ')'); }
        else taper.push('Row ' + r + ': ch 1, turn, sc in each st across (' + c + ')');
    }
})();
taper.push('Rows 28-29: ch 1, turn, sc in each st across (46)');
function sleeveText() { return genText().split('SLEEVE')[1] || ''; }
function ruleLine() { return (sleeveText().match(/Rows 4-[^\n]*/) || [''])[0]; }
setVal('grade-base-name', 'Medium');
$('bulk-input').value = taper.join('\n');
$('bulk-parse-btn').fire('click');

// Untyped, the sleeve grades by the bust like everything else - and the note says how to do better.
ok('the shaping row is printed', /Row 3: ch 1, turn, 2 sc in first st[^\n]*\(28 \(31, 34, 37/.test(sleeveText()));
ok('the rows it recurs over are one rule', /^Rows 4-27: ch 1, turn, sc in each st across, working Row 3 again every/.test(ruleLine()));
ok('and not rows', !/Row 7: /.test(sleeveText()) && !/Row 27: /.test(sleeveText()));
ok('the written size keeps its spacing', /every 4th \(4th, 4th, 3rd/.test(ruleLine()));
ok('and its count of repeats', / 5 \(5, 6, 7/.test(ruleLine()) && /more times/.test(ruleLine()));
ok('ending on its written count', /\(38 \(41, 46, 51/.test(ruleLine()));
ok('the rows after the rule carry each size\'s own end', /Row 28: [^\n]*\(38 \(41, 46, 51/.test(sleeveText()));
ok('the note says what to set', /Set a piece's type under Sections/.test(genNote()));
ok('and that row numbers after a rule are the base size\'s', /Row numbers after a graded run are the base size's/.test(genNote()));

// Typed as a sleeve, it grades by the upper arm and the arm length: the sleeve of a Large is wider
// AND longer, so its rule reaches further, over more rows, and the row range says so per size.
// The upper arm is the whole arm - a sleeve is one piece around it - so the X-Small cuff is 29, from
// 32 x 28/32: the full 13.75 in at 4 sts/in is 55, not a halved 6.9 in rounded to 28.
$('grade-sy-sleeve').value = 'sleeve'; $('grade-sy-sleeve').fire('change');
ok('the cuff scales by the upper arm, not the bust', /Row 1: [^\n]*\(29 \(30, 32, 34, 37/.test(sleeveText()));
ok('the rows the rule spans grade by the arm length', /^Rows 4-27 \(4-27, 4-27, 4-28, 4-28/.test(ruleLine()));
ok('the written size is still exact', /every 4th \(4th, 4th, 3rd/.test(ruleLine()) && / 6 \(6, 6, 7/.test(ruleLine()));
ok('ending on the upper arm', /\(43 \(44, 46, 50, 53/.test(ruleLine()));
ok('with the straight rows left over per size', /then 0 \(0, 0, 4, 4/.test(ruleLine()));
ok('the back is untouched by the sleeve\'s type', /Row 1: ch 81[^\n]*\(64 \(72, 80, 88/.test(genText()));
ok('the note still asks while the back is untyped', /Set a piece's type under Sections/.test(genNote()));
$('grade-sy-back').value = 'back'; $('grade-sy-back').fire('change');
no('and stops once every piece has one', /Set a piece's type under Sections/.test(genNote()));
ok('a back grades by the bust, as before', /Row 1: ch 81[^\n]*\(64 \(72, 80, 88/.test(genText()));
$('grade-sy-back').value = ''; $('grade-sy-back').fire('change');
ok('the export carries the rule', /working Row 3 again every/.test(state_generated()));
function state_generated() { BLOBS.length = 0; $('export-instructions').fire('click'); return BLOBS[0] || ''; }

// The tech editor's validation row: per typed piece, per size, does it reach the width it was graded
// to. The sleeve written at 46 sts is 11.5 in around; graded with the bust's +4 in of ease the Medium
// upper arm is 15 in, 60 sts, and the report says so rather than adjusting either.
function report() { return $('grade-report').text().replace(/\s+/g, ' '); }
ok('the report has a row per typed piece', /Per size, per piece/.test(report()) && /SLEEVE width/.test(report()));
ok('and says where a size misses its graded width', /46 sts, 60 needed \(-3\.5 in\)/.test(report()));
ok('as a finding against that size', /Medium: SLEEVE misses its target width/.test(report()));
ok('the rows it works are checked too', /SLEEVE rows/.test(report()));
BLOBS.length = 0; $('export-editing').fire('click');
ok('the editing report carries the same row', /Per size, per piece:/.test(BLOBS[0]) && /SLEEVE at Medium: 46 sts, 60 needed/.test(BLOBS[0]));

// Unevenly written shaping is redistributed, and that is said rather than done quietly.
var uneven = taper.slice(0, 5);
(function () {
    var c = 32, at = [3, 6, 10, 13, 17, 20, 24];
    for (var r = 2; r <= 27; r++) {
        if (at.indexOf(r) >= 0) { c += 2; uneven.push('Row ' + r + ': ch 1, turn, 2 sc in first st, sc in each st across to last st, 2 sc in last st (' + c + ')'); }
        else uneven.push('Row ' + r + ': ch 1, turn, sc in each st across (' + c + ')');
    }
})();
$('bulk-input').value = uneven.join('\n');
$('bulk-parse-btn').fire('click');
ok('uneven spacing is redistributed and said', /not evenly spaced; every size, including Medium/.test(ruleLine()));
ok('over the same rows to the same count', /^Rows 4-24 \([^)]*\)[^\n]*\(43 \(44, 46/.test(ruleLine()));
$('grade-sy-sleeve').value = ''; $('grade-sy-sleeve').fire('change');

// Back to the single-size pattern the sections below were written against.
$('bulk-input').value = ['BACK', 'Worked over a multiple of 6 + 1.',
    'Row 1: ch 68, sc in 2nd ch from hook and in each ch across (67)',
    'Row 2: ch 1, turn, sc in each st across (67)'].join('\n');
$('bulk-parse-btn').fire('click');

print('\n34. The export package');
var exportRows = $('export-package').text().replace(/\s+/g, ' ');
['Finished-measurement table', 'Body-measurement table', 'Schematic labels',
 'Multi-size instructions', 'Grading calculation report',
 'Technical-editing report', 'Stitch Math project file'].forEach(function (name) {
    ok('the package offers the ' + name.toLowerCase(), exportRows.indexOf(name) !== -1);
});
no('and no longer a tester worksheet', /Tester worksheet/.test(exportRows));

// Each artefact is what it says it is, so each is checked by downloading it.
BLOBS.length = 0;
$('export-finished').fire('click');
ok('the finished table is CSV', /Measurement,X-Small/.test(BLOBS[0]));
ok('with a row per measurement', /"Chest \/ Bust"/.test(BLOBS[0]));
BLOBS.length = 0;
$('export-calc').fire('click');
ok('the calculation report shows the working', /Body chest \/ bust/.test(BLOBS[0]));
ok('every step of it', /Actual total ease/.test(BLOBS[0]));
BLOBS.length = 0;
$('export-editing').fire('click');
ok('the editing report lists what is unresolved', /TECHNICAL-EDITING REPORT/.test(BLOBS[0]));
no('and carries no tester section', /From testers|In their own words/.test(BLOBS[0]));
BLOBS.length = 0;
$('export-json').fire('click');
ok('the JSON parses', (function () { try { JSON.parse(BLOBS[0]); return true; } catch (e) { return false; } })());
ok('and carries the graded garment', /"garment"/.test(BLOBS[0]));

// No row-by-row check can see this class of fault: every row of a raglan yoke can consume exactly what
// the row before it produced - the stitch math perfect, the health score 100 - and the yoke still be
// impossible, because a raglan gains eight stitches a round and 63 is not a multiple of eight. This is
// CheckGarmentConstruction reached through the Grader, held to the same Construction field the generated
// instructions above read - moved here from the Construction tab on 2026-08-14, once that stopped being its only door.
function has(l, haystack, needle) { ck(l + ' — looked for "' + needle + '"', String(haystack).indexOf(needle) !== -1, true); }
function typeSections(map) {
    Object.keys(map).forEach(function (key) {
        $('grade-sy-' + key).value = map[key];
        $('grade-sy-' + key).fire('change');
    });
}

print('\n35. The construction check, wired to a real pattern');
$('new-file-btn').fire('click');
ok('with no pattern open there is nothing to reach',
   /No pattern is open/.test($('grade-construction-result').text()));

// 5 rows per inch, so the yoke-depth line below has a known gauge to work at rather than whatever an
// earlier section left on screen.
$('gauge-width').value = '4'; $('gauge-height').value = '4';
$('gauge-stitches').value = '16'; $('gauge-rows').value = '20';
$('gauge-width').fire('input');

var RAGLAN = [
    'YOKE',
    'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
    'Row 2: ch 1, turn, [inc in next st] x 8, sc in each st across (20)',
    'Row 3: ch 1, turn, [inc in next st] x 8, sc in each st across (28)',
    'Row 4: ch 1, turn, [inc in next st] x 8, sc in each st across (36)',
    'BODY',
    'Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)',
    'Row 2: ch 1, turn, sc in each st across (20)',
    'SLEEVE',
    'Row 1: ch 9, sc in 2nd ch from hook and in each ch across (8)',
    'Row 2: ch 1, turn, sc in each st across (8)'
];
$('bulk-input').value = RAGLAN.join('\n');
$('bulk-parse-btn').fire('click');
has('untyped, the panel still lists the pieces it can see', $('grade-construction-pieces').text(), 'YOKE');
has('and says which have no type', $('grade-construction-pieces').text(), 'no type set');

typeSections({ yoke: 'yoke', body: 'body', sleeve: 'sleeve' });
$('gen-construction').value = 'raglan'; $('gen-construction').fire('change');
var checkSeen = $('grade-construction-result').text();
has('the planner that answered is named', checkSeen, 'PlanRaglanYoke');
has('the yoke is measured against its own pieces', checkSeen, 'the yoke ends at 36 sts');
has('which is the body plus two sleeves', checkSeen, 'the body (20) and two sleeves of 8');
has('the total gain is a multiple of eight', checkSeen, 'increase 8 stitches every row 3 times');
has('and every round adds eight', checkSeen, 'all 3 increase rounds add exactly eight');
// The engine is the authority on the verdict; the panel only has to show it.
var live = A.CheckGarmentConstruction({
    construction: 'raglan', rowsPerInch: 5,
    sections: [
        { title: 'YOKE', type: 'yoke', widestStitches: 36,
          worked: [{ label: 'Row 1', count: 12 }, { label: 'Row 2', count: 20 },
                   { label: 'Row 3', count: 28 }, { label: 'Row 4', count: 36 }] },
        { title: 'BODY', type: 'body', widestStitches: 20,
          worked: [{ label: 'Row 1', count: 20 }, { label: 'Row 2', count: 20 }] },
        { title: 'SLEEVE', type: 'sleeve', widestStitches: 8,
          worked: [{ label: 'Row 1', count: 8 }, { label: 'Row 2', count: 8 }] }
    ]
});
ck('the engine calls the pattern sound', live.state, 'pass');
live.checks.forEach(function (c) {
    has('"' + c.name + '" reaches the panel whole', checkSeen, c.detail);
});

print('\n35b. The same pattern, one round short of a raglan');
// Row 4 adds seven instead of eight. Every row still adds up - a garment fault, not a stitch-math one,
// and the row-by-row matrix has nothing to say about it.
var LIMP = RAGLAN.slice();
LIMP[4] = 'Row 4: ch 1, turn, [inc in next st] x 7, sc in each st across (35)';
$('bulk-input').value = LIMP.join('\n');
$('bulk-parse-btn').fire('click');
typeSections({ yoke: 'yoke', body: 'body', sleeve: 'sleeve' });
ck('the pattern itself is clean row by row',
   $('cumulative-status').text().indexOf('FAIL') === -1, true);
var limpSeen = $('grade-construction-result').text();
has('but the yoke no longer meets its pieces', limpSeen, 'the yoke is -1 sts');
has('and the round that fell short is named', limpSeen, 'Row 4 adds 7');

print('\n35c. The Construction field above drives the check');
// The same pattern read as a set-in sleeve. Its body is two flat rows, so there is no armhole shaped into
// it - which is exactly the finding, not a failure to check.
$('gen-construction').value = 'setIn'; $('gen-construction').fire('change');
has('read as a set-in sleeve, the body has no armhole', $('grade-construction-result').text(),
    'does not end by decreasing');
has('and the planner is named accordingly', $('grade-construction-result').text(), 'PlanSetInSleeve');
// One field, one check. There is no second construction control to disagree with it.
$('gen-construction').value = 'yoke'; $('gen-construction').fire('change');
has('switching it re-checks as a circular yoke', $('grade-construction-result').text(),
    'PlanCircularYoke');
$('gen-construction').value = 'raglan'; $('gen-construction').fire('change');
has('and back again', $('grade-construction-result').text(), 'PlanRaglanYoke');

print('\n36. Neck, shoulders and armholes, through the page');
// Planned per size from the graded cross back: a Medium's 15.75 in at 4 sts/in is 63 sts, so its
// neck is 31. The depth and the drop are asked for, in the neck panel's own unit, because the chart
// carries neither; a blank field is the figure its placeholder shows.
$('new-file-btn').fire('click');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
$('btn-calculate-gauge').fire('click');
setVal('grade-body', 38); setVal('grade-finished', 42);
$('bulk-input').value = ['BACK',
    'Row 1: ch 86, sc in 2nd ch from hook and in each ch across (85)',
    'Row 2: ch 1, turn, sc in each st across (85)'].join('\n');
$('bulk-parse-btn').fire('click');
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
function neckText() { return $('grade-neck-output').text().replace(/\s+/g, ' '); }
function neckRow(label) { return (neckText().match(new RegExp(label + '((?: \\| [^|]*){9})')) || [, ''])[1]; }
ok('a table of plans per size', /Neck stitches/.test(neckText()) && /Shoulder steps/.test(neckText()));
ck('the Medium neck is half its cross back', neckRow('Neck stitches').split('|')[3].trim(), '31');
ck('a 3 in default depth at 3 rows/in', neckRow('Neck depth \\(rows\\)').split('|')[3].trim(), '9');
setVal('grade-neck-depth', 4);
ck('a deeper neck has more rows', neckRow('Neck depth \\(rows\\)').split('|')[3].trim(), '12');
ok('each plan is said per size', /Medium: Leave the centre/.test(neckText()) || /Medium: \d+ decreases at each neck edge do not fit/.test(neckText()));
ok('and a plan that cannot be worked says so rather than moving a number',
   /do not fit in the \d+ rows of the shaping zone/.test(neckText()));
BLOBS.length = 0; $('export-calc').fire('click');
ok('the calculation report carries the plans', /--- Neck, shoulders and armholes ---/.test(BLOBS[0]) && /Shoulder: Slip stitch across/.test(BLOBS[0]));

print('\n37. The construction planned per size, from the graded cells');
// The Construction tab's planners take one size's counts by hand. Here they run for every size from
// the graded bust, upper arm, cross back and armhole depth, for the construction chosen under
// Generated instructions, and ask only for what no chart carries.
function con() { return $('grade-construction-output').text().replace(/\s+/g, ' '); }
$('gen-construction').value = 'drop'; $('gen-construction').fire('change');
ok('a drop shoulder has nothing to plan and says so', /no yoke or cap to plan/.test(con()));
$('gen-construction').value = 'raglan'; $('gen-construction').fire('change');
ok('a raglan needs the neck circumference and says so', /Needs the neck circumference/.test(con()));
ok('while the graded figures are already there', /Yoke rows \| 19 \| 20 \| 22/.test(con()));
setVal('grade-con-neck', 23);
ok('given the neck, the separation follows per size', /Separation stitches \| 242 \| 262 \| 284/.test(con()));
ok('and a yoke the depth cannot hold is a finding per size', /Medium: Yoke, 92 to 284 sts[^|]*shaping rows are needed/.test(con()));
$('gen-construction').value = 'setIn'; $('gen-construction').fire('change');
ok('a set-in sleeve compares the cap edge with the armhole edge per size', /Cap edge vs armhole edge \| 5 \/ 6\.33 in/.test(con()));
ok('and reports every part that cannot be worked, not the first', /X-Small: Armhole: 3 stitches cannot be worked 2 at a time/.test(con()) && /X-Small: Cap: 43 stitches cannot be worked 2 at a time/.test(con()));
setVal('grade-con-cap-height', 7);
ok('the cap height is the designer\'s to set', /Cap rows \| 21/.test(con()));
$('gen-construction').value = 'yoke'; $('gen-construction').fire('change');
ok('a circular yoke spreads its increases per size', /Stitches added \| \+\d+, \+\d+, \+\d+ \| \+\d+, \+\d+, \+\d+/.test(con()));
ok('each round said in the engine\'s words', /Round \d+: 92 → \d+ sts, \+\d+ \(every/.test(con()));
BLOBS.length = 0; $('export-calc').fire('click');
ok('the calculation report carries the construction', /--- Construction per size: Circular yoke ---/.test(BLOBS[0]));
$('gen-construction').value = 'drop'; $('gen-construction').fire('change');

endSuite();
