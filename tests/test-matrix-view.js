boot();
function load(lines){ $('bulk-input').value=lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function toggle(id,on){ $(id).checked=on; $(id).fire('change'); }
function body(){ return $('step-sequence-body').children; }
// The stub's innerHTML getter only returns assigned markup, so a <tr> built by
// appendChild reads as empty. Pull content from the cells themselves instead.
function cell(tr,i){ var c=tr.children[i]; return (c.innerHTML||'') + (c.textContent||''); }
function rowHtml(tr){ return tr.children.map(function(c){return (c.innerHTML||'')+(c.textContent||'');}).join(' '); }
function html(){ return body().map(rowHtml).join(' '); }
function rowLabels(){ return body().map(function(tr){ return cell(tr,0).replace(/<[^>]*>/g,''); }); }

var REPEATS = [
 "Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
 "Row 2: ch 1, turn, [sc in next 4 sts, inc in next st] x 3 (18)",
 "Rows 3-7: ch 1, turn, sc in each st across (18)",
 "Row 8: ch 1, turn, [sc in next 4 sts, sc2tog] x 3 (15)",
 "Rows 9-12: ch 1, turn, sc in each st across (15)"
];

print('\n1. Trend markers toggle');
load(REPEATS);
ck('markers present by default', /trend-badge/.test(html()), true);
toggle('toggle-trend-markers', false);
ck('all markers gone', /trend-badge/.test(html()), false);
ck('rows still render', body().length, 12);
toggle('toggle-trend-markers', true);
ck('markers restored', /trend-badge/.test(html()), true);

print('\n2. Collapsing repeated rows');
ck('12 lines uncollapsed', body().length, 12);
toggle('toggle-collapse-repeats', true);
ck('folds to 5 lines', body().length, 5);
ck('labels', JSON.stringify(rowLabels()), JSON.stringify(['Row 1','Row 2','Rows 3-7×5','Row 8','Rows 9-12×4']));
ck('count badge rendered', /repeat-count">×5</.test(html()), true);

print('\n3. Trend on a collapsed group is the net change');
ck('group 3-7 is flat vs row 2', /trend-flat/.test(cell(body()[2],4)), true);
ck('row 8 still shows the decrease', /trend-down/.test(cell(body()[3],4)), true);

print('\n4. Non-identical consecutive rows never fold');
load([
 "Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
 "Row 2: ch 1, turn, [sc in next 4 sts, inc in next st] x 3 (18)",
 "Row 3: ch 1, turn, [sc in next 5 sts, inc in next st] x 3 (21)"
]);
ck('stays 3 lines', body().length, 3);

print('\n5. Failed rows always render individually');
load([
 "Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
 "Row 2: ch 1, turn, sc x 99 (99)",
 "Row 3: ch 1, turn, sc x 99 (99)",
 "Row 4: ch 1, turn, sc x 99 (99)"
]);
ck('failed row not folded away', body().length >= 2, true);
ck('.row-failed survives for the jump button', /row-failed/.test(body().map(function(t){return t.className;}).join(' ')), true);

print('\n6. Editing expands its group');
load(REPEATS);
ck('collapsed', body().length, 5);
window.enableInlineEdit(4);            // row 5, inside the 3-7 group
ck('group expanded while editing', body().length > 5, true);
window.cancelInlineEdit();
ck('re-collapsed after cancel', body().length, 5);

print('\n7. Preferences persist');
toggle('toggle-trend-markers', false);
var saved = JSON.parse(localStorage.getItem('stitchmath_view_prefs'));
ck('trend pref saved', saved.showTrendMarkers, false);
ck('collapse pref saved', saved.collapseRepeats, true);

print('\n8. Export still emits every row');
BLOBS.length = 0;
$('export-txt-btn').fire('click');
var lines = BLOBS[0].split('\n').filter(function(l){return /^Row \d+:/.test(l);});
ck('export has all 12 rows', lines.length, 12);

print('\n9. A foundation-chain row 1 can be edited');
toggle('toggle-collapse-repeats', false);
load(["Ch 20", "Row 1: sc in 2nd ch from hook and in each ch across (19)"]);
ck('chain row rendered', /Chain 20/.test(cell(body()[0],1)), true);
window.enableInlineEdit(0);
// The chain lives in initialChain with an empty instruction, so the editor has to be
// filled from the chain itself or the row opens blank and saving wipes it.
ck('editor opens on the chain', /value="Ch 20"/.test(cell(body()[0],1)), true);
window.cancelInlineEdit();
ck('chain intact after cancel', /Chain 20/.test(cell(body()[0],1)), true);
window.enableInlineEdit(0);
$('inline-input-0').value = 'Ch 24';
window.saveInlineEdit(0);
ck('edited chain saved', /Chain 24/.test(cell(body()[0],1)), true);
ck('and written back to the text', /^Ch 24/.test($('bulk-input').value), true);

print('\n10. The turning chain is shown, not deleted');
// It was being cut out of the instruction and never put back, so the matrix showed a row starting at its
// second phrase - "dc in each st across" for a row typed as "Ch 3, turn, dc in each st across". The count
// is still worked out without it; only the display was wrong.
var FOUND = "Row 1: Ch 21, dc in 4th ch from hook and each ch across (18)";
function row2(line) { load([FOUND, line]); return cell(body()[1], 1); }
function yield2(line) { load([FOUND, line]); return cell(body()[1], 4).replace(/<[^>]*>/g,'').trim().split(/\s/)[0]; }

var shown = row2("Row 2: Ch 3, turn, dc in each st across (18)");
ck('the chain is back in the cell', /Ch 3, turn/.test(shown), true);
ck('marked as a turning chain', /class="turning-chain"/.test(shown), true);
ck('and the rest of the row follows it', /dc in each st across/.test(shown), true);
ck('while the count still leaves it out', yield2("Row 2: Ch 3, turn, dc in each st across (18)"), 18);
ck('a round-opening ch 1 too', /Ch 1, turn/.test(row2("Row 2: Ch 1, turn, sc in each st across (18)")), true);
ck('and the reversed wording', /turn, ch 3/i.test(row2("Row 2: turn, ch 3, dc in each st across (18)")), true);

// A chain that says what it is has been decided by the designer, so it is handed to
// the engine whole - shown verbatim, with no badge, and counted on its own word.
var counts = "Row 2: Ch 3 (counts as dc), turn, dc in each st across (19)";
ck('"counts as dc" is left exactly as typed', /Ch 3 \(counts as dc\), turn/.test(row2(counts)), true);
ck('and is not dressed up as a turning chain', /class="turning-chain"/.test(row2(counts)), false);
ck('and it counts - 18 sts plus the chain', yield2(counts), 19);
var notCounts = "Row 2: Ch 3 (does not count as a st), turn, dc in each st across (18)";
ck('"does not count" is left as typed too', /does not count as a st/.test(row2(notCounts)), true);
ck('and does not count', yield2(notCounts), 18);

// The editor is the path where the display mattered most: it opened on the shortened
// row, and saving wrote that back over the original.
load([FOUND, "Row 2: Ch 3, turn, dc in each st across (18)"]);
window.enableInlineEdit(1);
ck('the editor opens on the whole row', /value="Ch 3, turn, dc in each st across \(18\)"/.test(cell(body()[1],1)), true);
window.cancelInlineEdit();

print('\n11. Row numbering restarts where a row\'s own label restates "1"');
// A heading too plain for parseSectionHeader to recognise (no colon, no ALL CAPS) - "Sleeve" alone
// used to leave restart and continue indistinguishable, because nothing ever reset the counter.
// The fix does not depend on the heading at all: the Sleeve's own first row saying "Row 1" again is
// itself read as a fresh start.
$('meta-row-numbering').value = 'restart';
$('meta-row-numbering').fire('change');
load([
    "Body",
    "Row 1: ch 10, sc in 2nd ch from hook and in each ch across (9)",
    "Row 2: ch 1, turn, sc in each st across (9)",
    "Sleeve",
    "Row 1: ch 6, sc in 2nd ch from hook and in each ch across (5)",
    "Row 2: ch 1, turn, sc in each st across (5)"
]);
ck('restart: Sleeve renumbers from Row 1',
   JSON.stringify(rowLabels()), JSON.stringify(['Body', 'Row 1', 'Row 2', 'Sleeve', 'Row 1', 'Row 2']));

$('meta-row-numbering').value = 'continue';
$('meta-row-numbering').fire('change');
ck('continue: the same pattern stays sequential',
   JSON.stringify(rowLabels()), JSON.stringify(['Body', 'Row 1', 'Row 2', 'Sleeve', 'Row 3', 'Row 4']));

// A heading not followed by a restated "1" - the yoke-pattern shape, where a construction note
// ("Separating for Body & Sleeves") sits over rows that keep counting up, never restarting. Restart
// must not fire here: the designer's own numbering says this is still one continuous piece.
$('meta-row-numbering').value = 'restart';
$('meta-row-numbering').fire('change');
load([
    "Yoke",
    "Round 1: ch 12, join with sl st to first ch to form a ring (12)",
    "Round 2: ch 1, sc in each st around, join with sl st to first sc (12)",
    "Separating for Body & Sleeves",
    "Round 3: ch 1, sc in each st around, join with sl st to first sc (12)"
]);
ck('a heading with no restated "1" leaves numbering continuous either way',
   JSON.stringify(rowLabels()),
   JSON.stringify(['Yoke', 'Rnd 1', 'Rnd 2', 'Separating for Body & Sleeves', 'Rnd 3']));
$('meta-row-numbering').value = 'restart';

print('\n12. The foundation chain takes no row number');
// A bare chain above an explicit "Row 1" used to print Row 1 twice: the chain took the section's
// first number, then the row below restated 1 and the restart-on-restated-1 rule fired on it. The
// chain is a foundation, not a row - it keeps its place in the table, unnumbered, and the count
// carries on from it, restarting only where a section does.
load([
    "ch 16",
    "Row 1: sc in 2nd ch from hook and in each ch across (15)",
    "Row 2: ch 1, turn, sc in each st across (15)"
]);
ck('bare chain, then Row 1', JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 1', 'Row 2']));
load([
    "ch 46, sl st to join (46)",
    "Rnd 1: sc in each ch around (46)",
    "Rnd 2: sc in each st around (46)"
]);
ck('chain closed into a ring on its own line', JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Rnd 1', 'Rnd 2']));
load([
    "Row 0: ch 16",
    "Row 1: sc in 2nd ch from hook and in each ch across (15)"
]);
ck('a chain written as Row 0', JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 1']));
// The designer who counts the chain as their first row writes "Row 2" under it; the matrix follows
// the label it is given rather than deciding which convention the pattern uses.
load([
    "Ch 12 (12)",
    "Row 2: sc in each ch across (12)",
    "Row 3: sc in each st across (12)"
]);
ck('the row after the chain sets where the count starts', JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 2', 'Row 3']));
// Every section gets the same treatment, and the numbering setting still decides the rest.
load([
    "ch 16",
    "Row 1: sc in 2nd ch from hook and in each ch across (15)",
    "SLEEVE",
    "ch 16",
    "Row 1: sc in 2nd ch from hook and in each ch across (15)"
]);
ck('restart: each piece opens with its own foundation',
   JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 1', '--- SLEEVE ---', 'Foundation', 'Row 1']));
$('meta-row-numbering').value = 'continue';
$('meta-row-numbering').fire('change');
ck('continue: the foundation is skipped, not counted',
   JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 1', '--- SLEEVE ---', 'Foundation', 'Row 2']));
$('meta-row-numbering').value = 'restart';
$('meta-row-numbering').fire('change');
// A chain with work on the same line has made fabric and is a row, whatever its label says.
load([
    "Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
    "Row 2: ch 1, turn, sc in each st across (15)"
]);
ck('a chain worked back along on the same line is Row 1', JSON.stringify(rowLabels()), JSON.stringify(['Row 1', 'Row 2']));
load([
    "ch 4, sl st to form ring. ch 3, 2 dc in ring, [ch 2, 3 dc in ring] x 3, ch 2, sl st to top of ch-3 (12)",
    "Rnd 2: sc in each st around (12)"
]);
ck('a ring with its first round laid into it is a row', rowLabels()[0], 'Row 1');
// A restated "Row 1" mid-document still starts a fresh sequence - that rule is untouched.
load([
    "Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
    "Row 2: ch 1, turn, sc in each st across (15)",
    "Row 1: ch 1, turn, sc in each st across (15)",
    "Row 2: ch 1, turn, sc in each st across (15)"
]);
ck('a restated Row 1 with two rows above it still restarts', JSON.stringify(rowLabels()), JSON.stringify(['Row 1', 'Row 2', 'Row 1', 'Row 2']));
// The single-row form's "Starting Chains" is the other way a foundation arrives.
load([]);
$('initial-chain-input').value = '16'; $('tokens-input').value = ''; $('expected-yield-input').value = '16';
$('row-form').fire('submit');
$('initial-chain-input').value = '0'; $('tokens-input').value = 'Row 1: sc in 2nd ch from hook and in each ch across'; $('expected-yield-input').value = '15';
$('row-form').fire('submit');
ck('a foundation added through the single-row form', JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 1']));
// Collapsing never folds the foundation into a range, which would have nothing to print for its end.
load([
    "ch 16",
    "Row 1: sc in 2nd ch from hook and in each ch across (15)",
    "Rows 2-4: ch 1, turn, sc in each st across (15)"
]);
toggle('toggle-collapse-repeats', true);
ck('the foundation stays out of collapsed groups', JSON.stringify(rowLabels()), JSON.stringify(['Foundation', 'Row 1', 'Rows 2-4×3']));
toggle('toggle-collapse-repeats', false);

endSuite();
