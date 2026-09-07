/** Stitch Math - Yarn Yardage & Pattern Analytics Engine */
window.CrochetAnalyticsEngine = (() => {

    // === 1. YARN WEIGHT & STITCH CONSUMPTION DATA === //
    const BASE_INCHES_PER_STITCH = {
        'ch': 0.35, 'chain': 0.35, 'sl st': 0.25, 'slst': 0.25, 'slip stitch': 0.25,
        'sc': 0.55, 'single crochet': 0.55, 'hdc': 0.80, 'half double crochet': 0.80,
        'dc': 1.10, 'double crochet': 1.10, 'tr': 1.50, 'treble': 1.50, 'dtr': 1.90,
        'inc': 1.10, 'sc inc': 1.10, 'hdc inc': 1.60, 'dc inc': 2.20,
        'dec': 0.90, 'invdec': 0.90, 'sc2tog': 0.90, 'hdc2tog': 1.30, 'dc2tog': 1.80,
        'fpsc': 0.65, 'bpsc': 0.65, 'fpdc': 1.25, 'bpdc': 1.25,
        'puff': 3.20, 'popcorn': 4.50, 'pc': 4.50, 'bobble': 3.80, 'cluster': 3.00, 'cl': 3.00,
        'fsc': 0.85, 'fhdc': 1.15, 'fdc': 1.50, 'ftr': 1.95, 'sk': 0, 'skip': 0
    };

    // Derived from the engine's one table of CYC categories, so a weight cannot be known to the parser
    // and unknown to the yardage estimate. Category 0 was once absent here while the dropdown still
    // offered it, and every lace pattern fell through the `|| [4]` default and was costed as Worsted -
    // roughly double, silently.
    const YARN_WEIGHT_MULTIPLIERS = Object.fromEntries(
        window.CrochetMathEngine.CYC_YARN_CATEGORIES.map(
            ({ n, name, scale, avgSkeinYards }) => [n, { name, scale, avgSkeinYards }]));

    // === 1b. CYC BODY MEASUREMENT CHARTS === //
    // Craft Yarn Council Standards & Guidelines, printed pp. 15-21 (PDF 17-23; the booklet's page
    // numbers run two lower). Every value is an ACTUAL BODY measurement in inches, not a finished
    // one - the difference is the ease, which is the point of the matching below. Single-number
    // sizes carry min === max, so one comparison path serves all six charts.
    const inches = (min, max) => ({ min, max: max === undefined ? min : max });

    const MEASUREMENT_POINTS = [
        'chest', 'backNeckToWrist', 'backLength', 'crossBack',
        'armLength', 'upperArm', 'armholeDepth', 'waist', 'hip'
    ];

    const MEASUREMENT_LABELS = {
        chest: 'Chest / Bust', backNeckToWrist: 'Center Back Neck-to-Wrist',
        backLength: 'Back Length', crossBack: 'Cross Back (shoulder to shoulder)',
        armLength: 'Arm Length to Underarm', upperArm: 'Upper Arm',
        armholeDepth: 'Armhole Depth', waist: 'Waist', hip: 'Hip',
        headCircumference: 'Head Circumference',
        handCircumference: 'Hand Circumference', handLength: 'Hand Length',
        footCircumference: 'Foot Circumference', sockHeight: 'Sock Height',
        footLength: 'Total Foot Length'
    };

    const CYC_BODY_MEASUREMENTS = {
        baby: {
            label: "Baby", measure: 'chest', measureKey: 'chest',
            backLengthLabel: 'Back Waist Length',
            sizes: [
                ['3 months', { chest: inches(16), backNeckToWrist: inches(10.5), backLength: inches(6), crossBack: inches(7.25), armLength: inches(6), upperArm: inches(5.5), armholeDepth: inches(3.25), waist: inches(18), hip: inches(19) }],
                ['6 months', { chest: inches(17), backNeckToWrist: inches(11.5), backLength: inches(7), crossBack: inches(7.75), armLength: inches(6.5), upperArm: inches(6), armholeDepth: inches(3.5), waist: inches(19), hip: inches(20) }],
                ['12 months', { chest: inches(18), backNeckToWrist: inches(12.5), backLength: inches(7.5), crossBack: inches(8.25), armLength: inches(7.5), upperArm: inches(6.5), armholeDepth: inches(3.75), waist: inches(20), hip: inches(20) }],
                ['18 months', { chest: inches(19), backNeckToWrist: inches(14), backLength: inches(8), crossBack: inches(8.5), armLength: inches(8), upperArm: inches(7), armholeDepth: inches(4), waist: inches(20.5), hip: inches(21) }],
                ['24 months', { chest: inches(20), backNeckToWrist: inches(18), backLength: inches(8.5), crossBack: inches(8.75), armLength: inches(8.5), upperArm: inches(7.5), armholeDepth: inches(4.25), waist: inches(21), hip: inches(22) }]
            ]
        },
        child: {
            label: "Child", measure: 'chest', measureKey: 'chest',
            backLengthLabel: 'Back Waist Length',
            sizes: [
                ['2', { chest: inches(21), backNeckToWrist: inches(18), backLength: inches(8.5), crossBack: inches(9.25), armLength: inches(8.5), upperArm: inches(7), armholeDepth: inches(4.25), waist: inches(21), hip: inches(22) }],
                ['4', { chest: inches(23), backNeckToWrist: inches(19.5), backLength: inches(9.5), crossBack: inches(9.75), armLength: inches(10.5), upperArm: inches(7.5), armholeDepth: inches(4.75), waist: inches(21.5), hip: inches(23.5) }],
                ['6', { chest: inches(25), backNeckToWrist: inches(20.5), backLength: inches(10.5), crossBack: inches(10.25), armLength: inches(11.5), upperArm: inches(8), armholeDepth: inches(5), waist: inches(22.5), hip: inches(25) }],
                ['8', { chest: inches(26.5), backNeckToWrist: inches(22), backLength: inches(12.5), crossBack: inches(10.75), armLength: inches(12.5), upperArm: inches(8.5), armholeDepth: inches(5.5), waist: inches(23.5), hip: inches(28) }],
                ['10', { chest: inches(28), backNeckToWrist: inches(24), backLength: inches(14), crossBack: inches(11.25), armLength: inches(13.5), upperArm: inches(8.75), armholeDepth: inches(6), waist: inches(24.5), hip: inches(29.5) }]
            ]
        },
        youth: {
            label: "Youth", measure: 'chest', measureKey: 'chest',
            backLengthLabel: 'Back Waist Length',
            sizes: [
                ['12', { chest: inches(30), backNeckToWrist: inches(26), backLength: inches(15), crossBack: inches(12), armLength: inches(15), upperArm: inches(9), armholeDepth: inches(6.5), waist: inches(25), hip: inches(31.5) }],
                ['14', { chest: inches(31.5), backNeckToWrist: inches(27), backLength: inches(15.5), crossBack: inches(12.25), armLength: inches(16), upperArm: inches(9.25), armholeDepth: inches(7), waist: inches(26.5), hip: inches(33) }],
                ['16', { chest: inches(32.5), backNeckToWrist: inches(28), backLength: inches(16), crossBack: inches(13), armLength: inches(16.5), upperArm: inches(9.5), armholeDepth: inches(7.5), waist: inches(27.5), hip: inches(35.5) }]
            ]
        },
        woman: {
            label: "Woman", measure: 'bust', measureKey: 'chest',
            backLengthLabel: 'Back Waist Length',
            sizes: [
                ['X-Small', { chest: inches(28, 30), backNeckToWrist: inches(26, 26.5), backLength: inches(16.5), crossBack: inches(14, 14.5), armLength: inches(16.5), upperArm: inches(9.75), armholeDepth: inches(6, 6.5), waist: inches(23, 24), hip: inches(33, 34) }],
                ['Small', { chest: inches(32, 34), backNeckToWrist: inches(27, 27.5), backLength: inches(17), crossBack: inches(14.5, 15), armLength: inches(17), upperArm: inches(10.25), armholeDepth: inches(6.5, 7), waist: inches(25, 26.5), hip: inches(35, 36) }],
                ['Medium', { chest: inches(36, 38), backNeckToWrist: inches(28, 28.5), backLength: inches(17.25), crossBack: inches(15.5, 16), armLength: inches(17), upperArm: inches(11), armholeDepth: inches(7, 7.5), waist: inches(28, 30), hip: inches(38, 40) }],
                ['Large', { chest: inches(40, 42), backNeckToWrist: inches(29, 29.5), backLength: inches(17.5), crossBack: inches(16.5, 17), armLength: inches(17.5), upperArm: inches(12), armholeDepth: inches(7.5, 8), waist: inches(32, 34), hip: inches(42, 44) }],
                ['X-Large', { chest: inches(44, 46), backNeckToWrist: inches(29, 29.5), backLength: inches(17.75), crossBack: inches(17.5), armLength: inches(17.5), upperArm: inches(13.5), armholeDepth: inches(8, 8.5), waist: inches(36, 38), hip: inches(46, 48) }],
                ['2X', { chest: inches(48, 50), backNeckToWrist: inches(30, 30.5), backLength: inches(18), crossBack: inches(18), armLength: inches(18), upperArm: inches(15.5), armholeDepth: inches(8.5, 9), waist: inches(40, 42), hip: inches(52, 53) }],
                ['3X', { chest: inches(52, 54), backNeckToWrist: inches(30.5, 31), backLength: inches(18), crossBack: inches(18), armLength: inches(18), upperArm: inches(17), armholeDepth: inches(9, 9.5), waist: inches(44, 45), hip: inches(54, 55) }],
                ['4X', { chest: inches(56, 58), backNeckToWrist: inches(31.5, 32), backLength: inches(18.5), crossBack: inches(18.5), armLength: inches(18.5), upperArm: inches(18.5), armholeDepth: inches(9.5, 10), waist: inches(46, 47), hip: inches(56, 57) }],
                ['5X', { chest: inches(60, 62), backNeckToWrist: inches(31.5, 32), backLength: inches(18.5), crossBack: inches(18.5), armLength: inches(18.5), upperArm: inches(19.5), armholeDepth: inches(10, 10.5), waist: inches(49, 50), hip: inches(61, 62) }]
            ]
        },
        man: {
            label: "Man", measure: 'chest', measureKey: 'chest',
            backLengthLabel: 'Back Hip Length',
            sizes: [
                ['Small', { chest: inches(34, 36), backNeckToWrist: inches(32, 32.5), backLength: inches(23, 24), crossBack: inches(15.5, 16), armLength: inches(18), upperArm: inches(12), armholeDepth: inches(8.5, 9), waist: inches(28, 30), hip: inches(35, 37) }],
                ['Medium', { chest: inches(38, 40), backNeckToWrist: inches(33, 33.5), backLength: inches(25, 26), crossBack: inches(16.5, 17), armLength: inches(18.5), upperArm: inches(13), armholeDepth: inches(9, 9.5), waist: inches(32, 34), hip: inches(39, 41) }],
                ['Large', { chest: inches(42, 44), backNeckToWrist: inches(34, 34.5), backLength: inches(26, 27), crossBack: inches(17.5, 18), armLength: inches(19.5), upperArm: inches(15), armholeDepth: inches(9.5, 10), waist: inches(36, 38), hip: inches(43, 45) }],
                ['X-Large', { chest: inches(46, 48), backNeckToWrist: inches(35, 35.5), backLength: inches(28), crossBack: inches(18, 18.5), armLength: inches(20), upperArm: inches(15.5), armholeDepth: inches(10, 10.5), waist: inches(42, 44), hip: inches(47, 49) }],
                ['2X', { chest: inches(50, 52), backNeckToWrist: inches(36, 36.5), backLength: inches(29), crossBack: inches(19, 20), armLength: inches(20.5), upperArm: inches(16.5), armholeDepth: inches(11), waist: inches(46, 48), hip: inches(51, 53) }],
                ['3X', { chest: inches(54, 56), backNeckToWrist: inches(37, 37.5), backLength: inches(30), crossBack: inches(20, 21), armLength: inches(20.5), upperArm: inches(17.5), armholeDepth: inches(11.5), waist: inches(50, 52), hip: inches(54, 56) }],
                ['4X', { chest: inches(58, 60), backNeckToWrist: inches(38, 38.5), backLength: inches(30), crossBack: inches(21, 21.5), armLength: inches(21), upperArm: inches(18.5), armholeDepth: inches(12), waist: inches(54, 56), hip: inches(56, 58) }],
                ['5X', { chest: inches(62, 64), backNeckToWrist: inches(39, 39.5), backLength: inches(31), crossBack: inches(22, 22.5), armLength: inches(21.5), upperArm: inches(20), armholeDepth: inches(12.5), waist: inches(58, 60), hip: inches(58, 60) }]
            ]
        },
        // Circumference-only charts. measureKey names the field the size match runs on.
        head: {
            label: "Head", measure: 'head circumference', measureKey: 'headCircumference', sizes: [
                ['Preemie', { headCircumference: inches(9, 12) }],
                ['Baby', { headCircumference: inches(14, 16) }],
                ['Toddler', { headCircumference: inches(16, 18) }],
                ['Child', { headCircumference: inches(18, 20) }],
                ['Tween', { headCircumference: inches(20, 22) }],
                ['Adult Woman', { headCircumference: inches(21, 23) }],
                ['Adult Man', { headCircumference: inches(22, 24) }]
            ]
        },
        hand: {
            label: "Hand", measure: 'hand circumference', measureKey: 'handCircumference', sizes: [
                ['Child 2-4 y', { handCircumference: inches(5), handLength: inches(4) }],
                ['Child 4-6 y', { handCircumference: inches(6), handLength: inches(4.75) }],
                ['Child 6-8 y', { handCircumference: inches(6.5), handLength: inches(5.25) }],
                ['Woman Small', { handCircumference: inches(7), handLength: inches(6) }],
                ['Woman Medium', { handCircumference: inches(7.5), handLength: inches(6.5) }],
                ['Woman Large', { handCircumference: inches(8), handLength: inches(7.5) }],
                ['Man Small', { handCircumference: inches(8), handLength: inches(7.5) }],
                ['Man Medium', { handCircumference: inches(8.5), handLength: inches(7.75) }],
                ['Man Large', { handCircumference: inches(9), handLength: inches(8.5) }]
            ]
        },
        // Sock chart, printed p.20. An earlier note said its columns did not survive text
        // extraction; read as an image they are clear.
        foot: {
            label: "Foot", measure: 'foot circumference', measureKey: 'footCircumference', sizes: [
                ['Baby 0-4 (6-18 mo)', { footCircumference: inches(4.5), sockHeight: inches(2.5), footLength: inches(3, 4.5) }],
                ['Toddler 5-9 (2-3 y)', { footCircumference: inches(5.5), sockHeight: inches(3.5), footLength: inches(4.75, 6) }],
                ['Child 10-13 (4-5 y)', { footCircumference: inches(6), sockHeight: inches(4.5), footLength: inches(6.5, 7.5) }],
                ['Youth 1-3 (6-9 y)', { footCircumference: inches(6.5), sockHeight: inches(5.5), footLength: inches(7.75, 8.5) }],
                ['Youth 4-6 (10-13 y)', { footCircumference: inches(7), sockHeight: inches(6.5), footLength: inches(8.75, 9.5) }],
                ['Woman 4-6.5', { footCircumference: inches(7), sockHeight: inches(6.5), footLength: inches(8, 9) }],
                ['Woman 7-9.5', { footCircumference: inches(8), sockHeight: inches(7), footLength: inches(9.25, 10) }],
                ['Woman 10-12.5', { footCircumference: inches(9), sockHeight: inches(7.5), footLength: inches(10.25, 11) }],
                ['Man 6-8.5', { footCircumference: inches(8), sockHeight: inches(7.5), footLength: inches(9.25, 10) }],
                ['Man 9-11.5', { footCircumference: inches(9), sockHeight: inches(8), footLength: inches(10.25, 11) }],
                ['Man 12-14', { footCircumference: inches(10), sockHeight: inches(8.5), footLength: inches(11.25, 12) }]
            ]
        }
    };

    /**
     * Bust/Chest Fit and Ease Chart, printed p.13. The standard names five bands but does not cover
     * the line continuously - nothing between -2 and 0, or 0 and +2 - and says "Approximately"
     * throughout. Those gaps are the standard's; the thresholds here snap to the nearest band.
     */
    const CYC_EASE_BANDS = [
        { below: -1, name: 'very close fitting (negative ease)' },
        { below: 1,  name: 'close fitting (zero ease)' },
        { below: 4,  name: 'classic fit' },
        { below: 6,  name: 'loose fit' },
        { below: Infinity, name: 'oversized' }
    ];

    // The ease chart is explicitly a BUST/CHEST chart. A hat needs negative ease to stay on and
    // mitts are sized to the hand, so "oversized" for a 24 in hat would mislead. These two match
    // a size and stop there.
    const EASELESS_CATEGORIES = new Set(['head', 'hand']);

    /**
     * The standard prints every figure in inches and centimetres; the inches are shipped. These are
     * the cells where the printed centimetres disagree, confirmed against the page - Man 3X's cm row
     * duplicates 2X's, Man 4X prints 49.5 cm against 21 in, Man 5X prints a range where the inch
     * column gives one value. Listing them lets tests/test-grader.js assert "these and only these",
     * so a transcription slip fails while a known source quirk does not.
     */
    const CHART_CM_DISCREPANCIES = [
        ['woman', '5X', 'chest', 62, 158], ['woman', 'X-Small', 'backNeckToWrist', 26.5, 68.5],
        ['man', '3X', 'crossBack', 20, 48], ['man', '3X', 'crossBack', 21, 51],
        ['man', '4X', 'crossBack', 21, 51], ['man', '4X', 'armLength', 21, 49.5],
        ['man', '5X', 'armLength', 21.5, 53.5], ['man', '5X', 'upperArm', 20, 48],
        ['man', 'X-Large', 'armholeDepth', 10.5, 26],
        ['man', '2X', 'hip', 51, 129], ['man', '2X', 'hip', 53, 134]
    ];

    const CM_PER_INCH = 2.54;

    // Shared: was scoped inside CalculateFinishedSize, but the grader needs it too.
    const round1 = (n) => Math.round(n * 10) / 10;

    // Measurements report to a tenth, but the DIFFERENCE between a target and the count it rounded
    // to is routinely a quarter inch, and round1(0.25) is 0.3. A rounding error reported with a
    // rounding error of its own is not worth the tidier column.
    const round2 = (n) => Math.round(n * 100) / 100;

    // === 2. STITCH COMPLEXITY WEIGHTS === //
    const STITCH_COMPLEXITY_SCORES = {
        ch: 1, slst: 1, sc: 1, hdc: 2, dc: 2, tr: 3, dtr: 4,
        inc: 2, dec: 2, sc2tog: 3, hdc2tog: 3, dc2tog: 3, tr2tog: 4,
        sc3tog: 5, puff: 4, bobble: 5, popcorn: 5, cluster: 5, shell: 4,
        vst: 3, picot: 3, fpdc: 4, bpdc: 4, fpsc: 4, bpsc: 4,
        crab: 4, esc: 5, ldc: 4, standingsc: 3, standingdc: 3,
        magicring: 2, mr: 2, yo: 1, spike: 4, "3in1": 4, "4in1": 5, repeat: 1, rep: 1
    };

    // === 2b. STITCH CATEGORIES === //
    // Every dictionary key lands in exactly one bucket. Anything unlisted (including custom
    // stitches) counts as 'special' - the honest default for a stitch known only by cost and yield.
    const STITCH_CATEGORIES = {
        repetitive: [
            'ch', 'chain', 'sc', 'single crochet', 'hdc', 'half double crochet',
            'dc', 'double crochet', 'tr', 'treble', 'treble crochet', 'dtr',
            'double treble', 'dbltr', 'trtr', 'triple treble', 'qtr', 'quadruple treble',
            'sl st', 'slst', 'slip stitch'
        ],
        texture: [
            'puff', 'popcorn', 'pc', 'bobble', 'cl', 'cluster',
            '2-dc cl', '3-dc cl', '4-dc cl', '5-dc cl', '3-tr cl', '4-tr cl',
            'fpsc', 'bpsc', 'fphdc', 'bphdc', 'fpdc', 'bpdc', 'fptr', 'bptr',
            'fpdtr', 'bpdtr', 'fpslst', 'bpslst',
            'front post single crochet', 'back post single crochet',
            'front post double crochet', 'back post double crochet',
            'ssc', 'spike', 'spike sc', 'spike single crochet',
            'cross st', 'cross stitch', 'crossed dc', 'xdc',
            'wsc', 'waistcoat', 'waistcoat stitch'
        ],
        shaping: [
            'inc', 'sc inc', 'hdc inc', 'dc inc', 'tr inc', 'dtr inc',
            'sc-inc', 'hdc-inc', 'dc-inc', 'tr-inc', 'dtr-inc',
            '2in1', '3in1', '4in1', '5in1', '6in1', '7in1', '8in1',
            'dec', 'invdec', 'sc-dec', 'hdc-dec', 'dc-dec', 'tr-dec',
            'sc2tog', 'hdc2tog', 'dc2tog', 'tr2tog', 'dtr2tog',
            'sc3tog', 'hdc3tog', 'dc3tog', 'tr3tog', 'dtr3tog',
            'sc4tog', 'hdc4tog', 'dc4tog', 'tr4tog', 'sc5tog', 'dc5tog',
            'sk', 'skip'
        ],
        special: [
            'fsc', 'fhdc', 'fdc', 'ftr', 'fdtr',
            'foundation single crochet', 'foundation half double crochet',
            'foundation double crochet',
            'picot', 'ldc', 'linked dc', 'linked double crochet',
            'esc', 'exsc', 'extended single crochet', 'ehdc', 'edc',
            'extended double crochet', 'stsc', 'standing sc'
        ]
    };

    const CATEGORY_OF_STITCH = (() => {
        const map = {};
        Object.entries(STITCH_CATEGORIES).forEach(([category, keys]) => {
            keys.forEach(key => { map[key] = category; });
        });
        return map;
    })();

    /**
     * Share of the pattern's stitches in each category, counted by stitch instance rather than by
     * complexity weight - so "10% texture" means the same thing across two patterns.
     */
    function AnalyzeComplexity(stitchTotals) {
        const counts = { repetitive: 0, texture: 0, shaping: 0, special: 0 };
        let total = 0;

        Object.entries(stitchTotals).forEach(([stitch, count]) => {
            const category = CATEGORY_OF_STITCH[stitch] || CATEGORY_OF_STITCH[NormalizeAnalyticsToken(stitch)] || 'special';
            counts[category] += count;
            total += count;
        });

        return { counts, total, percentages: toPercentages(counts, total) };
    }

    /** Largest-remainder rounding, so the four figures total exactly 100 and the bars cannot
     *  show 99% or 101%. */
    function toPercentages(counts, total) {
        const keys = Object.keys(counts);
        if (!total) return keys.reduce((acc, k) => (acc[k] = 0, acc), {});

        const exact = keys.map(k => ({ key: k, value: (counts[k] / total) * 100 }));
        const out = {};
        exact.forEach(e => { out[e.key] = Math.floor(e.value); });

        let remaining = 100 - keys.reduce((sum, k) => sum + out[k], 0);
        exact
            .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)))
            .forEach(e => { if (remaining > 0) { out[e.key]++; remaining--; } });

        return out;
    }

    // === 3. CORE ANALYTICS FUNCTIONS === //
    function NormalizeAnalyticsToken(token) {
        token = token.trim().toLowerCase();
        const aliases = {
            ss: "slst", slip: "slst", slipstitch: "slst", slipst: "slst",
            magicring: "mr", magiccircle: "mr", single: "sc",
            halfdouble: "hdc", double: "dc", treble: "tr"
        };
        return aliases[token] || token;
    }

    /**
     * How many of each stitch the pattern actually works.
     *
     * `rows` is the evaluated pass, and is what makes a to-end clause countable: "dc in each st
     * across" is one dc token until something says how many stitches it runs across, and that is
     * the count the previous row produced. Without it a 60-stitch dc row counted once, leaving the
     * stitch totals, the yardage and the complexity split all short.
     *
     * The running count is READ from the pass, never re-derived: sections restarting, turning chains
     * skipped and corners carrying are all the validator's decisions and must not have a second
     * opinion here. Called without `rows` it behaves as before - a floor, not a target.
     */
    /**
     * A foundation row as the engine reads it, or null for an ordinary row. "ch 61, sc in 2nd ch
     * from hook and in each ch across" lays 61 chains and works 60 sc back along them.
     */
    function foundationOf(step, availableFromPass) {
        const engine = window.CrochetMathEngine;
        if (!engine || typeof engine.parseFoundationRow !== 'function') return null;
        // The chain count comes from the words when they carry it, and from the row before when the
        // pattern put the chain on a line of its own.
        const hint = availableFromPass || step.initialChain || 0;
        const foundation = engine.parseFoundationRow(step.instructionString, hint);
        return foundation.isFoundationRow ? foundation : null;
    }

    function AggregateStitchCounts(stepObjects, rows = null) {
        const totals = {};

        // Indexed by position in stepObjects, which is what row.index counts.
        const availableAt = {};
        if (Array.isArray(rows)) {
            rows.forEach(row => {
                if (row && typeof row.index === 'number') {
                    availableAt[row.index] = row.availableStitches || 0;
                }
            });
        }

        stepObjects.forEach((step, stepIndex) => {
            const multiplier = Math.max(1, step.multiplier || 1);

            if (step.initialChain > 0) {
                totals.ch = (totals.ch || 0) + step.initialChain;
            }

            if (!step.instructionString) return;

            const available = availableAt[stepIndex] || 0;
            const foundation = foundationOf(step, available);

            // Tokenized with nothing available, the way evaluateStep reads it: given a stitch count
            // it resolves "in each ch across" as that many more CHAINS, counting chain and stitches
            // worked back along it separately. The chain is taken as written; the stitch is then
            // stretched to the length the engine says the row works.
            const parsed = window.CrochetMathEngine.parseInstructions(
                step.instructionString, foundation ? 0 : available
            );

            parsed.tokens.forEach(tokenObj => {
                const stitchName = NormalizeAnalyticsToken(tokenObj.name);
                const worked = (foundation && stitchName !== 'ch') ? foundation.count : tokenObj.count;
                totals[stitchName] = (totals[stitchName] || 0) + worked * multiplier;
            });
        });
        return totals;
    }

    function EstimateYarnYardage(stitchTotals, yarnWeightCategory = 4, safetyBuffer = 0.15) {
        const weightInfo = YARN_WEIGHT_MULTIPLIERS[yarnWeightCategory] || YARN_WEIGHT_MULTIPLIERS[4];
        let totalInches = 0;

        Object.entries(stitchTotals).forEach(([stitch, count]) => {
            const baseInches = BASE_INCHES_PER_STITCH[stitch] || 0.75; 
            totalInches += (baseInches * count);
        });

        totalInches *= weightInfo.scale;

        const rawYards = totalInches / 36;
        const totalYardsWithBuffer = Math.ceil(rawYards * (1 + safetyBuffer));
        const totalMetersWithBuffer = Math.ceil(totalYardsWithBuffer * 0.9144);
        const estimatedSkeins = Math.ceil(totalYardsWithBuffer / weightInfo.avgSkeinYards);

        return {
            yarnWeightName: weightInfo.name,
            totalYards: totalYardsWithBuffer,
            totalMeters: totalMetersWithBuffer,
            rawYards: Math.round(rawYards),
            // Unrounded, for comparing sizes. Whole yards are right to show a designer and wrong to
            // divide: at these magnitudes rounding turns a 25% difference into 23.9%.
            exactYards: rawYards * (1 + safetyBuffer),
            safetyBufferPercent: Math.round(safetyBuffer * 100),
            estimatedSkeins,
            avgYardsPerSkein: weightInfo.avgSkeinYards
        };
    }

    function CalculateDifficulty(stitchTotals) {
        let score = 0;
        Object.entries(stitchTotals).forEach(([stitch, count]) => {
            const weight = STITCH_COMPLEXITY_SCORES[stitch] ?? 1;
            score += weight * count;
        });

        // The CYC project scale (p.12) has four levels, not three: Basic / Easy / Intermediate /
        // Complex. The two existing boundaries are kept so patterns do not jump bands - Intermediate
        // stays, Advanced becomes Complex - and the old bottom band splits at 60. Brand tokens rather
        // than raw hex, so the badge tracks the palette.
        let level = "Basic";
        let badgeColor = "var(--primary)";

        if (score > 60) {
            level = "Easy";
            badgeColor = "var(--level-easy)";
        }
        if (score > 120) {
            level = "Intermediate";
            // Not --cat-shaping: that ochre is only 3.33:1 against white text.
            badgeColor = "var(--warning-text)";
        }
        if (score > 275) {
            level = "Complex";
            badgeColor = "var(--danger-text)";
        }

        return { score, level, badgeColor };
    }

    // Stitches that mean the same thing written different ways. Two spellings of one stitch in a
    // pattern is a readability problem, not a math problem.
    /**
     * Spellings that mean the same stitch, for the "you called it two things" warning.
     *
     * NOT derivable from STITCH_GLOSSARY by grouping on `abbr`, though it looks like it should be.
     * That grouping is wider in one direction and narrower in the other: it would fold in the
     * mid-century spacings ('s c' with 'sc'), but it would also split five groups that belong
     * together, because each spelling carries its own abbreviation - 'dec' / 'sc2tog' / 'sc-dec' are
     * three abbrs for one operation, as are 'inc' / 'sc inc', 'hdc2tog' / 'hdc-dec', 'dc2tog' /
     * 'dc-dec' and 'cross st' / 'crossed dc'. Deriving it would quietly stop warning about those.
     * The question here is "did the designer name one stitch two ways", which is a broader relation
     * than "shares a CYC abbreviation".
     */
    const ABBREVIATION_GROUPS = [
        ['sc', 'single crochet'], ['hdc', 'half double crochet'],
        ['dc', 'double crochet'], ['tr', 'treble', 'treble crochet'],
        ['dtr', 'double treble', 'dbltr'], ['trtr', 'triple treble'],
        ['qtr', 'quadruple treble'], ['ch', 'chain'],
        ['sl st', 'slst', 'slip stitch'],
        ['inc', 'sc inc', 'sc-inc'], ['hdc inc', 'hdc-inc'],
        ['dc inc', 'dc-inc'], ['tr inc', 'tr-inc'], ['dtr inc', 'dtr-inc'],
        ['dec', 'sc2tog', 'sc-dec'], ['hdc2tog', 'hdc-dec'],
        ['dc2tog', 'dc-dec'], ['tr2tog', 'tr-dec'],
        ['pc', 'popcorn'], ['cl', 'cluster'], ['sk', 'skip'],
        ['esc', 'exsc', 'extended single crochet'],
        ['ldc', 'linked dc', 'linked double crochet'],
        ['ssc', 'spike', 'spike sc', 'spike single crochet'],
        ['wsc', 'waistcoat', 'waistcoat stitch'],
        ['cross st', 'cross stitch', 'crossed dc', 'xdc'],
        ['fpdc', 'front post double crochet'], ['bpdc', 'back post double crochet'],
        ['fpsc', 'front post single crochet'], ['bpsc', 'back post single crochet']
    ];

    const TURNING_CHAIN_RE = /^(?:(?:chain|ch)\s*\d+\s*,\s*turn|turn\s*,\s*(?:chain|ch)\s*\d+)/i;
    const TRAILING_COUNT_RE = /[\(\[]\s*\d+(?:\s+[a-zA-Z\s]+)?\s*[\)\]]\s*$/;

    /** The instruction alone - row label and trailing count removed. Without this the "(12)" at
     *  the end of a row reads as parenthesis repeat notation. */
    function instructionBody(source) {
        return window.CrochetMathEngine.stripRowLabel(source).replace(TRAILING_COUNT_RE, '').trim();
    }

    /**
     * A readability and correctness score in the spirit of a writing-assistant grade. Every deduction
     * traces to a signal the validator already produced - nothing here is a guess.
     *
     * rows: the per-row output of evaluatePatternRows() ({ step, status, evaluation, label }).
     */
    /**
     * Checks that a multi-size pattern is actually graded. Each size validates fine on its own, so a
     * typo in one parenthesis - "52 (56, 45)" for "54" - is invisible row by row and only shows up
     * when the sizes are compared.
     *
     * sizes: [{ label, stitches, allValid }], widest fabric row per size, in order.
     */
    /**
     * Judges a run of numbers that should climb with size. Shared by the health check and the grading
     * consistency report, so the two cannot disagree about what a plateau is.
     *
     * A run that shrinks or repeats is wrong: sizes that come out the same size are not sizes. An
     * uneven run is only worth a look - grading widens deliberately at the plus end - so it is
     * flagged once the largest step is more than double the smallest, which no rounding reaches.
     */
    function judgeProgression(values, labels = []) {
        const steps = values.slice(1).map((v, i) => round2(v - values[i]));
        const named = (i) => labels[i] !== undefined ? labels[i] : `#${i + 1}`;

        const shrinks = [];
        const flats = [];
        steps.forEach((step, i) => {
            if (step < 0) shrinks.push(`${named(i)} → ${named(i + 1)}`);
            else if (step === 0) flats.push(`${named(i)} and ${named(i + 1)}`);
        });

        const widest = steps.length ? Math.max(...steps) : 0;
        const narrowest = steps.length ? Math.min(...steps) : 0;
        const uneven = steps.length > 1 && widest > narrowest * 2;

        return {
            steps, shrinks, flats, widest, narrowest, uneven,
            state: shrinks.length || flats.length ? 'fail' : uneven ? 'warn' : 'pass'
        };
    }

    function CheckSizeGrading(sizes) {
        if (!Array.isArray(sizes) || sizes.length < 2) return null;

        // One verdict shape, five ways out. Spelling the name into each return was how a rename could
        // reach four of them and leave the fifth reporting under the old heading.
        const verdict = (state, detail, deduct = 0) => ({ name: 'Size grading', state, detail, deduct });

        const broken = sizes.filter(s => !s.allValid || !(s.stitches > 0));
        if (broken.length) {
            return verdict('warn',
                `cannot compare sizes: ${broken.map(s => s.label).join(', ')} ${broken.length === 1 ? 'does' : 'do'} not validate`);
        }

        const counts = sizes.map(s => s.stitches);
        const { steps, shrinks, flats, widest, narrowest } = judgeProgression(counts, sizes.map(s => s.label));

        if (shrinks.length) {
            return verdict('fail', `sizes get smaller as they go up: ${shrinks.join('; ')} (${counts.join(', ')} sts)`, 15);
        }
        if (flats.length) {
            return verdict('fail', `${flats.join('; ')} come out the same size (${counts.join(', ')} sts)`, 10);
        }
        if (widest > narrowest * 2) {
            return verdict('warn', `uneven grading: steps of ${steps.join(', ')} sts between sizes`, 3);
        }
        return verdict('pass', `${sizes.length} sizes grade evenly (${counts.join(', ')} sts)`);
    }

    /**
     * Whether the size arrays agree with each other, which is not the same question as whether they
     * grade evenly. CheckSizeGrading judges the NUMBERS; this judges the ARRAYS - does every one offer
     * the same number of sizes, and does each say which size is the base.
     *
     * Nothing downstream catches either, because both degrade quietly. A list one value short leaves
     * resolveSizeVariants nothing to pick for the last size, so it falls back to the base and that
     * size is silently worked at the smallest measurements. A list with no base number is not a size
     * group by the position rule at all, so it is read as a stitch count and summed.
     *
     * A list, not a single value: no stitch count is ever written "(18, 20)" - the same
     * discriminator resolveSizeVariants uses.
     */
    const SIZE_LIST_RE = /(\d+)?\s*\(\s*(\d+(?:\s*,\s*\d+)+)\s*(?:[a-z][a-z-]*\s*)?\)/gi;

    /**
     * "for a total of 10 (12, 14, 13) rows" states how long the finished piece is, and a bigger size
     * is not shorter, so a drop is an error.
     *
     * Deliberately narrow. A row count that falls as size rises is ordinary elsewhere - "Next 4 (8,
     * 1, 7) Rnds" and "until all 37 (35, 34, 32) rows of sequence" are both real and both correct,
     * because they count a shaping section or a stripe repeat rather than the length of the piece.
     * Only a stated TOTAL is held to rising, and repeated values are common and fine.
     */
    const TOTAL_ROWS_RE = /\btotal\s+of\s+(\d+)\s*\(\s*(\d+(?:\s*,\s*\d+)+)\s*\)\s*(?:rows?|rnds?|rounds?)\b/i;

    function CheckSizeConsistency(lines) {
        const seen = [];
        (lines || []).forEach(line => {
            const text = String(line || '');
            for (const m of text.matchAll(SIZE_LIST_RE)) {
                const values = m[2].split(',').map(v => v.trim());
                seen.push({ text: m[0].trim(), hasBase: m[1] !== undefined, sizes: (m[1] !== undefined ? 1 : 0) + values.length });
            }
        });
        if (!seen.length) return null;

        const expected = Math.max(...seen.map(s => s.sizes));
        if (expected < 2) return null;

        // A range row ("Rows 3-6") is filed as several steps off one source line, so the same array
        // can arrive several times. Reported once.
        const faults = [];
        const say = (message) => { if (!faults.includes(message)) faults.push(message); };
        seen.forEach(entry => {
            if (!entry.hasBase) {
                say(`"${entry.text}" gives ${entry.sizes} sizes with no base size outside the brackets`);
            } else if (entry.sizes !== expected) {
                say(`"${entry.text}" gives ${entry.sizes} sizes where the pattern has ${expected}`);
            }
        });

        (lines || []).forEach(line => {
            const m = String(line || '').match(TOTAL_ROWS_RE);
            if (!m) return;
            const values = [parseInt(m[1], 10)].concat(m[2].split(',').map(v => parseInt(v.trim(), 10)));
            const drop = values.findIndex((v, i) => i > 0 && v < values[i - 1]);
            if (drop > 0) {
                say(`the total row count falls from ${values[drop - 1]} to ${values[drop]} at size ${drop + 1} (${values.join(', ')})`);
            }
        });

        if (!faults.length) {
            return {
                name: 'Size consistency',
                state: 'pass',
                detail: `every size list offers the same ${expected} sizes`,
                deduct: 0
            };
        }
        return {
            name: 'Size consistency',
            state: 'fail',
            detail: faults.join('; '),
            details: faults,
            deduct: Math.min(20, 8 * faults.length)
        };
    }

    const ROUND_LABEL_RE = /^(?:Rnds?|Rounds?)\s*\d+/i;
    // The chain that opens a joined round and stands in for its first stitch.
    const ROUND_START_CHAIN_RE = /^(?:ch|chain)\s*\d+/i;

    /** The row's text as written. Three fields in fallback order, because a row can arrive from the
     *  bulk parser, from a reflowed source line, or built by hand - and several checks read it. */
    const sourceOf = (r) => String(r.step.sourceLine || r.step.originalLine || r.step.instructionString || '');

    /**
     * Flat, joined rounds, or a continuous spiral - three different ways to step up to the next row,
     * and only flat work has a turning chain.
     *
     * The construction dropdown settles it when set. Left on its "Rows (Flat)" default the pattern
     * text decides, because a piece worked in the round is worked in the round either way.
     */
    function constructionStyle(rows, construction) {
        const engine = window.CrochetMathEngine;
        const declared = String(construction || '');

        // Round-to-round joins only. Row 1's "ch 48, sl st to join" closes the foundation chain into
        // a ring - counting it would read every spiral tube as joined, then demand a join on rounds
        // that correctly have none.
        const joinsRounds = rows.slice(1).some(r => engine.hasJoiningSlipStitch(sourceOf(r)));

        if (/Spiral/i.test(declared)) return 'spiral';
        if (/Joined/i.test(declared)) return 'joined';
        if (/Rounds/i.test(declared)) return joinsRounds ? 'joined' : 'spiral';

        const first = rows[0];
        const opensRound = !!first
            && (ROUND_LABEL_RE.test(sourceOf(first)) || engine.isRingStart(sourceOf(first)));
        // A marker on the first stitch is how a spiral keeps its place, and the only tell a spiral
        // tube started from a plain chain gives.
        const marksRoundStart = rows.some(r => engine.marksFirstStitch(sourceOf(r)));

        if (!opensRound && !marksRoundStart) return 'flat';
        return joinsRounds ? 'joined' : 'spiral';
    }

    function CalculatePatternHealth({ rows = [], stitchTotals = {}, sizes = null, construction = '', sourceText = '' } = {}) {
        const checks = [];
        const warnings = [];
        let score = 100;

        const deduct = (points) => { score -= points; };

        if (!rows.length) {
            return { score: 0, grade: 'No pattern', checks: [], warnings: [], totalRows: 0 };
        }

        // --- Stitch math ---
        const failed = rows.filter(r => r.status === 'failed').length;
        const blocked = rows.filter(r => r.status === 'blocked').length;
        if (failed) {
            deduct(Math.min(40, 15 * failed));
            checks.push({ name: 'Stitch math', state: 'fail', detail: `${failed} row${failed === 1 ? ' does' : 's do'} not add up${blocked ? `, ${blocked} blocked behind ${failed === 1 ? 'it' : 'them'}` : ''}` });
        } else {
            checks.push({ name: 'Stitch math', state: 'pass', detail: 'every row consumes exactly what the previous row produced' });
        }

        // --- Terminology ---
        const unknown = [...new Set(rows.flatMap(r => r.evaluation.unknownTokens || []))];
        if (unknown.length) {
            deduct(Math.min(25, 10 * unknown.length));
            checks.push({ name: 'Terminology', state: 'fail', detail: `unrecognized: ${unknown.map(t => `"${t}"`).join(', ')}` });
        } else {
            checks.push({ name: 'Terminology', state: 'pass', detail: 'every stitch resolves to a known term' });
        }

        // --- Repeat consistency ---
        const notations = new Set();
        rows.forEach(r => {
            const body = instructionBody(sourceOf(r));
            if (/\[/.test(body)) notations.add('[ ]');
            if (/\(/.test(body)) notations.add('( )');
            if (/\*/.test(body)) notations.add('*');
        });
        if (notations.size > 1) {
            deduct(6);
            checks.push({ name: 'Repeat consistency', state: 'warn', detail: `mixed repeat notation: ${[...notations].join(', ')}` });
        } else {
            checks.push({ name: 'Repeat consistency', state: 'pass', detail: notations.size ? `consistent ${[...notations][0]} notation` : 'no repeat groups used' });
        }

        // --- Notation ---
        // Whether the brackets close and the repeat markers exist, which is not the same question as
        // whether the row adds up. A row can be punctuated wrong and still reach the right number -
        // the expanders drop what they cannot read - so without this the worst-formed row scores full.
        const malformed = rows
            .map(r => ({ row: r, faults: window.CrochetMathEngine.notationFaults(instructionBody(sourceOf(r))) }))
            .filter(entry => entry.faults.length);
        if (malformed.length) {
            deduct(Math.min(20, 8 * malformed.length));
            const bits = malformed.map(entry => `${entry.row.label || 'row'}: ${entry.faults[0].message}`);
            checks.push({ name: 'Notation', state: 'fail', detail: bits.join('; '), details: bits });
        } else {
            checks.push({ name: 'Notation', state: 'pass', detail: 'every group closes and every repeat marker is placed' });
        }

        // --- Formatting ---
        // The CYC rule (p.33) is "provide stitch counts after every row/round that contains an
        // increase or decrease" - not after every row. A plain row repeating an unchanged number
        // carries no information, and deducting for its absence penalised correct patterns.
        // Two limits: the first row always wants a count, having nothing to compare against; and a
        // row with a balanced increase AND decrease is not flagged, since its total is unchanged.
        const countsExpected = rows.filter((r, i) => {
            if (r.status !== 'valid') return false;
            if (i === 0) return true;
            const previous = rows.slice(0, i).reverse().find(p => p.status === 'valid');
            return !previous || previous.evaluation.calculatedYield !== r.evaluation.calculatedYield;
        });
        const missingCounts = countsExpected.filter(r => !(r.step.expectedYield > 0)).length;
        const unlabelled = rows.filter(r => !window.CrochetMathEngine.looksLikeRowLabel(sourceOf(r))).length;
        // A gap in the numbering - "Row 1" then "Row 3" - is either a dropped row or a mistyped
        // number, and the reader cannot tell which. The matrix renumbers what it is given, so the gap
        // closes on screen and the written label is the only trace left.
        //
        // A range covers every number in it: after "Rows 2-5" the next row is 6, and comparing
        // against the 2 would report a gap where there is none. Unnumbered rows are passed over
        // rather than breaking the chain, and only an increase counts, so a pattern that restarts at
        // 1 in each section is not flagged.
        const stated = rows.map(r => window.CrochetMathEngine.rowLabelNumbers(sourceOf(r)));
        const gaps = [];
        stated.forEach((current, i) => {
            if (!current) return;
            const previous = stated.slice(0, i).reverse().find(v => v);
            if (previous && current.start > previous.end + 1) {
                gaps.push(`${previous.end} to ${current.start}`);
            }
        });
        if (missingCounts || unlabelled || gaps.length) {
            deduct(Math.min(10, missingCounts * 2 + unlabelled * 2 + gaps.length * 2));
            const bits = [];
            if (missingCounts) bits.push(`${missingCounts} row${missingCounts === 1 ? '' : 's'} without a stitch count (required where the count changes)`);
            if (unlabelled) bits.push(`${unlabelled} row${unlabelled === 1 ? '' : 's'} without a row label`);
            if (gaps.length) bits.push(`row numbering skips ${gaps.join(', ')}`);
            // `details` carries the faults separately so the panel can list them one per line;
            // `detail` keeps the joined form for the plain-text export.
            checks.push({ name: 'Formatting', state: 'warn', detail: bits.join('; '), details: bits });
        } else {
            checks.push({ name: 'Formatting', state: 'pass', detail: 'every row is labeled, and every row that changes the count carries one' });
        }

        // --- Size grading (multi-size patterns only) ---
        const grading = CheckSizeGrading(sizes);
        if (grading) {
            deduct(grading.deduct);
            checks.push({ name: grading.name, state: grading.state, detail: grading.detail });
        }

        // --- Size consistency (the arrays, not the numbers in them) ---
        // Read from the pattern as typed where available, because a numbered row's sourceLine has had
        // its sizes resolved away by then. Falls back to the row sources.
        const consistency = CheckSizeConsistency(
            sourceText ? String(sourceText).split('\n') : rows.map(sourceOf));
        if (consistency) {
            deduct(consistency.deduct);
            checks.push({
                name: consistency.name, state: consistency.state,
                detail: consistency.detail, details: consistency.details
            });
        }

        // --- Warning: inconsistent abbreviations ---
        const used = new Set(Object.keys(stitchTotals));
        ABBREVIATION_GROUPS.forEach(group => {
            const seen = group.filter(form => used.has(form));
            if (seen.length > 1) warnings.push(`Abbreviations inconsistent: ${seen.join(' / ')} used for the same stitch`);
        });

        // --- Warning: the step up to the next row is not documented ---
        // Flat work turns and needs a turning chain; joined rounds do the same job with a closing slip
        // stitch and a starting chain. A continuous spiral does neither - it never closes - so the
        // check is skipped entirely. Asking an amigurumi pattern for a turning chain was asking for
        // something that would be wrong to add.
        const style = constructionStyle(rows, construction);
        if (style !== 'spiral') {
            const isFlat = style === 'flat';
            const stepRows = rows.slice(1);
            const documented = stepRows.filter(r => {
                const body = instructionBody(sourceOf(r));
                return isFlat
                    ? TURNING_CHAIN_RE.test(body)
                    : window.CrochetMathEngine.hasJoiningSlipStitch(sourceOf(r)) || ROUND_START_CHAIN_RE.test(body);
            }).length;
            const noun = isFlat ? 'Turning chain' : 'Round join or starting chain';
            const unit = isFlat ? 'row' : 'round';
            if (stepRows.length && documented === 0) {
                warnings.push(`${noun} not documented on any ${unit}`);
            } else if (stepRows.length && documented < stepRows.length) {
                warnings.push(`${noun} not documented on ${stepRows.length - documented} of ${stepRows.length} ${unit}s`);
            }
        }

        // --- Warning: foundation chain never worked into ---
        const first = rows[0];
        const startsWithChain = first.step.initialChain > 0 || ROUND_START_CHAIN_RE.test(instructionBody(sourceOf(first)));
        const referenced = rows.some(r => /\bch\s+from\s+hook\b|\bin\s+each\s+ch\b|\bacross\s+the\s+ch/i.test(sourceOf(r)));
        if (startsWithChain && !referenced) warnings.push('Foundation chain not referenced by any row');

        deduct(warnings.length * 3);

        score = Math.max(0, Math.min(100, Math.round(score)));
        const grade = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Needs work' : 'Poor';

        return { score, grade, checks, warnings, totalRows: rows.length };
    }

    function easeBandFor(ease) {
        return CYC_EASE_BANDS.find(band => ease < band.below).name;
    }

    // === 3b. GARMENT GRADER === //
    // Forward direction: a target size becomes stitch and row counts. CalculateFinishedSize below
    // runs the other way, measuring a written pattern to report what size it came out.

    const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
    const toInches = (value, unit) => unit === 'cm' ? value / CM_PER_INCH : value;

    /**
     * Which way a measurement runs. A width becomes stitches, a length becomes rows, and the other
     * is not produced at all - "45 sts of armhole depth" is not a thing, nor is "123 rows of bust".
     * Both used to be reported for every point, which only looked harmless one measurement at a time.
     */
    const MEASUREMENT_AXIS = {
        chest: 'width', waist: 'width', hip: 'width', upperArm: 'width', crossBack: 'width',
        headCircumference: 'width', handCircumference: 'width', footCircumference: 'width',
        backLength: 'length', armLength: 'length', armholeDepth: 'length',
        backNeckToWrist: 'length', handLength: 'length', sockHeight: 'length', footLength: 'length'
    };

    /**
     * The points a garment's overall ease applies to. The standard's ease chart is explicitly a
     * bust/chest chart - see EASELESS_CATEGORIES - so a bust ease says nothing about armhole depth.
     * Everything outside this set defaults to zero ease and is set individually.
     */
    const EASED_POINTS = new Set(['chest', 'waist', 'hip', 'upperArm']);

    /**
     * Body, finished and ease are tied by `finished = body + ease`, so any two give the third. Which
     * was supplied and which was worked out is always reported: the brief is "never infer ease
     * silently".
     *
     * Two supplied -> the third is derived and said to be. One -> nothing is reported and the missing
     * pieces are named. Three that disagree -> the disagreement is reported and NOTHING is
     * overwritten, because deciding which of the designer's own numbers to discard is the silent
     * inference the requirement forbids.
     */
    function ResolveEase({ body = null, finished = null, ease = null, unit = 'in' } = {}) {
        const b = isNum(body) ? toInches(body, unit) : null;
        const f = isNum(finished) ? toInches(finished, unit) : null;

        // Ease may be an absolute measurement or a share of the body measurement.
        let e = null;
        if (ease && isNum(ease.value)) {
            if (ease.mode === 'percent') e = b === null ? null : b * (ease.value / 100);
            else e = toInches(ease.value, ease.mode === 'cm' ? 'cm' : 'in');
        }

        const given = [b !== null && 'body', f !== null && 'finished', e !== null && 'ease'].filter(Boolean);
        const blank = { complete: false, body: b, finished: f, easeInches: null, easePercent: null, derived: null };

        if (given.length < 2) {
            return { ...blank, missing: ['body', 'finished', 'ease'].filter(k => !given.includes(k)) };
        }

        if (given.length === 3) {
            const implied = round1(f - b);
            if (Math.abs(implied - e) > 0.05) {
                return {
                    ...blank, missing: [], conflict: {
                        statedEase: round1(e), impliedEase: implied, body: round1(b), finished: round1(f)
                    }
                };
            }
        }

        const resolvedBody = b !== null ? b : f - e;
        const resolvedFinished = f !== null ? f : b + e;
        const resolvedEase = e !== null ? e : f - b;
        const derived = given.length === 3 ? null
            : (b === null ? 'body' : f === null ? 'finished' : 'ease');

        return {
            complete: true, missing: [], derived,
            body: round1(resolvedBody),
            finished: round1(resolvedFinished),
            easeInches: round1(resolvedEase),
            // Ease as a share of the BODY measurement: 4 in over a 38 in bust is 10.5%.
            easePercent: resolvedBody ? Math.round((resolvedEase / resolvedBody) * 1000) / 10 : null,
            band: easeBandFor(resolvedEase)
        };
    }

    /** Body measurement plus ease, in inches. Negative and zero ease are both valid. */
    function ApplyEase(bodyInches, ease) {
        if (!isNum(bodyInches)) return null;
        if (!ease || !isNum(ease.value)) return round1(bodyInches);
        const added = ease.mode === 'percent'
            ? bodyInches * (ease.value / 100)
            : toInches(ease.value, ease.mode === 'cm' ? 'cm' : 'in');
        return round1(bodyInches + added);
    }

    /** Target measurement -> stitches. Density is per inch; targets are given in inches. */
    function MeasurementToStitches(inchesAcross, stitchesPerInch) {
        if (!isNum(inchesAcross) || !isNum(stitchesPerInch) || stitchesPerInch <= 0) return null;
        return Math.round(inchesAcross * stitchesPerInch);
    }

    function MeasurementToRows(inchesDown, rowsPerInch) {
        if (!isNum(inchesDown) || !isNum(rowsPerInch) || rowsPerInch <= 0) return null;
        return Math.round(inchesDown * rowsPerInch);
    }

    /**
     * Which gauge a piece is actually worked at: a section naming its own, then the washed swatch,
     * then the unwashed one - washed first because that is the gauge the finished garment has.
     *
     * Chosen per axis rather than per swatch, so a designer who washed a swatch and measured only its
     * stitch gauge keeps the unwashed row gauge instead of losing row gauge entirely. That also fixes
     * a misreport: `source` used to come from the washed STITCH gauge alone, so a washed row gauge
     * with no washed stitch gauge was labelled unwashed while the washed figure was in use.
     *
     * A section supplying one axis inherits the other, so "the sleeve is worked in a denser stitch
     * pattern" does not silently discard the row gauge too.
     */
    function EffectiveGauge(gauge = {}, { section = '' } = {}) {
        const washed = gauge.washed || {};
        const unwashed = gauge.unwashed || {};
        const override = (section && gauge.sections && gauge.sections[section]) || {};

        const usable = (v) => isNum(v) && v > 0;
        const pick = (key) =>
            usable(override[key]) ? { value: override[key], source: 'section' } :
            usable(washed[key]) ? { value: washed[key], source: 'washed' } :
            { value: unwashed[key], source: 'unwashed' };

        const sts = pick('stitchesPerInch');
        const rows = pick('rowsPerInch');
        return {
            stitchesPerInch: sts.value,
            rowsPerInch: rows.value,
            stitchSource: sts.source,
            rowSource: rows.source,
            // Kept as the stitch axis' provenance, which is what it has always reported.
            source: sts.source
        };
    }

    /**
     * Lengths in a graded size come out of row gauge. A pattern that changes its stitch count between
     * rows is shaping vertically, and without row gauge every one of those lengths is a guess printed
     * as a number.
     */
    function CheckGaugeCompleteness({ rows = [], gauge = {} } = {}) {
        const effective = EffectiveGauge(gauge);
        const hasRowGauge = isNum(effective.rowsPerInch) && effective.rowsPerInch > 0;

        const counts = rows
            .filter(r => r.status === 'valid' && Number.isFinite(r.evaluation && r.evaluation.calculatedYield))
            .map(r => r.evaluation.calculatedYield);
        const hasShaping = counts.some((n, i) => i > 0 && n !== counts[i - 1]);

        if (hasShaping && !hasRowGauge) {
            return {
                ok: false,
                warning: 'This pattern shapes vertically (the stitch count changes between rows), '
                       + 'so its lengths depend on row gauge. Only stitch gauge has been entered.'
            };
        }
        return { ok: true, warning: '', hasShaping, hasRowGauge };
    }

    /**
     * Grades one measurement across the chosen sizes. Ease is global unless a section names its own,
     * so a sweater can carry +4 at the bust and none at the cuff.
     *
     * `rounding` is optional and off by default. Given `{ repeat, strategy, parity }` it fits every
     * width to the repeat and reports what that cost - see RoundStitchCount. Left null the count is
     * the plain conversion, byte for byte: a repeat belongs to a SECTION, and this grades a
     * MEASUREMENT POINT across sizes, which is not the same thing. The caller that knows about
     * sections supplies it.
     *
     * Applied to `across` rather than `target` - the per-piece count, not the circumference. That is
     * the number the designer chains, and a multiple describes one row of fabric. Fitting a
     * circumference then halving it is not even arithmetic: a 6 + 1 repeat over 163 sts does not
     * survive being cut in two.
     */
    function GradeSizes({ category = '', point = 'chest', sizes = null, ease = null,
                          sectionEase = {}, section = '', pointEase = {}, gauge = {},
                          overrides = {}, piece = 'round', rounding = null, chart = null } = {}) {
        // A chart passed in wins over the category lookup, which is how a custom or made-to-measure
        // size set grades through exactly the same arithmetic as a published one. The standard charts
        // are never mutated for it.
        chart = chart || CYC_BODY_MEASUREMENTS[category];
        const effective = EffectiveGauge(gauge, { section });
        const axis = MEASUREMENT_AXIS[point] || 'width';

        // Ease is chosen most-specific first: this point, then this section, then the overall figure -
        // and the overall figure only reaches the circumferences.
        let applied = null;
        if (pointEase && pointEase[point]) applied = pointEase[point];
        else if (section && sectionEase[section] && EASED_POINTS.has(point)) applied = sectionEase[section];
        else if (EASED_POINTS.has(point)) applied = ease;

        // A piece worked flat is half the circumference; in the round it is all of it. Lengths are
        // unaffected either way.
        const factor = piece === 'half' && axis === 'width' ? 0.5 : 1;

        const entries = (chart ? chart.sizes : [])
            .filter(([label]) => !sizes || sizes.includes(label));

        return entries.map(([label, measures]) => {
            const override = (overrides[label] || {})[point];
            const m = measures[point];
            // A range is graded from its midpoint; a single figure is used as printed.
            const bodyInches = isNum(override) ? override : (m ? (m.min + m.max) / 2 : null);
            const target = ApplyEase(bodyInches, applied);
            const across = isNum(target) ? round1(target * factor) : null;
            // Only computed when the caller asked, so a cell that was never fitted to a repeat carries
            // no fit fields at all rather than a row of nulls reading as "checked, nothing wrong".
            const fitted = rounding && axis === 'width'
                ? RoundStitchCount({
                    targetInches: across, stitchesPerInch: effective.stitchesPerInch,
                    repeat: rounding.repeat, strategy: rounding.strategy,
                    parity: rounding.parity, piece
                })
                : null;
            return {
                size: label,
                point, axis, piece,
                body: isNum(bodyInches) ? round1(bodyInches) : null,
                fromChart: !isNum(override),
                target,
                across,
                eased: applied !== null && applied !== undefined,
                // Only the axis the measurement actually has.
                stitches: axis === 'width'
                    ? (fitted ? fitted.stitches : MeasurementToStitches(across, effective.stitchesPerInch))
                    : null,
                rows: axis === 'length' ? MeasurementToRows(target, effective.rowsPerInch) : null,
                gaugeSource: effective.source,
                ...(fitted ? {
                    gradedInches: fitted.gradedInches,
                    differenceInches: fitted.differenceInches,
                    fits: fitted.fits,
                    plusSuppressed: fitted.plusSuppressed,
                    options: fitted.options
                } : {})
            };
        });
    }

    /** The measurement points a chart actually carries, in the standard's own order. */
    function ChartPoints(category, chart = null) {
        const source = chart || CYC_BODY_MEASUREMENTS[category];
        if (!source || !source.sizes.length) return [];
        // A custom chart declares its points: it starts with no measurements and there is nothing to
        // infer them from until the designer has typed some.
        if (source.points) return source.points;
        const present = source.sizes[0][1];
        const ordered = MEASUREMENT_POINTS.filter(p => present[p]);
        // Head, hand and foot carry their own points rather than the garment nine.
        return ordered.length ? ordered : Object.keys(present);
    }

    /** A whole garment graded in one go: every measurement the chart carries, across the chosen
     *  sizes, for one section. */
    function GradeGarment({ category = '', sizes = null, ease = null, sectionEase = {},
                            section = '', pointEase = {}, gauge = {}, overrides = {},
                            piece = 'round', rounding = null, chart = null } = {}) {
        return ChartPoints(category, chart).map(point => ({
            point,
            label: MEASUREMENT_LABELS[point] || point,
            axis: MEASUREMENT_AXIS[point] || 'width',
            eased: EASED_POINTS.has(point) || !!(pointEase && pointEase[point]),
            sizes: GradeSizes({ category, point, sizes, ease, sectionEase, section, pointEase,
                                gauge, overrides, piece, rounding, chart })
        }));
    }

    // === 3c. STITCH MULTIPLES AND ROUNDING === //
    // A stitch pattern repeats over a fixed number of stitches, and a count that does not land on it
    // cannot be worked as written. The rule is "never round a number without explaining the fit
    // consequence", so everything here reports what it did and what it cost in inches.

    /**
     * A repeat, or null for "unconstrained". Both are ordinary: most sections have no stated multiple,
     * and a section with none must not be reported as fitting nothing.
     *
     * A multiple below 2 is unconstrained rather than invalid. Every count is a multiple of 1, and
     * `x % 0` is NaN - which compares false against 0, so a naive rule would mark every count in an
     * unconstrained section a misfit and fill the panel with warnings about a repeat nobody set.
     */
    function normaliseRepeat(repeat) {
        if (!repeat) return null;
        const multiple = isNum(repeat.multiple) ? Math.trunc(repeat.multiple) : 0;
        if (!(multiple >= 2)) return null;
        const plus = isNum(repeat.plus) ? Math.max(0, Math.trunc(repeat.plus)) : 0;
        return { multiple, plus };
    }

    /** "6 + 1", or just "12" when there is no border. Never "12 + 0". */
    function repeatLabel({ multiple, plus }) {
        return plus ? `${multiple} + ${plus}` : String(multiple);
    }

    // The largest / smallest valid count at or beyond n. One full repeat is the floor: 1 st satisfies
    // (1-1) % 6 === 0 arithmetically, but fabric with no repeat in it is not what "multiple of 6 + 1"
    // describes.
    const validAtOrBelow = (n, r) => {
        const k = Math.floor((n - r.plus) / r.multiple);
        return k >= 1 ? r.multiple * k + r.plus : null;
    };
    const validAtOrAbove = (n, r) => r.multiple * Math.max(1, Math.ceil((n - r.plus) / r.multiple)) + r.plus;

    /** Does a count fit the repeat, and if not, what are the counts either side of it. */
    function FitToMultiple({ count = null, repeat = null } = {}) {
        const r = normaliseRepeat(repeat);
        const n = isNum(count) ? Math.round(count) : null;

        if (!r) {
            return { count: n, multiple: null, plus: 0, fits: true, remainder: 0,
                     label: '', below: null, above: null };
        }
        const label = repeatLabel(r);
        if (n === null) {
            return { count: null, multiple: r.multiple, plus: r.plus, fits: false,
                     remainder: null, label, below: null, above: null };
        }
        // Modulo of a negative is negative in JS, so a count below the border would report a nonsense
        // remainder rather than the distance to the next valid count.
        const remainder = (((n - r.plus) % r.multiple) + r.multiple) % r.multiple;
        return {
            count: n, multiple: r.multiple, plus: r.plus,
            fits: remainder === 0 && n >= r.multiple + r.plus,
            remainder, label,
            below: validAtOrBelow(n - 1, r),
            above: validAtOrAbove(n + 1, r)
        };
    }

    /**
     * The valid counts around a calculated one, each with what it actually measures. The calculated
     * count is always included and flagged, fitting or not, so the designer sees what they asked for
     * beside what they can have. Without a gauge the counts still list; only the inches are withheld.
     */
    function NearestValidCounts({ count = null, repeat = null, stitchesPerInch = null, span = 2 } = {}) {
        const n = isNum(count) ? Math.round(count) : null;
        if (n === null) return [];
        const r = normaliseRepeat(repeat);
        const spi = isNum(stitchesPerInch) && stitchesPerInch > 0 ? stitchesPerInch : null;
        const at = (c) => spi ? round2(c / spi) : null;

        const counts = new Set([n]);
        if (r) {
            let down = validAtOrBelow(n - 1, r);
            for (let i = 0; i < span && down !== null; i++) { counts.add(down); down = validAtOrBelow(down - 1, r); }
            let up = validAtOrAbove(n + 1, r);
            for (let i = 0; i < span; i++) { counts.add(up); up = validAtOrAbove(up + 1, r); }
        }
        return [...counts].sort((a, b) => a - b).map(c => ({
            count: c,
            valid: FitToMultiple({ count: c, repeat }).fits,
            inches: at(c),
            deltaInches: spi ? round2((c - n) / spi) : null,
            current: c === n
        }));
    }

    /**
     * A target measurement becomes a stitch count the stitch pattern can actually be worked over, and
     * the measurement that count really produces.
     *
     * `strategy` chooses which side of the target to land on; `parity` constrains the number of
     * REPEATS, not of stitches. Separate because they answer separate questions, and because a
     * strategy named for a geometric outcome would overpromise: whether centring a motif needs an odd
     * or even repeat count depends on whether the piece mirrors about a repeat's middle or about the
     * seam between two, which the multiple alone cannot say. The designer says which - the same rule
     * ResolveEase follows.
     *
     * With no repeat this is exactly MeasurementToStitches, returned literally rather than re-derived
     * by a strategy that happens to agree: several graded counts sit on float boundaries
     * (round1(7.25) * 3 is 21.900000000000002).
     */
    function RoundStitchCount({ targetInches = null, stitchesPerInch = null, repeat = null,
                                strategy = 'nearest', parity = 'any', piece = 'half' } = {}) {
        const spi = isNum(stitchesPerInch) && stitchesPerInch > 0 ? stitchesPerInch : null;
        const plain = MeasurementToStitches(targetInches, spi);
        const blank = {
            targetInches: isNum(targetInches) ? targetInches : null,
            rawStitches: null, stitches: null, gradedInches: null, differenceInches: null,
            strategy, parity, fits: false, repeat: null, plusSuppressed: false, options: []
        };
        if (plain === null) return blank;

        const raw = round2(targetInches * spi);
        const asked = normaliseRepeat(repeat);

        // A joined round has no edges, so nowhere to put the border stitches a flat piece carries.
        // Dropping them is right; dropping them silently is not.
        const plusSuppressed = !!asked && piece === 'round' && asked.plus > 0;
        const r = plusSuppressed ? { multiple: asked.multiple, plus: 0 } : asked;

        const settled = (stitches, fits) => ({
            ...blank,
            rawStitches: raw, stitches,
            gradedInches: round2(stitches / spi),
            differenceInches: round2(stitches / spi - targetInches),
            fits, repeat: r ? { ...r, label: repeatLabel(r) } : null, plusSuppressed,
            options: NearestValidCounts({ count: plain, repeat: r, stitchesPerInch: spi })
        });

        if (!r) return settled(plain, true);

        // Parity applies to the repeat count k, where count = multiple * k + plus.
        const kOk = (k) => k >= 1
            && (parity === 'even' ? k % 2 === 0 : parity === 'odd' ? k % 2 === 1 : true);
        const countFor = (k) => r.multiple * k + r.plus;
        const ideal = (raw - r.plus) / r.multiple;

        let kDown = Math.floor(ideal);
        while (kDown >= 1 && !kOk(kDown)) kDown--;
        let kUp = Math.ceil(ideal);
        while (!kOk(kUp)) kUp++;

        const lower = kDown >= 1 ? countFor(kDown) : null;
        const upper = countFor(kUp);

        if (strategy === 'up') return settled(upper, true);
        if (strategy === 'down') return settled(lower === null ? upper : lower, true);

        // Nearest, measured in inches rather than stitches so a coarse gauge is not treated as finely
        // as a fine one. A tie goes to the larger count: a garment a quarter inch big is wearable and
        // one that is small may not be.
        if (lower === null) return settled(upper, true);
        const chosen = Math.abs(lower / spi - targetInches) < Math.abs(upper / spi - targetInches)
            ? lower : upper;
        return settled(chosen, true);
    }

    // === 3a1. GARMENT PIECES AND DIMENSION MODES === //

    /**
     * The pieces a garment is made of, and which measurements each is responsible for. A grader that
     * treats a sweater as one rectangle cannot tell a cuff from a hem, so the designer says what each
     * section is and the rest follows.
     *
     * `points` is what the piece's dimensions grade from, which is also what lets ImpactOfChange say
     * which pieces a changed measurement reaches.
     */
    const SECTION_TYPES = {
        front: { label: 'Front', points: ['chest', 'waist', 'hip', 'backLength'] },
        back: { label: 'Back', points: ['chest', 'waist', 'hip', 'backLength'] },
        body: { label: 'Body', points: ['chest', 'waist', 'hip', 'backLength'] },
        sleeve: { label: 'Sleeve', points: ['upperArm', 'armLength'] },
        yoke: { label: 'Yoke', points: ['chest', 'crossBack', 'armholeDepth'] },
        waistband: { label: 'Waistband', points: ['waist'] },
        hem: { label: 'Hem', points: ['hip'] },
        neckband: { label: 'Neckband', points: ['crossBack'] },
        cuff: { label: 'Cuff', points: [] },
        collar: { label: 'Collar', points: ['crossBack'] },
        hood: { label: 'Hood', points: ['crossBack'] },
        pocket: { label: 'Pocket', points: [] },
        motif: { label: 'Motif panel', points: [] }
    };

    /**
     * How a dimension behaves across the size run.
     *
     * graded  - from the size chart plus ease; the default.
     * locked  - one value in every size. A 2.5 in cuff depth is 2.5 in at every size; grading it
     *           would be a mistake, not a feature.
     * derived - worked out from another measurement, so it moves when its source does.
     * manual  - the designer gives every size its own number.
     */
    const DIMENSION_MODES = ['graded', 'locked', 'derived', 'manual'];

    /**
     * Applies the modes to a graded garment. Only `locked` changes a number - it flattens every size
     * onto the base size's value and recomputes the counts that follow, so a locked measurement's
     * stitch count is the locked one rather than the graded one left behind.
     *
     * `derived` and `manual` are recorded rather than applied: derived values already come out of the
     * chart relationship and manual ones arrive as overrides, which GradeSizes has always honoured.
     * Marking them is what lets the UI say which is which.
     */
    function ApplyDimensionModes({ garment = [], modes = {}, baseSize = '', gauge = {},
                                   graph = MEASUREMENT_DEPENDS_ON } = {}) {
        const effective = EffectiveGauge(gauge);
        return garment.map(row => {
            const mode = DIMENSION_MODES.indexOf(modes[row.point]) === -1 ? 'graded' : modes[row.point];
            const base = row.sizes.find(cell => cell.size === baseSize);

            const sizes = row.sizes.map(cell => {
                const tagged = { ...cell, mode, dependsOn: mode === 'derived' ? (graph[row.point] || []) : [] };
                if (mode !== 'locked' || !base || !isNum(base.target)) return tagged;

                // Everything downstream has to move with it, or the row reports a locked measurement
                // beside a graded stitch count.
                const across = isNum(base.across) ? base.across : base.target;
                return {
                    ...tagged,
                    target: base.target,
                    across,
                    stitches: row.axis === 'width'
                        ? MeasurementToStitches(across, effective.stitchesPerInch) : null,
                    rows: row.axis === 'length'
                        ? MeasurementToRows(base.target, effective.rowsPerInch) : null,
                    lockedTo: baseSize
                };
            });

            return { ...row, mode, dependsOn: graph[row.point] || [], sizes };
        });
    }

    // === 3b1. PER-SIZE AND CROSS-SIZE VALIDATION === //

    /**
     * Totals the compiler's own numbers for one size: what it starts with, what each row consumes and
     * produces, and what it ends on. Nothing new is computed - every figure is already on the
     * evaluation the validator returned, which is what makes this stronger than a spreadsheet. A
     * spreadsheet holds the counts a designer typed; this holds the counts the stitches actually make.
     *
     * rows: the per-row output of evaluatePatternRows().
     */
    function CompileSizeReport({ label = '', rows = [] } = {}) {
        const worked = (rows || []).filter(r =>
            (r.status === 'valid' || r.status === 'failed')
            && Number.isFinite(r.evaluation && r.evaluation.calculatedYield));

        let consumed = 0, produced = 0, increases = 0, decreases = 0;
        let startingCount = null, endingCount = null;
        let previous = null;

        const sections = [];
        let current = null;

        (rows || []).forEach(row => {
            // A section boundary is where continuity has to be checked, so each piece records the
            // count it inherited and the count it hands on.
            if (row.status === 'section') {
                // startingCount is left null so the piece's FIRST ROW fills it in with what it
                // actually had. Seeding it from the previous section's ending count would make the
                // continuity check compare a number against itself, and it could never fail.
                current = { key: row.sectionTitle, title: row.sectionTitle,
                            inheritedCount: previous, startingCount: null,
                            endingCount: null, rows: 0 };
                sections.push(current);
                return;
            }
            if (!Number.isFinite(row.evaluation && row.evaluation.calculatedYield)) return;
            if (row.status !== 'valid' && row.status !== 'failed') return;

            const madeThis = row.evaluation.calculatedYield;
            // A foundation row makes its stitches from a chain and consumes nothing, so an unknown
            // cost is zero rather than "all of them" - assuming it ate everything would overstate
            // consumption on every opening row.
            const usedThis = Number.isFinite(row.evaluation.totalCost) ? row.evaluation.totalCost : 0;

            if (startingCount === null) startingCount = row.availableStitches || 0;
            consumed += usedThis;
            produced += madeThis;
            if (previous !== null) {
                const change = madeThis - previous;
                if (change > 0) increases += change;
                else if (change < 0) decreases += -change;
            }
            previous = madeThis;
            endingCount = madeThis;

            if (current) {
                if (current.startingCount === null) current.startingCount = row.availableStitches || 0;
                current.endingCount = madeThis;
                current.rows++;
            }
        });

        const failed = (rows || []).filter(r => r.status === 'failed').length;
        const blocked = (rows || []).filter(r => r.status === 'blocked').length;

        return {
            label,
            rowsCounted: worked.length,
            startingCount, endingCount,
            consumed, produced,
            increases, decreases,
            netChange: startingCount === null ? null : endingCount - startingCount,
            failedRows: failed, blockedRows: blocked,
            allValid: failed === 0 && blocked === 0,
            sections,
            // Where one piece hands on to the next: a section starting from a count the previous one
            // did not end on has lost or gained stitches in the gap.
            continuity: sections.slice(1).map((section, i) => {
                const before = sections[i];
                const holds = before.endingCount === null || section.startingCount === null
                    || before.endingCount === section.startingCount;
                return {
                    from: before.title, to: section.title,
                    endedOn: before.endingCount, startedOn: section.startingCount, holds
                };
            })
        };
    }

    /**
     * Compares the compiled sizes against each other. A pattern's sizes each validate perfectly well
     * on their own - the faults that exist only between them are the ones nothing else can see.
     *
     * reports: CompileSizeReport output, one per size, in size order.
     */
    function CrossSizeReport({ reports = [], repeat = null } = {}) {
        const findings = [];
        if (!Array.isArray(reports) || reports.length < 2) return findings;

        const usable = reports.filter(r => r.allValid && isNum(r.endingCount));
        if (usable.length < reports.length) {
            reports.filter(r => !r.allValid).forEach(r => {
                findings.push({ size: r.label, check: 'Size does not validate',
                                detail: `${r.failedRows} failed and ${r.blockedRows} blocked rows.`,
                                state: 'fail' });
            });
        }
        if (usable.length < 2) return findings;

        // Every size must reach a different, larger finished count.
        const judged = judgeProgression(usable.map(r => r.endingCount), usable.map(r => r.label));
        if (judged.shrinks.length) {
            findings.push({ size: 'across sizes', check: 'Sizes get smaller as they go up',
                            detail: `${judged.shrinks.join('; ')} (${usable.map(r => r.endingCount).join(', ')} sts).`,
                            state: 'fail' });
        }
        if (judged.flats.length) {
            findings.push({ size: 'across sizes', check: 'Sizes come out identical',
                            detail: `${judged.flats.join('; ')} finish on the same count.`, state: 'fail' });
        }
        if (judged.uneven) {
            findings.push({ size: 'across sizes', check: 'Shaping steps jump between sizes',
                            detail: `steps of ${judged.steps.join(', ')} sts.`, state: 'warn' });
        }

        // Every size has to hold the stitch pattern's repeat, not only the base size.
        if (repeat) {
            usable.forEach(r => {
                const fit = FitToMultiple({ count: r.endingCount, repeat });
                if (!fit.fits) {
                    findings.push({ size: r.label, check: 'Size breaks the stitch multiple',
                                    detail: `${r.endingCount} sts does not fit ${fit.label}; `
                                          + `${fit.below} and ${fit.above} do.`, state: 'fail' });
                }
            });
        }

        // A size writing a different number of rows than its neighbours has either skipped an
        // instruction or repeated one.
        const rowCounts = usable.map(r => r.rowsCounted);
        const oddRowCount = rowCounts.some(n => n !== rowCounts[0]);
        if (oddRowCount) {
            findings.push({ size: 'across sizes', check: 'Sizes work a different number of rows',
                            detail: `${usable.map(r => `${r.label}: ${r.rowsCounted}`).join(', ')} - `
                                  + `an instruction may be skipped or duplicated in one of them.`,
                            state: 'warn' });
        }

        // Continuity between pieces must hold in every size, not just the one on screen.
        usable.forEach(r => {
            (r.continuity || []).filter(link => !link.holds).forEach(link => {
                findings.push({ size: r.label, check: 'Pieces do not join up',
                                detail: `${link.from} ends on ${link.endedOn} sts but `
                                      + `${link.to} starts from ${link.startedOn}.`, state: 'fail' });
            });
        });

        return findings;
    }

    // === 3b0. INSTRUCTION GENERATION === //

    /**
     * How a piece's stitch count changes with size, per construction.
     *
     * Only `drop` is worked out here. A drop-shoulder body and a rectangular vest are rectangles:
     * every row is the same width, the width comes straight off the finished circumference, and the
     * armhole is a gap left in the side seam rather than a shaped curve. That makes the whole size
     * run derivable from one written size, which is the claim this generator has to stand behind.
     *
     * The others are declared and refused rather than omitted, so adding one is filling in a `plan`
     * and no caller changes. A raglan needs yoke depth and four seam lines; a set-in sleeve needs a
     * cap matched to an armhole perimeter; a circular yoke needs increase rounds at set percentages.
     * None follow from a width ratio, and pretending they do puts numbers in a pattern that do not
     * work.
     */
    const CONSTRUCTIONS = {
        drop: {
            label: 'Drop shoulder / rectangular',
            supported: true,
            // Every row scales with the finished width, because every row IS the width.
            scalesByWidth: true,
            plan: ({ baseCount, targetCount }) => ({ scale: baseCount ? targetCount / baseCount : 1 })
        },
        raglan: { label: 'Raglan', supported: true, scalesByWidth: false, yoke: 'raglan',
                  reason: 'a raglan grades by yoke depth and four seam lines, not by width alone' },
        setIn: { label: 'Set-in sleeve', supported: true, scalesByWidth: false, yoke: 'setIn',
                 reason: 'a set-in cap has to match an armhole perimeter, which no width ratio gives' },
        yoke: { label: 'Circular yoke', supported: true, scalesByWidth: false, yoke: 'circular',
                reason: 'a circular yoke grades by increase rounds at set percentages of the depth' }
    };

    /**
     * A raglan yoke, worked in one piece from the neck.
     *
     * The whole construction is one fact: four seams, each gaining a stitch on both sides of every
     * increase round, so the yoke grows eight stitches a round and nothing else about it is free.
     * Given the neck and the front, back and sleeves it has to reach, the number of increase rounds
     * is fixed - and if it does not fit the yoke depth, the yoke depth is wrong, which is said rather
     * than absorbed. Distribution goes through DistributeShaping, the same one a tapered sleeve uses.
     */
    function PlanRaglanYoke({ neckCount = null, frontBackCount = null, sleeveCount = null,
                              yokeRows = null, rowsPerInch = null } = {}) {
        const blank = { construction: 'raglan', supported: true, feasible: false,
                        increaseRounds: null, separationCount: null, shaping: null, warning: '' };
        if (!isNum(neckCount) || !isNum(frontBackCount) || !isNum(sleeveCount) || !isNum(yokeRows)) {
            return { ...blank, warning: 'A raglan needs the neck, front-and-back, sleeve and yoke-depth counts.' };
        }

        // What the yoke has to hold by the time the pieces separate.
        const separationCount = frontBackCount + sleeveCount * 2;
        const shaping = DistributeShaping({
            from: neckCount, to: separationCount, rows: yokeRows, preset: 'raglan'
        });

        return {
            ...blank,
            separationCount,
            increaseRounds: shaping.events,
            feasible: shaping.feasible,
            shaping,
            depthInches: isNum(rowsPerInch) && rowsPerInch > 0 ? round2(yokeRows / rowsPerInch) : null,
            warning: shaping.feasible ? '' :
                `${shaping.warning} A raglan gains exactly 8 stitches a round, so the yoke `
                + `depth and the separation count decide each other.`
        };
    }

    /**
     * A set-in armhole and the cap that has to fit it.
     *
     * Two separate obligations. The armhole loses stitches from the full body width to the shoulders,
     * an ordinary paired decrease. The cap is the part patterns get wrong: its seamed edge has to be
     * about as long as the armhole's, and a cap that is merely the right width at the bicep can still
     * be inches short around. Both edges are reported so they can be compared, rather than one
     * "it fits".
     */
    function PlanSetInSleeve({ bodyCount = null, shoulderCount = null, underarmCount = 0,
                               armholeRows = null, sleeveCount = null, capRows = null,
                               capTopCount = null, stitchesPerInch = null, rowsPerInch = null } = {}) {
        const blank = { construction: 'setIn', supported: true, feasible: false,
                        armhole: null, cap: null, armholeEdgeInches: null,
                        capEdgeInches: null, warning: '' };
        if (!isNum(bodyCount) || !isNum(shoulderCount) || !isNum(armholeRows)) {
            return { ...blank, warning: 'A set-in armhole needs the body count, the shoulder count and the armhole rows.' };
        }

        // The underarm is bound off at once; the rest is decreased away up the armhole.
        const afterUnderarm = bodyCount - underarmCount * 2;
        const armhole = DistributeShaping({
            from: afterUnderarm, to: shoulderCount, rows: armholeRows, preset: 'paired'
        });

        const cap = isNum(sleeveCount) && isNum(capRows) && isNum(capTopCount)
            ? DistributeShaping({ from: sleeveCount, to: capTopCount, rows: capRows, preset: 'paired' })
            : null;

        // Edge lengths, which is what actually has to match. Both are the straight-line height of the
        // shaped edge, which understates a curve equally on both sides and so compares like with like.
        const armholeEdgeInches = isNum(rowsPerInch) && rowsPerInch > 0
            ? round2(armholeRows / rowsPerInch) : null;
        const capEdgeInches = isNum(capRows) && isNum(rowsPerInch) && rowsPerInch > 0
            ? round2(capRows / rowsPerInch) : null;

        let warning = armhole.feasible ? '' : armhole.warning;
        if (!warning && cap && !cap.feasible) warning = cap.warning;
        if (!warning && isNum(armholeEdgeInches) && isNum(capEdgeInches)) {
            const gap = round2(capEdgeInches - armholeEdgeInches);
            // A cap is eased into an armhole, so it runs a little long on purpose.
            if (Math.abs(gap) > 0.75) {
                warning = `The cap edge is ${capEdgeInches} in and the armhole edge is `
                        + `${armholeEdgeInches} in (${signOf(gap)} in). They are seamed together, `
                        + `so one of the two row counts is wrong.`;
            }
        }

        return {
            ...blank,
            armhole, cap, armholeEdgeInches, capEdgeInches,
            feasible: armhole.feasible && (!cap || cap.feasible) && !warning,
            warning
        };
    }

    /**
     * A circular yoke, worked from the neck in increase rounds.
     *
     * Unlike a raglan the increases are not on four lines - they spread evenly around the round,
     * which is what SpaceEvenly answers. The classic shaping puts them in a few rounds spaced down
     * the yoke rather than a little at a time, so the plan is a list of rounds, each with its spacing.
     */
    function PlanCircularYoke({ neckCount = null, separationCount = null, yokeRows = null,
                               increaseRounds = 3, rowsPerInch = null } = {}) {
        const blank = { construction: 'circular', supported: true, feasible: false,
                        rounds: [], warning: '' };
        if (!isNum(neckCount) || !isNum(separationCount) || !isNum(yokeRows)) {
            return { ...blank, warning: 'A circular yoke needs the neck count, the separation count and the yoke depth.' };
        }
        if (separationCount <= neckCount) {
            return { ...blank, warning: `The yoke has to grow: ${neckCount} sts at the neck `
                                      + `cannot reach ${separationCount} at the separation.` };
        }

        const passes = Math.max(1, Math.round(increaseRounds));
        if (passes > yokeRows) {
            return { ...blank, warning: `${plural(passes, 'increase round')} will not fit in ${yokeRows} rows.` };
        }

        // Grown by an equal ratio rather than an equal number, which is what keeps the fabric flat:
        // a round near the neck has fewer stitches to spread into.
        const ratio = Math.pow(separationCount / neckCount, 1 / passes);
        const rounds = [];
        let count = neckCount;
        for (let i = 0; i < passes; i++) {
            const next = i === passes - 1 ? separationCount : Math.round(count * ratio);
            const added = next - count;
            rounds.push({
                round: Math.round(((i + 1) * yokeRows) / (passes + 1)),
                from: count, to: next, increases: added,
                spacing: added > 0 ? SpaceEvenly({ total: count, points: added }) : null
            });
            count = next;
        }

        return {
            ...blank,
            rounds,
            feasible: rounds.every(r => r.increases > 0 && (!r.spacing || r.spacing.feasible)),
            depthInches: isNum(rowsPerInch) && rowsPerInch > 0 ? round2(yokeRows / rowsPerInch) : null,
            warning: rounds.some(r => r.spacing && !r.spacing.feasible)
                ? 'One increase round asks for more increases than there are stitches to work them into.' : ''
        };
    }

    // === 3b-ii. CHECKING A WRITTEN GARMENT AGAINST ITS CONSTRUCTION === //

    /*
     * The three planners above answer "what would this construction need?". Everything from here
     * answers the other half: "and does the pattern that was written do it?".
     *
     * This is a fault class no row-by-row check can see. Every row of a raglan yoke can consume
     * exactly what the row before produced - stitch math perfect, health score 100 - and the yoke
     * still be impossible, because a raglan gains eight a round and 63 is not a multiple of eight.
     * The counts are locally right and globally not a garment. Same for a cap that is the right width
     * at the bicep and two inches short around the edge it is seamed to.
     *
     * So pieces are read as shapes rather than rows and handed to the planner for the construction
     * the designer says this is. Nothing is corrected: as everywhere else here, the disagreement is
     * the output.
     */

    /** Which pieces play which part. A front and a back are each "the body": each carries its own
     *  armhole, and together they are the circumference. */
    const GARMENT_ROLES = {
        body: ['body', 'front', 'back'],
        sleeve: ['sleeve'],
        yoke: ['yoke']
    };

    /** The planner that answers for each construction, named so a report can say so. */
    const CONSTRUCTION_PLANNERS = {
        raglan: 'PlanRaglanYoke', setIn: 'PlanSetInSleeve', circular: 'PlanCircularYoke'
    };

    /**
     * A piece read as a shape: what it starts at, ends at, how many rows it had to get there, and
     * every row that moved the count.
     *
     * `worked` is the piece's rows as [{ label, count }] - the count the validator RESOLVED, never
     * one the pattern merely states, so a wrong written count cannot smuggle a fault past this.
     */
    function PieceSpan(worked = []) {
        const rows = (worked || []).filter(row => row && isNum(row.count));
        if (rows.length < 2) return null;

        const steps = [];
        for (let i = 1; i < rows.length; i++) {
            const delta = rows[i].count - rows[i - 1].count;
            if (delta !== 0) {
                steps.push({ label: rows[i].label, at: i, from: rows[i - 1].count,
                             to: rows[i].count, delta });
            }
        }
        return {
            from: rows[0].count, to: rows[rows.length - 1].count,
            // The first row establishes the count; the rest are what there is to shape over. A yoke
            // of 35 rows has 34 in which to grow.
            rows: rows.length - 1,
            events: steps.length, steps
        };
    }

    /**
     * The shaped end of a piece: the run of rows at the finish where the count moves one way.
     *
     * This is how an armhole and a cap are found without being told where they are. A sleeve grows up
     * the arm then decreases for the cap; a body runs straight then decreases at the armhole. Straight
     * rows INSIDE the run belong to it - decreasing every other row is still one armhole - but
     * straight rows before it do not, or the armhole swallows the body below it.
     */
    function ShapedTail(worked = []) {
        const rows = (worked || []).filter(row => row && isNum(row.count));
        const blank = { from: null, to: null, rows: 0, direction: 'none',
                        events: 0, steps: [], straightAfter: 0 };
        if (rows.length < 2) return blank;

        // Anything flat at the very end is worked after the shaping, not part of it.
        let end = rows.length - 1;
        while (end > 0 && rows[end].count === rows[end - 1].count) end--;
        if (end === 0) return blank;
        const straightAfter = rows.length - 1 - end;
        const direction = rows[end].count > rows[end - 1].count ? 'increase' : 'decrease';

        let start = end;
        while (start > 0) {
            const delta = rows[start].count - rows[start - 1].count;
            if (delta !== 0 && (delta > 0) !== (direction === 'increase')) break;
            start--;
        }
        // Back off over any flat rows the walk crossed on its way to the first move.
        while (start < end && rows[start + 1].count === rows[start].count) start++;

        const steps = [];
        for (let i = start + 1; i <= end; i++) {
            const delta = rows[i].count - rows[i - 1].count;
            if (delta !== 0) {
                steps.push({ label: rows[i].label, at: i, from: rows[i - 1].count,
                             to: rows[i].count, delta });
            }
        }
        return {
            from: rows[start].count, to: rows[end].count, rows: end - start,
            direction, events: steps.length, steps, straightAfter
        };
    }

    /**
     * Whether a written garment can be the construction it says it is.
     *
     * sections: [{ key, title, type, widestStitches, worked: [{ label, count }] }] - the pieces the
     * pattern was read as, with the type the designer assigned. Asked rather than guessed: "Sleeve" in
     * a heading is a hint, and a hint is not enough to start telling someone their sweater is wrong.
     *
     * construction: a key of CONSTRUCTIONS. A drop shoulder is checked too and passes for a stated
     * reason - a check that goes quiet on the easy case cannot be trusted on the hard one.
     */
    function CheckGarmentConstruction({ sections = [], construction = 'drop',
                                        rowsPerInch = null } = {}) {
        const kind = CONSTRUCTIONS[construction] || CONSTRUCTIONS.drop;
        const checks = [];
        const add = (name, state, detail) => checks.push({ name, state, detail });

        const found = { body: [], sleeve: [], yoke: [] };
        (sections || []).forEach(section => {
            Object.keys(GARMENT_ROLES).forEach(role => {
                if (GARMENT_ROLES[role].indexOf(section.type) >= 0) found[role].push(section);
            });
        });

        const report = {
            construction, label: kind.label,
            planner: CONSTRUCTION_PLANNERS[kind.yoke] || '',
            pieces: {
                yoke: found.yoke.length ? found.yoke[0].title : null,
                body: found.body.map(s => s.title),
                sleeve: found.sleeve.map(s => s.title)
            },
            // A yoke construction reports one span, the yoke's. A set-in sleeve has no yoke and
            // reports the two shaped tails it compares instead.
            span: null, armhole: null, cap: null, boundOff: 0,
            plan: null, checks, state: 'skip'
        };
        const finish = () => {
            const worst = ['fail', 'warn', 'pass', 'skip']
                .find(state => checks.some(check => check.state === state));
            return { ...report, state: worst || 'skip' };
        };

        if (!kind.yoke) {
            add('Armhole and sleeve', 'pass',
                `${kind.label} has no armhole shaping and no cap to set in - every row is `
                + 'the full width, so there is no construction obligation to fail.');
            return finish();
        }

        // The circumference the yoke or armhole has to meet. A front and a back sum to it; a body in
        // the round already is it. The widest row of each is used - that is the row that has to go
        // round the chest.
        const bodyCount = found.body.length
            ? found.body.reduce((sum, s) => sum + (s.widestStitches || 0), 0) : null;
        const sleeveCount = found.sleeve.length ? found.sleeve[0].widestStitches : null;

        if (kind.yoke === 'setIn') return checkSetInSleeve(found, rowsPerInch, add, report, finish);

        const yoke = found.yoke[0];
        const span = yoke ? PieceSpan(yoke.worked) : null;
        if (!span) {
            add('Yoke', 'skip', yoke
                ? `${yoke.title} has fewer than two rows the validator could resolve, so there is no shape to read.`
                : 'No section is typed Yoke. Set one on the Sizer / Grader tab and the yoke can be checked.');
            return finish();
        }
        report.span = span;

        return kind.yoke === 'raglan'
            ? checkRaglan({ span, bodyCount, sleeveCount, rowsPerInch, add, report, finish })
            : checkCircularYoke({ span, bodyCount, sleeveCount, rowsPerInch, add, report, finish });
    }

    /** Does the yoke hand on exactly what the pieces hanging off it need? */
    function checkSeparation(span, bodyCount, sleeveCount, separationCount, add) {
        if (!isNum(bodyCount) || !isNum(sleeveCount)) {
            add('The yoke meets the pieces', 'skip',
                'Type one section Body (or a Front and a Back) and one Sleeve on the '
                + 'Sizer / Grader tab, and the yoke can be checked against what they need.');
            return;
        }
        const gap = span.to - separationCount;
        if (gap === 0) {
            add('The yoke meets the pieces', 'pass',
                `the yoke ends at ${span.to} sts, which is exactly the body (${bodyCount}) `
                + `and two sleeves of ${sleeveCount}.`);
        } else {
            add('The yoke meets the pieces', 'fail',
                `the yoke ends at ${span.to} sts, but the body (${bodyCount}) and two `
                + `sleeves of ${sleeveCount} need ${separationCount} - the yoke is `
                + `${signOf(gap)} sts. One of the two is written for a different garment.`);
        }
    }

    function checkRaglan({ span, bodyCount, sleeveCount, rowsPerInch, add, report, finish }) {
        const plan = PlanRaglanYoke({
            neckCount: span.from, frontBackCount: bodyCount, sleeveCount,
            yokeRows: span.rows, rowsPerInch
        });
        report.plan = plan;

        checkSeparation(span, bodyCount, sleeveCount, plan.separationCount, add);

        // Judged on the yoke's own numbers rather than the planner's: what is being checked is the
        // yoke that was written, not the one the pieces imply.
        const shaping = DistributeShaping({
            from: span.from, to: span.to, rows: span.rows, preset: 'raglan'
        });
        if (shaping.feasible) {
            add('Eight stitches a round', 'pass',
                `${span.from} to ${span.to} over ${plural(span.rows, 'row')}: ${shaping.text.toLowerCase()}.`);
        } else {
            add('Eight stitches a round', 'fail', shaping.warning
                + ' A raglan gains a stitch on both sides of all four seams, so its total gain'
                + ' is a multiple of eight or it is not a raglan.');
        }

        // Every round that moves the count has to move it by eight. This finds the round in the
        // middle that increased six, which the totals above cannot see if a later round made it up.
        const perEvent = SHAPING_PRESETS.raglan.perEvent;
        const offBeat = span.steps.filter(step => step.delta !== perEvent);
        if (!span.events) {
            add('Every round adds eight', 'fail',
                'no row in the yoke changes the stitch count, so nothing is being shaped.');
        } else if (!offBeat.length) {
            add('Every round adds eight', 'pass',
                `all ${plural(span.events, 'increase round')} add exactly eight.`);
        } else {
            add('Every round adds eight', 'fail',
                `${plural(offBeat.length, 'round')} of the ${span.events} that change the count `
                + `${offBeat.length === 1 ? 'does' : 'do'} not add eight: `
                + offBeat.slice(0, 3).map(step =>
                    `${step.label} ${step.delta > 0 ? 'adds' : 'loses'} ${Math.abs(step.delta)}`).join(', ')
                + (offBeat.length > 3 ? `, and ${offBeat.length - 3} more.` : '.'));
        }

        return finishWithYokeDepth({ plan, span, add, finish });
    }

    /** The closing move both yoke checks make: report the depth the plan works out to, if the gauge
     *  gave one, then finish. Written out twice, it was one edit away from the two reporting it
     *  differently. */
    function finishWithYokeDepth({ plan, span, add, finish }) {
        if (isNum(plan.depthInches)) {
            add('Yoke depth', 'pass',
                `${plural(span.rows, 'row')} at your row gauge is ${plan.depthInches} in from neck to separation.`);
        }
        return finish();
    }

    function checkCircularYoke({ span, bodyCount, sleeveCount, rowsPerInch, add, report, finish }) {
        // Planned against the pattern's OWN number of increase rounds. Whether the designer's three
        // rounds can carry the growth is the question; the planner's preferred number is not what
        // was written.
        const plan = PlanCircularYoke({
            neckCount: span.from, separationCount: span.to, yokeRows: span.rows,
            increaseRounds: span.events || 1, rowsPerInch
        });
        report.plan = plan;

        checkSeparation(span, bodyCount, sleeveCount, span.to, add);

        if (!span.events) {
            add('The yoke grows', 'fail',
                'no row in the yoke changes the stitch count, so nothing is being shaped.');
            return finish();
        }
        // A circular yoke grows by ratio, so no round has a fixed increase to check - but a round
        // asking for more increases than it has stitches to work them into is impossible at any
        // ratio. Named rather than left to the planner's summary: "one increase round asks for too
        // much" does not say which, and there is no second place to look.
        const tight = (plan.rounds || []).filter(round => round.spacing && !round.spacing.feasible);
        if (tight.length) {
            add('The increases fit the rounds they are worked in', 'fail',
                tight.map(round => `going ${round.from} to ${round.to} needs ${round.increases} `
                    + `increases across ${round.from} sts`).join('; ')
                + `. Spread over more than ${plural(span.events, 'round')}, or start from a wider neck.`);
        } else if (plan.feasible) {
            add('The increases fit the rounds they are worked in', 'pass',
                `${plural(span.events, 'increase round')} carry ${span.from} sts to ${span.to}, `
                + 'and each round has stitches enough to space its increases into.');
        } else {
            add('The increases fit the rounds they are worked in', 'fail',
                plan.warning || `${plural(span.events, 'increase round')} cannot carry `
                + `${span.from} sts to ${span.to}.`);
        }

        return finishWithYokeDepth({ plan, span, add, finish });
    }

    /** A set-in sleeve is the only one of the three whose obligation is between two separate pieces,
     *  so both have to be present before anything can be said. */
    function checkSetInSleeve(found, rowsPerInch, add, report, finish) {
        const body = found.body[0];
        const sleeve = found.sleeve[0];
        if (!body || !sleeve) {
            add('Armhole and cap', 'skip',
                'A set-in sleeve is checked by comparing two pieces, so it needs a section '
                + 'typed Body (or Front, or Back) and one typed Sleeve. Set them on the '
                + 'Sizer / Grader tab.');
            return finish();
        }

        const armhole = ShapedTail(body.worked);
        const cap = ShapedTail(sleeve.worked);
        if (armhole.direction !== 'decrease') {
            add('The armhole', 'fail',
                `${body.title} does not end by decreasing, so there is no armhole shaped `
                + 'into it. A set-in sleeve needs one.');
            return finish();
        }
        if (cap.direction !== 'decrease') {
            add('The cap', 'fail',
                `${sleeve.title} does not end by decreasing, so it has no cap - it is a `
                + 'straight-topped sleeve, which is a drop shoulder rather than a set-in one.');
            return finish();
        }

        // The underarm is bound off at once, so the first step down is bigger than the rest. Read as
        // the bind-off rather than a wild decrease row.
        const perEvent = SHAPING_PRESETS.paired.perEvent;
        const first = armhole.steps[0];
        const boundOff = first && Math.abs(first.delta) > perEvent ? Math.abs(first.delta) / 2 : 0;

        // The bind-off row stays in the row count. Tempting to remove - those stitches are not
        // decreased away over rows - but the two edge lengths are only comparable because each is
        // measured the same crude way, and docking a row from the armhole and none from the cap puts
        // bias into the one number this check turns on. Inside the planner it costs nothing: one more
        // row to decrease over is slack in a feasibility test.
        const plan = PlanSetInSleeve({
            bodyCount: armhole.from, shoulderCount: armhole.to,
            underarmCount: boundOff, armholeRows: armhole.rows,
            sleeveCount: cap.from, capRows: cap.rows, capTopCount: cap.to,
            rowsPerInch
        });
        report.plan = plan;
        report.armhole = armhole;
        report.cap = cap;
        report.boundOff = boundOff;

        add('The armhole is shaped into the body', 'pass',
            `${body.title} runs ${armhole.from} sts down to ${armhole.to} over `
            + `${plural(armhole.rows, 'row')}`
            + (boundOff ? `, ${boundOff} of them bound off at each underarm.` : '.'));
        add('The cap is shaped into the sleeve', 'pass',
            `${sleeve.title} runs ${cap.from} sts down to ${cap.to} over ${plural(cap.rows, 'row')}.`);

        if (plan.armhole && !plan.armhole.feasible) {
            add('The armhole decreases work', 'fail', plan.armhole.warning);
        }
        if (plan.cap && !plan.cap.feasible) {
            add('The cap decreases work', 'fail', plan.cap.warning);
        }

        // The check the construction turns on, and the one nothing else in the app can make: two
        // edges sewn to each other have to be the same length.
        if (!isNum(plan.armholeEdgeInches) || !isNum(plan.capEdgeInches)) {
            add('The cap fits the armhole', 'skip',
                'Both edges are measured in inches, so this needs a row gauge. Measure a '
                + 'swatch on the Gauge Library tab.');
        } else if (plan.warning) {
            add('The cap fits the armhole', 'fail', plan.warning);
        } else {
            add('The cap fits the armhole', 'pass',
                `the cap edge is ${plan.capEdgeInches} in and the armhole edge is `
                + `${plan.armholeEdgeInches} in. They are seamed together, and they match.`);
        }
        return finish();
    }

    /**
     * Restates one row's numbers at every size.
     *
     * A row is scaled only where its number is a stitch count spanning the piece. A repeat length, a
     * turning chain or a fixed edging is left alone - scaling "ch 1, turn" into "ch 2, turn" would be
     * the generator inventing a fabric. Only the row's own resolved count is scaled, never its text.
     */
    function ScaleRowCounts({ baseCount = null, targetCounts = [], construction = 'drop',
                              repeat = null, strategy = 'nearest', parity = 'any' } = {}) {
        const kind = CONSTRUCTIONS[construction] || CONSTRUCTIONS.drop;
        // `supported` means the engine can plan the construction at all; scaling every row by one
        // width ratio is a stronger claim, and only a rectangle earns it. A raglan has a planner and
        // still cannot be graded this way.
        if (!kind.scalesByWidth) {
            return { supported: false, construction, reason: kind.reason, counts: [] };
        }
        if (!isNum(baseCount) || baseCount <= 0) {
            return { supported: true, construction, reason: '', counts: [] };
        }

        const counts = targetCounts.map(target => {
            if (!isNum(target)) return null;
            const scaled = baseCount * kind.plan({ baseCount, targetCount: target }).scale;
            // Fitted to the repeat the same way every other count in this engine is, so a
            // generated row cannot break a multiple the written one held.
            const fitted = RoundStitchCount({
                targetInches: scaled, stitchesPerInch: 1, repeat, strategy, parity
            });
            return fitted.stitches;
        });
        return { supported: true, construction, reason: '', counts };
    }

    /**
     * The size numbers written the way a pattern writes them.
     *
     * `parenthetical` is the near-universal crochet convention - the base size outside,
     * the rest in brackets - and `bracket` is the same with square brackets, which some
     * publishers require. `column` is one size per line for a pattern that prints its
     * sizes separately rather than inline.
     */
    function FormatSizeNumbers({ counts = [], notation = 'parenthetical', order = null,
                                 labels = [] } = {}) {
        const picked = Array.isArray(order) && order.length
            ? order.map(label => {
                const at = labels.indexOf(label);
                return at === -1 ? null : counts[at];
            })
            : counts;
        const shown = picked.map(n => (isNum(n) ? String(n) : '—'));
        if (!shown.length) return '';
        if (shown.length === 1) return shown[0];

        // Identical numbers across every size are written once, as a pattern does: "ch 1 (1, 1, 1)"
        // is noise a reader has to check before discarding.
        if (shown.every(n => n === shown[0])) return shown[0];

        const [base, ...rest] = shown;
        if (notation === 'bracket') return `${base} [${rest.join(', ')}]`;
        if (notation === 'column') {
            const names = Array.isArray(order) && order.length ? order : labels;
            return shown.map((n, i) => `${names[i] || `Size ${i + 1}`}: ${n}`).join('\n');
        }
        return `${base} (${rest.join(', ')})`;
    }

    // === 3b3. TESTER FEEDBACK === //

    /**
     * What a tester actually got, against what the grader said they would. The only check here with
     * evidence from outside the engine, so the only one that can catch a gauge or a chart being wrong
     * rather than a sum being wrong.
     *
     * tester: { name, size, bodyMeasurements: {point: in}, finished: {point: in},
     *           fitRatings: {area: 'tight'|'good'|'loose'}, modifications, gauge: {...} }
     */
    function CompareTesterFeedback({ tester = null, garment = [], gauge = {} } = {}) {
        const findings = [];
        if (!tester || !tester.size) return findings;

        const at = (point) => {
            const row = garment.find(r => r.point === point);
            const cell = row && row.sizes.find(c => c.size === tester.size);
            return cell || null;
        };

        // Predicted versus what came off the hook. A quarter inch is blocking and measuring; beyond
        // that the prediction was wrong about something.
        Object.keys(tester.finished || {}).forEach(point => {
            const actual = tester.finished[point];
            const cell = at(point);
            if (!isNum(actual) || !cell || !isNum(cell.target)) return;
            const gap = round2(actual - cell.target);
            if (Math.abs(gap) > 0.25) {
                findings.push({
                    tester: tester.name || 'tester', size: tester.size, point,
                    check: `${MEASUREMENT_LABELS[point] || point} came out ${gap > 0 ? 'larger' : 'smaller'}`,
                    detail: `predicted ${cell.target} in, measured ${actual} in (${signOf(gap)} in).`,
                    state: Math.abs(gap) > 1 ? 'fail' : 'warn'
                });
            }
        });

        // A tester working at a different gauge explains size differences that would otherwise look
        // like a grading fault, so it is reported before them.
        const effective = EffectiveGauge(gauge);
        const theirs = tester.gauge || {};
        if (isNum(theirs.stitchesPerInch) && isNum(effective.stitchesPerInch)
            && effective.stitchesPerInch > 0) {
            const off = round1(((theirs.stitchesPerInch - effective.stitchesPerInch)
                                / effective.stitchesPerInch) * 100);
            if (Math.abs(off) >= 5) {
                findings.push({
                    tester: tester.name || 'tester', size: tester.size, point: 'gauge',
                    check: 'Tester worked at a different gauge',
                    detail: `${theirs.stitchesPerInch} sts/in against the pattern's `
                          + `${round2(effective.stitchesPerInch)} (${signOf(off)}%) - `
                          + `size differences follow from this before anything else.`,
                    state: 'warn'
                });
            }
        }

        Object.keys(tester.fitRatings || {}).forEach(area => {
            const rating = tester.fitRatings[area];
            if (rating === 'good' || !rating) return;
            findings.push({
                tester: tester.name || 'tester', size: tester.size, point: area,
                check: `Fit reported ${rating} at the ${MEASUREMENT_LABELS[area] || area}`,
                detail: tester.modifications ? `modifications: ${tester.modifications}` : '',
                state: 'warn'
            });
        });

        (tester.problemRows || []).forEach(label => {
            findings.push({
                tester: tester.name || 'tester', size: tester.size, point: 'row',
                check: `Tester flagged ${label}`, detail: '', state: 'warn'
            });
        });

        return findings;
    }

    // === 3b4. GRADING CONFIDENCE === //

    /**
     * How much to trust one graded size, as a percentage with its reasons attached.
     *
     * Built like CalculatePatternHealth: start at 100 and deduct only for signals something else
     * already produced. Nothing here is an opinion about the design - a size scores badly because its
     * measurements were extrapolated past the chart, its counts round further than the others, or a
     * tester came back with a problem. Extrapolation is the biggest deduction because it is the one a
     * designer cannot see: a 5XL graded off a chart stopping at 2X looks as confident as a Medium.
     */
    function GradingConfidence({ size = '', garment = [], gauge = {}, chartSizes = null,
                                 warnings = [], testerFindings = [], modes = {} } = {}) {
        const reasons = [];
        let score = 100;
        const deduct = (points, reason) => { score -= points; reasons.push({ points, reason }); };

        const cells = garment
            .map(row => ({ row, cell: row.sizes.find(c => c.size === size) }))
            .filter(entry => entry.cell);

        if (!cells.length) {
            const reason = 'this size was not graded';
            return { size, score: 0, band: 'not graded',
                     reasons: [{ points: 100, reason }], mainIssue: reason };
        }

        // Measurement coverage: a point with no body figure was graded off nothing.
        const missing = cells.filter(entry => !isNum(entry.cell.body));
        if (missing.length) {
            deduct(Math.min(30, missing.length * 6),
                `${plural(missing.length, 'measurement')} had no body figure to grade from `
                + `(${missing.map(e => MEASUREMENT_LABELS[e.row.point] || e.row.point).join(', ')})`);
        }

        // Extrapolation: a size outside the chart the rest were graded against.
        if (Array.isArray(chartSizes) && chartSizes.length && chartSizes.indexOf(size) === -1) {
            deduct(20, `${size} sits outside the supplied size chart, so its measurements `
                     + `were extrapolated rather than read`);
        }

        // Gauge completeness.
        const effective = EffectiveGauge(gauge);
        if (!(isNum(effective.stitchesPerInch) && effective.stitchesPerInch > 0)) {
            deduct(25, 'no stitch gauge, so no width converts to a count');
        }
        if (!(isNum(effective.rowsPerInch) && effective.rowsPerInch > 0)
            && cells.some(entry => entry.row.axis === 'length')) {
            deduct(15, 'no row gauge, so every length is a guess printed as a number');
        }
        if (effective.stitchSource === 'unwashed' && effective.rowSource === 'unwashed') {
            deduct(4, 'gauge was measured unwashed, so the finished garment may not match');
        }

        // A measurement set by hand is only as good as the hand that set it - not a criticism, just
        // less certain than a chart.
        const manual = cells.filter(entry => !entry.cell.fromChart).length;
        const byMode = Object.keys(modes || {}).filter(k => modes[k] === 'manual').length;
        if (manual + byMode > 0) {
            deduct(Math.min(12, (manual + byMode) * 3),
                `${plural(manual + byMode, 'measurement')} set by hand rather than graded`);
        }

        // Rounding deviation: how far the whole-number counts sit from their targets.
        const drifts = cells
            .filter(entry => isNum(entry.cell.differenceInches))
            .map(entry => Math.abs(entry.cell.differenceInches));
        if (drifts.length) {
            const worst = Math.max(...drifts);
            if (worst > 0.5) deduct(10, `a count rounds ${round2(worst)} in away from its target`);
            else if (worst > 0.25) deduct(4, `a count rounds ${round2(worst)} in away from its target`);
        }

        // Everything the fit, proportion and cross-size checks already found. A warning about THIS
        // size counts for more than one about the run as a whole, which lands on every size equally
        // and would flatten the scores into saying nothing about which size to trust.
        const mine = warnings.filter(w => w.size === size);
        const shared = warnings.filter(w => w.size === 'across sizes');
        if (mine.length) {
            deduct(Math.min(20, mine.length * 5),
                `${plural(mine.length, 'unresolved warning')} against this size`);
        }
        if (shared.length) {
            deduct(Math.min(8, shared.length * 2),
                `${plural(shared.length, 'unresolved warning')} across the size run`);
        }

        // Evidence from outside the engine outranks everything inside it.
        const theirs = testerFindings.filter(t => t.size === size);
        if (theirs.length) {
            const failed = theirs.filter(t => t.state === 'fail').length;
            deduct(Math.min(30, failed * 15 + (theirs.length - failed) * 5),
                `${plural(theirs.length, 'tester finding')} on this size`);
        }

        score = Math.max(0, Math.min(100, Math.round(score)));
        // Sorted worst first: the headline reason should be the one that cost the most.
        reasons.sort((a, b) => b.points - a.points);
        return {
            size, score,
            band: score >= 90 ? 'high' : score >= 75 ? 'fair' : score >= 50 ? 'low' : 'very low',
            reasons,
            mainIssue: reasons.length ? reasons[0].reason : ''
        };
    }

    // === 3b2. YARN AND TIME PER SIZE === //

    /**
     * Roughly how long a stitch takes to work, in seconds, at an unhurried pace. A taller stitch is
     * more yarn-overs and more passes, so the scale follows the yardage costs rather than being a
     * second opinion about difficulty.
     */
    const SECONDS_PER_STITCH = {
        ch: 1.2, slst: 1.4, sc: 2.2, hdc: 2.6, dc: 3, tr: 3.8, dtr: 4.6,
        sc2tog: 3.4, hdc2tog: 3.8, dc2tog: 4.4, tr2tog: 5.2,
        fpdc: 3.8, bpdc: 3.8, fptr: 4.6, bptr: 4.6, picot: 4, popcorn: 9, bobble: 8,
        cluster: 7, shell: 7, puff: 7.5, vst: 6
    };
    const DEFAULT_SECONDS_PER_STITCH = 3;

    /**
     * What one size costs in yarn and hours, from that size's own stitch totals rather than scaled
     * off the sample.
     *
     * Scaling a sample's yardage by bust circumference is wrong in the direction that matters: yarn
     * goes as area, so a garment 10% wider and 10% longer needs about 21% more, and a size run that
     * only widens needs less than the bust ratio suggests. These totals come from the rows the
     * compiler actually evaluated for that size, so neither guess is involved.
     */
    function EstimateSizeEffort({ label = '', stitchTotals = {}, yarnWeightCategory = 4,
                                  safetyBuffer = 0.15, colorTotals = null } = {}) {
        const yarn = EstimateYarnYardage(stitchTotals, yarnWeightCategory, safetyBuffer);

        let seconds = 0;
        let stitches = 0;
        Object.entries(stitchTotals || {}).forEach(([stitch, count]) => {
            seconds += (SECONDS_PER_STITCH[stitch] || DEFAULT_SECONDS_PER_STITCH) * count;
            stitches += count;
        });

        // Per colour, when the pattern tracks them: a two-colour garment needs the right amount of
        // each, not the right amount in total.
        const colors = colorTotals
            ? Object.keys(colorTotals).map(code => ({
                code,
                stitches: Object.values(colorTotals[code] || {}).reduce((a, b) => a + b, 0),
                yards: EstimateYarnYardage(colorTotals[code], yarnWeightCategory, safetyBuffer).totalYards
            }))
            : [];

        return {
            label, stitches,
            yards: yarn.totalYards, meters: yarn.totalMeters, skeins: yarn.estimatedSkeins,
            exactYards: yarn.exactYards,
            // Seconds kept unrounded: comparing sizes on a figure already rounded to a hundredth of
            // an hour turns a 25% difference into 25.4%.
            seconds,
            hours: round2(seconds / 3600),
            colors
        };
    }

    /** The size run, each size measured on its own, with how much more it costs than the sample.
     *  The percentage is what a designer actually buys yarn against. */
    function CompareSizeEffort({ efforts = [], baseLabel = '' } = {}) {
        if (!Array.isArray(efforts) || !efforts.length) return [];
        const base = efforts.find(e => e.label === baseLabel) || efforts[0];
        return efforts.map(effort => ({
            ...effort,
            isBase: effort === base,
            yardsOverBase: base.exactYards ? round1(((effort.exactYards - base.exactYards) / base.exactYards) * 100) : null,
            hoursOverBase: base.seconds ? round1(((effort.seconds - base.seconds) / base.seconds) * 100) : null,
            stitchesOverBase: base.stitches ? round1(((effort.stitches - base.stitches) / base.stitches) * 100) : null
        }));
    }

    // === 3c1. MEASUREMENT DEPENDENCIES === //

    /**
     * Which measurements are worked out from which. A garment is not nine independent numbers: the
     * body circumference sets the front and back widths, which set where the armhole falls, which
     * sets the shoulder, which sets where the neckline sits, which sets what the cap has to match.
     *
     * Held as "this depends on these" rather than "this affects those", because that is the direction
     * a designer states it in - and the reverse is derived below, so the two cannot fall out of step.
     */
    const MEASUREMENT_DEPENDS_ON = {
        chest: [],
        waist: ['chest'],
        hip: ['chest'],
        crossBack: ['chest'],
        armholeDepth: ['chest', 'upperArm'],
        upperArm: ['chest'],
        backLength: [],
        armLength: ['upperArm'],
        backNeckToWrist: ['crossBack', 'armLength']
    };

    /**
     * Everything downstream of a measurement, in dependency order, without the measurement itself.
     * Walked breadth-first so the nearest consequences come first, and guarded against cycles: a
     * declared dependency loop should report what it can rather than hang the page.
     */
    function DependentsOf(point, graph = MEASUREMENT_DEPENDS_ON) {
        const affects = {};
        Object.keys(graph).forEach(key => {
            (graph[key] || []).forEach(source => {
                if (!affects[source]) affects[source] = [];
                affects[source].push(key);
            });
        });

        const out = [];
        const seen = new Set([point]);
        let frontier = affects[point] || [];
        while (frontier.length) {
            const next = [];
            frontier.forEach(key => {
                if (seen.has(key)) return;
                seen.add(key);
                out.push(key);
                (affects[key] || []).forEach(child => next.push(child));
            });
            frontier = next;
        }
        return out;
    }

    /**
     * What a change to one measurement reaches: the measurements downstream of it, and the sections
     * carrying them. Nothing is recalculated - the requirement is that changing one measurement
     * identifies what it affects rather than silently moving unrelated numbers, so this reports and
     * stops.
     *
     * sections: [{ key, title, points: ['chest', ...] }] - which measurements each piece is
     * responsible for, as classified by the designer.
     */
    function ImpactOfChange({ point = '', sections = [], graph = MEASUREMENT_DEPENDS_ON } = {}) {
        if (!point || !graph[point]) {
            return { point, dependents: [], sections: [], dependsOn: [], detail: '' };
        }
        const dependents = DependentsOf(point, graph);
        const reached = new Set([point, ...dependents]);

        const touched = (sections || [])
            .filter(section => (section.points || []).some(p => reached.has(p)))
            .map(section => ({
                key: section.key,
                title: section.title,
                points: (section.points || []).filter(p => reached.has(p))
            }));

        return {
            point,
            dependsOn: graph[point] || [],
            dependents,
            sections: touched,
            detail: dependents.length
                ? `Changing ${MEASUREMENT_LABELS[point] || point} reaches `
                  + dependents.map(p => MEASUREMENT_LABELS[p] || p).join(', ')
                : `${MEASUREMENT_LABELS[point] || point} has nothing downstream of it.`
        };
    }

    // === 3c2. GRADING CONSISTENCY === //

    /**
     * How much each measurement grows from one size to the next. A garment can grade perfectly at the
     * bust and still jump an inch and a half at the upper arm, which no single overall figure shows.
     *
     * Judged by judgeProgression, the same rule the health check uses, so a plateau reported here is
     * a plateau there. Every row is reported clean or not: a consistency report that only lists
     * problems cannot show consistency.
     *
     * garment: the output of GradeGarment.
     */
    function GradingIncrements(garment = []) {
        return garment.map(row => {
            const labels = row.sizes.map(cell => cell.size);
            // Widths are compared as the finished measurement, not the per-piece one: a half-panel
            // figure grades identically but reads at half scale.
            const values = row.sizes.map(cell => cell.target);
            const usable = values.every(isNum) && values.length > 1;

            // 'skip', not 'warn': one size grading against itself is not a fault, and calling it one
            // buries the real findings under a row per measurement.
            if (!usable) {
                return { point: row.point, label: row.label, axis: row.axis, sizes: labels,
                         values, steps: [], state: 'skip', uneven: false,
                         detail: 'not enough sizes to compare' };
            }

            const judged = judgeProgression(values, labels);
            const steps = judged.steps.map((delta, i) => ({
                from: labels[i], to: labels[i + 1], delta
            }));

            // "Even" means every step is the same number, not merely that none tripped the uneven
            // threshold. A run of 0.5, 1, 1, 0.7 passes and is still not even; reporting it as "even
            // steps of 0.5" would invent a consistency the measurements do not have.
            const identical = judged.steps.every(step => step === judged.steps[0]);

            let detail, kind;
            if (judged.shrinks.length) {
                kind = 'shrinks';
                detail = `gets smaller: ${judged.shrinks.join('; ')}`;
            } else if (judged.flats.length) {
                kind = 'plateau';
                detail = `no change between ${judged.flats.join('; ')}`;
            } else if (judged.uneven) {
                kind = 'uneven';
                detail = `steps of ${judged.steps.join(', ')} in`;
            } else {
                kind = identical ? 'even' : 'varies';
                detail = identical ? `even steps of ${judged.steps[0]} in`
                                   : `steps of ${judged.steps.join(', ')} in`;
            }

            return {
                point: row.point, label: row.label, axis: row.axis,
                sizes: labels, values, steps,
                state: judged.state, uneven: judged.uneven, kind, detail
            };
        });
    }

    // === 3c3. FIT AND PROPORTION === //

    /**
     * Proportion checks over a graded garment. Every one of these is a garment that would be made,
     * worn once and never worn again - a sleeve narrower than the arm going into it, a neck opening a
     * head will not pass through - and none is visible from any single measurement on its own.
     *
     * All warnings, never corrections. A designer may want a 2 in negative-ease sleeve; what they
     * cannot want is not to have noticed. Every check names the two numbers it compared, so the
     * judgement can be checked rather than taken on trust.
     *
     * garment: GradeGarment output. size: which size to check, or null for every size.
     */
    // How much wider than its armhole opening a sleeve can be and still be eased in. Set from the CYC
    // chart's own proportions, which sit a little over 1:1 at every size.
    const EASEABLE_CAP = 0.9;

    function CheckFitAndProportion({ garment = [], sizes = null, headCircumference = null,
                                     neckOpening = null, sections = [] } = {}) {
        const warnings = [];
        const byPoint = {};
        garment.forEach(row => { byPoint[row.point] = row; });

        const labels = (garment[0] ? garment[0].sizes : []).map(cell => cell.size)
            .filter(label => !sizes || sizes.includes(label));

        const at = (point, label) => {
            const row = byPoint[point];
            if (!row) return null;
            return row.sizes.find(cell => cell.size === label) || null;
        };
        const add = (size, check, detail) => warnings.push({ size, check, detail, state: 'warn' });

        labels.forEach(label => {
            const chest = at('chest', label);
            const upperArm = at('upperArm', label);
            const armhole = at('armholeDepth', label);

            // Positive ease that came out negative: the eased target is below the body measurement it
            // was eased from, so the ease was subtracted.
            if (chest && isNum(chest.body) && isNum(chest.target) && chest.eased
                && chest.target < chest.body) {
                add(label, 'Finished bust smaller than the body',
                    `body ${chest.body} in, finished ${chest.target} in - the ease is negative.`);
            }

            // A sleeve has to be wider than the arm inside it.
            if (upperArm && isNum(upperArm.body) && isNum(upperArm.target)
                && upperArm.target < upperArm.body) {
                add(label, 'Sleeve narrower than the upper arm',
                    `upper arm ${upperArm.body} in, sleeve ${upperArm.target} in.`);
            }

            // The armhole opening is the depth taken twice, front and back. A set-in cap is eased in,
            // so the sleeve is normally a little wider - the CYC chart's own proportions sit slightly
            // over. Flagged only once the opening falls below what easing can absorb, or the check
            // fires on the reference chart and becomes noise.
            if (armhole && upperArm && isNum(armhole.target) && isNum(upperArm.target)
                && upperArm.target > 0 && armhole.target * 2 < upperArm.target * EASEABLE_CAP) {
                add(label, 'Armhole too shallow for the sleeve',
                    `a ${armhole.target} in armhole gives a ${round1(armhole.target * 2)} in opening `
                    + `for a ${upperArm.target} in sleeve - about `
                    + `${round1(upperArm.target * EASEABLE_CAP / 2)} in of depth is needed.`);
            }

            // A head does not compress. The neck opening is a circumference the head passes through,
            // unless the garment opens with buttons or a placket.
            if (isNum(headCircumference) && isNum(neckOpening) && neckOpening < headCircumference) {
                add(label, 'Neck opening smaller than the head',
                    `opening ${round1(neckOpening)} in, head ${round1(headCircumference)} in - `
                    + `it needs an opening, or ${round1(headCircumference - neckOpening)} in more.`);
            }
        });

        // Pieces that are seamed together have to be the same length where they meet.
        (sections || []).forEach(section => {
            (section.joins || []).forEach(join => {
                const other = (sections || []).find(s => s.key === join.to);
                if (!other || !isNum(section.lengthInches) || !isNum(other.lengthInches)) return;
                const gap = Math.abs(round2(section.lengthInches - other.lengthInches));
                if (gap > 0.25) {
                    add(join.size || 'all sizes', 'Seamed edges do not match',
                        `${section.title} is ${section.lengthInches} in and ${other.title} is `
                        + `${other.lengthInches} in where they join - ${gap} in apart.`);
                }
            });
        });

        // Sizes that come out identical, and steps that jump. Same rule as the health check and the
        // consistency report.
        GradingIncrements(garment).forEach(row => {
            if (row.state === 'pass' || row.state === 'skip') return;
            // Named for what actually happened. "Does not grade" overstates a chart that simply
            // repeats a measurement across two sizes at the plus end, which the published tables do
            // on purpose and which the designer still wants to know.
            const check = row.kind === 'shrinks' ? `${row.label} gets smaller as sizes go up`
                        : row.kind === 'plateau' ? `${row.label} is the same in two sizes`
                        : `${row.label} grades unevenly`;
            warnings.push({ size: 'across sizes', check, detail: row.detail, state: 'warn' });
        });

        return warnings;
    }

    // === 3c4. CALCULATION TRACE === //

    /**
     * Every step between a body measurement and the stitch count that comes out of it, in order, each
     * with the number it produced. The tool is only worth trusting if the designer can see why it said
     * what it said, so nothing is computed a second way - the trace calls the same ApplyEase and
     * RoundStitchCount the grader uses and reports what they returned.
     *
     * `allocation` is the share of the finished measurement this piece carries: 0.5 for the front of
     * a two-piece body, 1 for a piece worked in the round.
     */
    function TraceMeasurement({ label = 'measurement', body = null, ease = null,
                                allocation = 0.5, axis = 'width', stitchesPerInch = null,
                                rowsPerInch = null, repeat = null, strategy = 'nearest',
                                parity = 'any', piece = 'half' } = {}) {
        const steps = [];
        const add = (name, value, note) => steps.push({ name, value, note: note || '' });
        const blank = { steps, finalCount: null, actualInches: null, actualEase: null, axis };

        // A length is not divided between two pieces and has no repeat running along it: the front and
        // back are each the full body length, and a "multiple of 6 + 1" describes a row, not a column.
        const isWidth = axis !== 'length';
        const density = isWidth ? stitchesPerInch : rowsPerInch;
        const unit = isWidth ? 'sts' : 'rows';

        if (!isNum(body)) return blank;

        add(`Body ${label}`, `${round2(body)} in`);
        const finished = ApplyEase(body, ease);
        const easeInches = round2(finished - body);
        add('Selected ease', `${signOf(easeInches)} in`,
            ease && ease.mode === 'percent' ? `${ease.value}% of the body measurement` : '');
        add(isWidth ? 'Finished circumference' : 'Finished length', `${round2(finished)} in`);

        const share = isWidth && isNum(allocation) && allocation > 0 ? allocation : 1;
        if (isWidth) {
            add('Piece allocation', `${round2(share * 100)}%`,
                share === 0.5 ? 'one of a front and a back' : '');
        }
        const target = round2(finished * share);
        // "Target armhole depth length" says length twice; a width needs the word, because "target
        // bust" alone could mean the circumference.
        add(isWidth ? `Target ${label} width` : `Target ${label}`, `${target} in`);

        if (!isNum(density) || density <= 0) {
            add('Gauge', 'not set', `no ${unit} count can be worked out without it`);
            return blank;
        }
        add('Gauge', `${round2(density)} ${unit}/in`);

        // Lengths come out of MeasurementToRows, which is plain rounding - no repeat to fit and no
        // strategy to apply, so saying otherwise would be theatre.
        const rounded = isWidth
            ? RoundStitchCount({ targetInches: target, stitchesPerInch: density, repeat, strategy, parity, piece })
            : { rawStitches: round2(target * density), stitches: MeasurementToRows(target, density), repeat: null };

        add(`Raw count`, `${rounded.rawStitches} ${unit}`);
        if (rounded.repeat) {
            add('Required multiple', rounded.repeat.label,
                rounded.plusSuppressed ? 'the border stitches drop in the round' : '');
        }
        add('Final count', `${rounded.stitches} ${unit}`,
            rounded.repeat ? `rounded ${strategy}` : '');

        // What the whole number actually makes, and what that does to the ease asked for. This is the
        // pair the grader exists to expose: a target is a decimal and a count is not, so the finished
        // measurement is rarely the one requested exactly.
        const actualInches = round2(rounded.stitches / density);
        add(isWidth ? `Actual ${label} width` : `Actual ${label}`, `${actualInches} in`);
        const actualWhole = round2(actualInches / share);
        const actualEase = round2(actualWhole - body);
        add(isWidth ? 'Actual total ease' : 'Actual difference', `${signOf(actualEase)} in`,
            actualEase === easeInches ? '' : `asked for ${signOf(easeInches)} in`);

        return { steps, finalCount: rounded.stitches, actualInches, actualEase, axis, rounding: rounded };
    }

    const signOf = (n) => `${n > 0 ? '+' : ''}${n}`;

    // === 3c5. MOTIF LAYOUT === //

    /**
     * A garment made of motifs does not grade by stitch count. A granny-square blanket grows a square
     * at a time, so the achievable widths are a coarse set of fixed steps and the target usually falls
     * between two of them.
     *
     * Reported as: what the whole motifs give, what the nearest layouts either side give, and what a
     * border would have to be to close the gap. Nothing is rounded silently - the point is that "6
     * motifs" and "7 motifs" are 4 inches apart and the designer has to choose.
     *
     * `join` is the width a joining seam adds between two motifs: zero for join-as-you-go with no gap,
     * a real number for a chain-space join.
     */
    function PlanMotifLayout({ targetInches = null, motifInches = null, joinInches = 0,
                               borderInches = 0, allowPartial = false } = {}) {
        const target = isNum(targetInches) ? targetInches : null;
        const motif = isNum(motifInches) && motifInches > 0 ? motifInches : null;
        const join = isNum(joinInches) && joinInches > 0 ? joinInches : 0;
        const border = isNum(borderInches) && borderInches > 0 ? borderInches : 0;

        const blank = { target, motifInches: motif, joinInches: join, borderInches: border,
                        count: null, layouts: [], fits: false, exact: false,
                        partial: null, warning: '' };
        if (target === null || motif === null) return blank;

        // n motifs carry n-1 joins between them, plus the border on both edges.
        const widthOf = (n) => n < 1 ? null : round2(n * motif + (n - 1) * join + border * 2);
        const usable = target - border * 2;
        if (usable <= 0) {
            return { ...blank, warning: `A ${border} in border on both edges already exceeds `
                                      + `the ${target} in target.` };
        }

        // The count whose width lands nearest the target, and its neighbours.
        const ideal = (usable + join) / (motif + join);
        const around = [Math.floor(ideal) - 1, Math.floor(ideal), Math.ceil(ideal), Math.ceil(ideal) + 1]
            .filter(n => n >= 1)
            .filter((n, i, all) => all.indexOf(n) === i);

        const layouts = around.map(n => {
            const width = widthOf(n);
            return {
                count: n, width,
                difference: round2(width - target),
                // What the border would have to become for this count to hit the target exactly.
                // Negative means the motifs already overshoot.
                borderToFit: round2((target - (n * motif + (n - 1) * join)) / 2),
                exact: width === target
            };
        });

        const best = layouts.reduce((closest, layout) =>
            Math.abs(layout.difference) < Math.abs(closest.difference) ? layout : closest, layouts[0]);

        // A partial motif is a real technique - a half square fills a neck edge - but it is a
        // decision, not a default, so it is only offered when asked for.
        const partial = allowPartial && best.difference !== 0
            ? round2((usable - (Math.floor(ideal) * motif + (Math.floor(ideal) - 1) * join)) / motif)
            : null;

        return {
            ...blank,
            count: best.count,
            layouts,
            fits: best.difference === 0,
            exact: best.difference === 0,
            partial,
            warning: best.difference === 0 ? ''
                : `No whole number of ${motif} in motifs makes ${target} in. `
                + `${best.count} gives ${best.width} in (${signOf(best.difference)} in); `
                + `a ${best.borderToFit} in border each side would close it.`
        };
    }

    // === 3d. SHAPING === //
    // Getting from one stitch count to another over a given number of rows. Every kind of shaping a
    // garment uses is the same arithmetic with a different number of stitches changed per shaping row,
    // so there is one distributor and a table of presets rather than a function per garment part.

    /**
     * How many stitches a single shaping row changes: a paired decrease takes one off each end, a
     * raglan one off each side of all four seams. Anything not listed is given as a plain number.
     */
    const SHAPING_PRESETS = {
        paired: { perEvent: 2, where: 'one stitch at each end of the row' },
        single: { perEvent: 1, where: 'one stitch at one end of the row' },
        centre: { perEvent: 2, where: 'one stitch each side of the center' },
        raglan: { perEvent: 8, where: 'one stitch each side of all four raglan seams' },
        yoke: { perEvent: 4, where: 'one stitch each side of two seams' }
    };

    function ordinal(n) {
        const teens = n % 100;
        if (teens >= 11 && teens <= 13) return `${n}th`;
        const last = n % 10;
        return `${n}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`;
    }

    // "stitch" takes -es and "row" takes -s, and both appear in the same sentences.
    const everyNth = (n) => n === 1 ? 'Every stitch' : `Every ${ordinal(n)} stitch`;

    const plural = (n, word) =>
        `${n} ${word}${n === 1 ? '' : /(?:ch|sh|s|x|z)$/.test(word) ? 'es' : 's'}`;
    const times = (n) => plural(n, 'time');

    /**
     * Spreads a change in stitch count over the rows available for it.
     *
     * Two plans come back, because the even one is not always possible. `plan` is the plain reading a
     * pattern usually prints - one interval repeated, leftover rows worked straight. `balanced` fills
     * every row exactly by mixing two intervals, which is what to write when the leftover rows would
     * land in the wrong place. Nothing is decided here; both are reported, as with every other number
     * in this engine that could have gone more than one way.
     */
    function DistributeShaping({ from = null, to = null, rows = null,
                                 preset = 'paired', perEvent = null } = {}) {
        const start = isNum(from) ? Math.round(from) : null;
        const end = isNum(to) ? Math.round(to) : null;
        const span = isNum(rows) ? Math.round(rows) : null;
        const chosen = SHAPING_PRESETS[preset] || SHAPING_PRESETS.paired;
        const step = isNum(perEvent) && perEvent > 0 ? Math.round(perEvent) : chosen.perEvent;

        const blank = {
            from: start, to: end, rows: span, delta: null, direction: 'none',
            perEvent: step, preset, where: chosen.where, events: null, feasible: false,
            even: false, plan: null, balanced: [], balancedText: '',
            leftoverRows: null, text: '', warning: ''
        };
        if (start === null || end === null || span === null || span < 1) return blank;

        const delta = end - start;
        if (delta === 0) {
            return { ...blank, delta: 0, direction: 'none', events: 0, feasible: true,
                     even: true, leftoverRows: span, text: 'No shaping: the count does not change.' };
        }

        const direction = delta > 0 ? 'increase' : 'decrease';
        const magnitude = Math.abs(delta);

        // A paired shaping cannot move an odd number of stitches, and saying so is more use than
        // rounding to the nearest number that happens to divide.
        if (magnitude % step !== 0) {
            return { ...blank, delta, direction,
                     warning: `${magnitude} stitches cannot be worked ${step} at a time. `
                            + `Nearest workable: ${Math.floor(magnitude / step) * step} or ${Math.ceil(magnitude / step) * step}.` };
        }

        const events = magnitude / step;
        if (events > span) {
            return { ...blank, delta, direction, events,
                     warning: `${plural(events, 'shaping row')} are needed but only ${span} `
                            + `${span === 1 ? 'row is' : 'rows are'} available. `
                            + `Work more than ${plural(step, 'stitch')} per row, or allow more rows.` };
        }

        const interval = Math.floor(span / events);
        const remainder = span % events;
        const everyWhat = interval === 1 ? 'row' : `${ordinal(interval)} row`;

        // Mixing two intervals uses every row exactly, which the single interval only does when the
        // division came out whole.
        const balanced = remainder === 0
            ? [{ interval, times: events }]
            : [{ interval: interval + 1, times: remainder }, { interval, times: events - remainder }];

        return {
            ...blank,
            delta, direction, events, feasible: true, even: remainder === 0,
            plan: { interval, times: events, leftoverRows: span - interval * events },
            balanced,
            // Written out here rather than by the caller: the ordinals and plurals are this engine's,
            // and a second copy elsewhere would drift.
            balancedText: balanced
                .map(part => `every ${part.interval === 1 ? 'row' : ordinal(part.interval) + ' row'} `
                           + times(part.times))
                .join(', then '),
            leftoverRows: span - interval * events,
            text: `${direction === 'increase' ? 'Increase' : 'Decrease'} ${step} `
                + `${step === 1 ? 'stitch' : 'stitches'} every ${everyWhat} ${times(events)}`
        };
    }

    /**
     * Spreads a number of points evenly across the stitches of one row or round: the increases of a
     * circular yoke, or the turning points of a set of short rows. Both are the same question - where
     * do N things go among M stitches - so both come through here rather than two functions that
     * would drift apart.
     */
    function SpaceEvenly({ total = null, points = null } = {}) {
        const stitches = isNum(total) ? Math.round(total) : null;
        const count = isNum(points) ? Math.round(points) : null;
        const blank = { total: stitches, points: count, every: null, remainder: null,
                        plan: [], even: false, feasible: false, text: '', warning: '' };
        if (stitches === null || count === null || count < 1) return blank;
        if (count > stitches) {
            return { ...blank, warning: `${count} points will not fit across ${stitches} stitches.` };
        }

        const every = Math.floor(stitches / count);
        const remainder = stitches % count;
        return {
            ...blank,
            every, remainder, feasible: true, even: remainder === 0,
            plan: remainder === 0
                ? [{ gap: every, times: count }]
                : [{ gap: every + 1, times: remainder }, { gap: every, times: count - remainder }],
            // "Every 1st stitch" is not something a pattern says.
            text: remainder === 0
                ? `${everyNth(every)}, ${times(count)}`
                : `${everyNth(every + 1)} ${times(remainder)}, then ${everyNth(every).toLowerCase()} ${times(count - remainder)}`
        };
    }

    // A whole row that is only "Ch 100." - no comma, nothing worked into it.
    const FOUNDATION_ONLY_RE = /^(?:ch|chain)\s*\d+\s*\.?$/i;

    /**
     * A row that is nothing but the foundation chain describes a chain, not fabric. It would otherwise
     * win "widest" - a ch 60 for a 59-stitch row overstates the piece - and counting it as a row of
     * height overstates the length.
     *
     * Both spellings have to be caught: a pattern opening "Ch 100." on its own line keeps that text as
     * an instruction, while "Row 1: ch 101, sc in 2nd ch from hook..." carries the chain in
     * step.initialChain and IS fabric.
     */
    function fabricRows(rows) {
        // A missing or non-numeric yield would propagate to a rendered "NaN in", which is worse than
        // showing nothing.
        const valid = (rows || []).filter(r =>
            r.status === 'valid' && Number.isFinite(r.evaluation && r.evaluation.calculatedYield));
        const first = valid[0];
        if (!first) return valid;
        const step = first.step || {};
        const chain = step.initialChain || 0;
        const chainIsWholeRow = chain > 0 && first.evaluation.calculatedYield === chain;
        const writtenAsChainOnly = FOUNDATION_ONLY_RE.test(String(step.instructionString || '').trim());
        return (chainIsWholeRow || writtenAsChainOnly) ? valid.slice(1) : valid;
    }

    /** The widest row of actual fabric, and how many rows of it there are. Split out because size
     *  grading needs the stitch count without needing a gauge. */
    function WidestFabricRow(rows) {
        const fabric = fabricRows(rows || []);
        if (!fabric.length) return null;
        const widest = fabric.reduce((best, r) =>
            r.evaluation.calculatedYield > best.evaluation.calculatedYield ? r : best, fabric[0]);
        return { label: widest.label, stitches: widest.evaluation.calculatedYield, rowCount: fabric.length };
    }

    /**
     * Turns stitch counts into a finished measurement, then names the CYC sizes it could be.
     *
     * It deliberately does NOT pick one. A 40 in finished bust is a Large with negative ease, a Medium
     * with classic ease, or a Small worn oversized - all three are real garments, and choosing between
     * them would be a guess reported as a fact. Every size whose implied ease lands in a recognised
     * band is listed instead.
     *
     * rows: the per-row output of evaluatePatternRows().
     * piece: 'half' for one of a front/back pair worked flat, where the measured width is half the
     *        finished circumference.
     */
    function CalculateFinishedSize({ rows = [], gauge = null, category = '', piece = 'round' } = {}) {
        const blank = { available: false, matches: [], outOfRange: false, charted: false };
        if (!gauge || !(gauge.stitchDensity > 0)) return blank;

        const fabric = fabricRows(rows);
        if (!fabric.length) return blank;

        // stitchDensity is per gauge unit, so a cm gauge needs converting before it can meet the
        // charts, which are in inches.
        const perInch = gauge.unit === 'cm' ? gauge.stitchDensity * CM_PER_INCH : gauge.stitchDensity;
        const rowsPerInch = gauge.unit === 'cm' ? gauge.rowDensity * CM_PER_INCH : gauge.rowDensity;

        const widest = fabric.reduce((best, r) =>
            r.evaluation.calculatedYield > best.evaluation.calculatedYield ? r : best, fabric[0]);

        // No stitches means no fabric. A zero or negative width is not a measurement worth reporting,
        // and quoting one would only look authoritative.
        if (!(widest.evaluation.calculatedYield > 0)) return blank;

        // Ease is derived from the rounded figure that gets displayed, so the number on screen and the
        // ease quoted beside it always agree.
        const widthInches = round1(widest.evaluation.calculatedYield / perInch);
        const circumferenceInches = round1(piece === 'half' ? widthInches * 2 : widthInches);
        const lengthInches = rowsPerInch > 0 ? round1(fabric.length / rowsPerInch) : null;

        const result = {
            available: true,
            widestRow: { label: widest.label, stitches: widest.evaluation.calculatedYield },
            rowsCounted: fabric.length,
            widthInches, circumferenceInches, lengthInches,
            piece,
            category,
            charted: false,
            usesEase: false,
            chartLabel: '', measureName: '',
            chartMin: null, chartMax: null,
            matches: [],
            outOfRange: false
        };

        const chart = CYC_BODY_MEASUREMENTS[category];
        if (!chart) return result;

        result.charted = true;
        result.usesEase = !EASELESS_CATEGORIES.has(category);
        result.chartLabel = chart.label;
        result.measureName = chart.measure;
        // Sizes now carry every measurement point, so the size match reads the one this chart is
        // indexed by rather than the whole entry.
        const sizing = ([, m]) => m[chart.measureKey];
        result.chartMin = Math.min(...chart.sizes.map(e => sizing(e).min));
        result.chartMax = Math.max(...chart.sizes.map(e => sizing(e).max));

        const candidates = chart.sizes.map(entry => {
            const [sizeLabel] = entry;
            const m = sizing(entry);
            const easeLow = round1(circumferenceInches - m.max);
            const easeHigh = round1(circumferenceInches - m.min);
            const midpoint = (easeLow + easeHigh) / 2;
            return { sizeLabel, min: m.min, max: m.max, easeLow, easeHigh, midpoint };
        });

        if (result.usesEase) {
            // The standard's own extremes are -4 and 6+, so a slightly wider window shows a near miss
            // and labels it rather than dropping it without a word.
            result.matches = candidates
                .filter(c => c.midpoint >= -4 && c.midpoint <= 8)
                .sort((a, b) => a.midpoint - b.midpoint)
                .map(c => ({ ...c, band: easeBandFor(c.midpoint) }));
        } else {
            const distance = (c) => circumferenceInches >= c.min && circumferenceInches <= c.max
                ? 0
                : Math.min(Math.abs(circumferenceInches - c.min), Math.abs(circumferenceInches - c.max));
            result.matches = candidates
                .slice()
                .sort((a, b) => distance(a) - distance(b))
                .slice(0, 2)
                .map(c => ({ ...c, band: '' }));
        }

        result.outOfRange = result.matches.length === 0;
        return result;
    }

    function GenerateFullReport(stepObjects, options = {}) {
        const yarnWeight = options.yarnWeight ?? 4;
        // options.rows is the evaluated pass, and is what makes "across" countable.
        const stitchTotals = AggregateStitchCounts(stepObjects, options.rows);
        const totalStitches = Object.values(stitchTotals).reduce((a, b) => a + b, 0);
        const yardage = EstimateYarnYardage(stitchTotals, yarnWeight);
        const difficulty = CalculateDifficulty(stitchTotals);
        const complexity = AnalyzeComplexity(stitchTotals);

        // options.gauge was carried in this report and never read until sizing arrived.
        const gauge = options.gauge || null;
        const sizing = CalculateFinishedSize({
            rows: options.rows || [],
            gauge,
            category: options.sizingCategory || '',
            piece: options.sizingPiece || 'round'
        });

        return {
            totalStitches,
            stitchTotals,
            yardage,
            difficulty,
            complexity,
            sizing,
            gauge,
            history: options.history || []
        };
    }

    // === 4. EXPORTS === //
    return {
        AggregateStitchCounts,
        EstimateYarnYardage,
        CalculateDifficulty,
        AnalyzeComplexity,
        // Shared with app.js, which draws the daily stitch roll from these keys. They are exactly the
        // tokens NormalizeAnalyticsToken emits into stitchTotals, so a rolled stitch is always one the
        // app can see the designer work - and the 1-5 weight beside it already states how hard the
        // stitch is, which is all a rarity tier needs.
        STITCH_COMPLEXITY_SCORES,
        CalculatePatternHealth,
        CalculateFinishedSize,
        CheckSizeGrading,
        CheckSizeConsistency,
        WidestFabricRow,
        CYC_BODY_MEASUREMENTS,
        MEASUREMENT_POINTS,
        MEASUREMENT_LABELS,
        CHART_CM_DISCREPANCIES,
        // Shared with app.js, which has no unit-conversion math of its own - both files used to carry
        // their own copy.
        CM_PER_INCH,
        round1,
        ResolveEase,
        ApplyEase,
        MeasurementToStitches,
        MeasurementToRows,
        FitToMultiple,
        NearestValidCounts,
        RoundStitchCount,
        round2,
        DistributeShaping,
        SpaceEvenly,
        SHAPING_PRESETS,
        GradingIncrements,
        TraceMeasurement,
        PlanMotifLayout,
        EstimateSizeEffort,
        CompareSizeEffort,
        CompareTesterFeedback,
        GradingConfidence,
        CONSTRUCTIONS,
        PlanRaglanYoke,
        PlanSetInSleeve,
        PlanCircularYoke,
        // Reading a written garment back as a shape and holding it to its construction. PieceSpan and
        // ShapedTail are exported alongside the check because they make it testable in isolation.
        PieceSpan,
        ShapedTail,
        CheckGarmentConstruction,
        GARMENT_ROLES,
        ScaleRowCounts,
        FormatSizeNumbers,
        SECONDS_PER_STITCH,
        SECTION_TYPES,
        DIMENSION_MODES,
        ApplyDimensionModes,
        CompileSizeReport,
        CrossSizeReport,
        MEASUREMENT_DEPENDS_ON,
        DependentsOf,
        ImpactOfChange,
        CheckFitAndProportion,
        EffectiveGauge,
        CheckGaugeCompleteness,
        GradeSizes,
        GradeGarment,
        ChartPoints,
        MEASUREMENT_AXIS,
        EASED_POINTS,
        GenerateFullReport
    };
})();