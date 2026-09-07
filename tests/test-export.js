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

$('bulk-input').value = [
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
"Row 11-13: ch 1, turn, sc in each st across (15)"
].join("\n");
$('bulk-parse-btn').fire('click');

// Calculated counts straight off the on-screen table, to compare against.
var onScreen = $('step-sequence-body').children.map(function (tr) {
    return tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(' ')[0];
});

BLOBS.length = 0;
$('export-txt-btn').fire('click');
ck('a file was produced', BLOBS.length, 1);

var lines = BLOBS[0].split('\n').filter(function (l) { return /^Row \d+:/.test(l); });
print('\nExported rows:');
lines.forEach(function (l) { print('    ' + l); });

ck('one line per table row', lines.length, onScreen.length);

print('\nEvery row ends with its calculated count');
var allMatch = true, anyMissing = false;
lines.forEach(function (line, i) {
    var m = line.match(/\((\d+)\)\s*$/);
    if (!m) { anyMissing = true; return; }
    if (m[1] !== onScreen[i]) allMatch = false;
});
ck('no row missing a count', anyMissing, false);
ck('every count matches the table', allMatch, true);

print('\nSpecific rows');
ck('R1 foundation row', /^Row 1: .*\(12\)$/.test(lines[0]), true);
ck('R2 bracket repeat', /\(18\)$/.test(lines[1]), true);
ck('R8 fan row', /\(50\)$/.test(lines[7]), true);
ck('R9 collapse row', /\(10\)$/.test(lines[8]), true);
ck('range rows all expanded to 15', lines.slice(10).every(function(l){return /\(15\)$/.test(l);}), true);
ck('range produced 3 rows', lines.length, 13);
ck('stitch math passes for the whole pattern', mathCheckState(), 'pass');

print('\nNo doubled counts from the written estimate');
ck('no "(18) (18)" style duplication', /\(\d+\)\s*\(\d+\)/.test(BLOBS[0]), false);

print('\nPrint table agrees with the on-screen table');
var printed = $('print-table-body').children.map(function (tr) {
    return tr.innerHTML.replace(/<[^>]*>/g, '|').split('|').filter(Boolean).pop().trim();
});
ck('print counts match table counts', JSON.stringify(printed), JSON.stringify(onScreen));

endSuite();
