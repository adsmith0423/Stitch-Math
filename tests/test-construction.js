// Holding a written garment to the construction it says it is.
//
// The fault class this exists for is the one no row-by-row check can reach: every row consumes exactly
// what the row before produced, the health score is 100, and the yoke is still not a raglan. So the
// fixtures are deliberately built to PASS the stitch math and to fail as garments.
boot();

function has(l, haystack, needle) {
    ck(l + ' — looked for "' + needle + '"', String(haystack).indexOf(needle) !== -1, true);
}

var A = window.CrochetAnalyticsEngine;

function piece(title, type, counts) {
    return {
        key: title.toLowerCase(), title: title, type: type,
        widestStitches: Math.max.apply(null, counts),
        worked: counts.map(function (c, i) { return { label: 'Row ' + (i + 1), count: c }; })
    };
}
function check(construction, sections, rowsPerInch) {
    return A.CheckGarmentConstruction({
        construction: construction, sections: sections,
        rowsPerInch: rowsPerInch === undefined ? 5 : rowsPerInch
    });
}
function named(report, name) {
    return report.checks.filter(function (c) { return c.name === name; })[0] || null;
}
function stateOf(report, name) { var c = named(report, name); return c ? c.state : 'absent'; }
function detailOf(report, name) { var c = named(report, name); return c ? c.detail : ''; }

// A raglan yoke that works: 76 at the neck, eight a round on 28 of its 34 rounds.
function soundRaglan() {
    var out = [76], left = 28;
    for (var i = 0; i < 34; i++) {
        if (i % 6 !== 5 && left > 0) { out.push(out[out.length - 1] + 8); left--; }
        else out.push(out[out.length - 1]);
    }
    return out;
}
function paired(times, from) {
    var out = [from];
    for (var i = 0; i < times; i++) out.push(out[out.length - 1] - 2);
    return out;
}

print('\n1. PieceSpan reads a piece as a shape');
var span = A.PieceSpan([{ label: 'R1', count: 10 }, { label: 'R2', count: 10 },
                        { label: 'R3', count: 14 }, { label: 'R4', count: 14 }]);
ck('it starts where the piece starts', span.from, 10);
ck('and ends where it ends', span.to, 14);
// Three rows follow the first, and the first establishes the count rather than changing it. A yoke of 35
// rows has 34 in which to grow.
ck('rows is what there is to shape over, not the row count', span.rows, 3);
ck('only the rows that moved are events', span.events, 1);
ck('and the event names the row it happened in', span.steps[0].label, 'R3');
ck('with the size of the move', span.steps[0].delta, 4);
ck('a piece of one row has no shape', A.PieceSpan([{ label: 'R1', count: 10 }]), null);
ck('nor has an empty one', A.PieceSpan([]), null);
ck('a row with no resolved count is not counted',
   A.PieceSpan([{ label: 'R1', count: 10 }, { label: 'R2', count: null },
                { label: 'R3', count: 12 }]).rows, 1);

print('\n2. ShapedTail finds the shaped end of a piece');
// A sleeve: grows up the arm, then decreases for the cap. The cap is the trailing run.
var cap = A.ShapedTail(piece('S', 'sleeve', [60, 64, 68, 72, 72, 70, 68, 66]).worked);
ck('the tail runs the way the piece ends', cap.direction, 'decrease');
ck('it starts where the decreasing starts', cap.from, 72);
ck('and it does not swallow the growth below it', cap.to, 66);
ck('over the rows the decreasing took', cap.rows, 3);
ck('one event per row that moved', cap.events, 3);

// Straight rows INSIDE the run belong to it — decreasing every other row is one armhole.
var every2nd = A.ShapedTail(piece('B', 'body', [100, 100, 98, 98, 96, 96, 94]).worked);
ck('a decrease every other row is still one tail', every2nd.from, 100);
ck('and it reaches the end', every2nd.to, 94);
ck('counting only the rows that moved', every2nd.events, 3);
// ...but leading straight rows do not, or the armhole swallows the body below it.
ck('the body below it is not part of the armhole', every2nd.rows, 5);

var trailing = A.ShapedTail(piece('B', 'body', [100, 96, 92, 92, 92]).worked);
ck('rows worked flat after the shaping are not part of it', trailing.to, 92);
ck('and are counted separately', trailing.straightAfter, 2);
ck('a piece that never moves has no tail',
   A.ShapedTail(piece('B', 'body', [40, 40, 40]).worked).direction, 'none');
ck('nor has a piece of one row', A.ShapedTail(piece('B', 'body', [40]).worked).direction, 'none');
ck('a piece that only grows has an increasing tail',
   A.ShapedTail(piece('S', 'sleeve', [40, 42, 44]).worked).direction, 'increase');

print('\n3. A raglan that works');
var good = check('raglan', [piece('Yoke', 'yoke', soundRaglan()),
                            piece('Body', 'body', [180, 180]),
                            piece('Sleeve', 'sleeve', [60, 60])]);
ck('the report passes', good.state, 'pass');
ck('and names the planner that answered it', good.planner, 'PlanRaglanYoke');
ck('the yoke hands on what the pieces need', stateOf(good, 'The yoke meets the pieces'), 'pass');
has('and says what that is', detailOf(good, 'The yoke meets the pieces'), '300 sts');
ck('the total gain is a multiple of eight', stateOf(good, 'Eight stitches a round'), 'pass');
ck('and every round adds eight', stateOf(good, 'Every round adds eight'), 'pass');
// The wording is DistributeShaping's, lowercased into the sentence. Nothing here restates a plan the
// engine already put into words.
has('in the engine\'s own words', detailOf(good, 'Eight stitches a round'),
    A.DistributeShaping({ from: 76, to: 300, rows: 34, preset: 'raglan' }).text.toLowerCase());
ck('the depth follows from the row gauge', stateOf(good, 'Yoke depth'), 'pass');
has('and is stated in inches', detailOf(good, 'Yoke depth'), '6.8 in');

print('\n4. A raglan whose yoke does not meet its own pieces');
var short = check('raglan', [piece('Yoke', 'yoke', soundRaglan()),
                             piece('Body', 'body', [176, 176]),
                             piece('Sleeve', 'sleeve', [60, 60])]);
ck('it fails', short.state, 'fail');
ck('on the piece agreement', stateOf(short, 'The yoke meets the pieces'), 'fail');
has('naming both numbers', detailOf(short, 'The yoke meets the pieces'), '300 sts');
has('and the size of the gap', detailOf(short, 'The yoke meets the pieces'), '+4 sts');
// The yoke's own arithmetic is still sound — it is the pieces it does not fit.
ck('the yoke itself is not blamed', stateOf(short, 'Eight stitches a round'), 'pass');

print('\n5. A raglan whose total gain is not a multiple of eight');
var odd = soundRaglan();
odd[odd.length - 1] = odd[odd.length - 1] + 1;
var notEight = check('raglan', [piece('Yoke', 'yoke', odd),
                                piece('Body', 'body', [180, 180]),
                                piece('Sleeve', 'sleeve', [60, 60])]);
ck('it fails', stateOf(notEight, 'Eight stitches a round'), 'fail');
has('with DistributeShaping\'s own refusal', detailOf(notEight, 'Eight stitches a round'),
    '225 stitches cannot be worked 8 at a time');
has('and the nearest counts that would work', detailOf(notEight, 'Eight stitches a round'),
    'Nearest workable: 224 or 232');
has('plus why a raglan cannot bend', detailOf(notEight, 'Eight stitches a round'),
    'multiple of eight or it is not a raglan');

print('\n6. The check the totals cannot make: one round that adds six');
// Two rounds altered so they still sum to 224 - the totals above pass, and the yoke is still wrong. This
// is the whole reason the per-round check exists.
var limp = soundRaglan();
limp[10] = limp[10] - 2;
var offBeat = check('raglan', [piece('Yoke', 'yoke', limp),
                               piece('Body', 'body', [180, 180]),
                               piece('Sleeve', 'sleeve', [60, 60])]);
ck('the total still works out', stateOf(offBeat, 'Eight stitches a round'), 'pass');
ck('and the yoke still meets its pieces', stateOf(offBeat, 'The yoke meets the pieces'), 'pass');
ck('but the rounds do not', stateOf(offBeat, 'Every round adds eight'), 'fail');
ck('so the report fails', offBeat.state, 'fail');
has('the round that adds six is named', detailOf(offBeat, 'Every round adds eight'), 'adds 6');
has('and the one that makes it up', detailOf(offBeat, 'Every round adds eight'), 'adds 10');
has('by the row label the pattern gave them',
    detailOf(offBeat, 'Every round adds eight'), 'Row 11');

var flat = check('raglan', [piece('Yoke', 'yoke', [76, 76, 76, 76])]);
ck('a yoke that never grows fails outright', stateOf(flat, 'Every round adds eight'), 'fail');
has('and says nothing is being shaped', detailOf(flat, 'Every round adds eight'), 'nothing is being shaped');

print('\n7. What is skipped is said, not dropped');
var alone = check('raglan', [piece('Yoke', 'yoke', soundRaglan())]);
ck('with no body or sleeve typed, the agreement is skipped',
   stateOf(alone, 'The yoke meets the pieces'), 'skip');
has('and the panel says how to un-skip it',
    detailOf(alone, 'The yoke meets the pieces'), 'Sizer / Grader tab');
ck('the checks that CAN run still run', stateOf(alone, 'Eight stitches a round'), 'pass');

var noYoke = check('raglan', [piece('Body', 'body', [180, 180])]);
ck('with no yoke at all there is nothing to read', stateOf(noYoke, 'Yoke'), 'skip');
has('and it says which type to set', detailOf(noYoke, 'Yoke'), 'typed Yoke');

print('\n8. A set-in sleeve is two pieces or it is nothing');
// 3 straight rows, 6 bound off each side at the underarm, then 14 paired decreases.
var body = [160, 160, 160, 148].concat(paired(14, 148).slice(1));
var shortCap = [60, 62, 64, 66, 68, 70, 72, 74, 76].concat(paired(8, 76).slice(1));
var evenCap = [60, 62, 64, 66, 68, 70, 72, 74, 76].concat(paired(15, 76).slice(1));

var lone = check('setIn', [piece('Body', 'body', body)]);
ck('one piece is not enough to compare', stateOf(lone, 'Armhole and cap'), 'skip');
has('and it says so plainly', detailOf(lone, 'Armhole and cap'), 'comparing two pieces');

var badCap = check('setIn', [piece('Body', 'body', body), piece('Sleeve', 'sleeve', shortCap)]);
ck('the armhole is found without being told where it is',
   detailOf(badCap, 'The armhole is shaped into the body').indexOf('160 sts down to 120') !== -1, true);
has('including the underarm bind-off', detailOf(badCap, 'The armhole is shaped into the body'),
    '6 of them bound off at each underarm');
has('the cap is found the same way', detailOf(badCap, 'The cap is shaped into the sleeve'),
    '76 sts down to 60 over 8 rows');
ck('and the edges do not match', stateOf(badCap, 'The cap fits the armhole'), 'fail');
has('with PlanSetInSleeve\'s own sentence', detailOf(badCap, 'The cap fits the armhole'),
    'They are seamed together, so one of the two row counts is wrong');

var goodCap = check('setIn', [piece('Body', 'body', body), piece('Sleeve', 'sleeve', evenCap)]);
ck('a cap cut to the armhole passes', stateOf(goodCap, 'The cap fits the armhole'), 'pass');
// Both edges measured the same crude way. Docking the bind-off row from the armhole and nothing from the
// cap would put a row of bias into the one number this turns on.
has('and both edges are the same length', detailOf(goodCap, 'The cap fits the armhole'),
    'the cap edge is 3 in and the armhole edge is 3 in');

var noGauge = check('setIn', [piece('Body', 'body', body), piece('Sleeve', 'sleeve', shortCap)], null);
ck('without a row gauge the edges cannot be compared',
   stateOf(noGauge, 'The cap fits the armhole'), 'skip');
has('and it says what is needed', detailOf(noGauge, 'The cap fits the armhole'), 'row gauge');
ck('but the shapes are still read', stateOf(noGauge, 'The armhole is shaped into the body'), 'pass');

var flatTop = check('setIn', [piece('Body', 'body', body),
                              piece('Sleeve', 'sleeve', [60, 62, 64, 66, 66, 66])]);
ck('a sleeve with no cap is not a set-in sleeve', stateOf(flatTop, 'The cap'), 'fail');
has('and is named as the construction it actually is',
    detailOf(flatTop, 'The cap'), 'drop shoulder rather than a set-in one');

var noArmhole = check('setIn', [piece('Body', 'body', [160, 160, 160]),
                                piece('Sleeve', 'sleeve', evenCap)]);
ck('a body with no armhole fails too', stateOf(noArmhole, 'The armhole'), 'fail');

print('\n9. A circular yoke is judged on the rounds the pattern actually uses');
var crammed = [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 240];
var crowded = check('yoke', [piece('Yoke', 'yoke', crammed),
                             piece('Body', 'body', [180, 180]),
                             piece('Sleeve', 'sleeve', [30, 30])]);
ck('one round cannot carry the whole growth', crowded.state, 'fail');
ck('and it is the spacing that fails',
   stateOf(crowded, 'The increases fit the rounds they are worked in'), 'fail');
has('naming what the round asks for',
    detailOf(crowded, 'The increases fit the rounds they are worked in'),
    '160 increases across 80 sts');
has('and what to do about it',
    detailOf(crowded, 'The increases fit the rounds they are worked in'), 'more than 1 round');

var spread = [80, 80, 115, 115, 115, 166, 166, 166, 200, 200, 240, 240, 240, 240];
var roomy = check('yoke', [piece('Yoke', 'yoke', spread),
                           piece('Body', 'body', [180, 180]),
                           piece('Sleeve', 'sleeve', [30, 30])]);
ck('spread over four rounds it passes', roomy.state, 'pass');
ck('the planner that answered is named', roomy.planner, 'PlanCircularYoke');
has('and the four rounds are counted',
    detailOf(roomy, 'The increases fit the rounds they are worked in'), '4 increase rounds');
// A circular yoke has no fixed per-round increase, so it is never held to one - that is what separates it
// from the raglan above.
ck('it is never held to eight a round', named(roomy, 'Every round adds eight'), null);

print('\n10. A drop shoulder passes for a stated reason');
var drop = check('drop', [piece('Body', 'body', [160, 160, 160])]);
ck('it passes', drop.state, 'pass');
ck('with no planner, because it needs none', drop.planner, '');
has('and says why there is nothing to fail',
    detailOf(drop, 'Armhole and sleeve'), 'no armhole shaping and no cap to set in');
// A check that goes quiet on the easy case cannot be trusted on the hard one.
ck('it is a check, not a silence', drop.checks.length > 0, true);

print('\n11. The pieces it read are reported back');
ck('the yoke it used', good.pieces.yoke, 'Yoke');
ck('the body pieces', good.pieces.body.join(), 'Body');
ck('the sleeve pieces', good.pieces.sleeve.join(), 'Sleeve');
// A front and a back are each "the body": each carries an armhole, and together they are the circumference
// the yoke has to hand on to.
var split = check('raglan', [piece('Yoke', 'yoke', soundRaglan()),
                             piece('Front', 'front', [90, 90]),
                             piece('Back', 'back', [90, 90]),
                             piece('Sleeve', 'sleeve', [60, 60])]);
ck('a front and a back sum to the body', stateOf(split, 'The yoke meets the pieces'), 'pass');
has('and both are named', detailOf(split, 'The yoke meets the pieces'), 'the body (180)');
ck('both are reported as body pieces', split.pieces.body.join(), 'Front,Back');

endSuite();
