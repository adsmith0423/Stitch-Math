boot();
var PAT = [
"Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
"Row 2: ch 1, turn, sc in first 4 sts, [sc in next 3 sts, inc in next st] x 4, sc in last 4 sts (28)",
"Row 3: ch 1, turn, (inc in next st, sc in next st) 4 times, sc in next 12 sts, (sc in next st, inc in next st) 4 times (36)",
"Row 4: ch 2, turn, *hdc in next 2 sts, hdc-inc in next st; repeat from * across (48)",
"Row 5: ch 1, turn, [(sc in next 2 sts, inc in next st) 2 times, sc in next 2 sts] x 6 (60)",
"Row 6: ch 1, turn, *sc in next 3 sts, sc2tog over next 2 sts; repeat from * 3 times total, [sc in next 3 sts, sc2tog over next 2 sts] x 6, (sc in next 3 sts, sc2tog over next 2 sts) 3 times (48)",
"Row 7: ch 2, turn, [3-dc cl in next st, ch 1, sk 1 st] x 23, sc in last 2 sts (48)",
"Row 8: ch 1, turn, *(sc in next st/sp, [inc in next st/sp, sc in next 2 sts/sps] x 2) 3 times; repeat from * 1 more time, sc in last 6 sts/sps (60)",
"Row 9: ch 1, turn, [sc2tog over next 2 sts, sc in next 3 sts] x 4, sc in next 10 sts, [sc in next 3 sts, sc2tog over next 2 sts] x 4, sc in last 10 sts (52)",
"Row 10: ch 1, turn, *sc in next 2 sts, (hdc, dc, hdc) in next st, sc in next 2 sts; repeat from * to last 2 sts, sc in last 2 sts (72)"
].join("\n");
$('bulk-input').value = PAT;
$('bulk-parse-btn').fire('click');
var bad = 0;
// See test-corpus-pattern.js: a passing row whose calculated count disagrees with the written one is
// its own fault, and counting only failures hides it completely.
var miscount = 0;
print(' #  |exp |got | ok');
print('----+----+----+---------------------------------------------');
$('step-sequence-body').children.forEach(function (tr, i) {
    var c = tr.children;
    var exp = c[3].textContent;
    var got = c[4].innerHTML.replace(/<[^>]*>/g,'').trim().split(' ')[0];
    var st  = c[5].innerHTML.replace(/<span class="math-reason">/g,' :: ').replace(/<span class="math-fix">/g,' >> ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    var ok  = st.indexOf('FAIL') === -1;
    if (!ok) bad++;
    else if (c.length >= 6 && exp && exp.trim() !== '0' && got && exp.trim() !== got) miscount++;
    print(('R'+(i+1)+'    ').slice(0,4)+'|'+('   '+exp).slice(-4)+'|'+('   '+got).slice(-4)+'| '+(ok?'ok':'XX  '+st.slice(0,120)));
});
print('\n'+bad+' of '+$('step-sequence-body').children.length+' rows failed, '+miscount+' miscounted');
