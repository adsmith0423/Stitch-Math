boot();
function cell(tr,i){ var c=tr.children[i]; return (c.innerHTML||'')+(c.textContent||''); }
function body(){ return $('step-sequence-body').children; }
function load(l){ $('bulk-input').value=l.join('\n'); $('bulk-parse-btn').fire('click'); }
function calc(r){ return cell(body()[r],4).replace(/<[^>]*>/g,'').trim().split(/\s/)[0]; }
// There is no UI control for this any more; every call here is followed by load(), which reparses.
function mode(m){ CrochetMathEngine.setRepeatConvention(m); }
function series(){ return body().map(function(_,i){return calc(i);}).join(','); }

print('\n=== Mirror Mirror on the Ball (Aunt Lydia\'s, 1979) ===');
print('    verbatim, only the round labels shortened');
mode('inclusive');
load([
 "With White ch 2, 6 s c in 2nd st from hook",
 "2nd ROUND: 2 s c in each s c",
 "3rd ROUND: * 1 s c in next s c, 2 s c in next s c, repeat from * all around",
 "4th ROUND: * 1 s c in each of the next 2 s c, 2 s c in next s c, repeat from * all around",
 "5th ROUND: * 1 s c in each of the next 3 s c, 2 s c in next s c, repeat from * all around"
]);
ck('flat circle runs 6,12,18,24,30', series(), '6,12,18,24,30');

print('\n=== Rose Topper (Aunt Lydia\'s) ===');
load([
 "With Cerise ch 2, 8 s c in 1st st of ch",
 "2nd ROUND: 2 s c in each s c",
 "3rd ROUND: S c in next s c, 2 s c in next s c, repeat from beg all around (24 s c)"
]);
ck('8 -> 16 -> 24, matching the printed (24 s c)', series(), '8,16,24');

print('\n=== Xmas Bell (Aunt Lydia\'s) ===');
load([
 "With Red ch 2, 8 s c in 1st st of ch",
 "2nd ROUND: 2 s c in each s c",
 "3rd ROUND: 2 s c in next s c, 1 s c in next s c, repeat from beg all around (24 s c)",
 "4th ROUND: 1 s c in each s c",
 "5th ROUND: 1 s c in each of next 2 s c, 2 s c in next s c, repeat from beg all around (32 s c)"
]);
ck('8,16,24,24,32 as printed', series(), '8,16,24,24,32');

print('\n=== A Belle\'s Shell (Aunt Lydia\'s) - 3 sizes ===');
load(["BACK: Ch 52 (56, 60), s c in 2nd st from hook, 1 s c in each remaining st of ch"]);
ck('3 sizes offered', $('meta-size').innerHTML.match(/<option/g).length, 3);
ck('Small  -> 51 sts off ch 52', calc(0), 51);
$('meta-size').value='1'; $('meta-size').fire('change');
ck('Medium -> 55 sts off ch 56', calc(0), 55);
$('meta-size').value='2'; $('meta-size').fire('change');
ck('Large  -> 59 sts off ch 60', calc(0), 59);
$('meta-size').value='0'; $('meta-size').fire('change');

print('\n=== Miss Lambert (1847), spelled-out numbers ===');
load([
 "Commence with a chain of twenty-five stitches, sc in 2nd ch from hook and in each ch across",
 "Second row-sc in each st across",
 "Third row-sc in each st across"
]);
ck('chain of twenty-five -> 24 sts', calc(0), 24);
ck('ordinal row labels stripped, count holds', series(), '24,24,24');
mode('exact');

endSuite();
