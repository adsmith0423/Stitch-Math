/**
 * Stitch Math - Application Orchestrator
 * Streamlined, strictly organized, modularized, and section-aware.
 */
(() => {
    
    // === 1. STATE & DOM ELEMENTS INITIALIZATION === //

    /**
     * A swatch nobody has measured. Three places need this exact object - initial state, New File, and
     * opening a project with no gauge of its own - and they were three separate literals, which is a
     * field added to one and missed by the other two waiting to happen.
     *
     * A fresh object every call: this is assigned into `state`, and a shared one would let New File
     * edit the constant.
     */
    function defaultGauge() {
        return {
            width: 4,
            height: 4,
            stitches: 0,
            rows: 0,
            unit: "in",
            yarnWeight: "",
            hookSize: "",
            notes: "",
            swatchWeight: 0,
            swatchWeightUnit: "g",
            stitchDensity: 0,
            rowDensity: 0,
            // The same swatch counted again after washing. Kept as counts rather than densities so
            // they are read the way they were measured.
            washedStitches: 0,
            washedRows: 0,
            // Sizing rather than gauge, but kept here because handleSaveProject clones this object
            // wholesale, so these persist with no serializer change.
            sizingCategory: "",
            sizingPiece: "round"
        };
    }

    /** The pattern's front matter. Eight places used to enumerate these fields by hand and could
     *  disagree about which existed or what it was called; `onLoad` is the value a saved project
     *  falls back to when it predates the field, blank for anything that has always been optional. */
    const META_FIELDS = [
        { id: "meta-designer",     key: "designer",     label: "Designer",     onLoad: "" },
        { id: "meta-difficulty",   key: "difficulty",   label: "Difficulty",   onLoad: "" },
        { id: "meta-hook",         key: "hook",         label: "Hook Size",    onLoad: "" },
        { id: "meta-yarn-weight",  key: "yarnWeight",   label: "Yarn Weight",  onLoad: "" },
        // Construction used to be here, backed by a dropdown. It is now read off the pattern by
        // CrochetMathEngine.inferPatternSettings and lives on state.inferred instead - a saved
        // project carries its rawText, so the inference reproduces it on load. buildMetadataFields
        // adds it back for the printout and the text export, which still want the line.
        //
        // Neither of these lived here before - both silently reverted to their default on every
        // project load, which is why setting them never seemed to "stick".
        { id: "meta-row-numbering", key: "rowNumbering", label: "Row Numbering", onLoad: "restart" },
        { id: "meta-chain-space-convention", key: "chainSpaceConvention", label: "Chain-Sp Counts As", onLoad: "count" },
        // Which terminology the pattern is written in, so a UK term in a US pattern can be flagged.
        // US or UK, never off: a project saved before the field existed (or while it still had an
        // "off" choice) carries a blank, and a blank opens as US - the dialect most patterns in the
        // store are written in - rather than as a check quietly switched off.
        { id: "meta-terminology", key: "terminology", label: "Terminology", onLoad: "us" },
        // Free text: markers, needles, buttons - whatever this pattern needs beyond yarn and hook.
        { id: "meta-notions",      key: "notions",      label: "Notions",      onLoad: "" }
    ];
    const META_FIELD_IDS = META_FIELDS.map(field => field.id);

    /**
     * How the piece is built, read off the pattern rather than asked for. Falls back to flat only so
     * that callers doing string work always get a string; `hasInferred()` is the way to ask whether
     * anything has actually been read yet, which is not the same question.
     */
    const inferredConstruction = () => state.inferred?.construction || 'Rows (Flat)';
    const hasInferred = () => state.inferred !== null;

    /** Which terminology this project declares. Read off the control rather than off state.metadata so
     *  it is current mid-edit, the way applyMetadataChange's other readers are; 'off' whenever the
     *  field is absent, which is every project saved before it existed. */
    const terminologyMode = () => UI['meta-terminology']?.value || 'us';

    /** How many foundation chains a row skips when it never says. Read off the row's own opening
     *  stitch by the engine; 0 where nothing on the row settles it. */
    const inferredSkip = () => state.inferred?.unstatedSkip || 0;

    /** Whether that skip (or the refusal to guess one) came from a bare foundation chain answered
     *  only by the row below it, rather than a line that settles the question on its own - the shape
     *  Row 1 gets warned about, since the pattern text itself never says which chain Row 2 starts in. */
    const inferredSkipNeedsDisclosure = () => !!state.inferred?.unstatedSkipTwoLine;

    /** The front matter as printed. Construction is no longer a form field but is still something a
     *  printed pattern states, so it is spliced back in at the position its box used to occupy -
     *  the export's field order is the order a reader scans. */
    function metadataForPrint() {
        // One line per field. Notions is a textarea, and a list typed one item per line reads as
        // one comma-separated line in the front matter rather than as a broken "- Notions:" entry.
        const fields = META_FIELDS.map(({ id, label, onLoad }) => ({
            label, val: String(UI[id]?.value || onLoad || '').trim().split(/\s*\n+\s*/).filter(Boolean).join(', ')
        }));
        fields.splice(4, 0, { label: 'Construction', val: hasInferred() ? inferredConstruction() : '' });
        return fields;
    }

    // A blank weight is 0 rather than NaN, but a blank width is not - the calculator distinguishes
    // "not measured" from "measured as zero". Both spellings are deliberate; keep them apart.
    const asDecimal = value => parseFloat(value || 0);
    const asWhole = value => parseInt(value || 0, 10);
    const asAmount = value => parseFloat(value) || 0;
    const asTrimmed = value => String(value || "").trim();
    const asChoice = blank => value => value || blank;

    /**
     * The swatch, as one table. Reading the form, normalising an older save and writing it back used to
     * enumerate these fields separately, so a field added to one could be missing from another.
     * `normalise` marks the fields an older save may carry as empty rather than absent - they are
     * written after syncConvertUnit(), which the first group has to precede. `blankZero` is the handful
     * whose zero shows as an empty box rather than "0".
     */
    const GAUGE_FIELDS = [
        { id: "gauge-width",           key: "width",            parse: asDecimal },
        { id: "gauge-height",          key: "height",           parse: asDecimal },
        { id: "gauge-stitches",        key: "stitches",         parse: asWhole },
        { id: "gauge-rows",            key: "rows",             parse: asWhole },
        { id: "gauge-unit",            key: "unit",             parse: asChoice("in") },
        { id: "gauge-washed-stitches", key: "washedStitches",   parse: asWhole,   normalise: true, blank: 0,       blankZero: true },
        { id: "gauge-washed-rows",     key: "washedRows",       parse: asWhole,   normalise: true, blank: 0,       blankZero: true },
        { id: "gauge-hook-size",       key: "hookSize",         parse: asTrimmed, normalise: true, blank: "" },
        { id: "gauge-notes",           key: "notes",            parse: asTrimmed, normalise: true, blank: "" },
        { id: "swatch-weight",         key: "swatchWeight",     parse: asAmount,  normalise: true, blank: 0,       blankZero: true },
        { id: "swatch-weight-unit",    key: "swatchWeightUnit", parse: asChoice("g"),     normalise: true, blank: "g" },
        { id: "sizing-category",       key: "sizingCategory",   parse: asChoice(""),      normalise: true, blank: "" },
        { id: "sizing-piece",          key: "sizingPiece",      parse: asChoice("round"), normalise: true, blank: "round" }
    ];

    const state = {
        patternSteps: [],
        metadata: {
            designer: "",
            difficulty: "",
            hook: "",
            yarnWeight: "",
            construction: "Rows (Flat)"
        },
        gauge: defaultGauge(),
        gaugeHistory: [],
        // Grading choices that are not gauge and not a single form field: what each section repeats
        // over and works at, which way counts round, and any body measurement the designer overrode.
        grading: {
            sections: {},
            overrides: {},
            modes: {},
            customChart: null,
            // Which graded size the pattern is written in, settled by resolveBaseSize on every grade:
            // { label, source } with source one of named / selected / nearest / first.
            baseSize: null
        },
        analytics: {
            report: null,
            lastPass: null,
            // The health panel's own working, kept so the dashboard reports the same score rather than
            // computing a second one that could disagree.
            health: null,
            constructionCheck: null 
        },
        difficultyManuallySet: false,
        convertUnitManuallySet: false,
        sizingPieceManuallySet: false,
        sizeIndex: 0,
        sizeCount: 1,
        // What the last parse read off the pattern itself: sizing, construction and the foundation
        // skip, each of which used to be a form control the reader had to set correctly first. Null
        // until a pattern has been parsed, which is the difference between "flat" and "nothing to
        // read yet" - several callers need to tell those apart rather than defaulting to a guess.
        // Shape is CrochetMathEngine.inferPatternSettings's return value; see validator.js section 8.
        inferred: null,
        // practiceMode is DEFAULT ON. A beginner will not go looking in Settings for a feature they
        // do not know exists; a professional finds the switch within a minute of wanting it. It
        // describes what is SHOWN, never who the person is - see SETTING_SPECS.
        // theme is 'system' | 'day' | 'night'. 'system' is the default because a first visit should
        // look like the rest of the person's screen, and it keeps following the OS until they choose.
        viewPrefs: { showTrendMarkers: true, collapseRepeats: false, outlineOnly: false, practiceMode: true, theme: 'system' },
        viewPrefsKey: "stitchmath_view_prefs",
        savedProjectsKey: "stitchmath_saves",
        
        // Stitch Points, level, streak, lifetime record and the daily stitch roll. Deliberately NOT
        // cleared by New File: the designer's history across projects, not a property of one file.
        progressKey: "stitchmath_progress",
        savedStitchesKey: "stitchmath_custom_stitches",
        savedColorsKey: "stitchmath_colors",
        // Which project the recovery record belongs to. A bare string, like stitchmath_view: start-up
        // has to know what to recover before it can afford to go looking through IndexedDB for it.
        currentProjectKey: "stitchmath_current_project",
        // Written on arrival, cleared on a clean exit. Still set at the next boot means the last
        // session ended without one - which changes what the recovery offer says and nothing else.
        sessionKey: "stitchmath_session",

        /**
         * Autosave's own working. `lastBody` is the serialized body of the last write, kept as a string
         * rather than a digest - the write needs the string anyway so it is free, and a hand-rolled hash
         * has collisions, where a collision silently loses a save.
         *
         * Two redundancy guards because neither is enough alone: `dirty` stops the timer arming at all,
         * and the string compare catches the edits that changed nothing, of which there are many -
         * refreshGaugeOutputs fires on keystrokes that move no value, and a grader control fires both
         * input and change for one edit.
         */
        autosave: { dirty: false, lastBody: null, savedAt: 0, status: "on", failed: false, lastSnapshotAt: 0 },
        // What the recover panel is currently showing: an offer from the last session, if there is one
        // worth making, and the summaries of the ring. Neither is a copy of the work - the envelope in
        // `offer` is the one already read, and a snapshot's body is fetched only when it is restored.
        recovery: { offer: null, snapshots: [] },
        editingIndex: null,
        // The linter's own working. `findings` is rebuilt from every pass, so nothing here is a second
        // record of what is wrong with the pattern - only of what the user has done about it.
        // `ignored` holds "lineIndex:fixId" keys and is per-file, cleared with the rest on New File.
        linter: {
            findings: [], byLine: {}, ignored: {}, collapsed: true,
            lineEls: [], markEls: [], openLine: null
        }
    };
    
    const UI = {};

    /*
     * The headless stub is DOM-shaped but is not a browser, and the difference matters twice below.
     * window.addEventListener is the cheapest reliable thing to test for: document.getElementById
     * invents an element for any id it is asked for, so "is the toast host there?" cannot answer this.
     */
    const IS_BROWSER = typeof window.addEventListener === 'function';

    /* The build, in one place. Shown in the dashboard strip and stamped into every exported project, so
       a bug report arrives with the version that produced it instead of a guess. Bump it on release. */
    const APP_VERSION = '1.2.0';

    /**
     * The last line of defence. Without one, a throw anywhere in a render left the page half-drawn with
     * no indication anything had gone wrong - the worst possible failure for a tool whose whole claim is
     * that it checks arithmetic you cannot check by eye. It does not try to recover: it says plainly
     * that a result on screen may be wrong, names the build, and points at the recovery the app already
     * has. Autosave has run by then, so Recent recovery points is a real offer rather than a hope.
     */
    function reportFatal(what, detail) {
        const host = document.getElementById('fatal-error');
        if (!host) return;
        host.textContent = `Something went wrong ${what}. A figure on this page may be wrong or missing `
            + `- reload, and use Recent recovery points on the Patterns tab if your work is not as `
            + `you left it. `
            + `(Stitch Math ${APP_VERSION}: ${detail})`;
        host.classList.remove('hidden');
    }

    /* Guarded the way persistence.js guards indexedDB, and for the same reason: the headless stub has no
       window.addEventListener, and an unguarded call here throws at load time - before a single suite
       runs, taking all 66 of them with it rather than failing one. */
    function installErrorHandlers() {
        if (typeof window.addEventListener !== 'function') return;
        window.addEventListener('error', (event) => {
            reportFatal('while drawing this page', (event.error && event.error.message) || event.message || 'unknown');
        });
        window.addEventListener('unhandledrejection', (event) => {
            const why = event.reason;
            reportFatal('in a background task', (why && why.message) || String(why || 'unknown'));
        });
    }

    function init() {
        const elementsToCache = [
            "row-form", "initial-chain-input", "tokens-input", "multiplier-input", "expected-yield-input",
            "bulk-input", "bulk-parse-btn", "step-sequence-body", "cumulative-status", "project-name",
            "save-btn", "load-select", "load-btn", "delete-project-btn", "new-file-btn",
            "custom-stitch-form", "custom-st-name", "custom-st-def", "custom-st-cost", "custom-st-yield",
            "custom-stitch-table", "custom-stitch-body", "stitch-feedback", "custom-stitch-list",
            "color-form", "color-code", "color-name", "color-table", "color-body", "color-feedback",
            "delete-last-btn", "clear-all-btn", "export-txt-btn", "export-pdf-btn", "export-markup-btn",
            "save-status", "export-project-btn", "import-project-btn", "import-file",
            "recover-panel", "recover-select", "recover-restore-btn",
            ...META_FIELD_IDS,
            "print-pattern-title", "print-metadata", "print-stitches-used", "print-stitches-used-section",
            "print-custom-dictionary", "print-custom-dictionary-section", "print-table-body",
            "print-validation-results", "btn-calculate-gauge", "btn-calculate-yardage", "gauge-results", "gauge-results-content",
            "gauge-height", "gauge-width", "gauge-rows", "gauge-stitches",
            "gauge-washed-stitches", "gauge-washed-rows", 
            "gauge-unit", "calc-skein-weight", "calc-skein-length",
            "calc-skein-weight-unit", "calc-skein-length-unit",
            "gauge-hook-size", "gauge-notes", "gauge-convert-size", "gauge-convert-unit", "gauge-conversion-output",
            "swatch-weight", "swatch-weight-unit",
            "sizing-category", "sizing-piece", "finished-size-content",
            "complexity-content", "toggle-trend-markers", "toggle-collapse-repeats", "toggle-beginner-phrasing", "toggle-outline-view", "meta-size", "size-picker-group", "meta-row-numbering", "meta-chain-space-convention",
            "validation-badge", "matrix-section",
            "density-stitches", "density-rows", "active-swatch-content", "swatch-history-body", "quick-density-output",
            "btn-export-history",
            // Newly added for strict DOM cache compliance:
            "stat-total-stitches", "stat-sections", "stat-special", "print-running-header",
            "grade-base-name", "grade-body", "grade-finished", "grade-ease",
            "grade-ease-mode", "grade-chart", "grade-summary", "grade-sizing-statement",
            "grade-tables", "grade-size-picker", "grade-point-ease", "grade-options",
            "grade-sections", "grade-construction-pieces", "grade-construction-result",
            "grade-rounding", "grade-parity", "grade-row-parity",
            "grade-schematic", "grade-point-detail", "grade-report",
            "grade-motif-panel", "motif-size", "motif-join", "motif-border", "motif-point", "motif-output",
            "grade-output-panel", "gen-notation", "gen-construction", "gen-output", "export-package",
            "grade-sample-yards", "grade-sample-yards-unit",
            "grade-neck-panel", "grade-neck-depth", "grade-neck-unit", "grade-shoulder-drop",
            "grade-neck-share", "grade-neck-bindoff", "grade-armhole-bindoff", "grade-neck-output",
            "grade-construction-panel", "grade-con-neck", "grade-con-unit", "grade-con-rounds",
            "grade-con-cap-height", "grade-con-cap-top", "grade-construction-output",
            "grade-measurements", "grade-custom-sizes", "grade-custom-chart",
            "jump-error-btn", "stat-difficulty",
            // Pattern linter (section 8d). Hosts only - every cue, tooltip and sidebar row inside them
            // is built at run time, so none of it is a field New File has to clear.
            "lint-mirror", "lint-gutter", "lint-tip", "lint-side", "lint-side-toggle",
            "lint-side-tally", "lint-side-badge", "lint-side-body",
            // Pattern skeletons. The host only; the buttons inside are built from PATTERN_TEMPLATES.
            "template-picker", "template-list",
            // The off-screen line a validation result is announced through (section 8e).
            "validation-announce",
            // App shell (section 12): navigation, the summary dashboard and the progress readouts.
            // None of these hold pattern data.
            "app-shell", "app-main", "workspace", "left-column", "right-column",
            "dashboard-view", "intro-header", "project-panel", "metadata-panel",
            "settings-panel", "settings-list", "help-panel", "publish-panel", "color-panel",
            "stitch-usage-panel", "stitch-usage-content",
            "print-area", "pdf-preview", "pub-refresh-preview",
            "pub-export-txt", "pub-export-pdf", "pub-export-markup", "pub-export-history", "pub-export-package",
            "nav-dashboard", "nav-patterns", "nav-sizer", "nav-studio", "nav-practice",
            "nav-analytics", "nav-library", "nav-gauge",
            "nav-publish", "nav-settings", "nav-construction", "nav-toggle", "nav-scrim",
            // Construction (section 8c). Hosts only - everything inside is built at run time, so none of it
            // is in the static field list New File clears.
            "construction-panel", "construction-index", "construction-yoke-panel", "construction-con-why",
            "construction-con-raglan", "construction-con-setIn", "construction-con-circular",
            "construction-yoke-fields", "construction-yoke-gauge", "construction-yoke-result",
            "construction-impact-panel", "construction-point-picks", "construction-impact-result",
            "view-title", "view-subtitle", "btn-new-project", "btn-save-project",
            "points-total", "points-bar", "points-next", "points-note",
            "xp-title", "xp-level", "xp-bar", "xp-count", "streak-count", "streak-note",
            "roll-reel", "roll-stitch", "roll-term", "roll-tier", "roll-reward",
            "roll-note", "roll-again", "roll-worked",
            // Daily Practice (section 12). The answer box is why this is a view rather than a
            // Dashboard card: the Dashboard carries no form controls, by contract.
            "practice-panel", "practice-read", "practice-meet", "practice-swatch",
            "practice-read-state", "practice-swatch-state", "practice-swatch-note",
            "practice-available", "practice-instruction", "practice-answer", "practice-check",
            "practice-verdict", "practice-teaches", "practice-swatch-go", "toggle-practice-mode",
            // Day or night. The one setting that lives on the Settings panel itself.
            "theme-mode",
            // The surfaces the practice-mode gate hides. Named rather than reached by class or by
            // walking to parentElement, both of which break silently when the markup moves.
            "sidebar-points", "status-pill", "card-daily", "card-record",
            "streak-dots", "streak-dots-note",
            "cabinet-panel", "cabinet-count", "cabinet-grid",
            "lessons-panel", "lessons-list",
            "rec-patterns", "rec-exports", "rec-stitches", "rec-compiles", "rec-best",
            "rec-collected", "rec-collection-bar",
            "tile-patterns", "tile-compiler", "tile-sizer", "tile-studio",
            "tile-analytics",
            "tile-patterns-value", "tile-compiler-value", "tile-sizer-value",
            "tile-studio-value", "tile-analytics-value",
            "link-recent", "link-compiler", "link-analytics",
            "link-sizes", "link-gauges",
            "dash-recent", "dash-findings", "dash-graph", "dash-errors", "dash-warnings",
            "dash-passed", "dash-health", "dash-health-bar",
            "dash-analytics", "dash-sizes", "dash-schematics", "dash-gauges",
            "quest-text", "quest-reward", "quest-bar", "quest-count",
            "dash-export-txt", "dash-export-pdf", "dash-export-history",
            "dash-export-package", "dash-export-open", "dock-open-library"
        ];

        elementsToCache.forEach(id => {
            UI[id] = document.getElementById(id);
        });

        // Respect a difficulty the browser restored on reload rather than overwriting it.
        state.difficultyManuallySet = !!UI["meta-difficulty"]?.value;

        loadViewPrefs();
        // Established in code, not left to the markup's attribute: behaviour depending on a default the
        // JS never sets is invisible to every headless test.
        state.sizeCount = 1;
        applySizeTypeVisibility();
        syncMetadataToGauge();
        // The custom stitch dictionary lasts as long as the page does. A stitch defined for one pattern
        // has a cost and yield that were true of THAT pattern, and carrying it into the next silently
        // changes how that one counts. Cleared rather than simply not loaded, so nothing stale is left
        // in storage for the export and print views to read back.
        clearCustomStitchDictionary();
        loadColorCodes();
        // Built once: the table is a constant, so nothing here has to be redrawn on a later pass.
        renderTemplatePicker();
        setupEventListeners();
        updateLoadDropdown();
        renderUI();
        // Last, so the first view it opens is drawn from a page that has already rendered itself once.
        setupShell();
        wireConfirmModal();
        // After everything, and it must stay there: persistence is an offer laid over a page that has
        // already booted, never a step boot waits on. See section 5b.
        beginPersistence();
        // Last line of boot: from here on, a change to the page is something someone asked for.
        armAnnouncements();
    }
    
    // === 2. EVENT BINDINGS & LISTENERS === //
    /** Wires one handler across many controls. Ids rather than elements, because everything the static
     *  markup owns is reached through the UI cache. */
    function bind(ids, events, handler) {
        const list = Array.isArray(events) ? events : [events];
        ids.forEach(id => list.forEach(event => UI[id]?.addEventListener(event, handler)));
    }

    /**
     * Marks a handler as belonging to a control whose value is part of the project, as opposed to a
     * view preference. The rule, rather than a list: every bind whose control appears in GAUGE_FIELDS,
     * META_FIELDS or GRADER_FIELDS is wrapped in this and nothing else is.
     *
     * Note what is not wrapped - meta-size, the three matrix toggles, the conversion unit. Those change
     * what is on screen, not what the file contains, and test-newfile.js already draws exactly this
     * line for the toggles.
     */
    const edits = (handler) => (event) => { markDirty(); return handler(event); };

    function setupEventListeners() {
        UI["row-form"].addEventListener("submit", handleSingleRowSubmit);
        UI["bulk-parse-btn"].addEventListener("click", validateWithBusyState);

        // ---- Pattern linter (section 8d) ----
        // Typing lints on a debounce; the cues follow the text when it scrolls; the caret is what says
        // which line a tooltip belongs to, since the cue itself sits behind the box being typed in.
        if (UI["bulk-input"]) {
            // Typing closes the card rather than refreshing it: the findings behind it are from the
            // last debounce, so leaving it open would explain the row as it was a moment ago, over the
            // top of the row being written now.
            UI["bulk-input"].addEventListener("input", edits(() => { closeLintTip(); scheduleLint(); }));
            UI["bulk-input"].addEventListener("scroll", syncLintScroll);
            UI["bulk-input"].addEventListener("click", openLintTipAtCaret);
            // Only the keys that move the caret without changing the text - otherwise the card would
            // reopen on every keystroke.
            UI["bulk-input"].addEventListener("keyup", (event) => {
                if (CARET_KEYS.indexOf(event && event.key) >= 0) openLintTipAtCaret();
            });
        }
        if (UI["lint-side-toggle"]) UI["lint-side-toggle"].addEventListener("click", toggleLintSidebar);
        // A narrower box re-wraps the rows, which moves every line under the first one that changed.
        if (typeof window.addEventListener === "function") {
            window.addEventListener("resize", positionLintMarks);
        }
        
        UI["delete-last-btn"].addEventListener("click", () => {
            if (!state.patternSteps.length) return;
            state.patternSteps.pop();
            syncBulkInput();
            renderUI();
        });

        UI["clear-all-btn"].addEventListener("click", () => {
            // The dictionary counts as something to clear in its own right: a pattern can be empty and
            // still have terms defined against it, and without this the button would do nothing.
            const definedTerms = Object.keys(getLocalStorage(state.savedStitchesKey)).length;
            if (!state.patternSteps.length && !definedTerms) return;
            askConfirm("Clear all pattern rows and the custom stitch dictionary?", () => {
                // After the answer and before anything is emptied. See snapshotBeforeDestruction.
                snapshotBeforeDestruction('pre-destructive-operation');
                state.patternSteps = [];
                clearCustomStitchDictionary();
                syncBulkInput();
                renderUI();
            }, { confirmLabel: 'Clear all' });
        });

        UI["save-btn"].addEventListener("click", handleSaveProject);
        // Bound to the document rather than the Patterns view, so the shortcut works from whichever view
        // is open - the save reads the fields straight out of the page, and every one exists whether or
        // not its view is visible.
        document.addEventListener("keydown", handleSaveShortcut);
        UI["load-btn"].addEventListener("click", handleLoadProject);
        UI["delete-project-btn"].addEventListener("click", handleDeleteProject);
        UI["new-file-btn"].addEventListener("click", handleNewFile);
        UI["export-project-btn"]?.addEventListener("click", handleExportProject);
        // The button is the control; the file input is hidden and only ever opened through it.
        UI["import-project-btn"]?.addEventListener("click", () => {
            importMode = 'project';
            UI["import-file"]?.click();
        });
        UI["import-file"]?.addEventListener("change", handleImportFile);
        // Typing a different name IS opening a different project as far as the ring is concerned:
        // projectIdFor reads this field. On change rather than input - one redraw per name, not one
        // per keystroke, and each redraw is a store read.
        UI["project-name"]?.addEventListener("change", refreshRecoverPanel);
        UI["export-txt-btn"].addEventListener("click", handleExportText);
        UI["export-pdf-btn"].addEventListener("click", handleExportPdf);
        UI["export-markup-btn"]?.addEventListener("click", handleExportMarkup);

        UI["custom-stitch-form"].addEventListener("submit", handleCustomStitchSubmit);
        UI["color-form"]?.addEventListener("submit", handleColorSubmit);
        UI["btn-calculate-gauge"]?.addEventListener("click", handleGaugeCalculation);
        UI["btn-calculate-yardage"]?.addEventListener("click", handleYardageCalculation);
        UI["btn-export-history"]?.addEventListener("click", exportGaugeHistory);

        // The swatch conversion has to work before "Calculate Gauge & Yardage" is pressed (that path
        // also demands skein data), so keep the gauge fields live.
        bind(["gauge-width", "gauge-height", "gauge-stitches", "gauge-rows",
              "gauge-washed-stitches", "gauge-washed-rows",
              "gauge-hook-size", "gauge-notes", "swatch-weight"], "input", edits(refreshGaugeOutputs));
        // gauge-convert-size rides along in the wrapper rather than being split out into a bind of its
        // own: it is not project data, but a spurious dirty mark costs one string compare at flush time.
        bind(["gauge-unit", "gauge-convert-size", "swatch-weight-unit"], "change", edits(refreshGaugeOutputs));

        UI["meta-row-numbering"]?.addEventListener("change", edits(renderUI));
        UI["meta-chain-space-convention"]?.addEventListener("change", edits(() => {
            window.CrochetMathEngine.setChainSpaceConvention(UI["meta-chain-space-convention"].value);
            renderUI();
        }));

        // The grader re-reads everything on any of its own inputs.
        bind(["grade-base-name", "grade-body", "grade-finished", "grade-ease",
              "grade-ease-mode", "grade-chart", "grade-custom-sizes"], ["input", "change"], edits(renderGrader));

        // Rounding belongs to the section panel, the only thing that fits counts to a repeat. The graded
        // table grades the whole garment and does not round.
        // Rounding reaches the graded table now, not only the section panel - a repeat is fitted per
        // point, and rows can round to even - so the whole grader redraws.
        bind(["grade-rounding", "grade-parity", "grade-row-parity"], "change", edits(renderGrader));

        // The motif and generation panels grade against the same garment as the tables, so any of their
        // inputs re-runs the grader rather than a private redraw.
        bind(["motif-size", "motif-join", "motif-border", "motif-point",
              "gen-notation", "gen-construction", "grade-sample-yards", "grade-sample-yards-unit",
              "grade-neck-depth", "grade-neck-unit", "grade-shoulder-drop", "grade-neck-share",
              "grade-neck-bindoff", "grade-armhole-bindoff",
              "grade-con-neck", "grade-con-unit", "grade-con-rounds", "grade-con-cap-height", "grade-con-cap-top"],
             ["input", "change"], renderGrader);

        // Each is a named function rather than an inline one because the Settings view mirrors the same
        // controls and runs the SAME function - a mirror that reimplemented the effect would be a second
        // copy free to drift. See SETTING_SPECS in section 12.
        UI["meta-size"]?.addEventListener("change", applySizeChange);
        UI["toggle-trend-markers"]?.addEventListener("change", applyTrendMarkerPref);
        UI["toggle-collapse-repeats"]?.addEventListener("change", applyCollapseRepeatPref);
        UI["toggle-outline-view"]?.addEventListener("change", applyOutlineViewPref);
        UI["toggle-beginner-phrasing"]?.addEventListener("change", applyRepeatPhrasingMode);
        UI["toggle-practice-mode"]?.addEventListener("change", applyPracticeMode);
        UI["theme-mode"]?.addEventListener("change", applyTheme);
        // 'Match system' means keep matching it: the OS flipping to dark at sunset re-applies here.
        // Only ever consulted while the preference is 'system' - applyTheme reads it back each time.
        const scheme = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)');
        if (scheme && typeof scheme.addEventListener === 'function') {
            scheme.addEventListener('change', () => { if (state.viewPrefs.theme === 'system') applyTheme(); });
        }
        UI["gauge-convert-unit"]?.addEventListener("change", applyConvertUnitOverride);
        UI["sizing-category"]?.addEventListener("change", edits(refreshGaugeOutputs));
        UI["sizing-piece"]?.addEventListener("change", edits(applySizingPieceOverride));

        META_FIELD_IDS.forEach(id => {
            UI[id]?.addEventListener("change", edits(() => applyMetadataChange(id)));
        });
    }

    // ---- Named effects, shared with the Settings mirrors ---------------------

    /** Changing size re-parses from the raw text: the size numbers were substituted away during
     *  parsing and cannot be recovered from the steps. */
    function applySizeChange() {
        state.sizeIndex = parseInt(UI["meta-size"].value || '0', 10) || 0;
        reparseIfPattern();
    }

    function applyTrendMarkerPref() {
        state.viewPrefs.showTrendMarkers = !!UI["toggle-trend-markers"].checked;
        saveViewPrefs();
        renderUI();
    }

    /** The outline is a way of LOOKING at the pattern, so it is remembered the way the other two view
     *  options are - a teacher who works in it should not have to switch it on for every file. */
    function applyOutlineViewPref() {
        state.viewPrefs.outlineOnly = !!UI["toggle-outline-view"].checked;
        saveViewPrefs();
        renderUI();
    }

    function applyCollapseRepeatPref() {
        state.viewPrefs.collapseRepeats = !!UI["toggle-collapse-repeats"].checked;
        saveViewPrefs();
        renderUI();
    }

    /**
     * Beginner-friendly (long form) and bracket shorthand are the same repeats, worded two ways - this
     * checkbox is the switch between them, run on the whole pattern at once. Not a display preference
     * like the two above: it edits the text in the box, the same as "Standardize All" already does one
     * direction, so checking and unchecking are just standardizeRepeatText and its reverse,
     * condenseRepeatText, applied to every line. Not persisted - it describes what the CURRENT text
     * looks like, not a setting to remember once the text has changed underneath it.
     */
    function applyRepeatPhrasingMode() {
        const box = UI["bulk-input"];
        if (!box) return;
        const toBeginner = !!UI["toggle-beginner-phrasing"].checked;
        const convert = toBeginner
            ? window.CrochetMathEngine.standardizeRepeatText
            : window.CrochetMathEngine.condenseRepeatText;

        const lines = String(box.value || "").split("\n");
        let changed = 0;
        lines.forEach((line, i) => {
            const next = convert(line);
            if (next && next !== line) { lines[i] = next; changed++; }
        });
        if (!changed) return;

        box.value = lines.join("\n");
        closeLintTip();
        handleBulkSubmit();
    }

    /** Choosing a unit here is a deliberate override; stop mirroring the gauge unit. */
    function applyConvertUnitOverride() {
        state.convertUnitManuallySet = true;
        refreshGaugeOutputs();
    }

    /** Once chosen by hand, construction stops steering the piece. */
    function applySizingPieceOverride() {
        state.sizingPieceManuallySet = true;
        refreshGaugeOutputs();
    }

    function applyMetadataChange(id) {
        // A user-chosen difficulty overrides the calculated one until they reselect the blank option.
        if (id === "meta-difficulty") state.difficultyManuallySet = !!UI[id].value;
        syncMetadataToGauge();
        // Terminology is the one metadata field that changes what is DRAWN OVER THE PATTERN rather
        // than what is printed beside it: the linter's findings and the turning-chain notes are both
        // read against it. refreshPatternUI does not re-run either, so this takes the full render.
        // No re-parse, though - the text has not changed and no count depends on this.
        if (id === "meta-terminology") { renderUI(); return; }
        refreshPatternUI();
    }

    /** Re-read the pattern, if there is one. Several options change how it is counted. */
    function reparseIfPattern() {
        if (UI['bulk-input']?.value.trim()) handleBulkSubmit();
    }

    /**
     * Named, because the Dashboard and Publish tab offer this export too and call it directly. They used
     * to synthesise a click on the original button, which works in a browser and does nothing under the
     * headless stub - so the forwarding could not be tested, and a broken shortcut would have looked
     * fine right up until a user pressed it.
     */
    function printPattern() {
        renderPrintArea();
        if (typeof window.print === 'function') window.print();
        // A printed pattern left the app as surely as a downloaded one, and this is the one export that
        // never touches downloadFile.
        awardProgress('export');
    }

    /** Matrix view preferences. Persisted because a display choice that resets on every reload is more
     *  annoying than not having the option at all. */
    function loadViewPrefs() {
        const saved = getLocalStorage(state.viewPrefsKey);
        if (typeof saved.showTrendMarkers === "boolean") state.viewPrefs.showTrendMarkers = saved.showTrendMarkers;
        if (typeof saved.collapseRepeats === "boolean") state.viewPrefs.collapseRepeats = saved.collapseRepeats;
        if (typeof saved.outlineOnly === "boolean") state.viewPrefs.outlineOnly = saved.outlineOnly;
        // Absent means never chosen, which is on. Written as a typeof test rather than `|| true`
        // so an explicit false is not read back as a missing value.
        if (typeof saved.practiceMode === "boolean") state.viewPrefs.practiceMode = saved.practiceMode;
        // Anything but the four known words is 'system' - a hand-edited store cannot pick a theme
        // the stylesheet does not have.
        if (THEME_MODES.indexOf(saved.theme) >= 0) state.viewPrefs.theme = saved.theme;

        if (UI["toggle-trend-markers"]) UI["toggle-trend-markers"].checked = state.viewPrefs.showTrendMarkers;
        if (UI["toggle-collapse-repeats"]) UI["toggle-collapse-repeats"].checked = state.viewPrefs.collapseRepeats;
        if (UI["toggle-outline-view"]) UI["toggle-outline-view"].checked = state.viewPrefs.outlineOnly;
        // Set here rather than left to a `checked` attribute in the markup: the headless stub does not
        // read markup, so a default that lives in index.html alone is untestable.
        if (UI["toggle-practice-mode"]) UI["toggle-practice-mode"].checked = state.viewPrefs.practiceMode;
        applyPracticeMode();
        if (UI["theme-mode"]) UI["theme-mode"].value = state.viewPrefs.theme;
        applyTheme();
    }

    const THEME_MODES = ['system', 'day', 'night', 'readable'];

    /** The browser chrome around an installed app, per resolved theme. It follows the sidebar. */
    const THEME_CHROME = { light: '#B9EBDC', dark: '#171A2C', readable: '#F5F0E2' };

    /**
     * The theme, on the document. The head script in index.html made the same decision before the
     * stylesheet loaded, from the same stored word; this is the one that runs when the word CHANGES
     * - from the Settings control, or from the OS while the preference is 'system'.
     *
     * The stylesheet is keyed on a RESOLVED theme, never on the preference itself, so 'system' is
     * resolved here and the CSS carries one block per look rather than one per way of arriving at
     * it. Three resolved values now: light, dark, readable.
     *
     * Readable is deliberately not reachable from 'system'. No OS signal means "give me the most
     * legible page you have" - prefers-contrast: more is the closest and says something narrower,
     * and inferring it from reduced-motion or a large default font size would be guessing at
     * something the reader can simply be asked. It is a choice, so it is only ever chosen.
     *
     * Everything is guarded because the headless stub has neither a documentElement nor matchMedia,
     * and neither is a reason for a preference not to save.
     */
    function applyTheme() {
        const picked = UI['theme-mode']?.value;
        const mode = THEME_MODES.indexOf(picked) >= 0 ? picked : 'system';
        state.viewPrefs.theme = mode;
        saveViewPrefs();

        const scheme = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)');
        const dark = mode === 'night' || (mode === 'system' && !!(scheme && scheme.matches));
        const resolved = mode === 'readable' ? 'readable' : (dark ? 'dark' : 'light');
        const root = document.documentElement;
        if (root && root.dataset) root.dataset.theme = resolved;
        const chrome = typeof document.querySelector === 'function' && document.querySelector('meta[name="theme-color"]');
        if (chrome) chrome.setAttribute('content', THEME_CHROME[resolved]);
    }

    function saveViewPrefs() {
        setLocalStorage(state.viewPrefsKey, state.viewPrefs);
    }

    /**
     * The progress layer, shown or not shown. One boolean, one meaning.
     *
     * What it does NOT do is stop the store recording. awardProgress, recordWork, touchStreak and the
     * collection all run exactly as they do with it on; only rendering is suppressed. Someone who
     * switches off in March and back on in June finds six months of history waiting rather than a
     * reset - and it is the simpler implementation besides, one gate at the render boundary rather
     * than a condition threaded through every award path where a missed branch silently costs
     * somebody their streak.
     *
     * Nothing leaves the device either way, so there is no privacy cost to counting quietly.
     */
    function applyPracticeMode() {
        const on = !!UI['toggle-practice-mode']?.checked;
        state.viewPrefs.practiceMode = on;
        saveViewPrefs();

        PRACTICE_SURFACES.forEach(id => setHidden(id, !on));
        // The nav entry goes with the view it opens, or the rail offers a destination whose panel is
        // hidden - which reads as a broken tab rather than as a setting doing its job.
        setHidden('nav-practice', !on);
        // Standing on Practice when it is switched off would leave an empty workspace and a rail with
        // nothing marked current. Only ever a step BACK to the Dashboard, never a redirect on the way
        // in, so this cannot fight the router.
        if (!on && currentNavId === 'nav-practice') navigateTo('nav-dashboard');
    }

    /* Every surface the switch hides, in one list. A new one added to the progress layer belongs here
       on the day it is written - retrofitting a gate around a finished feature is how two versions of
       the same app start to drift. */
    const PRACTICE_SURFACES = [
        'sidebar-points', 'status-pill', 'card-daily', 'card-record',
        'practice-panel', 'cabinet-panel', 'lessons-panel'
    ];

    /**
     * Mirrors the Pattern Info fields into state, and carries the chosen yarn weight across to the
     * gauge so a logged swatch records which yarn it was worked in.
     *
     * Runs wherever it is needed - on init, on every metadata change, before a gauge calculation, on
     * save, and on every stats refresh. It used to have a "Sync Metadata" button as well, which could
     * therefore never do anything, and was removed.
     */
    function syncMetadataToGauge() {
        META_FIELDS.forEach(({ id, key }) => { state.metadata[key] = UI[id]?.value || ""; });
        state.gauge.yarnWeight = state.metadata.yarnWeight;
    }

    function readGaugeInputs() {
        GAUGE_FIELDS.forEach(({ id, key, parse }) => { state.gauge[key] = parse(UI[id]?.value); });
    }

    /**
     * Puts a gauge the pattern stated into the gauge calculator: "9 hdc + 8 rows = about 4 in." is the
     * swatch the designer worked, and re-typing it is work the app can save.
     *
     * Only empty fields are filled. A number the user measured outranks anything printed - their hook
     * and their hands are the reason gauge is checked at all - so this can add to what is there but
     * never overwrite it. Returns whether it filled anything, so the row can say so.
     */
    function applyGaugeStatement(gauge) {
        const fields = {
            'gauge-stitches': gauge.stitches, 'gauge-rows': gauge.rows,
            'gauge-width': gauge.width, 'gauge-height': gauge.height
        };
        const filledIds = [];
        Object.entries(fields).forEach(([id, value]) => {
            if (value === undefined || !UI[id] || String(UI[id].value).trim() !== '') return;
            UI[id].value = String(value);
            filledIds.push(id);
        });
        if (!filledIds.length) return false;

        // The unit moves only when both swatch dimensions came from the pattern. The numbers just
        // written are in the pattern's unit, so leaving a different one selected would misread them -
        // but a swatch the user half-measured is theirs, and mixing two units into one swatch is worse
        // than either. A unit chosen while the dimensions were empty does get overwritten: it was a
        // preference, and the alternative is a 4-inch swatch labelled 4 cm.
        const dimensionsAreOurs = filledIds.includes('gauge-width') && filledIds.includes('gauge-height');
        if (gauge.unit && dimensionsAreOurs && UI['gauge-unit']) UI['gauge-unit'].value = gauge.unit;

        readGaugeInputs();
        calculateGaugeDensity();
        syncConvertUnit();
        return true;
    }

    // Single source of truth is the analytics engine, which loads first; this file has no
    // unit-conversion math of its own.
    const CM_PER_INCH = window.CrochetAnalyticsEngine.CM_PER_INCH;

    /** The convert-to unit tracks the measurement unit until the user picks one deliberately, then
     *  holds. Same manual-override idea as applyAutoDifficulty.
     *
     *  Kept when the other inferrable controls went: "what did you measure in" and "what do you want
     *  it restated in" are two questions, and the second is answered by nothing in the pattern text.
     *  Measuring a swatch in cm and quoting the gauge in inches is the whole point of the selector. */
    function syncConvertUnit() {
        const select = UI["gauge-convert-unit"];
        if (!select || state.convertUnitManuallySet) return;
        select.value = state.gauge.unit;
    }

    /** Rounds give a circumference; rows give the width of one flat piece, which for a garment body is
     *  half the finished measurement. Defaults from the construction the pattern was read as, then
     *  holds once the user says otherwise.
     *
     *  The override is not redundancy and was kept when the inferrable controls went: a flat rectangle
     *  100 sts wide is a scarf OR half a sweater body, and no wording in any pattern distinguishes
     *  them. Derived alone, a blanket would silently report double its finished width. */
    function syncSizingPiece() {
        const select = UI["sizing-piece"];
        if (!select || state.sizingPieceManuallySet) return;
        select.value = worksInRounds(inferredConstruction()) ? "round" : "half";
        state.gauge.sizingPiece = select.value;
    }

    function refreshGaugeOutputs() {
        readGaugeInputs();
        syncConvertUnit();
        syncSizingPiece();
        calculateGaugeDensity();
        renderGaugeConversion();
        renderFinishedSize();
        // Every graded count comes out of the gauge, so editing the swatch has to reach the grader too.
        // It used to refresh only the panel measuring a written pattern, leaving the forward direction
        // quoting counts from the previous gauge.
        renderGrader();
    }

    /** Restates the measured swatch at a different square size: a 2x2 of 8 sts / 10 rows becomes the
     *  4x4 equivalent of 16 / 20, so gauge measured small compares against a pattern quoted standard. */
    /**
     * The measured swatch restated at a different square size. Returns null when there is nothing to
     * convert. Split out from the renderer because the swatch history records it too, and the
     * conversion is worth exactly one implementation.
     */
    function computeSwatchConversion() {
        const g = state.gauge;
        if (!g.width || !g.height || !g.stitches || !g.rows) return null;

        const target = parseFloat(UI["gauge-convert-size"]?.value || 0);
        if (!target) return null;

        // Density is per measurement unit, so crossing units rescales it before the swatch size is
        // applied. Measuring in cm and converting to inches is the point of the unit selector.
        const unit = UI["gauge-convert-unit"]?.value || g.unit;
        const factor = unit === g.unit ? 1 : (unit === "in" ? CM_PER_INCH : 1 / CM_PER_INCH);

        return {
            target, unit,
            stitches: (g.stitches / g.width) * factor * target,
            rows: (g.rows / g.height) * factor * target
        };
    }

    /** "16.0 sts × 20.0 rows / 4 × 4 in" - one phrasing, used by the card, table and export. */
    function describeConversion(c) {
        if (!c) return "";
        return `${c.stitches.toFixed(1)} sts × ${c.rows.toFixed(1)} rows / ${c.target} × ${c.target} ${c.unit}`;
    }

    function renderGaugeConversion() {
        const out = UI["gauge-conversion-output"];
        if (!out) return;

        const g = state.gauge;
        if (!g.width || !g.height || !g.stitches || !g.rows) {
            out.innerHTML = "<em>Enter swatch size, stitches, and rows to convert.</em>";
            return;
        }

        const converted = computeSwatchConversion();
        if (!converted) {
            out.innerHTML = `Measured: <strong>${g.stitches}</strong> sts × <strong>${g.rows}</strong> rows over ${g.width} × ${g.height} ${g.unit}.`;
            return;
        }

        const from = `${g.width} × ${g.height} ${g.unit}`;
        out.innerHTML = `
            Scaled from ${from} to <strong>${converted.target} × ${converted.target} ${converted.unit}</strong>:<br>
            <strong>${converted.stitches.toFixed(1)}</strong> sts × <strong>${converted.rows.toFixed(1)}</strong> rows
            <small class="muted-note">(work to ${Math.round(converted.stitches)} sts × ${Math.round(converted.rows)} rows)</small>
        `;
    }

    function calculateGaugeDensity() {
        const g = state.gauge;
        if (!g.width || !g.height || !g.stitches || !g.rows) return;

        g.stitchDensity = g.stitches / g.width;
        g.rowDensity = g.rows / g.height;
        const normalized = g.unit === "cm" ? 10 : 4;
        
        const stitchNorm = (g.stitchDensity * normalized).toFixed(2);
        const rowNorm = (g.rowDensity * normalized).toFixed(2);

        if(UI["density-stitches"]) UI["density-stitches"].textContent = `${stitchNorm} stitches / ${normalized} ${g.unit}`;
        if(UI["density-rows"]) UI["density-rows"].textContent = `${rowNorm} rows / ${normalized} ${g.unit}`;
        if(UI["quick-density-output"]) UI["quick-density-output"].innerHTML = `<strong>${stitchNorm}</strong> sts · <strong>${rowNorm}</strong> rows`;
    }

    // === 2b. GARMENT SIZE COMPARISON === //
    // Element ids and function names keep the earlier "finished size" wording; only the heading and the
    // export section were renamed.

    /** Charts are in inches; a measurement is more useful quoted in both. */
    function bothUnits(inchValue) {
        return `${inchValue.toFixed(1)} in / ${(inchValue * CM_PER_INCH).toFixed(1)} cm`;
    }

    /**
     * The same, for a figure whose sign carries meaning - an ease, or the difference between a target
     * and what a whole number of stitches produces. Both halves are signed: "+4 in / 10.2 cm" reads as
     * though only the inches went up. Was scoped inside the grader summary, which left the schematic
     * writing its own.
     */
    const signedNumber = (n) => `${n > 0 ? '+' : ''}${n}`;
    function signedBoth(inches) {
        const round1 = window.CrochetAnalyticsEngine.round1;
        return `${signedNumber(round1(inches))} in / ${signedNumber(round1(inches * CM_PER_INCH))} cm`;
    }

    /** "-2 to 0 in" reads better than "0 to -2 in", so always low-to-high. */
    function easeRange(match) {
        const sign = (n) => (n < 0 ? `−${Math.abs(n)}` : `${n}`);
        return match.easeLow === match.easeHigh
            ? `${sign(match.easeLow)} in ease`
            : `${sign(match.easeLow)} to ${sign(match.easeHigh)} in ease`;
    }

    function sizeRangeText(match) {
        return match.min === match.max ? `${match.min} in` : `${match.min}–${match.max} in`;
    }

    /**
     * Reports what the pattern measures, then which CYC sizes it could be. It deliberately never picks
     * one: the same finished bust is a Large with negative ease, a Medium with classic ease and a Small
     * worn oversized, and choosing would be a guess presented as a fact.
     */
    function renderFinishedSize() {
        const target = UI["finished-size-content"];
        if (!target || !window.CrochetAnalyticsEngine) return;

        const pass = state.analytics.lastPass;
        const sizing = window.CrochetAnalyticsEngine.CalculateFinishedSize({
            rows: pass ? pass.validation.rows : [],
            gauge: state.gauge,
            category: state.gauge.sizingCategory,
            piece: state.gauge.sizingPiece
        });

        if (!sizing.available) {
            target.innerHTML = `<p class="placeholder-text">Enter a gauge and a validated pattern to see the finished size.</p>`;
            return;
        }

        const worksInRounds = !!pass && pass.validation.labelPrefix === 'Rnd';
        const rowWord = worksInRounds ? 'round' : 'row';
        // A doubled panel and a round both describe the way around; a single flat piece that was not
        // doubled is only ever a width.
        const widthLabel = (sizing.piece === 'half' || worksInRounds) ? 'Circumference' : 'Width';

        const measures = [
            `<div class="size-measure"><span>Widest ${rowWord}</span>`
            + `<span><strong>${escapeHtml(sizing.widestRow.label)}</strong> — ${sizing.widestRow.stitches} sts</span></div>`,
            `<div class="size-measure"><span>${widthLabel}</span><span><strong>${bothUnits(sizing.circumferenceInches)}</strong>`
            + (sizing.piece === 'half' ? ` <span class="size-working">(${bothUnits(sizing.widthInches)} per panel, doubled)</span>` : '')
            + `</span></div>`
        ];
        if (sizing.lengthInches !== null) {
            measures.push(`<div class="size-measure"><span>Length</span><span><strong>${bothUnits(sizing.lengthInches)}</strong>`
                + ` <span class="size-working">(${sizing.rowsCounted} ${rowWord}s)</span></span></div>`);
        }

        let html = `<div class="size-measures">${measures.join('')}</div>`;

        if (!sizing.charted) {
            target.innerHTML = html
                + `<p class="size-note">Choose who this is sized for to compare it against the Craft Yarn Council body charts.</p>`;
            return;
        }

        if (sizing.outOfRange) {
            target.innerHTML = html
                + `<p class="size-note">${sizing.circumferenceInches.toFixed(1)} in is outside the `
                + `${escapeHtml(sizing.chartLabel)} chart (${sizing.chartMin}–${sizing.chartMax} in).</p>`;
            return;
        }

        const heading = sizing.usesEase
            ? `${escapeHtml(sizing.chartLabel)}'s sizing — CYC ${escapeHtml(sizing.measureName)} chart, ${sizing.circumferenceInches.toFixed(1)} in finished`
            : `${escapeHtml(sizing.chartLabel)} — CYC ${escapeHtml(sizing.measureName)} chart, ${sizing.circumferenceInches.toFixed(1)} in finished`;

        const items = sizing.matches.map(m =>
            `<li><span class="size-name">${escapeHtml(m.sizeLabel)}</span>`
            + `<span class="size-body">${sizeRangeText(m)}</span>`
            + (sizing.usesEase
                ? `<span class="size-ease">${easeRange(m)} · <span class="size-band">${escapeHtml(m.band)}</span></span>`
                : '')
            + `</li>`
        ).join('');

        html += `<p class="size-chart-title">${heading}</p><ul class="size-matches">${items}</ul>`;

        // The standard's ease chart is explicitly a bust/chest chart, and a hat is worn with negative
        // ease, so saying nothing about ease here is the correct answer rather than a missing feature.
        if (!sizing.usesEase) {
            html += `<p class="size-note">Head and hand sizes are matched to the chart directly; the CYC ease chart covers bust and chest only.</p>`;
        }

        target.innerHTML = html;
    }


    // === 3. GAUGE & YARDAGE CALCULATOR === //
    /** Reads the swatch and computes density. Shared by both buttons, since neither can do anything
     *  without a swatch. Returns false when the swatch is incomplete. */
    function prepareGauge() {
        syncMetadataToGauge();
        readGaugeInputs();

        if (!state.gauge.width || !state.gauge.height || !state.gauge.stitches || !state.gauge.rows) {
            notify("Please complete all Gauge Profile fields.", 'warn');
            return false;
        }

        calculateGaugeDensity();
        renderGaugeConversion();
        return true;
    }

    /** Gauge on its own. Skein weight and length answer a different question - how much yarn to buy -
     *  and used to be demanded here, so a perfectly good swatch produced a nag and an empty panel. */
    function handleGaugeCalculation() {
        if (!prepareGauge()) return;

        logCurrentSwatch();

        renderGaugeResults(null);
        refreshPatternUI();
    }

    /** Gauge plus how much yarn the pattern needs. Needs a pattern and a skein to compare to. */
    function handleYardageCalculation() {
        if (!prepareGauge()) return;

        // Records the swatch too, so going straight to Yardage without pressing Gauge first still fills
        // the history. logCurrentSwatch ignores an unchanged repeat.
        logCurrentSwatch();

        // NO DOM CALLS HERE: strictly using UI cache map
        const totalPatternStitches = parseInt(UI["stat-total-stitches"]?.textContent.replace(/,/g, '') || 0, 10);
        const skein = {
            weight: parseFloat(UI["calc-skein-weight"]?.value),
            weightUnit: UI["calc-skein-weight-unit"]?.value,
            length: parseFloat(UI["calc-skein-length"]?.value),
            lengthUnit: UI["calc-skein-length-unit"]?.value
        };

        // Name what is actually missing. The old message listed everything it might be, which left the
        // user checking fields that were already filled in.
        const missing = [];
        if (!totalPatternStitches) missing.push("a validated pattern to measure");
        if (!skein.weight) missing.push("the skein weight");
        if (!skein.length) missing.push("the skein length");
        if (missing.length) {
            // The gauge half is still worth showing - the swatch was fine.
            renderGaugeResults(null);
            const list = missing.length > 1
                ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`
                : missing[0];
            notify(`Yardage needs ${list}. Your gauge has been calculated.`, 'warn');
            return;
        }

        const swatch = {
            width: state.gauge.width,
            height: state.gauge.height,
            stitches: state.gauge.stitches,
            rows: state.gauge.rows,
            unit: state.gauge.unit,
            yarnWeight: state.gauge.yarnWeight,
            weight: state.gauge.swatchWeight,
            weightUnit: state.gauge.swatchWeightUnit
        };

        const result = window.CrochetMathEngine.calculateYardage(totalPatternStitches, swatch, skein);

        if (result.error) {
            renderGaugeResults(null);
            notify(result.error, 'error');
            return;
        }

        renderGaugeResults(result);
        refreshPatternUI();
    }

    /** One renderer for both buttons, so they cannot drift into differently shaped panels. Density is
     *  always shown; the yardage block only when there is one. */
    function renderGaugeResults(yardage) {
        UI["gauge-results-content"].innerHTML = `
            <div class="result-item"><strong>Stitch Density</strong> ${state.gauge.stitchDensity.toFixed(2)} sts/${state.gauge.unit}</div>
            <div class="result-item"><strong>Row Density</strong> ${state.gauge.rowDensity.toFixed(2)} rows/${state.gauge.unit}</div>
            ${yardage ? `
            <hr>
            <div class="result-item"><strong>Total Yardage</strong> ${yardage.imperial.totalLengthYards} yd (${yardage.metric.totalLengthMeters} m)</div>
            <div class="result-item"><strong>Total Weight</strong> ${yardage.metric.totalWeightGrams} g (${yardage.imperial.totalWeightOunces} oz)</div>
            <div class="result-item"><strong>Recommended Skeins</strong> ${yardage.skeins.recommendedPurchase} <small>(Exact: ${yardage.skeins.exact})</small></div>
            ` : ''}
            ${yardage && yardage.byWeight ? `
            <hr>
            <div class="result-item"><strong>By Swatch Weight</strong> ${yardage.byWeight.totalWeightGrams} g (${yardage.byWeight.totalWeightOunces} oz)</div>
            <div class="result-item"><strong>Yardage by Weight</strong> ${yardage.byWeight.totalLengthYards} yd (${yardage.byWeight.totalLengthMeters} m)</div>
            <div class="result-item"><strong>Skeins by Weight</strong> ${yardage.byWeight.skeins.recommendedPurchase} <small>(Exact: ${yardage.byWeight.skeins.exact})</small></div>
            <div class="result-item"><small>From ${yardage.byWeight.gramsPerStitch} g per stitch measured on your swatch &mdash; generally more accurate than the length estimate above.</small></div>
            ` : ''}
        `;
        UI["gauge-results"].classList.remove("hidden");
    }

    /** The measured facts, ignoring when it was recorded. */
    function isSameSwatch(a, b) {
        if (!a || !b) return false;
        return a.width === b.width && a.height === b.height
            && a.stitches === b.stitches && a.rows === b.rows && a.unit === b.unit
            && a.hookSize === b.hookSize && a.notes === b.notes
            && a.yarnWeight === b.yarnWeight && a.swatchWeight === b.swatchWeight;
    }

    function logCurrentSwatch() {
        const entry = {
            timestamp: new Date().toLocaleString(),
            width: state.gauge.width, height: state.gauge.height,
            stitches: state.gauge.stitches, rows: state.gauge.rows,
            unit: state.gauge.unit, yarnWeight: state.gauge.yarnWeight,
            hookSize: state.gauge.hookSize,
            notes: state.gauge.notes,
            swatchWeight: state.gauge.swatchWeight,
            swatchWeightUnit: state.gauge.swatchWeightUnit,
            construction: state.metadata.construction,
            stitchDensity: state.gauge.stitchDensity,
            rowDensity: state.gauge.rowDensity,
            // Whatever the converter was showing when the swatch was logged, so a swatch measured 2x2
            // keeps its 4x4 equivalent alongside the raw numbers.
            converted: computeSwatchConversion()
        };
        // Either button records the swatch, and either can be pressed more than once. Re-recording an
        // unchanged swatch adds a row that says nothing new, so the most recent entry is compared on its
        // measurements before another is filed.
        if (isSameSwatch(state.gaugeHistory[0], entry)) {
            state.gaugeHistory[0] = entry;   // keep the newer timestamp and conversion
            renderGaugeHistory();
            return;
        }

        state.gaugeHistory.unshift(entry);
        awardProgress('swatch');
        renderGaugeHistory();
    }

    function renderGaugeHistory() {
        if (!UI["swatch-history-body"]) return;
        UI["swatch-history-body"].innerHTML = "";

        if (state.gaugeHistory.length === 0) {
            UI["active-swatch-content"].innerHTML = "<em>No swatch recorded.</em>";
            return;
        }

        const current = state.gaugeHistory[0];
        UI["active-swatch-content"].replaceChildren();
        appendSwatchSummary(UI["active-swatch-content"], current);

        state.gaugeHistory.forEach((item, index) => {
            const tr = elem("tr");

            // Remove leads the row and the date closes it, matching the custom stitch table.
            const btnTd = elem("td");
            btnTd.innerHTML = `<button type="button" title="Remove this swatch" aria-label="Remove the swatch recorded ${escapeHtml(item.timestamp)}" class="link-button" onclick="window.removeSwatch(${index})">Remove</button>`;
            tr.appendChild(btnTd);

            // textContent, not innerHTML: hook size and notes are free text.
            [
                item.yarnWeight || "-",
                item.hookSize || "-",
                item.unit,
                `${item.stitches}/${item.rows}`,
                describeConversion(item.converted) || "-",
                item.notes || "-",
                item.timestamp
            ].forEach(val => {
                tr.appendChild(elem('td', null, val));
            });

            UI["swatch-history-body"].appendChild(tr);
        });
    }

    function appendSwatchSummary(container, swatch) {
        const line = (label, value) => {
            const div = elem('div', null, `${label}${value}`);
            return div;
        };
        container.append(
            line("", `${swatch.stitches} sts / ${swatch.rows} rows`),
            line("", `${swatch.width} × ${swatch.height} ${swatch.unit}`),
            line("Yarn: ", swatch.yarnWeight || "-"),
            line("Hook: ", swatch.hookSize || "-")
        );
        if (swatch.converted) container.append(line("Converted: ", describeConversion(swatch.converted)));
        if (swatch.notes) container.append(line("Notes: ", swatch.notes));
    }

    window.removeSwatch = function(index) {
        if (index < 0 || index >= state.gaugeHistory.length) return;
        state.gaugeHistory.splice(index, 1);
        renderGaugeHistory();
    };

    /**
     * One download path for the whole app: build a blob, name it, click it. It is also where an export
     * is counted, for the same reason it is where a file is written - there is one of it. Counting at
     * the call sites instead would mean one chance per site to add an export that scores nothing.
     */
    /**
     * Hands the browser a file, and says so first.
     *
     * The ordering is the fix to a finding from the VoiceOver pass, and it is not cosmetic. A download
     * makes the browser speak for itself - Safari announces "download started" - and a polite live
     * region updated AFTER that arrives while the reader is already talking, which is exactly where a
     * polite message gets dropped. Announced before the click, the app's sentence is the one that gets
     * in, and the browser's follows it. Reported twice from a real run: first "reads everything in
     * full", then "just states download started and nothing more".
     *
     * It also means every export now confirms itself. Only the PDF did before; Save as Text, the
     * project file, the gauge history and the export package were all silent, so a reader pressing them
     * had nothing but the browser's own chatter to tell them anything had happened.
     *
     * Claiming success a moment early is the trade. a.click() on a blob URL does not meaningfully fail,
     * and a confirmation nobody hears is worth less than one that is a hundred milliseconds optimistic.
     */
    function downloadFile(name, body, type, said) {
        if (said) notify(said);
        const blob = new Blob([body], { type: type || 'text/plain' });
        const a = elem('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        awardProgress('export');
    }

    /** The project name as a filename. Was written out at each export site. */
    function projectSlug(fallback) {
        return (UI['project-name']?.value || fallback || 'pattern').toLowerCase().replace(/\s+/g, '-');
    }

    function exportGaugeHistory() {
        if (!state.gaugeHistory.length) {
            notify("No swatches recorded.", 'warn');
            return;
        }
        downloadFile("gauge-history.json",
                     JSON.stringify(state.gaugeHistory, null, 2), "application/json",
                     'Gauge history saved.');
    }

    // === 4. CUSTOM STITCH MANAGEMENT === //
    // Storage here is a within-session store rather than a saved preference: it holds the definition
    // text and needs-review flags the engine dictionary has no room for, and init clears it. There is
    // deliberately no loader.

    function handleCustomStitchSubmit(event) {
        event.preventDefault();
        UI['stitch-feedback'].innerText = '';
        
        const name = UI['custom-st-name'].value.trim().toLowerCase();
        const cost = UI['custom-st-cost'].value;
        const yieldVal = UI['custom-st-yield'].value;
        const def = UI['custom-st-def'].value.trim();
        
        const result = window.CrochetMathEngine.addCustomStitch(name, cost, yieldVal);
        if (!result.success) {
            UI['stitch-feedback'].innerText = result.message;
            return;
        }

        updateLocalStorage(state.savedStitchesKey, saved => {
            saved[name] = { cost: Number(cost), yield: Number(yieldVal), def: def };
        });

        UI['custom-stitch-form'].reset();
        renderCustomStitchUI();
        renderUI(); 
    }

    /**
     * The Remove button leading every dictionary row, wired to whichever global handler that dictionary
     * uses. `title` reads "Remove KEY" in both panels; `noun` lets the colour panel say "Remove colour
     * KEY" without the stitch panel carrying the extra word.
     */
    function dictionaryRemoveCell(key, handlerName, noun) {
        // A real listener rather than an inline onclick. The key is user text, and interpolating it into
        // a JS string inside an HTML attribute cannot be made safe by escaping alone - the parser decodes
        // an escaped quote back to a quote before the JS is read, so a stitch named with an apostrophe
        // broke out of the call. Closing over the value sidesteps the question, and gives the headless
        // stub a button it can actually click, which an innerHTML-built one never was.
        const remove = button('link-button', 'Remove', null, () => window[handlerName](key));
        remove.title = `Remove ${key}`;
        remove.setAttribute('aria-label', noun ? `Remove ${noun} ${key}` : `Remove ${key}`);
        const td = elem('td');
        td.appendChild(remove);
        return td;
    }

    /**
     * Show/hide, clear, repopulate: the part of a dictionary panel that has nothing to do with what the
     * dictionary holds. Hiding the table is not emptying it - left in place, old rows would survive a
     * New File in the DOM and come back the moment the table is shown - so the body is always cleared.
     */
    function renderDictionaryTable({ table, body, keys, buildRow }) {
        if (!table || !body) return;
        if (keys.length === 0) {
            table.style.display = 'none';
            body.innerHTML = '';
            return;
        }
        table.style.display = 'table';
        body.innerHTML = '';
        keys.forEach(key => body.appendChild(buildRow(key)));
    }

    /**
     * Replaces the dictionary wholesale - what opening a project does. The engine copy and the stored
     * copy are written together, because they hold different halves of the same entry and a project
     * that set only one of them would report terms it could not cost.
     */
    function applyStitchDictionary(dict) {
        window.CrochetMathEngine.clearCustomStitches();
        const clean = {};
        Object.entries(dict || {}).forEach(([name, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            const key = String(name).trim().toLowerCase();
            if (!key) return;
            clean[key] = { cost: entry.cost, yield: entry.yield, def: entry.def || '' };
            // An entry harvested from an abbreviation list has no cost or yield yet. It is kept in
            // storage so the designer can finish it, but the engine must not be told it is a stitch.
            if (Number.isFinite(Number(entry.cost)) && Number.isFinite(Number(entry.yield))) {
                window.CrochetMathEngine.addCustomStitch(key, entry.cost, entry.yield);
            }
        });
        setLocalStorage(state.savedStitchesKey, clean);
        renderCustomStitchUI();
    }

    /**
     * Merges an incoming dictionary into the one already here - what "load stitches only" does.
     *
     * The conflict rule is the whole point. A v-st defined as 5 stitches in one designer's dictionary
     * and 3 in another's is not something to resolve quietly: whichever copy loses, some pattern's
     * counts change and nobody is told which. So a name that already exists with DIFFERENT numbers is
     * collected and asked about once, in a list, rather than overwritten or skipped silently. A name
     * that exists with the same numbers is not a conflict at all and is left alone.
     *
     * Returns a report rather than rendering one, so the caller decides how to say it.
     */
    function mergeStitchDictionary(incoming) {
        const existing = getLocalStorage(state.savedStitchesKey);
        const added = [], conflicts = [], unchanged = [];
        const same = (a, b) => Number(a.cost) === Number(b.cost) && Number(a.yield) === Number(b.yield);

        Object.entries(incoming || {}).forEach(([name, entry]) => {
            if (!entry || typeof entry !== 'object') return;
            const key = String(name).trim().toLowerCase();
            if (!key) return;
            if (!existing[key]) added.push(key);
            else if (same(existing[key], entry)) unchanged.push(key);
            else conflicts.push(key);
        });
        return { added, conflicts, unchanged, incoming: incoming || {} };
    }

    /** Writes the names the caller decided to take. Separate from the report above so the decision and
     *  the write are not the same step - the conflict question happens in between. */
    function commitStitchMerge(incoming, names) {
        updateLocalStorage(state.savedStitchesKey, saved => {
            names.forEach(key => {
                const entry = incoming[key];
                saved[key] = { cost: entry.cost, yield: entry.yield, def: entry.def || '' };
            });
        });
        names.forEach(key => {
            const entry = incoming[key];
            if (Number.isFinite(Number(entry.cost)) && Number.isFinite(Number(entry.yield))) {
                window.CrochetMathEngine.addCustomStitch(key, entry.cost, entry.yield);
            }
        });
        renderCustomStitchUI();
        renderUI();
    }

    window.removeCustomStitch = function(token) {
        window.CrochetMathEngine.removeCustomStitch(token);
        updateLocalStorage(state.savedStitchesKey, saved => { delete saved[token]; });
        renderCustomStitchUI();
        renderUI();
    };

    function renderCustomStitchUI() {
        const dict = window.CrochetMathEngine.CUSTOM_STITCHES;
        const savedStitches = getLocalStorage(state.savedStitchesKey);
        // Entries harvested from a pattern's own abbreviation list are saved without a cost or yield, so
        // they are not in the engine dictionary and have to be pulled from storage - they are exactly
        // the rows the user needs to see and finish.
        const keys = [...new Set([...Object.keys(dict), ...Object.keys(savedStitches)])];

        if (keys.length === 0) {
            UI['custom-stitch-list'].innerHTML = '<em>No custom stitches added yet.</em>';
        } else {
            UI['custom-stitch-list'].replaceChildren();
            const heading = elem('strong', null, 'Additional Terms:');
            const list = elem('ul');
            list.style.margin = '5px 0'; list.style.paddingLeft = '20px';

            keys.forEach(key => {
                const item = elem('li');
                item.innerHTML = `<strong>${escapeHtml(key)}</strong>: <em>${escapeHtml(savedStitches[key]?.def || 'No def')}</em>`;
                list.appendChild(item);
            });
            UI['custom-stitch-list'].append(heading, elem('br'), list);
        }

        renderDictionaryTable({
            table: UI['custom-stitch-table'], body: UI['custom-stitch-body'], keys,
            buildRow: key => {
                const tr = elem('tr');
                // Remove leads the row so it lines up down the left edge and stays reachable without
                // scrolling the table sideways in the narrow column.
                tr.appendChild(dictionaryRemoveCell(key, 'removeCustomStitch'));
                // A pattern stitch is priced from the pattern's own repeat and lives in its own
                // dictionary, so its numbers come from storage rather than the stitch dictionary. Only
                // an entry with no numbers anywhere still needs a user.
                const entry = dict[key] || (savedStitches[key]?.cost != null ? savedStitches[key] : null);
                if (!entry) {
                    tr.className = 'needs-review';
                    tr.title = 'Add this stitch above with its cost and yield to have it counted.';
                }
                [key, savedStitches[key]?.def || '-',
                 entry ? entry.cost : 'needs cost', entry ? entry.yield : 'needs yield'].forEach(val => {
                    tr.appendChild(elem('td', null, val));
                });
                return tr;
            }
        });
    }

    /**
     * The colour dictionary. Same shape as the custom stitch dictionary above, because it answers the
     * same kind of question: the pattern uses a shorthand the reader is expected to hold, and the app
     * has to hold it too. "With A, ch 146" is the foundation row of every piece in a colourwork pattern.
     *
     * Single letters parse without any of this filled in; what the dictionary adds is the colour a
     * letter stands for, which is what the export legend prints.
     */
    function loadColorCodes() {
        const saved = getLocalStorage(state.savedColorsKey);
        Object.entries(saved).forEach(([code, name]) => {
            window.CrochetMathEngine.addColorCode(code, name);
        });
        renderColorUI();
    }

    function handleColorSubmit(event) {
        event.preventDefault();
        UI['color-feedback'].innerText = '';

        const code = UI['color-code'].value.trim();
        const name = UI['color-name'].value.trim();

        const result = window.CrochetMathEngine.addColorCode(code, name);
        if (!result.success) { UI['color-feedback'].innerText = result.message; return; }

        updateLocalStorage(state.savedColorsKey, saved => { saved[result.key] = name; });

        UI['color-form'].reset();
        renderColorUI();
        renderUI();
    }

    window.removeColorCode = function (code) {
        window.CrochetMathEngine.removeColorCode(code);
        updateLocalStorage(state.savedColorsKey, saved => { delete saved[code]; });
        renderColorUI();
        renderUI();
    };

    function clearColorDictionary() {
        window.CrochetMathEngine.clearColorCodes();
        setLocalStorage(state.savedColorsKey, {});
        renderColorUI();
    }

    function renderColorUI() {
        const codes = window.CrochetMathEngine.COLOR_CODES;
        const keys = Object.keys(codes).sort();

        renderDictionaryTable({
            table: UI['color-table'], body: UI['color-body'], keys,
            buildRow: key => {
                const tr = elem('tr');
                tr.appendChild(dictionaryRemoveCell(key, 'removeColorCode', 'color'));
                [key, codes[key] || '-'].forEach(val => {
                    tr.appendChild(elem('td', null, val));
                });
                return tr;
            }
        });
    }

    // === 5. PROJECT STORAGE & MANAGEMENT === //

    /**
     * localStorage is the only store this app has, and both directions can fail for reasons that have
     * nothing to do with the code: a value can be corrupt (hand edited, or a write cut short when the
     * quota ran out mid-string), and a write can be refused outright by Safari private mode.
     *
     * A read degrades to an empty store, the same shape a first visit sees. That is deliberate: this
     * runs during init(), and an exception there took the whole page with it - a blank screen, every
     * view gone, and no way back short of clearing storage by hand. One damaged key should cost what is
     * in that key, not the app.
     *
     * Anything that is not a plain object is treated as damaged too. Every caller reads these as a
     * string-keyed map, and a stored `null`, array or number would sail past a try/catch and fail later,
     * somewhere that has no idea why.
     */
    /** Whether a pattern is worked in the round. Four places derived this from the construction string
     *  by hand, which is three chances for a pattern worked in rounds to be labelled "Row". */
    function worksInRounds(construction) {
        return String(construction || "").includes("Rounds");
    }

    function labelPrefixFor(construction) {
        return worksInRounds(construction) ? "Rnd" : "Row";
    }

    /** The view key is a bare string rather than a dictionary, so it needs its own pair - but the
     *  private-mode guard is the same one getLocalStorage carries. */
    function getStoredString(key) {
        try { return localStorage.getItem(key) || ""; } catch (err) { return ""; }
    }

    function setStoredString(key, value) {
        try { localStorage.setItem(key, value); return true; } catch (err) { return false; }
    }

    function getLocalStorage(key) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch (err) {
            return {};
        }
    }

    /** Writes, and says whether the write landed. The boolean is the point: only the caller knows
     *  whether silence is acceptable. Saving a project has to say when it did not happen; harvesting an
     *  abbreviation on a keystroke has to stay quiet. */
    function setLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * The read-modify-write shape every dictionary and project-list edit shares. `mutator` changes
     * `data` in place; returning `false` skips the write, for a caller that only persists when something
     * changed (harvesting abbreviations finds nothing new most of the time).
     *
     * Returns whether the caller's change is now in storage. A skipped write counts as true - nothing
     * needed saving, so nothing was lost. Only a refusal is false.
     */
    function updateLocalStorage(key, mutator) {
        const data = getLocalStorage(key);
        if (mutator(data) === false) return true;
        return setLocalStorage(key, data);
    }
   
    /**
     * Cmd+S on a Mac, Ctrl+S everywhere else, from any view. Both are accepted on both platforms rather
     * than sniffed for, since either is the muscle memory somebody arrives with and neither means
     * anything else here.
     *
     * The default is always suppressed once the combination matches, including where the save itself
     * refuses (no name, no pattern): letting the browser's "save this page" dialog through in exactly
     * the cases where the app declined to save would be the worst of both.
     */
    function handleSaveShortcut(e) {
        if (!e || (e.key !== "s" && e.key !== "S")) return;
        if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
        if (typeof e.preventDefault === "function") e.preventDefault();
        handleSaveProject();
    }

    /**
     * Everything that is "the project", read off the page: the pattern text, its front matter, the
     * gauge, the swatch log and the grader.
     *
     * The three sync calls are why this is a function rather than an object literal at each call site.
     * readGraderInputs is the only thing that gets the grader form into state.grading - renderGrader
     * does not, despite the name - so a caller that built the record itself would persist the grader as
     * it stood at the last save. Saving, autosaving, exporting and every snapshot come through here, so
     * a recovery copy and a named save cannot end up disagreeing about what the project is.
     *
     * Nothing derived is included. patternSteps, the inference, the analytics and the linter's findings
     * are all rebuilt from rawText, and storing them would be a second answer about the pattern.
     */
    function readProjectBody() {
        syncMetadataToGauge();
        readGaugeInputs();
        readGraderInputs();
        return {
            rawText: UI["bulk-input"].value,
            metadata: Object.fromEntries(
                META_FIELDS.map(({ id, key }) => [key, UI[id]?.value])),
            gauge: structuredClone(state.gauge),
            gaugeHistory: structuredClone(state.gaugeHistory),
            grading: structuredClone(state.grading),
            // The custom stitch dictionary rides with the project. It did not before, which meant a
            // pattern written with a v-st arrived somewhere else as a pattern full of unknown terms -
            // the file carried the rows but not what they meant. Read from storage rather than from
            // the engine because storage is the fuller copy: it holds the definition text and the
            // half-finished entries harvested from an abbreviation list, which the engine has no room
            // for. mergeStitchDictionary is the other half of this.
            customStitches: getLocalStorage(state.savedStitchesKey)
        };
    }

    function handleSaveProject() {
        const name = UI["project-name"].value.trim() || UI["load-select"].value;
        if (!name) { notify("Please enter a project name.", 'warn'); return; }
        if (!UI["bulk-input"].value.trim()) { notify("There is no pattern to save.", 'warn'); return; }

        const body = readProjectBody();

        // Read before the write, because afterwards every save looks like it was always there.
        // Overwriting a file is editing a pattern, not writing one.
        const isNewFile = !Object.prototype.hasOwnProperty.call(
            getLocalStorage(state.savedProjectsKey), name);

        const stored = updateLocalStorage(state.savedProjectsKey, saves => {
            saves[name] = Object.assign({
                version: 2,
                // Additive: the loader ignores keys it does not know, so older saves still load. Recent
                // Projects reports "no date" for them rather than inventing one.
                savedAt: Date.now()
            }, body);
        });

        // A refused write is the one case where saying nothing is worse than saying the wrong thing: the
        // pattern is still on screen and still unsaved, and the designer has to know before they close
        // the tab. No points either - awardProgress would be paying for a file that is not there.
        if (!stored) {
            notify(`Could not save "${name}". This browser refused to write to its storage `
                + `- it may be full, or in private browsing. Your pattern is still on `
                + `screen: use Save as Text to keep a copy.`, 'error');
            return;
        }

        recordManualSave(name, body);
        updateLoadDropdown();
        if (isNewFile) awardProgress('project', name);
        // Named differently on purpose: "updated" is the app saying why no points moved, without a
        // second message to explain the first.
        notify(`Project "${name}" ${isNewFile ? 'saved' : 'updated'}.`);
    }

    /**
     * A named save is also the moment the recovery record should agree with the file it just wrote:
     * same body, same project id, and a snapshot marked as the deliberate act it was.
     *
     * Defined here rather than in section 5b because it is part of what saving means; everything it
     * calls lives there. Failures are reported on the status line and nowhere else - the save itself
     * has already succeeded and already said so.
     */
    function recordManualSave(name, body) {
        if (!projectStore) return;
        try {
            state.autosave.dirty = false;
            writeCurrent(persistence.buildEnvelope({ projectName: name, body }), 'manual-save');
        } catch (err) {
            reportSaveFailure();
        }
    }

    function handleLoadProject() {
        const name = UI["load-select"].value;
        if (!name) return;
        const saves = getLocalStorage(state.savedProjectsKey);
        const project = saves[name];
        if (!project) return;
        // The same rule the import path follows, applied to the browser's own saves: a record written
        // by a newer build is refused rather than read for the parts this one recognises.
        const readable = persistence.fromLegacySave(name, project);
        if (!readable.ok) { notify(readable.error.message, 'error'); return; }
        applyProjectRecord(name, project);
        // The ring is per project, and the panel is on screen the whole time now - so opening a
        // different file has to redraw it, or it goes on offering the last file's points. Not left to
        // recordLoadedProject below: that only snapshots when the interval is up.
        refreshRecoverPanel();
    }

    /**
     * Puts a saved record on the page. Opening a project, importing a file and restoring a snapshot all
     * need exactly this, and there is one correct version of it.
     *
     * Every field below is defaulted rather than guarded, and each of those defaults is a bug that was
     * found the hard way - a save without a gauge block inheriting the last project's swatch, a save
     * from before the grader existed leaving the previous designer's grading sections standing. The reasons are
     * written in place. Do not fold them into a loop.
     */
    function applyProjectRecord(name, project) {
        UI["project-name"].value = name;
        UI["bulk-input"].value = project.rawText || "";

        // Unguarded for the same reason as the gauge below: a save with no metadata block is a project
        // that recorded none, not a reason to keep the last one's. Guarded, an older file inherited the
        // previous designer's name and hook, and - worse - its construction style, which decides whether
        // every row is labelled Row or Rnd and which piece the sizing is measured over.
        const meta = project.metadata || {};
        const savedLevel = migrateDifficultyLevel(meta.difficulty);
        state.difficultyManuallySet = !!savedLevel;

        META_FIELDS.forEach(({ id, key, onLoad }) => {
            if (UI[id]) UI[id].value = meta[key] || onLoad;
        });
        // The engine's chain-space convention is module state, not something it reads off the DOM -
        // restoring the dropdown's value alone would leave the engine on whatever the last project set.
        window.CrochetMathEngine.setChainSpaceConvention(UI['meta-chain-space-convention']?.value);
        // Not the raw saved string: an older file's level has to be migrated before it is shown.
        UI["meta-difficulty"].value = savedLevel;

        // Runs for every project, including one that saved no gauge. A gauge belongs to the pattern it
        // was swatched for, so "this file has no gauge" has to present as an empty swatch, not the last
        // file's. Guarded, opening an older save inherited the previous project's stitch counts, hook
        // and piece, and saving it wrote them into that designer's file as though they had measured them.
        // Before the gauge, so that a re-parse triggered by anything below reads the pattern with the
        // dictionary its author was using. An older file with no dictionary clears rather than inherits,
        // for the same reason the metadata block does: the previous project's v-st is not this one's.
        applyStitchDictionary(project.customStitches || {});

        state.gauge = Object.assign(defaultGauge(), project.gauge || {});
        GAUGE_FIELDS.filter(field => !field.normalise).forEach(({ id, key }) => {
            if (UI[id]) UI[id].value = state.gauge[key];
        });
        syncConvertUnit();

        // Older saves carry these as empty rather than absent, which Object.assign copies straight over
        // the default. Normalised the way they always were.
        GAUGE_FIELDS.filter(field => field.normalise).forEach(({ id, key, blank, blankZero }) => {
            state.gauge[key] = state.gauge[key] || blank;
            if (UI[id]) UI[id].value = blankZero ? (state.gauge[key] || "") : state.gauge[key];
        });
        calculateGaugeDensity();
        renderGaugeConversion();

        // A saved piece is a choice the user made once; do not let the construction style overwrite it
        // on reopen. Outside the guard for the same reason as the difficulty flag above - with no saved
        // gauge there is no saved choice, and inheriting the last project's was how a body-worked-flat
        // setting followed the designer into a pattern worked in the round.
        state.sizingPieceManuallySet = !!project.gauge?.sizingPiece;

        // Outside the gauge block, and it matters: the grader is not part of the gauge, and a save
        // written before the gauge existed would otherwise leave the previous project's sections,
        // overrides and modes standing while its pattern loaded. Every field is defaulted rather than
        // assumed present - older saves predate the grader entirely, so an absent block is normal.
        state.grading = project.grading || {};
        state.grading.sections = state.grading.sections || {};
        state.grading.overrides = state.grading.overrides || {};
        state.grading.fields = state.grading.fields || {};
        state.grading.modes = state.grading.modes || {};
        state.grading.customChart = state.grading.customChart || null;

        state.gaugeHistory = structuredClone(project.gaugeHistory || []);
        renderGaugeHistory();
        // The sizing of the project being opened is read from its own text, not carried over from
        // whatever was chosen by hand for the pattern before it.
        handleBulkSubmit();
        // After the pattern is parsed, so the section panel has rows to describe.
        applyGraderInputs();
        // So the Publish preview is never a stale leftover from whatever was open before - rendered here
        // rather than left for a manual Refresh, the same way a hidden panel is rendered on arrival
        // elsewhere in the shell.
        renderPdfPreview();
        // Whatever put this record on the page, the recovery copy should now agree with it. This is
        // also where the one migration V1 ships actually runs: every save already sitting in every
        // user's browser passes through fromLegacySave the first time it is opened.
        recordLoadedProject(name, project);
    }

    /**
     * Returns the page to the state it has on a first visit: every field, every scrap of in-memory
     * state, and the saved custom stitch dictionary.
     *
     * The two matrix view toggles are the deliberate exception. They are display preferences rather
     * than project data, and loadViewPrefs persists them precisely so they survive.
     */
    function handleNewFile() {
        askConfirm("Create a new project? Unsaved work, including custom stitches, will be lost.", () => {
            // After the confirm and before anything is cleared. "Will be lost" stays true of the page, but
            // the ring holds the copy for as long as five recovery points last.
            snapshotBeforeDestruction('pre-destructive-operation');
            // A different project, so the last-written body is no longer a comparison worth making. Left
            // standing, retyping the same pattern into the new file would match it and record nothing.
            state.autosave.lastBody = null;

            state.patternSteps = [];
            state.gaugeHistory = [];
            state.gauge = defaultGauge();
            state.grading = { sections: {}, overrides: {}, modes: {}, fields: {}, customChart: null };
            state.convertUnitManuallySet = false;
            state.sizingPieceManuallySet = false;
            // Matrix view preferences are restored too: trend markers are on by default, and leaving
            // them off forever because they were once switched off is not a default.
            //
            // practiceMode is NOT among them, and deliberately carried across. The others describe how
            // to read the pattern in front of you, so a new pattern is a fair moment to reset them.
            // Practice mode is a statement about the whole app - a professional who switched the layer
            // off did not ask for it back on their next new file, and having it reappear there would
            // be the setting quietly undoing itself.
            state.viewPrefs = {
                showTrendMarkers: true, collapseRepeats: false, outlineOnly: false,
                practiceMode: state.viewPrefs.practiceMode,
                // A theme is a statement about the room, not the file.
                theme: state.viewPrefs.theme
            };
            saveViewPrefs();
            if (UI["toggle-trend-markers"]) UI["toggle-trend-markers"].checked = true;
            if (UI["toggle-collapse-repeats"]) UI["toggle-collapse-repeats"].checked = false;
            if (UI["toggle-beginner-phrasing"]) UI["toggle-beginner-phrasing"].checked = false;
            state.difficultyManuallySet = false;
            state.analytics.lastPass = null;
            state.analytics.report = null;
            state.analytics.health = null;
            state.editingIndex = null;
            // Dismissals belong to the file they were made against. Carried over, a suggestion the user
            // waved away on the last pattern would be invisible on this one.
            state.linter.ignored = {};
            state.linter.openLine = null;
            state.linter.collapsed = true;
            state.sizeIndex = 0;
            state.sizeCount = 1;

            UI["row-form"].reset();

            // Cleared by explicit value rather than form.reset() or selectedIndex. reset() restores an input
            // to its value attribute, which is not always empty, and selectedIndex leaves .value untouched
            // in anything but a real browser - so both can appear to work while leaving data on the page.
            [
                "bulk-input", "project-name", "meta-designer", "meta-hook", "meta-notions",
                "gauge-width", "gauge-height", "gauge-stitches", "gauge-rows",
                "gauge-washed-stitches", "gauge-washed-rows",
                "gauge-hook-size", "gauge-notes", "swatch-weight",
                "grade-base-name", "grade-body", "grade-finished", "grade-ease", "grade-custom-sizes",
                "grade-sample-yards", "grade-neck-depth", "grade-shoulder-drop", "grade-neck-share",
                "grade-neck-bindoff", "grade-armhole-bindoff",
                "grade-con-neck", "grade-con-rounds", "grade-con-cap-height", "grade-con-cap-top",
                "calc-skein-weight", "calc-skein-length",
                "custom-st-name", "custom-st-def", "custom-st-cost", "custom-st-yield",
                "initial-chain-input", "tokens-input", "multiplier-input", "expected-yield-input"
            ].forEach(id => { if (UI[id]) UI[id].value = ""; });

            // Each select's own first option, taken from index.html.
            const SELECT_DEFAULTS = {
                "load-select": "", "meta-difficulty": "", "meta-yarn-weight": "",
                "meta-row-numbering": "restart", "meta-chain-space-convention": "count",
                "gauge-unit": "in", "gauge-convert-unit": "in", "gauge-convert-size": "",
                "swatch-weight-unit": "g", "calc-skein-weight-unit": "g",
                "calc-skein-length-unit": "yd",
                "sizing-category": "", "sizing-piece": "round",
                "grade-ease-mode": "in", "grade-chart": "", "grade-rounding": "nearest", "grade-parity": "any",
                "grade-row-parity": "any", "grade-sample-yards-unit": "yd", "grade-neck-unit": "in",
                "grade-con-unit": "in",
                "meta-terminology": "us"
            };
            Object.entries(SELECT_DEFAULTS).forEach(([id, value]) => {
                if (!UI[id]) return;
                UI[id].value = value;
                UI[id].selectedIndex = 0;
            });

            // The repeat convention and the chain-space convention both live in the engine as well as
            // their dropdowns, and the size list is rebuilt from pattern text that no longer exists.
            window.CrochetMathEngine.setRepeatConvention("exact");
            window.CrochetMathEngine.setChainSpaceConvention("count");
            clearGraderControls();
            clearConstructionControls();
            // Nothing has been read yet, so nothing is inferred: construction, sizing and the foundation
            // skip all go back to "no pattern", not to a default that would read as a finding.
            state.inferred = null;
            syncSizeOptions("");

            clearCustomStitchDictionary();
            clearColorDictionary();

            syncConvertUnit();
            renderGaugeConversion();

            if (UI["density-stitches"]) UI["density-stitches"].textContent = "--";
            if (UI["density-rows"]) UI["density-rows"].textContent = "--";
            if (UI["quick-density-output"]) UI["quick-density-output"].textContent = "--";

            // Yardage results are only shown once calculated, so hide them again.
            if (UI["gauge-results"]) UI["gauge-results"].classList.add("hidden");
            if (UI["gauge-results-content"]) UI["gauge-results-content"].innerHTML = "";

            // state.gaugeHistory was emptied above; renderGaugeHistory owns both the history table and the
            // Current Swatch card, and runs via renderUI below.
            renderUI();
        }, { confirmLabel: 'New project' });
    }

    /** Empties the custom stitch dictionary: the engine and the saved copy. */
    function clearCustomStitchDictionary() {
        window.CrochetMathEngine.clearCustomStitches();
        setLocalStorage(state.savedStitchesKey, {});
        if (UI["stitch-feedback"]) UI["stitch-feedback"].innerText = "";
        renderCustomStitchUI();
    }

    function handleDeleteProject() {
        const name = UI['load-select'].value;
        if (!name) return;
        askConfirm(`Delete project "${name}"?`, () => {
            // updateLoadDropdown reads storage back, so a refused write leaves the name in the list and
            // the deletion simply does not appear to have happened. Say so, rather than letting it read
            // as a bug in the dropdown.
            if (!updateLocalStorage(state.savedProjectsKey, saves => { delete saves[name]; })) {
                notify(`Could not delete "${name}". This browser refused to write to its storage.`, 'error');
                return;
            }
            updateLoadDropdown();
            notify(`Project "${name}" deleted.`);
        }, { confirmLabel: 'Delete' });
    }

    function updateLoadDropdown() {
        const saves = getLocalStorage(state.savedProjectsKey);
        fillSelect(UI['load-select'],
            [['', '-- Load a Pattern --']].concat(Object.keys(saves).map(key => [key, key])));
    }

    /**
     * Motion preference, read at call time rather than cached: someone can turn it on mid-session, and
     * a value read once at boot would then be wrong for the rest of the visit. Guarded because the test
     * runners supply no matchMedia at all.
     */
    function reducedMotion() {
        if (typeof window.matchMedia !== 'function') return false;
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        return !!(query && query.matches);
    }

    /**
     * What the jumped-to row says about itself, in one sentence.
     *
     * Reported from a real VoiceOver run on 4 Sep: focus landed on the right row and announced its
     * position in the table and its number, and nothing about what was actually wrong. The number is
     * the least useful thing here - a reader who has just pressed "jump to first error" knows they are
     * on the first error and wants to know what it IS.
     *
     * So the name leads with the top-ranked cause. That ranking is the fix to the very first bug on
     * this project: for a row the engine could not read at all, "Typo or unknown stitch" outranks any
     * arithmetic measured against it, and this sentence is where that work finally reaches someone who
     * cannot see the table. Read off the rendered cells rather than the pass, because the matrix is
     * what the reader is standing in.
     */
    function describeFailingRow(tr) {
        const cell = (i) => (tr.cells && tr.cells[i] ? String(tr.cells[i].textContent || '').trim() : '');
        const pick = (selector) => {
            const found = typeof tr.querySelector === 'function' ? tr.querySelector(selector) : null;
            return found ? String(found.textContent || '').trim() : '';
        };
        const parts = [cell(0) || 'First failing row'];
        // The bullet is a visual separator. Spoken, it is the word "bullet" in the middle of a sentence.
        const reason = pick('.math-reason').replace(/\s*•\s*/g, '. ');
        const cause = pick('.math-cause .cause-name');
        if (cause) parts.push(cause);
        if (reason) parts.push(reason);
        const written = cell(3);
        const counted = cell(4);
        if (written && counted) parts.push(`Written ${written}, counted ${counted}`);
        return parts.join('. ').replace(/\.\s*\./g, '.').replace(/\.?$/, '.');
    }

    window.jumpToFirstError = function() {
        const firstErrorRow = UI["step-sequence-body"].querySelector('.row-failed');
        if (!firstErrorRow) {
            // Silence used to be the answer for everyone. A button that does nothing and says nothing
            // reads as broken rather than as "there is nothing to jump to".
            announce('No failing rows to jump to.');
            return;
        }
        // Focus, not only scroll. Scrolling moves the viewport; it does not move a screen reader's
        // cursor, so a jump button that only scrolls does nothing at all for the reader who most needs
        // it. tabindex -1 makes the row a focus target without putting it in the tab order.
        //
        // The summary goes on the row as its accessible name rather than into the live region, and that
        // is deliberate: moving focus and updating a live region in the same tick gives a reader two
        // things to say at once. Naming the row means the ONE announcement focus already causes is the
        // short one - "Row 3. Written 18, counted 0." - instead of sixty words of failure detail. A
        // reader that ignores the name on a row falls back to reading the row, which is verbose but
        // correct, and the cells are still there to arrow across either way.
        firstErrorRow.setAttribute('tabindex', '-1');
        firstErrorRow.setAttribute('aria-label', describeFailingRow(firstErrorRow));
        firstErrorRow.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
        if (typeof firstErrorRow.focus === 'function') firstErrorRow.focus({ preventScroll: true });
        firstErrorRow.style.transition = 'background-color 0.3s ease';
        const originalBg = firstErrorRow.style.backgroundColor;
        firstErrorRow.style.backgroundColor = 'var(--danger-bg)';
        setTimeout(() => { firstErrorRow.style.backgroundColor = originalBg; }, 1500);
    };

    // === 5b. AUTOSAVE, SNAPSHOTS & RECOVERY === //
    //
    // Everything here is about keeping a copy of the work, and none of it knows anything about the
    // project format: the envelope, what makes one valid, how one is migrated and which snapshots
    // survive all live in persistence.js. This section decides when, and says so on screen.
    //
    // The store is reached through callbacks rather than promises because there is no async anywhere
    // else in this app - see the note on createStore.

    const persistence = window.StitchPersistence;

    /**
     * One store per session. The adapter is normally chosen by the store itself; window.STITCH_ADAPTER
     * is the seam a suite uses to seed one before boot, and no production path sets it.
     */
    let projectStore = null;

    /**
     * Long enough to land in the gap after the linter settles. scheduleLint debounces at 400ms, and two
     * timers of equal length armed by one keystroke run back to back in a single frame - a full lint
     * pass immediately followed by a full envelope serialise. Staggering them is the whole point of the
     * number, so it is deliberately not 400.
     */
    const AUTOSAVE_DEBOUNCE_MS = 1500;
    let autosaveTimer = null;

    /** Something that is part of the project changed. Wired through edits(), never called directly by
     *  a view control - see the note there for where the line is drawn. */
    function markDirty() {
        if (!projectStore) return;
        state.autosave.dirty = true;
        renderSaveStatus('dirty');
        if (autosaveTimer !== null && typeof clearTimeout === 'function') clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => { autosaveTimer = null; flushAutosave(); }, AUTOSAVE_DEBOUNCE_MS);
    }

    /** The project as it stands on the page, in the form that travels. */
    function currentEnvelope() {
        return persistence.buildEnvelope({
            projectName: UI['project-name']?.value || '',
            body: readProjectBody()
        });
    }

    /**
     * Write the current project to the recovery store.
     *
     * It does not re-parse, does not run the linter and does not render: a save that re-parses is a
     * second opinion about what the pattern is, arriving 1500ms after the first. It reads the text as a
     * string and calls the same three sync functions the Save button calls, through readProjectBody.
     *
     * The whole body is wrapped, and the callback separately, because neither may throw. Under the test
     * stubs setTimeout fires instantly, so this runs inside every keystroke a suite sends; an exception
     * in an async callback is counted as a suite failure by both runners, and in a browser it would
     * take down a save the user was told was happening.
     */
    function flushAutosave() {
        if (autosaveTimer !== null && typeof clearTimeout === 'function') clearTimeout(autosaveTimer);
        autosaveTimer = null;
        if (!projectStore || !state.autosave.dirty) return;
        state.autosave.dirty = false;

        try {
            const env = currentEnvelope();

            // An empty page is not a project worth recording, and a recovery record replaced by an
            // empty one is worse than no record: the copy just overwritten is precisely the one the
            // designer wants back after clearing the box by accident.
            if (!env.body.rawText.trim()) { restStatus(); return; }

            if (JSON.stringify(env.body) === state.autosave.lastBody) { restStatus(); return; }
            writeCurrent(env);
        } catch (err) {
            reportSaveFailure();
        }
    }

    /**
     * Write the recovery record, and take a snapshot if one is due. One function, because a manual save
     * and an autosave must not be able to disagree about what "recorded" means.
     *
     * `reason` forces a snapshot: an explicit act is not subject to a timer. Omitted, an auto-save
     * snapshot is taken at most once per SNAPSHOT_MIN_INTERVAL_MS. That interval is the difference
     * between a ring that can serve its purpose and one that cannot - five snapshots at a few seconds
     * apart would evict the pre-import copy taken moments before the import being regretted.
     */
    function writeCurrent(env, reason) {
        state.autosave.lastBody = JSON.stringify(env.body);
        // Mirrored into localStorage so start-up knows what to recover without reading through
        // IndexedDB to find out.
        setStoredString(state.currentProjectKey, env.projectId);
        renderSaveStatus('saving');
        projectStore.saveCurrent(env, (result) => {
            try {
                if (!result.ok) { reportSaveFailure(); return; }
                state.autosave.failed = false;
                state.autosave.savedAt = Date.now();
                renderSaveStatus('saved');
            } catch (err) { reportSaveFailure(); }
        });

        const now = Date.now();
        const due = reason
            || (now - state.autosave.lastSnapshotAt >= persistence.SNAPSHOT_MIN_INTERVAL_MS ? 'auto-save' : null);
        if (!due) return;
        state.autosave.lastSnapshotAt = now;
        // No failure handling: a snapshot that does not land costs a recovery point, not the save. The
        // current record above is the one the status line speaks for. The callback only redraws the
        // panel, which is on screen the whole time now and would otherwise go stale the moment the ring
        // took a point.
        projectStore.snapshot(env, due, () => { try { refreshRecoverPanel(); } catch (err) { /* see beginPersistence */ } });
    }

    /**
     * A safety copy taken before something irreversible - New File, Clear All, an import, a restore.
     *
     * The body is read here, synchronously, and only the write is deferred. That is what makes the
     * guarantee hold even though the record lands after the page has already been emptied. It ignores
     * the auto-save interval on purpose: this is the snapshot the ring exists for.
     *
     * `cb` runs once the copy is durably written, or immediately if there was nothing to copy. Callers
     * that are about to replace the page wait for it; callers that are about to clear it need not.
     */
    function snapshotBeforeDestruction(reason, cb) {
        const done = () => { if (typeof cb === 'function') cb(); };
        if (!projectStore || !UI['bulk-input'] || !UI['bulk-input'].value.trim()) { done(); return; }
        try {
            const env = currentEnvelope();
            state.autosave.lastSnapshotAt = Date.now();
            projectStore.snapshot(env, reason, () => {
                try { refreshRecoverPanel(); } catch (err) { /* see beginPersistence */ }
                try { done(); } catch (err) { /* not ours */ }
            });
        } catch (err) {
            done();
        }
    }

    /**
     * A write did not land. Sticky until one does: `status` is transient - the next keystroke sets it
     * to "Unsaved changes" - and without a flag of its own the failure would be washed away by an edit
     * that happened to change nothing, leaving the line claiming autosave was fine.
     */
    function reportSaveFailure() {
        state.autosave.failed = true;
        renderSaveStatus('error');
    }

    /** Back to rest after a flush that found nothing to write. A reported failure stands until a write
     *  actually succeeds: a flush that skipped the store is no evidence the store started working. */
    function restStatus() {
        if (state.autosave.failed) { renderSaveStatus('error'); return; }
        renderSaveStatus(state.autosave.savedAt ? 'saved' : 'on');
    }

    function clockTime(when) {
        const at = new Date(when || Date.now());
        return String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
    }

    /**
     * The one line of UI autosave has, and the only place a designer learns it is not running.
     *
     * A store that cannot record anything says so and names the way out, for the reason the quota alert
     * gives: a refused write is the one case where saying nothing is worse than saying the wrong thing.
     * A recovery layer that is silently not recording is that case exactly.
     *
     * textContent rather than innerHTML, so this reads back under the stub as what a user would see.
     */
    function renderSaveStatus(kind) {
        if (kind) state.autosave.status = kind;
        const line = UI['save-status'];
        if (!line) return;
        const blocked = projectStore ? projectStore.unavailable() : null;
        let text;
        if (blocked) text = 'Autosave unavailable \u2014 use Save File';
        else if (state.autosave.status === 'error') text = 'Recovery record unreadable';
        else if (state.autosave.status === 'saving') text = 'Saving\u2026';
        else if (state.autosave.status === 'dirty') text = 'Unsaved changes';
        else if (state.autosave.status === 'saved') text = 'Saved ' + clockTime(state.autosave.savedAt);
        else text = 'Autosave on';
        line.textContent = text;
    }

    /**
     * The single line init() gains, and the only entry point into this section.
     *
     * Last in init() and nothing above it moves, so a browser with no IndexedDB, or a slow one, boots
     * exactly as it did before. Idempotent and silent about its own failures: test-newfile.js boots a
     * second time in an already-booted context, and an exception here would take the page with it.
     */
    function beginPersistence() {
        try {
            projectStore = persistence.createStore(window.STITCH_ADAPTER || null);
            state.autosave.dirty = false;
            state.autosave.lastBody = null;
            state.autosave.savedAt = 0;
            state.autosave.failed = false;
            state.recovery.offer = null;
            state.recovery.snapshots = [];
            // A new session, so the ring is free to take its first snapshot again. The panel is drawn
            // straightaway rather than waiting to be asked for: there is no button to ask with, and a
            // fire escape nobody can see is not one. It draws its empty state until there is anything
            // in the ring, and beginRecoveryProbe redraws it if it finds something to offer.
            state.autosave.lastSnapshotAt = 0;
            refreshRecoverPanel();
            renderSaveStatus('on');
            hookSessionFlush();
            beginRecoveryProbe();
        } catch (err) {
            projectStore = null;
        }
    }

    let sessionFlushHooked = false;

    /**
     * Flush on the way out.
     *
     * visibilitychange rather than beforeunload: beforeunload does not fire reliably on mobile or when
     * a tab is discarded, and cannot complete an IndexedDB write synchronously in any case. The event
     * fires on both hide and show, so the check is for "not visible" rather than "hidden" - under the
     * headless stub there is no visibilityState at all, and testing for 'hidden' would make this
     * unreachable outside a browser.
     */
    function hookSessionFlush() {
        if (sessionFlushHooked || typeof document.addEventListener !== 'function') return;
        sessionFlushHooked = true;
        document.addEventListener('visibilitychange', () => {
            try {
                if (document.visibilityState === 'visible') return;
                flushAutosave();
            } catch (err) { /* leaving the page is not the moment to raise anything */ }
        });
        // beforeunload is unreliable for a write, but perfectly good for clearing a token: this is the
        // only thing that distinguishes a closed tab from a crashed one.
        if (typeof window.addEventListener === "function") {
            window.addEventListener('beforeunload', () => { setStoredString(state.sessionKey, ''); });
        }
    }

    // ---- Recovery: the offer, the panel and restoring --------------------

    /**
     * Puts an envelope on the page. Import and restore both need it, and neither may have its own
     * version - applyProjectRecord is where the per-field defaulting lives, and the recovery record is
     * refreshed from its tail, so nothing here has to remember to do either.
     */
    function applyEnvelope(env) {
        applyProjectRecord(env.projectName, env.body);
        state.recovery.offer = null;
        refreshRecoverPanel();
    }

    /**
     * The recovery copy should agree with whatever was just opened. fromLegacySave is what makes a
     * stitchmath_saves record into an envelope; a record it refuses is reported on the status line
     * rather than in a dialog, because by this point the project is already on screen and the only
     * thing that failed is the safety copy of it.
     */
    function recordLoadedProject(name, project) {
        if (!projectStore) return;
        try {
            const converted = persistence.fromLegacySave(name, project);
            if (!converted.ok) { reportSaveFailure(); return; }
            state.autosave.dirty = false;
            state.autosave.lastBody = null;
            writeCurrent(converted.value);
        } catch (err) {
            reportSaveFailure();
        }
    }

    /** The dropdown entry that is the boot offer rather than a snapshot. A string no IndexedDB key
     *  can be, so it cannot collide with one. */
    const OFFER_VALUE = 'offer';

    /** What each reason means to someone who did not write it. */
    const SNAPSHOT_LABELS = {
        'auto-save': 'autosaved',
        'manual-save': 'saved',
        'pre-import': 'before an import',
        'pre-restore': 'before a restore',
        'pre-destructive-operation': 'before the page was cleared'
    };

    function refreshRecoverPanel() {
        if (!projectStore) { state.recovery.snapshots = []; renderRecoverPanel(); return; }
        const projectId = persistence.projectIdFor(UI['project-name']?.value || '');
        projectStore.listSnapshots(projectId, (result) => {
            try {
                state.recovery.snapshots = result.ok ? result.value : [];
                renderRecoverPanel();
            } catch (err) { /* an async callback may not raise; see beginPersistence */ }
        });
    }

    /**
     * One dropdown of recovery points, newest first, and one Restore button - not a button per row.
     *
     * The ring holds five, and most of the time several of them are autosaves of one unchanged page.
     * Five Restore buttons for one state is five decisions nobody needs to make, so a run of
     * snapshots with the same digest is listed once, as its newest, and the whole list is a single
     * <select> with the time and the reason on each entry. A snapshot written before the digest
     * existed has none, and is kept - an entry that might differ beats one that might be lost.
     *
     * The offer - unsaved work found on boot - is the newest entry IN that dropdown, and the line
     * above it only says what happened. It used to carry a Restore of its own, which put two buttons
     * in a panel that exists to ask one question; the top one also stretched the width of the panel,
     * so the smaller, more dangerous choice looked like the main one. Preselected, so pressing the
     * single Restore does exactly what the removed button did.
     *
     * "Recovery points", never "history" and never "versions". The ring lives in storage a browser may
     * clear at any moment, does not travel between machines and does not survive a cleared profile.
     * The copy a designer owns is the exported file, and the note at the foot says so on every render -
     * this panel is the one place the app could imply otherwise, so it is the one place that must not.
     *
     * Built with createElement rather than assigned markup: a Restore button written into innerHTML
     * cannot be found by getElementById, so it would work in a browser and silently do nothing here.
     */
    function renderRecoverPanel() {
        const panel = UI['recover-panel'];
        if (!panel) return;
        panel.replaceChildren();
        panel.appendChild(elem('h3', 'recover-title', 'Recent recovery points'));

        // What happened, in a sentence. No control on this line: the offer is restored from the
        // dropdown below like everything else.
        const offer = state.recovery.offer;
        if (offer) {
            const row = elem('div', 'recover-offer');
            const named = offer.envelope.projectName ? ` in "${offer.envelope.projectName}"` : '';
            row.appendChild(elem('span', 'recover-when',
                (offer.crashed ? 'Stitch Math closed unexpectedly. ' : '')
                + `Unsaved work${named} from ${relativeWhen(offer.envelope.savedAt)}`));
            panel.appendChild(row);
        }

        const rows = (state.recovery.snapshots || []).filter((snapshot, i, all) =>
            !snapshot.digest || i === 0 || snapshot.digest !== all[i - 1].digest);
        if (rows.length || offer) {
            const pick = elem('div', 'recover-pick');
            const select = elem('select', null, null, 'recover-select');
            // No visible label: the panel is headed "Recent recovery points" and the dropdown holds
            // nothing else, so a "Recovery point" caption over it said the heading again. The name a
            // screen reader needs is still there - it just is not drawn twice.
            select.setAttribute('aria-label', 'Recovery point');
            UI['recover-select'] = select;
            // Ids are looked up from the option's value rather than carried on it: an IndexedDB key
            // is a number, and a <select> only ever hands back a string. OFFER_VALUE cannot collide
            // with one: it is not a number.
            const byValue = {};
            if (offer) {
                const option = elem('option', null,
                    `Unsaved work from your last session (${relativeWhen(offer.envelope.savedAt)})`);
                option.value = OFFER_VALUE;
                select.appendChild(option);
            }
            rows.forEach(snapshot => {
                const value = String(snapshot.id);
                byValue[value] = snapshot.id;
                const option = elem('option', null,
                    `${clockWhen(snapshot.savedAt)} (${relativeWhen(snapshot.savedAt)}) \u00b7 ${SNAPSHOT_LABELS[snapshot.reason] || snapshot.reason}`);
                option.value = value;
                select.appendChild(option);
            });
            // The offer first when there is one: it is the newest thing here, and it is what the
            // panel drew itself to ask about.
            select.value = offer ? OFFER_VALUE : String(rows[0].id);
            const restore = button('btn-secondary', 'Restore', 'recover-restore-btn', () => {
                if (select.value === OFFER_VALUE) { restoreOffer(); return; }
                const id = byValue[select.value];
                if (id !== undefined) restoreSnapshot(id);
            });
            pick.append(select, restore);
            panel.appendChild(pick);
        }

        if (!rows.length && !offer) {
            panel.appendChild(elem('p', 'recover-empty',
                'Recovery points are temporary. Use Export Project to keep a copy you own.'));
        } else {
            panel.appendChild(elem('p', 'recover-note',
                'Recovery points are temporary. Use Export Project to keep a copy you own.'));
        }
    }

    /**
     * Restore is itself recoverable: the copy of what is on screen now is durably written before the
     * snapshot is even read, so a restore that goes wrong halfway leaves a way back. Any failure at any
     * step says so and returns, with the page untouched.
     */
    function restoreSnapshot(snapshotId) {
        if (!projectStore) return;
        askConfirm('Restore this recovery point? It replaces the pattern, gauge and grading now on the page.', () => {
            snapshotBeforeDestruction('pre-restore', () => {
                projectStore.getSnapshot(snapshotId, (result) => {
                    try {
                        if (!result.ok || !result.value) {
                            notify('That recovery point could not be read. Nothing on the page has changed.', 'error');
                            return;
                        }
                        const checked = persistence.migrate(result.value);
                        if (!checked.ok) { notify(checked.error.message, 'error'); return; }
                        applyEnvelope(checked.value);
                        notify('Recovery point restored.');
                    } catch (err) {
                        notify('That recovery point could not be opened. Nothing on the page has changed.', 'error');
                    }
                });
            });
        }, { confirmLabel: 'Restore' });
    }

    /** The offer made at start-up. Its envelope has already been read and migrated by the probe. */
    function restoreOffer() {
        const offer = state.recovery.offer;
        if (!offer) return;
        askConfirm('Restore the work from your last session? It replaces what is now on the page.', () => {
            snapshotBeforeDestruction('pre-restore', () => {
                try {
                    applyEnvelope(offer.envelope);
                } catch (err) {
                    notify('That work could not be reopened. Nothing on the page has changed.', 'error');
                }
            });
        }, { confirmLabel: 'Restore' });
    }

    /**
     * Look for something to offer, and never do more than offer it.
     *
     * A recovered copy is not loaded, because the designer may have arrived to do something else and a
     * page that rewrites itself on boot is worse than one that forgets. It also never blocks: nothing
     * above this in init() waits on it, so a slow or absent store leaves boot exactly as it was.
     *
     * A damaged recovery record costs the recovery record, not the page - the same trade getLocalStorage
     * makes at the top of section 5, for the same reason.
     */
    function beginRecoveryProbe() {
        // Read then written: still set from last time means that session never ended cleanly. It changes
        // the offer's wording and nothing else, so a false positive costs nothing.
        const endedBadly = getStoredString(state.sessionKey) === 'open';
        setStoredString(state.sessionKey, 'open');

        const projectId = getStoredString(state.currentProjectKey);
        if (!projectStore || !projectId) return;

        projectStore.loadCurrent(projectId, (result) => {
            try {
                // The probe is what resolves which adapter this session is on, so this is the first
                // moment the status line can tell the truth about whether anything is being recorded.
                renderSaveStatus();
                if (!result.ok) { reportSaveFailure(); return; }
                const record = result.value;
                if (!record) return;

                const checked = persistence.migrate(record);
                if (!checked.ok) { reportSaveFailure(); return; }
                const env = checked.value;
                if (!env.body.rawText.trim()) return;

                // The page won because it is newer. Anything already typed, or any edit not yet
                // flushed, is more recent than the record - and the ring is still one button away.
                if (state.autosave.dirty) return;
                if (UI['bulk-input'] && UI['bulk-input'].value.trim()) return;

                state.recovery.offer = { envelope: env, crashed: endedBadly };
                renderRecoverPanel();
            } catch (err) { /* an exception in an async callback is counted as a suite failure */ }
        });
    }

    // ---- The portable project file ----------------------------------------

    /**
     * The designer's own copy, and the only thing in this whole layer that is permanent. Snapshots live
     * in storage a browser may clear at any moment and never leave the machine; this is the file they
     * own, back up and send to someone else.
     *
     * Written through downloadFile like every other export, rather than a Blob built here: that is the
     * one place a download happens and the one place an export is counted.
     */
    function handleExportProject() {
        if (!UI['bulk-input'].value.trim()) { notify('There is no pattern to export.', 'warn'); return; }
        downloadFile(`${projectSlug('pattern')}-project.json`,
                     JSON.stringify(currentEnvelope(), null, 2), 'application/json',
                     'Project file saved.');
    }

    /** The largest thing that could sensibly be a project file. Generous by an order of magnitude - the
     *  point is to catch a video or a disk image chosen by mistake, not to police a big pattern. */
    const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

    /* Which question the file picker is answering. Import Project is the only button that opens it
       now - the stitches-only door was removed from the panel - but the mode is still recorded before
       the picker opens and reset to 'project' after every read, so importStitchesFrom stays reachable
       for a caller that wants it and no picker can inherit a mode it did not set. */
    let importMode = 'project';

    /** Four lines and a FileReader, so the decision below can be tested without one. */
    function handleImportFile(event) {
        const input = (event && event.target) || UI['import-file'];
        const file = input && input.files ? input.files[0] : null;
        if (!file) return;
        // Refused before it is read, not after. A project file is a few hundred KB of JSON; anything of
        // this order is the wrong file, and JSON.parse on it freezes the tab for long enough to look
        // like a crash - parsePortable never gets its chance to decline politely.
        if (file.size > MAX_IMPORT_BYTES) {
            notify(`That file is ${Math.round(file.size / 1048576)} MB. A Stitch Math project is under `
                + `${MAX_IMPORT_BYTES / 1048576} MB, so this is almost certainly not one.`, 'warn');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => handleImportText(String(reader.result || ''));
        reader.onerror = () => notify('That file could not be read.', 'error');
        reader.readAsText(file);
        // Cleared so choosing the same file twice fires a second change event.
        input.value = '';
    }

    /**
     * The whole import, and the order is the design.
     *
     * Read, then check the version, then ask, then take the safety copy, and only inside its callback
     * touch the page. Two things fall out of that ordering and both matter:
     *
     * A file this build cannot open costs nothing at all - no snapshot, no alert about work that was
     * never at risk, and not one character of the open project changed. Validating after snapshotting
     * would fill the five-slot ring with safety copies for imports that were never going to happen;
     * five bad drag-and-drops and the copies worth having are gone.
     *
     * And the replacement itself is recoverable, because the copy is durably written before the first
     * field is overwritten rather than afterwards.
     */
    function handleImportText(text) {
        const mode = importMode;
        importMode = 'project';

        const parsed = persistence.parsePortable(text);
        if (!parsed.ok) { notify(parsed.error.message, 'error'); return; }

        const env = parsed.value;
        if (mode === 'stitches') { importStitchesFrom(env); return; }
        const label = env.projectName || 'this project';
        askConfirm(`Import "${label}"? This replaces the pattern, gauge and grading now on the page.`, () => {
            snapshotBeforeDestruction('pre-import', () => {
                try {
                    applyEnvelope(env);
                    notify(`Imported "${label}".`);
                } catch (err) {
                    notify('That project could not be opened. Your previous work is in Recent recovery points.', 'error');
                }
            });
        }, { confirmLabel: 'Import' });
    }

    /**
     * Takes the dictionary out of a project file and leaves everything else where it is.
     *
     * No snapshot is taken and nothing on the page is replaced, which is why this does not go through
     * the ceremony handleImportText does: adding stitches to a dictionary is additive, and the one
     * destructive thing it could do - overwrite a definition already here - is the thing it asks about.
     *
     * A file from before the dictionary was carried in the envelope has no dictionary in it. That is
     * reported as its own case rather than as "0 stitches imported", because the two mean different
     * things to the person who chose the file: one is an old file, the other is an empty one.
     */
    function importStitchesFrom(env) {
        const incoming = (env.body && env.body.customStitches) || {};
        if (!Object.keys(incoming).length) {
            notify(`"${env.projectName || 'That project'}" carries no custom stitches. `
                + 'Projects saved before stitch dictionaries traveled with them will not have any.', 'warn');
            return;
        }

        const report = mergeStitchDictionary(incoming);
        let take = report.added.slice();

        if (report.conflicts.length) {
            // Named in full rather than counted. "3 stitches already exist" tells the designer nothing
            // about whether to say yes; the names are what they recognise.
            const list = report.conflicts.map(k => `"${k}"`).join(', ');
            // Declining is not "do nothing": the stitches that did NOT clash were still asked for, and
            // dropping them because one name collided would lose work the designer agreed to. So both
            // answers lead somewhere, and the difference is only which list is written.
            askConfirm(`${list} ${report.conflicts.length === 1 ? 'is' : 'are'} already in your `
                     + `dictionary with different numbers. Replace ${report.conflicts.length === 1 ? 'it' : 'them'} `
                     + `with the imported version? Canceling keeps what you have and imports the rest.`,
                () => finishStitchImport(report, take.concat(report.conflicts)),
                { confirmLabel: 'Replace', onCancel: () => finishStitchImport(report, take) });
            return;
        }
        finishStitchImport(report, take);
    }

    /* Split out so the conflict answer and the plain path write through the same code. */
    function finishStitchImport(report, take) {
        if (!take.length) {
            notify('Nothing to import - every stitch in that file is already in your dictionary.');
            return;
        }
        commitStitchMerge(report.incoming, take);

        const parts = [`${take.length} stitch${take.length === 1 ? '' : 'es'} imported`];
        if (report.unchanged.length) parts.push(`${report.unchanged.length} already matched`);
        if (report.conflicts.length && take.length === report.added.length) {
            parts.push(`${report.conflicts.length} kept as you had ${report.conflicts.length === 1 ? 'it' : 'them'}`);
        }
        notify(parts.join(', ') + '.');
    }

    // === 6. PATTERN PARSING ENGINE === //
    /**
     * A published pattern is typeset in narrow columns, so one instruction spreads over three or four
     * physical lines. Read a line at a time, the tail of a row becomes a row of its own - "75) hdc.",
     * "spaced around armhole edge; join with sl st in first sc." - each of which fails and blocks
     * everything under it. Rejoining them is what makes a pasted pattern readable at all.
     *
     * It is also the wrong thing to do to a pattern typed one row per line, so the reflow only runs when
     * the text actually arrived wrapped. The tell is not the shape of the lines - a lowercase hand-typed
     * pattern looks wrapped by every shallow measure - it is that a wrapped fragment cannot be read on
     * its own. A typed row always can: that is what makes it a row.
     */
    function splitPatternLines(rawText) {
        const lines = String(rawText || '').split('\n').map(line => line.trim());
        // Each logical line carries the index of the raw textarea line it began on. Blank lines are
        // dropped and wrapped fragments are glued together below, so position in this array says
        // nothing about position in the box - and the linter has to underline the line the user is
        // actually looking at. A joined continuation keeps the index of the line it STARTED on.
        const nonBlank = lines
            .map((text, lineIndex) => ({ text, lineIndex }))
            .filter(entry => entry.text);
        if (nonBlank.length < 2) return nonBlank;

        // Nothing joins onto a line that has already finished. A wrapped fragment always continues an
        // unfinished sentence, so a full stop, semicolon or written stitch count at the end of the
        // previous line means the next line is something new - a copyright notice, an abbreviation, the
        // next row - and gluing it on would make it part of a row it has nothing to do with.
        const looksFinished = line => /[.;:]\s*$/.test(line) || /\(\s*\d+[^)]*\)\s*[.;]?\s*$/.test(line);

        // A heading, whether or not the section classifier would call it one. "GAUGE" and "Sleeve:" it
        // already knows; "Abbreviations" and "Pattern Notes" on a line of their own it does not - and
        // those are exactly the headings whose bodies must not be glued onto them, because the heading
        // is the only thing marking the block below as documentation rather than work.
        const isHeading = line => window.CrochetMathEngine.parseSectionHeader(line).isSection
            || Boolean(window.CrochetMathEngine.documentationHeading(line));

        // A line that opens a row, a piece, or a fresh instruction is never a continuation.
        const opensNewLine = (line, afterBlank) => afterBlank
            || looksLikeRowLabel(line)
            || isHeading(line)
            // A foundation chain opens a piece, so it is never the tail of the line above.
            // "Foundation: Ch 56" was being glued onto the heading over it and the whole piece lost the
            // count it works into.
            || window.CrochetMathEngine.startsWorkSection(line)
            // "Hook Size: 5.0 mm", "Gauge: 14 hdc x 10 rounds" - a labelled statement about the pattern
            // begins something, it never continues something. Front matter is often set without blank
            // lines between entries, and glued to the line above the label is gone and with it any
            // chance of reading it.
            || Boolean(window.CrochetMathEngine.parseMetadataStatement(line))
            || /^(?:With|Work|Rep|Repeat|Beg|Begin|Fasten|Sew|Weave|Note|Do not)\b/.test(line)
            // "hdc = half double crochet" is a whole entry on one line. An abbreviation list rarely ends
            // its lines with punctuation, so without this the entries run together and only the first is
            // readable. Only the "=" form counts: a term followed by a bracket is the other way an entry
            // is written, but it is also how a wrapped row continues - "hook (3 skipped ch count as dc),
            // * ch 1, sk" - and splitting there tears a row in half.
            || /^[A-Za-z][A-Za-z0-9]{0,11}(?:\s+sts?)?\s*=/.test(line);

        const readsAlone = line => {
            const parsed = window.CrochetMathEngine.parseInstructions(line);
            return (parsed.unknownTokens || []).length === 0;
        };

        let candidates = 0, unreadable = 0;
        for (let i = 1; i < nonBlank.length; i++) {
            if (looksFinished(nonBlank[i - 1].text) || opensNewLine(nonBlank[i].text, false)) continue;
            candidates++;
            if (!readsAlone(nonBlank[i].text)) unreadable++;
        }
        // Measured on the three garment patterns: 41-82% of their continuation lines are
        // unreadable alone, against 0% for every hand-typed pattern in the test corpora.
        // The floor on candidates keeps one odd line in a short paste from flipping the mode.
        const isWrapped = candidates >= 3 && (unreadable / candidates) >= 0.25;
        if (!isWrapped) return nonBlank;

        const out = [];
        let afterBlank = true;
        lines.forEach((line, lineIndex) => {
            if (!line) { afterBlank = true; return; }
            // A heading is a line of its own on both sides. Without this the body runs onto the end of
            // it - "STITCH EXPLANATIONS hdc2tog (hdc 2 sts together)..." - and it stops being a heading.
            const previous = out.length ? out[out.length - 1].text : '';
            const previousWasHeading = out.length > 0 && isHeading(previous);
            if (!out.length || previousWasHeading || looksFinished(previous) || opensNewLine(line, afterBlank)) {
                out.push({ text: line, lineIndex });
            }
            else out[out.length - 1].text += ' ' + line;
            afterBlank = false;
        });
        return out;
    }
    
    /**
     * Older books spell their numbers out ("chain of fourteen stitches", "Thirty-seventh row").
     * Rewriting them to digits up front lets the row-label, size and stitch-count logic downstream stay
     * purely numeric. Only whole-word matches, so "one" inside "bone" is safe.
     */
    const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
        'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
        'eighteen', 'nineteen'];
    const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
    const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
        'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth',
        'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
    const ORDINAL_TENS = { twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90 };

    const CARDINAL_WORDS = (() => {
        const map = new Map();
        ONES.forEach((w, i) => { if (i > 0) map.set(w, String(i)); });
        for (const [word, value] of Object.entries(TENS)) {
            map.set(word, String(value));
            ONES.slice(1, 10).forEach((unit, i) => map.set(`${word}-${unit}`, String(value + i + 1)));
        }
        return map;
    })();

    const ORDINAL_WORDS = (() => {
        const map = new Map();
        ORDINALS.forEach((w, i) => { if (i > 0) map.set(w, String(i)); });
        for (const [word, value] of Object.entries(TENS)) {
            ORDINALS.slice(1, 10).forEach((unit, i) => map.set(`${word}-${unit}`, String(value + i + 1)));
        }
        for (const [word, value] of Object.entries(ORDINAL_TENS)) map.set(word, String(value));
        return map;
    })();

    // Longest first, so "twenty-seven" is consumed before "twenty".
    const longestFirst = keys => keys.sort((a, b) => b.length - a.length).join('|');
    const CARDINAL_REGEX = new RegExp(`\\b(${longestFirst([...CARDINAL_WORDS.keys()])})\\b`, 'gi');
    const ORDINAL_ALTERNATION = longestFirst([...ORDINAL_WORDS.keys()]);

    /**
     * Ordinals are deliberately NOT rewritten in the body of a row. In crochet "first" and "last" are
     * positions, not numbers - "sc in first 4 sts" means the first four stitches, and "sc in 1 4 sts"
     * silently loses three. They only mean a number in a row label, handled separately below.
     */
    function normalizeWordNumbers(line) {
        return String(line).replace(CARDINAL_REGEX, m => CARDINAL_WORDS.get(m.toLowerCase()) ?? m);
    }

    // "Fourth row", "Thirty-seventh row", "Eighth and Ninth Rows" - leading position only.
    const ORDINAL_LABEL_REGEX = new RegExp(
        `^(${ORDINAL_ALTERNATION})(\\s*(?:,|and|&|-|to)\\s*(${ORDINAL_ALTERNATION}))?(\\s+(?:rows?|rnds?|rounds?)\\b)`, 'i');

    function normalizeOrdinalRowLabel(line) {
        return String(line).replace(ORDINAL_LABEL_REGEX, (whole, first, joinPart, second, noun) => {
            const start = ORDINAL_WORDS.get(first.toLowerCase());
            if (!start) return whole;
            if (second) {
                const end = ORDINAL_WORDS.get(second.toLowerCase());
                if (end) return `${start} and ${end}${noun}`;
            }
            return `${start}${noun}`;
        });
    }

    function createPatternStep(line) {
        return { originalLine: line, instructionString: line, expectedYield: 0, multiplier: 1, initialChain: 0, rowsToGenerate: 1, rangeStartRow: null };
    }

    /**
     * Multi-size patterns write the alternatives in parentheses: "Ch 52 (56, 60)", "dec 1 st ... -36
     * (36, 40, 40) sts". Those numbers are sizes, not stitch counts, and reading "(56)" as a written
     * count silently validates a garment against a number that was never a count.
     *
     * The discriminator is position, not content: a size group is an all-numeric parenthesised list
     * *directly preceded by a number* - "52 (56)" is a size, "sc in each ch across (24)" is a count and
     * "(12 loops)" is a note. Substituting the selected size for the whole group leaves a clean
     * single-size instruction.
     */
    // Counting the sizes moved to the engine as CrochetMathEngine.countSizeVariants - it reads text
    // and nothing else, so it belongs beside the rest of the inference. The regex and the
    // size-vs-count discriminator came with it and are read back from there rather than kept as a
    // second copy: counting the sizes and substituting one have to find the SAME groups.

    function resolveSizeVariants(step, sizeIndex) {
        const line = step.instructionString;
        const E = window.CrochetMathEngine;
        step.instructionString = line.replace(
            E.sizeGroupRegex(),
            (whole, baseNumber, list, unit, offset) => {
                if (!E.isSizeGroup(list, offset + whole.length, line)) return whole;
                // Index 0 is the base size, already written outside the parentheses.
                const picked = sizeIndex <= 0
                    ? baseNumber
                    : (list.split(',').map(v => v.trim())[sizeIndex - 1] ?? baseNumber);
                // A unit inside the bracket means the bracket was the row's stated count, not an aside
                // - "49 (54, 59, 61 sts)". Resolving it to a bare number would throw the count away, so
                // it is handed on in the shape the written-count reader recognises, carrying this size.
                return unit ? `(${picked} ${unit})` : picked;
            }
        );
        return step;
    }

    /**
     * The stitch count a row is written to end on: "(24)", "[108 sts]", "[60 hdc, 4 ch-1 sps]".
     *
     * The last is how a yoke, a granny square or anything else with corners states its count, and it
     * was matched by nothing here. That cost twice: the expected count came back 0, so the row was never
     * checked against what the designer wrote, AND the annotation stayed in the instruction, where "4
     * ch-1 sps" read as four more chain spaces worked and inflated the row by four.
     *
     * The parts are summed, because the app counts a chain space toward the row's yield the same way
     * the pattern does - 60 hdc and 4 ch-1 sps is a round of 64. Parts measured in rows or inches are
     * not stitches and are left out.
     */
    const COUNT_TAIL = String.raw`(?:\s*[a-zA-Z][a-zA-Z0-9\- ]*)?`;
    // The full stop after the bracket is part of the sentence, not the count, and most published
    // patterns write one: "sc in each st across (21 sts)." Anchored hard to the end without it, the
    // count matched nothing - which cost twice, exactly as the bracketed-parts case did: the row was
    // never checked against the designer's number, AND "(21 sts)" stayed in the instruction, where it
    // tokenized as twenty-one worked stitches and buried the row's real count.
    const WRITTEN_COUNT_RE = new RegExp(String.raw`[\(\[]\s*(\d+)${COUNT_TAIL}((?:\s*,\s*\d+${COUNT_TAIL})*)\s*[\)\]]\s*[.;]?\s*$`);
    const NOT_A_STITCH_UNIT = /\b(?:rows?|rounds?|rnds?|in|inch(?:es)?|cm|mm|yd|yds|yards?|gs?|grams?|balls?|skeins?)\b/i;

    /**
     * A bracketed list whose FIRST item is a bare number is a run of sizes, not a count in parts. The
     * parts of a real multi-part count are each labelled with what they are - "[60 hdc, 4 ch-1 sps]" -
     * because that is the only reason to write it in parts at all. A size list labels at most the last:
     * "(24, 28, 32 sts)".
     *
     * It matters because the two are summed by the same rule, and a size list that reached it came back
     * as the total of every size at once - a four-size row reported as a written count of 84, presented
     * as the designer's own figure. This only reaches a list with no base number in front of it: a list
     * WITH one is claimed by resolveSizeVariants long before here.
     */
    const SIZE_LIST_NOT_A_COUNT = /^[\(\[]\s*\d+\s*,/;

    function extractExpectedYield(step) {
        const match = step.instructionString.match(WRITTEN_COUNT_RE);
        if (!match) return step;

        // Removed rather than left in place: it is an annotation either way, and leaving it in the
        // instruction is how "(21 sts)" used to be tokenized as worked stitches. No count is claimed -
        // which size it belongs to is exactly what is missing.
        if (SIZE_LIST_NOT_A_COUNT.test(match[0])) {
            step.instructionString = step.instructionString.replace(WRITTEN_COUNT_RE, '').trim();
            return step;
        }

        let total = parseInt(match[1], 10);
        // The trailing parts, each still carrying its unit, so a part measured in something that is not
        // a stitch can be recognised and dropped.
        (match[2] || '').split(',').forEach(part => {
            const piece = part.trim();
            if (!piece || NOT_A_STITCH_UNIT.test(piece)) return;
            const n = piece.match(/^(\d+)/);
            if (n) total += parseInt(n[1], 10);
        });

        step.expectedYield = total;
        step.instructionString = step.instructionString.replace(WRITTEN_COUNT_RE, '').trim();
        return step;
    }

    /**
     * The chain that lifts the hook to the height of the row about to be worked. It is not a stitch and
     * must not be counted, or the count gains one every row - and because the calculated count carries
     * forward, the error compounds down the piece rather than staying put.
     *
     * A flat pattern turns, and the word "turn" is what marked the chain as a turning chain. A pattern
     * worked in the round never turns: it opens "Ch 1, hdc in each st around" and closes with a join, so
     * nothing said "turning chain" and the ch 1 was counted in every round of every in-the-round pattern.
     *
     * Only ch 1 is taken on the strength of the round alone. A single chain is never a stitch in any
     * convention - there is no stitch one chain tall. From ch 2 up it depends on the designer, who says
     * so either way, so those still need the turn or the parenthetical and are not guessed at.
     */
    /**
     * A chain that states its own verdict has been decided by the designer either way: "Ch 3 (counts as
     * dc)" is the row's first stitch and "Ch 2 (does not count as a st)" is not. The engine reads both
     * correctly, so such a chain is handed to it untouched. Swallowing the parenthetical here - which
     * the optional "(...)" in the patterns below used to do - meant the words the designer wrote changed
     * nothing at all: the row counted the same with or without them.
     */
    const CHAIN_STATES_ITS_OWN_COUNT = /\([^)]*\b(?:counts?\s+as|does\s+not\s+count|doesn'?t\s+count|not\s+a\s+(?:st|stitch))\b[^)]*\)/i;

    function preprocessTurningChain(step) {
        // The parenthetical is optional and sits between the chain and the turn: "Ch 2 (does not count
        // as a st), turn, hdc in each st across".
        const turningChainRegex = /^(?:(?:chain|ch)\s*\d+\s*(?:\([^)]*\))?\s*,\s*turn|turn\s*,\s*(?:chain|ch)\s*\d+\s*(?:\([^)]*\))?)\s*[,]?\s*/i;
        // "Ch 1," opening a round. The comma matters: it separates the chain from the work that
        // follows, and without it "Ch 1" is the whole instruction - a row that really does make a single
        // chain, and really should be counted.
        const roundOpeningChain = /^(?:chain|ch)\s*1\s*(?:\([^)]*\))?\s*,\s*(?=\S)/i;

        const match = step.instructionString.match(turningChainRegex)
            || step.instructionString.match(roundOpeningChain);
        if (!match) return step;
        if (CHAIN_STATES_ITS_OWN_COUNT.test(match[0])) return step;

        // Kept, not discarded. The row still has to be evaluated without it or every count gains one,
        // but it is part of what the pattern says and the reader wrote it - so the matrix, the printout
        // and the inline editor all show it again, marked as the one thing it is.
        step.turningChain = match[0].replace(/[,\s]+$/, '');
        step.instructionString = step.instructionString.replace(match[0], '').trim();
        return step;
    }

    /** What a row says, as the reader typed it. instructionString is the evaluated form, which has had
     *  the turning chain taken out of it; anything showing the row to a person wants the chain back. */
    function stepInstructionText(step) {
        // Empty when the row has no instruction of its own - a bare foundation chain keeps its number in
        // initialChain, and each caller words that fallback its own way ("Ch 20" in the editor,
        // "Chain 20" in the printout).
        if (!step.instructionString) return '';
        return step.turningChain ? `${step.turningChain}, ${step.instructionString}` : step.instructionString;
    }

    /** The same chain for the matrix, marked so it reads as shown-but-not-counted. */
    function turningChainMarkup(step) {
        if (!step.turningChain) return '';
        return `<span class="turning-chain" title="Turning chain — lifts the hook to the height of the row, and is not counted as a stitch">`
            + `${escapeHtml(step.turningChain)}</span>, `;
    }

    function extractMultiplier(step) {
        // A trailing "x 6" after a repeat group belongs to that group, not the whole row. "sc in next 2
        // sts, [bobble, sc x 3] x 6" must not multiply the leading 2 sc as well. expandBracketRepeats
        // applies it to the group correctly, so leave it inline whenever a group is present.
        if (/[\[\(\*]/.test(step.instructionString)) return step;

        const match = step.instructionString.match(/\s*(?:x|repeat|rep)\s*(\d+)(?:\s*times)?\s*$/i);
        if (!match) return step;
        step.multiplier = parseInt(match[1], 10);
        step.instructionString = step.instructionString.replace(/\s*(?:x|repeat|rep)\s*\d+(?:\s*times)?\s*$/i, '').trim();
        return step;
    }

    // The row-label shapes live in the engine, which owns the pattern grammar and is where the line
    // classifier reads them from too.
    const ROW_LABELS = window.CrochetMathEngine.ROW_LABELS;
    const looksLikeRowLabel = window.CrochetMathEngine.looksLikeRowLabel;

    function extractRowRange(step) {
        const rangeMatch = step.instructionString.match(ROW_LABELS.range);
        if (rangeMatch) {
            step.rangeStartRow = parseInt(rangeMatch[1], 10);
            step.rowsToGenerate = Math.max(1, parseInt(rangeMatch[2], 10) - step.rangeStartRow + 1);
            step.instructionString = step.instructionString.replace(rangeMatch[0], '').trim();
            return step;
        }
        const singleMatch = step.instructionString.match(ROW_LABELS.single);
        if (singleMatch) {
            step.rangeStartRow = parseInt(singleMatch[1], 10); step.rowsToGenerate = 1;
            step.instructionString = step.instructionString.replace(singleMatch[0], '').trim();
            return step;
        }
        const ordinalRange = step.instructionString.match(ROW_LABELS.ordinalRange);
        if (ordinalRange) {
            step.rangeStartRow = parseInt(ordinalRange[1], 10);
            step.rowsToGenerate = Math.max(1, parseInt(ordinalRange[2], 10) - step.rangeStartRow + 1);
            step.instructionString = step.instructionString.replace(ordinalRange[0], '').trim();
            return step;
        }
        const ordinalSingle = step.instructionString.match(ROW_LABELS.ordinalSingle);
        if (ordinalSingle) {
            step.rangeStartRow = parseInt(ordinalSingle[1], 10); step.rowsToGenerate = 1;
            step.instructionString = step.instructionString.replace(ordinalSingle[0], '').trim();
            return step;
        }
        // "Next 4 (8, 1, 7) Rnds:" - the size group is already resolved to one number by the time this
        // runs, so the label seen here is "Next 4 Rnds:".
        const nextCount = step.instructionString.match(ROW_LABELS.nextCount);
        if (nextCount) {
            step.rowsToGenerate = Math.max(1, parseInt(nextCount[1], 10));
            step.instructionString = step.instructionString.replace(nextCount[0], '').trim();
            return step;
        }
        // "Next Rnd:", "Last Row:", "Decrease Rnd:" - a row with a name instead of a number. It still
        // takes its place in the numbering, so nothing is set here beyond removing the label.
        const unnumbered = step.instructionString.match(ROW_LABELS.unnumbered);
        if (unnumbered) {
            step.instructionString = step.instructionString.replace(unnumbered[0], '').trim();
            return step;
        }
        step.instructionString = step.instructionString.replace(/^\d+[:.-]\s*/, '').trim();
        return step;
    }

    function extractFoundationChain(step, isFirstStep) {
        if (!isFirstStep) return step;
        const match = step.instructionString.match(/^(?:chain|ch)\s*(\d+)$/i);
        if (!match) return step;
        step.initialChain = parseInt(match[1], 10); step.instructionString = '';
        return step;
    }

    function parsePatternLine(line, isFirstStep = false) {
        let step = createPatternStep(line);
        // Word numbers first, so everything downstream sees digits. Sizes next: "(56)" must be resolved
        // away before extractExpectedYield can mistake it for a written stitch count.
        step.instructionString = normalizeOrdinalRowLabel(normalizeWordNumbers(step.instructionString));
        step = resolveSizeVariants(step, state.sizeIndex);
        step = extractExpectedYield(step); step = extractMultiplier(step);
        step = extractRowRange(step); step = extractFoundationChain(step, isFirstStep);
        return step;
    }

    window.enableInlineEdit = function(index) { state.editingIndex = index; renderUI(); };
    window.cancelInlineEdit = function() { state.editingIndex = null; renderUI(); };

    window.saveInlineEdit = function(index) {
        // Dynamic elements exception: Must query by dynamic ID
        const input = document.getElementById(`inline-input-${index}`);
        const multInput = document.getElementById(`inline-mult-${index}`);
        
        if (input) {
            const newText = input.value.trim();
            // A row that was nothing but a foundation chain carries its number in initialChain, so
            // turning it into worked stitches has to let that number go; a chain typed into the
            // single-row form alongside an instruction is a separate choice, and editing the instruction
            // must not discard it.
            const wasFoundationOnly = !state.patternSteps[index].instructionString
                && state.patternSteps[index].initialChain > 0;
            const parsed = parsePatternLine(newText, index === 0);
            state.patternSteps[index].instructionString = parsed.instructionString;
            state.patternSteps[index].multiplier = parsed.multiplier;
            state.patternSteps[index].expectedYield = parsed.expectedYield;
            if (index === 0 && (parsed.initialChain > 0 || wasFoundationOnly)) {
                state.patternSteps[index].initialChain = parsed.initialChain;
            }
            state.patternSteps[index].sourceLine = newText;
        }
        if (multInput) {
            const newMult = parseInt(multInput.value, 10);
            if (!isNaN(newMult) && newMult > 0) state.patternSteps[index].multiplier = newMult;
        }
        syncBulkInput();
        state.editingIndex = null;
        renderUI();
    };

    /**
     * The text the inline editor opens with. A foundation chain keeps its number in initialChain and
     * leaves the instruction empty, so reading instructionString alone opens an empty box on row 1 of
     * any pattern starting "Ch 20" - the row looks erased, and saving it really would erase it.
     */
    function stepEditText(step) {
        // The turning chain comes back for editing too. Without it the box opened on a row missing its
        // own first words, and saving wrote that shortened row back over the original - the one edit
        // that really did erase what the pattern said.
        const base = stepInstructionText(step) || (step.initialChain > 0 ? `Ch ${step.initialChain}` : '');
        return base + (step.expectedYield > 0 ? ` (${step.expectedYield})` : '');
    }

    /** Rewrites the pattern box from the parsed rows. The one place the pattern text changes without a
     *  keystroke behind it, which is why the dirty mark is here rather than on the three buttons that
     *  reach it - Delete Last Row, Clear All and the single-row form. */
    function syncBulkInput() {
        UI['bulk-input'].value = state.patternSteps.map(step => {
            if (step.sourceLine) return step.sourceLine;
            let line = step.instructionString || ('ch ' + step.initialChain);
            if (step.expectedYield > 0) line += ` (${step.expectedYield})`;
            return line;
        }).join('\n');
        // After the write, not before: the flush this arms reads the box back, and marking first
        // recorded the row that was just deleted.
        markDirty();
    }

    function handleSingleRowSubmit(event) {
        event.preventDefault();
        const initialChainOverride = parseInt(UI['initial-chain-input'].value || '0', 10);
        const multiplierOverride = parseInt(UI['multiplier-input'].value || '1', 10);
        const expectedYieldOverride = parseInt(UI['expected-yield-input'].value || '0', 10);
        const rawInstruction = (UI['tokens-input'].value || '').trim();

        let step = parsePatternLine(rawInstruction, state.patternSteps.length === 0);
        if (initialChainOverride > 0) step.initialChain = initialChainOverride;
        if (multiplierOverride !== 1) step.multiplier = multiplierOverride;
        if (expectedYieldOverride > 0) step.expectedYield = expectedYieldOverride;

        state.patternSteps.push({
            initialChain: step.initialChain, instructionString: step.instructionString,
            multiplier: step.multiplier, expectedYield: step.expectedYield, sourceLine: step.originalLine
        });

        UI['row-form'].reset(); syncBulkInput(); renderUI();
    }
    
    /** Populates the size selector from the pattern itself. The widest size group wins: a pattern
     *  writing "Ch 52 (56, 60)" has three sizes even if a later row happens to be the same across all
     *  of them and is written without parentheses. */
    /**
     * Garment patterns name their sizes rather than number them, and which names depends on how many
     * there are: three are S/M/L, five open at XS, and anything past XL climbs the 2X/3X ladder. The
     * sets below are the conventional runs for each count, so "Size 2" only appears for a grading
     * longer than the standard ladder, where a name would be a guess.
     */
    const SIZE_NAME_SETS = {
        2: ['Small', 'Large'],
        3: ['Small', 'Medium', 'Large'],
        4: ['Small', 'Medium', 'Large', 'X-Large'],
        5: ['X-Small', 'Small', 'Medium', 'Large', 'X-Large'],
        6: ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X-Large'],
        7: ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X-Large', '3X-Large'],
        8: ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X-Large', '3X-Large', '4X-Large'],
        9: ['X-Small', 'Small', 'Medium', 'Large', 'X-Large', '2X-Large', '3X-Large', '4X-Large', '5X-Large']
    };

    /** Abbreviations shown beside the name, so "Ch 52 (56, 60)" maps to S (M, L) at a glance. */
    const SIZE_ABBREVIATIONS = {
        'X-Small': 'XS', 'Small': 'S', 'Medium': 'M', 'Large': 'L', 'X-Large': 'XL',
        '2X-Large': '2XL', '3X-Large': '3XL', '4X-Large': '4XL', '5X-Large': '5XL'
    };

    function sizeVariantNames(count) {
        const named = SIZE_NAME_SETS[count];
        if (!named) return Array.from({ length: count }, (_, i) => `Size ${i + 1}`);
        return named.map(name => {
            const abbr = SIZE_ABBREVIATIONS[name];
            return abbr ? `${name} (${abbr})` : name;
        });
    }

    /**
     * Whether the pattern is graded is not a question worth asking: a pattern writing "Ch 52 (56, 60)"
     * has said so. Only WHICH of the sizes to validate is a choice, and that picker appears once
     * there is something to choose between.
     *
     * There used to be a "Sizing" dropdown here as well, plus a sizeTypeManuallySet flag to stop
     * detection overwriting it on every keystroke. Both are gone: the dropdown's only remaining power
     * was to contradict the text.
     */
    function syncSizeOptions(rawText) {
        const detected = state.inferred ? state.inferred.sizeCount : 1;
        state.sizeCount = detected;
        if (state.sizeIndex >= detected) state.sizeIndex = 0;

        const select = UI['meta-size'];
        if (select) {
            select.innerHTML = sizeVariantNames(detected)
                .map((name, i) => `<option value="${i}"${i === state.sizeIndex ? ' selected' : ''}>${name}</option>`)
                .join('');
            select.value = String(state.sizeIndex);
        }
        applySizeTypeVisibility();
    }

    /** The "which size" picker is only meaningful once the pattern offers more than one. */
    function applySizeTypeVisibility() {
        UI['size-picker-group']?.classList.toggle('hidden', state.sizeCount <= 1);
    }

    /**
     * Presses Validate: paints a busy state, yields one frame, then does the work.
     *
     * The yield is the whole trick and it is not optional. evaluatePatternRows is synchronous, so
     * setting the flag and parsing in the same tick paints nothing at all - the browser never gets a
     * frame between the two, and the spinner appears and vanishes inside one blocked frame. Measured
     * on a fast desktop: 100 rows 438ms, 300 rows 1081ms, 600 rows 2024ms, and roughly triple that on a
     * mid-range phone. Past a second, someone needs to know the app is alive.
     *
     * The honest limit, stated because it will look like a bug otherwise: the spinner does not animate
     * during the parse, because the thread that would animate it is the thread doing the parsing. It
     * appears, freezes, and goes. Making it actually spin means moving the parse to a worker, which is
     * a much larger change than this one.
     *
     * aria-busy goes on the results region rather than the button, because it is the region whose
     * contents are about to be replaced - and it pairs with the live region that announces the result,
     * so a reader is told the work started and then told what it found.
     */
    function validateWithBusyState() {
        const btn = UI['bulk-parse-btn'];
        const results = UI['cumulative-status'];
        if (btn) btn.classList.add('is-busy');
        if (results) results.setAttribute('aria-busy', 'true');

        const finish = () => {
            try { handleBulkSubmit(); }
            finally {
                if (btn) btn.classList.remove('is-busy');
                if (results) results.setAttribute('aria-busy', 'false');
            }
        };

        // rAF where there is one, a timeout otherwise. Both runners supply a synchronous setTimeout,
        // so under test this stays a straight-through call and the suites see no change in behaviour.
        if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(finish);
        else if (typeof setTimeout === 'function') setTimeout(finish, 0);
        else finish();
    }

    /**
     * The blank canvas, answered.
     *
     * A beginner opening Stitch Math gets an empty textarea and no indication that a pattern is
     * expected to state a hook, a yarn, a gauge and a key to its abbreviations before anybody else can
     * work it. These four skeletons are the shortest honest example of each common shape, and each one
     * OPENS WITH THAT FRONT MATTER - the skeleton demonstrates what requiredElements asks for rather
     * than merely satisfying it, so the structure is learned by having it in front of you rather than
     * by being told off for its absence.
     *
     * Every one of these is checked by tests/test-templates.js: loaded through the same button the
     * user presses, each must produce zero failing rows AND a complete required-elements set. A
     * skeleton that does not validate would teach the wrong lesson twice over - once about the shape
     * and once about whether the checker can be trusted - so that suite is the real specification for
     * this table and the numbers below are not to be edited without running it.
     */
    /**
     * The front matter every round template opens with. Lifted out because the stacked and seamless
     * versions of a shape differ ONLY in how their increases are distributed - if the two carried
     * separate copies of the hook, yarn, gauge and abbreviations, a change to one would silently make
     * the pair differ in something that has nothing to do with the strategy being demonstrated.
     */
    const AMIGURUMI_FRONT_MATTER = [
        'Hook: 3.5mm (E/4), or size needed to obtain gauge',
        'Yarn: Worsted Weight (Category 4), approx. 100 yards',
        'Gauge: 16 sc x 18 rows = 4 in.',
        '',
        'Abbreviations',
        'ch = chain',
        'sc = single crochet',
        'inc = increase (2 sc in the same stitch)',
        'dec = decrease (2 sc worked together)',
        ''
    ];

    const BEANIE_FRONT_MATTER = [
        'Hook: 5.5mm (I/9), or size needed to obtain gauge',
        'Yarn: Worsted Weight (Category 4), approx. 220 yards',
        'Gauge: 12 dc x 7 rows = 4 in.',
        '',
        'Abbreviations',
        'ch = chain',
        'dc = double crochet',
        'dc-inc = double crochet increase (2 dc in the same stitch)',
        'sl st = slip stitch',
        ''
    ];

    /*
     * STACKED AND SEAMLESS, OFFERED AS PAIRS.
     *
     * A rounded piece can distribute its increases two ways, and the choice is visible in the finished
     * object rather than in any number:
     *
     *   stacked   [2 sc, inc] x 6                    every increase in the same position each round,
     *                                                so six columns run radially and the circle
     *                                                creases along them - it comes out a hexagon.
     *   seamless  sc, inc, [2 sc, inc] x 5, sc       one base run split across the round boundary,
     *                                                which rotates the column and spreads the tension.
     *
     * The two are ARITHMETICALLY IDENTICAL - same six increases, same 6k plain stitches, same cost and
     * yield - so no amount of validation can prefer one, and neither is a mistake. That is exactly why
     * they are offered as pairs: the difference is a design decision, and the only honest way to teach
     * it is to let someone insert both and look at the two.
     *
     * BRACKET SHORTHAND, NOT PROSE.
     *
     * Every row is written the way the editor's own help text writes it - "[sc, inc] x 6 (18)" - and
     * never as "single crochet in the next stitch, then two single crochet in the next stitch, repeat
     * around". The skeletons are a base for kitbashing: a designer copies one in, changes a repeat
     * count, swaps a stitch, splices the crown of one onto the sides of another. Prose would have to
     * be re-read and re-typed to do any of that; a bracket line is edited in place. And a beginner
     * who is given the repeat rather than its expansion still has to work out what the repeat does,
     * which is the exercise. The notation is uniform across all eight ("[...] x N", "MR", "around",
     * "join with sl st") so that any row from any skeleton can be dropped into any other.
     *
     * Titles are CAPS ("SPHERE", "CROWN") because that is what the editor reads as the start of a new
     * piece - a title-case line is just a note, and the rows under it would be measured against the
     * piece before. Alone, a skeleton never notices; under another one, the scarf's foundation chain
     * was failing for leaving the beanie's 48 stitches unworked.
     *
     * Each is kept as `front` (hook, yarn, gauge, key) and `body` (title and rows) because the picker
     * offers two ways in: REPLACE the editor, which takes the whole thing, and APPEND to what is
     * there, which takes only the body - a second "Hook:" line under a pattern that already has one
     * would be exactly the noise kitbashing is meant to avoid. `text` is the two joined, and is what
     * the tests and the replace path read.
     */
    const PATTERN_TEMPLATES = [
        {
            id: 'circle-stacked',
            name: 'Flat Circle (stacked)',
            blurb: 'Increases pile up in six columns, so the disc reads as a hexagon. Choose it when you want visible structure — or to see what staggering fixes.',
            front: AMIGURUMI_FRONT_MATTER,
            body: [
                'FLAT CIRCLE',
                'Rnd 1: 6 sc in MR (6)',
                'Rnd 2: inc x 6 (12)',
                'Rnd 3: [sc, inc] x 6 (18)',
                'Rnd 4: [2 sc, inc] x 6 (24)',
                'Rnd 5: [3 sc, inc] x 6 (30)',
                'Rnd 6: [4 sc, inc] x 6 (36)'
            ]
        },
        {
            id: 'circle-seamless',
            name: 'Flat Circle (seamless)',
            blurb: 'The same stitch counts, round for round — but each even round splits its first run across the join, rotating the increases so the disc lies flat and smooth.',
            front: AMIGURUMI_FRONT_MATTER,
            body: [
                'FLAT CIRCLE',
                'Rnd 1: 6 sc in MR (6)',
                'Rnd 2: inc x 6 (12)',
                'Rnd 3: [sc, inc] x 6 (18)',
                'Rnd 4: sc, inc, [2 sc, inc] x 5, sc (24)',
                'Rnd 5: [3 sc, inc] x 6 (30)',
                'Rnd 6: 2 sc, inc, [4 sc, inc] x 5, 2 sc (36)'
            ]
        },
        {
            id: 'sphere-stacked',
            name: 'Amigurumi Sphere (stacked)',
            blurb: 'Continuous rounds from a magic ring: increase to the middle, straight sides, decrease away. Increases and decreases both stack, so the shape has six soft facets.',
            front: AMIGURUMI_FRONT_MATTER,
            body: [
                'SPHERE',
                'Rnd 1: 6 sc in MR (6)',
                'Rnd 2: inc x 6 (12)',
                'Rnd 3: [sc, inc] x 6 (18)',
                'Rnd 4: [2 sc, inc] x 6 (24)',
                'Rnd 5-8: sc around (24)',
                'Rnd 9: [2 sc, dec] x 6 (18)',
                'Rnd 10: [sc, dec] x 6 (12)',
                'Rnd 11: dec x 6 (6)'
            ]
        },
        {
            id: 'sphere-seamless',
            name: 'Amigurumi Sphere (seamless)',
            blurb: 'Identical counts to the stacked sphere, with the shaping rotated on the even rounds — the version to use when the seam would show through stuffing.',
            front: AMIGURUMI_FRONT_MATTER,
            body: [
                'SPHERE',
                'Rnd 1: 6 sc in MR (6)',
                'Rnd 2: inc x 6 (12)',
                'Rnd 3: [sc, inc] x 6 (18)',
                'Rnd 4: sc, inc, [2 sc, inc] x 5, sc (24)',
                'Rnd 5-8: sc around (24)',
                'Rnd 9: [2 sc, dec] x 6 (18)',
                // k=1, so the prefix has no plain stitches before its decrease and the whole base run
                // moves to the suffix. Still exactly six decreases over 18 stitches.
                'Rnd 10: dec, [sc, dec] x 5, sc (12)',
                'Rnd 11: dec x 6 (6)'
            ]
        },
        {
            id: 'beanie-stacked',
            name: 'Top-Down Beanie (stacked crown)',
            blurb: 'A flat circle crown increased to size, then worked straight down the sides. Joined rounds, with the crown increases stacked.',
            // The "does not count as st" convention rather than a ch-3 that stands in for the first dc:
            // both are correct and published, but only one of them leaves a beginner's arithmetic doing
            // what it looks like it does. The parenthetical is the shortest form the engine reads as
            // "this chain makes nothing" - a bare "ch 2" is counted, and the count is then two over on
            // every round.
            front: BEANIE_FRONT_MATTER,
            body: [
                'CROWN',
                'Rnd 1: ch 2 (does not count as st), 12 dc in MR, join with sl st (12)',
                'Rnd 2: ch 2 (does not count as st), dc-inc x 12, join with sl st (24)',
                'Rnd 3: ch 2 (does not count as st), [dc, dc-inc] x 12, join with sl st (36)',
                'Rnd 4: ch 2 (does not count as st), [2 dc, dc-inc] x 12, join with sl st (48)',
                'Rnd 5-12: ch 2 (does not count as st), dc around, join with sl st (48)'
            ]
        },
        {
            id: 'beanie-seamless',
            name: 'Top-Down Beanie (seamless crown)',
            blurb: 'The same crown, with the last increase round rotated so the increase columns do not read as ridges under a close-fitting hat.',
            front: BEANIE_FRONT_MATTER,
            body: [
                'CROWN',
                'Rnd 1: ch 2 (does not count as st), 12 dc in MR, join with sl st (12)',
                'Rnd 2: ch 2 (does not count as st), dc-inc x 12, join with sl st (24)',
                'Rnd 3: ch 2 (does not count as st), [dc, dc-inc] x 12, join with sl st (36)',
                // Twelve repeats rather than six, so the core runs 11 times and the split run is one dc
                // on each side. The ch 2 and the joining sl st cost nothing, so they are not what makes
                // this round read as offset - the dc either side of the repeat is.
                'Rnd 4: ch 2 (does not count as st), dc, dc-inc, [2 dc, dc-inc] x 11, dc, join with sl st (48)',
                'Rnd 5-12: ch 2 (does not count as st), dc around, join with sl st (48)'
            ]
        },
        {
            id: 'scarf',
            name: 'Flat Scarf',
            blurb: 'Rows worked back and forth on a foundation chain. The simplest shape there is, and the one that teaches turning chains.',
            front: [
                'Hook: 5.0mm (H/8), or size needed to obtain gauge',
                'Yarn: Worsted Weight (Category 4), approx. 350 yards',
                'Gauge: 13 hdc x 10 rows = 4 in.',
                '',
                'Abbreviations',
                'ch = chain',
                'hdc = half double crochet',
                ''
            ],
            body: [
                'SCARF',
                'Row 1: ch 26',
                // "in each ch across" rather than "across": the engine reads the shorter form as
                // consuming the whole 26-chain foundation, turning chain included, and the row comes
                // out two over.
                'Row 2: hdc in 3rd ch from hook, hdc in each ch across (24)',
                'Row 3-80: ch 2, turn, hdc across (24)'
            ]
        },
        {
            id: 'granny',
            name: 'Granny Square',
            // A granny square states its counts in double crochets and leaves out the chains that form
            // its corner and side spaces, which is the "discount" reading. Declared here and applied on
            // insert, so the template arrives with the app set to the convention it was written in
            // rather than showing a fourteen-stitch discrepancy the reader has to diagnose. The control
            // visibly changes, so nothing is done behind the designer's back.
            chainSpace: 'discount',
            blurb: 'Five rounds of clusters worked into chain spaces rather than into stitches. Grows by exactly four clusters a round — 4, 8, 12, 16, 20 — which is what keeps it square.',
            // Each round after the first is one repeat: a corner, then the side clusters between it and
            // the next corner, x 3 - with the last side's clusters written out ahead of the repeat,
            // because the round opened in the middle of a corner. The side count is the only number
            // that changes from round to round, which is exactly the number a designer editing the
            // square wants to find in one place.
            front: [
                'Hook: 4.0mm (G/6), or size needed to obtain gauge',
                'Yarn: Worsted Weight (Category 4), approx. 60 yards',
                'Gauge: 14 dc x 7 rows = 4 in.',
                '',
                'Abbreviations',
                'ch = chain',
                'dc = double crochet',
                'sl st = slip stitch',
                ''
            ],
            // The note travels with the rows, not the front matter: appended under another pattern
            // the square still counts the discount way, and the line is what says so.
            body: [
                'GRANNY SQUARE',
                'Note: counts are double crochets only, and do not include the corner and side chains.',
                'Note: set "Chain-Sp Counts As" to "only the stitches worked into it" to check them.',
                'Rnd 1: ch 4, sl st to form ring, ch 3, 2 dc in ring, [ch 2, 3 dc in ring] x 3, ch 2, join with sl st to top of ch-3 (12)',
                'Rnd 2: sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp] x 3, ch 1, join with sl st to top of ch-3 (24)',
                'Rnd 3: sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, ch 1, 3 dc in next ch-1 sp, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp, ch 1, 3 dc in next ch-1 sp] x 3, ch 1, join with sl st to top of ch-3 (36)',
                'Rnd 4: sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, 3 dc in next ch-1 sp] x 2, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp, [ch 1, 3 dc in next ch-1 sp] x 2] x 3, ch 1, join with sl st to top of ch-3 (48)',
                'Rnd 5: sl st to ch-2 sp, ch 3, [2 dc, ch 2, 3 dc] in same sp, [ch 1, 3 dc in next ch-1 sp] x 3, [ch 1, [3 dc, ch 2, 3 dc] in next ch-2 sp, [ch 1, 3 dc in next ch-1 sp] x 3] x 3, ch 1, join with sl st to top of ch-3 (60)'
            ]
        }
    ].map(template => ({ ...template, text: template.front.concat(template.body).join('\n') }));

    /**
     * Drops a skeleton into the editor and validates it, so the first thing a beginner sees is a green
     * badge over a pattern that is structured correctly rather than an empty box.
     *
     * Existing work is confirmed first, through the confirm the rest of the app already uses. This is
     * the one control in the Studio that destroys text outright, and a template picker that silently
     * ate forty rows would be the worst button in the application. The same question offers the
     * other answer: APPEND the skeleton's rows under what is there, which is how a sphere gets bolted
     * onto a beanie. Only the rows go in - the front matter is the editor's own, already.
     */
    function insertTemplate(id) {
        const template = PATTERN_TEMPLATES.find(t => t.id === id);
        const box = UI['bulk-input'];
        if (!template || !box) return;

        const apply = (mode) => {
            const current = String(box.value || '');
            box.value = mode === 'append' && current.trim()
                ? current.replace(/\s+$/, '') + '\n\n' + template.body.join('\n')
                : template.text;
            // Before the parse, not after: the convention decides what every round of the pattern
            // counts, so applying it afterwards would validate once against the wrong reading.
            if (template.chainSpace && UI['meta-chain-space-convention']) {
                UI['meta-chain-space-convention'].value = template.chainSpace;
                window.CrochetMathEngine.setChainSpaceConvention(template.chainSpace);
                syncMetadataToGauge();
            }
            handleBulkSubmit();
            notify(mode === 'append'
                ? `Appended the ${template.name} rows to the pattern.`
                : `Inserted the ${template.name} template.`, 'success');
        };

        if (String(box.value || '').trim()) {
            askConfirm(`Replace the pattern in the editor with the ${template.name} template, or append `
                + `its rows below what is there? Replacing loses the current pattern; appending adds `
                + `the rows only, without a second hook, yarn or gauge line.`,
                () => apply('replace'),
                { confirmLabel: 'Replace', altLabel: 'Append', onAlt: () => apply('append') });
            return;
        }
        apply('replace');
    }

    /** One button per skeleton, built rather than written as markup so the blurb and the handler come
     *  from the same table the tests read. */
    function renderTemplatePicker() {
        const host = UI['template-list'];
        if (!host) return;
        host.replaceChildren();
        PATTERN_TEMPLATES.forEach(template => {
            const row = elem('div', 'template-row');
            const text = elem('div', 'template-text');
            text.append(elem('strong', null, template.name), elem('p', 'template-blurb', template.blurb));
            row.append(text, button('row-button is-primary is-small', 'Insert',
                `template-insert-${template.id}`, () => insertTemplate(template.id)));
            host.appendChild(row);
        });
    }

    function handleBulkSubmit() {
        const rawText = UI['bulk-input'].value.trim();
        state.patternSteps.length = 0;
        // One pass over the raw text for everything that used to be a form control: sizing,
        // construction and the foundation skip. Everything downstream reads state.inferred, so the
        // whole document is interpreted one way rather than each consumer asking the DOM separately.
        state.inferred = rawText ? window.CrochetMathEngine.inferPatternSettings(rawText) : null;
        if (!rawText) { syncSizeOptions(''); renderUI(); return; }

        syncSizeOptions(rawText);
        buildPatternSteps(rawText);
        renderUI();
    }

    /** Reads one line of a documentation block for whatever it can give the rest of the app, and
     *  returns why it is not being validated. The line is shown either way. */
    /**
     * The metadata fields a pattern states in its own front matter. Every one had a box in the Pattern
     * Metadata panel and no way to fill it but by typing, so a pattern that opened by naming its hook,
     * yarn and skill level arrived with all three empty and the printout said nothing about any of them.
     *
     * A field the user has filled is never overwritten, on the same principle applyGaugeStatement
     * follows: what they typed is a decision, what the paste says is a suggestion. Returns a description
     * of what was taken, for the note's tooltip, so nothing is filed invisibly.
     */
    function applyMetadataStatement(meta) {
        const taken = [];

        const setText = (id, value, name) => {
            if (!value || !UI[id] || String(UI[id].value).trim() !== '') return;
            UI[id].value = value;
            state.metadata[name] = value;
            taken.push(name);
        };

        setText('meta-designer', meta.designer, 'designer');
        setText('meta-hook', meta.hook, 'hook');
        setText('meta-yarn-weight', meta.yarnWeight, 'yarnWeight');

        // The difficulty dropdown is normally driven by the complexity calculator. A level the designer
        // printed is a stated fact rather than an estimate, so it takes the field and holds it, exactly
        // as a level the user picked would.
        if (meta.difficulty && UI['meta-difficulty'] && !UI['meta-difficulty'].value) {
            UI['meta-difficulty'].value = meta.difficulty;
            state.metadata.difficulty = meta.difficulty;
            state.difficultyManuallySet = true;
            taken.push('difficulty');
        }

        if (taken.length) renderPrintArea();
        return taken;
    }

    // Working out what the pattern is built in moved to the engine as
    // CrochetMathEngine.inferConstruction, called once per parse from handleBulkSubmit. The version
    // here could only ever answer "Rounds" - it filled a blank dropdown and left a flat pattern on
    // the blank option forever, which is most of why the dropdown still looked necessary.

    /**
     * A front-matter line that states something about the pattern rather than working it. Tried on every
     * note, in a documentation block or not: a self-published pattern runs its specifications, gauge and
     * abbreviations together under one heading or none, so which block a line lands in says nothing
     * about whether it is one of these. Returns why it was kept, or null if it is just text.
     */
    function harvestFrontMatterLine(line, underGaugeHeading = false) {
        const meta = window.CrochetMathEngine.parseMetadataStatement(line);
        if (meta) {
            const taken = applyMetadataStatement(meta);
            if (taken.length) return `read into Pattern Info — ${taken.join(', ')}`;
        }

        // Under a GAUGE heading the statement is the whole line and never repeats the word: "9 hdc + 8
        // rows = about 4 in." is what the block is for. Elsewhere the line has to say so itself, or any
        // row with an "=" in it would be read as one.
        if (underGaugeHeading || (meta && meta.gauge) || /\bgauge\b/i.test(line)) {
            const gauge = window.CrochetMathEngine.parseGaugeStatement(line);
            if (gauge && applyGaugeStatement(gauge)) return 'gauge — read into the gauge calculator';
        }

        return meta ? 'pattern info' : null;
    }

    function harvestDocumentationLine(docBlock, line, abbreviations) {
        const frontMatter = harvestFrontMatterLine(line, docBlock === 'gauge');
        if (frontMatter) return frontMatter;
        if (docBlock === 'gauge') return 'gauge';

        const entry = window.CrochetMathEngine.parseAbbreviationEntry(line);
        // A term the engine already counts needs nothing; one it does not is a candidate, held until the
        // end to see whether any row actually uses it.
        if (entry && !window.CrochetMathEngine.isKnownStitch(entry.term)) {
            abbreviations[entry.term.toLowerCase()] = entry.definition;
            return `defines "${entry.term}"`;
        }
        return 'stitch definition';
    }

    /**
     * Files the terms a pattern defined for itself, but only the ones its rows turned out
     * to need. An abbreviation list is mostly words - "beg = begin(ning)", "rep = repeat" -
     * and filing those as stitches would fill the dictionary with things that are not
     * stitches. A term earns its entry by appearing in a row the engine could not read.
     *
     * Cost and yield are left empty on purpose. They cannot be known from a definition,
     * and a guess would be a wrong count presented as a right one; an entry without them
     * is not registered with the engine, so the row still fails and still names the term -
     * now with a dictionary row waiting that only needs two numbers.
     */
    function fileHarvestedAbbreviations(abbreviations) {
        const terms = Object.keys(abbreviations);
        if (!terms.length) return;

        const unreadable = new Set();
        workedSteps().forEach(step => {
            const parsed = window.CrochetMathEngine.parseInstructions(step.instructionString || '');
            (parsed.unknownTokens || []).forEach(token => {
                terms.forEach(term => { if (new RegExp(`\\b${term}\\b`, 'i').test(token)) unreadable.add(term); });
            });
        });
        if (!unreadable.size) return;

        let added = false;
        updateLocalStorage(state.savedStitchesKey, saved => {
            unreadable.forEach(term => {
                if (saved[term]) return;
                saved[term] = { cost: null, yield: null, def: abbreviations[term], needsReview: true };
                added = true;
            });
            if (!added) return false;
        });
        if (!added) return;

        renderCustomStitchUI();
    }

    /** Parses raw text into state.patternSteps at the currently selected size. */
    function buildPatternSteps(rawText) {
        const lines = splitPatternLines(rawText);
        // Terms the pattern defines for itself. Collected while walking the document and filed at the
        // end, once it is known which of them the rows actually needed.
        const abbreviations = {};
        let docBlock = null;
        // The pattern stitch being defined, if the walk is inside a PATTERN STITCH block.
        window.CrochetMathEngine.clearPatternStitches();
        let patternStitch = null;
        let inPatternStitchBlock = false;
        const closePatternStitch = () => {
            if (patternStitch) registerPatternStitch(patternStitch);
            patternStitch = null;
        };
        // Which raw textarea line the walk is on. Held here rather than passed to pushMarkerStep at
        // each of its call sites, so a marker cannot be pushed without one - a step with no lineIndex
        // is a finding the linter can never point at.
        let sourceLineIndex = 0;

        // A line kept in the step list but never evaluated - a section title, or a note. It holds its
        // place in the matrix and survives the round-trip back to the textarea, so it carries the same
        // inert instruction fields every step is read for; `extra` says which kind of marker it is.
        const pushMarkerStep = (line, extra) => {
            state.patternSteps.push({
                initialChain: 0, instructionString: '', multiplier: 1, expectedYield: 0,
                sourceLine: line, lineIndex: sourceLineIndex,
                ...extra
            });
        };

        lines.forEach(({ text: line, lineIndex }) => {
            sourceLineIndex = lineIndex;
            // A section title is a marker, not work. Kept in the step list so it holds its place in the
            // matrix and survives the round-trip, but never evaluated and never counted.
            const classified = window.CrochetMathEngine.classifyPatternLine(line);

            // A documentation block ends the moment the pattern starts working again. Without this it
            // would run to the next section heading, and a pattern whose front matter is not followed by
            // one - most of them - would have every row after "Abbreviations" filed as a note and never
            // checked. startsWorkSection is the signal: a numbered row, or a foundation chain, which is
            // how the piece under the notes usually opens and carries no row number.
            if (docBlock && (classified.kind === 'section' || window.CrochetMathEngine.startsWorkSection(line))) {
                docBlock = null;
            }

            // "Abbreviations", "Gauge", "Pattern Notes" on a line of their own. These are not section
            // headings by the classifier's rules - no capitals, no colon, no dashes - so documentationBlock
            // was never reached for them, and the block that exists to keep an abbreviation list from
            // being validated as rows could not fire. Every entry became a row of its own.
            if (!docBlock && classified.kind !== 'section') {
                const heading = window.CrochetMathEngine.documentationHeading(line);
                if (heading) {
                    docBlock = heading;
                    closePatternStitch();
                    pushMarkerStep(line, {
                        isNote: true, noteText: line, noteReason: `${heading} block — not validated`
                    });
                    return;
                }
            }

            if (classified.kind === 'section') {
                docBlock = window.CrochetMathEngine.documentationBlock(classified.title);
                closePatternStitch();
                inPatternStitchBlock = /^pattern\s+stitch(?:es)?$/i.test(classified.title);
                pushMarkerStep(line, { isSection: true, sectionTitle: classified.title });
                return;
            }

            // Inside a GAUGE or ABBREVIATIONS block. Written in the vocabulary of stitches but
            // describing them rather than working them, so the block is read for what it can give the
            // rest of the app and then set aside.
            if (docBlock) {
                pushMarkerStep(line, {
                    isNote: true, noteText: line,
                    noteReason: harvestDocumentationLine(docBlock, line, abbreviations)
                });
                return;
            }

            // Inside a PATTERN STITCH block. These read as rows, but they are the definition of a
            // repeat rather than a piece being worked - there is no foundation under them and never will
            // be - so they go to the dictionary as a named stitch and stand in the matrix as notes.
            if (inPatternStitchBlock) {
                const named = window.CrochetMathEngine.parsePatternStitchName(line);
                if (named) {
                    closePatternStitch();
                    patternStitch = { ...named, rows: [] };
                } else if (patternStitch) {
                    patternStitch.rows.push(line);
                }
                pushMarkerStep(line, {
                    isNote: true, noteText: line,
                    noteReason: patternStitch ? `defines ${patternStitch.name}` : 'pattern stitch'
                });
                return;
            }

            // Text that makes no fabric - assembly, marker reminders, the copyright line. Kept where it
            // was written so nothing pasted disappears, but never evaluated, so it cannot fail and
            // cannot block the rows under it.
            if (classified.kind === 'note') {
                pushMarkerStep(line, {
                    isNote: true, noteText: line,
                    // A pattern that never writes the word "Abbreviations" still states its hook and
                    // gauge somewhere near the top, so the front-matter readers get a look at every
                    // note, not only the ones under a heading.
                    noteReason: harvestFrontMatterLine(line) || classified.why
                });
                return;
            }

            // First-row handling is per section, so a later piece's foundation chain is recognised as a
            // foundation rather than measured against the piece before it. Notes are skipped when
            // looking back: a "Continue in Stripe Sequence" line between the heading and the first row
            // must not make the row look like it is mid-piece.
            const lastReal = [...state.patternSteps].reverse().find(s => !s.isNote);
            const isFirstOfSection = !state.patternSteps.some(s => !s.isSection && !s.isNote)
                || lastReal?.isSection === true;
            const step = parsePatternLine(line, isFirstOfSection);
            for (let i = 0; i < step.rowsToGenerate; i++) {
                const constStyle = inferredConstruction();
                const labelPrefix = labelPrefixFor(constStyle);
                state.patternSteps.push({
                    initialChain: (i === 0) ? step.initialChain : 0,
                    instructionString: step.instructionString,
                    multiplier: step.multiplier,
                    expectedYield: step.expectedYield,
                    // The row number this generated row's own label states, if any - "Rows 3-7" produces
                    // five steps numbered 3 through 7. Read by evaluatePatternRows to restart row
                    // numbering when a later row restates 1, without re-parsing instructionString, which
                    // has already had the label text removed by this point.
                    rangeStartRow: step.rangeStartRow === null ? null : step.rangeStartRow + i,
                    // "Rows 3-7" is one line that becomes five steps, and all five point back at it.
                    // A fix accepted on any of them rewrites the one line that produced them all.
                    lineIndex,
                    // Range rows have no single original line, so rebuild one. The multiplier has to go
                    // back in: extractMultiplier already moved it out of instructionString, and without
                    // it both this and syncBulkInput would silently drop the "x N" from a range row.
                    sourceLine: step.rangeStartRow === null
                            ? step.originalLine
                            : `${labelPrefix} ${step.rangeStartRow + i}: ${step.instructionString}${step.multiplier > 1 ? ` x ${step.multiplier}` : ''}${step.expectedYield > 0 ? ` (${step.expectedYield})` : ''}`
                });
            }
        });

        closePatternStitch();
        fileHarvestedAbbreviations(abbreviations);
    }

    /**
     * Files a pattern stitch the document defined for itself, so "work in Ripple pattern as established
     * over next 60 sts" can be counted at all.
     *
     * The repeat is taken from the block's own rows: the text between the asterisks is the unit, and
     * pricing it turns a name into a number. It goes into the custom stitch dictionary too, with the
     * rows it was read from as its definition, so the user can see what the app thinks - and correct it.
     */
    function registerPatternStitch(collected) {
        const bodies = collected.rows
            .map(row => (row.match(/\*(.+?);\s*rep(?:eat)?\s+from\s+\*/i) || [])[1])
            .filter(Boolean);
        if (!bodies.length) return;

        // The last row that states the repeat is the one worked for the rest of the piece: a first row
        // worked into the foundation chain says the same thing in chains, and every row after it in
        // stitches.
        const body = bodies[bodies.length - 1].trim();
        const result = window.CrochetMathEngine.addPatternStitch(collected.name, body, { multiple: collected.multiple });

        const key = collected.name.toLowerCase();
        updateLocalStorage(state.savedStitchesKey, saved => {
            saved[key] = result.success
                ? { cost: result.cost, yield: result.yield, def: collected.rows.join(' '), isPattern: true }
                // Registration only fails when the pattern's own two figures disagree. Saving it unpriced
                // keeps the disagreement in front of the user instead of settling it silently, and
                // leaves the rows that use it failing, which they should.
                : { cost: null, yield: null, def: result.message, needsReview: true, isPattern: true };
        });
        renderCustomStitchUI();
    }

    /**
     * Re-parses and re-evaluates the pattern at one of its other sizes. The size numbers are substituted
     * away during parsing and cannot be recovered from the steps, so the only way to see another size is
     * to build it again from the raw text. The live steps and selected size are swapped out and
     * restored, so nothing the user is looking at moves.
     */
    /** The CYC weight number behind the dropdown's label, defaulting to worsted. Both the whole-pattern
     *  report and the per-size effort estimate need it, and they were parsing the same field twice. */
    function yarnWeightNumber() {
        const parsed = parseInt(UI["meta-yarn-weight"]?.value, 10);
        return Number.isNaN(parsed) ? 4 : parsed;
    }

    function evaluateAtSize(rawText, sizeIndex) {
        const savedSteps = state.patternSteps;
        const savedIndex = state.sizeIndex;
        state.patternSteps = [];
        state.sizeIndex = sizeIndex;
        try {
            buildPatternSteps(rawText);
            // The pass carries the steps it was built from, which matters here: yarn and time for a
            // size have to come from the stitches that size actually works, and state.patternSteps is
            // swapped back below. Scaling the sample's yardage by bust circumference gets the
            // direction right and the amount wrong, because yarn goes as area.
            return evaluatePatternRows();
        } finally {
            state.patternSteps = savedSteps;
            state.sizeIndex = savedIndex;
        }
    }

    // Grading costs a full re-parse per size, and computePatternHealth runs on every render - including
    // view toggles that cannot change the answer. Measured at ~55 ms per size on a 60-row pattern, so a
    // four-size pattern paid a fifth of a second to recompute an identical result. Keyed on everything
    // the counts depend on, so a stale answer is not possible.
    let gradingCache = { key: null, value: null };

    function gradingCacheKey(rawText) {
        return [
            rawText,
            state.sizeCount,
            // What the counts actually depend on, read straight from the engine.
            window.CrochetMathEngine.getRepeatConvention(),
            inferredSkip(),
            JSON.stringify(window.CrochetMathEngine.CUSTOM_STITCHES || {}),
            // The efforts on the cached result depend on these too.
            yarnWeightNumber(),
            JSON.stringify(sampleYarn())
        ].join('\u0000');
    }

    /** Measures every size a multi-size pattern offers, so the grading between them can be checked.
     *  Reported in stitches rather than inches because grading is wrong or right regardless of whether
     *  a gauge has been entered. */
    function computeSizeGrading() {
        if (state.sizeCount < 2) return null;
        const rawText = UI['bulk-input']?.value.trim();
        if (!rawText) return null;

        const key = gradingCacheKey(rawText);
        if (gradingCache.key === key) return gradingCache.value;

        const names = sizeVariantNames(state.sizeCount);
        const sizes = [];
        const reports = [];
        const efforts = [];
        const sample = sampleYarn();
        for (let i = 0; i < state.sizeCount; i++) {
            const pass = evaluateAtSize(rawText, i);
            const widest = window.CrochetAnalyticsEngine.WidestFabricRow(pass.validation.rows);
            sizes.push({
                label: names[i],
                stitches: widest ? widest.stitches : null,
                allValid: pass.validation.allStepsValid
            });
            // The same pass, totalled. Collected here rather than in a second loop: re-parsing every
            // size costs about 55 ms each, and the numbers the per-size report needs are already sitting
            // on the rows this pass produced.
            reports.push(window.CrochetAnalyticsEngine.CompileSizeReport({
                label: names[i], rows: pass.validation.rows
            }));
            efforts.push(window.CrochetAnalyticsEngine.EstimateSizeEffort({
                label: names[i],
                stitchTotals: window.CrochetAnalyticsEngine.AggregateStitchCounts(pass.validation.steps || [], pass.validation.rows),
                yarnWeightCategory: yarnWeightNumber(),
                yardsPerStitch: sample ? sample.yardsPerStitch : null,
                skeinYards: sample ? sample.skeinYards : null
            }));
        }
        sizes.reports = reports;
        sizes.efforts = window.CrochetAnalyticsEngine.CompareSizeEffort({
            efforts, baseLabel: names[0]
        });
        gradingCache = { key, value: sizes };
        return sizes;
    }

    /** The compiled totals for every size the pattern writes, or null for a single size. */
    function sizeReports() {
        const sizes = computeSizeGrading();
        return sizes ? sizes.reports : null;
    }

    // === 7. EXPORTS & RENDER ENGINE === //
    // Mirrors the patterns extractRowRange and extractExpectedYield strip off, so the export can re-add
    // its own row label and the calculated count.
    const ROW_LABEL_RE = /^(?:Rows?|Rnds?|Rounds?|R)\s*\d+(?:\s*-\s*\d+)?\s*[:.\-]?\s*|^\d+[:.\-]\s*/i;
    const TRAILING_COUNT_RE = /[\(\[]\s*\d+(?:\s+[a-zA-Z\s]+)?\s*[\)\]]\s*$/;

    /**
     * The row exactly as the user typed it. Parsing splits a line into pieces - preprocessTurningChain
     * removes "ch 1, turn," and extractMultiplier removes the trailing "x 6" - so instructionString
     * alone would export a row that no longer matches what was written. sourceLine keeps the original,
     * which is also what the bulk textarea round-trips from.
     */
    function exportRowText(step) {
        const source = step.sourceLine || step.originalLine;
        if (source) {
            const stripped = String(source).replace(ROW_LABEL_RE, '').replace(TRAILING_COUNT_RE, '').trim();
            if (stripped) {
                // A multiplier set from the single-row form never appears in the typed text, so add it
                // only when it is not already there.
                const alreadyThere = new RegExp(`(?:x|times|rep)\\s*${step.multiplier}\\s*$`, 'i').test(stripped);
                return step.multiplier > 1 && !alreadyThere ? `${stripped} x ${step.multiplier}` : stripped;
            }
        }

        let text = stepInstructionText(step) || ('Chain ' + step.initialChain);
        if (step.multiplier > 1) text += ` x ${step.multiplier}`;
        return text;
    }

    /** Current swatch, as entered in the Yarn & Gauge Profile. Omitted if not measured. */
    /** Every export section closes with the same rule, so the file's shape cannot drift apart. */
    const EXPORT_RULE = '\n========================================\n\n';

    function buildGaugeSection() {
        readGaugeInputs();
        const g = state.gauge;
        if (!g.width || !g.height || !g.stitches || !g.rows) return '';

        // Gauge is conventionally quoted per 4 in / per 10 cm, so give both.
        const normal = g.unit === 'cm' ? 10 : 4;
        const stitchDensity = g.stitches / g.width;
        const rowDensity = g.rows / g.height;

        const lines = [
            `- Swatch: ${g.stitches} sts x ${g.rows} rows over ${g.width} x ${g.height} ${g.unit}`,
            `- Stitch Density: ${stitchDensity.toFixed(2)} sts per ${g.unit} (${(stitchDensity * normal).toFixed(2)} per ${normal} ${g.unit})`,
            `- Row Density: ${rowDensity.toFixed(2)} rows per ${g.unit} (${(rowDensity * normal).toFixed(2)} per ${normal} ${g.unit})`
        ];
        if (g.hookSize) lines.push(`- Hook / Needle: ${g.hookSize}`);
        if (g.yarnWeight) lines.push(`- Yarn Weight: ${g.yarnWeight}`);
        if (g.swatchWeight) lines.push(`- Swatch Weight: ${g.swatchWeight} ${g.swatchWeightUnit}`);
        if (g.notes) lines.push(`- Notes: ${g.notes}`);

        return `GAUGE & SWATCH:\n${lines.join('\n')}\n${EXPORT_RULE}`;
    }

    /** Finished measurements, and the CYC sizes they could be. Omitted without a gauge. */
    /**
     * The graded sizes, as the pattern will publish them: the sample size and its ease, the finished
     * measurement of every size, and how to choose. Present only once a chart has been graded - the
     * grader's own panels are empty until then, and so is this.
     */
    function buildGraderSection() {
        const garment = state.grading.lastGarment;
        if (!UI['grade-chart']?.value || !garment || !garment.length) return '';
        const labels = garment[0].sizes.map(cell => cell.size);
        const lines = sizingStatement(garment, labels, state.grading.baseSize).lines;
        if (!lines.length) return '';
        return `FINISHED SIZES:\n${lines.map(line => `- ${line}`).join('\n')}\n${EXPORT_RULE}`;
    }

    function buildSizingSection(pass) {
        if (!window.CrochetAnalyticsEngine) return '';
        const sizing = window.CrochetAnalyticsEngine.CalculateFinishedSize({
            rows: pass.validation.rows,
            gauge: state.gauge,
            category: state.gauge.sizingCategory,
            piece: state.gauge.sizingPiece
        });
        if (!sizing.available) return '';

        const label = (sizing.piece === 'half' || pass.validation.labelPrefix === 'Rnd') ? 'Circumference' : 'Width';

        const lines = [
            `- Widest ${pass.validation.labelPrefix === 'Rnd' ? 'round' : 'row'}: ${sizing.widestRow.label} (${sizing.widestRow.stitches} sts)`,
            `- ${label}: ${bothUnits(sizing.circumferenceInches)}`
        ];
        if (sizing.piece === 'half') lines.push(`  (${bothUnits(sizing.widthInches)} per panel, doubled for front and back)`);
        if (sizing.lengthInches !== null) lines.push(`- Length: ${bothUnits(sizing.lengthInches)} over ${sizing.rowsCounted} rows`);

        if (sizing.charted && sizing.outOfRange) {
            lines.push(`- ${sizing.circumferenceInches.toFixed(1)} in is outside the ${sizing.chartLabel} chart (${sizing.chartMin}-${sizing.chartMax} in)`);
        } else if (sizing.charted) {
            lines.push(`- CYC ${sizing.chartLabel} ${sizing.measureName} chart:`);
            sizing.matches.forEach(m => {
                const range = m.min === m.max ? `${m.min} in` : `${m.min}-${m.max} in`;
                const ease = sizing.usesEase
                    ? ` - ${m.easeLow} to ${m.easeHigh} in ease, ${m.band}`
                    : '';
                lines.push(`  - ${m.sizeLabel} (${range})${ease}`);
            });
        }

        return `GARMENT SIZE COMPARISON:\n${lines.join('\n')}\n${EXPORT_RULE}`;
    }

    /** Validation summary, then the rows that need attention and the counts that moved. */
    function buildValidationSection(pass) {
        const total = pass.validation.rows.length;
        if (!total) return '';
        const prefix = pass.validation.labelPrefix;

        const lines = [
            `- Status: ${pass.validation.allStepsValid ? 'VALID' : `${pass.analytics.failedRowsCount} ${prefix.toLowerCase()}${pass.analytics.failedRowsCount === 1 ? '' : 's'} to fix`}`,
            `- ${prefix}s Passed: ${pass.analytics.passedRowsCount} / ${total}`
        ];
        if (pass.analytics.blockedRowsCount) lines.push(`- ${prefix}s Blocked: ${pass.analytics.blockedRowsCount} (waiting on ${pass.validation.blockedByLabel})`);
        lines.push(`- Total Stitches: ${pass.analytics.totalStitchesAllRounds.toLocaleString()}`);
        lines.push(`- Total ${prefix}s: ${total}`);

        let section = `VALIDATION RESULTS:\n${lines.join('\n')}\n`;

        const problems = pass.validation.rows.filter(r => r.status !== 'valid');
        if (problems.length) {
            section += `\nIssues:\n`;
            problems.forEach(({ label, status, evaluation }) => {
                if (status === 'blocked') {
                    section += `- ${label}: blocked - fix ${pass.validation.blockedByLabel} first.\n`;
                    return;
                }
                section += `- ${label}: ${evaluation.reason.replace(/<br>\s*/g, ' ')}\n`;
                (evaluation.resolutions || []).forEach(fix => { section += `    Fix: ${fix}\n`; });
            });
        }

        // The written counts are advisory; say which ones the export replaced.
        const adjusted = pass.validation.rows.filter(r => r.step.expectedYield > 0 && r.step.expectedYield !== r.evaluation.calculatedYield);
        if (adjusted.length) {
            section += `\nCounts updated:\n`;
            adjusted.forEach(({ label, step, evaluation }) => {
                section += `- ${label}: written ${step.expectedYield}, calculated ${evaluation.calculatedYield}\n`;
            });
        }

        return `${section}${EXPORT_RULE}`;
    }

    /** Health score with the checklist and warnings that produced it. */
    function buildHealthSection(pass) {
        const health = computePatternHealth(pass);
        if (!health || !health.totalRows) return '';

        const labels = { pass: 'pass', warn: 'warn', fail: 'FAIL' };
        let section = `PATTERN HEALTH: ${health.score} / 100 (${health.grade})\n`;
        health.checks.forEach(c => { section += `- ${c.name}: ${labels[c.state]} - ${c.detail}\n`; });
        health.warnings.forEach(w => { section += `- Warning: ${w}\n`; });

        // The same disclosure the health panel makes, for the copy that leaves the app. Anyone
        // reading the export needs to know the counts were checked against a construction and a
        // foundation skip that were read off the text rather than stated by the designer.
        (state.inferred?.notices || []).forEach(n => {
            section += `- Read from the pattern: ${n.label} = ${n.value}`
                + (n.basis ? ` (from ${n.basis})` : ' (assumed - the pattern does not say)') + `\n`;
        });

        return `${section}${EXPORT_RULE}`;
    }

    /** Objective category split, for comparing two patterns against each other. */
    function buildComplexitySection() {
        const report = state.analytics.report;
        const complexity = report && report.complexity;
        if (!complexity || !complexity.total) return '';

        let section = `TECHNICAL COMPLEXITY:\n`;
        Object.keys(COMPLEXITY_LABELS)
            .map(key => ({ key, pct: complexity.percentages[key], count: complexity.counts[key] }))
            .sort((a, b) => b.pct - a.pct)
            .forEach(({ key, pct, count }) => {
                section += `- ${COMPLEXITY_LABELS[key]}: ${pct}% (${count.toLocaleString()} sts)\n`;
            });
        if (report.difficulty) section += `- Overall Level: ${report.difficulty.level}\n`;

        return `${section}${EXPORT_RULE}`;
    }

    /**
     * The exported document, as text.
     *
     * Split out of handleExportText so the PDF is the same document rather than a second one written
     * separately. Two builders would drift - a section added to one and forgotten in the other - and
     * the difference would only surface in whichever file the designer happened not to check.
     */
    /**
     * Everything above the pattern itself, as one string.
     *
     * Split out of buildExportText when the annotated draft needed the ROWS as separate, individually
     * markable lines. This half never carries a mark - a finding belongs to a row, not to the gauge
     * section - so it stays the string it always was and is broken into lines only at the very end.
     */
    function buildExportPrelude(pass) {
        const title = UI['project-name'].value || "Untitled Pattern";
        let fileContent = `${title.toUpperCase()}${EXPORT_RULE}`;

        const metadata = metadataForPrint();

        if (metadata.some(m => m.val)) {
            fileContent += `METADATA:\n`;
            metadata.forEach(m => { if (m.val) fileContent += `- ${m.label}: ${m.val}\n`; });
            fileContent += EXPORT_RULE;
        }

        fileContent += buildGaugeSection();
        fileContent += buildSizingSection(pass);
        fileContent += buildGraderSection();
        fileContent += buildValidationSection(pass);
        fileContent += buildHealthSection(pass);
        fileContent += buildComplexitySection();

        const instructionsList = workedSteps().map(s => s.instructionString || ('ch ' + s.initialChain));
        const usedStitches = window.CrochetMathEngine.getUsedStitches(instructionsList);
        if (usedStitches.length > 0) {
            fileContent += `STITCHES USED IN PATTERN:\n- ${usedStitches.join(', ')}\n${EXPORT_RULE}`;
        }

        const customStitches = getLocalStorage(state.savedStitchesKey);
        if (Object.keys(customStitches).length > 0) {
            fileContent += `CUSTOM STITCH DICTIONARY:\n`;
            Object.entries(customStitches).forEach(([key, st]) => {
                fileContent += `- ${key.toUpperCase()}: ${st.def || 'No definition'} (Cost: ${st.cost}, Yield: ${st.yield})\n`;
            });
            fileContent += EXPORT_RULE;
        }

        const colorCodes = getLocalStorage(state.savedColorsKey);
        if (Object.keys(colorCodes).length > 0) {
            fileContent += `COLOURS:\n`;
            Object.entries(colorCodes).sort().forEach(([code, name]) => {
                fileContent += `- ${code}: ${name || 'Unnamed'}\n`;
            });
            fileContent += EXPORT_RULE;
        }

        // Export Stitch Math's calculated count rather than the written estimate, which is advisory and
        // may disagree. instructionString already had any trailing "(N)" stripped by
        // extractExpectedYield, so this cannot produce a double count.
        if (!pass.validation.allStepsValid) {
            fileContent += `Note: this file has been updated to show correct final stitch count.\n\n`;
        }

        return fileContent;
    }

    /**
     * The pattern itself, one entry per output line, each able to carry a linter mark.
     *
     * `marks` is optional and is only passed by the annotated draft: with it, a row whose line the
     * linter flagged is tagged with that line's severity, which is the SAME grouping the on-screen
     * gutter reads (state.linter.byLine). That is what makes the coral in the PDF land on exactly the
     * rows the coral on screen did, rather than on a second opinion computed here.
     */
    function buildExportRows(pass, marks) {
        const out = [];
        // row.label, not index + 1: the evaluator is the only thing that knows where the sections fall
        // and whether numbering restarts at each one.
        pass.validation.rows.forEach(({ step, label, status, evaluation }) => {
            if (status === 'section') {
                out.push({ text: '' }, { text: `--- ${label} ---` });
                return;
            }
            // Verbatim, and with no count appended: a note never had one, and writing it back as it
            // arrived is what lets the exported file be pasted in again.
            if (status === 'note') { out.push({ text: step.noteText }); return; }

            const group = marks && typeof step.lineIndex === 'number' ? marks[step.lineIndex] : null;
            out.push({
                text: `${label}: ${exportRowText(step)} (${evaluation.calculatedYield})`,
                mark: group ? group.severity : undefined
            });
        });
        return out;
    }

    /**
     * The exported document as lines, which is the form the annotated PDF needs.
     *
     * buildExportText is defined in terms of this rather than beside it, so there is still exactly one
     * builder and the two exports cannot describe different documents - the concern the original doc
     * comment was written about. The join reproduces the old concatenation exactly: every row used to
     * contribute `text + '\n'`, which is what joining on '\n' and adding one at the end comes to.
     */
    function buildExportLines(marks) {
        const pass = evaluatePatternRows();
        const prelude = buildExportPrelude(pass).split('\n').map(text => ({ text }));
        // split() on a string ending in '\n' leaves a trailing empty entry that the join puts back.
        prelude.pop();
        return prelude.concat(buildExportRows(pass, marks));
    }

    function buildExportText() {
        return buildExportLines().map(line => line.text).join('\n') + '\n';
    }

    /** What each severity is called in a document nobody can hover over. */
    const MARK_NAMES = { math: 'arithmetic', syntax: 'notation', style: 'style' };

    /**
     * The annotated draft: the pattern with the linter's cues still on it, and a numbered list of what
     * every one of them says.
     *
     * WHAT THIS IS FOR. A student fixes their mistakes and hands in the corrected file, and the
     * recurring misunderstanding that produced them - every round short by exactly one because the
     * turning chain was counted, say - is invisible by the time anyone reads it. This exports the
     * working rather than the answer. The squiggles show a teacher WHERE; the appendix, which is the
     * half a printed page can actually be graded from, tells them WHAT.
     *
     * Read from state.linter.findings rather than recomputed, so the file says exactly what the
     * screen said - including the findings the writer chose to ignore staying ignored.
     */
    function buildMarkupLines() {
        const byLine = state.linter.byLine || {};
        const lines = buildExportLines(byLine);
        const findings = state.linter.findings || [];
        if (!findings.length) return lines;

        lines.push({ text: '' }, { text: EXPORT_RULE.trim() }, { text: '' });
        lines.push({ text: `MARKUP NOTES (${findings.length}):` });
        lines.push({ text: 'Every underline in this file, and what it says. Coral is arithmetic, gold' });
        lines.push({ text: 'is notation, teal is a style note. Nothing here has been corrected.' });
        lines.push({ text: '' });

        findings.forEach((finding, i) => {
            const where = finding.label || `Line ${finding.lineIndex + 1}`;
            lines.push({
                text: `${i + 1}. [${MARK_NAMES[finding.severity] || finding.severity}] ${where}: ${finding.title}`,
                mark: finding.severity
            });
            if (finding.detail) lines.push({ text: `   ${finding.detail}` });
            if (finding.lesson) lines.push({ text: `   Why: ${finding.lesson}` });
            lines.push({ text: '' });
        });

        return lines;
    }

    /**
     * Generates the annotated draft. Same file format as the ordinary PDF export and the same one
     * builder underneath it - the only difference is that the lines carry their severities, and that
     * the appendix is on the end.
     */
    function handleExportMarkup() {
        if (state.patternSteps.length === 0) {
            notify('There is no pattern to export.', 'warn');
            return;
        }
        if (!window.StitchPdf) {
            notify('The PDF writer did not load, so an annotated draft cannot be made. '
                + 'Use Export PDF, which can fall back to printing.', 'warn');
            return;
        }
        const title = UI['project-name'].value || 'Untitled Pattern';
        downloadFile(`${projectSlug('my-pattern')}-draft.pdf`,
                     window.StitchPdf.fromText(buildMarkupLines(), { title: `${title} — annotated draft` }),
                     'application/pdf',
                     'Annotated draft saved.');
    }

    function handleExportText() {
        if (state.patternSteps.length === 0) return;
        downloadFile(`${projectSlug('my-pattern')}.txt`, buildExportText(), 'text/plain',
                     'Pattern saved as text.');
    }

    /**
     * Generates the PDF rather than asking the browser to print one.
     *
     * window.print() is fine on a desktop and unreliable everywhere else - on iOS Safari and Android
     * Chrome the print sheet is inconsistent and sometimes offers no way to save at all. Phones and
     * tablets are supported targets, so the file is made here. See pdf.js for what that costs, which
     * is one dependency-free file and a deliberate refusal to do anything but text.
     *
     * The content is buildExportText()'s, unchanged - the same document the text export writes.
     */
    function handleExportPdf() {
        if (state.patternSteps.length === 0) {
            notify('There is no pattern to export.', 'warn');
            return;
        }
        if (!window.StitchPdf) {
            // Only reachable if pdf.js failed to load. Printing is worse than a generated file but far
            // better than a button that does nothing.
            printPattern();
            return;
        }
        const title = UI['project-name'].value || 'Untitled Pattern';
        downloadFile(`${projectSlug('my-pattern')}.pdf`,
                     window.StitchPdf.fromText(buildExportText(), { title }),
                     'application/pdf',
                     'PDF saved.');
    }

    /** `sharedPass` lets a caller that has already validated the pattern hand its result over. renderUI
     *  does; everything else reaches the print area without one and pays for its own pass. */
    function renderPrintArea(sharedPass) {
        const title = UI['project-name'].value.trim() || "Untitled Pattern";
        UI['print-pattern-title'].textContent = title;

        const designer = UI['meta-designer'].value.trim();
        const difficulty = UI['meta-difficulty'].value;
        const hook = UI['meta-hook'].value.trim();
        const yarnWeight = UI['meta-yarn-weight'].value;
        const construction = inferredConstruction();

        const labelPrefix = labelPrefixFor(construction);

        if (UI['print-running-header']) {
            const designerStr = designer ? ` by ${designer}` : '';
            UI['print-running-header'].setAttribute('data-header-text', ` of ${title}${designerStr}`);
        }

        const metaItems = [];
        if (designer) metaItems.push(`<span><strong>Designer:</strong> ${escapeHtml(designer)}</span>`);
        if (difficulty) metaItems.push(`<span><strong>Difficulty:</strong> ${escapeHtml(difficulty)}</span>`);
        if (hook) metaItems.push(`<span><strong>Hook:</strong> ${escapeHtml(hook)}</span>`);
        if (yarnWeight) metaItems.push(`<span><strong>Yarn:</strong> ${escapeHtml(yarnWeight)}</span>`);
        if (construction) metaItems.push(`<span><strong>Style:</strong> ${escapeHtml(construction)}</span>`);

        UI['print-metadata'].innerHTML = metaItems.length > 0 ? metaItems.join('<span class="meta-separator">•</span>') : '<em>No metadata specified</em>';
            
        const instructionsList = workedSteps().map(s => s.instructionString || ('ch ' + s.initialChain));
        const usedStitches = window.CrochetMathEngine.getUsedStitches ? window.CrochetMathEngine.getUsedStitches(instructionsList) : [];
        
        UI['print-stitches-used'].innerHTML = usedStitches.length > 0 ? usedStitches.map(st => `<span class="print-tag">${escapeHtml(st)}</span>`).join(' ') : '<em>None identified</em>';

        const customStitches = getLocalStorage(state.savedStitchesKey);
        const customKeys = Object.keys(customStitches);
        if (customKeys.length > 0) {
            UI['print-custom-dictionary-section'].style.display = 'block';
            UI['print-custom-dictionary'].innerHTML = customKeys.map(k => `<div><strong>${escapeHtml(k.toUpperCase())}</strong>: ${escapeHtml(customStitches[k].def || 'Custom stitch')}</div>`).join('');
        } else {
            UI['print-custom-dictionary-section'].style.display = 'none';
        }

        UI['print-table-body'].innerHTML = '';

        // Shared with the on-screen table, so the two can no longer disagree - and when the caller
        // already has that pass, re-validating every row here was the same answer computed twice.
        const pass = sharedPass || evaluatePatternRows();
        const { allStepsValid } = pass.validation;
        const { passedRowsCount, totalStitchesAllRounds } = pass.analytics;

        pass.validation.rows.forEach(({ step, label, status, evaluation }) => {
            const tr = elem('tr');
            if (status === 'note') {
                tr.className = 'note-row';
                tr.innerHTML = `<td colspan="4">${escapeHtml(step.noteText)}</td>`;
            } else if (status === 'section') {
                tr.className = 'section-row';
                tr.innerHTML = `<td colspan="4">--- ${escapeHtml(label)} ---</td>`;
            } else {
                tr.innerHTML = `<td>${escapeHtml(label)}</td><td>${escapeHtml(stepInstructionText(step) || `Chain ${step.initialChain}`)}</td><td>x${step.multiplier}</td><td>${evaluation.calculatedYield}</td>`;
            }
            UI['print-table-body'].appendChild(tr);
        });

        const totalSteps = state.patternSteps.length;
        UI['print-validation-results'].innerHTML = totalSteps === 0
            ? '<span>No pattern steps configured.</span>'
            : `<span><strong>Validation Status:</strong> ${allStepsValid ? 'VALID ✓' : 'DISCREPANCIES DETECTED ✗'} &nbsp;|&nbsp; <strong>${labelPrefix}s Passed:</strong> ${passedRowsCount} / ${totalSteps} &nbsp;|&nbsp; <strong>Total Stitches:</strong> ${totalStitchesAllRounds.toLocaleString()} &nbsp;|&nbsp; <strong>Total ${labelPrefix}s:</strong> ${totalSteps}</span>`;
    }

    /**
     * Walks the pass looking for the failure one row cannot see: a row that fell short of its own
     * written count, failing the row below it that expected those stitches.
     *
     * The decision itself is CrochetMathEngine.applyUpstreamCause. This used to hold it, and holding it
     * here was the bug - the UI layer was calling parseInstructions and analyzeRepeatUnit, deciding
     * unilaterally what a failure meant, and overriding a diagnosis the engine had already made. What
     * is left here is the part that genuinely belongs to the caller: which rows are on screen, and what
     * this designer's row labels say. The engine is handed the five figures it needs and nothing else.
     */
    function addUpstreamCauses(rows) {
        rows.forEach((row, index) => {
            if (row.status !== 'failed' || index === 0) return;
            const prev = rows[index - 1];
            row.evaluation.likelyCauses = window.CrochetMathEngine.applyUpstreamCause(row.evaluation, {
                label: prev.label,
                instructionString: prev.step.instructionString,
                multiplier: prev.step.multiplier,
                expectedYield: prev.step.expectedYield,
                calculatedYield: prev.evaluation.calculatedYield
            });
        });
    }

    /**
     * Flags a piece that changes increase strategy partway up - stacked shaping for several rounds,
     * then staggered, or the reverse - which leaves a visible seam on an otherwise smooth shape.
     *
     * Scoped to the SECTION, because a sphere and the beanie worked after it are two objects and each
     * is entitled to its own strategy. Rounds the engine cannot classify are dropped rather than
     * breaking the run: a sphere's straight middle sits between its increases and its decreases and
     * says nothing about either.
     *
     * A post-pass rather than part of the walk, matching addUpstreamCauses above: the engine's rule
     * reads a whole section's rhythm, and keeping it a pure function of that list is what makes it
     * testable without building a pattern first. Read stepInstructionText, not instructionString, for
     * the same reason the dialect and shorthand checks do - preprocessTurningChain has taken the
     * opening chain out of the evaluated form, and a round is classified on what the designer wrote.
     */
    function addIncreaseStyleFindings(rows) {
        const sections = [];
        let current = [];
        sections.push(current);

        rows.forEach(row => {
            if (row.status === 'section') { current = []; sections.push(current); return; }
            if (row.status === 'note' || row.step.isNote) return;
            const style = window.CrochetMathEngine.increaseStyle(stepInstructionText(row.step));
            if (style) current.push({ style, row });
        });

        sections.forEach(shaped => {
            const fix = window.CrochetMathEngine.buildIncreaseStyleFix(shaped.map(entry => entry.style));
            if (!fix) return;
            const target = shaped[fix.at];
            if (!target) return;
            const { at, ...finding } = fix;
            target.row.evaluation.fixes = (target.row.evaluation.fixes || []).concat(finding);
        });
    }

    /**
     * Flags a square whose rounds do not grow by four clusters.
     *
     * A granny square adds one cluster to each of its four sides every round, so it runs 4, 8, 12, 16.
     * A round that drops one still balances perfectly - it consumes what the round below produced and
     * states a count that matches - so nothing else in the engine notices, and the piece comes out a
     * rhombus. This is the only check that looks at the shape rather than the arithmetic.
     *
     * Only consecutive rounds that BOTH carry the granny signature are compared (see clusterCount);
     * anything else breaks the run rather than being compared across a gap, so a square followed by a
     * border, or a document holding a square and a shawl, is not measured against itself.
     */
    function addClusterGrowthFindings(rows) {
        let previous = null;
        rows.forEach(row => {
            if (row.status === 'section') { previous = null; return; }
            if (row.status === 'note' || row.step.isNote) return;

            const clusters = window.CrochetMathEngine.clusterCount(
                row.evaluation, stepInstructionText(row.step));
            // A round the gate does not recognise ends the run: comparing across it would measure a
            // square's round 5 against its round 3 and report a jump of eight that is not there.
            if (clusters === null) { previous = null; return; }

            if (previous !== null) {
                const fix = window.CrochetMathEngine.buildClusterGrowthFix(previous, clusters, row.label);
                if (fix) row.evaluation.fixes = (row.evaluation.fixes || []).concat(fix);
            }
            previous = clusters;
        });
    }

    /** Single source of truth for the row-by-row validation pass. The on-screen table, the print area
     *  and the text export all need the same calculated counts, and before this existed the first two
     *  ran separate loops that could disagree. */
    /** Only the steps that make fabric: headings and notes carry no stitches of their own. */
    const workedSteps = () => state.patternSteps.filter(s => !s.isSection && !s.isNote);

    /** How many foundation chains a row skips when it never says which chain to start in. Read off
     *  the row's own opening stitch; a row that states its own ordinal never consults this. */
    const skippedChains = () => inferredSkip();

    /** The first worked step of the section containing the step at `index`. Notes are stepped over: a
     *  heading followed by a note and then the foundation chain must still find the chain. */
    function firstStepOfSection(index) {
        const worked = s => !s.isSection && !s.isNote;
        for (let i = index - 1; i >= 0; i--) {
            if (state.patternSteps[i].isSection) {
                return state.patternSteps.slice(i + 1).find(worked);
            }
        }
        return state.patternSteps.find(worked);
    }

    function evaluatePatternRows(options = {}) {
        const construction = inferredConstruction();
        const labelPrefix = labelPrefixFor(construction);
        // Told once, here, because this is the single walk everything on screen reads. The engine uses
        // it for one thing only - which height table a turning-chain NOTE is written against - and no
        // count anywhere depends on it. See UK_CHAIN_HEIGHTS in validator.js section 2.
        window.CrochetMathEngine.setTerminology(terminologyMode());

        // Sections are separate pieces, worked one after another and assembled later, so each starts
        // from nothing and keeps its own troubles to itself.
        //
        // This was a "Pattern is worked in sections / parts" tickbox, on by default. Unticking it kept
        // the titles as dividers without resetting anything, for a pattern that heads its phases
        // ("Crown shaping", "Brim") rather than its pieces. The control is gone and on is now the only
        // behaviour.
        const restartNumbering = (UI['meta-row-numbering']?.value || 'restart') === 'restart';

        let currentRunningCount = 0;
        // How many corners the last round worked. A "repeat from * to end" round closes when it has been
        // round every corner, so it needs to know how many there are.
        let currentCorners = 0;
        let allStepsValid = true;
        let passedRowsCount = 0, failedRowsCount = 0, blockedRowsCount = 0;
        let totalStitchesAllRounds = 0;
        let blockedByLabel = null;
        // The first failure in the whole document, kept for the one-line summaries. blockedByLabel above
        // is per section and reset at every heading, so reading it after the walk names whichever piece
        // failed last rather than first.
        let firstFailureLabel = null;
        // Stitches an earlier row set aside for a piece worked later, by the name it used. Filled as the
        // walk goes, so a section can only be seeded from something the pattern said BEFORE it - a
        // sleeve cannot borrow its own count.
        const heldStitches = {};
        let sectionTitle = null;
        let rowNumber = 0;        // continuous count, used when numbering does not restart
        let rowInSection = 0;     // count within the current section
        let indexInSection = 0;   // position within the section, for foundation handling
        let sectionHasFoundation = false;   // the section opened with an unnumbered chain
        // A style-linter fix built while standing on Row 1, waiting for Row 2 to reach the map so it
        // has somewhere to attach - see the isEmptyFoundationRow block below. Captured and cleared at
        // the top of every iteration, so it lands on the very next step and nowhere further: a note or
        // section header between the two would otherwise let it drift onto the wrong row.
        let pendingStyleFix = null;
        // The repeat-shorthand recommendation is per-DOCUMENT, not per-row: once one row has raised it,
        // no other row does. Reset per call, so a re-render or the linter's own scratch pass each get
        // exactly one, on the same row as the last pass.
        let repeatFixPlaced = false;

        const rows = state.patternSteps.map((step, index) => {
            const styleFix = pendingStyleFix;
            pendingStyleFix = null;
            // A note is invisible to the count. It takes no row number, moves no running total, and -
            // the point of the whole thing - never sets blockedByLabel, so a copyright line in the middle
            // of a piece cannot blank the rows under it.
            if (step.isNote) {
                // A note makes no fabric, but it is often where the pattern says how the fabric is
                // divided - "(Section breakdown: Back = 48 hdc, Right Sleeve = 38 hdc)". Read for that
                // and nothing else.
                Object.assign(heldStitches, window.CrochetMathEngine.parseHeldStitches(step.noteText) || {});
                return {
                    step, index, status: 'note', label: step.noteText, sectionTitle,
                    availableStitches: 0,
                    evaluation: { calculatedYield: 0, costIsValid: true, reason: '', unknownTokens: [], notes: [] }
                };
            }

            if (step.isSection) {
                // Reset everything a new piece should not inherit: the stitch count it would otherwise
                // work into, and the failure that would blank it.
                //
                // Except where the pattern held stitches for this piece by name. A sleeve worked into the
                // 38 stitches the yoke skipped for it does not start from nothing, and starting it at
                // nothing failed its first round and blocked every round under it.
                const seeded = window.CrochetMathEngine.matchHeldName(step.sectionTitle, heldStitches);
                currentRunningCount = seeded || 0;
                currentCorners = 0;
                blockedByLabel = null;
                rowInSection = 0;
                indexInSection = 0;
                sectionHasFoundation = false;
                sectionTitle = step.sectionTitle;
                return {
                    step, index, status: 'section', sectionTitle: step.sectionTitle,
                    label: step.sectionTitle, availableStitches: 0, heldStitches: seeded || 0,
                    evaluation: { calculatedYield: 0, costIsValid: true, reason: '', unknownTokens: [], notes: [] }
                };
            }

            preprocessTurningChain(step);

            // Foundation handling is relative to the section, not the document: without this, every piece
            // after the first has its opening chain measured against fabric belonging to the previous one.
            let availableStitches;
            // A bare foundation line - nothing on it but the chain, no row worked back along it on the
            // same line - is the shape the reader below is only guessing at. isEmptyFoundationRow guards
            // both the availableStitches branch and the disclosure note below, so the two cannot drift.
            const isEmptyFoundationRow = indexInSection === 0 && step.initialChain > 0 && !step.instructionString;
            if (indexInSection === 0 && step.initialChain > 0) availableStitches = 0;
            else if (indexInSection === 1 && firstStepOfSection(index)?.initialChain > 0) {
                availableStitches = currentRunningCount - skippedChains();
            } else availableStitches = currentRunningCount;

            // The same setting reaches the engine, for the other shape a foundation takes: the chain and
            // the row that works back along it written as one line, where there is no following row to
            // subtract it from. Only consulted when the row states no starting chain of its own.
            const evaluation = window.CrochetMathEngine.evaluateStep(
                step.initialChain, availableStitches, step.instructionString, step.multiplier,
                step.expectedYield, currentCorners, skippedChains()
            );

            // Placed here rather than mixed into evaluateStep's own fixes: the edit this offers targets
            // the RAW LINE this row was built from ("6 sc"), which only exists once this row is reached
            // - buildUnstatedSkipFix was called standing on Row 1, before that text was in scope.
            if (styleFix) evaluation.fixes = (evaluation.fixes || []).concat(styleFix);

            // Bracket shorthand is correct, extremely common, and used consistently by the patterns
            // that use it at all, so this is raised ONCE for the document - the first row that can
            // actually be rewritten claims it, and "Standardize All" handles the rest. A card on every
            // repeat row would be a preference pushed forty times over rather than a convention
            // pointed out once, which is the whole reason it is scoped this way.
            if (!repeatFixPlaced && step.instructionString) {
                const repeatFix = window.CrochetMathEngine.buildRepeatPhrasingFix(step.instructionString);
                if (repeatFix) {
                    evaluation.fixes = (evaluation.fixes || []).concat(repeatFix);
                    repeatFixPlaced = true;
                }
            }

            // Terminology and nomenclature, per row rather than once for the document: each names a
            // specific term in a specific line, and a student who mixed dialects twice needs telling
            // twice. Both are style findings and neither can fail a row - the counts above were
            // already settled by evaluateStep and nothing here is consulted by them.
            //
            // A documentation line never reaches this branch, which is what keeps the standardizer
            // off an abbreviations key: "hdc = half double crochet" is the long form written on
            // purpose, and correcting it would be correcting the one place it belongs.
            //
            // Read against stepInstructionText, not instructionString: preprocessTurningChain takes
            // the opening chain OUT of the evaluated form, so "chain 1, dc in each st around" reaches
            // the engine as "dc in each st around" and the longhand chain - the single most common
            // thing a beginner writes - was invisible to the standardizer. Both of these findings are
            // shown to a person and their edits resolve against the line as typed, so both want the
            // row as the reader wrote it, which is exactly what that helper is for.
            const asTyped = stepInstructionText(step);
            if (asTyped) {
                const mode = terminologyMode();
                const engine = window.CrochetMathEngine;
                const dialect = engine.dialectFaults(asTyped, mode)
                    .map(fault => engine.buildTerminologyFix(fault, mode));
                const shorthand = engine.buildShorthandFixes(asTyped, mode);
                if (dialect.length || shorthand.length) {
                    evaluation.fixes = (evaluation.fixes || []).concat(dialect, shorthand);
                }
            }

            // The chain is valid either way - the count is unaffected whether the skip below it was
            // stated or assumed - but only the reader can settle which chain Row 2 actually starts in.
            // Flagged here rather than folded into evaluateStep's own notes because the fact being
            // reported belongs to the ROW BELOW, not to anything this line says about itself.
            if (isEmptyFoundationRow && inferredSkipNeedsDisclosure()) {
                const nextUnit = labelPrefix === 'Rnd' ? 'round' : 'row';
                evaluation.notes = (evaluation.notes || []).concat(
                    `This pattern doesn't say how many chains the next ${nextUnit} skips - it's assumed `
                    + `from the stitch it uses. State it at the start of the next ${nextUnit} (for example `
                    + `"sc in 2nd ch from hook"), or combine this chain into that ${nextUnit}.`
                );
                // The fix itself needs the NEXT row's own text, which only this row's neighbour in
                // patternSteps can give it - buildUnstatedSkipFix reads it once, here, rather than the
                // linter re-deriving "which line is Row 2" from scratch the way lintDiff reads the
                // textarea for every other edit target.
                const nextStep = state.patternSteps[index + 1];
                pendingStyleFix = window.CrochetMathEngine.buildUnstatedSkipFix(
                    state.inferred?.unstatedSkipStitch || null,
                    state.inferred?.unstatedSkip || 0,
                    nextStep ? nextStep.instructionString : ''
                );
            }

            const isStepValid = evaluation.costIsValid && evaluation.reason === '';

            // Numbering also restarts when the row's OWN label restates the count back to 1 - "Sleeve
            // Row 1" under a heading too plain to be recognised as a section (parseSectionHeader wants
            // ALL CAPS, a trailing colon, or "Name (make N)", and broadening that would also reset the
            // running stitch count and per-piece health checks, not just the label). The designer
            // writing "Row 1" again is itself the signal a new sequence starts here. extractRowRange
            // already parsed this off the label and stripped it from instructionString before this
            // point, so rangeStartRow is read here rather than re-parsing text that is already gone.
            // Cosmetic only - rowInSection is the only thing touched, so stitch math and section-scoped
            // checks are unaffected. Skipped on the very first work row, already at 1 regardless.
            //
            // The foundation chain is the one row that takes no number at all. It makes no fabric of
            // its own, and numbering it pushed every label one ahead of the pattern's own: the chain
            // became Row 1, and then the explicit "Row 1" written under it hit the rule above - a
            // restart it was never meant to catch - and landed on Row 1 a second time, so the matrix
            // showed the number twice. Unnumbered, the chain keeps its place in the table (the reader
            // still needs to see it was read) while the count carries straight on from it, restarting
            // only where a section does.
            //
            // Foundation means the section's opening chain and nothing more: a bare "ch 46", or one
            // closed into a ring ("ch 46, sl st to join") whose whole yield is still only the chain.
            // A chain with work on the same line has made fabric and is a row - "ch 6, 6 sc in 2nd ch
            // from hook", or a granny ring laying its first round of dc into the ring, which is why
            // the yield is compared against the chain rather than isRingStart being trusted alone. So
            // is a chain whose own label claims a number, which is the designer saying it is a row;
            // "Row 0" is not that, it is how a foundation gets written when it is written at all.
            let label;
            // extractFoundationChain only absorbs a line that is exactly "ch N", so a chain closed
            // into a ring on the same line keeps its count in the instruction instead. Read from
            // either place, so both shapes are recognised as the opening chain they are.
            const openingChain = step.initialChain > 0
                ? step.initialChain
                : Number((step.instructionString.match(/^(?:chain|ch)\s*(\d+)\b/i) || [])[1]) || 0;
            const isFoundationRow = indexInSection === 0
                && openingChain > 0
                && !(step.rangeStartRow > 0)
                && (!step.instructionString
                    || (window.CrochetMathEngine.isRingStart(step.instructionString)
                        && evaluation.calculatedYield === openingChain));
            if (isFoundationRow) {
                indexInSection++;
                sectionHasFoundation = true;
                label = 'Foundation';
            } else {
                // The row after the foundation says where the count starts. "Ch 12" then "Row 1" and
                // "Ch 12" then "Row 2" are both written - the second counts the chain as its first row -
                // and the matrix follows the pattern either way rather than deciding for it. Only the
                // first section can seed the continuous count; a later piece under "Continue across
                // sections" is numbered straight through, so its chain is not a row 1 to skip.
                if (sectionHasFoundation && indexInSection === 1 && step.rangeStartRow >= 1) {
                    if (restartNumbering) rowInSection = step.rangeStartRow - 1;
                    else if (rowNumber === 0) rowNumber = step.rangeStartRow - 1;
                }
                // The restart is also held back when only one row stands above this one in the
                // section, because that row is almost always its opening chain in a shape not
                // recognised as one ("ch 16, turn" loses its count before it gets here). Restarting
                // there prints the same number twice, which is the one thing the numbering must never
                // do; a piece with a single row above a restated "Row 1" is rare enough, and reads
                // ambiguously enough, to be worth that.
                if (restartNumbering && rowNumber > 0 && step.rangeStartRow === 1 && rowInSection !== 1) rowInSection = 0;

                rowNumber++; rowInSection++; indexInSection++;
                label = `${labelPrefix} ${restartNumbering ? rowInSection : rowNumber}`;
            }

            // Once a row fails, every row after it measures against a stitch count that never got
            // produced, so report the cause once instead of per row.
            let status;
            if (blockedByLabel) status = 'blocked';
            else if (!isStepValid) {
                status = 'failed';
                blockedByLabel = label;
                if (firstFailureLabel === null) firstFailureLabel = label;
            }
            else status = 'valid';

            // Captured per row, not read from the closure at render time. A section resets
            // blockedByLabel, so by the end of the walk the variable holds the LAST section's failure -
            // and every blocked row in the document, including ones blocked by an earlier section
            // entirely, was being told to go and fix that one. With restart numbering it named a row
            // number that existed twice, and a row could be sent to fix itself.
            const blockedBy = status === 'blocked' ? blockedByLabel : null;

            if (status === 'valid') {
                currentRunningCount = evaluation.calculatedYield;
                // Only carried forward when the round actually went into corners, so a plain row between
                // two granny rounds does not wipe the count.
                if (evaluation.cornersUsed > 0) currentCorners = evaluation.cornersUsed;
                passedRowsCount++;
            }
            else if (status === 'failed') { allStepsValid = false; failedRowsCount++; }
            else { allStepsValid = false; blockedRowsCount++; }

            totalStitchesAllRounds += (evaluation.calculatedYield || 0);

            // The row that divides the yoke names the pieces and the count each keeps: "ch 6 (Underarm
            // 1), skip 38 sts (Right Sleeve)". Read from the source line rather than instructionString,
            // which has had its preamble and written count taken off by the time it gets here.
            Object.assign(heldStitches,
                window.CrochetMathEngine.parseHeldStitches(step.sourceLine || step.instructionString) || {});

            return { step, index, evaluation, status, label, sectionTitle, availableStitches, blockedBy,
                     isFoundation: isFoundationRow };
        });

        addUpstreamCauses(rows);
        addIncreaseStyleFindings(rows);
        addClusterGrowthFindings(rows);

        // Two halves: what the pattern does, and what it adds up to. The analytics counters are
        // tallied by the loop above rather than by a second walk over the rows, so they cost nothing
        // beyond the pass that was being made anyway.
        const result = {
            validation: {
                rows, labelPrefix, allStepsValid, blockedByLabel: firstFailureLabel,
                // The steps this pass was built from. evaluateAtSize swaps state.patternSteps back
                // before it returns, so a caller measuring one size cannot re-read them afterwards.
                steps: state.patternSteps
            },
            analytics: { passedRowsCount, failedRowsCount, blockedRowsCount, totalStitchesAllRounds }
        };

        // Stitch totals and complexity need the whole row set, so unlike the counters above they
        // cannot be tallied a row at a time. Opt-in because the print area and the text export never
        // read them, and aggregating on those paths would be work thrown away.
        if (options.withComplexity && window.CrochetAnalyticsEngine) {
            const A = window.CrochetAnalyticsEngine;
            result.analytics.stitchTotals = A.AggregateStitchCounts(state.patternSteps, rows);
            result.analytics.complexity = A.AnalyzeComplexity(result.analytics.stitchTotals);
        }
        return result;
    }

    /**
     * Says one sentence into #validation-announce, the off-screen live region.
     *
     * A screen reader user pressing Validate previously heard nothing at all: the matrix, the health
     * panel and the status line are all written straight into the DOM, and a silent DOM change is not
     * an event. This is the smallest thing that fixes that honestly - the RESULT, in a sentence, not a
     * reading of the panel. Wrapping the health panel in a live region instead would re-announce every
     * figure on every keystroke, which is noise a reader cannot skip and worse than saying nothing.
     *
     * Re-announcing identical text is a no-op in most screen readers, so the same sentence twice would
     * be silent the second time. The value is cleared first to force it, because "still 3 failures" is
     * exactly what someone who just pressed the button again needs to hear.
     */
    /* Nothing speaks during boot. init() draws the whole page once before anyone has asked for
       anything, and that first render reached the live region - so a screen reader arriving at the app
       was greeted with "Nothing to validate yet." while the page was still introducing itself. Armed at
       the end of init(). A project restored from storage lands after that and does announce its state
       once, which is the right thing for someone returning to work in progress. */
    let announcementsArmed = false;

    function armAnnouncements() { announcementsArmed = true; }

    function announce(sentence) {
        const host = UI['validation-announce'];
        if (!host || !sentence || !announcementsArmed) return;
        host.textContent = '';
        host.textContent = sentence;
    }

    /** What the pass amounts to, in one line. Reads the same numbers the health panel does. */
    function announceValidation(pass) {
        const { passedRowsCount, failedRowsCount, blockedRowsCount } = pass.analytics;
        const noun = pass.validation.labelPrefix.toLowerCase();
        const total = passedRowsCount + failedRowsCount + blockedRowsCount;
        if (!total) { announce('Nothing to validate yet.'); return; }
        const parts = [`${passedRowsCount} of ${total} ${noun}s pass`];
        if (failedRowsCount) parts.push(`${failedRowsCount} failed`);
        // A blocked row is not a second failure - it is a row whose numbers could not be judged. Said
        // separately so a reader is not told about four problems when there is one.
        if (blockedRowsCount) parts.push(`${blockedRowsCount} could not be checked until the failure above is fixed`);
        const findings = state.linter.findings.length;
        if (findings) parts.push(`${findings} suggestion${findings === 1 ? '' : 's'} available`);
        announce(`Validation complete. ${parts.join('. ')}.`);
    }

    // === 5c. MESSAGES: TOASTS AND THE CONFIRM MODAL === //
    //
    // Twenty-three alerts and seven confirms used to be native browser dialogs. On a desktop that is a
    // polish problem; in a packaged shell it is a correctness one, because some webviews suppress them
    // outright - and a confirm() that silently returns false turns "Import this project?" into an
    // import that quietly does nothing, with no error and no explanation.
    //
    // Both fall back to the native call when there is no browser, which is how every existing suite
    // keeps working untouched: tests/test-dom.js records through the global alert() and returns true
    // from confirm(), and those remain the channels under test.

    const TOAST_MS = { info: 4200, warn: 6000, error: 8000 };

    /**
     * Says one thing, near where the reader was looking, without taking the thread.
     *
     * Tone is advisory and only sets a colour bar and a dwell time - an error stays long enough to read
     * twice. The role is the part that matters: 'alert' interrupts a screen reader, 'status' waits its
     * turn, and getting that backwards is worse than the silence this replaces.
     */
    function notify(message, tone) {
        const text = String(message == null ? '' : message);
        if (!IS_BROWSER) { if (typeof alert === 'function') alert(text); return; }

        const host = document.getElementById('toast-host');
        if (!host) { if (typeof alert === 'function') alert(text); return; }

        const kind = tone === 'error' || tone === 'warn' ? tone : 'info';
        const toast = elem('div', 'toast' + (kind === 'info' ? '' : ' is-' + kind));
        toast.appendChild(elem('span', null, text));
        host.appendChild(toast);

        // The toast itself is aria-hidden; the announcement comes from a region that was already in
        // the page. Confirmed by ear on 4 Sep: a role set on an element as it is appended is not a
        // change to a live region, it is a live region arriving, and VoiceOver read none of them.
        // Cleared first so the same message twice running is two changes rather than one no-op.
        const region = document.getElementById(kind === 'error' ? 'toast-alert' : 'toast-say');
        if (region) { region.textContent = ''; region.textContent = text; }

        let gone = false;
        const dismiss = () => {
            if (gone) return;
            gone = true;
            toast.classList.add('is-leaving');
            // Removed on a timer rather than on animationend: a reduced-motion viewer has no animation
            // to end, and the toast would stay on screen for ever waiting for an event that never fires.
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 180);
        };
        toast.addEventListener('click', dismiss);
        setTimeout(dismiss, TOAST_MS[kind]);
    }

    /* The modal is single-use at a time; these hold the two decisions it is waiting to make. A cancel
       callback is not "do nothing" everywhere: importing a dictionary whose conflicts you declined
       still has the non-conflicting half to write, and dropping that would lose work you did agree to. */
    let pendingConfirm = null;
    let pendingCancel = null;
    let pendingAlt = null;

    /**
     * Asks before something destructive, and continues in a callback.
     *
     * Every caller guards work that cannot be got back, so the shape is deliberate: nothing happens
     * until `onConfirm` runs, cancelling does nothing at all rather than running a second path, and
     * Escape and the scrim both cancel because the safe answer must be the easy one to reach.
     *
     * Under the stub the native confirm() answers immediately and onConfirm runs synchronously, which
     * is what keeps every existing destructive-path assertion working unchanged.
     */
    /**
     * @param {object} [options]
     * @param {string} [options.confirmLabel]  what the confirming button says; "Continue" otherwise
     * @param {Function} [options.onCancel]
     * @param {string} [options.altLabel]      a third answer, shown between Cancel and the confirm
     * @param {Function} [options.onAlt]       what the third answer does; shown only with a label
     */
    function askConfirm(message, onConfirm, options) {
        const opts = options || {};
        const cancel = typeof opts.onCancel === 'function' ? opts.onCancel : null;
        const alt = opts.altLabel && typeof opts.onAlt === 'function' ? opts.onAlt : null;
        // Without the modal, a global confirm() answers. A boolean has no way to say the third
        // thing, so a stub returning the alt label itself ("Append") is read as choosing it.
        const fallback = () => {
            const answer = typeof confirm === 'function' ? confirm(String(message)) : true;
            if (alt && typeof answer === 'string' && answer.toLowerCase() === String(opts.altLabel).toLowerCase()) alt();
            else if (answer) onConfirm();
            else if (cancel) cancel();
        };
        if (!IS_BROWSER) { fallback(); return; }
        const scrim = document.getElementById('modal-scrim');
        const body = document.getElementById('modal-text');
        const yes = document.getElementById('modal-confirm');
        if (!scrim || !body || !yes) { fallback(); return; }
        pendingCancel = cancel;
        pendingAlt = alt;
        body.textContent = String(message);
        yes.textContent = opts.confirmLabel || 'Continue';
        const altBtn = document.getElementById('modal-alt');
        if (altBtn) {
            altBtn.textContent = alt ? String(opts.altLabel) : '';
            altBtn.classList.toggle('hidden', !alt);
        }
        pendingConfirm = onConfirm;
        scrim.classList.remove('hidden');
        // aria-modal is a claim about the REST of the page - that none of it is reachable while this
        // is up - so it is made when the dialog opens and withdrawn when it closes. Left in the static
        // markup it is a standing claim about a dialog that is not there, and some screen readers
        // honour it anyway and treat the whole page as inert.
        document.getElementById('modal-card')?.setAttribute('aria-modal', 'true');
        // The destructive button is not the one focus lands on. A hurried Return should cancel.
        const cancelBtn = document.getElementById('modal-cancel');
        if (cancelBtn && typeof cancelBtn.focus === 'function') cancelBtn.focus();
    }

    /** @param {boolean|'alt'} answer  true for the confirm, 'alt' for the third button, false to cancel */
    function closeConfirm(answer) {
        const scrim = document.getElementById('modal-scrim');
        if (scrim) scrim.classList.add('hidden');
        document.getElementById('modal-card')?.removeAttribute('aria-modal');
        const run = answer === 'alt' ? pendingAlt : answer ? pendingConfirm : pendingCancel;
        // All cleared before any runs, so a callback that opens a second question is not torn down
        // by the closing of the first.
        pendingConfirm = null;
        pendingCancel = null;
        pendingAlt = null;
        if (typeof run === 'function') run();
    }

    function wireConfirmModal() {
        if (!IS_BROWSER) return;
        document.getElementById('modal-confirm')?.addEventListener('click', () => closeConfirm(true));
        document.getElementById('modal-alt')?.addEventListener('click', () => closeConfirm('alt'));
        document.getElementById('modal-cancel')?.addEventListener('click', () => closeConfirm(false));
        // The scrim itself cancels; the card stops the click so pressing inside it does not.
        document.getElementById('modal-scrim')?.addEventListener('click', () => closeConfirm(false));
        document.getElementById('modal-card')?.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && pendingConfirm) closeConfirm(false);
        });
    }

    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
    }

    /**
     * Marks up the words the parser could not resolve so the failing term is obvious in the instruction
     * column. Rebuilds the string word by word rather than running replacements over HTML, so every
     * character still goes through escapeHtml and a token can never be wrapped twice.
     */
    function highlightUnknownTokens(instruction, unknownTokens) {
        const text = String(instruction ?? '');
        if (!unknownTokens || !unknownTokens.length) return escapeHtml(text);

        const normalize = (word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').toLowerCase();
        const flagged = new Set();
        unknownTokens.forEach(token => {
            String(token).split(/\s+/).forEach(word => {
                const clean = normalize(word);
                if (clean) flagged.add(clean);
            });
        });

        return text
            .split(/([a-zA-Z0-9][a-zA-Z0-9\-]*)/)
            .map(part => {
                const safe = escapeHtml(part);
                return flagged.has(normalize(part))
                    ? `<mark class="unknown-token" title="Not found in the stitch dictionary">${safe}</mark>`
                    : safe;
            })
            .join('');
    }

    /** status: 'valid' | 'failed' | 'blocked'. A blocked row sits downstream of a failure, so its own
     *  stitch numbers are derived from a stale count - repeating them buries the one row that actually
     *  needs attention. */
    function renderMathCheck(cell, status, evaluation, blockedByLabel) {
        if (status === 'blocked') {
            cell.innerHTML = `<strong class="math-blocked-flag">⏸ BLOCKED</strong>`
                + `<span class="math-blocked">Fix the error on ${escapeHtml(blockedByLabel)} before continuing — this row's stitch count depends on it.</span>`;
            return;
        }

        cell.innerHTML = `<strong>${status === 'valid' ? '✓' : '✗ FAIL'}</strong>`;

        if (status === 'failed') {
            if (evaluation.reason) {
                const bullets = evaluation.reason.split(/<br>\s*•\s*/).filter(Boolean);
                cell.innerHTML += `<span class="math-reason">${bullets.map(escapeHtml).join(' • ')}</span>`;
            }
            (evaluation.resolutions || []).forEach(fix => {
                cell.innerHTML += `<span class="math-fix">→ ${escapeHtml(fix)}</span>`;
            });

            const causes = evaluation.likelyCauses || [];
            if (causes.length) {
                cell.innerHTML += `<span class="math-causes-title">Likely causes</span>`;
                causes.forEach(({ tier, cause, evidence }) => {
                    cell.innerHTML += `<span class="math-cause">`
                        + `<span class="cause-tier tier-${tier.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(tier)}</span>`
                        + `<span class="cause-name">${escapeHtml(cause)}</span>`
                        + `<span class="cause-evidence">${escapeHtml(evidence)}</span>`
                        + `</span>`;
                });
            }
        }

        // Advisory notes show on passing rows too - that is the whole point.
        (evaluation.notes || []).forEach(note => {
            cell.innerHTML += `<span class="math-note">${escapeHtml(note)}</span>`;
        });
    }

    /** Health needs the aggregated stitch counts as well as the per-row verdicts. */
    function computePatternHealth(pass) {
        if (!window.CrochetAnalyticsEngine) return null;
        // Already on the pass when it was asked for; the export and print paths do not ask, so they
        // still aggregate here.
        const stitchTotals = pass.analytics.stitchTotals
            || window.CrochetAnalyticsEngine.AggregateStitchCounts(state.patternSteps, pass.validation.rows);
        return window.CrochetAnalyticsEngine.CalculatePatternHealth({
            rows: pass.validation.rows, stitchTotals, sizes: computeSizeGrading(),
            construction: hasInferred() ? inferredConstruction() : '',
            // The size-array checks need the text as the designer typed it. A row's sourceLine is rebuilt
            // from its instructionString once the label is parsed off, and by then resolveSizeVariants
            // has replaced "20 (24, 28, 32)" with the one number for the selected size - so the arrays
            // are simply not there any more. Only a line filed as a note keeps its original text, which
            // is why a fault on a numbered row went unseen.
            sourceText: UI['bulk-input']?.value || ''
        });
    }

    const CHECK_ICONS = { pass: '✓', warn: '⚠', fail: '✗' };

    /**
     * The whole document's verdict, in one line.
     *
     * WHY THIS IS NOT THE HEALTH SCORE. The score answers "how well is this written" - it weighs
     * notation, repeat consistency, formatting, and gives partial credit. This answers a different and
     * blunter question: can the arithmetic be trusted, and is anything still missing? A teacher with
     * thirty patterns to grade needs the second one before they can spend their attention on
     * creativity, clarity and aesthetics, and a number out of a hundred does not answer it.
     *
     * Three states, in the order a reader cares about them. A failing row outranks a missing hook
     * size: no amount of front matter makes a pattern that does not add up ready to publish.
     */
    function computeValidationBadge(pass) {
        const elements = window.CrochetMathEngine.requiredElements({
            sourceText: UI['bulk-input']?.value || '',
            metadata: state.metadata,
            gauge: state.gauge
        });
        const rows = pass.validation.rows.filter(r => r.status !== 'note' && r.status !== 'section');

        if (!rows.length) {
            return { state: 'empty', elements, headline: 'Nothing to check yet',
                     detail: 'Write a pattern, or start from a template above.' };
        }
        // An unrecognised stitch needs no branch of its own: evaluateStep sets a reason for one, which
        // fails the row, so a pattern containing one always arrives here. Worth stating because the
        // opposite would be a green tick over totals computed without one of the stitches.
        if (!pass.validation.allStepsValid) {
            const failed = pass.analytics.failedRowsCount;
            const blocked = pass.analytics.blockedRowsCount;
            return {
                state: 'invalid', elements,
                headline: 'Not valid',
                detail: `${failed} ${pass.validation.labelPrefix.toLowerCase()}${failed === 1 ? '' : 's'} `
                    + `${failed === 1 ? 'does' : 'do'} not add up`
                    + (blocked ? `, and ${blocked} below ${blocked === 1 ? 'is' : 'are'} waiting on `
                        + `${pass.validation.blockedByLabel}` : '') + '.'
            };
        }
        if (!elements.complete) {
            const missing = elements.items.filter(item => !item.present).map(item => item.label);
            return {
                state: 'incomplete', elements,
                headline: 'Math sound — not finished',
                detail: `Every ${pass.validation.labelPrefix.toLowerCase()} adds up. Still missing: `
                    + `${missing.join(', ')}.`
            };
        }
        return {
            state: 'valid', elements,
            headline: 'Valid',
            detail: `All ${rows.length} ${pass.validation.labelPrefix.toLowerCase()}s add up, and the `
                + `pattern states its hook, yarn, gauge and abbreviations.`
        };
    }

    const BADGE_ICONS = { valid: '✓', incomplete: '◐', invalid: '✗', empty: '·' };

    /**
     * The badge, and the checklist under it.
     *
     * The four elements are listed whatever the verdict - a designer whose pattern is valid still
     * benefits from seeing WHY, and one whose pattern is not needs to know the front matter is fine
     * so they do not go looking there. Each present item says where it was read from, on the same
     * principle renderInferenceNotices follows: a tick whose provenance is hidden is a tick that has
     * to be re-checked by hand.
     *
     * The scope line says what the tick proves and what it does not. The About panel says the same,
     * but About is on the Settings view; a claim about what a tick means has to sit under the tick,
     * or a designer reads "Valid" as "will fit". Left off the empty state, where nothing was checked.
     */
    const BADGE_SCOPE = 'A tick means the arithmetic adds up: every row can be worked from the one '
        + 'before it, and the count you wrote matches. It does not check gauge, shaping or fit — only '
        + 'a swatch does that.';

    function renderValidationBadge(pass) {
        const host = UI['validation-badge'];
        if (!host) return;

        const badge = computeValidationBadge(pass);
        if (badge.state === 'empty') {
            host.className = 'validation-badge badge-empty';
            host.innerHTML = `<div class="badge-head"><span class="badge-icon">${BADGE_ICONS.empty}</span>`
                + `<span class="badge-headline">${escapeHtml(badge.headline)}</span></div>`
                + `<p class="badge-detail">${escapeHtml(badge.detail)}</p>`;
            return;
        }

        const items = badge.elements.items.map(item => {
            const where = item.present
                ? `<span class="badge-source">from ${item.source === 'form' ? 'your project details' : 'the pattern'}</span>`
                : `<span class="badge-hint">${escapeHtml(item.hint)}</span>`;
            return `<li class="badge-el ${item.present ? 'is-present' : 'is-missing'}">`
                + `<span class="badge-el-icon">${item.present ? '✓' : '○'}</span>`
                + `<span class="badge-el-name">${escapeHtml(item.label)}</span>${where}</li>`;
        }).join('');

        host.className = `validation-badge badge-${badge.state}`;
        host.innerHTML = `
            <div class="badge-head">
                <span class="badge-icon">${BADGE_ICONS[badge.state]}</span>
                <span class="badge-headline">${escapeHtml(badge.headline)}</span>
            </div>
            <p class="badge-detail">${escapeHtml(badge.detail)}</p>
            <p class="badge-scope">${escapeHtml(BADGE_SCOPE)}</p>
            <ul class="badge-elements">${items}</ul>`;
    }

    /**
     * The pattern as pure geometry: every row's stitch count, and what it did to the one above.
     *
     * Prose is what makes a shape error hard to see. "Rnd 4: [2 sc, inc] x 6 (24)" is forty characters
     * in which the only number that decides whether the sphere closes is the 24, and a teacher reading
     * thirty of these is reading the same forty characters thirty times. Stripped to "R4: 24 +6" the
     * run reads as a curve, and a round that increases when it should hold is visible without
     * arithmetic.
     *
     * A view concern only, the same call groupRepeatedRows makes: nothing here re-evaluates anything,
     * and the export, the printout and the PDF still emit every row in full.
     */
    function renderOutline(pass, body, matrixLabelOverrides) {
        let previous = null;
        pass.validation.rows.forEach(({ step, index, evaluation, status, label }) => {
            // Prose is exactly what this view exists to remove.
            if (status === 'note') return;

            const tr = elem('tr');
            if (status === 'section') {
                tr.className = 'section-row';
                const td = elem('td');
                td.colSpan = 3;
                td.textContent = `--- ${label} ---`;
                tr.appendChild(td);
                body.appendChild(tr);
                previous = null;         // a new piece starts its own curve
                return;
            }

            tr.className = status === 'valid' ? 'row-passed' : (status === 'blocked' ? 'row-blocked' : 'row-failed');

            const tdRow = elem('td', 'outline-label',
                (matrixLabelOverrides && matrixLabelOverrides.get(index)) || label);
            const count = evaluation.calculatedYield ?? 0;
            const tdCount = elem('td', 'outline-count', String(count));

            const tdDelta = elem('td', 'outline-delta');
            if (status === 'valid') {
                if (previous === null) tdDelta.textContent = 'base';
                else {
                    const diff = count - previous;
                    tdDelta.textContent = diff > 0 ? `+${diff}` : diff < 0 ? String(diff) : '—';
                    tdDelta.className = `outline-delta ${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : 'is-flat'}`;
                }
                previous = count;
            } else tdDelta.textContent = status === 'blocked' ? 'blocked' : 'fails';

            tr.append(tdRow, tdCount, tdDelta);
            body.appendChild(tr);
        });
    }

    function renderHealthPanel(pass, health) {
        const prefix = pass.validation.labelPrefix;
        const total = pass.validation.rows.length;

        if (!health) {
            return `<div class="status-invalid"><strong>Analytics engine unavailable.</strong></div>`;
        }

        const band = health.score >= 90 ? 'health-good' : health.score >= 75 ? 'health-ok' : 'health-bad';

        // A check that found several separate faults lists them one per line. Run together they read as
        // a single sentence and the second fault gets missed - which is the whole reason it is reported.
        const checks = health.checks.map(c => {
            const many = Array.isArray(c.details) && c.details.length > 1;
            const detail = many
                ? `<ul class="check-detail check-detail-list">${c.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
                : `<span class="check-detail">${escapeHtml(c.detail)}</span>`;
            return `<li class="check-${c.state}"><span class="check-icon">${CHECK_ICONS[c.state]}</span>`
                + `<span class="check-name">${escapeHtml(c.name)}</span>`
                + detail + `</li>`;
        }).join('');

        const warnings = health.warnings.map(w =>
            `<li class="check-warn"><span class="check-icon">⚠</span><span class="check-name">${escapeHtml(w)}</span></li>`
        ).join('');

        const counts = [
            `<span><strong>${prefix}s Passed:</strong> ${pass.analytics.passedRowsCount} / ${total}</span>`,
            pass.analytics.blockedRowsCount ? `<span><strong>Blocked:</strong> ${pass.analytics.blockedRowsCount} (waiting on ${escapeHtml(pass.validation.blockedByLabel)})</span>` : '',
            `<span><strong>Total Stitches:</strong> ${pass.analytics.totalStitchesAllRounds.toLocaleString()}</span>`,
            `<span><strong>Total ${prefix}s:</strong> ${total}</span>`
        ].filter(Boolean).join('');

        return `
            <div class="health-panel ${band}">
                <div class="health-header">
                    <div><span class="health-number">${health.score}</span><span class="health-max"> / 100</span></div>
                    <div class="health-grade">${escapeHtml(health.grade)}</div>
                </div>
                <ul class="health-checks">${checks}${warnings}</ul>
                <div class="health-counts">${counts}</div>
                ${renderInferenceNotices()}
            </div>`;
    }

    /**
     * What was read off the pattern rather than asked for: sizing, construction, and the foundation
     * skip. These were form controls until the engine learned to read them, and a setting that
     * changes the reader's numbers without saying so is worse than the box it replaced - so each one
     * names the value AND the text it was taken from.
     *
     * An unconfident reading is marked rather than hidden. That is the case where no signal was found
     * and a prevalence default stood in, which is exactly when the reader most needs to know.
     */
    function renderInferenceNotices() {
        const notices = state.inferred?.notices || [];
        if (!notices.length) return '';

        const items = notices.map(n => {
            const because = n.basis
                ? `<span class="infer-basis">from ${escapeHtml(n.basis)}</span>`
                : `<span class="infer-basis infer-assumed">assumed &mdash; your pattern does not say</span>`;
            return `<li${n.confident ? '' : ' class="infer-unsure"'}>`
                + `<span class="infer-label">${escapeHtml(n.label)}:</span> `
                + `<strong>${escapeHtml(n.value)}</strong> ${because}</li>`;
        }).join('');

        return `<div class="health-inferred">`
            + `<h4>Read from your pattern</h4><ul class="infer-list">${items}</ul></div>`;
    }

    /**
     * Folds runs of identical consecutive rows into one display line. Purely a view concern -
     * evaluatePatternRows() is untouched, so the print area and text export still emit every row.
     *
     * A run only folds when the instruction, multiplier, calculated total AND status all match, which is
     * what lets one line stand for the group truthfully. Two exclusions: failed rows always render
     * individually (so they stay visible and jumpToFirstError still finds .row-failed), and the row
     * being inline-edited is never folded.
     */
    function groupRepeatedRows(rows) {
        if (!state.viewPrefs.collapseRepeats) return rows.map(r => ({ ...r, span: 1 }));

        const groups = [];
        rows.forEach(row => {
            const prev = groups[groups.length - 1];
            // The foundation chain is excluded because it carries no row number: a group prints its
            // range by stripping the prefix off both end labels, and "Foundation" has no number left
            // behind to print.
            const foldable = (row.status === 'valid' || row.status === 'blocked') && !row.isFoundation;
            const matches = prev
                && foldable
                && !prev.isFoundation
                && prev.status === row.status
                && prev.step.instructionString === row.step.instructionString
                && prev.step.multiplier === row.step.multiplier
                && prev.evaluation.calculatedYield === row.evaluation.calculatedYield
                && state.editingIndex !== row.index
                && state.editingIndex !== prev.index;

            // A section marker is not foldable (its status is neither valid nor blocked),
            // so a group can never span a section boundary.
            if (matches) { prev.span++; prev.lastIndex = row.index; prev.lastLabel = row.label; }
            else groups.push({ ...row, span: 1, lastIndex: row.index, lastLabel: row.label });
        });
        return groups;
    }

    /**
     * A pattern that states its foundation chain as its own "Row 0", one line above the row worked
     * into it ("Row 0: ch 13. turn" / "Row 1: sk 1, 12 sc."), collides with the restart-on-restated-1
     * rule: the chain is the document's first row and already reads as "Row 1" by position, then the
     * explicit "Row 1" below it restates the count back to 1 and lands on the same label. Matrix-only
     * fix - the two are shown as "(Row 1)" and "(Row 1 cont.)" so the reader can tell them apart.
     * `label` itself is untouched, so export, the health panel and jump-to-error still see the pair
     * the engine actually computed.
     *
     * Deliberately narrow, the same way inferUnstatedSkip's two-line shape is: only the document's
     * first two rows are checked, and only when their labels would otherwise print identically.
     */
    function matrixFoundationLabelOverride(rows, labelPrefix) {
        const first = rows[0], second = rows[1];
        if (!first || !second || first.status === 'note' || first.status === 'section') return null;
        // "Row 0" is not a real label anyone writes except for a foundation chain, so requiring it is
        // the narrowing check - it does not also require initialChain to have parsed, which it does
        // not when the chain shares its line with "turn" or other trailing text.
        if (first.step.rangeStartRow !== 0 || second.step.rangeStartRow !== 1) return null;
        if (first.label !== second.label) return null;
        const prefix = labelPrefix.toLowerCase();
        return new Map([[first.index, `(${prefix} 1)`], [second.index, `(${prefix} 1 cont.)`]]);
    }

    function renderUI() {
        UI['step-sequence-body'].innerHTML = '';
        let previousValidYield = null;

        // The one path that wants the aggregate: health reads the stitch totals, and asking for them
        // here means the pass carries them rather than computePatternHealth walking the rows again.
        const pass = evaluatePatternRows({ withComplexity: true });
        // The finished-size panel also refreshes on gauge keystrokes, which have no pattern pass of
        // their own, so the latest one is kept for it to read.
        state.analytics.lastPass = pass;
        const { labelPrefix, allStepsValid } = pass.validation;
        const { passedRowsCount, failedRowsCount, blockedRowsCount, totalStitchesAllRounds } = pass.analytics;
        const matrixLabelOverrides = matrixFoundationLabelOverride(pass.validation.rows, labelPrefix);

        // The badge is drawn by refreshPatternUI, which finishRenderUI reaches on both paths below -
        // one call site rather than two, because it is also what redraws the badge when only the
        // metadata changed. state.analytics.lastPass is this pass by the time it runs.
        //
        // The outline replaces the matrix rather than sitting beside it: the point is to have nothing
        // else on screen. Everything below - the health panel, the print area, the linter - is
        // untouched, because this decides nothing and only chooses what the table shows.
        const outlineOnly = !!UI['toggle-outline-view']?.checked;
        UI['matrix-section']?.classList.toggle('is-outline', outlineOnly);
        if (outlineOnly) {
            renderOutline(pass, UI['step-sequence-body'], matrixLabelOverrides);
            if (UI['jump-error-btn']) {
                UI['jump-error-btn'].style.display = allStepsValid ? 'none' : 'inline-block';
            }
            finishRenderUI(pass);
            return;
        }

        let renderedAWorkRow = false;
        groupRepeatedRows(pass.validation.rows).forEach(({ step, index, evaluation: engineEvaluation, status: rowStatus, span, label, lastLabel, blockedBy }) => {
            const tr = elem('tr');

            // Text that makes no fabric: shown where it was written, with no counts and no verdict, so
            // the user can see it was read and decide whether it belongs.
            if (rowStatus === 'note') {
                tr.className = 'note-row';
                const td = elem('td');
                td.colSpan = 7;
                td.textContent = label;
                td.title = `Not validated — ${step.noteReason}`;
                tr.appendChild(td);
                UI['step-sequence-body'].appendChild(tr);
                return;
            }

            // A section title spans the whole table: a divider between pieces, not a row of work, with
            // no counts of its own to show.
            if (rowStatus === 'section') {
                tr.className = 'section-row';
                const td = elem('td');
                td.colSpan = 7;
                td.textContent = `--- ${label} ---`;
                tr.appendChild(td);
                UI['step-sequence-body'].appendChild(tr);
                previousValidYield = null;   // trends restart with the new piece
                return;
            }

            tr.className = rowStatus === 'valid' ? 'row-passed' : (rowStatus === 'blocked' ? 'row-blocked' : 'row-failed');
            const isEditing = (state.editingIndex === index);

            const tdRow = elem('td');
            // "Rows 3-7 x5". Both ends come from row.label rather than the array index, so a group
            // inside a section reports that section's own numbering.
            if (span > 1) {
                const firstNum = label.replace(/^\D+/, '');
                const lastNum = String(lastLabel || '').replace(/^\D+/, '');
                tdRow.innerHTML = `${labelPrefix}s ${escapeHtml(firstNum)}-${escapeHtml(lastNum)}<span class="repeat-count">×${span}</span>`;
            } else tdRow.textContent = (matrixLabelOverrides && matrixLabelOverrides.get(index)) || label;
            const tdInst = elem('td');
            if (isEditing) tdInst.innerHTML = `<input type="text" id="inline-input-${index}" class="inline-edit-input" value="${escapeHtml(stepEditText(step))}">`;
            else if (step.instructionString) tdInst.innerHTML = turningChainMarkup(step)
                + highlightUnknownTokens(step.instructionString, engineEvaluation.unknownTokens);
            else tdInst.textContent = `Chain ${step.initialChain}`;

            const tdMult = elem('td');
            if (isEditing) tdMult.innerHTML = `<div class="inline-edit-mult"><span>x</span><input type="number" id="inline-mult-${index}" value="${step.multiplier}" min="1"></div>`;
            else tdMult.textContent = `x${step.multiplier}`;

            const tdExp = elem('td'); tdExp.textContent = step.expectedYield;

            // For a collapsed group every row shares one yield, so the net change across the group is
            // the same as its first row's.
            let trendBadgeHtml = '';
            if (rowStatus === 'valid' && engineEvaluation.calculatedYield !== undefined) {
                if (state.viewPrefs.showTrendMarkers) {
                    if (previousValidYield === null) trendBadgeHtml = `<span class="trend-badge trend-base" title="Starting stitch count">Base</span>`;
                    else {
                        const diff = engineEvaluation.calculatedYield - previousValidYield;
                        if (diff > 0) trendBadgeHtml = `<span class="trend-badge trend-up" title="Increased by ${diff}">▲ +${diff}</span>`;
                        else if (diff < 0) trendBadgeHtml = `<span class="trend-badge trend-down" title="Decreased by ${Math.abs(diff)}">▼ ${diff}</span>`;
                        else trendBadgeHtml = `<span class="trend-badge trend-flat" title="No change">▶ 0</span>`;
                    }
                }
                // Advances whether or not the markers are drawn, so hiding them cannot change what the
                // next visible marker reports.
                previousValidYield = engineEvaluation.calculatedYield;
            }

            const tdCalc = elem('td'); tdCalc.innerHTML = `<span class="calc-total">${engineEvaluation.calculatedYield ?? 0}</span> ${trendBadgeHtml}`;
            const statusCell = elem('td');
            renderMathCheck(statusCell, rowStatus, engineEvaluation, blockedBy);

            renderedAWorkRow = true;

            const actionCell = elem('td'); actionCell.style.textAlign = 'right';
            if (isEditing) actionCell.innerHTML = `<div class="row-actions"><button type="button" onclick="window.saveInlineEdit(${index})" class="row-button is-primary is-small">Save</button><button type="button" onclick="window.cancelInlineEdit()" class="row-button is-small">Cancel</button></div>`;
            else actionCell.innerHTML = `<button type="button" onclick="window.enableInlineEdit(${index})" class="row-button">Edit</button>`;

            tr.append(tdRow, tdInst, tdMult, tdExp, tdCalc, statusCell, actionCell);
            UI['step-sequence-body'].appendChild(tr);
        });

        // allStepsValid is fixed for the whole pass, so this used to be rewritten once per row. The flag
        // keeps the one case the in-loop write also skipped: a pattern that is all notes and headings
        // never reached this line, and leaves the button exactly as it was.
        if (renderedAWorkRow && UI['jump-error-btn']) {
            UI['jump-error-btn'].style.display = allStepsValid ? 'none' : 'inline-block';
        }

        finishRenderUI(pass);
    }

    /**
     * Everything renderUI does once the table is drawn, whichever table that was.
     *
     * Split out when the geometric outline gave the matrix a second shape: the health panel, the
     * printout, the linter and the announcement are all read off the SAME pass and must run for both,
     * and two copies of this tail is one copy free to be forgotten. The outline path returns through
     * here rather than duplicating five calls.
     */
    function finishRenderUI(pass) {
        const labelPrefix = pass.validation.labelPrefix;
        const totalSteps = state.patternSteps.length;
        // The status pill's row counter. Set here rather than only in renderProgress because the
        // pattern changes far more often than the progress store does - every parse, undo, clear
        // and load passes through this tail, and a counter that only moved when points were earned
        // would sit there stale for most of a writing session.
        setText('row-count', totalSteps.toLocaleString());
        // Same reason: the parse that just ran is what decides whether Draft and Export are ticked.
        refreshStageRail();
        if (totalSteps === 0) {
            UI['cumulative-status'].innerHTML = `<p class="placeholder-text">No pattern steps configured.<br>Add a ${labelPrefix.toLowerCase()} to begin validation.</p>`;
        } else {
            const health = computePatternHealth(pass);
            state.analytics.health = health;
            UI['cumulative-status'].innerHTML = renderHealthPanel(pass, health);
        }

        renderPrintArea(pass);
        refreshPatternUI();
        // The pass that drew the matrix draws the cues too, rather than the linter making a second one
        // that could disagree with what the table is showing.
        runLint(pass);
        // After runLint, so the sentence can carry the suggestion count the sidebar is about to show.
        announceValidation(pass);
    }

    // === 8d. PATTERN LINTER === //
    /*
     * A second reader of the validation pass. Nothing here decides whether a row is right - that is
     * settled by evaluatePatternRows() and the engine underneath it - and nothing here parses a
     * pattern. It takes the `fixes` each row already carries, puts them under the text in the editor,
     * and offers to apply them.
     *
     * The editor is still a plain <textarea>. The cues live on a copy of the text underneath it
     * (#lint-mirror), so the caret, selection, undo history and IME all remain the browser's. That
     * copy is only trustworthy because it and the textarea share one CSS rule for every metric that
     * can move a line break - see section 5d.
     */

    // Lowest to highest urgency, for rolling several findings on one line down to the single colour
    // the gutter mark and underline can show. A style suggestion never outranks an arithmetic fault.
    const LINT_SEVERITY_RANK = { style: 1, syntax: 2, math: 3 };

    /**
     * Resolves one of the engine's semantic edits against the line as the designer actually wrote it.
     *
     * The engine never sees that line: by the time a row reaches evaluateStep its label and written
     * count have been parsed off, so an edit says WHAT to change ("the x3", "the count in brackets")
     * and this is where it becomes a character change. Returns null when the target cannot be found,
     * which is a fix that will be offered as advice instead of as a button.
     */
    function applyLintEdit(line, edit, instruction) {
        const text = String(line ?? '');
        if (!edit) return null;

        if (edit.target === 'multiplier') {
            // The shapes extractMultiplier and analyzeRepeatUnit both read: "x 3", "x3", "rep 3",
            // "repeat 3 times", "* 3". The LAST one stating the number the engine measured is the one
            // that moves - a row can carry both a bracket's own count and the row's.
            //
            // "*" sits OUTSIDE the \b rather than inside the alternation with the words: a word
            // boundary before "*" asks the character before it to be a word character, which in
            // "(2 sc, inc) * 5" is a space - so written the obvious way this never matches, the edit
            // resolves to null, and a correction the engine had already worked out degrades silently
            // to advice with no button.
            const re = /(?:\b(?:x|times|rep(?:eat)?)|\*)\s*(\d+)/gi;
            let match, last = null;
            while ((match = re.exec(text)) !== null) {
                if (parseInt(match[1], 10) === edit.from) last = match;
            }
            if (!last) return null;
            const at = last.index + last[0].length - last[1].length;
            return text.slice(0, at) + edit.to + text.slice(at + last[1].length);
        }

        if (edit.target === 'statedCount') {
            // The written count is a parenthesised number, usually last on the line: "(42)", "(42 sts)".
            const re = /\(\s*(\d+)[^)]*\)/g;
            let match, last = null;
            while ((match = re.exec(text)) !== null) {
                if (parseInt(match[1], 10) === edit.from) last = match;
            }
            if (!last) return null;
            const at = last.index + last[0].indexOf(last[1]);
            return text.slice(0, at) + edit.to + text.slice(at + last[1].length);
        }

        if (edit.target === 'insert') {
            // A missing closer goes at the end of the instruction, which is BEFORE the written count -
            // appended after it, the bracket would swallow the count into the group it closes.
            const tail = text.match(/(\s*\(\s*\d+[^)]*\)\s*\.?\s*|\s*\.?\s*)$/)[1];
            return text.slice(0, text.length - tail.length) + edit.text + tail;
        }

        if (edit.target === 'foundationOrdinal') {
            // Rewrites a bare leading count of the guessed stitch ("6 sc") into the same row spelled
            // out with its starting chain named ("sc in 2nd ch from hook, 5 sc") - the stitch total is
            // unchanged, just no longer left for the reader to assume. Only offered as a button when
            // buildUnstatedSkipFix already confirmed the line matches this exact shape.
            const re = new RegExp(`\\b${edit.count}\\s+${edit.stitch}\\b`, 'i');
            const match = text.match(re);
            if (!match) return null;
            const rest = edit.count - 1;
            const replacement = rest > 0
                ? `${edit.stitch} in ${edit.ordinal} ch from hook, ${rest} ${edit.stitch}`
                : `${edit.stitch} in ${edit.ordinal} ch from hook`;
            return text.slice(0, match.index) + replacement + text.slice(match.index + match[0].length);
        }

        if (edit.target === 'repeatPhrasing') {
            // The engine matched this bracket on the row's instruction, which is the raw line minus its
            // label, so the same substring is present here verbatim. indexOf rather than a rebuilt
            // regex: `from` is literal pattern text full of brackets and asterisks, and escaping it to
            // search for itself would be work done only to undo it. A miss returns null and the
            // suggestion degrades to advice - which is also what happens on a graded row, where
            // resolveSizeVariants substituted a size into the instruction and the line no longer
            // contains what the engine read.
            const at = text.indexOf(edit.from);
            if (at < 0) return null;
            return text.slice(0, at) + edit.to + text.slice(at + edit.from.length);
        }

        if (edit.target === 'replaceAt') {
            // `occurrence` counts delimiters within the instruction, so counting starts where the
            // instruction starts. Without that offset a bracket in the row's preamble would shift
            // every position and the wrong character would be rewritten.
            const from = instruction ? text.indexOf(instruction) : -1;
            let count = 0;
            for (let i = from >= 0 ? from : 0; i < text.length; i++) {
                if (text[i] !== edit.from) continue;
                if (count === edit.occurrence) return text.slice(0, i) + edit.to + text.slice(i + 1);
                count++;
            }
            return null;
        }

        return null;
    }

    /**
     * Every fix in one pass, in document order, minus the ones the user has dismissed.
     *
     * A blocked row is skipped outright: it sits downstream of a failure and its numbers come from a
     * stitch count that was never produced, so correcting them would be acting on arithmetic nobody
     * can trust yet. That is the same call renderMathCheck makes for the matrix.
     */
    function collectFindings(pass) {
        const out = [];
        const seen = {};
        pass.validation.rows.forEach(row => {
            const step = row.step || {};
            if (step.isNote || step.isSection) return;
            if (typeof step.lineIndex !== 'number') return;

            (row.evaluation.fixes || []).forEach(fix => {
                const key = `${step.lineIndex}:${fix.id}`;
                // "Rows 3-7" is five steps built from one line, and every one of them reports the same
                // fault about the same text. One line, one finding.
                if (seen[key] || state.linter.ignored[key]) return;
                seen[key] = true;
                out.push({
                    key, id: fix.id, lineIndex: step.lineIndex, label: row.label,
                    instruction: step.instructionString || '',
                    severity: fix.severity, title: fix.title, detail: fix.detail, lesson: fix.lesson,
                    edit: fix.edit,
                    // Set only on a row downstream of a failure, and only for a finding whose numbers
                    // came from the count that failure never produced. See dependsOnUpstream below.
                    blockedBy: (row.status === 'blocked' && fix.severity === 'math') ? row.blockedBy : null
                });
            });
        });
        return out;
    }

    /** Small builder, because most of the UI is created rather than written as HTML: buttons have to
     *  be wired, and a generated control needs an id to be reachable at all under the headless stub.
     *  Text is assigned rather than interpolated, so nothing here can carry markup. */
    function elem(tag, className, text, id) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (id) node.id = id;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    /** A generated button. type="button" is not a default worth forgetting: inside a <form> an
     *  untyped button submits, which reloads the page and loses the pattern. */
    function button(className, text, id, onClick) {
        const node = elem('button', className, text, id);
        node.type = 'button';
        if (onClick) node.addEventListener('click', onClick);
        return node;
    }

    /** Fills a <select> from [value, label] pairs. The signature guard is what keeps a redraw from
     *  discarding the user's choice: rebuilding the options resets selectedIndex, so an unchanged
     *  list must not be rebuilt at all. */
    function fillSelect(select, pairs, signature) {
        if (!select) return false;
        if (signature !== undefined) {
            if (select.dataset.signature === signature) return false;
            select.dataset.signature = signature;
        }
        select.replaceChildren();
        pairs.forEach(([value, label]) => {
            const option = elem('option', null, label === undefined ? value : label);
            option.value = value;
            select.appendChild(option);
        });
        return true;
    }

    /** What the line says now against what it would say. Computed from the live textarea rather than
     *  from the pass, so what the user is shown is what will actually be written. */
    function lintDiff(finding) {
        const box = UI['bulk-input'];
        if (!finding.edit || !box) return null;
        const before = String(box.value || '').split('\n')[finding.lineIndex];
        if (before === undefined) return null;
        const after = applyLintEdit(before, finding.edit, finding.instruction);
        return (after === null || after === before) ? null : { before, after };
    }

    /**
     * One finding, drawn the same way in the tooltip and in the sidebar. A fix with no applicable edit
     * gets no Apply button - an unknown stitch is advice, not a correction, and a button that rewrote
     * a designer's own term on a guess would be worse than the underline it replaced.
     */
    function renderFixCard(finding, into, idPrefix, titleClass, detailClass) {
        into.appendChild(elem('p', titleClass, finding.title));
        if (finding.detail) into.appendChild(elem('p', detailClass, finding.detail));
        // The general "why this is the standard" sentence, distinct from detail's claim about this
        // row's own text - only style findings carry one today. Reuses the idPrefix-based class
        // naming detail already uses, so the tooltip and the sidebar card each pick up their own rule.
        if (finding.lesson) {
            into.appendChild(elem('p', idPrefix === 'lint-tip' ? 'lint-tip-lesson' : 'lint-item-lesson', finding.lesson));
        }

        // A row downstream of a failure is still read, and what it says about its OWN text - an
        // unclosed bracket, a term not in the dictionary - is true whatever happens above it. Its
        // arithmetic is not: it was measured against the last count that was actually produced, which
        // is not the count this row will be worked into once the failure above is fixed. So the
        // suggestion is shown and can be taken, but it says what it is resting on first.
        if (finding.blockedBy) {
            into.appendChild(elem('p', 'lint-depends',
                `Counted from before ${finding.blockedBy}, which does not add up yet. `
                + `Fix that row first — this one may resolve itself.`));
        }

        const diff = lintDiff(finding);
        if (diff) {
            const box = elem('div', 'lint-diff');
            box.appendChild(elem('del', 'lint-diff-old', diff.before));
            box.appendChild(elem('ins', 'lint-diff-new', diff.after));
            into.appendChild(box);
        }

        const actions = elem('div', idPrefix === 'lint-tip' ? 'lint-tip-actions' : 'lint-item-actions');
        if (diff) {
            const applyLabel = finding.severity === 'style' ? 'Accept Suggested Formatting' : 'Suggest a fix';
            actions.appendChild(button('row-button is-primary is-small', applyLabel,
                `${idPrefix}-apply-${finding.lineIndex}`, () => applyLintFix(finding)));
        }
        actions.appendChild(button('row-button is-small', 'Ignore',
            `${idPrefix}-ignore-${finding.lineIndex}`, () => ignoreLintFinding(finding)));
        into.appendChild(actions);
        return into;
    }

    /** Repaints the copy of the text that carries the underlines. */
    function paintLintCues() {
        const mirror = UI['lint-mirror'];
        const box = UI['bulk-input'];
        if (!mirror || !box) return;

        mirror.replaceChildren();
        // Each line is its own block, so no newline text nodes are needed and an empty line still
        // takes a line box (min-height in section 5d) instead of collapsing and shifting every line
        // under it up by one.
        state.linter.lineEls = String(box.value || '').split('\n').map((text, i) => {
            const group = state.linter.byLine[i];
            const span = elem('span', 'lint-line' + (group ? ` lint-mark-${group.severity}` : ''),
                text, `lint-line-${i}`);
            mirror.appendChild(span);
            return span;
        });

        paintLintGutter();
    }

    /** The margin marks. Positioned from each line's MEASURED offset rather than from a line number
     *  times a line height: a row that wraps is taller than one line, and every mark below it would
     *  drift by the difference. */
    function paintLintGutter() {
        const gutter = UI['lint-gutter'];
        if (!gutter) return;
        gutter.replaceChildren();
        state.linter.markEls = [];

        Object.keys(state.linter.byLine).forEach(key => {
            const i = Number(key);
            const span = state.linter.lineEls[i];
            const group = state.linter.byLine[i];
            if (!span) return;

            const mark = button(`lint-gutter-mark lint-gutter-${group.severity}`, null, `lint-gutter-${i}`);
            mark.title = group.items.length === 1
                ? group.items[0].title
                : `${group.items.length} suggestions on this line`;
            // A style suggestion is a teaching note, not an alert - the open-book glyph already used
            // for the Stitch Library says that without a new asset.
            const icon = group.severity === 'style' ? 'ic-book' : 'ic-alert';
            mark.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#${icon}"></use></svg>`;
            mark.addEventListener('click', () => openLintTip(i));
            gutter.appendChild(mark);
            state.linter.markEls.push({ el: mark, lineIndex: i });
        });

        positionLintMarks();
    }

    /**
     * Moves each margin mark to its line's measured offset.
     *
     * Kept apart from painting them because the measurement is only real once the panel is on screen.
     * Validating from another tab paints the marks against a hidden box, where every offset reads 0 and
     * they stack at the top of the gutter - so this runs again when the Studio view is opened, and on a
     * resize, which re-wraps the rows and moves every line under the first one that changed.
     */
    function positionLintMarks() {
        (state.linter.markEls || []).forEach(({ el, lineIndex }) => {
            const span = state.linter.lineEls[lineIndex];
            // No layout to measure headlessly, and none needed: the mark is still built, still classed
            // and still wired, which is everything but where it sits.
            if (span && typeof span.offsetTop === 'number') el.style.top = `${span.offsetTop}px`;
        });
        syncLintScroll();
    }

    function syncLintScroll() {
        const box = UI['bulk-input'];
        if (!box || typeof box.scrollTop !== 'number') return;
        if (UI['lint-mirror']) UI['lint-mirror'].scrollTop = box.scrollTop;
        if (UI['lint-gutter']) UI['lint-gutter'].scrollTop = box.scrollTop;
    }

    function closeLintTip() {
        state.linter.openLine = null;
        if (UI['lint-tip']) UI['lint-tip'].classList.add('hidden');
    }

    /** Opens the frosted card against a line, or closes it if that line has nothing to say. */
    function openLintTip(lineIndex) {
        const tip = UI['lint-tip'];
        if (!tip) return;
        const group = state.linter.byLine[lineIndex];
        if (!group) return closeLintTip();

        state.linter.openLine = lineIndex;
        tip.replaceChildren();
        group.items.forEach(finding => {
            renderFixCard(finding, tip, 'lint-tip', 'lint-tip-title', 'lint-tip-detail');
        });

        const span = state.linter.lineEls[lineIndex];
        if (span && typeof span.offsetTop === 'number') {
            const box = UI['bulk-input'];
            const scrolled = span.offsetTop - (box && typeof box.scrollTop === 'number' ? box.scrollTop : 0);
            tip.style.top = `${scrolled + (span.offsetHeight || 22) + 6}px`;
            tip.style.left = '42px';
        }
        tip.classList.remove('hidden');
    }

    /** Keys that move the caret without changing the text. */
    const CARET_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End',
                        'PageUp', 'PageDown'];

    /** Which line the caret is on. The cue itself cannot be clicked - it is behind a textarea that
     *  must keep every pointer event - so the caret is what says which line the user means. */
    function lintLineAtCaret() {
        const box = UI['bulk-input'];
        if (!box || typeof box.selectionStart !== 'number') return null;
        return String(box.value || '').slice(0, box.selectionStart).split('\n').length - 1;
    }

    function openLintTipAtCaret() {
        const line = lintLineAtCaret();
        if (line === null) return;
        if (state.linter.byLine[line]) openLintTip(line);
        else closeLintTip();
    }

    function renderLintSidebar() {
        const tally = UI['lint-side-tally'];
        const body = UI['lint-side-body'];
        const count = state.linter.findings.length;

        const tallyText = count === 0
            ? 'No suggestions'
            : `${count} suggestion${count === 1 ? '' : 's'} available`;
        if (tally) tally.textContent = tallyText;

        // The collapsed rail hides the sentence for want of room, so the count carries it there instead
        // - and the button's accessible name carries it in both states, which it had in neither: the
        // icon is aria-hidden and the tally is display:none, so the control announced as an empty button.
        if (UI['lint-side-badge']) UI['lint-side-badge'].textContent = count ? String(count) : '';
        const toggle = UI['lint-side-toggle'];
        if (toggle) {
            toggle.setAttribute('aria-label', tallyText);
            toggle.setAttribute('aria-expanded', String(!state.linter.collapsed));
        }

        const side = UI['lint-side'];
        if (side) {
            side.classList.toggle('is-collapsed', state.linter.collapsed);
            // Drives whether the collapsed rail shows a count at all - see style.css section 5d.
            side.classList.toggle('has-findings', count > 0);
        }
        if (!body) return;

        body.replaceChildren();
        if (!count) {
            body.appendChild(elem('p', 'lint-empty',
                'Nothing to suggest. Anything Stitch Math can help with will appear here as you write.'));
            return;
        }

        // Accept-all is the one action where the reader does not see each diff before it is written,
        // so it takes only the corrections that stand on their own. A downstream row's arithmetic is
        // offered individually - with its dependency stated and its diff on screen - but never applied
        // in bulk against a count the pattern has not produced yet.
        const applicable = state.linter.findings.filter(f => !f.blockedBy && lintDiff(f));
        // The repeat recommendation is raised once for the document, so its bulk action is offered
        // beside it: "Accept all" would spell out only the one row the card happens to sit on, which
        // is not what a writer agreeing to the convention means. Only shown when more than that one
        // row would actually change - on a pattern with a single repeat the two buttons would do the
        // same thing under different names.
        const shorthandRows = state.linter.findings.some(f => f.id === 'repeat-shorthand')
            ? repeatShorthandLines() : [];

        if (applicable.length || shorthandRows.length > 1) {
            const batch = elem('div', 'lint-side-batch');
            if (applicable.length) {
                batch.appendChild(button('row-button is-primary is-small',
                    `Accept all (${applicable.length})`, 'lint-accept-all', applyAllLintFixes));
            }
            if (shorthandRows.length > 1) {
                batch.appendChild(button('row-button is-small',
                    `Standardize All (${shorthandRows.length})`, 'lint-standardize-all', standardizeAllRepeats));
            }
            batch.appendChild(button('row-button is-small', 'Reject all',
                'lint-reject-all', ignoreAllLintFindings));
            body.appendChild(batch);
        }

        state.linter.findings.forEach((finding, i) => {
            const item = elem('div', 'lint-item', null, `lint-item-${i}`);
            item.appendChild(elem('p', 'lint-item-row', finding.label || `Line ${finding.lineIndex + 1}`));
            renderFixCard(finding, item, `lint-side-${i}`, 'lint-item-title', 'lint-item-detail');
            body.appendChild(item);
        });
    }

    function applyLintFix(finding) {
        const box = UI['bulk-input'];
        const diff = lintDiff(finding);
        if (!box || !diff) return false;

        const lines = String(box.value || '').split('\n');
        lines[finding.lineIndex] = diff.after;
        box.value = lines.join('\n');
        // Recorded here, where the correction is actually accepted. Not on the finding appearing,
        // which would reward writing bad rows, and not on dismissal, which would reward ignoring
        // advice. See recordLesson.
        recordLesson(finding);
        closeLintTip();
        // Back through the ordinary parse, so a correction accepted here is read exactly as one typed
        // by hand. Nothing writes to state.patternSteps directly: handleBulkSubmit rebuilds it from
        // the text, and renderUI re-runs the linter at the end of it.
        handleBulkSubmit();
        // The card that was just clicked has been rebuilt and the button no longer exists, so focus was
        // being dropped to the top of the document with no announcement. Send it to the text instead,
        // with the caret on the line that changed - which is where someone accepting a fix wants to be
        // whether they are using a mouse or not. announceValidation has already spoken by this point.
        if (typeof box.focus === 'function') {
            box.focus();
            const line = finding.lineIndex;
            const upTo = lines.slice(0, line).join('\n').length + (line ? 1 : 0);
            if (typeof box.setSelectionRange === 'function') {
                box.setSelectionRange(upTo, upTo + (lines[line] || '').length);
            }
        }
        return true;
    }

    /** Which lines of the live text hold a repeat this can rewrite. Read from the textarea rather than
     *  from the pass, for the same reason lintDiff is: what the count promises is what will be written. */
    function repeatShorthandLines() {
        const box = UI['bulk-input'];
        if (!box) return [];
        return String(box.value || '').split('\n')
            .map((line, i) => (window.CrochetMathEngine.standardizeRepeatText(line) ? i : -1))
            .filter(i => i >= 0);
    }

    /**
     * The whole document's repeats, spelled out in one press.
     *
     * The counterpart to raising the recommendation only once: the writer is being asked about a
     * convention for the pattern, so the answer is applied to the pattern. Safe to run unread in a way
     * the arithmetic fixes are not - buildRepeatPhrasing reads every rewrite back through the tokenizer
     * and refuses any that would change the stitches, so this cannot move a count.
     */
    function standardizeAllRepeats() {
        const box = UI['bulk-input'];
        if (!box) return;

        const lines = String(box.value || '').split('\n');
        let changed = 0;
        lines.forEach((line, i) => {
            const next = window.CrochetMathEngine.standardizeRepeatText(line);
            if (next && next !== line) { lines[i] = next; changed++; }
        });

        if (!changed) return;
        box.value = lines.join('\n');
        closeLintTip();
        handleBulkSubmit();
    }

    function applyAllLintFixes() {
        const box = UI['bulk-input'];
        if (!box) return;

        const lines = String(box.value || '').split('\n');
        const done = {};
        let changed = 0;
        // Bottom-up, so an applied edit cannot move a line another finding is pointed at. One edit per
        // line per round: two corrections to the same line were each computed against the text as it
        // stands now, and the second would be applied to a line that no longer matches it. Whatever is
        // left is offered again on the next pass, against the corrected text.
        state.linter.findings
            .filter(f => f.edit && !f.blockedBy)
            .slice()
            .sort((a, b) => b.lineIndex - a.lineIndex)
            .forEach(finding => {
                if (done[finding.lineIndex]) return;
                const before = lines[finding.lineIndex];
                if (before === undefined) return;
                const after = applyLintEdit(before, finding.edit, finding.instruction);
                if (after === null || after === before) return;
                lines[finding.lineIndex] = after;
                done[finding.lineIndex] = true;
                // Accepting them in a batch is still accepting them, so each one that carries a
                // lesson records it. recordLesson is first-time-only, so a fix applied here and again
                // by hand tomorrow does not move its date.
                recordLesson(finding);
                changed++;
            });

        if (!changed) return;
        box.value = lines.join('\n');
        closeLintTip();
        handleBulkSubmit();
    }

    /** Clears the cue and leaves the text alone - that is the whole contract of Ignore. */
    function ignoreLintFinding(finding) {
        state.linter.ignored[finding.key] = true;
        closeLintTip();
        runLint();
    }

    function ignoreAllLintFindings() {
        state.linter.findings.forEach(f => { state.linter.ignored[f.key] = true; });
        closeLintTip();
        runLint();
    }

    function toggleLintSidebar() {
        state.linter.collapsed = !state.linter.collapsed;
        renderLintSidebar();
    }

    /**
     * The linter's one entry point. Given the pass that drew the matrix it reads that; called without
     * one - from a keystroke - it makes a scratch pass with evaluateAtSize, which swaps
     * state.patternSteps out and restores it in a finally, so linting while drafting cannot disturb
     * the matrix, the health panel or anything else reading the live steps.
     */
    function runLint(pass) {
        if (!UI['lint-mirror']) return;

        const raw = UI['bulk-input'] ? String(UI['bulk-input'].value || '') : '';
        const source = pass || (raw.trim() ? evaluateAtSize(raw, state.sizeIndex) : null);
        state.linter.findings = source ? collectFindings(source) : [];

        state.linter.byLine = state.linter.findings.reduce((byLine, finding) => {
            const group = byLine[finding.lineIndex]
                || (byLine[finding.lineIndex] = { severity: finding.severity, items: [] });
            group.items.push(finding);
            // A line with any arithmetic fault reads as one: the coral wave is the more urgent of the
            // three cues, and a line carrying more than one should not be dressed as the mildest of
            // them. Ranked rather than a single "is it math" check, now that a third severity exists -
            // whichever finding arrives first must not lock the group at the wrong colour.
            if (LINT_SEVERITY_RANK[finding.severity] > LINT_SEVERITY_RANK[group.severity]) {
                group.severity = finding.severity;
            }
            return byLine;
        }, {});

        if (state.linter.openLine !== null && !state.linter.byLine[state.linter.openLine]) closeLintTip();
        paintLintCues();
        renderLintSidebar();
    }

    // Debounced, because a pass on every keystroke is a parse of the whole document per character.
    // runLint itself stays synchronous and is what the tests and the render path call: the timers
    // behave differently under each runner, and correctness should not depend on which one is used.
    let lintTimer = null;
    function scheduleLint() {
        if (lintTimer !== null && typeof clearTimeout === 'function') clearTimeout(lintTimer);
        lintTimer = setTimeout(() => { lintTimer = null; runLint(); }, 400);
    }

    function refreshPatternUI() {
        calculatePatternStats(state.patternSteps);
        if (typeof renderGaugeHistory === "function") {
            renderGaugeHistory();
        }
        // Two of the badge's four required elements can be satisfied from the metadata form and the
        // gauge calculator, neither of which re-validates the pattern - so typing a hook size left the
        // badge saying it was still missing until the next Validate. Redrawn from the last pass rather
        // than a new one: nothing about the metadata changes what the rows count, and re-walking the
        // pattern on every keystroke in another panel would be a parse per character.
        if (state.analytics.lastPass) renderValidationBadge(state.analytics.lastPass);
    }
    
    function calculatePatternStats(stepObjects) {
        if (!window.CrochetAnalyticsEngine) return;
        syncMetadataToGauge();

        const yarnWeight = yarnWeightNumber();

        const report = window.CrochetAnalyticsEngine.GenerateFullReport(
            stepObjects,
            {
                yarnWeight, gauge: state.gauge, history: state.gaugeHistory,
                rows: state.analytics.lastPass ? state.analytics.lastPass.validation.rows : [],
                sizingCategory: state.gauge.sizingCategory,
                sizingPiece: state.gauge.sizingPiece
            }
        );

        state.analytics.report = report;

        // Banked before anything draws. renderGrader below reaches the dashboard on its own, and the
        // dashboard is where the stitch roll settles - so crediting after it would price today's roll
        // against yesterday's streak and report a record one compile behind itself.
        touchActivity();
        creditPatternWork(report);

        // Strictly using cached UI elements
        if (UI["stat-total-stitches"]) UI["stat-total-stitches"].textContent = report.totalStitches.toLocaleString();

        if (UI["stat-difficulty"]) {
            UI["stat-difficulty"].textContent = report.difficulty.level;
            UI["stat-difficulty"].style.backgroundColor = report.difficulty.badgeColor;
            UI["stat-difficulty"].style.color = report.difficulty.badgeInk;
        }

        applyAutoDifficulty(report);
        renderSectionCount();
        renderGrader({ skipDashboard: true });
        renderComplexity(report.complexity);
        syncSizingPiece();
        renderFinishedSize();
        // The dashboard and the stitch list both summarise what the calls above just worked out, so they
        // are refreshed here rather than on their own schedule - there is no moment where any of them
        // could show different numbers.
        renderStitchUsage();
        renderDashboard();
    }

    /** How many pieces the project is made of. A pattern with no section titles is one piece, and so is
     *  any pattern when "worked in sections" is unticked - the titles are then dividers rather than
     *  separate pieces, so counting them would be wrong. */
    function renderSectionCount() {
        if (!UI["stat-sections"]) return;
        // No pattern, no pieces. The floor of 1 below is for a pattern that exists but names no
        // sections; an empty page has nothing to count.
        if (!state.patternSteps.length) { UI["stat-sections"].textContent = "0"; return; }

        const titles = state.patternSteps.filter(step => step.isSection).length;
        UI["stat-sections"].textContent = String(Math.max(1, titles));
    }

    const COMPLEXITY_LABELS = {
        repetitive: 'Repetitive',
        texture: 'Texture',
        shaping: 'Shaping',
        special: 'Special stitches'
    };

    // Special stitches are reported as a plain count in the dashboard rather than a bar: as a share of
    // the whole they were nearly always a sliver, which said less than the number itself. Kept in
    // COMPLEXITY_LABELS because the text export still lists all four categories with percentages.
    const BARRED_CATEGORIES = ['repetitive', 'texture', 'shaping'];

    // === 8. GARMENT GRADER === //
    // Forward direction: a chosen size becomes stitch and row counts. All arithmetic lives in the
    // analytics engine; this reads the inputs and renders what comes back.

    // One ease figure for the whole project. It used to be settable per section, each with its own
    // "as above / full circumference / half per piece" choice - three controls per piece for a number
    // that is, in practice, one design decision. Removed: the overall ease applies to every section.
    function graderEase() {
        const value = parseFloat(UI['grade-ease']?.value);
        if (!Number.isFinite(value)) return null;
        return { value, mode: UI['grade-ease-mode']?.value || 'in' };
    }

    const sectionKey = (title) => String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    /**
     * The pattern's own pieces, with what the parse already knows about each: how many rows it has, its
     * widest stitch count, and the stitch multiple it repeats over.
     *
     * All derived rather than typed. The counts come from the same evaluation the matrix is drawn from,
     * so they cannot disagree with the pattern the way a second set of hand-entered numbers would. A
     * pattern that names no sections is one piece, the same floor renderSectionCount uses.
     */
    function sectionProfiles() {
        const pass = state.analytics.lastPass;
        const E = window.CrochetMathEngine;
        if (!pass || !pass.validation.rows.length || !E) return [];

        const order = [];
        const byKey = {};

        pass.validation.rows.forEach(row => {
            const title = row.sectionTitle || 'Pattern';
            const key = sectionKey(title);
            if (!byKey[key]) {
                byKey[key] = { key, title, rowCount: 0, widestStitches: 0, detected: null,
                               startingCount: null, endingCount: null,
                               // Every resolved row of the piece, in order. The construction check reads
                               // a piece as a SHAPE - where it grows, where it narrows, which row does
                               // it - and only the sequence carries that. First and widest cannot.
                               worked: [] };
                order.push(key);
                // A section can state its multiple in its own heading.
                byKey[key].detected = E.parseStitchMultiple(title);
            }
            const profile = byKey[key];

            if (row.status === 'valid' && Number.isFinite(row.evaluation && row.evaluation.calculatedYield)) {
                profile.rowCount++;
                profile.widestStitches = Math.max(profile.widestStitches, row.evaluation.calculatedYield);
                // The count the piece begins from and the count it hands on. Both come out of the same
                // evaluation the matrix is drawn from, so neither can disagree with the pattern the way
                // a typed number would.
                if (profile.startingCount === null) profile.startingCount = row.evaluation.calculatedYield;
                profile.endingCount = row.evaluation.calculatedYield;
                // The count the validator worked out, never the one the pattern states. A row whose
                // written count is wrong must not be able to smuggle a construction fault past the
                // check by asserting itself.
                // `index` is the row's place in the pass, so a shaped run found among the worked rows
                // can be mapped back onto the rows the generator prints.
                profile.worked.push({ label: row.label, count: row.evaluation.calculatedYield,
                                      index: row.index });
            }
            // The first statement wins. A multiple is stated once, at the top of a piece; a later row
            // that happens to mention one is describing something else.
            if (!profile.detected) {
                const text = row.status === 'note' ? row.label : (row.step && row.step.instructionString) || '';
                profile.detected = E.parseStitchMultiple(text);
            }
        });

        return order.map(key => enrichSection(byKey[key]));
    }

    /**
     * Everything about a piece that follows from what was already read out of it: how wide and how long
     * it comes out at its gauge, and the shaping that gets it from its starting count to its ending
     * count over the rows it has.
     *
     * Only the type and the joins are the designer's to say - neither is written anywhere in a pattern
     * in a form that can be read reliably.
     */
    function enrichSection(profile) {
        const A = window.CrochetAnalyticsEngine;
        const set = state.grading.sections[profile.key] || {};
        const gauge = A.EffectiveGauge(graderGauge(), { section: profile.key });

        const widthInches = gauge.stitchesPerInch > 0 && profile.widestStitches
            ? A.round2(profile.widestStitches / gauge.stitchesPerInch) : null;
        const lengthInches = gauge.rowsPerInch > 0 && profile.rowCount
            ? A.round2(profile.rowCount / gauge.rowsPerInch) : null;

        return {
            ...profile,
            type: set.type || '',
            typeLabel: (A.SECTION_TYPES[set.type] || {}).label || '',
            // What the piece is graded from, which is what lets a change to a measurement name the
            // pieces it reaches.
            points: (A.SECTION_TYPES[set.type] || {}).points || [],
            joins: set.joinTo ? [{ to: set.joinTo }] : [],
            joinTo: set.joinTo || '',
            widthInches, lengthInches,
            stitchesPerInch: gauge.stitchesPerInch,
            rowsPerInch: gauge.rowsPerInch,
            gaugeSource: gauge.stitchSource,
            // The shaping the piece already contains, read back out of its own counts.
            shaping: A.DistributeShaping({
                from: profile.startingCount, to: profile.endingCount,
                rows: profile.rowCount, preset: set.shaping || 'paired'
            }),
            shapingPreset: set.shaping || 'paired'
        };
    }

    /** The repeat in force for a section: what the designer set, else what was detected. */
    function sectionRepeat(profile) {
        const set = state.grading.sections[profile.key] || {};
        if (Number.isFinite(set.multiple) && set.multiple >= 2) {
            return { multiple: set.multiple, plus: Number.isFinite(set.plus) ? set.plus : 0, source: 'manual' };
        }
        if (profile.detected) return { ...profile.detected, source: 'pattern' };
        return null;
    }

    /**
     * Which repeat each measurement point lands on, read through the pieces the designer has TYPED.
     *
     * The graded table is one chart for the whole garment, and a repeat belongs to one piece of a
     * pattern - so a repeat reaches a measurement only by way of a section whose type says it is
     * worked to that measurement: a Back typed `back` carries its 6 + 1 to the bust, waist and hip; a
     * Sleeve typed `sleeve` carries its repeat (or whole stitches, when it has none) to the upper arm.
     * An untyped section carries nothing to the table, however plainly its heading says "Sleeve" -
     * the same asked-not-guessed gate the construction check uses. A point two typed pieces both claim
     * goes to the first, in pattern order.
     *
     * Returns `byPoint`, in the shape GradeSizes' `rounding.byPoint` takes, and `sources`, the
     * section title behind each point, for the note under the table.
     */
    function repeatByPoint() {
        const A = window.CrochetAnalyticsEngine;
        const byPoint = {};
        const sources = {};
        sectionProfiles().forEach(profile => {
            if (!profile.type) return;
            const repeat = sectionRepeat(profile);
            profile.points.forEach(point => {
                if (A.MEASUREMENT_AXIS[point] !== 'width') return;
                if (Object.prototype.hasOwnProperty.call(byPoint, point)) return;
                byPoint[point] = repeat ? { multiple: repeat.multiple, plus: repeat.plus } : null;
                sources[point] = profile.title;
            });
        });
        return { byPoint, sources };
    }

    /** Body, finished and ease reconciled from the three grader fields. Both the summary line and the
     *  graded tables need it, and asking twice with the arguments spelled out twice is how the two
     *  could come to disagree. */
    function resolvedEase() {
        return window.CrochetAnalyticsEngine.ResolveEase({
            body: parseFloat(UI['grade-body']?.value),
            finished: parseFloat(UI['grade-finished']?.value),
            ease: graderEase(),
            unit: state.gauge.unit || 'in'
        });
    }

    /** `skipDashboard` is for the one caller that refreshes the dashboard itself, further down, once
     *  the complexity and finished-size panels have also been redrawn. Letting it run here as well meant
     *  the whole dashboard - a localStorage read, a size regrade and ten sub-panels - was built twice
     *  for every pattern refresh, and the first build was always the staler of the two. */
    function renderGrader({ skipDashboard = false } = {}) {
        const A = window.CrochetAnalyticsEngine;
        if (!A || !UI['grade-summary']) return;

        populateGraderSelects();

        const unit = state.gauge.unit || 'in';
        const resolved = resolvedEase();

        UI['grade-summary'].innerHTML = graderSummaryHtml(resolved);
        const category = UI['grade-chart']?.value || '';
        const chart = graderChart(category);
        renderSizePicker(category);
        renderPointEase(category, chart);
        renderOverrideGrid(category, chart);
        renderGradeTables();
        renderSectionProfiles();
        renderConstructionCheck();
        // The dashboard's schematic preview is read from the garment this just graded
        // (state.grading.lastGarment). Without this, picking or clearing a chart would not reach the
        // dashboard until the pattern itself was re-parsed.
        if (!skipDashboard) renderDashboard();
    }

    /** The four-line readout: body, finished, ease in both forms, and the gauge. */
    function graderSummaryHtml(resolved) {
        const A = window.CrochetAnalyticsEngine;
        // Named after the chart's own sizing measurement - bust for Woman, chest elsewhere.
        const chart = A.CYC_BODY_MEASUREMENTS[UI['grade-chart']?.value || ''];
        const name = chart ? chart.measure : 'bust';

        if (resolved.conflict) {
            const c = resolved.conflict;
            return `<div class="grade-conflict"><strong>These three do not agree.</strong>
                ${c.body} with ${c.statedEase > 0 ? '+' : ''}${c.statedEase} of ease is ${round1(c.body + c.statedEase)},
                but the finished measurement says ${c.finished}, which is
                ${c.impliedEase > 0 ? '+' : ''}${c.impliedEase} of ease.
                Nothing has been changed &mdash; correct whichever is wrong.</div>`;
        }
        if (!resolved.complete) {
            return `<em>Give any two of body, finished and ease. Still needed: ${resolved.missing.join(', ')}.</em>`;
        }

        // resolved.body/finished/easeInches are always inches (ResolveEase converts on the way in) -
        // bothUnits() reports both, rather than relabelling an inches figure with whatever unit the
        // gauge inputs happen to be set to.
        const derived = resolved.derived ? ` <span class="grade-derived">(derived)</span>` : '';
        return `
            <div class="grade-line"><span>Body ${escapeHtml(name.toLowerCase())}:</span><strong>${bothUnits(resolved.body)}</strong></div>
            <div class="grade-line"><span>Finished ${escapeHtml(name.toLowerCase())}:</span><strong>${bothUnits(resolved.finished)}</strong></div>
            <div class="grade-line"><span>Ease:</span><strong>${signedBoth(resolved.easeInches)} / ${signedNumber(resolved.easePercent)}%</strong>${derived}
                <em class="grade-axis">${resolved.easeScales ? 'scales with size' : 'fixed across sizes'}</em></div>
            <div class="grade-line"><span>Gauge:</span><strong>${gaugeOver4()}</strong></div>
            ${constructionLine()}
            <div class="grade-band">${escapeHtml(resolved.band)}</div>
            ${gaugeWarningHtml()}`;
    }

    /**
     * How the piece is built, taken from the Pattern Info panel rather than asked for twice. Shown
     * because it is part of what a base size IS - the same measurements graded flat and in the round
     * are not the same pattern - and omitted when unset, rather than defaulted to a guess.
     */
    function constructionLine() {
        const construction = hasInferred() ? inferredConstruction() : '';
        if (!construction) return '';
        return `<div class="grade-line"><span>Construction:</span><strong>${escapeHtml(construction)}</strong></div>`;
    }

    /** Gauge quoted the way patterns quote it: over 4 in, or 10 cm. */
    function gaugeOver4() {
        const g = state.gauge;
        if (!g.stitchDensity) return 'not set';
        const over = g.unit === 'cm' ? 10 : 4;
        const sts = (g.stitchDensity * over).toFixed(0);
        const rows = g.rowDensity ? `${(g.rowDensity * over).toFixed(0)} rows` : 'no row gauge';
        // Which swatch is actually being graded from, when the two disagree.
        const effective = window.CrochetAnalyticsEngine.EffectiveGauge(graderGauge());
        const washed = effective.stitchSource === 'washed' || effective.rowSource === 'washed'
            ? ' (washed)' : '';
        return `${sts} sts × ${rows} per ${over} ${g.unit}${washed}`;
    }

    function gaugeWarningHtml() {
        const pass = state.analytics.lastPass;
        if (!pass) return '';
        const check = window.CrochetAnalyticsEngine.CheckGaugeCompleteness({
            rows: pass.validation.rows,
            gauge: graderGauge()
        });
        return check.ok ? '' : `<div class="grade-warning">⚠ ${escapeHtml(check.warning)}</div>`;
    }

    function populateGraderSelects() {
        const A = window.CrochetAnalyticsEngine;
        const chart = UI['grade-chart'];
        if (chart && !chart.innerHTML.includes('option value="woman"')) {
            chart.innerHTML = '<option value="">-- Select One --</option>'
                + Object.keys(A.CYC_BODY_MEASUREMENTS)
                    .map(k => `<option value="${k}">${escapeHtml(A.CYC_BODY_MEASUREMENTS[k].label)}</option>`).join('')
                + '<option value="custom">Custom / made-to-measure</option>';
        }
    }

    /** Which sizes to grade to. All of them until the designer says otherwise. */
    function renderSizePicker(category) {
        const host = UI['grade-size-picker'];
        const A = window.CrochetAnalyticsEngine;
        if (!host) return;
        const chart = A.CYC_BODY_MEASUREMENTS[category];
        if (!chart) { host.replaceChildren(); return; }

        const signature = category + ':' + chart.sizes.map(s => s[0]).join(',');
        if (host.dataset.signature === signature) return;   // keep the ticks on a redraw
        host.dataset.signature = signature;

        host.replaceChildren();
        const heading = elem('strong', null, 'Sizes to grade');
        const list = elem('div', 'grade-size-list');

        chart.sizes.forEach(([label]) => {
            const wrap = elem('label', 'grade-size-tick');
            const box = elem('input', null, null, `grade-size-${sectionKey(label)}`);
            box.type = 'checkbox';
            box.checked = true;
            wrap.append(box, elem('span', null, label));
            list.appendChild(wrap);
            register(box, renderGradeTables);
        });
        host.append(heading, list);
    }

    function selectedSizes(category) {
        const A = window.CrochetAnalyticsEngine;
        const chart = A.CYC_BODY_MEASUREMENTS[category];
        if (!chart) return null;
        const picked = chart.sizes
            .map(([label]) => label)
            .filter(label => {
                const box = UI[`grade-size-${sectionKey(label)}`];
                return box ? box.checked : true;
            });
        return picked.length ? picked : null;
    }

    /** Ease per measurement. Only the circumferences take the overall ease - a bust ease says nothing
     *  about armhole depth - so the rest show "none" until one is set here. */
    function renderPointEase(category, chart) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-point-ease'];
        if (!host) return;
        const points = A.ChartPoints(category, chart);
        if (!points.length) { host.replaceChildren(); return; }

        if (host.dataset.signature === category) return;
        host.dataset.signature = category;

        host.replaceChildren();
        host.append(
            elem('strong', null, 'Ease by measurement'),
            elem('p', 'helper-text', 'Blank means the overall ease for a circumference, and none for a length.')
        );

        points.forEach(pt => {
            host.appendChild(easeRow({
                id: `grade-pe-${sectionKey(pt)}`,
                label: A.MEASUREMENT_LABELS[pt] || pt,
                axis: A.MEASUREMENT_AXIS[pt] === 'width' ? 'sts' : 'rows',
                placeholder: A.EASED_POINTS.has(pt) ? 'overall' : 'none'
            }));
        });
    }

    /** A labelled number input, built as real elements so its value can be read back. */
    function easeRow({ id, label, axis, placeholder }) {
        const row = elem('label', 'grade-ease-row');
        row.appendChild(elem('span', null, label));
        if (axis) row.appendChild(elem('em', 'grade-axis', axis));

        // Not numberBox(): that one carries the section-input class, a min of 0 and the section handler.
        const input = elem('input', null, null, id);
        input.type = 'number';
        input.step = '0.25';
        input.placeholder = placeholder || '';
        row.appendChild(input);
        register(input, renderGradeTables);

        // Its own unit, rather than borrowing whichever the overall ease is set to. A bust ease given as
        // a percentage says nothing about how a cuff should be eased, and the two are as likely to want
        // different units as different numbers.
        const mode = elem('select', 'unit-input', null, `${id}-mode`);
        fillSelect(mode, [['in', 'in'], ['cm', 'cm'], ['percent', '%']]);
        row.appendChild(mode);
        register(mode, renderGradeTables);
        return row;
    }

    /** Caches a freshly built control and wires it, since it is not in the static map. */
    function register(el, handler) {
        if (!el || !el.id) return;
        UI[el.id] = el;
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    }

    // The grader builds these at run time, so they are not in the static field list New File clears -
    // and being absent from index.html, the harvest in test-newfile.js cannot see them either. Cleared
    // explicitly, or a new project opens holding the last one's per-measurement ease and overrides.
    const DYNAMIC_GRADER_PREFIXES = ['grade-ov-', 'grade-pe-', 'grade-sm-', 'grade-sp-',
                                     'grade-sg-', 'grade-sr-', 'grade-sy-', 'grade-sj-',
                                     'grade-sh-', 'grade-dm-'];

    function clearGraderControls() {
        Object.keys(UI).forEach(id => {
            if (!DYNAMIC_GRADER_PREFIXES.some(prefix => id.startsWith(prefix))) return;
            const el = UI[id];
            if (el && typeof el.value === 'string') el.value = '';
        });
        // Both panels skip a redraw when their shape is unchanged, so the memo has to go with the values
        // or the cleared controls are never rebuilt.
        ['grade-point-ease', 'grade-custom-chart', 'grade-size-picker'].forEach(id => {
            if (UI[id] && UI[id].dataset) UI[id].dataset.signature = '';
        });
    }

    /** The grader's own fields. None of these used to survive a save or a New File, so a reopened
     *  project came back with the previous one's ease still in the boxes. */
    const GRADER_FIELDS = ['grade-base-name', 'grade-body', 'grade-finished', 'grade-ease',
                           'grade-ease-mode', 'grade-chart', 'grade-rounding', 'grade-parity',
                           'grade-row-parity', 'grade-custom-sizes',
                           'grade-sample-yards', 'grade-sample-yards-unit',
                           'grade-neck-depth', 'grade-neck-unit', 'grade-shoulder-drop',
                           'grade-neck-share', 'grade-neck-bindoff', 'grade-armhole-bindoff',
                           'grade-con-neck', 'grade-con-unit', 'grade-con-rounds',
                           'grade-con-cap-height', 'grade-con-cap-top'];

    /** Snapshots everything the grader holds, including the measurement grid. */
    function readGraderInputs() {
        const fields = {};
        GRADER_FIELDS.forEach(id => { fields[id] = UI[id] ? UI[id].value : ''; });
        state.grading.fields = fields;

        const category = UI['grade-chart']?.value || '';
        const chart = graderChart(category);
        const points = window.CrochetAnalyticsEngine.ChartPoints(category, chart);
        state.grading.overrides = graderOverrides(chartLabels(category, chart), points);
        // Modes and section settings are kept current by the renders that read them, but re-read here so
        // a save never depends on which render happened to run last.
        graderModes(points);
        readSectionInputs();
        return state.grading;
    }

    /** Puts a saved grader back on the page. Rendered twice on purpose: the measurement grid does not
     *  exist until the chart is set, so there is nowhere to write the saved overrides until after the
     *  first pass. */
    function applyGraderInputs() {
        const fields = state.grading.fields || {};
        GRADER_FIELDS.forEach(id => { if (UI[id]) UI[id].value = fields[id] || ''; });
        renderGrader();

        const overrides = state.grading.overrides || {};
        Object.keys(overrides).forEach(label => {
            Object.keys(overrides[label]).forEach(point => {
                const cell = UI[overrideId(label, point)];
                if (cell) cell.value = String(overrides[label][point]);
            });
        });
        renderGrader();
    }

    /** Size names for a made-to-measure chart. One name is a single body; several is a run. */
    function customSizeNames() {
        return (UI['grade-custom-sizes']?.value || '')
            .split(',').map(name => name.trim()).filter(Boolean);
    }

    /**
     * A chart the designer defined, or null. It carries no measurements of its own - they all arrive as
     * overrides, the same route a replaced figure on a standard chart takes, so one grid serves both and
     * the grading arithmetic never forks.
     *
     * No published measurements ship here beyond the CYC tables already in the engine. Anything else -
     * ASTM's, or a designer's own block - is entered by whoever holds it.
     */
    function customChart() {
        const names = customSizeNames();
        if (!names.length) return null;
        return {
            label: 'Custom', measure: 'bust', measureKey: 'chest',
            points: window.CrochetAnalyticsEngine.MEASUREMENT_POINTS,
            sizes: names.map(name => [name, {}])
        };
    }

    /** The chart in force: a custom one when chosen, otherwise the published chart. */
    function graderChart(category) {
        return category === 'custom' ? customChart() : null;
    }

    // Both halves go through sectionKey, matching the per-point ease ids: the points are camelCase and
    // an id that keeps the capitals is one nobody can guess from the others.
    const overrideId = (sizeLabel, point) => `grade-ov-${sectionKey(sizeLabel)}-${sectionKey(point)}`;

    /** How each measurement grades, read back off the grid. */
    function graderModes(points) {
        const modes = {};
        (points || []).forEach(point => {
            const chosen = UI[`grade-dm-${sectionKey(point)}`]?.value || '';
            if (chosen && chosen !== 'graded') modes[point] = chosen;
        });
        state.grading.modes = modes;
        return modes;
    }

    /** Every measurement the designer has replaced, in the shape GradeSizes expects. */
    function graderOverrides(labels, points) {
        const out = {};
        labels.forEach(label => {
            points.forEach(point => {
                const value = parseFloat(UI[overrideId(label, point)]?.value);
                if (Number.isFinite(value)) {
                    if (!out[label]) out[label] = {};
                    out[label][point] = value;
                }
            });
        });
        return out;
    }

    /**
     * The measurement grid: points down the side, sizes across the top. A published figure sits in the
     * placeholder rather than the value, so a box the designer filled in is never mistaken for one the
     * chart filled in - only one of the two should win, and the table has to tell them apart.
     */
    function renderOverrideGrid(category, chart) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-custom-chart'];
        if (!host) return;

        const labels = chartLabels(category, chart);
        const points = A.ChartPoints(category, chart);
        if (!labels.length || !points.length) {
            host.replaceChildren(elem('p', 'placeholder-text', category === 'custom'
                ? 'Name at least one custom size above.'
                : 'Choose a size chart to see and adjust its measurements.'));
            return;
        }

        // Rebuilt only when the shape changes, so typing in a cell does not replace it.
        const signature = category + ':' + labels.join(',');
        if (host.dataset.signature === signature) return;
        host.dataset.signature = signature;
        host.replaceChildren();

        const { wrap, body } = responsiveTable(
            ['Measurement', 'How it grades'].concat(labels), 'grade-measure-table');
        const published = chart ? null : A.CYC_BODY_MEASUREMENTS[category];
        points.forEach(point => {
            const tr = elem('tr');
            tr.appendChild(rowHeader(A.MEASUREMENT_LABELS[point] || point));

            // Whether this measurement grades, holds one value, follows another, or is set by hand for
            // every size. A cuff depth that grades is a mistake; a bust that does not is a different
            // mistake. The grader cannot tell which the designer meant, so it asks and says which it used.
            const modeCell = elem('td');
            modeCell.appendChild(pickBox(`grade-dm-${sectionKey(point)}`,
                state.grading.modes[point],
                A.DIMENSION_MODES.map(mode => [mode, mode]),
                renderGradeTables));
            const source = (A.MEASUREMENT_DEPENDS_ON[point] || [])
                .map(dep => A.MEASUREMENT_LABELS[dep] || dep);
            if (source.length) modeCell.appendChild(elem('em', 'grade-axis', `from ${source.join(' + ')}`));
            // The downstream half of the same graph: what a change to this measurement reaches, said
            // where the change is made rather than on the Construction tab.
            const reaches = A.DependentsOf(point).map(dep => A.MEASUREMENT_LABELS[dep] || dep);
            if (reaches.length) modeCell.appendChild(elem('em', 'grade-axis', `reaches ${reaches.join(', ')}`));
            tr.appendChild(modeCell);

            labels.forEach(label => {
                // Not numberBox(): these report to the grader, not to the section reader.
                const input = elem('input', 'grade-section-input', null, overrideId(label, point));
                input.type = 'number';
                input.step = '0.25';
                input.min = '0';
                input.placeholder = publishedFigure(published, label, point);
                register(input, renderGradeTables);
                const td = elem('td');
                td.appendChild(input);
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        host.appendChild(wrap);
    }

    /** The chart's own figure for a cell, as the placeholder text. Ranges show as a range. */
    function publishedFigure(chart, label, point) {
        if (!chart) return '';
        const entry = (chart.sizes.find(([name]) => name === label) || [])[1];
        const measure = entry && entry[point];
        if (!measure) return '';
        return measure.min === measure.max ? String(measure.min) : `${measure.min}-${measure.max}`;
    }

    /** Which sizes the table has columns for, whichever kind of chart is in force. */
    function chartLabels(category, chart) {
        const A = window.CrochetAnalyticsEngine;
        if (chart) return chart.sizes.map(([label]) => label);
        const published = A.CYC_BODY_MEASUREMENTS[category];
        if (!published) return [];
        return selectedSizes(category) || published.sizes.map(([label]) => label);
    }

    function graderPointEase(category, chart) {
        const A = window.CrochetAnalyticsEngine;
        const out = {};
        A.ChartPoints(category, chart).forEach(pt => {
            const id = `grade-pe-${sectionKey(pt)}`;
            const el = UI[id];
            const v = el ? parseFloat(el.value) : NaN;
            // Falls back to the overall unit only when this row has no unit of its own, which is what
            // happens before the select has been touched.
            if (Number.isFinite(v)) {
                out[pt] = { value: v, mode: UI[`${id}-mode`]?.value || UI['grade-ease-mode']?.value || 'in' };
            }
        });
        return out;
    }

    /**
     * The three reports that judge a graded garment rather than produce one: how evenly it grades,
     * whether its proportions work, and what the compiler makes of each size the pattern writes.
     *
     * Nothing here changes a number. Every one is a finding the designer decides about, which is why
     * they sit apart from the tables that do the grading.
     */
    function renderGradeReport(garment, labels, run) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-report'];
        if (!host) return;
        host.replaceChildren();

        host.appendChild(elem('strong', null, 'Grading report'));

        const increments = A.GradingIncrements(garment || []).filter(row => row.state !== 'skip');
        if (increments.length) host.appendChild(incrementTable(increments));

        const warnings = A.CheckFitAndProportion({
            garment: garment || [],
            sections: sectionProfiles()
        });
        const reports = sizeReports();
        const cross = reports
            ? A.CrossSizeReport({ reports, repeat: firstSectionRepeat() })
            : [];

        if (reports) host.appendChild(perSizeTable(reports));

        // The tech editor's TRUE row: each typed piece, each size, does it reach the width it was graded
        // to and work the rows its length grades to.
        const check = run && run.pieces.length ? pieceCheck(run) : { pieces: [], findings: [] };
        if (check.pieces.length) host.appendChild(pieceCheckTable(check, run.targets.labels));

        const findings = warnings.concat(cross, check.findings);
        host.appendChild(findingList(findings));
    }

    /** Two rows per piece - width and rows - with a tick where the size comes out as graded and the
     *  shortfall where it does not. Every figure and every sentence is the engine's. */
    function pieceCheckTable(check, labels) {
        const wrap = elem('div');
        wrap.appendChild(elem('strong', null, 'Per size, per piece'));
        wrap.appendChild(elem('p', 'helper-text',
            'Whether each typed piece reaches the width it was graded to, and works the rows its length '
            + 'grades to. A piece with no type is not checked.'));
        const table = responsiveTable(['Piece'].concat(labels));
        check.pieces.forEach(piece => {
            const width = elem('tr');
            width.appendChild(rowHeader(`${piece.title} width`));
            const rows = elem('tr');
            rows.appendChild(rowHeader(`${piece.title} rows`));
            piece.sizes.forEach(size => {
                const w = plainCell(!size.feasible ? '—'
                    : size.widthOk ? `${size.widestCount} sts ✓`
                    : isNum(size.widthTarget) ? `${size.widestCount} sts, ${size.widthTarget} needed`
                        + (isNum(size.differenceInches) ? ` (${size.differenceInches > 0 ? '+' : ''}${size.differenceInches} in)` : '')
                    : `${size.widestCount} sts`);
                w.className = !size.feasible || (isNum(size.widthTarget) && !size.widthOk) ? 'grade-misfit' : 'grade-fits';
                width.appendChild(w);
                const r = plainCell(!size.feasible ? '—'
                    : size.lengthOk === null ? `${size.rows}`
                    : size.lengthOk ? `${size.rows} ✓`
                    : `${size.rows}, ${size.intendedRows} intended`);
                r.className = !size.feasible || size.lengthOk === false ? 'grade-misfit' : 'grade-fits';
                rows.appendChild(r);
            });
            table.body.appendChild(width);
            table.body.appendChild(rows);
        });
        wrap.appendChild(table.wrap);
        return wrap;
    }

    /** The repeat to hold every size to: the first one any section names. */
    function firstSectionRepeat() {
        const named = sectionProfiles().map(sectionRepeat).filter(Boolean)[0];
        return named ? { multiple: named.multiple, plus: named.plus } : null;
    }

    function incrementTable(rows) {
        const steps = rows[0].steps;
        const { wrap, body } = responsiveTable(
            ['Measurement'].concat(steps.map(s => `${s.from}→${s.to}`)));
        rows.forEach(row => {
            const tr = elem('tr');
            const name = rowHeader(row.label);
            if (row.state !== 'pass') {
                name.appendChild(elem('em', row.state === 'fail' ? 'grade-misfit' : 'grade-axis', row.detail));
            }
            tr.appendChild(name);
            row.steps.forEach(step => {
                const td = plainCell(`${step.delta > 0 ? '+' : ''}${step.delta}"`);
                if (step.delta <= 0) td.className = 'grade-misfit';
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        return wrap;
    }

    /** What the compiler counted in each size the pattern writes. */
    function perSizeTable(reports) {
        const { wrap, body } = responsiveTable(
            ['Size', 'Rows', 'Starts', 'Ends', 'Consumed', 'Produced', 'Inc', 'Dec', 'Valid']);
        reports.forEach(report => {
            const tr = elem('tr');
            tr.appendChild(rowHeader(report.label));
            [report.rowsCounted, report.startingCount, report.endingCount, report.consumed,
             report.produced, report.increases, report.decreases]
                .forEach(value => tr.appendChild(plainCell(value === null ? '—' : value)));
            const valid = plainCell(report.allValid ? 'yes' : 'no');
            valid.className = report.allValid ? 'grade-fits' : 'grade-misfit';
            tr.appendChild(valid);
            body.appendChild(tr);
        });
        return wrap;
    }

    function findingList(findings) {
        const list = elem('div', 'grade-findings');
        if (!findings.length) {
            list.appendChild(elem('p', 'helper-text', 'No fit, proportion or cross-size problems found.'));
            return list;
        }
        findings.forEach(finding => {
            const line = elem('div', finding.state === 'fail' ? 'grade-misfit' : 'grade-warning');
            line.textContent = finding.detail
                ? `${finding.size}: ${finding.check} — ${finding.detail}`
                : `${finding.size}: ${finding.check}`;
            list.appendChild(line);
        });
        return list;
    }

    // === 8b. MOTIFS, GENERATION AND EXPORT === //

    /** A motif panel graded against the finished measurement it has to reach. Fed from the graded table
     *  rather than a typed width, so the motif count and the size run cannot disagree about what the
     *  garment measures. */
    function renderMotifLayout(garment, labels) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['motif-output'];
        if (!host) return;
        host.replaceChildren();

        fillPointPicker(garment);
        const motif = parseFloat(UI['motif-size']?.value);
        if (!Number.isFinite(motif) || motif <= 0) {
            host.appendChild(elem('p', 'placeholder-text', 'Enter the size of one motif to see how many fit each size.'));
            return;
        }

        const point = UI['motif-point']?.value || 'chest';
        const row = garment.find(r => r.point === point);
        if (!row) return;

        const { wrap, body } = responsiveTable(
            ['Size', 'Target', 'Motifs', 'Gives', 'Difference', 'Border to fit']);
        labels.forEach(size => {
            const cell = row.sizes.find(c => c.size === size);
            if (!cell || !isNum(cell.across)) return;
            const plan = A.PlanMotifLayout({
                targetInches: cell.across,
                motifInches: motif,
                joinInches: parseFloat(UI['motif-join']?.value) || 0,
                borderInches: parseFloat(UI['motif-border']?.value) || 0
            });
            const best = plan.layouts.find(l => l.count === plan.count);

            const tr = elem('tr');
            tr.appendChild(rowHeader(size));
            tr.appendChild(plainCell(bothUnits(cell.across)));
            tr.appendChild(plainCell(plan.count === null ? '—' : plan.count));
            tr.appendChild(plainCell(best ? bothUnits(best.width) : '—'));
            const diff = plainCell(best ? `${signedBoth(best.difference)}` : '—');
            if (best && best.difference !== 0) diff.className = 'grade-misfit';
            tr.appendChild(diff);
            tr.appendChild(plainCell(best ? bothUnits(best.borderToFit) : '—'));
            body.appendChild(tr);
        });
        host.appendChild(wrap);
    }

    /** The shape every table in the grader shares: a heading row, a body to fill, and the scroll wrapper
     *  that keeps a wide table inside its column. Six panels were each building all three by hand, which
     *  is six places for a class name to drift. Two still do: buildGradeTable and renderDashSizes build
     *  their own wrappers as markup strings. */
    function responsiveTable(headings, className) {
        const table = elem('table', `matrix-table ${className || 'grade-detail-table'}`);
        table.appendChild(simpleHead(headings));
        const body = elem('tbody');
        table.appendChild(body);
        const wrap = elem('div', 'table-responsive');
        wrap.appendChild(table);
        return { wrap, table, body };
    }

    function simpleHead(labels) {
        const head = elem('thead');
        const tr = elem('tr');
        labels.forEach(text => {
            tr.appendChild(elem('th', null, text));
        });
        head.appendChild(tr);
        return head;
    }

    /** A row's own heading cell. Written out at seven sites before this. */
    function rowHeader(text) {
        const th = elem('th');
        th.setAttribute('scope', 'row');
        th.textContent = text;
        return th;
    }

    /** Which measurement the motifs run across, offered from the chart's own points. */
    function fillPointPicker(garment) {
        const select = UI['motif-point'];
        if (!select) return;
        fillSelect(select,
            garment.filter(row => row.axis === 'width').map(row => [row.point, row.label]),
            garment.map(row => row.point).join(','));
    }

    /**
     * The neck, shoulder and armhole inputs as the engine takes them: inches, with a blank field
     * meaning the figure its placeholder shows. Read in one place so the panel and the calculation
     * report plan from the same numbers.
     */
    function neckInputs() {
        const unit = UI['grade-neck-unit']?.value || 'in';
        const inches = (id, fallback) => {
            const v = parseFloat(UI[id]?.value);
            const raw = Number.isFinite(v) && v >= 0 ? v : fallback;
            return unit === 'cm' ? raw / CM_PER_INCH : raw;
        };
        const share = (id, fallback) => {
            const v = parseFloat(UI[id]?.value);
            return Number.isFinite(v) && v >= 0 ? v / 100 : fallback;
        };
        return {
            depthInches: inches('grade-neck-depth', 3),
            dropInches: inches('grade-shoulder-drop', 1),
            bindOffInches: inches('grade-armhole-bindoff', 0.75),
            neckShare: share('grade-neck-share', 0.5),
            bindOffShare: share('grade-neck-bindoff', 0.4)
        };
    }

    /**
     * The three plans for one size, from that size's graded cells: the neckline from the cross back,
     * the shoulder from what the neckline leaves, the armhole from the bust down to the cross back.
     * Null where the chart carries no cross back - the head, hand and foot charts - or nothing has
     * been graded yet.
     */
    function neckPlansFor(garment, size) {
        const A = window.CrochetAnalyticsEngine;
        const cellOf = point => {
            const row = (garment || []).find(r => r.point === point);
            return row ? row.sizes.find(c => c.size === size) || null : null;
        };
        const crossBack = cellOf('crossBack');
        const chest = cellOf('chest');
        const armhole = cellOf('armholeDepth');
        if (!crossBack || !isNum(crossBack.stitches)) return null;
        const gauge = A.EffectiveGauge(graderGauge());
        const inputs = neckInputs();
        const rowParity = roundingChoice().rowParity;
        const depthRows = A.MeasurementToRows(inputs.depthInches, gauge.rowsPerInch, rowParity);
        const dropRows = A.MeasurementToRows(inputs.dropInches, gauge.rowsPerInch, rowParity);
        const neck = A.PlanNeckline({
            crossBackStitches: crossBack.stitches, neckShare: inputs.neckShare,
            bindOffShare: inputs.bindOffShare, depthRows, repeat: repeatByPoint().byPoint.crossBack || null
        });
        const shoulder = isNum(neck.shoulderStitches)
            ? A.PlanShoulderSlope({ shoulderStitches: neck.shoulderStitches, dropRows }) : null;
        const armholePlan = chest && isNum(chest.stitches) && armhole && isNum(armhole.rows)
            ? A.PlanArmholeShaping({
                bodyStitches: chest.stitches, crossBackStitches: crossBack.stitches,
                bindOffStitches: A.MeasurementToStitches(inputs.bindOffInches, gauge.stitchesPerInch),
                rows: armhole.rows, piece: chest.piece
            })
            : null;
        return { neck, shoulder, armhole: armholePlan, depthRows, dropRows };
    }

    /** Sizes across, the plans' figures down, and every plan's sentence and warning beneath. */
    function renderNeckAndShoulders(garment, labels) {
        const host = UI['grade-neck-output'];
        if (!host) return;
        host.replaceChildren();
        const plans = labels.map(size => neckPlansFor(garment, size));
        if (!plans.some(Boolean)) {
            host.appendChild(elem('p', 'placeholder-text',
                'Planned once a chart with a cross back is graded.'));
            return;
        }

        const { wrap, body } = responsiveTable([''].concat(labels));
        const line = (label, pick, misfit) => {
            const tr = elem('tr');
            tr.appendChild(rowHeader(label));
            plans.forEach(plan => {
                const value = plan ? pick(plan) : null;
                const td = plainCell(value === null || value === undefined ? '—' : value);
                if (plan && misfit && misfit(plan)) td.className = 'grade-misfit';
                tr.appendChild(td);
            });
            body.appendChild(tr);
        };
        const neckBad = p => p.neck && !p.neck.feasible;
        line('Neck depth (rows)', p => p.depthRows);
        line('Neck stitches', p => p.neck.neckStitches, neckBad);
        line('Left unworked at the centre', p => p.neck.bindOff, neckBad);
        line('Decreased at each neck edge', p => p.neck.perSide, neckBad);
        line('Rows straight to the shoulder', p => (p.neck.feasible ? p.neck.straightRows : null), neckBad);
        line('Shoulder stitches', p => p.neck.shoulderStitches);
        line('Shoulder steps', p => (p.shoulder && p.shoulder.feasible
            ? p.shoulder.segments.map(seg => `${seg.stitches}×${seg.times}`).join(', ') : null),
            p => p.shoulder && !p.shoulder.feasible);
        line('Underarm given up, each side', p => (p.armhole ? p.armhole.bindOff : null));
        line('Armhole decrease rows', p => (p.armhole && p.armhole.feasible ? p.armhole.shaping.events : null),
            p => p.armhole && !p.armhole.feasible);
        host.appendChild(wrap);

        // Each plan in words, per size, with anything that could not be planned said as such.
        const words = elem('div', 'grade-findings');
        labels.forEach((size, i) => {
            const plan = plans[i];
            if (!plan) return;
            [plan.neck, plan.shoulder, plan.armhole].forEach(part => {
                if (!part) return;
                const p = elem('div', part.feasible ? null : 'grade-warning');
                p.textContent = `${size}: ${part.feasible ? part.text : part.warning}`;
                words.appendChild(p);
            });
        });
        host.appendChild(words);
    }

    /** The construction inputs no chart carries, as the engine takes them: the neck circumference and
     *  cap figures in inches (blank cap fields mean the placeholder; a blank neck means none), and the
     *  circular yoke's increase rounds. */
    function constructionInputs() {
        const unit = UI['grade-con-unit']?.value || 'in';
        const inches = (id, fallback) => {
            const v = parseFloat(UI[id]?.value);
            const raw = Number.isFinite(v) && v > 0 ? v : fallback;
            return raw === null ? null : (unit === 'cm' ? raw / CM_PER_INCH : raw);
        };
        const rounds = parseInt(UI['grade-con-rounds']?.value, 10);
        return {
            neckInches: inches('grade-con-neck', null),
            capHeightInches: inches('grade-con-cap-height', 5),
            capTopInches: inches('grade-con-cap-top', 3),
            increaseRounds: Number.isFinite(rounds) && rounds > 0 ? rounds : null
        };
    }

    /** One size's construction plan from its graded cells, for the construction under Generated
     *  instructions. Null before a chart is graded. */
    function constructionPlanFor(garment, size) {
        const A = window.CrochetAnalyticsEngine;
        if (!garment || !garment.length) return null;
        const cellOf = point => {
            const row = garment.find(r => r.point === point);
            return row ? row.sizes.find(c => c.size === size) || null : null;
        };
        const chest = cellOf('chest');
        const upperArm = cellOf('upperArm');
        const crossBack = cellOf('crossBack');
        const armhole = cellOf('armholeDepth');
        const gauge = A.EffectiveGauge(graderGauge());
        const inputs = constructionInputs();
        const rowParity = roundingChoice().rowParity;
        return A.PlanConstructionAtSize({
            construction: UI['gen-construction']?.value || 'drop',
            chest: chest ? chest.stitches : null,
            chestShare: chest && isNum(chest.share) ? chest.share : 0.5,
            upperArm: upperArm ? upperArm.stitches : null,
            crossBack: crossBack ? crossBack.stitches : null,
            armholeRows: armhole ? armhole.rows : null,
            neckCount: A.MeasurementToStitches(inputs.neckInches, gauge.stitchesPerInch),
            underarmCount: A.MeasurementToStitches(neckInputs().bindOffInches, gauge.stitchesPerInch),
            capRows: A.MeasurementToRows(inputs.capHeightInches, gauge.rowsPerInch, rowParity),
            capTopCount: A.MeasurementToStitches(inputs.capTopInches, gauge.stitchesPerInch),
            increaseRounds: inputs.increaseRounds,
            stitchesPerInch: gauge.stitchesPerInch, rowsPerInch: gauge.rowsPerInch
        });
    }

    /** The sentences a size's plan comes to, in the engine's words, or the reason it could not be
     *  planned. One list for the panel and the calculation report. */
    function constructionPlanLines(result) {
        if (!result || !result.planner) return [];
        if (!result.plan) return [result.warning];
        const plan = result.plan;
        const lines = [];
        // Each part of the plan on its own line - its sentence when it can be worked, its reason when
        // it cannot - so a size with two problems is told both, not the first the planner met.
        const said = new Set();
        const part = (name, shaping, from, to) => {
            if (!shaping) return;
            if (shaping.feasible && shaping.text) {
                lines.push(`${name}: ${shaping.text.toLowerCase()}`
                    + (isNum(from) && isNum(to) ? `, ${from} to ${to} sts` : '') + '.');
            } else if (shaping.warning) {
                lines.push(`${name}: ${shaping.warning}`);
                said.add(shaping.warning);
            }
        };
        if (result.planner === 'raglan') {
            part(`Yoke, ${result.inputs.neckCount} to ${plan.separationCount} sts`
                + (isNum(plan.depthInches) ? ` over ${plan.depthInches} in` : ''), plan.shaping);
        } else if (result.planner === 'setIn') {
            part('Armhole', plan.armhole, result.inputs.bodyCount - result.inputs.underarmCount * 2, result.inputs.shoulderCount);
            part('Cap', plan.cap, result.inputs.sleeveCount, result.inputs.capTopCount);
            if (isNum(plan.capEdgeInches) && isNum(plan.armholeEdgeInches)) {
                lines.push(`Cap edge ${plan.capEdgeInches} in against an armhole edge of ${plan.armholeEdgeInches} in.`);
            }
        } else {
            plan.rounds.forEach(r => lines.push(`Round ${r.round}: ${r.from} → ${r.to} sts, +${r.increases}`
                + (r.spacing ? ` (${(r.spacing.text || r.spacing.warning).toLowerCase()})` : '') + '.'));
        }
        if (result.warning && !said.has(result.warning)) lines.push(result.warning);
        return lines;
    }

    /** Sizes across, the plan's figures down, for whichever construction is chosen; every figure and
     *  sentence is the engine's. A drop shoulder has nothing here and says so. */
    function renderConstructionPerSize(garment, labels) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-construction-output'];
        if (!host) return;
        host.replaceChildren();
        const results = labels.map(size => constructionPlanFor(garment, size));
        const first = results.find(Boolean);
        if (!first) {
            host.appendChild(elem('p', 'placeholder-text', 'Planned once a chart is graded.'));
            return;
        }
        const kind = A.CONSTRUCTIONS[first.construction] || A.CONSTRUCTIONS.drop;
        host.appendChild(elem('p', 'helper-text', `${kind.label}: ${kind.reason || 'every row is the width, so there is no yoke or cap to plan; the armhole and shoulders are under Neck, shoulders and armholes'}.`));
        if (!first.planner) return;

        const { wrap, body } = responsiveTable([''].concat(labels));
        const line = (label, pick, misfit) => {
            const tr = elem('tr');
            tr.appendChild(rowHeader(label));
            results.forEach(result => {
                const value = result ? pick(result) : null;
                const td = plainCell(value === null || value === undefined ? '—' : value);
                if (result && misfit && misfit(result)) td.className = 'grade-misfit';
                tr.appendChild(td);
            });
            body.appendChild(tr);
        };
        const bad = r => !r.feasible;
        const plan = r => r.plan;
        if (first.planner === 'raglan') {
            line('Neck stitches', r => r.inputs.neckCount);
            line('Separation stitches', r => (plan(r) ? plan(r).separationCount : null), bad);
            line('Yoke rows', r => r.inputs.yokeRows);
            line('Increase rounds', r => (plan(r) && isNum(plan(r).increaseRounds) ? plan(r).increaseRounds : null), bad);
        } else if (first.planner === 'setIn') {
            line('Body, one piece', r => r.inputs.bodyCount);
            line('Underarm each side', r => r.inputs.underarmCount);
            line('Shoulder stitches', r => r.inputs.shoulderCount);
            line('Armhole rows', r => r.inputs.armholeRows);
            line('Armhole decrease rows', r => (plan(r) && plan(r).armhole && plan(r).armhole.feasible ? plan(r).armhole.events : null), r => plan(r) && plan(r).armhole && !plan(r).armhole.feasible);
            line('Bicep stitches', r => r.inputs.sleeveCount);
            line('Cap rows', r => r.inputs.capRows);
            line('Cap top stitches', r => r.inputs.capTopCount);
            line('Cap decrease rows', r => (plan(r) && plan(r).cap && plan(r).cap.feasible ? plan(r).cap.events : null), r => plan(r) && plan(r).cap && !plan(r).cap.feasible);
            line('Cap edge vs armhole edge', r => (plan(r) && isNum(plan(r).capEdgeInches) && isNum(plan(r).armholeEdgeInches)
                ? `${plan(r).capEdgeInches} / ${plan(r).armholeEdgeInches} in` : null), bad);
        } else {
            line('Neck stitches', r => r.inputs.neckCount);
            line('Separation stitches', r => r.inputs.separationCount);
            line('Yoke rows', r => r.inputs.yokeRows);
            line('Increase rounds', r => r.inputs.increaseRounds);
            line('Stitches added', r => (plan(r) ? plan(r).rounds.map(x => `+${x.increases}`).join(', ') : null), bad);
        }
        host.appendChild(wrap);

        const words = elem('div', 'grade-findings');
        labels.forEach((size, i) => {
            const result = results[i];
            if (!result) return;
            constructionPlanLines(result).forEach(text => {
                const p = elem('div', result.feasible ? null : 'grade-warning');
                p.textContent = `${size}: ${text}`;
                words.appendChild(p);
            });
        });
        host.appendChild(words);
    }

    /** Confidence per size, and the generated instructions. Both depend on everything else the grader
     *  has worked out, so they are rendered last. */
    function renderConfidence(garment, labels, run) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['gen-output'];
        if (!host) return;
        host.replaceChildren();

        fillConstructionPicker();
        const category = UI['grade-chart']?.value || '';
        const chart = graderChart(category);
        const chartSizes = chart ? chart.sizes.map(s => s[0])
            : (A.CYC_BODY_MEASUREMENTS[category] || { sizes: [] }).sizes.map(s => s[0]);

        // A piece that misses its graded width is a warning against that size, and costs it confidence
        // the same way a fit warning does.
        const check = run && run.pieces.length ? pieceCheck(run) : { findings: [] };
        const warnings = A.CheckFitAndProportion({ garment, sections: sectionProfiles() })
            .concat(check.findings);
        // Sizes the pattern writes are measured from their own rows. Sizes it does not write are
        // measured from the counts generated for them, which is still the graded instructions rather
        // than a bust ratio applied to the sample's yardage.
        const efforts = sizeReports() ? computeSizeGrading().efforts : generatedEfforts(labels, run);

        // Where the yarn figures come from, said before the figures: a sample's own measurement, or
        // the yarn-weight table standing in for one.
        const sample = sampleYarn();
        const source = elem('p', 'helper-text');
        source.textContent = sample
            ? `Yarn: from your sample, ${A.round2(sample.yardsPerStitch)} yd per stitch`
              + (sample.source === 'sample-weight' ? ' (by swatch weight)' : '') + '.'
            : 'Yarn: from the yarn-weight table. Enter the yarn your sample used, above, for a figure '
              + 'measured from it.';
        host.appendChild(source);

        const { wrap, body } = responsiveTable(
            ['Size', 'Confidence', 'Yarn', 'Skeins', 'Hours', 'vs base', 'Main issue']);
        labels.forEach(size => {
            const confidence = A.GradingConfidence({
                size, garment, gauge: graderGauge(), chartSizes,
                warnings, modes: state.grading.modes
            });
            const effort = efforts ? efforts.find(e => e.label === size) : null;

            const tr = elem('tr');
            tr.appendChild(rowHeader(size));

            const pct = plainCell(`${confidence.score}%`);
            pct.className = confidence.score >= 90 ? 'grade-fits'
                : confidence.score >= 75 ? '' : 'grade-misfit';
            tr.appendChild(pct);
            tr.appendChild(plainCell(effort ? `${effort.yards} yd` : '—'));
            tr.appendChild(plainCell(effort ? effort.skeins : '—'));
            tr.appendChild(plainCell(effort ? effort.hours : '—'));
            tr.appendChild(plainCell(effort && effort.yardsOverBase !== null
                ? `${effort.yardsOverBase > 0 ? '+' : ''}${effort.yardsOverBase}%` : '—'));
            tr.appendChild(plainCell(confidence.mainIssue || 'nothing outstanding'));
            body.appendChild(tr);
        });
        host.appendChild(wrap);
        host.appendChild(generatedInstructions(labels, run));
    }

    /**
     * Yarn and time for sizes the pattern has not been written out to.
     *
     * Every row of a rectangular piece scales by the same ratio, so the stitch mix scales with it - a
     * size 12% wider works 12% more of each stitch it already uses. Summed from the generated counts,
     * not the bust measurement: yarn goes as area, and a bust ratio applied to a yardage figure gets the
     * direction right and the amount wrong. Only offered where that scaling is actually true.
     */
    /**
     * The yarn one stitch takes, measured from what the designer has said about their own sample:
     * the yards the sample used, over the stitches the pattern on the page works; else the swatch's
     * weight over its stitches, through the skein's yards per gram. Null when neither has been given,
     * and the estimate falls back to the yarn-weight table - which the panel says.
     */
    function sampleYarn() {
        const A = window.CrochetAnalyticsEngine;
        const typed = parseFloat(UI['grade-sample-yards']?.value);
        const unit = UI['grade-sample-yards-unit']?.value || 'yd';
        const skeinLength = parseFloat(UI['calc-skein-length']?.value);
        const skeinYards = Number.isFinite(skeinLength) && skeinLength > 0
            ? (UI['calc-skein-length-unit']?.value === 'm' ? skeinLength * 1.09361 : skeinLength) : null;

        if (Number.isFinite(typed) && typed > 0) {
            const totals = A.AggregateStitchCounts(state.patternSteps, state.analytics.lastPass?.validation.rows);
            const stitches = Object.values(totals).reduce((a, b) => a + b, 0);
            const measured = A.YardsPerStitchFromSample({
                yards: unit === 'm' ? typed * 1.09361 : typed, stitches
            });
            return measured ? { ...measured, skeinYards } : null;
        }

        const g = state.gauge;
        const skeinWeight = parseFloat(UI['calc-skein-weight']?.value);
        const skeinGrams = Number.isFinite(skeinWeight) && skeinWeight > 0
            ? (UI['calc-skein-weight-unit']?.value === 'oz' ? skeinWeight * 28.3495 : skeinWeight) : null;
        if (!(g.swatchWeight > 0) || !skeinGrams || !skeinYards) return null;
        const measured = A.YardsPerStitchFromSample({
            grams: g.swatchWeightUnit === 'oz' ? g.swatchWeight * 28.3495 : g.swatchWeight,
            stitches: g.stitches * g.rows,
            skein: { yards: skeinYards, grams: skeinGrams }
        });
        return measured ? { ...measured, skeinYards } : null;
    }

    function generatedEfforts(labels, run) {
        const A = window.CrochetAnalyticsEngine;
        if (!state.patternSteps.length || !run || !run.pieces.length) return null;
        const { targets } = run;
        const sample = sampleYarn();

        // The live steps: the base size is whatever is on the page, and evaluateAtSize's swapped-in
        // steps only exist for sizes the pattern text writes. So the stitch mix on the page is the
        // base size's, and every other size works the same mix scaled by the stitches it actually
        // works - every piece's graded rows and rules summed - which is the area of the garment. Yarn
        // goes as area; a bust ratio gets the direction right and the amount wrong, because a larger
        // size is longer as well as wider.
        const baseTotals = A.AggregateStitchCounts(state.patternSteps, state.analytics.lastPass?.validation.rows);
        const baseIndex = targets.labels.indexOf(targets.base.label);
        const stitchesAt = (i) => run.pieces.reduce((sum, piece) => {
            const n = piece.graded.totals ? piece.graded.totals.stitches[i] : null;
            return sum === null || !isNum(n) ? null : sum + n;
        }, 0);
        const baseStitches = stitchesAt(baseIndex);
        if (!baseStitches) return null;

        const efforts = targets.labels.map((label, i) => {
            const stitches = stitchesAt(i);
            if (!isNum(stitches)) return null;
            const ratio = stitches / baseStitches;
            const scaled = {};
            Object.keys(baseTotals).forEach(stitch => {
                scaled[stitch] = Math.round(baseTotals[stitch] * ratio);
            });
            return A.EstimateSizeEffort({
                label, stitchTotals: scaled, yarnWeightCategory: yarnWeightNumber(),
                yardsPerStitch: sample ? sample.yardsPerStitch : null,
                skeinYards: sample ? sample.skeinYards : null
            });
        }).filter(Boolean);
        return A.CompareSizeEffort({ efforts, baseLabel: targets.base.label });
    }

    function fillConstructionPicker() {
        const A = window.CrochetAnalyticsEngine;
        const select = UI['gen-construction'];
        if (!select || select.children.length) return;
        fillSelect(select, Object.keys(A.CONSTRUCTIONS).map(key => [key, A.CONSTRUCTIONS[key].label]));
    }

    /** The pattern's rows restated across every size. A row's own resolved count is what gets scaled -
     *  never its text - so a turning chain stays a turning chain. */
    /**
     * Every piece of the pattern graded to every size: the one pass that the generated run, the
     * validation row, the yardage comparison and the export package all read, so they cannot disagree
     * about a count.
     *
     * Each piece scales by the measurement its type names - a sleeve by the upper arm and arm length,
     * a body by the bust - falling back to the bust when it has no type, or the chart has no figure
     * for its point. The engine chains the straight stretches (the written size verbatim, every other
     * size by ratio, a shaping row keeping the change it writes) and regrades each run of shaping rows
     * as a rule, so nothing here decides a number. `pieces` is empty whenever nothing can be generated,
     * and `reason` says why.
     */
    function gradedPieces(labels) {
        const A = window.CrochetAnalyticsEngine;
        const pass = state.analytics.lastPass;
        const construction = UI['gen-construction']?.value || 'drop';
        const notation = UI['gen-notation']?.value || 'parenthetical';
        const kind = A.CONSTRUCTIONS[construction] || A.CONSTRUCTIONS.drop;
        const targets = generationTargets(labels);
        const profiles = pass && pass.validation.rows.length ? sectionProfiles() : [];
        const run = { targets, kind, construction, notation, profiles, pieces: [], reason: '' };

        if (!profiles.length) { run.reason = 'no pattern'; return run; }
        if (!kind.scalesByWidth) { run.reason = 'construction'; return run; }
        if (!targets.counts.length) { run.reason = 'no targets'; return run; }
        if (!isNum(targets.baseCount)) { run.reason = 'base not graded'; return run; }

        const choice = roundingChoice();
        run.pieces = profiles.map(profile => {
            const widthPoint = profile.points.find(p => A.MEASUREMENT_AXIS[p] === 'width');
            const lengthPoint = profile.points.find(p => A.MEASUREMENT_AXIS[p] === 'length');
            const width = (widthPoint && pieceTargets(targets.labels, widthPoint, 'stitches'))
                || { counts: targets.counts, baseCount: targets.baseCount };
            const length = lengthPoint ? pieceTargets(targets.labels, lengthPoint, 'rows') : null;
            const repeat = sectionRepeat(profile);
            const graded = A.GradePieceRows({
                counts: profile.worked.map(w => w.count),
                baseTarget: width.baseCount, targetCounts: width.counts,
                baseRows: length ? length.baseCount : null, targetRows: length ? length.counts : null,
                construction, repeat: repeat ? { multiple: repeat.multiple, plus: repeat.plus } : null,
                strategy: choice.strategy, parity: choice.parity,
                labels: targets.labels, notation,
                rowNumbers: profile.worked.map(w => rowLabelNumber(w.label))
            });
            return { profile, graded, widthPoint, lengthPoint, width, length, repeat };
        });
        return run;
    }

    /**
     * The tech editor's validation row, for every typed piece: the engine's TRUE/FALSE on whether the
     * piece reaches its graded width and works its graded rows, per size. Untyped pieces are not
     * checked - with no type there is no measurement to hold them to, and "not checked" must not read
     * as "checked and fine".
     */
    function pieceCheck(run) {
        const A = window.CrochetAnalyticsEngine;
        const labels = run.targets.labels;
        const baseIndex = labels.indexOf(run.targets.base.label);
        const pieces = run.pieces
            .filter(piece => piece.profile.type)
            .map(piece => ({
                title: piece.profile.title, type: piece.profile.type, graded: piece.graded,
                widthTargets: piece.width.counts,
                lengthTargets: piece.length ? piece.length.counts : null,
                writtenRows: piece.profile.rowCount, baseIndex,
                repeat: piece.repeat ? { multiple: piece.repeat.multiple, plus: piece.repeat.plus } : null,
                stitchesPerInch: piece.profile.stitchesPerInch
            }));
        return A.CheckGradedPieces({ pieces, labels });
    }

    /** The pattern's rows restated across every size. A row's own resolved count is what gets scaled -
     *  never its text - so a turning chain stays a turning chain. */
    function generatedInstructions(labels, run) {
        const A = window.CrochetAnalyticsEngine;
        const wrap = elem('div');
        wrap.appendChild(elem('strong', null, 'Generated instructions'));
        // Cleared before any of the early returns below, so the export package never offers a run
        // generated under a construction or base size that has since changed.
        state.grading.generated = '';

        const pass = state.analytics.lastPass;
        if (!pass || !pass.validation.rows.length) {
            wrap.appendChild(elem('p', 'placeholder-text', 'Validate a pattern in Studio to generate its size run.'));
            return wrap;
        }

        const { targets, kind, notation, profiles } = run;
        const untyped = profiles.some(profile => !profile.type);

        const note = elem('p', 'helper-text');
        note.textContent = kind.scalesByWidth
            ? `Graded as ${kind.label.toLowerCase()}: each piece's width scales with its own measurement `
              + '(upper arm for a sleeve, bust otherwise); a run of two or more shaping rows is regraded by '
              + 'count and row length per size, and written as a rule; a single shaping row keeps the '
              + "change it writes. Row numbers after a graded run are the base size's. "
              + (untyped ? "Set a piece's type under Sections to grade a sleeve by upper arm and arm length. " : '')
              + baseSizeNote(targets.base)
            : `Not generated: ${kind.reason}.`;
        wrap.appendChild(note);
        if (!kind.scalesByWidth || !targets.counts.length) return wrap;
        if (!isNum(targets.baseCount)) {
            wrap.appendChild(elem('p', 'placeholder-text',
                `Not generated: ${targets.base.label || 'the base size'} is not among the sizes being `
                + 'graded, so there is nothing to scale the other sizes against. Tick it under '
                + '"Sizes to grade".'));
            return wrap;
        }

        // Bookkeeping only: which pass row prints which counts, which opens a rule, which are inside one.
        const rows = pass.validation.rows;
        const byIndex = {};     // pass row index -> counts per size
        const ruleAt = {};      // pass row index of a run's shaping row -> the run
        const hidden = new Set();
        run.pieces.forEach(({ profile, graded }) => {
            profile.worked.forEach((w, j) => { byIndex[w.index] = graded.rows[j]; });
            graded.runs.forEach(rule => {
                ruleAt[profile.worked[rule.firstShaping].index] = { run: rule, profile };
                for (let k = rule.firstShaping + 1; k <= rule.end; k++) hidden.add(profile.worked[k].index);
            });
        });

        const text = elem('pre', 'grade-generated');
        text.textContent = rows.map((row, i) => {
            if (row.status === 'section') return `\n${row.label}`;
            if (row.status === 'note') return row.step.noteText || '';
            if (hidden.has(i)) return null;
            const counts = A.FormatSizeNumbers({
                counts: byIndex[i] || [], labels: targets.labels, notation
            });
            const line = `${row.label}: ${exportRowText(row.step)} (${counts})`;
            return ruleAt[i] ? `${line}\n${shapingRuleLine(ruleAt[i], row, rows, targets)}` : line;
        }).filter(line => line !== null).join('\n').trim();
        wrap.appendChild(text);
        state.grading.generated = text.textContent;
        return wrap;
    }

    /**
     * The stitch count each size has to reach, taken from the graded bust, and the count the base size
     * reaches - the size the pattern is written in. Every generated count is the written count times
     * the ratio of its size's target to the base's, so the base is the one number the whole run scales
     * against. `baseCount` is null when the base size is not among the graded sizes, and nothing can be
     * generated: a ratio against a size that was not graded is a ratio against nothing.
     */
    function generationTargets(labels) {
        const garment = state.grading.lastGarment || [];
        const chest = garment.find(row => row.point === 'chest');
        const base = state.grading.baseSize || { label: '', source: 'first' };
        if (!chest) return { labels: [], counts: [], base, baseCount: null };
        const usable = labels.filter(label => {
            const cell = chest.sizes.find(c => c.size === label);
            return cell && isNum(cell.stitches);
        });
        const baseCell = chest.sizes.find(c => c.size === base.label);
        return {
            labels: usable,
            counts: usable.map(label => chest.sizes.find(c => c.size === label).stitches),
            base,
            baseCount: baseCell && isNum(baseCell.stitches) ? baseCell.stitches : null
        };
    }

    /**
     * One measurement's graded figure per size, for a piece that scales by something other than the
     * bust: a sleeve's upper arm (`stitches`) and arm length (`rows`). Null where the chart has no row
     * for the point at all - a custom chart with nothing typed for it - so the caller can fall back.
     */
    function pieceTargets(labels, point, field) {
        const garment = state.grading.lastGarment || [];
        const row = garment.find(r => r.point === point);
        if (!row) return null;
        const base = state.grading.baseSize || { label: '' };
        const cellOf = label => row.sizes.find(c => c.size === label);
        const baseCell = cellOf(base.label);
        const baseCount = baseCell && isNum(baseCell[field]) ? baseCell[field] : null;
        if (!isNum(baseCount) || baseCount <= 0) return null;
        return {
            counts: labels.map(label => {
                const cell = cellOf(label);
                return cell && isNum(cell[field]) ? cell[field] : null;
            }),
            baseCount
        };
    }

    /** The number a row label ends in - "Row 3" is 3 - or null for a label that has none. */
    function rowLabelNumber(label) {
        const match = String(label || '').match(/(\d+)\s*$/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * A regraded shaping run written as the rule a multi-size pattern prints under its shaping row:
     * the rows it spans, the row worked between shapings, how often the shaping row recurs and how
     * many more times, what is worked straight after, and the count it ends on - every figure in size
     * columns, from the engine. Sizes the shaping does not fit are dashes in every column, with the
     * reason on a line of its own; nothing is nudged to make a size fit.
     */
    function shapingRuleLine({ run, profile }, shapingRow, rows, targets) {
        const t = run.graded.text;
        const word = String(shapingRow.label).replace(/\s*\d+\s*$/, '') || 'Row';
        const span = t.rowRange && t.rowRange !== '—' ? `${word}s ${t.rowRange}` : `Next ${t.rows} rows`;
        const anyFeasible = run.graded.sizes.some(s => s.feasible);

        // The row worked between shapings is the first straight row inside the run, quoted as written.
        let between = '';
        for (let k = run.firstShaping + 1; k <= run.end; k++) {
            if (profile.worked[k].count === profile.worked[k - 1].count) {
                const flat = rows[profile.worked[k].index];
                between = flat && flat.step ? exportRowText(flat.step) : '';
                break;
            }
        }

        let line = `${span}: `;
        if (!anyFeasible) {
            line += `not graded — the shaping does not fit any size.`;
        } else {
            line += between ? `${between}, working ${shapingRow.label} again ` : `work ${shapingRow.label} again `;
            line += `every ${t.every} row ${t.times} more times`;
            if (t.straight !== '0') line += `, then ${t.straight} rows straight`;
            line += ` (${t.ending})`;
            if (run.redistributed) {
                line += ` — the written ${run.direction}s were not evenly spaced; every size, including `
                      + `${targets.base.label}, is an even redistribution over the same rows to the same count`;
            }
        }
        const reasons = run.graded.sizes
            .map((s, i) => (s.feasible || !s.warning ? '' : `  ${targets.labels[i]}: ${s.warning}`))
            .filter(Boolean);
        return reasons.length ? `${line}\n${reasons.join('\n')}` : line;
    }

    /**
     * The export package: every artefact the grader can produce, each downloadable on its own. Separate
     * files rather than one archive because a zip would be a few hundred lines of bit-twiddling that is
     * not grading, and because a technical editor wants the editing report, not a bundle to unpack.
     */
    function renderExportPackage(garment, labels, run) {
        const host = UI['export-package'];
        if (!host) return;
        host.replaceChildren();

        host.appendChild(elem('strong', null, 'Export package'));

        const artefacts = exportArtefacts(garment, labels, run);
        const list = elem('div', 'grade-export-list');
        artefacts.forEach(artefact => {
            const row = elem('div', 'grade-export-row');
            const name = elem('span', null, artefact.label);
            const download = button('link-button', artefact.empty ? 'nothing to export' : 'Download',
                `export-${artefact.key}`);
            if (!artefact.empty) {
                download.addEventListener('click',
                    () => downloadFile(artefact.file, artefact.body, artefact.type,
                                       `${artefact.label} saved.`));
            }
            UI[download.id] = download;
            row.append(name, download);
            list.appendChild(row);
        });
        host.appendChild(list);
    }

    /** One place that knows what the package contains, so nothing is exported twice. */
    function exportArtefacts(garment, labels, run) {
        const A = window.CrochetAnalyticsEngine;
        const slug = projectSlug('pattern');
        const check = run && run.pieces.length ? pieceCheck(run) : { pieces: [], findings: [] };
        const finished = measurementCsv(garment, labels, 'target');
        const bodyRows = measurementCsv(garment, labels, 'body');
        // What the rounded counts really measure. Empty until a typed piece's repeat has fitted
        // something, or rows round to even - a table of blanks would read as "checked, no change".
        const actual = garment.some(row => row.sizes.some(cell => isNum(cell.actualTarget)))
            ? measurementCsv(garment, labels, 'actualTarget') : '';
        const reports = sizeReports();
        const warnings = A.CheckFitAndProportion({ garment, sections: sectionProfiles() });

        return [
            { key: 'finished', label: 'Finished-measurement table (CSV)',
              file: `${slug}-finished.csv`, type: 'text/csv', body: finished, empty: !finished },
            { key: 'body', label: 'Body-measurement table (CSV)',
              file: `${slug}-body.csv`, type: 'text/csv', body: bodyRows, empty: !bodyRows },
            { key: 'actual', label: 'Actual finished measurements after rounding (CSV)',
              file: `${slug}-actual.csv`, type: 'text/csv', body: actual, empty: !actual },
            { key: 'schematic', label: 'Schematic labels',
              file: `${slug}-schematic.txt`, type: 'text/plain',
              body: schematicLabels(garment, labels), empty: !garment.length },
            { key: 'instructions', label: 'Multi-size instructions',
              file: `${slug}-sizes.txt`, type: 'text/plain',
              body: state.grading.generated || '', empty: !state.grading.generated },
            { key: 'calc', label: 'Grading calculation report',
              file: `${slug}-calculations.txt`, type: 'text/plain',
              body: calculationReport(garment, labels), empty: !garment.length },
            { key: 'editing', label: 'Technical-editing report',
              file: `${slug}-editing.txt`, type: 'text/plain',
              body: editingReport(warnings, reports, {
                  check, statement: sizingStatement(garment, labels, state.grading.baseSize)
              }), empty: !garment.length },
            { key: 'json', label: 'JSON for Stitch Math',
              file: `${slug}-grading.json`, type: 'application/json',
              body: JSON.stringify({ version: 1, grading: state.grading, gauge: state.gauge,
                                     garment, sizes: labels }, null, 2), empty: !garment.length }
        ];
    }

    /** A measurement table as CSV: sizes across, measurements down. */
    function measurementCsv(garment, labels, field) {
        if (!garment.length) return '';
        const cell = (value) => (isNum(value) ? String(value) : '');
        const rows = [['Measurement', ...labels].join(',')];
        garment.forEach(row => {
            const values = labels.map(size => {
                const at = row.sizes.find(c => c.size === size);
                return at ? cell(at[field]) : '';
            });
            // Labels carry commas ("Cross Back (shoulder to shoulder)"), so they are quoted.
            rows.push([`"${row.label}"`, ...values].join(','));
        });
        return rows.join('\n');
    }

    function schematicLabels(garment, labels) {
        const lines = ['SCHEMATIC LABELS', ''];
        garment.forEach(row => {
            const values = labels.map(size => {
                const at = row.sizes.find(c => c.size === size);
                // The measurement the garment will really have, where rounding has been applied.
                const value = at && isNum(at.actualTarget) ? at.actualTarget : (at ? at.target : null);
                return isNum(value) ? `${value}` : '—';
            });
            lines.push(`${row.label}: ${values.join(' (')}${values.length > 1 ? ')' : ''} in`);
        });
        return lines.join('\n');
    }

    /** Every number, with the working that produced it. */
    function calculationReport(garment, labels) {
        const lines = ['GRADING CALCULATION REPORT', ''];
        garment.forEach(row => {
            lines.push(`--- ${row.label} ---`);
            labels.forEach(size => {
                const trace = traceFor(row, size);
                if (!trace || !trace.steps.length) return;
                lines.push(`  ${size}:`);
                trace.steps.forEach(step => {
                    lines.push(`    ${step.name}: ${step.value}${step.note ? `  (${step.note})` : ''}`);
                });
            });
            lines.push('');
        });
        // The shaping plans, per size, in the engine's own words.
        const plans = labels.map(size => ({ size, plan: neckPlansFor(garment, size) }))
            .filter(entry => entry.plan);
        if (plans.length) {
            lines.push('--- Neck, shoulders and armholes ---');
            plans.forEach(({ size, plan }) => {
                lines.push(`  ${size}:`);
                [['Neckline', plan.neck], ['Shoulder', plan.shoulder], ['Armhole', plan.armhole]].forEach(([name, part]) => {
                    if (part) lines.push(`    ${name}: ${part.feasible ? part.text : part.warning}`);
                });
            });
            lines.push('');
        }
        // The construction planned per size, for a yoke or a set-in sleeve.
        const constructions = labels.map(size => ({ size, result: constructionPlanFor(garment, size) }))
            .filter(entry => entry.result && entry.result.planner);
        if (constructions.length) {
            const A = window.CrochetAnalyticsEngine;
            const kind = A.CONSTRUCTIONS[constructions[0].result.construction];
            lines.push(`--- Construction per size: ${kind ? kind.label : constructions[0].result.construction} ---`);
            constructions.forEach(({ size, result }) => {
                lines.push(`  ${size}:`);
                constructionPlanLines(result).forEach(text => lines.push(`    ${text}`));
            });
            lines.push('');
        }
        return lines.join('\n');
    }

    /** What a technical editor needs: everything unresolved, in one list. */
    function editingReport(warnings, reports, extras = {}) {
        const A = window.CrochetAnalyticsEngine;
        const lines = ['TECHNICAL-EDITING REPORT', ''];

        // What the pattern will say about its sizes, first: it is the first thing an editor checks.
        if (extras.statement && extras.statement.lines.length) {
            lines.push('Sizing statement:');
            extras.statement.lines.forEach(line => lines.push(`  ${line}`));
            lines.push('');
        }

        lines.push('Fit and proportion:');
        if (!warnings.length) lines.push('  Nothing outstanding.');
        warnings.forEach(w => lines.push(`  [${w.state}] ${w.size}: ${w.check} — ${w.detail}`));

        // The validation row a grading spreadsheet keeps: per piece, per size, TRUE or the shortfall.
        const check = extras.check;
        if (check && check.pieces.length) {
            lines.push('', 'Per size, per piece:');
            check.pieces.forEach(piece => {
                piece.sizes.forEach(size => {
                    const width = !size.feasible ? 'does not fit'
                        : size.widthOk ? `${size.widestCount} sts as graded`
                        : isNum(size.widthTarget) ? `${size.widestCount} sts, ${size.widthTarget} needed`
                        : `${size.widestCount} sts`;
                    const rows = !size.feasible ? ''
                        : size.lengthOk === null ? `, ${size.rows} rows`
                        : size.lengthOk ? `, ${size.rows} rows as graded`
                        : `, ${size.rows} rows, ${size.intendedRows} intended`;
                    lines.push(`  ${piece.title} at ${size.size}: ${width}${rows}`);
                });
            });
        }

        if (reports) {
            lines.push('', 'Per size, from the compiler:');
            reports.forEach(r => {
                lines.push(`  ${r.label}: ${r.rowsCounted} rows, ${r.startingCount} → ${r.endingCount} sts, `
                    + `${r.consumed} consumed, ${r.produced} produced, `
                    + `+${r.increases}/-${r.decreases}, ${r.allValid ? 'validates' : 'DOES NOT VALIDATE'}`);
            });
            const cross = A.CrossSizeReport({ reports, repeat: firstSectionRepeat() });
            lines.push('', 'Across sizes:');
            if (!cross.length) lines.push('  Nothing outstanding.');
            cross.forEach(c => lines.push(`  [${c.state}] ${c.size}: ${c.check} — ${c.detail}`));
        }

        return lines.join('\n');
    }

    /** How counts should round, whether the repeat count is constrained, and whether row counts round
     *  to even - a grader's habit, so every new action starts on the right side of the fabric. */
    function roundingChoice() {
        return {
            strategy: UI['grade-rounding']?.value || 'nearest',
            parity: UI['grade-parity']?.value || 'any',
            rowParity: UI['grade-row-parity']?.value || 'any'
        };
    }

    /** Section-by-section: what the pattern repeats over, what it works at, and whether the count it
     *  actually reaches fits. Where pattern-derived data lives; it reaches the graded table above only
     *  through a piece the designer has typed - see repeatByPoint. */
    function renderSectionProfiles() {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-sections'];
        if (!host || !A) return;
        host.replaceChildren();

        const profiles = sectionProfiles();
        host.appendChild(elem('strong', null, 'Sections and stitch multiples'));

        if (!profiles.length) {
            host.appendChild(elem('p', 'placeholder-text', 'Validate a pattern in Studio to see its sections, their counts and the repeat each one works over.'));
            return;
        }

        const note = elem('p', 'helper-text');
        note.textContent = 'Row and stitch counts are read from the pattern, not typed. '
            + 'A multiple stated in the text is filled in for you; anything you enter here wins.';
        host.appendChild(note);

        const { wrap, body } = responsiveTable(
            ['Section', 'Piece', 'Joins', 'Counts', 'Size', 'Multiple', 'Gauge', 'Shaping', 'Fit'],
            'grade-section-table');
        profiles.forEach(profile => body.appendChild(sectionRow(profile)));
        host.appendChild(wrap);
    }

    // ---- The written garment, held to its construction -------------------------

    // The health panel's three, plus the one it never needs: a check that could not run. Reported rather
    // than dropped, because "we did not look" and "we looked and it was fine" are the two answers a
    // validation panel must never conflate.
    const CHECK_ICONS_SKIPPABLE = { pass: CHECK_ICONS.pass, warn: CHECK_ICONS.warn,
                                    fail: CHECK_ICONS.fail, skip: '·' };

    /**
     * Every row of a raglan yoke can consume exactly what the row before it produced - the stitch math
     * perfect, the health score 100 - and the yoke still be impossible, because a raglan gains eight
     * stitches a round and 63 is not a multiple of eight. No row-by-row check can see that; this reads
     * each piece back as a shape instead, held to the construction the Construction dropdown above names -
     * the same field `generatedInstructions` reads, so there is no second control free to disagree with it.
     */
    function renderConstructionCheck() {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-construction-result'];
        if (!host || !A) return;

        fillConstructionPicker();
        const sections = sectionProfiles();
        renderConstructionPieces(sections);
        host.replaceChildren();

        if (!sections.length) {
            host.appendChild(elem('p', 'placeholder-text', 'No pattern is open. Compile one on the Studio tab and its pieces are checked here.'));
            return;
        }

        const report = A.CheckGarmentConstruction({
            sections,
            construction: UI['gen-construction']?.value || 'drop',
            rowsPerInch: effectiveRowGauge()
        });

        // Which planner answered, named rather than implied. The whole panel is one engine call, and a
        // reader should be able to go and read it.
        const source = elem('p', 'construction-check-source');
        source.textContent = report.planner
            ? `Checked as ${report.label.toLowerCase()}, by ${report.planner}.`
            : `Checked as ${report.label.toLowerCase()}.`;
        host.appendChild(source);

        const list = elem('ul', 'health-checks');
        report.checks.forEach(check => {
            const item = elem('li', `check-${check.state}`);

            const icon = elem('span', 'check-icon', CHECK_ICONS_SKIPPABLE[check.state] || '');
            const name = elem('span', 'check-name', check.name);
            const detail = elem('span', 'check-detail', check.detail);

            item.append(icon, name, detail);
            list.appendChild(item);
        });
        host.appendChild(list);
    }

    /** The pieces the check is reading, and the type each was given. Shown because a check that silently
     *  found nothing to check looks identical to one that passed - and because the fix for most skipped
     *  checks is to type a section here. */
    function renderConstructionPieces(sections) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-construction-pieces'];
        if (!host) return;
        host.replaceChildren();
        if (!sections.length) return;

        const roles = {};
        Object.keys(A.GARMENT_ROLES).forEach(role => {
            A.GARMENT_ROLES[role].forEach(type => { roles[type] = role; });
        });

        sections.forEach(section => {
            const chip = elem('span');
            // Only a piece the construction check actually reads is marked as read.
            chip.className = roles[section.type] ? 'construction-piece is-read' : 'construction-piece';
            const name = elem('strong', null, section.title);
            const role = elem('em', null, section.typeLabel || 'no type set');
            chip.append(name, role);
            host.appendChild(chip);
        });
    }

    function sectionRow(profile) {
        const tr = elem('tr');

        tr.appendChild(rowHeader(profile.title));

        const repeat = sectionRepeat(profile);
        const set = state.grading.sections[profile.key] || {};
        const A = window.CrochetAnalyticsEngine;

        // What kind of piece this is. Not readable from a pattern - "SLEEVE" and "Second Side" are both
        // headings - so it is the one thing here the designer states.
        const typeCell = elem('td');
        typeCell.appendChild(pickBox(`grade-sy-${profile.key}`, set.type,
            [['', 'unset']].concat(Object.keys(A.SECTION_TYPES).map(k => [k, A.SECTION_TYPES[k].label]))));
        tr.appendChild(typeCell);

        // Which piece it is seamed to, so the two can be checked against each other.
        const joinCell = elem('td');
        joinCell.appendChild(pickBox(`grade-sj-${profile.key}`, set.joinTo,
            [['', 'none']].concat(sectionProfiles()
                .filter(other => other.key !== profile.key)
                .map(other => [other.key, other.title]))));
        tr.appendChild(joinCell);

        // Start to end over how many rows: everything the shaping is worked out from.
        tr.appendChild(plainCell(profile.startingCount === null ? '—'
            : `${profile.startingCount} → ${profile.endingCount} over ${profile.rowCount}`));

        // What that comes out at, at this piece's own gauge.
        tr.appendChild(plainCell(profile.widthInches === null && profile.lengthInches === null ? '—'
            : `${profile.widthInches === null ? '—' : bothUnits(profile.widthInches)}`
              + ` × ${profile.lengthInches === null ? '—' : bothUnits(profile.lengthInches)}`));

        // Detected values sit in the placeholder, not the value: a filled-in box would be
        // indistinguishable from one the designer typed, and only one of those should win.
        const multiple = elem('td');
        multiple.appendChild(numberBox(`grade-sm-${profile.key}`, set.multiple,
            profile.detected ? String(profile.detected.multiple) : 'none', 1));
        multiple.appendChild(elem('span', 'grade-plus', '+'));
        multiple.appendChild(numberBox(`grade-sp-${profile.key}`, set.plus,
            profile.detected ? String(profile.detected.plus) : '0', 1));
        // Where the repeat in force came from. Refreshed alongside the fit, or overriding a detected
        // multiple would leave the cell still claiming to quote the pattern.
        const tag = elem('em', 'grade-axis');
        tag.id = `grade-st-${profile.key}`;
        UI[tag.id] = tag;
        tag.textContent = repeatSourceLabel(repeat);
        multiple.appendChild(tag);
        tr.appendChild(multiple);

        const gauge = elem('td');
        gauge.appendChild(numberBox(`grade-sg-${profile.key}`, set.stitchesPerInch, 'as set', 0.25));
        gauge.appendChild(numberBox(`grade-sr-${profile.key}`, set.rowsPerInch, 'rows', 0.25));
        tr.appendChild(gauge);

        // How the piece gets from its starting count to its ending count over its rows.
        const shapingCell = elem('td');
        shapingCell.appendChild(pickBox(`grade-sh-${profile.key}`, set.shaping,
            Object.keys(A.SHAPING_PRESETS).map(k => [k, `${k} (${A.SHAPING_PRESETS[k].perEvent})`])));
        const shapingText = elem('div');
        shapingText.id = `grade-sd-${profile.key}`;
        shapingText.className = 'grade-count';
        UI[shapingText.id] = shapingText;
        fillShapingCell(shapingText, profile);
        shapingCell.appendChild(shapingText);
        tr.appendChild(shapingCell);

        const fit = elem('td');
        fit.id = `grade-sf-${profile.key}`;
        UI[fit.id] = fit;
        fillFitCell(fit, profile, repeat);
        tr.appendChild(fit);
        return tr;
    }

    /** The shaping a piece already contains, read back out of its own counts. Reported rather than
     *  imposed: it says what the pattern does and, when the numbers do not work, what is wrong. */
    function fillShapingCell(host, profile) {
        host.replaceChildren();
        const shaping = profile.shaping;
        if (!shaping || (!shaping.text && !shaping.warning)) {
            host.textContent = 'no counts yet';
            return;
        }
        if (shaping.warning) {
            host.appendChild(elem('div', 'grade-misfit', shaping.warning));
            return;
        }
        host.appendChild(elem('div', null, shaping.text));
        if (shaping.leftoverRows > 0) {
            const balanced = elem('div');
            // The plain reading leaves rows over; the balanced one uses every row. Both are correct, and
            // which to write is the designer's call. The wording comes from the engine, which owns the
            // ordinals and the plurals.
            balanced.textContent = `${shaping.leftoverRows} row${shaping.leftoverRows === 1 ? '' : 's'} `
                + `straight, or ${shaping.balancedText}`;
            host.appendChild(balanced);
        }
    }

    /** A dropdown built as a real element so its value can be read back. */
    function pickBox(id, value, options, handler) {
        const select = elem('select', 'grade-section-input', null, id);
        fillSelect(select, options);
        if (value) select.value = value;
        register(select, handler || readSectionInputs);
        return select;
    }

    const repeatSourceLabel = (repeat) =>
        repeat && repeat.source === 'pattern' ? 'from the pattern'
        : repeat ? 'yours' : '';

    function plainCell(text) {
        return elem('td', null, String(text));
    }

    function numberBox(id, value, placeholder, step) {
        const input = elem('input');
        input.type = 'number';
        input.step = String(step);
        input.min = '0';
        input.id = id;
        input.className = 'grade-section-input';
        input.placeholder = placeholder;
        if (Number.isFinite(value)) input.value = String(value);
        register(input, readSectionInputs);
        return input;
    }

    /** Whether the count the pattern actually reaches fits its repeat, and if not, the valid counts
     *  either side with what each measures. A count is never quietly adjusted here - this reports, the
     *  designer decides. */
    function fillFitCell(td, profile, repeat) {
        const A = window.CrochetAnalyticsEngine;
        td.replaceChildren();
        const count = profile.widestStitches;

        if (!repeat || !count) {
            td.textContent = repeat ? 'no count yet' : 'no multiple set';
            return td;
        }

        const bare = { multiple: repeat.multiple, plus: repeat.plus };
        const spi = sectionGauge(profile.key).stitchesPerInch;
        const fit = A.FitToMultiple({ count, repeat: bare });

        const line = elem('div', null, `${count} over ${fit.label}: ${fit.fits ? 'fits' : 'does not fit'}`);
        line.className = fit.fits ? 'grade-fits' : 'grade-misfit';
        td.appendChild(line);
        if (fit.fits) return td;

        const signed = (n) => `${n > 0 ? '+' : ''}${n}`;

        // What the chosen rounding would do, and what it costs. Reported rather than applied: the pattern
        // says what it says, and a number is never moved on the designer's behalf without the difference
        // being shown next to it.
        if (spi) {
            const choice = roundingChoice();
            const rounded = A.RoundStitchCount({
                targetInches: count / spi, stitchesPerInch: spi, repeat: bare,
                strategy: choice.strategy, parity: choice.parity, piece: 'half'
            });
            const applied = elem('div', 'grade-rounded');
            applied.textContent = `Rounds to ${rounded.stitches}: `
                + `${bothUnits(rounded.targetInches)} becomes ${bothUnits(rounded.gradedInches)}, `
                + `a difference of ${signed(rounded.differenceInches)} in`;
            td.appendChild(applied);
        }

        // Every alternative, with its consequence, in the same breath as the problem.
        const list = elem('div', 'grade-count');
        A.NearestValidCounts({ count, repeat: bare, stitchesPerInch: spi, span: 1 })
            .filter(row => row.valid)
            .forEach(row => {
                const option = elem('div');
                option.textContent = row.inches === null
                    ? `${row.count} (${signed(row.count - count)})`
                    : `${row.count} = ${bothUnits(row.inches)} (${signed(row.deltaInches)} in)`;
                list.appendChild(option);
            });
        td.appendChild(list);
        return td;
    }

    /** A section's own gauge if it names one, otherwise the project's. */
    function sectionGauge(key) {
        return window.CrochetAnalyticsEngine.EffectiveGauge(graderGauge(), { section: key });
    }

    /**
     * The gauge object the engine expects: washed and unwashed swatches, plus whatever individual
     * sections have overridden.
     *
     * Densities are stored per gauge unit, but every measurement the grader works in is inches, so a
     * swatch measured in centimetres is converted here. It used to be handed over as-is, which quietly
     * graded a 16-sts-per-10-cm fabric as though it were 16 per 10 INCHES.
     */
    function graderGauge() {
        const g = state.gauge;
        const perInch = (density) => (g.unit === 'cm' ? density * CM_PER_INCH : density) || 0;

        const sections = {};
        Object.keys(state.grading.sections).forEach(key => {
            const set = state.grading.sections[key];
            const entry = {};
            // A section gauge is typed in stitches per inch directly, so it is not converted.
            if (Number.isFinite(set.stitchesPerInch)) entry.stitchesPerInch = set.stitchesPerInch;
            if (Number.isFinite(set.rowsPerInch)) entry.rowsPerInch = set.rowsPerInch;
            if (Object.keys(entry).length) sections[key] = entry;
        });

        return {
            washed: {
                stitchesPerInch: g.washedStitches && g.width ? perInch(g.washedStitches / g.width) : 0,
                rowsPerInch: g.washedRows && g.height ? perInch(g.washedRows / g.height) : 0
            },
            unwashed: { stitchesPerInch: perInch(g.stitchDensity), rowsPerInch: perInch(g.rowDensity) },
            sections
        };
    }

    /** Reads the section boxes back into state and redraws the cells that report, then the graded
     *  table - a typed piece's repeat is what its measurement is fitted to, and its type is what the
     *  generated run and the validation row grade it by. The section table itself is not rebuilt, so
     *  the control being typed into keeps its caret. */
    function readSectionInputs() {
        const profiles = sectionProfiles();
        profiles.forEach(profile => {
            const num = (prefix) => {
                const value = parseFloat(UI[`${prefix}-${profile.key}`]?.value);
                return Number.isFinite(value) ? value : null;
            };
            const pick = (prefix) => UI[`${prefix}-${profile.key}`]?.value || '';
            const entry = {
                multiple: num('grade-sm'), plus: num('grade-sp'),
                stitchesPerInch: num('grade-sg'), rowsPerInch: num('grade-sr'),
                type: pick('grade-sy'), joinTo: pick('grade-sj'), shaping: pick('grade-sh')
            };
            const holdsSomething = Object.keys(entry)
                .some(key => entry[key] !== null && entry[key] !== '');
            if (holdsSomething) state.grading.sections[profile.key] = entry;
            else delete state.grading.sections[profile.key];
        });
        // Only the cells that report are rebuilt. Redrawing the whole table would replace the control
        // being used and take the caret with it.
        sectionProfiles().forEach(profile => {
            const repeat = sectionRepeat(profile);
            const cell = UI[`grade-sf-${profile.key}`];
            if (cell) fillFitCell(cell, profile, repeat);
            const tag = UI[`grade-st-${profile.key}`];
            if (tag) tag.textContent = repeatSourceLabel(repeat);
            const shaping = UI[`grade-sd-${profile.key}`];
            if (shaping) fillShapingCell(shaping, profile);
        });
        // Its own host, not a cell in the table above, so rebuilding it here cannot take a caret with it.
        // A section's type is exactly what the construction check reads pieces by, so it has to follow
        // this handler rather than wait for the next full renderGrader pass.
        renderConstructionCheck();
        // The type names the measurement a piece is graded by, and its repeat is what that
        // measurement's count is fitted to - so the graded table, and everything drawn from it, follows
        // this handler. The section table itself is not rebuilt, so the caret survives.
        if (UI['grade-chart']?.value) renderGradeTables();
    }

    /** One chart, not one per piece. Every section (Body, Sleeve, ...) grades against the same size
     *  chart, the same ease and the same half-a-circumference convention, so a separate table per piece
     *  said nothing a single one does not. */
    function renderGradeTables() {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-tables'];
        if (!host) return;
        host.innerHTML = '';
        // Cleared up front rather than only on success: an early return below leaves no garment graded,
        // and the dashboard's schematic preview reads this same field, so it would otherwise keep showing
        // a chart the designer just cleared.
        state.grading.lastGarment = null;
        if (UI['grade-sizing-statement']) UI['grade-sizing-statement'].replaceChildren();

        const category = UI['grade-chart']?.value || '';
        const chart = graderChart(category);
        if (!category || (category === 'custom' && !chart)) {
            host.innerHTML = category === 'custom'
                ? '<p class="placeholder-text">Name at least one custom size under Body measurements.</p>'
                : '<p class="placeholder-text">Choose a size chart to grade against.</p>';
            return;
        }

        const resolved = resolvedEase();
        // A derived ease grades exactly as a stated one would; an ease typed as a percentage stays one,
        // and so scales with every size. ResolveEase decides which, and says which.
        const ease = resolved.complete ? resolved.easeApplied : graderEase();

        // A custom chart grades every size it names; a published one grades the ticked ones.
        const sizes = chart ? null : selectedSizes(category);
        const labels = chartLabels(category, chart);
        const pointEase = graderPointEase(category, chart);
        const gauge = graderGauge();
        const overrides = graderOverrides(labels, A.ChartPoints(category, chart));

        // Fixed at 'half': a garment worked flat is two pieces, front and back, each half the finished
        // circumference. That is the shape of the patterns this grades, so it is no longer a per-piece
        // choice the designer has to make.
        //
        // Each width is fitted to the repeat of the typed piece worked to it, and every cell then
        // carries the measurement its rounded count really gives - the "rounding effects" column of a
        // grading spreadsheet. Nothing typed, nothing fitted: the count is the plain conversion.
        const repeats = repeatByPoint();
        const graded = A.GradeGarment({ category, chart, sizes, ease, pointEase, gauge,
                                        overrides, piece: 'half',
                                        rounding: { ...roundingChoice(), byPoint: repeats.byPoint } });
        // Which size the pattern on the page is written in. Everything below that says "base" - the
        // locked measurements, the generated size run, the yarn comparison - reads this one answer.
        const base = resolveBaseSize({
            labels, graded,
            everyLabel: (chart || A.CYC_BODY_MEASUREMENTS[category] || { sizes: [] }).sizes.map(s => s[0])
        });
        state.grading.baseSize = base;
        // A locked measurement holds the base size's value in every size, and the stitch count that
        // follows from it moves with it.
        const garment = A.ApplyDimensionModes({
            garment: graded,
            modes: graderModes(A.ChartPoints(category, chart)),
            baseSize: base.label
        });
        // Kept for the panels below, which all grade against the same garment.
        state.grading.lastGarment = garment;
        renderSizingStatement(garment, labels, base, resolved);
        host.appendChild(buildGradeTable(garment, labels, base, repeats.sources));
        // Every piece graded to every size, once: the report's validation row, the generated run, the
        // yardage comparison and the export package all read this one result.
        const run = gradedPieces(labels);
        renderSchematic(garment, labels);
        renderGradeReport(garment, labels, run);
        renderMotifLayout(garment, labels);
        renderNeckAndShoulders(garment, labels);
        renderConstructionPerSize(garment, labels);
        renderConfidence(garment, labels, run);
        renderExportPackage(garment, labels, run);
    }

    /** The engine's sizing statement for the garment on the page, built the same way wherever it is
     *  shown, so the panel, the editing report and the pattern export cannot say different things. */
    function sizingStatement(garment, labels, base, resolved) {
        const A = window.CrochetAnalyticsEngine;
        const category = UI['grade-chart']?.value || '';
        const chart = graderChart(category) || A.CYC_BODY_MEASUREMENTS[category] || null;
        return A.SizingStatement({
            base, resolved: resolved || resolvedEase(), garment, labels, chart,
            notation: UI['gen-notation']?.value || 'parenthetical'
        });
    }

    function renderSizingStatement(garment, labels, base, resolved) {
        const host = UI['grade-sizing-statement'];
        if (!host) return;
        host.replaceChildren();
        sizingStatement(garment, labels, base, resolved).lines.forEach(line => {
            host.appendChild(elem('p', null, line));
        });
    }

    /**
     * Which of the graded sizes the pattern on the page is written in.
     *
     * A pattern is written in ONE size, and every other size is a ratio against it - so the answer
     * decides every generated count, and a wrong one restates a Large as a Small with nothing to show
     * for it. It is settled in this order, and the source is returned with the label so the panels can
     * say which applied rather than leave a Medium pattern looking as though it grew out of X-Small:
     *
     *   named     - the name the designer typed, in any spelling the chart's sizes go by ("M", "Med",
     *               "Medium"; "2X", "2XL", "XXL"). The one answer that is not a reading.
     *   selected  - a pattern that already writes several sizes is validated at one of them, and the
     *               counts on the page are that size's, so the run is generated from it.
     *   nearest   - the size whose graded width is closest to the widest row the pattern reaches. A
     *               reading, and reported as one: the note under the generated run says the count it
     *               was read from, and naming the size overrides it.
     *   first     - the first size graded, when there is no pattern to read from. A locked measurement
     *               has to lock to something.
     *
     * A typed name that matches none of the sizes falls through and is reported as `unmatched`, so a
     * typo does not silently become the first size. A name that IS a size on the chart but is not
     * ticked under "Sizes to grade" is matched against `everyLabel` and returned with `excluded: true`
     * rather than falling through: the pattern is still written in that size, and the answer to "it is
     * not being graded" is to say so, not to read the pattern as some other size.
     */
    function resolveBaseSize({ labels = [], everyLabel = labels, graded = [] } = {}) {
        const A = window.CrochetAnalyticsEngine;
        const typed = (UI['grade-base-name']?.value || '').trim();
        if (typed) {
            const named = A.MatchSizeLabel(typed, everyLabel);
            if (named) {
                return { label: named, source: 'named', typed, unmatched: '',
                         excluded: !labels.includes(named) };
            }
        }

        // The size the pattern is being validated at, stripped of the "(M)" shown beside it.
        if (state.sizeCount > 1) {
            const current = String(sizeVariantNames(state.sizeCount)[state.sizeIndex] || '')
                .replace(/\s*\(.*\)\s*$/, '');
            const selected = A.MatchSizeLabel(current, everyLabel);
            if (selected) {
                return { label: selected, source: 'selected', typed, unmatched: typed,
                         excluded: !labels.includes(selected) };
            }
        }

        const widest = widestPatternRow();
        const chest = (graded || []).find(row => row.point === 'chest');
        if (widest && chest) {
            const nearest = A.NearestSizeByCount({ cells: chest.sizes, stitches: widest.stitches });
            if (nearest) {
                return { label: nearest.size, source: 'nearest', typed, unmatched: typed,
                         stitches: widest.stitches, difference: nearest.difference };
            }
        }

        return { label: labels[0] || '', source: 'first', typed, unmatched: typed };
    }

    /** The widest row of the pattern on the page, at the size it is being validated at. */
    function widestPatternRow() {
        const pass = state.analytics.lastPass;
        if (!pass || !pass.validation.rows.length) return null;
        return window.CrochetAnalyticsEngine.WidestFabricRow(pass.validation.rows);
    }

    /** One sentence on which size the run is generated from and why, for the panels that show it. */
    function baseSizeNote(base) {
        if (!base || !base.label) return '';
        const typo = base.unmatched
            ? `"${base.unmatched}" is not a size on this chart. ` : '';
        switch (base.source) {
            case 'named': return `Written in ${base.label}, as named.`;
            case 'selected': return `${typo}Written in ${base.label}, the size being validated.`;
            case 'nearest': return `${typo}Read as ${base.label}: its widest row is ${base.stitches} sts, `
                + `nearest that size's graded width. Type the base size name to change it.`;
            default: return `${typo}Written in ${base.label}, the first size graded. Type the base size name to change it.`;
        }
    }

    // Where each measurement sits on the schematic: the label anchor, and the line drawn to show what is
    // being measured. A sweater front, flat, in a 300 x 260 box.
    const SCHEMATIC_POINTS = [
        { point: 'chest', x: 150, y: 150, line: [40, 150, 260, 150] },
        { point: 'waist', x: 150, y: 190, line: [48, 190, 252, 190] },
        { point: 'hip', x: 150, y: 232, line: [44, 232, 256, 232] },
        { point: 'crossBack', x: 150, y: 44, line: [95, 44, 205, 44] },
        { point: 'armholeDepth', x: 72, y: 105, line: [62, 62, 62, 148] },
        { point: 'upperArm', x: 30, y: 92, line: [8, 92, 62, 92] },
        { point: 'backLength', x: 278, y: 145, line: [278, 36, 278, 240] },
        { point: 'armLength', x: 24, y: 130, line: [24, 66, 24, 196] }
    ];

    // The garment outline, as one path: shoulders, sleeve, side seam, hem.
    const SCHEMATIC_BODY = 'M95 36 L205 36 L205 62 L252 78 L252 196 L214 196 L214 240 '
                         + 'L86 240 L86 196 L48 196 L48 78 L95 62 Z';

    /** A schematic with a hit target on every measurement it carries. Drawn from the graded garment
     *  rather than beside it, so a point that is not on the chart is not on the drawing either. */
    function renderSchematic(garment, sizeLabels) {
        const host = UI['grade-schematic'];
        if (!host) return;
        host.replaceChildren();
        if (!garment.length) return;

        const carried = SCHEMATIC_POINTS.filter(spot => garment.some(row => row.point === spot.point));
        const heading = elem('strong', null, 'Schematic');
        const note = elem('p', 'helper-text', 'Click a measurement to see how its stitch count was arrived at.');
        host.append(heading, note);

        const svg = svgEl('svg', {
            viewBox: '0 0 300 260', class: 'grade-schematic-svg',
            role: 'group', 'aria-label': 'Garment schematic with clickable measurements'
        });
        svg.appendChild(svgEl('path', { d: SCHEMATIC_BODY, class: 'grade-schematic-body' }));

        carried.forEach(spot => {
            const [x1, y1, x2, y2] = spot.line;
            svg.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'grade-schematic-rule' }));

            const hit = svgEl('circle', {
                cx: spot.x, cy: spot.y, r: 11, class: 'grade-schematic-hit',
                tabindex: '0', role: 'button',
                'aria-label': window.CrochetAnalyticsEngine.MEASUREMENT_LABELS[spot.point] || spot.point
            });
            // Assigned as a property, not an attribute: setAttribute does not register the element for
            // lookup, so the target would be found but carry no listener.
            hit.id = `grade-pt-${sectionKey(spot.point)}`;
            UI[hit.id] = hit;
            hit.addEventListener('click', () => showPointDetail(spot.point, garment, sizeLabels));
            svg.appendChild(hit);
        });

        host.appendChild(svg);
        // Opened on whatever the schematic leads with, so the panel is never a blank box.
        if (carried.length) showPointDetail(carried[0].point, garment, sizeLabels);
    }

    /** SVG needs its own namespace; createElement alone produces an inert HTML element. */
    function svgEl(name, attributes) {
        const el = document.createElementNS
            ? document.createElementNS('http://www.w3.org/2000/svg', name)
            : document.createElement(name);
        Object.keys(attributes).forEach(key => el.setAttribute(key, String(attributes[key])));
        return el;
    }

    /**
     * The six lines behind one measurement, per size: what the body measures, what was added, what that
     * targets, what it converts to, what it rounded to, and what the rounded count actually finishes at.
     * The last two are the point - a stitch count is a whole number and the measurement it produces is
     * rarely the one asked for.
     */
    function showPointDetail(point, garment, sizeLabels) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['grade-point-detail'];
        if (!host) return;
        host.replaceChildren();

        const row = garment.find(r => r.point === point);
        if (!row) return;

        host.appendChild(elem('strong', null, A.MEASUREMENT_LABELS[point] || point));

        const { wrap, body } = responsiveTable(['', ...sizeLabels]);

        // Every column is a full trace from the engine, so the rows of this table are whatever the engine
        // says the working is - not restated here. The six lines this used to build by hand have become
        // the trace's own steps.
        const traces = {};
        sizeLabels.forEach(size => { traces[size] = traceFor(row, size); });

        // Widths and lengths trace through different steps, so the row headings come from whichever size
        // actually produced a trace rather than a fixed list.
        const shape = sizeLabels.map(size => traces[size]).find(t => t && t.steps.length);
        (shape ? shape.steps : []).forEach((step, index) => {
            const tr = elem('tr');
            const name = rowHeader('');
            // The name goes in its own element rather than as the cell's own text: setting textContent
            // and then appending a child leaves two ideas of what the cell says, and which wins is not
            // worth depending on.
            name.appendChild(elem('span', null, step.name));
            if (step.note) {
                name.appendChild(elem('em', 'grade-axis', step.note));
            }
            tr.appendChild(name);
            sizeLabels.forEach(size => {
                const trace = traces[size];
                const at = trace && trace.steps[index];
                tr.appendChild(plainCell(at ? at.value : '—'));
            });
            body.appendChild(tr);
        });
        host.appendChild(wrap);
    }

    /** The engine's working for one measurement at one size. */
    function traceFor(row, size) {
        const A = window.CrochetAnalyticsEngine;
        const cell = row.sizes.find(c => c.size === size);
        if (!cell) return null;
        const gauge = A.EffectiveGauge(graderGauge());
        const choice = roundingChoice();
        // The ease is whatever actually reached this measurement, read back out of the graded cell rather
        // than guessed at from the controls - a point ease, a section ease and the overall figure all
        // arrive here looking the same.
        const applied = isNum(cell.body) && isNum(cell.target)
            ? { value: A.round2(cell.target - cell.body), mode: 'in' } : null;
        return A.TraceMeasurement({
            label: (A.MEASUREMENT_LABELS[row.point] || row.point).toLowerCase(),
            body: cell.body,
            ease: applied,
            // The share the graded cell carried, so a cross back or an upper arm traces as the whole
            // measurement it is, and only a body circumference as half.
            allocation: isNum(cell.share) ? cell.share : (cell.piece === 'half' ? 0.5 : 1),
            axis: row.axis,
            stitchesPerInch: gauge.stitchesPerInch,
            rowsPerInch: gauge.rowsPerInch,
            // The same repeat the table fitted this point to, so the working and the cell agree.
            repeat: repeatByPoint().byPoint[row.point] ?? null,
            strategy: choice.strategy,
            parity: choice.parity,
            rowParity: choice.rowParity,
            piece: cell.piece
        });
    }

    const isNum = (v) => typeof v === 'number' && Number.isFinite(v);


    function buildGradeTable(garment, sizeLabels, base = null, sources = {}) {
        const wrap = elem('div');
        // The size the pattern is written in, however it was settled - typed as "M", or read off the
        // pattern's widest row. Marked so the column the run is generated from can be told from the
        // rest. Not when it is only the first size by default: with no pattern to read, no column is
        // the base in any sense worth drawing attention to.
        const baseName = base && base.source !== 'first' ? base.label : '';

        const head = `<thead><tr><th>Measurement</th>${sizeLabels
            .map(l => `<th${l === baseName ? ' class="grade-base-col"' : ''}>${escapeHtml(l)}</th>`)
            .join('')}</tr></thead>`;

        const rows = garment.map(row => {
            const cells = row.sizes.map(cell => {
                const count = cell.stitches !== null ? `${cell.stitches} sts`
                          : cell.rows !== null ? `${cell.rows} rows` : '&mdash;';
                // cell.target/across are always inches, whatever unit the gauge inputs were typed in -
                // bothUnits() converts, it does not relabel.
                const target = cell.target === null ? '&mdash;' : bothUnits(cell.target);
                const across = cell.across !== null && cell.across !== cell.target
                    ? `<span class="grade-across">(${bothUnits(cell.across)} per piece)</span>` : '';
                // What the rounded count really measures, when that is not the target - the "rounding
                // effects" column of a grading spreadsheet. A width's difference is per piece, which is
                // where the rounding happened; a length's is the whole length.
                const actual = isNum(cell.actualTarget) && cell.actualTarget !== cell.target
                    ? `<span class="grade-actual">→ ${bothUnits(cell.actualTarget)} `
                      + `(${signedBoth(cell.differenceInches)}${row.axis === 'width' ? ' per piece' : ''})</span>`
                    : '';
                return `<td><span class="grade-target">${target}</span>${across}${actual}<span class="grade-count">${count}</span></td>`;
            }).join('');
            // A locked or manual measurement looks exactly like a graded one in the table, so the row
            // says which it is rather than leaving them to be told apart by whether the numbers happen
            // to repeat.
            const mode = row.mode && row.mode !== 'graded'
                ? `<em class="grade-axis">${escapeHtml(row.mode)}</em>` : '';
            return `<tr><th scope="row">${escapeHtml(row.label)}`
                 + `<em class="grade-axis">${row.axis === 'width' ? 'width' : 'length'}</em>${mode}</th>${cells}</tr>`;
        }).join('');

        wrap.innerHTML = `<div class="table-responsive"><table class="matrix-table grade-table">${head}<tbody>${rows}</tbody></table></div>`
            + roundingNoteHtml(garment, sources);
        return wrap;
    }

    /** Which piece's repeat each fitted measurement landed on: "Chest / Bust rounded to BACK's 6 + 1;
     *  Upper Arm to whole stitches (SLEEVE)". Nothing when nothing was fitted. */
    function roundingNoteHtml(garment, sources) {
        const A = window.CrochetAnalyticsEngine;
        const parts = garment
            .filter(row => sources && sources[row.point])
            .map(row => {
                const fitted = row.sizes.find(cell => cell.repeat !== undefined);
                const repeat = fitted && fitted.repeat ? fitted.repeat.label : '';
                const label = A.MEASUREMENT_LABELS[row.point] || row.point;
                return repeat
                    ? `${escapeHtml(label)} rounded to ${escapeHtml(sources[row.point])}'s ${escapeHtml(repeat)}`
                    : `${escapeHtml(label)} to whole stitches (${escapeHtml(sources[row.point])})`;
            });
        return parts.length ? `<p class="helper-text">${parts.join('; ')}.</p>` : '';
    }

    const round1 = window.CrochetAnalyticsEngine.round1;

    function renderComplexity(complexity) {
        const target = UI['complexity-content'];
        if (!target) return;

        if (UI['stat-special']) {
            UI['stat-special'].textContent = (complexity?.counts?.special || 0).toLocaleString();
        }

        if (!complexity || !complexity.total) {
            target.innerHTML = `<p class="placeholder-text">Add a row to analyze complexity.</p>`;
            return;
        }

        // Ordered by share so the dominant character of the pattern reads first.
        const ordered = BARRED_CATEGORIES
            .map(key => ({ key, pct: complexity.percentages[key], count: complexity.counts[key] }))
            .sort((a, b) => b.pct - a.pct);

        target.innerHTML = ordered.map(({ key, pct, count }) => `
            <div class="complexity-row">
                <span class="complexity-label">${COMPLEXITY_LABELS[key]}</span>
                <span class="complexity-track"><span class="complexity-bar bar-${key}" style="width: ${pct}%;"></span></span>
                <span class="complexity-value">${pct}%</span>
                <span class="complexity-count">${count.toLocaleString()} sts</span>
            </div>`).join('')
            + `<p class="complexity-total">${complexity.total.toLocaleString()} stitches classified</p>`;
    }

    /**
     * Projects saved before the switch to the CYC scale hold the old three-level names. Assigning one to
     * the select would silently blank it - there is no matching option - and the blank would still count
     * as a manual choice, leaving the field empty AND blocking the calculator from filling it. Mapped
     * instead: Advanced and Beginner move to the ends of the new scale, Intermediate is unchanged.
     */
    const LEGACY_DIFFICULTY = { Beginner: 'Basic', Advanced: 'Complex' };

    function migrateDifficultyLevel(saved) {
        if (!saved) return '';
        return LEGACY_DIFFICULTY[saved] || saved;
    }

    /** Mirrors the calculated difficulty badge into the Pattern Info dropdown. Stops as soon as the
     *  user picks a level themselves; re-selecting the blank placeholder hands control back. */
    function applyAutoDifficulty(report) {
        const select = UI["meta-difficulty"];
        if (!select || state.difficultyManuallySet) return;
        if (!report.totalStitches) return;

        const level = report.difficulty.level;
        if (select.value === level) return;

        select.value = level;
        state.metadata.difficulty = select.value;
        renderPrintArea();
    }

    // === 8c. CONSTRUCTION: ENGINES WITH NO WAY IN === //
    /*
     * Six engine APIs in analytics.js were finished, documented and covered by the test
     * suites, while no line of app.js or index.html called any of them. They were not dead
     * weight - a tested planner that nothing invokes is a missing door, not a missing
     * feature - so this section became the door rather than a deletion.
     *
     * CheckGarmentConstruction, PieceSpan and ShapedTail have since moved out: the Grader's
     * "Construction check" (renderConstructionCheck, section 8) reads the same three, held to
     * whatever the Generator's Construction dropdown says the pattern is, so that check no
     * longer needed a door of its own. The planners have a second door too: the Grader's
     * "Construction per size" (renderConstructionPerSize) runs them for every size from the graded
     * cells, through PlanConstructionAtSize, and the override grid prints each measurement's reach
     * from the same graph the impact panel walks. This tab remains the by-hand door - one size,
     * counts typed, for a design with no chart - and the place the graph is explored on its own.
     *
     * Three rules hold for everything on this tab, and they are the same three the rest
     * of the app keeps:
     *
     *   - Every figure comes back from the engine. Nothing here re-derives a plan, and
     *     no warning is reworded: the ordinals, the plurals and the reasons are the
     *     engine's, so a sentence shown here cannot drift from the one it tests.
     *   - No count is filled in on the designer's behalf. The planners take typed counts
     *     because a yoke's neck count is not written anywhere a parser could read it.
     *     Row gauge IS known, so it comes from the swatch and is labelled as such.
     *   - The panels are hosts in index.html and everything inside them is built here,
     *     which keeps the run-time inputs out of the static field list New File clears -
     *     they are cleared by prefix instead, below.
     */

    /**
     * The three construction planners, and the fields each needs to answer. The "why" is not written out
     * here: it comes from the CONSTRUCTIONS entry naming this planner, the same table the generator's
     * construction dropdown reads. Stating the reason twice is how the two would come to disagree about
     * what a raglan is.
     */
    const CONSTRUCTION_PLANNERS = {
        raglan: {
            call: 'PlanRaglanYoke',
            blurb: 'Four seams, eight stitches a round. The number of increase rounds is not free once the neck and the separation count are known.',
            fields: [
                { key: 'neckCount', label: 'Neck', axis: 'sts', note: 'What the yoke casts on at' },
                { key: 'frontBackCount', label: 'Front and back', axis: 'sts', note: 'Both body panels at the separation' },
                { key: 'sleeveCount', label: 'One sleeve', axis: 'sts', note: 'At the separation; counted twice' },
                { key: 'yokeRows', label: 'Yoke depth', axis: 'rows', note: 'Neck to separation' }
            ]
        },
        setIn: {
            call: 'PlanSetInSleeve',
            blurb: 'Two obligations, not one. The armhole is an ordinary paired decrease; the cap has to match the armhole around its edge, which a cap of the right width can still fail.',
            fields: [
                { key: 'bodyCount', label: 'Body', axis: 'sts', note: 'Full width below the armhole' },
                { key: 'shoulderCount', label: 'Shoulder', axis: 'sts', note: 'What is left at the top' },
                { key: 'underarmCount', label: 'Underarm bind-off', axis: 'sts', note: 'Each side, at once' },
                { key: 'armholeRows', label: 'Armhole', axis: 'rows', note: 'Underarm to shoulder' },
                { key: 'sleeveCount', label: 'Sleeve at the bicep', axis: 'sts', note: 'Where the cap begins' },
                { key: 'capRows', label: 'Cap', axis: 'rows', note: 'Bicep to the top of the cap' },
                { key: 'capTopCount', label: 'Cap top', axis: 'sts', note: 'What is bound off at the top' }
            ]
        },
        circular: {
            call: 'PlanCircularYoke',
            blurb: 'Increases spread around the round, not onto four lines, and grown by an equal ratio each pass rather than an equal number - which is what keeps the fabric flat.',
            fields: [
                { key: 'neckCount', label: 'Neck', axis: 'sts', note: 'What the yoke casts on at' },
                { key: 'separationCount', label: 'Separation', axis: 'sts', note: 'Body and sleeves together' },
                { key: 'yokeRows', label: 'Yoke depth', axis: 'rows', note: 'Neck to separation' },
                { key: 'increaseRounds', label: 'Increase rounds', axis: 'passes', note: 'How many passes to spread it over' }
            ]
        }
    };

    /** What the designer has typed, per planner. Held here rather than read off the boxes because
     *  switching construction rebuilds them: without this, flipping to the set-in sleeve and back would
     *  empty the raglan. */
    const constructionValues = { raglan: {}, setIn: {}, circular: {} };
    let constructionConstruction = 'raglan';
    let constructionPoint = '';

    /** Emptied by New File alongside the grader's own run-time controls. */
    function clearConstructionControls() {
        Object.keys(constructionValues).forEach(key => { constructionValues[key] = {}; });
        constructionConstruction = 'raglan';
        constructionPoint = '';
        Object.keys(UI).forEach(id => {
            if (id.startsWith('construction-f-') && UI[id] && typeof UI[id].value === 'string') {
                UI[id].value = '';
            }
        });
        // The field host skips a rebuild while its construction is unchanged, so the memo goes with the
        // values - otherwise the boxes for the construction on screen are never rebuilt and keep
        // whatever they were holding.
        if (UI['construction-yoke-fields'] && UI['construction-yoke-fields'].dataset) {
            UI['construction-yoke-fields'].dataset.signature = '';
        }
    }

    function renderConstruction() {
        if (!window.CrochetAnalyticsEngine || !UI['construction-index']) return;
        renderConstructionIndex();
        renderConstructionPlanner();
        renderConstructionImpact();
    }

    /** What is on this tab and where each entry lives, read off the engine rather than listed by hand:
     *  an entry whose export has gone says so instead of quietly becoming a heading with nothing under
     *  it. */
    const CONSTRUCTION_INDEX = [
        { calls: ['PlanRaglanYoke', 'PlanSetInSleeve', 'PlanCircularYoke'],
          title: 'Three construction planners',
          what: 'The shaping a raglan, a set-in sleeve or a circular yoke actually needs. The construction dropdown already used the shape of the seam; the planners behind it were never asked.',
          panel: 'construction-yoke-panel', go: 'Open the planners' },
        { calls: ['ImpactOfChange', 'DependentsOf'],
          title: 'What changing a measurement reaches',
          what: 'The dependency graph walked all the way down, and the pieces of your pattern it lands in. The grader reads the same graph one hop deep, to say what a measurement is worked out from.',
          panel: 'construction-impact-panel', go: 'Open the graph' }
    ];

    function renderConstructionIndex() {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['construction-index'];
        host.replaceChildren();

        CONSTRUCTION_INDEX.forEach(entry => {
            const row = elem('div', 'construction-entry');

            row.appendChild(elem('strong', null, entry.title));

            row.appendChild(elem('p', 'construction-entry-what', entry.what));

            const calls = elem('p', 'construction-calls');
            entry.calls.forEach(name => {
                const tag = elem('code');
                // Present or missing is checked, not assumed. This tab is the only caller of these, so
                // nothing else would notice one going.
                tag.className = A[name] ? 'construction-call' : 'construction-call construction-call-gone';
                tag.textContent = A[name] ? name : `${name} (not in this build)`;
                calls.appendChild(tag);
            });
            row.appendChild(calls);

            const go = button('construction-go', entry.go, `construction-go-${entry.panel}`,
                () => focusPanel(entry.panel));
            row.appendChild(go);

            host.appendChild(row);
        });
    }

    // ---- The three planners ---------------------------------------------------

    /** The construction the planner is showing, as the shared CONSTRUCTIONS table has it. */
    function constructionConstructionEntry(planner) {
        const A = window.CrochetAnalyticsEngine;
        const key = Object.keys(A.CONSTRUCTIONS).find(k => A.CONSTRUCTIONS[k].yoke === planner);
        return key ? A.CONSTRUCTIONS[key] : null;
    }

    function renderConstructionPlanner() {
        const spec = CONSTRUCTION_PLANNERS[constructionConstruction];
        if (!spec) return;

        Object.keys(CONSTRUCTION_PLANNERS).forEach(key => {
            const tab = UI[`construction-con-${key}`];
            if (!tab) return;
            tab.classList.toggle('is-on', key === constructionConstruction);
        });

        const entry = constructionConstructionEntry(constructionConstruction);
        // The engine's own reason a construction cannot be graded by a width ratio, which is exactly why
        // it needs a planner of its own.
        setText('construction-con-why', entry && entry.reason
            ? `${entry.label}: ${entry.reason}. ${spec.blurb}`
            : spec.blurb);

        renderConstructionFields(spec);
        renderConstructionPlan(spec);
    }

    function renderConstructionFields(spec) {
        const host = UI['construction-yoke-fields'];
        if (!host) return;
        // Rebuilt only when the construction changes, so typing in a box does not replace the box being
        // typed in and take the caret with it.
        if (host.dataset.signature === constructionConstruction) return;
        host.dataset.signature = constructionConstruction;
        host.replaceChildren();

        spec.fields.forEach(field => {
            const row = elem('label', 'construction-field');

            const name = elem('span', 'construction-field-name', field.label);
            name.appendChild(elem('em', 'construction-field-note', field.note));
            row.appendChild(name);

            row.appendChild(elem('em', 'grade-axis', field.axis));

            const input = elem('input');
            input.type = 'number';
            input.step = '1';
            input.min = '0';
            input.id = `construction-f-${constructionConstruction}-${field.key}`;
            const held = constructionValues[constructionConstruction][field.key];
            if (Number.isFinite(held)) input.value = String(held);
            register(input, readConstructionFields);
            row.appendChild(input);

            host.appendChild(row);
        });
    }

    function readConstructionFields() {
        const spec = CONSTRUCTION_PLANNERS[constructionConstruction];
        if (!spec) return;
        const held = {};
        spec.fields.forEach(field => {
            const value = parseFloat(UI[`construction-f-${constructionConstruction}-${field.key}`]?.value);
            if (Number.isFinite(value)) held[field.key] = value;
        });
        constructionValues[constructionConstruction] = held;
        // Only the answer is redrawn. The boxes are what is being typed into.
        renderConstructionPlan(spec);
    }

    /** The row gauge the depth in inches is worked out at. The one number on this panel the app already
     *  knows, so it is taken rather than asked for - and named, so a depth that looks wrong can be
     *  traced to the swatch that produced it. */
    function effectiveRowGauge() {
        const A = window.CrochetAnalyticsEngine;
        const gauge = A.EffectiveGauge(graderGauge(), {});
        return Number.isFinite(gauge.rowsPerInch) && gauge.rowsPerInch > 0 ? gauge.rowsPerInch : null;
    }

    function renderConstructionPlan(spec) {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['construction-yoke-result'];
        if (!host) return;

        const rowsPerInch = effectiveRowGauge();
        setText('construction-yoke-gauge', rowsPerInch
            ? `Row gauge ${A.round2(rowsPerInch)} rows per inch, from your swatch.`
            : 'No row gauge yet, so depths are shown in rows only. Measure a swatch on the Gauge Profile tab.');

        host.replaceChildren();
        const held = constructionValues[constructionConstruction];

        // A planner says for itself when it has been given too little, and its wording beats any generic
        // one - but only once something has been typed. An empty panel scolding the designer for the
        // panel being empty is noise.
        if (!Object.keys(held).length) {
            host.appendChild(elem('p', 'placeholder-text', 'Fill in the counts above to plan the shaping.'));
            return;
        }

        const plan = A[spec.call]({ ...held, rowsPerInch });
        if (constructionConstruction === 'raglan') fillRaglanPlan(host, plan);
        else if (constructionConstruction === 'setIn') fillSetInPlan(host, plan);
        else fillCircularPlan(host, plan);

        if (plan.warning) {
            host.appendChild(elem('p', 'grade-warning', plan.warning));
        }
    }

    /** A labelled figure, the shape the grader's summary lines already use. */
    /* Was constructionLine, until the tab rename collided it with the grader's own constructionLine
       - two declarations in one scope, the second silently winning, and the grader summary quietly
       calling the wrong one. Named for what it builds rather than for the tab it sits on. */
    function planRow(label, value) {
        const row = elem('div', 'grade-line');
        const name = elem('span', null, label);
        const figure = elem('strong', null, String(value));
        row.append(name, figure);
        return row;
    }

    /** Everything DistributeShaping worked out, said the way the engine says it. */
    function constructionShaping(host, title, shaping) {
        host.appendChild(elem('strong', 'construction-sub', title));

        if (!shaping || (!shaping.text && !shaping.warning)) {
            host.appendChild(elem('p', 'placeholder-text', 'Not enough counts for this part yet.'));
            return;
        }
        if (shaping.text) {
            host.appendChild(elem('p', 'construction-shaping', shaping.text));
        }
        if (shaping.balancedText) {
            const balanced = elem('p', 'grade-derived');
            balanced.textContent = shaping.leftoverRows
                ? `${plainPlural(shaping.leftoverRows, 'row')} straight, or ${shaping.balancedText}`
                : shaping.balancedText;
            host.appendChild(balanced);
        }
        if (shaping.warning && !shaping.feasible) {
            host.appendChild(elem('p', 'grade-warning', shaping.warning));
        }
    }

    const plainPlural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

    function fillRaglanPlan(host, plan) {
        if (Number.isFinite(plan.separationCount)) {
            host.appendChild(planRow('Stitches at the separation', plan.separationCount));
        }
        if (Number.isFinite(plan.increaseRounds)) {
            host.appendChild(planRow('Increase rounds', plan.increaseRounds));
        }
        if (Number.isFinite(plan.depthInches)) {
            host.appendChild(planRow('Yoke depth', `${plan.depthInches} in`));
        }
        constructionShaping(host, 'Down the four seams', plan.shaping);
    }

    function fillSetInPlan(host, plan) {
        if (Number.isFinite(plan.armholeEdgeInches)) {
            host.appendChild(planRow('Armhole edge', `${plan.armholeEdgeInches} in`));
        }
        if (Number.isFinite(plan.capEdgeInches)) {
            host.appendChild(planRow('Cap edge', `${plan.capEdgeInches} in`));
        }
        constructionShaping(host, 'Up the armhole', plan.armhole);
        constructionShaping(host, 'Up the cap', plan.cap);
    }

    function fillCircularPlan(host, plan) {
        if (Number.isFinite(plan.depthInches)) {
            host.appendChild(planRow('Yoke depth', `${plan.depthInches} in`));
        }
        if (!plan.rounds.length) return;

        const { wrap, body } = responsiveTable(
            ['Round', 'From', 'To', 'Increases', 'Spaced'], 'construction-round-table');
        plan.rounds.forEach(round => {
            const tr = elem('tr');
            tr.appendChild(rowHeader(`Round ${round.round}`));
            [round.from, round.to, round.increases].forEach(value => {
                tr.appendChild(plainCell(value));
            });
            const spaced = elem('td', 'construction-spaced');
            // SpaceEvenly's own sentence. "Every 4th stitch, 12 times" is its phrasing, including the
            // case where the division does not come out whole.
            spaced.textContent = round.spacing
                ? (round.spacing.text || round.spacing.warning || '')
                : 'no increase';
            tr.appendChild(spaced);
            body.appendChild(tr);
        });
        host.appendChild(wrap);
    }

    // ---- What a measurement reaches -------------------------------------------

    function renderConstructionImpact() {
        const A = window.CrochetAnalyticsEngine;
        const picks = UI['construction-point-picks'];
        if (!picks) return;

        const points = Object.keys(A.MEASUREMENT_DEPENDS_ON);
        if (picks.dataset.signature !== points.join(',')) {
            picks.dataset.signature = points.join(',');
            picks.replaceChildren();
            points.forEach(point => {
                const pick = button('construction-pick', A.MEASUREMENT_LABELS[point] || point,
                    `construction-pt-${sectionKey(point)}`);
                pick.addEventListener('click', () => {
                    // Tapping the chosen one again clears it.
                    constructionPoint = constructionPoint === point ? '' : point;
                    renderConstructionImpact();
                });
                picks.appendChild(pick);
            });
        }
        points.forEach(point => {
            const pick = UI[`construction-pt-${sectionKey(point)}`];
            if (!pick) return;
            pick.classList.toggle('is-on', point === constructionPoint);
        });

        renderConstructionImpactResult();
    }

    function renderConstructionImpactResult() {
        const A = window.CrochetAnalyticsEngine;
        const host = UI['construction-impact-result'];
        if (!host) return;
        host.replaceChildren();

        if (!constructionPoint) {
            host.appendChild(elem('p', 'placeholder-text', 'Pick a measurement above.'));
            return;
        }

        // Sections come from the pattern that is open, typed by the designer on the Sizer tab. An
        // untyped section carries no measurements, so it is correctly absent rather than guessed at.
        const sections = sectionProfiles();
        const impact = A.ImpactOfChange({ point: constructionPoint, sections });

        const detail = elem('p', 'construction-detail');
        // The engine's sentence, including the case where nothing is downstream.
        detail.textContent = impact.detail;
        host.appendChild(detail);

        const label = (point) => A.MEASUREMENT_LABELS[point] || point;

        host.appendChild(planRow('Worked out from',
            impact.dependsOn.length ? impact.dependsOn.map(label).join(' + ') : 'nothing - it is a root measurement'));
        host.appendChild(planRow('Measurements downstream', impact.dependents.length));

        if (impact.dependents.length) {
            const list = elem('ol', 'construction-chain');
            impact.dependents.forEach(point => {
                list.appendChild(elem('li', null, label(point)));
            });
            host.appendChild(list);
        }

        host.appendChild(elem('strong', 'construction-sub', 'Pieces of your pattern this lands in'));

        if (!sections.length) {
            host.appendChild(elem('p', 'placeholder-text', 'No pattern is open, so there are no pieces to reach.'));
            return;
        }
        if (!impact.sections.length) {
            host.appendChild(elem('p', 'placeholder-text', 'None of your sections carries this measurement. A section takes its measurements from the type it is given, on the Size Grader tab.'));
            return;
        }

        const { wrap, body } = responsiveTable(['Section', 'Measurements it carries'], 'construction-reach-table');
        impact.sections.forEach(section => {
            const tr = elem('tr');
            tr.appendChild(rowHeader(section.title));
            tr.appendChild(plainCell(section.points.map(label).join(', ')));
            body.appendChild(tr);
        });
        host.appendChild(wrap);
    }

    /*
     * CHART_CM_DISCREPANCIES had a renderer here and no longer does. It stays exported from analytics.js
     * and back-end only: it records the published standard's own inch/centimetre slips, and its job is
     * to let tests/test-grader.js assert "these and only these", so a transcription error in the chart
     * data fails while a known source quirk does not. That makes it a tripwire on our own transcription,
     * not a finding about anyone's pattern - and Stitch Math grades from the inch column throughout, so
     * none of it can reach a garment either way.
     */

    // === 12. APP SHELL: NAVIGATION, DASHBOARD & PROGRESS === //
    /*
     * The shell is presentation only. It never parses, validates, grades or exports - it decides which
     * of the app's existing panels are on screen, and renders a read-only summary of state the rest of
     * the file has already computed. Two rules hold it together:
     *   - Panels are hidden, never moved or removed. Every id the app talks to is in the document at all
     *     times, so a render into a panel nobody is looking at works exactly as it always did.
     *   - Nothing on the dashboard is a form control. Every figure traces to a source listed in
     *     DASHBOARD SOURCES below; there is no placeholder data anywhere.
     */

    // Which panels belong to which view. A panel appears exactly once.
    const VIEW_PANELS = {
        dashboard: [],
        patterns:  ['project-panel', 'metadata-panel', 'color-panel', 'notions-panel'],
        // The stitch reference on a page of its own: the designer's own definitions first, then what
        // this pattern works, then the cabinet of what has been worked so far. It used to sit under
        // the colours on Patterns, which made looking a stitch up mean scrolling past the file's
        // metadata to reach it.
        library:   ['custom-stitch-section', 'stitch-usage-panel', 'cabinet-panel'],
        // Writing a pattern and compiling it are the same desk, so they are one view. Pattern Structure
        // sits under the paste box: how to read what was just written, before the matrix that reads it.
        studio:    ['intro-header', 'input-section', 'structure-section', 'matrix-section'],
        sizer:     ['grader-section', 'finished-size-panel'],
        analytics: ['pattern-analytics-dashboard', 'output-section', 'complexity-panel', 'lessons-panel'],
        gauge:     ['gauge-profile-panel', 'gauge-history-dashboard'],
        settings:  ['help-panel', 'settings-panel', 'about-panel'],
        // The daily habit, and the one view a person who is not writing a pattern has a reason to
        // open. Hidden entirely when practice mode is off - see applyPracticeMode.
        practice:  ['practice-panel'],
        // Engine capability with no other way in. Section 8c.
        construction:   ['construction-panel', 'construction-yoke-panel', 'construction-impact-panel'],
        // Project Management appears on Patterns as well: the same panel shown in two places, not a copy
        // - saving a file is both a pattern job and an export one. Publish only needs Load Project, so
        // showView hides the rest of its controls through CSS rather than duplicating the element.
        publish:   ['publish-panel', 'project-panel']
    };

    // Which grid column each panel sits in, so a view drawing on one column alone can take the full
    // width instead of leaving the other half empty. 'intro-header' is outside the grid and in neither
    // list. Keep in step with the markup: a panel listed here must actually sit inside .left-column, and
    // section 3 of test-shell.js checks this against index.html - getting it wrong leaves an empty
    // column beside the content.
    const LEFT_PANELS = [
        'output-section', 'pattern-analytics-dashboard', 'complexity-panel', 'lessons-panel',
        'gauge-profile-panel', 'finished-size-panel', 'gauge-history-dashboard'
    ];

    const ALL_PANELS = Object.keys(VIEW_PANELS)
        .reduce((all, view) => all.concat(VIEW_PANELS[view]), []);

    /*
     * Where each sidebar entry goes. Every entry owns a view; `focus` is for a caller that wants to land
     * on one panel of a view rather than at its top.
     */
    const NAV_TARGETS = {
        'nav-dashboard':  { view: 'dashboard', title: 'Dashboard', sub: 'Your creative command center' },
        'nav-patterns':   { view: 'patterns',  title: 'Patterns',  sub: 'Saved files and pattern metadata' },
        'nav-library':    { view: 'library',   title: 'Stitch Library', sub: 'Common & custom stitches' },
        'nav-studio':     { view: 'studio',    title: 'Studio',    sub: 'Write, compile and check your pattern' },
        'nav-sizer':      { view: 'sizer',     title: 'Size Grader', sub: 'Grade one size into multiple sizes' },
        'nav-analytics':  { view: 'analytics', title: 'Analytics', sub: 'Pattern health and complexity' },
        'nav-practice':   { view: 'practice',  title: 'Daily Practice', sub: 'Three things to do today, and none of them need a pattern' },
        'nav-gauge':      { view: 'gauge',     title: 'Gauge Profile', sub: 'Swatches, density and yardage' },
        'nav-publish':    { view: 'publish',   title: 'Export', sub: 'Save your work, or take it out of Stitch Math' },
        'nav-construction':    { view: 'construction',   title: 'Construction', sub: 'Plan a yoke, and see what a measurement change disturbs' },
        'nav-settings':   { view: 'settings',  title: 'Settings',  sub: 'Every option, and how to use the app' }
    };

    const NAV_IDS = Object.keys(NAV_TARGETS);

    /*
     * Which hub owns each destination. Eleven entries in a flat rail said nothing about which of
     * them belonged together, or which you needed next - so the rail is now the workflow: the
     * Dashboard, then the three steps a pattern is written through in the order they happen, then
     * Settings. Grouped and ordered is all they are. Every id below is still its own view with its
     * own route; nothing was merged and nothing was hidden.
     *
     * Settings is in no hub. It is not a step in writing a pattern, and a rail that filed it under
     * one would be claiming it was. HUB_OF has no entry for it, and expandHub(undefined) closes
     * every hub, which is exactly what landing on Settings should look like.
     *
     * This table is the ONLY place the grouping is written down. HUB_OF is derived from it rather
     * than kept beside it, and test-shell.js section 1b reads the table back and fails if a
     * destination other than Settings has no hub - which is exactly how a twelfth view would
     * otherwise end up reachable by URL and invisible in the rail. The three numbered hubs are the
     * three STAGES below, in the same order: hub-setup is step 1 because STAGES[0] says so.
     */
    const NAV_HUBS = {
        'hub-dashboard': ['nav-dashboard', 'nav-analytics', 'nav-practice'],
        'hub-setup':     ['nav-patterns', 'nav-library', 'nav-gauge'],
        'hub-write':     ['nav-studio', 'nav-construction', 'nav-sizer'],
        'hub-export':    ['nav-publish']
    };
    const HUB_IDS = Object.keys(NAV_HUBS);
    const HUB_OF = HUB_IDS.reduce((map, hub) => {
        NAV_HUBS[hub].forEach(navId => { map[navId] = hub; });
        return map;
    }, {});

    /*
     * The pattern-writing workflow.
     *
     * Writing one pattern crosses three views - fill in the metadata, draft and compile it, export
     * it. The sidebar walks those three in order as
     * its numbered hubs; the strip in the topbar repeats them as a compact progress rail on the
     * views they describe. Both are drawn from THIS table, so a step has one number and one word
     * everywhere it appears: `hub` names the sidebar hub the step is, `nav` the destination the
     * step lands on, and the position in the array is its number.
     *
     * Two rules, both load-bearing:
     *
     *   - `done` is READ, never recorded. Each predicate below asks the live state a question it
     *     already knows the answer to; there is no separate progress flag to be written, migrated,
     *     or to drift out of step with the pattern. Delete a pattern's rows and Write un-marks
     *     itself, because the mark was never a fact of its own.
     *
     *   - Nothing is GATED. Every stage is clickable whenever the rail is on screen, the same way
     *     every sidebar entry always was. A done mark reports; it does not unlock. Real work does
     *     not go in this order - people export a draft to read it on paper,
     *     and come back to the metadata last - and a rail that enforced the sequence would be
     *     wrong more often than it was right.
     *
     * A done stage KEEPS ITS NUMBER. It used to swap it for a tick, so step 4 read as "4" in the
     * sidebar and as a checkmark in the rail - the same step with two labels. Colour carries
     * "done" now, in both places, and the number is the number wherever you look.
     */
    const STAGES = [
        {
            hub: 'hub-setup', nav: 'nav-patterns', label: 'Setup',
            // The file has been identified as somebody's, by name or by any of the metadata.
            done: () => !!(UI['project-name']?.value || '').trim()
                || !!(state.metadata.designer || state.metadata.hook || state.metadata.yarnWeight)
        },
        { hub: 'hub-write',  nav: 'nav-studio',  label: 'Write',  done: () => state.patternSteps.length > 0 },
        // Ready to export is not the same as exported: a pattern that compiles with no failed or
        // blocked rows is one you can hand over. isCleanPass is the same test the stitch roll and
        // the daily quest pay out on, so the rail cannot disagree with them about what "clean" is.
        { hub: 'hub-export', nav: 'nav-publish', label: 'Publish', done: () => isCleanPass(state.analytics.lastPass) }
    ];
    const STAGE_NAV = STAGES.map(stage => stage.nav);

    // ---- Hash routing -------------------------------------------------------
    /*
     * Twelve views and, until now, one address. A reload dropped you on the Dashboard mid-task, the
     * back button did nothing, and there was no way to send anyone a link to the Grader.
     *
     * The slug is derived from the nav id rather than written out beside it, so a view cannot be added
     *
     * Two deliberate choices about history. A push is done by assigning location.hash rather than by
     * pushState, because pushState with a relative URL throws on file:// in some browsers and the app
     * is opened that way today - assigning the hash works everywhere and produces the same entry. And
     * a navigation that is a SIDE EFFECT of something else - the export-package button switching you to
     * the Grader - replaces rather than pushes, or the history fills with entries nobody asked for and
     * pressing back four times feels random.
     */
    const slugFor = (navId) => String(navId).replace(/^nav-/, '');
    const NAV_SLUGS = {};
    NAV_IDS.forEach(id => { NAV_SLUGS[slugFor(id)] = id; });

    /* Set while we are writing the hash ourselves, so the hashchange our own write fires is ignored
       instead of being read back as a navigation the user asked for. */
    let writingHash = false;

    /** The nav id the current URL names, or null. An unknown slug is null rather than a guess: old
     *  links outlive view renames, and landing on the Dashboard beats landing on a blank workspace. */
    function navFromHash() {
        const loc = typeof window !== 'undefined' && window.location;
        if (!loc) return null;
        return NAV_SLUGS[String(loc.hash || '').replace(/^#\/?/, '')] || null;
    }

    function syncHash(navId, replace) {
        const loc = typeof window !== 'undefined' && window.location;
        if (!loc) return;
        const want = '#' + slugFor(navId);
        if (String(loc.hash || '') === want) return;
        try {
            if (replace && window.history && typeof window.history.replaceState === 'function') {
                // replaceState fires no hashchange, so nothing has to be swallowed.
                window.history.replaceState(null, '', want);
            } else {
                writingHash = true;
                loc.hash = want;
            }
        } catch (err) {
            // A browser that refuses to rewrite the URL is not a reason to fail the navigation; the
            // view has already changed by the time this runs.
            writingHash = false;
        }
    }

    function handleHashChange() {
        if (writingHash) { writingHash = false; return; }
        navigateTo(navFromHash() || 'nav-dashboard', { fromHash: true });
    }

    /** The shell and the dashboard address elements by id at call time rather than holding a reference,
     *  because several are drawn into a panel that is rebuilt as the view changes. Everything else goes
     *  straight to the cached `UI`; this is the one fallback, written once. */
    function shellEl(id) {
        return UI[id] || document.getElementById(id);
    }

    function setHidden(id, hidden) {
        const el = shellEl(id);
        if (!el) return;
        if (hidden) el.classList.add('hidden'); else el.classList.remove('hidden');
    }

    /** Switches which panels are on screen. Never touches panel contents. */
    /* The view showView last resolved to. Held so closeDock can restore panel visibility by asking
       showView again rather than by remembering what it changed - there is one authority on which
       panels are on screen, and a dock must not become a second. */
    let currentViewName = 'dashboard';

    /* The nav id navigateTo last landed on, as opposed to the view it resolved to - Stitch Library and
       Patterns share a view and are different places. Null until the first navigation, which is
       what lets applyPracticeMode run during init without trying to route anywhere. */
    let currentNavId = null;

    function showView(view) {
        const panels = VIEW_PANELS[view] ? view : 'dashboard';
        const shown = VIEW_PANELS[panels];
        currentViewName = panels;

        ALL_PANELS.forEach(id => setHidden(id, shown.indexOf(id) < 0));
        setHidden('dashboard-view', panels !== 'dashboard');
        setHidden('workspace', shown.length === 0);

        // Every view is a single column. Splitting a view in two only paid off when a page was long
        // enough to fill both sides, and now that the sidebar decides what is on screen no view is - so
        // the second column left a stray empty gutter. The Dashboard keeps its own card grid, which is
        // not this grid. An unused column is hidden outright rather than left empty: in place it would
        // contribute a grid gap, which reads as a margin down the side of the page.
        const inGrid = shown.filter(id => id !== 'intro-header');
        const usesLeft = inGrid.some(id => LEFT_PANELS.indexOf(id) >= 0);
        const usesRight = inGrid.some(id => LEFT_PANELS.indexOf(id) < 0);
        setHidden('left-column', !usesLeft);
        setHidden('right-column', !usesRight);
        const workspace = shellEl('workspace');
        if (workspace) workspace.dataset.cols = 'one';

        // The editor was hidden when its cues were last placed, so every offset they were measured
        // against read 0. Nothing is recomputed - the marks are only moved to where their lines are.
        if (panels === 'studio') positionLintMarks();
        if (panels === 'dashboard') renderDashboard();
        // Read fresh from the source controls every time the page is opened.
        if (panels === 'settings') renderSettingsMirrors();
        if (panels === 'publish') renderPdfPreview();
        // project-panel is the same element shown on Patterns, not a copy - Publish only needs Load
        // Project, so the rest of its controls are hidden through this class rather than duplicated.
        shellEl('project-panel')?.classList.toggle('publish-scope', panels === 'publish');
        // Reads the pattern's sections and the swatch's row gauge, both of which move while the tab is
        // closed, so it is rebuilt on arrival rather than once at boot.
        if (panels === 'construction') renderConstruction();
        // Both read the store rather than the pattern, and the store moves while the tab is closed.
        if (panels === 'practice') renderPractice();
        if (panels === 'patterns') renderCabinet();
        if (panels === 'analytics') renderLessons();
        return panels;
    }

    // ---- Settings mirrors ----------------------------------------------------
    /*
     * Every option in the app on one page. Each row is a MIRROR of a control living on some other panel:
     * it copies its value to the original and runs the original's own handler - the same named function
     * wired up in setupEventListeners. Nothing here reimplements an effect, so a mirror and its source
     * cannot drift apart. `apply` is that shared function; `group` only sorts the page into headings.
     */
    /* Two controls are deliberately NOT here. Difficulty is a fact about the pattern, inferred
       from its stitches and shown with the rest of the metadata on Patterns - not a way the app
       behaves. The converted-swatch unit is an override of the gauge unit that follows it unless
       somebody says otherwise, and a settings page that lists both is asking the same question twice;
       the override stays on the Gauge Profile for the rare swatch that needs it. */
    const SETTING_SPECS = [
        { id: 'meta-size', kind: 'select', group: 'Reading the pattern', label: 'Which size to check',
          note: 'Which of the graded sizes the counts are validated against.',
          hidden: () => !!UI['size-picker-group']?.classList.contains('hidden'), apply: applySizeChange },
        { id: 'meta-row-numbering', kind: 'select', group: 'Reading the pattern', label: 'Row numbering',
          note: 'Whether each new piece starts again at Row 1 or numbering runs straight through.', apply: renderUI },
        { id: 'meta-chain-space-convention', kind: 'select', group: 'Reading the pattern', label: 'Chain-sp counts as',
          note: "Whether a corner or chain space's own chains count toward the round's stitch total, or only the stitches worked into it do.",
          apply: () => { window.CrochetMathEngine.setChainSpaceConvention(UI['meta-chain-space-convention'].value); renderUI(); } },
        { id: 'meta-terminology', kind: 'select', group: 'Reading the pattern', label: 'Terminology',
          note: 'Flags US terms in a UK pattern and UK terms in a US one. Never rewrites a stitch, and never changes a count.',
          apply: () => applyMetadataChange('meta-terminology') },

        { id: 'toggle-trend-markers', kind: 'checkbox', group: 'Validation and linting', label: 'Show trend markers',
          note: 'Mark whether each row grew, shrank or held its stitch count.', apply: applyTrendMarkerPref },
        { id: 'toggle-collapse-repeats', kind: 'checkbox', group: 'Validation and linting', label: 'Collapse repeated rows',
          note: 'Fold runs of identical rows into a single line with a count.', apply: applyCollapseRepeatPref },
        { id: 'toggle-outline-view', kind: 'checkbox', group: 'Validation and linting', label: 'Geometric outline only',
          note: 'Strip the prose and show only the stitch count each row produces, and what it did to the row above.',
          apply: applyOutlineViewPref },

        { id: 'toggle-beginner-phrasing', kind: 'checkbox', group: 'Validation and linting', label: 'Beginner-friendly repeat phrasing',
          note: 'Spell every repeat out in full instead of bracket shorthand - switching back off folds them back to brackets.',
          apply: applyRepeatPhrasingMode },

        /* It describes what is SHOWN, not who the person is. Not "beginner mode" - nobody wants to
           tick a box that calls them a beginner, and a professional using the practice rows to check
           their own dialect should not have to identify as one either. */
        { id: 'toggle-practice-mode', kind: 'checkbox', group: 'Practice and progress',
          label: 'Show daily practice, streak and rank',
          note: 'Turn this off for a plain working tool. Nothing is lost - your record keeps counting, '
              + 'and it is all still here if you turn it back on.',
          apply: applyPracticeMode },

        { id: 'gauge-unit', kind: 'select', group: 'Gauge and measurements', label: 'Gauge unit',
          note: 'The unit your swatch width and height are measured in.', apply: refreshGaugeOutputs },
        { id: 'gauge-convert-size', kind: 'select', group: 'Gauge and measurements', label: 'Convert swatch to',
          note: 'Restate your gauge over a standard square, whatever size you measured.', apply: refreshGaugeOutputs },
        { id: 'sizing-category', kind: 'select', group: 'Gauge and measurements', label: 'Sized for',
          note: 'Which body measurement chart the finished size is compared against.', apply: refreshGaugeOutputs },
        { id: 'sizing-piece', kind: 'select', group: 'Gauge and measurements', label: 'Widest row measures',
          note: 'Whether the widest row is the full circumference or one panel of a pair.', apply: applySizingPieceOverride },

        { id: 'grade-rounding', kind: 'select', group: 'Grading', label: 'When a count does not fit',
          note: 'How a graded stitch count resolves when the target falls between two valid counts.', apply: renderGrader },
        { id: 'grade-parity', kind: 'select', group: 'Grading', label: 'Number of repeats',
          note: 'Whether a graded section must work a whole odd or even number of its repeat.', apply: renderGrader },
        { id: 'grade-row-parity', kind: 'select', group: 'Grading', label: 'Row counts',
          note: 'Whether graded lengths round to an even number of rows, so shaping starts on the right side.', apply: renderGrader },
        { id: 'gen-notation', kind: 'select', group: 'Grading', label: 'Generated notation',
          note: 'How multi-size instructions write their numbers: 82 (90, 98), brackets, or one size per line.', apply: renderGrader }
    ];

    /** Rebuilt each time Settings is opened rather than kept in sync continuously: the source controls
     *  are the truth, several have options generated at runtime, and reading them once on open cannot go
     *  stale while the page is being looked at. */
    /*
     * The shape of the page: which rows are on it, and how many choices each offers. Rebuilding is only
     * correct when this changes - doing it on every edit tore out the control the user was still
     * clicking, and collapsing the list's height mid-click made the browser snap back to the top.
     */
    let settingsShapeKey = '';

    function settingsShape() {
        return SETTING_SPECS
            .filter(spec => UI[spec.id] && !(spec.hidden && spec.hidden()))
            .map(spec => `${spec.id}:${UI[spec.id].options ? UI[spec.id].options.length : 0}`)
            .join('|');
    }

    /** Values only, in place. Nothing is added or removed, so focus, the caret and the scroll position
     *  all survive - which is the whole point of it. */
    function syncSettingsMirrors() {
        if (settingsShape() !== settingsShapeKey) { renderSettingsMirrors(); return; }
        SETTING_SPECS.forEach(spec => {
            const source = UI[spec.id];
            const mirror = UI[`set-${spec.id}`];
            if (!source || !mirror) return;
            if (spec.kind === 'checkbox') mirror.checked = !!source.checked;
            else mirror.value = source.value;
        });
    }

    function renderSettingsMirrors() {
        const host = UI['settings-list'];
        if (!host) return;
        settingsShapeKey = settingsShape();
        host.replaceChildren();

        let lastGroup = '';
        SETTING_SPECS.forEach(spec => {
            const source = UI[spec.id];
            if (!source || (spec.hidden && spec.hidden())) return;

            if (spec.group !== lastGroup) {
                lastGroup = spec.group;
                host.appendChild(elem('h3', 'settings-group', spec.group));
            }

            const row = elem('div', 'setting-row');

            const text = elem('div', 'setting-text');
            const label = elem('label', null, spec.label);
            const note = elem('p', 'setting-note', spec.note);
            text.append(label, note);

            const control = elem('div', 'setting-control');
            control.appendChild(buildMirror(spec, source));

            row.append(text, control);
            host.appendChild(row);
        });
    }

    /*
     * `spec.kind` is declared rather than read off the source element. The headless stub does not parse
     * markup, so a control built from index.html reports neither its tagName nor its type, and detecting
     * the kind at runtime would work in the browser and quietly build the wrong control under test.
     * Section 4d of test-shell.js checks each declared kind against the real markup.
     */
    function buildMirror(spec, source) {
        const isCheckbox = spec.kind === 'checkbox';
        const mirror = elem(spec.kind === 'select' ? 'select' : 'input');
        mirror.id = `set-${spec.id}`;
        UI[mirror.id] = mirror;

        if (spec.kind === 'select') {
            copyOptions(source, mirror);
            mirror.value = source.value;
        } else if (isCheckbox) {
            mirror.type = 'checkbox';
            mirror.checked = !!source.checked;
        } else {
            mirror.type = spec.kind;
            mirror.value = source.value;
        }

        mirror.addEventListener('change', () => {
            if (isCheckbox) source.checked = !!mirror.checked;
            else source.value = mirror.value;
            spec.apply();
            // The effect may have moved another setting - choosing "one size fits all" clears the size
            // picker - so the rest of the page is read back from the sources. In place, so the control
            // just clicked is not torn out from under the pointer and the page does not jump.
            syncSettingsMirrors();
        });
        return mirror;
    }

    /** Options are copied from the live control rather than restated here, so there is one list of
     *  choices in the app. Under the headless stub a markup-built select has no options to copy and the
     *  mirror is left empty - it still carries the value, which is what the tests check. */
    function copyOptions(source, mirror) {
        const options = source.options;
        if (!options || !options.length) return;
        fillSelect(mirror, Array.from(options, opt => [opt.value, opt.textContent]));
    }

    // ---- Stitches used in this pattern ---------------------------------------
    /**
     * What to print beside a stitch, and where that sentence came from.
     *
     * A term the designer defined is defined by THEM, so their wording wins outright - quoting the
     * Council at someone about their own abbreviation would be both wrong and rude. Failing that the
     * glossary answers, and when the pattern spelled the stitch out in full the name is already the
     * definition, so the abbreviation is the useful half to show instead.
     */
    function describeStitchForPanel(name, customEntry, glossary) {
        if (customEntry) {
            return customEntry.def
                ? { text: customEntry.def, source: 'Your definition, from the Custom Stitch Dictionary', cyc: false }
                : { text: 'your own stitch, no definition saved', source: 'Added without a definition', cyc: false };
        }

        const known = glossary[name];
        if (!known) return { text: 'not in the dictionary', source: 'No definition on file', cyc: false };

        const source = known.cyc
            ? 'Craft Yarn Council Crochet Abbreviations Master List'
            : 'Stitch Math description - the CYC master list does not name this stitch';
        // Spelled out in full already: the term would only repeat the name back.
        const text = known.term.toLowerCase() === name.toLowerCase()
            ? `abbreviated ${known.abbr}`
            : known.term;
        return { text, source, cyc: known.cyc };
    }

    /**
     * A glossary of the pattern's own stitches: every term it works, what that term means, and what
     * it costs - the stitches it uses from the row below and the stitches it makes for the row above.
     * How many times each is worked is NOT here; those figures live on the Dashboard, and a share or
     * a bar would turn a glossary into a report.
     *
     * The price is shown because the matrix's Calc Total can only be checked by hand when the reader
     * can see what each stitch is worth. It is read from the same dictionary the arithmetic runs on
     * (built-in primitives under the designer's own entries, the merge the engine itself uses), so
     * this panel cannot disagree with a row the engine has already counted.
     *
     * Which stitches appear still comes from AggregateStitchCounts - the same aggregation behind the
     * stitch total and the yardage estimate - so the panel cannot list a stitch the rest of the app does
     * not think the pattern works. Its counts are used for ordering and then dropped: most-worked first.
     *
     * The wording is the engine's glossary - CYC master-list terms where the Council names the stitch,
     * our own descriptions where it does not, and the designer's OWN definition, which outranks both.
     */
    function priceStitchForPanel(entry) {
        // A term harvested from the pattern's own abbreviations key arrives with no numbers, and the
        // row that works it fails until the designer supplies them - say so rather than print "uses ?".
        if (!entry || typeof entry.cost !== 'number' || typeof entry.yield !== 'number') {
            return 'not priced yet — add its numbers in the Custom Stitch Dictionary';
        }
        return `uses ${entry.cost} · makes ${entry.yield}`;
    }

    function renderStitchUsage() {
        const host = UI['stitch-usage-content'];
        if (!host) return;

        const A = window.CrochetAnalyticsEngine;
        if (!A || !state.patternSteps.length) {
            host.innerHTML = emptyState('No pattern yet. Validate one in Studio and every stitch it works is listed here.');
            return;
        }

        const totals = A.AggregateStitchCounts(state.patternSteps, state.analytics.lastPass?.validation.rows);
        const names = Object.keys(totals)
            .filter(name => totals[name] > 0)
            .sort((a, b) => totals[b] - totals[a]);

        if (!names.length) {
            host.innerHTML = emptyState('Nothing countable in this pattern yet.');
            return;
        }

        const custom = window.CrochetMathEngine.CUSTOM_STITCHES || {};
        const glossary = window.CrochetMathEngine.STITCH_GLOSSARY || {};
        // The engine's getFullDictionary is not exported; this is the same merge, custom on top.
        const priced = { ...(window.CrochetMathEngine.STITCH_PRIMITIVES || {}), ...custom };
        // The engine dictionary prices a custom stitch but has no room for its wording; the definition
        // the designer typed is in the same store the Custom Stitch Dictionary panel reads.
        const savedStitches = getLocalStorage(state.savedStitchesKey);

        let citesCouncil = false;

        const rows = names.map(name => {
            const isCustom = Object.prototype.hasOwnProperty.call(custom, name);
            const meaning = describeStitchForPanel(
                name, isCustom ? (savedStitches[name] || {}) : null, glossary);
            if (meaning.cyc) citesCouncil = true;
            return `<div class="stitch-row">
                <div class="stitch-head">
                    <span class="stitch-name">${escapeHtml(name)}${isCustom ? '<span class="stitch-flag">yours</span>' : ''}</span>
                    <span class="stitch-math">${escapeHtml(priceStitchForPanel(priced[name]))}</span>
                </div>
                <span class="stitch-working" title="${escapeHtml(meaning.source)}">${escapeHtml(meaning.text)}</span>
            </div>`;
        }).join('');

        const legend = `<p class="stitch-summary">Uses is what a stitch takes from the row below; makes is what it leaves for the row above. The same numbers the matrix counts with.</p>`;
        const credit = citesCouncil
            ? `<p class="stitch-summary">Definitions come from the Craft Yarn Council master list where it names the stitch.</p>`
            : '';
        host.innerHTML = `${legend}${credit}<div class="stitch-list">${rows}</div>`;
    }

    // ---- Printed pattern preview ---------------------------------------------
    /**
     * A scaled copy of #print-area - the element the browser actually prints - so the
     * preview cannot show a page the printout does not. It is rebuilt from that element
     * rather than assembled here, which is why there is no second copy of the print
     * layout to keep in step.
     *
     * Ids are stripped on the way in. The print area is full of them, and a second live
     * element carrying id="print-pattern-title" would make getElementById ambiguous and
     * quietly break the real print rendering.
     */
    function renderPdfPreview() {
        const host = UI['pdf-preview'];
        if (!host) return;

        if (!state.patternSteps.length) {
            host.innerHTML = emptyState('Validate a pattern in Studio and the printed page appears here.');
            return;
        }

        renderPrintArea();
        const source = UI['print-area'];
        const markup = source ? String(source.innerHTML || '') : '';
        host.innerHTML = markup
            ? markup.replace(/\sid="[^"]*"/g, '')
            : emptyState('Nothing to preview yet.');
    }

    /** Brings a panel into view, opening its disclosure if it is a collapsed one. */
    function focusPanel(id, openId) {
        if (openId) {
            const disclosure = shellEl(openId);
            if (disclosure) disclosure.open = true;
        }
        const target = shellEl(id);
        if (target && typeof target.scrollIntoView === 'function') {
            // Instant, not smooth. The panel has only just been shown, so animating to it slides the
            // reader past content that appeared a frame ago - it reads as the page lurching.
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
    }

    /*
     * Opens one hub and closes the other three. An accordion rather than four independent
     * disclosures: with all four open the rail is the same twelve-item list it was before, only
     * taller, and the grouping stops doing any work.
     *
     * The open/closed state is not stored. It is derived from wherever you currently are, every
     * time - navigateTo calls this with the hub owning the destination - so the rail cannot drift
     * out of step with the view, and there is no fifth thing in localStorage to migrate.
     */
    function expandHub(hubId) {
        HUB_IDS.forEach(id => {
            const hub = shellEl(id);
            if (!hub) return;
            const open = id === hubId;
            hub.classList.toggle('is-open', open);
            hub.setAttribute('aria-expanded', String(open));
        });
    }

    /*
     * Draws the workflow rail, or hides it.
     *
     * Rebuilt rather than patched, because it is three nodes read off state that is already computed
     * - the cost is nothing and a diffing version would be more code than the thing it updates.
     *
     * `currentNav` is passed in rather than read back off the DOM: this runs from navigateTo, which
     * knows where it is going before the classes that would say so have been written.
     */
    /* ---- Floating docks -------------------------------------------------------
     * Two panels you reach for WHILE working rather than places you go: the Stitch Library and the
     * Compiler Overview. Both float over the current view instead of replacing it, because looking
     * a stitch up or checking what last failed should not cost you the screen you were writing on.
     *
     * Nothing here moves a panel. Each dock wrapper is already the panels' home in the document -
     * closed it is display: contents and disappears from layout, open it becomes a fixed pane. The
     * shell's invariant holds untouched: every id is in the page at all times, so renderDashCompiler
     * goes on writing live findings into the compiler dock from whichever view you are standing on.
     *
     * Deliberately NOT modal, and there is no scrim. A dock you cannot work behind is a dialog.
     */
    const DOCKS = {
        'dock-library': {
            trigger: 'dock-btn-library', close: 'dock-close-library',
            shellClass: 'dock-library-open',
            // The panels this dock carries. They belong to the Library view, so on any other view
            // showView has hidden them - a dock that opened onto its own hidden panels is an empty
            // pane, which is exactly what the first build of this did.
            panels: ['stitch-usage-panel', 'custom-stitch-section']
        },
        'dock-compiler': {
            trigger: 'dock-btn-compiler', close: 'dock-close-compiler',
            shellClass: 'dock-compiler-open',
            // Nothing to unhide: the compiler card is not a VIEW_PANELS panel. What hides it is its
            // ANCESTOR, #dashboard-view, and an ancestor is the stylesheet's problem - see the
            // dock host rules in section 1b.
            panels: []
        }
    };
    const DOCK_IDS = Object.keys(DOCKS);

    /** Which dock is open, or null. One at a time: two 460px panes over a workspace is a workspace
     *  nobody can see, and they would overlap each other besides. */
    let openDockId = null;

    function setDockState(dockId, open) {
        // A position: fixed pane inside a display: none parent draws nothing, and both docks live
        // inside something a view can hide - the workspace, the dashboard. This class is what the
        // stylesheet keys the host chain off; it re-renders those containers and empties them, so
        // the dock is the only thing in them that draws. Scoped to .hidden containers only, so
        // opening a dock on the view that already owns it changes nothing behind it.
        const shell = shellEl('app-shell');
        if (shell) shell.classList.toggle(DOCKS[dockId].shellClass, open);
        // And the dock's own panels, which the current view may have hidden outright.
        if (open) DOCKS[dockId].panels.forEach(id => setHidden(id, false));

        const dock = shellEl(dockId);
        if (dock) {
            dock.classList.toggle('is-open', open);
            // role="dialog" is set here rather than written into the markup, and that is not
            // tidiness. Closed, the wrapper is display: contents and its panels are simply part of
            // the page - a permanent dialog role would wrap them in a dialog that is not there,
            // and a screen reader would announce one around the Stitch Library at all times.
            // The role exists exactly while the pane does.
            if (open) dock.setAttribute('role', 'dialog');
            else dock.removeAttribute('role');
        }
        const trigger = shellEl(DOCKS[dockId].trigger);
        if (trigger) trigger.setAttribute('aria-expanded', String(open));
    }

    function closeDock(options) {
        if (!openDockId) return;
        const wasOpen = openDockId;
        setDockState(wasOpen, false);
        openDockId = null;
        // Hand visibility back to the one thing that decides it. Re-asking showView is why closing
        // a dock cannot leave a panel on screen that the current view does not want - there is no
        // list here of what was changed, so there is no list to get wrong.
        if (DOCKS[wasOpen].panels.length) showView(currentViewName);
        // Focus goes back where it came from, or a keyboard user is returned to the top of the
        // document having lost their place. Skipped when the close was itself a navigation, which
        // has its own opinion about where focus should be.
        if (!(options || {}).silent) shellEl(DOCKS[wasOpen].trigger)?.focus();
    }

    function openDock(dockId) {
        if (!DOCKS[dockId]) return;
        if (openDockId && openDockId !== dockId) closeDock({ silent: true });
        setDockState(dockId, true);
        openDockId = dockId;
        shellEl(DOCKS[dockId].close)?.focus();
    }

    function toggleDock(dockId) {
        if (openDockId === dockId) closeDock();
        else openDock(dockId);
    }

    /* Where the rail last drew. Held so refreshStageRail can redraw after a compile without the
       caller - which is deep in the matrix renderer and has no business knowing about navigation -
       having to say where it is. */
    let stageRailNav = null;

    /* Lights the sidebar's numbered hubs off the same predicates the rail reads. Separate from the
       rail because the sidebar is on screen on every view and the rail is not: a compile run from
       the Dashboard's compiler dock has to light step 2 in the sidebar even though there is no
       rail on the Dashboard to redraw. */
    function renderStepBadges() {
        STAGES.forEach(stage => {
            shellEl(stage.hub)?.classList.toggle('is-done', !!stage.done());
        });
    }

    function renderStageRail(currentNav) {
        stageRailNav = currentNav;
        renderStepBadges();
        const rail = shellEl('stage-rail');
        if (!rail) return;

        // On every page that belongs to a numbered step - not only the one each step lands on, but
        // every entry under its hub, so the Stitch Library, Construction and the Size Grader carry
        // the rail as much as Patterns and the Studio do. Off on the rest: Settings, and the
        // Dashboard's entries. A "write a pattern" strip above Analytics would be pointing at work
        // the page in front of you has nothing to do with. The current step is the one whose hub
        // owns the page, so the Stitch Library lights step 1 and the Size Grader step 2.
        const currentHub = HUB_OF[currentNav];
        const onWorkflow = STAGES.some(stage => stage.hub === currentHub);
        setHidden('stage-rail', !onWorkflow);
        if (!onWorkflow) { rail.replaceChildren(); return; }

        // Built element by element and each stage given an id, NOT assembled as an innerHTML string.
        // A strip built from markup has to be found again with querySelectorAll to be wired, the
        // stub the tests run under does not have it, and a control
        // that cannot be clicked in a test is a control whose behaviour is unverified. Routing
        // across three views is the whole point of this rail, so it has to be clickable in a test.
        // The rail element itself spans the topbar so it lands on its own line; the visible pill is
        // an inner track that spans it in turn, with the .stage-link threads taking up the slack so
        // the three stages spread from edge to edge. Two elements because the outer one's flex-basis
        // is what buys the line break and the inner one is what can then be styled as a pill.
        rail.replaceChildren();
        const track = elem('div', 'stage-track');
        rail.appendChild(track);

        STAGES.forEach((stage, i) => {
            if (i > 0) track.appendChild(elem('span', 'stage-link'));

            const done = !!stage.done();
            const here = stage.hub === currentHub;
            const cls = 'stage' + (done ? ' is-done' : '') + (here ? ' is-here' : '');
            const el = button(cls, null, `stage-${stage.nav}`, () => navigateTo(stage.nav));
            UI[el.id] = el;

            // The number stays whether or not the stage has anything in it - it is the same number
            // the sidebar shows for this step, and a label that changes shape is two labels. Done
            // is the is-done class, which colours the disc.
            const dot = elem('span', 'stage-dot');
            dot.appendChild(elem('span', 'stage-num', String(i + 1)));

            // The step's pastel, shared with the sidebar through [data-step] in the stylesheet.
            el.dataset.step = String(i + 1);
            el.appendChild(dot);
            el.appendChild(elem('span', 'stage-label', stage.label));
            // aria-current marks where you are. "done" is said in words as well, because a colour
            // announces as nothing at all.
            if (here) el.setAttribute('aria-current', 'step');
            if (done) el.appendChild(elem('span', 'visually-hidden', ' (done)'));

            track.appendChild(el);
        });
    }

    /* Redraw where we already are. Called after a compile, when Write and Export may have just
       been earned and the rail would otherwise keep showing the state before the parse. The
       sidebar badges are refreshed either way - see renderStepBadges - because the rail may
       never have been drawn on this view while the sidebar always has. */
    function refreshStageRail() {
        if (stageRailNav) renderStageRail(stageRailNav);
        else renderStepBadges();
    }

    /** The one entry point for navigation, from the sidebar or from a dashboard link. */
    function navigateTo(navId, options) {
        const target = NAV_TARGETS[navId];
        if (!target) return;
        const opts = options || {};

        // Practice is a destination only while the layer it belongs to is shown. Refused here rather
        // than only hidden in the rail, because a hash is a way in that does not go through the rail:
        // #practice with the switch off would otherwise open a panel display: none is hiding.
        if (navId === 'nav-practice' && !state.viewPrefs.practiceMode) {
            navigateTo('nav-dashboard', opts);
            return;
        }
        currentNavId = navId;

        // A dock holds panels that also belong to a view. Leave one open across a navigation onto
        // that view and the panels are in the floating pane while the column they came from shows a
        // gap where they should be. Closing here is the whole fix, and it is also what you want
        // anyway: you asked to go somewhere, so the thing floating over the last place should go.
        // Silent because focus is about to be decided by the navigation itself.
        closeDock({ silent: true });

        showView(target.view);
        expandHub(HUB_OF[navId]);
        renderStageRail(navId);

        NAV_IDS.forEach(id => {
            const tab = shellEl(id);
            if (!tab) return;
            const active = id === navId;
            tab.classList.toggle('is-active', active);
            // The class is a colour; this is the fact. Without it the active tab is styled as current
            // and announced as identical to the eleven around it.
            if (active) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });

        setText('view-title', target.title);
        setText('view-subtitle', target.sub);

        // A sighted reader gets a whole new screen; without this a listener gets silence, and eleven
        // sidebar items that all sound the same once activated. aria-current names which tab is
        // selected, which is a different question from where you now are.
        //
        // Said rather than focused, deliberately. Moving focus to the heading would also work and is
        // what a lot of routers do, but it drags a sighted keyboard user's caret across the page on
        // every click; the announcement reaches the reader who needs it and leaves everyone else alone.
        //
        // Not on the opening navigation: that one runs before anyone has asked for anything, and
        // announcing there talks over the page introducing itself.
        if (!opts.silent) announce(`${target.title}. ${target.sub}`);

        // Exactly one scroll per navigation. A view with no focus target starts at its top, or it
        // inherits wherever the previous view was scrolled to and can land on blank space. A view WITH
        // one goes straight there - resetting to the top and then animating down is two scrolls for one
        // click, which is the shake this used to have.
        // opts.focus is a caller asking for a panel the destination does not name by itself - the
        // dashboard's two compiler shortcuts, which go to Studio but want its matrix rather than its
        // top. It goes through here rather than being scrolled to afterwards so it stays ONE scroll.
        const landOn = opts.focus || target.focus;
        if (landOn) {
            focusPanel(landOn, opts.focus ? null : target.open);
        } else if (typeof window.scrollTo === 'function') {
            window.scrollTo(0, 0);
        }
        closeNavDrawer();
        setStoredString('stitchmath_view', navId);
        // Not when we got here BECAUSE the hash changed - the URL is already what it should be, and
        // writing it again would push a duplicate entry the back button then has to walk back through.
        if (!opts.fromHash) syncHash(navId, opts.replace);
    }

    function closeNavDrawer() {
        const shell = shellEl('app-shell');
        if (shell) shell.classList.remove('nav-open');
        UI['nav-toggle']?.setAttribute('aria-expanded', 'false');
    }

    function setupShell() {
        NAV_IDS.forEach(id => {
            const tab = shellEl(id);
            if (tab) tab.addEventListener('click', () => navigateTo(id));
        });

        // A hub press opens the group and goes to its first entry. Opening alone was tried and is
        // worse: a press that only reveals more buttons is a press that did nothing, and it leaves
        // the rail claiming a hub is open while the workspace still shows a different one. Going
        // somewhere also means expandHub is reached through the single navigateTo path rather than
        // being a second way for the rail to change state.
        HUB_IDS.forEach(id => {
            const hub = shellEl(id);
            if (hub) hub.addEventListener('click', () => navigateTo(NAV_HUBS[id][0]));
        });

        DOCK_IDS.forEach(id => {
            shellEl(DOCKS[id].trigger)?.addEventListener('click', () => toggleDock(id));
            shellEl(DOCKS[id].close)?.addEventListener('click', () => closeDock());
        });
        // Escape closes the dock. Registered on the document rather than the pane because focus is
        // free to be anywhere - the whole point is that you can keep typing behind it.
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && openDockId) closeDock();
        });
        // So does a click anywhere outside it. Not a scrim - the workspace behind stays live, and
        // the click still lands on whatever it hit; the dock just goes as it does. Silent, because
        // the pointer has already put focus where the user wants it. Its own trigger is left out
        // or a click that just opened it would close it in the same breath, and a target that the
        // click's own handler has since re-rendered out of the document is left alone, or a
        // re-render inside the pane would read as a click outside it.
        document.addEventListener('click', event => {
            if (!openDockId) return;
            const target = event.target;
            if (!(target instanceof Node) || !document.contains(target)) return;
            if (shellEl(openDockId)?.contains(target)) return;
            if (shellEl(DOCKS[openDockId].trigger)?.contains(target)) return;
            closeDock({ silent: true });
        });

        UI['nav-toggle']?.addEventListener('click', () => {
            const shell = shellEl('app-shell');
            if (!shell) return;
            const open = shell.classList.toggle('nav-open');
            // Reported rather than assumed: the drawer is also closed by the scrim and by navigating,
            // and a toggle that only ever says "false" is worse than one that says nothing.
            UI['nav-toggle'].setAttribute('aria-expanded', String(open));
        });
        UI['nav-scrim']?.addEventListener('click', closeNavDrawer);

        // Summary tiles and card links are shortcuts to the same destinations. Compiling is something
        // Studio does rather than a place of its own, so the Compiler tile and the Overview card's
        // "Open compiler" both lead there - but they land ON the compiler, not at the top of the tab.
        // Sent to Studio bare they were indistinguishable from the Studio tile beside them: three
        // controls with three different labels and one visible result, which is what made "Open
        // compiler" read as a link that did not work. A shortcut is either a nav id or a pair of one
        // and the panel to land on; focusPanel is the same scroll navigateTo does for a nav target
        // that declares one, so nothing here scrolls twice.
        const SHORTCUTS = {
            'tile-patterns': 'nav-patterns',
            'tile-compiler': { nav: 'nav-studio', focus: 'matrix-section' },
            'tile-sizer': 'nav-sizer', 'tile-studio': 'nav-studio',
            'tile-analytics': 'nav-analytics',
            'link-recent': 'nav-patterns',
            'link-compiler': { nav: 'nav-studio', focus: 'matrix-section' },
            'link-analytics': 'nav-analytics',
            'link-sizes': 'nav-sizer',
            'link-gauges': 'nav-gauge', 'dash-export-package': 'nav-publish',
            'dash-export-open': 'nav-publish',
            // From the floating Stitch Library to the tab it is a peek at.
            'dock-open-library': 'nav-library'
        };
        Object.keys(SHORTCUTS).forEach(id => {
            UI[id]?.addEventListener('click', () => {
                const to = SHORTCUTS[id];
                if (typeof to === 'string') navigateTo(to);
                else navigateTo(to.nav, { focus: to.focus });
            });
        });

        // Export options forward to the real controls rather than duplicating them, so there is one
        // implementation of each export and no format is offered that the app cannot produce. Every
        // shortcut runs the same function the original button runs: synthesising a click would work in a
        // browser and do nothing headlessly, so the shortcuts could never be tested.
        UI['roll-again']?.addEventListener('click', rerollStitch);
        UI['roll-worked']?.addEventListener('click', markStitchWorked);
        UI['practice-check']?.addEventListener('click', checkPracticeAnswer);
        // A shortcut, not a second implementation: logging the swatch is still the Gauge Profile's job.
        UI['practice-swatch-go']?.addEventListener('click', () => navigateTo('nav-gauge'));
        // Construction's construction picker. Everything else on that tab is built at run time and wires
        // itself as it is built; these three are in the markup.
        Object.keys(CONSTRUCTION_PLANNERS).forEach(key => {
            UI[`construction-con-${key}`]?.addEventListener('click', () => {
                constructionConstruction = key;
                renderConstructionPlanner();
            });
        });

        UI['btn-new-project']?.addEventListener('click', handleNewFile);
        // Save, from anywhere. The same function #save-btn runs, not a second implementation and not
        // a synthesised click on it: handleSaveProject reads the name and the pattern out of the page
        // itself, so it does not care which button asked. It says its own no when there is nothing to
        // save or nothing to call it.
        UI['btn-save-project']?.addEventListener('click', handleSaveProject);
        UI['dash-export-txt']?.addEventListener('click', handleExportText);
        UI['dash-export-pdf']?.addEventListener('click', handleExportPdf);
        UI['dash-export-history']?.addEventListener('click', exportGaugeHistory);

        UI['pub-export-txt']?.addEventListener('click', handleExportText);
        UI['pub-export-pdf']?.addEventListener('click', handleExportPdf);
        UI['pub-export-markup']?.addEventListener('click', handleExportMarkup);
        UI['pub-export-history']?.addEventListener('click', exportGaugeHistory);
        UI['pub-refresh-preview']?.addEventListener('click', renderPdfPreview);
        // The multi-size package is built by the grader, so this goes to it.
        UI['pub-export-package']?.addEventListener('click', () => {
            // A side effect of pressing an export button, not a place the reader chose to go.
            navigateTo('nav-sizer', { replace: true });
            focusPanel('grade-output-panel', 'grade-output-panel');
        });

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('hashchange', handleHashChange);
        }

        // A link someone was sent outranks where this browser happened to be last. Replaces rather than
        // pushes, so the first entry in the history is the view you actually arrived on.
        const saved = getStoredString('stitchmath_view');
        const opening = navFromHash() || (NAV_TARGETS[saved] ? saved : 'nav-dashboard');
        navigateTo(opening, { replace: true, silent: true });
    }

    // ---- Progress store ------------------------------------------------------
    /*
     * Points are awarded for things that actually happened in this browser and nothing else. Every
     * source is a piece of pattern-writing work - a pattern saved, a file exported, stitches worked, a
     * swatch measured - recorded at the moment it is done rather than estimated on render.
     *
     * Two rules the whole store is built to keep:
     *   1. Nothing pays twice for the same work. Re-pressing Compile, re-saving the same file or
     *      re-rendering the dashboard must never move the total - hence the stitch high-water mark and
     *      the date-stamped daily awards.
     *   2. Nothing is invented. Every figure traces back to a step the designer took; there is no
     *      participation trophy for opening the app.
     */
    const POINTS = { project: 25, swatch: 10, export: 15, quest: 50 };
    const POINTS_PER_LEVEL = 100;

    // Lifetime stitches are paid in steps rather than per stitch: a point a stitch would make every
    // other source irrelevant by the second row.
    const STITCHES_PER_STEP = 100;
    const POINTS_PER_STEP = 5;

    // The ledger that stops a re-compile being paid for twice. Capped, because it is keyed by pattern
    // and localStorage is not a database.
    const CREDIT_LEDGER_MAX = 40;

    // Exporting is real work, but it is also a button. The lifetime count always moves; the payout stops
    // after three in a day.
    const EXPORTS_PAID_PER_DAY = 3;

    /* Consecutive days are worth more than the sum of their parts, so the streak pays out at the points
       where giving up is most tempting. Once each, and only forwards. */
    /* One rest day banked per seven consecutive days, never more than two in hand. Two is enough to
       cover an ordinary weekend away and few enough that the streak still means what it says. */
    const REST_DAY_EVERY = 7;
    const REST_DAY_CAP = 2;
    /* Seven dots shown, a fortnight kept. A gap then reads as a week with a hole in it rather than as
       a failure - a bare number makes a miss feel like a score of zero, which is what this replaces.
       The second week is held so a rest day spent on the boundary is still on the record. */
    const STREAK_WEEK = 7;
    const STREAK_DOTS = 14;

    const STREAK_MILESTONES = [
        { day: 3, points: 25 }, { day: 7, points: 75 },
        { day: 14, points: 150 }, { day: 30, points: 400 }
    ];

    /** The day, as the store counts days. `today(-1)` is yesterday - the offset is here because the
     *  streak needs both and two spellings of the same date arithmetic is one too many. */
    function today(offsetDays) {
        return new Date(Date.now() + (offsetDays || 0) * 86400000)
            .toISOString().slice(0, 10);
    }

    function readProgress() {
        const stored = getLocalStorage(state.progressKey);
        const roll = stored.roll || {};
        const practice = stored.practice || {};
        const dayExports = stored.dayExports || {};
        const object = (value) => (value && typeof value === 'object') ? value : {};
        // Version 3 added the lifetime record and the stitch roll; 4 the locker; 5 how the designer
        // chose to look. Versions 4 and 5 are gone again - the avatar and its wardrobe were removed -
        // and the fields they wrote are simply no longer read. They are not deleted from storage
        // either: a write merges over what is there, so a store that has them keeps them and the
        // feature could return without anyone losing what they chose. Every field is additive and
        // defaults to empty, so a version 1 store loads as a designer who has written nothing rather
        // than needing a migration.
        return {
            version: 6,
            points: Number(stored.points) || 0,
            // Points that have been spent. Kept because `points` is the balance and the level is a
            // statement about work done - without this, a re-roll would walk the rank backwards.
            spent: Number(stored.spent) || 0,
            projects: Number(stored.projects) || 0,
            swatches: Number(stored.swatches) || 0,
            exports: Number(stored.exports) || 0,
            stitches: Number(stored.stitches) || 0,
            compiles: Number(stored.compiles) || 0,
            streak: Number(stored.streak) || 0,
            bestStreak: Number(stored.bestStreak) || 0,
            // Rest days banked, and the streak length the last one was banked at. Both additive and
            // both default to zero, so a store written before forgiveness existed reads as a designer
            // who has banked nothing rather than needing a migration.
            restDays: Math.max(0, Math.min(REST_DAY_CAP, Number(stored.restDays) || 0)),
            restBankedAt: Number(stored.restBankedAt) || 0,
            // The days that were not missed, most recent last, each { d: 'YYYY-MM-DD', k: 'worked' |
            // 'rested' }. Dated rather than positional because the dots have to show gaps, and a gap
            // is a day with NO entry - which a bare list of outcomes cannot represent.
            days: Array.isArray(stored.days)
                ? stored.days.filter(day => day && day.d).slice(-STREAK_DOTS)
                : [],
            lastMilestone: Number(stored.lastMilestone) || 0,
            lastActive: stored.lastActive || '',
            questDate: stored.questDate || '',
            // token -> the date it was first worked. It used to be `true`; any truthy value still
            // reads as collected, so a store written before the cabinet existed keeps its stitches
            // and simply has no dates to show for them. The same additive rule as everything else
            // here - no migration.
            collection: object(stored.collection),
            // Slot A's ledger and slot B's mark, both stamped with the day they belong to. Nothing
            // pays twice and everything resets at local midnight, exactly as questDate does.
            practice: {
                date: practice.date || '',
                rowId: practice.rowId || '',
                answered: !!practice.answered,
                given: Number(practice.given) || 0,
                correct: !!practice.correct,
                met: !!practice.met
            },
            // The day a swatch was last logged. The lifetime count cannot answer "today?", which is
            // the only question slot C asks.
            lastSwatch: stored.lastSwatch || '',
            // fixId -> the date the correction was first accepted. Deliberately not priced: this is a
            // record of understanding, and putting points on it would invite farming.
            lessons: object(stored.lessons),
            credited: object(stored.credited),
            creditOrder: Array.isArray(stored.creditOrder) ? stored.creditOrder : [],
            paidSaves: Array.isArray(stored.paidSaves) ? stored.paidSaves : [],
            dayExports: { date: dayExports.date || '', count: Number(dayExports.count) || 0 },
            roll: {
                date: roll.date || '', stitch: roll.stitch || '',
                rerolls: Number(roll.rerolls) || 0, claimed: !!roll.claimed,
                isNew: !!roll.isNew
            }
        };
    }

    /** The one writer. Reads the store, hands it to the caller to change, writes it back and redraws the
     *  readouts. Returning false from `mutate` abandons the write, for a caller that found nothing had
     *  changed. */
    function writeProgress(mutate) {
        updateLocalStorage(state.progressKey, store => {
            const progress = readProgress();
            if (mutate(progress) === false) return false;
            Object.assign(store, progress);
        });
        renderProgress();
    }

    /**
     * A streak is consecutive calendar days with recorded activity, with one day of forgiveness in
     * the bank for every seven kept.
     *
     * Why forgiveness at all: resetting to 1 on a single missed day un-earns every milestone with it,
     * which is the mechanic that makes people quit on day eight and not come back. It also punishes
     * the wrong thing - somebody who worked twenty days and missed one has not undone the twenty.
     *
     * What it is NOT is a free pass. A rest day is spent, not granted: it has to have been earned by
     * seven days of actual work, only one gap of exactly one day can be covered, and two days away is
     * still a reset however full the bank is.
     */
    function touchStreak(progress) {
        const now = today();
        if (progress.lastActive === now) return progress;

        const yesterday = progress.lastActive === today(-1);
        // Exactly one day missed, and something banked to cover it. Longer gaps fall through to the
        // reset below whatever the bank holds.
        const forgiven = !yesterday && progress.lastActive === today(-2) && progress.restDays > 0;

        if (forgiven) {
            progress.restDays -= 1;
            progress.streak += 1;
            markDay(progress, 'rested', today(-1));
        } else if (yesterday) {
            progress.streak += 1;
        } else {
            progress.streak = 1;
            // A run that ended takes its bank with it. Carrying it over would let somebody bank two
            // days across a good fortnight and then spend them covering alternate days forever.
            progress.restDays = 0;
            progress.restBankedAt = 0;
        }

        markDay(progress, 'worked');
        progress.lastActive = now;
        if (progress.streak > progress.bestStreak) progress.bestStreak = progress.streak;
        // A broken streak un-earns its milestones, or the next run of days would climb past them in
        // silence.
        if (progress.streak === 1) progress.lastMilestone = 0;

        // One banked per seven consecutive days, capped. `restBankedAt` is what stops day 8, 9 and 10
        // each banking another: the bank moves when the streak CROSSES a seventh day, not while it
        // stands past one.
        const earned = Math.floor(progress.streak / REST_DAY_EVERY) * REST_DAY_EVERY;
        if (earned > progress.restBankedAt) {
            progress.restBankedAt = earned;
            progress.restDays = Math.min(REST_DAY_CAP, progress.restDays + 1);
        }
        return progress;
    }

    /** Records one day as worked or rested. A rest day and the day of work that follows it are two
     *  separate marks on two separate dates, which is why this takes the date rather than assuming
     *  today. Kept short: it is a picture of the last fortnight, not a history. */
    function markDay(progress, kind, date) {
        if (!Array.isArray(progress.days)) progress.days = [];
        const day = date || today();
        const already = progress.days.findIndex(entry => entry.d === day);
        if (already !== -1) progress.days.splice(already, 1);
        progress.days.push({ d: day, k: kind });
        while (progress.days.length > STREAK_DOTS) progress.days.shift();
    }

    /** The last seven calendar days, oldest first. A day with no entry is a miss - which is the whole
     *  reason the entries are dated: a list of outcomes alone cannot say which days are missing. */
    function streakDots(progress) {
        const marks = {};
        (progress.days || []).forEach(entry => { marks[entry.d] = entry.k; });
        const out = [];
        for (let back = STREAK_WEEK - 1; back >= 0; back--) {
            const date = today(-back);
            out.push({ date, kind: marks[date] || 'missed' });
        }
        return out;
    }

    /** Marks the day as worked and pays any streak milestone that just came due. */
    function recordWork(progress) {
        touchStreak(progress);
        STREAK_MILESTONES.forEach(milestone => {
            if (progress.streak >= milestone.day && progress.lastMilestone < milestone.day) {
                progress.points += milestone.points;
                progress.lastMilestone = milestone.day;
            }
        });
        return progress;
    }

    /** Writing a pattern keeps the streak alive on a day that happens to pay nothing - the work was still
     *  done. Opening the app does not: this is called from the compile path, where there are steps on
     *  the page to prove it. */
    function touchActivity() {
        // New File runs the stats over an empty page, and an empty page is not a day's work. Without
        // this the streak started itself the moment the app was opened.
        if (!state.patternSteps.length) return;
        if (readProgress().lastActive === today()) return;
        writeProgress(recordWork);
    }

    function awardProgress(kind, detail) {
        const points = POINTS[kind];
        if (!points) return;
        writeProgress(progress => {
            if (kind === 'project') {
                // The caller has already refused to pay for overwriting a file that exists. This is the
                // other half of the same rule: a name paid for once stays paid for, so deleting a project
                // and saving it again under the same name is not a way to be paid twice.
                if (progress.paidSaves.indexOf(detail) !== -1) return recordWork(progress);
                progress.paidSaves.push(detail);
                progress.projects += 1;
            }
            if (kind === 'swatch') { progress.swatches += 1; progress.lastSwatch = today(); }
            if (kind === 'quest') { progress.questDate = today(); progress.compiles += 1; }
            if (kind === 'export') {
                // The lifetime figure is the honest record and always moves. The payout is what is
                // capped, so pressing Download eight times ships eight files and earns three.
                progress.exports += 1;
                if (progress.dayExports.date !== today()) {
                    progress.dayExports = { date: today(), count: 0 };
                }
                if (progress.dayExports.count >= EXPORTS_PAID_PER_DAY) return recordWork(progress);
                progress.dayExports.count += 1;
            }
            progress.points += points;
            recordWork(progress);
        });
    }

    // ---- Lifetime record -----------------------------------------------------
    /** FNV-1a, 32-bit. Small, stable, and the same number in every browser. */
    function hashString(text) {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    /** What makes this pattern this pattern, for the purpose of not paying for it twice. */
    function patternFingerprint() {
        return String(hashString(state.patternSteps
            .map(step => step.sourceLine ?? step.instructionString ?? '').join('|')));
    }

    function rememberFingerprint(progress, fingerprint) {
        const seen = progress.creditOrder.indexOf(fingerprint);
        if (seen !== -1) progress.creditOrder.splice(seen, 1);
        progress.creditOrder.push(fingerprint);
        while (progress.creditOrder.length > CREDIT_LEDGER_MAX) {
            delete progress.credited[progress.creditOrder.shift()];
        }
    }

    /**
     * Stitches ever worked, and stitches ever discovered.
     *
     * The analytics recompute the pattern's stitch total on every compile, so adding that total to a
     * lifetime figure would pay a designer for pressing Compile rather than for writing anything. Only
     * the increase over what this pattern has already been credited counts, held as a high-water mark
     * per pattern - so adding ten rows credits ten rows, and re-compiling credits nothing.
     *
     * The ledger holds the last forty patterns. One that falls off the end and comes back is credited
     * again; the alternative is a store that grows forever, and forty is far past the point where anyone
     * is farming it by hand.
     *
     * Only a clean pattern counts. The aggregator will happily total the stitches in a row that does not
     * add up, and such a row is not work anyone can crochet - crediting it would pay for text, and put a
     * lifetime figure behind a number the app is at that moment calling wrong.
     */
    function creditPatternWork(report) {
        if (!report || !state.patternSteps.length) return;
        if (!isCleanPass(state.analytics.lastPass)) return;
        const fingerprint = patternFingerprint();
        const total = Number(report.totalStitches) || 0;
        const totals = report.stitchTotals || {};
        const worked = Object.keys(totals).filter(name => totals[name] > 0);

        writeProgress(progress => {
            const fresh = worked.filter(name => !progress.collection[name]);
            const gained = Math.max(0, total - (Number(progress.credited[fingerprint]) || 0));
            if (!gained && !fresh.length) return false;

            fresh.forEach(name => { progress.collection[name] = today(); });
            if (gained) {
                progress.credited[fingerprint] = total;
                rememberFingerprint(progress, fingerprint);
                // Paid on the steps crossed rather than the stitches gained, so the hundredth stitch pays
                // whether it arrived alone or with ninety-nine.
                const before = Math.floor(progress.stitches / STITCHES_PER_STEP);
                progress.stitches += gained;
                const after = Math.floor(progress.stitches / STITCHES_PER_STEP);
                progress.points += (after - before) * POINTS_PER_STEP;
                recordWork(progress);
            }
        });
    }

    // ---- Daily stitch roll ---------------------------------------------------
    /*
     * One stitch a day, drawn at random, worth more the rarer it is: work it into a pattern that compiles
     * clean and it pays. The draw is the point - a bobble is a different afternoon from a single crochet,
     * and which one you are asked for is not up to you.
     *
     * The pool is the analytics complexity table intersected with the engine's stitch dictionary, which
     * is deliberately narrow: a stitch is only rollable if the parser can read it (so it can be typed)
     * AND the aggregator emits its token (so working it can be seen). Anything the app could ask for but
     * never notice would be a quest that cannot be completed.
     */
    const ROLL_BASE = 40;
    /*
     * KEPT ON PURPOSE, and deliberately no longer charged. Rerolls became a daily allowance (see
     * REROLLS_PER_DAY) because telling a beginner that looking at a different stitch costs them
     * progress teaches the wrong lesson about curiosity.
     *
     * This constant, `progress.spent` and the `lifetime = points + spent` arithmetic in
     * renderProgress are the machinery a currency needs. They stay against the return of a spend -
     * the avatar and its accessories are the use case that would want one - exactly as readProgress
     * keeps the version 4 and 5 fields it no longer reads. Not dead code to be tidied away.
     */
    const REROLL_COST = 40;
    /* Two a day. Enough to get past a stitch you have no yarn for, few enough that the draw still
       means something - the whole shape of the roll is that which stitch you are asked for is not up
       to you. Read off the counter the store already keeps. */
    const REROLLS_PER_DAY = 2;
    const DISCOVERY_BONUS = 50;
    // Neither a stitch nor a technique anyone sets out to use: rolling "work a chain today" is not a
    // quest, it is a description of crochet.
    const ROLL_SKIP = ['ch', 'yo', 'repeat', 'rep', 'magicring'];

    /* Rarer stitches are both harder to land and worth more, which is the whole shape of the thing:
       `odds` is the number of tickets a stitch of that weight holds in the draw, `pay` what it multiplies
       the base reward by. Roughly 39% Common, 22% Uncommon, 30% Rare, 9% Legendary across the pool. */
    const ROLL_TIERS = {
        1: { name: 'Common', odds: 5, pay: 1 },
        2: { name: 'Common', odds: 4, pay: 1.5 },
        3: { name: 'Uncommon', odds: 3, pay: 2 },
        4: { name: 'Rare', odds: 2, pay: 3 },
        5: { name: 'Legendary', odds: 1, pay: 5 }
    };

    let rollPoolCache = null;
    function rollPool() {
        if (rollPoolCache) return rollPoolCache;
        const scores = (window.CrochetAnalyticsEngine || {}).STITCH_COMPLEXITY_SCORES || {};
        const primitives = (window.CrochetMathEngine || {}).STITCH_PRIMITIVES || {};
        rollPoolCache = Object.keys(scores)
            .filter(token => ROLL_SKIP.indexOf(token) === -1 && primitives[token])
            // Sorted, so the seed means the same stitch tomorrow as it did today. Object key order is
            // stable in practice and guaranteed in nothing.
            .sort()
            .map(token => ({ token, weight: Math.max(1, Math.min(5, scores[token])) }));
        return rollPoolCache;
    }

    /** A weighted draw, decided by the seed alone so it can be made again. */
    function drawStitch(seed) {
        const pool = rollPool();
        if (!pool.length) return '';
        const tickets = pool.reduce((sum, entry) => sum + ROLL_TIERS[entry.weight].odds, 0);
        let ticket = hashString(seed) % tickets;
        for (let i = 0; i < pool.length; i++) {
            ticket -= ROLL_TIERS[pool[i].weight].odds;
            if (ticket < 0) return pool[i].token;
        }
        return pool[pool.length - 1].token;
    }

    /** The glossary's wording for a rolled token, or the token when it has none. Follows the same rule
     *  the Stitch Library panel does: when the token IS the word - "bobble", "picot" - the term would
     *  only print the name back, so the abbreviation is the useful half to show. */
    function stitchTermFor(token) {
        const glossary = (window.CrochetMathEngine || {}).STITCH_GLOSSARY || {};
        const known = glossary[token];
        if (!known) return token;
        // Some glossary entries carry an explanation after a dash. The card has room for the name, not
        // the lesson.
        const term = String(known.term).split(' - ')[0];
        return term.toLowerCase() === String(token).toLowerCase()
            ? `abbreviated ${known.abbr}` : term;
    }

    /** Today's roll and what it is worth. Derived rather than stored, apart from the token itself: a
     *  reward held in the store would drift from the streak that multiplies it. */
    function describeRoll(progress) {
        const token = progress.roll.stitch;
        const scores = (window.CrochetAnalyticsEngine || {}).STITCH_COMPLEXITY_SCORES || {};
        const weight = Math.max(1, Math.min(5, scores[token] || 1));
        const tier = ROLL_TIERS[weight];
        // Settled when the stitch was drawn, not asked again here. The compile that claims a roll is
        // usually the same one that adds the stitch to the collection, so re-deriving it would cancel the
        // discovery bonus a moment before paying it - the card would advertise 250 and hand over 200.
        const isNew = progress.roll.isNew;
        const base = Math.round((ROLL_BASE * tier.pay * streakMultiplier(progress.streak)) / 5) * 5;
        return {
            token, weight, isNew,
            tier: tier.name,
            term: stitchTermFor(token),
            reward: base + (isNew ? DISCOVERY_BONUS : 0),
            rerolled: progress.roll.rerolls > 0,
            claimed: progress.roll.claimed
        };
    }

    /** What a streak is worth: 5% a day, and no more than half again. */
    function streakMultiplier(streak) {
        return 1 + Math.min(Number(streak) || 0, 10) * 0.05;
    }

    /** Draws the day's stitch the first time the day is seen, then holds it. The seed is the date and the
     *  number of re-rolls bought, so a reload cannot re-roll: the reel is an animation over a decision
     *  already made. */
    function ensureRoll() {
        const progress = readProgress();
        if (progress.roll.date === today() && progress.roll.stitch) return progress;
        // Drawing is not work, so this write does not touch the streak. Opening the app on a new day must
        // not start one.
        writeProgress(store => {
            const stitch = drawStitch(today() + '#0');
            store.roll = {
                date: today(), stitch, rerolls: 0, claimed: false,
                isNew: !store.collection[stitch]
            };
        });
        return readProgress();
    }

    /** Two draws a day beyond the first, and none once the bonus has been claimed - a stitch already
     *  worked is not one to trade away. The counter resets with the roll, so tomorrow starts at zero. */
    function canReroll(progress) {
        return !progress.roll.claimed && progress.roll.rerolls < REROLLS_PER_DAY;
    }

    function rerollStitch() {
        if (!canReroll(ensureRoll())) return;
        writeProgress(progress => {
            progress.roll.rerolls += 1;
            progress.roll.stitch = drawStitch(today() + '#' + progress.roll.rerolls);
            progress.roll.isNew = !progress.collection[progress.roll.stitch];
        });
        startReel();
        renderPractice();
    }

    /** Whether the pattern on the page currently counts as finished work. */
    function isCleanPass(pass) {
        return !!pass && pass.validation.rows.length > 0 && pass.analytics.failedRowsCount === 0
            && pass.analytics.blockedRowsCount === 0;
    }

    /** Pays the roll when the pattern on the page both compiles clean and actually works the stitch. Read
     *  off the aggregated totals rather than the text, so claiming it needs the stitch to have been
     *  worked rather than merely mentioned. */
    function checkStitchRoll(pass) {
        const progress = ensureRoll();
        if (progress.roll.claimed || !isCleanPass(pass)) return;
        const totals = (state.analytics.report || {}).stitchTotals || {};
        if (!(totals[progress.roll.stitch] > 0)) return;

        const reward = describeRoll(progress).reward;
        writeProgress(store => {
            store.points += reward;
            store.roll.claimed = true;
            if (!store.collection[store.roll.stitch]) store.collection[store.roll.stitch] = today();
            recordWork(store);
        });
    }

    /** The daily quest, checked rather than awarded: it asks whether the pattern currently compiles
     *  clean, which is a fact about state, so it is safe to evaluate on every render. The points behind
     *  it are still granted once a day. */
    function checkDailyQuest(pass) {
        if (isCleanPass(pass) && readProgress().questDate !== today()) awardProgress('quest');
        return readProgress().questDate === today();
    }

    // ---- Daily practice ------------------------------------------------------
    /*
     * Three slots, each independently completable, each resetting at local midnight - and completing
     * ANY one of them is a day's work, so the streak advances.
     *
     * That last part is the whole reason this section exists. Every other way to earn presupposes
     * somebody who is ALREADY writing a pattern: a project saved, a swatch measured, a file exported,
     * stitches worked, a clean compile. A beginner has none of those, so the entire progress layer was
     * invisible to exactly the person it was meant to serve.
     *
     * The rule it does not weaken: there is still no participation trophy for opening the app. A slot
     * has to be DONE. What changed is that there is now something a learner can do.
     */

    /*
     * The rows.
     *
     * Curated rather than generated, in the same spirit as PATTERN_TEMPLATES. A generated row can be
     * arithmetically valid and pedagogically meaningless, and the value here is that a person chose
     * what is worth learning on day nine.
     *
     * NO ROW STORES ITS ANSWER, and none ever may. The count comes back from evaluateStep every time
     * the question is asked - see practiceAnswer. An answer stored beside the row would eventually
     * disagree with the validator, and then the app would be teaching something its own checker
     * contradicts. Grading through the engine makes that impossible by construction, and the practice
     * improves for free every time the engine does. test-practice.js asserts the absence of the field.
     *
     * EVERY ROW IS WORKED IN THE ROUND, with no turning chain, and that is not decoration. The engine
     * counts a turning chain into the row's yield - correct for a dc row, surprising for an sc one -
     * and a practice question is the wrong place to meet a convention argument. A round row has one
     * defensible answer and the engine gives it.
     *
     * `available` must equal what the instruction actually consumes: a row that uses fewer stitches
     * than it is handed does not validate at all, and the suite checks every entry.
     */
    const PRACTICE_ROWS = [
        { id: 'ring-six', tier: 1, available: 0,
          instruction: '6 sc in magic ring',
          teaches: 'A magic ring starts from nothing, so the round makes exactly as many stitches as it works.' },
        { id: 'plain-round', tier: 1, available: 18,
          instruction: 'sc in each st around',
          teaches: 'One stitch worked into each stitch keeps the count exactly where it was.' },
        { id: 'inc-every', tier: 1, available: 6,
          instruction: 'inc in each st around',
          teaches: 'An increase works twice into one stitch, so increasing into every stitch doubles the round.' },
        { id: 'two-into-each', tier: 1, available: 6,
          instruction: '2 sc in each st around',
          teaches: 'Two stitches into each stitch is the same thing an increase names, written out in full.' },
        { id: 'inc-every-other', tier: 1, available: 12,
          instruction: '[1 sc, inc] * 6',
          teaches: 'Six repeats with one increase each add six stitches - the plain stitches beside them change nothing.' },
        { id: 'inc-every-third', tier: 1, available: 18,
          instruction: '[2 sc, inc] * 6',
          teaches: 'The repeat grew but the number of increases did not, so the round still gains six.' },
        { id: 'ring-nine', tier: 1, available: 0,
          instruction: '9 sc in magic ring',
          teaches: 'A ring makes whatever it is told to make - six is a convention, not a rule.' },
        { id: 'slst-round', tier: 1, available: 14,
          instruction: 'sl st in each st around',
          teaches: 'A slip stitch is still a stitch: it works one into one and leaves the count alone.' },
        { id: 'dec-every-third', tier: 1, available: 15,
          instruction: '[sc, dec] * 5',
          teaches: 'Each repeat takes three stitches and gives back two, so a third of the round goes.' },
        { id: 'inc-four-in-sixteen', tier: 1, available: 16,
          instruction: '[3 sc, inc] * 4',
          teaches: 'Four repeats, four increases. Read the number after the bracket, not the stitches inside it.' },
        { id: 'inc-every-fourth', tier: 2, available: 24,
          instruction: '[3 sc, inc] * 6',
          teaches: 'A flat circle adds the same six every round; only the plain run between them lengthens.' },
        { id: 'inc-every-fifth', tier: 2, available: 30,
          instruction: '[4 sc, inc] * 6',
          teaches: 'Count the repeats, not the stitches: six repeats, six increases, six stitches gained.' },
        { id: 'dec-every-sixth', tier: 2, available: 36,
          instruction: '[4 sc, dec] * 6',
          teaches: 'A decrease works two stitches together into one, so each repeat gives one stitch back.' },
        { id: 'dec-every-fourth', tier: 2, available: 20,
          instruction: '[2 sc, dec] * 5',
          teaches: 'Five repeats, five decreases: the round loses five however long the repeat is.' },
        { id: 'dec-eighth', tier: 2, available: 48,
          instruction: '[6 sc, dec] * 6',
          teaches: 'Closing a sphere is the increase rounds run backwards, one repeat at a time.' },
        { id: 'flat-foundation', tier: 2, available: 0,
          instruction: 'ch 20, sc in 2nd ch from hook and in each ch across',
          teaches: 'A flat row starts one short: the first chain is the turn, and nothing is worked into it.' },
        { id: 'dec-all-eleven', tier: 2, available: 22,
          instruction: '[dec] * 11',
          teaches: 'Nothing but decreases takes two stitches for every one it leaves, so the row halves.' },
        { id: 'inc-eleven', tier: 2, available: 22,
          instruction: '[sc, inc] * 11',
          teaches: 'Eleven repeats and eleven increases on an odd round - the count does not have to be even.' },
        { id: 'dec-seven-run', tier: 2, available: 45,
          instruction: '[7 sc, dec] * 5',
          teaches: 'A long plain run between decreases changes nothing: five repeats still lose five.' },
        { id: 'dec-nine', tier: 3, available: 45,
          instruction: '[3 sc, dec] * 9',
          teaches: 'Nine repeats is nine decreases. The repeat count is what sets the change, not the stitch count.' },
        { id: 'sc2tog-long', tier: 3, available: 32,
          instruction: '[sc in next 2 sts, sc2tog] * 8',
          teaches: 'sc2tog is dec written the long way, and it eats two stitches to make one.' },
        { id: 'sc2tog-four', tier: 3, available: 20,
          instruction: '[sc in next 3 sts, sc2tog] * 4',
          teaches: 'Each repeat here consumes five stitches and produces four.' },
        { id: 'dc-inc', tier: 3, available: 12,
          instruction: '[dc in next st, 2 dc in next st] * 6',
          teaches: 'Taller stitches increase the same way single crochet does - height changes nothing about the count.' },
        { id: 'hdc-inc', tier: 3, available: 16,
          instruction: '[hdc in next st, 2 hdc in next st] * 8',
          teaches: 'Eight repeats, one extra stitch in each: half double crochet counts like everything else.' },
        { id: 'inc-double', tier: 3, available: 18,
          instruction: '[sc in next st, inc] * 9',
          teaches: 'Nine increases in a round of eighteen is half the stitches doubled, so it gains nine.' },
        { id: 'dc2tog-thirteen', tier: 3, available: 26,
          instruction: '[dc2tog] * 13',
          teaches: 'Height changes nothing about a decrease: thirteen of them leave thirteen stitches.' },
        { id: 'sc3tog-five', tier: 3, available: 35,
          instruction: '[sc in next 4 sts, sc3tog] * 5',
          teaches: 'sc3tog eats three stitches and leaves one, so each repeat spends seven and makes five.' },
        { id: 'post-rib', tier: 3, available: 26,
          instruction: '[fpdc, bpdc] * 13',
          teaches: 'Ribbing is worked around the posts rather than into the tops, and it still counts one for one.' },
        { id: 'three-into-one', tier: 3, available: 16,
          instruction: '[sc in next st, 3 sc in next st] * 8',
          teaches: 'Three into one stitch adds two, not three - one of them replaces the stitch it stands in.' },
        { id: 'inc-five', tier: 4, available: 30,
          instruction: '[5 sc, inc] * 5',
          teaches: 'Five repeats of six stitches uses all thirty and returns thirty-five - the repeat count rules.' },
        { id: 'dc2tog-all', tier: 4, available: 16,
          instruction: '[dc2tog] * 8',
          teaches: 'Nothing but decreases: every repeat takes two stitches and leaves one, so the round halves.' },
        { id: 'tr-inc', tier: 4, available: 8,
          instruction: '[tr in next st, 2 tr in next st] * 4',
          teaches: 'Treble crochet increases exactly like the rest; four repeats gain four.' },
        { id: 'mesh-round', tier: 4, available: 12,
          instruction: '[sc, ch 1, sk next st] * 6',
          teaches: 'A skipped stitch is consumed without being worked, and the chain beside it fills the gap.' },
        { id: 'dec-eight-run', tier: 4, available: 40,
          instruction: '[8 sc, dec] * 4',
          teaches: 'A long plain run hides how little is happening: four repeats, four stitches lost.' },
        { id: 'popcorn-alt', tier: 4, available: 28,
          instruction: '[popcorn in next st, sc in next st] * 14',
          teaches: 'A popcorn is several stitches gathered into one, and one is what it counts as.' },
        { id: 'spike-run', tier: 4, available: 20,
          instruction: '[spike in next st, sc in next 3 sts] * 5',
          teaches: 'A spike reaches down into an earlier row but still uses the one stitch below it.' },
        { id: 'dec-five-run', tier: 4, available: 56,
          instruction: '[sc in next 5 sts, dec] * 8',
          teaches: 'Eight repeats of seven stitches spends all fifty-six and returns forty-eight.' },
        { id: 'inc-eleven-run', tier: 4, available: 48,
          instruction: '[11 sc, inc] * 4',
          teaches: 'Twelve worked, thirteen made, four times over - the far end of a flat circle.' },
        { id: 'dtr-inc-seven', tier: 4, available: 14,
          instruction: '[dtr in next st, 2 dtr in next st] * 7',
          teaches: 'The tallest stitch in the book increases exactly like the shortest one does.' }
    ];

    /* A correct answer is worth about what a swatch is. Deliberately modest: the reason to do this is
       to find out whether you can read the row, and pricing it higher would make it a chore to farm. */
    const PRACTICE_POINTS = 20;

    const PRACTICE_TIERS = 4;

    /** Which tiers today's draw may reach. The ladder is the collection, because how many stitches
     *  somebody has actually worked is the only evidence in the store of how far along they are - a
     *  points total measures how much they have done, not how much they know. */
    function practiceCeiling(progress) {
        const pool = rollPool();
        if (!pool.length) return 1;
        const collected = pool.filter(entry => progress.collection[entry.token]).length;
        const share = collected / pool.length;
        return Math.max(1, Math.min(PRACTICE_TIERS, Math.floor(share * PRACTICE_TIERS) + 1));
    }

    /** Whole days since the epoch, from a YYYY-MM-DD stamp. The deck below is dealt against this
     *  rather than against a hash, so consecutive days are consecutive slots. */
    function dayNumber(stamp) {
        return Math.floor(Date.parse(stamp + 'T00:00:00Z') / 86400000);
    }

    /** The answer to a row, memoised. practiceAnswer goes to the engine every time by design; this
     *  is the same figure, kept because the deal below asks for every row's answer at once and the
     *  table does not change while the page is open. Keyed by id, so a row edited in the source is a
     *  different key the next time the file loads. */
    const practiceAnswerCache = {};
    function practiceAnswerOf(row) {
        if (practiceAnswerCache[row.id] === undefined) {
            practiceAnswerCache[row.id] = practiceAnswer(row);
        }
        return practiceAnswerCache[row.id];
    }

    /**
     * The day's row: a dealt deck, not a fresh coin toss every morning.
     *
     * It used to be `pool[hash(date) % pool.length]`, which is memoryless - nothing stopped two days
     * running from drawing the same row, and at tier 1 the pool is six rows, so they often did. Worse,
     * rows that are NOT the same can have the same answer: at tier 1 both "sc in each st around" over
     * eighteen and "[1 sc, inc] * 6" over twelve come to 18, and a run of four days all answering 18
     * is what this replaces. A question whose answer you can guess from yesterday is not a question.
     *
     * So: shuffle the pool once per cycle of pool.length days and deal one card a day. Every row comes
     * up exactly once per cycle, and two passes fix the two seams a shuffle alone leaves - a deck whose
     * first card repeats the last deck's, and neighbours that differ as rows but agree as answers.
     *
     * Still decided by the date and the designer's own ceiling alone, so the same day gives the same
     * row on every device and a reload is not a second draw. Same guarantee it always had; nothing
     * here reads or writes what was actually served.
     */
    function practiceDraw(progress) {
        const ceiling = practiceCeiling(progress);
        const open = PRACTICE_ROWS.filter(row => row.tier <= ceiling);
        const pool = open.length ? open : PRACTICE_ROWS;
        if (pool.length < 2) return pool[0];

        const day = dayNumber(today());
        const size = pool.length;
        // Math.floor, not a truncation: day is positive for every date this app will see, but a
        // negative cycle index would still deal a valid deck rather than reversing the arithmetic.
        const cycle = Math.floor(day / size);
        const slot = ((day % size) + size) % size;
        return practiceDeck(pool, cycle)[slot];
    }

    /**
     * One cycle's deck: shuffle, then DEAL - lay the cards out one at a time, never putting an answer
     * next to the same answer.
     *
     * Two earlier attempts are worth naming, because both look right and neither is.
     *
     * A repair pass over a finished shuffle cannot work: a swap that fixes a collision can only look
     * forward, so a collision landing on the LAST card has nothing left to swap with and survives.
     *
     * Dealing "the first card that is not the answer before it" cannot work either, for the mirror
     * reason: it spends the answers that are easy to place and strands the duplicates. Tier 1 holds
     * two rows answering 18 and two answering 12; leave one 18 to the end and the card before it is
     * whatever was left, which is the other 18 half the time.
     *
     * So the rule is "the first card carrying the answer with the MOST copies still to place, that is
     * not the answer before it" - spend the crowded answers while there is still room to separate
     * them. That is the standard reorganise-a-string greedy, and it finds a valid layout whenever one
     * exists. The fallback takes whatever is left rather than looping, for a pool where none does.
     *
     * Deterministic in (pool, cycle) and nothing else, which is what keeps two devices in step.
     */
    function practiceDeck(pool, cycle) {
        let answerOf;
        try {
            // Warm the cache before anything depends on it, so a missing engine fails here - where a
            // plain shuffle is still a decent deck - rather than halfway through the deal.
            pool.forEach(practiceAnswerOf);
            answerOf = practiceAnswerOf;
        } catch (err) {
            return practiceShuffle(pool, cycle);   // an unrepeated row still beats a repeated one
        }

        // What the day before this deck answered, so the seam between cycles is dealt like any other
        // position. The previous deck is laid out without ITS predecessor - carrying the chain back
        // would recurse a cycle at a time to the epoch - which makes its first card occasionally not
        // the one that cycle really served. Its LAST card, the only one read here, is unaffected in
        // every arrangement this pool produces; and were it ever wrong, being wrong can only avoid a
        // collision that was not there.
        const before = practiceLay(pool, cycle - 1, null, answerOf);
        const previous = before.length ? answerOf(before[before.length - 1]) : null;
        return practiceLay(pool, cycle, previous, answerOf);
    }

    /** The deal itself. `previous` is the answer this deck must not open with, or null. */
    function practiceLay(pool, cycle, previous, answerOf) {
        const remaining = practiceShuffle(pool, cycle);
        const dealt = [];
        while (remaining.length) {
            // How many of each answer are still to place, recounted every card - cheap at this size,
            // and the counts are what the choice below turns on.
            const left = {};
            remaining.forEach(row => { left[answerOf(row)] = (left[answerOf(row)] || 0) + 1; });
            let pick = -1;
            for (let i = 0; i < remaining.length; i++) {
                if (answerOf(remaining[i]) === previous) continue;
                if (pick === -1 || left[answerOf(remaining[i])] > left[answerOf(remaining[pick])]) pick = i;
            }
            if (pick === -1) pick = 0;
            previous = answerOf(remaining[pick]);
            dealt.push(remaining.splice(pick, 1)[0]);
        }
        return dealt;
    }

    /** Fisher-Yates over a copy, driven by a small LCG re-seeded from the cycle number. hashString
     *  alone gives one number and the shuffle needs pool.length of them; stepping the LCG is how one
     *  seed becomes a sequence. */
    function practiceShuffle(pool, cycle) {
        const deck = pool.slice();
        let seed = hashString(cycle + '#practice') || 1;
        const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
        for (let i = deck.length - 1; i > 0; i--) {
            const j = next() % (i + 1);
            const swap = deck[i]; deck[i] = deck[j]; deck[j] = swap;
        }
        return deck;
    }

    function practiceRowById(id) {
        return PRACTICE_ROWS.find(row => row.id === id) || null;
    }

    /** Draws today's row the first time the day is seen, then holds it - so answering, navigating away
     *  and coming back is the same question. Drawing is not work, so this write does not touch the
     *  streak: opening the app on a new day must not start one. */
    function ensurePractice() {
        const progress = readProgress();
        if (progress.practice.date === today() && progress.practice.rowId) return progress;
        writeProgress(store => {
            store.practice = {
                date: today(), rowId: practiceDraw(store).id,
                answered: false, given: 0, correct: false, met: false
            };
        });
        return readProgress();
    }

    /**
     * THE ANSWER, AND THE ONE RULE THIS FILE MUST NOT BREAK.
     *
     * It comes back from the engine, every single time, and is never read off the row. expectedYield
     * is passed as 0 so evaluateStep reports its own arithmetic rather than judging it against a
     * figure we supplied - the question is what the row makes, and the engine is the only thing here
     * entitled to say.
     */
    function practiceAnswer(row) {
        const evaluation = window.CrochetMathEngine.evaluateStep(
            0,                  // initialChain
            row.available,      // availableStitches
            row.instruction,    // instructionString
            1,                  // rowMultiplier
            0,                  // expectedYield - 0 so the engine reports rather than judges
            0,                  // availableCorners
            0                   // unstatedSkip
        );
        return evaluation.calculatedYield;
    }

    /** One attempt at today's row. No second try: the point is the thinking, not the guessing, and a
     *  box that keeps taking numbers until one of them is right teaches nothing at all. */
    function checkPracticeAnswer() {
        const progress = ensurePractice();
        if (progress.practice.answered) return;
        const row = practiceRowById(progress.practice.rowId);
        const box = UI['practice-answer'];
        if (!row || !box) return;

        const given = Number(box.value);
        if (String(box.value).trim() === '' || !Number.isFinite(given)) {
            setText('practice-verdict', 'Type a number first.');
            return;
        }

        const right = given === practiceAnswer(row);
        writeProgress(store => {
            store.practice.answered = true;
            store.practice.given = given;
            store.practice.correct = right;
            if (right) store.points += PRACTICE_POINTS;
            // Right or wrong. Reading the row and committing to a number is the work; being wrong
            // about it is most of how anybody learns to read one.
            recordWork(store);
        });
        renderPractice();
    }

    /** Slot B. Credits the rolled stitch to the collection without a pattern - the roll's own payout
     *  still needs one compiled clean, so this records the DOING rather than the writing, and pays
     *  nothing on its own. */
    function markStitchWorked() {
        const progress = ensurePractice();
        if (progress.practice.met) return;
        const token = ensureRoll().roll.stitch;
        if (!token) return;
        writeProgress(store => {
            store.practice.met = true;
            if (!store.collection[token]) store.collection[token] = today();
            recordWork(store);
        });
        renderPractice();
        renderCabinet();
    }

    // ---- Rendering the practice panel ----------------------------------------
    function renderPractice() {
        // Both, and both before anything is read. The roll used to be ensured only by the Dashboard,
        // which meant opening Practice first thing on a new day drew today's practice row beside
        // yesterday's stitch. Each is a no-op once the day has been seen.
        ensurePractice();
        ensureRoll();
        const progress = readProgress();
        renderStreakDots(progress);
        renderPracticeRow(progress);
        renderRollSlot(progress);
        renderSwatchSlot(progress);
    }

    /** Seven days as they happened. `rested` is a day covered by the bank, which is a different fact
     *  from having worked it and is drawn as a different dot. */
    function renderStreakDots(progress) {
        const host = shellEl('streak-dots');
        if (!host) return;
        const dots = streakDots(progress);
        host.replaceChildren();
        dots.forEach(day => {
            const dot = elem('span', `streak-dot is-${day.kind}`);
            dot.setAttribute('title', `${day.date}: ${day.kind}`);
            host.appendChild(dot);
        });

        const banked = progress.restDays;
        const run = progress.streak === 0 ? 'No streak yet'
            : progress.streak === 1 ? '1 day streak'
            : `${progress.streak} day streak`;
        setText('streak-dots-note', banked
            ? `${run} · ${banked} rest ${banked === 1 ? 'day' : 'days'} banked`
            : run);
    }

    function renderPracticeRow(progress) {
        const row = practiceRowById(progress.practice.rowId);
        if (!row) return;
        const done = progress.practice.answered;

        setText('practice-read-state', done ? 'Done today' : 'Not done today');
        // Nothing in hand used to mean a magic ring, because every row starting from nothing was one.
        // flat-foundation is not: it starts from a chain, and telling a beginner they are working into
        // a ring when the row in front of them says "ch 20" teaches the wrong thing about both.
        setText('practice-available', row.available
            ? `You have ${row.available} stitches.`
            : `You are starting from ${/magic ring/.test(row.instruction) ? 'a magic ring' : 'a foundation chain'}`
              + ', with nothing to work into yet.');
        setText('practice-instruction', row.instruction);

        const box = UI['practice-answer'];
        if (box) {
            if (done) box.value = String(progress.practice.given);
            box.disabled = done;
        }
        const check = UI['practice-check'];
        if (check) check.disabled = done;

        if (!done) {
            setText('practice-verdict', '');
            setText('practice-teaches', '');
            return;
        }
        // The engine's working is shown whether the answer was right or wrong. A wrong answer is the
        // moment somebody is most willing to read the explanation, and spending it on a red cross
        // throws that away.
        const answer = practiceAnswer(row);
        setText('practice-verdict', progress.practice.correct
            ? `Yes - ${answer} stitches. +${PRACTICE_POINTS} Stitch Points.`
            : `Not quite. It makes ${answer} stitches, not ${progress.practice.given}.`);
        setText('practice-teaches', row.teaches);
    }

    function renderRollSlot(progress) {
        const roll = describeRoll(progress);
        setText('roll-stitch', roll.token);
        setText('roll-term', roll.term);
        setText('roll-tier', roll.isNew ? `${roll.tier} · New` : roll.tier);
        setTierTone('roll-tier', roll.weight);
        setText('roll-reward', roll.claimed
            ? `+${roll.reward} Stitch Points earned today`
            : `+${roll.reward} Stitch Points`);
        setText('roll-note', roll.claimed
            ? 'Worked today. A new stitch is drawn tomorrow.'
            : roll.isNew
                ? `You have never worked this one - it pays ${DISCOVERY_BONUS} extra.`
                : 'Work it into a pattern that compiles clean.');

        const reroll = shellEl('roll-again');
        if (reroll) {
            const left = REROLLS_PER_DAY - progress.roll.rerolls;
            reroll.disabled = !canReroll(progress);
            reroll.textContent = roll.claimed ? 'Claimed'
                : left <= 0 ? 'No re-rolls left today'
                : `Re-roll · ${left} left today`;
        }

        const worked = shellEl('roll-worked');
        if (worked) {
            const met = progress.practice.met;
            worked.disabled = met;
            worked.textContent = met ? 'Added to your cabinet' : "I've worked this";
        }
    }

    function renderSwatchSlot(progress) {
        const done = progress.lastSwatch === today();
        setText('practice-swatch-state', done ? 'Done today' : 'Not done today');
        setText('practice-swatch-note', done
            ? 'Logged today. The gauge every count in your pattern is measured against is current.'
            : 'Measure a square and write down what it came to. It is the one step every pattern depends on and almost nobody takes.');
    }

    // ---- The stitch cabinet --------------------------------------------------
    /*
     * What progress.collection has been recording all along, as something you can look at. It rendered
     * as a single progress bar before, and a collection you cannot browse is not a collection - the
     * pull comes from seeing the holes.
     *
     * Locked cards show the abbreviation and nothing else: enough to know something is missing, not
     * enough to be a stitch dictionary nobody earned.
     */
    function renderCabinet() {
        const host = shellEl('cabinet-grid');
        if (!host) return;
        const progress = readProgress();
        const pool = rollPool();
        const collected = pool.filter(entry => progress.collection[entry.token]).length;

        setText('cabinet-count', `${collected} of ${pool.length} stitches worked`);

        host.replaceChildren();
        pool.forEach(entry => {
            const when = progress.collection[entry.token];
            const has = !!when;
            const card = elem('div', `cabinet-card ${has ? 'is-open' : 'is-locked'}`,
                null, `cabinet-${entry.token}`);

            card.appendChild(elem('strong', 'cabinet-abbr', entry.token));
            if (has) {
                card.appendChild(elem('span', 'cabinet-term', stitchTermFor(entry.token)));
                const tier = elem('span', `cabinet-tier tier-${entry.weight}`,
                    ROLL_TIERS[entry.weight].name);
                card.appendChild(tier);
                // A date only where there is one to show: a stitch collected before the cabinet
                // existed was stored as `true`, and inventing a day for it would be inventing a fact.
                if (when !== true && typeof when === 'string') {
                    card.appendChild(elem('span', 'cabinet-when', `First worked ${when}`));
                }
            } else {
                card.appendChild(elem('span', 'cabinet-term', 'Not worked yet'));
            }
            host.appendChild(card);
        });
    }

    // ---- Lessons -------------------------------------------------------------
    /*
     * The linter already emits a `lesson` on many findings - one general sentence on why a convention
     * matters. It appeared once and vanished.
     *
     * A lesson is recorded when the correction is APPLIED through the app's own control, and at no
     * other moment. Recording it when the finding appears would reward writing bad patterns;
     * recording it when the finding is dismissed would reward ignoring advice. Applying the fix is
     * the only event that means the lesson landed.
     *
     * No points. This is a record of understanding, and pricing it would turn it into something to
     * farm - which is exactly what it is not for.
     */
    function recordLesson(finding) {
        if (!finding || !finding.lesson || !finding.id) return;
        writeProgress(store => {
            // First time only. The date is when it was first understood, and a second acceptance of
            // the same correction does not move it.
            if (store.lessons[finding.id]) return false;
            store.lessons[finding.id] = today();
        });
        renderLessons();
    }

    /** Every lesson accepted, oldest first, with the sentence the linter used at the time. The text is
     *  looked up from the engine's current fixes where it can be, so a reworded lesson is not frozen
     *  in the store; the store holds the id and the date, which is all it should. */
    function renderLessons() {
        const host = shellEl('lessons-list');
        if (!host) return;
        const progress = readProgress();
        const ids = Object.keys(progress.lessons)
            .sort((a, b) => String(progress.lessons[a]).localeCompare(String(progress.lessons[b])));

        if (!ids.length) {
            host.innerHTML = emptyState(
                'Nothing yet. Accept a suggestion in the Pattern Linter and what it taught is recorded here.');
            return;
        }

        host.replaceChildren();
        ids.forEach(id => {
            const item = elem('div', 'lesson-item', null, `lesson-${id}`);
            item.appendChild(elem('p', 'lesson-text', lessonTextFor(id)));
            item.appendChild(elem('span', 'lesson-when', `First accepted ${progress.lessons[id]}`));
            host.appendChild(item);
        });
    }

    /*
     * The wording. Taken from the finding on screen whenever this fix is among them, so what is shown
     * is the linter's own current sentence rather than a copy.
     *
     * Nothing but the id and the date is stored, which is the whole reason for this lookup: a sentence
     * written into the store on the day it was earned would be the one thing in the app able to
     * contradict the linter it came from. The fallbacks below are summaries for the days when the
     * pattern on screen happens not to raise the finding again - shorter than the engine's, and never
     * pretending to be it.
     */
    function lessonTextFor(id) {
        const live = (state.linter.findings || []).find(finding => finding.id === id && finding.lesson);
        if (live) return live.lesson;
        // Matched by family, because several of these are generated with the offending term in the id -
        // `shorthand-2-sc`, `dialect-treble` - and there is one lesson behind each family.
        const family = Object.keys(LESSON_TEXT)
            .find(prefix => id === prefix || id.indexOf(prefix + '-') === 0);
        return family ? LESSON_TEXT[family] : id;
    }

    const LESSON_TEXT = {
        'unstated-skip-ordinal': 'A first row that skips a chain should say so: the reader cannot tell a '
            + 'deliberate skip from a miscount.',
        'repeat-shorthand': 'Bracket shorthand and the long form say the same thing. A pattern should '
            + 'pick one and hold to it.',
        'granny-growth': 'A granny square gains four clusters a round because each of its four corners '
            + 'adds two.',
        'increase-style-mixed': 'Stacked increases pile into columns and staggered ones lie flat. Which '
            + 'you want is a choice; mixing them by accident is not.',
        'shorthand': 'Standard abbreviations are what let a reader work a pattern from its key alone.',
        'dialect': 'US and UK crochet reuse each other\'s abbreviations for different stitches. Naming '
            + 'which system a pattern uses, and staying inside it, is what stops a reader working the '
            + 'wrong stitch throughout.'
    };

    // ---- Rank ----------------------------------------------------------------
    /* The level was a number with nothing attached; the title beside it was a word with nothing behind
       it. They are the same thing now. Ordered high to low so the first match wins. */
    const RANKS = [
        { from: 25, name: 'Master Designer' },
        { from: 17, name: 'Stitch Architect' },
        { from: 12, name: 'Gauge Whisperer' },
        { from: 8, name: 'Stitch Collector' },
        { from: 5, name: 'Pattern Explorer' },
        { from: 3, name: 'Row Counter' },
        { from: 1, name: 'Chain Starter' }
    ];

    function rankFor(level) {
        const rank = RANKS.find(entry => level >= entry.from);
        return (rank || RANKS[RANKS.length - 1]).name;
    }

    /** The rank above the one being worn, and how many levels away it is - or null at the top of the
     *  ladder, where there is nothing to count towards and saying so is more honest than inventing a
     *  target. RANKS runs high to low, so the next one up is the last entry the level has not reached. */
    function nextRankFor(level) {
        const ahead = RANKS.filter(entry => level < entry.from);
        if (!ahead.length) return null;
        const next = ahead[ahead.length - 1];
        return { name: next.name, levels: next.from - level };
    }

    function renderProgress() {
        const progress = readProgress();
        // Rank is a statement about work done, so it is computed from everything ever earned rather than
        // what is left in the purse. Spending is a choice about the balance, not an undoing of the writing
        // that earned it, and an XP bar that ran backwards after a re-roll would read as a bug.
        const lifetime = progress.points + progress.spent;
        const level = Math.floor(lifetime / POINTS_PER_LEVEL) + 1;
        const into = lifetime % POINTS_PER_LEVEL;

        /*
         * Rank, not currency.
         *
         * Points still drive levels and levels still drive rank; what they stopped being is a WALLET.
         * A balance on screen turns every reward into a price and every look at a different stitch
         * into a cost, which is the wrong lesson to teach a beginner about curiosity. The arithmetic
         * below is unchanged - only the display drops the figure.
         */
        const rank = rankFor(level);
        const ahead = nextRankFor(level);
        setText('points-total', rank);
        setBarWidth('points-bar', (into / POINTS_PER_LEVEL) * 100);
        setText('points-next', ahead
            ? `${ahead.levels} ${ahead.levels === 1 ? 'level' : 'levels'} to ${ahead.name}`
            : 'Top rank reached');
        // The record, not the balance: what the work was is more interesting than a score for it, and
        // it is the only place the lifetime figures reach the rail.
        setText('points-note', lifetime
            ? `${progress.projects} saved · ${progress.exports} exported · ${progress.stitches.toLocaleString()} stitches worked.`
            : 'Write, export or save a pattern to start earning.');

        setText('xp-title', rank);
        setText('xp-level', `Level ${level}`);
        setBarWidth('xp-bar', (into / POINTS_PER_LEVEL) * 100);
        setText('xp-count', `${into} / ${POINTS_PER_LEVEL} XP`);
        // "0 day streak" is not a streak, it is the absence of one, and reading it as a score of zero is
        // discouraging on a first visit.
        setText('streak-count', progress.streak === 0 ? 'No streak yet'
            : progress.streak === 1 ? '1 day streak'
            : `${progress.streak} day streak`);
        setText('streak-note', progress.streak > 1
            ? `×${streakMultiplier(progress.streak).toFixed(2).replace(/0$/, '')} on rolls`
            : 'Write daily');

        // Rows in the pattern currently open, on the status pill beside the level and the streak.
        // The same figure the Studio dashboard tile reads, and from the same place - this is a
        // count of what is loaded right now, not a lifetime total, so it falls to zero on New File
        // along with the pattern it describes.
        setText('row-count', state.patternSteps.length.toLocaleString());
    }

    // ---- Dashboard -----------------------------------------------------------
    function setText(id, value) {
        const el = shellEl(id);
        if (el) el.textContent = String(value);
    }

    function setHtml(id, value) {
        const el = shellEl(id);
        if (el) el.innerHTML = value;
    }

    /* Widths are assigned rather than written into markup: a computed number is the one thing a
       stylesheet cannot carry, and an inline style attribute in a template is how the rest of the app's
       styling used to leak back into its HTML. */
    function setBarWidth(id, percent) {
        const el = shellEl(id);
        if (!el) return;
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        el.style.width = `${clamped}%`;
    }

    /** Plain text out of an engine string that may carry markup. */
    function plainText(value) {
        return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /** The wall-clock moment, for a list where "3m ago" and "5m ago" would read as the same thing. */
    function clockWhen(savedAt) {
        if (!savedAt) return 'no date';
        try {
            return new Date(savedAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
            });
        } catch (err) {
            return new Date(savedAt).toISOString().slice(0, 16).replace('T', ' ');
        }
    }

    function relativeWhen(savedAt) {
        if (!savedAt) return 'no date recorded';
        const minutes = Math.round((Date.now() - savedAt) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.round(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.round(hours / 24)}d ago`;
    }

    function emptyState(message) {
        return `<p class="dash-empty">${escapeHtml(message)}</p>`;
    }

    /*
     * DASHBOARD SOURCES
     *   tiles / recent      saved projects store, state.patternSteps, state.grading
     *   findings / counts   state.analytics.lastPass (the row-by-row validation pass)
     *   health              state.analytics.health, as shown in Validation Results
     *   graph               calculatedYield per row from that same pass
     *   analytics           state.analytics.report
     *   sizes / schematics  computeSizeGrading()
     *   gauges              state.gaugeHistory
     * Anything without a source yet renders an empty state, never a placeholder figure.
     */
    function renderDashboard() {
        const saves = getLocalStorage(state.savedProjectsKey);
        const pass = state.analytics.lastPass;
        const health = state.analytics.health;
        const report = state.analytics.report;
        const history = state.gaugeHistory || [];
        const sizes = (state.sizeCount > 1) ? computeSizeGrading() : null;

        renderProgress();
        renderDashTiles(saves, pass, health, sizes);
        renderDashRecent(saves);
        renderDashCompiler(pass, health);
        renderDashQuest(pass);
        renderDashRecord();
        renderDashAnalytics(report, health);
        renderDashSizes(sizes);
        renderDashSchematics(sizes);
        renderDashGauges(history);
    }

    function renderDashTiles(saves, pass, health, sizes) {
        setText('tile-patterns-value', Object.keys(saves).length);
        setText('tile-compiler-value', pass ? pass.analytics.failedRowsCount : 0);
        setText('tile-sizer-value', sizes ? sizes.length : 0);
        setText('tile-studio-value', state.patternSteps.length);
        setText('tile-analytics-value', health ? `${health.score}%` : '—');
    }

    function renderDashRecent(saves) {
        const names = Object.keys(saves);
        if (!names.length) {
            setHtml('dash-recent', emptyState('No saved projects yet. Save one from Patterns and it will appear here.'));
            return;
        }
        const rows = names
            .map(name => ({ name, savedAt: Number(saves[name].savedAt) || 0, save: saves[name] }))
            .sort((a, b) => b.savedAt - a.savedAt)
            .slice(0, 4)
            .map(entry => {
                const lines = String(entry.save.rawText || '').split('\n').filter(line => line.trim()).length;
                return `<button type="button" class="recent-row" data-project="${escapeHtml(entry.name)}">
                    <svg class="ic recent-swatch" aria-hidden="true" focusable="false"><use href="#ic-yarn"></use></svg>
                    <span><span class="recent-name">${escapeHtml(entry.name)}</span><span class="recent-when">${escapeHtml(relativeWhen(entry.savedAt))}</span></span>
                    <span class="recent-rows">${lines} rows</span>
                </button>`;
            }).join('');
        setHtml('dash-recent', rows);
        wireRecentRows();
    }

    /* Built with innerHTML, so the buttons have to be found again to be wired. Reading them back by name
       keeps the click on the row that carries it. */
    function wireRecentRows() {
        const host = shellEl('dash-recent');
        if (!host || typeof host.querySelectorAll !== 'function') return;
        host.querySelectorAll('.recent-row').forEach(row => {
            row.addEventListener('click', () => {
                const name = row.dataset.project;
                if (!name || !UI['load-select']) return;
                UI['load-select'].value = name;
                handleLoadProject();
                // 'nav-compiler' was a retired id, so navigateTo bailed at its lookup and the row loaded
                // the project without ever leaving the dashboard. The compiler lives on the Studio tab -
                // the same target SHORTCUTS gives 'tile-compiler' and 'link-compiler'.
                navigateTo('nav-studio');
            });
        });
    }

    function renderDashCompiler(pass, health) {
        if (!pass || !pass.validation.rows.length) {
            setHtml('dash-findings', emptyState('No pattern compiled yet. Paste one into the Compiler to see its findings here.'));
            setHtml('dash-graph', '<p class="graph-empty">Nothing to plot yet.</p>');
            setText('dash-errors', 0);
            setText('dash-warnings', 0);
            setText('dash-passed', 0);
            setText('dash-health', '—');
            setBarWidth('dash-health-bar', 0);
            return;
        }

        setText('dash-errors', pass.analytics.failedRowsCount);
        setText('dash-warnings', pass.analytics.blockedRowsCount);
        setText('dash-passed', pass.analytics.passedRowsCount);
        setText('dash-health', health ? health.score : '—');
        setBarWidth('dash-health-bar', health ? health.score : 0);
        setHtml('dash-findings', findingsHtml(pass));
        setHtml('dash-graph', stitchGraphHtml(pass));
    }

    /** The first few things wrong with the pattern, in the order they occur. */
    function findingsHtml(pass) {
        const findings = [];
        pass.validation.rows.forEach(row => {
            if (findings.length >= 3) return;
            if (row.status === 'failed') {
                const detail = (row.evaluation.errorDetails || [])[0];
                findings.push({
                    kind: 'error', label: row.label,
                    detail: plainText(detail ? detail.message : row.evaluation.reason) || 'Row does not add up.'
                });
            } else if (row.status === 'blocked') {
                findings.push({
                    kind: 'warn', label: row.label,
                    detail: 'Cannot be checked until an earlier row is fixed.'
                });
            } else if ((row.evaluation.notes || []).length) {
                findings.push({ kind: 'warn', label: row.label, detail: plainText(row.evaluation.notes[0]) });
            }
        });

        if (!findings.length) {
            return `<div class="finding-row finding-ok">
                <span class="finding-head"><strong>All rows check out</strong><span class="finding-badge badge-ok">Clean</span></span>
                <p class="finding-detail">${pass.analytics.passedRowsCount} rows counted with no mismatch.</p>
            </div>`;
        }

        return findings.map(finding => {
            const tone = finding.kind === 'error' ? 'error' : 'warn';
            const word = finding.kind === 'error' ? 'Error' : 'Warning';
            return `<div class="finding-row finding-${tone}">
                <span class="finding-head"><strong>${escapeHtml(finding.label)}</strong><span class="finding-badge badge-${tone}">${word}</span></span>
                <p class="finding-detail">${escapeHtml(finding.detail)}</p>
            </div>`;
        }).join('');
    }

    /** Stitch count per worked row, as the pattern runs. Failing rows are marked. */
    function stitchGraphHtml(pass) {
        const points = pass.validation.rows
            .filter(row => row.status === 'valid' || row.status === 'failed' || row.status === 'blocked')
            .map(row => ({ value: row.evaluation.calculatedYield || 0, bad: row.status !== 'valid' }));

        if (points.length < 2) return '<p class="graph-empty">Two or more worked rows are needed to plot a line.</p>';

        const W = 300, H = 110, PAD = 8;
        const peak = Math.max.apply(null, points.map(p => p.value)) || 1;
        const stepX = (W - PAD * 2) / (points.length - 1);
        const place = (point, i) => ({
            x: PAD + stepX * i,
            y: H - PAD - ((point.value / peak) * (H - PAD * 2)),
            bad: point.bad
        });
        const placed = points.map(place);
        const line = placed.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const dots = placed.map(p =>
            `<circle class="graph-dot${p.bad ? ' graph-dot-bad' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.bad ? 4 : 2.6}"></circle>`
        ).join('');

        return `<svg class="graph-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stitch count per row, peak ${peak}">
            <line class="graph-axis" x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}"></line>
            <polyline class="graph-line" points="${line}"></polyline>${dots}
        </svg>`;
    }

    /**
     * The stitch roll card. Two things pay here and they pay separately: the roll, which is the gamble,
     * and the daily quest underneath it, which is not. A stitch nobody wants to work should cost the
     * designer a bonus, never the day.
     *
     * Order matters. The roll has to exist before it can be claimed, and be claimed before its reward can
     * be described - otherwise the card reports the reward as still owing at the moment it is paid.
     */
    function renderDashQuest(pass) {
        ensureRoll();
        checkStitchRoll(pass);
        const done = checkDailyQuest(pass);

        setText('quest-text', 'Compile a pattern without any errors');
        setText('quest-reward', `+${POINTS.quest} Stitch Points`);
        setText('quest-count', done ? '1 / 1' : '0 / 1');
        setBarWidth('quest-bar', done ? 100 : 0);

        // The roll lives on the Practice view now, and a compile that claims it happens wherever the
        // designer is standing. Panels are hidden rather than torn down, so redrawing one nobody is
        // looking at is the same cheap write it has always been.
        renderPractice();
    }

    /** The tier chip wears its rarity as a class, so the colour lives in the stylesheet. */
    function setTierTone(id, weight) {
        const el = shellEl(id);
        if (!el || !el.classList) return;
        [1, 2, 3, 4, 5].forEach(step => el.classList.remove(`tier-${step}`));
        el.classList.add(`tier-${weight}`);
    }

    /** Spins the reel once. Presentation only - the stitch is already decided - so it is a class the
     *  stylesheet animates and removes itself from, with a timer behind it for the headless case where no
     *  animation ever ends. */
    function startReel() {
        const reel = shellEl('roll-reel');
        if (!reel || !reel.classList) return;
        reel.classList.add('is-rolling');
        setTimeout(() => reel.classList.remove('is-rolling'), 900);
    }

    /** The lifetime record: what this browser has written, start to finish. Every figure comes from the
     *  progress store, which only counts work actually done - so an empty strip is an accurate report and
     *  not a missing one. */
    function renderDashRecord() {
        const progress = readProgress();
        // Counted against the roll pool rather than everything ever worked: the collection is the set of
        // stitches the app can ask for, and a chain the designer has laid ten thousand of is not one.
        const pool = rollPool();
        const collected = pool.filter(entry => progress.collection[entry.token]).length;
        const collectable = pool.length;

        setText('rec-patterns', progress.projects.toLocaleString());
        setText('rec-exports', progress.exports.toLocaleString());
        setText('rec-stitches', progress.stitches.toLocaleString());
        setText('rec-compiles', progress.compiles.toLocaleString());
        setText('rec-best', progress.bestStreak);
        setText('rec-collected', `${collected} / ${collectable}`);
        setBarWidth('rec-collection-bar', collectable ? (collected / collectable) * 100 : 0);
    }

    function renderDashAnalytics(report, health) {
        if (!report || !report.totalStitches) {
            setHtml('dash-analytics', emptyState('Validate a pattern to see its stitch total, difficulty and complexity.'));
            return;
        }
        const rows = [
            ['Total stitches', report.totalStitches.toLocaleString()],
            ['Difficulty', report.difficulty.level],
            ['Health score', health ? `${health.score} / 100` : '—']
        ].map(pair => `<div class="stat-line"><span>${escapeHtml(pair[0])}</span><strong>${escapeHtml(pair[1])}</strong></div>`);

        // Same three categories the Technical Complexity panel draws as bars, read from the same report -
        // percentages and counts, keyed by category.
        const complexity = report.complexity;
        if (complexity && complexity.total) {
            BARRED_CATEGORIES.forEach(key => {
                const pct = Math.round(complexity.percentages[key] || 0);
                rows.push(`<div class="stat-line"><span>${escapeHtml(COMPLEXITY_LABELS[key])}</span><strong>${pct}%</strong><span class="mini-track"><span class="mini-bar" data-pct="${pct}"></span></span></div>`);
            });
        }
        setHtml('dash-analytics', rows.join(''));
        applyMiniBars('dash-analytics');
    }

    /* The bar widths again, assigned after the markup lands rather than written into it. */
    function applyMiniBars(hostId) {
        const host = shellEl(hostId);
        if (!host || typeof host.querySelectorAll !== 'function') return;
        host.querySelectorAll('.mini-bar').forEach(bar => {
            bar.style.width = `${Math.max(0, Math.min(100, Number(bar.dataset.pct) || 0))}%`;
        });
    }

    function renderDashSizes(sizes) {
        if (!sizes || !sizes.length) {
            setHtml('dash-sizes', emptyState('This pattern is written for one size. A graded pattern - "ch 52 (56, 60)" - fills this in.'));
            return;
        }
        const body = sizes.map(size => `<tr>
            <td>${escapeHtml(size.label)}</td>
            <td>${size.stitches === null ? '—' : size.stitches}</td>
            <td>${size.allValid ? 'clean' : 'check'}</td>
        </tr>`).join('');
        setHtml('dash-sizes', `<div class="mini-scroll"><table class="mini-table">
            <thead><tr><th>Size</th><th>Widest row</th><th>Status</th></tr></thead>
            <tbody>${body}</tbody></table></div>`);
    }

    /**
     * A small non-interactive copy of the real schematic in #grade-schematic: same body outline, same
     * measurement rules, drawn from the same garment and point table (set in section 8). Built as a markup
     * string and read back with innerHTML - not by cloning the live SVG - because the live one is built
     * with appendChild, which the test stub cannot read through innerHTML. No hit targets: this card is a
     * preview, not a second place to work.
     */
    function schematicPreviewSvg(garment) {
        if (!garment || !garment.length) return '';
        const carried = SCHEMATIC_POINTS.filter(spot => garment.some(row => row.point === spot.point));
        if (!carried.length) return '';
        const lines = carried.map(spot => {
            const [x1, y1, x2, y2] = spot.line;
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="grade-schematic-rule"></line>`;
        }).join('');
        return `<svg class="grade-schematic-svg dash-schematic-svg" viewBox="0 0 300 260" role="img" aria-label="Garment schematic preview">
            <path d="${SCHEMATIC_BODY}" class="grade-schematic-body"></path>${lines}
        </svg>`;
    }

    function renderDashSchematics(sizes) {
        const garment = state.grading.lastGarment;
        if (!sizes || !sizes.length || !garment || !garment.length) {
            setHtml('dash-schematics', emptyState('A schematic is drawn once the grader has a base size and a size chart.'));
            return;
        }
        const preview = schematicPreviewSvg(garment);
        setHtml('dash-schematics', `<div class="dash-schematic-frame">${preview}</div>
            <div class="stat-line"><span>Sizes on the schematic</span><strong>${sizes.length}</strong></div>
            <div class="stat-line"><span>Base size</span><strong>${escapeHtml(sizes[0].label)}</strong></div>`);
    }

    function renderDashGauges(history) {
        if (!history.length) {
            setHtml('dash-gauges', emptyState('No swatches logged. Calculate a gauge and it is filed here.'));
            return;
        }
        setHtml('dash-gauges', history.slice(0, 3).map((entry, index) => {
            const weight = entry.yarnWeight || 'Unnamed yarn';
            const detail = `${entry.stitches || 0} sts × ${entry.rows || 0} rows = ${entry.width || 0}${entry.unit || 'in'}`;
            return `<div class="gauge-row">
                <svg class="ic gauge-dot" aria-hidden="true" focusable="false"><use href="#ic-swatch"></use></svg>
                <span><span class="gauge-name">${escapeHtml(weight)}</span><span class="gauge-detail">${escapeHtml(detail)}</span></span>
                ${index === 0 ? '<span class="gauge-flag">Current</span>' : '<span class="gauge-flag">Logged</span>'}
            </div>`;
        }).join(''));
    }

    /**
     * Registers the service worker, and only where one can exist.
     *
     * Deliberately silent about failure. A worker is an enhancement - the app is fully functional
     * without one - so a registration that does not take should cost the designer nothing and say
     * nothing. It genuinely cannot register from a file:// path, which is how the app is opened today,
     * and treating that as an error would put a message on screen every single load.
     *
     * An update IS worth mentioning, because the alternative is a designer running last week's build
     * for a fortnight without knowing. The offer is a toast rather than a forced reload: a reload in
     * the middle of writing a pattern is exactly the wrong moment to take the page away.
     */
    function registerServiceWorker() {
        if (!IS_BROWSER || !('serviceWorker' in navigator)) return;
        if (window.location.protocol === 'file:') return;

        navigator.serviceWorker.register('sw.js').then(registration => {
            registration.addEventListener('updatefound', () => {
                const incoming = registration.installing;
                if (!incoming) return;
                incoming.addEventListener('statechange', () => {
                    // 'installed' with a controller already present means this is a replacement rather
                    // than the first install - the only case worth telling anyone about.
                    if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
                        notify('A new version of Stitch Math is ready. Reload when you are at a good stopping point.');
                    }
                });
            });
        }).catch(() => { /* No worker, no message: the app works without one. */ });
    }

    /**
     * Adds the engine test harness back, on a developer's machine only.
     *
     * tests.js used to be a fifth <script> tag in index.html, which meant every customer downloaded
     * 22KB they never run and got window.RunMathTests on their global object - a development surface
     * in a shipped product. Deleting the tag outright would have cost the console harness, which is
     * genuinely useful while writing code.
     *
     * So the page no longer loads it and this does, on localhost and file:// alone. A build step will
     * make this unnecessary by simply not emitting the file; until one exists, the host is the only
     * honest signal available, and it errs the safe way - anything that is not plainly a dev origin
     * gets nothing.
     */
    function loadDevOnlyScripts() {
        if (!IS_BROWSER) return;
        const host = window.location.hostname;
        const isDev = window.location.protocol === 'file:'
            || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
        if (!isDev) return;
        const tag = document.createElement('script');
        tag.src = 'tests.js?v=' + APP_VERSION;
        document.head.appendChild(tag);
    }

    /* Installed before init so a throw inside init itself is still reported, rather than leaving the
       page blank with a silent console entry nobody opens. */
    installErrorHandlers();
    document.addEventListener('DOMContentLoaded', () => {
        init();
        // Both places the build number appears are set from the one constant, so they cannot disagree.
        [document.getElementById('app-version'), document.getElementById('about-version')]
            .forEach(el => { if (el) el.textContent = `v${APP_VERSION}`; });
        registerServiceWorker();
        loadDevOnlyScripts();
    });
})();