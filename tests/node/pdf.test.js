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
