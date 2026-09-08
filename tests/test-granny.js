/**
 * Granny squares - clusters worked into chain spaces, and the two numbers a round can honestly report.
 *
 * THE BUG THIS SUITE EXISTS FOR. A granny square states its count in double crochets: "(24)" means
 * twenty-four dc, never twenty-four plus the twelve chains that form its corner and side spaces.
 * Stitch Math counted the chains too, so a correct round read 38, the matrix showed it, and the linter
 * offered to "correct" the designer's right answer to the engine's wrong one. Nothing failed, because
 * a round worked into spaces is exempt from the balance rule and a disagreeing written count is only
 * ever advisory - so the shipped granny template displayed the wrong number on every line and every
 * test passed.
 *
 * Both readings are legitimate and the app has always had a setting for which one applies. What was
 * wrong is that neither setting produced the number published patterns actually print.
 */
boot();

var E = window.CrochetMathEngine;

/** A granny round n >= 2, written the way the template writes it. */
function round(n) {
    var side = '';
    for (var i = 0; i < n - 2; i++) side += 'ch 1, 3 dc in next ch-1 sp, ';
    return 'sl st to next ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, ['
        + side + 'ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp] x 3, '
        + side + 'ch 1, sl st to top of ch-3';
}
var RING = 'ch 4, sl st to form ring. ch 3, 2 dc in ring, [ch 2, 3 dc in ring] x 3, ch 2, sl st to top of ch-3';

function evalRound(instr, available, corners) {
    return E.evaluateStep(0, available, instr, 1, 0, corners || 0, 0);
}
function withConvention(mode, fn) {
    E.setChainSpaceConvention(mode);
    try { return fn(); } finally { E.setChainSpaceConvention('count'); }
}

function load(lines, convention) {
    $('meta-chain-space-convention').value = convention || 'discount';
    $('meta-chain-space-convention').fire('change');
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}
function calcCounts() {
    return $('step-sequence-body').children.map(function (tr) {
        return tr.children.length >= 6
            ? tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(' ')[0] : null;
    }).filter(function (v) { return v !== null; }).join(',');
}
function findings(word) {
    var out = [];
    $('lint-side-body').children.forEach(function (card) {
        var flat = card.children.map(function (p) { return p.textContent; }).join(' ');
        if (flat.indexOf(word) >= 0) out.push(card.children[0].textContent);
    });
    return out;
}

print('\n1. A square counts 12X double crochets, which is 4X clusters');
// The growth every classic granny square has: one cluster added to each of four sides per round.
withConvention('discount', function () {
    ck('Rnd 1', evalRound(RING, 0, 0).calculatedYield, 12);
    ck('Rnd 2', evalRound(round(2), 12, 4).calculatedYield, 24);
    ck('Rnd 3', evalRound(round(3), 24, 4).calculatedYield, 36);
    ck('Rnd 4', evalRound(round(4), 36, 4).calculatedYield, 48);
    ck('Rnd 5', evalRound(round(5), 48, 4).calculatedYield, 60);
    // 12X dc is 4X clusters of three, which is the same statement counted the other way.
    ck('and that is 20 clusters on round 5', evalRound(round(5), 48, 4).calculatedYield / 3, 20);
});

print('\n2. Every round is valid, and none of them is held to the full count below');
// A granny round passes over every stitch of the round below on purpose. The exemption is what stops
// a correct round being reported as leaving twelve unworked - and it is also why nothing else in the
// engine would have caught the wrong count.
withConvention('discount', function () {
    [[round(2), 12], [round(3), 24], [round(4), 36]].forEach(function (c, i) {
        var ev = evalRound(c[0], c[1], 4);
        ok('round ' + (i + 2) + ' valid', ev.costIsValid && ev.reason === '');
        ok('round ' + (i + 2) + ' went into spaces', ev.spaceCost > 0);
    });
});

print('\n3. The chain-inclusive reading is unchanged, and still available');
// The default convention is what every existing corner test is pinned to, and it is a real house
// style rather than a bug. Both readings are carried so the notes can name the other one.
var counted = evalRound(round(2), 12, 4);
ck('the default still counts the chains', counted.calculatedYield, 38);
ck('the dc-only reading rides along', counted.stitchYield, 24);
var discounted = withConvention('discount', function () { return evalRound(round(2), 12, 4); });
ck('and under discount the two swap places', discounted.calculatedYield + '/' + discounted.rawYield, '24/30');

print('\n4. An ordinary row is untouched by any of this');
// stitchYield differs from calculatedYield only where a round works into chain spaces. Everywhere
// else a caller can read either.
[['a plain round', 12, 'sc in each st around'],
 ['a turning chain', 12, 'ch 1, dc in each st across'],
 ['a magic ring', 0, '6 sc in magic ring'],
 ['a foundation chain', 0, 'ch 20'],
 ['a granny-ish row into stitches', 12, '[3 dc, ch 2, 3 dc] in next st']].forEach(function (c) {
    var ev = E.evaluateStep(0, c[1], c[2], 1, 0, 0, 0);
    ck(c[0] + ' reports one number', ev.calculatedYield, ev.stitchYield);
});

print('\n5. The linter never offers to rewrite a granny count');
// This is what it used to do: "This row makes 14 stitches more than the 24 it states… if the count in
// brackets is the typo, this corrects it." Accepting it wrote 38 into a correct pattern.
var fixes = evalRound(round(2), 12, 4).fixes || [];
ck('no stated-count rewrite is offered', fixes.filter(function (f) { return f.id === 'stated-count'; }).length, 0);
// An ordinary row still gets one - the suppression is scoped to rounds worked into spaces, not global.
var plainFixes = E.evaluateStep(0, 12, 'sc in each st around', 1, 20, 0, 0).fixes || [];
ck('but an ordinary row still does', plainFixes.filter(function (f) { return f.id === 'stated-count'; }).length, 1);

print('\n6. Instead it says which convention the pattern is written in');
// The useful thing to say when both readings are known and the written count matches the other one:
// this is not a typo, it is a house style, and here is the setting that agrees with it.
var noted = E.evaluateStep(0, 12, round(2), 1, 24, 4, 0);
var noteText = (noted.notes || []).join(' ');
ok('the note is raised', noteText.indexOf('without the chains that form its spaces') >= 0);
ok('it names both numbers', noteText.indexOf('24') >= 0 && noteText.indexOf('38') >= 0);
ok('and the setting that resolves it', noteText.indexOf('Chain-Sp Counts As') >= 0);
// And nothing is said when the two already agree.
var agreeing = withConvention('discount', function () { return E.evaluateStep(0, 12, round(2), 1, 24, 4, 0); });
ck('silent when the count matches', (agreeing.notes || []).join(' ').indexOf('Chain-Sp Counts As') >= 0, false);

print('\n7. Recognising a square round, and refusing to guess');
// The gate for the cluster rule. It has to be tight: plenty of rounds work into chain spaces without
// being squares, and holding those to a four-cluster rhythm would flag correct work.
withConvention('discount', function () {
    ck('a granny round counts its clusters', E.clusterCount(evalRound(round(3), 24, 4), round(3)), 12);
    var mesh = 'ch 4, [dc in next ch-2 sp, ch 1] x 12, sl st to top of ch-3';
    ck('a mesh round is not a square', String(E.clusterCount(evalRound(mesh, 12, 4), mesh)), 'null');
    var shell = 'sl st to next ch-2 sp, ch 3, [4 dc, ch 2, 4 dc] in same sp, [ch 1, [4 dc, ch 2, 4 dc] in next ch-2 sp] x 3, ch 1, sl st to top of ch-3';
    // 32 dc does not divide into clusters of three, so nothing is claimed about it.
    ck('a four-dc shell is not a square', String(E.clusterCount(evalRound(shell, 12, 4), shell)), 'null');
    var plain = 'sc in each st around';
    ck('a round into stitches is not a square', String(E.clusterCount(E.evaluateStep(0, 12, plain, 1, 0, 0, 0), plain)), 'null');
});

print('\n8. The growth rule');
ck('four more is a square', String(E.buildClusterGrowthFix(8, 12)), 'null');
ck('and from any starting point', String(E.buildClusterGrowthFix(16, 20)), 'null');
var stalled = E.buildClusterGrowthFix(12, 12);
ok('no growth is reported', !!stalled);
ok('naming the shortfall', stalled.title.indexOf('adds 0 clusters') >= 0);
ck('as a style note, not an error', stalled.severity, 'style');
ck('and it never rewrites a round', String(stalled.edit), 'null');
var doubled = E.buildClusterGrowthFix(8, 16);
ok('growing by eight is reported', doubled.title.indexOf('adds 8 clusters') >= 0);
ok('and it says what the round should have held', doubled.detail.indexOf('12') >= 0);

print('\n9. End to end: a five-round square');
load([
    'Rnd 1: ' + RING + ' (12)',
    'Rnd 2: ' + round(2) + ' (24)',
    'Rnd 3: ' + round(3) + ' (36)',
    'Rnd 4: ' + round(4) + ' (48)',
    'Rnd 5: ' + round(5) + ' (60)'
]);
ck('the counts run 12X', calcCounts(), '12,24,36,48,60');
ck('nothing failed', $('step-sequence-body').children.filter(function (tr) {
    return tr.children.length >= 6 && /FAIL/.test(tr.children[5].innerHTML);
}).length, 0);
ck('and the linter is quiet', $('lint-side-tally').textContent, 'No suggestions');

print('\n10. End to end: a square that stops growing');
// The failure nothing else catches. Round 4 repeats round 3's side count, so it consumes and produces
// a perfectly consistent number and comes out a rhombus.
load([
    'Rnd 1: ' + RING + ' (12)',
    'Rnd 2: ' + round(2) + ' (24)',
    'Rnd 3: ' + round(3) + ' (36)',
    'Rnd 4: ' + round(3) + ' (36)'
]);
ck('no row fails', $('step-sequence-body').children.filter(function (tr) {
    return tr.children.length >= 6 && /FAIL/.test(tr.children[5].innerHTML);
}).length, 0);
ck('but the shape is flagged, once', findings('cluster').length, 1);
ck('on the round that stopped growing', findings('cluster')[0], 'Rnd 4');

print('\n11. Each piece is judged on its own');
load([
    'SQUARE ONE',
    'Rnd 1: ' + RING + ' (12)',
    'Rnd 2: ' + round(2) + ' (24)',
    'SQUARE TWO',
    'Rnd 1: ' + RING + ' (12)',
    'Rnd 2: ' + round(2) + ' (24)'
]);
// The second square restarts at 4 clusters. Compared across the heading that would read as losing 4.
ck('a new square is not measured against the last one', findings('cluster').join(',') || 'none', 'none');

print('\n12. The join that credits the standing chain, written the many ways it is written');
// The round's opening chain stands in for its first dc, and the join is what says so. Getting this
// wrong costs exactly one stitch on every round of every square - which is how a corpus pattern sat
// at 23 instead of 24 while every test called it clean.
function credits(instr) {
    return withConvention('discount', function () {
        return E.evaluateStep(0, 12, instr, 1, 0, 4, 0).calculatedYield;
    });
}
var BODY = 'ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp] x 3, ch 1, ';
ck('joined to the top of a named chain', credits('sl st to next ch-2 sp, ' + BODY + 'sl st to top of ch-3'), 24);
ck('joined to the top, chain unnamed', credits('sl st to next ch-2 sp, ' + BODY + 'sl st to top'), 24);
ck('joined to the top of beg ch', credits('sl st to next ch-2 sp, ' + BODY + 'join with sl st in top of beg ch'), 24);
ck('and when the pattern says so outright',
   credits('sl st to next ch-2 sp, ch 3 (counts as first dc), [2 dc, ch 2, 3 dc] in same sp, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp] x 3, ch 1'), 24);

print('\n13. But a turning chain is not a standing chain');
// A ch 1 opening a round stands for nothing, and crediting it would add a stitch that is not there.
ck('ch 1 is not credited',
   credits('sl st to next ch-2 sp, ch 1, [2 dc, ch 2, 3 dc] in same sp, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp] x 3, ch 1, sl st to top'), 23);
// And a round that never joins says nothing about its opening chain either way.
ck('an unjoined round is not credited',
   credits('sl st to next ch-2 sp, ' + BODY.replace(/, $/, '')), 23);

endSuite();
