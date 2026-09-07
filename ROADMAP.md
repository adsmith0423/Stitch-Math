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
