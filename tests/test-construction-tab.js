// Construction: the tab that reaches the engine APIs nothing else in the app called.
//
// Almost every assertion compares what is ON SCREEN against what the engine returns when called directly,
// rather than against a number written out here. That is the point of the tab - it is a window onto
// analytics.js, and a window that quietly rounds, rewords or recomputes is not one. A hard-coded
// expectation would pass just as happily against a panel doing its own arithmetic.
//
// CheckGarmentConstruction, PieceSpan and ShapedTail moved out on 2026-08-14: the Grader's own
// "Construction check" reaches them now, held to the Generator's Construction field, so that check
// stopped needing a door of its own. Its coverage moved with it, into tests/test-grader.js.
boot();

function has(l, haystack, needle) { ck(l + ' — looked for "' + needle + '"', String(haystack).indexOf(needle) !== -1, true); }

var HTML = readFile('index.html');
var A = window.CrochetAnalyticsEngine;

function nav(id) { $(id).fire('click'); }
function shown(id) { return !$(id).classList.contains('hidden'); }
function seen(id) { return $(id).text(); }
function type(id, value) { $(id).value = String(value); $(id).fire('input'); }
function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }

var PANELS = ['construction-panel', 'construction-yoke-panel', 'construction-impact-panel'];

print('\n1. The tab exists and is a destination like any other');
ok('nav-construction is in the markup', HTML.indexOf('id="nav-construction"') !== -1);
ck('and is a button, not a form control',
   (HTML.match(/<(\w+)[^>]*\bid="nav-construction"/) || [, ''])[1], 'button');
ok('the tab is named for it', HTML.indexOf('<span class="nav-label">Construction</span>') !== -1);
PANELS.forEach(function (id) {
    ok(id + ' is in the markup', HTML.indexOf('id="' + id + '"') !== -1);
});

nav('nav-construction');
PANELS.forEach(function (id) { ok(id + ' is on screen', shown(id)); });
no('the grader is put away', shown('grader-section'));
no('the matrix is put away', shown('matrix-section'));
no('and the dashboard with it', shown('dashboard-view'));
ck('the topbar names the view', $('view-title').textContent, 'Construction');
ck('one column, as every view is', $('workspace').dataset.cols, 'one');

print('\n2. The index names the engines it reaches, and checks they are really there');
var REACHED = ['PlanRaglanYoke', 'PlanSetInSleeve', 'PlanCircularYoke',
               'ImpactOfChange', 'DependentsOf'];
REACHED.forEach(function (name) {
    ok(name + ' is exported by the engine', !!A[name]);
    has('and named on the index', seen('construction-index'), name);
});
// CHART_CM_DISCREPANCIES is back-end only on purpose: a tripwire on our own transcription of the
// published charts, held to "these and only these" by tests/test-grader.js, not a finding a designer
// can act on. CheckGarmentConstruction left for a different reason - the Grader reaches it now - so it
// is checked the same way rather than lumped in with the one that was never meant to surface here.
ok('the discrepancy record is still in the engine', !!A.CHART_CM_DISCREPANCIES);
no('but nothing on the tab surfaces it', /CHART_CM_DISCREPANCIES/.test(seen('construction-index')));
no('nor the construction check, which moved to the Grader',
   /CheckGarmentConstruction/.test(seen('construction-index')));
// Read out of the markup rather than through $(): the DOM stub invents an element for any id it is asked
// for, so "is this element absent" cannot be asked of it at all.
no('it has no panel of its own', /id="construction-chart-panel"/.test(HTML));
no('nor a table to draw into', /id="construction-chart-table"/.test(HTML));
no('and the heading it used to carry is gone', /disagrees with itself/.test(HTML));
no('and the construction check panel is gone too', /id="construction-check-panel"/.test(HTML));
no('and none is reported missing from the build',
   /not in this build/.test(seen('construction-index')));
PANELS.slice(1).forEach(function (id) {
    ok('the index offers a way down to ' + id, !!$('construction-go-' + id));
});

print('\n3. An untouched planner asks for counts rather than scolding');
has('empty planner says what it needs', seen('construction-yoke-result'), 'Fill in the counts');
ck('raglan is the construction it opens on', $('construction-con-raglan').classList.contains('is-on'), true);
no('and the other two are not', $('construction-con-setIn').classList.contains('is-on'));
// The reason a raglan needs a planner comes from CONSTRUCTIONS, the same table the generator's construction
// dropdown reads. Written out here as well, the two would be free to disagree about what a raglan is.
has('the reason is the engine\'s own', seen('construction-con-why'), A.CONSTRUCTIONS.raglan.reason);
ck('no row gauge yet, and it says so', /No row gauge yet/.test(seen('construction-yoke-gauge')), true);

print('\n4. A raglan yoke, planned');
type('construction-f-raglan-neckCount', 76);
type('construction-f-raglan-frontBackCount', 180);
type('construction-f-raglan-sleeveCount', 60);
type('construction-f-raglan-yokeRows', 34);

var raglan = A.PlanRaglanYoke({ neckCount: 76, frontBackCount: 180, sleeveCount: 60, yokeRows: 34 });
ok('the engine says this raglan works', raglan.feasible);
var raglanSeen = seen('construction-yoke-result');
has('the separation count is shown', raglanSeen, String(raglan.separationCount));
ck('and it is the sum the engine made it', raglan.separationCount, 180 + 60 * 2);
has('the number of increase rounds', raglanSeen, String(raglan.increaseRounds));
has('the shaping, in the engine\'s words', raglanSeen, raglan.shaping.text);
has('and the balanced alternative', raglanSeen, raglan.shaping.balancedText);
no('nothing is flagged', /grade-warning/.test(JSON.stringify(raglan.warning)) || raglan.warning);

print('\n5. A raglan whose numbers cannot meet says so, in full');
type('construction-f-raglan-frontBackCount', 181);
var broken = A.PlanRaglanYoke({ neckCount: 76, frontBackCount: 181, sleeveCount: 60, yokeRows: 34 });
no('the engine refuses it', broken.feasible);
has('the whole refusal reaches the panel', seen('construction-yoke-result'), broken.warning);
has('including why a raglan cannot bend', seen('construction-yoke-result'), 'gains exactly 8 stitches a round');
type('construction-f-raglan-frontBackCount', 180);

print('\n6. Switching construction keeps each planner\'s own numbers');
nav('nav-construction');
$('construction-con-setIn').fire('click');
ck('set-in is now the one on', $('construction-con-setIn').classList.contains('is-on'), true);
no('and the raglan is not', $('construction-con-raglan').classList.contains('is-on'));
ok('its own fields are on screen', !!$('construction-f-setIn-bodyCount'));
has('and its reason came with it', seen('construction-con-why'), A.CONSTRUCTIONS.setIn.reason);
$('construction-con-raglan').fire('click');
ck('back on the raglan, the neck count survived', $('construction-f-raglan-neckCount').value, '76');
has('and so did its plan', seen('construction-yoke-result'), raglan.shaping.text);

print('\n7. Row gauge is taken from the swatch, not asked for');
$('gauge-width').value = '4'; $('gauge-height').value = '4';
$('gauge-stitches').value = '16'; $('gauge-rows').value = '20';
$('gauge-width').fire('input');
nav('nav-construction');
has('the panel names the gauge it is working at', seen('construction-yoke-gauge'), '5 rows per inch');
var deep = A.PlanRaglanYoke({ neckCount: 76, frontBackCount: 180, sleeveCount: 60,
                              yokeRows: 34, rowsPerInch: 5 });
ck('a yoke depth in inches follows from it', deep.depthInches, 6.8);
has('and it is on screen', seen('construction-yoke-result'), '6.8 in');

print('\n8. A set-in cap that does not fit its armhole');
$('construction-con-setIn').fire('click');
type('construction-f-setIn-bodyCount', 160);
type('construction-f-setIn-shoulderCount', 100);
type('construction-f-setIn-underarmCount', 6);
type('construction-f-setIn-armholeRows', 40);
type('construction-f-setIn-sleeveCount', 76);
type('construction-f-setIn-capRows', 30);
type('construction-f-setIn-capTopCount', 26);

var setIn = A.PlanSetInSleeve({ bodyCount: 160, shoulderCount: 100, underarmCount: 6,
                                armholeRows: 40, sleeveCount: 76, capRows: 30,
                                capTopCount: 26, rowsPerInch: 5 });
var setInSeen = seen('construction-yoke-result');
ck('the armhole edge measures 8 in', setIn.armholeEdgeInches, 8);
ck('the cap edge measures 6 in', setIn.capEdgeInches, 6);
has('both edges are shown, because both have to match', setInSeen, '8 in');
has('the cap edge as well', setInSeen, '6 in');
ok('the engine calls it a mismatch', !!setIn.warning);
has('and the panel carries the whole sentence', setInSeen, setIn.warning);
has('the armhole shaping is the engine\'s', setInSeen, setIn.armhole.text);
has('and the cap\'s is separate from it', setInSeen, setIn.cap.text);

print('\n9. A circular yoke, round by round');
$('construction-con-circular').fire('click');
type('construction-f-circular-neckCount', 80);
type('construction-f-circular-separationCount', 240);
type('construction-f-circular-yokeRows', 40);
type('construction-f-circular-increaseRounds', 3);

var circular = A.PlanCircularYoke({ neckCount: 80, separationCount: 240, yokeRows: 40,
                                    increaseRounds: 3, rowsPerInch: 5 });
ok('the engine plans it', circular.feasible);
ck('three passes, as asked for', circular.rounds.length, 3);
var circularSeen = seen('construction-yoke-result');
circular.rounds.forEach(function (round, index) {
    has('round ' + (index + 1) + ' is numbered', circularSeen, 'Round ' + round.round);
    has('round ' + (index + 1) + ' says what it grows to', circularSeen, String(round.to));
    // SpaceEvenly's own sentence, ordinals and plurals included. This is the part a panel is most tempted
    // to rewrite, and rewriting it is how it comes to disagree with the suite that pins the engine.
    has('round ' + (index + 1) + ' spaces its increases', circularSeen, round.spacing.text);
});
ck('the last pass lands exactly on the separation count',
   circular.rounds[2].to, 240);

print('\n10. What a measurement reaches');
nav('nav-construction');
var POINTS = Object.keys(A.MEASUREMENT_DEPENDS_ON);
ck('one button per measurement in the graph', POINTS.length, 9);
POINTS.forEach(function (point) {
    ok(point + ' has a button', !!$('construction-pt-' + point.toLowerCase()));
});
has('nothing picked yet', seen('construction-impact-result'), 'Pick a measurement');

$('construction-pt-chest').fire('click');
var chest = A.ImpactOfChange({ point: 'chest', sections: [] });
var chestSeen = seen('construction-impact-result');
has('the engine\'s own sentence is what is shown', chestSeen, chest.detail);
// Everything but backLength: chest is upstream of all eight other points except the one length that is
// nobody's consequence.
ck('chest reaches seven measurements', chest.dependents.length, 7);
has('and the panel says seven', chestSeen, '7');
ck('backLength is the only one it misses',
   POINTS.filter(function (pt) { return pt !== 'chest' && chest.dependents.indexOf(pt) === -1; }).join(),
   'backLength');
// The half the grader already had is one hop: "from chest + upperArm". This walks on.
ok('armholeDepth is one hop from chest', A.MEASUREMENT_DEPENDS_ON.armholeDepth.indexOf('chest') !== -1);
ok('and backNeckToWrist is not', A.MEASUREMENT_DEPENDS_ON.backNeckToWrist.indexOf('chest') === -1);
ok('yet DependentsOf still reaches it', chest.dependents.indexOf('backNeckToWrist') !== -1);
has('so the chain names it too', chestSeen, A.MEASUREMENT_LABELS.backNeckToWrist);
has('chest is a root, and says so', chestSeen, 'root measurement');
has('with no pattern open there is nothing to reach', chestSeen, 'No pattern is open');

$('construction-pt-chest').fire('click');
has('tapping it again clears it', seen('construction-impact-result'), 'Pick a measurement');

print('\n11. And the pieces of the open pattern it lands in');
load(['Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)',
      'Row 2: ch 1, turn, sc in each st across (20)']);
nav('nav-sizer');
$('grade-sy-pattern').value = 'sleeve';
$('grade-sy-pattern').fire('change');
nav('nav-construction');
$('construction-pt-upperarm').fire('click');
var reachSeen = seen('construction-impact-result');
has('the section is named', reachSeen, 'Pattern');
has('with the measurement that reached it', reachSeen, A.MEASUREMENT_LABELS.upperArm);
has('and the one downstream of it', reachSeen, A.MEASUREMENT_LABELS.armLength);
// A sleeve carries upperArm and armLength. Chest is upstream of both, so a chest change reaches the
// sleeve; hip is neither, so it must not.
$('construction-pt-hip').fire('click');
has('a measurement the sleeve does not carry reaches no piece',
    seen('construction-impact-result'), 'None of your sections carries this');

print('\n12. New File empties the planners');
window.confirm = function () { return true; };
$('new-file-btn').fire('click');
nav('nav-construction');
ck('the raglan neck count is gone', $('construction-f-raglan-neckCount').value, '');
has('and the planner is asking again', seen('construction-yoke-result'), 'Fill in the counts');
ck('the construction is back to the raglan', $('construction-con-raglan').classList.contains('is-on'), true);
has('with no measurement picked', seen('construction-impact-result'), 'Pick a measurement');

endSuite();
