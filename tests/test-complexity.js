var A = window.CrochetAnalyticsEngine, E = window.CrochetMathEngine;
function pct(totals){ return A.AnalyzeComplexity(totals).percentages; }
function sum(o){ return o.repetitive + o.texture + o.shaping + o.special; }

print('\nPure categories');
ck('all sc is 100% repetitive', pct({sc:100}).repetitive, 100);
ck('all puff is 100% texture', pct({puff:50}).texture, 100);
ck('all inc is 100% shaping', pct({inc:50}).shaping, 100);
ck('all fsc is 100% special', pct({fsc:50}).special, 100);

print('\nMixed pattern splits by stitch share');
var mix = pct({ sc: 82, puff: 10, inc: 6, picot: 2 });
ck('repetitive 82%', mix.repetitive, 82);
ck('texture 10%', mix.texture, 10);
ck('shaping 6%', mix.shaping, 6);
ck('special 2%', mix.special, 2);

print('\nPercentages always total exactly 100');
[ {sc:1,puff:1,inc:1},                    // thirds
  {sc:1,puff:1,inc:1,picot:1},            // quarters
  {sc:7,puff:7,inc:7},                    // repeating decimal
  {sc:1},                                 // single category
  {sc:333,puff:333,inc:333,picot:1}
].forEach(function(t, i){
    ck('case '+(i+1)+' sums to 100', sum(pct(t)), 100);
});

print('\nEdge cases');
ck('empty totals give zeros', sum(pct({})), 0);
ck('unknown stitch counts as special', pct({mysteryst:10}).special, 100);

print('\nPost stitches are texture, tall trebles are repetitive');
ck('fpdc is texture', pct({fpdc:10}).texture, 100);
ck('dtr is repetitive', pct({dtr:10}).repetitive, 100);
ck('dc5tog is shaping', pct({dc5tog:10}).shaping, 100);
ck('3in1 is shaping', pct({'3in1':10}).shaping, 100);

endSuite();
