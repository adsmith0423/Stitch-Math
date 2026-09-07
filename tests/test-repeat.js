boot();
function cell(tr,i){ var c=tr.children[i]; return (c.innerHTML||'')+(c.textContent||''); }
function body(){ return $('step-sequence-body').children; }
function load(lines){ $('bulk-input').value=lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function calc(r){ return cell(body()[r],4).replace(/<[^>]*>/g,'').trim().split(/\s/)[0]; }
// There is no UI control for this any more, so the convention is driven straight through the engine
// and the matrix is forced to re-read the already-loaded text against it.
function mode(m){ CrochetMathEngine.setRepeatConvention(m); $('bulk-parse-btn').fire('click'); }

var ROW = ["Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)",
           "Row 2: ch 1, turn, * sc in next st, repeat from * 5 times"];

print('\n1. "repeat from * 5 times"');
load(ROW);
mode('exact');     ck('modern  -> 5 sts consumed', calc(1), 5);
mode('inclusive'); ck('vintage -> 6 sts consumed', calc(1), 6);

print('\n2. "N more times" is N+1 under BOTH conventions');
load(["Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)",
      "Row 2: ch 1, turn, * sc in next st, repeat from * 5 more times"]);
mode('exact');     ck('modern  -> 6', calc(1), 6);
mode('inclusive'); ck('vintage -> 6', calc(1), 6);

print('\n3. once / twice / thrice follow the convention');
function words(q){ return ["Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)",
                           "Row 2: ch 1, turn, * sc in next st, repeat from * " + q]; }
mode('exact');
load(words('once'));  ck('modern once  -> 1', calc(1), 1);
load(words('twice')); ck('modern twice -> 2', calc(1), 2);
mode('inclusive');
load(words('once'));  ck('vintage once  -> 2', calc(1), 2);
load(words('twice')); ck('vintage twice -> 3', calc(1), 3);
load(words('thrice'));ck('vintage thrice-> 4', calc(1), 4);

print('\n4. Yellow Bud Ruffle rounds 6-8 must run 1, 2, 3');
mode('inclusive');
load(["Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)",
      "Row 2: ch 1, turn, sc in next st",
      "Row 3: ch 1, turn, * sc in next st, repeat from * once",
      "Row 4: ch 1, turn, * sc in next st, repeat from * twice"]);
ck('rnd 6 = 1', calc(1), 1); ck('rnd 7 = 2', calc(2), 2); ck('rnd 8 = 3', calc(3), 3);

print('\n5. The bracket form is exact under BOTH');
var BR = ["Row 1: ch 41, sc in 2nd ch from hook and in each ch across (40)",
          "Row 2: ch 1, turn, [sc in next st] x 4"];
mode('exact');     load(BR); ck('modern  [..] x4 -> 4', calc(1), 4);
mode('inclusive'); load(BR); ck('vintage [..] x4 -> 4', calc(1), 4);

print('\n7. A repeat whose body consumes nothing still repeats');
// The convention above was being skipped entirely by any body that COSTS nothing - chains, the
// foundation stitches, picot. expandAsteriskRepeats turned those away before reading the qualifier,
// which left them to expandBracketRepeats, and that reads '*' as an ordinary delimiter pair: it
// swallowed the "rep from" clause into the repeated text and took the number at face value. So
// "5 more times" ran five passes instead of six - correct-looking output, silently one short.
mode('exact');
function yieldOf(s) { return CrochetMathEngine.parseInstructions(s, 0).totalYield; }
ck('a chain-only repeat runs N+1', yieldOf('*ch 2; rep from * 5 more times'), 12);
ck('and reads a stated total as itself', yieldOf('*ch 2; rep from * 6 times'), 12);
// picot and the foundation stitches are the other zero-cost bodies this reached.
ck('a picot edging repeat', yieldOf('*ch 3, picot; rep from * 3 more times'), 12);
ck('a foundation-stitch repeat', yieldOf('*fsc; rep from * 9 more times'), 10);
// The bodies that always worked must be unmoved by the guard shifting.
ck('a body that costs something is unchanged', yieldOf('*sc; rep from * 5 more times'), 6);
ck('and a mixed body too', yieldOf('*dc in next st, ch 2; rep from * 5 more times'), 18);
// The guard did not vanish - it moved to the qualifiers that SIZE themselves by dividing the stitch
// pool, which a costless body cannot answer. Left unexpanded rather than divided by zero.
ck('"to end" on a costless body is left alone', yieldOf('*ch 2; rep from * across'), 2);
ck('and so is "to last st"', yieldOf('*ch 2; rep from * to last st'), 2);

print('\n6. "all around" is unaffected by the convention');
var AA = ["Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
          "Row 2: ch 1, turn, * sc in next st, repeat from * across"];
mode('exact');     load(AA); ck('modern  fills 20', calc(1), 20);
mode('inclusive'); load(AA); ck('vintage fills 20', calc(1), 20);
mode('exact');

endSuite();
