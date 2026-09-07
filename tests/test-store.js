// The store: the retention rule, the callback contract, and the fallback a browser without IndexedDB
// actually runs on.
//
// There is no indexedDB in this context, which is the point of the split. Everything that decides
// anything - what is kept, what is refused, when a callback fires - lives above the adapter, so it is
// all exercised here against the memory adapter that a real browser also falls back to. The IndexedDB
// body underneath is a translation of these same calls and holds no rule of its own.

var P = window.StitchPersistence;

function env(name, savedAt, text) {
    return P.buildEnvelope({ projectName: name, savedAt: savedAt, body: { rawText: text || 'Ch 6' } });
}
// Every callback here is synchronous under the memory adapter, but nothing below assumes that: each
// records what it was given and the assertion reads the recording afterwards.
function catcher() {
    var box = { calls: 0, last: null };
    box.cb = function (result) { box.calls++; box.last = result; };
    return box;
}

print('\n1. prunePlan is a pure rule, not a store operation');
// The cursor that enacts it only ever runs against a real IndexedDB, which no test can reach. The
// decision is separated out precisely so the rule is still covered.
var seven = [];
for (var i = 1; i <= 7; i++) seven.push({ id: i, savedAt: 1000 + i });
var plan = P.prunePlan(seven, 5);
ck('five kept', plan.keep.length, 5);
ck('two dropped', plan.drop.length, 2);
ck('the newest survive', plan.keep.join(','), '7,6,5,4,3');
ck('the oldest go', plan.drop.join(','), '2,1');
ck('under the limit, nothing is dropped', P.prunePlan(seven.slice(0, 3), 5).drop.length, 0);
ck('exactly at the limit, nothing is dropped', P.prunePlan(seven.slice(0, 5), 5).drop.length, 0);
ck('nothing at all is not an error', P.prunePlan([], 5).keep.length, 0);
ck('nor is junk', P.prunePlan(null, 5).keep.length, 0);
ck('the default limit is five', P.prunePlan(seven).keep.length, 5);

print('\n2. The tie-break is deterministic');
// Under the stub setTimeout fires instantly, so several snapshots written in one tick share a
// millisecond. Sorting on time alone would leave which five survive up to sort stability, and the two
// runners this project requires to agree would be free to disagree.
var tied = [{ id: 1, savedAt: 500 }, { id: 2, savedAt: 500 }, { id: 3, savedAt: 500 },
            { id: 4, savedAt: 500 }, { id: 5, savedAt: 500 }, { id: 6, savedAt: 500 }];
var tiePlan = P.prunePlan(tied, 5);
ck('the highest ids win', tiePlan.keep.join(','), '6,5,4,3,2');
ck('and the lowest is dropped', tiePlan.drop.join(','), '1');
ck('the same answer every time', P.prunePlan(tied.slice().reverse(), 5).keep.join(','), '6,5,4,3,2');
// A record with no usable time sorts oldest rather than throwing the comparison.
ck('an undated row sorts last', P.prunePlan([{ id: 1, savedAt: 5 }, { id: 2 }], 1).keep.join(','), '1');

print('\n3. With no IndexedDB, the store falls back and says so');
// This is not a test-only path: it is what a browser with storage disabled runs on, and losing
// everything on reload is the right answer there - it is what localStorage already offers.
var probed = P.createStore(null);
var landed = catcher();
probed.saveCurrent(env('Fallback', 1000), landed.cb);
ok('the write still lands', landed.last.ok);
ck('on the memory adapter', probed.adapterName(), 'memory');
ck('and the store reports why', probed.unavailable().code, 'store-unavailable');
ok('with a sentence naming what is not happening',
   probed.unavailable().message.indexOf('nothing is being recorded') >= 0);

print('\n4. Round trip through the current record');
var store = P.createStore(P.memoryAdapter());
ck('an explicit adapter is used as given', store.adapterName(), 'memory');
ck('and reports no problem', String(store.unavailable()), 'null');
var saved = env('Kingbird Cardigan', 1755900000000, 'Ch 6\nRow 1: sc in each ch across. (6)');
var write = catcher();
store.saveCurrent(saved, write.cb);
ok('the save reports success', write.last.ok);
var read = catcher();
store.loadCurrent(saved.projectId, read.cb);
ok('the record reads back', read.last.ok);
ck('with its text', read.last.value.body.rawText.indexOf('Ch 6'), 0);
ck('and its name', read.last.value.projectName, 'Kingbird Cardigan');

print('\n5. A project with no record is an empty answer, not a failure');
// Every first visit takes this path, so it must not read as something going wrong.
var absent = catcher();
store.loadCurrent('project_never-saved', absent.cb);
ok('the read succeeds', absent.last.ok);
ck('with nothing in it', String(absent.last.value), 'null');

print('\n6. One project, one current record');
store.saveCurrent(env('Kingbird Cardigan', 1755900001000, 'Ch 8'), function () {});
var again = catcher();
store.loadCurrent(saved.projectId, again.cb);
ck('the second write replaced the first', again.last.value.body.rawText, 'Ch 8');

print('\n7. What is stored is a copy');
// The adapter clones on the way in and out, as IndexedDB does. Without it a caller holding what it
// saved could edit the store through it, and the recovery copy would silently track the live page.
var live = env('Mutable', 2000, 'original');
store.saveCurrent(live, function () {});
live.body.rawText = 'changed after saving';
var stable = catcher();
store.loadCurrent(live.projectId, stable.cb);
ck('editing the envelope afterwards does not reach the store', stable.last.value.body.rawText, 'original');

print('\n8. Snapshots: the ring holds five');
var ring = P.createStore(P.memoryAdapter());
var project = env('Ringed', 1000);
for (var n = 0; n < 7; n++) ring.snapshot(env('Ringed', 1000 + n, 'row ' + n), 'auto-save', function () {});
var listed = catcher();
ring.listSnapshots(project.projectId, listed.cb);
ck('exactly five survive', listed.last.value.length, 5);
ck('newest first', listed.last.value[0].savedAt, 1006);
ck('down to the oldest kept', listed.last.value[4].savedAt, 1002);
ck('each carries its reason', listed.last.value[0].reason, 'auto-save');
// Summaries, not envelopes: the panel needs a time and a label, and five envelopes is a lot of pattern
// text to hold for two lines of UI.
ck('the list is summaries only', Object.keys(listed.last.value[0]).sort().join(','), 'id,reason,savedAt');

print('\n9. Seven written in one tick still leave a determinate five');
var tick = P.createStore(P.memoryAdapter());
for (var t = 0; t < 7; t++) tick.snapshot(env('Tick', 5000, 'row ' + t), 'auto-save', function () {});
var sameMs = catcher();
tick.listSnapshots(P.projectIdFor('Tick'), sameMs.cb);
ck('five of the seven', sameMs.last.value.length, 5);
ck('and it is the last five written', sameMs.last.value.map(function (s) { return s.id; }).join(','), '7,6,5,4,3');

print('\n10. The envelope comes back whole');
var fetched = catcher();
ring.getSnapshot(listed.last.value[0].id, fetched.cb);
ok('a snapshot reads back', fetched.last.ok);
ck('with the pattern that was in it', fetched.last.value.body.rawText, 'row 6');
ok('and it still validates', P.validate(fetched.last.value).ok);
var missing = catcher();
ring.getSnapshot(9999, missing.cb);
ok('an id that is not there is not a failure', missing.last.ok);
ck('it is simply empty', String(missing.last.value), 'null');

print('\n11. Projects do not evict each other');
// The index is keyed on [projectId, savedAt], so one project churning must not cost another its ring.
var shared = P.createStore(P.memoryAdapter());
shared.snapshot(env('Keeper', 100), 'manual-save', function () {});
for (var b = 0; b < 6; b++) shared.snapshot(env('Busy', 200 + b), 'auto-save', function () {});
var keeper = catcher();
shared.listSnapshots(P.projectIdFor('Keeper'), keeper.cb);
ck('the quiet project keeps its one snapshot', keeper.last.value.length, 1);
var busy = catcher();
shared.listSnapshots(P.projectIdFor('Busy'), busy.cb);
ck('the busy one is capped at five', busy.last.value.length, 5);

print('\n12. A snapshot reason is checked, not trusted');
// It is the only label the recover panel has. A typo would store fine and show up, much later, as a
// blank row nobody can explain.
var typo = catcher();
shared.snapshot(env('Keeper', 300), 'pre-inport', typo.cb);
no('an unrecognised reason is refused', typo.last.ok);
ck('as malformed', typo.last.error.code, 'malformed');
ok('naming the reason it was given', typo.last.error.message.indexOf('pre-inport') >= 0);
var stillOne = catcher();
shared.listSnapshots(P.projectIdFor('Keeper'), stillOne.cb);
ck('and nothing was written', stillOne.last.value.length, 1);
P.SNAPSHOT_REASONS.forEach(function (reason) {
    var accepted = catcher();
    shared.snapshot(env('Reasons', 400), reason, accepted.cb);
    ok('"' + reason + '" is accepted', accepted.last.ok);
});

print('\n13. The callback fires exactly once');
// Asserted directly rather than assumed: a callback fired twice double-counts a save, and one never
// fired hangs the status line on "Saving..." forever.
var chatty = P.memoryAdapter();
var realPut = chatty.put;
chatty.put = function (store, record, cb) { realPut.call(chatty, store, record, function (r) { cb(r); cb(r); cb(r); }); };
var noisy = P.createStore(chatty);
var counted = catcher();
noisy.saveCurrent(env('Chatty', 1), counted.cb);
ck('an adapter calling back three times still reports once', counted.calls, 1);
ok('and reports the truth', counted.last.ok);

print('\n14. The callback is optional');
// Autosave has nowhere to report but the status line, so it passes none.
var quiet = '';
try {
    var silent = P.createStore(P.memoryAdapter());
    silent.saveCurrent(env('Quiet', 1));
    silent.snapshot(env('Quiet', 1), 'auto-save');
    silent.loadCurrent(P.projectIdFor('Quiet'));
} catch (e) { quiet = String(e); }
ck('omitting it raises nothing', quiet, '');

print('\n15. An adapter that refuses is reported, not swallowed');
var broken = P.memoryAdapter();
broken.put = function (store, record, cb) { cb({ ok: false, error: { code: 'store-refused', message: 'quota' } }); };
var refusing = P.createStore(broken);
var told = catcher();
refusing.saveCurrent(env('Refused', 1), told.cb);
no('the save does not claim success', told.last.ok);
ck('the refusal reaches the caller', told.last.error.code, 'store-refused');
var thrower = P.memoryAdapter();
thrower.put = function () { throw new Error('gone'); };
var throwing = P.createStore(thrower);
var caught = catcher();
var raised = '';
try { throwing.saveCurrent(env('Thrown', 1), caught.cb); } catch (e) { raised = String(e); }
ck('an adapter that throws does not throw at the caller', raised, '');
ck('it comes back as a refusal', caught.last.error.code, 'store-refused');

print('\n16. clearProject takes the record and the whole ring');
var doomed = P.createStore(P.memoryAdapter());
doomed.saveCurrent(env('Doomed', 1), function () {});
for (var d = 0; d < 3; d++) doomed.snapshot(env('Doomed', 10 + d), 'auto-save', function () {});
var cleared = catcher();
doomed.clearProject(P.projectIdFor('Doomed'), cleared.cb);
ok('it reports success', cleared.last.ok);
ck('three snapshots removed', cleared.last.value, 3);
var goneRecord = catcher();
doomed.loadCurrent(P.projectIdFor('Doomed'), goneRecord.cb);
ck('the current record is gone', String(goneRecord.last.value), 'null');
var goneRing = catcher();
doomed.listSnapshots(P.projectIdFor('Doomed'), goneRing.cb);
ck('and so is the ring', goneRing.last.value.length, 0);
var nothingToClear = catcher();
doomed.clearProject(P.projectIdFor('Doomed'), nothingToClear.cb);
ok('clearing twice is not a failure', nothingToClear.last.ok);

print('\n17. idbAdapter can be built without a browser');
// It must never name indexedDB, IDBKeyRange or Blob as a bare identifier: this file is loaded into a
// context that has none of them, and a reference at load time would throw before any suite ran.
var built = '';
var fake = null;
try { fake = P.idbAdapter({ open: function () { return {}; } }, null); } catch (e) { built = String(e); }
ck('constructing it raises nothing', built, '');
ck('and it identifies itself', fake.name, 'idb');
var src = readFile('persistence.js');
// Guarded references only - `typeof x === 'undefined'` on the same line is the shape that is allowed.
// Comment lines are dropped first: the rule is about what the engine evaluates, and the header has to
// be free to explain why the rule exists.
function codeLines() {
    return src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); });
}
['indexedDB', 'IDBKeyRange'].forEach(function (name) {
    var lines = codeLines().filter(function (l) { return new RegExp('\\b' + name + '\\b').test(l); });
    ok(name + ' is named in the code at all', lines.length > 0);
    lines.forEach(function (l) {
        ok(name + ' is only named behind a typeof guard', /typeof\s+\w+\s*===?\s*'undefined'/.test(l));
    });
});
no('and Blob is not named at all', codeLines().some(function (l) { return /\bBlob\b/.test(l); }));

endSuite();
