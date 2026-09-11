/**
 * The stitch cabinet - progress.collection, as something you can look at.
 *
 * The data was always there and always counted; it rendered as a single progress bar, which is a
 * score rather than a collection. The pull comes from seeing the holes, so every stitch the roll can
 * ask for gets a card whether it has been worked or not.
 *
 * The compatibility rule this suite pins: the store used to write `collection[token] = true` and now
 * writes the date. Any truthy value still reads as collected, so a browser that has been earning
 * stitches for months does not lose them - the same additive rule readProgress follows everywhere,
 * and no migration.
 */
boot();

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
function today() { return new Date().toISOString().slice(0, 10); }
function openCabinet() { nav('nav-dashboard'); nav('nav-patterns'); }

/** The cards actually in the grid. getElementById cannot answer this - the stub conjures an element
 *  for any id it has never seen - so the grid is walked instead. */
function cards() {
    return ($('cabinet-grid').children || []).map(function (card) {
        return { id: String(card.id).replace('cabinet-', ''), className: card.className };
    });
}
function card(token) {
    return cards().filter(function (entry) { return entry.id === token; })[0] || null;
}

/** The roll pool, which is what the cabinet is a picture of: the analytics complexity table
 *  intersected with the engine's stitch dictionary, minus the tokens nobody sets out to work. */
function pool() {
    var scores = window.CrochetAnalyticsEngine.STITCH_COMPLEXITY_SCORES || {};
    var primitives = window.CrochetMathEngine.STITCH_PRIMITIVES || {};
    var skip = ['ch', 'yo', 'repeat', 'rep', 'magicring'];
    return Object.keys(scores).filter(function (token) {
        return skip.indexOf(token) === -1 && primitives[token];
    }).sort();
}

var POOL = pool();

print('\n1. Every stitch the roll can ask for has a card');
resetProgress();
openCabinet();
ok('the pool is not empty', POOL.length > 0);
ck('one card each, and no orphans', cards().length, POOL.length);
POOL.forEach(function (token) {
    ok(token + ' is on the shelf', !!card(token));
});
// The count is read off the same pool the cards are built from, so the two cannot disagree.
ck('the count matches the pool', $('cabinet-count').textContent, '0 of ' + POOL.length + ' stitches worked');

print('\n2. Locked and unlocked are distinguishable');
POOL.forEach(function (token) {
    ck(token + ' starts locked', card(token).className.indexOf('is-locked') >= 0, true);
});
ok('a locked card says only that something is missing',
   /Not worked yet/.test($('cabinet-grid').text()));

print('\n3. Working a stitch moves it, and moves the count with it');
resetProgress();
// Through the app's own control: the practice panel's "I've worked this" is the path that credits a
// stitch without a pattern, which is exactly the case the cabinet exists to make visible.
nav('nav-practice');
var got = progress().roll.stitch;
$('roll-worked').fire('click');
openCabinet();
ck(got + ' is unlocked', card(got).className.indexOf('is-open') >= 0, true);
no('and no longer locked', card(got).className.indexOf('is-locked') >= 0);
ck('the count moved with it', $('cabinet-count').textContent, '1 of ' + POOL.length + ' stitches worked');
ok('the card names the stitch', $('cabinet-grid').text().indexOf(got) >= 0);

print('\n4. The date it was first worked is stored, and shown');
ck('the store keeps the day rather than a flag', progress().collection[got], today());
ok('and the card says when', /First worked \d{4}-\d{2}-\d{2}/.test($('cabinet-grid').text()));

print('\n5. First worked means FIRST - a later day does not overwrite it');
seedProgress({ collection: (function () {
    var c = {}; c[got] = '2020-01-01'; return c;
})() });
nav('nav-practice');
seedProgress({ practice: { date: today(), rowId: 'ring-six', answered: false, given: 0, correct: false, met: false },
               roll: { date: today(), stitch: got, rerolls: 0, claimed: false, isNew: false } });
nav('nav-dashboard');
nav('nav-practice');
$('roll-worked').fire('click');
ck('the original date stands', progress().collection[got], '2020-01-01');

print('\n6. AN OLDER STORE STILL READS AS COLLECTED');
// The whole compatibility claim. `true` is what the store wrote before the cabinet existed.
resetProgress();
var legacy = {};
legacy[POOL[0]] = true;
legacy[POOL[1]] = true;
seedProgress({ collection: legacy });
openCabinet();
ck(POOL[0] + ' from an old store is unlocked', card(POOL[0]).className.indexOf('is-open') >= 0, true);
ck(POOL[1] + ' too', card(POOL[1]).className.indexOf('is-open') >= 0, true);
ck('and both are counted', $('cabinet-count').textContent, '2 of ' + POOL.length + ' stitches worked');
// No date to show, and none invented. A stitch collected before the store kept dates has no day, and
// making one up would be inventing a fact about somebody's history.
no('no date is invented for it', /First worked true/.test($('cabinet-grid').text()));

print('\n7. It lives beside the Stitch Library, which is the same subject');
var HTML = readFile('index.html');
ok('the cabinet is a panel on the Patterns view',
   /cabinet-panel/.test(SRC.slice(SRC.indexOf('patterns:  ['), SRC.indexOf('studio:    ['))));
ok('and sits next to the stitch reference in the markup',
   HTML.indexOf('id="cabinet-panel"') > HTML.indexOf('id="stitch-usage-panel"'));
ok('the panel is inside the practice-mode gate',
   /'cabinet-panel'/.test(SRC.slice(SRC.indexOf('const PRACTICE_SURFACES'), SRC.indexOf('const PRACTICE_SURFACES') + 400)));

endSuite();
