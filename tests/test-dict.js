var E = window.CrochetMathEngine;
function row(instr, avail, expYield) {
    var r = E.evaluateStep(0, avail, instr, 1, expYield);
    return r.costIsValid && r.calculatedYield === expYield ? 'ok' : JSON.stringify(r);
}
function tokens(instr){ return E.parseInstructions(instr,0).tokens.map(function(t){return t.name;}).join(','); }

print('\nMulti-cost decreases inside a real row');
ck('hdc3tog then 7 hdc over 10',  row('hdc3tog, hdc x 7', 10, 8), 'ok');
ck('sc4tog then 6 sc over 10',    row('sc4tog, sc x 6', 10, 7), 'ok');
ck('dc5tog then 5 dc over 10',    row('dc5tog, dc x 5', 10, 6), 'ok');
ck('tr3tog pair over 6',          row('tr3tog x 2', 6, 2), 'ok');
ck('dtr2tog over 2',              row('dtr2tog', 2, 1), 'ok');

print('\nCrossed pairs consume and return two');
ck('3 cross st over 6',   row('cross st x 3', 6, 6), 'ok');
ck('crossed dc over 2',   row('crossed dc', 2, 2), 'ok');

print('\nPicot adds nothing to the stitch count');
ck('sc, picot, sc over 16', row('sc x 8, picot, sc x 8', 16, 16), 'ok');
ck('picot alone is inert',  row('picot', 0, 0), 'ok');

print('\nHigh-yield increases');
ck('5in1 over 1', row('5in1', 1, 5), 'ok');
ck('6in1 over 1', row('6in1', 1, 6), 'ok');

print('\nPost stitch ribbing');
ck('fpdc/bpdc rib over 8',  row('fpdc x 4, bpdc x 4', 8, 8), 'ok');
ck('fptr/bptr rib over 4',  row('fptr x 2, bptr x 2', 4, 4), 'ok');

print('\nFoundation rows consume nothing');
ck('fdtr 12 from nothing', row('fdtr 12', 0, 12), 'ok');
ck('foundation single crochet 20', row('foundation single crochet 20', 0, 20), 'ok');

print('\nAbbreviations are not shadowed by their shorter cousins');
ck('esc  -> esc',  tokens('esc'),  'esc');
ck('ssc  -> ssc',  tokens('ssc'),  'ssc');
ck('xdc  -> xdc',  tokens('xdc'),  'xdc');
ck('ldc  -> ldc',  tokens('ldc'),  'ldc');
ck('trtr -> trtr', tokens('trtr'), 'trtr');
ck('fptr -> fptr', tokens('fptr'), 'fptr');

print('\nLong names win over the short key inside them');
ck('front post double crochet', tokens('front post double crochet'), 'front post double crochet');
ck('spike sc beats spike',      tokens('spike sc'), 'spike sc');
ck('linked double crochet',     tokens('linked double crochet'), 'linked double crochet');
ck('extended single crochet',   tokens('extended single crochet'), 'extended single crochet');

print('\nUnknown tokens still rejected (no new key matches mid-word)');
var bad = E.evaluateStep(0, 10, 'sc x 5, mystitch, dc x 4', 1, 10);
ck('mystitch still unknown', bad.errorDetails.some(function(e){return e.type==='syntax';}), true);
ck('picotry not matched as picot', E.parseInstructions('picotry',0).unrecognizedTokens.length, 1);
ck('descent not matched as dec',   E.parseInstructions('descent',0).unrecognizedTokens.length, 1);

print('\nMixed complex row');
ck('post + cross + picot over 12', row('fpdc x 4, cross st x 2, picot, bpdc x 4', 12, 12), 'ok');

print('\nEvery priced stitch can also be read out in words');
// The Stitch Library panel names each stitch the pattern works. A key priced here but missing from the
// glossary would show up there as "not in the dictionary", exactly the wrong thing to say about a stitch
// the engine knows.
var glossary = E.STITCH_GLOSSARY;
var unglossed = Object.keys(E.STITCH_PRIMITIVES).filter(function (key) { return !glossary[key]; });
ck('no priced stitch is left undefined', unglossed.join(', ') || 'none', 'none');
var strayGlossary = Object.keys(glossary).filter(function (key) { return !E.STITCH_PRIMITIVES[key]; });
ck('and nothing is defined that cannot be counted', strayGlossary.join(', ') || 'none', 'none');
ck('every entry carries a term and an abbreviation',
   Object.keys(glossary).filter(function (key) {
       return !glossary[key].term || !glossary[key].abbr;
   }).length, 0);

// Spot checks against the Craft Yarn Council Crochet Abbreviations Master List
// (Standards & Guidelines p.1), Description column verbatim.
ck('ch',      glossary['ch'].term,      'chain stitch');
ck('sl st',   glossary['slst'].term,    'slip stitch');
ck('dc2tog',  glossary['dc2tog'].term,  'double crochet 2 stitches together');
ck('BPdc',    glossary['bpdc'].abbr,    'BPdc');
ck('pc',      glossary['pc'].term,      'popcorn stitch');
// ...and the line the list does not carry, which must not claim it does.
ck('picot is ours, not the Council\'s', glossary['picot'].cyc, false);
ck('so is the foundation family',       glossary['fsc'].cyc,   false);
ck('and the UK half treble',            glossary['htr'].cyc,   false);

endSuite();
