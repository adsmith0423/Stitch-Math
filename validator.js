/** Stitch Math - Crochet Math & Validation Engine */
window.CrochetMathEngine = (function() {
    
    // === 1. INTERNAL DICTIONARIES === //
    const stitchDictionary = {
        'ch': { cost: 0, yield: 1 }, 'chain': { cost: 0, yield: 1 },
        'sc': { cost: 1, yield: 1 }, 'single crochet': { cost: 1, yield: 1 },
        'hdc': { cost: 1, yield: 1 }, 'half double crochet': { cost: 1, yield: 1 },
        'dc': { cost: 1, yield: 1 }, 'double crochet': { cost: 1, yield: 1 },
        'tr': { cost: 1, yield: 1 }, 'treble': { cost: 1, yield: 1 },
        'dtr': { cost: 1, yield: 1 }, 'sl st': { cost: 1, yield: 1 },
        'slst': { cost: 1, yield: 1 }, 'slip stitch': { cost: 1, yield: 1 },
        'fsc': { cost: 0, yield: 1 }, 'fhdc': { cost: 0, yield: 1 },
        'fdc': { cost: 0, yield: 1 }, 'ftr': { cost: 0, yield: 1 },
        'inc': { cost: 1, yield: 2 }, 'sc inc': { cost: 1, yield: 2 },
        'hdc inc': { cost: 1, yield: 2 }, 'dc inc': { cost: 1, yield: 2 },
        'tr inc': { cost: 1, yield: 2 }, 'sc-inc': { cost: 1, yield: 2 }, 
        'hdc-inc': { cost: 1, yield: 2 }, 'dc-inc': { cost: 1, yield: 2 },
        'tr-inc': { cost: 1, yield: 2 },
        // N stitches worked into one. expandIntoOneGroups rewrites "(hdc, dc, hdc) in next st" to
        // the matching token, so keep the range wide enough for shells and fans.
        // '0in1'/'1in1' exist for the chain-space discount convention below: a corner group whose
        // chains are excluded from the count can fold to as few as zero or one real stitch.
        '0in1': { cost: 1, yield: 0 }, '1in1': { cost: 1, yield: 1 },
        '2in1': { cost: 1, yield: 2 }, '3in1': { cost: 1, yield: 3 }, '4in1': { cost: 1, yield: 4 },
        'dec': { cost: 2, yield: 1 }, 'invdec': { cost: 2, yield: 1 },
        'sc2tog': { cost: 2, yield: 1 }, 'hdc2tog': { cost: 2, yield: 1 },
        'dc2tog': { cost: 2, yield: 1 }, 'tr2tog': { cost: 2, yield: 1 },
        'sc-dec': { cost: 2, yield: 1 }, 'hdc-dec': { cost: 2, yield: 1 },
        'dc-dec': { cost: 2, yield: 1 }, 'tr-dec': { cost: 2, yield: 1 },
        'sc3tog': { cost: 3, yield: 1 }, 'dc3tog': { cost: 3, yield: 1 },
        'fpsc': { cost: 1, yield: 1 }, 'bpsc': { cost: 1, yield: 1 },
        'fphdc': { cost: 1, yield: 1 }, 'bphdc': { cost: 1, yield: 1 },
        'fpdc': { cost: 1, yield: 1 }, 'bpdc': { cost: 1, yield: 1 },
        'puff': { cost: 1, yield: 1 }, 'popcorn': { cost: 1, yield: 1 },
        'pc': { cost: 1, yield: 1 }, 'bobble': { cost: 1, yield: 1 },
        'cl': { cost: 1, yield: 1 }, 'cluster': { cost: 1, yield: 1 },
        'sk': { cost: 1, yield: 0 }, 'skip': { cost: 1, yield: 0 },

        // --- Taller basics. Height changes the look, not the arithmetic: one in, one out.
        'treble crochet': { cost: 1, yield: 1 },
        // --- UK half treble = US hdc. Arithmetic is identical, so this is safe to accept without
        // asking which terminology the pattern uses.
        'htr': { cost: 1, yield: 1 }, 'half treble': { cost: 1, yield: 1 },
        'half treble crochet': { cost: 1, yield: 1 },
        'double treble': { cost: 1, yield: 1 }, 'dbltr': { cost: 1, yield: 1 },
        'trtr': { cost: 1, yield: 1 }, 'triple treble': { cost: 1, yield: 1 },
        'qtr': { cost: 1, yield: 1 }, 'quadruple treble': { cost: 1, yield: 1 },

        // --- Worked-differently 1:1 variants. Each still eats exactly one stitch.
        'esc': { cost: 1, yield: 1 }, 'exsc': { cost: 1, yield: 1 },
        'extended single crochet': { cost: 1, yield: 1 },
        'ehdc': { cost: 1, yield: 1 }, 'edc': { cost: 1, yield: 1 },
        'extended double crochet': { cost: 1, yield: 1 },
        'ldc': { cost: 1, yield: 1 }, 'linked dc': { cost: 1, yield: 1 },
        'linked double crochet': { cost: 1, yield: 1 },
        'wsc': { cost: 1, yield: 1 }, 'waistcoat': { cost: 1, yield: 1 },
        'waistcoat stitch': { cost: 1, yield: 1 },
        'ssc': { cost: 1, yield: 1 }, 'spike': { cost: 1, yield: 1 },
        'spike sc': { cost: 1, yield: 1 }, 'spike single crochet': { cost: 1, yield: 1 },
        'stsc': { cost: 1, yield: 1 }, 'standing sc': { cost: 1, yield: 1 },

        // --- Post stitches, extending the fp/bp family. Worked around the post, still one in, one out.
        'fptr': { cost: 1, yield: 1 }, 'bptr': { cost: 1, yield: 1 },
        'fpdtr': { cost: 1, yield: 1 }, 'bpdtr': { cost: 1, yield: 1 },
        'fpslst': { cost: 1, yield: 1 }, 'bpslst': { cost: 1, yield: 1 },
        'front post single crochet': { cost: 1, yield: 1 },
        'back post single crochet': { cost: 1, yield: 1 },
        'front post double crochet': { cost: 1, yield: 1 },
        'back post double crochet': { cost: 1, yield: 1 },

        // --- Foundation stitches build their own base, so they consume nothing.
        'fdtr': { cost: 0, yield: 1 },
        'foundation single crochet': { cost: 0, yield: 1 },
        'foundation half double crochet': { cost: 0, yield: 1 },
        'foundation double crochet': { cost: 0, yield: 1 },

        // --- Increases: n stitches worked into one.
        'dtr inc': { cost: 1, yield: 2 }, 'dtr-inc': { cost: 1, yield: 2 },
        '5in1': { cost: 1, yield: 5 }, '6in1': { cost: 1, yield: 6 },
        '7in1': { cost: 1, yield: 7 }, '8in1': { cost: 1, yield: 8 },

        // --- Decreases: n stitches joined into one. Only the fixed "Ntog" forms; a bare "cluster
        // over next N" is pattern-defined.
        'hdc3tog': { cost: 3, yield: 1 }, 'tr3tog': { cost: 3, yield: 1 },
        'dtr2tog': { cost: 2, yield: 1 }, 'dtr3tog': { cost: 3, yield: 1 },
        'sc4tog': { cost: 4, yield: 1 }, 'hdc4tog': { cost: 4, yield: 1 },
        'dc4tog': { cost: 4, yield: 1 }, 'tr4tog': { cost: 4, yield: 1 },
        'sc5tog': { cost: 5, yield: 1 }, 'dc5tog': { cost: 5, yield: 1 },

        // --- Crossed/cabled pairs: worked out of order over two stitches, two in and two out.
        'cross st': { cost: 2, yield: 2 }, 'cross stitch': { cost: 2, yield: 2 },
        'crossed dc': { cost: 2, yield: 2 }, 'xdc': { cost: 2, yield: 2 },

        // --- Picot: a decorative chain loop closed on itself. Neither consumes a stitch nor adds one.
        'picot': { cost: 0, yield: 0 },

        // --- n-stitch clusters worked into ONE stitch. The leading number counts the legs, not the
        // base stitches consumed, so these stay a fixed 1 -> 1. (A cluster worked *over* n stitches
        // is a decrease - use the Ntog forms above.) The escaping makes "3-dc cl" and "3 dc cl"
        // both match.
        '2-dc cl': { cost: 1, yield: 1 }, '3-dc cl': { cost: 1, yield: 1 },
        '4-dc cl': { cost: 1, yield: 1 }, '5-dc cl': { cost: 1, yield: 1 },
        '3-tr cl': { cost: 1, yield: 1 }, '4-tr cl': { cost: 1, yield: 1 },

        // --- Mid-century American Thread spellings. Their books print stitch names spaced out and
        // equate "Short Double Crochet s d c OR Half Double Crochet h d c" in one abbreviation list:
        // one stitch, five spellings, all modern hdc.
        'sdc': { cost: 1, yield: 1 }, 's d c': { cost: 1, yield: 1 },
        'h d c': { cost: 1, yield: 1 }, 'half dc': { cost: 1, yield: 1 },
        'short double crochet': { cost: 1, yield: 1 },
        's c': { cost: 1, yield: 1 }, 'd c': { cost: 1, yield: 1 },
        'tr c': { cost: 1, yield: 1 }, 'd tr c': { cost: 1, yield: 1 },
        'tr tr c': { cost: 1, yield: 1 },
        'pc st': { cost: 1, yield: 1 }, 'popcorn st': { cost: 1, yield: 1 },

        // --- CYC master-list abbreviations we were missing, all fixed 1 -> 1 like the spelled-out
        // forms above. NOT added: CYC's "sh" (shell) - 3-dc, 5-dc and 7-dc shells are all common, so
        // it belongs in the custom dictionary rather than getting one invented cost and yield.
        'bo': { cost: 1, yield: 1 },
        'ps': { cost: 1, yield: 1 }, 'puff stitch': { cost: 1, yield: 1 },
        'etr': { cost: 1, yield: 1 }, 'extended treble': { cost: 1, yield: 1 },
        'extended treble crochet': { cost: 1, yield: 1 }
    };

    /**
     * What each stitch IS, for the Stitch Library panel. The dictionary above says what a stitch
     * COSTS; this says what it is called and, where the name does not carry it, how it is worked.
     *
     * Entries flagged `cyc: true` are quoted from the Craft Yarn Council's Crochet Abbreviations
     * Master List (p.1): `abbr` exactly as printed, `term` its Description column verbatim.
     * Everything else is Stitch Math's own wording and is marked `cyc: false`, so the panel never
     * credits the Council with a sentence it did not write. That is also why nothing here describes
     * HOW a CYC stitch is worked - the master list gives terms, not instructions, and inventing the
     * rest would put our words in its mouth.
     *
     * Keyed by the same spellings as the dictionary, since those are the tokens aggregation counts
     * under. One entry serves all the spellings of one stitch.
     */
    const stitchDefinitions = [
        // --- Craft Yarn Council master list -------------------------------------
        { abbr: 'ch', term: 'chain stitch', cyc: true, keys: ['ch', 'chain'] },
        { abbr: 'sc', term: 'single crochet', cyc: true, keys: ['sc', 'single crochet'] },
        { abbr: 'hdc', term: 'half double crochet', cyc: true, keys: ['hdc', 'half double crochet'] },
        { abbr: 'dc', term: 'double crochet', cyc: true, keys: ['dc', 'double crochet'] },
        { abbr: 'tr', term: 'treble crochet', cyc: true, keys: ['tr', 'treble', 'treble crochet'] },
        { abbr: 'dtr', term: 'double treble crochet', cyc: true, keys: ['dtr', 'double treble', 'dbltr'] },
        { abbr: 'trtr', term: 'triple treble crochet', cyc: true, keys: ['trtr', 'triple treble'] },
        { abbr: 'sl st', term: 'slip stitch', cyc: true, keys: ['sl st', 'slst', 'slip stitch'] },
        { abbr: 'sk', term: 'skip', cyc: true, keys: ['sk', 'skip'] },
        { abbr: 'inc', term: 'increase', cyc: true, keys: ['inc'] },
        { abbr: 'dec', term: 'decrease', cyc: true, keys: ['dec'] },
        { abbr: 'sc2tog', term: 'single crochet 2 stitches together', cyc: true, keys: ['sc2tog'] },
        { abbr: 'hdc2tog', term: 'half double crochet 2 stitches together', cyc: true, keys: ['hdc2tog'] },
        { abbr: 'dc2tog', term: 'double crochet 2 stitches together', cyc: true, keys: ['dc2tog'] },
        { abbr: 'tr2tog', term: 'treble crochet 2 stitches together', cyc: true, keys: ['tr2tog'] },
        { abbr: 'CL', term: 'cluster', cyc: true, keys: ['cl', 'cluster'] },
        { abbr: 'bo', term: 'bobble', cyc: true, keys: ['bo', 'bobble'] },
        { abbr: 'pc', term: 'popcorn stitch', cyc: true, keys: ['pc', 'popcorn'] },
        { abbr: 'ps or puff', term: 'puff stitch', cyc: true, keys: ['ps', 'puff', 'puff stitch'] },
        { abbr: 'esc', term: 'extended single crochet', cyc: true, keys: ['esc', 'exsc', 'extended single crochet'] },
        { abbr: 'ehdc', term: 'extended half double crochet', cyc: true, keys: ['ehdc'] },
        { abbr: 'edc', term: 'extended double crochet', cyc: true, keys: ['edc', 'extended double crochet'] },
        { abbr: 'etr', term: 'extended treble crochet', cyc: true, keys: ['etr', 'extended treble', 'extended treble crochet'] },
        { abbr: 'FPsc', term: 'front post single crochet', cyc: true, keys: ['fpsc', 'front post single crochet'] },
        { abbr: 'BPsc', term: 'back post single crochet', cyc: true, keys: ['bpsc', 'back post single crochet'] },
        { abbr: 'FPhdc', term: 'front post half double crochet', cyc: true, keys: ['fphdc'] },
        { abbr: 'BPhdc', term: 'back post half double crochet', cyc: true, keys: ['bphdc'] },
        { abbr: 'FPdc', term: 'front post double crochet', cyc: true, keys: ['fpdc', 'front post double crochet'] },
        { abbr: 'BPdc', term: 'back post double crochet', cyc: true, keys: ['bpdc', 'back post double crochet'] },
        { abbr: 'FPtr', term: 'front post treble crochet', cyc: true, keys: ['fptr'] },
        { abbr: 'BPtr', term: 'back post treble crochet', cyc: true, keys: ['bptr'] },
        { abbr: 'FPdtr', term: 'front post double treble crochet', cyc: true, keys: ['fpdtr'] },
        { abbr: 'BPdtr', term: 'back post double treble crochet', cyc: true, keys: ['bpdtr'] },

        // --- Not on the master list. Our own descriptions, saying how the stitch is worked wherever
        // the name does not.
        { abbr: 'fsc', term: 'foundation single crochet - lays its own base chain as it goes', cyc: false,
          keys: ['fsc', 'foundation single crochet'] },
        { abbr: 'fhdc', term: 'foundation half double crochet - lays its own base chain as it goes', cyc: false,
          keys: ['fhdc', 'foundation half double crochet'] },
        { abbr: 'fdc', term: 'foundation double crochet - lays its own base chain as it goes', cyc: false,
          keys: ['fdc', 'foundation double crochet'] },
        { abbr: 'ftr', term: 'foundation treble crochet - lays its own base chain as it goes', cyc: false, keys: ['ftr'] },
        { abbr: 'fdtr', term: 'foundation double treble crochet - lays its own base chain as it goes', cyc: false, keys: ['fdtr'] },

        { abbr: 'sc inc', term: 'single crochet increase - two worked into one stitch', cyc: false, keys: ['sc inc', 'sc-inc'] },
        { abbr: 'hdc inc', term: 'half double crochet increase - two worked into one stitch', cyc: false, keys: ['hdc inc', 'hdc-inc'] },
        { abbr: 'dc inc', term: 'double crochet increase - two worked into one stitch', cyc: false, keys: ['dc inc', 'dc-inc'] },
        { abbr: 'tr inc', term: 'treble crochet increase - two worked into one stitch', cyc: false, keys: ['tr inc', 'tr-inc'] },
        { abbr: 'dtr inc', term: 'double treble increase - two worked into one stitch', cyc: false, keys: ['dtr inc', 'dtr-inc'] },
        { abbr: '0in1', term: 'a chain space whose own chains are discounted from the stitch count', cyc: false, keys: ['0in1'] },
        { abbr: '1in1', term: '1 stitch worked into one stitch', cyc: false, keys: ['1in1'] },
        { abbr: '2in1', term: '2 stitches worked into one stitch', cyc: false, keys: ['2in1'] },
        { abbr: '3in1', term: '3 stitches worked into one stitch', cyc: false, keys: ['3in1'] },
        { abbr: '4in1', term: '4 stitches worked into one stitch', cyc: false, keys: ['4in1'] },
        { abbr: '5in1', term: '5 stitches worked into one stitch', cyc: false, keys: ['5in1'] },
        { abbr: '6in1', term: '6 stitches worked into one stitch', cyc: false, keys: ['6in1'] },
        { abbr: '7in1', term: '7 stitches worked into one stitch', cyc: false, keys: ['7in1'] },
        { abbr: '8in1', term: '8 stitches worked into one stitch', cyc: false, keys: ['8in1'] },

        { abbr: 'invdec', term: 'invisible decrease - two worked together under the front loops only', cyc: false, keys: ['invdec'] },
        { abbr: 'sc-dec', term: 'single crochet decrease - two worked together as one', cyc: false, keys: ['sc-dec'] },
        { abbr: 'hdc-dec', term: 'half double crochet decrease - two worked together as one', cyc: false, keys: ['hdc-dec'] },
        { abbr: 'dc-dec', term: 'double crochet decrease - two worked together as one', cyc: false, keys: ['dc-dec'] },
        { abbr: 'tr-dec', term: 'treble crochet decrease - two worked together as one', cyc: false, keys: ['tr-dec'] },
        { abbr: 'sc3tog', term: 'single crochet 3 stitches together', cyc: false, keys: ['sc3tog'] },
        { abbr: 'sc4tog', term: 'single crochet 4 stitches together', cyc: false, keys: ['sc4tog'] },
        { abbr: 'sc5tog', term: 'single crochet 5 stitches together', cyc: false, keys: ['sc5tog'] },
        { abbr: 'hdc3tog', term: 'half double crochet 3 stitches together', cyc: false, keys: ['hdc3tog'] },
        { abbr: 'hdc4tog', term: 'half double crochet 4 stitches together', cyc: false, keys: ['hdc4tog'] },
        { abbr: 'dc3tog', term: 'double crochet 3 stitches together', cyc: false, keys: ['dc3tog'] },
        { abbr: 'dc4tog', term: 'double crochet 4 stitches together', cyc: false, keys: ['dc4tog'] },
        { abbr: 'dc5tog', term: 'double crochet 5 stitches together', cyc: false, keys: ['dc5tog'] },
        { abbr: 'tr3tog', term: 'treble crochet 3 stitches together', cyc: false, keys: ['tr3tog'] },
        { abbr: 'tr4tog', term: 'treble crochet 4 stitches together', cyc: false, keys: ['tr4tog'] },
        { abbr: 'dtr2tog', term: 'double treble 2 stitches together', cyc: false, keys: ['dtr2tog'] },
        { abbr: 'dtr3tog', term: 'double treble 3 stitches together', cyc: false, keys: ['dtr3tog'] },

        { abbr: 'htr', term: 'half treble crochet - the UK name for the US half double crochet', cyc: false,
          keys: ['htr', 'half treble', 'half treble crochet'] },
        { abbr: 'qtr', term: 'quadruple treble crochet - taller again than a triple treble', cyc: false,
          keys: ['qtr', 'quadruple treble'] },
        { abbr: 'ldc', term: 'linked double crochet - each stitch picks up a loop from the post of the last, so there is no gap between them', cyc: false,
          keys: ['ldc', 'linked dc', 'linked double crochet'] },
        { abbr: 'wsc', term: 'waistcoat stitch - single crochet worked into the V at the center of the stitch below', cyc: false,
          keys: ['wsc', 'waistcoat', 'waistcoat stitch'] },
        { abbr: 'ssc', term: 'spike single crochet - worked down into a row below the working one', cyc: false,
          keys: ['ssc', 'spike', 'spike sc', 'spike single crochet'] },
        { abbr: 'stsc', term: 'standing single crochet - starts a new yarn with no turning chain', cyc: false,
          keys: ['stsc', 'standing sc'] },
        { abbr: 'fpslst', term: 'front post slip stitch - worked around the post of the stitch below from the front', cyc: false, keys: ['fpslst'] },
        { abbr: 'bpslst', term: 'back post slip stitch - worked around the post of the stitch below from the back', cyc: false, keys: ['bpslst'] },
        { abbr: 'cross st', term: 'cross stitch - two stitches worked out of order over the same two stitches', cyc: false,
          keys: ['cross st', 'cross stitch'] },
        { abbr: 'xdc', term: 'crossed double crochet - two worked out of order over the same two stitches', cyc: false,
          keys: ['crossed dc', 'xdc'] },
        { abbr: 'picot', term: 'picot - a small chain loop closed back on itself, worked as decoration', cyc: false, keys: ['picot'] },
        { abbr: '2-dc cl', term: '2-double crochet cluster - 2 legs joined into one stitch', cyc: false, keys: ['2-dc cl'] },
        { abbr: '3-dc cl', term: '3-double crochet cluster - 3 legs joined into one stitch', cyc: false, keys: ['3-dc cl'] },
        { abbr: '4-dc cl', term: '4-double crochet cluster - 4 legs joined into one stitch', cyc: false, keys: ['4-dc cl'] },
        { abbr: '5-dc cl', term: '5-double crochet cluster - 5 legs joined into one stitch', cyc: false, keys: ['5-dc cl'] },
        { abbr: '3-tr cl', term: '3-treble cluster - 3 legs joined into one stitch', cyc: false, keys: ['3-tr cl'] },
        { abbr: '4-tr cl', term: '4-treble cluster - 4 legs joined into one stitch', cyc: false, keys: ['4-tr cl'] },

        // --- Mid-century spellings. The stitch is a modern one and only the printing differs, so the
        // definition says which modern stitch it is.
        { abbr: 'sdc', term: 'short double crochet - the mid-century name for half double crochet', cyc: false,
          keys: ['sdc', 's d c', 'short double crochet'] },
        { abbr: 'hdc', term: 'half double crochet, spelled the mid-century way', cyc: false, keys: ['h d c', 'half dc'] },
        { abbr: 'sc', term: 'single crochet, spelled the mid-century way', cyc: false, keys: ['s c'] },
        { abbr: 'dc', term: 'double crochet, spelled the mid-century way', cyc: false, keys: ['d c'] },
        { abbr: 'tr', term: 'treble crochet, spelled the mid-century way', cyc: false, keys: ['tr c'] },
        { abbr: 'dtr', term: 'double treble crochet, spelled the mid-century way', cyc: false, keys: ['d tr c'] },
        { abbr: 'trtr', term: 'triple treble crochet, spelled the mid-century way', cyc: false, keys: ['tr tr c'] },
        { abbr: 'pc', term: 'popcorn stitch, spelled the mid-century way', cyc: false, keys: ['pc st', 'popcorn st'] }
    ];

    // Flattened for lookup by token name, which is how every caller reaches it.
    const stitchGlossary = {};
    stitchDefinitions.forEach(entry => {
        entry.keys.forEach(key => {
            stitchGlossary[key] = { abbr: entry.abbr, term: entry.term, cyc: entry.cyc };
        });
    });

    const CUSTOM_STITCHES = {};

    /**
     * How to read "repeat from * 3 times".
     *
     * 'exact'     - modern convention: 3 executions.
     * 'inclusive' - the mid-century publishers' convention, stated outright in their own abbreviation
     *               blocks: "repeat from * 3 times means 4 patterns in all." American Thread and
     *               Spool Cotton both mean this, though Spool writes "3 MORE times" - so the word
     *               "more" is not the signal, the house style is. Here "once" and "twice" are just
     *               words for N=1 and N=2 and become 2 and 3 executions; verified against the Yellow
     *               Bud Ruffle, whose rounds 6-8 run 1, "once", "twice" and must come out 1, 2, 3.
     *
     * The parenthesised form "(dc, ch 1) 4 times" is always exact in both conventions - the same
     * Bulkies abbreviation block that defines the asterisk rule says so.
     */
    let repeatConvention = 'exact';
    function setRepeatConvention(mode) {
        repeatConvention = mode === 'inclusive' ? 'inclusive' : 'exact';
    }
    function getRepeatConvention() { return repeatConvention; }

    /**
     * Whether a corner or chain space's own chains count toward the round's produced stitch total.
     *
     * 'count'    - the chains are worked stitches like any other and count in full. Stitch Math's
     *              long-standing default, and the convention every existing corner test is pinned to.
     * 'discount' - the chains are scaffolding, not stitches: "(dc, ch 2, dc) in ch-2 sp" produces 2,
     *              not 4. Some designers state this outright ("stitch count does not include the
     *              ch-2 corner spaces"); others just write counts that only add up under it.
     *
     * Scoped to genuine chain SPACES only (CH_SPACE_TARGET, via expandIntoOneGroups' isSpace flag) -
     * a group worked into a single plain stitch or chain ("(dc, ch 2, dc) in first ch") is a different,
     * pre-existing case this does not touch.
     */
    let chainSpaceConvention = 'count';
    function setChainSpaceConvention(mode) {
        chainSpaceConvention = mode === 'discount' ? 'discount' : 'count';
    }
    function getChainSpaceConvention() { return chainSpaceConvention; }

    // "N more times" is N+1 under both conventions; a bare "N times" depends on the house.
    function resolveRepeatCount(n, saidMore) {
        if (saidMore) return n + 1;
        return repeatConvention === 'inclusive' ? n + 1 : n;
    }

    function getFullDictionary() { 
        return { ...stitchDictionary, ...CUSTOM_STITCHES }; 
    }

    function getUsedStitches(instructionsList = []) {
        const used = new Set();
        instructionsList.forEach(line => {
            if (!line) return;
            const parsed = parseInstructions(line, 0);
            parsed.tokens.forEach(t => used.add(t.name));
        });
        return Array.from(used);
    }

    // === 2. TESTING & NORMALIZATION === //
    function normalizeForTesting(input) {
        let chunk = input.toLowerCase().trim();
        chunk = chunk.replace(/\bdc\s+decrease\b/gi, "dc2tog");
        chunk = chunk.replace(/\bdc\s+increase\b/gi, "dc-inc");
        chunk = chunk.replace(/\bdc\s+inc\b/gi, "dc-inc");
        chunk = chunk.replace(/\bsc\s+inc\b/gi, "sc-inc");
        chunk = chunk.replace(/\bskip\s+(\d+)\b/gi, "$1sk");
        chunk = chunk.replace(/\bsl\s+st\b/gi, "slst");
        chunk = chunk.replace(/\b(sc|hdc|dc|tr|dtr|slst)\s+in\s+(?:the\s+)?(?:next|last|final|first)\s+(\d+)\s*(?:sts?|stitches?)\b/gi, (_, stitch, count) => `${count} ${stitch}`);
        return chunk;
    }

    /**
     * The chain a round stands up on, and the stitch it stands in for. A turning chain is worked as N
     * chains but occupies the place of ONE stitch, which is what "ch 3 (counts as dc)" says: three
     * chains tall, one stitch wide. Counting it as three put every granny square and joined round two
     * or three stitches over, compounding round by round.
     *
     * The heights are conventional - each stitch needs a chain as tall as it is. A pattern that pairs
     * them differently is followed, not corrected: standing-chain conventions vary by designer, and
     * "ch 2 (counts as dc)" is a real house style for a looser fabric. The mismatch is reported as a
     * note so a genuine typo stays visible.
     */
    const STANDING_CHAIN_HEIGHTS = { sc: 1, hdc: 2, dc: 3, tr: 4, dtr: 5, trtr: 6 };

    /**
     * The same heights read in UK terminology, where the abbreviations name different stitches: a UK
     * "dc" is a US "sc" and stands on one chain, not three; a UK "tr" is a US "dc" and stands on
     * three, not four.
     *
     * This is the ONE place terminology reaches past the linter into how a row is read, and it can
     * only ever change a note. turningChainNote and standingChainNotes are advisory by construction -
     * the row's arithmetic already followed the pattern and stays valid whatever the note says (see
     * the comment on turningChainNote). So a project set to UK terms gets the right sentence, and no
     * count anywhere moves.
     */
    const UK_CHAIN_HEIGHTS = { dc: 1, htr: 2, tr: 3, dtr: 4, trtr: 5, qtr: 6 };

    /** Which height table a given terminology reads by. Anything but 'uk' - including the 'off'
     *  default and an unset project - gets the US table, which is what this app has always used. */
    let chainHeightMode = 'off';
    function setTerminology(mode) {
        chainHeightMode = (mode === 'us' || mode === 'uk') ? mode : 'off';
    }
    function standingChainHeights() {
        return chainHeightMode === 'uk' ? UK_CHAIN_HEIGHTS : STANDING_CHAIN_HEIGHTS;
    }

    /**
     * Rewrites "ch 3 (counts as dc)" to the one stitch it stands for. Runs on the raw instruction,
     * before the prose rules strip the "(counts as ...)" wording and leave a bare "ch 3" to be counted
     * as three.
     *
     * The replacement is "ch 1": one chain is already worth one stitch of yield and no cost, which is
     * exactly what a standing chain is worth. It substitutes for a stitch rather than consuming one -
     * whether the row also skips the stitch underneath is said separately by the skip rules.
     */
    function resolveStandingChains(text) {
        if (!text) return '';
        // The join says the same thing the parenthetical does, so it gets the same rewrite.
        const implied = impliedStandingChain(text);
        const withOpening = implied
            ? String(text).replace(/^(\s*)(?:ch|chain)\s*\d+\b/i, '$1ch 1')
            : String(text);
        return withOpening.replace(
            /\b(?:ch|chain)\s*(\d+)\s*\(\s*(?:this\s+)?counts?\s+as\b([^)]*)\)/gi,
            (whole, chains, named) => {
                if (/\bnot\b/i.test(named)) return whole;
                // "ch 4 (counts as dc, ch 1)" opens a granny round: the chain stands for a dc AND
                // leaves the ch-1 space separating the groups. Both are real, so both are kept.
                const alsoMakes = named.match(/\bch(?:ain)?\s*(\d+)/i);
                return alsoMakes ? ` ch 1 , ch ${alsoMakes[1]} ` : ' ch 1 ';
            }
        );
    }

    /**
     * A joined round closing "sl st to top of ch-3" has already said its opening chain is a stitch:
     * the top of a chain is only somewhere to join if the chain stands in the place of one. Rounds
     * that count their chain and never write "(counts as dc)" are the majority - the parenthetical is
     * the exception and the join is the rule - so reading only the parenthetical left every one of
     * them a stitch short of its own stated count, compounding into the round above.
     *
     * Only the round's OWN opening chain, and only when the heights agree. A round opening "ch 2" and
     * joining to the top of a ch-3 describes a chain this cannot see, and a guess would be worse than
     * leaving the count alone. A chain carrying its own "(counts as ...)" note has already answered
     * the question and is left to resolveStandingChains.
     *
     * @returns {number} the height of the opening chain the join names, or 0 for none
     */
    function impliedStandingChain(text) {
        const line = String(text || '');
        if (!line) return 0;
        const open = line.match(/^\s*(?:ch|chain)\s*(\d+)\b/i);
        if (!open) return 0;
        if (/^\s*(?:ch|chain)\s*\d+\s*\([^)]*count/i.test(line)) return 0;
        // "to join" and "to close" sit between the slip stitch and the chain as often as nothing does,
        // so a short gap is allowed - but not one long enough to reach across a comma into a
        // different clause.
        const join = line.match(
            /\b(?:sl\s*st|slst|slip\s+stitch|join)\b[^,;]{0,40}?\btop\s+of\s+(?:the\s+)?(?:beg(?:inning)?\s+)?ch(?:ain)?\s*-?\s*(\d+)\b/i);
        if (!join) return 0;
        return parseInt(join[1], 10) === parseInt(open[1], 10) ? parseInt(open[1], 10) : 0;
    }

    /**
     * A row that turns but never chains up to the height it is about to work. The count is unaffected
     * - fourteen dc into fourteen stitches is fourteen either way - so this is only ever a note and
     * the row stays valid.
     *
     * It has to be a note on the ROW, though. The health panel reports this at the pattern level
     * ("Turning chain not documented on any row"), which is easy to miss under an "Excellent" banner
     * and cannot say which row it means. That row showed a bare tick.
     *
     * Two things keep it off correctly-written work. "turn" has to be in THIS row: the common
     * "...dc in each st across, ch 3, turn." convention puts chain and turn at the end of the row
     * BEFORE, and the row after says neither, so requiring "turn" here stops that whole style being
     * flagged every other row. And sc is left alone - it is worked flush and most designers never
     * write its ch 1 - so only hdc and taller, which genuinely cannot reach.
     */
    /**
     * The tallest basic stitch named on a line, and how tall its chain is. Two callers need this and
     * need it to agree: the turning-chain note below, and the foundation-row skip inference in
     * section 8. A line naming no stitch in the table comes back at height 0 - "ldc" and "esc" are
     * deliberately not matched, because `\bdc\b` does not fire inside "ldc" and inventing a
     * prefix-stripping rule here would start guessing at stitches the table never claimed to cover.
     */
    function tallestStitch(line) {
        const heights = standingChainHeights();
        let tallest = null;
        let height = 0;
        Object.keys(heights).forEach(stitch => {
            if (heights[stitch] > height && new RegExp(`\\b${stitch}\\b`, 'i').test(line)) {
                tallest = stitch;
                height = heights[stitch];
            }
        });
        return { tallest, height };
    }

    function turningChainNote(text) {
        const line = String(text || '');
        if (!/\bturn\b/i.test(line)) return [];
        if (/\bch(?:ain)?\s*\d/i.test(line)) return [];

        const { tallest, height } = tallestStitch(line);
        if (height < 2) return [];

        return [`This row turns and works ${tallest}, which usually stands on a ch ${height}, `
            + 'but no turning chain is written. The count is unaffected.'];
    }

    /** Where a standing chain and the stitch it claims to stand for disagree with the conventional
     *  height. Advisory only - the count already followed the pattern. */
    function standingChainNotes(text) {
        const notes = [];
        const re = /\b(?:ch|chain)\s*(\d+)\s*\(\s*(?:this\s+)?counts?\s+as\s+(?:an?\s+)?([a-z]+)/gi;
        let m;
        while ((m = re.exec(String(text || ''))) !== null) {
            const chains = parseInt(m[1], 10);
            const stitch = m[2].toLowerCase();
            const expected = standingChainHeights()[stitch];
            if (expected && expected !== chains) {
                notes.push(`A standing chain for ${stitch} is usually ch ${expected}; this pattern writes ch ${chains}. Counted as the one ${stitch} the pattern says it is.`);
            }
        }
        return notes;
    }

    // === 3. CUSTOM STITCH MANAGEMENT === //

    /**
     * Colourwork patterns name yarns by letter and expect the reader to hold the mapping: "With A, ch
     * 146", "change to B in last dc", "Join C with sl st in seam". Without it "with a" reads as an
     * unknown stitch and fails the foundation row of every piece.
     *
     * Held by reference like CUSTOM_STITCHES, and for the same reason: callers keep the object and
     * expect to see later additions.
     */
    const COLOR_CODES = {};

    function addColorCode(code, name) {
        const key = String(code || '').trim().toUpperCase();
        if (!key) return { success: false, message: 'Color code cannot be empty.' };
        if (!/^[A-Z][A-Z0-9]?$/.test(key)) {
            return { success: false, message: 'Color code is a letter, as the pattern writes it (A, B, C).' };
        }
        COLOR_CODES[key] = String(name || '').trim();
        return { success: true, key };
    }

    function removeColorCode(code) {
        delete COLOR_CODES[String(code || '').trim().toUpperCase()];
    }

    function clearColorCodes() {
        Object.keys(COLOR_CODES).forEach(key => { delete COLOR_CODES[key]; });
    }

    /**
     * The colour vocabulary to look for. Single letters are recognised whether or not anything has
     * been entered, because that is the near-universal convention and a pattern has to work on first
     * paste; the dictionary adds the full names a particular pattern uses ("Creamsicle").
     */
    function colorAlternatives() {
        const named = Object.entries(COLOR_CODES)
            .flatMap(([code, name]) => [code, name])
            .filter(Boolean)
            .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        // Longest first so "Grey Heather" is consumed before a bare letter inside it.
        return [...new Set([...named, '[A-H]'])].sort((a, b) => b.length - a.length).join('|');
    }

    function stripColorReferences(text) {
        if (!text) return '';
        const colour = `(?:${colorAlternatives()})`;
        return String(text)
            .replace(new RegExp(String.raw`\b(?:and\s+)?chang(?:e|ing)\s+to\s+${colour}\b[^,;.]*`, 'gi'), ' ')
            .replace(new RegExp(String.raw`\bjoin\s+${colour}\s+(?=with\b)`, 'gi'), 'join ')
            .replace(new RegExp(String.raw`\b(?:with|using)\s+${colour}\s+only\b`, 'gi'), ' ')
            // A bare letter is only a colour where a colour can stand: at a clause break. "join with a
            // sl st" has to keep its "a", or the joining slip stitch starts counting as a stitch.
            .replace(new RegExp(String.raw`\b(?:with|using)\s+${colour}\s*(?=[,;.]|$)`, 'gi'), ' ')
            .replace(/\s+/g, ' ').trim();
    }

    /**
     * A pattern stitch is a repeat the designer defines once at the top and refers to afterwards:
     * "Ripple Pattern (worked over a multiple of 12 sts)", then "work in Ripple pattern as established
     * over next 60 sts". Without the definition those rows cannot be counted at all - the stitches are
     * somewhere else on the page.
     *
     * Stored as the repeat's own text rather than a pair of numbers, so a usage can be rewritten into
     * the ordinary asterisk repeat it stands for and counted by the same machinery as any other row.
     */
    const PATTERN_STITCHES = {};

    function addPatternStitch(name, body, options = {}) {
        const key = String(name || '').trim().toLowerCase();
        const text = String(body || '').trim();
        if (!key || !text) return { success: false, message: 'A pattern stitch needs a name and a repeat.' };

        const unit = parseInstructions(text, 0, 1);
        if (!unit.totalCost || unit.unrecognizedTokens.length) {
            return { success: false, message: `The repeat for "${name}" could not be read.` };
        }
        // The designer states the multiple the pattern is worked over, which is the same number the
        // repeat costs. Two independent figures agreeing is what makes this safe to take
        // automatically; disagreeing, one is wrong and neither should be trusted into the dictionary.
        if (options.multiple && options.multiple !== unit.totalCost) {
            return {
                success: false,
                message: `"${name}" says it is worked over a multiple of ${options.multiple} sts, but its repeat uses ${unit.totalCost}.`
            };
        }

        PATTERN_STITCHES[key] = { body: text, cost: unit.totalCost, yield: unit.totalYield };
        return { success: true, key, cost: unit.totalCost, yield: unit.totalYield };
    }

    function clearPatternStitches() {
        Object.keys(PATTERN_STITCHES).forEach(key => { delete PATTERN_STITCHES[key]; });
    }

    /** "Ripple Pattern (worked over a multiple of 12 sts)" - the line that names one. */
    function parsePatternStitchName(line) {
        const m = String(line || '').trim()
            .match(/^([A-Z][A-Za-z' -]{2,30}?\s+(?:pattern|stitch|st))\s*(?:\(\s*worked\s+over\s+a\s+multiple\s+of\s+(\d+)\s*sts?\s*\))?\s*$/i);
        if (!m) return null;
        return { name: m[1].trim(), multiple: m[2] ? parseInt(m[2], 10) : null };
    }

    /**
     * The stitch multiple a section is worked over, stated anywhere in its prose rather than only in a
     * pattern-stitch header: "Ch a multiple of 6 + 1". parsePatternStitchName only fires on a
     * definition line, and most patterns say this in a note or the foundation row instead.
     *
     * The literal phrase "multiple of" is required before the digit, and that is the whole safety of
     * it: without the anchor, "rep from * 6 more times" reads as a multiple of 6 and a section
     * silently acquires a constraint nobody wrote. The plus is only taken when it sits directly after
     * the multiple, so the trailing "(add 3 for the base ch)" cannot become the plus - that 3 is a
     * chain allowance, not part of the repeat.
     */
    function parseStitchMultiple(text) {
        const m = String(text || '')
            // "stitches" leads the alternation: ordered alternation would otherwise let "sts?" take
            // the "st" out of "stitches" and leave "itches plus 3" unmatched, dropping the plus.
            .match(/\bmultiples?\s+of\s+(\d+)\s*(?:stitches|sts?)?\s*(?:(?:\+|plus)\s*(\d+)\s*(?:stitches|sts?)?)?/i);
        if (!m) return null;
        const multiple = parseInt(m[1], 10);
        // A multiple of 1 constrains nothing, and 0 is not a repeat at all.
        if (!(multiple >= 2)) return null;
        return { multiple, plus: m[2] ? parseInt(m[2], 10) : 0 };
    }

    /**
     * Rewrites a reference to a pattern stitch into the asterisk repeat it stands for. Runs on the raw
     * instruction, before the prose strippers: "as established to last 5 sts" is one phrase to a
     * reader, but cleanModifiers takes the "last" out of it.
     */
    function expandPatternStitchUsage(text) {
        const names = Object.keys(PATTERN_STITCHES);
        if (!names.length || !text) return String(text || '');

        let out = String(text);
        names.forEach(key => {
            const unit = PATTERN_STITCHES[key];
            const named = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const lead = String.raw`(?:work|working|continue|continuing)\s+(?:even\s+)?(?:in|as)\s+${named}(?:\s+as\s+established)?`;
            const repeat = qualifier => ` * ${unit.body}; rep from * ${qualifier} `;

            out = out
                .replace(new RegExp(String.raw`${lead}\s+over\s+(?:the\s+)?next\s+(\d+)\s*sts?`, 'gi'),
                    (_, n) => repeat(`${Math.max(1, Math.round(parseInt(n, 10) / unit.cost))} times`))
                .replace(new RegExp(String.raw`${lead}\s+to\s+last\s+(\d+)\s*sts?`, 'gi'),
                    (_, n) => repeat(`to last ${n} sts`))
                // "to end of row", "to end of back sts", "to marker" - everything the
                // designer means by "carry on in pattern until the row runs out".
                .replace(new RegExp(String.raw`${lead}(?:\s+to\s+[a-z0-9 ]{0,24})?(?=[,.;]|$)`, 'gi'),
                    () => repeat('across'));
        });
        return out;
    }

    function addCustomStitch(name, cost, yieldVal) {
        const key = String(name).trim().toLowerCase();
        if (!key) return { success: false, message: 'Stitch name cannot be empty.' };

        const costNum = parseInt(cost, 10);
        const yieldNum = parseInt(yieldVal, 10);

        if (isNaN(costNum) || costNum < 0) return { success: false, message: 'Invalid stitch cost.' };
        if (isNaN(yieldNum) || yieldNum < 0) return { success: false, message: 'Invalid stitch yield.' };

        CUSTOM_STITCHES[key] = { cost: costNum, yield: yieldNum };
        return { success: true, key };
    }

    function removeCustomStitch(name) {
        delete CUSTOM_STITCHES[String(name).trim().toLowerCase()];
    }

    /** Drops every custom stitch. Mutated rather than reassigned, because the object is exported by
     *  reference and callers hold on to it. */
    function clearCustomStitches() {
        Object.keys(CUSTOM_STITCHES).forEach(key => { delete CUSTOM_STITCHES[key]; });
    }

    // === 4. RECURSIVE TOKENIZER & HELPERS === //
    // Printed patterns count small repeats in words as often as digits: "(hdc2tog) twice" is how every
    // ripple sleeve cap is written. Unlike the asterisk repeats below, a bracketed group takes the word
    // at face value - the convention argument is about "repeat from * N times", where the question is
    // whether the first pass counts, and "(x) twice" has no such ambiguity.
    const WORD_TIMES = { once: 1, twice: 2, thrice: 3 };

    // The "* ... repeat from *" construct, and the qualifier that means "as far as the row goes".
    // The expander and analyzeRepeatUnit both ask, and a spelling fixed in one but not the other is
    // how the two came to disagree about the same row.
    const ASTERISK_REPEAT_RE = /\*([^*]+?)\s*;?\s*(?:repeat|rep)\s+from\s+\*\s*([^,;]*)/i;
    const TO_END_RE = /across|around|to\s+end/i;

    function expandBracketRepeats(text) {
        if (!text) return '';
        let current = text;
        const innermostRegex = /(?:[\(\[\*])([^\(\)\[\]\*]+)(?:[\)\]\*])\s*(?:x|times|rep|\*)?\s*(\d+|once|twice|thrice)?/i;
        let depthLimit = 0;

        while (innermostRegex.test(current) && depthLimit < 50) {
            current = current.replace(innermostRegex, (_, body, count) => {
                const word = WORD_TIMES[String(count).toLowerCase()];
                const times = word || (count ? parseInt(count, 10) : 1);
                return ' ' + Array(times).fill(body.trim()).join(', ') + ' ';
            });
            depthLimit++;
        }
        return current.replace(/[\(\)\[\]\*]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * "(hdc, dc, hdc) in next st" - several stitches worked into ONE stitch, so it costs 1 and yields
     * 3. Rewritten to the equivalent Nin1 token rather than left to be split on commas and counted as
     * three. A trailing repeat count ("(sc, inc) 2 times") is a repeat group, not this.
     *
     * A chain space is one place to work into just as a stitch is, so "(3 dc, ch 2, 3 dc) in corner
     * ch-2 sp" - every granny corner - folds the same way. The target is left on the end rather than
     * consumed: what a chain space costs is the chains it was made from, and the tokenizer needs to
     * still see which space it was.
     */
    function expandIntoOneGroups(text, depth) {
        // Square-bracket-only text ("[sc, ch 1, sc] in each corner", no parens anywhere in the row)
        // used to skip this whole function: the guard checked only for '(', so a corner written with
        // brackets fell straight through to expandBracketRepeats and priced its two flanking stitch
        // groups separately instead of as one folded corner - see [[stitch-math-chain-space-corner]].
        if (!text || (text.indexOf('(') === -1 && text.indexOf('[') === -1)) return text || '';
        const dict = getFullDictionary();

        const fold = (whole, body, target, isSpace) => {
            const inner = parseInstructions(body, 0, depth + 1);
            if (!inner.totalYield || inner.unrecognizedTokens.length) return whole;
            // Under the discount convention, a chain space's own chains are scaffolding rather than
            // stitches: "(dc, ch 2, dc) in ch-2 sp" produces 2, not 4. Only the chains this group
            // itself writes are dropped - a group with no chain in its own body ("3 dc in next ch-2
            // sp") is working into a space made by an earlier round and is left untouched either way.
            //
            // isSpace also covers a group folded into a bare foundation chain ("(dc, ch 2, dc) in
            // first ch", how nearly every raglan yoke opens its first round) or an undeclared "sp" -
            // the chain a group writes into one of those positions creates a corner exactly as much
            // as one written "in ch-2 sp" does, it is just not yet named as a space because nothing
            // has worked into it a second time. A group folded into a real STITCH is left alone even
            // with a chain inside it ("(sc, ch 3, sc) in next st"): that shape is at least as often a
            // picot or a button loop as a corner, and unlike a width that is stated outright, there is
            // no text signal here to tell the two apart - discounting it silently would be a guess.
            let effectiveYield = inner.totalYield;
            if (isSpace && chainSpaceConvention === 'discount') {
                const chainYield = inner.tokens
                    .filter(t => t.name === 'ch' || t.name === 'chain')
                    .reduce((sum, t) => sum + t.yield, 0);
                effectiveYield = Math.max(0, effectiveYield - chainYield);
            }
            const token = `${effectiveYield}in1`;
            return dict[token] ? ` ${token}${target || ''} ` : whole;
        };

        // Square brackets group as parentheses do - "[2 dc, ch 2, 3 dc] in same sp" is one granny
        // corner - and a group followed by a target is never a repeat, so taking both cannot swallow a
        // "[...] x 3". Matched separately rather than as one character class, so a bracket nested
        // inside parens ("( [d tr c] 3 times over hook) in same space") still reads as one group.
        //
        // "corner" alone, with no "sp"/"space" after it, is still a chain-space target: "(3 dc, ch 2,
        // 3 dc) in each corner" is how most granny patterns actually write it, and requiring "sp" left
        // every one of those un-folded, so the group fell to expandBracketRepeats instead and its ch-2
        // priced as 2 real stitches - a corner correctly worked read as consuming 6 more than it did.
        // Excluded when "corner" is followed by "st"/"stitch": that names a real stitch AT the corner
        // position, not the space, and must keep costing what the stitch costs.
        const CH_SPACE_TARGET = String.raw`((?:in|into)\s+(?:the\s+)?(?:(?:same|next|one|corner|each)\s+)?(?:ch-?\s*\d+\s*(?:corner\s+)?(?:sp|space)s?|corner(?!\s+stitch|\s+st\b)(?:\s+(?:sp|space)s?)?))\b`;
        // A single chain is one place to work into exactly as a stitch is. A yoke worked from the neck
        // down puts its raglan increases into the foundation chain - "(hdc, ch 1, hdc) in next ch" -
        // and without "ch" here the group was split and charged as two chains instead of one, so the
        // opening round demanded four more chains than the foundation had.
        //
        // The lookahead keeps this off "in next ch-2 sp", which is a chain SPACE, priced and matched
        // differently by CH_SPACE_TARGET above. The noun is captured (not just matched) so the fold
        // above can tell a chain or an undeclared space - corner-shaped either way - from a real
        // stitch, which a chain inside the group does not turn into a space.
        const PLAIN_TARGET = String.raw`(?:in|into)\s+(?:the\s+)?(?:same|next|one|last|first)\s+(st|stitch|sp|space|ch|chain)s?\b(?!\s*-?\s*\d)`;
        const isChainOrSpace = noun => /^(?:ch|chain|sp|space)/i.test(noun);

        return text
            // Into a chain space: "(3 dc, ch 2, 3 dc) in next ch-2 sp". The target is kept so the
            // tokenizer can still see which space, and charge for it.
            .replace(new RegExp(String.raw`\(([^()]*)\)\s*${CH_SPACE_TARGET}`, 'gi'),
                (whole, body, target) => fold(whole, body, ' ' + target, true))
            .replace(new RegExp(String.raw`\[([^\[\]]*)\]\s*${CH_SPACE_TARGET}`, 'gi'),
                (whole, body, target) => fold(whole, body, ' ' + target, true))
            // Into a single stitch or chain, or a space named without its width. The target is
            // consumed here: with no ch-N there is nothing to price, and leaving the words changes how
            // the rest reads.
            .replace(new RegExp(String.raw`\(([^()]*)\)\s*${PLAIN_TARGET}`, 'gi'),
                (whole, body, noun) => fold(whole, body, '', isChainOrSpace(noun)))
            .replace(new RegExp(String.raw`\[([^\[\]]*)\]\s*${PLAIN_TARGET}`, 'gi'),
                (whole, body, noun) => fold(whole, body, '', isChainOrSpace(noun)));
    }

    // Longest first so "s d c" wins over "s c". Used wherever a rule names a stitch or the noun it is
    // worked into, because the mid-century books write both positions spaced out: "1 s c in each of
    // the next 2 s c".
    const SPACED = String.raw`s\s+d\s+c|d\s+tr\s+c|tr\s+tr\s+c|tr\s+c|s\s+c|d\s+c`;
    const STITCH_LEAD = String.raw`${SPACED}|sc2tog|hdc2tog|dc2tog|tr2tog|sc3tog|sdc|slst|hdc|dtr|inc|dec|sc|dc|tr`;
    // "ch" belongs here as well as in the stitch list: a foundation row is always worked into the
    // chain ("hdc in next 3 ch"), and without the noun the run count is lost and the row reads as a
    // single stitch. The rules using it all require an explicit "next/first N" ahead of the noun, so
    // "sc in 2nd ch from hook" is unaffected.
    const STITCH_NOUN = String.raw`${SPACED}|stitches?|spaces?|sts?|sps?|chains?|chs?|sdc|hdc|dtr|sc|dc|tr`;

    /**
     * The words a pattern puts between a count and the stitches it counts, to say WHICH ones: "hdc in
     * each of the 48 Back sts", "hdc in 3 underarm chs", "38 skipped sleeve sts". A garment worked in
     * one piece names its pieces constantly, and with no room for the name between the number and the
     * noun none of these counted at all - a body round working 108 was reported as working 4.
     *
     * Two words at most, each a plain word: enough for "skipped sleeve" and "Back", not enough to
     * swallow a clause. The noun after it is still required, so "in 5 rows" does not match.
     */
    const PIECE_NAME = String.raw`(?:[a-z][a-z-]*\s+){0,2}`;
    // "next 4 sts", but also "the 48 Back sts", where the number stands alone with no next/first/last.
    const COUNT_LEAD = String.raw`(?:next|last|final|first|remaining|rem|skipped|held)\s+`;

    /**
     * "S c in next s c, 2 s c in next s c, repeat from beg all around" means the same as an asterisk
     * repeat with the marker implied at the start of the row. Rewriting it to the explicit form lets
     * expandAsteriskRepeats do the work, including the repeat-convention handling.
     */
    function expandRepeatFromBeginning(text) {
        const line = String(text || '');
        if (!line || line.indexOf('*') !== -1) return line;
        const m = line.match(/^(.*?),?\s*(?:repeat|rep)\s+from\s+(?:the\s+)?(?:beginning|beg)\b\s*([^,;]*)/i);
        if (!m) return line;
        const body = m[1].trim().replace(/[,;]\s*$/, '');
        if (!body) return line;
        return `* ${body}, repeat from * ${m[2].trim()}`.trim();
    }

    /**
     * "*sc in next 2 sts, dc in next st; repeat from * across" - the asterisk form. expandBracketRepeats
     * treats '*' as a delimiter pair, which silently swallows the "repeat from" clause, so this has to
     * resolve first. Handles "N times [total]", "N more time(s)", "twice", "across/around/to end" and
     * "to last N sts".
     */
    function expandAsteriskRepeats(text, availableStitches, depth, availableCorners = 0) {
        if (!text || text.indexOf('*') === -1) return text || '';

        let current = text;
        const construct = ASTERISK_REPEAT_RE;

        for (let guard = 0; guard < 10; guard++) {
            const m = current.match(construct);
            if (!m) break;

            const body = m[1].replace(/[;,]\s*$/, '').trim();
            const qualifier = (m[2] || '').trim().toLowerCase();
            const expandedBody = expandBracketRepeats(body);
            const unit = parseInstructions(expandedBody, 0, depth + 1);
            // A body that COSTS nothing is still a real repeat. Chains, the foundation stitches and
            // picot all consume no existing fabric, so "*ch 2; rep from * 5 more times" is six chain
            // loops however little it takes; only a body that also MAKES nothing - pure prose - has
            // nothing to repeat. Turning cost-0 bodies away here handed them to expandBracketRepeats
            // instead, which reads '*' as an ordinary delimiter pair: it swallowed the "rep from"
            // clause into the repeated text and took the qualifier's number at face value, so every
            // "N more times" on a chain, picot or foundation repeat came out one pass short. The
            // guard belongs on the qualifiers that SIZE themselves by dividing the stitch pool, and
            // it has moved down to those two.
            if (!unit.totalCost && !unit.totalYield) break;

            // Everything outside the repeat still claims stitches; the repeat fills what is left.
            const rest = current.replace(m[0], ' ');
            const restCost = parseInstructions(expandBracketRepeats(rest), 0, depth + 1).totalCost;

            let times = null;
            let q;
            if ((q = qualifier.match(/(\d+)\s*(?:more\s+)?times?/i))) {
                times = resolveRepeatCount(parseInt(q[1], 10), /\bmore\b/i.test(qualifier));
            } else if ((q = Object.keys(WORD_TIMES).find(word => new RegExp(`\\b${word}\\b`, 'i').test(qualifier)))) {
                // Same words the bracket expander reads, from the same table - but routed through
                // resolveRepeatCount, because "repeat from * twice" carries the convention question
                // that "(x) twice" does not.
                times = resolveRepeatCount(WORD_TIMES[q], /\bmore\b/i.test(qualifier));
            } else if ((q = qualifier.match(/to\s+last\s+(?:(\d+)\s*)?sts?\b/i))) {
                // "to last st" is one stitch, written without the number the way English writes a
                // single anything. Requiring the digit left the repeat unexpanded, and the ribbing row
                // of every cardigan came out one over.
                const held = q[1] ? parseInt(q[1], 10) : 1;
                // Sized by dividing the stitches still to be worked, so a body that consumes none has
                // no answer here - left unexpanded rather than divided by zero.
                if (unit.totalCost > 0) {
                    times = Math.floor(Math.max(0, availableStitches - held) / unit.totalCost);
                }
            } else if (TO_END_RE.test(qualifier)) {
                // "to end" means until the round closes, not until the stitches run out. A granny
                // round's repeat takes in one corner and a square has four, so the round is over after
                // four passes however many stitches are left between them. Counted by corners rather
                // than stitches, it comes out at four repeats instead of the fourteen that dividing
                // the stitch count gives.
                times = (unit.cornersUsed > 0 && availableCorners > 0)
                    ? Math.floor(availableCorners / unit.cornersUsed)
                    // Same division, same guard: "to end" on a costless body cannot be sized by the
                    // stitches it would eat, so it is left alone.
                    : (unit.totalCost > 0
                        ? Math.floor(Math.max(0, availableStitches - restCost) / unit.totalCost)
                        : null);
            }

            if (!times || times < 1) break;
            current = current.replace(m[0], ` ${Array(times).fill(expandedBody).join(', ')} `);
        }

        return current;
    }

    /**
     * A slip stitch that closes a round ("sl st to join", "sl st to top of ch-3") is structural: it
     * consumes nothing and is never counted. One that WORKS into the fabric ("sl st in next st") is a
     * real stitch, so the distinction is the word that follows - join/form/first/top/beginning, never
     * next/each.
     *
     * The landmark is also written as a figure - "sl st to 1st hdc to join" closes every round of a
     * modern in-the-round pattern, and "ch 56, sl st to the 1st ch to form a ring" opens one. "1st" is
     * not in the list above, so neither was recognised, and the ring-forming join was charged against
     * a foundation that did not exist yet: the opening round failed and blocked the whole piece.
     *
     * Those are caught by their PURPOSE instead of their landmark. Naming any ordinal here would also
     * catch "Sl st to 1st ch 3, ch 4, 2 tr c cluster", where the slip stitch is a positioning move
     * into a row that carries on working - true of that row too, but it moves vintage-corpus counts
     * this is not for. A slip stitch that says it is there "to join" or "to form a ring" is structural
     * beyond argument, whatever landmark it names.
     */
    function stripJoiningSlipStitches(text) {
        if (!text) return '';
        return text
            .replace(/\bjoin(?:ing)?\s+with\s+(?:a\s+)?(?:sl\s*st|slst|slip\s+stitch)\b[^,;]*/gi, ' ')
            .replace(/\b(?:sl\s*st|slst|slip\s+stitch)\s+(?:to|in|into)\s+(?:the\s+)?(?:join|form|first|top|beg|beginning)\b[^,;]*/gi, ' ')
            .replace(/\b(?:sl\s*st|slst|slip\s+stitch)\s+(?:to|in|into)\s+[^,;.]*?\bto\s+(?:join|form)\b[^,;.]*/gi, ' ')
            // "sl st to ch-2 sp" opens a granny round: it walks the hook across to the corner it is
            // about to work into. Nothing is made, and the space it lands in is spent by the stitches
            // that follow - charging it here would spend it twice.
            .replace(/\b(?:sl\s*st|slst|slip\s+stitch)\s+(?:to|in|into)\s+(?:the\s+)?(?:next\s+|first\s+|same\s+)?ch-?\s*\d*\s*(?:sp|space)\b/gi, ' ')
            .replace(/\bjoin\s+(?:to\s+form|with)\b[^,;]*/gi, ' ')
            .replace(/\s+/g, ' ');
    }

    /**
     * Prose: the parts of a written pattern that describe what the hands do rather than what the hook
     * makes. None of it consumes or produces a stitch.
     *
     * Measured against 479 rows from four public-domain books, 53% were blocked by text of this kind
     * rather than by any missing stitch - and the densest prose sits in the OPENING rounds ("ch 6,
     * join to form a ring"), so it stopped the foundation count from ever being established and
     * blocked everything downstream.
     *
     * A table rather than a chain of replaces, so every rule carries its reason and can be tested on
     * its own. Anything NOT listed still fails the row: an uncatalogued phrase must never be mistaken
     * for prose and skipped, or a misspelled stitch would vanish and the count be wrong silently.
     */
    const NON_STITCH_PROSE = [
        {
            name: 'cluster-close',
            // "thread over and work off all loops at one time" - how a cluster is closed. The stitches
            // it closes are written separately and still counted. Listed before the bare yarn-over
            // rule so the whole phrase goes, not just its head.
            re: /\b(?:thread|yarn|wool)\s+over\s+and\s+(?:work\s+off|pull\s+through|draw\s+through)\b[^,;.]*/gi,
            why: 'closes a cluster whose stitches are counted separately'
        },
        {
            name: 'work-off-loops',
            re: /\b(?:work(?:ing)?\s+off|pull(?:ing)?\s+through|draw(?:ing)?\s+through)\s+(?:all\s+|both\s+|\d+\s+)?loops?\b[^,;.]*/gi,
            why: 'finishing the loops of a stitch already counted'
        },
        {
            name: 'keeping-loop-on-hook',
            re: /\bkeeping\s+(?:the\s+)?last\s+loop\s+of\s+each\b[^,;.]*/gi,
            why: 'describes holding a cluster open, not a stitch'
        },
        {
            name: 'yarn-over',
            // A yarn-over is part of making a stitch, never a stitch on its own.
            re: /\b(?:thread|yarn|wool)\s+over(?:\s+hook)?\b/gi,
            why: 'part of working a stitch, not a stitch'
        },
        {
            name: 'pull-up-loop',
            re: /\b(?:pull|draw)\s+(?:up\s+)?(?:a\s+|the\s+)?loop\b[^,;.]*/gi,
            why: 'part of working a stitch, not a stitch'
        },
        {
            name: 'insert-hook',
            re: /\binsert\s+(?:your\s+|the\s+)?(?:hook\s+)?(?:in|into|through)\b[^,;.]*/gi,
            why: 'positions the hook; the stitch worked there is named separately'
        },
        {
            name: 'fabric-side',
            // RS and WS say which face of the fabric is toward you: as a row marker ("Row 1 (RS):"),
            // as a direction ("From RS, draw up a loop of A"), and spelled out. Every published garment
            // pattern uses them and none were in the dictionary, so each failed its row as unknown.
            re: /\b(?:from|with|on)?\s*\b(?:rs|ws|right\s*side|wrong\s*side)\b(?:\s+facing(?:\s+you)?)?/gi,
            why: 'names which face of the fabric is toward you'
        },
        {
            name: 'attach-yarn',
            // "Attach yarn at the center (3rd chain) of the underarm chain." - where to put the hook to
            // begin a piece. It names chains and stitches, so it read as a row that works them, but
            // nothing is made until the round below starts. Only the bare attach: "join yarn with sl st
            // in next st, ch 2, hdc in each" goes on to work and is left to the join rules.
            re: /\battach\s+(?:the\s+)?(?:yarn|thread|colou?r|[A-Z])\b[^,;.]*/gi,
            why: 'says where to start a piece, not what to make'
        },
        {
            name: 'resume-in-place',
            // Picking a piece up where another left off: none of it works a stitch, and the stitch that
            // IS worked ("beg in same st as joining, hdc2tog") is written separately and still counted.
            re: /\b(?:beg|begin|beginning)\s+in\s+same\s+(?:st|stitch|sp|space)(?:\s+as\s+joining)?\b/gi,
            why: 'says where to start, not what to make'
        },
        {
            name: 'leave-unworked',
            re: /\bleave\s+(?:rem|remaining)?\s*(?:sts?|stitches?)?\s*unworked\b[^,;.]*/gi,
            why: 'stitches deliberately not worked in this row'
        },
        {
            name: 'ready-to-work',
            re: /\bso\s+that\s+you\s+are\s+ready\s+to\b[^,;.]*/gi,
            why: 'orients the work before the first stitch'
        },
        {
            name: 'join-verb',
            // Only as a verb: bare, or leading a location. NEVER as the object of "in" - "tr c in
            // joining" is a real treble worked into the join, and appears in the corpus. Eating
            // "joining" there would take the treble with it.
            re: /(?:^|[,;.]\s*)join\b(?:\s+(?:in|to|with|at)\b[^,;.]*)?/gi,
            why: 'joining is structural: it consumes no stitch'
        },
        {
            name: 'turn',
            // Longest forms first: "do not turn" alone left "your work" behind.
            re: /\b(?:do\s+not|don't|dont)\s+turn(?:\s+(?:your\s+)?work)?\b|\bturn(?:\s+(?:your\s+)?work)?\b(?:\s+so\b[^,;.]*)?/gi,
            why: 'changes direction only'
        },
        {
            name: 'do-not-join',
            // Spiral rounds say this; it is not at a clause boundary, so the join rule below - which
            // anchors to one - does not see it.
            re: /\b(?:do\s+not|don't|dont)\s+join\b/gi,
            why: 'says a round is not closed; makes nothing'
        },
        {
            name: 'loops-only',
            // "working in the back loops only" - cleanModifiers knows blo/flo, but not the sentence a
            // beginner pattern wraps around it.
            re: /\bwork(?:ing)?\s+in(?:to)?\s+(?:the\s+)?(?:back|front|third|3rd)\s+loops?\s+only\b/gi,
            why: 'says where to place the hook, not what to make'
        },
        {
            name: 'finishing',
            re: /\b(?:cut|break|fasten)\s+(?:off\s+)?(?:the\s+)?(?:thread|yarn|off)\b[^,;.]*/gi,
            why: 'finishing the work'
        },
        {
            name: 'fasten-off',
            re: /\bfasten\s+off\b[^,;.]*/gi,
            why: 'finishing the work'
        },
        {
            name: 'weave-ends',
            re: /\bweave\s+in\b[^,;.]*/gi,
            why: 'finishing the work'
        },
        {
            name: 'making-up',
            re: /\b(?:stuff|block|sew|seam|attach|stitch\s+together)\b[^,;.]*(?:piece|firmly|closed|ends|together|shut)[^,;.]*/gi,
            why: 'assembly, after the fabric is made'
        },
        {
            name: 'chain-that-is-not-a-stitch',
            // "Ch 2 (does not count as a st), turn" opens nearly every row of a modern garment pattern,
            // and the designer has said in as many words that it makes nothing. Listed before the
            // counts-as rule below, which would otherwise take only the parenthesis and leave the chain.
            re: /\b(?:ch|chain)\s*\d+\s*\(\s*(?:does\s+not|doesn'?t|do\s+not)\s+count\s+as\b[^)]*\)/gi,
            why: 'a turning chain the pattern says is not a stitch'
        },
        {
            name: 'counts-as',
            // "(counts as a dc)" - the note itself adds nothing. resolveStandingChains has already
            // turned the chain in front of it into the stitch it stands for, so only wording is left.
            re: /\(?\s*(?:this\s+)?counts?\s+as\b[^,;.)]*\)?/gi,
            why: 'names what a chain stands in for; adds no stitch'
        },
        {
            name: 'reassurance',
            // The -ing forms matter as much as the imperatives: an in-the-round pattern opens "Ch 56,
            // taking care not to twist the chain, sl st to the 1st ch", and without the participle here
            // "the chain" survived as a stitch.
            re: /\b(?:mak(?:e|ing)\s+sure|be(?:ing)?\s+careful|tak(?:e|ing)\s+care|don't\s+forget)\b[^,;.]*/gi,
            why: 'advice to the crocheter'
        },
        {
            name: 'spiral-note',
            re: /\bcontinue\s+working\s+in\s+a\s+spiral\b[^,;.]*/gi,
            why: 'describes construction, not a stitch'
        },
        {
            name: 'beginning-marker',
            // "beg"/"beginning" names the first stitch or space of a round - "3 dc in beg ch-sp", "dc
            // in top of beg ch-3" - not a stitch of its own, with no cost or yield to give it. Left
            // alone where "beg" is a definition ("beg = begin(ning)") or introduces a repeat ("repeat
            // from beg"): expandRepeatFromBeginning runs after this and needs that phrase intact.
            re: /(?<!from\s)(?<!from\s+the\s)\bbeg(?:inning)?\b(?!\s*=)/gi,
            why: 'names the first stitch or space, not a stitch itself'
        }
    ];

    function stripNonStitchProse(text) {
        if (!text) return '';
        let out = String(text);
        NON_STITCH_PROSE.forEach(rule => { out = out.replace(rule.re, ' '); });
        return out.replace(/\s+/g, ' ').trim();
    }

    /**
     * A stitch marker is not a stitch. It consumes nothing and produces nothing - it just tells the
     * crocheter where the round began, which is how a spiral round is tracked when there is no join to
     * mark the seam.
     *
     * Before this, every phrasing failed the row outright: "sm to first st" left the tokenizer with an
     * unrecognized "sm to", so a correctly written amigurumi pattern was reported as broken math.
     */
    function stripMarkerInstructions(text) {
        if (!text) return '';
        return text
            // "place/move/slip a stitch marker ..." through to the next clause break.
            .replace(/\b(?:place|move|slip|mark|remove)\s+(?:the\s+|a\s+)?(?:stitch\s+)?marker\b[^,;]*/gi, ' ')
            // Bare abbreviations: sm / pm, optionally with a target ("sm to 1st st").
            .replace(/\b(?:sm|pm)\b(?:\s+(?:to|in|into|on)\b[^,;]*)?/gi, ' ')
            // "marker" left on its own, and "mark the first st".
            .replace(/\b(?:stitch\s+)?marker\b[^,;]*/gi, ' ')
            .replace(/\bmark\s+(?:the\s+)?(?:first|1st|last|beg(?:inning)?)\b[^,;]*/gi, ' ')
            .replace(/\s+/g, ' ');
    }

    // A marker placed on the FIRST stitch is a spiral-round tell: it is how you find the start of the
    // next round when nothing joins it. A marker anywhere else is not - flat triangular shawls mark
    // the centre spine.
    const MARKS_FIRST_STITCH_RE = new RegExp([
        // A marker named explicitly, then the target: "sm to 1st st", "move marker to first st".
        '\\b(?:sm|pm|(?:place|move|slip|mark)(?:\\s+(?:the|a))?(?:\\s+stitch)?\\s+marker)\\b[^,;]*\\b(?:first|1st|beg(?:inning)?)\\b',
        // The verb form, which never says "marker" at all: "mark the first stitch".
        '\\bmark(?:\\s+the)?\\s+(?:first|1st|beg(?:inning)?)\\b'
    ].join('|'), 'i');

    function marksFirstStitch(text) {
        return MARKS_FIRST_STITCH_RE.test(String(text || ''));
    }

    function cleanModifiers(text) {
        if (!text) return '';
        let clean = text.replace(/[\(\[]\s*(?:color|col|cc|mc)\s*[a-z0-9]*\s*[\)\]]/gi, ' ');
        clean = clean.replace(/\b(?:change\s+to\s+)?(?:color|col)\s+[a-z0-9]+\b/gi, ' ');
        clean = clean.replace(/\b(?:in\s+)?(?:mc|cc\d*|ca|cb)\b/gi, ' ');
        clean = clean.replace(/\b(?:in\s+)?(?:the\s+)?(?:blo|flo|back\s+loop(?:\s+only)?|front\s+loop(?:\s+only)?|3rd\s+loop(?:\s+only)?|third\s+loop(?:\s+only)?)\b/gi, ' ');
        clean = clean.replace(/\b(?:blo|flo)([a-z]+)\b/gi, '$1');
        return clean.replace(/\s+/g, ' ').trim();
    }

    function parseMagicRing(instruction) {
        const clean = instruction.toLowerCase().trim();
        const mrRegex = /(?:(\d+)\s*([a-z]+)\s*(?:in|into)?\s*(?:mr|magic\s*(?:ring|circle)))|(?:(?:mr|magic\s*(?:ring|circle))\s*(?:with|of|:)?\s*(\d+)\s*([a-z]+)?)/i;
        const match = clean.match(mrRegex);
        if (match) return { isMagicRing: true, count: parseInt(match[1] || match[3] || '6', 10), stitchType: (match[2] || match[4] || 'sc').toLowerCase() };
        return { isMagicRing: false };
    }

    // Chain-ring openings as actually written: "ch 4, sl st to join", "ch 6, join with sl st to form a
    // ring", "2 dc in ring".
    const CHAIN_RING_RE =
        /\b(?:sl\s*st|slst|slip\s+stitch)\s+to\s+join\b|\bjoin(?:ing)?\s+with\s+(?:a\s+)?(?:sl\s*st|slst|slip\s+stitch)\b|\bto\s+form\s+(?:a\s+)?(?:ring|circle|loop)\b|\b(?:in|into)\s+(?:the\s+)?(?:ring|circle)\b/i;

    /**
     * Does this row open a piece worked in the round? A magic ring or a chain joined into a ring is
     * only ever used to start round work, so it settles the question on its own.
     *
     * parseChainRing() is deliberately not reused: it gives up above 12 chains, the right guard for
     * its own arithmetic and the wrong one for detection - a doily ring of 60 chains is still a ring.
     */
    function isRingStart(text) {
        const value = String(text || '');
        return parseMagicRing(value).isMagicRing || CHAIN_RING_RE.test(value);
    }

    /**
     * True when the row closes or opens a round with a slip stitch, as opposed to working slip stitches
     * into the fabric. Reuses the distinction stripJoiningSlipStitches already draws rather than
     * restating it: if stripping changed anything, there was a structural join in there.
     */
    function hasJoiningSlipStitch(text) {
        const value = String(text || '').replace(/\s+/g, ' ');
        return stripJoiningSlipStitches(value) !== value;
    }

    /**
     * "ch 13, sc in 2nd ch from hook and in each ch across" -> 12 stitches. The foundation chain is
     * consumed by the row that works back along it, so the yield is (chains - skipped): "2nd ch from
     * hook" skips 1, "3rd" skips 2 (hdc), "4th" skips 3 (dc). Requires the "in each ... across" clause
     * so a row working only one stitch into the chain is not caught by mistake.
     */
    /**
     * Garment patterns head the first row with a section label ("BACK: Ch 52, ..."), older books open
     * in prose ("Commence with a chain of 25 stitches, ..."), and mid-century ones name a colour first
     * ("With White ch 2, ..."). All three push the chain off the front of the line.
     */
    function stripRowPreamble(text) {
        return String(text || '').toLowerCase().trim()
            .replace(/^[a-z][a-z' ]{0,24}:\s*/i, '')
            .replace(/^(?:commence|start|starting|begin|beginning)\b[^,]*?\b(?:with|at)\s+(?:a\s+)?(?=ch(?:ain)?\b)/i, '')
            .replace(/^(?:with|using)\s+[a-z ]{0,20}?(?=ch(?:ain)?\s*\d)/i, '')
            // "stitches" before "sts": the shorter alternative would match the "st" of "stitches" and
            // leave "itches" behind.
            .replace(/^(?:ch|chain)\s+of\s+(\d+)\s*(?:stitches?|sts?)?\b/i, 'ch $1');
    }

    // Explicit section markers. Unambiguous: nobody writes a crochet row this way.
    const EXPLICIT_SECTION_RE = /^\s*(?:-{2,}|={2,}|#{1,3})\s*(.+?)\s*(?:-{2,}|={2,})?\s*$/;
    // How printed patterns actually head a piece.
    const CAPS_SECTION_RE    = /^\s*([A-Z][A-Z' ]{1,38})\s*:?\s*$/;          // SLEEVE
    const COLON_SECTION_RE   = /^\s*([A-Za-z][A-Za-z' ]{1,38})\s*:\s*$/;     // Sleeve:
    const MAKE_SECTION_RE    = /^\s*([A-Za-z][A-Za-z' ]{1,30})\s*\((?:make\s+)?\d+\s*\)\s*:?\s*$/i;  // Sleeve (make 2)

    /**
     * Is this line the title of a new piece rather than a row to work?
     *
     * The guard that makes this safe is that the line must contain no recognisable stitch. "BACK: Ch 52
     * (56, 60), s c in 2nd st from hook" is a row with a section label on the front - stripRowPreamble
     * handles that - and a typo like "sc in each st acroos" is still a row, because sc is known.
     *
     * A bare instruction such as "Join yarn" is deliberately NOT promoted to a section: it matches none
     * of the shapes below, and inventing a section there would silently reset the running stitch count,
     * which is the dangerous direction to be wrong in.
     */
    /**
     * How a row announces itself. One table, because three things read it: the parser, which strips the
     * label off an instruction; the line reflow, which uses it to tell a new row from the tail of the
     * previous one; and the classifier below, which treats a labelled line as work whatever it says. A
     * second hand-copied set would drift, and the symptom would be rows silently glued together.
     *
     * LABEL_MARKER is the parenthesised aside published patterns put between the number and the colon:
     * "Row 1 (RS):", "Row 3 (Decrease Row):". Optional everywhere and never carries a count.
     */
    const LABEL_MARKER = String.raw`(?:\s*\([^)]*\))?`;
    const ROW_WORD = String.raw`(?:Rows?|Rnds?|Rounds?)`;
    const ROW_LABELS = {
        // "Rows 4-9:", "Rnds 2-4."
        range: new RegExp(String.raw`^(?:${ROW_WORD}|R)\s*(\d+)\s*-\s*(\d+)${LABEL_MARKER}\s*[:.-]?\s*`, 'i'),
        // "Row 1:", "Rnd 3 (buttonhole rnd):"
        single: new RegExp(String.raw`^(?:${ROW_WORD}|R)\s*(\d+)${LABEL_MARKER}\s*[:.-]?\s*`, 'i'),
        // Ordinal-first labels: "2nd Round.", "Fourth row—", "13th and 14th Rows—". Both corpora write
        // them this way, and normalizeWordNumbers has already turned the spelled-out ones into digits.
        ordinalRange: new RegExp(String.raw`^(\d+)(?:st|nd|rd|th)?\s*(?:,|and|&|-|to)\s*(\d+)(?:st|nd|rd|th)?\s+${ROW_WORD}\b[\s.:—–-]*`, 'i'),
        // Either the ordinal suffix or a terminator has to be there. Without that guard "56 rows in Body
        // Stripe Sequence." reads as a label for row 56, and the prose it belongs to gets torn off the
        // line above and validated as work. normalizeWordNumbers has already turned "Fourth row—" into
        // "4 row—", which is why the suffix cannot simply be required.
        ordinalSingle: new RegExp(String.raw`^(\d+)(?:(?:st|nd|rd|th)\s+${ROW_WORD}\b[\s.:—–-]*|\s+${ROW_WORD}\b\s*[.:—–-]+\s*)`, 'i'),
        // Unnumbered labels. "Next 4 Rnds:" is four rows of the same instruction, as a range says too;
        // the others are a single row.
        nextCount: new RegExp(String.raw`^Next\s+(\d+)\s*${ROW_WORD}(?:\(s\))?${LABEL_MARKER}\s*[:.-]?\s*`, 'i'),
        unnumbered: new RegExp(String.raw`^(?:Next|Last|First|Decrease|Increase)\s+${ROW_WORD}(?:\(s\))?${LABEL_MARKER}\s*[:.-]?\s*`, 'i')
    };

    /** Does this line open a row of its own? */
    function looksLikeRowLabel(line) {
        const text = String(line || '').trim();
        return Object.values(ROW_LABELS).some(re => re.test(text));
    }

    /** The line with its row label removed. The table above knows every shape a label takes, so a
     *  caller stripping one with a pattern of its own is a second, narrower copy of it. Tried in
     *  declaration order, which is why `range` precedes `single`: against "Rows 4-9:" the single-row
     *  pattern would take "Rows 4-" and leave "9:" behind. */
    function stripRowLabel(line) {
        const text = String(line || '');
        for (const re of Object.values(ROW_LABELS)) {
            if (re.test(text)) return text.replace(re, '');
        }
        return text;
    }

    /** The row numbers a label states: {start, end}, both the same for a single row, and null for a
     *  label that carries no number ("Next Row:") - which is passed over rather than breaking a
     *  numbering chain. */
    function rowLabelNumbers(line) {
        const text = String(line || '').trim();
        for (const key of ['range', 'single', 'ordinalRange', 'ordinalSingle']) {
            const found = text.match(ROW_LABELS[key]);
            if (found && found[1]) {
                return { start: parseInt(found[1], 10), end: parseInt(found[2] || found[1], 10) };
            }
        }
        return null;
    }

    /**
     * Is this line work, a piece heading, or neither? A pasted pattern carries a good deal of text that
     * makes no fabric - "Sew shoulder seams.", "Move neck shaping marker as each row is worked.", the
     * copyright line. Validating those as rows produced 236 blocked rows out of 296 on a real cardigan:
     * the first fails and everything under it is blocked behind it.
     *
     * The one thing this must not do is quietly absorb a row. A labelled line is work whatever it says,
     * so a mistyped stitch under "Row 4:" still fails and still names itself - the same rule
     * NON_STITCH_PROSE follows, for the same reason.
     */
    function classifyPatternLine(line) {
        const raw = String(line || '').trim();
        if (!raw) return { kind: 'note', why: 'blank' };

        const section = parseSectionHeader(raw);
        if (section.isSection) return { kind: 'section', title: section.title };

        if (looksLikeRowLabel(raw)) return { kind: 'work', why: 'carries a row label' };

        // A specification, not an instruction. Checked before the stitch test because these lines are
        // written in stitches - "Gauge: 14 hdc x 10 rounds = 4in" read as a row of 140 hdc, failed for
        // want of a foundation, and blocked every row beneath it. Only the labels
        // parseMetadataStatement knows divert here, and a row label still wins, so "Round 4: ..." is
        // work whatever follows the colon.
        if (parseMetadataStatement(raw)) return { kind: 'note', why: 'states a pattern specification' };

        // A whole line inside brackets is an aside about the rows around it, not a row: "(Section
        // breakdown: Back = 48 hdc, Right Sleeve = 38 hdc)". Written in stitches, so it read as work and
        // failed. A row that merely ENDS in brackets is a row with its stitch count on it and is
        // untouched - the whole line has to be wrapped, opening bracket to closing.
        if (/^\([^()]*\)[.;]?$/.test(raw) || /^\[[^\[\]]*\][.;]?$/.test(raw)) {
            return { kind: 'note', why: 'an aside in brackets, not a row' };
        }

        if (parseInstructions(raw).tokens.some(t => t.count > 0)) {
            return { kind: 'work', why: 'works stitches' };
        }
        // A foundation chain makes no stitches yet, but it is the row everything after is measured against.
        if (/^(?:ch|chain)\s*\d+\s*[.,]?\s*$/i.test(stripRowPreamble(raw))) {
            return { kind: 'work', why: 'foundation chain' };
        }

        return { kind: 'note', why: 'no row label and no stitches' };
    }

    /**
     * The headings whose bodies are documentation rather than work. The classifier catches most
     * non-work text on its own, but these three blocks are written in the vocabulary of stitches -
     * "9 hdc + 8 rows = about 4 in.", "hdc2tog (hdc 2 sts together)" - so they read as rows and fail.
     * Deliberately short: PATTERN STITCH is not here, because its body really is rows and really
     * should be checked.
     */
    const DOC_HEADINGS = {
        gauge: /^gauges?$/i,
        stitches: /^(?:stitch\s+explanations?|abbreviations?|special\s+stitches?)$/i,
        // The notes a pattern gives before it starts. Their body is written entirely in the vocabulary
        // of stitches - "The ch 1 at the beginning of rounds does not count as a stitch" - so every line
        // read as a row, and the first to fail blocked the pattern underneath.
        //
        // "Pattern Instructions" is deliberately NOT here: it heads the pattern, not a block about it,
        // and listing it swallowed the foundation chain of everything under it. Specification headings
        // are not here either - their lines are labelled ("Gauge:") and parseMetadataStatement already
        // keeps them out of the matrix.
        notes: /^(?:pattern\s+)?(?:notes?|materials)$/i
    };

    function documentationBlock(title) {
        const name = String(title || '').trim();
        return Object.keys(DOC_HEADINGS).find(key => DOC_HEADINGS[key].test(name)) || null;
    }

    /**
     * The same question asked of a raw line rather than of a title already known to be a
     * heading. parseSectionHeader only calls something a heading when it is capitalised,
     * colon-terminated, marked with dashes or followed by "(make 2)" - so "Abbreviations"
     * and "Gauge", written plainly on a line of their own, were never titles at all and
     * documentationBlock above was never reached for them. This is the entry point for
     * text that has not been through the section classifier.
     */
    function documentationHeading(line) {
        const raw = String(line || '').trim().replace(/[:\s.-]+$/, '');
        // A heading stands alone. "Gauge: 14 hdc x 10 rounds" is a statement about the gauge, not the
        // heading of a block, and is read by parseGaugeStatement instead.
        if (!raw || raw.length > 40 || /[,;:]/.test(String(line))) return null;
        return documentationBlock(raw);
    }

    /**
     * Does this line start the pattern working again? It closes a documentation block, so it has to
     * catch both ways a piece opens: a numbered row, and a foundation chain with no number of its own
     * ("Foundation: Ch 56", "Ch 146."). Without the second, a Pattern Notes block ran straight over the
     * foundation below it and the first real round had nothing to work into.
     */
    function startsWorkSection(line) {
        const raw = String(line || '').trim();
        if (!raw) return false;
        if (looksLikeRowLabel(raw)) return true;
        return /^(?:(?:foundation|base|starting|set[-\s]?up)\s*(?:chain|ch|row|rnd|round)?\s*[:.\-]?\s*)?(?:ch|chain)\s*\d/i.test(raw);
    }

    /** Is this a term the engine already knows how to count? */
    function isKnownStitch(term) {
        const key = String(term || '').trim().toLowerCase();
        if (!key) return false;
        return Boolean(getFullDictionary()[key]) || parseInstructions(key).tokens.length > 0;
    }

    /**
     * "9 hdc + 8 rows = about 4 in. (10 cm)." - the gauge as every published pattern states it. Read
     * into the gauge calculator rather than thrown away, so a pasted pattern arrives with its swatch
     * already entered.
     *
     * Each half is optional and reported only when really there. The Ripple Cardigan measures its
     * stitches in ripples ("1 ripple = about 3 in."), which is not a stitch count and must not become
     * one - so that half comes back undefined and the user still has to swatch for it.
     */
    function parseGaugeStatement(line) {
        const text = String(line || '');
        const out = {};
        const unitOf = word => (/^cm/i.test(word) ? 'cm' : 'in');

        // "14 hdc x 10 rounds = 4" x 4"" - the other way the same swatch is written, and the one a
        // pattern worked in the round uses, its vertical unit being a round. Both measurements are
        // given so the swatch need not be assumed square; the second is optional for "16 sc x 18 rows".
        const UNIT = String.raw`in\b|inch(?:es)?|cm|"|”`;
        const grid = text.match(new RegExp(String.raw`(\d+)\s+([a-z][a-z0-9\- ]{0,12}?)\s*[x×]\s*(\d+)\s*(?:rows?|rounds?|rnds?)\s*=\s*(?:about\s+)?(\d+(?:[./]\d+)?)\s*(${UNIT})(?:\s*[x×]\s*(\d+(?:[./]\d+)?)\s*(${UNIT})?)?`, 'i'));
        if (grid && isKnownStitch(grid[2])) {
            out.stitches = parseInt(grid[1], 10);
            out.rows = parseInt(grid[3], 10);
            out.width = parseFloat(grid[4]);
            out.height = grid[6] === undefined ? out.width : parseFloat(grid[6]);
            out.unit = unitOf(grid[7] || grid[5]);
            return out;
        }

        const both = text.match(/(\d+)\s+([a-z][a-z0-9\- ]{0,12}?)\s*\+\s*(\d+)\s*(?:rows?|rounds?|rnds?)\s*=\s*(?:about\s+)?(\d+(?:[./]\d+)?)\s*(in\b|inch|inches|cm)/i);
        if (both && isKnownStitch(both[2])) {
            out.stitches = parseInt(both[1], 10);
            out.rows = parseInt(both[3], 10);
            // A swatch stated as one measurement is square: "= about 4 in." means 4 by 4.
            out.width = out.height = parseFloat(both[4]);
            out.unit = unitOf(both[5]);
            return out;
        }

        const rows = text.match(/(\d+)\s*rows?\s*=\s*(?:about\s+)?(\d+(?:[./]\d+)?)\s*(in\b|inch|inches|cm)/i);
        if (rows) {
            out.rows = parseInt(rows[1], 10);
            out.height = parseFloat(rows[2]);
            out.unit = unitOf(rows[3]);
        }

        const sts = text.match(/(\d+)\s+([a-z][a-z0-9\- ]{0,12}?)\s*=\s*(?:about\s+)?(\d+(?:[./]\d+)?)\s*(in\b|inch|inches|cm)/i);
        if (sts && isKnownStitch(sts[2])) {
            out.stitches = parseInt(sts[1], 10);
            out.width = parseFloat(sts[3]);
            out.unit = unitOf(sts[4]);
        }

        return Object.keys(out).length ? out : null;
    }

    /**
     * A line from an abbreviation list or stitch-explanation block: "hdc = half double crochet",
     * "BPdc (Back Post double crochet) Yarn over, insert...". Returns the term and what it stands for,
     * so a stitch the dictionary lacks can be carried into the custom dictionary rather than lost.
     */
    function parseAbbreviationEntry(line) {
        const text = String(line || '').trim();

        const equals = text.match(/^([A-Za-z][A-Za-z0-9]{0,11}(?:\s+sts?)?)\s*=\s*(.+)$/);
        if (equals) return { term: equals[1].trim(), definition: equals[2].trim().replace(/[.;]\s*$/, '') };

        const paren = text.match(/^([A-Za-z][A-Za-z0-9]{0,11}(?:\s+sts?)?)\s*\(([^)]+)\)/);
        if (paren) return { term: paren[1].trim(), definition: paren[2].trim() };

        return null;
    }

    /**
     * The labelled front matter every pattern opens with - "Hook Size: US H/8 (5.0 mm)", "Yarn: Medium
     * / Worsted Weight (Category 4)", "Skill Level: Easy / Intermediate". The app had fields for all of
     * it and no way to fill them but by hand, so a pattern stating hook, yarn and difficulty in its
     * first six lines arrived with every box empty.
     *
     * Returns only what the line actually says. An unrecognised label comes back null and is left as a
     * note: a wrong hook size on a printout is worse than a blank one.
     */
    /**
     * The eight CYC yarn categories, in one table. The same list had grown three encodings - the
     * detection patterns here, the yardage multipliers in analytics.js, and the dropdown in
     * index.html - so adding a category meant remembering all three, and category 0 once existed in
     * two of them but not the third.
     *
     * `value` is the form value index.html round-trips and must match its <option value> exactly.
     * `name` is report prose and deliberately reads differently. `scale` and `avgSkeinYards` are what
     * the yardage estimate needs; analytics.js derives its own map from this rather than restating it.
     */
    const CYC_YARN_CATEGORIES = [
        { n: 0, value: '0 - Lace',        name: 'Lace/10 count thread (Lace)', scale: 0.35, avgSkeinYards: 1000,
          re: /\b(?:lace|thread|10\s*count)\b|\bcategory\s*0\b/i },
        { n: 1, value: '1 - Super Fine',  name: 'Sock/Fingering (Super Fine)', scale: 0.55, avgSkeinYards: 400,
          re: /\bsuper\s*fine\b|\b(?:sock|fingering|baby)\b|\bcategory\s*1\b/i },
        { n: 2, value: '2 - Fine',        name: 'Sport/Baby (Fine)',           scale: 0.72, avgSkeinYards: 300,
          re: /\bfine\b|\bsport\b|\bcategory\s*2\b/i },
        { n: 3, value: '3 - Light',       name: 'DK/Light Worsted (Light)',    scale: 0.85, avgSkeinYards: 250,
          re: /\blight(?:\s*worsted)?\b|\bdk\b|\bcategory\s*3\b/i },
        { n: 4, value: '4 - Medium',      name: 'Worsted/Aran (Medium)',       scale: 1.00, avgSkeinYards: 200,
          re: /\bmedium\b|\bworsted\b|\baran\b|\bcategory\s*4\b/i },
        { n: 5, value: '5 - Bulky',       name: 'Bulky (Chunky)',              scale: 1.35, avgSkeinYards: 130,
          re: /\bbulky\b|\bchunky\b|\brug\b|\bcategory\s*5\b/i },
        { n: 6, value: '6 - Super Bulky', name: 'Super Bulky',                 scale: 1.75, avgSkeinYards: 90,
          re: /\bsuper\s*bulky\b|\broving\b|\bcategory\s*6\b/i },
        { n: 7, value: '7 - Jumbo',       name: 'Jumbo',                       scale: 2.30, avgSkeinYards: 60,
          re: /\bjumbo\b|\bcategory\s*7\b/i }
    ];

    // CYC project levels, and the words patterns actually print for them. Hardest first: "Easy /
    // Intermediate" describes a pattern you need to be an intermediate to finish.
    const SKILL_LEVELS = [
        { value: 'Complex', re: /\b(?:complex|advanced|experienced|expert)\b/i },
        { value: 'Intermediate', re: /\bintermediate\b/i },
        { value: 'Easy', re: /\beasy\b/i },
        { value: 'Basic', re: /\b(?:basic|beginner|novice)\b/i }
    ];

    function parseMetadataStatement(line) {
        const text = String(line || '').trim();
        const labelled = text.match(/^([A-Za-z][A-Za-z /]{2,24}?)\s*[:–—-]\s*(.+)$/);
        if (!labelled) return null;

        const label = labelled[1].trim().toLowerCase();
        const value = labelled[2].trim().replace(/[.;]\s*$/, '');
        if (!value) return null;

        const pick = (table) => (table.find(entry => entry.re.test(value)) || {}).value || null;

        if (/^(?:designer|design(?:ed)?\s*by|author|by)$/.test(label)) return { designer: value };

        if (/^(?:hooks?|hook\s*sizes?|crochet\s*hooks?)$/.test(label)) {
            // "or size needed to obtain gauge" - true of every hook size ever printed, and says nothing
            // about this one.
            return { hook: value.replace(/\s*(?:,|\bor\b)\s*(?:the\s+)?size\s+(?:needed|required)\b.*$/i, '').trim() };
        }

        if (/^(?:yarns?|yarn\s*weights?|weights?|materials?)$/.test(label)) {
            const out = {};
            const weight = pick(CYC_YARN_CATEGORIES);
            if (weight) out.yarnWeight = weight;
            // "approx. 650-750 yards" - the top of a stated range is what you have to buy.
            const yards = value.match(/(\d[\d,]*)\s*(?:[-–—]\s*(\d[\d,]*)\s*)?(?:yd|yds|yards?|m\b|met(?:er|re)s?)/i);
            if (yards) out.yardage = parseInt((yards[2] || yards[1]).replace(/,/g, ''), 10);
            return Object.keys(out).length ? out : null;
        }

        if (/^(?:skill\s*levels?|difficulty|levels?|experience)$/.test(label)) {
            const level = pick(SKILL_LEVELS);
            return level ? { difficulty: level } : null;
        }

        // Handed back whole rather than parsed here: parseGaugeStatement is the one reader for a
        // swatch and is called with the line either way. What matters at this level is that "Gauge: 14
        // hdc x 10 rounds = 4in" is a statement about the pattern, not a round of 140 hdc.
        if (/^(?:gauges?|tension)$/.test(label)) return { gauge: value };

        if (/^(?:sizes?|finished\s*sizes?|fits?)$/.test(label)) return { size: value };
        if (/^(?:notions?|tools?|supplies|other\s*materials?)$/.test(label)) return { notions: value };

        return null;
    }

    /**
     * The four things a pattern has to state before anyone else can work it: hook size, yarn weight,
     * gauge, and a key to the abbreviations it uses.
     *
     * WHY THIS IS NOT A HEALTH CHECK. CalculatePatternHealth scores the arithmetic and the notation -
     * things that are right or wrong about the stitches. These four are not wrong, they are absent,
     * and a pattern whose every row balances perfectly should not be told it scored 82 because it did
     * not name a hook. It gates the validation badge instead, where "sound, but not finished" is a
     * state the reader can act on.
     *
     * Each element is satisfied by the metadata form OR by the pattern's own front matter, and which
     * one is recorded rather than collapsed - a designer who typed the gauge into the calculator and a
     * designer who wrote "Gauge: 14 hdc x 10 rows = 4in" have both stated it, and being told which was
     * read is the difference between trusting the tick and re-checking it by hand.
     *
     * Nothing here parses a row or touches a count. It reads the same lines classifyPatternLine files
     * as notes, using the readers that already exist for them.
     */
    const REQUIRED_ELEMENTS = [
        { key: 'hook', label: 'Hook Size',
          hint: 'Add it under Pattern Metadata, or write "Hook: 4.0mm (G)" near the top of the pattern.' },
        { key: 'yarnWeight', label: 'Yarn Weight',
          hint: 'Choose a weight under Pattern Metadata, or write "Yarn: Worsted Weight (Category 4)".' },
        { key: 'gauge', label: 'Gauge',
          hint: 'Measure a swatch on the Gauge tab, or state it: "Gauge: 14 hdc x 10 rows = 4 in."' },
        { key: 'abbreviations', label: 'Abbreviations Key',
          hint: 'Add an "Abbreviations" heading followed by your terms, one per line: "hdc = half double crochet".' }
    ];

    /**
     * An abbreviations key needs at least two entries to be a key at all - one line under the heading
     * is as likely to be a stray sentence as a definition, and a pattern that defines a single term
     * has not told the reader what the rest of its vocabulary means.
     *
     * The block ends where the work starts, which is the same boundary documentationHeading's callers
     * already use: startsWorkSection, or another documentation heading.
     */
    function countAbbreviationEntries(lines, from) {
        let entries = 0;
        for (let i = from + 1; i < lines.length; i++) {
            const line = String(lines[i] || '').trim();
            if (!line) continue;
            if (startsWorkSection(line) || documentationHeading(line)) break;
            if (parseAbbreviationEntry(line)) entries++;
        }
        return entries;
    }

    function requiredElements({ sourceText = '', metadata = {}, gauge = {} } = {}) {
        const lines = String(sourceText || '').split('\n');
        // 'form' beats 'pattern' only in the sense that it is checked first; both are equally valid
        // ways to have stated the thing, and `source` reports whichever answered.
        const found = {};
        const see = (key, source) => { if (key && !found[key]) found[key] = source; };

        if (String(metadata.hook || '').trim()) see('hook', 'form');
        if (String(metadata.yarnWeight || '').trim()) see('yarnWeight', 'form');
        // Both halves, because a swatch with stitches and no rows cannot produce a row gauge and is
        // not a measurement anyone can work from.
        if (gauge.stitches > 0 && gauge.rows > 0) see('gauge', 'form');

        lines.forEach((line, i) => {
            const stated = parseMetadataStatement(line);
            if (stated) {
                if (stated.hook) see('hook', 'pattern');
                if (stated.yarnWeight) see('yarnWeight', 'pattern');
                // parseMetadataStatement hands the gauge back whole rather than parsed, so the line is
                // put to the one reader that knows a swatch from a sentence. "Gauge: work evenly" is a
                // gauge label with nothing measurable under it and must not count.
                if (stated.gauge && (parseGaugeStatement(line) || {}).stitches > 0) see('gauge', 'pattern');
            } else if ((parseGaugeStatement(line) || {}).stitches > 0) {
                // A gauge stated without its label - "14 hdc x 10 rows = 4 in." on a line of its own,
                // which is how a Gauge block writes it once the heading above has said what it is.
                see('gauge', 'pattern');
            }

            if (documentationHeading(line) === 'stitches' && countAbbreviationEntries(lines, i) >= 2) {
                see('abbreviations', 'pattern');
            }
        });

        const items = REQUIRED_ELEMENTS.map(element => ({
            key: element.key,
            label: element.label,
            hint: element.hint,
            present: Boolean(found[element.key]),
            source: found[element.key] || null
        }));

        return {
            items,
            missing: items.filter(item => !item.present).map(item => item.key),
            complete: items.every(item => item.present)
        };
    }

    /**
     * US and UK terminology, and the one question worth asking about it.
     *
     * The two systems name the same stitches differently and, worse, reuse each other's
     * abbreviations for different heights: a UK "dc" is a US "sc", and a UK "tr" is a US "dc". A
     * student who learned from one video and one blog post mixes them without noticing, and the
     * result is a pattern nobody can work, because "dc" now means two things in one document.
     *
     * WHY THIS IS A TERMINOLOGY CHECK AND NOT AN ARITHMETIC ONE. Every basic in stitchDictionary is
     * cost 1 / yield 1, so the counts come out the same whichever system a row is read in. The
     * ambiguity is real for a human and invisible to the arithmetic, which is exactly why it needs
     * saying out loud rather than being caught by a row that fails to add up. It never will.
     *
     * WHAT IS DELIBERATELY ABSENT: dc, tr, dtr. Those are the colliding terms - valid in BOTH
     * systems, merely naming different stitches in each - so a pattern using them is not thereby
     * wrong, and flagging them would put an underline on essentially every pattern ever written.
     * Same reasoning as the note on htr in the dictionary above: what gets flagged is a genuinely
     * impossible mixture, not an ambiguity. A "sc" in a pattern declared UK cannot be anything but a
     * US term, because UK terminology has no such stitch.
     */
    const DIALECT_EXCLUSIVE = {
        // Terms that exist only in US terminology, with the UK name for the same stitch.
        // "skip" is deliberately not here. UK patterns traditionally write "miss", but "skip" is used
        // throughout modern UK publishing too, so it is not exclusive and flagging it would be noise.
        us: {
            'sc': 'dc', 'single crochet': 'double crochet',
            'hdc': 'htr', 'half double crochet': 'half treble',
            'sc2tog': 'dc2tog', 'sc3tog': 'dc3tog',
            'fpsc': 'fpdc', 'bpsc': 'bpdc'
        },
        // Terms that exist only in UK terminology, with the US name for the same stitch.
        uk: {
            'htr': 'hdc', 'half treble': 'half double crochet',
            'half treble crochet': 'half double crochet',
            'trtr': 'dtr', 'triple treble': 'double treble',
            'qtr': 'trtr', 'quadruple treble': 'triple treble',
            'miss': 'sk'
        }
    };

    /** The full name of each system, for the sentence the finding writes. */
    const DIALECT_NAMES = { us: 'US', uk: 'UK' };

    /**
     * Terms in this row that cannot belong to the terminology the project declares.
     *
     * `mode` is the system the pattern says it is written in, so the terms LOOKED FOR are the other
     * one's. Anything but 'us' or 'uk' - including the 'off' default - finds nothing at all.
     *
     * Matched whole-word and longest-first, so "half double crochet" is reported once as itself
     * rather than three times over as its parts, and "sc" never fires inside "fpsc".
     *
     * The boundary is checked against the surrounding characters rather than written into the regex
     * as a lookbehind: a hyphen has to count as part of the word here ("sc-inc" is one term, not an
     * "sc" beside something else) and \b does not treat it that way. Doing it by hand also keeps the
     * expression to what every engine this runs under has always supported.
     */
    const DIALECT_WORD = /[a-z0-9-]/i;

    function dialectFaults(instructionText, mode) {
        const text = String(instructionText || '');
        const other = mode === 'us' ? 'uk' : mode === 'uk' ? 'us' : null;
        if (!other || !text) return [];

        const table = DIALECT_EXCLUSIVE[other];
        const out = [];
        const claimed = [];
        Object.keys(table)
            .sort((a, b) => b.length - a.length)
            .forEach(term => {
                const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                let match;
                while ((match = re.exec(text)) !== null) {
                    const start = match.index;
                    const end = start + match[0].length;
                    const before = start > 0 ? text[start - 1] : '';
                    const after = end < text.length ? text[end] : '';
                    if (DIALECT_WORD.test(before) || DIALECT_WORD.test(after)) continue;
                    // A longer term already covering this position has been reported; its parts are
                    // not separate faults.
                    if (claimed.some(span => start < span.end && end > span.start)) continue;
                    claimed.push({ start, end });
                    out.push({ term: match[0], belongsTo: other, equivalent: table[term], at: start });
                }
            });

        return out.sort((a, b) => a.at - b.at);
    }

    /**
     * One dialect fault as something the linter can underline.
     *
     * `edit: null`, deliberately and permanently. Rewriting "sc" to "dc" in a pattern the student
     * believes is US would silently change what every one of those stitches means, and a button that
     * does that on the strength of a dropdown nobody may have set correctly is worse than the
     * underline it would replace. Same call buildFixes already makes for an unknown token.
     */
    function buildTerminologyFix(fault, mode) {
        const declared = DIALECT_NAMES[mode] || 'the chosen';
        const found = DIALECT_NAMES[fault.belongsTo];
        return {
            id: `dialect-${fault.term.toLowerCase().replace(/\s+/g, '-')}`,
            severity: 'style',
            title: `"${fault.term}" is a ${found} term, but this pattern is set to ${declared} terms`,
            detail: `The ${declared} equivalent is "${fault.equivalent}". Stitch Math will not change `
                + `it for you — if this pattern really is ${found}, change the Terminology setting `
                + `instead of the stitch.`,
            lesson: 'US and UK crochet reuse each other\'s abbreviations for different stitches — a UK '
                + '"dc" is a US "sc". Naming which system a pattern uses, and then staying inside it, '
                + 'is what stops a reader working the wrong stitch all the way through.',
            edit: null
        };
    }

    /**
     * Longhand a beginner writes, and the abbreviation the industry prints.
     *
     * "chain 3" and "make an increase" are perfectly clear and completely correct - the engine reads
     * both without complaint. They are also not how a published pattern is written, and a student who
     * never sees the difference pointed out submits work that reads as unfinished for a reason nobody
     * ever told them. That is the whole content of this table: nomenclature, taught in place.
     *
     * `dialect` restricts an entry to one terminology. "single crochet" only abbreviates to "sc" in a
     * US pattern, because UK terminology has no such stitch - suggesting it in a UK document would be
     * teaching the error the check above exists to catch. Entries with no `dialect` are the ones that
     * abbreviate the same way in both.
     *
     * ORDER MATTERS, and ordering alone is not enough. Longest first, so "half double crochet" is
     * matched before the "double crochet" rule below it - but a longer rule that is SKIPPED for
     * belonging to the other dialect would otherwise leave its text open to the shorter one, and
     * "half double crochet" in a UK pattern came back as a suggestion to write "half dc". So a longer
     * form claims the span it matched whether or not it was offered, and shorter rules cannot reach
     * inside it. Same span-claiming rule dialectFaults uses, for the same reason.
     */
    const SHORTHAND_FORMS = [
        { name: 'half-double-crochet', re: /\bhalf\s+double\s+crochets?\b/i, to: 'hdc', dialect: 'us' },
        { name: 'half-treble',         re: /\bhalf\s+trebles?(?:\s+crochets?)?\b/i, to: 'htr', dialect: 'uk' },
        { name: 'single-crochet',      re: /\bsingle\s+crochets?\b/i, to: 'sc', dialect: 'us' },
        { name: 'double-crochet',      re: /\bdouble\s+crochets?\b/i, to: 'dc' },
        { name: 'treble-crochet',      re: /\btreble\s+crochets?\b/i, to: 'tr' },
        { name: 'slip-stitch',         re: /\bslip\s+stitch(?:es)?\b/i, to: 'sl st' },
        { name: 'chain-count',         re: /\bchain\s+(\d+)\b/i, to: 'ch $1' },
        { name: 'increase',            re: /\bmake\s+an?\s+increase\b/i, to: 'inc' },
        { name: 'decrease',            re: /\bmake\s+an?\s+decrease\b/i, to: 'dec' }
    ];

    /**
     * The first longhand term on this row, as something the linter can offer a button for.
     *
     * One per row rather than all of them: each carries a distinct id, so a row with two long forms
     * raises two findings and the sidebar shows both - but the same term twice on one line is one
     * lesson, and collectFindings already folds it to a single card.
     *
     * The `edit` uses the repeatPhrasing target, which is a literal indexOf replace against the raw
     * line. That works because the matched text is taken from the row's own instruction, which is the
     * line minus its label - so the same substring is present in the line verbatim. On a graded row
     * where a size has been substituted it will not be, indexOf misses, and the suggestion degrades
     * to advice rather than rewriting the wrong thing.
     */
    function buildShorthandFixes(instructionText, mode) {
        const text = String(instructionText || '');
        if (!text) return [];

        const out = [];
        const claimed = [];
        SHORTHAND_FORMS.forEach(form => {
            const match = text.match(form.re);
            if (!match) return;
            const start = match.index;
            const end = start + match[0].length;
            // Claimed before the dialect test, not after: a longer form that is not offered here must
            // still keep a shorter one out of the text it covers.
            if (claimed.some(span => start < span.end && end > span.start)) return;
            claimed.push({ start, end });

            // 'off' still standardizes everything that abbreviates the same way in both systems; only
            // the dialect-specific entries wait to be told which one this is.
            if (form.dialect && form.dialect !== mode) return;
            const replacement = match[0].replace(form.re, form.to);
            if (replacement === match[0]) return;

            out.push({
                id: `shorthand-${form.name}`, severity: 'style',
                title: `"${match[0]}" is usually written "${replacement}"`,
                detail: `Both are read the same way by Stitch Math. "${replacement}" is the form a `
                    + `published pattern prints, and the one your abbreviations key should define.`,
                lesson: 'Standard abbreviations are what make a pattern short enough to follow a row at '
                    + 'a time, and what let a reader who does not share your language work it from the '
                    + 'key alone. Writing the long form is not wrong — it is just not the convention.',
                edit: { target: 'repeatPhrasing', from: match[0], to: replacement }
            });
        });
        return out;
    }

    /**
     * Stitches a row sets aside for a piece worked later, and the name it sets them aside under. A
     * garment made in one piece says so constantly:
     *
     *     ch 6 (Underarm 1), skip 38 sts (Right Sleeve)
     *     (Section breakdown: Back = 48 hdc, Right Sleeve = 38 hdc)
     *     leave 20 sts unworked for Left Front
     *
     * Each states a count against a name, and the piece naming itself the same way later is worked
     * into exactly those stitches. Collected so a section can start with the fabric it is actually
     * worked into rather than from nothing - which is what made the first round of every sleeve fail.
     *
     * Returns a plain {name: count} map. Names are kept as written; matchHeldName does the
     * normalising, because "Right Sleeve" is set aside and "Sleeves" is worked.
     */
    function parseHeldStitches(line) {
        const text = String(line || '');
        const held = {};
        const NAME = String.raw`[A-Za-z][A-Za-z ]{0,24}?`;

        // "skip 38 sts (Right Sleeve)", "leave 20 sts unworked for Left Front"
        const setAside = new RegExp(String.raw`\b(?:skip|leave|hold)\s+(\d+)\s*(?:sts?|stitches?)?[^.;()]*?(?:\(\s*(${NAME})\s*\)|\bfor\s+(${NAME})\b)`, 'gi');
        for (const m of text.matchAll(setAside)) {
            const name = (m[2] || m[3] || '').trim();
            if (name) held[name] = parseInt(m[1], 10);
        }

        // "Back = 48 hdc", "Right Sleeve = 38 hdc". The equals form is how a section breakdown is
        // written, and it is a list, so this runs over the whole line rather than stopping at the first.
        const stated = new RegExp(String.raw`((?:${NAME})?)\s*(?:total\s*)?=\s*(\d+)\s*(?:hdc|dc|sc|tr|sts?|stitches?)\b`, 'gi');
        for (const m of text.matchAll(stated)) {
            const name = (m[1] || '').replace(/^.*?[:,(]\s*/, '').trim();
            if (name && !/^(?:section\s+breakdown|total)$/i.test(name)) held[name] = parseInt(m[2], 10);
        }

        return Object.keys(held).length ? held : null;
    }

    /**
     * The count set aside for the piece a section heading names. "Sleeves (Make 2)" is worked into what
     * "Right Sleeve" and "Left Sleeve" held, so the side and the plural both have to come off before
     * the names can meet. Exact match wins; failing that, the longest registered name the title
     * contains, or that contains the title.
     */
    function matchHeldName(title, held) {
        const normalise = s => String(s || '').toLowerCase()
            .replace(/\b(?:right|left|first|second|1st|2nd|front|back)\b/g, ' ')
            .replace(/\bmake\s+\d+\b/g, ' ')
            .replace(/[^a-z ]/g, ' ')
            .replace(/s\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const want = normalise(title);
        if (!want || !held) return null;

        let best = null;
        Object.keys(held).forEach(name => {
            const key = normalise(name);
            if (!key) return;
            const hit = key === want || key.includes(want) || want.includes(key);
            if (!hit) return;
            if (!best || key.length > best.key.length) best = { key, count: held[name] };
        });
        return best ? best.count : null;
    }

    function parseSectionHeader(line) {
        const raw = String(line || '').trim();
        if (!raw) return { isSection: false, title: '' };

        const explicit = raw.match(EXPLICIT_SECTION_RE);
        const title = explicit
            ? explicit[1].replace(/[-=\s]+$/, '').trim()
            : (raw.match(CAPS_SECTION_RE) || raw.match(COLON_SECTION_RE) || raw.match(MAKE_SECTION_RE) || [])[1];

        if (!title) return { isSection: false, title: '' };

        // The stitch-free test. Chains count too: "Ch 20" alone is a row, not a heading.
        const parsed = parseInstructions(raw);
        const worksStitches = parsed.tokens.some(t => t.count > 0);
        if (worksStitches) return { isSection: false, title: '' };

        return { isSection: true, title: title.trim() };
    }

    /**
     * A ring made from a short chain: "ch 2, 6 s c in 2nd st from hook", "ch 4, join to form a ring, ch
     * 3, 11 d c in ring". The chain is scaffolding the round is worked into and around, so it
     * contributes nothing - the round is just the N stitches. Counting the chain too is how "6 sc"
     * became 8 and threw every subsequent round of a doily off.
     */
    function parseChainRing(instruction) {
        // Read before the brackets are expanded: expandBracketRepeats treats "(counts as dc)" as a
        // group and unwraps it, so the parentheses are gone by then.
        const raw = stripRowPreamble(instruction);
        // Said outright, or said by joining to the top of the chain - the same thing, and the ring has
        // to count the chain either way.
        const standsOnAChain = /\b(?:ch|chain)\s*\d+\s*\(\s*(?:this\s+)?counts?\s+as(?![^)]*\bnot\b)/i.test(raw)
            || impliedStandingChain(raw) > 0;

        // Bracket groups are expanded next: a granny square writes three of its four groups as
        // "[3 dc in ring, ch 2] x 3", and the ring has to see all of them.
        const clean = expandBracketRepeats(raw);
        const into = String.raw`(?:\d+\s*(?:st|nd|rd|th)\s+(?:st|stitch|ch|chain)\s+from\s+(?:the\s+)?hook` +
            String.raw`|1\s*(?:st)?\s+(?:st|stitch)\s+of\s+(?:the\s+)?ch(?:ain)?|ring)`;
        const worked = new RegExp(String.raw`\b(\d+)\s+([a-z][a-z ]*?)\s+in\s+(?:the\s+)?${into}\b`, 'gi');

        const head = clean.match(/^(?:ch|chain)\s*(\d+)\b/i);
        if (!head) return { isChainRing: false };
        const chains = parseInt(head[1], 10);
        // Only a short chain forms a ring. A long one is a foundation row.
        if (!(chains > 0) || chains > 12) return { isChainRing: false };

        // Every group worked into the ring, not just the first. A granny square works four - "2 dc in
        // ring ... [3 dc in ring, ch 2] x 3" - and stopping at the first reported the round as 2
        // stitches, starving every round above it: the next asked for 22 and was told 2 were available.
        let count = 0, stitchType = '', match;
        while ((match = worked.exec(clean)) !== null) {
            count += parseInt(match[1], 10);
            if (!stitchType) stitchType = match[2].trim();
        }
        if (!(count > 0)) return { isChainRing: false };

        // A round standing up on "ch 3 (counts as dc)" has that chain as its first stitch, worked into
        // the ring like the rest. Without this the opening round of a granny square comes out one short
        // of its own stated count.
        if (standsOnAChain) count += 1;

        return { isChainRing: true, chains, count, stitchType };
    }

    /**
     * "in each ch across" is the phrase that makes a row a foundation row: it is worked into the chain
     * itself. "in each st across" is an ordinary row and "in each ch-1 sp around" is a mesh round, so
     * both are excluded - a ch-1 space is a hole in fabric that already exists, not a link of the
     * foundation.
     */
    const WORKS_INTO_CHAIN = /\b(?:in\s+)?each\s+(?:ch|chain)s?\b(?!\s*-?\s*\d)(?!\s+sp)/i;

    /**
     * @param {number} unstatedSkip  How many chains to skip when the row never says which chain to
     *   start in. Comes from the "Initial Turning Chains" box and is only consulted in that case: a row
     *   saying "2nd ch from hook" has stated its own answer, and the pattern outranks the setting.
     */
    function parseFoundationRow(instruction, availableChains = 0, unstatedSkip = 0) {
        let clean = stripRowPreamble(instruction);
        // "2nd st from hook" as well as "2nd ch from hook": the American Thread books always write the
        // former, and at that point the only thing to work into is the foundation chain.
        const head = clean.match(/^(?:ch|chain)\s*(\d+)\s*[,.]?\s+.*?\b(\d+)\s*(?:st|nd|rd|th)\s+(?:ch|chain|st|stitch)\s+from\s+(?:the\s+)?hook\b/i);
        // A published pattern puts the chain on its own line - "With B, ch 97." - and opens the next
        // row "dc in 3rd ch from hook and in each ch across". Same instruction, one line later, with
        // the chain count coming from the row before. Without this the row consumes a single stitch and
        // reports the other 96 unworked.
        const carried = head ? null : clean.match(/\b(\d+)\s*(?:st|nd|rd|th)\s+(?:ch|chain)\s+from\s+(?:the\s+)?hook\b/i);
        // "Ch 16, sc in each ch across" - the chain and the row working back along it on one line, with
        // no word about which chain to start in. Left to the tokenizer this counted the 16 chains AND a
        // stitch worked into them, failing the row on 17 against nothing. It is a foundation row like
        // any other; only the skip is missing, which the caller supplies from the setting.
        const unstated = (head || carried) ? null
            : clean.match(/^(?:ch|chain)\s*(\d+)\s*[,.]?\s+/i);
        if (!head && !carried && !(unstated && WORKS_INTO_CHAIN.test(clean))) {
            return { isFoundationRow: false };
        }
        // "remaining" as well as across/around: American Thread writes "1 s c in each remaining st of
        // ch", which never reaches the word "across". The "in" is optional - "sc in 2nd ch from hook and
        // each ch across" is as common in print as the fuller form, and without this it fell through to
        // the tokenizer, which counts the chain and the stitches worked back along it as two separate
        // contributions and fails the row on a phantom deficit.
        if (!/\b(?:in\s+)?each\b/i.test(clean) || !/\b(?:across|around|remaining)\b/i.test(clean)) {
            return { isFoundationRow: false };
        }

        const chains = head ? parseInt(head[1], 10)
            : unstated ? parseInt(unstated[1], 10)
            : availableChains;
        // Stated as an ordinal - "2nd ch from hook" skips 1 - or, where the row says nothing, taken from
        // the setting. skipStated travels with the result so the caller can say out loud that the number
        // came from the box and not the pattern.
        const skipStated = !unstated;
        const skipped = skipStated ? parseInt(head ? head[2] : carried[1], 10) - 1 : unstatedSkip;
        if (!(chains > 0) || !(skipped >= 0) || skipped >= chains) return { isFoundationRow: false };

        return { isFoundationRow: true, chains, skipped, count: chains - skipped, skipStated };
    }

    /**
     * The cost/yield of ONE repeat of a bracketed group, so a failure can be reported as "add 1 more
     * repeat" rather than a raw stitch deficit. The app strips a trailing "x 6" into rowMultiplier, so
     * handle both that and an inline "[...] x 6" that parseInstructions has already expanded.
     */
    function analyzeRepeatUnit(instructionString, rowMultiplier, parsed, availableStitches = 0) {
        const text = String(instructionString || '');
        // The multiplier alternation carries "*" alongside "x" for the same reason REPEAT_SHORTHAND_RE
        // does - "(2 sc, inc) * 6" is ordinary amigurumi notation. This one costs more than a style
        // note when it is missed: without a repeat unit the "this repeat runs 5 times but the row has
        // stitches for 6" correction cannot be offered at all, and the row falls through to a raw
        // stitch deficit. Note the marker is OPTIONAL, so "*sc, inc; rep from * 5" already matched on
        // the bare digits and is unaffected.
        const inline = text.match(/[\(\[\*]([^\(\)\[\]\*]+)[\)\]\*]\s*(?:x|times|rep|\*)?\s*(\d+)/i);

        if (inline) {
            const body = parseInstructions(inline[1], 0);
            if (body.totalCost > 0) {
                return {
                    cost: body.totalCost,
                    yield: body.totalYield,
                    times: parseInt(inline[2], 10) * (rowMultiplier || 1),
                    // `times` multiplies the bracket's own count by the row multiplier, so it is not a
                    // number that appears anywhere in the text. `kind` and `stated` name the one that
                    // does, which is all a linter can safely rewrite.
                    kind: 'inline',
                    stated: parseInt(inline[2], 10),
                    rowMultiplier: rowMultiplier || 1
                };
            }
        }

        // An open-ended repeat names no number of times: "*sk 2 sts, 3 dc in next st; rep from * to end"
        // runs until the row does, and the expander sizes it by dividing whatever is left after the rest
        // of the row. Those same two numbers - what one pass costs, and what the row works outside the
        // repeat - decide which stitch counts the row can be worked over, so a row that fits none of
        // them can only be diagnosed from here. Without this the repeat came back null and the failure
        // fell through to generic deficit advice.
        const open = text.match(ASTERISK_REPEAT_RE);
        if (open && TO_END_RE.test(open[2] || '')) {
            const body = parseInstructions(expandBracketRepeats(open[1].replace(/[;,]\s*$/, '').trim()), 0);
            // A repeat measured in corners closes when the corners run out, not the stitches, so
            // leftovers are expected there and say nothing.
            if (body.totalCost > 0 && !body.cornersUsed) {
                const rest = parseInstructions(expandBracketRepeats(text.replace(open[0], ' ')), 0);
                const forRepeat = Math.max(0, availableStitches - rest.totalCost);
                return {
                    cost: body.totalCost,
                    yield: body.totalYield,
                    times: Math.floor(forRepeat / body.totalCost),
                    openEnded: true,
                    restCost: rest.totalCost,
                    // Named but deliberately not rewritable: an open repeat already runs to the end of
                    // the row, so there is no count in the text to correct.
                    kind: 'open'
                };
            }
        }

        if (rowMultiplier > 1 && parsed.totalCost > 0) {
            return {
                cost: parsed.totalCost, yield: parsed.totalYield, times: rowMultiplier,
                kind: 'row-multiplier', stated: rowMultiplier, rowMultiplier
            };
        }
        return null;
    }

    /**
     * Turns a failure into plain-language next steps. Most-actionable first and deliberately short: a
     * whole-repeat fix explains both the stitch count and the yield at once, so it supersedes the
     * generic advice.
     */
    /** The "-es" on "stitches". Both the resolution text and the fix text need it, and two copies of a
     *  one-line rule is two places for it to stop agreeing. */
    const plural = (n) => (Math.abs(n) === 1 ? '' : 'es');

    function buildResolutions(ctx) {
        const { availableStitches, totalCost, repeat, unknownTokens } = ctx;
        const out = [];

        if (unknownTokens.length) {
            const list = unknownTokens.map(t => `"${t}"`).join(', ');
            out.push(`${list} is not in the stitch dictionary. Check the spelling, or add it under Custom Stitches with its cost and yield.`);
            // The totals below were computed without the unrecognized stitch, so any deficit advice
            // would be guesswork. Resolve the token first.
            return out;
        }

        // Only the stitch pool can be wrong now - the written count is advisory and reported as a note.
        const costGap = availableStitches - totalCost;
        if (costGap === 0) return out;

        // An open-ended repeat cannot be given another pass - it already runs to the end of the row.
        // Stitches are left over because the row's count is not one this repeat divides, so the count is
        // the thing to change and the useful answer is which counts would work. "Extend this row by 1"
        // was the old advice, and it cannot be done: the next pass needs 3 stitches and 1 remains.
        if (repeat && repeat.openEnded && repeat.cost > 0 && costGap > 0
            && repeat.restCost + repeat.times * repeat.cost === totalCost) {
            const fits = n => repeat.restCost + n * repeat.cost;
            const shape = repeat.restCost > 0
                ? `${repeat.restCost} + a multiple of ${repeat.cost}`
                : `a multiple of ${repeat.cost}`;
            const outside = repeat.restCost === 0 ? ''
                : repeat.restCost === 1 ? ' and 1 stitch is worked outside it'
                : ` and ${repeat.restCost} stitches are worked outside it`;
            out.push(
                `The repeat takes ${repeat.cost} stitches a pass${outside}, so this row fits ${shape} `
                + `stitches - ${fits(repeat.times)} or ${fits(repeat.times + 1)}, not ${availableStitches}. `
                + `It runs ${repeat.times} time${repeat.times === 1 ? '' : 's'} and leaves ${costGap} unworked.`
            );
            return out;
        }

        if (repeat && repeat.cost > 0 && costGap % repeat.cost === 0 && Number.isFinite(repeat.times)) {
            const n = costGap / repeat.cost;
            if (repeat.times + n >= 1) {
                const times = Math.abs(n);
                const label = times === 1 ? 'repeat' : 'repeats';
                out.push(n > 0
                    ? `Add ${times} more ${label} (x${repeat.times + n} instead of x${repeat.times}) to complete the row.`
                    : `Remove ${times} ${label} (x${repeat.times + n} instead of x${repeat.times}) to fit the row.`);
                return out;
            }
        }

        if (costGap > 0) {
            out.push(`${costGap} stitch${plural(costGap)} from the previous row ${Math.abs(costGap) === 1 ? 'is' : 'are'} still unworked. Extend this row by ${costGap}, or reduce the previous row to ${totalCost}.`);
        } else {
            out.push(`This row needs ${-costGap} stitch${plural(costGap)} more than the previous row produced. Shorten it by ${-costGap}, or grow the previous row to ${totalCost}.`);
        }

        return out;
    }

    /**
     * The same diagnosis as buildResolutions, expressed as edits a caller can apply rather than
     * sentences a reader must act on. Both are built from one diagnosisContext, so the linter cannot
     * offer a correction the matrix does not also explain.
     *
     * An edit names WHAT to change, never a string to search for: `instructionString` has had its row
     * label and written count taken off by the time it reaches here, so a find/replace built against
     * it would be aimed at text the caller does not have. The caller holds the original line and
     * resolves the target against it.
     *
     *   { target: 'multiplier',  from, to }             the "x N" a row or a bracket repeats
     *   { target: 'statedCount', from, to }             the count in parentheses at the end
     *   { target: 'insert',      text }                 a missing closer, appended to the instruction
     *   { target: 'replaceAt',   occurrence, from, to } the Nth "from" delimiter, closed wrongly
     *
     * A fifth target, `{ target: 'foundationOrdinal', stitch, ordinal, count }`, is built by
     * buildUnstatedSkipFix rather than here - it names the starting chain a row left unstated. Listed
     * for the same reason as the four above: applyLintEdit (app.js) is the only place any of them
     * become a character change, and a reader of that switch should find every target it handles here.
     *
     * `edit: null` is a finding worth showing that is not worth applying automatically. An unknown
     * term is the whole reason that exists: guessing which stitch a designer meant and rewriting it
     * silently is a worse failure than leaving it underlined.
     *
     * `severity: 'style'` is a third kind this function does not itself emit - it flags a pattern
     * that is valid but written in a way that leaves something to guess at, rather than something
     * wrong. buildUnstatedSkipFix is the one place that builds one today; it carries an extra
     * `lesson` field alongside `detail` - one general sentence on why the convention matters, as
     * opposed to `detail`'s specific claim about this row's own text.
     *
     * @returns {Array<{id: string, severity: 'math'|'syntax'|'style', title: string, detail: string,
     *   lesson: string=, edit: object|null}>}
     */
    function buildFixes(ctx, resolutions) {
        const { availableStitches, totalCost, calculatedYield, expectedYield,
                repeat, unknownTokens, notation, costIsValid } = ctx;
        const out = [];

        // Punctuation first, and on its own. A row whose brackets do not balance was read "as best it
        // could be" - the expanders drop what they cannot parse and count the rest - so its totals came
        // from a partial reading of the text. Offering to rewrite the stated count to one of those
        // numbers would write a wrong figure into the pattern and clear the note that said so. Fix the
        // punctuation, and the arithmetic is offered on the next pass against a row that parsed.
        let structural = false;
        (notation || []).forEach((fault, i) => {
            if (fault.kind !== 'orphan-repeat') structural = true;
            if (fault.kind === 'unclosed') {
                out.push({
                    id: `notation-unclosed-${i}`, severity: 'syntax',
                    title: `This row opens a "${fault.char}" that never closes`,
                    detail: `Adding the "${fault.expected}" at the end is the usual repair, but it is a guess `
                        + `at where the group was meant to end — check the result before accepting it.`,
                    edit: { target: 'insert', text: fault.expected }
                });
            } else if (fault.kind === 'mismatched') {
                out.push({
                    id: `notation-mismatched-${i}`, severity: 'syntax',
                    title: `A group here is closed with "${fault.char}" instead of "${fault.expected}"`,
                    detail: 'The row still counts, because the reader does not check which closer it got — '
                        + 'which is why this is worth correcting rather than leaving.',
                    edit: { target: 'replaceAt', occurrence: fault.occurrence, from: fault.char, to: fault.expected }
                });
            } else {
                out.push({
                    id: `notation-${fault.kind}-${i}`, severity: 'syntax',
                    title: `Malformed notation: ${fault.message}`,
                    detail: 'The row was read as best it could be. There is no single safe correction for '
                        + 'this one, so it is left to you.',
                    edit: null
                });
            }
        });
        if (structural) return out;

        // Advisory by design - see the doc comment above.
        if (unknownTokens && unknownTokens.length) {
            const list = unknownTokens.map(t => `"${t}"`).join(', ');
            out.push({
                id: 'unknown-token', severity: 'syntax',
                title: `${list} ${unknownTokens.length === 1 ? 'is' : 'are'} not in the stitch dictionary`,
                detail: 'Check the spelling, or add it under Custom Stitches with its cost and yield. '
                    + 'Stitch Math will not guess which stitch you meant.',
                edit: null
            });
            // The totals were computed without the unrecognised stitch, so the counts below would be
            // corrections towards a number that is itself wrong. Same reasoning as buildResolutions.
            return out;
        }

        // A repeat worked the wrong number of times, where the text actually contains the number.
        const costGap = availableStitches - totalCost;
        if (repeat && repeat.cost > 0 && costGap !== 0 && costGap % repeat.cost === 0
            && Number.isFinite(repeat.times) && repeat.stated > 0 && repeat.kind !== 'open') {
            const n = costGap / repeat.cost;
            // The bracket's own count is what appears in the text; `times` has already multiplied it by
            // the row multiplier. The difference only divides back down cleanly when the correction is a
            // whole number of passes of the WHOLE row, so anything else is left to prose.
            const perRow = repeat.kind === 'inline' ? repeat.rowMultiplier : 1;
            if (repeat.times + n >= 1 && n % perRow === 0) {
                const to = repeat.stated + (n / perRow);
                if (to >= 1) {
                    out.push({
                        id: 'repeat-times', severity: 'math',
                        title: `This repeat runs ${repeat.stated} time${repeat.stated === 1 ? '' : 's'}, `
                            + `but the row has stitches for ${to}`,
                        detail: `One pass takes ${repeat.cost} stitch${repeat.cost === 1 ? '' : 'es'}, and `
                            + `${Math.abs(costGap)} ${Math.abs(costGap) === 1 ? 'is' : 'are'} left `
                            + `${costGap > 0 ? 'unworked' : 'short'}.`,
                        edit: { target: 'multiplier', from: repeat.stated, to }
                    });
                }
            }
        }

        // A row whose stitches do not balance against the row below it, where no single edit can put
        // it right - the repeat above covers the case where one can. There is no button here because
        // "extend this row, or shrink the one above" is a choice only the designer can make, and the
        // resolutions say so in words.
        //
        // It is reported all the same, and it matters more than anything downstream of it: this is the
        // row that blocks the rest of the piece. Without it the linter marked every row AFTER the
        // fault and stayed silent about the fault itself.
        if (costIsValid === false && costGap !== 0 && !out.some(fix => fix.severity === 'math')) {
            out.push({
                id: 'stitch-balance', severity: 'math',
                title: costGap > 0
                    ? `This row works ${totalCost} of the ${availableStitches} stitches below it, `
                        + `leaving ${costGap} unworked`
                    : `This row needs ${-costGap} stitch${plural(costGap)} more than the `
                        + `${availableStitches} below it`,
                detail: (resolutions || [])[0]
                    || 'Check this row against the one above it before trusting anything below.',
                edit: null
            });
        }

        // The count in parentheses disagreeing with the stitches is advisory in the matrix - it never
        // fails a row - but it is the single most common thing a designer actually wants corrected.
        //
        // EXCEPT on a round worked into chain spaces, where this is withheld. A granny square states
        // its count in double crochets and this engine's figure includes the chains that form the
        // corner and side spaces, so the two are measuring different things and the difference is not
        // a typo. Offered there, the button rewrote a correct "(24)" to a wrong "(38)" - it corrupted
        // the very patterns it was meant to tidy. The note below still reports the difference; only
        // the one-click rewrite is taken away, on the same principle as every other advisory-only
        // finding: where Stitch Math cannot be sure which number is right, it does not offer to
        // write one.
        if (expectedYield > 0 && calculatedYield !== expectedYield && !(ctx.spaceCost > 0)) {
            const short = expectedYield - calculatedYield;
            out.push({
                id: 'stated-count', severity: 'math',
                title: short > 0
                    ? `This row seems to be missing ${short} stitch${short === 1 ? '' : 'es'} to reach ${expectedYield}`
                    : `This row makes ${-short} stitch${-short === -1 ? '' : 'es'} more than the ${expectedYield} it states`,
                detail: `The stitches written add up to ${calculatedYield}. If the count in brackets is the `
                    + `typo, this corrects it; if the stitches are, fix those instead and the note clears itself.`,
                edit: { target: 'statedCount', from: expectedYield, to: calculatedYield }
            });
        }

        return out;
    }

    // === 5. TOKENIZER ENGINE === //
    /**
     * ORDERING CONTRACT. parseInstructions is a fixed sequence of transformations, not one combined
     * pass, and the sequence IS the algorithm - each step depends on something being true, or not yet
     * true, about the text it receives. Moving one has broken a real pattern every time it has been
     * tried. The dependencies, in order:
     *
     *  1. expandPatternStitchUsage - on untouched raw text. "as established TO LAST 5 sts" is one
     *     phrase here; cleanModifiers (4) strips bare words like "last" and would leave nothing.
     *  2. resolveStandingChains - before stripNonStitchProse (4). "ch 3 (counts as dc)" must become the
     *     one stitch it stands for before the counts-as rule strips the note and leaves a bare "ch 3",
     *     which is a real chain count and tokenizes as three. Test: test-counting.js §6.
     *  3. stripColorReferences - before stripJoiningSlipStitches (4). "Join C with sl st in seam" must
     *     lose its "C" or the joining rule cannot match, "c" reports as unknown AND the slip stitch is
     *     counted as fabric. Test: test-garment.js.
     *  4. The prose strips - joining slip stitches, markers, NON_STITCH_PROSE, cleanModifiers - in that
     *     relative order, so a rule recognising a specific longer phrase gets first look before the
     *     generic word-level cleanup takes a word out of the middle of it.
     *  5. expandIntoOneGroups - before expandBracketRepeats (7). A group followed by a target -
     *     "(3 dc, ch 2, 3 dc) in corner ch-2 sp" - folds into one priced token here; left to the
     *     generic expander it is torn apart on its commas and the corner is charged three times. The
     *     two delimiter forms are checked separately, not as one character class: a combined class
     *     matched a bracket nested in parens as the WRONG pair and silently moved a vintage count by
     *     two. Test: test-counting.js §7.
     *  6. expandRepeatFromBeginning - before expandAsteriskRepeats (7), which it rewrites into. Reversed,
     *     step 7 finds no `*` in a beg-style row and does nothing.
     *  7. expandAsteriskRepeats - reads `availableCorners`, threaded in from the previous round's
     *     evaluateStep (app.js), not derived here. "Repeat from * to end" closes when every corner is
     *     worked, not when the stitch pool empties - sizing by stitches took a 4-corner round to 14
     *     repeats. A data dependency rather than a pass-order one, but with the same consequence: get
     *     this input wrong and nothing downstream recovers it. Test: test-counting.js §9.
     *  8. The normalize pass folding "<stitch> in next N sts" to a bare count runs on the whole string
     *     ahead of the segment loop, and deliberately declines the form with a multiplier in front -
     *     "2 sc in next 10 sts". Folding keeps one number and there are two: the count is POSITIONS and
     *     the multiplier is how many stitches go into each. Only the segment loop carries both (as
     *     perEachPosition), so the phrase has to arrive there unfolded, or a mid-row increase comes out
     *     the same length as the row below. Test: test-miscount.js §1.
     *
     * A change here that moves a count in tests/fixtures-vintage-counts.json is not automatically wrong
     * - see the snapshot's own note - but it must be inspected, never accepted because the suite still
     * says "0 failed" after the assertions were edited to match.
     */
    /**
     * One compiled regex per dictionary key. The tokenizer asks for every key on every chunk of every
     * row, and building 143 RegExp objects inside that loop was the single most expensive thing the
     * parse did. Keyed by the key text, which is all the pattern depends on, so a custom stitch just
     * adds an entry and a removed one leaves a harmless unused cache slot.
     */
    const tokenRegexCache = new Map();
    function tokenRegexFor(key) {
        let cached = tokenRegexCache.get(key);
        if (!cached) {
            const keyEscaped = key.replace(/[ \-]/g, '[ \\\\-]');
            // The leading \b is required: without it a key matches mid-word, e.g. 'ch' absorbing the
            // "ch" in "mystitch" instead of flagging it as unknown.
            cached = new RegExp(
                `(?:\\b(\\d+)\\s+)?\\b(${keyEscaped})(?:s|es)?(?:\\s*(?:x|times|\\*)\\s*(\\d+))?\\b`,
                "i"
            );
            tokenRegexCache.set(key, cached);
        }
        return cached;
    }

    function parseInstructions(instructionString, availableStitches = 0, depth = 0, availableCorners = 0) {
        const dict = getFullDictionary();
        // Colours first: "Join C with sl st in seam" must become "join with sl st in seam" before
        // stripJoiningSlipStitches can recognise it. A pattern-stitch reference resolves on raw text,
        // before anything is stripped. Standing chains resolve first of all - "ch 3 (counts as dc)" has
        // to become the one stitch it stands for before the prose rules leave a bare "ch 3".
        let cleaned = cleanModifiers(stripNonStitchProse(stripMarkerInstructions(
            stripJoiningSlipStitches(stripColorReferences(resolveStandingChains(
                depth === 0 ? expandPatternStitchUsage(instructionString) : instructionString))))));

        // Depth-guarded: both passes re-enter parseInstructions to price the group they are rewriting,
        // and those inner calls must not expand again.
        if (depth === 0) {
            cleaned = expandIntoOneGroups(cleaned, depth);
            cleaned = expandRepeatFromBeginning(cleaned);
            cleaned = expandAsteriskRepeats(cleaned, availableStitches, depth, availableCorners);
        }

        const expanded = expandBracketRepeats(cleaned);
        let normalized = expanded.toLowerCase();

        // The lookbehind hands the leading-count form - "2 sc in next 10 sts" - to the segment loop
        // untouched. This rule folds the phrase to a bare count, reading it as the number of POSITIONS;
        // with a multiplier in front there are two numbers and only one survives, so the "2" was
        // silently dropped and a mid-row increase came out a plain run. Only the segment loop carries
        // both (as perEachPosition), so the phrase has to reach it.
        normalized = normalized.replace(
            new RegExp(String.raw`(?<!\d\s{1,4})\b(${STITCH_LEAD})\s+in\s+(?:the\s+)?(?:next|last|final|first)\s+(\d+)\s*(?:${STITCH_NOUN})\b`, 'gi'),
            (_, stitch, count) => `${count} ${stitch}`
        );

        // "sc in each st and ch-1 sp across" is ONE to-end clause covering every position, not two
        // segments. Collapsed before the ' and ' split below, or the row consumes only the first half
        // and reports underworked.
        normalized = normalized.replace(
            /\bin\s+each\s+[a-z0-9\- ]*?\s+and\s+[a-z0-9\- ]*?\s+(across|around)\b/gi,
            'in each st $1'
        );

        const segments = normalized.split(/[,]|(?:\s+and\s+)/i);
        let totalCost = 0; let totalYield = 0;
        // How much of this row's cost went on chain spaces rather than stitches. A granny round works
        // into the spaces of the round below and passes over every stitch, so recognising such a row is
        // what stops it being reported as leaving 12 stitches unworked when that is how it is built.
        let spaceCost = 0;
        // Yield contributed by chains rather than by stitches worked into the fabric. A granny square
        // states its count in double crochets - "(24)" means 24 dc, never 24 dc plus the twelve chains
        // that form its corner and side spaces - so the two figures have to be kept apart or a correct
        // round reports half as much again as it made. See stitchYield in evaluateStep.
        let chainYield = 0;
        // A corner named without its width is the one the round below made. Two is the near-universal
        // granny corner, and only the starting assumption: the first ch-N corner the row names replaces it.
        let lastCornerWidth = 2;
        // How many corners this row works into. A square has four, and that is what tells a "repeat from
        // * to end" round how many times to go round.
        let cornersUsed = 0;
        const unrecognizedTokens = []; const tokens = [];
        const dictKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

        // Foundation/chain phrasing puts the count AFTER the stitch ("fsc 15", "ch 20"). Flip it so the
        // tokenizer's standard leading-count form applies. Longest keys first so 'fsc' wins over 'sc';
        // the trailing \s+ keeps "sc x 5" untouched.
        const trailingCountRegex = new RegExp(
            `\\b(${dictKeys.map(k => k.replace(/[ \-]/g, '[ \\-]')).join('|')})\\s+(\\d+)\\b`,
            "i"
        );

        /**
         * What the rest of the row still has to pay for. A run worked "across" fills what is left, but
         * what is left is everything unspent MINUS the work that comes after it.
         *
         * The raglan yoke shows it. "*hdc in each st across to next ch-1 sp, (hdc, ch 1, hdc) in ch-1
         * sp; rep from * 3 more times" expands to four runs and four corners; the first run took all 64
         * stitches, left nothing for the other three, and the four corners were charged on top - so a
         * round working exactly the 64 stitches under it was reported as needing 68. Reserving the
         * corners first gives the runs 60 to share, which is what the round actually works.
         *
         * Priced at availableStitches 0, the same way expandAsteriskRepeats prices text outside a
         * repeat: a later run's own "across" contributes nothing to the reservation, which both stops
         * this recursing and is correct - two runs cannot each reserve the remainder from the other.
         */
        const costOfRemainingSegments = (from) => {
            const rest = segments.slice(from + 1).join(', ').trim();
            if (!rest || !/[a-z]/i.test(rest)) return 0;
            return parseInstructions(rest, 0, depth + 1).totalCost;
        };

        segments.forEach((segment, segmentIndex) => {
            let chunk = segment.trim().toLowerCase();
            if (!chunk) return;

            // "2 dc in last st" works twice into ONE stitch, exactly like "in next st"; last/first/final
            // belong here, and the plural forms ("in last 4 sts") are rewritten to "x 4" further down
            // and never reach this test. The target noun may be a stitch NAME rather than the generic
            // "st": "2 s c in next s c" is the same shape, and without it the round reads as two
            // separate stitches and a flat circle never grows.
            let isSameStitch = /\b(?:in|into)\s+(?:the\s+)?(?:same|next|one|last|first|final)\s+(?:st|stitch|sp|space|sc|dc|hdc|tr|dtr|s\s+c|d\s+c|tr\s+c|s\s+d\s+c)\b/i.test(chunk);

            // A chain space is one place to put the hook, however many stitches go into it: "(3 dc, ch 2,
            // 3 dc) in corner ch-2 sp" is one corner, not six positions. What it costs is the chains it
            // was made from - the round below banked those, so spending them back balances the two
            // rounds. The qualifier is optional and may sit on either side of the number: "in next ch-1
            // sp", "in corner ch-2 sp", "in ch-2 corner sp" and a bare "in ch-2 sp" are interchangeable.
            const chainSpace = chunk.match(
                /\b(?:in|into)\s+(?:the\s+)?(?:same|next|one|last|first|final|corner|each)?\s*ch-?\s*(\d+)\s*(?:corner\s+)?(?:sp|space)\b/i);
            // "in corner sp" names the corner without restating how wide it is. It is the
            // ch-N the round below put there, so it is worth what that was worth - and a
            // granny corner is a ch-2 unless the pattern has said otherwise. Only
            // "corner" is read this way: a bare "same space" means the same STITCH in the
            // mid-century books, and reading those as chain spaces moved 33 of them.
            //
            // "sp"/"space" is optional here too, matching CH_SPACE_TARGET above: once that has folded
            // "(3 dc, ch 2, 3 dc) in each corner" into one "8in1 in each corner" chunk, this is what
            // reads the target back and prices it as the space rather than as 8 stitches. Still excluded
            // when "corner" names a real stitch position - "in corner st" - not the space.
            const cornerSpace = !chainSpace && /\b(?:in|into)\s+(?:the\s+)?(?:next\s+|same\s+|each\s+)?corner(?!\s+stitch|\s+st\b)(?:\s+(?:sp|space))?\b/i.test(chunk);
            if (chainSpace) lastCornerWidth = parseInt(chainSpace[1], 10);
            const spaceWidth = chainSpace ? parseInt(chainSpace[1], 10) : (cornerSpace ? lastCornerWidth : 0);
            if (chainSpace || cornerSpace) isSameStitch = true;
            if (spaceWidth > 0 && /\bcorner\b/i.test(chunk)) cornersUsed++;

            // "2 hdc in each of next 2 sts" puts TWO stitches into EACH of two positions: it consumes
            // 2 and makes 4. The rewrite just below folds "in each of next 2 sts" to a bare count, after
            // which the leading 2 reads as the number of positions and the doubling is lost - and that
            // phrase is the increase at the peak of every ripple row.
            //
            // "each of" is optional. "2 sc in next 10 sts" is the same increase written short, and is
            // written that way constantly: "2 sc in next st" already put two into one position, so the
            // plural cannot mean anything but two into each of ten. Requiring the words dropped the
            // leading 2 on the plural form only - a mid-row increase then read as a plain run, and the
            // row came out exactly as long as the row below, which is the shape of error that looks right.
            const eachOfMatch = chunk.match(new RegExp(
                String.raw`\b(\d+)\s+(?:${STITCH_LEAD})\s+in\s+(?:each\s+of\s+)?(?:the\s+)?${COUNT_LEAD}\d+\s*(?:${STITCH_NOUN})\b`, 'i'));
            const perEachPosition = eachOfMatch ? parseInt(eachOfMatch[1], 10) : 1;

            chunk = chunk.replace(
                new RegExp(String.raw`\b(${STITCH_LEAD})\s+in\s+(?:each\s+of\s+)?(?:the\s+)?${COUNT_LEAD}(\d+)\s*(?:${STITCH_NOUN})\b`, 'gi'),
                (_, stitch, count) => `${count} ${stitch.toLowerCase()}`
            );

            chunk = chunk.replace(/\bwork\s+(\d+)\s+([a-z0-9]+)\b/gi, "$1 $2");
            chunk = chunk.replace(/\bin\s+each\s+remaining\s+st(?:itch)?\b/gi, "across");
            chunk = chunk.replace(new RegExp(String.raw`\bin\s+(?:each\s+of\s+)?(?:the\s+)?${COUNT_LEAD}(\d+)\s*(?:${STITCH_NOUN})\b`, 'gi'), "x $1");
            // The same with the piece named instead of a next/first: "in each of the 48 Back sts", "in
            // 3 underarm chs". Run after the rules above so a plain "next N sts" is already gone and
            // cannot match with "next" mistaken for the piece name. "across" is included as well as
            // "in": "hdc across 46 Back sts" is a run of exactly 46, not a run to the end of the round,
            // and it has to lose the word here or the isToEnd test below reads it as one.
            chunk = chunk.replace(new RegExp(String.raw`\b(?:in|across)\s+(?:each\s+of\s+)?(?:the\s+)?(\d+)\s+${PIECE_NAME}(?:${STITCH_NOUN})\b`, 'gi'), "x $1");
            chunk = chunk.replace(/\b(?:the|of|remaining)\b/gi, "");
            chunk = chunk.replace(/\s+/g, " ").trim();
            chunk = chunk.replace(trailingCountRegex, (_, stitch, count) => `${count} ${stitch}`);

            // "in each s c" with no "across"/"around" is how the mid-century books write a whole round.
            // Anchored to the end of the chunk so "3 dc in each ch-2 space" - per-space, not per-stitch
            // - is left alone.
            const bareInEach = /\bin\s+each\s+(?:st|stitch|sc|dc|hdc|tr|s\s+c|d\s+c|tr\s+c|s\s+d\s+c)\s*$/i;
            // "around" means to the end of the round - except in a post stitch, where it says where the
            // hook goes: "FPdc around next st" works one stitch around one post. Read as a round, the
            // first post stitch of a ribbing row consumed everything available and the rest counted nothing.
            const aroundTheRound = /\baround\b(?!\s+(?:the\s+)?(?:post|next|each|last|first|same|\d))/i;
            const isToEnd = /\b(?:to\s+end|across|in\s+each\s+st\s+(?:across|around))\b/i.test(chunk)
                || aroundTheRound.test(chunk)
                || bareInEach.test(chunk);
            if (isToEnd) {
                chunk = chunk
                    .replace(bareInEach, '')
                    .replace(/\b(?:to\s+end|across|around|in\s+each\s+st\s+(?:across|around)|each\s+st|in\s+each\s+st)\b/gi, '')
                    .trim();
            }

            let matchedInChunk = false;
            chunk = chunk.replace(/\bwork\s+/gi, "");

            // Pick the stitch appearing EARLIEST in the instruction, not the first dictionary key that
            // matches somewhere: "sc in 2nd ch from hook" is a single crochet mentioning a chain, not a
            // chain. dictKeys is sorted longest-first and ties keep the incumbent, so an equal position
            // still prefers the more specific key ('spike sc' over 'spike').
            let best = null;
            for (const key of dictKeys) {
                const candidate = chunk.match(tokenRegexFor(key));
                if (candidate && (!best || candidate.index < best.match.index)) {
                    best = { key, match: candidate };
                }
            }

            {
                const key = best ? best.key : null;
                const match = best ? best.match : null;

                if (match) {
                    const preMult = parseInt(match[1] || '1', 10);
                    const postMult = parseInt(match[3] || '1', 10);
                    let multiplier = preMult * postMult;
                    const stitchData = dict[key];
                    // How many stitches go into EACH position. "2 sc in each st around" works two into
                    // every available stitch: the leading 2 multiplies the yield while the row still
                    // consumes one position per stitch. Folded into the multiplier it was dropped
                    // silently and the round reported unchanged - which is how most amigurumi round 2
                    // is written. "2 hdc in each of next 2 sts" is the same with a stated position count.
                    let perPosition = perEachPosition;

                    if (isToEnd && availableStitches > 0) {
                        const reserved = costOfRemainingSegments(segmentIndex);
                        const remainingStitches = Math.max(0, availableStitches - totalCost - reserved);
                        perPosition = multiplier;
                        multiplier = Math.floor(remainingStitches / (stitchData.cost > 0 ? stitchData.cost : 1));
                    }

                    let stepCost = stitchData.cost * multiplier;
                    if (isSameStitch && multiplier > 1 && !isToEnd) stepCost = stitchData.cost;
                    const stepYield = stitchData.yield * multiplier * perPosition;

                    // Into a chain space the price is the space, not the stitches: its N chains, once,
                    // however many stitches go into it. A whole group written "(3 dc, ch 2, 3 dc) in
                    // corner ch-2 sp" has already been folded into one token by expandIntoOneGroups, so
                    // a single charge here covers the corner.
                    //
                    // Under the discount convention the space costs nothing at all, not just fewer
                    // stitches: the round below never banked it as a real stitch to spend back (its own
                    // yield excluded it too), so the round after it can consume the space for free. This
                    // is what lets a corner be pure growth - "dc in each st across to next ch-2 sp" then
                    // absorbs the WHOLE real count of the round below, with the corner's own real
                    // stitches landing on top of that rather than trading places with two of them. Without
                    // this a discounted corner still reserved its declared width from the run beside it,
                    // which canceled out exactly what discounting its yield gained and left every round
                    // flat instead of growing - wrong for every real corner-increase construction (raglan
                    // yokes, granny squares), which is what this convention exists for in the first place.
                    if (spaceWidth > 0 && !isToEnd) {
                        stepCost = chainSpaceConvention === 'discount' ? 0 : spaceWidth;
                    }

                    totalCost += stepCost;
                    // Tracked from the space's declared width, not the (possibly discounted) stepCost
                    // above: this only has to say "a space was worked here", for the under-consumption
                    // exemption below - a granny round that skips real stitches between corners must stay
                    // excused under either convention.
                    if (spaceWidth > 0 && !isToEnd) spaceCost += spaceWidth;
                    totalYield += stepYield;
                    if (key === 'ch' || key === 'chain') chainYield += stepYield;
                    tokens.push({ name: key, count: multiplier * perPosition, cost: stepCost, yield: stepYield });
                    matchedInChunk = true;
                    chunk = chunk.replace(match[0], '').trim();
                }
            }

            if (!matchedInChunk && chunk.length > 0 && !/^\d+$/.test(chunk)) {
                let cleanChunk = chunk.replace(/\b(the|first|last|final|then|work|into|in|next|sts?|stitches?|spaces?|sps?|around|each|across|to\s+end|same|one|times?|total|more|rep|repeat|from)\b/gi, '').trim();
                cleanChunk = cleanChunk.replace(/^[,\.\-]+|[,\.\-]+$/g, '').trim();
                // Punctuation left behind when a phrase is stripped is not an unreadable term. "do not
                // join." leaves a bare ";" once the prose goes, and reporting that as unrecognised
                // failed a row that had been fully read.
                const hasWord = /[a-z0-9]/i.test(cleanChunk);
                if (cleanChunk.length > 0 && hasWord && !/^\d+$/.test(cleanChunk)) unrecognizedTokens.push(cleanChunk);
            }
        });

        return {
            totalCost, totalYield, cost: totalCost, yield: totalYield,
            spaceCost, cornersUsed, chainYield,
            expandedText: expanded, expandedInstruction: expanded,
            unrecognizedTokens, unknownTokens: unrecognizedTokens,
            tokens, errors: [], warnings: [], reasons: [], messages: []
        };
    }

    /**
     * Structural faults in how a row is punctuated, as opposed to what it adds up to: a bracket that
     * never closes, a group opened with one delimiter and closed with another, a "rep from *" whose
     * marker was never placed.
     *
     * Every one is survivable, and the expanders do survive them - they drop what they cannot parse and
     * read the rest, which is the right recovery and exactly why the faults went unreported. The row
     * still produces a number: on an unclosed bracket, the row minus the whole group; on a mismatched
     * pair, the expander never checked which closer it got, so the row reads as though nothing were
     * wrong; on an orphaned "rep from *", the clause is dropped and a row that should repeat is counted
     * once. The arithmetic then reports what it can see - "previous row count is wrong" - which is a
     * row that is fine, and the wrong place to look.
     *
     * `index` is where in the text the offending character sits, and `expected` is the closer that
     * should have been there. Neither changes what is reported - they are what lets the linter offer
     * the repair as an edit rather than only as a sentence.
     *
     * @returns {Array<{kind: string, message: string, char: string, index: number, expected?: string}>}
     *          in the order the faults appear
     */
    const NOTATION_PAIRS = { '(': ')', '[': ']' };
    const NOTATION_CLOSERS = { ')': '(', ']': '[' };

    function notationFaults(text) {
        const line = String(text || '');
        const faults = [];
        const open = [];

        // Indexed by hand rather than with entries(): for...of walks code points, so a character
        // outside the BMP advances the position by two and a running counter would drift off it.
        let at = 0;
        // How many of each delimiter have been passed. `index` locates a fault in THIS string, but a
        // caller holding the original line has it with the row label and written count still attached,
        // where that offset means nothing. "The third ')' in the row" survives the difference.
        const seen = {};
        for (const ch of line) {
            const index = at;
            at += ch.length;
            const occurrence = (NOTATION_PAIRS[ch] || NOTATION_CLOSERS[ch]) ? (seen[ch] = (seen[ch] || 0) + 1) - 1 : 0;
            if (NOTATION_PAIRS[ch]) {
                open.push({ ch, index, occurrence });
            } else if (NOTATION_CLOSERS[ch]) {
                if (!open.length) {
                    faults.push({
                        kind: 'unopened', char: ch, index, occurrence,
                        message: `"${ch}" closes a group that was never opened`
                    });
                    continue;
                }
                const started = open.pop();
                if (NOTATION_PAIRS[started.ch] !== ch) {
                    faults.push({
                        kind: 'mismatched', char: ch, index, occurrence, expected: NOTATION_PAIRS[started.ch],
                        message: `a group opened with "${started.ch}" is closed with "${ch}"`
                    });
                }
            }
        }
        open.forEach(({ ch, index, occurrence }) => faults.push({
            kind: 'unclosed', char: ch, index, occurrence, expected: NOTATION_PAIRS[ch],
            message: `"${ch}" is never closed`
        }));

        // "rep from *" points back to a marker. The first asterisk has to come before the clause that
        // refers to it, or there is nothing to go back to.
        const clause = line.search(/\b(?:rep|repeat)\s+from\s+\*/i);
        if (clause >= 0 && line.indexOf('*') >= clause) {
            faults.push({
                kind: 'orphan-repeat', char: '*', index: clause,
                message: 'a "rep from *" has no earlier "*" in the row to repeat from'
            });
        }

        return faults;
    }

    /**
     * Ranks what a human most likely did wrong, rather than restating the arithmetic. Each candidate
     * scores from a concrete signal in the row and carries the evidence that produced it.
     *
     * Deliberately NOT percentages: there is no corpus of real designer errors behind these weights, so
     * a "92%" would be invented precision. Tiers say only what the evidence supports - which cause is
     * best supported, not how often it occurs in the wild.
     */
    function diagnoseRowFailure(ctx) {
        const { availableStitches, totalCost, calculatedYield, expectedYield, repeat, unknownTokens } = ctx;
        const causes = [];

        const costGap = availableStitches - totalCost;
        const yieldGap = expectedYield > 0 ? expectedYield - calculatedYield : 0;

        // A row punctuated wrong was not read as written, so every number below measures a row the
        // reader did not type. Ranked above the arithmetic causes for that reason - not because it is
        // more common, but because none of them can be judged until this is fixed. Only "typo or unknown
        // stitch" outranks it, and that is the same kind of finding: the text could not be read.
        (ctx.notation || []).forEach(fault => {
            causes.push({
                cause: 'Notation is malformed',
                score: 95,
                evidence: fault.message
            });
        });

        if (unknownTokens.length) {
            causes.push({
                cause: 'Typo or unknown stitch',
                score: 100,
                evidence: `${unknownTokens.map(t => `"${t}"`).join(', ')} could not be matched to any stitch`
            });
        }

        if (repeat && repeat.cost > 0) {
            // A row short by exactly one stitch per repeat is the classic dropped increase.
            if (yieldGap > 0 && repeat.times > 0 && yieldGap % repeat.times === 0) {
                const perRepeat = yieldGap / repeat.times;
                causes.push({
                    cause: perRepeat === 1 ? 'Missing increase' : `Missing ${perRepeat} stitches per repeat`,
                    score: 90,
                    evidence: `yield is ${yieldGap} short over ${repeat.times} repeats, exactly ${perRepeat} per repeat`
                });
            }
            if (yieldGap < 0 && repeat.times > 0 && (-yieldGap) % repeat.times === 0) {
                const perRepeat = (-yieldGap) / repeat.times;
                causes.push({
                    cause: perRepeat === 1 ? 'Missing decrease' : `${perRepeat} extra stitches per repeat`,
                    score: 90,
                    evidence: `yield is ${-yieldGap} over across ${repeat.times} repeats, exactly ${perRepeat} per repeat`
                });
            }
            if (costGap !== 0 && costGap % repeat.cost === 0) {
                causes.push({
                    cause: 'Incorrect repeat count',
                    score: 70,
                    evidence: `the ${costGap > 0 ? 'unworked' : 'excess'} ${Math.abs(costGap)} stitches divide evenly into ${Math.abs(costGap / repeat.cost)} whole repeat(s)`
                });
            }
            // The row is not short of repeats, it is short of a stitch count the repeat fits. Outranks
            // "previous row count is wrong", which is the same observation without the reason, and which
            // sent the reader to the wrong row to fix it.
            if (repeat.openEnded && costGap > 0 && costGap % repeat.cost !== 0) {
                causes.push({
                    cause: `Stitch count is not one the repeat divides`,
                    score: 85,
                    evidence: `the repeat takes ${repeat.cost} stitches a pass and ${availableStitches - repeat.restCost} are left for it, which is ${repeat.times} whole passes and ${costGap} over`
                });
            }
        }

        if (costGap !== 0) {
            causes.push({
                cause: 'Previous row count is wrong',
                score: Math.abs(costGap) <= 2 ? 55 : 30,
                evidence: `this row works ${totalCost} stitches against ${availableStitches} available (off by ${Math.abs(costGap)})`
            });
        }

        if (!unknownTokens.length && costGap !== 0) {
            causes.push({
                cause: 'Wrong stitch abbreviation',
                score: 15,
                evidence: 'every stitch was recognized, so a valid-but-unintended abbreviation is possible'
            });
        }

        // Tiers reflect strength of evidence only - the top cause is the best supported.
        return causes
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map((c, i) => ({
                cause: c.cause,
                evidence: c.evidence,
                tier: i === 0 ? 'MOST LIKELY' : (c.score >= 50 ? 'POSSIBLE' : 'UNLIKELY')
            }));
    }

    /** The two causes above that mean "this row's own text could not be read". While either stands, no
     *  arithmetic measured against the row means anything - see applyUpstreamCause. */
    const UNREADABLE_CAUSES = ['Typo or unknown stitch', 'Notation is malformed'];

    /**
     * The one cause no single row can see, and the reason it lives here rather than in the caller.
     *
     * A dropped increase does not fail the row it happens on - that row's stitch math still balances,
     * only its written count is off. It fails the row *after*, which arrives expecting stitches that
     * were never made. evaluateStep sees one row at a time and cannot spot that, so the comparison has
     * to happen somewhere that can see two. It used to happen in app.js, which meant the UI layer was
     * calling parseInstructions and analyzeRepeatUnit and deciding what a failure meant - and, because
     * it decided alone, it could disagree with the diagnosis the engine had already produced.
     *
     * It did disagree. The override was unconditional, so a misspelled stitch on Row 3 was reported as
     * "Row 2 is short 87 stitches" at MOST LIKELY, sending the designer to edit a count that was not
     * the problem while the actual misspelling was demoted to POSSIBLE. Both guards below are the fix,
     * and both restate rules this file already holds elsewhere: diagnoseRowFailure scores an unknown
     * token at 100 so nothing outranks it, and buildResolutions refuses deficit advice after one.
     *
     * `prev` is the previous row reduced to the five things this decision needs. Deliberately not the
     * caller's row object: what a row looks like on screen is the caller's business, and taking the
     * whole thing would make this function care about it.
     *
     * Returns the new likelyCauses list, or the one it was given, unchanged.
     */
    function applyUpstreamCause(evaluation, prev) {
        const causes = (evaluation && evaluation.likelyCauses) || [];
        if (!prev) return causes;

        // Guard one: the failing row's own text is unreadable, so its numbers are not evidence about
        // anything upstream. The row worked 0 of the stitches available to it because the tokenizer
        // stopped, not because the row above came up short.
        if ((evaluation.unknownTokens || []).length) return causes;
        if (causes.some(c => UNREADABLE_CAUSES.indexOf(c.cause) !== -1)) return causes;

        // Guard two: the signal only exists when the previous row fell short of its OWN written count.
        const written = prev.expectedYield;
        const actual = prev.calculatedYield;
        if (!(written > 0)) return causes;
        const missing = written - actual;
        if (missing <= 0) return causes;

        const repeat = analyzeRepeatUnit(
            prev.instructionString, prev.multiplier,
            parseInstructions(prev.instructionString, 0));

        // A row short by exactly one stitch per repeat is the classic dropped increase, and saying so
        // is worth more than saying the total.
        const perRepeat = repeat && repeat.times > 0 && missing % repeat.times === 0
            ? missing / repeat.times
            : null;

        const label = prev.label || 'The previous row';
        return [
            {
                cause: perRepeat === 1 ? `Missing increase on ${label}` : `${label} is short ${missing} stitches`,
                evidence: perRepeat
                    ? `${label} produced ${actual} but its count says ${written} - short ${missing} over ${repeat.times} repeats, exactly ${perRepeat} per repeat`
                    : `${label} produced ${actual} but its count says ${written}, leaving this row ${missing} short`,
                tier: 'MOST LIKELY'
            },
            ...causes.map(c => ({ ...c, tier: c.tier === 'MOST LIKELY' ? 'POSSIBLE' : c.tier }))
        ].slice(0, 4);
    }

    /**
     * The count in parentheses is the designer's estimate, not an input to the math. A disagreement is
     * worth surfacing (it catches a typo) but never invalidates a row, so it comes back as a note.
     */
    function buildCountNote(calculatedYield, expectedYield) {
        if (!expectedYield || expectedYield === calculatedYield) return [];
        const diff = calculatedYield - expectedYield;
        return [`Written count ${expectedYield}, calculated ${calculatedYield} (${diff > 0 ? '+' : ''}${diff}). Stitch Math uses the calculated count.`];
    }

    /**
     * A round makes holes as well as stitches, and the count in parentheses almost never mentions them:
     * "(16 sts)" beside a granny round counts the sixteen dc and says nothing about the four ch-2 spaces
     * it also made. Stitch Math counts the round the way the designer did - stitches only, which is what
     * keeps the granny corpora reading straight - so the spaces would otherwise go unmentioned anywhere,
     * and they are what the round above works its corners into.
     *
     * Only raised when the stated count and the stitches agree. If they disagree the reader already has
     * a count note and that is the more urgent thing to read; if the pattern's number happens to include
     * the spaces, nothing is omitted.
     */
    /**
     * The written count disagrees, and the reason is the convention rather than a mistake.
     *
     * A granny square states "(24)" meaning twenty-four double crochets. Counting the corner and side
     * chains as well gives 38, so under the default convention a perfectly correct round looks wrong
     * by fourteen - and the designer has no way to tell that from an actual miscount.
     *
     * This is the note that replaced offering to "correct" the 24 to a 38, which rewrote the right
     * number to the wrong one in the very patterns it was meant to tidy. Here the two readings are
     * both known, so when the written count matches the OTHER one exactly, that is not a typo: it is
     * the pattern telling us which convention it was written in, and the only useful thing to say is
     * which setting makes the numbers agree.
     */
    /**
     * How many standard clusters a round of a square is made of, or null if it is not that shape.
     *
     * A classic granny square grows by exactly four clusters a round - one added to each side - so
     * round X holds 4X clusters and 12X double crochets. That is a strong enough regularity to check
     * against, and nothing else in the engine checks it: a round that drops one side cluster still
     * consumes and produces a consistent count, passes every balance rule, and comes out a rhombus.
     *
     * THE GATE IS THE HARD PART. Plenty of rounds work into chain spaces without being granny
     * squares - mesh, filet, shells, picot edgings - and holding those to a four-cluster rhythm would
     * flag correct work. So a round only qualifies when it carries the whole signature: it went into
     * chain spaces, it turned corners, and its stitches divide into threes AND its clusters into
     * fours. A round failing any of those returns null and takes no part in the check, which is the
     * conservative direction: a missed granny square costs a warning nobody sees, where a false one
     * tells a designer their correct shawl is a broken square.
     */
    const CLUSTER_DC = 3;

    /**
     * A corner, by its shape: a bracketed group holding a chain, worked INTO a space -
     * "(3 dc, ch 2, 3 dc) in next ch-2 sp". That chain inside the group is the corner itself; the two
     * clusters either side of it are what turn the fabric ninety degrees.
     *
     * Read off the text rather than off parsed.cornersUsed, which counts a corner only when the
     * designer writes the WORD "corner" - true of "in ch-2 corner sp" and not of the equally common
     * "in next ch-2 sp", so half of all squares register no corners at all. The group's own "in ... sp"
     * must follow the closing bracket, which is what keeps a mesh repeat like
     * "[dc in next ch-2 sp, ch 1] x 12" out: there the space is worked into from INSIDE the group.
     */
    const CORNER_GROUP_RE = /[\(\[][^()\[\]]*\bch(?:ain)?\s*\d+[^()\[\]]*[\)\]]\s*(?:in|into)\b[^,;]{0,40}?\bsp/gi;

    /**
     * Counted on the text AS WRITTEN, not on the expanded form: expandBracketRepeats folds a group
     * into an NinN token, which is exactly the shape being looked for here and destroys it. Writing a
     * round out in full is not required either - two distinct corner groups is the most a square ever
     * spells, since the other two live inside its "x 3", which is why the threshold is two.
     */
    function cornerGroupCount(instructionText) {
        CORNER_GROUP_RE.lastIndex = 0;
        const found = String(instructionText || '').match(CORNER_GROUP_RE);
        CORNER_GROUP_RE.lastIndex = 0;
        return found ? found.length : 0;
    }

    function clusterCount(evaluation, instructionText) {
        if (!evaluation || !(evaluation.spaceCost > 0)) return null;
        // Corners are what make this a square rather than a strip or a circle. Two is enough to ask
        // for - a round written with its repeat left open expands to fewer than four - and the
        // cluster arithmetic below has to agree as well before anything is claimed.
        if (cornerGroupCount(instructionText) < 2 && !(evaluation.cornersUsed > 0)) return null;
        const stitches = evaluation.stitchYield;
        if (!(stitches > 0) || stitches % CLUSTER_DC !== 0) return null;
        const clusters = stitches / CLUSTER_DC;
        return clusters % 4 === 0 ? clusters : null;
    }

    /**
     * Two consecutive rounds of a square that do not differ by exactly four clusters.
     *
     * Stated as a GROWTH rule rather than as "round X must hold 4X", because the growth is the thing
     * that is actually true of the fabric and it needs no agreement about which round is round one -
     * a square worked as the second piece of a document, or one whose first round the engine could
     * not classify, is still checked from wherever the run begins.
     *
     * Advisory, and `edit: null`: a square that grows by eight is not a broken square, it is a
     * different motif, and the only honest thing to do is say the shape will not come out square and
     * let the designer decide.
     */
    function buildClusterGrowthFix(previousClusters, clusters, label) {
        const gained = clusters - previousClusters;
        if (gained === 4) return null;

        return {
            id: 'granny-growth', severity: 'style',
            title: gained > 4
                ? `This round adds ${gained} clusters where a square adds 4`
                : gained < 0
                    ? `This round has ${-gained} fewer clusters than the one before it`
                    : `This round adds ${gained} cluster${gained === 1 ? '' : 's'} where a square adds 4`,
            detail: `The round before it holds ${previousClusters} cluster${previousClusters === 1 ? '' : 's'} `
                + `(${previousClusters * CLUSTER_DC} dc) and this one holds ${clusters} `
                + `(${clusters * CLUSTER_DC} dc). A square gains exactly one cluster on each of its four `
                + `sides, so the next round after ${previousClusters} should hold ${previousClusters + 4}.`,
            lesson: 'A classic granny square holds 4X clusters on round X - 4, 8, 12, 16 - because each '
                + 'round adds one cluster to every side. Growing by more than four makes the piece '
                + 'ruffle; by fewer, it cups. The stitch count still balances either way, which is why '
                + 'nothing else catches it.',
            edit: null
        };
    }

    function conventionMismatchNote(expectedYield, calculatedYield, stitchYield, rawYield, spaceCost) {
        if (!(spaceCost > 0) || !expectedYield || expectedYield === calculatedYield) return [];

        if (expectedYield === stitchYield) {
            return [`Written count ${expectedYield} is this round's stitches without the chains that `
                + `form its spaces; counting those as well gives ${calculatedYield}. Nothing is wrong `
                + `with the round — set "Chain-Sp Counts As" to "only the stitches worked into it" and `
                + `the two agree.`];
        }
        if (expectedYield === rawYield) {
            return [`Written count ${expectedYield} counts the chains that form this round's spaces as `
                + `stitches; leaving them out gives ${calculatedYield}. Set "Chain-Sp Counts As" to `
                + `"the chains count" and the two agree.`];
        }
        return [];
    }

    function chainSpaceNotes(instruction, calculatedYield, expectedYield) {
        if (!expectedYield || expectedYield !== calculatedYield) return [];
        const clean = expandBracketRepeats(stripRowPreamble(String(instruction || '')))
            // The chain the round stands up on is a stitch or a turning chain, not a space.
            .replace(/^\s*(?:ch|chain)\s*\d+\s*(?:\([^)]*\))?/i, ' ')
            // A chain the round works INTO was made by the round below and is counted there - what is
            // reported here is what THIS round leaves behind.
            .replace(/\b(?:in|into)\s+[^,;]*?ch-?\s*\d+\s*(?:corner\s+)?(?:sp|space)s?\b/gi, ' ')
            // The closing join names the standing chain it joins to - "sl st to top of ch-3". That is a
            // reference to a chain the round already made, not another one.
            .replace(/\b(?:top|\d+\s*(?:st|nd|rd|th)\s+ch(?:ain)?)\s+of\s+(?:the\s+)?(?:beg(?:inning)?\s+)?ch(?:ain)?\s*-?\s*\d+/gi, ' ');
        const widths = {};
        const re = /\bch(?:ain)?\s*-?\s*(\d+)\b(?!\s*(?:sp|space))/gi;
        let m, total = 0;
        while ((m = re.exec(clean)) !== null) {
            widths[m[1]] = (widths[m[1]] || 0) + 1;
            total++;
        }
        if (!total) return [];
        const parts = Object.keys(widths)
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map(w => `${widths[w]} ch-${w} space${widths[w] === 1 ? '' : 's'}`);
        return [`Also makes ${parts.join(' and ')}. The written count of ${expectedYield} counts stitches only.`];
    }

    /**
     * The payload for a row the tokenizer never sees: a foundation chain, a foundation row, a magic
     * ring, a chain ring. Each builds its own base, so there is no stitch pool to reconcile and nothing
     * that can fail - only the written count can disagree, and that is a note plus the advisory
     * yield_mismatch detail.
     *
     * `totalCost` is deliberately absent rather than zero: CalculatePatternHealth reads it through
     * Number.isFinite and treats a missing one as consuming nothing, which is exactly true of all four.
     */
    /**
     * Does this round open with a chain that stands in for its first stitch?
     *
     * Broader than impliedStandingChain, and deliberately so: that one anchors the chain to the START
     * of the line, which is right for a turning chain but wrong for a granny round. A granny round
     * traverses first - "sl st to next ch-2 sp, ch 3, 2 dc in same sp" - so the chain that stands for
     * the round's first dc is not at position 0 and the anchored test missed every one of them,
     * leaving the stitch count exactly one short on every round of every square.
     *
     * Two signals, either sufficient: the pattern says so outright, or it joins to the top of that
     * chain at the end of the round, which says the same thing in the other direction - you only join
     * to the top of a chain that is standing where a stitch would be.
     */
    function standingChainSubstitutes(text) {
        const line = String(text || '');
        if (!line) return false;
        if (/\b(?:ch|chain)\s*\d+\s*\(\s*(?:this\s+)?counts?\s+as\b(?![^)]*\bnot\b)/i.test(line)) return true;

        const join = line.match(
            /\b(?:sl\s*st|slst|slip\s+stitch|join)\b[^,;]{0,40}?\btop\s+of\s+(?:the\s+)?(?:beg(?:inning)?\s+)?ch(?:ain)?\s*-?\s*(\d+)\b/i);
        // The chain it names has to actually be on the line, or the join is describing something the
        // round never made.
        if (join) return new RegExp(`\\b(?:ch|chain)\\s*${join[1]}\\b`, 'i').test(line);

        // The same join written without naming the chain - "sl st to top", "join with sl st in top of
        // beg ch". Extremely common, and it says exactly as much: you only join to the TOP of
        // something standing where a stitch would be. Paired with an opening chain of two or more,
        // because a ch 1 opening a round is a turning chain that stands for nothing.
        if (!/\b(?:sl\s*st|slst|slip\s+stitch|join)\b[^,;]{0,30}?\btop\b/i.test(line)) return false;
        const opening = line.match(/\b(?:ch|chain)\s*(\d+)\b/i);
        return !!opening && parseInt(opening[1], 10) >= 2;
    }

    function unworkedRow(calculatedYield, expectedYield, notes) {
        return {
            costIsValid: true,
            calculatedYield,
            // A foundation, a magic ring and a chain ring all count their own stitches directly and
            // never counted scaffolding chains in the first place, so the two figures are the same
            // here. Set rather than left undefined, so every caller can read stitchYield off any
            // evaluation without checking which path produced it.
            stitchYield: calculatedYield,
            reason: '',
            errorDetails: (expectedYield !== 0 && calculatedYield !== expectedYield)
                ? [{ type: 'yield_mismatch', message: 'Yield mismatch' }]
                : [],
            unknownTokens: [],
            notes,
            resolutions: []
        };
    }

    // === 6. EVALUATE STEP FUNCTION === //
    function evaluateStep(initialChain = 0, availableStitches = 0, instructionString = '', rowMultiplier = 1, expectedYield = 0, availableCorners = 0, unstatedSkip = 0) {
        let errorDetails = [];
        let reasons = [];

        // Foundation chain step validation
        if (initialChain > 0 && (!instructionString || instructionString.trim() === '')) {
            const yieldVal = initialChain * rowMultiplier;
            return unworkedRow(yieldVal, expectedYield, buildCountNote(yieldVal, expectedYield));
        }

        // Foundation row: "ch N, sc in 2nd ch from hook and in each ch across". Checked before the
        // tokenizer, which would count the chains and the stitches worked back along them separately.
        const foundation = parseFoundationRow(instructionString, availableStitches, unstatedSkip);
        if (foundation.isFoundationRow) {
            const calculatedYield = foundation.count * rowMultiplier;
            const matchesExpected = expectedYield === 0 || calculatedYield === expectedYield;
            const notes = [];
        // A skip the row never stated is said out loud either way. At 0 nothing on the row settled it
        // and every chain is counted as worked; above 0 the number was read off the row's own opening
        // stitch, which is a convention rather than something the pattern confirmed.
            if (!foundation.skipStated) {
                notes.push(foundation.skipped === 0
                    ? `This row does not say which chain to work into first, and names no stitch whose standing chain would settle it, so all ${foundation.chains} chains are counted as worked.`
                    : `This row does not say which chain to work into first. Counting ${foundation.chains} chains less the ${foundation.skipped} its opening stitch stands on.`);
            }
            if (!matchesExpected) {
                notes.push(foundation.skipped === 0
                    ? `Written count ${expectedYield}, calculated ${calculatedYield}: all ${foundation.chains} chains counted as worked. Chain ${expectedYield} if you want ${expectedYield}.`
                    : `Written count ${expectedYield}, calculated ${calculatedYield}: ${foundation.chains} chains minus the ${foundation.skipped} skipped at the hook. Chain ${expectedYield + foundation.skipped} if you want ${expectedYield}.`);
            }
            return unworkedRow(calculatedYield, expectedYield, notes);
        }

        // Magic Ring handling
        const mrCheck = parseMagicRing(instructionString);
        if (mrCheck.isMagicRing) {
            const calculatedYield = mrCheck.count * rowMultiplier;
            return unworkedRow(calculatedYield, expectedYield,
                buildCountNote(calculatedYield, expectedYield));
        }

        // A ring made from a short chain, before the general path counts the scaffolding as stitches.
        const ringCheck = parseChainRing(instructionString);
        if (ringCheck.isChainRing) {
            // parseChainRing counts what was worked INTO the ring, which leaves out the chain the
            // round stood up on - so a granny square's opening round came back 11 where the designer
            // wrote 12. Credited only under the discount convention, for two reasons: it is the
            // reading in which that standing chain is unambiguously a stitch rather than three
            // chains, and 11 is the figure every existing corner test is pinned to under the default.
            // With it, round one is 12 and the square runs 12, 24, 36, 48 - three stitches per
            // cluster, four clusters per round.
            const standing = chainSpaceConvention === 'discount'
                && standingChainSubstitutes(instructionString) ? 1 : 0;
            const calculatedYield = ringCheck.count * rowMultiplier + standing;
            return unworkedRow(calculatedYield, expectedYield,
                buildCountNote(calculatedYield, expectedYield)
                    .concat(chainSpaceNotes(instructionString, calculatedYield, expectedYield)));
        }

        const parsed = parseInstructions(instructionString, availableStitches, 0, availableCorners);

        if (parsed.unrecognizedTokens.length > 0) {
            reasons.push(`Unrecognized instructions/tokens: "${parsed.unrecognizedTokens.join(', ')}"`);
            errorDetails.push({ type: 'syntax', message: 'Unknown token' });
        }

        const totalCost = parsed.totalCost * rowMultiplier;
        const calculatedYield = parsed.totalYield * rowMultiplier;

        const spaceCost = parsed.spaceCost * rowMultiplier;
        let costIsValid = true;

        // A round working into chain spaces passes over the stitches between them on purpose - that is
        // how a granny square is built, and holding it to the full stitch count of the round below
        // reported a correct round as leaving 12 unworked. Over-consumption is still caught: no round
        // can work more than is there. Only the "you left some behind" half is dropped, and only for a
        // round that went into spaces, where leaving some behind is the technique.
        const worksIntoSpaces = spaceCost > 0;

        // A ring is a hole, not a row of stitches: as many will go into it as the pattern asks for. When
        // the ring is made on its own line - "ch 4, sl st to first ch to form ring." then "[3 dc into
        // ring, ch 2] x 4" - the round after was measured against the ring's four chains and told it
        // needed twelve. Nothing is checked either way here, because there is no count to check against.
        const worksIntoRing = /\b(?:in|into)\s+(?:the\s+)?ring\b/i.test(instructionString);

        if (!worksIntoRing && (availableStitches > 0 || totalCost > 0)) {
            if (totalCost > availableStitches) {
                costIsValid = false;
                reasons.push(`Requires ${totalCost} stitches, but only ${availableStitches} are available.`);
                errorDetails.push({ type: 'physics_overconsume', message: 'Over-consuming stitches' });
            } else if (!worksIntoSpaces && totalCost < availableStitches && availableStitches > 0) {
                costIsValid = false;
                reasons.push(`Used ${totalCost} stitches out of ${availableStitches} available.`);
                errorDetails.push({ type: 'physics_underconsume', message: 'Under-consuming stitches' });
            }
        }

        // Advisory only: a written count that disagrees becomes a note, not a failure.
        if (expectedYield > 0 && calculatedYield !== expectedYield) {
            errorDetails.push({ type: 'yield_mismatch', message: 'Yield mismatch' });
        }

        // The count in double crochets, for a round worked into chain spaces.
        //
        // A granny square states "(24)" meaning twenty-four double crochets - never twenty-four plus
        // the twelve chains that form its corner and side spaces. calculatedYield counts both, so a
        // correct round reported half as much again as it made, the matrix showed the wrong number,
        // and the linter offered to write it into the pattern.
        //
        // Two things have to come off, and they pull in opposite directions. Chains that FORM a space
        // are scaffolding and are subtracted - including the ones inside a corner group, which is what
        // the discount convention already knows how to do, so it is borrowed here rather than
        // reimplemented. The opening chain that STANDS FOR a stitch is not scaffolding: it is the
        // round's first dc wearing a chain's clothing, so it is added back. resolveStandingChains has
        // already rewritten it to "ch 1" by this point, which is exactly why subtracting every chain
        // leaves the count one short.
        //
        // Only computed for a round that went into spaces at all, so an ordinary row pays nothing for
        // this and its reported count is untouched.
        let stitchYield = calculatedYield;
        if (spaceCost > 0) {
            const previous = chainSpaceConvention;
            chainSpaceConvention = 'discount';
            let discounted;
            try {
                discounted = parseInstructions(instructionString, availableStitches, 0, availableCorners);
            } finally {
                chainSpaceConvention = previous;
            }
            const standsForAStitch = standingChainSubstitutes(instructionString);
            stitchYield = Math.max(0,
                (discounted.totalYield - discounted.chainYield) * rowMultiplier + (standsForAStitch ? 1 : 0));
        }

        // The figure this round reports, chosen by the declared convention. Named before the notes and
        // the diagnosis context are built, so all three describe the same number.
        const reportedYield = chainSpaceConvention === 'discount' ? stitchYield : calculatedYield;

        const notation = notationFaults(instructionString);
        const diagnosisContext = {
            availableStitches,
            totalCost,
            calculatedYield: reportedYield,
            expectedYield,
            repeat: analyzeRepeatUnit(instructionString, rowMultiplier, parsed, availableStitches),
            unknownTokens: parsed.unrecognizedTokens,
            notation,
            // Whether the stitches balance, as decided above. buildFixes reports the imbalance itself
            // when it has no single edit to offer for it, and cannot re-derive that from the numbers:
            // a round working into chain spaces leaves stitches behind on purpose.
            costIsValid,
            // How much of this round went into chain spaces rather than into stitches. buildFixes uses
            // it to withhold the stated-count rewrite - see the comment there.
            spaceCost
        };
        const resolutions = buildResolutions(diagnosisContext);
        const likelyCauses = costIsValid && !parsed.unrecognizedTokens.length
            ? []
            : diagnoseRowFailure(diagnosisContext);

        return {
            costIsValid: costIsValid && parsed.unrecognizedTokens.length === 0,
            // Which of the two readings the round reports is the designer's declared convention, not
            // this function's choice - see stitchYield above.
            calculatedYield: reportedYield,
            // The other reading, always available. The pair is what lets the notes tell a designer
            // that their written count matches the convention they have NOT selected.
            rawYield: calculatedYield,
            // What the row eats, alongside what it makes. Both are worked out here either way; only the
            // yield used to be handed back, leaving every consumer to re-derive consumption from the
            // available count and get it wrong on any row that works into spaces.
            totalCost,
            reason: reasons.join('<br> • '),
            errorDetails,
            unknownTokens: parsed.unrecognizedTokens,
            spaceCost,
            // The same round counted in stitches rather than in stitches-and-chains. Equal to
            // calculatedYield on every row that does not work into spaces, so a caller can read it
            // unconditionally.
            stitchYield,
            // Corners this round went into, so the next one knows how many it has.
            cornersUsed: parsed.cornersUsed,
            // A standing chain the pattern pairs unconventionally is followed, not corrected - the note
            // is the only place that difference is mentioned. Raised whether or not the arithmetic came
            // out: a row can be punctuated wrong and still land on the right number, and that is the
            // case most worth saying out loud, because nothing else about it looks amiss.
            notes: buildCountNote(reportedYield, expectedYield)
                .concat(conventionMismatchNote(expectedYield, reportedYield, stitchYield,
                                               calculatedYield, spaceCost))
                .concat(standingChainNotes(instructionString))
                .concat(turningChainNote(instructionString))
                .concat(chainSpaceNotes(instructionString, calculatedYield, expectedYield))
                .concat(notation.map(fault =>
                    `Malformed notation: ${fault.message}. The row was read as best it could be - check it before trusting the count.`)),
            resolutions,
            // The same findings as an applicable edit rather than a sentence. Built from the context
            // above, so the linter and the matrix can never disagree about what is wrong with a row.
            fixes: buildFixes(diagnosisContext, resolutions),
            likelyCauses
        };
    }

    // === 7. GAUGE & YARDAGE CALCULATOR === //
    function calculateYardage(totalStitches, swatch, skein) {
        if (!totalStitches || !swatch || !swatch.width || !swatch.height || !swatch.stitches || !swatch.rows) {
            return { error: 'Invalid gauge or stitch inputs.' };
        }

        const totalLengthInches = (totalStitches / swatch.stitches) * swatch.width * 12;
        const totalYards = totalLengthInches / 36;
        const totalMeters = totalYards * 0.9144;

        const skeinLengthYards = skein.lengthUnit === 'm' ? skein.length * 1.09361 : skein.length;
        const recommendedSkeins = skeinLengthYards > 0 ? Math.ceil(totalYards / skeinLengthYards) : 1;
        const exactSkeins = skeinLengthYards > 0 ? (totalYards / skeinLengthYards).toFixed(2) : 1;

        // Metric to Imperial weight conversions
        const weightGrams = skein.weightUnit === 'oz' ? skein.weight * 28.3495 : skein.weight;
        const weightOunces = skein.weightUnit === 'g' ? skein.weight * 0.035274 : skein.weight;

        // Weighing a swatch measures yarn actually consumed, so it beats deriving length from stitch
        // counts. Optional: null unless a swatch weight is given.
        const swatchWeightGrams = swatch.weightUnit === 'oz' ? swatch.weight * 28.3495 : swatch.weight;
        const swatchStitchCount = swatch.stitches * swatch.rows;
        let byWeight = null;

        if (swatchWeightGrams > 0 && swatchStitchCount > 0) {
            const gramsPerStitch = swatchWeightGrams / swatchStitchCount;
            const projectGrams = gramsPerStitch * totalStitches;
            const skeinsByWeight = weightGrams > 0 ? projectGrams / weightGrams : 0;

            byWeight = {
                gramsPerStitch: gramsPerStitch.toFixed(4),
                totalWeightGrams: Math.ceil(projectGrams),
                totalWeightOunces: (projectGrams * 0.035274).toFixed(2),
                totalLengthYards: Math.ceil(skeinsByWeight * skeinLengthYards),
                totalLengthMeters: Math.ceil(skeinsByWeight * skeinLengthYards * 0.9144),
                skeins: {
                    recommendedPurchase: Math.ceil(skeinsByWeight),
                    exact: skeinsByWeight.toFixed(2)
                }
            };
        }

        return {
            byWeight,
            imperial: {
                totalLengthYards: Math.ceil(totalYards),
                totalWeightOunces: (weightOunces * exactSkeins).toFixed(2)
            },
            metric: {
                totalLengthMeters: Math.ceil(totalMeters),
                totalWeightGrams: Math.ceil(weightGrams * exactSkeins)
            },
            skeins: {
                recommendedPurchase: recommendedSkeins,
                exact: exactSkeins
            }
        };
    }

    // === 8. PATTERN SETTINGS INFERENCE === //
    /*
     * Settings the app used to ask for in a form box and can read off the pattern instead.
     *
     * Every one of these was a control the reader had to set correctly before the numbers meant
     * anything, and every one of them restates something the pattern text already says. Three of the
     * four detections below already existed, scattered through app.js next to the DOM writes they fed;
     * gathering them here makes them testable without a page, keeps validator.js free of the DOM as
     * ROADMAP guardrail 2 requires, and gives the app one call to make instead of four.
     *
     * Nothing here is allowed to be silent. Each detection returns the value AND the text it read it
     * from, and `confident: false` marks the cases where no signal was found and a prevalence default
     * was used instead. The app renders those as a note - a setting that changes the reader's numbers
     * without telling them is worse than the box it replaced.
     */

    /**
     * Counted a line at a time, never across the whole pattern at once. isSizeGroup decides by asking
     * whether anything follows on the LINE, so over a whole document the text after a match is always
     * non-empty and every trailing stitch count on every row but the last reads as a size group.
     *
     * Moved here from app.js unchanged. SIZE_GROUP_REGEX and isSizeGroup stay there with
     * resolveSizeVariants, which mutates a step object and is not the engine's business.
     */
    /*
     * The base number is captured whole, not just its last digit: replacing "52 (56, 60)" with "56"
     * must not leave the "5" of 52 behind as "556".
     *
     * The unit is allowed INSIDE the closing bracket as well as outside. Both spellings are in use -
     * "20 (24, 28, 32) sts" and "20 (24, 28, 32 sts)" - and only the first was recognised. The second
     * fell through to the written-count reader, which is built to SUM a bracketed list ("[60 hdc, 4
     * ch-1 sps]" is a round of 64) and duly reported a four-size row as a count of 174.
     *
     * A fresh RegExp each call, never one shared object: /g carries lastIndex between uses, and both
     * callers iterate. Counting the sizes and substituting one both have to find the SAME groups - a
     * count of 3 against a substitution that matched something else is worse than either bug alone -
     * so app.js's resolveSizeVariants builds its regex from here rather than keeping a second copy.
     */
    const sizeGroupRegex = () => /(\d+)\s*\(\s*(\d+(?:\s*,\s*\d+)*)\s*([a-z][a-z-]*)?\s*\)/gi;

    /**
     * A digit followed by a parenthesised number is not automatically a size. The row "[sc, inc] x 3
     * (18)" ends in a multiplier and then an ordinary stitch count, and eating that as a size loses
     * the count entirely.
     *
     * A *list* is always sizes - no stitch count is ever written "(18, 20)". A single value is a size
     * only mid-line, as in "until there are 23 (27) sts on needle"; at the end of a row it is the
     * count. Judged against the LINE, which is why counting is done a line at a time: over a whole
     * document the text after a match is always non-empty and every trailing count would read as a
     * size.
     */
    function isSizeGroup(list, matchEnd, wholeLine) {
        if (list.includes(',')) return true;
        return /\S/.test(wholeLine.slice(matchEnd));
    }

    function countSizeVariants(text) {
        const sizeGroup = sizeGroupRegex();
        let widest = 0;
        let sample = '';
        String(text).split('\n').forEach(line => {
            for (const match of line.matchAll(sizeGroup)) {
                if (!isSizeGroup(match[2], match.index + match[0].length, line)) continue;
                const width = match[2].split(',').length + 1;
                if (width > widest) { widest = width; sample = match[0]; }
            }
        });
        return { count: Math.max(1, widest), sample };
    }

    /**
     * What the pattern says it is worked in. A document whose rows are labelled "Round" is worked in
     * rounds, and whether they are joined or spiralled is settled by whether the rounds close with a
     * slip stitch.
     *
     * The app's version of this could only ever answer "Rounds": a flat pattern left the dropdown on
     * its blank option forever, which is exactly why the dropdown still looked necessary. Saying
     * "Rows (Flat)" out loud is what makes the control redundant.
     *
     * Note that no consumer distinguishes Joined from Spiral - worksInRounds tests only for the word
     * "Rounds" - so the joined/spiral split is labelling, and only the rounds-vs-rows call has to be
     * right for this to match what the dropdown achieved.
     */
    function inferConstruction(text) {
        const rounds = (text.match(/^\s*(?:Round|Rnd)s?\s*\.?\s*\d/gim) || []).length;
        const rows = (text.match(/^\s*Rows?\s*\.?\s*\d/gim) || []).length;
        const plural = (n, word) => `${n} "${word}" label${n === 1 ? '' : 's'}`;
        if (rounds < 2 || rounds <= rows) {
            return rows > 0
                ? { value: 'Rows (Flat)', basis: `${plural(rows, 'Row')} and no "Round" labels`, confident: true }
                : { value: 'Rows (Flat)', basis: '', confident: false };
        }

        const joins = /\b(?:sl\s*st|slst|slip\s+stitch)\s+(?:to|in|into)\b[^.;]*\bjoin\b|\bjoin\s+with\s+(?:a\s+)?(?:sl\s*st|slst)/i.test(text);
        const spirals = /\b(?:do\s+not|don't|dont)\s+join\b|\bcontinue\s+(?:working\s+)?in\s+a\s+spiral\b/i.test(text);
        return joins && !spirals
            ? { value: 'Rounds (Joined)', basis: `${plural(rounds, 'Round')} closing with a join`, confident: true }
            : { value: 'Rounds (Spiral)', basis: `${plural(rounds, 'Round')} with no join`, confident: true };
    }

    /**
     * How many foundation chains a row skips when it never says which chain to start in.
     *
     * A row that states its own ordinal - "sc in 2nd ch from hook" - on the SAME line as its chain has
     * already answered and never reaches this branch; parseFoundationRow reads the number straight off
     * the row. What is left on that line is the shape "ch 16, sc in each ch across", which states a
     * chain and a row worked back along it and leaves the turning chain implied. A stated ordinal
     * split onto the ROW BELOW its chain is a different matter - see the two-line shape further down,
     * which still has to read it, because nothing else ever will.
     *
     * The convention is fixed and the table for it already exists: a stitch stands on a chain as tall
     * as itself, and that chain is the one skipped. sc goes into the 2nd chain from the hook (skip 1),
     * hdc the 3rd (skip 2), dc the 4th (skip 3) - i.e. the skip IS the height, not the height less
     * one. Every stated foundation row across the corpora confirms the pairing.
     *
     * Where the row names no stitch this table knows, 0 is returned and marked unconfident rather
     * than guessed at: under-skipping leaves the count one high, which shows up as a visible
     * mismatch, while over-skipping silently invents agreement.
     *
     * The chain also takes a second shape, on its own line with nothing else said - "Ch 7" - and the
     * row worked back along it is the one after, not the same line. Only trusted as the very first
     * line of content in the document: a bare "Ch 2" LATER in the pattern is a turning chain into
     * stitches that already exist, not a foundation, and would invent a skip on fabric that is already
     * there. Left alone when the next row claims "each ch across" - that wording already means every
     * chain gets worked, which is a real, different convention from a bare count falling short.
     */
    function inferUnstatedSkip(text) {
        const lines = String(text).split('\n');
        let seenWork = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            // Two strips, and both are needed. This reads the RAW document, where a row still carries
            // its "Row 1:" label - by the time parseFoundationRow sees an instruction the label is long
            // gone, stripped upstream in buildPatternSteps. stripRowPreamble alone does not remove it:
            // its leading-word pattern is `[a-z' ]`, which cannot cross the digit in "Row 1".
            const line = stripRowPreamble(stripRowLabel(raw));
            // Mirror parseFoundationRow's branch selection exactly: a stated ordinal wins, and only
            // a line that opens with its own chain and works back into it lands on the unstated path.
            if (/\b\d+\s*(?:st|nd|rd|th)\s+(?:ch|chain|st|stitch)\s+from\s+(?:the\s+)?hook\b/i.test(line)) continue;
            if (/^(?:ch|chain)\s*\d+\s*[,.]?\s+/i.test(line) && WORKS_INTO_CHAIN.test(line)
                && /\b(?:in\s+)?each\b/i.test(line) && /\b(?:across|around|remaining)\b/i.test(line)) {
                const { tallest, height } = tallestStitch(line);
                if (!height) return { value: 0, basis: '', confident: false };
                return {
                    value: height,
                    basis: `a foundation row of ${tallest}, which stands on a ch ${height}`,
                    confident: true
                };
            }
            if (!line) continue;
            // The other shape a foundation chain takes: alone on its own line, nothing else said about
            // it - "Ch 7" - with the very next row worked straight back into it. Only trusted as the
            // FIRST line with content in the whole document (`seenWork` stays false until here), because
            // a bare "ch 2" turning a LATER row is a turning chain into stitches already made, not a
            // foundation, and reading it the same way would invent a skip on fabric that already exists.
            if (!seenWork && /^(?:ch|chain)\s*\d+$/i.test(line) && lines[i + 1] !== undefined) {
                const nextLine = stripRowPreamble(stripRowLabel(lines[i + 1]));
                // The row below can answer this outright - "sc in 2nd ch from hook" - and when it does,
                // that stated number is the one to trust, not a stitch-height guess. This only exists
                // because the chain and the row are separate STEPS here: on the single-line shape above,
                // both reach evaluateStep together and parseFoundationRow reads the ordinal off the row
                // itself, with no need for this function to hand back a number at all. Split across two
                // lines, nothing else ever reads what the row said - without this, a pattern that spelled
                // its starting chain out explicitly still fell back to an uninferred, wrong skip of 0.
                const stated = nextLine.match(
                    /\b(\d+)\s*(?:st|nd|rd|th)\s+(?:ch|chain|st|stitch)\s+from\s+(?:the\s+)?hook\b/i);
                if (stated) {
                    const value = parseInt(stated[1], 10) - 1;
                    if (value > 0) {
                        return {
                            value, confident: true,
                            basis: `the next row stating its own start, "${stated[0]}"`
                        };
                    }
                    // "1st ch from hook" - nothing skipped - is nonstandard but not this function's call.
                    return { value: 0, basis: '', confident: false };
                }
                // "In each ch across" already means every chain gets worked - that is a real, different
                // convention from a bare count, and left alone rather than reread as a skip.
                if (!/\b(?:in\s+)?each\s+(?:ch|chain)s?\b/i.test(nextLine)) {
                    const { tallest, height } = tallestStitch(nextLine);
                    // `twoLine` is true here, and only here: this is the one sub-shape genuinely left for
                    // a reader to resolve, whether or not a height could be read off the row below. The
                    // stated-ordinal case above never sets it - it already answered its own question.
                    if (height) {
                        return {
                            value: height,
                            basis: `a foundation row of ${tallest}, which stands on a ch ${height}`,
                            confident: true, twoLine: true, stitch: tallest
                        };
                    }
                    return { value: 0, basis: '', confident: false, twoLine: true, stitch: null };
                }
            }
            seenWork = true;
        }
        return { value: 0, basis: '', confident: false };
    }

    /**
     * One pass over the raw text for everything the app would otherwise have asked the reader for.
     *
     * @param {string} rawText the whole pattern as typed or pasted
     * @returns {{sizeCount: number, construction: string, unstatedSkip: number,
     *   unstatedSkipTwoLine: boolean, unstatedSkipStitch: string|null, notices: Array}}
     *   `notices` carries one entry per inferred setting: `{ setting, label, value, basis,
     *   confident }`. `confident: false` means no signal was found and a prevalence default stood in.
     *   `unstatedSkipTwoLine` is true when the skip (or the refusal to guess one) came from a bare
     *   foundation chain answered only by the row below it - the shape the app warns about on Row 1,
     *   since combining the two lines or stating the skip on the second would settle the question in
     *   the pattern text itself rather than leaving the app to assume it. `unstatedSkipStitch` is the
     *   stitch that guess was read off (null when the row named none the table knows) - the linter
     *   needs the name itself, not just the chain count it stands on, to word a stated-ordinal fix.
     */
    function inferPatternSettings(rawText) {
        const text = String(rawText || '');
        const sizes = countSizeVariants(text);
        const construction = inferConstruction(text);
        const skip = inferUnstatedSkip(text);

        const notices = [];
        // A one-size pattern is the unremarkable case and saying so on every pattern would bury the
        // lines that matter. Graded is the one worth announcing, because it also decides which
        // numbers the whole matrix is validated against.
        if (sizes.count > 1) {
            notices.push({
                setting: 'sizeCount', label: 'Sizing', value: `${sizes.count} sizes`,
                basis: sizes.sample ? `the graded list "${sizes.sample}"` : '', confident: true
            });
        }
        notices.push({
            setting: 'construction', label: 'Construction', value: construction.value,
            basis: construction.basis, confident: construction.confident
        });
        // Only worth a line when it actually moves a number. A skip of 0 changes nothing, and the
        // unconfident 0 is the no-foundation-row case, which is most patterns.
        if (skip.value > 0) {
            notices.push({
                setting: 'unstatedSkip', label: 'Starting chains skipped', value: String(skip.value),
                basis: skip.basis, confident: skip.confident
            });
        }

        return {
            sizeCount: sizes.count,
            construction: construction.value,
            unstatedSkip: skip.value,
            unstatedSkipTwoLine: skip.twoLine === true,
            unstatedSkipStitch: skip.stitch || null,
            notices
        };
    }

    // A stitch is worked into the chain ONE PAST the number it skips - a ch 1 (sc) into the 2nd chain
    // from the hook, up to a ch 6 (trtr) into the 7th - so this is always height + 1, spelled the way
    // a pattern actually writes it. STANDING_CHAIN_HEIGHTS only runs 1-6, so a lookup covers it.
    const SKIP_ORDINALS = { 1: '2nd', 2: '3rd', 3: '4th', 4: '5th', 5: '6th', 6: '7th' };

    /**
     * The Row-1 disclosure (see inferUnstatedSkip) as something the linter can offer a button for, not
     * only a sentence in the matrix. Always returns a fix - the caller only calls this once the
     * two-line shape is already known to be in play - because "the pattern doesn't say" is worth
     * surfacing even when no stitch was recognised and there is nothing to auto-write.
     *
     * `edit` stays null unless the guess actually resolved a stitch AND the next row's own text is the
     * narrow, unambiguous shape this can rewrite safely: a bare leading count of that exact stitch
     * ("6 sc"), nothing else. Anything looser - a bracket, a second stitch, a count already stated in
     * words - is left to the reader rather than guessed at, same reasoning buildFixes already uses for
     * every other advisory-only finding.
     */
    function buildUnstatedSkipFix(stitch, height, nextInstructionText) {
        const detail = stitch
            ? `The chain above is only worked back into by assumption - nothing on either line states `
                + `that ${stitch} starts in the ${SKIP_ORDINALS[height]} chain from the hook.`
            : `The chain above is only worked back into by assumption - nothing on either line states `
                + `which chain the next row starts in.`;
        const lesson = 'Naming the starting chain explicitly keeps a pattern unambiguous for '
            + 'translations, screen readers, and anyone reading this row without the one above it.';

        let edit = null;
        if (stitch) {
            const match = String(nextInstructionText || '').match(new RegExp(`^\\s*(\\d+)\\s+${stitch}\\b`, 'i'));
            const count = match ? parseInt(match[1], 10) : 0;
            if (count > 0) edit = { target: 'foundationOrdinal', stitch, ordinal: SKIP_ORDINALS[height], count };
        }

        return {
            id: 'unstated-skip-ordinal', severity: 'style',
            title: "This row doesn't say which starting chain it works into",
            detail, lesson, edit
        };
    }

    /**
     * Repeat shorthand: a bracketed group and how many times it runs - "[2 sc, inc] x 6",
     * "(sc, inc) x 6", "[dc, ch 1] 12 times".
     *
     * The count is required AND has to carry a marker: a bare "(24)" at the end of a row is a stated
     * stitch count and "(8, 10)" is a size list, and reading either as a repeat would rewrite a number
     * the pattern meant as an answer. The body excludes brackets by character class, so a group holding
     * another group simply does not match - left alone whole rather than read half-way and rebuilt
     * wrong. Global, because standardizeRepeatText walks every group on a line.
     *
     * "*" is a multiplier here as well as "x": amigurumi is written "(2 sc, inc) * 6" at least as often
     * as "[2 sc, inc] x 6", and expandBracketRepeats has always counted it - only this rule could not
     * see it, so a pattern in that notation silently got no beginner-phrasing offer. It cannot collide
     * with the OTHER meaning of "*" (the "*...; rep from * around" repeat marker), because that form
     * has no closing bracket before its digits and so never reaches this alternation.
     */
    const REPEAT_SHORTHAND_RE = /[\(\[]([^()\[\]]+)[\)\]]\s*(?:(?:x|\*|rep(?:eat)?)\s*(\d+)|(\d+)\s*times)/gi;

    /** Which plain stitch an increase makes two of, where the abbreviation says so itself. Bare "inc"
     *  is deliberately absent: it names no stitch, so the row it sits in has to supply one. */
    const INCREASE_BASE = {
        'sc inc': 'sc', 'sc-inc': 'sc', 'hdc inc': 'hdc', 'hdc-inc': 'hdc',
        'dc inc': 'dc', 'dc-inc': 'dc', 'tr inc': 'tr', 'tr-inc': 'tr',
        'dtr inc': 'dtr', 'dtr-inc': 'dtr'
    };

    /** "st" or "sts", for the position counts the phrasing spells out. */
    const stsOf = n => (n === 1 ? 'st' : 'sts');

    /**
     * One clause of a repeat body - "2 sc", "inc", "sc2tog", "ch 1" - written out with the positions
     * it works into named. Returns null for anything it cannot phrase with certainty, and the caller
     * abandons the whole rewrite rather than emitting a half-standardized line.
     *
     * The shape is read off cost and yield rather than a per-stitch template table, because that is
     * what the arithmetic already knows and a second table would be a second place for the two to
     * disagree: one-in-one-out is a plain run, one-in-two-out is an increase, two-or-more-in-one-out
     * is a decrease worked over that many positions.
     *
     * @param base the plain stitch the row works in, for a bare "inc" that names none of its own
     */
    function phraseRepeatClause(count, key, base) {
        const data = getFullDictionary()[key];
        if (!data) return null;

        // Chains make fabric without consuming any, so there are no positions to name - "ch 1" is
        // already as explicit as it gets, and the count is chains rather than stitches.
        if (data.cost === 0 && data.yield === 1) return `${key} ${count}`;
        // A skip consumes positions and yields nothing. The two counts are worded differently on
        // purpose: "sk next st" is the natural singular, but its plural "sk next 2 sts" reads back
        // through the tokenizer as ONE skip - only a count sitting directly against the abbreviation
        // is multiplied - so more than one is written "sk 2 sts", which parses as the two it says.
        // Both are ordinary pattern phrasings; the self-check in buildRepeatPhrasing pins the choice.
        //
        // Named rather than inferred from `yield === 0`, which is not the same set: picot makes no
        // countable stitch AND takes no position, and 0in1 is a folded corner group. Reading either
        // as a skip rewrote a decoration into an instruction to miss a stitch - caught by the
        // self-check, but only after it had already been written.
        if (key === 'sk' || key === 'skip') return count > 1 ? `sk ${count} sts` : 'sk next st';
        // Anything else that makes no stitch has no long form worth writing, so it is left alone.
        if (data.yield === 0) return null;

        if (data.cost === 1 && data.yield === 1) {
            return count > 1 ? `${key} in next ${count} sts` : `${key} in next st`;
        }
        if (data.cost === 1 && data.yield === 2) {
            const made = INCREASE_BASE[key] || base;
            // Nothing in the abbreviation and nothing in the row says WHICH stitch is doubled. Spelling
            // it out would mean inventing one, so the rewrite is abandoned instead.
            if (!made) return null;
            return count > 1
                ? `2 ${made} in each of next ${count} sts`
                : `2 ${made} in next st`;
        }
        if (data.cost >= 2 && data.yield === 1) {
            // Only the single decrease. "2 sc2tog" is two separate decreases over four positions, and
            // "sc2tog over next 4 sts" would read as one decrease taking four together - a different
            // stitch. Left to the writer rather than written wrong.
            if (count > 1) return null;
            return `${key} over next ${data.cost} sts`;
        }
        return null;
    }

    /**
     * A repeat written in shorthand, spelled out in the long form the Craft Yarn Council style uses:
     * "[2 sc, inc] x 6" becomes "*sc in next 2 sts, 2 sc in next st; rep from * 5 more times".
     *
     * All-or-nothing by design. A clause carrying anything past a count and a stitch - "3 dc in same
     * st", "sc in next ch-2 sp" - already says where it goes, and rewriting around it risks moving a
     * position the pattern was specific about, so one unreadable clause abandons the whole line.
     *
     * @returns {string|null} the long form, or null where it cannot be written with certainty
     */
    function buildRepeatPhrasing(body, times) {
        if (!(times >= 2)) return null;
        const dict = getFullDictionary();
        // Split on commas only: the body cannot hold a nested group (REPEAT_SHORTHAND_RE's character
        // class excludes brackets), so unlike parseInstructions' segment loop there is no folded
        // "(3 dc, ch 2, 3 dc) in corner" whose internal commas have to survive the split.
        const clauses = String(body).split(',').map(c => c.trim()).filter(Boolean);
        if (!clauses.length) return null;

        // Read as "<count> <stitch>" and nothing else. Anything with a target on it is left alone.
        const parsed = clauses.map(clause => {
            // Chains and skips carry their count AFTER the abbreviation - "ch 1", "sk 2" - where every
            // worked stitch carries it before. Without this the commonest mesh repeat in print,
            // "[dc, ch 1] x 12", fails to read and the whole rewrite is abandoned.
            const trailing = clause.match(/^(ch|chain|sk|skip)\s+(\d+)$/i);
            if (trailing) return { count: parseInt(trailing[2], 10), key: trailing[1].toLowerCase() };

            const m = clause.match(/^(?:(\d+)\s+)?([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)$/i);
            if (!m) return null;
            const key = m[2].toLowerCase();
            return dict[key] ? { count: parseInt(m[1] || '1', 10), key } : null;
        });
        if (parsed.some(p => !p)) return null;

        // The stitch a bare "inc" doubles, taken from the row it sits in: in "[2 sc, inc] x 6" the
        // only plain stitch present is sc, so the increase makes two of those. Read from the whole
        // body before phrasing any clause, so position within the bracket does not change the answer.
        const base = (parsed.find(p => dict[p.key].cost === 1 && dict[p.key].yield === 1) || {}).key || null;

        const phrased = parsed.map(p => phraseRepeatClause(p.count, p.key, base));
        if (phrased.some(c => !c)) return null;

        const longForm = `*${phrased.join(', ')}; rep from * ${times - 1} more times`;

        // The rewrite has to be a change of WORDING and nothing else, so it is checked rather than
        // trusted: read both forms back through the tokenizer and refuse the suggestion unless the
        // stitches consumed and produced come out identical. A phrasing template that drifts from what
        // the parser actually understands is otherwise invisible here and silently rewrites a correct
        // row into a wrong one - "sk next 2 sts" reads as ONE skip, where the "sk 2" it replaced reads
        // as two, which is exactly this failure. Cheap next to being wrong: two parses, once per
        // suggestion, and only for a row already known to hold a repeat.
        const before = parseInstructions(`[${body}] x ${times}`, 0);
        const after = parseInstructions(longForm, 0);
        if (before.totalCost !== after.totalCost || before.totalYield !== after.totalYield) return null;

        return longForm;
    }

    /**
     * Every repeat shorthand on one line, rewritten long-form. Returns null when nothing on the line
     * could be rewritten, so a caller can tell "already standard" from "changed" without diffing.
     */
    function standardizeRepeatText(text) {
        let changed = false;
        const out = String(text || '').replace(REPEAT_SHORTHAND_RE, (whole, body, timesX, timesWord) => {
            const phrased = buildRepeatPhrasing(body, parseInt(timesX || timesWord, 10));
            if (!phrased) return whole;
            changed = true;
            return phrased;
        });
        return changed ? out : null;
    }

    /**
     * The pattern-level style recommendation: this pattern writes its repeats in bracket shorthand,
     * and here is the same row in long form.
     *
     * Raised once for the whole document rather than once per row - the app stops after the first row
     * that produces one. Bracket shorthand is correct, extremely common, and used consistently by the
     * patterns that use it at all, so a card on every row would be a preference pushed forty times
     * over rather than a convention pointed out once. "Standardize All" is what handles the rest.
     */
    function buildRepeatPhrasingFix(instructionText) {
        const text = String(instructionText || '');
        REPEAT_SHORTHAND_RE.lastIndex = 0;
        const match = REPEAT_SHORTHAND_RE.exec(text);
        REPEAT_SHORTHAND_RE.lastIndex = 0;
        if (!match) return null;

        const phrased = buildRepeatPhrasing(match[1], parseInt(match[2] || match[3], 10));
        if (!phrased) return null;

        return {
            id: 'repeat-shorthand', severity: 'style',
            title: 'This pattern writes its repeats in bracket shorthand',
            detail: `"${match[0]}" is correct and widely understood, but the long form names every `
                + `position outright, so nothing has to be inferred from the brackets.`,
            lesson: 'This is a matter of formatting, not correctness - spelling repeats out in full is '
                + 'simply more beginner-friendly than bracket shorthand, since a newer crocheter can '
                + 'follow along without decoding what the brackets and multiplier mean.',
            edit: { target: 'repeatPhrasing', from: match[0], to: phrased }
        };
    }

    /**
     * Which way a shaping round distributes its increases: the difference between a circle and a
     * hexagon.
     *
     *   'uniform'  (2 sc, inc) * 6                    - the whole round is one repeat
     *   'offset'   1 sc, inc, (2 sc, inc) * 5, 1 sc   - a run of stitches sits outside the repeat
     *   null       everything else - not a shaping round, or not one this can read
     *
     * WHY THIS MATTERS. Stacked increases land in the same position every round, so six increase
     * columns run radially and the fabric creases along them - a flat circle comes out a hexagon.
     * Staggering rotates the column by splitting one base run across the round boundary, which
     * distributes the tension and produces a smooth curve. The two are arithmetically IDENTICAL -
     * same six increases, same 6k plain stitches, same cost and yield - so nothing in the validation
     * can tell them apart, and nothing should: both are correct. Only the finished object differs.
     *
     * WHY THE TEST IS COST, NOT TEXT. The tempting rule is "is there text outside the brackets", and
     * it is wrong: a joined round is written "ch 2 (does not count as a stitch), [dc, dc-inc] x 12,
     * sl st to first dc", where both of those fragments are outside the group and neither is a run of
     * stitches. They cost NOTHING - a starting chain consumes no stitch and a joining slip stitch is
     * stripped - where a real staggered prefix ("1 sc, inc") costs 2. So the question asked here is
     * how much the outside CONSUMES from the round below, which is exactly the distinction wanted and
     * needs no list of scaffolding phrases to maintain.
     *
     * Shaping is likewise read off the arithmetic rather than by looking for "inc" and "dec" by name:
     * a group that yields more or fewer stitches than it consumes is shaping the fabric, whatever it
     * calls itself. That also correctly passes over a mesh repeat like "(sc, ch 1, sk 1) x 12", which
     * costs and yields two and is a stitch pattern rather than a shaping round.
     */
    function increaseStyle(instructionText) {
        const text = String(instructionText || '');
        if (!text) return null;

        REPEAT_SHORTHAND_RE.lastIndex = 0;
        const match = REPEAT_SHORTHAND_RE.exec(text);
        REPEAT_SHORTHAND_RE.lastIndex = 0;
        if (!match) return null;

        const body = parseInstructions(match[1], 0);
        if (body.totalCost === body.totalYield) return null;

        const before = parseInstructions(text.slice(0, match.index), 0);
        const after = parseInstructions(text.slice(match.index + match[0].length), 0);
        return (before.totalCost + after.totalCost) > 0 ? 'offset' : 'uniform';
    }

    /**
     * A piece that changes shaping strategy partway up, which leaves a seam on an otherwise smooth
     * shape - or one flat facet on an otherwise faceted one.
     *
     * THE TRAP THIS EXISTS TO AVOID. A correctly staggered pattern ALTERNATES between the two forms:
     *
     *     Rnd 3: (1 sc, inc) * 6                    uniform
     *     Rnd 4: 1 sc, inc, (2 sc, inc) * 5, 1 sc   offset
     *     Rnd 5: (3 sc, inc) * 6                    uniform
     *     Rnd 6: 2 sc, inc, (4 sc, inc) * 5, 2 sc   offset
     *
     * so a rule that fired whenever the style changed would fire on every round of a correct pattern -
     * the single worst thing this check could do. What separates correct alternation from a real
     * switch is the RHYTHM: staggering rotates the column one round at a time, so every offset round
     * is separated by exactly one uniform round and two uniform shaping rounds never run together.
     *
     * So the finding is raised on the first offset round that follows two or more consecutive uniform
     * ones - the round where the piece demonstrably stopped alternating, which is also the round a
     * reader would look at. A pattern that is uniform throughout has no offset round and says nothing;
     * a correctly staggered one never accumulates a uniform pair.
     *
     * @param styles the styles of a section's shaping rounds, in order, nulls already dropped.
     * @returns { at, ...fix } where `at` indexes into `styles`, or null.
     */
    function buildIncreaseStyleFix(styles) {
        const list = Array.isArray(styles) ? styles : [];
        let uniformRun = 0;
        for (let i = 0; i < list.length; i++) {
            if (list[i] === 'uniform') { uniformRun++; continue; }
            if (list[i] !== 'offset') continue;
            if (uniformRun < 2) { uniformRun = 0; continue; }

            return {
                at: i,
                id: 'increase-style-mixed', severity: 'style',
                title: 'This round staggers its increases, but the shaping above it stacks them',
                detail: `The ${uniformRun} rounds before this one work their increases as a single `
                    + `repeat, which lines them up in columns; this one splits a run across the start `
                    + `and end of the round, which rotates them. Both are correct on their own — mixed `
                    + `in one piece they leave a seam where the strategy changes.`,
                lesson: 'Stacked increases pile up in six columns and read as the corners of a '
                    + 'hexagon; staggered ones rotate each round and come out smooth. A staggered '
                    + 'pattern alternates — one uniform round, one offset round — so two uniform '
                    + 'shaping rounds in a row is the sign a piece has switched strategy partway up.',
                edit: null
            };
        }
        return null;
    }

    /** The abbreviation to write for an increase that doubles a stitch other than the row's own base -
     *  the reverse of INCREASE_BASE. Resolved to the hyphenated spelling since that is as valid as the
     *  spaced one and dictionary keys have to pick one; deliberately excludes bare "inc" itself, which
     *  is resolved separately once the row's base stitch is known. */
    const REVERSE_INCREASE_BASE = { sc: 'sc-inc', hdc: 'hdc-inc', dc: 'dc-inc', tr: 'tr-inc', dtr: 'dtr-inc' };

    /**
     * The shapes phraseRepeatClause can write, read back from text into structured data rather than
     * straight into a shorthand token. An increase clause cannot be rendered until every clause in the
     * body has been read once - "made" only resolves to bare "inc" once the row's own plain stitch is
     * known, and that stitch can sit anywhere else in the list - so parsing and rendering are kept as
     * two separate passes, mirroring buildRepeatPhrasing's own two-pass order for `base`.
     */
    function parseCondensedClauseShape(clause, dict) {
        const text = String(clause).trim();

        // Chains and the foundation stitches (fsc, fhdc...) share this shape in the LONG form - anything
        // cost0/yield1 is written "<key> <count>" by phraseRepeatClause - but only ch/chain are valid
        // shorthand written that way round; every other cost0/yield1 key only parses as shorthand with
        // the count FIRST ("2 fdc"), same as an ordinary stitch. `trailing` remembers which it was, so
        // rendering can put the count back where buildRepeatPhrasing's own clause parser expects it.
        const zeroM = text.match(/^([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)\s+(\d+)$/i);
        if (zeroM) {
            const key = zeroM[1].toLowerCase();
            const data = dict[key];
            if (data && data.cost === 0 && data.yield === 1) {
                return {
                    kind: 'chain', key, count: parseInt(zeroM[2], 10),
                    trailing: key === 'ch' || key === 'chain'
                };
            }
        }

        if (/^sk next st$/i.test(text)) return { kind: 'skip', count: 1 };
        const skipM = text.match(/^sk\s+(\d+)\s+sts$/i);
        if (skipM) return { kind: 'skip', count: parseInt(skipM[1], 10) };

        const incPluralM = text.match(/^2\s+([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)\s+in each of next\s+(\d+)\s+sts$/i);
        if (incPluralM) return { kind: 'increase', made: incPluralM[1].toLowerCase(), count: parseInt(incPluralM[2], 10) };
        const incSingularM = text.match(/^2\s+([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)\s+in next st$/i);
        if (incSingularM) return { kind: 'increase', made: incSingularM[1].toLowerCase(), count: 1 };

        const decM = text.match(/^([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)\s+over next\s+(\d+)\s+sts$/i);
        if (decM) {
            const key = decM[1].toLowerCase();
            const data = dict[key];
            if (!data || data.cost < 2 || data.yield !== 1) return null;
            return { kind: 'decrease', key };
        }

        const runPluralM = text.match(/^([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)\s+in next\s+(\d+)\s+sts$/i);
        if (runPluralM) {
            const key = runPluralM[1].toLowerCase();
            const data = dict[key];
            if (!data || data.cost !== 1 || data.yield !== 1) return null;
            return { kind: 'run', key, count: parseInt(runPluralM[2], 10) };
        }
        const runSingularM = text.match(/^([a-z][a-z0-9]*(?:[ -][a-z0-9]+)*)\s+in next st$/i);
        if (runSingularM) {
            const key = runSingularM[1].toLowerCase();
            const data = dict[key];
            if (!data || data.cost !== 1 || data.yield !== 1) return null;
            return { kind: 'run', key, count: 1 };
        }

        return null;
    }

    /** parseCondensedClauseShape's counterpart: a structured shape written back to a shorthand token,
     *  once `base` - the row's own plain stitch, read off every OTHER clause first - is known. */
    function renderCondensedClause(shape, base) {
        switch (shape.kind) {
            case 'chain': return shape.trailing ? `${shape.key} ${shape.count}` : `${shape.count} ${shape.key}`;
            case 'skip': return `sk ${shape.count}`;
            case 'decrease': return shape.key;
            case 'run': return shape.count > 1 ? `${shape.count} ${shape.key}` : shape.key;
            case 'increase': {
                // A bare "inc" only means "double the row's plain stitch" - anything else has to name
                // what it doubles, same as phraseRepeatClause reads it going the other way.
                const key = shape.made === base ? 'inc' : REVERSE_INCREASE_BASE[shape.made];
                return key ? (shape.count > 1 ? `${shape.count} ${key}` : key) : null;
            }
            default: return null;
        }
    }

    /**
     * The reverse of buildRepeatPhrasing: a repeat spelled out in long form, folded back into bracket
     * shorthand - "*sc in next 2 sts, 2 sc in next st; rep from * 5 more times" becomes
     * "[2 sc, inc] x 6".
     *
     * Checked against the parser exactly as the forward rewrite is. The guarantee this makes is "same
     * wording family, same stitches" rather than "one specific text", so trusting a hand-built inverse
     * template here would be exactly the failure buildRepeatPhrasing's own self-check exists to catch.
     *
     * @returns {string|null} the shorthand form, or null where it cannot be folded back with certainty
     */
    function buildRepeatShorthand(body, times) {
        if (!(times >= 2)) return null;
        const dict = getFullDictionary();
        const clauses = String(body).split(',').map(c => c.trim()).filter(Boolean);
        if (!clauses.length) return null;

        const shapes = clauses.map(c => parseCondensedClauseShape(c, dict));
        if (shapes.some(s => !s)) return null;

        const base = (shapes.find(s => s.kind === 'run') || {}).key || null;

        const rendered = shapes.map(s => renderCondensedClause(s, base));
        if (rendered.some(c => !c)) return null;

        const shorthand = `[${rendered.join(', ')}] x ${times}`;

        const before = parseInstructions(`*${body}; rep from * ${times - 1} more times`, 0);
        const after = parseInstructions(shorthand, 0);
        if (before.totalCost !== after.totalCost || before.totalYield !== after.totalYield) return null;

        return shorthand;
    }

    // Matches only the exact shape buildRepeatPhrasing writes - "*<body>; rep from * <n> more times" -
    // rather than every asterisk-repeat wording the parser accepts, so this only ever folds back a
    // repeat this feature (or a writer copying its convention) actually wrote this way.
    const REPEAT_LONGFORM_RE = /\*([^*]+?);\s*rep from \*\s*(\d+)\s*more times\b/gi;

    /** Every long-form repeat on one line, folded back to shorthand. standardizeRepeatText's
     *  counterpart, offered so a writer who prefers bracket notation is not stuck once a row has been
     *  spelled out - formatting is a preference to switch between, not a one-way door. */
    function condenseRepeatText(text) {
        let changed = false;
        const out = String(text || '').replace(REPEAT_LONGFORM_RE, (whole, body, moreTimes) => {
            const shorthand = buildRepeatShorthand(body, parseInt(moreTimes, 10) + 1);
            if (!shorthand) return whole;
            changed = true;
            return shorthand;
        });
        return changed ? out : null;
    }

    // === 9. EXPORTS === //
    return {
        STITCH_PRIMITIVES: stitchDictionary,
        STITCH_GLOSSARY: stitchGlossary,
        // Shared with analytics.js, which builds its yardage multipliers from it rather than keeping
        // a second list of the same eight categories.
        CYC_YARN_CATEGORIES,
        CUSTOM_STITCHES,
        getUsedStitches,
        normalizeForTesting,
        addCustomStitch,
        removeCustomStitch,
        clearCustomStitches,
        setRepeatConvention,
        getRepeatConvention,
        setChainSpaceConvention,
        getChainSpaceConvention,
        isRingStart,
        hasJoiningSlipStitch,
        marksFirstStitch,
        NON_STITCH_PROSE,
        addPatternStitch,
        clearPatternStitches,
        parsePatternStitchName,
        parseStitchMultiple,
        COLOR_CODES,
        addColorCode,
        removeColorCode,
        clearColorCodes,
        parseSectionHeader,
        classifyPatternLine,
        STANDING_CHAIN_HEIGHTS,
        standingChainNotes,
        turningChainNote,
        // Section 8. inferPatternSettings is the one the app calls; the three parts are exported
        // alongside it so a suite can pin each detection without reading the combined shape.
        inferPatternSettings,
        countSizeVariants,
        // Shared with app.js's resolveSizeVariants so the two cannot disagree about what a size is.
        sizeGroupRegex,
        isSizeGroup,
        inferConstruction,
        inferUnstatedSkip,
        buildUnstatedSkipFix,
        buildRepeatPhrasing,
        buildRepeatPhrasingFix,
        standardizeRepeatText,
        buildRepeatShorthand,
        condenseRepeatText,
        impliedStandingChain,
        chainSpaceNotes,
        notationFaults,
        documentationBlock,
        documentationHeading,
        startsWorkSection,
        parseHeldStitches,
        matchHeldName,
        isKnownStitch,
        parseGaugeStatement,
        parseMetadataStatement,
        parseAbbreviationEntry,
        requiredElements,
        REQUIRED_ELEMENTS,
        dialectFaults,
        buildTerminologyFix,
        buildShorthandFixes,
        setTerminology,
        standingChainHeights,
        DIALECT_EXCLUSIVE,
        SHORTHAND_FORMS,
        looksLikeRowLabel,
        stripRowLabel,
        rowLabelNumbers,
        ROW_LABELS,
        parseInstructions,
        analyzeRepeatUnit,
        increaseStyle,
        buildIncreaseStyleFix,
        clusterCount,
        buildClusterGrowthFix,
        // The cross-row half of the diagnosis. evaluateStep cannot reach it - it sees one row.
        applyUpstreamCause,
        buildFixes,
        evaluateStep,
        // Exported for the stitch aggregation, which has to know how many stitches a foundation row
        // works into its own chain. That is this function's decision and should not be second-guessed.
        parseFoundationRow,
        calculateYardage
    };

})();