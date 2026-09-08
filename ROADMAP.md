# Stitch Math — Product Roadmap

> **Vision:** A professional crochet pattern validation and yardage calculation tool designed to help pattern designers parse, validate, and calculate stitch metrics with precision.

---

## MVP Milestones

### Phase 1: Core Parsing & Validation Engine (`validator.js`)
- [x] Basic stitch cost & yield parser (`sc`, `hdc`, `dc`, `ch`, `sl st`).
- [x] Foundation stitch support (`fsc`, `fhdc`, `fdc`).
- [x] Complex stitch extraction & repeat evaluation (`across`, `[...], x times`).
- [x] Error detection (syntax errors, stitch count mismatches, unknown tokens).
- [x] Automated test harness suite integration.

### Phase 2: Gauge & Yardage Analytics (`analytics.js`)
- [x] Swatch area & density metrics calculation.
- [x] Project yardage requirements based on swatch weight/length ratio.
- [x] Custom stitch dictionary tracking & yield costing.
- [x] Swatch history log generation.

### Phase 3: UI & Frontend Integration (`app.js`)
- [x] DOM element caching & event handling overhaul.
- [x] Real-time gauge density & yardage output rendering.
- [x] Custom stitch creation form & dynamic dictionary table.
- [x] Swatch history UI syncing & local storage persistence.
- [x] Clean step-sequence row manager & cumulative stitch display.

### Phase 4: Pattern Sections & Advanced Features — *NEXT*
- [x] Multi-section pattern parser (e.g., Sleeves, Body, Collar separation).
- [x] Custom stitch definitions export/import via JSON.

### Phase 5: Exporting & Publishing
- [x] Export clean text pattern with validation reports.
- [x] Export PDF summary with metadata, stitch counts, and yardage estimates.

---

## Core Guardrails

1. **Scope Control:** Never build features outside the current active phase.
2. **Architecture Boundaries:** `validator.js` and `analytics.js` must **never** touch the DOM.

### Phase 6: Shipping — *COMPLETE*
- [x] Hash routing, so every view has an address and the back button works.
- [x] Toast and modal replacing every `alert()` and `confirm()`.
- [x] Manifest, icons and a service worker: genuinely offline once served.
- [x] About panel — version, Craft Yarn Council credit, licence, privacy.
- [x] Browser suite against a real IndexedDB (`npm run test:browser`).
- [x] `tests.js` no longer ships; version-stamped assets so returning users get a matched set.
- [x] Build step: `npm run build` — concatenate, strip comments from JS, CSS and HTML, content-hash.
      No dependencies. First visit 175.5 KB gzipped, down from 324.1 unbuilt.
- [x] Generated PDF export, so phone and tablet users can export their work. No library.
- [x] Screen-reader pass with VoiceOver on the Studio view. Run 1-5 Sep on Safari. Four findings, all
      fixed: the view change was silent, Jump to First Error moved the viewport but not the reader,
      the failing row announced its number but not the fault, and the toasts were never announced at
      all. That last one took two rounds: a live region that arrives already full has not changed, AND
      a polite update fired after a download lands while the browser is already speaking. Confirmations
      now go out before the click. aria-busy stays silent in VoiceOver and that is accepted - the
      result sentence is the load-bearing half. Export confirmation is being re-checked by ear.

### Phase 7: Teaching — *COMPLETE*
The pivot from a tool for working designers to one that also serves educators and beginners. Nothing
here changes what the engine counts: every rule added is advisory, and none of them can fail a row.

- [x] **Pattern skeletons.** Four one-click templates — Amigurumi Sphere, Top-Down Beanie, Flat Scarf,
      Granny Square — each opening with the front matter a pattern is required to state, so the
      structure is learned by having it in front of you. `tests/test-templates.js` is the real
      specification: every skeleton must validate clean AND state all four required elements, loaded
      through the same button a user presses.
- [x] **Required elements.** Hook, yarn, gauge and an abbreviations key, each satisfied by the
      metadata form *or* the pattern's own text, reusing the readers that already existed for both.
      Deliberately NOT a health check — the score measures how well a pattern is written, and one
      whose every row balances should not score 82 for not naming a hook.
- [x] **The validation badge.** One verdict for the whole document: Valid / Math sound — not finished
      / Not valid, gated on the checklist above. What a teacher reads before deciding whether the
      arithmetic needs checking by hand.
- [x] **US/UK strict mode.** A project-level terminology setting that flags terms which cannot belong
      to the declared dialect. `dc`, `tr` and `dtr` are deliberately absent from the table: they are
      valid in both systems and merely name different stitches, so flagging them would underline
      every pattern ever written. Never rewrites a stitch — the linter teaches, it does not guess.
- [x] **Shorthand standardizer.** "chain 3" → "ch 3", "make an increase" → "inc", with the dialect-
      specific names waiting to be told which system the pattern is in. Cannot reach an abbreviations
      block, where the long form is the whole point.
- [x] **Geometric outline.** The pattern stripped to `R1: 6 / R2: 12 +6 / R3: 18 +6`, so a shape going
      off track is visible without reading forty characters of prose per row.
- [x] **Annotated draft export.** `pdf.js` gained colour and rectangle fills — the first time this
      file has drawn anything but text, and the annotated draft is what bought it. Coral, gold and
      teal rules under the flagged rows, matching the screen exactly because both read
      `state.linter.byLine`, plus a numbered appendix carrying each finding's lesson. `buildExportText`
      is now defined in terms of `buildExportLines` so there is still exactly one builder.

### Phase 8: Increase strategy — *COMPLETE*
Stacked and staggered increases, for rounded pieces. The two are **arithmetically identical** — same
six increases, same 6k plain stitches, same cost and yield — so nothing in the validation can prefer
one and neither is a mistake. Only the finished object differs: stacked increases pile into six
columns and crease a circle into a hexagon; staggered ones rotate each round and come out smooth.

The prefix + core + suffix parsing this needed **already worked**. `parseInstructions` splits on
commas and expands bracket groups in place, so a staggered round's un-bracketed prefix and suffix are
summed like any other tokens — verified across every multiplier spelling, both bracket types, odd
base groups, decreases, and the `* … rep from *` notation before any code was written. What was
missing was everything above the arithmetic:

- [x] **`* N` reaches the style and diagnosis layers.** `REPEAT_SHORTHAND_RE` and
      `analyzeRepeatUnit` matched `x N` / `N times` / `rep N` but not `* N`, so a pattern in ordinary
      amigurumi notation got no beginner-phrasing offer and — the one that actually cost something —
      no "this repeat runs the wrong number of times" correction. `applyLintEdit`'s multiplier target
      needed the same, with `*` outside the `\b` rather than inside the alternation: a word boundary
      before `*` never matches, so written the obvious way the edit resolved to null and a correction
      the engine had already worked out degraded silently to advice.
- [x] **`increaseStyle(text)` → `uniform` / `offset` / `null`.** The test is what the text OUTSIDE the
      repeat group *consumes*, not whether any text is there: a joined round writes `ch 2` and
      `sl st to first dc` outside the brackets and both cost nothing, where a real staggered prefix
      costs two. A text-based rule would have flagged every round of every joined pattern.
- [x] **The mixing warning.** A correctly staggered pattern *alternates* — uniform, offset, uniform,
      offset — so a rule that fired whenever the style changed would fire on every round of correct
      work. The signal is the rhythm: staggering rotates one round at a time, so two uniform shaping
      rounds never run together. Raised on the first offset round following a run of two or more
      uniform ones, once per section, `severity: 'style'` and `edit: null`.
- [x] **Six round templates, offered as three pairs** — Flat Circle, Amigurumi Sphere and Top-Down
      Beanie, each stacked and seamless. Within a pair the front matter is shared and the notation
      matches, so the strategy is the only thing that differs and the two can be inserted and
      compared. `tests/test-increase-style.js` asserts that each seamless template really staggers
      and each stacked one really does not, so a template cannot ship contradicting its own name.

### Phase 9: Granny squares — *COMPLETE*
Clusters worked into chain spaces, and the two numbers a round can honestly report. The prefix/core
parsing needed here already worked; what did not was the counting.

- [x] **The count a granny square actually states.** A square states its count in double crochets —
      "(24)" means 24 dc, never 24 plus the twelve chains that form its corner and side spaces. The
      engine counted the chains, so a correct round read 38. Three things hid it: a round worked into
      spaces is exempt from the balance rule (correctly — leaving stitches behind *is* the technique),
      a disagreeing written count is only ever advisory, and the badge therefore said "Math sound".
      **The shipped granny template displayed the wrong number on every line and every test passed.**
- [x] **Both readings, and the setting decides.** `chainSpaceConvention` already existed for this
      question and neither of its settings reached the designer's number: `count` gave 38, `discount`
      gave 30, the answer is 24. `discount` was scoped to chains inside space-*groups* only, so it
      missed the standalone ch-1 side spaces and the standing chain. Completed rather than overridden,
      so `count` stays exactly what every pinned corner test asserts and `discount` finally means what
      its own description promises. A square now runs 12, 24, 36, 48, 60 — `12X` dc, `4X` clusters.
- [x] **`standingChainSubstitutes`.** `impliedStandingChain` anchors the chain to the START of the
      line, which is right for a turning chain and wrong for a granny round: those traverse first
      ("sl st to next ch-2 sp, ch 3, …"), so the anchored test missed every one and left the count
      exactly one short on every round of every square.
- [x] **The harmful fix withdrawn.** The linter offered to "correct" a right `(24)` to a wrong `(38)`
      — it corrupted the patterns it was meant to tidy. The stated-count rewrite is now withheld on
      any round worked into chain spaces, and replaced by a note naming both readings and the setting
      that makes them agree.
- [x] **The 4X cluster rule.** A square adds one cluster to each of four sides per round. A round that
      drops one still balances perfectly and comes out a rhombus, and nothing else looks at the shape.
      The gate is the hard part: `cornersUsed` only counts a corner when the designer writes the WORD
      "corner", so corners are detected by shape instead — a bracketed group holding a chain, worked
      *into* a space. Mesh, filet and four-dc shells are all silent.
- [x] **A five-round Granny Square template**, and templates can now declare the chain-space
      convention they are written in, applied on insert so the control visibly changes rather than the
      reader diagnosing a fourteen-stitch discrepancy.
- [x] **The assertion that was missing.** `tests/test-templates.js` now checks that every template's
      *written* counts equal its *calculated* counts. "No failing rows" never was that claim, which is
      exactly how the broken square got through.
- [x] **The corpora audited for the same class of bug.** Having hit "a row that passes while reporting
      a wrong count" twice, every clean corpus was swept for it: 108 passing rows carrying a written
      count, of which **2 disagreed — both the granny square**. So the failure mode was specific to
      chain-space work rather than widespread, which is worth knowing. `test-corpus-suite`'s "fully
      clean" now means passed AND the counts agree, and that stronger metric immediately found a
      second bug: a round joining with a bare "sl st to top" (no chain named) did not credit its
      standing chain, costing one stitch on every round of every square written that way.
- [x] **The same guarantee across all four clean corpora.** `test-corpus-suite2` folds a disagreeing
      count into its "fully clean" tally the way `-suite` does; `-pattern` and `-p2` report and pin a
      separate `miscounted` figure, since their metric counts rows rather than patterns. All four
      baselines were verified to bite by deliberately breaking one written count in each and watching
      the pin fail — a check that passes vacuously is how this class of bug survived in the first
      place. No new faults were found in the other three, which matches the audit.
