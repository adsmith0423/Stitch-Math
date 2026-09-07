/**
 * Stitch Math - shared assertion helpers.
 *
 * Loaded ahead of every suite by both runners, exactly as test-dom.js and test-stub.js are, so these
 * land on the one shared global the suites already run in. 51 suites used to carry their own copy of
 * all of this: `ck` had two spellings whose FAIL text disagreed, `ok` had four, and the closing
 * summary line had four more.
 *
 * The two-space `  PASS` / `  FAIL` prefixes are load-bearing. Both runners count assertions by
 * looking for them in the output stream - run-tests.sh greps, tests/node/harness.js filters lines -
 * so reformatting either string silently changes every reported total.
 *
 * This file must stay listed as infrastructure in BOTH runners: the `case` list in run-tests.sh and
 * the `infrastructure` Set in tests/node/harness.js. Listed in only one, the other runs it as a
 * suite of its own, where it asserts nothing and fails the "a suite that booted reports at least one
 * pass" check.
 */

var p = 0, f = 0;

/**
 * Compared as strings, which is deliberate: the DOM stub hands back strings for every value read off
 * an element, so 3 and '3' have to agree or half the suite would be comparing types rather than
 * answers.
 */
function ck(l, a, e) {
    if (String(a) === String(e)) {
        print('  PASS  ' + l);
        p++;
    } else {
        print('  FAIL  ' + l + '\n         expected ' + e + ', got ' + a);
        f++;
    }
}

/** Truthy / falsy, reported as the same PASS and FAIL lines. */
function ok(l, c) { ck(l, !!c, true); }
function no(l, c) { ck(l, !c, true); }

/**
 * The closing line of every suite. Named `endSuite` rather than the obvious `summary` because that
 * name was already taken by two suites for their own things - a health-panel string in test-cascade
 * and a grade-summary reader in test-grader - and a global function is only as safe as the least
 * common name it claims.
 */
function endSuite() {
    print('\n=== ' + p + ' passed, ' + f + ' failed ===');
}
