// Drives the real app.js gauge code paths through the DOM stub.
/** Substring assertion, kept local because its FAIL text is the useful one here: against a long
 *  innerHTML what you need to see is the needle, not the whole haystack quoted back as "expected".
 *  It reports through the shared counters like everything else. */
function contains(label, haystack, needle) {
    if (String(haystack).indexOf(needle) !== -1) { print('  PASS  ' + label); p++; }
    else { print('  FAIL  ' + label + '\n         "' + needle + '" not in: ' + haystack); f++; }
}
function setVal(id, v) { $(id).value = String(v); $(id).fire('input'); }
function convOut() { return $('gauge-conversion-output').innerHTML.replace(/\s+/g, ' ').trim(); }
function rows() { return $('swatch-history-body').children; }

boot();

print('\n1. Conversion works with no button press');
setVal('gauge-width', 2); setVal('gauge-height', 2);
setVal('gauge-stitches', 8); setVal('gauge-rows', 10);
contains('measured line shown by default', convOut(), '8</strong> sts');
contains('measured size echoed', convOut(), '2 × 2 in');

print('\n2. 2x2 -> 4x4 and 6x6 conversion');
$('gauge-convert-size').value = '4'; $('gauge-convert-size').fire('change');
contains('4x4 stitches', convOut(), '<strong>16.0</strong> sts');
contains('4x4 rows', convOut(), '<strong>20.0</strong> rows');
contains('4x4 target labelled', convOut(), '4 × 4 in');
$('gauge-convert-size').value = '6'; $('gauge-convert-size').fire('change');
contains('6x6 stitches', convOut(), '<strong>24.0</strong> sts');
contains('6x6 rows', convOut(), '<strong>30.0</strong> rows');
$('gauge-convert-size').value = '8'; $('gauge-convert-size').fire('change');
contains('8x8 stitches', convOut(), '<strong>32.0</strong> sts');
contains('8x8 rows', convOut(), '<strong>40.0</strong> rows');
contains('8x8 target labelled', convOut(), '8 \u00d7 8 in');
$('gauge-convert-size').value = '6'; $('gauge-convert-size').fire('change');

print('\n3. Unit select follows through');
$('gauge-unit').value = 'cm'; $('gauge-unit').fire('change');
contains('cm label', convOut(), '6 × 6 cm');
$('gauge-unit').value = 'in'; $('gauge-unit').fire('change');

print('\n4. Non-square swatch scales each axis independently');
setVal('gauge-width', 2); setVal('gauge-height', 4);
setVal('gauge-stitches', 9); setVal('gauge-rows', 12);
$('gauge-convert-size').value = '4'; $('gauge-convert-size').fire('change');
contains('width axis doubled', convOut(), '<strong>18.0</strong> sts');
contains('height axis unchanged', convOut(), '<strong>12.0</strong> rows');

print('\n5. Incomplete gauge shows the prompt, not NaN');
setVal('gauge-stitches', '');
contains('placeholder restored', convOut(), 'Enter swatch size');

print('\n6. Gauge alone needs no skein data');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 20);
$('gauge-hook-size').value = '4.0mm (G)'; $('gauge-hook-size').fire('input');
$('gauge-notes').value = 'blocked, held double'; $('gauge-notes').fire('input');
ALERTS.length = 0;
$('btn-calculate-gauge').fire('click');
// Skein weight and length answer "how much yarn do I buy", not "what is my gauge".
// Demanding them here produced a nag and an empty results panel.
ck('no alert at all', ALERTS.join(' | '), '');
ck('the swatch is logged', rows().length, 1);
contains('and the density is shown', $('gauge-results-content').innerHTML, 'Stitch Density');
contains('row density too', $('gauge-results-content').innerHTML, 'Row Density');
ck('with no yardage section', $('gauge-results-content').innerHTML.indexOf('Recommended Skeins') === -1, true);

print('\n7. Hook and notes reach the history row');
// Column order: Remove | Yarn | Hook | Unit | Gauge | Converted | Notes | Date.
var cells = rows()[0].children.map(function (c) { return c.textContent; });
ck('hook column', cells[2], '4.0mm (G)');
ck('gauge column', cells[4], '16/20');
ck('notes column', cells[6], 'blocked, held double');
contains('remove button leads the row', rows()[0].children[0].innerHTML, 'window.removeSwatch(0)');
ck('and the date closes it', /\d/.test(cells[7]), true);
ck('the date is not still in the first cell', /\d{4}|\d+\/\d+/.test(cells[0]), false);
contains('header leads with a blank column', readFile('index.html'), '<thead><tr><th></th><th>Yarn</th>');
contains('header ends with Date', readFile('index.html'), '<th>Notes</th><th>Date</th></tr></thead>');

print('\n8. Remove deletes only the targeted swatch');
$('gauge-hook-size').value = '5.0mm (H)'; $('gauge-hook-size').fire('input');
setVal('gauge-stitches', 14);
$('btn-calculate-gauge').fire('click');
ck('two swatches logged', rows().length, 2);
ck('newest is first', rows()[0].children[2].textContent, '5.0mm (H)');
window.removeSwatch(0);
ck('one row left', rows().length, 1);
ck('the surviving row is the older one', rows()[0].children[2].textContent, '4.0mm (G)');
contains('current-swatch card re-pointed', $('active-swatch-content').text(), '4.0mm (G)');

print('\n9. Notes survive save/new/load (fix 2)');
$('project-name').value = 'roundtrip';
$('bulk-input').value = 'sc x 16';
$('gauge-hook-size').value = '3.5mm (E)'; // typed, never blurred, no numeric field touched
$('gauge-notes').value = 'tight tension';
$('save-btn').fire('click');
$('new-file-btn').fire('click');
ck('new file cleared hook', $('gauge-hook-size').value, '');
ck('new file cleared notes', $('gauge-notes').value, '');
$('load-select').value = 'roundtrip';
$('load-btn').fire('click');
ck('hook restored', $('gauge-hook-size').value, '3.5mm (E)');
ck('notes restored', $('gauge-notes').value, 'tight tension');

print('\n10. Removing the last swatch falls back cleanly');
while (rows().length) window.removeSwatch(0);
contains('empty-state message', $('active-swatch-content').innerHTML, 'No swatch recorded');

print('\n11. Swatch weight flows end-to-end into Gauge Results');
$('new-file-btn').fire('click');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 20);
setVal('swatch-weight', 15);
$('swatch-weight-unit').value = 'g'; $('swatch-weight-unit').fire('change');
$('calc-skein-weight').value = '100'; $('calc-skein-length').value = '220';
$('calc-skein-weight-unit').value = 'g'; $('calc-skein-length-unit').value = 'yd';
$('stat-total-stitches').textContent = '4,800';
ALERTS.length = 0;
$('btn-calculate-yardage').fire('click');
ck('no alert - full data present', ALERTS.length, 0);
var res = $('gauge-results-content').innerHTML.replace(/\s+/g, ' ');
contains('weight section rendered', res, 'By Swatch Weight');
contains('225 g total', res, '225 g');
contains('3 skeins by weight', res, '<strong>Skeins by Weight</strong> 3');
contains('g/stitch shown', res, '0.0469 g per stitch');
ck('swatch weight stored on the logged swatch', rows()[0] && true, true);

print('\n12. Blank swatch weight hides the section, no NaN');
setVal('swatch-weight', '');
$('stat-total-stitches').textContent = '4,800';  // refreshPatternUI zeroed it (no pattern rows)
ALERTS.length = 0;
$('btn-calculate-yardage').fire('click');
ck('recalculated cleanly', ALERTS.length, 0);
var res2 = $('gauge-results-content').innerHTML;
ck('weight section absent', res2.indexOf('By Swatch Weight') === -1, true);
ck('no NaN leaked', res2.indexOf('NaN') === -1, true);

print('\n13. Yarn weight reaches a logged swatch without a Sync Metadata button');
// The button was removed: syncMetadataToGauge already runs on init, on every metadata change, before a
// gauge calculation, on save and on every stats refresh, so a manual sync could never do anything.
var pageHtml = readFile('index.html');
ck('no Sync Metadata button on the page', /btn-sync-metadata/.test(pageHtml), false);
ck('no dead calc-gauge-yarn-weight reference', /calc-gauge-yarn-weight/.test(readFile('app.js')), false);
ck('Export History button still there', /btn-export-history/.test(pageHtml), true);

$('meta-yarn-weight').value = '0 - Lace';
$('meta-yarn-weight').fire('change');
$('gauge-hook-size').value = '3.5mm (E)'; $('gauge-hook-size').fire('input');
setVal('gauge-stitches', 22); setVal('gauge-rows', 26);
$('btn-calculate-gauge').fire('click');
ck('newest swatch records the yarn weight', rows()[0].children[1].textContent, '0 - Lace');


print('\n14. The converted swatch size is saved with the swatch');
// The converter restates a 2x2 measurement at 4x4. That restatement is worth keeping
// alongside the raw numbers, so the history records whatever it was showing.
$('new-file-btn').fire('click');
setVal('gauge-width', 2); setVal('gauge-height', 2);
setVal('gauge-stitches', 8); setVal('gauge-rows', 10);
$('gauge-hook-size').value = '4.0mm (G)'; $('gauge-hook-size').fire('input');
$('gauge-convert-size').value = '4'; $('gauge-convert-size').fire('change');
$('calc-skein-weight').value = '100'; $('calc-skein-length').value = '220';
$('btn-calculate-gauge').fire('click');
var conv = rows()[0].children.map(function (c) { return c.textContent; });
ck('the raw measurement is untouched', conv[4], '8/10');
ck('the converted size sits beside it', conv[5], '16.0 sts \u00d7 20.0 rows / 4 \u00d7 4 in');
contains('and appears on the current-swatch card', $('active-swatch-content').text(), 'Converted: 16.0 sts');
contains('history header gained the column', readFile('index.html'), '<th>Gauge</th><th>Converted</th><th>Notes</th>');

// Nothing selected in the converter means nothing to record - not a stale value.
$('gauge-convert-size').value = ''; $('gauge-convert-size').fire('change');
$('btn-calculate-gauge').fire('click');
ck('no conversion selected leaves a dash', rows()[0].children[5].textContent, '-');
ck('the raw gauge is still there', rows()[0].children[4].textContent, '8/10');

// Converting across units has to rescale the density, not just relabel it.
setVal('gauge-width', 2); setVal('gauge-height', 2);
setVal('gauge-stitches', 8); setVal('gauge-rows', 10);
$('gauge-convert-size').value = '4'; $('gauge-convert-size').fire('change');
$('gauge-convert-unit').value = 'cm'; $('gauge-convert-unit').fire('change');
$('btn-calculate-gauge').fire('click');
// 4 sts per inch -> 4/2.54 per cm, over 4cm = 6.3 sts.
ck('in -> cm rescales the density', rows()[0].children[5].textContent, '6.3 sts \u00d7 7.9 rows / 4 \u00d7 4 cm');
$('gauge-convert-unit').value = 'in'; $('gauge-convert-unit').fire('change');

// It must survive the round trip, since the history is what gets saved and exported.
// Save refuses without a pattern, so give it one.
$('bulk-input').value = 'Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)';
$('bulk-parse-btn').fire('click');
$('project-name').value = 'converted';
$('gauge-convert-size').value = '4'; $('gauge-convert-size').fire('change');
$('btn-calculate-gauge').fire('click');
ALERTS.length = 0;
$('save-btn').fire('click');
// Save alerts on success too, so check what it said rather than that it stayed quiet.
contains('the project saved', ALERTS.join(' '), 'saved');
$('new-file-btn').fire('click');
ck('new file clears the history', rows().length, 0);
$('load-select').value = 'converted';
$('load-btn').fire('click');
contains('the conversion comes back with it', rows()[0].children[5].textContent, 'sts');


print('\n15. Gauge and yardage are separate actions');
$('new-file-btn').fire('click');
setVal('gauge-width', 4); setVal('gauge-height', 4);
setVal('gauge-stitches', 16); setVal('gauge-rows', 20);

// Gauge alone: no pattern, no skein, no complaint.
ALERTS.length = 0;
$('btn-calculate-gauge').fire('click');
ck('gauge raises no alert', ALERTS.join(' | '), '');
contains('and shows density', $('gauge-results-content').innerHTML, 'Stitch Density');
ck('says nothing about skeins', /skein/i.test($('gauge-results-content').innerHTML), false);
ck('one swatch logged', rows().length, 1);

// Pressing it again does not file the same swatch twice.
$('btn-calculate-gauge').fire('click');
ck('an unchanged swatch is not logged twice', rows().length, 1);

// Yardage names exactly what is missing, and keeps the gauge half on screen.
ALERTS.length = 0;
$('btn-calculate-yardage').fire('click');
contains('names the missing pattern', ALERTS.join(' '), 'a validated pattern to measure');
contains('names the skein weight', ALERTS.join(' '), 'the skein weight');
contains('names the skein length', ALERTS.join(' '), 'the skein length');
ck('reads as a list, not "and and"', / and .* and /.test(ALERTS.join(' ')), false);
contains('density survives the refusal', $('gauge-results-content').innerHTML, 'Stitch Density');
ck('and still no duplicate swatch', rows().length, 1);

// With a pattern present it stops blaming the pattern.
$('stat-total-stitches').textContent = '4,800';
ALERTS.length = 0;
$('btn-calculate-yardage').fire('click');
ck('no longer blames the pattern', /validated pattern/.test(ALERTS.join(' ')), false);
contains('still asks for the skein', ALERTS.join(' '), 'skein');

// Full data: both halves in one panel.
$('calc-skein-weight').value = '100'; $('calc-skein-length').value = '220';
$('stat-total-stitches').textContent = '4,800';
ALERTS.length = 0;
$('btn-calculate-yardage').fire('click');
ck('no alert with everything present', ALERTS.length, 0);
var both = $('gauge-results-content').innerHTML;
contains('density still there', both, 'Stitch Density');
contains('and yardage beneath it', both, 'Recommended Skeins');

// Both buttons refuse an incomplete swatch, with the same message.
$('new-file-btn').fire('click');
ALERTS.length = 0;
$('btn-calculate-gauge').fire('click');
$('btn-calculate-yardage').fire('click');
ck('both refuse without a swatch', ALERTS.length, 2);
ck('with the gauge message', /Gauge Profile fields/.test(ALERTS[0]) && /Gauge Profile fields/.test(ALERTS[1]), true);

ck('both buttons exist on the page', /id="btn-calculate-gauge"/.test(readFile('index.html'))
    && /id="btn-calculate-yardage"/.test(readFile('index.html')), true);

endSuite();
