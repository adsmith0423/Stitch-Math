boot();
function has(l,t,n){ if(String(t).indexOf(n)!==-1){print('  PASS  '+l);p++;} else {print('  FAIL  '+l+'\n         missing: '+n);f++;} }
function exp(){ BLOBS.length=0; $('export-txt-btn').fire('click'); return BLOBS[0] || ''; }

$('project-name').value='Health Export';
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 1, turn, [hdc in next 2 sts, puff in next st] x 6 (18)"
].join("\n");
$('bulk-parse-btn').fire('click');
var t = exp();
print(t.slice(t.indexOf('VALIDATION RESULTS'), t.indexOf('STITCHES USED')));

print('Sections present and ordered');
has('health header', t, 'PATTERN HEALTH:');
has('complexity header', t, 'TECHNICAL COMPLEXITY:');
ck('health after validation', t.indexOf('VALIDATION RESULTS:') < t.indexOf('PATTERN HEALTH:'), true);
ck('complexity after health', t.indexOf('PATTERN HEALTH:') < t.indexOf('TECHNICAL COMPLEXITY:'), true);
ck('both before stitches used', t.indexOf('TECHNICAL COMPLEXITY:') < t.indexOf('STITCHES USED'), true);

print('\nHealth content');
has('score out of 100', t, '/ 100');
has('stitch math check', t, '- Stitch math: pass');
has('terminology check', t, '- Terminology: pass');
has('formatting check', t, '- Formatting: pass');

print('\nComplexity content');
has('repetitive line', t, '- Repetitive:');
has('texture line', t, '- Texture:');
has('shaping line', t, '- Shaping:');
has('special line', t, '- Special stitches:');
has('overall level retained', t, '- Overall Level:');
var pcts = (t.match(/- (?:Repetitive|Texture|Shaping|Special stitches): (\d+)%/g)||[])
    .map(function(l){ return +l.match(/(\d+)%/)[1]; });
ck('four percentages', pcts.length, 4);
ck('they total 100', pcts.reduce(function(a,b){return a+b;},0), 100);

print('\nBroken pattern carries warnings into the export');
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: sc x 60 (60)"
].join("\n");
$('bulk-parse-btn').fire('click');
var b = exp();
has('stitch math FAIL', b, '- Stitch math: FAIL');
has('a warning line', b, '- Warning:');

print('\nNo pattern -> no file at all');
$('bulk-input').value = '';
$('bulk-parse-btn').fire('click');
ck('export is a no-op', exp(), '');

endSuite();
