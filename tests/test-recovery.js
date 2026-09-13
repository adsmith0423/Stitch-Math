// Start-up recovery and the recover panel.
//
// Recovery never blocks, never reorders boot and never applies itself. It is an offer, and it is made
// only when the page has nothing newer on it. The panel is a fire escape, not an archive: the wording
// is asserted here because it is the one place the app could imply that five slots in a store the
// browser may clear are somewhere to keep work.
//
// The panel has no button of its own any more - it is on screen the whole time Project Management is,
// and it redraws itself whenever the ring takes a point. So "is there an offer" is read off the text
// rather than off a hidden class, which is what the class used to stand for.

// Both runners have to report the same counts, and they disagree about timers: the Node context has
// no setTimeout at all, so test-stub.js supplies a synchronous one, while JavaScriptCore's shell has a
// real asynchronous one and the debounce would never fire before the suite ended. Pin it here rather
// than in the shared stub, which would change how the other suites behave under jsc.
//
// Firing inline is also the harshest reading of the design: every keystroke below runs a whole flush.
setTimeout = function (fn) { fn(); return 0; };
clearTimeout = function () {};

var P = window.StitchPersistence;

function panelText() { return $('recover-panel').text(); }
// The offer row carries its own Restore button; the ring is one dropdown with one button beside it.
function restoreButtons() {
    return $('recover-panel').children.filter(function (row) {
        return row.children.some(function (c) { return c.tagName === 'BUTTON'; });
    });
}
function recoveryOptions() {
    var pick = $('recover-panel').children.filter(function (row) { return row.className === 'recover-pick'; })[0];
    if (!pick) return [];
    var select = pick.children.filter(function (c) { return c.tagName === 'SELECT'; })[0];
    return select ? select.children : [];
}
function said() { return ALERTS.length ? String(ALERTS[ALERTS.length - 1]) : ''; }
// An offer is the start-up row, not the ring below it. Read off the two sentences only that row says.
function offered() { return /closed unexpectedly|Unsaved work/.test(panelText()); }

print('\n1. The controls are in the markup');
var HTML = readFile('index.html');
ok('the panel exists', /id="recover-panel"/.test(HTML));
ok('and it does not start hidden', /id="recover-panel" class="recover-panel">/.test(HTML));
no('there is no button to open it with', /id="recover-btn"/.test(HTML));
// Outside .project-status, so it gets the panel's whole width instead of wrapping under the save
// line. Read as "the save line closes before the panel opens", which is what being a sibling means.
ok('it is a row of its own, not part of the save line',
   HTML.indexOf('</div>', HTML.indexOf('id="save-status"')) < HTML.indexOf('id="recover-panel"'));
ck('still no inline styles in the markup', (HTML.match(/style="/g) || []).length, 0);
var CSS = readFile('style.css');
ok('the panel is styled in the stylesheet', /\.recover-panel \{/.test(CSS));
// A control written into innerHTML cannot be found by getElementById, so it would work in a browser
// and silently do nothing here. The panel says so in the markup; check the code really does build it.
var src = readFile('app.js');
var render = src.slice(src.indexOf('function renderRecoverPanel'), src.indexOf('function restoreSnapshot'));
no('the panel is not built out of assigned markup', /innerHTML/.test(render));
ok('it is built with the element helper', /elem\(/.test(render));

print('\n2. A fresh browser draws the panel and offers nothing in it');
var first = P.memoryAdapter();
window.STITCH_ADAPTER = first;
boot();
ok('the panel is on screen from boot', !$('recover-panel').classList.contains('hidden'));
ok('and it drew itself', panelText().indexOf('Recent recovery points') >= 0);
no('with nothing to offer', offered());
ok('and nothing to restore', restoreButtons().length === 0 && recoveryOptions().length === 0);

print('\n3. Work done in one session is offered in the next');
$('project-name').value = 'Kingbird Cardigan';
$('bulk-input').value = 'Ch 6\nRow 1: sc in each ch across. (6)';
$('bulk-input').fire('input');
// A new session on the same store: the page is blank again, the store is not.
$('bulk-input').value = '';
boot();
ok('the offer is made', offered());
ok('it names the project', panelText().indexOf('Kingbird Cardigan') >= 0);
ok('and says when', /just now|m ago|h ago|d ago/.test(panelText()));

print('\n4. It is an offer, not a load');
// A page that rewrites itself on boot is worse than one that forgets: the designer may have arrived to
// do something else entirely.
ck('the pattern box is still empty', $('bulk-input').value, '');
// One Restore in the panel, never two. The offer used to carry its own above the dropdown, which put
// the smaller and more dangerous choice in the wider button.
ck('there is exactly one Restore button to press', restoreButtons().length, 1);
ok('and the offer is the entry it is pointing at',
   recoveryOptions()[0].textContent.indexOf('Unsaved work from your last session') === 0);
ck('preselected, so the button does what the removed one did', $('recover-select').value, 'offer');

print('\n5. Pressing it brings the work back');
$('recover-restore-btn').fire('click');
ck('the pattern is on the page', $('bulk-input').value.indexOf('Ch 6'), 0);
ck('and so is its name', $('project-name').value, 'Kingbird Cardigan');

print('\n6. An unclean exit changes the wording, not the behaviour');
// The session token is still set from the boot above, which never cleared it.
ck('the token is set while a session is open', localStorage.getItem('stitchmath_session'), 'open');
$('bulk-input').value = '';
boot();
ok('the offer says the app closed unexpectedly', panelText().indexOf('closed unexpectedly') >= 0);
ok('but it is still only an offer', $('bulk-input').value === '');

print('\n7. A page with work on it is not offered an older copy');
// The recovered copy is older than what is on screen. The ring is still one button away, and restoring
// from it snapshots first anyway.
$('bulk-input').value = 'Ch 30\nRow 1: sc in each ch across. (30)';
boot();
no('no offer over the top of live work', offered());
ck('and nothing on the page moved', $('bulk-input').value.indexOf('Ch 30'), 0);

print('\n8. An offer draws itself into the panel unasked');
$('bulk-input').value = '';
boot();
ok('there is something to see, so it is said', offered());

print('\n9. The panel is headed for what it holds');
// Not "history" and not "versions". Five slots in a store a browser may clear at any moment, that do
// not travel between machines and do not survive a cleared profile.
ok('the heading names recovery points', panelText().indexOf('Recent recovery points') >= 0);
no('it is not called a history', /histor/i.test(panelText()));
ok('and it says outright that they are temporary',
   panelText().indexOf('Recovery points are temporary. Use Export Project to keep a copy you own.') >= 0);

print('\n10. The empty state says the same thing');
var bare = P.memoryAdapter();
window.STITCH_ADAPTER = bare;
localStorage.setItem('stitchmath_current_project', '');
boot();
$('project-name').value = 'Nothing Here';
ok('the empty panel points at the copy the designer owns',
   panelText().indexOf('Recovery points are temporary. Use Export Project to keep a copy you own.') >= 0);
ok('and offers nothing to restore', restoreButtons().length === 0 && recoveryOptions().length === 0);

print('\n11. Snapshots are named for what they were');
var listing = P.memoryAdapter();
window.STITCH_ADAPTER = listing;
boot();
$('project-name').value = 'Ringed';
$('bulk-input').value = 'Ch 6\nRow 1: sc in each ch across. (6)';
$('bulk-input').fire('input');
ok('an autosave is listed as one, without anyone asking', panelText().indexOf('autosaved') >= 0);
ok('and offers a restore', recoveryOptions().length >= 1 && restoreButtons().length === 1);
ok('with the time on the entry', /\d/.test(recoveryOptions()[0].textContent));
$('save-btn').fire('click');
ok('an explicit save is listed as a save', /\bsaved\b/.test(panelText()));

print('\n12. Restoring a recovery point is itself recoverable');
// The copy of what is on screen now is durably written before the snapshot is even read.
var replaced = 'Ch 40\nRow 1: sc in each ch across. (40)';
$('bulk-input').value = replaced;
$('bulk-input').fire('input');
$('recover-restore-btn').fire('click');
ck('the earlier work is back', $('bulk-input').value.indexOf('Ch 6'), 0);
ok('and what it replaced was kept', panelText().indexOf('before a restore') >= 0);

print('\n13. Snapshots of the same page fold into one row');
// Five autosaves of one unchanged page are five recovery points that restore the same thing. The
// panel offers that once, as its newest, so a Restore button always means a different page.
var folded = P.memoryAdapter();
window.STITCH_ADAPTER = folded;
boot();
$('project-name').value = 'Folded';
$('bulk-input').value = 'Ch 8\nRow 1: sc in each ch across. (8)';
$('bulk-input').fire('input');
$('save-btn').fire('click');
$('save-btn').fire('click');
$('save-btn').fire('click');
ck('three saves of one page are one entry', recoveryOptions().length, 1);
ck('and there is one Restore button, not one per entry', restoreButtons().length, 1);
// A different page is a different digest, which is what makes it a second row. Asserted on the
// fingerprint rather than by saving again: every boot() above re-registers the Save handler on the
// same stub element, so one click here writes several snapshots and floods the five-slot ring.
ok('the store fingerprints each snapshot', typeof P.digestOf === 'function' && P.digestOf({ a: 1 }) !== P.digestOf({ a: 2 }));


print('\n13. A recovery record this build cannot read costs the record, not the page');
// The same trade getLocalStorage makes at the top of section 5: one damaged key is worth what is in
// that key, never the whole app.
var damaged = P.memoryAdapter();
damaged.put('current', {
    projectId: 'project_damaged', savedAt: Date.now(),
    envelope: { kind: 'stitch-math-project', fileVersion: 99, projectName: 'Damaged', body: {} }
}, function () {});
window.STITCH_ADAPTER = damaged;
localStorage.setItem('stitchmath_current_project', 'project_damaged');
$('bulk-input').value = '';
var raised = '';
try { boot(); } catch (e) { raised = String(e); }
ck('boot raises nothing', raised, '');
ok('the page wired itself up', ($('save-btn').listeners.click || []).length > 0);
no('nothing was offered', offered());
ck('and the line says the record is unreadable', $('save-status').textContent, 'Recovery record unreadable');

print('\n14. A store that throws on read does the same');
var hostile = P.memoryAdapter();
hostile.get = function () { throw new Error('gone'); };
window.STITCH_ADAPTER = hostile;
var alsoRaised = '';
try { boot(); } catch (e) { alsoRaised = String(e); }
ck('boot raises nothing', alsoRaised, '');
ok('and the page still works', ($('bulk-parse-btn').listeners.click || []).length > 0);

print('\n15. With no store at all, boot is what it always was');
window.STITCH_ADAPTER = null;
localStorage.setItem('stitchmath_current_project', 'project_kingbird-cardigan');
var noStore = '';
try { boot(); } catch (e) { noStore = String(e); }
ck('boot raises nothing', noStore, '');
no('nothing is offered', offered());
ok('and the panel is honest about having nothing',
   panelText().indexOf('Recovery points are temporary') >= 0);

print('\n16. Opening a saved project refreshes its recovery record');
// The one migration V1 ships, and it runs against every save already in every user's browser.
var loading = P.memoryAdapter();
window.STITCH_ADAPTER = loading;
boot();
localStorage.setItem('stitchmath_saves', JSON.stringify({
    'An old file': { rawText: 'Ch 8\nRow 1: sc in each ch across. (8)' }
}));
$('load-select').value = 'An old file';
$('load-btn').fire('click');
var record = null;
loading.get('current', P.projectIdFor('An old file'), function (r) { record = r.value; });
ok('a recovery record now exists for it', !!record);
ck('as a current-format envelope', record.envelope.fileVersion, 1);
ck('holding the pattern from the unversioned save', record.envelope.body.rawText.indexOf('Ch 8'), 0);

print('\n17. A saved record from a newer build is refused, not half-loaded');
localStorage.setItem('stitchmath_saves', JSON.stringify({
    'From the future': { version: 9, rawText: 'Ch 99\nRow 1: sc in each ch across. (99)' }
}));
$('project-name').value = 'Still Mine';
$('bulk-input').value = 'Ch 5\nRow 1: sc in each ch across. (5)';
$('bulk-input').fire('input');
var mine = $('bulk-input').value;
$('load-select').value = 'From the future';
$('load-btn').fire('click');
ok('the designer is told', said().indexOf('newer version of Stitch Math') >= 0);
ck('and the open project is untouched', $('bulk-input').value, mine);
ck('down to its name', $('project-name').value, 'Still Mine');

endSuite();
