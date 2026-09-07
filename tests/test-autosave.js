// Autosave: what marks the project dirty, what does not, and what the one line of UI says about it.
//
// Under the stubs setTimeout fires immediately, so a debounce is not a delay here - every keystroke
// below runs the whole flush inline. That is deliberately the harshest reading of the design: if the
// dirty gate or the body compare were not doing their job, this suite would be writing an envelope
// per character.

// Both runners have to report the same counts, and they disagree about timers: the Node context has
// no setTimeout at all, so test-stub.js supplies a synchronous one, while JavaScriptCore's shell has a
// real asynchronous one and the debounce would never fire before the suite ended. Pin it here rather
// than in the shared stub, which would change how the other suites behave under jsc.
//
// Firing inline is also the harshest reading of the design: every keystroke below runs a whole flush.
setTimeout = function (fn) { fn(); return 0; };
clearTimeout = function () {};

var P = window.StitchPersistence;
// The seam. Every suite gets the memory fallback for free, since this context has no indexedDB at all;
// seeding one explicitly is how this suite reads back what was written.
var adapter = P.memoryAdapter();
window.STITCH_ADAPTER = adapter;
boot();

function status() { return $('save-status').textContent; }
function recordFor(name) {
    var found = null;
    adapter.get('current', P.projectIdFor(name), function (r) { found = r.value; });
    return found;
}
function typePattern(text) {
    $('bulk-input').value = text;
    $('bulk-input').fire('input');
}

print('\n1. The status line exists and starts quiet');
ck('the markup carries it', /id="save-status"/.test(readFile('index.html')), true);
ck('nothing has changed yet', status(), 'Autosave on');
// Reported, not offered: there is nothing to press, so it is a caption rather than a control.
ok('and it is styled as a caption', /\.save-status \{[^}]*font-size/.test(readFile('style.css')));

print('\n2. Typing a pattern records it');
$('project-name').value = 'Kingbird Cardigan';
typePattern('Ch 6\nRow 1: sc in each ch across. (6)');
var saved = recordFor('Kingbird Cardigan');
ok('a recovery record was written', !!saved);
ck('under an id derived from the name', saved.projectId, 'project_kingbird-cardigan');
ck('holding the pattern', saved.envelope.body.rawText.indexOf('Ch 6'), 0);
ck('as a current-format envelope', saved.envelope.fileVersion, 1);
ok('and the line says so', /^Saved \d\d:\d\d$/.test(status()));

print('\n3. Start-up is told where to look, without reading the store');
ck('the project id is mirrored into localStorage',
   localStorage.getItem('stitchmath_current_project'), 'project_kingbird-cardigan');

print('\n4. The grader reaches the recovery record');
// The reason readProjectBody exists. readGraderInputs is the only thing that gets the grader form into
// state.grading, so an autosave that built its own record would have persisted the grader as it stood
// at the last manual save.
$('grade-base-name').value = 'Bodice';
$('grade-ease').value = '2';
$('grade-ease').fire('input');
var withGrader = recordFor('Kingbird Cardigan');
ck('the grader field is in the record', withGrader.envelope.body.grading.fields['grade-base-name'], 'Bodice');
ck('and so is the ease', withGrader.envelope.body.grading.fields['grade-ease'], '2');

print('\n5. Gauge and metadata are project data');
$('gauge-stitches').value = '14';
$('gauge-stitches').fire('input');
ck('a gauge edit is recorded', recordFor('Kingbird Cardigan').envelope.body.gauge.stitches, 14);
$('meta-designer').value = 'Jane';
$('meta-designer').fire('change');
ck('so is the designer', recordFor('Kingbird Cardigan').envelope.body.metadata.designer, 'Jane');

print('\n6. A view preference is not');
// The line test-newfile.js already draws: these change what is on screen, not what the file holds.
var before = JSON.stringify(recordFor('Kingbird Cardigan').envelope.body);
$('toggle-trend-markers').checked = false;
$('toggle-trend-markers').fire('change');
$('toggle-collapse-repeats').checked = true;
$('toggle-collapse-repeats').fire('change');
ck('toggling the matrix views records nothing new',
   JSON.stringify(recordFor('Kingbird Cardigan').envelope.body), before);

print('\n7. An edit that changes nothing is not written again');
// refreshGaugeOutputs fires on keystrokes that move no value, and a grader control fires both input and
// change for a single edit. The dirty flag cannot see that; the body compare can.
var stamp = recordFor('Kingbird Cardigan').savedAt;
for (var i = 0; i < 5; i++) $('gauge-stitches').fire('input');
ck('five no-op events, the same record', recordFor('Kingbird Cardigan').savedAt, stamp);

print('\n8. The pattern box changing without a keystroke still counts');
// Delete Last Row, Clear All and the single-row form all rewrite the box through syncBulkInput, which
// fires no input event of its own.
typePattern('Ch 6\nRow 1: sc in each ch across. (6)\nRow 2: sc in each st across. (6)');
$('bulk-parse-btn').fire('click');
ck('three rows are on the page', $('bulk-input').value.split('\n').length, 3);
$('delete-last-btn').fire('click');
ck('deleting a row is recorded',
   recordFor('Kingbird Cardigan').envelope.body.rawText.split('\n').length, 2);

print('\n9. Renaming the project moves the record, it does not merge');
$('project-name').value = 'Second Project';
typePattern('Ch 10\nRow 1: sc in each ch across. (10)');
ck('the new name has its own record', recordFor('Second Project').envelope.body.rawText.indexOf('Ch 10'), 0);
ok('and the first is still there', recordFor('Kingbird Cardigan').envelope.body.rawText.indexOf('Ch 6') === 0);

print('\n10. An empty page does not replace a real record');
// The copy about to be overwritten is exactly the one wanted back after the box is cleared by accident.
var kept = recordFor('Second Project').envelope.body.rawText;
typePattern('   ');
ck('clearing the box leaves the record alone', recordFor('Second Project').envelope.body.rawText, kept);
// The line still reports the last real save. It does not invent a new one for the empty page, and it
// does not go back to "Autosave on" as though nothing had ever been recorded.
ok('the line reports the last real save, not a new one', /^Saved \d\d:\d\d$/.test(status()));

print('\n11. Nothing derived is stored');
$('project-name').value = 'Derived';
typePattern('Ch 6\nRow 1: sc in each ch across. (6)');
$('bulk-parse-btn').fire('click');
$('gauge-notes').value = 'x';
$('gauge-notes').fire('input');
ck('five body keys and no more',
   Object.keys(recordFor('Derived').envelope.body).sort().join(','),
   'gauge,gaugeHistory,grading,metadata,rawText');

print('\n12. Autosave does not re-parse');
// A save that re-parses is a second opinion about what the pattern is, arriving after the first.
typePattern('Row 1: this is not a stitch anyone knows');
ck('the matrix still shows the parsed rows, not the typed ones', $('step-sequence-body').children.length > 0, true);
ok('but the record has the new text', recordFor('Derived').envelope.body.rawText.indexOf('not a stitch') > 0);

print('\n13. The visibility flush');
// visibilitychange rather than beforeunload: the latter does not fire reliably on mobile or on tab
// discard, and cannot finish an IndexedDB write synchronously anyway.
var src = readFile('app.js');
ok('the hook is on visibilitychange', /addEventListener\('visibilitychange'/.test(src));
no('and not on beforeunload for the flush', /addEventListener\("beforeunload", *\(\) *=> *\{ *flushAutosave/.test(src));
$('project-name').value = 'Flushed';
$('bulk-input').value = 'Ch 12\nRow 1: sc in each ch across. (12)';
// No input event: the page is hidden with an edit the debounce has not reached.
fireDocument('visibilitychange', { });
ok('leaving the page with nothing marked writes nothing', !recordFor('Flushed'));
$('bulk-input').fire('input');
ok('but a marked edit is there', !!recordFor('Flushed'));

print('\n14. A store that refuses is reported, not hidden');
var refusing = P.memoryAdapter();
refusing.put = function (store, record, cb) { cb({ ok: false, error: { code: 'store-refused', message: 'quota' } }); };
window.STITCH_ADAPTER = refusing;
boot();
$('project-name').value = 'Refused';
typePattern('Ch 6\nRow 1: sc in each ch across. (6)');
ck('the line says the record is not readable', status(), 'Recovery record unreadable');

print('\n15. A store that throws does not take the page with it');
// Under the stubs this runs inline inside a keystroke, and an exception here is counted as a failure by
// both runners - which is the same reason it must never reach a browser.
var throwing = P.memoryAdapter();
throwing.put = function () { throw new Error('gone'); };
window.STITCH_ADAPTER = throwing;
boot();
var raised = '';
try {
    $('project-name').value = 'Thrown';
    typePattern('Ch 6\nRow 1: sc in each ch across. (6)');
} catch (e) { raised = String(e); }
ck('typing raises nothing', raised, '');
ck('and the line says something is wrong', status(), 'Recovery record unreadable');

print('\n16. With no store at all, the app is unchanged');
// The probe path every browser without IndexedDB takes, which is also every one of these suites.
window.STITCH_ADAPTER = null;
boot();
var brokeSomething = '';
try {
    $('project-name').value = 'No Store';
    typePattern('Ch 6\nRow 1: sc in each ch across. (6)');
    $('bulk-parse-btn').fire('click');
} catch (e) { brokeSomething = String(e); }
ck('typing and parsing raise nothing', brokeSomething, '');
ok('the pattern still validated', $('step-sequence-body').children.length > 0);
// Naming the way out, for the same reason the quota alert does: a recovery layer silently not
// recording is the one case where saying nothing is worse than saying the wrong thing.
ck('and the line says autosave is not running', status(), 'Autosave unavailable \u2014 use Save File');

print('\n17. Booting twice is safe');
var rebooted = '';
try { boot(); boot(); } catch (e) { rebooted = String(e); }
ck('re-running init raises nothing', rebooted, '');

endSuite();
