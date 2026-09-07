boot();

var A = CrochetAnalyticsEngine;
function shape(from, to, rows, opts) {
    opts = opts || {};
    return A.DistributeShaping({ from: from, to: to, rows: rows,
                                 preset: opts.preset, perEvent: opts.perEvent });
}

print('\n1. Spreading a change in count over the rows available');
// 82 to 104 is 22 stitches; paired shaping moves 2 a row, so 11 shaping rows over 36.
var brief = shape(82, 104, 36);
ck('the direction is read from the numbers', brief.direction, 'increase');
ck('22 stitches at 2 a row is 11 shaping rows', brief.events, 11);
ok('which fits in 36 rows', brief.feasible);
ck('written the way a pattern writes it', brief.text, 'Increase 2 stitches every 3rd row 11 times');
ck('with the rows left over counted', brief.leftoverRows, 3);
no('and it is not an even division', brief.even);

print('\n2. Two plans, because the even one does not always fit');
ck('the plain reading repeats one interval', JSON.stringify(brief.plan),
   '{"interval":3,"times":11,"leftoverRows":3}');
// The balanced sequence mixes two intervals so no rows are left hanging at the end.
ck('the balanced one mixes two intervals', JSON.stringify(brief.balanced),
   '[{"interval":4,"times":3},{"interval":3,"times":8}]');
var filled = brief.balanced.reduce(function (sum, part) { return sum + part.interval * part.times; }, 0);
ck('and uses every row exactly', filled, 36);
ck('while the plain one falls short by the leftover', 3 * 11 + brief.leftoverRows, 36);

var even = shape(80, 100, 30);
ok('an even division says so', even.even);
ck('and offers a single interval', even.balanced.length, 1);
ck('with nothing left over', even.leftoverRows, 0);

print('\n3. What cannot be worked is said, not rounded away');
// A paired shaping moves two stitches at a time and cannot move twenty-one.
var odd = shape(82, 103, 36);
no('an odd change on a paired shaping is not feasible', odd.feasible);
ok('and the reason is given', /cannot be worked 2 at a time/.test(odd.warning));
ok('with the counts that would work', /20 or 22/.test(odd.warning));
ck('no plan is invented', odd.plan, 'null');

var cramped = shape(82, 130, 10);
no('more shaping rows than rows is not feasible', cramped.feasible);
ck('the shortfall is quantified', cramped.events, 24);
ok('and the two ways out are named', /more than 2 stitches per row, or allow more rows/.test(cramped.warning));

print('\n4. No change is an answer, not a failure');
var flat = shape(80, 80, 20);
ck('nothing to do', flat.events, 0);
ok('and that is feasible', flat.feasible);
ck('and said plainly', flat.text, 'No shaping: the count does not change.');
ck('every row is a plain row', flat.leftoverRows, 20);

print('\n5. One distributor, a preset per kind of shaping');
// A raglan moves one stitch each side of four seams, so eight a round.
var raglan = shape(100, 180, 20, { preset: 'raglan' });
ck('raglan moves eight a round', raglan.perEvent, 8);
ck('so 80 stitches is 10 rounds', raglan.events, 10);
ck('every other round', raglan.text, 'Increase 8 stitches every 2nd row 10 times');
ok('and it says where they go', /four raglan seams/.test(raglan.where));

ck('a single-edge shaping moves one', shape(40, 50, 20, { preset: 'single' }).perEvent, 1);
ck('so ten stitches is ten rows', shape(40, 50, 20, { preset: 'single' }).events, 10);
ck('centre shaping moves two', shape(40, 50, 20, { preset: 'centre' }).perEvent, 2);
ck('and a plain number overrides the preset', shape(40, 52, 20, { perEvent: 4 }).events, 3);

print('\n6. Decreases read as decreases');
var taper = shape(60, 40, 40);
ck('the direction', taper.direction, 'decrease');
ck('and the wording', taper.text, 'Decrease 2 stitches every 4th row 10 times');
ck('the change is still counted as 20 stitches', Math.abs(taper.delta), 20);

print('\n7. Points spread across a row or round');
// A circular yoke increasing 96 to 128 puts 32 increases among 96 stitches.
var yoke = A.SpaceEvenly({ total: 96, points: 32 });
ck('every third stitch', yoke.every, 3);
ok('evenly', yoke.even);
ck('and written out', yoke.text, 'Every 3rd stitch, 32 times');

// Short-row turning points are the same question: N places among M stitches.
var shortRows = A.SpaceEvenly({ total: 50, points: 7 });
no('50 does not divide by 7', shortRows.even);
ck('so two gaps are used', shortRows.plan.length, 2);
ck('and every stitch is accounted for',
   shortRows.plan.reduce(function (sum, part) { return sum + part.gap * part.times; }, 0), 50);
ck('singular where it should be', shortRows.text,
   'Every 8th stitch 1 time, then every 7th stitch 6 times');

no('more points than stitches does not fit', A.SpaceEvenly({ total: 10, points: 20 }).feasible);
ok('and says so', /will not fit/.test(A.SpaceEvenly({ total: 10, points: 20 }).warning));

print('\n8. Hostile input produces nothing, not NaN');
no('no rows', shape(80, 100, null).feasible);
no('zero rows', shape(80, 100, 0).feasible);
no('no start', shape(null, 100, 20).feasible);
no('no end', shape(80, null, 20).feasible);
ck('and no text is offered', shape(null, null, null).text, '');
no('nothing spread across nothing', A.SpaceEvenly({}).feasible);
ck('no NaN anywhere', /NaN/.test(JSON.stringify(shape(null, null, null))), false);

endSuite();
