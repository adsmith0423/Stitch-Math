var p=0,f=0; var E = window.CrochetMathEngine;
function cost(i,a){ return E.parseInstructions(i,a).totalCost; }
function yld(i,a){ return E.parseInstructions(i,a).totalYield; }

print('\nJoining slip stitches are structural, not stitches');
ck('"ch 30, sl st to join" costs 0', cost("ch 30, sl st to join", 0), 0);
ck('"ch 30, sl st to join" yields 30', yld("ch 30, sl st to join", 0), 30);
ck('"join with sl st" costs 0', cost("sc in each st around, join with sl st", 20), 20);
ck('"sl st to top of ch-3" costs 0', cost("dc in each st around, sl st to top of ch-3", 20), 20);
ck('"sl st in first sc" costs 0', cost("sc in each st around, sl st in first sc", 20), 20);
ck('"sl st to form a ring" costs 0', cost("ch 6, sl st to form a ring", 0), 0);

print('\nWorking slip stitches are still counted');
ck('"sl st in next st" costs 1', cost("sl st in next st", 5), 1);
ck('"sl st in each st across" consumes the row', cost("sl st in each st across", 12), 12);
ck('"sl st in next 4 sts" costs 4', cost("sl st in next 4 sts", 8), 4);
ck('bare "slst" still costs 1', cost("slst", 5), 1);

endSuite();
