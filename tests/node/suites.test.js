/**
 * Stitch Math - node:test entry point.
 *
 * Mirrors run-tests.sh: the engine suite, then every assertion suite, then the pattern corpora.
 * The suites themselves are untouched - they still count their own assertions and print
 * PASS/FAIL lines. What node:assert checks here is that a suite finished with nothing failed,
 * and that the corpora still read exactly the numbers they are pinned to.
 */

const test = require('node:test');
const assert = require('node:assert');
const { runSuite, runAppSuite, assertionSuites, lastLine, failureReport } = require('./harness');

// --- Engine suite (tests.js, via window.RunMathTests) -------------------------------
// analytics.js is required here even though the suite is named for the math engine: without it
// ten of the sixteen analytics tests fail on a missing AnalyzeComplexity.
test('engine (tests.js)', () => {
    const result = runSuite(
        ['tests/test-harness.js', 'validator.js', 'analytics.js', 'tests.js'],
        'window.RunMathTests();'
    );
    assert.strictEqual(result.exceptions, 0, result.output.join('\n'));
    const failed = result.lines.filter(l => l.includes('❌'));
    assert.deepStrictEqual(failed, [], 'engine suite reported failures:\n' + failed.join('\n'));
});

// --- Assertion suites ---------------------------------------------------------------
for (const suiteFile of assertionSuites()) {
    test(suiteFile.replace(/\.js$/, ''), () => {
        const result = runAppSuite(suiteFile);
        assert.strictEqual(
            result.fail + result.exceptions, 0,
            `${suiteFile}: ${result.pass} passed, ${result.fail + result.exceptions} failed\n` +
            failureReport(result)
        );
        // A suite that fails to boot prints nothing and would otherwise pass the check above.
        assert.ok(result.pass > 0, `${suiteFile} recorded no assertions at all`);
    });
}

// --- Pattern corpora ----------------------------------------------------------------
// These report "N of M" rather than PASS/FAIL. deepStrictEqual against the recorded baseline
// so drift is caught in both directions - a count that improves may mean a loosened assertion.
const CORPORA = [
    {
        file: 'test-corpus-pattern.js',
        pattern: /^(\d+) of (\d+) rows failed$/,
        keys: ['failed', 'total'],
        expected: { failed: 0, total: 20 }
    },
    {
        file: 'test-corpus-p2.js',
        pattern: /^(\d+) of (\d+) rows failed$/,
        keys: ['failed', 'total'],
        expected: { failed: 0, total: 10 }
    },
    {
        file: 'test-corpus-suite.js',
        pattern: /^(\d+) of (\d+) patterns fully clean$/,
        keys: ['clean', 'total'],
        expected: { clean: 12, total: 12 }
    },
    {
        file: 'test-corpus-suite2.js',
        pattern: /^(\d+) of (\d+) patterns fully clean$/,
        keys: ['clean', 'total'],
        expected: { clean: 10, total: 10 }
    },
    {
        // The 16 failing rows are expected: this corpus is three published Lion Brand patterns
        // and is meant to be short of perfect. The load-bearing part is that OCR and pdftotext
        // read the same, which says the line reflow follows the pattern, not the typesetting.
        file: 'test-corpus-garment.js',
        pattern: /^(\d+) of (\d+) patterns read the same from OCR and PDF, (\d+) work rows, (\d+) failing$/,
        keys: ['agree', 'total', 'workRows', 'failing'],
        expected: { agree: 3, total: 3, workRows: 234, failing: 16 }
    }
];

for (const corpus of CORPORA) {
    test(corpus.file.replace(/\.js$/, ''), () => {
        const line = lastLine(runAppSuite(corpus.file));
        const match = corpus.pattern.exec(line);
        assert.ok(match, `unrecognised summary line: ${JSON.stringify(line)}`);
        const actual = {};
        corpus.keys.forEach((key, i) => { actual[key] = Number(match[i + 1]); });
        assert.deepStrictEqual(actual, corpus.expected);
    });
}
