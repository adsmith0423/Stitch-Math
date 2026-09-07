boot();
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 1, turn, [hdc in next 2 sts, puff in next st] x 6 (18)"
].join("\n");
$('bulk-parse-btn').fire('click');

print('Stat cards still wired after the markup change');
ck('total stitches populated', /^[0-9,]+$/.test($('stat-total-stitches').textContent), true);
ck('difficulty populated', $('stat-difficulty').textContent.length > 0, true);
ck('badge colour is a brand token', /^var\(--/.test($('stat-difficulty').style.backgroundColor), true);

print('\nComplexity bars use the category classes');
var cx = $('complexity-content').innerHTML;
// Special stitches moved out of the bars and into the dashboard as a plain count, so
// only three categories are drawn as bars now.
['bar-repetitive','bar-texture','bar-shaping'].forEach(function(c){
    ck(c + ' present', cx.indexOf(c) !== -1, true);
});
ck('special is no longer a bar', cx.indexOf('bar-special') === -1, true);
ck('it is a dashboard counter instead', /id="stat-special"/.test(readFile('index.html')), true);
ck('no raw hex in complexity markup', /#[0-9a-f]{3,6}/i.test(cx), false);

print('\nHealth panel and math cells carry no raw hex');
ck('health panel clean', /#[0-9a-f]{3,6}/i.test($('cumulative-status').innerHTML), false);
var cells = $('step-sequence-body').children.map(function(tr){ return tr.children[5].innerHTML; }).join('');
ck('math check cells clean', /#[0-9a-f]{3,6}/i.test(cells), false);

endSuite();
