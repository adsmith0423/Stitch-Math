boot();

// Every field on the page, harvested from index.html rather than hand-listed, so a
// control added later cannot quietly escape the reset.
var HTML = readFile('index.html');
var FIELDS = [];
HTML.replace(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g, function (whole, tag, id) {
    FIELDS.push({ tag: tag, id: id, type: (whole.match(/type="([^"]+)"/) || [, 'text'])[1] });
    return whole;
});

print('\n1. Fill in absolutely everything');
ck('fields discovered on the page', FIELDS.length > 30, true);

$('bulk-input').value = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)\nRow 2: ch 1, turn, sc in each st across (12)';
$('bulk-parse-btn').fire('click');

$('project-name').value = 'dirty project';
$('meta-designer').value = 'Someone';
$('meta-hook').value = '4.0mm';
$('meta-difficulty').value = 'Complex';
$('meta-difficulty').fire('change');
$('meta-yarn-weight').value = '0 - Lace';
$('meta-construction').value = 'Rounds (Spiral)';
$('meta-construction').fire('change');
// No UI control for this any more; dirty it straight through the engine.
CrochetMathEngine.setRepeatConvention('inclusive');
$('skipped-chains').value = '3';

$('gauge-width').value = '4'; $('gauge-height').value = '4';
$('gauge-stitches').value = '10'; $('gauge-rows').value = '18';
$('gauge-unit').value = 'cm';
$('gauge-hook-size').value = '5.0mm';
$('gauge-notes').value = 'blocked hard';
$('swatch-weight').value = '12'; $('swatch-weight-unit').value = 'oz';
$('calc-skein-weight').value = '100'; $('calc-skein-weight-unit').value = 'oz';
$('calc-skein-length').value = '220'; $('calc-skein-length-unit').value = 'm';
$('gauge-convert-size').value = '6';
$('gauge-convert-unit').value = 'cm'; $('gauge-convert-unit').fire('change');
$('gauge-width').fire('input');
$('sizing-category').value = 'woman'; $('sizing-category').fire('change');
$('sizing-piece').value = 'half'; $('sizing-piece').fire('change');

// A custom stitch, saved the way the form saves it.
function addStitch(name, def, cost, yieldVal) {
    $('custom-st-name').value = name;
    $('custom-st-def').value = def;
    $('custom-st-cost').value = cost;
    $('custom-st-yield').value = yieldVal;
    $('custom-stitch-form').fire('submit');
}
addStitch('wibble', 'a wibbly stitch', '2', '3');
addStitch('flumph', 'sc sc', '1', '2');
addStitch('zorp', 'tr tr', '3', '4');
ck('three custom stitches registered', Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 3);
ok('persisted to storage', /wibble/.test(localStorage.getItem('stitchmath_custom_stitches') || ''));
ck('three rows drawn in the table', $('custom-stitch-body').children.length, 3);

// Remove leads the row, so the stitch name is the second cell.
var firstRow = $('custom-stitch-body').children[0];
// .text(), not .innerHTML: the button is a real element now rather than an assigned markup string,
// and the stub's innerHTML getter only returns what was assigned to it.
ok('first cell is the Remove button', /Remove/.test(firstRow.children[0].text() || ''));
ck('second cell is the stitch name', firstRow.children[1].textContent, 'wibble');
ck('third cell is the definition', firstRow.children[2].textContent, 'a wibbly stitch');
ck('fourth cell is the cost', firstRow.children[3].textContent, '2');
ck('fifth cell is the yield', firstRow.children[4].textContent, '3');
ok('the header leads with a blank column', /<thead><tr><th><\/th><th>Stitch<\/th>/.test(HTML));

// Yardage results panel is populated so we can prove it gets hidden again.
$('btn-calculate-gauge').fire('click');

print('\n2. New File');
$('new-file-btn').fire('click');

print('\n3. Every field is back to its default');
// Checkboxes are matrix view preferences, deliberately persisted - see loadViewPrefs.
var VIEW_PREFS = { 'toggle-trend-markers': 1, 'toggle-collapse-repeats': 1 };
var dirty = [];
FIELDS.forEach(function (fld) {
    if (VIEW_PREFS[fld.id]) return;
    var el = $(fld.id);
    if (fld.tag === 'select') {
        if (el.selectedIndex !== 0 && el.value !== '' && el.value !== '0') dirty.push(fld.id + '=' + el.value);
    } else if (fld.type === 'number' || fld.type === 'text' || fld.tag === 'textarea') {
        if (el.value !== '' && el.value !== '0') dirty.push(fld.id + '=' + el.value);
    }
});
ck('no field left holding data', dirty.join(', ') || 'none', 'none');

print('\n4. The custom stitch dictionary is gone');
ck('engine dictionary empty', Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 0);
ck('saved dictionary empty', localStorage.getItem('stitchmath_custom_stitches'), '{}');
ck('name field cleared', $('custom-st-name').value, '');
ck('definition field cleared', $('custom-st-def').value, '');
ck('cost field cleared', $('custom-st-cost').value, '');
ck('yield field cleared', $('custom-st-yield').value, '');
ok('list shows the empty state', /No custom stitches added yet/.test($('custom-stitch-list').innerHTML));
// Hiding the table is not emptying it: rows left in the DOM would reappear the moment
// a new stitch was added and the table was shown again.
ck('no rows left in the table body', $('custom-stitch-body').children.length, 0);
ck('table body markup emptied', $('custom-stitch-body').innerHTML, '');

print('\n5. Engine and app state, not just the visible fields');
ck('repeat convention back to exact', CrochetMathEngine.getRepeatConvention(), 'exact');
// Sizing and the foundation skip are read off the pattern, and New File leaves no pattern to read.
ok('sizing back to one size fits all', $('size-picker-group').classList.contains('hidden'));
ck('pattern matrix emptied', $('step-sequence-body').text().replace(/\s/g, ''), '');
ok('density readouts reset', /--/.test($('density-stitches').textContent));
ck('gauge conversion reset', /Enter swatch size/.test($('gauge-conversion-output').innerHTML), true);
ok('finished size back to its placeholder', /Enter a gauge/.test($('finished-size-content').innerHTML));
ok('swatch history cleared', /No swatch recorded|^\s*$/.test($('active-swatch-content').innerHTML));

print('\n6. A second New File on an already-clean page is harmless');
$('new-file-btn').fire('click');
ck('still empty', $('bulk-input').value, '');
ck('still no custom stitches', Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 0);

print('\n7. The page is usable again afterwards');
$('bulk-input').value = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)';
$('bulk-parse-btn').fire('click');
ok('a new pattern parses', /ch 13/.test($('step-sequence-body').text()));

// The old rows must not come back when the table is shown again.
addStitch('newone', 'sc dc', '1', '1');
ck('only the new stitch is listed', $('custom-stitch-body').children.length, 1);
ck('and it is the new one', $('custom-stitch-body').children[0].children[1].textContent, 'newone');

print('\n8. Clear All empties the dictionary too');
// A custom stitch is defined against the pattern it was needed for. Its cost and yield were true of that
// pattern, so leaving it behind to apply to the next one silently changes how that one counts.
addStitch('cleartest', 'dc dc', '2', '2');
ok('the stitch is registered', !!CrochetMathEngine.CUSTOM_STITCHES.cleartest);
$('bulk-input').value = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)';
$('bulk-parse-btn').fire('click');
$('clear-all-btn').fire('click');
ck('rows cleared', $('bulk-input').value, '');
ck('and so is the dictionary', Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 0);
ck('including the saved copy', localStorage.getItem('stitchmath_custom_stitches'), '{}');

// With no rows left, the button used to return early and do nothing at all - which meant
// a dictionary could not be cleared once the pattern had been emptied first.
addStitch('lonely', 'sc', '1', '1');
ck('a dictionary with no pattern is still something to clear',
   Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 1);
$('clear-all-btn').fire('click');
ck('and it clears', Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 0);

print('\n9. A refresh does not bring the dictionary back');
// Terms last as long as the page does. Seeded here the way a previous session would have
// left them, then the page is booted again.
localStorage.setItem('stitchmath_custom_stitches',
    JSON.stringify({ stale: { cost: 9, yield: 9, def: 'left over from last time' } }));
boot();
ck('the stale term is not in the engine', Object.keys(CrochetMathEngine.CUSTOM_STITCHES).length, 0);
ck('nor left in storage for the export to read', localStorage.getItem('stitchmath_custom_stitches'), '{}');
ck('and the table shows nothing', $('custom-stitch-body').children.length, 0);

endSuite();
