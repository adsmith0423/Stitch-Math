boot();

var A = CrochetAnalyticsEngine;
var GAUGE = { unwashed: { stitchesPerInch: 4, rowsPerInch: 3 } };

function graded(opts) {
    opts = opts || {};
    return A.GradeGarment({
        category: 'woman', piece: 'half', gauge: GAUGE,
        sizes: opts.sizes || ['X-Small', 'Small', 'Medium', 'Large', 'X-Large'],
        ease: opts.ease === undefined ? { value: 4, mode: 'in' } : opts.ease,
        pointEase: opts.pointEase || {},
        overrides: opts.overrides || {}
    });
}

print('\n1. Which measurements are worked out from which');
ck('the bust has nothing above it', A.MEASUREMENT_DEPENDS_ON.chest.join(','), '');
ck('the waist comes off the bust', A.MEASUREMENT_DEPENDS_ON.waist.join(','), 'chest');
ck('the armhole needs both bust and upper arm',
   A.MEASUREMENT_DEPENDS_ON.armholeDepth.join(','), 'chest,upperArm');

print('\n2. What a change reaches');
var fromChest = A.DependentsOf('chest');
ok('the bust reaches the waist and hip',
   fromChest.indexOf('waist') !== -1 && fromChest.indexOf('hip') !== -1);
ok('and on through the armhole to the sleeve',
   fromChest.indexOf('armholeDepth') !== -1 && fromChest.indexOf('armLength') !== -1);
// Nearest consequences first, so the closest thing to check is named first.
ck('the direct dependants come before the indirect ones',
   fromChest.indexOf('waist') < fromChest.indexOf('armLength'), true);
no('and a measurement never depends on itself', fromChest.indexOf('chest') !== -1);
ck('a leaf measurement reaches nothing', A.DependentsOf('backLength').length, 0);
ck('and an unknown one is not invented', A.DependentsOf('elbow').length, 0);

print('\n3. A change identifies the sections it touches, and stops');
var SECTIONS = [
    { key: 'body', title: 'BODY', points: ['chest', 'waist', 'hip'] },
    { key: 'sleeve', title: 'SLEEVE', points: ['upperArm', 'armLength'] },
    { key: 'cuff', title: 'CUFF', points: [] }
];
var impact = A.ImpactOfChange({ point: 'chest', sections: SECTIONS });
ck('two sections are affected', impact.sections.length, 2);
ck('the body, by the measurements it carries',
   impact.sections[0].title + ':' + impact.sections[0].points.join(','), 'BODY:chest,waist,hip');
ck('and the sleeve', impact.sections[1].title, 'SLEEVE');
no('a section carrying none of them is left alone',
   impact.sections.some(function (s) { return s.key === 'cuff'; }));
ok('and it says so in words', /Changing Chest \/ Bust reaches/.test(impact.detail));
// Reporting, not recalculating: nothing is returned that could be mistaken for a new value.
no('no replacement measurements are handed back', 'values' in impact);

var leaf = A.ImpactOfChange({ point: 'backLength', sections: SECTIONS });
ck('a measurement with nothing downstream affects no section', leaf.sections.length, 0);
ok('and says that plainly', /nothing downstream/.test(leaf.detail));
ck('an unknown measurement reaches nothing', A.ImpactOfChange({ point: 'elbow' }).dependents.length, 0);

print('\n4. A dependency loop reports rather than hangs');
var LOOP = { a: ['b'], b: ['a'] };
ck('a two-way loop still terminates', A.DependentsOf('a', LOOP).join(','), 'b');

print('\n5. How much each measurement grows between sizes');
var rows = A.GradingIncrements(graded());
var bust = rows.filter(function (r) { return r.point === 'chest'; })[0];
ck('four steps across five sizes', bust.steps.length, 4);
ck('named from and to', bust.steps[0].from + '->' + bust.steps[0].to, 'X-Small->Small');
ck('the bust grades by four inches a size', bust.steps.map(function (s) { return s.delta; }).join(','), '4,4,4,4');
ck('and passes', bust.state, 'pass');
ck('reported as even', bust.detail, 'even steps of 4 in');
// Every measurement is reported, not only the faulty ones: a consistency report that
// lists only problems cannot show consistency.
ck('every measurement gets a row', rows.length, 9);

// "Even" means the same number every time, not merely inside the tolerance.
var crossBack = rows.filter(function (r) { return r.point === 'crossBack'; })[0];
ck('a run that varies but passes is not called even', /^steps of/.test(crossBack.detail), true);

print('\n6. Plateaus and jumps are flagged');
// Two sizes forced to the same bust measurement.
var flat = A.GradingIncrements(graded({
    sizes: ['Small', 'Medium', 'Large'],
    overrides: { Medium: { chest: 35 }, Small: { chest: 35 } }
})).filter(function (r) { return r.point === 'chest'; })[0];
ck('two sizes at the same measurement fail', flat.state, 'fail');
ok('and are named', /no change between Small and Medium/.test(flat.detail));

var shrink = A.GradingIncrements(graded({
    sizes: ['Small', 'Medium', 'Large'],
    overrides: { Medium: { chest: 30 } }
})).filter(function (r) { return r.point === 'chest'; })[0];
ck('a size that gets smaller fails', shrink.state, 'fail');
ok('and the pair is named', /gets smaller: Small → Medium/.test(shrink.detail));

var jump = A.GradingIncrements(graded({
    sizes: ['Small', 'Medium', 'Large'],
    overrides: { Large: { chest: 60 } }
})).filter(function (r) { return r.point === 'chest'; })[0];
ck('an unexplained jump warns rather than fails', jump.state, 'warn');

// One size has nothing to compare against, which is not a fault.
var single = A.GradingIncrements(graded({ sizes: ['Medium'] }))[0];
ck('a single size is skipped, not warned', single.state, 'skip');

print('\n7. Fit and proportion warnings');
// A realistic sweater: +4 at the bust, +2 at the arm. The engine sends the overall ease to the upper arm
// unless a point ease overrides it, and +4 in on an 11 in arm is a sleeve no cap will set into - which the
// armhole check below is there to catch.
var SOUND = { sizes: ['Medium'], pointEase: { upperArm: { value: 2, mode: 'in' } } };
function checks(opts) {
    var merged = { sizes: ['Medium'], pointEase: SOUND.pointEase, ease: opts.ease, overrides: opts.overrides };
    if (opts.pointEase) {
        merged.pointEase = {};
        Object.keys(SOUND.pointEase).forEach(function (k) { merged.pointEase[k] = SOUND.pointEase[k]; });
        Object.keys(opts.pointEase).forEach(function (k) { merged.pointEase[k] = opts.pointEase[k]; });
    }
    return A.CheckFitAndProportion({ garment: graded(merged), sizes: ['Medium'] });
}
function found(list, needle) {
    return list.some(function (w) { return w.check.indexOf(needle) !== -1; });
}
ck('a sound garment raises nothing', checks({}).length, 0);

// The published body measurements, with no ease at all, must never trip a check: a
// warning that fires on the reference chart is noise rather than a finding.
var chartNoise = 0;
['baby', 'child', 'youth', 'woman', 'man'].forEach(function (cat) {
    chartNoise += A.CheckFitAndProportion({
        garment: A.GradeGarment({ category: cat, piece: 'half', gauge: GAUGE })
    }).filter(function (w) { return w.size !== 'across sizes'; }).length;
});
ck('the CYC charts raise nothing against themselves', chartNoise, 0);

// Positive ease intended, negative ease delivered.
var negative = checks({ sizes: ['Medium'], ease: { value: -3, mode: 'in' } });
ok('a finished bust under the body bust is flagged', found(negative, 'Finished bust smaller'));
ok('with both numbers quoted', /body 37 in, finished 34 in/.test(negative[0].detail));
ck('as a warning, never a correction', negative[0].state, 'warn');

var tightSleeve = checks({ sizes: ['Medium'], pointEase: { upperArm: { value: -2, mode: 'in' } } });
ok('a sleeve narrower than the arm is flagged', found(tightSleeve, 'Sleeve narrower'));
ok('quoting the arm and the sleeve', /upper arm 11 in, sleeve 9 in/.test(
   tightSleeve.filter(function (w) { return w.check.indexOf('Sleeve narrower') !== -1; })[0].detail));

var shallow = checks({ sizes: ['Medium'], pointEase: { armholeDepth: { value: -4, mode: 'in' } } });
ok('an armhole too shallow for its sleeve is flagged', found(shallow, 'Armhole too shallow'));
ok('and says what depth it would need', /of depth is needed/.test(
   shallow.filter(function (w) { return w.check.indexOf('Armhole') !== -1; })[0].detail));
ok('quoting the opening the armhole actually gives', /in opening/.test(
   shallow.filter(function (w) { return w.check.indexOf('Armhole') !== -1; })[0].detail));

var SOUND_GARMENT = graded({ sizes: ['Medium'], pointEase: SOUND.pointEase });
var neck = A.CheckFitAndProportion({
    garment: SOUND_GARMENT, sizes: ['Medium'],
    headCircumference: 22, neckOpening: 19
});
ok('a neck opening smaller than the head is flagged', found(neck, 'Neck opening smaller'));
ok('and says how much more is needed', /3 in more/.test(
   neck.filter(function (w) { return w.check.indexOf('Neck') !== -1; })[0].detail));
ck('a big enough opening raises nothing', A.CheckFitAndProportion({
    garment: SOUND_GARMENT, sizes: ['Medium'],
    headCircumference: 22, neckOpening: 24 }).length, 0);

print('\n8. Pieces that are seamed together must match');
var seams = A.CheckFitAndProportion({ garment: [], sections: [
    { key: 'front', title: 'FRONT', lengthInches: 24, joins: [{ to: 'back' }] },
    { key: 'back', title: 'BACK', lengthInches: 25.5 }
]});
ck('a seam length mismatch is flagged', seams.length, 1);
ok('naming both pieces and the gap', /FRONT is 24 in and BACK is 25\.5 in.*1\.5 in apart/.test(seams[0].detail));
ck('a quarter inch is within tolerance', A.CheckFitAndProportion({ garment: [], sections: [
    { key: 'front', title: 'FRONT', lengthInches: 24, joins: [{ to: 'back' }] },
    { key: 'back', title: 'BACK', lengthInches: 24.25 }
]}).length, 0);
ck('a join to a piece that does not exist is ignored', A.CheckFitAndProportion({ garment: [], sections: [
    { key: 'front', title: 'FRONT', lengthInches: 24, joins: [{ to: 'hood' }] }
]}).length, 0);

print('\n9. Nothing at all produces nothing, not NaN');
ck('no garment', A.CheckFitAndProportion({}).length, 0);
ck('no increments', A.GradingIncrements([]).length, 0);
ck('no NaN anywhere', /NaN/.test(JSON.stringify(A.CheckFitAndProportion({}))), false);

endSuite();
