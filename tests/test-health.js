boot();
function load(lines){ $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function health(){ return $('cumulative-status').innerHTML; }
function score(){ var m = health().match(/health-number">(\d+)</); return m ? +m[1] : null; }
function check(name){ var re = new RegExp('check-(pass|warn|fail)"><span class="check-icon">[^<]*</span><span class="check-name">'+name+'<');
    var m = health().match(re); return m ? m[1] : null; }
function warned(text){ return health().indexOf(text) !== -1; }

print('\n1. Clean pattern scores 100 with four passes');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 1, turn, [sc in next 2 sts, inc in next st] x 6 (24)"
]);
ck('score is 100', score(), 100);
ck('stitch math passes', check('Stitch math'), 'pass');
ck('terminology passes', check('Terminology'), 'pass');
ck('repeat consistency passes', check('Repeat consistency'), 'pass');
ck('formatting passes', check('Formatting'), 'pass');
ck('grade Excellent', /health-grade">Excellent</.test(health()), true);
ck('no warnings', /check-warn/.test(health()), false);

print('\n2. Written count is not mistaken for repeat notation');
ck('single notation reported', /consistent \[ \] notation/.test(health()), true);

print('\n3. Failing row costs the stitch-math check');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 5 (18)",
 "Row 3: ch 1, turn, sc in each st across (18)"
]);
ck('stitch math fails', check('Stitch math'), 'fail');
ck('singular grammar', /1 row does not add up/.test(health()), true);
ck('mentions blocked row', /1 blocked behind it/.test(health()), true);
ck('score drops to 85', score(), 85);

print('\n4. Unknown token costs terminology');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, sc x 4, wibblestitch, sc x 7 (12)"
]);
ck('terminology fails', check('Terminology'), 'fail');
ck("names the token (html-escaped)", /&quot;wibblestitch&quot;/.test(health()), true);

print('\n5. Inconsistent abbreviations warned');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, sc in next 6 sts, single crochet in next 6 sts (12)"
]);
ck('abbreviation warning', warned('Abbreviations inconsistent'), true);
ck('names both forms', /sc \/ single crochet/.test(health()), true);

print('\n6. Turning chain not documented');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: sc in each st across (12)",
 "Row 3: sc in each st across (12)"
]);
ck('turning chain warning', warned('Turning chain not documented on any row'), true);

print('\n7. Foundation chain never referenced');
load([
 "Row 1: ch 13 (13)",
 "Row 2: ch 1, turn, sc in each st across (13)"
]);
ck('foundation warning', warned('Foundation chain not referenced'), true);

print('\n8. Formatting warns on missing counts and labels');
load([
 "ch 13, sc in 2nd ch from hook and in each ch across",
 "ch 1, turn, sc in each st across"
]);
ck('formatting warns', check('Formatting'), 'warn');
ck('mentions missing counts', /without a stitch count/.test(health()), true);
ck('cites the CYC rule', /required where the count changes/.test(health()), true);
// Row 2 repeats the count and is correctly written without one; only the first row,
// which has no previous count to compare against, is counted as missing.
ck('counts only the first row, not both', /1 row without a stitch count/.test(health()), true);
ck('mentions missing labels', /without a row label/.test(health()), true);

print('\n9. Score never leaves 0-100');
load(["Row 1: ch 5, blah blah blah (99)", "Row 2: more nonsense (99)", "Row 3: junk (99)"]);
var s = score();
ck('score within range', s >= 0 && s <= 100, true);

// Turning chains are a flat-work idea. Joined rounds step up with a closing slip stitch and a starting
// chain; a continuous spiral does neither and needs nothing.
function setConstruction(v){ $('meta-construction').value = v; $('meta-construction').fire('change'); }
function turnWarned(){ return warned('Turning chain not documented'); }
function roundWarned(){ return warned('Round join or starting chain not documented'); }

var AMIGURUMI = [
 "Row 1: 6 sc in mr (6)",
 "Row 2: inc x 6 (12)",
 "Row 3: [sc, inc] x 6 (18)",
 "Row 4: [2 sc, inc] x 6 (24)",
 "Row 5: [pc, ch 1, sk 1] x 12 (24)",
 "Row 6: [fpdc, bpdc] x 12 (24)",
 "Row 7: [sc2tog, 2 sc] x 6 (18)",
 "Row 8: [3 dc in same st, sk 1] x 9 (27)",
 "Row 9: [sl st, puff, cl] x 9 (27)",
 "Row 10: [sc, dec] x 9 (18)",
 "Row 11: sc in each st across (18)",
 "Row 12: sc in next 3 sts, hdc in next 3 sts, dc in next 3 sts, tr in final 9 sts (18)",
 "inc x18",
 "[sc3tog]x12"
];

print('\n10. Amigurumi in a spiral is never asked for a turning chain');
setConstruction('Rows (Flat)');            // the default, which is how this was hit
load(AMIGURUMI);
ck('no turning chain warning on the default setting', turnWarned(), false);
ck('and no round-join warning either', roundWarned(), false);
setConstruction('Rounds (Spiral)');
load(AMIGURUMI);
ck('none when declared a spiral', turnWarned() || roundWarned(), false);
// Silencing one warning must not silence its neighbours.
ck('missing stitch counts still flagged', warned('without a stitch count'), true);
ck('missing row labels still flagged', warned('without a row label'), true);
ck('sc2tog / dec still flagged', warned('Abbreviations inconsistent'), true);
ck('score is 89, not 86', score(), 89);

print('\n11. Flat work still has to document its turning chain');
setConstruction('Rows (Flat)');
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: sc in each st across (12)",
 "Row 3: sc in each st across (12)"
]);
ck('flat pattern still warned', turnWarned(), true);
// A flat body finished with a round border is still flat where it counts.
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: sc in each st across (12)",
 "Rnd 3: sc in each st around (12)"
]);
ck('flat body with a round border still warned', turnWarned(), true);

print('\n12. Joined rounds are checked against the join, not a turning chain');
setConstruction('Rows (Flat)');
load([
 "Rnd 1: ch 4, sl st to join, ch 3, 2 dc in ring, ch 2, [3 dc in ring, ch 2] x 3, sl st to top of ch-3 (12)",
 "Rnd 2: sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, (3 dc, ch 2, 3 dc) in next ch-2 sp] x 3, ch 1, sl st to top (24)"
]);
ck('granny square: no turning chain demanded', turnWarned(), false);
ck('granny square: its joins count as documented', roundWarned(), false);
setConstruction('Rounds (Joined)');
load([
 "Rnd 1: ch 20, sl st to join (20)",
 "Rnd 2: dc in each st around (20)",
 "Rnd 3: dc in each st around (20)"
]);
ck('declared joined but nothing documented -> round warning', roundWarned(), true);
ck('and it is not called a turning chain', turnWarned(), false);

print('\n13. A spiral tube from a plain chain is found by its stitch marker');
setConstruction('Rows (Flat)');
load([
 "Row 1: ch 20, sc in 2nd ch from hook and in each ch across (19)",
 "Row 2: sc in each st around, sm to 1st st (19)",
 "Row 3: sc in each st around, sm to 1st st (19)"
]);
ck('marker cue classifies it as a spiral', turnWarned(), false);
ck('markers do not break the math', check('Stitch math'), 'pass');
ck('and are not unknown terms', check('Terminology'), 'pass');
// A marker anywhere else is not a round cue - flat shawls mark the centre spine.
load([
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: sc in next 6 sts, place marker in centre st, sc in next 6 sts (12)",
 "Row 3: sc in each st across (12)"
]);
ck('a centre-spine marker leaves it flat', turnWarned(), true);

endSuite();
