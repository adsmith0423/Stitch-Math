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
ck('and the same numbers', tableText(0), before);
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
// nothing derived from the pattern text may appear in it.
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
ok('still exactly one table', tables().length === 1);
no('no section name in it', /BODY|SLEEVE/.test(tableText(0)));
no('no repeat in it', /over 6 \+ 1|does not fit/.test(tableText(0)));
no('and no rounding note', /Rounds to/.test(tableText(0)));

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
ok('the size is named as the designer named it', /<th>Mine<\/th>/.test(tableText(0)));
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
ck('several names grade as a run of sizes', tableText(0).match(/<th>/g).length, 4);
ok('each one named', /<th>S<\/th>/.test(tableText(0)) && /<th>L<\/th>/.test(tableText(0)));

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
ck('and the custom size names', $('grade-custom-sizes').value, '');
ck('and the washed gauge', $('gauge-washed-stitches').value, '');
// The pattern is gone, so the panel has nothing to describe and says so.
ok('the section panel is back to its placeholder',
   /Parse a pattern/.test($('grade-sections').text()));
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

print('\n30. Motifs, testers, generation and export, through the page');
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

print('\n33. Tester feedback through the page');
setVal('tester-name', 'Rae');
$('tester-size').value = 'Medium';
setVal('tester-finished-bust', 43.5);
setVal('tester-gauge', 3.7);
$('tester-fit-arm').value = 'tight';
setVal('tester-notes', 'added 2 rows to the sleeve');
setVal('tester-freeform', 'Ran big at the bust.\nLoved the cuff.');
$('tester-add-btn').fire('click');
var tester = $('tester-output').text().replace(/\s+/g, ' ');
ok('the tester is listed', /Rae \(Medium\)/.test(tester));
ok('their finished measurement is compared with the prediction',
   /predicted 41 in, measured 43\.5 in/.test(tester));
ok('their gauge difference is reported', /different gauge/.test(tester));
ok('and their fit rating', /tight at the Upper Arm/.test(tester));
// Body measurements are real people's data and stay in the project on this machine.
ok('recorded against the project', /Rae/.test(JSON.stringify(state_saved())));
// The freeform box in the Tester Notes panel used to be read by nothing: the Record button beneath it
// saved the fields above and dropped this one, clearing its neighbours so the loss looked like a save.
var RAE = state_saved().filter(function (t) { return t.name === 'Rae'; })[0];
ck('their own words are saved with them', RAE.freeform, 'Ran big at the bust.\nLoved the cuff.');
ck('and stay apart from the one-line modifications field, which the engine quotes back',
   RAE.modifications, 'added 2 rows to the sleeve');
function state_saved() {
    $('project-name').value = 'tester-project';
    $('save-btn').fire('click');
    return JSON.parse(localStorage.getItem('stitchmath_saves'))['tester-project'].grading.testers;
}

print('\n34. The export package');
var exportRows = $('export-package').text().replace(/\s+/g, ' ');
['Finished-measurement table', 'Body-measurement table', 'Schematic labels',
 'Multi-size instructions', 'Grading calculation report', 'Tester worksheet',
 'Technical-editing report', 'JSON for Stitch Math'].forEach(function (name) {
    ok('the package offers the ' + name.toLowerCase(), exportRows.indexOf(name) !== -1);
});

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
$('export-tester').fire('click');
ok('the tester worksheet is blank to fill in', /Tester name: _+/.test(BLOBS[0]));
ok('with what the pattern predicts beside each line', /pattern predicts/.test(BLOBS[0]));
BLOBS.length = 0;
$('export-editing').fire('click');
ok('the editing report lists what is unresolved', /TECHNICAL-EDITING REPORT/.test(BLOBS[0]));
ok('including the tester findings', /From testers/.test(BLOBS[0]));
// The findings are what the engine measured; this is what the tester actually wrote, and it is the
// half a designer reads first. Printed under the tester's own name so a reply can be addressed.
ok('and their own words', /In their own words:/.test(BLOBS[0]));
ok('under the tester who wrote them', /Rae \(Medium\):/.test(BLOBS[0]));
ok('with the line breaks they typed kept', /Loved the cuff\./.test(BLOBS[0]));
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

endSuite();
