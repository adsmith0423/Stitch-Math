/**
 * Stitch Math - Node test harness.
 *
 * Runs the existing suites unchanged. They were written for the JavaScriptCore shell, which
 * loads every script file into one shared global scope; `var window = this` at the top of
 * test-dom.js then aliases that global, which is how `window.CrochetMathEngine = ...` in
 * validator.js becomes a plain global the suites can name.
 *
 * vm.runInContext reproduces that exactly - top-level `this` is the context's global object
 * and top-level `var` lands on it - so no source file and no suite needs editing. Only jsc's
 * two built-ins have to be supplied: print and readFile.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Run a list of script files in one fresh context, in order, as jsc would.
 *
 * `trailing` is evaluated last, for the engine suite's -e "window.RunMathTests();".
 * Returns the captured output plus the counts run-tests.sh derived by grepping it.
 */
function runSuite(scripts, trailing) {
    const output = [];
    let exceptions = 0;

    const sandbox = {
        print: (...args) => { output.push(args.map(String).join(' ')); },
        // Paths in the suites are relative to the project root, and stay that way here: several
        // suites assert against the real markup with readFile('index.html'). CRLF is normalised
        // because a Windows checkout would otherwise break every regex matched against source text.
        readFile: (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
    };
    // No console: jsc has none either, and the suites that need one shim it themselves
    // (tests/test-harness.js). Injecting it here would diverge from what run-tests.sh exercises.

    const context = vm.createContext(sandbox);

    const run = (code, filename) => {
        try {
            vm.runInContext(code, context, { filename });
        } catch (err) {
            // jsc prints uncaught exceptions into the same stream and run-tests.sh counts them
            // as failures. Match that rather than letting one bad suite abort the whole run.
            exceptions++;
            output.push('Exception: ' + (err && err.stack ? err.stack : String(err)));
        }
    };

    for (const rel of scripts) {
        run(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel);
    }
    if (trailing) run(trailing, 'trailing');

    const lines = output.join('\n').split('\n');
    return {
        pass: lines.filter(l => l.includes('  PASS')).length,
        fail: lines.filter(l => l.includes('  FAIL')).length,
        exceptions,
        output,
        lines
    };
}

/** The scripts every assertion suite is loaded on top of, in index.html's order. */
const APP_STACK = [
    'tests/test-dom.js',
    'tests/test-stub.js',
    'tests/test-assert.js',
    'validator.js',
    'analytics.js',
    'persistence.js',
    'app.js'
];

/** Run one tests/test-*.js suite against the full app stack. */
function runAppSuite(suiteFile) {
    return runSuite([...APP_STACK, 'tests/' + suiteFile]);
}

/**
 * Every suite run as an assertion suite by run-tests.sh: test-*.js minus the infrastructure
 * files and minus the corpora, which report "N of M" instead of PASS/FAIL.
 */
function assertionSuites() {
    const infrastructure = new Set(['test-dom.js', 'test-stub.js', 'test-harness.js', 'test-assert.js']);
    return fs.readdirSync(path.join(ROOT, 'tests'))
        .filter(f => f.startsWith('test-') && f.endsWith('.js'))
        .filter(f => !infrastructure.has(f) && !f.startsWith('test-corpus-'))
        .sort();
}

/** The last non-empty line of a run - what run-tests.sh reads off the corpora with tail -1. */
function lastLine(result) {
    const lines = result.lines.filter(l => l.trim() !== '');
    return lines.length ? lines[lines.length - 1].trim() : '';
}

/** The FAIL lines and any exception text, for use as an assertion message. */
function failureReport(result) {
    return result.lines
        .filter(l => l.includes('  FAIL') || l.startsWith('Exception:'))
        .join('\n');
}

module.exports = { ROOT, runSuite, runAppSuite, assertionSuites, lastLine, failureReport, APP_STACK };
