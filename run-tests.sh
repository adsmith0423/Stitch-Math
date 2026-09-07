#!/bin/bash
# Stitch Math test runner.
#
# There is no node and no build step. Everything runs under the JavaScriptCore shell
# that ships with macOS, against the same source files the browser loads.
#
#   ./run-tests.sh            run everything
#   ./run-tests.sh sizing     run only suites whose name contains "sizing"
#
# The suites live in tests/ but are RUN from the project root, because several of them
# call readFile('index.html') and readFile('style.css') to assert against the real markup.
# That is why the paths below are prefixed rather than the working directory changed.

cd "$(dirname "$0")" || exit 1
TESTS=tests

JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ ! -x "$JSC" ]; then
    echo "JavaScriptCore shell not found at $JSC"
    exit 1
fi

FILTER="$1"
GREEN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; OFF=$'\033[0m'

total_pass=0
total_fail=0
failed_suites=""

# --- Engine suite (tests.js, via window.RunMathTests) ---------------------------
# analytics.js is required here even though the suite is named for the math engine:
# without it, ten of the sixteen analytics tests fail on a missing AnalyzeComplexity.
if [ -z "$FILTER" ] || [[ "engine" == *"$FILTER"* ]]; then
    out=$("$JSC" "$TESTS/test-harness.js" validator.js analytics.js tests.js -e "window.RunMathTests();" 2>&1)
    echo "$out" | grep -E "COMPLETE|Tests:" | sed "s/^/  /"
    if echo "$out" | grep -q "❌"; then
        failed_suites="$failed_suites engine"
        total_fail=$((total_fail + 1))
    fi
    echo ""
fi

# --- Assertion suites -----------------------------------------------------------
for f in "$TESTS"/test-*.js; do
    base=$(basename "$f")
    case "$base" in
        test-dom.js|test-stub.js|test-harness.js|test-assert.js) continue ;;   # infrastructure
        test-corpus-*.js) continue ;;                                # reported separately
    esac
    [ -n "$FILTER" ] && [[ "$base" != *"$FILTER"* ]] && continue

    out=$("$JSC" "$TESTS/test-dom.js" "$TESTS/test-stub.js" "$TESTS/test-assert.js" validator.js analytics.js persistence.js pdf.js app.js "$f" 2>&1)
    pass=$(echo "$out" | grep -c "  PASS")
    fail=$(echo "$out" | grep -c "  FAIL")
    exc=$(echo "$out" | grep -c "Exception")

    total_pass=$((total_pass + pass))
    total_fail=$((total_fail + fail + exc))

    name="${base%.js}"
    if [ "$fail" != "0" ] || [ "$exc" != "0" ]; then
        printf "  %s%-22s %3s passed  %s failed%s\n" "$RED" "$name" "$pass" "$((fail + exc))" "$OFF"
        echo "$out" | grep -A2 "  FAIL\|Exception" | sed "s/^/      /"
        failed_suites="$failed_suites $name"
    else
        printf "  %s%-22s%s %3s passed\n" "$GREEN" "$name" "$OFF" "$pass"
    fi
done

# --- Pattern corpora ------------------------------------------------------------
# These report "N of M" rather than pass/fail assertions. Two are expected to be
# short of perfect; see the baseline in the README.
if [ -z "$FILTER" ] || [[ "corpus" == *"$FILTER"* ]]; then
    echo ""
    echo "  ${DIM}pattern corpora${OFF}"
    for f in test-corpus-pattern.js test-corpus-p2.js test-corpus-suite.js test-corpus-suite2.js test-corpus-garment.js; do
        line=$("$JSC" "$TESTS/test-dom.js" "$TESTS/test-stub.js" "$TESTS/test-assert.js" validator.js analytics.js persistence.js pdf.js app.js "$TESTS/$f" 2>&1 | tail -1)
        printf "  %-22s %s\n" "${f%.js}" "$line"
    done
fi

echo ""
if [ "$total_fail" = "0" ]; then
    echo "${GREEN}$total_pass assertions passed, 0 failed${OFF}"
    exit 0
fi
echo "${RED}$total_pass assertions passed, $total_fail failed${OFF} —$failed_suites"
exit 1
