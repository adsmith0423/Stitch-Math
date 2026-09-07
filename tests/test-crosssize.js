boot();

var A = CrochetAnalyticsEngine;

// The shape evaluatePatternRows() hands back, built by hand so the report can be tested
// without a pattern to parse.
function work(available, cost, made, section) {
    return { status: 'valid', sectionTitle: section || null, availableStitches: available,
             label: 'Row', step: {}, evaluation: { calculatedYield: made, totalCost: cost } };
}
function heading(title) {
    return { status: 'section', sectionTitle: title, label: title, step: {}, availableStitches: 0 };
}
function broken(available) {
    return { status: 'failed', sectionTitle: null, availableStitches: available, label: 'Row',
             step: {}, evaluation: { calculatedYield: 0, totalCost: 0 } };
}

print('\n1. What the compiler already knows, totalled for one size');
var plain = A.CompileSizeReport({ label: 'Medium', rows: [
    work(0, 0, 40), work(40, 40, 40), work(40, 40, 44), work(44, 44, 44)
]});
ck('rows counted', plain.rowsCounted, 4);
ck('the count it starts from', plain.startingCount, 0);
ck('and the count it ends on', plain.endingCount, 44);
ck('stitches consumed across the piece', plain.consumed, 124);
ck('and produced', plain.produced, 168);
ck('increases add up', plain.increases, 4);
ck('decreases add up', plain.decreases, 0);
ck('net change', plain.netChange, 44);
ok('and it all validates', plain.allValid);

var shaped = A.CompileSizeReport({ label: 'M', rows: [
    work(0, 0, 60), work(60, 60, 56), work(56, 56, 52), work(52, 52, 58)
]});
ck('decreases counted separately from increases', shaped.decreases, 8);
ck('and increases still counted', shaped.increases, 6);
ck('net change is the difference end to end', shaped.netChange, 58);

print('\n2. A size that does not validate says so rather than reporting totals');
var bad = A.CompileSizeReport({ label: 'L', rows: [work(0, 0, 40), broken(40)] });
no('it is not all valid', bad.allValid);
ck('and the failure is counted', bad.failedRows, 1);

print('\n3. Section to section continuity');
var pieces = A.CompileSizeReport({ label: 'M', rows: [
    heading('BACK'), work(0, 0, 40, 'BACK'), work(40, 40, 40, 'BACK'),
    heading('SLEEVE'), work(40, 40, 20, 'SLEEVE'), work(20, 20, 20, 'SLEEVE')
]});
ck('both pieces are reported', pieces.sections.length, 2);
ck('the back ends where it ends', pieces.sections[0].endingCount, 40);
ck('the sleeve starts from what it inherited', pieces.sections[1].startingCount, 40);
ck('one hand-off between two pieces', pieces.continuity.length, 1);
ok('and it holds', pieces.continuity[0].holds);
ck('rows are counted per piece', pieces.sections[0].rows + ',' + pieces.sections[1].rows, '2,2');

print('\n4. Cross-size checks');
function sizeOf(label, rows) { return A.CompileSizeReport({ label: label, rows: rows }); }
function run(reports, repeat) { return A.CrossSizeReport({ reports: reports, repeat: repeat }); }
function has(list, needle) { return list.some(function (x) { return x.check.indexOf(needle) !== -1; }); }

var good = [
    sizeOf('S', [work(0, 0, 40), work(40, 40, 40)]),
    sizeOf('M', [work(0, 0, 44), work(44, 44, 44)]),
    sizeOf('L', [work(0, 0, 48), work(48, 48, 48)])
];
ck('three sound sizes raise nothing', run(good).length, 0);
ck('a single size has nothing to compare against', run([good[0]]).length, 0);

var shrinking = [good[0], good[1], sizeOf('L', [work(0, 0, 42), work(42, 42, 42)])];
ok('a size that gets smaller is caught', has(run(shrinking), 'get smaller'));
ck('and it is a failure', run(shrinking)[0].state, 'fail');

var identical = [good[0], sizeOf('M', [work(0, 0, 40), work(40, 40, 40)]), good[2]];
ok('two sizes that finish the same are caught', has(run(identical), 'come out identical'));

var jumpy = [good[0], good[1], sizeOf('L', [work(0, 0, 80), work(80, 80, 80)])];
ok('a jump between sizes warns', has(run(jumpy), 'jump between sizes'));
ck('as a warning, not a failure',
   run(jumpy).filter(function (x) { return x.check.indexOf('jump') !== -1; })[0].state, 'warn');

print('\n5. Every size must hold the stitch multiple, not just the base size');
// 40 and 48 fit a multiple of 4; 44 does too, so use 6 + 1 to break the middle size.
var multiple = run(good, { multiple: 6, plus: 1 });
ok('sizes that break the repeat are named', has(multiple, 'breaks the stitch multiple'));
ok('with the counts that would work', /and .* do/.test(
   multiple.filter(function (x) { return x.check.indexOf('multiple') !== -1; })[0].detail));
// 37, 43 and 49 are all 6n + 1.
var fitting = [
    sizeOf('S', [work(0, 0, 37)]), sizeOf('M', [work(0, 0, 43)]), sizeOf('L', [work(0, 0, 49)])
];
ck('sizes that hold it raise nothing', run(fitting, { multiple: 6, plus: 1 }).length, 0);

print('\n6. A skipped or duplicated instruction shows as a different row count');
var uneven = [
    sizeOf('S', [work(0, 0, 40), work(40, 40, 40)]),
    sizeOf('M', [work(0, 0, 44), work(44, 44, 44), work(44, 44, 44)]),
    sizeOf('L', [work(0, 0, 48), work(48, 48, 48)])
];
ok('the odd size is flagged', has(run(uneven), 'different number of rows'));
ok('and every size is quoted', /S: 2, M: 3, L: 2/.test(
   run(uneven).filter(function (x) { return x.check.indexOf('different number') !== -1; })[0].detail));

print('\n7. Pieces must join up in every size, not just the one on screen');
var joined = sizeOf('S', [
    heading('BACK'), work(0, 0, 40, 'BACK'),
    heading('SLEEVE'), work(40, 40, 20, 'SLEEVE')
]);
// The sleeve of the large starts from a count the back never reached.
var split = A.CompileSizeReport({ label: 'L', rows: [
    heading('BACK'), work(0, 0, 48, 'BACK'),
    heading('SLEEVE'), work(30, 30, 24, 'SLEEVE')
]});
var joins = run([joined, split]);
ok('the mismatch is caught', has(joins, 'do not join up'));
ok('naming both pieces and both counts', /BACK ends on 48 sts but SLEEVE starts from 30/.test(
   joins.filter(function (x) { return x.check.indexOf('join up') !== -1; })[0].detail));
ck('and it is attributed to the size it happened in',
   joins.filter(function (x) { return x.check.indexOf('join up') !== -1; })[0].size, 'L');

print('\n8. A size that does not validate is reported, not silently compared');
var withBroken = [good[0], sizeOf('M', [work(0, 0, 44), broken(44)]), good[2]];
ok('the broken size is named', has(withBroken.length ? run(withBroken) : [], 'does not validate'));
ck('and attributed', run(withBroken)[0].size, 'M');

print('\n9. Nothing at all produces nothing, not NaN');
ck('no rows', A.CompileSizeReport({}).rowsCounted, 0);
ck('and no counts invented', A.CompileSizeReport({}).startingCount, 'null');
ck('no reports', run([]).length, 0);
ck('no NaN anywhere', /NaN/.test(JSON.stringify(A.CompileSizeReport({}))), false);

endSuite();
