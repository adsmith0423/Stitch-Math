#!/usr/bin/env node
/**
 * Stitch Math build - no dependencies, and deliberately so.
 *
 * A bundler exists to resolve an import graph. Stitch Math has none: five IIFEs, loaded in order by
 * script tags, sharing globals. Concatenating them in that order is what the browser already does, so
 * the "bundling" here is genuinely a file read and a join. Content hashing is node:crypto. Neither
 * needs a package, and keeping it that way is what lets `npm test` and CI run with no install step.
 *
 * The one job a real toolchain does better is minification, and it is not attempted here: safely
 * renaming identifiers or rewriting syntax needs a parser, and hand-rolling one is how a build starts
 * silently corrupting the thing it ships. What IS done is comment stripping - JavaScript, CSS and
 * HTML - which on this codebase takes the first visit from 324 KB gzipped to 176 KB, roughly 70% of
 * what full minification would save, and which is verified rather than trusted. See stripComments.
 *
 *   node build.js                 # dist/, comments stripped
 *   node build.js --keep-comments # dist/, byte-for-byte the source
 *
 * The source tree stays the dev entry point. index.html still loads the five plain files, both test
 * runners still read them directly, and nothing about writing code changes. dist/ is only what ships.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const KEEP_COMMENTS = process.argv.includes('--keep-comments');

/* Load order, and it matters: app.js reads the globals the three before it define. tests.js is absent
   on purpose - it is a development harness, and loadDevOnlyScripts() adds it on a dev origin only. */
const SCRIPTS = ['validator.js', 'analytics.js', 'persistence.js', 'pdf.js', 'app.js'];
const STATIC = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
                'icons/icon-maskable-512.png'];

// ---------------------------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------------------------

/**
 * Walks JavaScript once, reporting every region as code, comment, or literal.
 *
 * This is the only clever thing in the file, and it exists because "strip the comments" is not a
 * regex job. A `//` inside a string is not a comment; a `/` may open a regex or divide, and telling
 * those apart needs the previous significant token; a template literal can span lines and contain
 * anything at all, including text that looks exactly like a comment.
 *
 * The regex-versus-division rule below is the standard heuristic: a `/` starts a regex when the last
 * meaningful thing before it cannot end an expression. It is not a full parser and does not pretend
 * to be - which is precisely why the output is verified afterwards rather than assumed correct.
 */
function scan(src) {
    const regions = [];
    let i = 0, lastSignificant = '';
    const push = (kind, start, end) => regions.push({ kind, start, end });

    const canPrecedeRegex = () => {
        if (!lastSignificant) return true;
        if (/[({[,;:=!&|?+\-*%~^<>]$/.test(lastSignificant)) return true;
        return /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/
            .test(lastSignificant);
    };

    while (i < src.length) {
        const c = src[i], d = src[i + 1];

        if (c === '/' && d === '/') {
            const start = i;
            while (i < src.length && src[i] !== '\n') i++;
            push('line-comment', start, i);
            continue;
        }
        if (c === '/' && d === '*') {
            const start = i;
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i = Math.min(i + 2, src.length);
            push('block-comment', start, i);
            continue;
        }
        if (c === '"' || c === "'") {
            const start = i, quote = c;
            i++;
            while (i < src.length) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === quote) { i++; break; }
                i++;
            }
            push('string', start, i);
            lastSignificant = 'x';
            continue;
        }
        if (c === '`') {
            // Template literals nest: `${ `inner` }` is legal. Depth is tracked rather than assuming
            // the first backtick closes it, because getting this wrong is how a stripper eats code.
            const start = i;
            i++;
            let depth = 0;
            while (i < src.length) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
                if (src[i] === '}' && depth > 0) { depth--; i++; continue; }
                if (src[i] === '`' && depth === 0) { i++; break; }
                i++;
            }
            push('template', start, i);
            lastSignificant = 'x';
            continue;
        }
        if (c === '/' && canPrecedeRegex()) {
            const start = i;
            i++;
            let inClass = false, closed = false;
            while (i < src.length) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === '[') inClass = true;
                else if (src[i] === ']') inClass = false;
                else if (src[i] === '\n') break;              // an unterminated regex is division
                else if (src[i] === '/' && !inClass) { i++; closed = true; break; }
                i++;
            }
            if (closed) {
                while (i < src.length && /[gimsuyd]/.test(src[i])) i++;
                push('regex', start, i);
                lastSignificant = 'x';
                continue;
            }
            i = start + 1;
            lastSignificant = '/';
            continue;
        }
        if (!/\s/.test(c)) lastSignificant = (lastSignificant + c).slice(-12);
        i++;
    }
    return regions;
}

/** Every literal in the file, in order. The invariant the verification below rests on. */
function literals(src) {
    return scan(src)
        .filter(r => r.kind === 'string' || r.kind === 'template' || r.kind === 'regex')
        .map(r => src.slice(r.start, r.end));
}

// ---------------------------------------------------------------------------------------------
// Comment stripping, and the proof that it worked
// ---------------------------------------------------------------------------------------------

/**
 * Removes comments, then proves it removed only comments.
 *
 * Two checks, and the build aborts on either. The first is the one that matters: every string,
 * template and regex literal in the output must be identical, in the same order, to the input's. A
 * stripper that ate into a template literal - the realistic failure - changes that list immediately.
 * The second is that the result still parses. Neither is a substitute for the test suite, which runs
 * against the built bundle separately; they are what turns "it passed the tests" into "and it could
 * not have been wrong in the way this transformation goes wrong".
 *
 * A blank line is left where a comment was, so a stack trace from dist still lands on the right line
 * as the source. That costs a few KB before compression and almost nothing after it, and it is the
 * difference between a bug report you can act on and a line number that means nothing.
 */
function stripComments(src, label) {
    const regions = scan(src).filter(r => r.kind === 'line-comment' || r.kind === 'block-comment');
    let out = '', cursor = 0;
    for (const r of regions) {
        out += src.slice(cursor, r.start);
        const eaten = src.slice(r.start, r.end);
        const newlines = eaten.split('\n').length - 1;
        out += '\n'.repeat(newlines);
        cursor = r.end;
    }
    out += src.slice(cursor);

    const before = literals(src), after = literals(out);
    if (before.length !== after.length) {
        throw new Error(`${label}: comment stripping changed the literal count `
            + `(${before.length} -> ${after.length}). Refusing to ship. Build with --keep-comments.`);
    }
    for (let n = 0; n < before.length; n++) {
        if (before[n] !== after[n]) {
            throw new Error(`${label}: comment stripping altered a literal:\n  before: `
                + `${before[n].slice(0, 80)}\n  after:  ${after[n].slice(0, 80)}\n`
                + `Refusing to ship. Build with --keep-comments.`);
        }
    }
    try {
        new Function(out);
    } catch (err) {
        throw new Error(`${label}: the stripped output does not parse (${err.message}). `
            + `Refusing to ship.`);
    }
    return out;
}

/**
 * CSS is a much smaller problem: no regex literals, no templates, so a comment is anything
 * between the block markers that is not inside a quoted string. url() and content: are the only
 * places a stray marker can hide, and both are quoted.
 */
function stripCssComments(src) {
    let out = '', i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '*') {
            const start = i;
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i = Math.min(i + 2, src.length);
            out += '\n'.repeat(src.slice(start, i).split('\n').length - 1);
            continue;
        }
        if (c === '"' || c === "'") {
            const quote = c;
            out += c; i++;
            while (i < src.length) {
                out += src[i];
                if (src[i] === '\\') { out += src[i + 1] || ''; i += 2; continue; }
                if (src[i] === quote) { i++; break; }
                i++;
            }
            continue;
        }
        out += c; i++;
    }
    return out;
}

/**
 * Strips HTML comments from index.html, leaving verbatim regions alone.
 *
 * index.html carries the same density of explanation as the JavaScript does - 17% of its bytes are
 * comments describing what each panel is for - and by the same argument they should not be in the
 * download. It is a smaller win than the JS strip (about 7 KB gzipped) but it is the same win, and
 * leaving it on the table would have made the build inconsistent about its own rule.
 *
 * Two things are NOT touched. `<pre>` and `<textarea>` contents are rendered exactly as written, so
 * a comment opener in there is text a user reads, not markup. `<script>` and `<style>` bodies are
 * JavaScript and CSS, where `<!--` has a different meaning again; index.html has no inline ones
 * today, and this makes sure adding one later does not quietly corrupt it.
 *
 * As with the JavaScript stripper the result is verified rather than trusted: the tag sequence and
 * the visible text must both come out unchanged, or the build stops.
 */
function stripHtmlComments(src) {
    /* One pass, one regex, alternating between the two things worth finding. Capture group 1 is the
       verbatim tag name, and its presence is how a match tells the two cases apart. */
    const token = /<!--[\s\S]*?-->|<(pre|textarea|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
    let out = '', last = 0, m;
    while ((m = token.exec(src)) !== null) {
        out += src.slice(last, m.index);
        // Line numbers survive, for the same reason they do in the JavaScript: a bug report that
        // names a line in the shipped file should name the same line in the source.
        out += m[1] ? m[0] : '\n'.repeat((m[0].match(/\n/g) || []).length);
        last = m.index + m[0].length;
    }
    out += src.slice(last);

    /* Verification. Comments are removed from both sides before comparing, so a comment that lives
       inside a <pre> - kept in the output, absent from the naive view of the input - does not read
       as a difference. What is being asserted is that nothing ELSE moved. */
    const bare = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
    const tags = (s) => (bare(s).match(/<[^>]+>/g) || []).join('\n');
    const text = (s) => bare(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (tags(out) !== tags(src)) {
        throw new Error('build: stripping HTML comments changed the tag sequence in index.html.');
    }
    if (text(out) !== text(src)) {
        throw new Error('build: stripping HTML comments changed the visible text of index.html.');
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------

const hash8 = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
const kb = (text) => (Buffer.byteLength(text) / 1024).toFixed(1) + ' KB';

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

function build() {
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });

    // --- the bundle ---------------------------------------------------------------------------
    let js = '';
    for (const file of SCRIPTS) {
        const src = read(file);
        // A newline AND a semicolon between files. Two of the four end in an IIFE with no trailing
        // semicolon, and `})()` followed by `(function(){` on the next line is a call, not two
        // statements - the classic concatenation bug, and it fails at load rather than subtly.
        js += (KEEP_COMMENTS ? src : stripComments(src, file)) + '\n;\n';
    }
    // loadDevOnlyScripts() fetches tests.js on localhost and file://, which is right for the source
    // tree and wrong here: dist/ does not contain tests.js, so a developer previewing the build from
    // localhost gets a 404 in the console for a file the build deliberately omits. The built bundle is
    // by definition not the dev entry point, so the call is removed rather than the file shipped.
    const devCall = 'loadDevOnlyScripts();';
    if (!js.includes(devCall)) {
        throw new Error('build: the dev-only script loader call was not found in the bundle. '
            + 'If it was renamed, update build.js - otherwise dist/ will 404 on tests.js.');
    }
    js = js.split(devCall).join('/* dev-only loader removed by build.js */');

    const css = KEEP_COMMENTS ? read('style.css') : stripCssComments(read('style.css'));

    // --- content hashes -----------------------------------------------------------------------
    // Derived from the bytes, so they cannot be forgotten the way the ?v= stamps could. This is the
    // whole reason the build is worth having: the version now has one source and no one to remember it.
    const jsName = `app.${hash8(js)}.js`;
    const cssName = `style.${hash8(css)}.css`;
    fs.writeFileSync(path.join(DIST, jsName), js);
    fs.writeFileSync(path.join(DIST, cssName), css);

    // --- index.html ---------------------------------------------------------------------------
    let html = KEEP_COMMENTS ? read('index.html') : stripHtmlComments(read('index.html'));
    html = html.replace(/<link rel="stylesheet" href="style\.css[^"]*">/,
                        `<link rel="stylesheet" href="${cssName}">`);
    // The four script tags become one. Matched as a block so a stray tag elsewhere is left alone.
    html = html.replace(
        /<script src="validator\.js[^"]*"><\/script>[\s\S]*?<script src="app\.js[^"]*"><\/script>/,
        `<script src="${jsName}"></script>`);
    if (html.includes('validator.js') || !html.includes(jsName)) {
        throw new Error('index.html was not rewritten as expected - the script block did not match.');
    }
    fs.writeFileSync(path.join(DIST, 'index.html'), html);

    // --- service worker -----------------------------------------------------------------------
    // PRECACHE is generated from what was actually emitted. Written by hand it would list names the
    // build no longer produces, and the cache would sit unused while every load hit the network.
    let sw = read('sw.js');
    const precache = ['./', './index.html', `./${jsName}`, `./${cssName}`, ...STATIC.map(f => `./${f}`)];
    sw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/,
        'const PRECACHE = [\n' + precache.map(p => `    '${p}'`).join(',\n') + '\n];');
    // The cache name keys off the bundle hash, so any change to any source file retires the old cache.
    sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${hash8(js + css)}';`);
    // Scoped to the precache block. CACHE_NAME legitimately keeps its `stitch-math-${VERSION}` template
    // - it is evaluated at run time by the worker - and an unscoped check flags that as a failure.
    const precacheBlock = sw.match(/const PRECACHE = \[[\s\S]*?\];/);
    if (!precacheBlock || precacheBlock[0].includes('${')) {
        throw new Error('sw.js precache list was not rewritten to real filenames.');
    }
    if (!precacheBlock[0].includes(jsName)) {
        throw new Error(`sw.js precache does not name the emitted bundle (${jsName}).`);
    }
    fs.writeFileSync(path.join(DIST, 'sw.js'), KEEP_COMMENTS ? sw : stripComments(sw, 'sw.js'));

    // --- everything else ----------------------------------------------------------------------
    for (const file of STATIC) {
        fs.copyFileSync(path.join(ROOT, file), path.join(DIST, file));
    }

    // --- report -------------------------------------------------------------------------------
    const rawJs = SCRIPTS.reduce((n, f) => n + Buffer.byteLength(read(f)), 0);
    console.log('dist/');
    console.log(`  ${jsName.padEnd(24)} ${kb(js).padStart(10)}   (from ${(rawJs / 1024).toFixed(1)} KB of source)`);
    console.log(`  ${cssName.padEnd(24)} ${kb(css).padStart(10)}`);
    console.log(`  ${'index.html'.padEnd(24)} ${kb(html).padStart(10)}   (from ${(Buffer.byteLength(read('index.html')) / 1024).toFixed(1)} KB of source)`);
    console.log(`  sw.js, manifest, ${STATIC.length - 1} icons`);
    console.log(`  comments: ${KEEP_COMMENTS ? 'kept' : 'stripped, and every literal verified unchanged'}`);
}

/* Exported so the transformations can be tested rather than trusted - tests/test-build.js drives
   stripComments against the cases that break naive strippers, and a verification pass runs the whole
   assertion suite against stripped copies of the sources. Only a direct `node build.js` builds. */
module.exports = { scan, literals, stripComments, stripCssComments, stripHtmlComments, build };

if (require.main === module) {
    try {
        build();
    } catch (err) {
        console.error('\nBuild failed: ' + err.message);
        process.exit(1);
    }
}
