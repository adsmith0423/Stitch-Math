
var swatch = { width:4, height:4, stitches:16, rows:20, unit:'in', weight:15, weightUnit:'g' };
var skein  = { weight:100, weightUnit:'g', length:220, lengthUnit:'yd' };

print('\nWeight-based estimate (15 g swatch, 16x20 = 320 sts, 4800 st project)');
var r = window.CrochetMathEngine.calculateYardage(4800, swatch, skein);
// 15/320 = 0.046875 g per stitch; * 4800 = 225 g; /100 g skein = 2.25 skeins
ck('grams per stitch', r.byWeight.gramsPerStitch, '0.0469');
ck('total grams',      r.byWeight.totalWeightGrams, 225);
ck('total ounces',     r.byWeight.totalWeightOunces, (225*0.035274).toFixed(2));
ck('exact skeins',     r.byWeight.skeins.exact, '2.25');
ck('skeins to buy',    r.byWeight.skeins.recommendedPurchase, 3);
ck('yards by weight',  r.byWeight.totalLengthYards, Math.ceil(2.25*220));

print('\nOunce swatch converts to grams');
var oz = window.CrochetMathEngine.calculateYardage(4800,
    { width:4, height:4, stitches:16, rows:20, weight:15/28.3495, weightUnit:'oz' }, skein);
ck('matches the gram result', oz.byWeight.totalWeightGrams, 225);

print('\nOptional: omitted / zero / missing weight yields null');
ck('no weight key', window.CrochetMathEngine.calculateYardage(4800,
    { width:4,height:4,stitches:16,rows:20 }, skein).byWeight, null);
ck('zero weight', window.CrochetMathEngine.calculateYardage(4800,
    { width:4,height:4,stitches:16,rows:20, weight:0, weightUnit:'g' }, skein).byWeight, null);

print('\nLength-based estimate is unchanged by the new block');
ck('legacy yards',  r.imperial.totalLengthYards, Math.ceil((4800/16)*4*12/36));
ck('legacy skeins', r.skeins.recommendedPurchase, Math.ceil(((4800/16)*4*12/36)/220));

endSuite();
