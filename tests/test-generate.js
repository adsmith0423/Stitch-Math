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

print('\n3b. A pattern written in a size other than the first');
// The pattern is a Medium of 80 sts. The chart grades Medium at 82 and Large at 90: the Medium row
// comes back exactly as written, and the Large row is 80 scaled by 90/82, not 90 itself.
var medium = A.ScaleRowCounts({ baseCount: 80, baseTarget: 82, targetCounts: [66, 74, 82, 90] });
ck('the written size keeps its written count', medium.counts[2], 80);
ck('a larger size scales by the ratio between the two targets', medium.counts[3], 88);
ck('and a smaller one likewise', medium.counts[0], 64);
// A row that is not the full width - a decrease row - is scaled by the same ratio, not replaced by
// the target width, which is what happened when the row's own count stood in for the base width.
var narrow = A.ScaleRowCounts({ baseCount: 40, baseTarget: 82, targetCounts: [66, 82, 90] });
ck('a narrow row stays narrow', narrow.counts.join(','), '32,40,44');
// The written size is never refitted to the repeat: 80 does not fit 6 + 1, and it was not generated.
var kept = A.ScaleRowCounts({ baseCount: 80, baseTarget: 82, targetCounts: [66, 82, 90],
                              repeat: { multiple: 6, plus: 1 } });
ck('the written count is not refitted', kept.counts[1], 80);
ok('while the generated ones are', (kept.counts[0] - 1) % 6 === 0 && (kept.counts[2] - 1) % 6 === 0);

print('\n3c. A piece is graded as a sequence, and shaping keeps what it writes');
// Row 1 is the width; row 3 takes two off; row 4 is straight. Scaled one row at a time each would
// round on its own, and the decrease row of a small size could come out one below its neighbour
// where the text plainly removes two.
var seq = A.ScaleRowSequence({ counts: [80, 80, 78, 78], baseTarget: 82, targetCounts: [66, 82, 90] });
ok('supported', seq.supported);
ck('the first row is scaled', seq.rows[0].join(','), '64,80,88');
ck('a straight row stays at the row above', seq.rows[1].join(','), '64,80,88');
ck('a decrease of two is two in every size', seq.rows[2].join(','), '62,78,86');
ck('and the row after it holds', seq.rows[3].join(','), '62,78,86');
ck('the written size is verbatim throughout',
   seq.rows.map(function (r) { return r[1]; }).join(','), '80,80,78,78');
// A section boundary starts a fresh chain: the sleeve is scaled from its own first row.
var pieces = A.ScaleRowSequence({ counts: [80, 78, null, 32, 34], baseTarget: 82, targetCounts: [66, 82, 90] });
ck('a boundary yields nothing', pieces.rows[2], 'null');
ck('and the next piece is scaled from its own first row', pieces.rows[3].join(','), '26,32,35');
ck('then chained', pieces.rows[4].join(','), '28,34,37');
// A row with no count - a note - yields nothing and does not break the chain.
var noted = A.ScaleRowSequence({ counts: [80, NaN, 78], baseTarget: 82, targetCounts: [66, 82, 90] });
ck('a note yields nothing', noted.rows[1], 'null');
ck('and the chain continues past it', noted.rows[2].join(','), '62,78,86');
// Shaping that a small size cannot hold is reported as nothing, not as a negative count.
var shrunk = A.ScaleRowSequence({ counts: [10, 2], baseTarget: 82, targetCounts: [8, 82] });
ck('a count that falls below one stitch is nothing', shrunk.rows[1][0], 'null');
ck('a construction the generator cannot scale says so',
   A.ScaleRowSequence({ counts: [80], construction: 'raglan' }).supported, false);

print('\n3d. A size name in any spelling the chart goes by');
var WOMAN = ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X', '3X', '4X', '5X'];
ck('the exact label', A.MatchSizeLabel('Medium', WOMAN), 'Medium');
ck('any case', A.MatchSizeLabel('medium', WOMAN), 'Medium');
ck('an abbreviation', A.MatchSizeLabel('M', WOMAN), 'Medium');
ck('a short form', A.MatchSizeLabel('Med', WOMAN), 'Medium');
ck('L', A.MatchSizeLabel('L', WOMAN), 'Large');
ck('XL', A.MatchSizeLabel('XL', WOMAN), 'X-Large');
ck('extra large, spelled out', A.MatchSizeLabel('Extra Large', WOMAN), 'X-Large');
ck('XS', A.MatchSizeLabel('xs', WOMAN), 'X-Small');
ck('2XL', A.MatchSizeLabel('2XL', WOMAN), '2X');
ck('XXL', A.MatchSizeLabel('XXL', WOMAN), '2X');
ck('3XL', A.MatchSizeLabel('3xl', WOMAN), '3X');
ck('with spacing', A.MatchSizeLabel('  x-large ', WOMAN), 'X-Large');
ck('a name that is no size matches nothing', A.MatchSizeLabel('foo', WOMAN), '');
ck('a bare "X" is not a size', A.MatchSizeLabel('X', WOMAN), '');
ck('nothing typed matches nothing', A.MatchSizeLabel('', WOMAN), '');
ck('a child size by number', A.MatchSizeLabel('8', ['2', '4', '6', '8', '10']), '8');
ck('a baby size', A.MatchSizeLabel('12 months', ['6 months', '12 months']), '12 months');
ck('and a number alone does not match a month', A.MatchSizeLabel('12', ['6 months', '12 months']), '');
ck('a size not on the chart is not matched to a neighbour', A.MatchSizeLabel('XS', ['Small', 'Medium']), '');

print('\n3e. The size a written piece is nearest to');
var cells = [{ size: 'S', stitches: 74 }, { size: 'M', stitches: 82 }, { size: 'L', stitches: 90 }];
ck('an 80-stitch piece is a Medium', A.NearestSizeByCount({ cells: cells, stitches: 80 }).size, 'M');
ck('with its distance', A.NearestSizeByCount({ cells: cells, stitches: 80 }).difference, 2);
ck('an 88-stitch piece is a Large', A.NearestSizeByCount({ cells: cells, stitches: 88 }).size, 'L');
ck('a tie goes to the smaller size', A.NearestSizeByCount({ cells: cells, stitches: 78 }).size, 'S');
ck('no count, no answer', A.NearestSizeByCount({ cells: cells }), 'null');
ck('no sizes, no answer', A.NearestSizeByCount({ cells: [], stitches: 80 }), 'null');

print('\n3f. A run of shaping rows is regraded as a rule');
// A sleeve written in Medium: 32 sts, then increase 2 every 4th row 7 times from Row 3 - 46 sts on
// Row 27 - then two rows straight. The rule's three numbers all move with size: how far, over how
// many rows, and so how often.
var SLEEVE = [32, 32];
(function () { var c = 32; for (var r = 3; r <= 27; r++) { if ((r - 3) % 4 === 0) c += 2; SLEEVE.push(c); } })();
SLEEVE.push(46, 46);
var SML = ['S', 'M', 'L'];
var run = A.ShapedRuns(SLEEVE.map(function (n) { return { count: n }; }))[0];
ck('the taper is one run of seven', run.events, 7);
ck('entered from Row 2', run.start, 1);
ck('over 25 rows', run.rows, 25);

var graded = A.GradeShapedRun({ from: [29, 32, 35], writtenFrom: 32, writtenTo: 46, writtenRows: 25,
                                perEvent: 2, baseTarget: 32, targetCounts: [29, 32, 35],
                                baseRows: 25, targetRows: [24, 25, 26], firstRow: 3, labels: SML });
// The written size comes back exactly as written: "once, then every 4th row 6 more times" is what
// seven increases every 4th row from Row 3 ARE. Spreading all seven over all 25 rows would say
// "every 3rd row" and move every increase the designer placed.
ck('the written size keeps its end', graded.sizes[1].to, 46);
ck('and its rows', graded.sizes[1].rows, 25);
ck('and its spacing', graded.sizes[1].more.text, 'Increase 2 stitches every 4th row 6 times');
ok('with no rows left over', graded.sizes[1].more.even);
// A wider size travels further and a narrower one less, always by whole shaping rows.
ck('a wider size ends wider', graded.sizes[2].to, 51);
ck('a narrower size ends narrower', graded.sizes[0].to, 41);
ok('every size moves by whole shaping events',
   graded.sizes.every(function (s) { return (s.to - s.from) % 2 === 0; }));
ck('and a longer size has more rows to do it in', graded.sizes[2].rows, 26);
ck('so it shapes more often', graded.sizes[2].more.plan.interval, 3);
// The rule, in size columns.
ck('the count after the shaping row', graded.text.shapingRow, '31 (34, 37)');
ck('the rows the rule spans', graded.text.rowRange, '4-26 (4-27, 4-28)');
ck('how often', graded.text.every, '4th (4th, 3rd)');
ck('how many more times', graded.text.times, '5 (6, 7)');
ck('what is worked straight after', graded.text.straight, '3 (0, 4)');
ck('and the count it ends on', graded.text.ending, '41 (46, 51)');
// Without a graded length every size has the written rows.
ck('no length, no change of rows',
   A.GradeShapedRun({ from: [29, 32, 35], writtenFrom: 32, writtenTo: 46, writtenRows: 25, perEvent: 2,
                      baseTarget: 32, targetCounts: [29, 32, 35], labels: SML }).text.rows, '25');

// A size the shaping does not fit is said, not squeezed.
var tight = A.GradeShapedRun({ from: [10, 32], writtenFrom: 32, writtenTo: 46, writtenRows: 25, perEvent: 2,
                               baseTarget: 32, targetCounts: [96, 32], baseRows: 25, targetRows: [3, 25],
                               labels: ['XS', 'M'] });
no('too many shaping rows for the rows available is infeasible', tight.sizes[0].feasible);
ok('and says so', /do not fit in 3 rows/.test(tight.sizes[0].warning));
ck('printing as a dash in every column', tight.text.ending, '— (46)');
no('a size the rows before did not fit is infeasible',
   A.GradeShapedRun({ from: [null, 32], writtenFrom: 32, writtenTo: 46, writtenRows: 25, perEvent: 2,
                      baseTarget: 32, targetCounts: [29, 32] }).sizes[0].feasible);
ck('a count that does not move is no rule',
   A.GradeShapedRun({ from: [32], writtenFrom: 32, writtenTo: 32, writtenRows: 25, perEvent: 2,
                      baseTarget: 32, targetCounts: [32] }).sizes.length, 0);

// The whole piece: the rows before the run chained, the run as a rule, the rows after it carried on
// from each size's own end.
var pieceRows = A.GradePieceRows({ counts: SLEEVE, baseTarget: 32, targetCounts: [29, 32, 35],
                                   baseRows: 25, targetRows: [24, 25, 26], labels: SML,
                                   rowNumbers: SLEEVE.map(function (_, i) { return i + 1; }) });
ck('one rule', pieceRows.runs.length, 1);
ck('worked from Row 3', pieceRows.runs[0].firstShaping, 2);
ck('the first row is scaled', pieceRows.rows[0].join(','), '29,32,35');
ck('the shaping row carries the count after it', pieceRows.rows[2].join(','), '31,34,37');
ck('the rows inside the rule are not rows', pieceRows.rows[3], 'null');
ck('and the rows after it carry each size\'s own end', pieceRows.rows[27].join(','), '41,46,51');
no('evenly written shaping is not redistributed', pieceRows.runs[0].redistributed);
ok('unevenly written shaping is, and says so',
   A.GradePieceRows({ counts: [32, 34, 34, 36, 36, 36, 38], baseTarget: 32, targetCounts: [32] }).runs[0].redistributed);
// What is not a rule stays a row.
var single = A.GradePieceRows({ counts: [80, 80, 78, 78], baseTarget: 82, targetCounts: [66, 82, 90] });
ck('a single shaping row is not a rule', single.runs.length, 0);
ck('and the piece chains as before',
   single.rows.map(function (r) { return r.join(','); }).join('|'),
   A.ScaleRowSequence({ counts: [80, 80, 78, 78], baseTarget: 82, targetCounts: [66, 82, 90] })
       .rows.map(function (r) { return r.join(','); }).join('|'));
ck('a run whose rows move by different amounts is not a rule',
   A.GradePieceRows({ counts: [32, 34, 34, 38, 38], baseTarget: 32, targetCounts: [32] }).runs.length, 0);
ck('a construction the generator cannot scale says so',
   A.GradePieceRows({ counts: SLEEVE, construction: 'raglan' }).supported, false);

print('\n3h. A piece\'s totals per size, and the tech editor\'s TRUE row');
// A grading spreadsheet keeps a cell per size that must read TRUE before the pattern is written up:
// the count after shaping equals the target width, the rows worked equal the intended rows. The
// totals behind it are summed in closed form for a rule's rows, and checked here against the
// row-by-row sum of the written Medium.
ck('the written size\'s stitches are the row-by-row sum',
   pieceRows.totals.stitches[1], SLEEVE.reduce(function (a, b) { return a + b; }, 0));
ck('a wider, longer size works more', pieceRows.totals.stitches[2] > pieceRows.totals.stitches[1], true);
ck('rows per size follow the graded length', pieceRows.totals.rows.join(','), '28,29,30');
ck('the count each size ends on', pieceRows.endCounts.join(','), '41,46,51');
ck('and the widest it reaches', pieceRows.widestCounts.join(','), '41,46,51');
var single = A.GradePieceRows({ counts: [80, 80, 78, 78], baseTarget: 82, targetCounts: [66, 82, 90] });
ck('a piece with no rule is totalled from its rows', single.totals.stitches[1], 316);
ck('ending on its last row', single.endCounts[1], 78);
ck('and widest at its widest', single.widestCounts[1], 80);

function sleeveCheck(widths, extra) {
    var piece = { title: 'SLEEVE', type: 'sleeve', graded: pieceRows, widthTargets: widths,
                  lengthTargets: [24, 25, 26], writtenRows: 29, baseIndex: 1, repeat: null, stitchesPerInch: 4 };
    Object.keys(extra || {}).forEach(function (k) { piece[k] = extra[k]; });
    return A.CheckGradedPieces({ pieces: [piece], labels: SML });
}
var trueRow = sleeveCheck([41, 46, 51]);
ok('every size reaches its width', trueRow.pieces[0].sizes.every(function (z) { return z.widthOk; }));
ok('and works its rows', trueRow.pieces[0].sizes.every(function (z) { return z.lengthOk; }));
ck('so there is nothing to report', trueRow.findings.length, 0);
// A target that arrives as 50.9999 from a chain of inch arithmetic is 51: whole stitches both sides.
ok('a floating-point target is compared as whole stitches', sleeveCheck([41, 46, 50.99999]).pieces[0].sizes[2].widthOk);
var off = sleeveCheck([41, 44, 51]);
no('a size that misses its width says so', off.pieces[0].sizes[1].widthOk);
ck('by how many stitches', off.pieces[0].sizes[1].differenceStitches, 2);
ck('and how far in inches', off.pieces[0].sizes[1].differenceInches, 0.5);
ck('as one finding against that size', off.findings.length, 1);
ck('naming the size', off.findings[0].size, 'M');
ok('and the shortfall', /46 sts, 44 needed \(\+0\.5 in\)/.test(off.findings[0].detail));
// With a repeat the count can only land on its lattice, so within half a multiple is as close as it gets.
ok('a repeat allows half a multiple', sleeveCheck([41, 44, 51], { repeat: { multiple: 4, plus: 2 } }).pieces[0].sizes[1].widthOk);
no('but not more', sleeveCheck([41, 43, 51], { repeat: { multiple: 4, plus: 2 } }).pieces[0].sizes[1].widthOk);
var shortRows = sleeveCheck([41, 46, 51], { lengthTargets: [24, 25, 30] });
no('a size that works the wrong rows says so', shortRows.pieces[0].sizes[2].lengthOk);
ok('naming the rows intended', /30 rows, 35 intended/.test(shortRows.pieces[0].sizes[2].warning));
ck('no length point, no row check', sleeveCheck([41, 46, 51], { lengthTargets: null }).pieces[0].sizes[1].lengthOk, 'null');
var unfit = A.CheckGradedPieces({ pieces: [{ title: 'SLEEVE', graded: A.GradePieceRows({ counts: SLEEVE, baseTarget: 32, targetCounts: [96, 32], baseRows: 25, targetRows: [3, 25], labels: ['XS', 'M'] }),
    widthTargets: [96, 46], lengthTargets: null, writtenRows: 29, baseIndex: 1, repeat: null, stitchesPerInch: 4 }], labels: ['XS', 'M'] });
no('a size the piece cannot be worked in is not TRUE', unfit.pieces[0].sizes[0].feasible);
ok('and is reported as not fitting', /does not fit/.test(unfit.findings[0].check));
ck('nothing to check is nothing', A.CheckGradedPieces({}).pieces.length, 0);

print('\n3g. A rule\'s words go in size columns like its numbers');
ck('ordinals', A.FormatSizeNumbers({ counts: ['4th', '4th', '3rd'] }), '4th (4th, 3rd)');
ck('a row range, with a size the rule does not fit', A.FormatSizeNumbers({ counts: ['3-29', null] }), '3-29 (—)');
ck('an empty string is absent', A.FormatSizeNumbers({ counts: ['', 'x'] }), '— (x)');
ck('the same word in every size is written once', A.FormatSizeNumbers({ counts: ['4th', '4th'] }), '4th');

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

print('\n7b. A construction planned for one size from its graded cells');
// The planners above take typed counts. The grader knows them per size - bust, upper arm, cross back
// and armhole depth - so only what no chart carries is asked for, and a size missing one of those
// says which rather than planning from a number nobody gave.
var GRADED = { chest: 82, chestShare: 0.5, upperArm: 60, crossBack: 63, armholeRows: 22,
               stitchesPerInch: 4, rowsPerInch: 3 };
function at(construction, extra) {
    var args = { construction: construction };
    Object.keys(GRADED).forEach(function (k) { args[k] = GRADED[k]; });
    Object.keys(extra || {}).forEach(function (k) { args[k] = extra[k]; });
    return A.PlanConstructionAtSize(args);
}
ck('a drop shoulder has nothing to plan', at('drop').planner, 'null');
ok('and says so', /no yoke or cap to plan/.test(at('drop').warning));

var raglan = at('raglan', { neckCount: 92 });
ck('a raglan is planned by the raglan planner', raglan.planner, 'raglan');
ck('the front and back at the separation are the whole bust', raglan.inputs.frontBackCount, 164);
ck('the sleeves are the graded upper arm', raglan.inputs.sleeveCount, 60);
ck('and the yoke is the graded armhole depth', raglan.inputs.yokeRows, 22);
ck('so the separation follows', raglan.plan.separationCount, 284);
ok('a yoke the depth cannot hold is a finding', !raglan.feasible && /shaping rows are needed/.test(raglan.warning));
ok('a deeper yoke holds it', at('raglan', { neckCount: 92, armholeRows: 30 }).feasible);
ok('no neck circumference, no raglan', /Needs the neck circumference/.test(at('raglan').warning));
ck('and nothing is planned from a number nobody gave', at('raglan').plan, 'null');

var setIn = at('setIn', { underarmCount: 3, capRows: 15, capTopCount: 12 });
ck('a set-in sleeve takes the bust as one piece', setIn.inputs.bodyCount, 82);
ck('the cross back as the shoulder', setIn.inputs.shoulderCount, 63);
ck('and the upper arm at the bicep', setIn.inputs.sleeveCount, 60);
ok('the armhole and the cap are both planned', setIn.plan.armhole && setIn.plan.cap);
ok('and the cap edge is compared with the armhole edge',
   Math.abs(setIn.plan.capEdgeInches - 5) < 0.01 && Math.abs(setIn.plan.armholeEdgeInches - 7.33) < 0.01);

var circular = at('yoke', { neckCount: 88, increaseRounds: 3 });
ck('a circular yoke is planned by the circular planner', circular.planner, 'circular');
ck('its separation is the bust and both sleeves', circular.inputs.separationCount, 284);
ck('spread over the rounds asked for', circular.plan.rounds.length, 3);
ck('three rounds unless told otherwise', at('yoke', { neckCount: 88 }).inputs.increaseRounds, 3);
ck('nothing to plan is nothing', A.PlanConstructionAtSize({}).planner, 'null');

print('\n8. Hostile input produces nothing, not NaN');
ck('no counts to scale', A.ScaleRowCounts({}).counts.length, 0);
ck('no raglan', A.PlanRaglanYoke({}).increaseRounds, 'null');
ck('no set-in', A.PlanSetInSleeve({}).armhole, 'null');
ck('no yoke', A.PlanCircularYoke({}).rounds.length, 0);
ck('no sequence to scale', A.ScaleRowSequence({}).rows.length, 0);
ck('no piece to grade', A.GradePieceRows({}).rows.length, 0);
ck('no run to grade', A.GradeShapedRun({}).sizes.length, 0);
ck('no runs in nothing', A.ShapedRuns().length, 0);
ck('no pieces to check', A.CheckGradedPieces({}).findings.length, 0);
ck('no NaN anywhere', /NaN/.test(JSON.stringify([
    A.ScaleRowCounts({}), A.ScaleRowSequence({}), A.PlanRaglanYoke({}), A.PlanSetInSleeve({}),
    A.PlanCircularYoke({}), A.MatchSizeLabel(), A.NearestSizeByCount(),
    A.GradePieceRows({}), A.GradeShapedRun({}), A.ShapedRuns(), A.CheckGradedPieces({}),
    A.PlanConstructionAtSize({}), A.PlanConstructionAtSize({ construction: 'raglan' })
])), false);

endSuite();
