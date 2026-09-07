boot();

// Three modern published garment patterns, each read two ways: the OCR of the printed page, and pdftotext
// over the same PDF. Neither was written to be parseable and neither was edited to help - the point is to
// measure what a real pattern does when pasted in whole, and to notice when that measurement moves.
//
// Read a line at a time these were 296, 457 and 447 rows, of which 7, 0 and 0 passed: every wrapped line
// became a row, and the first failure blocked the rest of the piece behind it.

var SOURCES = [
    { name: 'kingbird-cardigan',      sizes: 4 },
    { name: 'modern-ripple-cardigan', sizes: 3 },
    { name: 'granny-square-set',      sizes: 1 }
];

function measure(file) {
    $('new-file-btn').fire('click');
    $('bulk-input').value = readFile(file);
    $('bulk-parse-btn').fire('click');

    var counts = { note: 0, section: 0, passed: 0, failed: 0, blocked: 0 };
    $('step-sequence-body').children.forEach(function (tr) {
        if (tr.className === 'note-row') counts.note++;
        else if (tr.className === 'section-row') counts.section++;
        else if (tr.className === 'row-passed') counts.passed++;
        else if (tr.className === 'row-failed') counts.failed++;
        else if (tr.className === 'row-blocked') counts.blocked++;
    });
    counts.work = counts.passed + counts.failed + counts.blocked;
    counts.sizes = (($('meta-size').innerHTML || '').match(/<option/g) || []).length;
    return counts;
}

var totalWork = 0, totalFailed = 0, agree = 0;
SOURCES.forEach(function (source) {
    var ocr = measure('tests/fixtures-' + source.name + '-ocr.txt');
    var pdf = measure('tests/fixtures-' + source.name + '-pdf.txt');

    // The two extractions break their lines in different places. Reading the same pattern out of them has
    // to give the same answer, or the reflow is following the typesetting rather than the pattern.
    var same = ocr.work === pdf.work && ocr.note === pdf.note && ocr.failed === pdf.failed;
    if (same) agree++;

    totalWork += ocr.work;
    totalFailed += ocr.failed;

    print(source.name + ': ' + ocr.work + ' work rows, ' + ocr.note + ' notes, '
        + ocr.passed + ' passed, ' + ocr.failed + ' failed, ' + ocr.blocked + ' blocked'
        + ' | sizes ' + ocr.sizes + '/' + source.sizes
        + ' | ocr vs pdf: ' + (same ? 'agree' : 'DIFFER'));
});

print(agree + ' of ' + SOURCES.length + ' patterns read the same from OCR and PDF, '
    + totalWork + ' work rows, ' + totalFailed + ' failing');
