# Stitch Math

A crochet pattern validator. Paste a pattern, and it checks the arithmetic row by row — what each
row consumes, what it produces, and whether the counts you wrote match the counts you'd actually
get. It grades a size range, estimates yardage from a swatch, and tells you when a garment's shaping
is impossible even though every individual row adds up.

It is also meant to teach. Every failure says which row broke, what it expected, and the most
likely reason — a misspelling ranked above the arithmetic when the row could not be read at all —
so a designer learns why a pattern was wrong rather than only that it was. The suggestions panel,
the upstream-cause ranking and the plain-language errors all exist for that reason.

**Your work never leaves your device.** No account, no server, no network requests. Patterns, gauge
history, your stitch dictionary and your testers' measurements live in your browser and nowhere else.

## Running it

**Live:** https://adsmith0423.github.io/Stitch-Math/

Open `index.html` locally. That's the whole thing — no install, no build, no dependencies.

To serve it properly (which you need for the service worker and offline support):

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## What's in here

| File | |
|---|---|
| `validator.js` | Tokenizing, parsing and per-row validation. `CrochetMathEngine`. Touches no DOM. |
| `analytics.js` | Gauge, yardage, size grading, garment construction checks. `CrochetAnalyticsEngine`. Touches no DOM. |
| `persistence.js` | The project file format, migrations, and the IndexedDB store behind autosave. |
| `pdf.js` | A PDF writer in ~200 lines, so exports work on a phone. No library. |
| `app.js` | The UI. Everything DOM lives here and nothing else does. |
| `tests.js` | The engine harness, `window.RunMathTests()`. Loaded only on `localhost` and `file://`. |
| `build.js` | Produces `dist/`. Concatenates, strips comments, content-hashes. No dependencies. |

`ARCHITECTURE.md` explains how the pieces fit and why. `CONTRIBUTING.md` has the coding standards and
the test baseline. `PERSISTENCE.md` covers the project file format and the recovery store.

## Commands

```bash
npm test              # 111 node:test cases, 4,373 assertions. No install needed.
npm run build         # writes dist/
npm run test:browser  # the storage suite, against a real browser
./run-tests.sh        # the same suites under macOS JavaScriptCore

# Once per machine, and only for test:browser:
npm install --save-dev playwright
npx playwright install chromium
```

**The app has no dependencies, and that is deliberate.** `npm test` and CI run with no install step
because the suites load the same source files the browser does. The build adds none either: there is
no module graph to resolve, so bundling is concatenation, and content hashing is `node:crypto`. The
one thing a toolchain would do better is minification, which is skipped — stripping comments from the
JavaScript, CSS and HTML at build time takes a first visit from 324 KB gzipped to 176 KB, about 70%
of what it would have saved, and the source keeps every comment.

Playwright is the single exception, for `npm run test:browser` alone, because a real IndexedDB needs
a real browser. It is not required to build or ship.

## The comments

There are a lot of them, and they are load-bearing. They explain *why* a decision was made — which
trap a rule avoids, which bug a guard was written for — because the arithmetic is the easy part and
the conventions are not. The build strips them from the shipped copy — JavaScript, CSS and HTML
alike — so they cost a reader nothing.

Please keep writing them that way.

## Licence

Proprietary. © 2026 Ashley Smith, trading as TropiCrochet. See `LICENSE`.

What you make with Stitch Math is yours — the licence covers the software and claims no interest in
your patterns.

Body measurement charts, yarn weight categories and the abbreviation list come from the
[Craft Yarn Council](https://www.craftyarncouncil.com)'s Standards & Guidelines.

Stitch Math checks arithmetic. It does not replace working a gauge swatch, and a pattern that
validates is not thereby guaranteed to fit.
