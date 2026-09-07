boot();
var PAT = [
"Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
"Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
"Row 3: ch 1, turn, [hdc in next 2 sts, puff in next st] x 6 (18)",
"Row 4: ch 2, turn, [dc in next 2 sts, dc-inc in next st] x 6 (24)",
"Row 5: ch 2, turn, [fpdc in next st, bpdc in next st] x 12 (24)",
"Row 6: ch 1, turn, [pc in next st, ch 1, sk 1 st] x 12 (24)",
"Row 7: ch 1, turn, [sc in next 3 sts/chs, inc in next st/ch] x 6 (30)",
"Row 8: ch 2, turn, [5 dc in next st, sk 2 sts] x 10 (50)",
"Row 9: ch 2, turn, [dc5tog over next 5 sts] x 10 (10)",
"Row 10: ch 1, turn, [inc in next st, sc in next st] x 5 (15)",
"Row 11: ch 1, turn, sc in next 3 sts, hdc in next 3 sts, dc in next 3 sts, tr in next 3 sts, dtr in final 3 sts (15)",
"Row 12: ch 1, turn, [BLO sc in next 4 sts, BLO inc in next st] x 3 (18)",
"Row 13: ch 1, turn, [sc2tog over next 2 sts, sc in next 4 sts] x 3 (15)",
"Row 14: ch 1, turn, [3-dc cl in next st, ch 1, sk 1 st, sc in next st] x 5 (15)",
"Row 15-20: ch 1, turn, sc in each st and ch-1 sp across (15)"
].join("\n");

$('bulk-input').value = PAT;
$('bulk-parse-btn').fire('click');

var body = $('step-sequence-body');
print('  #  | exp | got | ok | instruction / reason');
print('-----+-----+-----+----+--------------------------------------------');
var bad = 0;
body.children.forEach(function (tr, i) {
    var c = tr.children;
    var label = c[0].textContent;
    var instr = c[1].textContent;
    var exp   = c[3].textContent;
    var got   = c[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(' ')[0];
    var st    = c[5].innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    var ok    = st.indexOf('FAIL') === -1;
    if (!ok) bad++;
    print(
        (label + '        ').slice(0, 7) + '|' +
        ('   ' + exp).slice(-4) + ' |' +
        ('   ' + got).slice(-4) + ' | ' + (ok ? ' ' : 'X') + '  | ' +
        (ok ? instr.slice(0, 44) : st.slice(0, 90))
    );
});
print('\n' + bad + ' of ' + body.children.length + ' rows failed');
