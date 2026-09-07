boot();
function rows(){ BLOBS.length=0; $('export-txt-btn').fire('click');
    return BLOBS[0].split('\n').filter(function(l){return /^Row \d+:/.test(l);}); }

$('project-name').value='RT';
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 2, turn, [dc in next 2 sts, dc-inc in next st] x 6 (24)",
 "Row 4: ch 1, turn, *sc in next 2 sts, sc2tog over next 2 sts; repeat from * across (18)",
 "Row 5-7: ch 1, turn, sc in each st across (18)"
].join("\n");
$('bulk-parse-btn').fire('click');
var out = rows();
print('Exported:');
out.forEach(function(l){ print('    ' + l); });

print('\nTyped text is preserved verbatim');
ck('R1 foundation', out[0], 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)');
ck('R2 keeps turning chain and x6', out[1], 'Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)');
ck('R3 keeps ch 2 turn', out[2], 'Row 3: ch 2, turn, [dc in next 2 sts, dc-inc in next st] x 6 (24)');
ck('R4 keeps asterisk repeat', out[3], 'Row 4: ch 1, turn, *sc in next 2 sts, sc2tog over next 2 sts; repeat from * across (18)');
ck('R5 range row keeps turning chain', out[4], 'Row 5: ch 1, turn, sc in each st across (18)');
ck('range expanded to 3 rows', out.length, 7);

print('\nCounts are still the calculated ones, not the typed ones');
$('bulk-input').value = "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (999)";
$('bulk-parse-btn').fire('click');
ck('typed 999 replaced by 12', rows()[0], 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)');

print('\nNo doubled label or count');
ck('single "Row 1:"', (rows()[0].match(/Row 1:/g)||[]).length, 1);
ck('single trailing count', (rows()[0].match(/\(\d+\)/g)||[]).length, 1);

print('\nRange rows keep their multiplier through syncBulkInput');
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2-3: ch 1, turn, [sc in next st, inc in next st] x 6 (18)"
].join("\n");
$('bulk-parse-btn').fire('click');
$('delete-last-btn').fire('click');   // triggers syncBulkInput
ck('x 6 survives the textarea rebuild', /x 6/.test($('bulk-input').value), true);

endSuite();
