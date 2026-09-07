boot();

var A = CrochetAnalyticsEngine;

print('\n1. Motif layouts');
// 4 in granny squares with a quarter-inch join and a 1 in border, into 42 in.
var plan = A.PlanMotifLayout({ targetInches: 42, motifInches: 4, joinInches: 0.25, borderInches: 1 });
ck('the nearest whole layout', plan.count, 9);
no('which does not hit the target exactly', plan.exact);
ck('nine motifs measure', plan.layouts.filter(function (l) { return l.count === 9; })[0].width, 40);
// n motifs carry n-1 joins, plus the border twice.
ck('joins and border are both counted',
   A.PlanMotifLayout({ targetInches: 42, motifInches: 4, joinInches: 0.25, borderInches: 1 })
    .layouts.filter(function (l) { return l.count === 10; })[0].width, 44.25);
ok('layouts either side are offered', plan.layouts.length >= 3);
ok('and the shortfall is named', /No whole number of 4 in motifs makes 42 in/.test(plan.warning));
// The border is the honest way out of a motif count that will not land.
ck('with the border that would close the gap',
   plan.layouts.filter(function (l) { return l.count === 9; })[0].borderToFit, 2);
ok('and it is said in the warning', /2 in border each side would close it/.test(plan.warning));

var exact = A.PlanMotifLayout({ targetInches: 40, motifInches: 4 });
ok('a layout that lands exactly says so', exact.exact);
ck('with no warning', exact.warning, '');
ck('and the right count', exact.count, 10);

ok('a border wider than the target is refused',
   /already exceeds/.test(A.PlanMotifLayout({ targetInches: 3, motifInches: 4, borderInches: 2 }).warning));
ck('no motif size, no layout', A.PlanMotifLayout({ targetInches: 40 }).count, 'null');
ck('no NaN', /NaN/.test(JSON.stringify(A.PlanMotifLayout({}))), false);

print('\n2. Partial motifs are offered only when asked for');
ck('not by default', A.PlanMotifLayout({ targetInches: 42, motifInches: 4 }).partial, 'null');
ok('and given when they are', A.PlanMotifLayout({ targetInches: 42, motifInches: 4, allowPartial: true }).partial !== null);

print('\n3. Yarn and time for one size');
var totals = { sc: 4000, dc: 2000, ch: 300 };
var effort = A.EstimateSizeEffort({ label: 'M', stitchTotals: totals, yarnWeightCategory: 4 });
ck('the stitches are counted', effort.stitches, 6300);
ok('yardage comes back', effort.yards > 0);
ok('and skeins', effort.skeins > 0);
ok('and hours', effort.hours > 0);
// 4000 sc at 2.2s, 2000 dc at 3s, 300 ch at 1.2s = 15160s = 4.21 h.
ck('worked out from the stitch mix, not a flat rate', effort.hours, 4.21);
ck('a taller stitch costs more time', A.SECONDS_PER_STITCH.dc > A.SECONDS_PER_STITCH.sc, true);
ck('nothing to work is no time', A.EstimateSizeEffort({ stitchTotals: {} }).hours, 0);

print('\n4. Comparing the size run against the sample');
var run = A.CompareSizeEffort({
    efforts: [
        A.EstimateSizeEffort({ label: 'S', stitchTotals: { sc: 4000 } }),
        A.EstimateSizeEffort({ label: 'M', stitchTotals: { sc: 5000 } }),
        A.EstimateSizeEffort({ label: 'L', stitchTotals: { sc: 6000 } })
    ], baseLabel: 'S'
});
ck('three sizes', run.length, 3);
ok('the base is marked', run[0].isBase);
no('and the others are not', run[1].isBase);
// Derived from each size's own stitches, so the percentage is real rather than a
// bust ratio applied to the sample's yardage.
ck('Medium works 25% more stitches', run[1].stitchesOverBase, 25);
ck('and needs 25% more yarn', run[1].yardsOverBase, 25);
ck('and 25% more time', run[1].hoursOverBase, 25);
ck('Large works 50% more', run[2].stitchesOverBase, 50);
ck('the base is 0% over itself', run[0].yardsOverBase, 0);
ck('nothing to compare', A.CompareSizeEffort({ efforts: [] }).length, 0);

print('\n5. Colour-specific yardage');
var twoColour = A.EstimateSizeEffort({
    label: 'M', stitchTotals: { sc: 6000 },
    colorTotals: { A: { sc: 4000 }, B: { sc: 2000 } }
});
ck('a figure per colour', twoColour.colors.length, 2);
ck('the main colour', twoColour.colors[0].code + ':' + twoColour.colors[0].stitches, 'A:4000');
ok('with its own yardage', twoColour.colors[0].yards > twoColour.colors[1].yards);
ck('and no colours when none are tracked',
   A.EstimateSizeEffort({ stitchTotals: { sc: 100 } }).colors.length, 0);

endSuite();
