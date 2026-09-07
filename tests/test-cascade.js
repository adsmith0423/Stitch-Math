boot();

// The flat "VALID" banner was replaced by the health panel; assert its semantics.
function mathCheckState(){
    var m = $('cumulative-status').innerHTML.match(/check-(pass|warn|fail)"><span class="check-icon">[^<]*<\/span><span class="check-name">Stitch math</);
    return m ? m[1] : null;
}
function healthScore(){
    var m = $('cumulative-status').innerHTML.match(/health-number">(\d+)</);
    return m ? +m[1] : null;
}

// Row 4 over-consumes (needs 60 from a 36-stitch row). Rows 5+ are only wrong
// because of Row 4, and Row 6 carries a deliberately wrong written count.
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 1, turn, [hdc in next 2 sts, puff in next st] x 6 (18)",
 "Row 4: ch 1, turn, sc x 60 (60)",
 "Row 5: ch 1, turn, sc in each st across (18)",
 "Row 6: ch 1, turn, sc in each st across (999)"
].join("\n");
$('bulk-parse-btn').fire('click');

var rows = $('step-sequence-body').children;
function cell(i){ return rows[i].children[5].innerHTML; }
function cls(i){ return rows[i].className; }

print('\nStatuses');
ck('R1 passes', /✓/.test(cell(0)) && cls(0) === 'row-passed', true);
ck('R3 passes', /✓/.test(cell(2)) && cls(2) === 'row-passed', true);
ck('R4 is the one failure', /✗ FAIL/.test(cell(3)) && cls(3) === 'row-failed', true);
ck('R5 blocked, not failed', /BLOCKED/.test(cell(4)) && cls(4) === 'row-blocked', true);
ck('R6 blocked, not failed', /BLOCKED/.test(cell(5)) && cls(5) === 'row-blocked', true);

print('\nThe cause is named once, not repeated');
ck('R5 names Row 4', /Fix the error on Row 4/.test(cell(4)), true);
ck('R6 names Row 4', /Fix the error on Row 4/.test(cell(5)), true);
var all = [0,1,2,3,4,5].map(cell).join(' ');
ck('"are available" appears exactly once', (all.match(/are available/g) || []).length, 1);
ck('no FAIL after row 4', /FAIL/.test(cell(4) + cell(5)), false);

print('\nBlocked rows are not counted as passed');
var summary = $('cumulative-status').innerHTML;
ck('3 of 6 passed', /Passed:<\/strong> 3 \/ 6/.test(summary), true);
ck('blocked reported separately', /Blocked:<\/strong> 2 \(waiting on Row 4\)/.test(summary), true);
ck('stitch math reports 1 failing row', /1 row does not add up/.test(summary), true);

print('\nAdvisory count on a passing row');
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (99)"
].join("\n");
$('bulk-parse-btn').fire('click');
rows = $('step-sequence-body').children;
ck('row still passes with a wrong count', /✓/.test(cell(1)) && cls(1) === 'row-passed', true);
ck('no FAIL', /FAIL/.test(cell(1)), false);
ck('note is shown', /math-note/.test(cell(1)), true);
ck('note text', /Written count 99, calculated 18 \(-81\)/.test(cell(1)), true);
ck('stitch math still passes', mathCheckState(), 'pass');
ck('health score is perfect', healthScore(), 100);

print('\nMatching counts stay silent');
$('bulk-input').value = "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)";
$('bulk-parse-btn').fire('click');
ck('no note when counts agree', /math-note/.test($('step-sequence-body').children[0].children[5].innerHTML), false);

endSuite();
