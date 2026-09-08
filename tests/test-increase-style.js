/**
 * Stacked vs staggered increases - which way a shaping round distributes them, and the warning for a
 * piece that changes its mind partway up.
 *
 * The two strategies are ARITHMETICALLY IDENTICAL, which section 2 asserts directly rather than
 * taking on trust: same six increases, same 6k plain stitches, same cost and yield. Nothing in the
 * validation can tell them apart and nothing should - both are correct. Only the finished object
 * differs: stacked increases pile into six columns and crease the fabric into a hexagon, staggered
 * ones rotate each round and come out smooth.
 *
 * The most important assertions in this file are the NEGATIVE ones in sections 4 and 5. A correctly
 * staggered pattern ALTERNATES between the two forms every round, so a naive "the style changed"
 * rule would fire on every round of correct work - the single worst thing this check could do.
 */
boot();

var E = window.CrochetMathEngine;

function style(text) { return String(E.increaseStyle(text)); }

function load(lines) {
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}
/** Which rows carry the mixed-strategy finding. Read off the sidebar cards, walked by hand because
 *  the stub's textContent does not recurse into children. */
function mixingWarnings() {
    var out = [];
    $('lint-side-body').children.forEach(function (card) {
        var flat = card.children.map(function (p) { return p.textContent; }).join(' ');
        if (flat.indexOf('staggers its increases') >= 0) out.push(card.children[0].textContent);
    });
    return out;
}
function failingRows() {
    return $('step-sequence-body').children.filter(function (tr) {
        return tr.children.length >= 6 && /FAIL/.test(tr.children[5].innerHTML);
    }).length;
}
function counts() {
    return $('step-sequence-body').children.map(function (tr) {
        return tr.children.length >= 6
            ? tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(' ')[0] : null;
    }).filter(function (v) { return v !== null; }).join(',');
}

print('\n1. Classifying a shaping round');
ck('a whole-round repeat is uniform', style('(2 sc, inc) * 6'), 'uniform');
ck('brackets and x, the same', style('[2 sc, inc] x 6'), 'uniform');
ck('so is "6 times"', style('(2 sc, inc) 6 times'), 'uniform');
ck('and "rep 6"', style('(2 sc, inc) rep 6'), 'uniform');
ck('a decrease round too', style('(2 sc, dec) * 6'), 'uniform');
ck('a split run makes it offset', style('1 sc, inc, (2 sc, inc) * 5, 1 sc'), 'offset');
ck('whatever the base run', style('2 sc, inc, (4 sc, inc) * 5, 2 sc'), 'offset');
ck('decreases stagger the same way', style('2 sc, dec, (4 sc, dec) * 5, 2 sc'), 'offset');
ck('a prefix alone is enough', style('1 sc, inc, (2 sc, inc) * 5'), 'offset');
ck('so is a suffix alone', style('(2 sc, inc) * 5, 3 sc'), 'offset');

print('\n2. The two strategies are mathematically identical');
// The claim the whole feature rests on. Asserted against the engine for every base run a first
// shaping sequence uses, rather than stated in a comment and hoped for.
for (var k = 1; k <= 6; k++) {
    // What the round below produced. One pass of "(k sc, inc)" consumes k+1 stitches, not k - the
    // increase eats one of its own - so a six-repeat round works 6(k+1).
    var available = 6 * (k + 1);
    var stacked = '(' + k + ' sc, inc) * 6';
    var half = Math.floor(k / 2);
    var rest = k - half;
    var staggered = (half ? half + ' sc, ' : '') + 'inc, (' + k + ' sc, inc) * 5, ' + rest + ' sc';

    var a = E.evaluateStep(0, available, stacked, 1, 0, 0, 0);
    var b = E.evaluateStep(0, available, staggered, 1, 0, 0, 0);
    ck('k=' + k + ' both consume the whole round', a.totalCost + '/' + b.totalCost,
       available + '/' + available);
    ck('k=' + k + ' both produce the same count', b.calculatedYield, a.calculatedYield);
    ok('k=' + k + ' both valid', a.costIsValid && b.costIsValid);
    // Same numbers, different shape - which is the entire point.
    ck('k=' + k + ' and they classify differently', style(stacked) + '/' + style(staggered),
       'uniform/offset');
}

print('\n3. Rounds this cannot read say so, rather than guessing');
// Guessing here is what would make the warning noisy, so anything that is not plainly one or the
// other comes back null and takes no part in the rhythm.
ck('a magic ring', style('6 sc in magic ring'), 'null');
ck('increasing every stitch', style('inc in each st around'), 'null');
ck('a straight round', style('sc in each st around'), 'null');
ck('a repeat that shapes nothing', style('(sc, ch 1, sk 1) x 12'), 'null');
ck('a group with no multiplier', style('(2 sc, inc)'), 'null');
ck('nothing at all', style(''), 'null');

print('\n4. A joined round is uniform, not offset');
// THE regression this rule exists to prevent. A joined round writes its starting chain and its
// closing slip stitch outside the repeat group, so "is there text outside the brackets" reads every
// round of every joined pattern as staggered. The question asked instead is what the outside
// CONSUMES: a starting chain eats no stitch and a joining slip stitch is stripped, so both cost 0.
ck('the whole round', style('ch 2 (does not count as a stitch), [dc, dc-inc] x 12, sl st to first dc'),
   'uniform');
ck('and a genuinely staggered joined round is still offset',
   style('ch 2 (does not count as a stitch), 1 dc, dc-inc, [2 dc, dc-inc] x 11, 1 dc, sl st to first dc'),
   'offset');

print('\n5. The mixing rule, on style sequences alone');
// A correctly staggered piece alternates, so every offset round has exactly one uniform round before
// it. Two uniform shaping rounds in a row is the signal a piece stopped alternating.
function at(styles) {
    var fix = E.buildIncreaseStyleFix(styles);
    return fix ? String(fix.at) : 'silent';
}
ck('all uniform says nothing', at(['uniform', 'uniform', 'uniform', 'uniform']), 'silent');
ck('correct alternation says nothing', at(['uniform', 'offset', 'uniform', 'offset']), 'silent');
ck('starting offset is fine too', at(['offset', 'uniform', 'offset', 'uniform']), 'silent');
ck('one round says nothing', at(['uniform']), 'silent');
ck('nothing says nothing', at([]), 'silent');
ck('two uniform then offset warns at the offset', at(['uniform', 'uniform', 'offset']), '2');
ck('a long uniform run then offset', at(['uniform', 'uniform', 'uniform', 'offset']), '3');
ck('alternating, then a stall, then offset', at(['uniform', 'offset', 'uniform', 'uniform', 'offset']), '4');
ck('raised once, at the first break', at(['uniform', 'uniform', 'offset', 'uniform', 'uniform', 'offset']), '2');
var one = E.buildIncreaseStyleFix(['uniform', 'uniform', 'offset']);
ck('filed as style, not an error', one.severity, 'style');
ck('and never rewrites a round', String(one.edit), 'null');
ok('it carries a lesson', one.lesson.length > 0);

print('\n6. End to end: a correct sphere of each kind is silent');
var STACKED = [
    'Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)',
    'Rnd 3: (1 sc, inc) * 6 (18)', 'Rnd 4: (2 sc, inc) * 6 (24)',
    'Rnd 5: (3 sc, inc) * 6 (30)', 'Rnd 6: (4 sc, inc) * 6 (36)'
];
var SEAMLESS = [
    'Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)',
    'Rnd 3: (1 sc, inc) * 6 (18)', 'Rnd 4: 1 sc, inc, (2 sc, inc) * 5, 1 sc (24)',
    'Rnd 5: (3 sc, inc) * 6 (30)', 'Rnd 6: 2 sc, inc, (4 sc, inc) * 5, 2 sc (36)'
];
load(STACKED);
ck('stacked: no failing rows', failingRows(), 0);
ck('stacked: no warning', mixingWarnings().join(',') || 'none', 'none');
var stackedCounts = counts();

load(SEAMLESS);
ck('seamless: no failing rows', failingRows(), 0);
ck('seamless: no warning despite alternating every round', mixingWarnings().join(',') || 'none', 'none');
ck('and the curve is identical to the stacked one', counts(), stackedCounts);

print('\n7. End to end: a genuine switch warns once, and names the round');
load([
    'Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)',
    'Rnd 3: (1 sc, inc) * 6 (18)', 'Rnd 4: (2 sc, inc) * 6 (24)',
    'Rnd 5: (3 sc, inc) * 6 (30)', 'Rnd 6: 2 sc, inc, (4 sc, inc) * 5, 2 sc (36)'
]);
ck('one warning', mixingWarnings().length, 1);
ck('on the round where the strategy changed', mixingWarnings()[0], 'Rnd 6');
// Style severity: a mixed piece is a design inconsistency, never an arithmetic fault.
ck('and nothing failed', failingRows(), 0);

print('\n8. Each piece is judged on its own');
// A sphere and a beanie worked after it are two objects, and each is entitled to its own strategy.
load([
    'SPHERE',
    'Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)',
    'Rnd 3: (1 sc, inc) * 6 (18)', 'Rnd 4: (2 sc, inc) * 6 (24)',
    'Rnd 5: (3 sc, inc) * 6 (30)',
    'EARS',
    'Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)',
    'Rnd 3: (1 sc, inc) * 6 (18)', 'Rnd 4: 1 sc, inc, (2 sc, inc) * 5, 1 sc (24)'
]);
// The sphere is uniform throughout and the ears alternate correctly. Neither is mixed, even though
// the document as a whole contains both strategies.
ck('two pieces, two strategies, no warning', mixingWarnings().join(',') || 'none', 'none');

print('\n9. A straight middle does not break the rhythm');
// The sphere's straight rounds classify as null and are skipped rather than splitting the run, so
// staggered increases followed by staggered decreases still read as one alternating sequence.
load([
    'Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)',
    'Rnd 3: (1 sc, inc) * 6 (18)', 'Rnd 4: 1 sc, inc, (2 sc, inc) * 5, 1 sc (24)',
    'Rnd 5-8: sc in each st around (24)',
    'Rnd 9: (2 sc, dec) * 6 (18)', 'Rnd 10: dec, (1 sc, dec) * 5, 1 sc (12)',
    'Rnd 11: dec * 6 (6)'
]);
ck('no failing rows', failingRows(), 0);
ck('and no warning', mixingWarnings().join(',') || 'none', 'none');

print('\n10. Every seamless template really is seamless');
// A template that claims to stagger but was typed stacked would teach the opposite of its own name.
$('template-list').children.forEach(function (row, i) {
    var name = row.children[0].children[0].textContent;
    if (name.indexOf('seamless') < 0) return;
    $('bulk-input').value = '';
    row.children[row.children.length - 1].fire('click');
    var styles = $('bulk-input').value.split('\n')
        .map(function (line) { return E.increaseStyle(line); })
        .filter(function (s) { return s; });
    ok(name + ' has shaping rounds', styles.length > 0);
    ok(name + ' actually staggers', styles.indexOf('offset') >= 0);
    ck(name + ' raises no warning about itself', mixingWarnings().join(',') || 'none', 'none');
});

print('\n11. And every stacked template really is stacked');
$('template-list').children.forEach(function (row) {
    var name = row.children[0].children[0].textContent;
    if (name.indexOf('stacked') < 0) return;
    $('bulk-input').value = '';
    row.children[row.children.length - 1].fire('click');
    var styles = $('bulk-input').value.split('\n')
        .map(function (line) { return E.increaseStyle(line); })
        .filter(function (s) { return s; });
    ok(name + ' has shaping rounds', styles.length > 0);
    ck(name + ' never staggers', styles.indexOf('offset') >= 0, false);
});

endSuite();
