boot();
var A = CrochetAnalyticsEngine;

// The three shaping plans a grader works out from the cross back - Sister Mountain's neckline,
// shoulder and armhole recipes - each returning its figures and its own sentence, and saying so when
// a size cannot hold the plan rather than moving a number to make it fit.

print('\n1. A front neckline, from the cross back');
// 60 sts across the back: the neck is half of it, 30; 40% of the neck, 12, is left unworked at the
// centre; the 9 a side are decreased over the lower two-thirds of a 15-row depth, 10 rows; the top
// 5 rows are worked straight to shoulders of 15 sts each.
var neck = A.PlanNeckline({ crossBackStitches: 60, depthRows: 15 });
ck('the neck is half the cross back', neck.neckStitches, 30);
ck('a share of it is left unworked at the centre', neck.bindOff, 12);
ck('the rest is decreased at each side', neck.perSide, 9);
ck('over the lower two-thirds of the depth', neck.shapingRows, 10);
ck('with the top third straight', neck.straightRows, 5);
ck('leaving two whole shoulders', neck.shoulderStitches, 15);
ok('it can be worked', neck.feasible);
ok('and is said in one sentence', /Leave the centre 12 sts unworked, then decrease 1 st at each neck edge every row 9 times; work 5 rows straight to the shoulder \(15 sts each shoulder\)/.test(neck.text));

// Parity: the neck takes the cross back's, so the shoulders are whole; the centre takes the neck's,
// so the two sides are whole.
var odd = A.PlanNeckline({ crossBackStitches: 63, depthRows: 15 });
ck('an odd cross back gives an odd neck', odd.neckStitches, 31);
ck('and an odd centre, so the sides are whole', odd.bindOff, 13);
ck('with whole shoulders', odd.shoulderStitches, 16);
ck('the shares are the designer\'s to change',
   A.PlanNeckline({ crossBackStitches: 60, depthRows: 15, neckShare: 0.4, bindOffShare: 0.5 }).neckStitches, 24);

// A neck too shallow for its decreases is a finding, not a number moved.
var shallow = A.PlanNeckline({ crossBackStitches: 64, depthRows: 9 });
no('decreases that do not fit the depth are not planned', shallow.feasible);
ok('and the two levers are named', /Leave more of the neck unworked at the centre, or make the neck deeper/.test(shallow.warning));
ck('a neck that breaks the repeat is reported, not moved',
   A.PlanNeckline({ crossBackStitches: 60, depthRows: 15, repeat: { multiple: 4, plus: 0 } }).fit.fits, false);
ck('nothing to plan is nothing', A.PlanNeckline({}).neckStitches, 'null');

print('\n2. A sloped shoulder');
// 16 sts over a 6-row drop: three steps of two rows, as even as whole stitches allow.
var slope = A.PlanShoulderSlope({ shoulderStitches: 16, dropRows: 6 });
ck('one step every two rows', slope.steps, 3);
ck('as even as whole stitches allow',
   slope.segments.map(function (s) { return s.stitches + 'x' + s.times; }).join(','), '6x1,5x2');
ok('said as a pattern says it', /Slip stitch across 6 sts once at the armhole edge, then 5 sts 2 times \(3 steps over 6 rows\)/.test(slope.text));
ck('a shoulder that divides evenly is one segment',
   A.PlanShoulderSlope({ shoulderStitches: 15, dropRows: 6 }).segments.length, 1);
no('more steps than stitches cannot be worked', A.PlanShoulderSlope({ shoulderStitches: 2, dropRows: 8 }).feasible);
ck('nothing to plan is nothing', A.PlanShoulderSlope({}).steps, 'null');

print('\n3. An armhole down to the cross back, for one flat piece');
// A Back of 82 sts to a cross back of 64 over 22 rows, 3 sts given up at once each side: 76 after the
// underarm, then 12 to lose two at a time - six decrease rows.
var armhole = A.PlanArmholeShaping({ bodyStitches: 82, crossBackStitches: 64, bindOffStitches: 3, rows: 22 });
ck('the piece is the piece', armhole.pieceStitches, 82);
ck('the underarm comes off both ends', armhole.afterUnderarm, 76);
ck('the rest is decreased in pairs', armhole.shaping.events, 6);
ok('it can be worked', armhole.feasible);
ok('and is said as a pattern says it', /Slip stitch across 3 sts at the start of the next row and leave 3 unworked at the end \(76 sts\), then decrease 1 st at each end every 3rd row 6 times \(64 sts\)/.test(armhole.text));
ok('an odd number to lose in pairs is a finding',
   /cannot be worked 2 at a time/.test(A.PlanArmholeShaping({ bodyStitches: 82, crossBackStitches: 63, bindOffStitches: 3, rows: 22 }).warning));
// The piece contract: a round is divided into a front and a back at the armhole, each worked flat.
var round = A.PlanArmholeShaping({ bodyStitches: 164, crossBackStitches: 64, bindOffStitches: 3, rows: 22, piece: 'round' });
ck('a round is halved into the piece', round.pieceStitches, 82);
ck('and plans the same as the piece', round.text, armhole.text);
ok('an odd round is reported rather than halved',
   /cannot be divided into an equal front and back/.test(A.PlanArmholeShaping({ bodyStitches: 163, crossBackStitches: 64, bindOffStitches: 3, rows: 22, piece: 'round' }).warning));
ck('nothing to plan is nothing', A.PlanArmholeShaping({}).pieceStitches, 'null');
ck('no NaN anywhere', /NaN/.test(JSON.stringify([A.PlanNeckline({}), A.PlanShoulderSlope({}), A.PlanArmholeShaping({})])), false);

endSuite();
