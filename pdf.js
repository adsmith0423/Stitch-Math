/**
 * pdf.js - a PDF writer, in about two hundred lines and with no dependencies.
 *
 * WHY THIS EXISTS. "Print / Save PDF" was window.print(), which is fine on a desktop where every
 * browser puts "Save as PDF" in the print dialog, and not fine anywhere else: on iOS Safari and
 * Android Chrome the print sheet is inconsistent and sometimes AirPrint-only, so a tester on an iPad
 * taps the button and gets a system sheet with no way to save. Phones and tablets are supported
 * targets, so the file has to be generated rather than requested.
 *
 * WHY IT IS NOT A LIBRARY. Stitch Math has no dependencies and the build has none either. A PDF that
 * is text on pages is a genuinely small format: a handful of objects, a table of their byte offsets,
 * and a content stream of positioned strings. What a library buys is everything this deliberately
 * does not do - images, embedded fonts, tables, vector art - so importing one to lay out monospaced
 * text would be paying the whole cost for none of it.
 *
 * WHAT IT DOES NOT DO, stated so nobody goes looking. No images, no embedded fonts, no colour, no
 * compression, no unicode beyond Latin-1. Every one of those is a deliberate omission rather than an
 * unfinished edge, and each is why this file is short enough to read in one sitting.
 *
 * THE FONT CHOICE IS LOAD-BEARING. Courier is one of the fourteen fonts every PDF reader is required
 * to have built in, so nothing has to be embedded - and every one of its glyphs is exactly 0.6 em
 * wide. That means wrapping is arithmetic rather than measurement, which is the single thing that
 * would otherwise force a metrics table into this file. It also happens to be the right choice for
 * the content: a pattern's stitch counts line up in columns.
 *
 * Exposes window.StitchPdf.
 */
(function () {
    'use strict';

    /* US Letter at 72 units per inch, which is the PDF default and the only unit used below. */
    const PAGE = { width: 612, height: 792, margin: 54 };
    const BODY_SIZE = 9;
    const LINE_HEIGHT = 11.5;
    const TITLE_SIZE = 15;

    /* Courier: every glyph 0.6 em. The whole wrapping model rests on this one number. */
    const COURIER_ADVANCE = 0.6;
    const COLUMNS = Math.floor((PAGE.width - PAGE.margin * 2) / (BODY_SIZE * COURIER_ADVANCE));

    /**
     * Latin-1 is what the base-14 fonts encode, so anything outside it has to become something.
     *
     * Dropping unknown characters silently would quietly mangle a designer's own words, so the
     * handful this app actually emits are mapped to their nearest ASCII and everything else becomes
     * '?' - visible, and obviously a substitution rather than something they typed.
     */
    const TRANSLITERATE = {
        '‘': "'", '’': "'", '“': '"', '”': '"',
        '–': '-', '—': '-', '…': '...', ' ': ' ',
        '×': 'x', '✓': 'v', '✗': 'x', '→': '->',
        '▲': '^', '▼': 'v', '▶': '>', '•': '-'
    };

    function toLatin1(text) {
        let out = '';
        for (const ch of String(text == null ? '' : text)) {
            if (TRANSLITERATE[ch] !== undefined) { out += TRANSLITERATE[ch]; continue; }
            const code = ch.codePointAt(0);
            out += (code >= 32 && code <= 126) || (code >= 160 && code <= 255) ? ch : '?';
        }
        return out;
    }

    /* Inside a PDF string these three are syntax. Escaped in this order, or the backslashes double. */
    function escapeText(text) {
        return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    }

    /**
     * Wraps to the column count, breaking at spaces where it can.
     *
     * Leading whitespace is carried onto continuation lines. The export indents nested detail, and a
     * wrapped line that returns to column zero reads as a new item rather than the rest of one.
     */
    function wrap(line, columns) {
        if (line.length <= columns) return [line];
        // Capped at half the width: a deeply indented line would otherwise leave no room to wrap into
        // and the loop below would make no progress.
        const indent = (line.match(/^\s*/) || [''])[0].slice(0, Math.floor(columns / 2));
        const out = [];
        let rest = line;
        let prefix = '';
        while (prefix.length + rest.length > columns) {
            // The room left AFTER the indent. Measuring against the full width instead is how a
            // continuation line ends up wider than the page - it was, until a test said so.
            const room = columns - prefix.length;
            let cut = rest.lastIndexOf(' ', room);
            // A single word longer than the line - a long URL, or a rule of equals signs - has to be
            // broken mid-word, and a break at column zero would make no progress at all.
            if (cut < 1) cut = room;
            out.push(prefix + rest.slice(0, cut).replace(/\s+$/, ''));
            rest = rest.slice(cut).replace(/^\s+/, '');
            prefix = indent;
        }
        if (rest.length) out.push(prefix + rest);
        return out;
    }

    /** Splits the document into pages of positioned lines. */
    function paginate(lines, title) {
        const top = PAGE.height - PAGE.margin;
        const bottom = PAGE.margin + LINE_HEIGHT;
        const pages = [];
        let page = null;
        let y = 0;

        const startPage = () => {
            page = [];
            pages.push(page);
            y = top;
            if (pages.length === 1 && title) {
                page.push({ text: title, x: PAGE.margin, y, size: TITLE_SIZE, bold: true });
                y -= TITLE_SIZE * 1.9;
            }
        };
        startPage();

        for (const raw of lines) {
            for (const piece of wrap(raw, COLUMNS)) {
                if (y < bottom) startPage();
                // Blank lines advance without emitting an operator - a Tj of an empty string is legal
                // but writes an object for nothing, and a long export is mostly blank lines.
                if (piece.trim()) page.push({ text: piece, x: PAGE.margin, y, size: BODY_SIZE });
                y -= LINE_HEIGHT;
            }
        }
        return pages;
    }

    /** One page's content stream. Tm sets an absolute position, so no state carries between lines. */
    function contentStream(items) {
        let out = '';
        for (const item of items) {
            const font = item.bold ? '/F2' : '/F1';
            out += `BT ${font} ${item.size} Tf 1 0 0 1 ${item.x.toFixed(2)} ${item.y.toFixed(2)} Tm `
                 + `(${escapeText(toLatin1(item.text))}) Tj ET\n`;
        }
        return out;
    }

    /**
     * Assembles the file.
     *
     * The xref table is the part that has to be exactly right: it is a list of byte offsets into this
     * very string, and a reader uses it to find every object. Offsets are therefore measured as the
     * body is built rather than calculated afterwards - counting them a second way is how a PDF ends
     * up opening in one reader and not another.
     */
    function assemble(pages, meta) {
        const objects = [];
        const add = (body) => { objects.push(body); return objects.length; };

        // 1 catalog, 2 pages, 3 and 4 fonts, then a page and a stream per page.
        const catalogId = add(null);
        const pagesId = add(null);
        const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier '
                              + '/Encoding /WinAnsiEncoding >>');
        const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold '
                           + '/Encoding /WinAnsiEncoding >>');

        const pageIds = [];
        for (const items of pages) {
            const stream = contentStream(items);
            const streamId = add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
            pageIds.push(add(
                `<< /Type /Page /Parent ${pagesId} 0 R `
                + `/MediaBox [0 0 ${PAGE.width} ${PAGE.height}] `
                + `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> `
                + `/Contents ${streamId} 0 R >>`));
        }

        objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
        objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} `
            + `/Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;

        const info = add('<< /Producer (Stitch Math) /Creator (Stitch Math) '
            + `/Title (${escapeText(toLatin1(meta.title || 'Pattern'))}) >>`);

        let out = '%PDF-1.4\n';
        const offsets = [];
        for (let i = 0; i < objects.length; i++) {
            offsets.push(out.length);
            out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
        }

        const xrefAt = out.length;
        out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (const offset of offsets) {
            out += String(offset).padStart(10, '0') + ' 00000 n \n';
        }
        out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${info} 0 R >>\n`
             + `startxref\n${xrefAt}\n%%EOF\n`;
        return out;
    }

    /**
     * Plain text in, PDF bytes out.
     *
     * A Blob rather than a string, because every byte must be Latin-1: handing a JS string to a Blob
     * would UTF-8 encode it and a single accented character would then be two bytes the reader counts
     * against a /Length that assumed one.
     */
    function fromText(text, options) {
        const meta = options || {};
        const lines = String(text == null ? '' : text).split('\n');
        const pdf = assemble(paginate(lines, meta.title), meta);
        const bytes = new Uint8Array(pdf.length);
        for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
        return bytes;
    }

    window.StitchPdf = {
        fromText,
        // Exported for tests/node/pdf.test.js, which checks the wrapping rule and the xref offsets
        // rather than eyeballing a rendered page.
        _internals: { wrap, toLatin1, escapeText, paginate, assemble, COLUMNS }
    };
})();
