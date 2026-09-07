boot();

var A = window.CrochetAnalyticsEngine;

function plain(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ').trim();
}
function load(lines) {
    $('new-file-btn').fire('click');
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}
function cell(row, col) {
    var td = $('step-sequence-body').children[row].children[col];
    return td ? plain((td.innerHTML || '') + ' ' + (td.textContent || '')) : '';
}
function written(row) { return parseInt(cell(row, 3), 10); }
function calculated(row) { return parseInt(cell(row, 4), 10); }
function status(row) { return cell(row, 5); }
function health() { var e = $('cumulative-status'); return plain((e.innerHTML || '') + ' ' + (e.textContent || '')); }
function pickSize(i) { $('meta-size').value = String(i); $('meta-size').fire('change'); }
function sizeCount() { return (($('meta-size').innerHTML || '').match(/<option/g) || []).length; }
// Which rows fail at a given size. The point of a graded pattern is that a row can be right in three sizes
// and wrong in the fourth, and nothing shows that but walking them.
function failingRowsAt(i) {
    pickSize(i);
    var out = [];
    $('step-sequence-body').children.forEach(function (tr, r) {
        if (tr.className === 'row-failed') out.push(r);
    });
    return out;
}
function consistency(lines) {
    var r = A.CheckSizeConsistency(lines);
    return r ? r.state + ': ' + r.detail : 'null';
}

// Five graded patterns. A multi-size pattern validates one size at a time, so every one of these is
// invisible to row-by-row checking of the size on screen - the fault is either in a size nobody looked at,
// or in the shape of the arrays rather than in any single number they contain.

print('\n0. A size list that carries its unit inside the brackets');
// Both spellings are in use - "20 (24, 28, 32) sts" and "20 (24, 28, 32 sts)" - and only the first was
// read as sizes. The second reached the written-count reader, which is built to SUM a bracketed list, so a
// four-size row came back as a written count of 174: every size added together, printed to the reader as
// the designer's own figure.
load([
    'Row 1: Ch 50 (55, 60, 62).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 49 (54, 59, 61 sts).'
]);
ck('the base size is read as the count, not the sum', written(1), 49);
ck('and the row calculates it', calculated(1), 49);
pickSize(2);
ck('the third size takes its own figure', written(1), 59);
ck('and calculates it', calculated(1), 59);
pickSize(0);
// The multi-part count this rule has to stay clear of: its parts are each labelled, which is the only
// reason to write a count in parts at all.
load([
    'Round 1: Ch 1, hdc in first 18 ch, hdc in next 8 ch, hdc in last 18 ch. [44 hdc, 4 ch-1 sps]'
]);
ck('a genuine multi-part count is still summed', written(0), 48);

print('\n1. Grading steps that are not even');
// 50, 55, 60, 62 climbs by 5, 5, then 2. The pattern validates perfectly in all four sizes - each is
// internally consistent - so nothing row-by-row can see it. It shows only when the sizes are compared.
load([
    'Row 1: Ch 50 (55, 60, 62).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 49 (54, 59, 61 sts).'
]);
ok('the uneven step is reported', /uneven grading: steps of 5, 5, 2 sts between sizes/.test(health()));
ck('and every size validates on its own', failingRowsAt(1).length + failingRowsAt(2).length + failingRowsAt(3).length, 0);
pickSize(0);
// An evenly graded pattern says so rather than staying silent, or a passing check would be
// indistinguishable from one that never ran.
load([
    'Row 1: Ch 21 (25, 29, 33).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 20 (24, 28, 32 sts).'
]);
ok('even grading is confirmed', /Size grading 4 sizes grade evenly/.test(health()));
no('and nothing is called uneven', /uneven grading/.test(health()));

print('\n2. A size list one value short');
// Row 1 offers four sizes, Row 2 only three. resolveSizeVariants has nothing to pick for the fourth, so it
// falls back to the BASE - the largest size is silently worked at the smallest measurements, and every row
// still passes.
load([
    'Row 1: Ch 21 (25, 29, 33).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 20 (24, 28) sts.'
]);
ok('the short list is reported',
    /"20 \(24, 28\)" gives 3 sizes where the pattern has 4/.test(health()));
ck('and no size fails on its own, which is why nothing else catches it',
    failingRowsAt(1).length + failingRowsAt(2).length + failingRowsAt(3).length, 0);
pickSize(0);
// Unit form, so the rule is pinned away from the page.
ck('three against four', consistency(['Ch 21 (25, 29, 33)', 'sc across 20 (24, 28) sts']),
    'fail: "20 (24, 28)" gives 3 sizes where the pattern has 4');
ck('lists that agree pass', consistency(['Ch 21 (25, 29, 33)', 'sc across 20 (24, 28, 32) sts']),
    'pass: every size list offers the same 4 sizes');
ck('a one-size pattern is not judged at all', consistency(['Ch 21', 'sc in each ch across (20)']), 'null');
// A range row is filed as several steps off one source line, so the same array can arrive more than once;
// it is reported once.
ck('a repeated array is reported once',
    (A.CheckSizeConsistency(['Ch 21 (25, 29, 33)', 'x 20 (24, 28) sts', 'x 20 (24, 28) sts']).details || []).length, 1);

print('\n3. A repeat that fits every size but one');
// The repeat takes 4 stitches a pass. 32, 40 and 44 divide by 4; 34 does not. Sizes S, L and XL are clean
// and the pattern opens on S, so the screen says the pattern is fine.
load([
    'Row 1: Ch 33 (35, 41, 45).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 32 (34, 40, 44 sts).',
    'Row 3: Ch 3, turn, *sk 1, 3 dc in next st, sk 1, dc in next st; rep from * across, 32 (34, 40, 44 sts).'
]);
ck('the size on screen is clean', failingRowsAt(0).length, 0);
ck('so is Large', failingRowsAt(2).length, 0);
ck('and X-Large', failingRowsAt(3).length, 0);
ck('but Medium fails on Row 3', failingRowsAt(1).join(','), '2');
ok('and it fails for the reason it should',
    /fits a multiple of 4 stitches - 32 or 36, not 34/.test(status(2)));
pickSize(0);
// The health panel is what a reader looking only at size S has to go on, and it names the size rather than
// reporting a clean pattern.
ok('the panel names the size that does not work',
    /Size grading cannot compare sizes: Medium \(M\) does not validate/.test(health()));

print('\n4. A total row count that falls at the largest size');
// 10, 12, 14, 13 rows: X-Large comes out shorter than Large. This is a note line, never validated as a
// row, so the arithmetic never sees it at all.
load([
    'Row 1: Ch 11 (13, 15, 17).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 10 (12, 14, 16 sts).',
    'Row 3: Ch 1, turn, sc in each st across.',
    'Repeat Row 3 for a total of 10 (12, 14, 13) rows.'
]);
ok('the drop is reported',
    /the total row count falls from 14 to 13 at size 4 \(10, 12, 14, 13\)/.test(health()));
ok('while the stitch counts still grade evenly', /Size grading 4 sizes grade evenly/.test(health()));
// Rising and level totals are both fine - sizes that repeat a value are common.
ck('a rising total passes',
    consistency(['Ch 11 (13, 15, 17)', 'for a total of 10 (12, 14, 16) rows']),
    'pass: every size list offers the same 4 sizes');
ck('and a total that holds a value passes',
    consistency(['Ch 11 (13, 15, 17)', 'for a total of 10 (12, 12, 14) rows']),
    'pass: every size list offers the same 4 sizes');
// The narrowness is the point. A row count that falls as the size rises is ordinary wherever it counts a
// shaping section or a stripe repeat rather than the finished length, and both of these are real lines
// from the Lion Brand cardigans. Held to "must rise", the check would call a published pattern broken.
ck('"Next N Rnds" is left alone',
    consistency(['Rnd 1: work 36 (40, 46, 50) sc', 'Next 4 (8, 1, 7) Rnds: hdc in each st around']),
    'pass: every size list offers the same 4 sizes');
ck('and so is a falling stripe sequence',
    consistency(['work 36 (40, 46, 50) sc', 'until all 37 (35, 34, 32) rows of sequence have been completed']),
    'pass: every size list offers the same 4 sizes');

print('\n5. A size list with no base size outside the brackets');
// "(24, 28, 32 sts)" states three sizes for a four-size pattern and never says which the smallest is. With
// no number in front of the bracket it is not a size group by the position rule, so it fell through to the
// written-count reader and was summed: the row claimed a written count of 84.
load([
    'Row 1: Ch 21 (25, 29, 33).',
    'Row 2: Sc in 2nd ch from hook and each ch across, (24, 28, 32 sts).'
]);
ok('the missing base is reported',
    /"\(24, 28, 32 sts\)" gives 3 sizes with no base size outside the brackets/.test(health()));
ck('and no count is invented from the sum', written(1), 0);
ck('the row still counts what it works', calculated(1), 20);
no('and is not failed', /FAIL/.test(status(1)));
// With the base restored the same pattern is silent.
load([
    'Row 1: Ch 21 (25, 29, 33).',
    'Row 2: Sc in 2nd ch from hook and each ch across, 20 (24, 28, 32 sts).'
]);
no('a complete list draws nothing', /no base size outside the brackets/.test(health()));
ck('and the base size is read as the count', written(1), 20);

endSuite();
