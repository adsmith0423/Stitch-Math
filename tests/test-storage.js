// localStorage is the only store this app has, and every other suite exercises it on a browser that is
// behaving. This one is about the browser that is not.
//
// Two failures, both real and neither rare: a value that will not parse (hand edited, or a write cut short
// when the quota ran out mid-string), and a write refused outright by Safari private mode or a full quota.
// Before the guard the first took the whole page down - getLocalStorage runs inside init(), so an exception
// there meant a blank screen and no way back short of clearing storage by hand - and the second was silent,
// which is worse for a save: the confirmation never appeared, but neither did anything else.
//
// The store is reached here through localStorage directly, as test-shell does, because app.js is one IIFE
// with no exports.

function said() { return ALERTS.length ? String(ALERTS[ALERTS.length - 1]) : ''; }
// Deliberately unguarded: sections 2-4 assert on what is really in storage, and a parse error there is a
// genuine failure rather than something to paper over.
function saves() { return JSON.parse(localStorage.getItem('stitchmath_saves') || '{}'); }
// How many projects the user can actually see, less the "-- Load a Pattern --" option.
function listed() { return Math.max(0, $('load-select').children.length - 1); }

// Every key the app reads at start-up, each damaged a different way. They have to be in place BEFORE
// boot(), because init() is the reader being tested.
localStorage.setItem('stitchmath_saves', '{"half-written":');   // truncated JSON
localStorage.setItem('stitchmath_progress', 'null');            // parses, but is not an object
localStorage.setItem('stitchmath_custom_stitches', '[1,2,3]');  // an array, not a map
localStorage.setItem('stitchmath_colors', '7');                 // a number
localStorage.setItem('stitchmath_view_prefs', '{oops}');        // not JSON at all

print('\n1. A damaged store costs the key, not the page');
var threw = '';
try { boot(); } catch (e) { threw = String(e); }
ck('init() raises nothing', threw, '');
// The load-bearing one: an exception inside init() stops the wiring, so the app looks present and does
// nothing at all. Asserting only "raises nothing" would miss a page that came up dead.
ok('and the page wired itself up', ($('save-btn').listeners.click || []).length > 0);

threw = '';
try {
    $('bulk-input').value = 'Ch 6\nRow 1: sc in each ch across. (6)';
    $('bulk-parse-btn').fire('click');
} catch (e) { threw = String(e); }
ck('compiling against it raises nothing either', threw, '');
ok('and the pattern was counted', $('step-sequence-body').children.length > 0);
// Read off the dropdown rather than out of storage: the damaged value is still sitting there untouched -
// the guard tolerates it, it does not repair it - and what matters is that the user is shown an empty list
// instead of half a parse.
ck('the unreadable save list is offered as no projects, not half a list', listed(), 0);

print('\n2. A refused write is reported, not swallowed');
var realSet = localStorage.setItem;
// A store worth saving over: an empty save list, and a balance to watch.
localStorage.setItem('stitchmath_saves', '{}');
localStorage.setItem('stitchmath_progress', JSON.stringify({ version: 5, points: 500 }));
// Now fill its mouth.
localStorage.setItem = function () { throw new Error('QuotaExceededError'); };

ALERTS.length = 0;
$('project-name').value = 'Refused Cardigan';
threw = '';
try { $('save-btn').fire('click'); } catch (e) { threw = String(e); }

ck('saving raises nothing', threw, '');
ok('and it says so', /Could not save/.test(said()));
ok('naming the project', /Refused Cardigan/.test(said()));
ok('and pointing at a way out', /Save as Text/.test(said()));
ok('it never claims the file was saved', !/" saved\.|" updated\./.test(said()));

localStorage.setItem = realSet;
ck('no points were paid for a file that is not there',
   JSON.parse(localStorage.getItem('stitchmath_progress')).points, 500);
ck('and nothing was written', Object.keys(saves()).length, 0);

print('\n3. With storage working, the same save goes through');
ALERTS.length = 0;
$('project-name').value = 'Real Cardigan';
$('save-btn').fire('click');
ok('it says saved', /Real Cardigan" saved\./.test(said()));
ok('and the file is in the store',
   Object.prototype.hasOwnProperty.call(saves(), 'Real Cardigan'));

print('\n4. A refused delete says so instead of looking like a broken dropdown');
// updateLoadDropdown reads storage back, so a refused delete leaves the name in the list and reads as the
// dropdown being broken rather than the write being refused.
$('load-select').value = 'Real Cardigan';
localStorage.setItem = function () { throw new Error('QuotaExceededError'); };
ALERTS.length = 0;
threw = '';
try { $('delete-project-btn').fire('click'); } catch (e) { threw = String(e); }
localStorage.setItem = realSet;
ck('deleting raises nothing', threw, '');
ok('and it says the delete did not happen', /Could not delete/.test(said()));
ok('the project is still there, as the message implies',
   Object.prototype.hasOwnProperty.call(saves(), 'Real Cardigan'));

endSuite();
