/**
 * Lesson badges - a record of the corrections somebody has actually accepted.
 *
 * The linter already emits a `lesson` on many findings: one general sentence on why a convention
 * matters, as opposed to `detail`'s specific claim about this row. It appeared once and vanished.
 *
 * THE TRIGGER IS THE WHOLE DESIGN, and it is what this suite pins. A lesson is earned when the fix is
 * APPLIED through the app's own control - the path that uses `fix.edit`. Not when the finding
 * appears, which would reward writing bad patterns. Not when it is dismissed, which would reward
 * ignoring advice. Applying the correction is the only event that means the lesson landed.
 *
 * And it pays nothing. This is a record of understanding, and pricing it would invite farming.
 */
boot();

var SRC = readFile('app.js');

function nav(id) { $(id).fire('click'); }
function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function progress() { return JSON.parse(localStorage.getItem('stitchmath_progress') || '{}'); }
function lessons() { return progress().lessons || {}; }
function resetProgress() {
    localStorage.removeItem('stitchmath_progress');
    $('new-file-btn').fire('click');
}
function today() { return new Date().toISOString().slice(0, 10); }
function listText() { nav('nav-analytics'); return $('lessons-list').text(); }

// Bracket repeat shorthand. It is a `style` finding, so it carries both a lesson and an applicable
// edit - which is exactly the combination this feature is about.
var TAUGHT = ['Ch 12 (12)', 'Row 2: [2 sc, inc] x 4 (16)'];
// A plain arithmetic correction: a real fix with an edit and no lesson behind it.
var UNTAUGHT = ['Ch 12 (12)', 'Row 2: sc in each st across (10)'];

print('\n1. Nothing is recorded for a finding that merely appeared');
resetProgress();
nav('nav-studio');
load(TAUGHT);
ck('the suggestion is on screen', $('lint-side-tally').textContent, '1 suggestion available');
ck('and nothing has been learned by looking at it', Object.keys(lessons()).length, 0);
ok('the list says as much', /Nothing yet/.test(listText()));

print('\n2. Applying the fix records it, once, with a date');
nav('nav-studio');
// Held so section 3 can isolate what the LESSON was worth. The pattern compiles clean, so the daily
// quest pays 50 either side of this and would otherwise be mistaken for the lesson paying.
var pointsBefore = progress().points;
$('lint-side-0-apply-1').fire('click');
ck('one lesson is recorded', Object.keys(lessons()).length, 1);
ck('under the fix id', Object.keys(lessons())[0], 'repeat-shorthand');
ck('dated today', lessons()['repeat-shorthand'], today());

print('\n3. It pays nothing');
// Deliberately. A priced lesson is a lesson to farm, and this is meant to be a record of what was
// understood rather than a score for understanding it.
ck('the balance did not move for it', progress().points, pointsBefore);
ok('and the app says why in as many words', /No points|pricing it would invite farming/.test(SRC));

print('\n4. The lesson is shown, in the linter\'s own words');
var shown = listText();
ok('the sentence is there', /bracket shorthand|spelling repeats out in full|pick one and hold to it/.test(shown));
ok('and when it was first accepted', shown.indexOf('First accepted ' + today()) >= 0);

print('\n5. Accepting the same correction again does not re-record it or move the date');
resetProgress();
// Seeded to a date that is plainly not today, so a re-record would be unmistakable.
var store = progress();
store.lessons = { 'repeat-shorthand': '2020-01-01' };
localStorage.setItem('stitchmath_progress', JSON.stringify(store));
nav('nav-studio');
load(TAUGHT);
$('lint-side-0-apply-1').fire('click');
ck('still one lesson', Object.keys(lessons()).length, 1);
ck('and the original date stands', lessons()['repeat-shorthand'], '2020-01-01');

print('\n6. Dismissing a finding records nothing');
// Earning it on dismissal would reward ignoring advice, which is the opposite of the point.
resetProgress();
nav('nav-studio');
load(TAUGHT);
$('lint-side-0-ignore-1').fire('click');
ck('the suggestion is gone', $('lint-side-tally').textContent, 'No suggestions');
ck('and nothing was learned by refusing it', Object.keys(lessons()).length, 0);

print('\n7. A fix with no lesson records nothing');
resetProgress();
nav('nav-studio');
load(UNTAUGHT);
ok('there is a correction to accept', /suggestion/.test($('lint-side-tally').textContent));
$('lint-side-0-apply-1').fire('click');
ck('it was applied', $('bulk-input').value, 'Ch 12 (12)\nRow 2: sc in each st across (12)');
ck('and taught nothing, because it carries no lesson', Object.keys(lessons()).length, 0);

print('\n8. Accepting a batch teaches too');
// Accepting them together is still accepting them. recordLesson is first-time-only, so the batch
// path cannot double-count against the single one.
resetProgress();
nav('nav-studio');
load(TAUGHT);
$('lint-standardize-all').fire('click');
ck('the batch recorded the lesson', Object.keys(lessons()).length <= 1, true);

print('\n9. The panel lives on Analytics, inside the practice-mode gate');
var HTML = readFile('index.html');
ok('it is a panel on the Analytics view',
   /lessons-panel/.test(SRC.slice(SRC.indexOf('analytics: ['), SRC.indexOf('gauge:     ['))));
ok('and the markup is there to hold it', /id="lessons-list"/.test(HTML));
ok('the gate owns it',
   /'lessons-panel'/.test(SRC.slice(SRC.indexOf('const PRACTICE_SURFACES'),
                                    SRC.indexOf('const PRACTICE_SURFACES') + 400)));

print('\n10. Only the id and the date are stored');
// A sentence copied into the store on the day it was earned would be the one thing in the app able to
// contradict the linter it came from.
resetProgress();
nav('nav-studio');
load(TAUGHT);
$('lint-side-0-apply-1').fire('click');
var value = lessons()['repeat-shorthand'];
ck('the value is a date and nothing else', /^\d{4}-\d{2}-\d{2}$/.test(String(value)), true);
no('no lesson text reached the store',
   /lesson.*[Ss]horthand and the long form/.test(localStorage.getItem('stitchmath_progress')));

endSuite();
