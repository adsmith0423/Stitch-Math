boot();
function cell(tr,i){ var c=tr.children[i]; return (c.innerHTML||'')+(c.textContent||''); }
function body(){ return $('step-sequence-body').children; }
function load(lines){ $('bulk-input').value=lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function pickSize(i){ $('meta-size').value=String(i); $('meta-size').fire('change'); }
function calc(r){ return cell(body()[r],4).replace(/<[^>]*>/g,'').trim().split(/\s/)[0]; }
function userTotal(r){ return cell(body()[r],3); }
function inst(r){ return cell(body()[r],1).replace(/<[^>]*>/g,'').trim(); }

print('\n1. The dangerous misread');
load(["Ch 52 (56), s c in 2nd st from hook, 1 s c in each remaining st of ch"]);
ck('mid-line (56) is a size, not a written count', userTotal(0), 0);
ck('  ... and the row still computes off 52', calc(0), 51);
// A single value at the very end of a row is a stitch count, because that is what "[sc, inc] x 3 (18)"
// means. A two-size pattern written "Ch 52 (56)" with nothing after it is genuinely ambiguous, and this is
// the side we take.
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across, [sc] x 3 (24)"]);
ck('a count after a multiplier survives', userTotal(0), 24);
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)"]);
ck('a real trailing count still reads', userTotal(0), 24);
load(["Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
      "Row 2: ch 1, turn, sc in each st across (12 loops)"]);
ck('"(12 loops)" still reads as a count', userTotal(1), 12);

print('\n2. Size switching substitutes the whole number');
load(["Ch 52 (56, 60)"]);
ck('Small  -> chain 52', calc(0), 52);
pickSize(1); ck('Medium -> chain 56', calc(0), 56);
pickSize(2); ck('Large  -> chain 60', calc(0), 60);
pickSize(0); ck('back to Small', calc(0), 52);

print('\n3. Size options come from the pattern');
ck('3 sizes detected', $('meta-size').innerHTML.match(/<option/g).length, 3);
ck('named Small/Medium/Large', /Small[\s\S]*Medium[\s\S]*Large/.test($('meta-size').innerHTML), true);
load(["ch 39 (39, 43, 43)"]);
ck('4 sizes detected', $('meta-size').innerHTML.match(/<option/g).length, 4);
ck('4 sizes named S/M/L/XL', /Small \(S\)[\s\S]*Medium \(M\)[\s\S]*Large \(L\)[\s\S]*X-Large \(XL\)/.test($('meta-size').innerHTML), true);
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)"]);
ck('single-size pattern resets the selector', $('meta-size').innerHTML.match(/<option/g).length, 1);

print('\n4. Row ranges with per-size endpoints');
load(["Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
      "ROWS 2-6 (8, 8, 10): ch 1, turn, sc in each st across"]);
ck('Small: rows 2-6 = 6 rows total', body().length, 6);
ck('size text does not leak into the row', /\(|\)/.test(inst(1)), false);
pickSize(3); ck('Size 4: rows 2-10 = 10 rows total', body().length, 10);
pickSize(0);

print('\n5. Mid-line size groups');
load(["Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
      "Row 2: ch 1, turn, sc in each of next 13 (15, 17) sts, sc2tog"]);
ck('Small consumes 13+2', calc(1), 14);
pickSize(1); ck('Medium consumes 15+2', calc(1), 16);
pickSize(0);

print('\n6. Sizing is read off the text, and the picker follows it');
// This section used to prove the opposite: that a "Sizing" dropdown set by hand outranked what the
// pattern said, sizeTypeManuallySet and all. The dropdown is gone. A pattern writing "52 (56, 60)"
// has already declared itself graded, and a box whose only remaining power was to contradict that
// was a way to get the wrong answer, not a setting. What is left is WHICH size to check.
function pickerHidden(){ return $('size-picker-group').classList.contains('hidden'); }
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)"]);
ck('a plain pattern hides the picker', pickerHidden(), true);
load(["Ch 52 (56, 60)"]);
ck('a graded pattern reveals it', pickerHidden(), false);
ck('sizes appear as the pattern writes them', $('meta-size').innerHTML.match(/<option/g).length, 3);
ck('and it validates the base size until told otherwise', calc(0), 52);
pickSize(2);
ck('the chosen size is what gets checked', calc(0), 60);
// Editing the sizes away takes the picker with them: the choice cannot outlive the thing it chose
// between, which is exactly the case the old manual flag got wrong.
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)"]);
ck('picker hidden again once the sizes go', pickerHidden(), true);
ck('and the count is the one size there is', calc(0), 24);
$('new-file-btn').fire('click');
load(["Ch 52 (56, 60)"]);
ck('new file still reads a graded pattern as graded', pickerHidden(), false);

endSuite();
