/**
 * The annotated draft export - the pattern with the linter's marks still on it.
 *
 * What this is for: a student fixes their mistakes and hands in the corrected file, and the recurring
 * misunderstanding that produced them is invisible by the time anyone reads it. This exports the
 * working rather than the answer.
 *
 * Driven entirely through the buttons, and read out of the generated file rather than off any
 * internal - which is the only way to prove the export a user actually gets is the one described
 * here. pdf.js is in the suite stack (see tests/node/harness.js), so window.StitchPdf is real and
 * handleExportMarkup takes its genuine path rather than the "writer did not load" fallback.
 */
boot();

function load(lines) {
    $('bulk-input').value = lines.join('\n');
    $('bulk-parse-btn').fire('click');
}

/** The text export, as the user receives it. */
function textExport() { BLOBS.length = 0; $('export-txt-btn').fire('click'); return BLOBS[0]; }

/**
 * The annotated PDF, decoded back to a string.
 *
 * The Blob stub stringifies whatever it is handed, and a Uint8Array stringifies as its bytes with
 * commas - so this reads those numbers back as characters. Ugly, and worth it: the alternative is
 * asserting against an internal, which would pass whether or not the button produced anything.
 */
function markupPdf() {
    BLOBS.length = 0;
    $('export-markup-btn').fire('click');
    if (!BLOBS.length) return '';
    var raw = String(BLOBS[0]);
    if (raw.indexOf(',') < 0) return raw;
    return raw.split(',').map(function (n) { return String.fromCharCode(Number(n)); }).join('');
}

/**
 * A pattern with nothing at all to say about it. Deliberately free of bracket repeats: "[sc, inc] x 6"
 * is correct, but it raises the one-per-document repeat-phrasing note, and a "clean" fixture that
 * actually carries a finding would make section 3 assert the opposite of what it claims.
 */
var GOOD = [
    'Rnd 1: 6 sc in magic ring (6)',
    'Rnd 2: inc in each st around (12)',
    'Rnd 3: sc in each st around (12)'
];

print('\n1. The ordinary text export is unchanged by the refactor');
// buildExportText is now defined in terms of buildExportLines. If the join is off by a newline
// anywhere, this is what says so - and the text export and both PDFs all read it.
load(GOOD);
var plain = textExport();
ok('the document was produced', plain && plain.length > 0);
ok('with its health section', plain.indexOf('PATTERN HEALTH') >= 0);
ok('and every row', plain.indexOf('Rnd 3:') >= 0);
ok('ending in a newline, as it always did', plain.charAt(plain.length - 1) === '\n');

print('\n2. The annotated draft is a real PDF');
var pdf = markupPdf();
ck('it has a PDF header', pdf.indexOf('%PDF-1.4'), 0);
ok('and a terminator', pdf.indexOf('%%EOF') > 0);
ok('and it contains the pattern', pdf.indexOf('Rnd 3') > 0);

print('\n3. A clean pattern carries no marks and no appendix');
ck('no appendix', pdf.indexOf('MARKUP NOTES') >= 0, false);
// No finding, so nothing sets a fill colour anywhere in the file.
ck('and no colour was written', / rg/.test(pdf), false);

print('\n4. A failing row is marked in coral, and the appendix says why');
var broken = GOOD.slice();
// Needs 18 stitches and has 12, so the round genuinely fails rather than merely miscounting.
broken[2] = 'Rnd 3: dec x 9 (12)';
load(broken);
var badPdf = markupPdf();
ok('there is an appendix', badPdf.indexOf('MARKUP NOTES') > 0);
ok('numbered, and filed as arithmetic', badPdf.indexOf('1. [arithmetic]') > 0);
ok('naming the round', badPdf.indexOf('Rnd 3') > 0);
ok('a fill colour was written', badPdf.indexOf(' rg') > 0);
ok('and a rule was filled under the row', badPdf.indexOf(' re f') > 0);
// The coral of style.css, as the PDF triple. The page and the printout must not claim different
// colours for the same severity - that is the whole reason this export exists.
ok('and it is the coral the screen uses', badPdf.indexOf('0.855 0.502 0.357 rg') > 0);

print('\n5. Colour never leaks past the thing it was set for');
ok('black is restored', badPdf.indexOf('0 0 0 rg') > 0);

print('\n6. A style finding is teal, not coral');
load([
    'Rnd 1: 6 sc in magic ring (6)',
    'Rnd 2: chain 1, double crochet in each st around (6)'
]);
var stylePdf = markupPdf();
ok('there is an appendix', stylePdf.indexOf('MARKUP NOTES') > 0);
ok('filed as style', stylePdf.indexOf('[style]') > 0);
ck('and nothing is filed as arithmetic', stylePdf.indexOf('[arithmetic]') >= 0, false);
ok('drawn in teal', stylePdf.indexOf('0.337 0.463 0.416 rg') > 0);
ck('and not in coral', stylePdf.indexOf('0.855 0.502 0.357 rg') >= 0, false);

print('\n7. The appendix carries the lesson, not just the complaint');
// The half a teacher can actually grade from: what the recurring misunderstanding IS.
ok('the "Why" line is there', stylePdf.indexOf('Why:') > 0);
ok('and it explains the convention', stylePdf.indexOf('Standard abbreviations') > 0);

print('\n8. A dismissed finding leaves the draft too');
// The file says exactly what the screen said, including what the writer chose to ignore.
$('lint-reject-all').fire('click');
var afterReject = markupPdf();
ck('the appendix is gone', afterReject.indexOf('MARKUP NOTES') >= 0, false);
ck('and so is the colour', / rg/.test(afterReject), false);

print('\n9. Exporting with no pattern writes no file');
load(['']);
BLOBS.length = 0;
$('export-markup-btn').fire('click');
ck('nothing was downloaded', BLOBS.length, 0);

print('\n10. The ordinary PDF export still works alongside it');
load(GOOD);
BLOBS.length = 0;
$('export-pdf-btn').fire('click');
ok('a file was produced', BLOBS.length > 0);
var plainPdf = String(BLOBS[0]).split(',').map(function (n) { return String.fromCharCode(Number(n)); }).join('');
ck('it is a PDF', plainPdf.indexOf('%PDF-1.4'), 0);
// The unannotated export must stay exactly what it was: no colour, no appendix.
ck('with no colour', / rg/.test(plainPdf), false);
ck('and no markup notes', plainPdf.indexOf('MARKUP NOTES') >= 0, false);

endSuite();
