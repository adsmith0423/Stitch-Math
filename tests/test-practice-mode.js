/**
 * The practice-mode switch: one boolean that shows or hides the whole progress layer.
 *
 * The line the product needs. The paying audience is professional pattern designers, to whom streaks
 * and levels read very differently than to a beginner, so the switch was built FIRST and everything
 * in the layer was built inside it. That is what this suite pins: not that the switch works, but that
 * every surface of the layer honours it, and that hiding the layer does not stop the store recording.
 *
 * THE PREFERENCE IS SEEDED BEFORE boot(). That is the point of doing it in a suite of its own: it
 * makes this the reload test as well as the gate test, because the app comes up having read a stored
 * `false` rather than having been switched off by hand afterwards. The other half of the claim - that
 * a store which has never seen the setting comes up ON - needs a clean boot and is asserted in
 * test-practice.js, which has one.
 */
localStorage.setItem('stitchmath_view_prefs', JSON.stringify({ practiceMode: false }));

boot();

var HTML = readFile('index.html');

function hidden(id) { return $(id).classList.contains('hidden'); }
function shown(id) { return !hidden(id); }
function nav(id) { $(id).fire('click'); }
function progress() { return JSON.parse(localStorage.getItem('stitchmath_progress') || '{}'); }
function prefs() { return JSON.parse(localStorage.getItem('stitchmath_view_prefs') || '{}'); }
function setMode(on) {
    $('toggle-practice-mode').checked = on;
    $('toggle-practice-mode').fire('change');
}

/* Every surface the switch owns. Written out here rather than read from app.js on purpose - a list
   that derives itself from the thing it is checking cannot catch a surface dropped from that list. */
var SURFACES = ['sidebar-points', 'status-pill', 'card-daily', 'card-record',
    'practice-panel', 'cabinet-panel', 'lessons-panel'];

print('\n1. A stored preference is honoured on the way up');
ck('the switch came up off', $('toggle-practice-mode').checked, false);
SURFACES.forEach(function (id) {
    ok(id + ' is hidden', hidden(id));
});
ok('and the Practice tab is hidden with the view it opens', hidden('nav-practice'));

print('\n2. Turning it on restores every one of them');
setMode(true);
SURFACES.forEach(function (id) {
    ok(id + ' is back', shown(id));
});
ok('and so is the tab', shown('nav-practice'));
ck('the preference was written', prefs().practiceMode, true);

print('\n3. Turning it off hides every one of them again');
setMode(false);
SURFACES.forEach(function (id) {
    ok(id + ' is hidden again', hidden(id));
});
ck('and the preference followed', prefs().practiceMode, false);

print('\n4. Practice is not reachable while the layer is hidden');
// Refused in navigateTo rather than only hidden in the rail, because a hash is a way in that does not
// go through the rail: #practice with the switch off would otherwise open a display:none panel.
nav('nav-practice');
ck('asking for it lands on the Dashboard instead', $('view-title').textContent, 'Dashboard');
no('and the panel stayed hidden', shown('practice-panel'));
setMode(true);
nav('nav-practice');
ck('with the layer shown it is a destination like any other', $('view-title').textContent, 'Daily Practice');
ok('and its panel is on screen', shown('practice-panel'));

print('\n5. Switching off while standing on Practice does not strand you');
setMode(false);
ck('the view steps back to the Dashboard', $('view-title').textContent, 'Dashboard');

print('\n6. THE REGRESSION THAT WOULD HURT MOST: the store keeps recording with the layer hidden');
// Someone who switches off in March and back on in June must find six months of history waiting, not
// a reset. Only rendering is suppressed - awardProgress, recordWork and touchStreak all run.
localStorage.removeItem('stitchmath_progress');
$('new-file-btn').fire('click');
ck('starting from nothing', progress().points || 0, 0);

ck('the layer really is off', $('toggle-practice-mode').checked, false);
nav('nav-studio');
$('bulk-input').value = [
    'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
    'Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)'
].join('\n');
$('bulk-parse-btn').fire('click');
$('project-name').value = 'hidden but counted';
$('save-btn').fire('click');

ok('points were still earned', progress().points > 0);
ck('the project was still counted', progress().projects, 1);
ck('and the streak still started', progress().streak, 1);
ok('and the stitches were still banked', progress().stitches > 0);

setMode(true);
nav('nav-dashboard');
ck('turning it back on shows the record that was kept', $('rec-patterns').textContent, '1');
ok('and the rank the work earned', $('points-total').textContent.length > 0);

print('\n6b. New File does not quietly switch it back on');
// The other view preferences are reset by New File, because they describe how to read the pattern in
// front of you. This one describes the whole app: a professional who switched the layer off did not
// ask for it back on their next new file.
setMode(false);
$('new-file-btn').fire('click');
ck('the switch is still off', $('toggle-practice-mode').checked, false);
ck('and the stored preference with it', prefs().practiceMode, false);
ok('the sidebar block stayed hidden', hidden('sidebar-points'));
// And the pattern-reading preferences really were reset, so this is an exemption rather than New File
// having stopped resetting anything.
ck('trend markers came back on', prefs().showTrendMarkers, true);
setMode(true);

print('\n7. It is a view preference, and never travels with a pattern');
// A .json a designer sends to a tester must not carry a UI preference with it. The envelope has a
// fixed shape, so this is structural rather than a matter of remembering - assert it anyway.
var envelope = window.StitchPersistence.buildEnvelope({
    projectName: 'shared', body: { rawText: 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)' }
});
var json = JSON.stringify(envelope);
no('practiceMode is not in the envelope', /practiceMode/.test(json));
no('nor any other view preference', /viewPrefs/.test(json));

print('\n8. The switch describes what is shown, not who is looking');
// Not "beginner mode". Nobody wants to tick a box that calls them a beginner, and a professional
// using the practice rows to check their own dialect should not have to identify as one either.
var SRC = readFile('app.js');
var spec = SRC.slice(SRC.indexOf("id: 'toggle-practice-mode'"), SRC.indexOf("id: 'gauge-unit'"));
ok('the label names the surfaces', /Show daily practice, streak and rank/.test(spec));
no('and nobody is called a beginner by it', /[Bb]eginner/.test(spec));
ok('the note promises nothing is lost', /your record keeps counting/.test(spec));
ok('it is mirrored onto Settings like every other option', /group: 'Practice and progress'/.test(spec));

// The source control lives with the thing it hides, so it goes when the layer does. The mirror on
// Settings is the way back, which is the whole reason it is in SETTING_SPECS.
ok('the source control is in the Practice panel', HTML.indexOf('id="toggle-practice-mode"') >
   HTML.indexOf('id="practice-panel"'));

endSuite();
