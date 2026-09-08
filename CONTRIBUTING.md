# Contributing & Coding Standards

To maintain code clarity and prevent AI or developer drift, strictly follow these standards.

---

## Code Standards

### 1. JavaScript Standards
* Use modern ES6+ syntax (`const`/`let`, arrow functions, template literals, destructuring).
* All utility/parsing functions in `validator.js` and `analytics.js` **must** be pure functions.
* **Strict DOM Selector Caching:** All DOM queries MUST be cached inside the central `UI` object in `app.js`. Avoid running `document.getElementById` or `document.querySelector` inside handlers or loops.

### 2. Modularity & DOM Separation
* **DOM Rule:** If a file is not `app.js`, it **must not** contain any `document.querySelector`, `innerHTML`, `classList`, or DOM manipulation code.
* **Logic Rule:** Never duplicate parsing logic. Always delegate parsing tasks to `window.CrochetMathEngine`.

### 3. Standard Validation Payload Contract

`CrochetMathEngine.evaluateStep()` returns:

```javascript
{
    costIsValid: boolean,      // false only when the row cannot be worked as written
    calculatedYield: number,   // what the row actually produces; the authoritative count
    reason: string,            // '' when valid; HTML-bearing explanation when not
    errorDetails: Array<{ type: string, message: string }>,
    unknownTokens: Array<string>,
    notes: Array<string>,      // advisory, does NOT invalidate the row
    resolutions: Array<string>,
    fixes: Array<object>,      // the same findings as applicable edits; see below
    likelyCauses: Array<object>
}
```

`fixes` is what `resolutions` says, in a form a caller can act on:
`{ id, severity: 'math'|'syntax'|'style', title, detail, lesson?, edit }`. Both `fixes` and
`resolutions` come from one `diagnosisContext`, so they cannot disagree. **`edit: null` is a real
value** — a finding worth showing that is not worth applying automatically, such as an unknown term
or a row that does not balance, where the correction is a choice rather than a calculation. The
linter renders those with no Apply button. An `edit` names *what* to change (`multiplier`,
`statedCount`, `insert`, `replaceAt`, `foundationOrdinal`, `repeatPhrasing`) rather than a string to
search for, because by the time the engine sees a row its label and written count have been parsed
off `instructionString`.

`severity: 'style'` flags a row that is valid but leaves something to guess at, or writes something
correct in a less explicit form than it could — as opposed to something wrong. It carries an optional
`lesson`: one general sentence on why the convention matters, as opposed to `detail`'s specific claim
about this row's own text. The linter labels a style fix's apply button "Accept Suggested Formatting"
rather than "Suggest a fix". Two rules build one today, both in `validator.js`:

* `buildUnstatedSkipFix` — the Row-1 assumed-skip disclosure. Per row.
* `buildRepeatPhrasingFix` — bracket repeat shorthand (`[2 sc, inc] x 6`) rewritten long-form
  (`*sc in next 2 sts, 2 sc in next st; rep from * 5 more times`). **Raised once per document**, not
  per row: `evaluatePatternRows` stops after the first row that produces one, and the sidebar offers
  a "Standardize All (N)" button (`standardizeAllRepeats`, app.js) that applies it everywhere.
  Shorthand is correct and used consistently, so a card per row would be a preference pushed rather
  than a convention pointed out.

**A repeat rewrite is verified, not trusted.** `buildRepeatPhrasing` reads both the original and its
long form back through `parseInstructions` and returns `null` unless `totalCost` and `totalYield`
match exactly. A phrasing template that drifts from what the tokenizer understands is otherwise
invisible and silently rewrites a correct row into a wrong one — `sk next 2 sts` reads as ONE skip
where the `sk 2` it replaced reads as two. Keep that check if you add phrasings.

`CrochetMathEngine.parseInstructions()` is the token-level call and returns a different
shape, including `tokens: Array<{ name, count, cost, yield }>`, `totalCost`, `totalYield`,
`expandedText`, `errors` and `warnings`.

Two things worth knowing before coding against this:

* **The stitch-count mismatch is a `note`, not a failure.** A row whose written count
  disagrees with the calculated one stays `costIsValid: true` and reports the discrepancy
  through `notes`. The engine treats its own arithmetic as authoritative and tells the user
  so. Do not "fix" this by invalidating the row.
* **It is `unknownTokens`, not `unrecognizedTokens`.** `parseInstructions` happens to expose
  both spellings; `evaluateStep` only has the former. Reading the wrong one returns
  `undefined` silently.

## Workflow Rules
Granular Commits: Commit often with descriptive titles (feat(parser): ..., fix(gauge): ...).

Test Driven Verification: Before committing changes to validator.js or analytics.js, run `npm test` from the project root and confirm 0 failures.

---

## Running the tests

There is no build step: the tests load the same source files the browser does. There are two
runners, and they run the same suites and must agree.

```
npm test                    # everything, under Node — this is what CI runs
npm run build               # dist/, the shipped copy
npm run test:browser        # the storage suite, against a real browser (needs Playwright)
./run-tests.sh              # everything, under macOS JavaScriptCore
./run-tests.sh sizing       # only suites whose filename contains "sizing"
```

`npm run test:browser` is separate on purpose. `npm test` runs anywhere with no dependencies, and
that property is worth keeping; the storage suite needs a real IndexedDB and therefore a real
browser. It is still a release blocker when it is red — it covers the one code path that can lose a
designer's work, and with cloud sync descoped there is no second copy anywhere.

`npm test` is the one to use. It needs no dependencies — `tests/node/harness.js` recreates
JavaScriptCore's shared-global model with `vm.runInContext`, which is why the suites and the
source files did not have to change to run under Node.

`./run-tests.sh` is kept as the macOS fallback and takes a filter argument, which the Node
runner does not. Both exit non-zero on any failure, so either can gate a commit.

The baseline is **4112 assertions, 0 failed** across 107 node:test cases, and the two runners report identical per-suite
counts. If a previously passing count drops, that is a regression; if one rises, check that
an assertion was not simply loosened.

Everything lives in `tests/`:

* `tests/test-*.js` — the suites. One file per area; each prints `PASS` / `FAIL` lines and ends
  with `endSuite();`.
* `tests/test-dom.js`, `tests/test-stub.js` — headless DOM stubs that let `app.js` run
  outside a browser.
* `tests/test-assert.js` — the shared assertion helpers `ck`, `ok`, `no` and `endSuite`, plus the
  `p` / `f` counters. Loaded ahead of every suite by both runners, so a suite declares none of them.
  Two things to know before touching it: the two-space `  PASS` / `  FAIL` prefixes are how **both**
  runners count assertions, and the file has to stay listed as infrastructure in **both** the `case`
  list in `run-tests.sh` and the `infrastructure` Set in `tests/node/harness.js` — listed in only
  one, the other runs it as a suite that asserts nothing and fails.
* `tests/test-harness.js` — console shims for the engine suite in `tests.js`.
* `tests/test-envelope.js`, `test-migrate.js`, `test-store.js` — the pure half of
  `persistence.js`: the project envelope and its validator, the forward-only migration dispatcher,
  and the store's retention rule and callback contract. These touch no DOM at all, which is the
  point — every storage assertion in this repo before them was an indirect, DOM-driven one.
* `tests/test-autosave.js`, `test-snapshots.js`, `test-portable.js`, `test-recovery.js` — the
  application half, in `app.js` section 5b. Read `PERSISTENCE.md` before changing any of them: the
  two hard rules it opens with (a newer file is never guessed at; recovery points are not version
  history) are asserted here, including one message word for word.
* `tests/test-corpus-*.js` — real-world pattern corpora. These report "N of M" rather than
  assertions; two are expected to be short of perfect (see the baseline below).
* `tests/test-vintage-corpus.js` + `tests/fixtures-vintage.json` — 479 rows lifted verbatim
  from public-domain American Thread and Spool Cotton books. Unlike the other corpora these
  were **not** chosen to be parseable, so most of them are not. The suite measures how much
  the tokenizer can read (currently ~40%) and asserts a floor rather than a target, so a
  regression shows up as the number falling.
* `tests/test-prose.js` + `tests/fixtures-vintage-counts.json` — the non-stitch prose rules,
  and a snapshot of the calculated count for every vintage row the engine can read. If a
  count in that snapshot moves, an answer changed: **inspect before accepting.** It is a
  change detector, not a correctness oracle — 28 rows moved when prose stripping landed and
  all 28 were corrections.

The suites live in `tests/` but are **run from the project root**, because several assert
against the real markup via `readFile('index.html')`. That is why `run-tests.sh` prefixes
paths instead of changing directory.

**Baseline that must hold.** Engine 177/177, parser 8/8, feedback 5/5, analytics 16/16;
**4112 assertions, 0 failed** as `./run-tests.sh` reports it on its closing line, which is the
grand total across every suite including the engine ones named above;
`test-corpus-pattern` and `test-corpus-p2` at 0 failing
rows; `test-corpus-pattern` and `test-corpus-p2` also at **0 miscounted**; `test-corpus-suite` at 12 of 12
and `test-corpus-suite2` at 10 of 10. All four now hold the same stronger claim: a row counts as good
only if it passed **and** its calculated count agrees with the one the pattern wrote. A disagreeing
written count is advisory and never fails a row, so the older FAIL-only baselines called a corpus
clean while it displayed the wrong figure on every line — which is how a broken granny square shipped.
A pattern written in a non-default chain-space convention declares it with `chainSpace: 'discount'` on
its corpus entry rather than being left to disagree;
`test-corpus-garment` at 3 of 3 read the same from OCR and PDF, 234 work rows, 16 failing —
that last one is **expected** to be short of perfect and the OCR/PDF agreement is the
load-bearing half of it. A previously passing count that drops is a regression; one that rises
should be checked for a loosened assertion.

**Stub limitations worth knowing.** Places where the stub is less capable than a
browser, each of which can make an assertion pass while proving nothing:

* `document.getElementById` **invents an element for any id it is asked for**, so it never
  returns null. `no('the panel is gone', $('some-panel'))` therefore passes for an id that
  exists and fails for one that does not — the exact opposite of the intent. Absence has to
  be asserted against `readFile('index.html')` instead.

* `innerHTML` only returns markup that was *assigned*. Anything built with `appendChild` —
  notably the validation matrix `#step-sequence-body` — reads as empty. Use `.text()`, which
  flattens children.
* `form.reset()` is a no-op, so code relying on it to clear fields looks correct and is not
  actually exercised.
* Setting `select.selectedIndex` does not update `select.value`. Production code that resets
  a dropdown should assign `.value` explicitly — it behaves identically in the browser and is
  the only version the tests can verify.
* The stub does not read markup, so a `checked` attribute or a first `<option>` is invisible
  to it. Any default that behaviour depends on must be set in `init()`, not left to the HTML —
  otherwise it works in the browser and is untestable here.
* There is **no `indexedDB`, `IDBKeyRange` or `Blob`** in either context, and no microtask queue.
  Anything promise-based would resolve after the suite had printed its totals, which is why the
  persistence store takes callbacks rather than returning promises.
* **The two runners disagree about `setTimeout`, and this is the one place they can be made to
  differ silently.** The Node context has none, so `tests/test-stub.js` supplies a synchronous one;
  JavaScriptCore's shell has a real asynchronous one, so a debounced callback never fires before the
  suite ends. A suite that depends on a timer must pin it itself — the four persistence suites
  assign a synchronous `setTimeout` at the top and say why. Do not fix this in the shared stub: that
  would change how every other suite behaves under `jsc`.
* Assigning `innerHTML` does **not** create child elements. A control built that way cannot be
  found by `getElementById`, so anything wired to it silently does nothing under test while
  working in a browser. Build controls that carry state with `createElement`.

Scope Control: Make surgical edits. Do not reformat or edit unrelated code files during a task.