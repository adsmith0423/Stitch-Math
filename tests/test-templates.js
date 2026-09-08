/**
 * Pattern skeletons - the guarantee that every shipped template is a pattern that actually works.
 *
 * This suite is the real specification for PATTERN_TEMPLATES in app.js. A skeleton offered to a
 * beginner has to validate clean and has to state all four required elements, because it is doing two
 * jobs at once: teaching the shape, and demonstrating that the checker can be trusted. A template
 * with a failing row teaches the opposite of both.
 *
 * Every template is loaded THROUGH THE BUTTON the user presses rather than by assigning the text
 * directly, so the picker's own wiring is under test alongside the text it inserts.
 */
boot();

var E = window.CrochetMathEngine;

/** The insert buttons, read off the host rather than by id: the stub's getElementById CREATES
 *  anything asked for, so `!!$('template-insert-sphere')` is true whether it was rendered or not. */
function templateRows() { return $('template-list').children; }
function insertButton(i) {
    var row = templateRows()[i];
    if (!row) return null;
    // [ text block, insert button ]
    return row.children[row.children.length - 1];
}
function templateName(i) {
    var row = templateRows()[i];
    return row ? row.children[0].children[0].textContent : '(no row)';
}

/** Failing rows in the matrix as it stands. Column 5 is the verdict cell renderMathCheck writes. */
function failingRows() {
    var bad = [];
    $('step-sequence-body').children.forEach(function (tr, i) {
        if (tr.children.length < 6) return;          // note and section rows span the table
        if (/FAIL/.test(tr.children[5].innerHTML)) bad.push(i + 1);
    });
    return bad;
}
function workRows() {
    return $('step-sequence-body').children.filter(function (tr) { return tr.children.length >= 6; }).length;
}

print('\n1. The picker is built from the table');
var count = templateRows().length;
ok('at least four skeletons are offered', count >= 4);
ok('each row carries a name', templateName(0).length > 0);
ok('and an insert button', !!insertButton(0));
ck('the button says what it does', insertButton(0).textContent, 'Insert');

print('\n2. Every skeleton validates clean');
// The load-bearing assertion in this file. A skeleton that does not add up would teach a beginner
// the wrong lesson about the shape AND about whether the green badge means anything.
for (var i = 0; i < count; i++) {
    $('bulk-input').value = '';                     // no confirm to answer on an empty editor
    var name = templateName(i);
    insertButton(i).fire('click');
    ok(name + ' produced rows', workRows() > 0);
    ck(name + ' has no failing row', failingRows().join(',') || 'none', 'none');
}

print('\n2b. Every skeleton\'s written counts match what Stitch Math calculates');
// THE assertion that was missing, and the reason a granny square shipped whose every round displayed
// the wrong number. "No failing rows" is not the same claim: a count in brackets that disagrees with
// the stitches is advisory and never fails a row, so a template could show "written 24, calculated 38"
// on every line and still pass section 2. A template is a worked example - if its own numbers do not
// agree, it teaches the reader to ignore the one figure the tool exists to produce.
for (var n = 0; n < count; n++) {
    $('bulk-input').value = '';
    var tname = templateName(n);
    insertButton(n).fire('click');
    var disagreed = [];
    $('step-sequence-body').children.forEach(function (tr) {
        if (tr.children.length < 6) return;
        var stated = String(tr.children[3].textContent).trim();
        var calc = tr.children[4].innerHTML.replace(/<[^>]*>/g, '').trim().split(' ')[0];
        // A row stating no count of its own has nothing to disagree with.
        if (!stated || stated === '0') return;
        if (stated !== calc) disagreed.push(tr.children[0].textContent + ' says ' + stated + ', calculated ' + calc);
    });
    ck(tname + ' agrees with itself on every row', disagreed.join(' | ') || 'none', 'none');
}

print('\n3. Every skeleton states all four required elements');
// The skeleton demonstrates what requiredElements asks for rather than merely satisfying it, so this
// is checked against the inserted text, not against the metadata form.
for (var j = 0; j < count; j++) {
    $('bulk-input').value = '';
    var nameJ = templateName(j);
    insertButton(j).fire('click');
    var elements = E.requiredElements({ sourceText: $('bulk-input').value });
    ck(nameJ + ' is complete', elements.missing.join(',') || 'none', 'none');
    // Read off the pattern, not the form: the point is that the TEXT says it.
    ck(nameJ + ' states them in the text', elements.items.filter(function (item) {
        return item.source === 'pattern';
    }).length, 4);
}

print('\n4. Inserting into an empty editor does not ask');
$('bulk-input').value = '';
insertButton(0).fire('click');
ok('the text went in', $('bulk-input').value.length > 0);

print('\n5. Inserting over existing work asks first');
// The one control in the Studio that destroys text outright. A picker that silently ate forty rows
// would be the worst button in the application.
//
// Headless, askConfirm takes its !IS_BROWSER path and defers to a global confirm() - see app.js
// section 5c. Declining through that is how the guard is exercised here; the modal itself is a
// browser path this stub has no way to open.
window.confirm = function () { return false; };
$('bulk-input').value = 'Row 1: ch 10\nRow 2: sc in each ch across (10)';
var before = $('bulk-input').value;
insertButton(1).fire('click');
ck('declining leaves the pattern exactly as it was', $('bulk-input').value, before);

print('\n6. Accepting replaces it');
window.confirm = function () { return true; };
insertButton(1).fire('click');
ok('the template is now in the editor', $('bulk-input').value.indexOf('Hook:') === 0);
ck('and it validates', failingRows().join(',') || 'none', 'none');
window.confirm = undefined;

endSuite();
