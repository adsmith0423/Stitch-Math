boot();
var PATTERNS = [
{ name: "Sock/toe increases (rounds, invdec)", rounds: true, rows: [
"Rnd 1: magic ring 8 sc (8)",
"Rnd 2: [inc] x 8 (16)",
"Rnd 3: [sc in next 3 sts, inc] x 4 (20)",
"Rnd 4: sc in each st around (20)",
"Rnd 5: [sc in next 3 sts, invdec] x 4 (16)"]},

{ name: "Waistcoat/knit-look (rounds)", rounds: true, rows: [
"Rnd 1: ch 30, sl st to join (30)",
"Rnd 2: wsc in each st around (30)",
"Rnd 3: wsc in each st around (30)"]},

{ name: "Crossed-stitch panel", rows: [
"Row 1: ch 21, dc in 4th ch from hook and in each ch across (18)",
"Row 2: ch 2, turn, [cross st] x 9 (18)",
"Row 3: ch 2, turn, dc in each st across (18)"]},

{ name: "Picot edging", rows: [
"Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
"Row 2: ch 1, turn, [sc in next 4 sts, picot] x 5 (20)"]},

{ name: "Decrease-heavy crown shaping", rounds: true, rows: [
"Rnd 1: ch 48, sl st to join (48)",
"Rnd 2: [sc in next 6 sts, sc2tog] x 6 (42)",
"Rnd 3: [sc in next 5 sts, sc2tog] x 6 (36)",
"Rnd 4: [sc in next 4 sts, sc2tog] x 6 (30)",
"Rnd 5: [sc in next 3 sts, sc2tog] x 6 (24)"]},

{ name: "Extended stitch fabric", rows: [
"Row 1: ch 21, esc in 2nd ch from hook and in each ch across (20)",
"Row 2: ch 1, turn, esc in each st across (20)",
"Row 3: ch 1, turn, [esc in next 3 sts, inc in next st] x 5 (25)"]},

{ name: "Row range shorthand", rows: [
"Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
"Rows 2-10: ch 1, turn, sc in each st across (15)"]},

{ name: "Mixed repeat notation in one pattern", rows: [
"Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
"Row 2: ch 1, turn, (sc in next st, inc in next st) 6 times, sc in next 12 sts (30)",
"Row 3: ch 1, turn, *sc in next 4 sts, sc2tog; repeat from * across (25)"]},

{ name: "Linked double crochet fabric", rows: [
"Row 1: ch 21, ldc in 4th ch from hook and in each ch across (18)",
"Row 2: ch 2, turn, ldc in each st across (18)"]},

{ name: "Spike stitch colourwork", rows: [
"Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
"Row 2: ch 1, turn, [sc in next 3 sts, spike sc in next st] x 6 (24)"]}
];

function run(pat) {
    // Construction used to be forced here, to 'Rounds (Circular)' - not even one of the dropdown's
    // own option values; it only ever worked because worksInRounds does a substring test. It is read
    // off each pattern's own "Rnd"/"Row" labels now, which is what the `rounds` flag already recorded.
    // Each pattern is read in the convention it was written in; anything without one gets the app
    // default, which is what it has always had. See test-corpus-suite.js.
    $('meta-chain-space-convention').value = pat.chainSpace || 'count';
    $('meta-chain-space-convention').fire('change');
    $('bulk-input').value = pat.rows.join('\n');
    $('bulk-parse-btn').fire('click');
    var body = $('step-sequence-body').children, bad = [];
    body.forEach(function (tr, i) {
        if (tr.children.length < 6) return;              // note and section rows span the table
        var st = tr.children[5].innerHTML;
        var stated = String(tr.children[3].textContent).trim();
        var got = tr.children[4].innerHTML.replace(/<[^>]*>/g,'').trim().split(' ')[0];
        if (/FAIL/.test(st)) {
            bad.push({ row: i+1, stated: stated, got: got,
                why: st.replace(/<span class="math-reason">/g,' :: ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,100) });
            return;
        }
        // "Fully clean" means the row passed AND the number reported for it is the number the pattern
        // wrote. A disagreeing written count never fails a row, so the FAIL-only check called a corpus
        // clean while it displayed the wrong figure on every line - see test-corpus-suite.js.
        if (stated && stated !== '0' && got && stated !== got) {
            bad.push({ row: i+1, stated: stated, got: got,
                       why: 'passed, but the calculated count disagrees with the written one' });
        }
    });
    return { total: body.length, bad: bad };
}
var clean = 0;
PATTERNS.forEach(function (pat) {
    var r = run(pat);
    if (!r.bad.length) { clean++; print('PASS   ' + pat.name + '  (' + r.total + ' rows)'); }
    else { print('FAIL   ' + pat.name + '  (' + r.bad.length + ' of ' + r.total + ')');
           r.bad.forEach(function(b){ print('         row '+b.row+': stated '+b.stated+', got '+b.got+'  |  '+b.why); }); }
});
print('\n' + clean + ' of ' + PATTERNS.length + ' patterns fully clean');
