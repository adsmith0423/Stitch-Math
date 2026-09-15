boot();

var A = CrochetAnalyticsEngine;
var GAUGE = { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } };
var CHART = ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X'];
function garment(opts) {
    opts = opts || {};
    return A.GradeGarment({
        category: 'woman', piece: 'half', gauge: opts.gauge || GAUGE,
        ease: { value: 4, mode: 'in' },
        pointEase: { upperArm: { value: 2, mode: 'in' } },
        overrides: opts.overrides || {}
    });
}
function score(opts) {
    opts = opts || {};
    return A.GradingConfidence({
        size: opts.size || 'Medium', garment: opts.garment || garment(),
        gauge: opts.gauge || GAUGE, chartSizes: opts.chartSizes,
        warnings: opts.warnings || [],
        modes: opts.modes || {}
    });
}

print('\n1. A well-supported size scores well');
var medium = score({ chartSizes: CHART });
ok('a high score', medium.score >= 90);
ck('and a band to match', medium.band, 'high');
ck('reported as a whole percentage', medium.score, Math.round(medium.score));

print('\n2. Extrapolating past the chart is the big one');
// The requirement's own example: a size graded beyond the supplied chart.
var beyond = score({ size: '5X', chartSizes: CHART });
ok('a size outside the chart scores lower', beyond.score < medium.score);
ok('and says that is the main issue', /outside the supplied size chart/.test(beyond.mainIssue));
ok('naming extrapolation rather than a vague doubt', /extrapolated/.test(beyond.mainIssue));
// The headline reason must be the one that actually cost the most.
ck('the reasons are worst-first',
   beyond.reasons[0].points >= beyond.reasons[beyond.reasons.length - 1].points, true);
ck('a size inside the chart is not penalised for it',
   /outside the supplied/.test(score({ size: 'Large', chartSizes: CHART }).mainIssue), false);

print('\n3. Gauge completeness');
var noStitchGauge = score({ gauge: { unwashed: { rowsPerInch: 3 } } });
ok('no stitch gauge costs a lot', noStitchGauge.score <= 75);
ok('and says why', noStitchGauge.reasons.some(function (r) { return /no stitch gauge/.test(r.reason); }));
var noRowGauge = score({ gauge: { unwashed: { stitchesPerInch: 4 } } });
ok('no row gauge costs too', noRowGauge.reasons.some(function (r) { return /no row gauge/.test(r.reason); }));
ok('with the consequence named', noRowGauge.reasons.some(function (r) { return /guess printed as a number/.test(r.reason); }));
var washed = score({ gauge: { washed: { stitchesPerInch: 4, rowsPerInch: 3 } } });
no('a washed gauge is not penalised', washed.reasons.some(function (r) { return /unwashed/.test(r.reason); }));

print('\n4. Hand-set measurements are less certain than charted ones');
var byHand = score({ garment: garment({ overrides: { Medium: { chest: 40, waist: 32 } } }) });
ok('overridden measurements cost something', byHand.score < medium.score);
ok('and are counted', byHand.reasons.some(function (r) { return /set by hand rather than graded/.test(r.reason); }));

print('\n5. Warnings about this size count for more than warnings about the run');
var mine = score({ warnings: [
    { size: 'Medium', check: 'a', detail: '' }, { size: 'Medium', check: 'b', detail: '' }
]});
var shared = score({ warnings: [
    { size: 'across sizes', check: 'a', detail: '' }, { size: 'across sizes', check: 'b', detail: '' }
]});
ok('a warning against this size costs more', mine.score < shared.score);
ok('this size\'s warnings are named as such',
   mine.reasons.some(function (r) { return /against this size/.test(r.reason); }));
ok('and the run\'s as the run\'s',
   shared.reasons.some(function (r) { return /across the size run/.test(r.reason); }));
// A warning about a different size is not this size's problem.
ck('a warning about another size is ignored',
   score({ warnings: [{ size: 'Large', check: 'a', detail: '' }] }).score, medium.score);

print('\n6. A count that rounds far from its target costs confidence');
// Reachable only once the garment was graded WITH rounding - a plain conversion carries no
// differenceInches, so there is nothing to deduct for. Medium bust 20.5 in a piece at 4 sts/in is 82;
// fitted to 6 + 1 it becomes 85, three-quarters of an inch over.
var fitted = A.GradeGarment({
    category: 'woman', piece: 'half', gauge: GAUGE,
    ease: { value: 4, mode: 'in' }, pointEase: { upperArm: { value: 2, mode: 'in' } },
    rounding: { byPoint: { chest: { multiple: 6, plus: 1 } }, strategy: 'nearest', parity: 'any' }
});
var drifted = score({ garment: fitted, chartSizes: CHART });
ok('a fitted count that drifts costs something', drifted.score < medium.score);
ok('and says how far', drifted.reasons.some(function (r) { return /rounds 0\.75 in away/.test(r.reason); }));
ck('a plain conversion is not penalised for rounding', medium.reasons.some(function (r) { return /rounds/.test(r.reason); }), false);

print('\n7. The score is bounded and always explained');
var awful = score({
    size: '5X', chartSizes: CHART,
    gauge: {},
    warnings: [1,2,3,4,5,6].map(function () { return { size: '5X', check: 'x', detail: '' }; })
});
ok('never below zero', awful.score >= 0);
ck('and banded honestly', awful.band, 'very low');
ok('with every deduction listed', awful.reasons.length > 3);
ok('an ungraded size scores nothing', score({ size: 'nope' }).score === 0);
ok('and says so', /was not graded/.test(score({ size: 'nope' }).mainIssue));

endSuite();
