/**
 * The PDF writer.
 *
 * A node:test file because pdf.js is loaded into a browser global and the vm harness supplies no
 * require; here it is evaluated against a stub window and driven directly.
 *
 * What is worth testing about a file format writer is not that it "produces a PDF" - almost anything
 * does, and a reader will open some remarkably broken ones - but the two things that silently go
 * wrong: the xref byte offsets, which a reader uses to find every object and which are trivially
 * wrong if anything is counted twice, and the encoding, where one non-Latin-1 character turns a
 * declared /Length into a lie. Both are asserted below against the bytes themselves.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// Evaluated in THIS realm rather than through node:vm, and the difference is not cosmetic: a vm
// context has its own Array and Uint8Array, so `instanceof Uint8Array` is false and deepStrictEqual
// reports "same structure but not reference-equal" for objects that are correct. Both looked like
// bugs in pdf.js the first time round and were bugs in this file.
const shim = { window: {} };
new Function('window', fs.readFileSync(path.join(ROOT, 'pdf.js'), 'utf8'))(shim.window);
const PDF = shim.window.StitchPdf;
const { wrap, toLatin1, escapeText, paginate, COLUMNS } = PDF._internals;

const decode = (bytes) => Buffer.from(bytes).toString('latin1');

test('it exposes a writer', () => {
    assert.strictEqual(typeof PDF.fromText, 'function');
});

test('wrapping breaks at spaces and keeps the indent', () => {
    const line = '    Row 12: sc in each st across, then repeat the shell from the previous round';
    const out = wrap(line, 40);
    assert.ok(out.every(l => l.length <= 40), 'every line fits the column count');
    assert.ok(out.length > 1, 'it actually wrapped');
    assert.ok(out[1].startsWith('  '), 'continuation lines keep an indent');
    assert.strictEqual(out.join(' ').replace(/\s+/g, ' ').trim(),
                       line.replace(/\s+/g, ' ').trim(), 'no words are lost');
});

test('a word longer than the line is broken rather than looping', () => {
    const rule = '='.repeat(120);
    const out = wrap(rule, 40);
    assert.strictEqual(out.length, 3);
    assert.ok(out.every(l => l.length <= 40));
});

test('short lines are left exactly alone', () => {
    assert.deepStrictEqual(wrap('Row 1: ch 13 (12)', COLUMNS), ['Row 1: ch 13 (12)']);
});

test('non-Latin-1 becomes something visible, never nothing', () => {
    // The app emits these; a designer's own words may contain anything.
    assert.strictEqual(toLatin1('x 6 × 3'), 'x 6 x 3');
    assert.strictEqual(toLatin1('valid ✓'), 'valid v');
    assert.strictEqual(toLatin1('‘quoted’'), "'quoted'");
    // Something with no mapping is substituted, not dropped - a silent deletion would mangle a
    // designer's text without telling them.
    assert.strictEqual(toLatin1('emoji \u{1F9F6}'), 'emoji ?');
    // Latin-1 itself survives: accented names in a project title are common.
    assert.strictEqual(toLatin1('Marisol Nuñez'), 'Marisol Nuñez');
});

test('parentheses and backslashes are escaped, in the right order', () => {
    // These three are PDF string syntax. Escaped in the wrong order the backslashes double.
    assert.strictEqual(escapeText('Row 1 (12)'), 'Row 1 \\(12\\)');
    assert.strictEqual(escapeText('a\\b'), 'a\\\\b');
    assert.strictEqual(escapeText('\\(x)'), '\\\\\\(x\\)');
});

test('pagination starts a new page rather than running off the bottom', () => {
    const pages = paginate(Array.from({ length: 400 }, (_, i) => 'line ' + i), 'Title');
    assert.ok(pages.length > 1, 'four hundred lines is more than one page');
    for (const page of pages) {
        for (const item of page) assert.ok(item.y >= 50, 'nothing is placed below the margin');
    }
});

test('the xref offsets actually point at their objects', () => {
    // The one thing that quietly breaks a PDF. Every offset in the table must land exactly on the
    // "N 0 obj" it claims to describe; a reader that follows a wrong one shows a blank document.
    const text = 'TITLE\n\nRow 1: ch 13 (12)\nRow 2: sc in each st (12)\n';
    const file = decode(PDF.fromText(text, { title: 'Test Pattern' }));

    const startxref = Number(file.match(/startxref\n(\d+)/)[1]);
    assert.ok(file.slice(startxref).startsWith('xref'), 'startxref points at the table');

    const table = file.slice(startxref).split('\n');
    const count = Number(table[1].split(' ')[1]);
    for (let n = 1; n < count; n++) {
        // Entry 0 is the free-list head; real objects start at 1.
        const offset = Number(table[1 + n + 1].slice(0, 10));
        assert.ok(file.slice(offset).startsWith(`${n} 0 obj`),
                  `xref entry ${n} points at offset ${offset}, which is not "${n} 0 obj"`);
    }
});

test('the declared stream length matches the bytes written', () => {
    // A /Length that disagrees with its stream is the other silent corruption: some readers trust it
    // and truncate, others recover, so it can look fine in one viewer and empty in another.
    const file = decode(PDF.fromText('Row 1: ch 13 (12)\n', { title: 'Lengths' }));
    const re = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g;
    let match, checked = 0;
    while ((match = re.exec(file))) {
        assert.strictEqual(match[2].length, Number(match[1]), 'stream length matches its declaration');
        checked++;
    }
    assert.ok(checked > 0, 'there was a stream to check');
});

test('the file has the parts a reader looks for', () => {
    const file = decode(PDF.fromText('Row 1: ch 13 (12)\n', { title: 'Shape' }));
    assert.ok(file.startsWith('%PDF-1.4'), 'header');
    assert.ok(file.trimEnd().endsWith('%%EOF'), 'terminator');
    assert.ok(/\/Type \/Catalog/.test(file) && /\/Type \/Pages/.test(file) && /\/Type \/Page[^s]/.test(file));
    assert.ok(/\/BaseFont \/Courier/.test(file), 'a base-14 font, so nothing is embedded');
    assert.ok(!/\/FontFile/.test(file), 'and no font is embedded');
});

test('every byte is Latin-1, so the length declarations hold', () => {
    const bytes = PDF.fromText('Marisol Nuñez — 6 × 3\n', { title: 'Encoding' });
    assert.ok(bytes instanceof Uint8Array);
    for (const b of bytes) assert.ok(b <= 0xff);
    const text = decode(bytes);
    assert.ok(text.includes('Nuñez'), 'an accent survives as one byte');
    assert.ok(text.includes('6 x 3'), 'and the multiplication sign was transliterated');
});

test('an empty document still produces a valid file', () => {
    const file = decode(PDF.fromText('', { title: 'Empty' }));
    assert.ok(file.startsWith('%PDF-1.4') && file.trimEnd().endsWith('%%EOF'));
});

/* === MARKED LINES ==============================================================================
 * The annotated draft. Colour was one of this file's stated omissions until the export that needed
 * it arrived, so what is asserted here is that adding it did not break the two things that silently
 * go wrong - and that the graphics state it introduces is always put back.
 */

test('a marked line is drawn with a coloured rule under it', () => {
    const stream = PDF._internals.contentStream(
        PDF._internals.paginate([{ text: 'Row 3: sc in each st across (12)', mark: 'math' }], null)[0]
    );
    const coral = PDF._internals.MARK_COLORS.math;
    assert.ok(stream.includes(`${coral[0]} ${coral[1]} ${coral[2]} rg`), 'the coral fill is set');
    assert.ok(/\d+\.\d\d \d+\.\d\d \d+\.\d\d 0\.7 re f/.test(stream), 'and a rectangle is filled');
});

test('the rule is exactly as wide as the text above it', () => {
    // Arithmetic rather than measurement, which is only possible because every Courier glyph is
    // 0.6em. A rule that does not match its text is the tell that this assumption has been broken.
    const text = 'Row 3: sc (12)';
    const items = PDF._internals.paginate([{ text, mark: 'style' }], null)[0];
    const rule = items.find(i => i.rule);
    assert.ok(rule, 'a rule was emitted');
    assert.strictEqual(Number(rule.width.toFixed(4)), Number((text.length * 9 * 0.6).toFixed(4)));
});

test('an indented line starts its rule at the first character, not in the margin', () => {
    const items = PDF._internals.paginate([{ text: '   indented note', mark: 'style' }], null)[0];
    const rule = items.find(i => i.rule);
    const body = items.find(i => !i.rule);
    assert.ok(rule.x > body.x, 'the rule is inset past the leading spaces');
    assert.strictEqual(Number(rule.width.toFixed(4)), Number(('indented note'.length * 9 * 0.6).toFixed(4)));
});

test('colour is always put back to black', () => {
    // The one piece of graphics state that persists between items. Without the reset, one teal
    // underline tints every page after it - and nothing about the file would look wrong.
    const stream = PDF._internals.contentStream(
        PDF._internals.paginate([
            { text: 'flagged row', mark: 'style' },
            'an ordinary row'
        ], null)[0]
    );
    const setColour = [...stream.matchAll(/^([\d.]+ [\d.]+ [\d.]+) rg$/gm)].map(m => m[1]);
    assert.ok(setColour.length > 0, 'colour was set at all');
    assert.strictEqual(setColour[setColour.length - 1], '0 0 0',
        'the last colour operator in the stream returns to black');
});

test('an unmarked line emits no colour operator at all', () => {
    const stream = PDF._internals.contentStream(PDF._internals.paginate(['plain row'], null)[0]);
    assert.ok(!/ rg/.test(stream), 'nothing sets a fill colour');
});

test('a mark survives wrapping onto continuation lines', () => {
    // A flagged row that wraps is still one row, and underlining only its first line would point at
    // half a fault.
    const long = 'Row 9: ' + 'sc in next st, '.repeat(12) + '(48)';
    const items = PDF._internals.paginate([{ text: long, mark: 'math' }], null)[0];
    const texts = items.filter(i => !i.rule);
    const rules = items.filter(i => i.rule);
    assert.ok(texts.length > 1, 'the line really did wrap');
    assert.strictEqual(rules.length, texts.length, 'every wrapped piece carries its own rule');
});

test('an unknown mark name is ignored rather than crashing', () => {
    const items = PDF._internals.paginate([{ text: 'row', mark: 'nonsense' }], null)[0];
    assert.strictEqual(items.filter(i => i.rule).length, 0, 'no rule');
    assert.strictEqual(items[0].mark, null, 'and the text is not coloured');
});

test('the xref offsets are still exact with rules in the stream', () => {
    // The load-bearing assertion of this whole file, repeated for the annotated path: colour adds
    // bytes to the content stream, and an offset table counted a second way is how a PDF ends up
    // opening in one reader and not another.
    const lines = [];
    for (let i = 1; i <= 60; i++) {
        lines.push(i % 3 === 0 ? { text: `Row ${i}: sc in each st across (${i})`, mark: 'math' }
                               : `Row ${i}: sc in each st across (${i})`);
    }
    const file = decode(PDF.fromText(lines, { title: 'Annotated' }));
    const xrefAt = Number(file.slice(file.lastIndexOf('startxref')).match(/startxref\n(\d+)/)[1]);
    assert.ok(file.slice(xrefAt).startsWith('xref'), 'startxref points at the table');

    const offsets = [...file.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
    assert.ok(offsets.length > 4, 'there are objects to check');
    offsets.forEach((offset, i) => {
        assert.ok(file.slice(offset).startsWith(`${i + 1} 0 obj`),
                  `xref entry ${i + 1} points at offset ${offset}, which is not "${i + 1} 0 obj"`);
    });

    const re = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g;
    let match, checked = 0;
    while ((match = re.exec(file))) {
        assert.strictEqual(match[2].length, Number(match[1]), 'stream length matches its declaration');
        checked++;
    }
    assert.ok(checked > 1, 'the document ran to more than one page');
});

test('an array of plain strings behaves exactly like the string form', () => {
    // Every existing caller passes a string. The array form must not be a second document format.
    const text = 'Row 1: ch 13 (12)\nRow 2: sc in each ch across (12)';
    const fromString = decode(PDF.fromText(text, { title: 'Same' }));
    const fromArray = decode(PDF.fromText(text.split('\n'), { title: 'Same' }));
    assert.strictEqual(fromArray, fromString);
});
