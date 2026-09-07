boot();

var E = CrochetMathEngine;
function yieldOf(text) { return E.parseInstructions(text).totalYield; }
function unknownIn(text) { return E.parseInstructions(text).unknownTokens || []; }
function reads(text) { return unknownIn(text).length === 0; }

// Prose is the part of a written pattern that says what the hands do rather than what the hook makes.
// 53% of rows in the vintage corpus were blocked by it.
print('\n1. Each rule carries its reason');
ok('the table exists', E.NON_STITCH_PROSE.length > 0);
var undocumented = E.NON_STITCH_PROSE.filter(function (r) { return !r.name || !r.why || !r.re; });
ck('every rule is named and justified', undocumented.length, 0);

print('\n2. Prose alone produces nothing');
[
    'join',
    'join in 3rd st of ch',
    'join in sl st',
    'turn',
    'do not turn',
    'turn your work',
    'cut thread',
    'break thread',
    'break thread leaving an end',
    'fasten off',
    'weave in all loose ends',
    'thread over hook',
    'insert hook in next st',
    'insert your hook into the next stitch',
    'pull up a loop in the next stitch',
    'make sure not to twist your chain',
    'this counts as your first dc'
].forEach(function (t) {
    ck('"' + t.slice(0, 44) + '" yields nothing', yieldOf(t), 0);
});

print('\n3. Prose does not swallow the stitches around it');
// The point of the exercise: the row still has to count what it makes.
ck('sc survives a turn', yieldOf('ch 1, turn, sc in each st across'), yieldOf('ch 1, sc in each st across'));
ck('2 sc survive an increase note', yieldOf('work 2 sc in the same stitch to increase'), 2);
// A standing chain is three chains tall but stands in the place of ONE stitch, which is what "counts as a
// dc" says. It used to be counted as its three chains.
ck('the ch-3 counts as the one stitch it stands for', yieldOf('ch 3 (counts as a dc)'), 1);
ck('dc survives a fasten off', yieldOf('dc in next 5 sts, fasten off'), 5);
ck('clusters survive the prose that closes them',
   yieldOf('2 d c in next st keeping last loop of each d c on hook, thread over and work off all loops at one time'), 2);
ck('and the yarn-over prose alone adds none',
   yieldOf('thread over and pull through all loops at one time'), 0);

print('\n3b. Modern beginner phrasing');
// Beginner patterns explain rather than abbreviate, so they carry far more of this than the vintage books.
// These were drafted rather than sourced - the weakest evidence here, worth replacing with real samples.
[
    'Do not turn your work.',
    'Fasten off and weave in your ends.',
    'Weave in all loose ends.',
    'Yarn over and pull through both loops on your hook.',
    'Pull up a loop in the next stitch.',
    'Insert your hook into the next stitch.',
    'Place a stitch marker in the first stitch of the round.',
    'Continue working in a spiral; do not join.',
    'Make sure not to twist your chain.',
    'This counts as your first dc.'
].forEach(function (t) {
    ok('"' + t.slice(0, 40) + '" reads', reads(t));
    ck('   and makes nothing', yieldOf(t), 0);
});
// Prose wrapped around real work: the work has to survive.
ck('a chain before a turn is still a chain', yieldOf('Ch 1 and turn.'), 1);
ok('back-loops-only reads as a whole sentence', reads('Working in the back loops only, sc in each st across.'));
ck('and still counts the sc', yieldOf('Working in the back loops only, sc in each st across.'), 1);

print('\n3c. Punctuation left by a strip is not an unreadable term');
// "Continue working in a spiral; do not join." strips to a bare ";" - reporting that as unrecognised
// failed a row the parser had in fact read completely.
ok('a row that strips to punctuation still reads', reads('Continue working in a spiral; do not join.'));
ok('and so does one ending in a stray full stop', reads('sc in each st across. Turn.'));

print('\n4. The trap in the corpus');
// "tr c in joining" is a real treble worked INTO the join. A rule matching the word "joining" would take
// the treble with it. It appears three times in the real books.
ck('tr c in joining still counts the treble', yieldOf('tr c in joining'), 1);
ck('dc in joining too', yieldOf('dc in joining'), 1);
// ...while "join in <somewhere>" makes nothing. The location is not a stitch.
ck('join in 1st cluster st makes nothing', yieldOf('join in 1st cluster st'), 0);
ck('but a cluster on its own is still a stitch', yieldOf('cluster'), 1);
ck('and two of them are two', yieldOf('2 cluster'), 2);

print('\n5. Unknown text still fails - prose handling is a catalogue, not a guess');
// If an unrecognised phrase were treated as prose, a misspelled stitch would vanish and the count would be
// wrong with nothing shown. That is the one thing this must not do.
no('a misspelled stitch is not read as prose', reads('dubble crochet in the last stitch'));
ok('and it is named', /dubble/i.test(unknownIn('dubble crochet in the last stitch').join(' ')));
no('a pattern-defined stitch still fails', reads('work a shell in the next st'));
no('so does an uncatalogued phrase', reads('gently snug the loop closed'));
ck('sc in each st across still reads', reads('sc in each st across'), true);

print('\n6. A whole vintage opening round now establishes its foundation');
// The prose sat densest in the opening rounds, so the foundation count was never set and everything after
// it was blocked. This is the case that unblocks whole patterns.
var opening = 'Ch 6, join to form a ring, ch 3, 15 dc in ring, join in 3rd st of ch 3';
ok('it reads', reads(opening));
// Through evaluateStep, not parseInstructions: the ring handling that discounts the chain scaffolding
// lives there, so this is the layer that gives a usable count.
ck('and the round is 15 dc, the chain being scaffolding',
   E.evaluateStep(0, 0, opening, 1, 0).calculatedYield, 15);
ok('with the round marked valid', E.evaluateStep(0, 0, opening, 1, 0).costIsValid);

print('\n7. Nothing that already worked changed its answer');
// Snapshot of every vintage row the engine can read. A change here means an answer moved: inspect before
// accepting. 28 moved when this landed - all corrections, where "join in <somewhere>" had been counting the
// location as a made stitch. 4 more when "N st in each of next M sts" was fixed: the leading count was
// being dropped, so "2 d c in each of the next 4 d c" made 4 instead of 8, and each moved up by exactly the
// number of increases in the row. 2 more when standing chains and chain spaces were priced properly. 1 more
// when a count could be qualified by the piece it counts ("in each of the 48 Back sts"): "increase 1 d c in
// each of the 2 center sts" had read as one position because "center" sat between the number and the noun.
var SNAP = JSON.parse(readFile('tests/fixtures-vintage-counts.json')).rows;
var moved = [];
SNAP.forEach(function (s) {
    var got = E.evaluateStep(0, 40, s.row, 1, 0).calculatedYield;
    if (got !== s.yield) moved.push(s.row.slice(0, 46) + ' (' + s.yield + ' -> ' + got + ')');
});
ck('no counted answer moved', moved.slice(0, 4).join(' | ') || 'none', 'none');
// Was >= 200 against a 301-row file. That file was destroyed by a bad shell redirect on 2026-08-08 and no
// filter over fixtures-vintage.json reproduced its row set - it had been captured when the engine read a
// different set of rows. The fixture was rebuilt on the definition it states for itself, "every row the
// engine can fully read", which is 193 rows today. The floor is lowered to match a real count, not to let a
// shrinking snapshot pass: if this file loses rows again, that is a regression in what the engine reads.
ok('and the snapshot is substantial', SNAP.length >= 190);

endSuite();
