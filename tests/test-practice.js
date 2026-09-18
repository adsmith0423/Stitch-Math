/**
 * Daily Practice - and the real specification for PRACTICE_ROWS in app.js, as test-templates.js is
 * for the templates.
 *
 * THE RULE THIS SUITE EXISTS TO ENFORCE. A practice row is graded by CrochetMathEngine and never by
 * a number stored beside it. An answer kept in the table would eventually disagree with the
 * validator, and then the app would be teaching something its own checker contradicts. Section 4
 * asserts the absence of the field mechanically, because a rule kept by memory is a rule that lasts
 * until the next person adds a row.
 *
 * Everything is driven through the panel's own controls - the answer box and the Check button - so
 * the wiring is under test alongside the arithmetic. test-templates.js's header explains why that
 * matters more than it looks.
 */
boot();

var E = window.CrochetMathEngine;
var SRC = readFile('app.js');

function nav(id) { $(id).fire('click'); }
function progress() { return JSON.parse(localStorage.getItem('stitchmath_progress') || '{}'); }
function seedProgress(fields) {
    var store = progress();
    for (var key in fields) store[key] = fields[key];
    localStorage.setItem('stitchmath_progress', JSON.stringify(store));
}
function resetProgress() {
    localStorage.removeItem('stitchmath_progress');
    $('new-file-btn').fire('click');
}
function answer(value) {
    $('practice-answer').value = String(value);
    $('practice-check').fire('click');
}
/** What the panel should say about what is in hand. Nothing in hand used to mean a magic ring,
 *  because every row starting from nothing was one; flat-foundation starts from a chain instead. */
function inHand(row) {
    if (row.available) return 'You have ' + row.available + ' stitches.';
    return 'You are starting from '
        + (/magic ring/.test(row.instruction) ? 'a magic ring' : 'a foundation chain')
        + ', with nothing to work into yet.';
}
/** The rows, read back out of app.js. There is no export for them and there should not be - this is
 *  a curated table, not an interface - so the suite parses the source the way the linter suites do. */
function practiceRows() {
    var body = SRC.slice(SRC.indexOf('const PRACTICE_ROWS = ['),
                         SRC.indexOf('const PRACTICE_POINTS'));
    var rows = [];
    body.replace(/\{\s*id: '([^']+)', tier: (\d+), available: (\d+),\s*instruction: '([^']*)',\s*teaches: '([^']*)'/g,
        function (all, id, tier, available, instruction, teaches) {
            rows.push({ id: id, tier: Number(tier), available: Number(available),
                        instruction: instruction, teaches: teaches });
            return all;
        });
    return rows;
}

var ROWS = practiceRows();

print('\n1. The table was read, and it is worth reading');
ok('at least thirty rows are offered, there are ' + ROWS.length, ROWS.length >= 30);
ok('and they span every tier', [1, 2, 3, 4, 5, 6, 7, 8].every(function (tier) {
    return ROWS.some(function (row) { return row.tier === tier; });
}));

print('\n1b. The answers are varied, tier by tier');
/*
 * The point of the table is that you cannot guess. A pool where four rows out of six come to the
 * same figure teaches the figure, not the reading - which is how tier 1 spent a run of days all
 * answering 18. So each tier is held to a share of DISTINCT answers, not just to a row count: the
 * ceiling opens tiers cumulatively, so tier N is judged on everything at or below it.
 */
function answersUpTo(tier) {
    return ROWS.filter(function (r) { return r.tier <= tier; })
        .map(function (r) { return E.evaluateStep(0, r.available, r.instruction, 1, 0, 0, 0).calculatedYield; });
}
[1, 2, 3, 4, 5, 6, 7, 8].forEach(function (tier) {
    var answers = answersUpTo(tier);
    var distinct = new Set(answers).size;
    ok('tier ' + tier + ' opens at least 10 rows, has ' + answers.length, answers.length >= 10);
    ok('tier ' + tier + ' spreads over at least 8 answers, has ' + distinct, distinct >= 8);
    // No single figure may dominate: at worst a third of the pool, so a guesser is wrong most days.
    var worst = 0;
    new Set(answers).forEach(function (a) {
        worst = Math.max(worst, answers.filter(function (x) { return x === a; }).length);
    });
    ok('and no one answer covers more than a third of tier ' + tier + ', worst is '
       + worst + '/' + answers.length, worst * 3 <= answers.length);
});
// A beginner sees tier 1 only, so its own spread is what most people meet. Guarded on its own.
ok('tier 1 alone is not four rows and two answers',
   new Set(ROWS.filter(function (r) { return r.tier === 1; })
       .map(function (r) { return E.evaluateStep(0, r.available, r.instruction, 1, 0, 0, 0).calculatedYield; })).size >= 7);

print('\n2. Every row validates clean through the engine');
// The load-bearing assertion. A practice row the engine cannot read teaches the opposite of what it
// is for, and a row that uses fewer stitches than it is handed does not validate at all.
ROWS.forEach(function (row) {
    var evaluation = E.evaluateStep(0, row.available, row.instruction, 1, 0, 0, 0);
    ok(row.id + ' is workable as written', evaluation.costIsValid);
    ok(row.id + ' produces stitches', evaluation.calculatedYield > 0);
    ck(row.id + ' has no unreadable token', (evaluation.unknownTokens || []).join(',') || 'none', 'none');
});

print('\n3. Every row is a stable, distinct ledger key with something to teach');
var ids = {};
ROWS.forEach(function (row) {
    no(row.id + ' is not a duplicate', ids[row.id]);
    ids[row.id] = true;
    ok(row.id + ' explains itself', row.teaches.length > 20);
    ok(row.id + ' sits in a real tier', row.tier >= 1 && row.tier <= 8);
});

print('\n4. NO ROW STORES ITS ANSWER');
// Invariant 5, enforced mechanically rather than by memory. If any of these ever appear in the table,
// the row is carrying a number that can drift from what the validator says.
var TABLE = SRC.slice(SRC.indexOf('const PRACTICE_ROWS = ['), SRC.indexOf('const PRACTICE_POINTS'));
no('no answer field', /\banswer\s*:/.test(TABLE));
no('no yield field', /\byield\s*:/.test(TABLE));
no('no count field', /\bcount\s*:/.test(TABLE));
no('no expected field', /\bexpected\s*:/.test(TABLE));
// And the grader really does ask the engine, with expectedYield 0 so it reports rather than judges.
ok('the answer comes back from evaluateStep',
   /function practiceAnswer\(row\) \{[\s\S]*?CrochetMathEngine\.evaluateStep\(/.test(SRC));
ok('and is asked for expectedYield 0',
   /0,\s*\/\/ expectedYield - 0 so the engine reports rather than judges/.test(SRC));

print('\n5. A store that has never seen the setting comes up with the layer ON');
// The other half of test-practice-mode.js's claim, which needs the clean boot this suite has. A
// beginner will not go looking in Settings for a feature they do not know exists.
ck('the switch is on', $('toggle-practice-mode').checked, true);
// Checked on the surfaces the GATE owns rather than on the panel: showView hides every panel that
// does not belong to the current view, so a hidden practice-panel on the Dashboard proves nothing
// either way. The nav entry and the sidebar block are the gate's alone.
no('the Practice tab is not hidden', $('nav-practice').classList.contains('hidden'));
no('nor the points block', $('sidebar-points').classList.contains('hidden'));
no('nor the progress pill', $('status-pill').classList.contains('hidden'));

print('\n6. The draw is the same row all day, and survives leaving the view');
resetProgress();
nav('nav-practice');
var first = $('practice-instruction').textContent;
var drawn = progress().practice.rowId;
ok('a row was drawn', drawn.length > 0);
nav('nav-dashboard');
nav('nav-practice');
ck('coming back gives the same row', $('practice-instruction').textContent, first);
ck('and the same ledger key', progress().practice.rowId, drawn);
// Deterministic from the date: clearing only the day stamp and asking again re-draws the same one.
seedProgress({ practice: { date: '', rowId: '', answered: false, given: 0, correct: false, met: false } });
nav('nav-dashboard');
nav('nav-practice');
ck('re-drawing on the same date gives the same row again', progress().practice.rowId, drawn);

print('\n6b. And a different row - and a different ANSWER - the next day');
/*
 * The draw used to be pool[hash(date) % pool.length], which is memoryless: nothing stopped two days
 * running from serving the same row, and at tier 1 the pool is six rows so they often did. Worse,
 * rows that are NOT the same can still have the same answer - "sc in each st around" over eighteen
 * and "[1 sc, inc] * 6" over twelve both come to 18 - and four days in a row answering 18 is what
 * this replaces. A question whose answer you can guess from yesterday is not a question.
 *
 * Driven by moving the clock rather than by reading the dealer, because what matters is what the
 * panel serves. A year is long enough to cross many cycle boundaries, which is where the first two
 * attempts at this leaked.
 */
var realNow = Date.now;
function runYear(days) {
    var answers = [], rows = [], base = Date.UTC(2026, 0, 1);
    for (var d = 0; d < days; d++) {
        Date.now = function (day) { return function () { return base + day * 86400000; }; }(d);
        seedProgress({ practice: { date: '', rowId: '', answered: false, given: 0, correct: false, met: false } });
        nav('nav-practice');
        var id = progress().practice.rowId;
        var served = ROWS.filter(function (r) { return r.id === id; })[0];
        rows.push(id);
        answers.push(E.evaluateStep(0, served.available, served.instruction, 1, 0, 0, 0).calculatedYield);
    }
    Date.now = realNow;
    return { rows: rows, answers: answers };
}
function backToBack(list) {
    var n = 0;
    for (var i = 1; i < list.length; i++) if (list[i] === list[i - 1]) n++;
    return n;
}
resetProgress();
var year = runYear(365);
ck('no day serves the row the day before served', backToBack(year.rows), 0);
// The one that was actually reported. Two different rows sharing an answer is the case a
// row-identity check alone would miss.
ck('and no day serves the same ANSWER as the day before', backToBack(year.answers), 0);
ok('the year is not one row on repeat either', new Set(year.rows).size >= 6);
// Every row in the pool comes up once per cycle of pool.length days, so a year uses all of them.
ok('every row open to this designer gets used', new Set(year.rows).size ===
   ROWS.filter(function (r) { return r.tier <= 1; }).length);
// Still the same row all day, and still the same row on another device: the deal is a function of
// the date and the ceiling, and reads nothing about what was served before.
no('the dealer keeps no record of what it served', /practice\.(served|history|recent)/.test(SRC));
resetProgress();

print('\n7. A wrong answer is still shown the working, and still counts as the day');
resetProgress();
nav('nav-practice');
var row = ROWS.filter(function (r) { return r.id === progress().practice.rowId; })[0];
var right = E.evaluateStep(0, row.available, row.instruction, 1, 0, 0, 0).calculatedYield;
ck('the panel states what is in hand', $('practice-available').textContent, inHand(row));
answer(right + 7);
ok('the verdict names the real count', $('practice-verdict').textContent.indexOf(String(right)) >= 0);
ck('and what was actually said', $('practice-verdict').textContent.indexOf(String(right + 7)) >= 0, true);
ck('the lesson is shown either way', $('practice-teaches').textContent, row.teaches);
ck('a wrong answer pays nothing', progress().points, 0);
ck('but the thinking was the work', progress().streak, 1);

print('\n8. No second attempt at the same day\'s row');
// The point is the thinking, not the guessing. A box that keeps taking numbers until one is right
// teaches nothing at all.
answer(right);
ck('the right answer afterwards still pays nothing', progress().points, 0);
no('and the verdict was not rewritten', /Yes/.test($('practice-verdict').textContent));
ok('the box is closed', $('practice-answer').disabled);
ok('and so is the button', $('practice-check').disabled);

print('\n9. A correct answer pays, once');
resetProgress();
nav('nav-practice');
row = ROWS.filter(function (r) { return r.id === progress().practice.rowId; })[0];
right = E.evaluateStep(0, row.available, row.instruction, 1, 0, 0, 0).calculatedYield;
answer(right);
var paid = progress().points;
ok('a correct answer pays', paid > 0);
ok('and says so', /Yes/.test($('practice-verdict').textContent));
answer(right);
ck('answering again pays nothing more', progress().points, paid);
ck('and the record still shows one answer', progress().practice.answered, true);

print('\n10. ANY ONE SLOT ADVANCES THE STREAK, WITH NO PATTERN AT ALL');
// The whole reason for this block of work. Every other way to earn presupposes somebody already
// writing a pattern; these three do not, and the Studio is empty for all of them.
resetProgress();
ck('the editor really is empty', $('bulk-input').value, '');
ck('and nothing has been earned', progress().points || 0, 0);

// Slot A.
nav('nav-practice');
answer(0);
ck('reading a row starts a streak from nothing', progress().streak, 1);

// Slot B, on a fresh day so the streak has somewhere to go.
resetProgress();
ck('back to no streak', progress().streak || 0, 0);
nav('nav-practice');
$('roll-worked').fire('click');
ck('meeting a stitch is a day\'s work too', progress().streak, 1);
ck('and it is recorded as met', progress().practice.met, true);
var token = progress().roll.stitch;
ok('the stitch went into the collection', !!progress().collection[token]);
ck('dated with the day it was worked', progress().collection[token], new Date().toISOString().slice(0, 10));
ck('and it paid nothing on its own', progress().points, 0);
$('roll-worked').fire('click');
ok('pressing it again changes nothing', $('roll-worked').disabled);

// Slot C is the Gauge Profile's own award, which already paid and already recorded the day. What is
// new is that the panel can say whether it happened.
resetProgress();
nav('nav-practice');
ck('no swatch yet today', $('practice-swatch-state').textContent, 'Not done today');
ok('and the slot links through rather than reimplementing it',
   /practice-swatch-go'\]\?\.addEventListener\('click', \(\) => navigateTo\('nav-gauge'\)\)/.test(SRC));
seedProgress({ lastSwatch: new Date().toISOString().slice(0, 10) });
nav('nav-dashboard');
nav('nav-practice');
ck('a swatch logged today is reported', $('practice-swatch-state').textContent, 'Done today');

print('\n11. The panel is a view, because two of its slots need form controls');
// The Dashboard carries none by contract - section 12 of test-shell.js - which is why this is not a
// card there.
var HTML = readFile('index.html');
var PANEL = HTML.slice(HTML.indexOf('id="practice-panel"'), HTML.indexOf('7b-iii-b. CONSTRUCTION'));
ok('the answer box is a real input', /<input type="number" id="practice-answer"/.test(PANEL));
ok('the three slots are all there',
   /id="practice-read"/.test(PANEL) && /id="practice-meet"/.test(PANEL) && /id="practice-swatch"/.test(PANEL));

endSuite();
