/**
 * The validation badge and the geometric outline - the two teacher-facing views.
 *
 * The badge answers a blunter question than the health score does: can the arithmetic be trusted, and
 * is anything still missing. The order of its states is the thing worth protecting - a failing row
 * outranks a missing hook size, because no amount of front matter makes a pattern that does not add
 * up ready to publish.
 *
 * The outline is a view concern only. Section 6 is what says so: switching it on must not move a
 * single number, a health score or a linter finding.
 */
boot();

function load(lines) {
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}
function badge() { return $('validation-badge'); }
function badgeState() {
    var m = String(badge().className || '').match(/badge-(valid|incomplete|invalid|empty)/);
    return m ? m[1] : '(none)';
}
function badgeText() { return String(badge().innerHTML || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function outline(on) { $('toggle-outline-view').checked = !!on; $('toggle-outline-view').fire('change'); }
function rows() { return $('step-sequence-body').children; }

/** A complete, valid pattern: math sound and all four elements stated. */
var COMPLETE = [
    'Hook: 3.5mm (E/4)',
    'Yarn: Worsted Weight (Category 4)',
    'Gauge: 16 sc x 18 rows = 4 in.',
    '',
    'Abbreviations',
    'sc = single crochet',
    'inc = increase',
    '',
    'Rnd 1: 6 sc in magic ring (6)',
    'Rnd 2: inc in each st around (12)',
    'Rnd 3: [sc, inc] x 6 (18)'
];

print('\n1. Nothing written yet');
load(['']);
ck('the badge says so', badgeState(), 'empty');

print('\n2. A pattern that adds up but states nothing about itself');
load(['Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)']);
ck('math sound, not finished', badgeState(), 'incomplete');
ok('and it names what is missing', badgeText().indexOf('Hook Size') >= 0);
ok('including the gauge', badgeText().indexOf('Gauge') >= 0);
ok('and the abbreviations key', badgeText().indexOf('Abbreviations Key') >= 0);

print('\n3. A complete pattern');
load(COMPLETE);
ck('valid', badgeState(), 'valid');
ok('and it says every round adds up', badgeText().indexOf('add up') >= 0);
// The checklist is shown whatever the verdict, so a valid pattern says WHY it is valid.
ok('the four elements are still listed', badgeText().indexOf('Yarn Weight') >= 0);
ok('each saying where it was read from', badgeText().indexOf('from the pattern') >= 0);

print('\n3b. Filling the metadata form updates the badge without re-validating');
// Two of the four elements can be satisfied from the form and the gauge calculator, neither of which
// re-walks the pattern. Before refreshPatternUI redrew the badge, typing a hook size left it still
// claiming the hook was missing until the next Validate.
load(['Rnd 1: 6 sc in magic ring (6)', 'Rnd 2: inc in each st around (12)']);
ck('missing to begin with', badgeState(), 'incomplete');
ok('and it says so about the hook', badgeText().indexOf('Hook Size') >= 0);
$('meta-hook').value = '3.5mm (E/4)';
$('meta-hook').fire('change');
ok('the hook now reads from the project details', badgeText().indexOf('from your project details') >= 0);
ck('but the pattern is still incomplete', badgeState(), 'incomplete');
$('meta-hook').value = '';
$('meta-hook').fire('change');

print('\n4. A failing row outranks missing front matter');
// No amount of front matter makes a pattern that does not add up ready to publish.
var broken = COMPLETE.slice();
broken[broken.length - 1] = 'Rnd 3: [sc, inc] x 9 (18)';
load(broken);
ck('not valid', badgeState(), 'invalid');
ok('and it counts the failing rounds', badgeText().indexOf('do not add up') >= 0 || badgeText().indexOf('does not add up') >= 0);

print('\n5. An unrecognised stitch is not "valid" either');
// A green tick over totals computed without one of the stitches would be the worst thing this badge
// could say. It never happens, and the reason is worth pinning down: evaluateStep sets a reason for
// an unknown token, which fails the row - so a pattern containing one reaches the failing branch and
// the badge needs no separate rule for it. If that ever stops being true, this assertion is what
// catches it.
load([
    'Hook: 3.5mm (E/4)', 'Yarn: Worsted Weight (Category 4)', 'Gauge: 16 sc x 18 rows = 4 in.',
    '', 'Abbreviations', 'sc = single crochet', 'inc = increase', '',
    'Rnd 1: 6 sc in magic ring (6)',
    'Rnd 2: 6 dubble crochet in each st around (12)'
]);
ck('not valid', badgeState(), 'invalid');
// The unknown stitch is named by the linter and the matrix; the badge reports the failing row.
ok('and it says a round does not add up', badgeText().indexOf('add up') >= 0);

print('\n6. The outline changes nothing but what is drawn');
load(COMPLETE);
var beforeCounts = rows().map(function (tr) {
    return tr.children.length >= 6 ? tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim() : '';
}).filter(Boolean).join('|');
var beforeHealth = $('cumulative-status').innerHTML;
var beforeTally = $('lint-side-tally').textContent;

outline(true);
ck('the badge is unchanged', badgeState(), 'valid');
ck('the health panel is unchanged', $('cumulative-status').innerHTML, beforeHealth);
ck('the linter is unchanged', $('lint-side-tally').textContent, beforeTally);

print('\n7. What the outline shows');
// Three columns: the label, the count, and what the row did to the one above.
var work = rows().filter(function (tr) { return tr.children.length === 3; });
ck('one line per work row', work.length, 3);
ck('R1 is the base', work[0].children[2].textContent, 'base');
ck('R1 count', work[0].children[1].textContent, '6');
ck('R2 count', work[1].children[1].textContent, '12');
ck('R2 delta', work[1].children[2].textContent, '+6');
ck('R3 count', work[2].children[1].textContent, '18');
ck('R3 delta', work[2].children[2].textContent, '+6');
ok('and the prose is gone', work[1].children[1].textContent.indexOf('inc') < 0);

print('\n8. A decrease reads as a decrease');
load([
    'Rnd 1: 6 sc in magic ring (6)',
    'Rnd 2: inc in each st around (12)',
    'Rnd 3: [sc, dec] x 4 (8)',
    'Rnd 4: sc in each st around (8)'
]);
var d = rows().filter(function (tr) { return tr.children.length === 3; });
ck('down', d[2].children[2].textContent, '-4');
ck('marked as a decrease', d[2].children[2].className.indexOf('is-down') >= 0, 'true');
ck('an unchanged round reads flat', d[3].children[2].textContent, '—');

print('\n9. Section headings survive, notes do not');
// A heading divides one piece from the next and the curve restarts at it. A note is prose, which is
// exactly what this view exists to remove.
load([
    'This is a note about the pattern.',
    'SLEEVE',
    'Rnd 1: 6 sc in magic ring (6)',
    'Rnd 2: inc in each st around (12)'
]);
var kinds = rows().map(function (tr) { return tr.className + ':' + tr.children.length; }).join(',');
ok('the section row is there', kinds.indexOf('section-row') >= 0);
no('and no note row is', kinds.indexOf('note-row') >= 0);
var w = rows().filter(function (tr) { return tr.children.length === 3 && tr.className !== 'section-row'; });
ck('the first round of the piece is the base', w[0].children[2].textContent, 'base');

print('\n10. Switching back restores the matrix');
outline(false);
load(COMPLETE);
var after = rows().filter(function (tr) { return tr.children.length >= 6; });
ck('the full seven-column rows are back', after.length, 3);
var afterCounts = rows().map(function (tr) {
    return tr.children.length >= 6 ? tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim() : '';
}).filter(Boolean).join('|');
ck('and every count is what it was before', afterCounts, beforeCounts);

endSuite();
