// The app shell: sidebar navigation, the dashboard summary, and the progress store.
//
// The shell is presentation only, so almost everything here is a containment check - that no panel lost
// its home, that no dashboard figure was invented, and that hiding a panel does not stop the app
// rendering into it. The last is why the shell hides panels instead of moving them, and is what §5 pins.
boot();

var HTML = readFile('index.html');
var CSS = readFile('style.css');

function hidden(id) { return $(id).classList.contains('hidden'); }
function shown(id) { return !hidden(id); }
function nav(id) { $(id).fire('click'); }
function load(lines) { $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function addStitch(name, def, cost, yieldVal) {
    $('custom-st-name').value = name;
    $('custom-st-def').value = def;
    $('custom-st-cost').value = cost;
    $('custom-st-yield').value = yieldVal;
    $('custom-stitch-form').fire('submit');
}

// Compiler and Studio were two entries onto the same panels and were merged, so the count has never
// been one per panel group. Construction came in when Schematics was retired; the Studio Locker went
// with the avatar; Daily Practice is the twelfth.
var NAV_IDS = ['nav-dashboard', 'nav-patterns', 'nav-library', 'nav-studio', 'nav-sizer',
    'nav-testers', 'nav-analytics', 'nav-gauge', 'nav-practice',
    'nav-publish', 'nav-construction', 'nav-settings'];

// Every panel the app had before the shell landed, plus Settings, Help and the panels split out of the
// grader since. Each must still be in the markup and reachable from exactly one view.
var PANELS = ['intro-header', 'project-panel', 'metadata-panel', 'input-section',
    'matrix-section', 'structure-section', 'grader-section', 'tester-panel', 'tester-notes-panel',
    'finished-size-panel',
    'pattern-analytics-dashboard', 'output-section', 'complexity-panel',
    'custom-stitch-section', 'gauge-profile-panel', 'gauge-history-dashboard',
    'settings-panel', 'help-panel'];

var CLEAN = [
    'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
    'Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)',
    'Row 3: ch 1, turn, sc in each st across (18)'
];

print('\n1. Twelve destinations, none of them a form control');
NAV_IDS.forEach(function (id) {
    ok(id + ' is in the markup', HTML.indexOf('id="' + id + '"') !== -1);
});
NAV_IDS.forEach(function (id) {
    var tag = (HTML.match(new RegExp('<(\\w+)[^>]*\\bid="' + id + '"')) || [, ''])[1];
    ck(id + ' is a button', tag, 'button');
});
ck('twelve of them', (HTML.match(/class="nav-item"/g) || []).length, 12);
no('Compiler is no longer a destination of its own', /id="nav-compiler"/.test(HTML));
no('Schematics is retired', /id="nav-schematics"/.test(HTML));
no('and the Studio Locker went with the avatar', /id="nav-locker"/.test(HTML));
// The twelve are grouped into four hubs now, so document order follows the grouping rather than
// the old flat run. Within Library & Assets, Pattern Files still leads into the Stitch Library.
ok('Pattern Files leads into Stitch Library',
   HTML.indexOf('id="nav-patterns"') < HTML.indexOf('id="nav-library"'));
ok('and Studio comes before both, being its own hub',
   HTML.indexOf('id="nav-studio"') < HTML.indexOf('id="nav-patterns"'));

print('\n1b. Four hubs, and every destination lives in exactly one');
var HUB_IDS = ['hub-dashboard', 'hub-studio', 'hub-library', 'hub-community'];
HUB_IDS.forEach(function (id) {
    ok(id + ' is in the markup', HTML.indexOf('id="' + id + '"') !== -1);
    var tag = (HTML.match(new RegExp('<(\\w+)[^>]*\\bid="' + id + '"')) || [, ''])[1];
    ck(id + ' is a button', tag, 'button');
});
ck('four of them', (HTML.match(/class="nav-hub"/g) || []).length, 4);
ck('each with a sub-list', (HTML.match(/class="nav-sub"/g) || []).length, 4);
// A hub is not a destination. If one ever gained a NAV_TARGETS entry it would own a route and a
// view, and the rail would have sixteen places to go rather than twelve.
HUB_IDS.forEach(function (id) {
    no(id + ' is not itself a destination', HTML.indexOf('id="' + id + '" class="nav-item"') !== -1);
});
// The grouping lives in app.js. Read it back and prove it covers the twelve exactly once - a
// thirteenth view added with a route and no hub would otherwise be reachable by URL and invisible
// in the rail, which is the failure this pins.
var shellSrc = readFile('app.js');
var hubBody = shellSrc.slice(shellSrc.indexOf('const NAV_HUBS = {'),
                             shellSrc.indexOf('const HUB_IDS'));
var grouped = (hubBody.match(/'nav-[a-z]+'/g) || []).map(function (s) { return s.slice(1, -1); });
ck('NAV_HUBS lists twelve destinations', grouped.length, 12);
NAV_IDS.forEach(function (id) {
    ck(id + ' has exactly one hub', grouped.filter(function (g) { return g === id; }).length, 1);
});

print('\n1c. Navigating opens the hub that owns where you went, and closes the rest');
function openHubs() {
    return HUB_IDS.filter(function (h) { return $(h).classList.contains('is-open'); });
}
NAV_IDS.forEach(function (id) {
    nav(id);
    var open = openHubs();
    ck(id + ' leaves exactly one hub open', open.length, 1);
    ck('and it is announced as expanded', $(open[0]).getAttribute('aria-expanded'), 'true');
});
// Where you are decides which hub is open, so the two cannot drift apart. Spot-check the mapping
// rather than trusting that "exactly one" happened to be the right one.
nav('nav-gauge');
ck('the Gauge Profile opens Library & Assets', openHubs()[0], 'hub-library');
nav('nav-construction');
ck('Construction opens Studio', openHubs()[0], 'hub-studio');
nav('nav-analytics');
ck('Analytics opens Dashboard', openHubs()[0], 'hub-dashboard');
// A hub press is a navigation, not just a disclosure: it lands on the group's first entry.
$('hub-community').fire('click');
ok('pressing a hub goes to its first entry', $('nav-testers').classList.contains('is-active'));
ck('and opens that hub', openHubs()[0], 'hub-community');
ck('while the others close', $('hub-studio').getAttribute('aria-expanded'), 'false');

print('\n1d. The workflow rail crosses the five views a pattern is written across');
var STAGE_NAV = ['nav-patterns', 'nav-studio', 'nav-sizer', 'nav-testers', 'nav-publish'];
function stage(navId) { return $('stage-' + navId); }
function railShown() { return !hidden('stage-rail'); }

// On for the workflow, off everywhere else. A five-step "write a pattern" strip above the Gauge
// Profile would be pointing at work that page has nothing to do with.
STAGE_NAV.forEach(function (id) {
    nav(id);
    ok(id + ' shows the rail', railShown());
});
['nav-dashboard', 'nav-analytics', 'nav-gauge', 'nav-construction', 'nav-settings',
 'nav-library'].forEach(function (id) {
    nav(id);
    no(id + ' does not', railShown());
});

// Every stage is a real destination, and reaching one marks it as the current step.
nav('nav-studio');
STAGE_NAV.forEach(function (id) {
    ok('stage for ' + id + ' is drawn', !!stage(id).className);
    ok('and carries the stage class', stage(id).className.indexOf('stage') >= 0);
});
ck('the stage you are on is the current step', stage('nav-studio').getAttribute('aria-current'), 'step');
no('and the others are not', stage('nav-sizer').getAttribute('aria-current') === 'step');

// Clicking a stage navigates. This is the whole point of the rail, so it is clicked rather than
// inspected - which is why the strip is built element by element and not from an innerHTML string.
stage('nav-sizer').fire('click');
ok('a stage press switches view', shown('grader-section'));
ok('and marks the sidebar entry active', $('nav-sizer').classList.contains('is-active'));
ok('and opens the hub that owns it', $('hub-studio').classList.contains('is-open'));
ck('and moves the current step', stage('nav-sizer').getAttribute('aria-current'), 'step');

print('\n1d-ii. A stage ticks itself off what the pattern actually has, and reports nothing else');
// The ticks are read from live state every redraw, never recorded, so they must follow the pattern
// rather than the visits. Walking all five above must NOT have ticked anything.
$('clear-all-btn').fire('click');
nav('nav-studio');
no('an empty pattern has not been drafted', stage('nav-studio').className.indexOf('is-done') >= 0);
no('nor graded', stage('nav-sizer').className.indexOf('is-done') >= 0);
no('nor tested', stage('nav-testers').className.indexOf('is-done') >= 0);
no('nor is it ready to hand over', stage('nav-publish').className.indexOf('is-done') >= 0);

load(CLEAN);
ok('a compiled pattern ticks Draft', stage('nav-studio').className.indexOf('is-done') >= 0);
ok('and a clean one is ready to export', stage('nav-publish').className.indexOf('is-done') >= 0);
no('but grading is still untouched', stage('nav-sizer').className.indexOf('is-done') >= 0);
// Un-ticks itself when the thing it reported is gone - which is what "read, never recorded" buys.
$('clear-all-btn').fire('click');
no('clearing the pattern un-ticks Draft', stage('nav-studio').className.indexOf('is-done') >= 0);

print('\n1e. The two floating docks');
function dockOpen(id) { return $(id).classList.contains('is-open'); }

nav('nav-studio');
no('the Stitch Library starts closed', dockOpen('dock-library'));
no('and so does the Compiler', dockOpen('dock-compiler'));

$('dock-btn-library').fire('click');
ok('the trigger opens it', dockOpen('dock-library'));
ck('and says so', $('dock-btn-library').getAttribute('aria-expanded'), 'true');
ok('without leaving the view you were on', shown('input-section'));
// Not modal, and not a navigation. The workspace behind it is untouched - that is the difference
// between a dock and the confirm dialog.
no('the nav drawer scrim is not involved', $('app-shell').classList.contains('nav-open'));
ck('the sidebar entry does not move', $('nav-studio').getAttribute('aria-current'), 'page');

$('dock-btn-library').fire('click');
no('the same trigger closes it', dockOpen('dock-library'));
ck('and says so', $('dock-btn-library').getAttribute('aria-expanded'), 'false');

// One at a time: two panes over the workspace would overlap each other and bury the work.
$('dock-btn-library').fire('click');
$('dock-btn-compiler').fire('click');
ok('opening the second opens it', dockOpen('dock-compiler'));
no('and closes the first', dockOpen('dock-library'));
ck('the first trigger is no longer held', $('dock-btn-library').getAttribute('aria-expanded'), 'false');

$('dock-close-compiler').fire('click');
no('the close button closes it', dockOpen('dock-compiler'));

// The dialog role exists exactly while the pane does. Closed, the wrapper is display: contents and
// its panels are just part of the page - a role left on it would have a screen reader announcing a
// dialog around the Stitch Library at all times, including on the view that owns those panels.
no('a closed dock is not a dialog', !!$('dock-compiler').getAttribute('role'));
$('dock-btn-compiler').fire('click');
ck('an open one is', $('dock-compiler').getAttribute('role'), 'dialog');
$('dock-btn-compiler').fire('click');
no('and it stops being one on close', !!$('dock-compiler').getAttribute('role'));

// Navigating puts the panels back where the view expects them. Left open, the Stitch Library's
// panels would be in the floating pane while Pattern Files showed a gap where they belong.
$('dock-btn-library').fire('click');
nav('nav-patterns');
no('navigating closes an open dock', dockOpen('dock-library'));
ok('and the panels are back in the column', shown('stitch-usage-panel'));

print('\n1e-ii. The compiler dock is live from anywhere, not a snapshot of the Dashboard');
// This is why floating it is worth anything. The shell hides panels rather than tearing them down,
// so renderDashCompiler keeps writing into these ids from any view - the dock shows what the last
// compile actually found while you are standing on the Gauge profile.
nav('nav-studio');
load(CLEAN);
var findings = $('dash-findings').innerHTML;
var passed = $('dash-passed').textContent;
ok('a compile fills the compiler card', findings.length > 0);
ck('and counts the rows that passed', passed, '3');
nav('nav-gauge');
$('dock-btn-compiler').fire('click');
ok('the dock opens on a view that is not the Dashboard', dockOpen('dock-compiler'));
ck('and carries the live findings', $('dash-findings').innerHTML, findings);
ck('and the live counts', $('dash-passed').textContent, '3');
// And it keeps up: compile something different and the open dock reflects it without reopening.
nav('nav-studio');
load(['Row 1: ch 6, sc in 2nd ch from hook and in each ch across (5)']);
nav('nav-gauge');
$('dock-btn-compiler').fire('click');
ck('a later compile is reflected', $('dash-passed').textContent, '1');
$('dock-close-compiler').fire('click');

print('\n2. Every legacy panel still exists and has a home');
PANELS.forEach(function (id) {
    ok(id + ' still in the markup', HTML.indexOf('id="' + id + '"') !== -1);
});
// Walking the sidebar must reveal each panel at least once. A panel added later with no view to live in
// fails here rather than quietly disappearing from the app.
var everSeen = {};
NAV_IDS.forEach(function (id) {
    nav(id);
    PANELS.forEach(function (panel) { if (shown(panel)) everSeen[panel] = true; });
});
PANELS.forEach(function (panel) { ok(panel + ' is reachable from the sidebar', everSeen[panel]); });

print('\n3. A view shows its own panels and hides the rest');
// Which column each panel sits in is a hand-kept list in app.js. Get it wrong and a view shows an empty
// column beside its content, so it is checked against the real markup.
var LEFT_SLICE = HTML.slice(HTML.indexOf('id="left-column"'), HTML.indexOf('id="right-column"'));
[['custom-stitch-section', false], ['stitch-usage-panel', false], ['output-section', true],
 ['pattern-analytics-dashboard', true], ['complexity-panel', true],
 ['gauge-profile-panel', true], ['finished-size-panel', true],
 ['gauge-history-dashboard', true], ['project-panel', false], ['metadata-panel', false],
 ['structure-section', false], ['grader-section', false], ['input-section', false],
 ['tester-panel', false], ['tester-notes-panel', false],
 ['matrix-section', false], ['settings-panel', false], ['help-panel', false],
 ['publish-panel', false],
 ['construction-panel', false], ['construction-yoke-panel', false],
 ['construction-impact-panel', false]].forEach(function (pair) {
    ck(pair[0] + (pair[1] ? ' is in the left column' : ' is in the right column'),
       LEFT_SLICE.indexOf('id="' + pair[0] + '"') !== -1, pair[1]);
});

// Stitch Library no longer owns a view. It lands on Patterns and scrolls to the stitch panels.
nav('nav-library');
ok('Stitch Library shows the stitch dictionary', shown('custom-stitch-section'));
ok('and the stitches the pattern works', shown('stitch-usage-panel'));
ok('on the Patterns tab, colours and all', shown('color-panel'));
no('and hides the grader', shown('grader-section'));
no('and hides the matrix', shown('matrix-section'));
no('the dashboard is put away', shown('dashboard-view'));
ck('one column, as every view now is', $('workspace').dataset.cols, 'one');
no('so the left column is hidden', shown('left-column'));
// It is a scroll target on Patterns, not a page of its own, so the topbar keeps saying Patterns.
ck('the page is not retitled', $('view-title').textContent, 'Patterns');

nav('nav-sizer');
ok('Sizer brings the grader back', shown('grader-section'));
ok('and the size comparison', shown('finished-size-panel'));
no('and puts the dictionary away', shown('custom-stitch-section'));
no('and the structure panel moved to Studio', shown('structure-section'));
no('and Tester Feedback moved to its own tab', shown('tester-panel'));
// Both columns carry panels here, but they stack rather than sit side by side. Only the dashboard, which
// has a card grid of its own, is ever more than one column wide.
ck('still a single column', $('workspace').dataset.cols, 'one');
ok('with both columns stacked', shown('left-column') && shown('right-column'));

nav('nav-dashboard');
ok('Dashboard shows the summary', shown('dashboard-view'));
no('and hides the workspace entirely', shown('workspace'));

print('\n4. Tester Feedback owns its own tab, with a blank notes panel beneath it');
nav('nav-testers');
ok('it shows the tester fields', shown('tester-panel'));
ok('and the blank notes panel underneath', shown('tester-notes-panel'));
no('and not the rest of the grader', shown('grader-section'));
no('nor the matrix', shown('matrix-section'));
ck('one column, as every view now is', $('workspace').dataset.cols, 'one');
no('so the left column is hidden', shown('left-column'));
// The notes panel is no longer blank. It used to carry an unnamed textarea that nothing read: the
// Record button directly beneath it saved the fields in the panel above and dropped this one, while
// clearing the others - so a discard was indistinguishable from a save. It now has an id, is read by
// recordTester, and is cleared with the rest, which also puts it in test-newfile.js's field sweep.
var TESTER_NOTES = HTML.slice(HTML.indexOf('id="tester-notes-panel"'));
TESTER_NOTES = TESTER_NOTES.slice(0, TESTER_NOTES.indexOf('</section>'));
ok('it holds a textarea', /<textarea/.test(TESTER_NOTES));
ok('and the textarea is named', /<textarea[^>]*\bid="tester-freeform"/.test(TESTER_NOTES));
ok('and its label points at it', /<label[^>]*\bfor="tester-freeform"/.test(TESTER_NOTES));

// What the id is for. Recording a tester must now read this box and empty it: it emptying is the
// observable half of "it was saved", and it staying full while every field beside it cleared was the
// bug. Where the value ends up - on the tester, and in the worksheet - is asserted in test-grader.js
// section 30, which already has the saved project to read it back out of.
$('tester-name').value = 'Marisol';
$('tester-size').value = 'M';
$('tester-freeform').value = 'Ran big at the bust.';
$('tester-add-btn').fire('click');
// Clearing is the observable half of "it was saved" - and it is also proof the click was accepted
// rather than turned away by the name-and-size guard, which returns before clearing anything.
ck('the freeform box is cleared like every other field', $('tester-freeform').value, '');

print('\n4a. A focus target switches view and opens what it names');
// Publish used to be a focus target on the grader's export disclosure. It owns a view now, and reaches
// that disclosure through the multi-size package button instead.
$('grade-output-panel').open = false;
nav('nav-publish');
ok('Publish lands on its own panel', shown('publish-panel'));
no('and not on the grader', shown('grader-section'));
$('pub-export-package').fire('click');
ok('the package button goes to the grader', shown('grader-section'));
ok('and opens the export disclosure', $('grade-output-panel').open === true);

print('\n4b. Studio is one workspace for writing and compiling');
nav('nav-studio');
ok('it carries the paste box', shown('input-section'));
ok('and the pattern structure fields, moved here from Sizer', shown('structure-section'));
ok('and the validation matrix', shown('matrix-section'));
ok('and the guidance header', shown('intro-header'));
// Reading order down the tab: structure sits under the paste box, before the matrix that reads it.
ok('structure comes after the pattern input',
   HTML.indexOf('id="input-section"') < HTML.indexOf('id="structure-section"'));
ok('and before the validation matrix',
   HTML.indexOf('id="structure-section"') < HTML.indexOf('id="matrix-section"'));

print('\n4b-ii. Patterns carries the pattern vocabulary: colours, then the stitches');
nav('nav-patterns');
ok('the colour panel is on this tab', shown('color-panel'));
ok('with the project and metadata panels', shown('project-panel') && shown('metadata-panel'));
ok('and both stitch panels', shown('stitch-usage-panel') && shown('custom-stitch-section'));
// Reading order down the tab: the metadata, then the colours it annotates, then the stitches. These are
// document positions, not view membership - a panel listed on the tab but written elsewhere in the markup
// would show up in the wrong place on the page and pass every `shown` check above.
ok('colours sit after Pattern Metadata',
   HTML.indexOf('id="metadata-panel"') < HTML.indexOf('id="color-panel"'));
ok('Stitches Used sits below Color Codes',
   HTML.indexOf('id="color-panel"') < HTML.indexOf('id="stitch-usage-panel"'));
ok('and the Custom Stitch Dictionary below that',
   HTML.indexOf('id="stitch-usage-panel"') < HTML.indexOf('id="custom-stitch-section"'));
// One of each panel, not a copy left behind in the old column.
['stitch-usage-panel', 'custom-stitch-section', 'custom-stitch-form'].forEach(function (id) {
    ck(id + ' appears once', (HTML.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
});
// And the dictionary is still wired where it now sits.
addStitch('vst2', 'dc, ch1, dc', '1', '3');
ok('adding a custom stitch still works from its new home',
   /vst2/.test($('custom-stitch-body').text() + $('custom-stitch-body').innerHTML));
// Left in place deliberately - section 4d-v opens with New File, which is what clears it.
// Still one of everything, and still wired.
['color-form', 'color-code', 'color-name', 'color-table', 'color-body'].forEach(function (id) {
    ck(id + ' appears once', (HTML.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
});
$('color-code').value = 'A'; $('color-name').value = 'Creamsicle';
$('color-form').fire('submit');
ok('adding a colour still works from its new home',
   /Creamsicle/.test($('color-body').text() + $('color-body').innerHTML));

print('\n4c. Settings is options plus help, not a copy of another view');
nav('nav-settings');
ok('Settings shows its options', shown('settings-panel'));
ok('and the help panel', shown('help-panel'));
// Help leads the tab: someone opening Settings to work out how the app works should meet the explanation
// before the switches.
ok('help comes first on the tab',
   HTML.indexOf('id="help-panel"') < HTML.indexOf('id="settings-panel"'));
no('without dragging the grader along', shown('grader-section'));
no('or any gauge panel', shown('gauge-profile-panel') || shown('gauge-history-dashboard'));
no('or the validation matrix', shown('matrix-section'));

print('\n4d. Every option is mirrored, and a mirror drives its original');
// The mirrors are built from the live controls, so the page cannot list an option the app does not have,
// and cannot miss one it does.
var rows = $('settings-list').children.filter(function (c) { return c.className === 'setting-row'; });
ok('the page has rows on it', rows.length >= 12);
ok('grouped under headings', $('settings-list').children.some(function (c) { return c.className === 'settings-group'; }));

// Each mirror declares what kind of control it is, because the headless stub cannot read that off the
// markup. A wrong declaration would build a text box where a tickbox belongs and work fine in a browser,
// so it is checked against the real markup.
// meta-size-type and skipped-chains were in this table until both were replaced by inference and
// their markup deleted. The stub invents a <div> for an id that is gone, so a stale row here would
// have read 'text' against the invented element rather than failing outright.
[['meta-row-numbering', 'select'],
 ['toggle-trend-markers', 'checkbox'], ['toggle-collapse-repeats', 'checkbox'],
 ['grade-rounding', 'select'],
 ['sizing-category', 'select'], ['gauge-unit', 'select']].forEach(function (pair) {
    var id = pair[0], kind = pair[1];
    var tagInMarkup = (HTML.match(new RegExp('<(\\w+)[^>]*\\bid="' + id + '"')) || [, ''])[1];
    var typeInMarkup = (HTML.match(new RegExp('<input[^>]*\\bid="' + id + '"[^>]*')) || [''])[0];
    var actual = tagInMarkup === 'select' ? 'select'
        : /type="checkbox"/.test(typeInMarkup) ? 'checkbox'
        : /type="number"/.test(typeInMarkup) ? 'number' : 'text';
    ck(id + ' is declared as the markup really has it', kind, actual);
    var mirror = $('set-' + id);
    ck('  and the mirror was built that way',
       kind === 'select' ? mirror.tagName.toLowerCase() : mirror.type, kind);
});

// A dropdown mirror: changing it must move the original.
$('meta-row-numbering').value = 'restart'; $('meta-row-numbering').fire('change');
nav('nav-settings');
ck('the mirror opens on the current value', $('set-meta-row-numbering').value, 'restart');
$('set-meta-row-numbering').value = 'continue';
$('set-meta-row-numbering').fire('change');
ck('the original moved with it', $('meta-row-numbering').value, 'continue');
$('set-meta-row-numbering').value = 'restart';
$('set-meta-row-numbering').fire('change');

// A checkbox mirror, driving a stored view preference.
$('toggle-trend-markers').checked = true;
nav('nav-settings');
ok('the checkbox mirror reflects the original', $('set-toggle-trend-markers').checked === true);
$('set-toggle-trend-markers').checked = false;
$('set-toggle-trend-markers').fire('change');
no('the original unticked', $('toggle-trend-markers').checked);
no('and the preference was saved', JSON.parse(localStorage.getItem('stitchmath_view_prefs')).showTrendMarkers);

// Editing the original and reopening Settings must show the new value: the mirrors are rebuilt from the
// sources on open, so they can never show a stale answer.
$('toggle-trend-markers').checked = true;
$('toggle-trend-markers').fire('change');
nav('nav-dashboard');
nav('nav-settings');
ok('reopening reads the source again', $('set-toggle-trend-markers').checked === true);

print('\n4d-ii. Editing a setting does not rebuild the page under the pointer');
// The rebuild was what made the page jump: it tore out the control being clicked and collapsed the
// list's height, so the browser snapped the scroll back to the top. Values are now written in place, and
// the very same element survives the edit.
nav('nav-settings');
var beforeNode = $('set-toggle-collapse-repeats');
var beforeRows = $('settings-list').children.length;
$('set-toggle-collapse-repeats').checked = true;
$('set-toggle-collapse-repeats').fire('change');
ok('the clicked control is the same object afterwards', $('set-toggle-collapse-repeats') === beforeNode);
ck('and the page still has the same rows', $('settings-list').children.length, beforeRows);
ok('while the setting really applied', $('toggle-collapse-repeats').checked === true);
// A change that alters WHICH rows belong on the page still rebuilds - the one case where leaving the old
// rows up would be wrong.
load(['Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)']);
nav('nav-settings');
ok('a graded pattern adds the size row', !!$('settings-list').children.some(function (c) {
    return c.className === 'setting-row' && c.text().indexOf('Which size') !== -1;
}));
$('set-toggle-collapse-repeats').checked = false;
$('set-toggle-collapse-repeats').fire('change');

print('\n4d-iii. Publish gathers saving and exporting, and previews the printout');
nav('nav-publish');
ok('the project panel is here too', shown('project-panel'));
// The same panel, shown on two tabs - not a second copy of the save controls.
ck('save-btn still appears once in the markup',
   (HTML.match(/id="save-btn"/g) || []).length, 1);
// Publish only needs to load a project, so the rest of the panel's controls are hidden here through a
// class rather than duplicated - a second #load-select or #load-btn would make getElementById ambiguous.
ok('project-panel is put in publish-only mode', $('project-panel').classList.contains('publish-scope'));
var PUBLISH_HIDE = (CSS.match(/#project-panel\.publish-scope[^{]*\{[^}]*\}/) || [''])[0];
ok('the rule sets display: none', /display:\s*none/.test(PUBLISH_HIDE));
['project-name', 'save-btn', 'new-file-btn', 'delete-project-btn'].forEach(function (id) {
    ok(id + ' is hidden on the Publish tab', PUBLISH_HIDE.indexOf('#' + id) !== -1);
});
['load-select', 'load-btn'].forEach(function (id) {
    no(id + ' stays visible, not swept into the same rule', PUBLISH_HIDE.indexOf('#' + id) !== -1);
});
nav('nav-patterns');
no('Patterns keeps every control, so it is not in publish-only mode',
   $('project-panel').classList.contains('publish-scope'));
nav('nav-publish');
// Every export forwards to the control that already does the job.
['pub-export-txt', 'pub-export-pdf', 'pub-export-history'].forEach(function (id) {
    ok(id + ' is a button, not a form control',
       (HTML.match(new RegExp('<(\\w+)[^>]*\\bid="' + id + '"')) || [, ''])[1] === 'button');
});
ALERTS.length = 0; BLOBS.length = 0;
load(CLEAN);
nav('nav-publish');
$('pub-export-txt').fire('click');
ok('Save as Text really wrote a file', BLOBS.length > 0);
ok('and it is the pattern', /ch 13/.test(BLOBS[BLOBS.length - 1]));

print('\n4d-iv. The preview is the print area, not a second layout');
ok('it drew something', $('pdf-preview').innerHTML.length > 0);
no('and it is not the empty state', /Validate a pattern in Studio/.test($('pdf-preview').innerHTML));
// Ids are stripped on the way in: a second live element carrying print-pattern-title would make
// getElementById ambiguous and break the real printout.
no('no duplicated ids in the preview', /\sid="/.test($('pdf-preview').innerHTML));
ok('the print area itself still has its ids', /id="print-pattern-title"/.test(HTML));
// Empty state when there is nothing to print.
$('new-file-btn').fire('click');
nav('nav-publish');
ok('an empty project says so', /Validate a pattern in Studio/.test($('pdf-preview').innerHTML));

print('\n4d-iv-b. Load File regenerates the preview on its own, without a manual Refresh');
load(CLEAN);
$('project-name').value = 'preview reload test';
$('save-btn').fire('click');
$('new-file-btn').fire('click');
nav('nav-publish');
ok('a fresh project has nothing to preview', /Validate a pattern in Studio/.test($('pdf-preview').innerHTML));
nav('nav-patterns');
$('load-select').value = 'preview reload test';
$('load-btn').fire('click');
// No nav('nav-publish') and no click on Refresh in between - checked on a tab it was never navigated
// to, the same way a hidden panel is proven rendered in §5. Moving off the patternSteps-empty message
// is the observable proof that renderPdfPreview ran on its own.
no('loading the project moved the preview off the empty-pattern message',
   /Validate a pattern in Studio/.test($('pdf-preview').innerHTML));
$('load-select').value = 'preview reload test';
$('delete-project-btn').fire('click');
$('new-file-btn').fire('click');

print('\n4d-v. The Stitch Library lists what the pattern actually works');
ck('the tab is named for it', HTML.indexOf('<span class="nav-label">Stitch Library</span>') !== -1, true);
$('new-file-btn').fire('click');
nav('nav-library');
ok('an empty project says so', /No pattern yet/.test($('stitch-usage-content').innerHTML));
load(CLEAN);
nav('nav-library');
ok('both library panels are up', shown('stitch-usage-panel') && shown('custom-stitch-section'));
var usage = $('stitch-usage-content').innerHTML;
// CLEAN works ch, sc and inc. Nothing else may appear, and none of those may be missed.
['ch', 'sc', 'inc'].forEach(function (st) {
    ok('lists ' + st, new RegExp('class="stitch-name">' + st + '(<|")').test(usage));
});
no('does not invent a stitch the pattern never works', /class="stitch-name">dc(<|")/.test(usage));
// It is a glossary, not a report: names and meanings only. Counts, shares and the bars that drew them
// belong to the Dashboard, and the arithmetic to the Custom Stitch Dictionary.
no('no counts', /class="stitch-count"/.test(usage));
no('no shares', /class="stitch-share"/.test(usage));
no('no bars', /mini-track|mini-bar/.test(usage));
no('no totals line', /worked in total/.test(usage));
no('no cost and yield anywhere', /uses \d+/.test(usage));

// A term the designer defined is theirs, and is labelled as such.
addStitch('vst', 'dc, ch1, dc', '1', '3');
$('bulk-input').value = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)\nRow 2: ch 1, turn, vst x 4 (12)';
$('bulk-parse-btn').fire('click');
nav('nav-library');
ok('a custom stitch is listed too', /class="stitch-name">vst/.test($('stitch-usage-content').innerHTML));
ok('and marked as the designer\'s own', /stitch-flag">yours</.test($('stitch-usage-content').innerHTML));

// What each stitch IS, in words. The designer's own wording wins for their own term - the Council has
// nothing to say about "vst".
var defs = $('stitch-usage-content').innerHTML;
ok('their own wording is what is shown', /class="stitch-working"[^>]*>dc, ch1, dc</.test(defs));
ok('and it is credited to them', /title="Your definition[^"]*"/.test(defs));
$('clear-all-btn').fire('click');

print('\n4d-v-a. The definitions say where they came from');
load(['Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
      'Row 2: ch 1, turn, [sc in next st, picot] x 6 (12)']);
nav('nav-library');
var meanings = $('stitch-usage-content').innerHTML;
// Quoted from the CYC master list, which gives terms and not working instructions - so a CYC line is the
// term, nothing more.
ok('a listed stitch gets the CYC term',
   /class="stitch-working" title="Craft Yarn Council[^"]*">single crochet</.test(meanings));
ok('and the panel says so once, in the summary',
   /Definitions come from the Craft Yarn Council master list/.test(meanings));
// Picot is not on that list. It still gets a definition, and the Council is not credited with a sentence
// it did not write.
ok('an unlisted stitch is described in our own words',
   /title="Stitch Math description[^"]*">picot - a small chain loop/.test(meanings));
$('clear-all-btn').fire('click');

print('\n4d-v-b. "across" counts the whole row, not one stitch');
// A to-end clause is one token until something says how far it runs. That number is the count the
// previous row produced, read off the evaluated pass rather than worked out a second time.
var A = CrochetAnalyticsEngine;
var oneRow = [{ instructionString: 'dc in each st across', multiplier: 1 }];
ck('60 available means 60 dc', A.AggregateStitchCounts(oneRow, [{ index: 0, availableStitches: 60 }]).dc, 60);
ck('and 12 available means 12', A.AggregateStitchCounts(oneRow, [{ index: 0, availableStitches: 12 }]).dc, 12);
// The documented floor: with no pass to read, a to-end clause is still one stitch. Every caller in the
// app passes the pass, so this is a fallback and not the normal path.
ck('with no pass it falls back to one', A.AggregateStitchCounts(oneRow).dc, 1);
// A repeated row works its clause once per repeat.
ck('Rows 2-4 works it three times',
   A.AggregateStitchCounts([{ instructionString: 'sc in each st across', multiplier: 3 }],
                           [{ index: 0, availableStitches: 20 }]).sc, 60);
// Shaping consumes the row rather than reproducing it: 60 stitches, two at a time.
ck('sc2tog across is half the row',
   A.AggregateStitchCounts([{ instructionString: 'sc2tog across', multiplier: 1 }],
                           [{ index: 0, availableStitches: 60 }]).sc2tog, 30);

// A whole flat pattern, foundation row and all. The counts are asserted here rather than read back out
// of the Stitch Library, which lists names and meanings and no longer prints a figure.
var flat = A.AggregateStitchCounts(
    [{ instructionString: 'ch 61, sc in 2nd ch from hook and in each ch across', multiplier: 1 },
     { instructionString: 'ch 3, turn, dc in each st across', multiplier: 1 }],
    [{ index: 0, availableStitches: 0 }, { index: 1, availableStitches: 60 }]);
ck('the dc row is counted in full', flat.dc, 60);
// The foundation row works back along its own chain. The engine reads that row outside the tokenizer -
// handed a stitch count it would call "in each ch across" that many more CHAINS - so the chain is taken
// as written and the stitch stretched to what it works.
ck('the foundation row works its chain length', flat.sc, 60);
ok('and the chain itself is still counted once', flat.ch >= 61 && flat.ch < 122);

// What the panel takes from that aggregation is the list of names, and only the names.
load(['Row 1: ch 61, sc in 2nd ch from hook and in each ch across (60)',
      'Row 2: ch 3, turn, dc in each st across (60)']);
nav('nav-library');
var listed = ($('stitch-usage-content').innerHTML.match(/class="stitch-name">([a-z0-9 -]+)</g) || [])
    .map(function (m) { return m.replace(/.*>/, '').replace('<', ''); }).sort().join(',');
ck('every stitch the row works is named, and nothing else', listed, 'ch,dc,sc');

print('\n4d-vi. Navigating scrolls once, not twice');
// A focus target used to reset to the top and then animate down to its panel. Two scrolls for one click
// is what made the page lurch. Only one survives.
var appSrc = readFile('app.js');
var navBody = appSrc.slice(appSrc.indexOf('function navigateTo'), appSrc.indexOf('function closeNavDrawer'));
ok('the reset only runs when there is nothing to focus',
   /if \(target\.focus\) \{[\s\S]*?focusPanel\(target\.focus[\s\S]*?\} else if[\s\S]*?scrollTo\(0, 0\)/.test(navBody));
no('and never both in a row', /scrollTo\(0, 0\);\s*if \(target\.focus\)/.test(navBody));
ok('focusing a panel does not animate', /behavior: 'auto'/.test(appSrc));
no('nothing smooth-scrolls on navigation', /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/.test(appSrc));

print('\n4e. The help panel explains the app that exists');
// Sliced to the help panel alone. Ending it at the grader swept in the Settings and Publish panels too,
// and a stray tag name inside one of their comments then read as a form control on the help page.
var HELPBLOCK = HTML.slice(HTML.indexOf('id="help-panel"'), HTML.indexOf('id="settings-panel"'));
ok('it has several topics', (HELPBLOCK.match(/<details class="help-topic"/g) || []).length >= 5);
ok('the first one is open by default', /<details class="help-topic" open>/.test(HELPBLOCK));
// Help that names a control the app does not have is worse than no help.
['Validate Entire Pattern', 'Jump to First Error', 'Calculate Gauge', 'Save as Text',
 'Save as PDF'].forEach(function (label) {
    ok('help names "' + label + '", and so does the app',
       HELPBLOCK.indexOf(label) !== -1 && HTML.indexOf(label) !== -1);
});
// It also names the sidebar destinations it tells people to visit.
['Studio', 'Gauge Profile', 'Sizer / Grader', 'Library', 'Patterns'].forEach(function (dest) {
    ok('help points at the real "' + dest + '" tab', HELPBLOCK.indexOf(dest) !== -1);
});
no('no form controls in the help panel', /<(input|select|textarea)\b/.test(HELPBLOCK));

print('\n5. A hidden panel is still a rendered panel');
// The whole reason the shell hides rather than moves. Validate from the dashboard, where the matrix is
// not on screen, then go and look at it.
nav('nav-dashboard');
load(CLEAN);
no('the matrix is off screen', shown('matrix-section'));
ok('but it has the rows', /ch 13/.test($('step-sequence-body').text()));
// nav-studio, not the retired 'nav-compiler': navigateTo bails on an id it does not know, so this
// step used to assert "when you look" without ever having looked.
nav('nav-studio');
ok('and they are there when you look', /ch 13/.test($('step-sequence-body').text()));
ok('and the matrix really is on screen now', shown('matrix-section'));
ck('three rows', $('step-sequence-body').children.length, 3);

print('\n6. Dashboard figures equal their sources');
var pass = null;
nav('nav-dashboard');
load(CLEAN);
ck('errors match the failed count', $('dash-errors').textContent, '0');
ck('passed matches the passed count', $('dash-passed').textContent, '3');
ck('warnings match the blocked count', $('dash-warnings').textContent, '0');
// The score shown is the one the Validation Results panel worked out, not a second opinion computed from
// the same rows.
var panelScore = ($('cumulative-status').innerHTML.match(/health-number">(\d+)</) || [, null])[1];
ck('health score matches the health panel', $('dash-health').textContent, panelScore);
ok('the stitch graph was plotted', /<svg/.test($('dash-graph').innerHTML));
ok('and no row is marked bad on a clean pattern', $('dash-graph').innerHTML.indexOf('graph-dot-bad') === -1);
ck('rows in progress matches the pattern', $('tile-studio-value').textContent, '3');
ck('analytics tile carries the score', $('tile-analytics-value').textContent, panelScore + '%');

// A deliberate mismatch has to show up in all three places at once.
load([
    'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
    'Row 2: ch 1, turn, sc2tog x 20 (12)'
]);
ok('a broken row raises the error count', Number($('dash-errors').textContent) > 0);
ok('and names the row in the findings', /Row 2/.test($('dash-findings').innerHTML));
ok('and marks it on the graph', /graph-dot-bad/.test($('dash-graph').innerHTML));
// evaluateStep returns an HTML-bearing `reason`. The card flattens it to text, so the detail line must
// carry neither live markup nor visibly escaped markup.
var detail = ($('dash-findings').innerHTML.match(/class="finding-detail">([\s\S]*?)<\/p>/) || [, ''])[1];
ok('there is a detail line to check', detail.length > 0);
no('it carries no live markup', /[<>]/.test(detail));
no('nor escaped markup showing through', /&lt;|&gt;/.test(detail));

print('\n7. Schematics card draws the real garment, not a status line');
ok('nothing graded yet, so the empty state shows', /A schematic is drawn once/.test($('dash-schematics').innerHTML));
load(['Row 1: ch 41 (45, 49), sc in 2nd ch from hook and in each ch across (40)']);
function setVal(id, v) { $(id).value = String(v); $(id).fire('input'); }
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 12);
setVal('grade-body', 38); setVal('grade-finished', 42);
no('still nothing until a chart is chosen', /<svg/.test($('dash-schematics').innerHTML));
$('grade-chart').value = 'woman'; $('grade-chart').fire('change');
ok('the preview draws once a chart is graded', /<svg class="grade-schematic-svg dash-schematic-svg"/.test($('dash-schematics').innerHTML));
ok('carrying the same body outline as the real schematic',
   $('dash-schematics').innerHTML.indexOf('class="grade-schematic-body"') !== -1
   && $('grade-schematic').innerHTML.indexOf('class="grade-schematic-body"') === -1); // real one is appendChild-built, reads empty under the stub - see CONTRIBUTING
ok('and at least one measurement line', /class="grade-schematic-rule"/.test($('dash-schematics').innerHTML));
// Reported from the same sizes array dash-sizes uses (Small/Medium/Large by default for three sizes),
// not from the grade-base-name field, which was never set in this test.
ok('base size is reported', /Small/.test($('dash-schematics').innerHTML));
// Clearing the chart must clear the preview too - it is read from the last graded garment, and a stale
// one would show a chart the designer just took away.
$('grade-chart').value = ''; $('grade-chart').fire('change');
ok('clearing the chart clears the preview', /A schematic is drawn once/.test($('dash-schematics').innerHTML));

print('\n8. Empty states rather than invented figures');
$('new-file-btn').fire('click');
ck('errors back to zero', $('dash-errors').textContent, '0');
ck('health has no number to show', $('dash-health').textContent, '—');
ok('the compiler card says so', /No pattern compiled yet/.test($('dash-findings').innerHTML));
ok('recent projects says so', /No saved projects yet/.test($('dash-recent').innerHTML));
ok('gauges says so', /No swatches logged/.test($('dash-gauges').innerHTML));
ok('testers says so', /No testers recorded/.test($('dash-testers').innerHTML));
ok('size charts says so', /written for one size/.test($('dash-sizes').innerHTML));
ok('and so does the schematic', /A schematic is drawn once/.test($('dash-schematics').innerHTML));

// ---- Progress store ----
// The store is reachable from here in exactly one way - through localStorage - which is also the only way
// to write down a date other than today. Every streak assertion below is built on that: seed `lastActive`,
// take a real action, read the result.
function progress() { return JSON.parse(localStorage.getItem('stitchmath_progress') || '{}'); }
function seedProgress(fields) {
    var store = progress();
    for (var key in fields) store[key] = fields[key];
    localStorage.setItem('stitchmath_progress', JSON.stringify(store));
}
function dayString(offset) {
    return new Date(Date.now() + (offset || 0) * 86400000).toISOString().slice(0, 10);
}
// A stitch CLEAN does not work, so the roll can never be claimed by accident and the point totals in §9
// and §10 stay the same whatever today's real draw would be. `isNew` is part of the draw rather than the
// claim, so it is pinned with it.
function pinRoll(stitch) {
    seedProgress({
        roll: { date: dayString(0), stitch: stitch, rerolls: 0, claimed: false, isNew: true }
    });
}
function resetProgress() {
    localStorage.removeItem('stitchmath_progress');
    // Cleared through storage and redrawn by a real action rather than a second boot(): booting twice
    // registers a second copy of every listener, so a later click would fire its handler twice.
    $('new-file-btn').fire('click');
}

print('\n9. Points come from recorded work, and outlive New File');
resetProgress();
pinRoll('bobble');
ck('a fresh browser has none', progress().points, 0);
ck('and is level 1', $('xp-level').textContent, 'Level 1');
ck('and holds the first rank', $('xp-title').textContent, 'Chain Starter');
// Rank, not currency. The sidebar leads with the rank name and counts levels to the next one; the
// figure behind it is deliberately not on screen anywhere.
ck('the sidebar leads with the rank', $('points-total').textContent, 'Chain Starter');
ok('and says how far the next one is', /levels? to Row Counter/.test($('points-next').textContent));
no('no balance in the sidebar', /\d+ pts/.test($('points-next').textContent));
ck('with nothing earned to report', $('points-note').textContent, 'Write, export or save a pattern to start earning.');

// Source one: the daily quest, completed by the pattern on the page compiling clean. CLEAN works 56
// stitches, short of the 100 that pays, so the quest is the only thing settling here.
load(CLEAN);
ck('a clean compile completes the quest', $('quest-count').textContent, '1 / 1');
ck('and pays 50', progress().points, 50);
ck('and banks the stitches it worked', progress().stitches, 56);
ck('and counts the compile', progress().compiles, 1);

// Source two: saving a project.
$('project-name').value = 'shell test';
$('save-btn').fire('click');
ck('a saved project adds 25', progress().points, 75);
ck('and the streak has started', $('streak-count').textContent, '1 day streak');
ok('the note reports what earned it', /1 saved/.test($('points-note').textContent));

print('\n9b. Saving pays for a new file, not for pressing the button');
$('save-btn').fire('click');
ck('saving over the same file pays nothing', progress().points, 75);
ck('and does not count a second pattern', progress().projects, 1);
ok('and the app says it updated rather than saved',
   /Project "shell test" updated\./.test(ALERTS[ALERTS.length - 1]));
$('project-name').value = 'shell test two';
$('save-btn').fire('click');
ck('a genuinely new file does pay', progress().points, 100);
ck('and counts', progress().projects, 2);
ok('and says so', /Project "shell test two" saved\./.test(ALERTS[ALERTS.length - 1]));

// The hole the existence check alone leaves open: delete the file, save it again.
$('load-select').value = 'shell test two';
$('delete-project-btn').fire('click');
$('project-name').value = 'shell test two';
$('save-btn').fire('click');
ck('a deleted name that comes back is not paid for twice', progress().points, 100);
ck('nor counted twice', progress().projects, 2);

$('project-name').value = 'shell test';

$('new-file-btn').fire('click');
ck('New File does not take the points away', progress().points, 100);
ok('because they are not part of the open file', /2 saved/.test($('points-note').textContent));

print('\n10. The quest pays once a day, not once a compile');
load(CLEAN);
ck('re-compiling clean does not pay again', progress().points, 100);
ck('but it still reads as done', $('quest-count').textContent, '1 / 1');
ck('and the stitches are not banked twice', progress().stitches, 56);
load(['Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)',
      'Row 2: ch 1, turn, sc2tog x 20 (12)']);
ck('and a broken pattern takes nothing back', progress().points, 100);
ck('nor banks stitches that do not add up', progress().stitches, 56);

print('\n10b. Stitches are credited once, and only the ones newly written');
resetProgress();
pinRoll('bobble');
load(CLEAN);
ck('a first compile banks the lot', progress().stitches, 56);
// The same three rows with three more on the end: only the difference is new work.
var LONGER = CLEAN.concat([
    'Row 4: ch 1, turn, sc in each st across (18)',
    'Row 5: ch 1, turn, sc in each st across (18)',
    'Row 6: ch 1, turn, sc in each st across (18)'
]);
load(LONGER);
var afterLonger = progress().stitches;
ok('extending the pattern banks the new rows', afterLonger > 56);
load(CLEAN);
ck('and going back to the shorter one banks nothing', progress().stitches, afterLonger);
ck('because a total already credited is not gained again',
   progress().credited[Object.keys(progress().credited)[0]] !== undefined, true);

print('\n10c. Crossing a hundred stitches pays, and pays once');
resetProgress();
pinRoll('bobble');
seedProgress({ points: 0, questDate: dayString(0) });   // quest already settled today
load(LONGER);
var banked = progress().stitches;
ok('the longer pattern is worth more than a hundred stitches', banked >= 100);
ck('and paid five points a hundred', progress().points, Math.floor(banked / 100) * 5);
var paid = progress().points;
load(LONGER);
ck('re-compiling pays nothing further', progress().points, paid);

print('\n11. The stitch roll');
resetProgress();
pinRoll('bobble');
$('nav-dashboard').fire('click');
ck('the card shows the stitch that was drawn', $('roll-stitch').textContent, 'bobble');
// The glossary term for "bobble" is "bobble", so the abbreviation is shown instead of printing the name
// back at the reader.
ck('and says something about it the name did not', $('roll-term').textContent, 'abbreviated bo');
ok('and grades it Legendary', /Legendary/.test($('roll-tier').textContent));
ok('a stitch never worked before is flagged as new', /New/.test($('roll-tier').textContent));
// 40 base x5 for Legendary, x1 because nothing has been written yet so there is no streak to multiply it,
// plus 50 for a stitch never worked before.
ck('and is priced accordingly', $('roll-reward').textContent, '+250 Stitch Points');
ck('the draw is held rather than re-made on every render', progress().roll.stitch, 'bobble');
$('nav-dashboard').fire('click');
ck('so a second render shows the same stitch', $('roll-stitch').textContent, 'bobble');

print('\n11b. Working the rolled stitch claims it, once');
resetProgress();
pinRoll('dc');
seedProgress({ questDate: dayString(0) });   // isolate the roll from the daily quest
load(['Row 1: ch 13, dc in 4th ch from hook and in each ch across (10)',
      'Row 2: ch 3, turn, dc in each st across (10)']);
ok('a clean pattern that works it claims the roll', progress().roll.claimed);
// dc is weight 2: 40 base x1.5 = 60, then x1.05 for the day-one streak the compile just started = 63,
// rounded to 65, plus 50 for the discovery.
ck('and pays the tier', progress().points, 115);
var afterClaim = progress().points;
load(['Row 1: ch 13, dc in 4th ch from hook and in each ch across (10)',
      'Row 2: ch 3, turn, dc in each st across (10)']);
ck('and does not pay again', progress().points, afterClaim);

resetProgress();
pinRoll('bobble');
seedProgress({ questDate: dayString(0) });
load(CLEAN);
no('a clean pattern without the stitch does not claim it', progress().roll.claimed);
ck('and the quest below it is unaffected', $('quest-count').textContent, '1 / 1');

print('\n11c. The re-roll is a daily allowance, not a purchase');
// It used to cost forty points. Telling a beginner that looking at a different stitch costs them
// progress teaches the wrong lesson about curiosity, so it is two a day and free.
resetProgress();
pinRoll('bobble');
seedProgress({ points: 0 });
nav('nav-practice');
no('with no points at all it is still live', $('roll-again').disabled);
ok('and says how many are left', /2 left today/.test($('roll-again').textContent));
$('roll-again').fire('click');
ck('re-rolling costs nothing', progress().points, 0);
ck('and records nothing as spent', progress().spent, 0);
ck('but it is counted', progress().roll.rerolls, 1);
ok('the stitch is drawn from the pool', $('roll-stitch').textContent.length > 0);

$('roll-again').fire('click');
ck('a second re-roll is allowed', progress().roll.rerolls, 2);
var third = progress().roll.stitch;
$('roll-again').fire('click');
ck('a third in one day is refused', progress().roll.stitch, third);
ck('and the counter holds at the cap', progress().roll.rerolls, 2);
ok('the button says why', /No re-rolls left today/.test($('roll-again').textContent));
ok('and is disabled', $('roll-again').disabled);

// Tomorrow is a new roll, so the allowance comes back with it.
seedProgress({ roll: { date: dayString(-1), stitch: 'bobble', rerolls: 2, claimed: false, isNew: true } });
nav('nav-practice');
ck('a new day draws again', progress().roll.date, dayString(0));
ck('and resets the allowance', progress().roll.rerolls, 0);

print('\n11d. A streak is consecutive days, and it is worth something');
resetProgress();
seedProgress({ lastActive: dayString(-1), streak: 4, bestStreak: 4 });
pinRoll('bobble');
load(CLEAN);
ck('a day after yesterday continues the streak', progress().streak, 5);
ck('and the meter says so', $('streak-count').textContent, '5 day streak');
ok('and reports the multiplier it buys', /×1.25/.test($('streak-note').textContent));

resetProgress();
seedProgress({ lastActive: dayString(-3), streak: 9, bestStreak: 9 });
pinRoll('bobble');
load(CLEAN);
ck('a missed day resets to one', progress().streak, 1);
ck('but the best is remembered', progress().bestStreak, 9);
ck('and the record strip reports it', $('rec-best').textContent, '9');

print('\n11d-ii. A rest day is banked every seven, and spent on a single missed day');
/*
 * Why forgiveness exists at all: a reset un-earns every milestone with it, which is the mechanic that
 * makes people quit on day eight and not come back - and it punishes the wrong thing. Somebody who
 * worked twenty days and missed one has not undone the twenty.
 *
 * What it is NOT is a free pass, and most of what follows is about that: the day has to have been
 * earned, only a gap of exactly one is covered, and two days away still resets however full the bank.
 */
resetProgress();
seedProgress({ lastActive: dayString(-1), streak: 6, bestStreak: 6, restDays: 0, restBankedAt: 0 });
pinRoll('bobble');
load(CLEAN);
ck('reaching seven days banks one', progress().restDays, 1);
ck('and the bank remembers where it came from', progress().restBankedAt, 7);

// Day 8, 9 and 10 must not each bank another. The bank moves when the streak CROSSES a seventh day.
resetProgress();
seedProgress({ lastActive: dayString(-1), streak: 8, bestStreak: 8, restDays: 1, restBankedAt: 7 });
pinRoll('bobble');
load(CLEAN);
ck('standing past seven banks nothing more', progress().restDays, 1);

resetProgress();
seedProgress({ lastActive: dayString(-1), streak: 13, bestStreak: 13, restDays: 1, restBankedAt: 7 });
pinRoll('bobble');
load(CLEAN);
ck('fourteen days banks the second', progress().restDays, 2);

resetProgress();
seedProgress({ lastActive: dayString(-1), streak: 20, bestStreak: 20, restDays: 2, restBankedAt: 14 });
pinRoll('bobble');
load(CLEAN);
ck('twenty-one still banks two, because two is the cap', progress().restDays, 2);

print('\n11d-iii. Spending one, and the gaps it does not cover');
resetProgress();
seedProgress({ lastActive: dayString(-2), streak: 9, bestStreak: 9, restDays: 1, restBankedAt: 7,
               lastMilestone: 7 });
pinRoll('bobble');
load(CLEAN);
ck('one missed day with a rest banked continues the streak', progress().streak, 10);
ck('and the bank paid for it', progress().restDays, 0);
ck('the milestones are not un-earned', progress().lastMilestone, 7);

resetProgress();
seedProgress({ lastActive: dayString(-2), streak: 9, bestStreak: 9, restDays: 0, restBankedAt: 7,
               lastMilestone: 7 });
pinRoll('bobble');
load(CLEAN);
ck('one missed day with nothing banked resets, as it always did', progress().streak, 1);
ck('and clears the milestones with it', progress().lastMilestone, 0);
ck('but the best is still remembered', progress().bestStreak, 9);

resetProgress();
seedProgress({ lastActive: dayString(-3), streak: 20, bestStreak: 20, restDays: 2, restBankedAt: 14,
               lastMilestone: 14 });
pinRoll('bobble');
load(CLEAN);
ck('three days away resets however full the bank is', progress().streak, 1);
ck('and the bank goes with the run that earned it', progress().restDays, 0);
ck('milestones cleared', progress().lastMilestone, 0);

print('\n11d-iv. Seven dots, not a bare number');
// A number makes one missed day feel like a score of zero. A row of dots makes it a week with a gap
// in it, which is what it actually is.
resetProgress();
seedProgress({ lastActive: dayString(-2), streak: 9, bestStreak: 9, restDays: 1, restBankedAt: 7,
               days: [{ d: dayString(-4), k: 'worked' }, { d: dayString(-3), k: 'worked' },
                      { d: dayString(-2), k: 'worked' }] });
pinRoll('bobble');
load(CLEAN);
nav('nav-practice');
ck('seven days are drawn', $('streak-dots').children.length, 7);
var dots = $('streak-dots').children.map(function (d) { return d.className.replace('streak-dot is-', ''); });
ck('today was worked', dots[6], 'worked');
ck('yesterday was covered by the bank', dots[5], 'rested');
ck('the day before was worked', dots[4], 'worked');
ck('and a day with nothing on it reads as missed', dots[0], 'missed');
ok('the note names the run', /10 day streak/.test($('streak-dots-note').textContent));

print('\n11e. Streak milestones pay once');
resetProgress();
seedProgress({ lastActive: dayString(-1), streak: 2, lastMilestone: 0, questDate: dayString(0) });
pinRoll('bobble');
load(CLEAN);
ck('reaching three days pays 25', progress().points, 25);
ck('and the milestone is stamped', progress().lastMilestone, 3);
var afterMilestone = progress().points;
load(CLEAN);
ck('and is not paid again the same day', progress().points, afterMilestone);

print('\n11f. Exports are counted, and paid three times a day');
resetProgress();
pinRoll('bobble');
seedProgress({ questDate: dayString(0) });
load(CLEAN);
var beforeExport = progress().points;
nav('nav-publish');
$('pub-export-txt').fire('click');
ck('an export pays 15', progress().points, beforeExport + 15);
ck('and is recorded', progress().exports, 1);
$('pub-export-txt').fire('click');
$('pub-export-txt').fire('click');
$('pub-export-txt').fire('click');
ck('the fourth in a day ships', progress().exports, 4);
ck('but only three were paid', progress().points, beforeExport + 45);
nav('nav-dashboard');
ck('and the record strip reports every one', $('rec-exports').textContent, '4');

print('\n11g. The rank ladder follows the level');
resetProgress();
seedProgress({ points: 480 });
pinRoll('bobble');
$('nav-dashboard').fire('click');
ck('480 points is level 5', $('xp-level').textContent, 'Level 5');
ck('which is where Pattern Explorer starts', $('xp-title').textContent, 'Pattern Explorer');
seedProgress({ points: 2500 });
$('nav-dashboard').fire('click');
ck('and the top of the ladder is the last rank', $('xp-title').textContent, 'Master Designer');

print('\n11h. The record strip counts a life, not a file');
resetProgress();
pinRoll('bobble');
load(CLEAN);
$('project-name').value = 'record test';
$('save-btn').fire('click');
nav('nav-dashboard');
ck('patterns saved', $('rec-patterns').textContent, '1');
ck('stitches worked', $('rec-stitches').textContent, '56');
ck('clean compiles', $('rec-compiles').textContent, '1');
ok('and the collection counts the stitches it can ask for',
   /^[0-9]+ \/ 27$/.test($('rec-collected').textContent));
$('new-file-btn').fire('click');
nav('nav-dashboard');
ck('and New File leaves all of it standing', $('rec-stitches').textContent, '56');

// Left as the app found it, so the sections below start from a known store.
resetProgress();

print('\n11i. The spend machinery is kept, deliberately unused');
// Section 2 of the build plan says so in as many words: REROLL_COST, `spent` and the
// lifetime = points + spent arithmetic are what a currency needs, and they stay against the return
// of one. Asserted rather than left to a comment, so a future tidy-up has to argue with a test.
var APPSRC = readFile('app.js');
ok('REROLL_COST still exists', /const REROLL_COST = \d+;/.test(APPSRC));
ok('and says why it is kept', /KEPT ON PURPOSE/.test(APPSRC));
ok('lifetime still counts what was spent', /const lifetime = progress\.points \+ progress\.spent;/.test(APPSRC));
resetProgress();
// Rank is computed from lifetime earnings, so a spend cannot walk it backwards. Seeded directly
// because nothing in the app spends any more - which is the point of keeping the arithmetic.
seedProgress({ points: 500, spent: 0 });
pinRoll('bobble');
nav('nav-dashboard');
ck('500 points is level 6', $('xp-level').textContent, 'Level 6');
ck('and a rank to match', $('xp-title').textContent, 'Pattern Explorer');
seedProgress({ points: 460, spent: 40 });
nav('nav-dashboard');
ck('spending forty of it holds the level', $('xp-level').textContent, 'Level 6');
ck('and the rank with it', $('xp-title').textContent, 'Pattern Explorer');

resetProgress();

print('\n12. Contract guards');
// New form controls on the dashboard would be swept into the New File reset suite, and would imply the
// summary holds data of its own. It does not.
var DASH = HTML.slice(HTML.indexOf('id="dashboard-view"'), HTML.indexOf('id="intro-header"'));
no('no form controls in the dashboard', /<(input|select|textarea)\b/.test(DASH));
var SIDEBAR = HTML.slice(HTML.indexOf('id="app-sidebar"'), HTML.indexOf('id="app-main"'));
no('nor in the sidebar', /<(input|select|textarea)\b/.test(SIDEBAR));
ck('index.html still carries no inline styles', (HTML.match(/style="/g) || []).length, 0);
// Bar widths are computed, so they are assigned rather than written into a template.
ck('app.js still has one inline style, the complexity bar',
   (readFile('app.js').match(/style="/g) || []).length, 1);

ok('the shell hides panels through the class app.js already uses',
   /\.hidden \{ display: none !important; \}/.test(CSS));
ok('the single-column override exists', /main\[data-cols="one"\] \{/.test(CSS));
// Every workspace view is one column; the dashboard is the only multi-column thing on the page, and it
// uses its own card grid rather than this one.
NAV_IDS.forEach(function (id) {
    nav(id);
    if (id === 'nav-dashboard') return;
    ck(id + ' is a single column', $('workspace').dataset.cols, 'one');
});
ok('and drops the left column zoom with it', /main\[data-cols="one"\] > \.left-column \{ zoom: 1/.test(CSS));
ok('the workspace grid itself is untouched',
   /main \{[\s\S]*?grid-template-columns: minmax\(330px, 1\.10fr\)/.test(CSS));
ok('the sidebar becomes a drawer below 950px', /#app-shell\.nav-open #app-sidebar/.test(CSS));
ok('printing drops the whole shell', /#app-shell \{ display: none !important; \}/.test(CSS));

print('\n11. Accessibility: what a screen reader is told');
// Before this pass there were zero live regions in 19,000 lines: pressing Validate wrote a matrix, a
// health panel and a status line into the DOM, and a silent DOM change is not an event. A reader heard
// nothing at all. These assert the contract rather than the wording, so the sentence can be reworded
// without breaking them - except the count itself, which is the part that carries the meaning.
ok('there is a live region for validation results',
   /id="validation-announce"[^>]*aria-live="polite"/.test(HTML));
ok('it is off-screen rather than display:none, which is not announced',
   /id="validation-announce"[^>]*class="visually-hidden"/.test(HTML));
ok('and the class really does keep it rendered', /\.visually-hidden \{[\s\S]*?clip-path: inset\(50%\)/.test(CSS));
ok('the autosave line reports its own changes', /id="save-status"[^>]*aria-live="polite"/.test(HTML));

// The one control the whole application exists to serve had no accessible name at all.
ok('the pattern box is named', /id="bulk-input"[^>]*aria-label="Pattern text/.test(HTML));
ok('and points at its own instructions', /id="bulk-input"[^>]*aria-describedby="bulk-input-help"/.test(HTML));
ok('which resolve to a real element', /id="bulk-input-help"/.test(HTML));
ok('the project name is named', /id="project-name"[^>]*aria-label="Project name"/.test(HTML));

// The drawer toggle said "Open navigation" whether the drawer was open or shut.
ok('the drawer toggle carries its state', /id="nav-toggle"[^>]*aria-expanded="false"/.test(HTML));
ok('and names what it controls', /id="nav-toggle"[^>]*aria-controls="app-sidebar"/.test(HTML));

// A result actually reaches the region, and says what happened rather than that something did.
nav('nav-studio');
$('bulk-input').value = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)\n'
                     + 'Row 2: ch 1, turn, sc in each st across (12)';
$('bulk-parse-btn').fire('click');
var SAID = $('validation-announce').text();
ok('validating announces a result', /Validation complete/.test(SAID));
ok('with the count in it, not just that something happened', /2 of 2 rows pass/.test(SAID));

// A failure has to be said as a failure. Silence on the bad case would be the worst version of this.
$('bulk-input').value = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)\n'
                      + 'Row 2: ch 1, turn, dubble crochet in each st across (12)';
$('bulk-parse-btn').fire('click');
ok('a failure is announced as one', /1 failed/.test($('validation-announce').text()));

// Exactly one tab is current, and it is the one that looks current.
nav('nav-sizer');
var CURRENT = NAV_IDS.filter(function (id) { return $(id).getAttribute('aria-current') === 'page'; });
ck('exactly one nav item is marked current', CURRENT.length, 1);
ck('and it is the one navigated to', CURRENT[0], 'nav-sizer');

// Confirmed by ear on 1 Sep, not by reading the tree: activating a sidebar item changed the whole
// screen and said nothing at all. aria-current answers "which tab is selected"; it does not answer
// "where am I now", and eleven views that all sound the same once activated is a screen reader user
// with no way to tell which one they are in.
nav('nav-studio');
var ARRIVED = $('validation-announce').text();
ok('arriving somewhere says where you are', /Studio/.test(ARRIVED));
ok('and what it is for, not just its name', ARRIVED.length > 'Studio'.length + 4);
nav('nav-gauge');
ok('and it is the view actually navigated to', /Gauge/.test($('validation-announce').text()));
// The opening navigation is the exception: it runs before anyone has asked for anything.
ok('the first navigation is silent', /navigateTo\(opening, \{ replace: true, silent: true \}\)/.test(appSrc));

// Jump to First Error scrolled the viewport and flashed a colour. Both are things you have to be
// looking at. The reader who most needs the button got nothing from it at all.
var jumpBody = appSrc.slice(appSrc.indexOf('window.jumpToFirstError'),
                            appSrc.indexOf('// === 5b.'));
ok('jumping moves the reader, not only the viewport', /\.focus\(\{ preventScroll: true \}\)/.test(jumpBody));
ok('and the row is made focusable to receive it', /setAttribute\('tabindex', '-1'\)/.test(jumpBody));
ok('and the row is named, so focus announces a summary not the whole row',
   /setAttribute\('aria-label', describeFailingRow\(/.test(jumpBody));
ok('and says so when there is nothing to jump to', /No failing rows to jump to/.test(jumpBody));
ok('the scroll respects a reduced-motion preference', /reducedMotion\(\) \? 'auto' : 'smooth'/.test(jumpBody));

// Boot says nothing. Drawing the empty page used to reach the live region, so a reader arriving at
// the app heard "Nothing to validate yet." before it had finished introducing itself.
ok('announcements are held until boot finishes',
   /let announcementsArmed = false;/.test(appSrc) && /!announcementsArmed\) return;/.test(appSrc));
ok('and armed on the last line of init', /beginPersistence\(\);[\s\S]{0,200}?armAnnouncements\(\);/.test(appSrc));

// Both reported from a real VoiceOver run, 4-5 Sep.
//
// The toast: a role set on an element as it is appended is a live region ARRIVING, not a live region
// changing, and VoiceOver announced none of them. The regions are permanent and empty now, and notify
// writes into them - which is a change, every time.
ok('the toast host is decoration, not the announcement',
   /id="toast-host"[^>]*aria-hidden="true"/.test(HTML));
ok('a polite region is standing by for it', /id="toast-say"[^>]*aria-live="polite"/.test(HTML));
ok('and an assertive one for errors', /id="toast-alert"[^>]*aria-live="assertive"/.test(HTML));
ok('and notify picks between them by tone',
   /getElementById\(kind === 'error' \? 'toast-alert' : 'toast-say'\)/.test(appSrc));
ok('clearing first, so the same message twice is two announcements',
   /region\.textContent = '';\s*region\.textContent = text;/.test(appSrc));
no('a toast no longer carries its own role', /toast\.setAttribute\('role'/.test(appSrc));

// Reported twice from the VoiceOver run: the export said nothing the app had written. A download makes
// the browser speak for itself, and a polite region updated after that arrives while the reader is
// already talking - which is where a polite message is dropped. So the confirmation goes out first.
var dlBody = appSrc.slice(appSrc.indexOf('function downloadFile(name, body, type, said)'),
                          appSrc.indexOf("function projectSlug"));
ok('the confirmation is spoken before the click, not after',
   dlBody.indexOf('if (said) notify(said);') < dlBody.indexOf('a.click()'));
no('and no export announces itself afterwards instead',
   /downloadFile\([\s\S]{0,300}?\);\s*notify\(/.test(appSrc));
// Only the PDF used to say anything at all. A reader pressing any of the others had nothing but the
// browser's own chatter to tell them the button had worked.
['Gauge history saved.', 'Project file saved.', 'Pattern saved as text.', 'PDF saved.']
  .forEach(function (said) {
    ok('an export confirms itself: "' + said + '"', appSrc.indexOf("'" + said + "'") !== -1);
});

// Jumping: focus landed on the right row and announced its position and number, and nothing about what
// was wrong - which is the one thing the reader pressed the button to find out.
var describeBody = appSrc.slice(appSrc.indexOf('function describeFailingRow'),
                                appSrc.indexOf('window.jumpToFirstError'));
ok('the row name leads with the top-ranked cause', /pick\('\.math-cause \.cause-name'\)/.test(describeBody));
ok('and carries the reason with it', /pick\('\.math-reason'\)/.test(describeBody));
ok('with the bullet spoken as a full stop rather than the word "bullet"',
   /replace\(\/\\s\*•\\s\*\/g, '\. '\)/.test(describeBody));

print('\n12. Hash routing');
// Twelve views and one address. The slug is derived from the nav id rather than written
// beside it, so a view cannot gain a route without a tab or a tab without a route - which is the whole
// reason to assert the mapping rather than a hand-written list.
var SLUGS = NAV_IDS.map(function (id) { return id.replace(/^nav-/, ''); });
ck('every nav id yields a slug', SLUGS.filter(Boolean).length, NAV_IDS.length);
ck('and no two share one', new Set(SLUGS).size, NAV_IDS.length);
ok('none of them keeps the nav- prefix', SLUGS.every(function (x) { return x.indexOf('nav-') === -1; }));
// nav-library shares nav-patterns' view but lands on a different panel, so it keeps its own address.
ok('library is addressable separately from patterns',
   SLUGS.indexOf('library') !== -1 && SLUGS.indexOf('patterns') !== -1);
// The stub has no window.location, so the router's writes are no-ops here rather than throwing - which
// is the assertion that matters for the suites: navigation still works with no URL to write to.
nav('nav-studio');
ok('navigation still works where there is no URL to write', shown('input-section'));

print('\n13. Stitch dictionary travels with the project');
ok('the envelope carries a dictionary field', /customStitches: getLocalStorage/.test(readFile('app.js')));
ok('and persistence validates it only when present',
   /body\.customStitches !== undefined/.test(readFile('persistence.js')));
ok('there is a button to take one without the pattern', /id="import-stitches-btn"/.test(HTML));

// The conflict rule is the point of the merge: a name that already exists with DIFFERENT numbers is
// asked about, one that matches is left alone, and a new one is simply added.
$('custom-st-name').value = 'v-st';
$('custom-st-def').value = 'dc, ch1, dc';
$('custom-st-cost').value = '1';
$('custom-st-yield').value = '3';
$('custom-stitch-form').fire('submit');
var DICT = JSON.parse(localStorage.getItem('stitchmath_custom_stitches') || '{}');
ck('a custom stitch is stored', DICT['v-st'].yield, 3);
ok('and the engine knows it', !!window.CrochetMathEngine.CUSTOM_STITCHES['v-st']);

print('\n14. Messages: no native dialogs left');
// alert() and confirm() block the thread, cannot be styled, and are suppressed outright in some
// webviews - where a confirm() silently returning false turns "Import this project?" into an import
// that quietly does nothing. Asserted against the source, because the stub still SUPPLIES both: they
// are the fallback the suites record through, which is why every assertion above still works.
// Line-based, because the two fallback lines each mention alert twice - "typeof alert === 'function'"
// and then the call itself - so counting occurrences would flag the very lines that are meant to stay.
var APP_LINES = readFile('app.js').split('\n');
var callSites = APP_LINES.filter(function (line) {
    var body = line.trim();
    if (body.indexOf('//') === 0 || body.indexOf('*') === 0) return false;   // comments
    if (body.indexOf('typeof alert') !== -1) return false;                    // the documented fallback
    return /[^.\w]alert\(/.test(line);
});
ck('no alert() call sites outside the documented fallback', callSites.join(' | '), '');
var confirmSites = APP_LINES.filter(function (line) {
    var body = line.trim();
    if (body.indexOf('//') === 0 || body.indexOf('*') === 0) return false;
    if (body.indexOf('typeof confirm') !== -1) return false;
    return /[^.\w]confirm\(/.test(line) && body.indexOf('askConfirm(') === -1
        && body.indexOf('closeConfirm(') === -1;
});
ck('and no confirm() call sites either', confirmSites.join(' | '), '');
ok('there is a toast host to replace them', /id="toast-host"/.test(HTML));
ok('and a modal to replace confirm()', /id="modal-scrim"/.test(HTML));
ok('the modal announces itself as one', /id="modal-card"[^>]*role="alertdialog"/.test(HTML));
// aria-modal is a claim that the rest of the page is unreachable, so it is set when the dialog opens
// and removed when it closes. Standing in the static markup it was a claim about a dialog that was not
// there, which some screen readers honour by treating the whole page as inert.
no('the markup does not stand as modal while closed', /id="modal-card"[^>]*aria-modal/.test(HTML));
ok('the dialog claims it when it opens', /scrim\.classList\.remove\('hidden'\);[\s\S]{0,800}?setAttribute\('aria-modal', 'true'\)/.test(appSrc));
ok('and withdraws it when it closes', /scrim\.classList\.add\('hidden'\);[\s\S]{0,120}?removeAttribute\('aria-modal'\)/.test(appSrc));
// Cancel before Continue in the DOM: it is the first tab stop and the safer answer to a hurried
// Return, and every one of these guards something that cannot be got back.
ok('cancel comes before continue', HTML.indexOf('id="modal-cancel"') < HTML.indexOf('id="modal-confirm"'));

print('\n15. Installable and offline');
ok('the page links a manifest', /rel="manifest"/.test(HTML));
ok('and declares a theme colour', /name="theme-color"/.test(HTML));
ok('and carries a description for the install card', /name="description"/.test(HTML));
var SW = readFile('sw.js');
ok('the worker versions its cache', /const CACHE_NAME = `stitch-math-\$\{VERSION\}`/.test(SW));
// Matched without the quote, because these entries are template literals carrying ?v=${VERSION} now.
ok('and precaches every script index.html loads',
   ['style.css', 'validator.js', 'analytics.js', 'persistence.js', 'app.js']
     .every(function (f) { return SW.indexOf('./' + f + '?v=') !== -1; }));
// The page is the manifest that names every other file, so a stale one is how a browser ends up
// running yesterday's HTML against today's scripts.
ok('the page itself is fetched network-first', /request\.mode === 'navigate'/.test(SW));
ok('and other origins are left alone', /url\.origin !== self\.location\.origin/.test(SW));

// Reported from the field on 2 Sep: edits to app.js were not showing up, and a bug fixed days earlier
// was still reproducing. The worker was answering from the cache and revalidating behind - correct for
// a hashed name, wrong for every name in the source tree, where nothing is hashed and the ?v= stamp
// never moves. The rule the fix rests on is that only a build output may be answered from the cache.
ok('a content-hashed asset is the only thing answered cache-first',
   /IMMUTABLE\.test\(url\.pathname \+ url\.search\)[\s\S]{0,240}?caches\.match\(request\)\.then\(hit => hit \|\| fetchAndCache/.test(SW));
ok('and the shape it matches is the one build.js emits',
   /const IMMUTABLE = \/\\\.\[0-9a-f\]\{8\}\\\.\(\?:js\|css\)/.test(SW));
ok('everything else goes to the network first',
   /fetchAndCache\(request\)\.catch\(\(\) => caches\.match\(request\)\)/.test(SW));
no('nothing is served stale and revalidated behind the reader any more',
   /return hit \|\| network;/.test(SW));
// The names in the source tree must NOT look immutable, or the rule above would cache them too.
ok('no source filename looks like a build output',
   ['style.css', 'validator.js', 'analytics.js', 'persistence.js', 'pdf.js', 'app.js']
     .every(function (f) { return !/\.[0-9a-f]{8}\./.test(f); }));
// And a real build output must, or the fast path silently stops being fast.
ok('a build output does', /\.[0-9a-f]{8}\.(js|css)$/.test('app.5f6a701e.js'));

print('\n16. About panel');
nav('nav-settings');
ok('it is on the Settings view', shown('about-panel'));
ok('the privacy claim is the first thing in it', /about-privacy/.test(HTML));
ok('it names where the measurements came from', /Craft Yarn Council/.test(HTML));
ok('and carries a licence', /All rights reserved/.test(HTML));
ck('the build number is set from the one constant', $('about-version').text(), $('app-version').text());

print('\n17. One version, and nothing allowed to drift from it');
// Cache-busting without a build step means the version is written in three files. That is a footgun
// exactly until something checks it, which is what this is: forget one and CI fails, rather than a
// returning browser quietly serving yesterday's app.js beside today's style.css.
var VERSION = (readFile('app.js').match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok('app.js declares a version', !!VERSION);
ck('sw.js is on the same version', (readFile('sw.js').match(/const VERSION = '([^']+)'/) || [])[1], VERSION);
var stamped = readFile('index.html').match(/(?:src|href)="[^"]+\?v=([^"]+)"/g) || [];
ok('index.html stamps its assets', stamped.length >= 4);
ok('and every stamp is that same version',
   stamped.every(function (tag) { return tag.indexOf('?v=' + VERSION + '"') !== -1; }));

print('\n18. tests.js does not ship');
// 22KB a customer never runs, plus window.RunMathTests on their global object. Loaded at run time on
// a dev origin instead, so the console harness survives without being in the page everyone downloads.
no('no static script tag for it', /<script src="tests\.js/.test(HTML));
ok('but a dev-only loader adds it back', /function loadDevOnlyScripts/.test(readFile('app.js')));
ok('gated on a dev origin, erring the safe way',
   /host === 'localhost'/.test(readFile('app.js')) && /protocol === 'file:'/.test(readFile('app.js')));
// The worker precaches what index.html actually asks for. A bare './app.js' entry would never answer
// a request for './app.js?v=1.0.0' - the cache would sit unused and every load would hit the network.
ok('the worker precaches the stamped urls', /\.\/app\.js\?v=\$\{VERSION\}/.test(readFile('sw.js')));
no('and does not precache tests.js', /'\.\/tests\.js'/.test(readFile('sw.js')));

endSuite();
