boot();
function has(l,t,n){ if(String(t).indexOf(n)!==-1){print('  PASS  '+l);p++;} else {print('  FAIL  '+l+'\n         missing: '+n);f++;} }
function lacks(l,t,n){ if(String(t).indexOf(n)===-1){print('  PASS  '+l);p++;} else {print('  FAIL  '+l+'\n         should not contain: '+n);f++;} }
function exp(){ BLOBS.length=0; $('export-txt-btn').fire('click'); return BLOBS[0]; }

$('project-name').value = 'Test';
$('gauge-width').value='4'; $('gauge-height').value='4';
$('gauge-stitches').value='16'; $('gauge-rows').value='20'; $('gauge-unit').value='in';
$('gauge-hook-size').value='4.0mm (G)';
$('swatch-weight').value='15'; $('swatch-weight-unit').value='g';
$('gauge-notes').value='blocked';

$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (99)",
 "Row 3: ch 1, turn, [hdc in next 2 sts, puff in next st] x 6 (18)"
].join("\n");
$('bulk-parse-btn').fire('click');
var ok = exp();

print('\nGauge section, placed after metadata');
has('section header', ok, 'GAUGE & SWATCH:');
ck('sits after METADATA', ok.indexOf('METADATA:') < ok.indexOf('GAUGE & SWATCH:'), true);
has('swatch dimensions', ok, '16 sts x 20 rows over 4 x 4 in');
has('stitch density + normalised', ok, '4.00 sts per in (16.00 per 4 in)');
has('row density', ok, '5.00 rows per in (20.00 per 4 in)');
has('hook', ok, '- Hook / Needle: 4.0mm (G)');
has('swatch weight', ok, '- Swatch Weight: 15 g');
has('notes', ok, '- Notes: blocked');

print('\nValidation section, placed under gauge');
has('section header', ok, 'VALIDATION RESULTS:');
ck('sits after GAUGE', ok.indexOf('GAUGE & SWATCH:') < ok.indexOf('VALIDATION RESULTS:'), true);
has('status', ok, '- Status: VALID');
has('rows passed', ok, '- Rows Passed: 3 / 3');
has('total stitches', ok, '- Total Stitches: 48');
lacks('no Issues block when clean', ok, 'Issues:');
has('adjusted counts listed', ok, '- Row 2: written 99, calculated 18');

print('\nNo broken-pattern note on a valid pattern');
lacks('note absent', ok, 'this file has been updated');

// --- broken ---
$('bulk-input').value = [
 "Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)",
 "Row 2: ch 1, turn, [sc in next st, inc in next st] x 6 (18)",
 "Row 3: ch 1, turn, sc x 60 (60)",
 "Row 4: ch 1, turn, sc in each st across (18)"
].join("\n");
$('bulk-parse-btn').fire('click');
var bad = exp();

print('\nBroken pattern');
has('the note appears', bad, 'Note: this file has been updated to show correct final stitch count.');
ck('note sits directly above the rows', bad.indexOf('this file has been updated') < bad.indexOf('Row 1:'), true);
has('status counts failures', bad, '- Status: 1 row to fix');
has('blocked reported', bad, '- Rows Blocked: 1 (waiting on Row 3)');
has('issues block present', bad, 'Issues:');
has('failed row detail', bad, '- Row 3: Requires 60 stitches, but only 18 are available.');
has('fix line', bad, '    Fix:');
has('blocked row detail', bad, '- Row 4: blocked - fix Row 3 first.');
ck('cause named once in Issues', (bad.match(/only 18 are available/g)||[]).length, 1);

print('\nGauge section omitted when no swatch measured');
$('gauge-stitches').value=''; $('gauge-stitches').fire('input');
var noGauge = exp();
lacks('no gauge header', noGauge, 'GAUGE & SWATCH:');
has('validation still present', noGauge, 'VALIDATION RESULTS:');

endSuite();
