boot();

var PATTERNS = [
{ name: "Amigurumi sphere (rounds, magic ring)", rounds: true, rows: [
"Rnd 1: magic ring 6 sc (6)",
"Rnd 2: [inc] x 6 (12)",
"Rnd 3: [sc, inc] x 6 (18)",
"Rnd 4: [sc in next 2 sts, inc] x 6 (24)",
"Rnd 5: [sc in next 3 sts, inc] x 6 (30)",
"Rnd 6: sc in each st around (30)",
"Rnd 7: [sc in next 3 sts, dec] x 6 (24)",
"Rnd 8: [sc in next 2 sts, dec] x 6 (18)",
"Rnd 9: [sc, dec] x 6 (12)",
"Rnd 10: [dec] x 6 (6)"]},

{ name: "Beanie crown (rounds, dc increases)", rounds: true, rows: [
"Rnd 1: magic ring 12 dc (12)",
"Rnd 2: [dc-inc in next st] x 12 (24)",
"Rnd 3: [dc in next st, dc-inc in next st] x 12 (36)",
"Rnd 4: [dc in next 2 sts, dc-inc in next st] x 12 (48)",
"Rnd 5: dc in each st around (48)"]},

{ name: "Ribbed scarf (post stitches, hdc foundation)", rows: [
"Row 1: ch 21, hdc in 3rd ch from hook and in each ch across (19)",
"Row 2: ch 1, turn, [fphdc in next st, bphdc in next st] x 9, hdc in last st (19)",
"Row 3: ch 1, turn, [fphdc in next st, bphdc in next st] x 9, hdc in last st (19)"]},

{ name: "Chevron ripple blanket (asterisk repeat)", rows: [
"Row 1: ch 57, sc in 2nd ch from hook and in each ch across (56)",
"Row 2: ch 1, turn, *sc in next 5 sts, 3 sc in next st, sc in next 5 sts, sc3tog; repeat from * across (56)",
"Row 3: ch 1, turn, *sc in next 5 sts, 3 sc in next st, sc in next 5 sts, sc3tog; repeat from * across (56)"]},

{ name: "Shell border (fans and skips)", rows: [
"Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
"Row 2: ch 1, turn, [sk 2 sts, 5 dc in next st, sk 2 sts, sc in next st] x 4 (24)"]},

{ name: "Bobble texture blanket", rows: [
"Row 1: ch 27, sc in 2nd ch from hook and in each ch across (26)",
"Row 2: ch 1, turn, sc in next 2 sts, [bobble in next st, sc in next 3 sts] x 6 (26)",
"Row 3: ch 1, turn, sc in each st across (26)"]},

{ name: "Foundation single crochet start", rows: [
"Row 1: fsc 20 (20)",
"Row 2: ch 1, turn, sc in each st across (20)",
"Row 3: ch 1, turn, [sc in next 3 sts, inc in next st] x 5 (25)"]},

{ name: "Triangle shawl (edge increases)", rows: [
"Row 1: ch 6, dc in 4th ch from hook and in each ch across (3)",
"Row 2: ch 3, turn, 2 dc in next st, dc in next st, 2 dc in last st (5)"]},

{ name: "V-stitch mesh (ch spaces)", rows: [
"Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
"Row 2: ch 3, turn, sk 1 st, [dc in next st, ch 1, sk 1 st] x 11, dc in last st (23)"]},

{ name: "UK terminology", rows: [
"Row 1: ch 21, dc in 2nd ch from hook and in each ch across (20)",
"Row 2: ch 1, turn, htr in each st across (20)",
"Row 3: ch 2, turn, tr in each st across (20)"]},

// Written in double crochets only, the way granny squares are: "(24)" is 24 dc and does not include
// the chains forming the corner and side spaces. Declared rather than assumed, because the app's
// default convention counts those chains and would read this correct square as 11 and 38.
{ name: "Granny square (rounds, ch-2 corners)", rounds: true, chainSpace: 'discount', rows: [
"Rnd 1: ch 4, sl st to join, ch 3, 2 dc in ring, ch 2, [3 dc in ring, ch 2] x 3, sl st to top of ch-3 (12)",
"Rnd 2: sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, (3 dc, ch 2, 3 dc) in next ch-2 sp] x 3, ch 1, sl st to top (24)"]},

{ name: "Filet crochet mesh", rows: [
"Row 1: ch 32, dc in 8th ch from hook and in each ch across (25)",
"Row 2: ch 4, turn, [sk 1 st, dc in next st, ch 1] x 12, dc in last st (25)"]}
];

function run(pat) {
    // Construction used to be forced here, to 'Rounds (Circular)' - not even one of the dropdown's
    // own option values; it only ever worked because worksInRounds does a substring test. It is read
    // off each pattern's own "Rnd"/"Row" labels now, which is what the `rounds` flag already recorded.
    // Each pattern is read in the convention it was written in. Everything without one gets the
    // app default, which is what it has always had.
    $('meta-chain-space-convention').value = pat.chainSpace || 'count';
    $('meta-chain-space-convention').fire('change');
    $('bulk-input').value = pat.rows.join('\n');
    $('bulk-parse-btn').fire('click');

    var body = $('step-sequence-body').children;
    var bad = [];
    body.forEach(function (tr, i) {
        if (tr.children.length < 6) return;                 // note and section rows span the table
        var st = tr.children[5].innerHTML;
        var stated = String(tr.children[3].textContent).trim();
        var got = tr.children[4].innerHTML.replace(/<[^>]*>/g,'').trim().split(' ')[0];
        if (/FAIL/.test(st)) {
            bad.push({
                row: i + 1, stated: stated, got: got,
                why: st.replace(/<span class="math-reason">/g,' :: ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0, 110)
            });
            return;
        }
        // A PASSING row whose calculated count disagrees with the one the designer wrote.
        //
        // This is the failure mode that let a granny square ship reading 11 and 38 where the pattern
        // said 12 and 24: a written count that disagrees is advisory and never fails a row, so
        // counting only FAILs said every pattern here was clean while one of them displayed the wrong
        // number on every line. "Fully clean" now means the row passed AND the two numbers agree,
        // which is the claim the metric was always assumed to be making.
        if (stated && stated !== '0' && got && stated !== got) {
            bad.push({ row: i + 1, stated: stated, got: got,
                       why: 'passed, but the calculated count disagrees with the written one' });
        }
    });
    return { total: body.length, bad: bad };
}

var clean = 0;
PATTERNS.forEach(function (pat) {
    var r = run(pat);
    if (!r.bad.length) { clean++; print('PASS   ' + pat.name + '  (' + r.total + ' rows)'); }
    else {
        print('FAIL   ' + pat.name + '  (' + r.bad.length + ' of ' + r.total + ' rows)');
        r.bad.forEach(function (b) { print('         row ' + b.row + ': stated ' + b.stated + ', got ' + b.got + '  |  ' + b.why); });
    }
});
print('\n' + clean + ' of ' + PATTERNS.length + ' patterns fully clean');
