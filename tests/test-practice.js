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
ok('at least twenty rows are offered', ROWS.length >= 20);
ok('and they span every tier', [1, 2, 3, 4].every(function (tier) {
    return ROWS.some(function (row) { return row.tier === tier; });
}));

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
    ok(row.id + ' sits in a real tier', row.tier >= 1 && row.tier <= 4);
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

print('\n7. A wrong answer is still shown the working, and still counts as the day');
resetProgress();
nav('nav-practice');
var row = ROWS.filter(function (r) { return r.id === progress().practice.rowId; })[0];
var right = E.evaluateStep(0, row.available, row.instruction, 1, 0, 0, 0).calculatedYield;
ck('the panel states what is in hand', $('practice-available').textContent,
   row.available ? 'You have ' + row.available + ' stitches.'
                 : 'You are starting from a magic ring, with nothing to work into yet.');
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
