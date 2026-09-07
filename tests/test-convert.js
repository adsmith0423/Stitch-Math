boot();
function has(l,n){ var t=out(); if(t.indexOf(n)!==-1){print('  PASS  '+l);p++;} else {print('  FAIL  '+l+'\n         missing: '+n+'\n         in: '+t);f++;} }
function out(){ return $('gauge-conversion-output').innerHTML.replace(/\s+/g,' ').trim(); }
function setv(id,v){ $(id).value=String(v); $(id).fire('input'); }
function pick(id,v){ $(id).value=String(v); $(id).fire('change'); }

print('\n1. Same unit is unchanged from before');
setv('gauge-width',2); setv('gauge-height',2); setv('gauge-stitches',8); setv('gauge-rows',10);
pick('gauge-unit','in'); pick('gauge-convert-size','4');
has('16.0 sts', '<strong>16.0</strong> sts');
has('20.0 rows', '<strong>20.0</strong> rows');
has('target labelled in', '4 × 4 in');

print('\n2. cm measurement converted to inches');
setv('gauge-width',10); setv('gauge-height',10); setv('gauge-stitches',20); setv('gauge-rows',30);
pick('gauge-unit','cm');
ck('unit followed the gauge', $('gauge-convert-unit').value, 'cm');
pick('gauge-convert-unit','in'); pick('gauge-convert-size','4');
// 20 sts / 10 cm = 2 sts/cm -> 5.08 sts/in -> x4 = 20.3
has('20.3 sts over 4 in', '<strong>20.3</strong> sts');
has('30.5 rows', '<strong>30.5</strong> rows');
has('names both units', 'Scaled from 10 × 10 cm to <strong>4 × 4 in</strong>');

print('\n3. Inches measurement converted to cm');
setv('gauge-width',4); setv('gauge-height',4); setv('gauge-stitches',16); setv('gauge-rows',20);
pick('gauge-unit','in'); pick('gauge-convert-unit','cm'); pick('gauge-convert-size','10');
// 16 sts / 4 in = 4 sts/in -> 1.5748 sts/cm -> x10 = 15.7
has('15.7 sts over 10 cm', '<strong>15.7</strong> sts');
has('names both units', 'Scaled from 4 × 4 in to <strong>10 × 10 cm</strong>');

print('\n4. Round trip returns the original figure');
pick('gauge-convert-unit','in'); pick('gauge-convert-size','4');
has('back to 16.0 sts', '<strong>16.0</strong> sts');

print('\n5. Explicit choice is not overwritten by the gauge unit');
pick('gauge-convert-unit','cm');
pick('gauge-unit','in');
ck('override held', $('gauge-convert-unit').value, 'cm');
$('new-file-btn').fire('click');
ck('new file clears the override', $('gauge-convert-unit').value, 'in');

print('\n6. Conversion is display-only');
setv('gauge-width',10); setv('gauge-height',10); setv('gauge-stitches',20); setv('gauge-rows',30);
pick('gauge-unit','cm'); pick('gauge-convert-unit','in'); pick('gauge-convert-size','4');
ck('density card still in cm', /\/ 10 cm/.test($('density-stitches').textContent), true);
$('calc-skein-weight').value='100'; $('calc-skein-length').value='220';
$('stat-total-stitches').textContent='1000';
$('btn-calculate-gauge').fire('click');
ck('logged swatch keeps cm', $('swatch-history-body').children[0].children[3].textContent, 'cm');

endSuite();
