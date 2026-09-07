/**
 * The build's comment stripper, against the cases that break naive ones.
 *
 * A node:test file rather than one of the tests/test-*.js suites, because those run inside a vm
 * context with only `print` and `readFile` supplied - no require - and build.js is Node code. Same
 * `npm test` either way.
 *
 * Everything else in build.js is a file read, a join and a sha256. This is the only part that has to
 * UNDERSTAND JavaScript, and the failure it can produce is the worst kind: a bundle that parses,
 * ships, and behaves differently. So it is tested here directly, and verified twice more at build
 * time - every string, template and regex literal must survive byte-identical and in the same order,
 * and the result must parse - before anything is written to dist/.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const B = require(path.join(ROOT, 'build.js'));
const strip = (src) => B.stripComments(src, 'test');

test('ordinary comments go, and the code around them stays', () => {
    assert.ok(!strip('var a = 1; // gone\nvar b = 2;').includes('gone'));
    assert.ok(strip('var a = 1; // gone\nvar b = 2;').includes('var b = 2;'));
    assert.ok(!strip('/* gone */ var a = 1;').includes('gone'));
    assert.ok(!strip('/**\n * gone\n */\nvar a = 1;').includes('gone'));
});

test('line numbers are preserved', () => {
    // A stack trace from dist must land on the same line as the source, or a bug report from a
    // designer names a line that means nothing.
    const block = '/**\n * one\n * two\n */\nvar a = 1;';
    assert.strictEqual(strip(block).split('\n').length, block.split('\n').length);
    assert.strictEqual(strip(block).split('\n')[4], 'var a = 1;');
});

test('what is NOT a comment is left alone', () => {
    // Each of these is a real way a naive stripper corrupts a file, and the reason this is a scanner
    // rather than two regexes.
    const cases = [
        ['a // inside a double-quoted string', 'var url = "http://example.com/path";'],
        ['inside a single-quoted string',      "var url = 'https://example.com';"],
        ['a template literal holding comment-shaped lines',
         'var t = `line one\n// not a comment\n* nor this\nend`;'],
        ['a regex containing a double slash',  'var re = /https?:\\/\\//g;'],
        ['a regex class holding a comment opener', 'var re = /[/*]/;'],
        ['a nested template literal',          'var t = `outer ${ `inner // text` } end`;']
    ];
    for (const [what, src] of cases) assert.strictEqual(strip(src), src, what);
});

test('division is not mistaken for a regex', () => {
    // The hard half of JS lexing. Get it backwards and everything after the slash is eaten.
    const out = strip('var x = (a + b) / 2; // gone\nvar y = c / d;');
    assert.ok(!out.includes('gone'));
    assert.ok(/\(a \+ b\) \/ 2;/.test(out) && /c \/ d;/.test(out));
});

test('the literal inventory is what the build rests on', () => {
    assert.strictEqual(B.literals('var a = "one"; var b = `two`;').join('|'), '"one"|`two`');
    const real = 'var msg = `a ${x} b`; // note\nvar re = /x\\/y/; var s = "z";';
    assert.deepStrictEqual(B.literals(strip(real)), B.literals(real));
});

test('stripComments throws rather than returning damage', () => {
    // The property that makes the build safe to run unattended: it cannot quietly ship a corrupted
    // bundle, only fail loudly. Forced here by handing it something that does not parse.
    assert.throws(() => B.stripComments('function ( {', 'broken'), /does not parse/);
});

test('css comments go, but not ones inside a content string', () => {
    assert.ok(!B.stripCssComments('/* gone */\n.a { color: red; }').includes('gone'));
    const css = '.a::after { content: "/* not a comment */"; }';
    assert.strictEqual(B.stripCssComments(css), css);
});

test('every literal in every shipped source survives stripping', () => {
    // The whole point, against the real files rather than fixtures.
    for (const file of ['validator.js', 'analytics.js', 'persistence.js', 'pdf.js', 'app.js']) {
        const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const out = B.stripComments(src, file);
        assert.deepStrictEqual(B.literals(out), B.literals(src), `${file}: literals changed`);
        assert.ok(out.length < src.length, `${file}: nothing was stripped`);
    }
});
test('html comments go, and the markup around them stays', () => {
    const src = '<p>one</p>\n<!-- gone -->\n<p>two</p>';
    const out = B.stripHtmlComments(src);
    assert.ok(!out.includes('gone'));
    assert.ok(out.includes('<p>one</p>') && out.includes('<p>two</p>'));
    assert.strictEqual(out.split('\n').length, src.split('\n').length);
});

test('verbatim regions keep their contents, comment-shaped or not', () => {
    // A <pre> showing sample pattern text, or a <textarea> holding a placeholder, is content a user
    // reads. A stripper that treats it as markup silently deletes part of the page.
    const cases = [
        '<pre>Row 1: sc 6 <!-- this is text --> (6)</pre>',
        '<textarea>ch 6 <!-- so is this --></textarea>',
        '<script>var a = 1; /* <!-- --> */</script>'
    ];
    for (const src of cases) assert.strictEqual(B.stripHtmlComments(src), src);
});

test('an unterminated comment is left alone rather than eating the page', () => {
    // The failure mode of a greedy regex. `<!--` with no closer is malformed markup, and the right
    // answer is to ship it unchanged and let the browser decide - not to delete everything after it.
    const src = '<p>kept</p><!-- no closer';
    assert.strictEqual(B.stripHtmlComments(src), src);
    assert.strictEqual(B.stripHtmlComments('<p>kept</p><!-- gone -->'), '<p>kept</p>');
});

test('index.html survives its own stripping', () => {
    // The real file, which is where the verbatim regions and the 100-plus comments actually live.
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const out = B.stripHtmlComments(src);
    assert.ok(out.length < src.length, 'nothing was stripped');
    assert.strictEqual(out.split('\n').length, src.split('\n').length, 'line numbers moved');
    assert.ok(!/<!--(?![\s\S]*?<\/(pre|textarea)>)/.test(out.replace(/<(pre|textarea)\b[\s\S]*?<\/\1>/g, '')),
              'a comment survived outside a verbatim region');
});
