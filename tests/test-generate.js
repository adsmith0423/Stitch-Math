boot();

var A = CrochetAnalyticsEngine;
var SIZES = ['S', 'M', 'L', 'XL', '2X'];

print('\n1. Multi-size notation');
function fmt(counts, opts) {
    opts = opts || {};
    return A.FormatSizeNumbers({ counts: counts, labels: SIZES,
                                 notation: opts.notation, order: opts.order });
}
ck('the base size outside, the rest in parentheses',
   fmt([82, 90, 98, 106, 114]), '82 (90, 98, 106, 114)');
ck('square brackets where a publisher wants them',
   fmt([82, 90, 98, 106, 114], { notation: 'bracket' }), '82 [90, 98, 106, 114]');
ck('one size per line', fmt([82, 90], { notation: 'column' }).split('\n')[1], 'M: 90');
// A number that is the same in every size is written once. "ch 1 (1, 1, 1)" is noise
// a reader has to check before discarding.
ck('an unchanging number is written once', fmt([1, 1, 1, 1, 1]), '1');
ck('a single size is just the number', A.FormatSizeNumbers({ counts: [82], labels: ['M'] }), '82');
ck('nothing at all is nothing', A.FormatSizeNumbers({ counts: [] }), '');

print('\n2. The designer chooses the order');
ck('largest first', fmt([82, 90, 98, 106, 114], { order: ['2X', 'XL', 'L', 'M', 'S'] }),
   '114 (106, 98, 90, 82)');
ck('a subset of sizes', fmt([82, 90, 98, 106, 114], { order: ['S', 'L', '2X'] }), '82 (98, 114)');
ck('a name that is not a size shows as missing',
   fmt([82, 90], { order: ['S', 'XXL'] }), '82 (—)');

print('\n3. Grading one written size up');
// A drop-shoulder body is a rectangle: every row is the finished width, so the whole
// size run follows from the base count and the target counts.
var scaled = A.ScaleRowCounts({ baseCount: 82, targetCounts: [82, 90, 98, 106, 114] });
ok('supported', scaled.supported);
ck('the counts come through', scaled.counts.join(','), '82,90,98,106,114');
ck('and read as a pattern writes them',
   'Ch ' + A.FormatSizeNumbers({ counts: scaled.counts, labels: SIZES }) + '.',
   'Ch 82 (90, 98, 106, 114).');

// A generated count must hold the repeat the written one held, or the fabric changes.
var fitted = A.ScaleRowCounts({ baseCount: 79, targetCounts: [79, 88, 97],
                                repeat: { multiple: 6, plus: 1 } });
ck('every generated count fits the repeat',
   fitted.counts.filter(function (n) { return (n - 1) % 6 === 0; }).length, 3);
ck('so 88 becomes the nearest that does', fitted.counts[1], 91);

ck('no base count generates nothing', A.ScaleRowCounts({ targetCounts: [90] }).counts.length, 0);

print('\n4. Constructions are added one at a time, and say so');
ck('drop shoulder is what the generator was built on',
   A.CONSTRUCTIONS.drop.supported, true);
ok('and it is named for what it covers', /rectangular/i.test(A.CONSTRUCTIONS.drop.label));
['raglan', 'setIn', 'yoke'].forEach(function (key) {
    ok(key + ' explains how it grades', A.CONSTRUCTIONS[key].reason.length > 20);
});

print('\n5. Raglan yokes');
// Four seams, eight stitches a round, so the round count is not a choice.
var raglan = A.PlanRaglanYoke({ neckCount: 76, frontBackCount: 164, sleeveCount: 60,
                                yokeRows: 30, rowsPerInch: 3 });
ck('the yoke has to reach front, back and both sleeves', raglan.separationCount, 284);
ck('208 stitches at 8 a round is 26 rounds', raglan.increaseRounds, 26);
ok('which fits in 30 rows', raglan.feasible);
ck('written out', raglan.shaping.text, 'Increase 8 stitches every row 26 times');
ck('and the depth reported', raglan.depthInches, 10);

// A raglan cannot gain a number of stitches that is not a multiple of eight.
var odd = A.PlanRaglanYoke({ neckCount: 76, frontBackCount: 168, sleeveCount: 60, yokeRows: 30 });
no('212 stitches cannot be worked 8 at a time', odd.feasible);
ok('and the workable counts are named', /208 or 216/.test(odd.warning));
ok('with the reason it is fixed', /8 stitches a round/.test(odd.warning));
no('a yoke with nothing given is not feasible', A.PlanRaglanYoke({}).feasible);
ok('and says what it needs', /needs the neck/.test(A.PlanRaglanYoke({}).warning));

print('\n6. Set-in sleeves');
var setIn = A.PlanSetInSleeve({ bodyCount: 84, shoulderCount: 60, underarmCount: 8,
                                armholeRows: 24, sleeveCount: 44, capRows: 22,
                                capTopCount: 16, rowsPerInch: 3 });
ok('a sound armhole and cap', setIn.feasible);
ck('the armhole decreases after the underarm bind-off',
   setIn.armhole.text, 'Decrease 2 stitches every 6th row 4 times');
ck('the cap has its own shaping', setIn.cap.text, 'Decrease 2 stitches every row 14 times');
ck('the armhole edge', setIn.armholeEdgeInches, 8);
ck('and the cap edge, which is seamed to it', setIn.capEdgeInches, 7.33);

// A cap whose own shaping works but whose edge is nowhere near the armhole's. The
// cap is eased in, so it runs slightly long on purpose - but not by inches.
var shortCap = A.PlanSetInSleeve({ bodyCount: 84, shoulderCount: 60, underarmCount: 8,
                                   armholeRows: 24, sleeveCount: 44, capRows: 8,
                                   capTopCount: 32, rowsPerInch: 3 });
ok('the cap shaping itself is workable', shortCap.cap.feasible);
no('but a cap that short does not fit its armhole', shortCap.feasible);
ok('and both edges are quoted', /cap edge is 2\.67 in and the armhole edge is 8 in/.test(shortCap.warning));
ok('with what it means', /seamed together/.test(shortCap.warning));

// A cap that cannot be worked at all is the more basic fault, and is reported first.
var impossibleCap = A.PlanSetInSleeve({ bodyCount: 84, shoulderCount: 60, underarmCount: 8,
                                        armholeRows: 24, sleeveCount: 44, capRows: 8,
                                        capTopCount: 16, rowsPerInch: 3 });
ok('an unworkable cap is reported as unworkable, not as a bad seam',
   /shaping rows are needed/.test(impossibleCap.warning));

print('\n7. Circular yokes');
var yoke = A.PlanCircularYoke({ neckCount: 76, separationCount: 288, yokeRows: 40,
                                increaseRounds: 5, rowsPerInch: 3 });
ck('five increase rounds', yoke.rounds.length, 5);
ok('feasible', yoke.feasible);
ck('the first starts at the neck count', yoke.rounds[0].from, 76);
ck('and the last reaches the separation count', yoke.rounds[4].to, 288);
// Grown by ratio, not by a flat number: a round near the neck has fewer stitches to
// spread into, and equal increases there would ruffle the fabric.
ok('each round adds more than the one before',
   yoke.rounds.every(function (r, i) { return i === 0 || r.increases >= yoke.rounds[i - 1].increases; }));
ok('every round says where its increases go', yoke.rounds.every(function (r) { return !!r.spacing.text; }));
ok('and none of them says "every 1st stitch"',
   yoke.rounds.every(function (r) { return !/1st stitch/.test(r.spacing.text); }));

no('a yoke that does not grow is refused',
   A.PlanCircularYoke({ neckCount: 200, separationCount: 100, yokeRows: 30 }).feasible);
ok('and says why', /has to grow/.test(
   A.PlanCircularYoke({ neckCount: 200, separationCount: 100, yokeRows: 30 }).warning));
no('more increase rounds than rows is refused',
   A.PlanCircularYoke({ neckCount: 76, separationCount: 288, yokeRows: 3, increaseRounds: 9 }).feasible);

print('\n8. Hostile input produces nothing, not NaN');
ck('no counts to scale', A.ScaleRowCounts({}).counts.length, 0);
ck('no raglan', A.PlanRaglanYoke({}).increaseRounds, 'null');
ck('no set-in', A.PlanSetInSleeve({}).armhole, 'null');
ck('no yoke', A.PlanCircularYoke({}).rounds.length, 0);
ck('no NaN anywhere', /NaN/.test(JSON.stringify([
    A.ScaleRowCounts({}), A.PlanRaglanYoke({}), A.PlanSetInSleeve({}), A.PlanCircularYoke({})
])), false);

endSuite();
