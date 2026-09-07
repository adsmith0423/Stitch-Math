boot();
function cell(tr,i){ var c=tr.children[i]; return (c.innerHTML||'')+(c.textContent||''); }
function body(){ return $('step-sequence-body').children; }
function load(lines){ $('bulk-input').value=lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function calc(r){ return cell(body()[r],4).replace(/<[^>]*>/g,'').trim().split(/\s/)[0]; }
function rowLabel(r){ return cell(body()[r],0).replace(/<[^>]*>/g,''); }
function inst(r){ return cell(body()[r],1).replace(/<[^>]*>/g,'').trim(); }

print('\n1. Word numbers');
load(["Commence with a chain of fourteen stitches"]);
ck('chain of fourteen -> 14', calc(0), 14);
load(["Row 1: chain twenty-five, sc in 2nd ch from hook and in each ch across"]);
ck('twenty-five -> 25 (24 after the skip)', calc(0), 24);
load(["Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
      "Row 2: ch 1, turn, sc in next twelve sts, sc2tog"]);
ck('twelve sts -> 12 sc + sc2tog = 13 made', calc(1), 13);

print('\n1b. "first"/"last" are positions, not numbers');
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
      "Row 2: ch 1, turn, sc in first 4 sts, [sc in next 3 sts, inc in next st] x 4, sc in last 4 sts (28)"]);
ck('"sc in first 4 sts" keeps all 4', calc(1), 28);
load(["Row 1: ch 25, sc in 2nd ch from hook and in each ch across (24)",
      "Row 2: ch 1, turn, sc in each of first 12 sts, sc in each of last 12 sts"]);
ck('"first 12" + "last 12" = 24', calc(1), 24);

print('\n2. Word numbers do not corrupt ordinary words');
load(["Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
      "Row 2: ch 1, turn, sc in each st across"]);
// The turning chain is shown as typed and marked as uncounted, so the cell reads back
// as the whole row. What this is really pinning is the word "across" arriving intact.
ck('"across" survives (not "a-cross")', inst(1), 'ch 1, turn, sc in each st across');
ck('row still totals 20', calc(1), 20);

print('\n3. Ordinal-first row labels');
load(["Chain 21, sc in 2nd ch from hook and in each ch across",
      "2nd Round. sc in each st across",
      "3rd Round. sc in each st across"]);
ck('"2nd Round." label stripped', inst(1), 'sc in each st across');
ck('and it still computes', calc(1), 20);
load(["Chain 21, sc in 2nd ch from hook and in each ch across",
      "Fourth row—sc in each st across"]);
ck('"Fourth row" stripped', inst(1), 'sc in each st across');
load(["Chain 21, sc in 2nd ch from hook and in each ch across",
      "8th and 9th Rows—sc in each st across"]);
ck('"8th and 9th Rows" spans 2 rows', body().length, 3);

print('\n4. Spaced-out American Thread stitch spellings');
load(["Ch 21, s c in 2nd st from hook, 1 s c in each remaining st of ch"]);
ck('"s c" reads as sc', calc(0), 20);
load(["Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
      "Row 2: ch 1, turn, 1 d c in each of the next 20 sts"]);
ck('"d c" reads as dc', calc(1), 20);
load(["Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
      "Row 2: ch 1, turn, 1 tr c in each of the next 20 sts"]);
ck('"tr c" reads as tr', calc(1), 20);
load(["Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
      "Row 2: ch 1, turn, 1 s d c in each of the next 20 sts"]);
ck('"s d c" reads as hdc', calc(1), 20);

endSuite();
