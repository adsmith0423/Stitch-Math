boot();
// increase, increase, no change, decrease
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 1, turn, [sc in next 2 sts, inc in next st] x 6 (24)",
 "Row 4: ch 1, turn, sc in each st across (24)",
 "Row 5: ch 1, turn, [sc in next 2 sts, sc2tog] x 6 (18)"
].join("\n");
$('bulk-parse-btn').fire('click');
var cells = $('step-sequence-body').children.map(function(tr){ return tr.children[4].innerHTML; });
cells.forEach(function(c,i){ print('   Row '+(i+1)+': '+c.replace(/\s+/g,' ')); });

print('');
ck('row 1 is Base', /trend-badge trend-base"[^>]*>Base</.test(cells[0]), true);
ck('row 2 is an increase', /trend-badge trend-up"[^>]*>▲ \+6</.test(cells[1]), true);
ck('row 3 is an increase', /trend-up/.test(cells[2]), true);
ck('row 4 is flat', /trend-badge trend-flat"[^>]*>▶ 0</.test(cells[3]), true);
ck('row 5 is a decrease', /trend-badge trend-down"[^>]*>▼ -6</.test(cells[4]), true);
ck('no inline colour on the badges', /(background|color)\s*:/.test(cells.join('')), false);
ck('titles kept for accessibility', /title="Increased by 6"/.test(cells[1]), true);
endSuite();
