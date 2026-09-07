/**
 * Stitch Math - Advanced Unit Test Harness
 * Responsibility: Complete stress-testing of dictionaries, custom stitches, parsing logic, and suggestion algorithms.
 */

// === 1. COMPLEX PHRASING & EDGE CASE SUITE === //
const MathEngineTests = {
    phrasingTestCases: [
        {
            name: "Flat Multiplier Sequence",
            input: { initialChain: 0, availableStitches: 10, instructionString: "sc x 10", rowMultiplier: 1, expectedYield: 10 },
            expected: { costIsValid: true, calculatedYield: 10, hasReason: false }
        },
        {
            name: "Bracket Grouping (Amigurumi Style)",
            input: { initialChain: 0, availableStitches: 12, instructionString: "[sc, inc] x 6", rowMultiplier: 1, expectedYield: 18 },
            expected: { costIsValid: true, calculatedYield: 18, hasReason: false }
        },
        {
            name: "Physics Error: Over-consuming stitches",
            input: { initialChain: 0, availableStitches: 5, instructionString: "sc x 6", rowMultiplier: 1, expectedYield: 6 },
            expected: { costIsValid: false, calculatedYield: 6, hasReason: true, expectedSuggestionType: 'physics_overconsume' } 
        },
        {
            name: "Physics Error: Under-consuming stitches",
            input: { initialChain: 0, availableStitches: 10, instructionString: "sc x 8", rowMultiplier: 1, expectedYield: 8 },
            expected: { costIsValid: false, calculatedYield: 8, hasReason: true, expectedSuggestionType: 'physics_underconsume' }
        },
        {
            name: "Written Count Is Advisory, Not An Error",
            input: { initialChain: 0, availableStitches: 12, instructionString: "sc x 12", rowMultiplier: 1, expectedYield: 14 },
            expected: { costIsValid: true, calculatedYield: 12, hasReason: false, hasNote: true }
        },
        {
            name: "Syntax Error: Unknown Token Suggestion",
            input: { initialChain: 0, availableStitches: 10, instructionString: "sc x 5, mystitch, dc x 4", rowMultiplier: 1, expectedYield: 10 },
            expected: { costIsValid: false, calculatedYield: 9, hasReason: true, expectedSuggestionType: 'syntax' } 
        },
        {
            name: "Same Stitch Complex Extraction (Shell)",
            input: { initialChain: 0, availableStitches: 2, instructionString: "sk 1, 5 dc in next st", rowMultiplier: 1, expectedYield: 5 },
            expected: { costIsValid: true, calculatedYield: 5, hasReason: false }
        },
        {
            name: "Across Command (Dynamic multiplier based on pool)",
            input: { initialChain: 0, availableStitches: 14, instructionString: "sc in each st across", rowMultiplier: 1, expectedYield: 14 },
            expected: { costIsValid: true, calculatedYield: 14, hasReason: false }
        },
        {
            name: "Conversational Noise Words",
            input: { initialChain: 0, availableStitches: 6, instructionString: "skip the first st, then work 5 sc into the next sts", rowMultiplier: 1, expectedYield: 5 },
            expected: { costIsValid: true, calculatedYield: 5, hasReason: false }
        },
        {
            name: "Strict Magic Ring Boundary Exemption",
            input: { initialChain: 0, availableStitches: 0, instructionString: "magic ring 6 sc", rowMultiplier: 1, expectedYield: 6 },
            expected: { costIsValid: true, calculatedYield: 6, hasReason: false }
        },
        {
            name: "Foundation Stitches (fsc) Starter",
            input: { initialChain: 0, availableStitches: 0, instructionString: "fsc 15", rowMultiplier: 1, expectedYield: 15 },
            expected: { costIsValid: true, calculatedYield: 15, hasReason: false }
        },
        {
            name: "Sequential Flow: Foundation Row followed by Working Row",
            input: { initialChain: 0, availableStitches: 10, instructionString: "10 sc", rowMultiplier: 1, expectedYield: 10 },
            expected: { costIsValid: true, calculatedYield: 10, hasReason: false }
        },
        {
            name: "Nested Bracket Repeats (Amigurumi Sub-groups)",
            input: { initialChain: 0, availableStitches: 15, instructionString: "[sc, (inc, sc) x 2] x 3", rowMultiplier: 1, expectedYield: 21 },
            expected: { costIsValid: true, calculatedYield: 21, hasReason: false }
        },
        {
            name: "Context Aware 'To End' Calculation",
            input: { initialChain: 0, availableStitches: 10, instructionString: "2 sc, inc, sc to end", rowMultiplier: 1, expectedYield: 11 },
            expected: { costIsValid: true, calculatedYield: 11, hasReason: false }
        },
        {
            name: "Complex Modifiers (BLO, FLO, 3rd loop, Color Tags)",
            input: { initialChain: 0, availableStitches: 5, instructionString: "[cc1] 2 sc in blo, 2 hdc in flo, dc in 3rd loop", rowMultiplier: 1, expectedYield: 5 },
            expected: { costIsValid: true, calculatedYield: 5, hasReason: false }
        },
        {
            name: "Fixed-Count Decrease In Context (hdc3tog)",
            input: { initialChain: 0, availableStitches: 10, instructionString: "hdc3tog, hdc x 7", rowMultiplier: 1, expectedYield: 8 },
            expected: { costIsValid: true, calculatedYield: 8, hasReason: false }
        },
        {
            name: "Crossed Stitches Consume And Return Two",
            input: { initialChain: 0, availableStitches: 6, instructionString: "cross st x 3", rowMultiplier: 1, expectedYield: 6 },
            expected: { costIsValid: true, calculatedYield: 6, hasReason: false }
        },
        {
            name: "Picot Is Inert (adds nothing to the stitch count)",
            input: { initialChain: 0, availableStitches: 16, instructionString: "sc x 8, picot, sc x 8", rowMultiplier: 1, expectedYield: 16 },
            expected: { costIsValid: true, calculatedYield: 16, hasReason: false }
        },
        {
            name: "Mixed Complex Row (post + crossed + picot)",
            input: { initialChain: 0, availableStitches: 12, instructionString: "fpdc x 4, cross st x 2, picot, bpdc x 4", rowMultiplier: 1, expectedYield: 12 },
            expected: { costIsValid: true, calculatedYield: 12, hasReason: false }
        },
        {
            name: "Abbreviation Not Shadowed By Shorter Key (esc vs sc)",
            input: { initialChain: 0, availableStitches: 8, instructionString: "esc x 4, ssc x 4", rowMultiplier: 1, expectedYield: 8 },
            expected: { costIsValid: true, calculatedYield: 8, hasReason: false }
        },
        {
            name: "Foundation Row Idiom (ch N, sc in 2nd ch from hook)",
            input: { initialChain: 0, availableStitches: 0, instructionString: "ch 13, sc in 2nd ch from hook and in each ch across", rowMultiplier: 1, expectedYield: 12 },
            expected: { costIsValid: true, calculatedYield: 12, hasReason: false }
        },
        {
            name: "Foundation Row Idiom (dc skips 3 chains)",
            input: { initialChain: 0, availableStitches: 0, instructionString: "ch 20, dc in 4th ch from hook and in each ch across", rowMultiplier: 1, expectedYield: 17 },
            expected: { costIsValid: true, calculatedYield: 17, hasReason: false }
        },
        {
            name: "Leftmost Stitch Wins Over Incidental Chain Mention",
            input: { initialChain: 0, availableStitches: 24, instructionString: "[sc in next 3 sts/chs, inc in next st/ch] x 6", rowMultiplier: 1, expectedYield: 30 },
            expected: { costIsValid: true, calculatedYield: 30, hasReason: false }
        },
        {
            name: "Combined To-End Clause (each st and ch-1 sp across)",
            input: { initialChain: 0, availableStitches: 15, instructionString: "sc in each st and ch-1 sp across", rowMultiplier: 1, expectedYield: 15 },
            expected: { costIsValid: true, calculatedYield: 15, hasReason: false }
        },
        {
            name: "Cluster Worked Into One Stitch (3-dc cl)",
            input: { initialChain: 0, availableStitches: 15, instructionString: "[3-dc cl in next st, ch 1, sk 1 st, sc in next st] x 5", rowMultiplier: 1, expectedYield: 15 },
            expected: { costIsValid: true, calculatedYield: 15, hasReason: false }
        },
        {
            name: "Asterisk Repeat Across (fills the row)",
            input: { initialChain: 0, availableStitches: 36, instructionString: "*hdc in next 2 sts, hdc-inc in next st; repeat from * across", rowMultiplier: 1, expectedYield: 48 },
            expected: { costIsValid: true, calculatedYield: 48, hasReason: false }
        },
        {
            name: "Asterisk Repeat With Explicit Count (1 more time)",
            input: { initialChain: 0, availableStitches: 48, instructionString: "*(sc in next st/sp, [inc in next st/sp, sc in next 2 sts/sps] x 2) 3 times; repeat from * 1 more time, sc in last 6 sts/sps", rowMultiplier: 1, expectedYield: 60 },
            expected: { costIsValid: true, calculatedYield: 60, hasReason: false }
        },
        {
            name: "Asterisk Repeat To Last N Stitches",
            input: { initialChain: 0, availableStitches: 52, instructionString: "*sc in next 2 sts, (hdc, dc, hdc) in next st, sc in next 2 sts; repeat from * to last 2 sts, sc in last 2 sts", rowMultiplier: 1, expectedYield: 72 },
            expected: { costIsValid: true, calculatedYield: 72, hasReason: false }
        },
        {
            name: "Several Stitches Into One Stitch Cost Only One",
            input: { initialChain: 0, availableStitches: 5, instructionString: "sc in next 2 sts, (hdc, dc, hdc) in next st, sc in next 2 sts", rowMultiplier: 1, expectedYield: 7 },
            expected: { costIsValid: true, calculatedYield: 7, hasReason: false }
        },
        {
            name: "Asterisk Repeat Computes Its Own Count, Ignoring A Wrong Written One",
            input: { initialChain: 0, availableStitches: 36, instructionString: "*hdc in next 2 sts, hdc-inc in next st; repeat from * across", rowMultiplier: 1, expectedYield: 50 },
            expected: { costIsValid: true, calculatedYield: 48, hasReason: false, hasNote: true }
        },
        {
            name: "Matching Counts Produce No Note",
            input: { initialChain: 0, availableStitches: 12, instructionString: "sc x 12", rowMultiplier: 1, expectedYield: 12 },
            expected: { costIsValid: true, calculatedYield: 12, hasReason: false, hasNote: false }
        },
        {
            name: "Real Stitch-Pool Error Still Fails Despite An Advisory Count",
            input: { initialChain: 0, availableStitches: 12, instructionString: "sc x 20", rowMultiplier: 1, expectedYield: 20 },
            expected: { costIsValid: false, calculatedYield: 20, hasReason: true, expectedSuggestionType: 'physics_overconsume' }
        }
    ],

    // === 2. EXECUTION ENGINE === //
    runAll() {
        console.clear();
        console.log("%c🌴 STITCH MATH AUTOMATED TEST SUITE 🌴", "color: #57756a; font-weight: bold; font-size: 16px; padding: 10px 0;");
        
        let totalPassed = 0; let totalFailed = 0;

        console.group("%c1. Primitive Dictionary Exhaustion", "color: #373d3a; font-weight: bold; font-size: 14px;");
        const primitives = Object.keys(window.CrochetMathEngine.STITCH_PRIMITIVES);
        let dictPassed = 0; let dictFailed = 0;

        primitives.forEach(stitch => {
            const rules = window.CrochetMathEngine.STITCH_PRIMITIVES[stitch];
            const result = window.CrochetMathEngine.evaluateStep(0, rules.cost, stitch, 1, rules.yield);
            if (result.costIsValid && result.calculatedYield === rules.yield && !result.reason) { dictPassed++; totalPassed++; } 
            else { console.error(`[FAIL] Stitch '${stitch}' failed.`, result); dictFailed++; totalFailed++; }
        });
        if (dictFailed === 0) console.log(`%c[PASS] All ${primitives.length} dictionary primitives parsed accurately.`, "color: #57756a; font-weight: bold;");
        console.groupEnd();

        console.group("%c2. Custom Stitch Lifecycle", "color: #373d3a; font-weight: bold; font-size: 14px;");
        window.CrochetMathEngine.addCustomStitch('v-st', 1, 3);
        const customResult = window.CrochetMathEngine.evaluateStep(0, 5, "2 sc, v-st, 2 sc", 1, 7);
        if (customResult.costIsValid && customResult.calculatedYield === 7) { console.log("%c[PASS] Custom stitch added and parsed correctly.", "color: #57756a; font-weight: bold;"); totalPassed++; } 
        else { console.error("[FAIL] Custom stitch evaluation failed.", customResult); totalFailed++; }

        window.CrochetMathEngine.removeCustomStitch('v-st');
        if (!window.CrochetMathEngine.CUSTOM_STITCHES['v-st']) { console.log("%c[PASS] Custom stitch successfully garbage collected.", "color: #57756a; font-weight: bold;"); totalPassed++; } 
        else { console.error("[FAIL] Custom stitch failed to delete."); totalFailed++; }
        console.groupEnd();

        console.group("%c3. Complex Phrasing, Logic, & Suggestions", "color: #373d3a; font-weight: bold; font-size: 14px;");
        this.phrasingTestCases.forEach((test, index) => {
            const result = window.CrochetMathEngine.evaluateStep(test.input.initialChain, test.input.availableStitches, test.input.instructionString, test.input.rowMultiplier, test.input.expectedYield);
            const costMatch = result.costIsValid === test.expected.costIsValid;
            const yieldMatch = result.calculatedYield === test.expected.calculatedYield;
            const hasReason = (result.reason !== "") === test.expected.hasReason;
            let suggestionMatch = true;
            if (test.expected.expectedSuggestionType) { suggestionMatch = result.errorDetails.some(e => e.type === test.expected.expectedSuggestionType); }
            // Only asserted where the case declares it, so existing cases stay unaffected.
            const noteMatch = test.expected.hasNote === undefined
                || ((result.notes || []).length > 0) === test.expected.hasNote;

            if (costMatch && yieldMatch && hasReason && suggestionMatch && noteMatch) { console.log(`%c[PASS] Test ${index + 1}: ${test.name}`, "color: #57756a; font-weight: 500;"); totalPassed++; }
            else {
                console.groupCollapsed(`%c[FAIL] Test ${index + 1}: ${test.name}`, "color: #d48261; font-weight: bold;");
                console.log("Expected Output:", test.expected); console.log("Actual Engine Output:", result);
                console.groupEnd(); totalFailed++;
            }
        });
        console.groupEnd();

        const totalTests = totalPassed + totalFailed;
        console.log(`%c=== ENGINE TEST SUITE COMPLETE: ${totalPassed}/${totalTests} Tests Passed ===`, `color: ${totalFailed > 0 ? '#d48261' : '#57756a'}; font-weight: bold; font-size: 15px; margin-top: 15px; border-top: 2px solid ${totalFailed > 0 ? '#d48261' : '#57756a'}; padding-top: 10px;`);
    }
};

// === 3. PARSER TESTS === //
function RunParserTests() {
    const tests = [
        { input: "dc increase", expected: "dc-inc" }, { input: "dc inc", expected: "dc-inc" },
        { input: "dc decrease", expected: "dc2tog" }, { input: "skip 3", expected: "3sk" },
        { input: "sl st", expected: "slst" }, { input: "Sc Inc", expected: "sc-inc" },
        { input: "sc in the last 4 sts", expected: "4 sc" }, { input: "tr in final 2 stitches", expected: "2 tr" }
    ];
    let passed = 0;
    console.log("%c===== Parser Normalization Tests =====", "color: #373d3a; font-weight: bold; font-size: 14px; margin-top: 15px;");
    tests.forEach((test, i) => {
        const result = window.CrochetMathEngine.normalizeForTesting(test.input);
        if (result === test.expected) { passed++; console.log(`✅ ${i + 1}: "${test.input}" -> "${result}"`); } 
        else { console.error(`❌ ${i + 1}: "${test.input}"\nExpected: "${test.expected}"\nGot: "${result}"`); }
    });
    console.log(`%cParser Tests: ${passed}/${tests.length} passed`, "color: #57756a; font-weight: bold;");
}

// === 4. FAILURE FEEDBACK TESTS === //
// Every failing row must name the unknown word and offer a concrete next step.
function RunFeedbackTests() {
    const cases = [
        {
            name: "Short repeat suggests adding one",
            args: [0, 12, "[sc in next st, inc in next st]", 5, 18],
            expectFix: "Add 1 more repeat (x6 instead of x5) to complete the row.",
            expectUnknown: []
        },
        {
            name: "Long repeat suggests removing one",
            args: [0, 12, "[sc in next st, inc in next st]", 7, 18],
            expectFix: "Remove 1 repeat (x6 instead of x7) to fit the row.",
            expectUnknown: []
        },
        {
            name: "Unknown token is reported and isolated",
            args: [0, 12, "sc x 4, wibblestitch, dc x 4", 1, 18],
            expectFix: '"wibblestitch" is not in the stitch dictionary. Check the spelling, or add it under Custom Stitches with its cost and yield.',
            expectUnknown: ["wibblestitch"],
            expectFixCount: 1
        },
        {
            name: "Miscounted row is a note, not a fix",
            args: [0, 12, "sc in each st across", 1, 99],
            expectFix: null,
            expectUnknown: [],
            expectNote: "Written count 99, calculated 12 (-87). Stitch Math uses the calculated count."
        },
        {
            name: "Valid row offers no fixes",
            args: [0, 12, "sc x 12", 1, 12],
            expectFix: null,
            expectUnknown: []
        }
    ];

    let passed = 0;
    console.log("%c===== Failure Feedback Tests =====", "color: #373d3a; font-weight: bold; font-size: 14px; margin-top: 15px;");
    cases.forEach((test, i) => {
        const r = window.CrochetMathEngine.evaluateStep(...test.args);
        const fixes = r.resolutions || [];
        const unknown = r.unknownTokens || [];
        const notes = r.notes || [];

        const fixOk = test.expectFix === null ? fixes.length === 0 : fixes.includes(test.expectFix);
        const unknownOk = JSON.stringify(unknown) === JSON.stringify(test.expectUnknown);
        const countOk = test.expectFixCount === undefined || fixes.length === test.expectFixCount;
        const noteOk = test.expectNote === undefined || notes.includes(test.expectNote);

        if (fixOk && unknownOk && countOk && noteOk) { passed++; console.log(`✅ ${i + 1}: ${test.name}`); }
        else console.error(`❌ ${i + 1}: ${test.name}\nExpected fix: ${test.expectFix}\nGot fixes: ${JSON.stringify(fixes, null, 2)}\nGot notes: ${JSON.stringify(notes)}\nGot unknown: ${JSON.stringify(unknown)}`);
    });
    console.log(`%cFeedback Tests: ${passed}/${cases.length} passed`, "color: #57756a; font-weight: bold;");
}

// === 5. COMPLEXITY & DIAGNOSIS TESTS === //
function RunAnalyticsTests() {
    const A = window.CrochetAnalyticsEngine;
    const pct = (totals) => A.AnalyzeComplexity(totals).percentages;
    const sum = (o) => o.repetitive + o.texture + o.shaping + o.special;

    const cases = [
        { name: "All plain stitches read 100% repetitive", got: () => pct({ sc: 100 }).repetitive, want: 100 },
        { name: "Puffs read as texture", got: () => pct({ puff: 40 }).texture, want: 100 },
        { name: "Increases read as shaping", got: () => pct({ inc: 40 }).shaping, want: 100 },
        { name: "Foundation stitches read as special", got: () => pct({ fsc: 40 }).special, want: 100 },
        { name: "Post stitches are texture, not repetitive", got: () => pct({ fpdc: 10 }).texture, want: 100 },
        { name: "Mixed pattern splits by stitch share", got: () => JSON.stringify(pct({ sc: 82, puff: 10, inc: 6, picot: 2 })), want: JSON.stringify({ repetitive: 82, texture: 10, shaping: 6, special: 2 }) },
        { name: "Thirds still total exactly 100", got: () => sum(pct({ sc: 1, puff: 1, inc: 1 })), want: 100 },
        { name: "Repeating decimals still total 100", got: () => sum(pct({ sc: 7, puff: 7, inc: 7 })), want: 100 },
        { name: "Unknown stitches fall back to special", got: () => pct({ mysteryst: 5 }).special, want: 100 },
        { name: "Empty pattern is all zeros", got: () => sum(pct({})), want: 0 }
    ];

    // Ranked causes must never claim a precision the engine cannot support.
    const wrongRepeat = window.CrochetMathEngine.evaluateStep(0, 18, "[sc in next st, inc in next st] x 4", 1, 27);
    const typo = window.CrochetMathEngine.evaluateStep(0, 12, "sc x 4, wibblestitch, sc x 7", 1, 12);
    cases.push(
        { name: "Wrong repeat count is the top cause", got: () => (wrongRepeat.likelyCauses[0] || {}).cause, want: "Incorrect repeat count" },
        { name: "Unknown token is the top cause", got: () => (typo.likelyCauses[0] || {}).cause, want: "Typo or unknown stitch" },
        { name: "Exactly one MOST LIKELY tier", got: () => wrongRepeat.likelyCauses.filter(c => c.tier === 'MOST LIKELY').length, want: 1 },
        { name: "Every cause carries evidence", got: () => wrongRepeat.likelyCauses.every(c => c.evidence && c.evidence.length > 0), want: true },
        { name: "Causes never report percentages", got: () => /\d+%/.test(JSON.stringify(wrongRepeat.likelyCauses)), want: false },
        { name: "A valid row is given no causes", got: () => window.CrochetMathEngine.evaluateStep(0, 12, "sc x 12", 1, 12).likelyCauses.length, want: 0 }
    );

    let passed = 0;
    console.log("%c===== Complexity & Diagnosis Tests =====", "color: #373d3a; font-weight: bold; font-size: 14px; margin-top: 15px;");
    cases.forEach((test, i) => {
        let actual;
        try { actual = test.got(); } catch (e) { actual = `threw: ${e.message}`; }
        if (String(actual) === String(test.want)) { passed++; console.log(`✅ ${i + 1}: ${test.name}`); }
        else console.error(`❌ ${i + 1}: ${test.name}\nExpected: ${test.want}\nGot: ${actual}`);
    });
    console.log(`%cAnalytics Tests: ${passed}/${cases.length} passed`, "color: #57756a; font-weight: bold;");
}

window.RunMathTests = () => { MathEngineTests.runAll(); RunParserTests(); RunFeedbackTests(); RunAnalyticsTests(); };