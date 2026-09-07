# Stitch Math — System Architecture

## Overview
Stitch Math uses a strict three-tier modular JavaScript structure. Responsibilities are fully decoupled: **Validator** handles validation/logic, **Analytics** handles reporting/metrics, and **App** handles DOM rendering and event orchestration.

           +---------------------------------+
           |        User Inputs / DOM        |
           +---------------------------------+
                            |
                            v
           +---------------------------------+
           |             app.js              |
           |   (UI Orchestrator & State)     |
           +---------------------------------+
             /              |                \
            /               |                 \
           v                v                  v
+-----------------------+  +------------------+  +-------------------------+
|     validator.js      |  |  persistence.js  |  |      analytics.js       |
| CrochetMathEngine     |  | StitchPersistence |  | CrochetAnalyticsEngine  |
| (Pure Math & Parsing) |  | (Files & Store)  |  | (Metrics & Yardage)     |
+-----------------------+  +------------------+  +-------------------------+

---

## Global Namespaces & Entry Points
* `validator.js`   --> Exposes `window.CrochetMathEngine`
* `analytics.js`   --> Exposes `window.CrochetAnalyticsEngine`
* `persistence.js` --> Exposes `window.StitchPersistence`
* `tests.js`       --> Exposes `window.RunMathTests`
## Module Responsibilities

### 1. `validator.js` — Core Math & Parsing Engine
* **Responsibility:** Stitch tokenization, syntax parsing, cost/yield verification, pattern line
  validation, and (section 8) reading a pattern's sizing, construction and foundation skip off its
  own text so the UI does not have to ask.
* **Key Exports:** Pattern parsing functions, stitch sequence evaluations, validation result objects.
* **Constraints:**
  * 🛑 **ZERO DOM ACCESS:** Never reference `document`, `window`, HTML elements, or UI state.
  * 🛑 **PURE FUNCTIONS:** Inputs produce deterministic output with no side effects.

### 2. `analytics.js` — Data & Yardage Analytics
* **Responsibility:** Multi-row stitch density, gauge area calculations, yarn weight/yardage estimations, custom stitch cost aggregation, swatch log generation.
* **Key Exports:** Swatch calculation functions, yardage estimates, statistical summaries.
* **Constraints:**
  * 🛑 **ZERO DOM ACCESS:** Operates strictly on raw data objects passed to it.
  * 🛑 **NO SYNTAX PARSING:** Relies on structured output from `validator.js`.

### 3. `app.js` — Frontend Orchestrator
* **Responsibility:** Caching DOM elements, event listening, global application state management, updating the UI based on engine returns, managing `localStorage`.
* **Key Exports:** Primary event listeners and UI update triggers.
* **Constraints:**
  * 🛑 **NO BUSINESS LOGIC:** Do not perform stitch calculations or yardage math directly inside UI event handlers. Delegate immediately to `validator.js` or `analytics.js`.

#### The validation pass

`evaluatePatternRows()` is the single walk over the pattern, and everything on screen reads its
return. `CrochetMathEngine.evaluateStep()` sees one row at a time and cannot total a pattern, so
the per-pattern figures are tallied here, in the same loop that validates — not by a second pass.

```js
{
  validation: { rows, steps, labelPrefix, allStepsValid, blockedByLabel },
  analytics:  { passedRowsCount, failedRowsCount, blockedRowsCount, totalStitchesAllRounds,
                stitchTotals?, complexity? }   // last two only with { withComplexity: true }
}
```

`stitchTotals` and `complexity` need the whole row set, so they cannot be accumulated a row at a
time and are opt-in: the print area and the text export never read them. The latest pass is kept
on `state.analytics.lastPass` for panels that refresh without a re-parse, such as the
finished-size panel on a gauge keystroke.

Two things on the pass exist for the linter and are described under it below: every step carries the
`lineIndex` of the raw textarea line it was built from, and every row's `evaluation` carries `fixes`
alongside the prose `resolutions`.

### 4. `persistence.js` — Project Files, Versioning & the Recovery Store
* **Responsibility:** The versioned project envelope, its validator, the forward-only migration
  dispatcher, the portable-file parser, the snapshot retention rule, and the IndexedDB/in-memory
  store behind autosave and recovery.
* **Key Exports:** `buildEnvelope`, `validate`, `migrate`, `MIGRATIONS`, `parsePortable`,
  `fromLegacySave`, `prunePlan`, `createStore`, `memoryAdapter`, `idbAdapter`, plus `ERRORS`,
  `SNAPSHOT_REASONS` and the version constants.
* **Constraints:**
  * 🛑 **ZERO DOM ACCESS:** it decides what a project file is; `app.js` decides when.
  * 🛑 **NO BARE `indexedDB`, `IDBKeyRange` OR `Blob`:** the test context has none of them, and a
    reference at load time would throw before a single suite ran. Guard with `typeof`, or take the
    factory as an argument.
  * Layer A is pure and is where every decision lives. Layer B — the adapters — is a translation
    of those decisions and holds no policy, because the IndexedDB path is executed by no test.
* **See `PERSISTENCE.md`** for the envelope, the two version axes, the forward-only rule and the
  difference between the current project, a recovery point and an exported file. `app.js` section
  **5b** holds the application half: autosave, snapshots, import/export and start-up recovery.

### 4b. `pdf.js` — The PDF Writer
* **Responsibility:** turning the exported document into a PDF. Exposes `window.StitchPdf`.
* **Why it exists:** "Print / Save PDF" was `window.print()`, which is fine on a desktop and
  unreliable everywhere else — on iOS Safari and Android Chrome the print sheet is inconsistent and
  sometimes offers no way to save at all. Phones and tablets are supported targets, so the file is
  generated rather than requested.
* **Why it is not a library:** a PDF that is text on pages is a small format — a handful of objects,
  a table of their byte offsets, and a content stream of positioned strings. A library's value is
  everything this deliberately does not do: images, embedded fonts, tables, vector art.
* **The font choice is load-bearing.** Courier is one of the fourteen fonts every reader must have
  built in, so nothing is embedded, and every glyph is exactly 0.6 em wide — which makes wrapping
  arithmetic rather than measurement, and is the one thing that would otherwise force a metrics table
  into the file. It also suits the content: stitch counts line up in columns.
* **Deliberately absent:** images, embedded fonts, colour, compression, unicode beyond Latin-1.
  Characters outside Latin-1 are transliterated where the app emits them (`×` to `x`, `✓` to `v`) and
  become `?` otherwise — visible, rather than silently deleted from a designer's own words.
* `buildExportText()` in `app.js` is the single source of the document. The text export and the PDF
  render the same string, so a section added to one cannot be missing from the other.

### 5. `tests.js` — Engine Verification Harness
* **Responsibility:** Unit tests for `validator.js` and `analytics.js`, callable in the browser
  console as `window.RunMathTests()`.
* **Not loaded by `index.html` any more.** It shipped 22KB no customer runs and put
  `RunMathTests` on their global object. `loadDevOnlyScripts()` in `app.js` adds it back on
  `localhost` and `file://` only, so the console harness survives without being in the page
  everyone downloads. A build step will make the loader unnecessary by not emitting the file.

### 6. `tests/` — Application Test Suites
* **Responsibility:** Headless suites covering the parsing, analytics and UI layers, run outside
  the browser. `tests/test-dom.js` and `tests/test-stub.js` stub the DOM so `app.js` loads
  unchanged.
* **Two runners over the same suites.** `npm test` (`tests/node/suites.test.js`) is what CI runs
  across Linux, macOS and Windows; `run-tests.sh` runs them under macOS JavaScriptCore and is
  kept as a fallback. Both exit non-zero on failure and must report identical counts.
* `tests/node/harness.js` is why the suites did not have to change: `vm.runInContext` gives each
  suite the one shared global scope JavaScriptCore gave it, so `var window = this` in the stubs
  still turns `window.CrochetMathEngine = …` into a real global. Only `print` and `readFile`
  are supplied.
* These files are **not** referenced by `index.html` and never ship to the page.
* See CONTRIBUTING.md for the invocation, the expected baseline, and the three stub
  limitations that can make an assertion pass vacuously.

---

## Pattern linter

A second reader of the validation pass, in `app.js` section 8d. It decides nothing about whether a
row is right and parses no pattern: it takes the findings each row already carries, draws them under
the text in the editor, and offers to apply them.

**The editor is still a plain `<textarea>`.** The cues are drawn on a *copy* of the text
(`#lint-mirror`) lying behind it, so the caret, selection, undo history and IME all remain the
browser's, `syncBulkInput()` keeps working, and every existing reader of `bulk-input.value` is
untouched. The copy only lines up because it and the textarea share one CSS rule for every metric
that can move a line break — see section 5d of `style.css`. Splitting that rule in two is how the
two drift apart and the underlines land a line off.

**Three additions carry it**, all of them additive:

* `CrochetMathEngine.buildFixes(ctx)` sits beside `buildResolutions` and is handed the **same**
  `diagnosisContext`, so the linter cannot offer a correction the matrix does not also explain. It
  returns `{ id, severity, title, detail, edit }`, where `edit` names *what* to change — the `x N`,
  the count in brackets, a missing closer — never a string to search for. `instructionString` has had
  its row label and written count parsed off by the time the engine sees it, so a find/replace built
  against it would be aimed at text the caller does not have. `applyLintEdit()` in `app.js` resolves
  the target against the line as the designer wrote it, which is also why an accepted fix keeps
  `Row 4:` where the inline editor drops it.
* `splitPatternLines()` returns `{ text, lineIndex }`, and `buildPatternSteps()` stamps `lineIndex`
  on every step. Blanks are dropped and wrapped fragments are glued together, so position in the step
  list says nothing about position in the box. A range row — one line that becomes five steps — gives
  all five the same index, and the linter reports one finding for the line rather than five.
* `notationFaults()` carries `char`, `occurrence` and `expected`, which is what lets a bracket repair
  be offered as an edit rather than only as a sentence.

**`edit: null` is deliberate.** An unknown term is reported and underlined but has no Apply button:
guessing which stitch a designer meant and rewriting it silently is a worse failure than the
underline it would replace. For the same reason, a row whose brackets do not balance is offered
*only* the punctuation repair — its totals came from a partial reading of the text, so writing one of
those numbers into the pattern would replace a note saying "check this" with a figure that is wrong.
`buildResolutions` already refuses to give deficit advice after an unknown token on this reasoning.

**A blocked row is still read.** In the matrix a row downstream of a failure is collapsed to "fix
the row above first", because its numbers were measured against a count that failure never produced.
The linter does not hide it, and the distinction it draws is what the row's finding actually rests
on:

* what a blocked row says about **its own text** — an unclosed bracket, a term not in the
  dictionary — is true whatever happens above it, and is offered with no caveat;
* its **arithmetic** was measured against the last count actually produced, which is not the count
  it will be worked into once the failure is fixed. It carries `blockedBy`, states which row it is
  counted from, and is left out of Accept-all — the one action where no diff is read before it is
  written. Taken one at a time, with the diff on screen, it still applies.

The failing row itself reports through the `stitch-balance` fix, which has no `edit`: "extend this
row, or shrink the one above" is a choice, so the engine's own words are handed over and no button
is offered. Without it the linter marked every row *after* a fault and said nothing about the fault.

**Applying a fix writes text, not steps.** The corrected line goes into the textarea and
`handleBulkSubmit()` re-parses it, so a fix accepted here is read exactly like one typed by hand.
Accept-all works bottom-up and takes one edit per line per round; whatever is left is offered again
on the next pass, against the corrected text.

**Ignore never touches the pattern.** Dismissals are `lineIndex:fixId` keys on `state.linter.ignored`,
cleared by New File — a suggestion waved away on the last pattern must not be invisible on this one.

`runLint(pass)` is the one entry point and is synchronous. Given the pass that drew the matrix it
reads that; called from a keystroke it makes a scratch pass with `evaluateAtSize()`, which swaps
`state.patternSteps` out and restores it in a `finally`, so linting while drafting cannot disturb the
matrix or the health panel. Typing goes through a 400 ms debounce, but nothing about correctness
depends on the timer: the two runners treat `setTimeout` differently, so the tests drive `runLint`
through the ordinary Validate path instead.

**Margin marks are positioned from measured offsets**, never from a line number times a line height —
a wrapped row is taller than one line and every mark below it would drift. Because a measurement is
only real once the panel is on screen, `positionLintMarks()` runs again when the Studio view opens
and on resize; a pattern validated from another tab paints its marks against a hidden box, where
every offset reads 0 and they stack at the top of the gutter.

---

## Sections

A pattern may be split into pieces — Body, Sleeve, Collar — worked separately and assembled.
`CrochetMathEngine.parseSectionHeader()` recognises a title line; `buildPatternSteps()` keeps it in
the step list as `{ isSection: true, sectionTitle }`, and `evaluatePatternRows()` treats a boundary
as the start of a new piece:

* the running stitch count resets to 0 — a sleeve works into its own foundation, not the body's
  last row;
* the failure cascade clears, so a broken Body does not blank the Sleeve;
* row numbering restarts or continues, per the `meta-row-numbering` setting;
* the foundation-chain and skipped-chain cases become *first / second row of the section*.

`row.label` is produced once, by the evaluator, and read by the matrix, the print area and the text
export. Nothing else recomputes `index + 1` — with sections that number is simply wrong.

A title line must contain **no recognisable stitch**, which is what keeps `BACK: Ch 52, s c in 2nd
st...` a row rather than a heading. A bare `Join yarn` is deliberately not promoted either: an
invented section would silently reset the stitch count.

---

## Narrow-column layout

The left column renders 10% larger than the rest of the page: its grid track is widened and
`--left-zoom` scales the contents to match, so it lays out the same content and simply draws it
bigger. In **CSS pixels** — the units every rule below is written in — it is as narrow as **260px**
between the 950px and 1100px breakpoints, leaving about 224px inside a panel and 198px inside a
fieldset. Change the track and `--left-zoom` together, or the column overflows or leaves a gap.

Anything that cannot shrink below its content pushes out of the panel rather than wrapping, so:

* `fieldset` needs an explicit `min-width: 0` — browsers give it an intrinsic
  `min-inline-size: min-content`, and it is the one element that will not shrink without being
  told. This is what put the gauge and skein groups outside their panel.
* Grid tracks are written `minmax(0, N)` rather than a bare `N` or `auto`, which are floors.
* Flex rows that hold more than one field carry `flex-wrap: wrap` and a flex-basis, so they break
  onto separate lines instead of squeezing each field too small to use.
* Grid and flex items default to `min-width: auto`; the columns and their panels set it to 0.

`tests/test-layout.js` section 10 asserts each of these guards, because they are invisible until
someone resizes a window.

---

## Non-stitch instructions

Some things written in a pattern row are not stitches: they consume nothing and produce nothing,
and the tokenizer must remove them before counting or it reports them as unknown terms. They are
stripped together in `parseInstructions()` ([validator.js](validator.js)):

* `stripJoiningSlipStitches()` — a slip stitch that *closes a round* ("sl st to join", "sl st to
  top"), as opposed to one worked into the fabric ("sl st in next st").
* `stripMarkerInstructions()` — stitch markers (`sm`, `pm`, "move stitch marker to 1st st").
* `cleanModifiers()` — colour changes and loop specifications (`blo`, `flo`).
* `stripNonStitchProse()` — the sentences describing what the hands do: `join`, `turn`,
  `cut thread`, `thread over and work off all loops at one time`, `fasten off`, `weave in`.
  Held as the `NON_STITCH_PROSE` table so each rule carries a name and a stated reason and can
  be tested on its own.

  **Only catalogued phrases are ignored.** Anything else still fails the row — if unrecognised
  text were assumed to be prose, a misspelling like `dubble crochet` would vanish and the count
  would be wrong with nothing shown.

  The trap to know about: `tr c in joining` is a real treble worked *into* the join, and appears
  in the corpus. `join` is therefore stripped only as a verb — bare, or leading a location — never
  as the object of "in".

Stripping happens on the way into the tokenizer only. `step.sourceLine` keeps the row exactly as
written, which is what the exports and the health checks read — so a marker can still be used as a
signal even though it never reaches the arithmetic.

---

## Sizing: two directions

* **`CalculateFinishedSize()`** runs *backwards* — measures the widest row of a written pattern
  and reports what size it came out as. Drives the **Garment Size Comparison** panel.
* **`GradeSizes()` / `ResolveEase()`** run *forwards* — a target size becomes stitch and row
  counts. Drives the **Garment Grader** panel.

They pair: the grader sets the target, the checker confirms the pattern reaches it.

`CYC_BODY_MEASUREMENTS` carries all nine measurement points from the standard (chest/bust, center
back neck-to-wrist, back length, cross back, arm length, upper arm, armhole depth, waist, hip) for
Baby, Child, Youth, Woman and Man — 30 sizes — plus head, hand and foot. Each chart names the field
its size match runs on via `measureKey`. The Man chart's `backLengthLabel` is **Back Hip Length**,
not Back Waist Length; that is a real difference in what is measured.

`CHART_CM_DISCREPANCIES` records the cells where the standard's own centimetre column disagrees
with its inch column. They are the source's errors, kept so the difference between "the PDF is
inconsistent here" and "someone mistyped a chart" stays visible.

It is **back-end only, deliberately**, and the one export on this page with no UI anywhere. Its job
is to let the cross-check in `tests/test-grader.js` assert *these and only these*, so a
transcription slip in our copy of the charts fails while a known source quirk does not — a tripwire
on our own data, not a finding about anyone's pattern. Stitch Math grades from the inch column
throughout, so none of it can reach a garment either way. It had a panel on the Construction tab briefly
and it was removed for exactly this reason; `tests/test-construction.js` §2 pins the absence so it does
not drift back.

**Every measurement has an axis.** `MEASUREMENT_AXIS` marks each point as a width (converts to
stitches) or a length (converts to rows), and only that one is produced — the other is `null`.
"45 sts of armhole depth" and "123 rows of bust" were both being reported before, which only looked
harmless while one measurement was shown at a time.

**Ease applies where ease means something.** `EASED_POINTS` limits the overall ease to the
circumferences (chest, waist, hip, upper arm), because the standard's ease chart is explicitly a
bust/chest chart. A bust ease says nothing about armhole depth; lengths default to zero ease and are
set individually. `piece: 'half'` halves widths only, for a body worked flat in two pieces.

**`ResolveEase()` never infers ease silently.** Body, finished and ease are tied by
`finished = body + ease`; two of them give the third and the derived one is labelled. One alone
resolves nothing. Three that disagree report the disagreement and overwrite neither — deciding
which of the designer's own numbers to discard is the inference the rule forbids.

---

## Construction

A sidebar tab, its own view, and `app.js` **section 8c**. It exists because six exports of
`analytics.js` were finished, documented and covered by the suites while no line of `app.js` or
`index.html` called any of them. Two panels remain here; a third moved out on 2026-08-14, once it
stopped needing a door of its own — see the next section. The sixth original export,
`CHART_CM_DISCREPANCIES`, was judged back-end only and stays that way — see Sizing above.

* **`PlanRaglanYoke` / `PlanSetInSleeve` / `PlanCircularYoke`** — the three construction planners.
  `CONSTRUCTIONS` was already wired to the generator's construction dropdown, so the *shape* of the
  seam was in use; the planner behind each shape was not. The tab's "why" line for each
  construction is read out of that same `CONSTRUCTIONS` entry rather than written out again, so the
  dropdown and the planner cannot come to disagree about what a raglan is.
* **`ImpactOfChange` / `DependentsOf`** — the measurement dependency graph walked all the way down,
  and the sections of the open pattern it lands in. `renderOverrideGrid` reads the raw
  `MEASUREMENT_DEPENDS_ON` graph one hop deep to print "from chest + upperArm", which is the
  upstream half of the same question; this is the downstream half, and it does not stop at the
  first step. Section membership comes from `sectionProfiles()`, whose `points` are whatever
  `SECTION_TYPES` gives the type the designer set — an untyped section carries nothing and is
  correctly absent rather than guessed at.

Three rules hold across the tab, and are what `tests/test-construction.js` actually asserts: every
figure and every sentence comes back from the engine (the suite compares the rendered text against
a direct call, not against a number written in the test); no count is filled in on the designer's
behalf, except row gauge, which the app already knows and therefore takes from the swatch and
labels; and the panels in `index.html` are empty hosts, so the run-time inputs never enter the
static field list `handleNewFile` clears — they are cleared by the `construction-f-` prefix instead,
alongside `clearGraderControls`.

## Checking a written garment against its construction

`CheckGarmentConstruction()` is what the three Construction planners above were unlocked for, and it
answers a class of fault nothing row-by-row can see. **Every row of a raglan yoke can consume
exactly what the row before it produced — the stitch math perfect, the health score 100 — and the
yoke still be impossible**, because a raglan gains eight stitches a round and 63 is not a multiple
of eight. The counts are locally right and globally not a garment. Same for a cap that is the
correct width at the bicep and two inches short around the edge it is seamed to: no single row of
it is wrong.

Reached from the **Grader** (`app.js` section 8, `renderConstructionCheck`), not Construction — it moved
there on 2026-08-14. The check had been given its own tab-and-picker only because nothing else in
the app named a garment's construction; the Generator's own Construction field (`#gen-construction`,
which the multi-size instructions above it already read) does that now, so a second control would
have had nothing to disagree about except itself. The host markup is `#grade-construction-pieces`
and `#grade-construction-result`, right under "Sections and stitch multiples" in `#grader-section`;
the render call sits in both `renderGrader()` and `readSectionInputs()`, so a section's type
changing (which is what the check reads pieces by) does not wait for a full grader pass to show up.

So each piece is read back as a *shape* rather than as rows, by two primitives exported alongside
the check:

* **`PieceSpan(worked)`** — what a piece starts at, ends at, how many rows it had to get there, and
  every row that moved the count. `rows` is one less than the row count: the first row establishes
  the count rather than changing it, so a yoke of 35 rows has 34 in which to grow.
* **`ShapedTail(worked)`** — the run of rows at the *end* of a piece where the count moves one way.
  This is how an armhole and a cap are found without being told where they are: a sleeve grows up
  the arm and then decreases for the cap. Straight rows **inside** the run belong to it (decreasing
  every other row is still one armhole); straight rows before it do not, or the armhole swallows the
  body below it.

`worked` carries the count the *validator resolved*, never the count the pattern states, so a row
whose written count is wrong cannot smuggle a construction fault past the check.

What each construction is then held to:

| Construction | Checks |
| --- | --- |
| Raglan | the yoke hands on exactly `frontBack + 2 × sleeve`; the total gain is a multiple of eight; **every** round adds eight — the last catches the round that adds six when a later one makes up the difference, which the totals cannot |
| Circular yoke | planned against the pattern's **own** number of increase rounds, not the planner's preferred number; fails when a round asks for more increases than it has stitches to space them into |
| Set-in sleeve | both shaped tails are found, the underarm bind-off is read as a bind-off rather than a wild decrease row, and the two seamed edges are compared — the check the whole construction turns on |
| Drop shoulder | passes, **with a stated reason**. A check that goes quiet on the easy case cannot be trusted on the hard one |

Section role comes from `GARMENT_ROLES`, which maps the designer's `SECTION_TYPES` choice onto
body / sleeve / yoke — a front and a back are each "the body", since each carries its own armhole
and together they are the circumference. The type is **asked, not guessed**: "Sleeve" in a heading
is a hint, and a hint is not enough to start telling someone their sweater is wrong. Every check
that cannot run reports `skip` with the type to set, because "we did not look" and "we looked and
it was fine" are the two answers a validation panel must never conflate.

`tests/test-grader.js` §35-35c hold the panel to the same standard as the rest of the app: every
figure and every sentence comes back from the engine, compared against a direct call rather than a
number written in the test. `tests/test-construction.js` covers `CheckGarmentConstruction` and its
two primitives at the engine level, independent of which UI reaches them.

---

## Reading settings off the pattern

`validator.js` **section 8** is the inference layer, entered once per parse from `handleBulkSubmit`
as `inferPatternSettings(rawText)`. It returns `{ sizeCount, construction, unstatedSkip, notices }`
and `app.js` stores it on `state.inferred`; every consumer reads from there rather than asking the
DOM, so the whole document is interpreted one way.

Three form controls were deleted when it landed, each of them a box restating something the text had
already said:

| Was | Now read from |
|---|---|
| **Sizing** (`meta-size-type`) | `countSizeVariants` — the array length inside `52 (56, 60)`, plus the base |
| **Construction Style** (`meta-construction`) | `inferConstruction` — `Rnd`/`Row` label counts, then a closing slip stitch for joined vs spiral |
| **Initial Turning Chains** (`skipped-chains`) | `inferUnstatedSkip` — the foundation row's tallest stitch, via `STANDING_CHAIN_HEIGHTS` |

`meta-size` stayed: *which* of the graded sizes to validate is a choice, not a fact.

**Nothing is applied silently.** Every reading returns a `notice` naming the value and the text it
came from, with `confident: false` where no signal was found and a prevalence default stood in.
`renderInferenceNotices` renders those under the health panel as "Read from your pattern", and
`buildHealthSection` repeats them in the text export, which is the copy a tester sees.

**Two controls survived an audit that expected to remove them**, both for the same reason — a
default is not a derivation, and the override carried information no pattern text contains:

* **`sizing-piece`** — a flat rectangle 100 sts wide is a scarf *or* half a sweater body. Derived
  from construction alone, a blanket silently reports double its finished width.
* **`gauge-convert-unit`** — "what did you measure in" and "what do you want it restated in" are two
  questions. Measuring in cm and quoting the gauge in inches is the whole point of the selector.

Both keep the derive-then-hold shape they always had: `syncSizingPiece` / `syncConvertUnit` set them
from the inference, and a manual choice freezes them via `sizingPieceManuallySet` /
`convertUnitManuallySet`.

### Engine settings

`CrochetMathEngine` also holds settings that are **not** derived from the pattern text:

* **Repeat convention** — `setRepeatConvention('exact' | 'inclusive')` / `getRepeatConvention()`.
  Modern patterns mean "repeat from \* 3 times" as three more repeats (`exact`); Victorian and
  early-20th-century books meant four in all (`inclusive`). Defaults to `exact`, and
  `handleNewFile` resets the engine back to it. There is no UI control for this any more - callers
  drive it directly through the engine API, which is also how the test suites exercise it.

  The size-grading cache keys off `getRepeatConvention()`, so the key cannot go stale.

  There is **no auto-detection**: guessing the convention from pattern text would silently change
  every stitch count in the document, which is the one failure mode this app exists to prevent.
  It is asked, not inferred.

* **Chain-space convention** — `setChainSpaceConvention('count' | 'discount')` /
  `getChainSpaceConvention()`, driven by the `meta-chain-space-convention` dropdown. Detectable in
  principle from a pattern's own "the ch-2 spaces are not counted" note, but most patterns never
  write one, so it stays asked for the same reason the repeat convention is.

---

## Data Flow Pipeline

1. **Input:** User enters stitch row or gauge input in `index.html`.
2. **Event Trigger:** `app.js` catches event, extracts raw input values, and passes them to `validator.js` or `analytics.js`.
3. **Calculation:** Engine processes input and returns a structured output payload:
   `{ costIsValid: boolean, calculatedYield: number, reason: string, errorDetails: Array }`
4. **Render:** `app.js` receives payload and updates the DOM UI accordingly.

---

## Shipping: routing, messages and the offline shell

Three things added on 2026-08-28 that the app shell had done without, plus the reason each is shaped
the way it is.

**Hash routing** (`app.js`, beside `NAV_TARGETS`). Every view has an address, derived from its nav id
rather than written beside it — so a view cannot gain a route without a tab, or a tab without a route.
A push assigns `location.hash` rather than calling `pushState`, because `pushState` with a relative
URL throws on `file://` and that is how the app is opened today; assigning the hash produces the same
history entry everywhere. A navigation that is a *side effect* of something else replaces rather than
pushes. At start-up a URL outranks the remembered view: a link someone was sent is a stronger signal
than where this browser happened to be last.

**`notify()` and `askConfirm()`** (`app.js` section 5c) replace every `alert()` and `confirm()`. On a
desktop those were a polish problem; in a packaged shell they are a correctness one, because some
webviews suppress them outright and a `confirm()` that silently returns false turns "Import this
project?" into an import that quietly does nothing. Both fall back to the native call when
`IS_BROWSER` is false, which is how every existing suite keeps working untouched — `tests/test-dom.js`
records through the global `alert()` and returns true from `confirm()`, and those are still the
channels under test. `askConfirm` takes an `onCancel` as well as an `onConfirm`, because declining is
not always "do nothing": a dictionary import whose conflicts you refused still has the
non-conflicting half to write.

**`sw.js` and `manifest.webmanifest`** make the offline claim true. Three strategies, and the split is
the design. A navigation is network-first, because `index.html` is the manifest naming every other file
and a stale one is how a browser ends up running yesterday's HTML against today's scripts. A
content-hashed build output is cache-first and never revalidated, because its name changes when its
bytes do. **Everything else is network-first with the cache as the offline fallback** — and that third
rule was bought the hard way. It was stale-while-revalidate for everything, which is correct only for
immutable names: against the source tree, where nothing is hashed and the `?v=` stamp never moves, it
put every editor save one reload behind. The symptom reached me as "the validator is broken again, I'm
seeing errors we fixed days ago", and it cost a debugging session before the cause was found. The rule
now is that only a build output may be answered from a cache. `CACHE_NAME` carries the version, and
`activate` drops every older cache wholesale rather than invalidating selectively; the build writes
both `VERSION` and `PRECACHE` from what it actually emitted.

**Live regions, and the one rule that is easy to get wrong.** A screen reader watches a live region for
*changes*. An element that is created, given `role="status"`, filled with text and appended has not
changed — it has appeared — and VoiceOver reads none of it. That was how the toasts were built, and a
real VoiceOver pass on 4 September found every one of them silent. The regions are permanent and empty
in the markup now (`#toast-say` polite, `#toast-alert` assertive, `#validation-announce` for results);
`notify()` writes text into whichever the tone selects, and the toast itself is `aria-hidden` because
it is the visual half. The same pass produced three other fixes worth naming, because each is a shape
that recurs: navigating changed the whole screen and said nothing (`navigateTo` now announces the view
title, said rather than focused, so a sighted keyboard user's caret is not dragged across the page);
Jump to First Error scrolled the viewport, which does not move a screen reader's cursor, so it now
focuses the row; and that row announced its number but not its fault, so its accessible name now leads
with the top-ranked likely cause. Announcements are held until `init()` finishes — drawing the empty
page at boot used to reach the live region and greet a reader with "Nothing to validate yet."

`tests/browser/persistence.spec.mjs` is the suite for the storage path the headless runners cannot
reach — the real IndexedDB adapter, the retention cursor, and the memory fallback's status line. It
blocks service workers, because a worker in the middle of it changes what a reload fetches and turns
a storage failure and a caching failure into the same red line.

## The build, and why it has no dependencies

`node build.js` writes `dist/`. The source tree stays the development entry point — `index.html`
still loads the five plain files, both test runners still read them directly — and `dist/` is only
what ships.

**A bundler exists to resolve an import graph, and there isn't one here.** Five IIFEs, loaded in
order by script tags, sharing globals. Concatenating them in that order is what the browser already
does, so "bundling" is a file read and a join. Content hashing is `node:crypto`. Neither needs a
package, which is what lets `npm test` and CI keep running with no install step.

Minification is deliberately not attempted: safely renaming identifiers or rewriting syntax needs a
parser, and hand-rolling one is how a build starts silently corrupting what it ships. What is done
is **comment stripping** — JavaScript, CSS and HTML — which takes a first visit from 324 KB gzipped
to 176 KB, roughly 70% of what full minification would save, and it is *verified* rather than
trusted:

* every string, template and regex literal must survive byte-identical and in the same order
  (`literals()` before and after). A stripper that ate into a template literal — the realistic
  failure — changes that list immediately;
* the result must parse;
* for `index.html`, the tag sequence and the visible text must both come out unchanged, and `<pre>`,
  `<textarea>`, `<script>` and `<style>` are left alone entirely — a comment opener inside a `<pre>`
  is sample pattern text a user reads, not markup;
* the build throws rather than writing damaged output. It cannot quietly ship a corrupted bundle,
  only fail loudly. `--keep-comments` is the escape hatch.

`tests/node/build.test.js` drives the scanner against the cases that break naive strippers: `//`
inside a string, comment-shaped lines inside a template literal, a regex containing `//`, a character
class holding `/*`, nested templates, and division versus regex — the hard half of JS lexing, where
getting it backwards eats everything after the slash.

**Content hashes replaced the `?v=` stamps.** The version had been written in three files with a
test to stop them drifting; a hash is derived from the bytes and cannot be forgotten. `dist/sw.js`'s
`PRECACHE` is generated from what the build actually emitted — written by hand it would name files
the build no longer produces, and the cache would sit unused while every load hit the network.

One thing the build must keep doing: it removes the `loadDevOnlyScripts()` call from the bundle.
That function fetches `tests.js` on `localhost` and `file://`, which is right for the source tree and
wrong for `dist/`, which deliberately does not contain it.

## The Construction tab

Called **UnBUILT** until 2026-08-28, and renamed because the name described what it was to build
rather than what it does for a designer. The panels are unchanged — the three construction planners
and the measurement dependency graph — and `tests/test-construction-tab.js` (formerly
`test-unbuilt.js`) still holds them to the same three rules.

The rename collided two functions: the Grader's `constructionLine()` and the tab's own. Two
declarations in one scope, the second silently winning, and the Grader's summary quietly calling the
wrong one — caught by `test-grader.js` §25. The tab's is now `planRow()`, named for what it builds.
Worth knowing before renaming anything else wholesale: checking ids and CSS classes for collisions
is not enough, function names collide too.
