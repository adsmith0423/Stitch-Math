boot();

var E = CrochetMathEngine;
var A = CrochetAnalyticsEngine;

// A repeat as a string, so a null and a {6,1} can be compared by the same helper.
function mult(text) {
    var r = E.parseStitchMultiple(text);
    return r ? r.multiple + '+' + r.plus : 'null';
}

print('\n1. Reading a stitch multiple out of prose');
ck('the plain form', mult('multiple of 6 + 1'), '6+1');
ck('spelled out', mult('multiple of 6 plus 1'), '6+1');
ck('no plus at all', mult('multiple of 12'), '12+0');
ck('pluralised, with units on both numbers', mult('multiples of 4 sts plus 2'), '4+2');
ck('in a foundation instruction', mult('Ch a multiple of 6 + 1.'), '6+1');
ck('in a pattern-stitch header', mult('Ripple Pattern (worked over a multiple of 12 sts)'), '12+0');
ck('shouted', mult('Worked over a MULTIPLE OF 8 STITCHES PLUS 3'), '8+3');
ck('a border bigger than the repeat is legal', mult('multiple of 4 plus 6'), '4+6');

print('\n2. What must NOT be read as a multiple');
// The literal "multiple of" is the whole safety of this. Without it a repeat count reads as a stitch
// multiple and a section acquires a constraint nobody wrote.
ck('a repeat count is not a multiple', mult('rep from * 6 more times'), 'null');
ck('an ordinary row says nothing', mult('sc in each st across'), 'null');
ck('a multiple of 1 constrains nothing', mult('multiple of 1'), 'null');
ck('empty text', mult(''), 'null');
ck('no text at all', mult(null), 'null');
// The 3 is a chain allowance, not part of the repeat: taking it would put the foundation chain's extra
// stitches into every row's arithmetic.
ck('a trailing chain allowance is not the plus',
   mult('multiple of 6 sts + 1 st (add 3 for the base ch)'), '6+1');

print('\n3. The existing pattern-stitch header parser is untouched');
ck('still returns its own shape',
   JSON.stringify(E.parsePatternStitchName('Ripple Pattern (worked over a multiple of 12 sts)')),
   '{"name":"Ripple Pattern","multiple":12}');

print('\n4. Does a count fit the repeat');
function fit(count, m, plus) { return A.FitToMultiple({ count: count, repeat: { multiple: m, plus: plus } }); }
ok('103 fits 6 + 1', fit(103, 6, 1).fits);
no('104 does not', fit(104, 6, 1).fits);
ck('and says how far off it is', fit(104, 6, 1).remainder, 1);
ck('the label reads the way patterns write it', fit(103, 6, 1).label, '6 + 1');
ck('with no plus it is just the number', fit(96, 12, 0).label, '12');
ck('the valid count below', fit(104, 6, 1).below, 103);
ck('and the one above', fit(104, 6, 1).above, 109);
// One full repeat is the floor. 1 st satisfies (1-1) % 6 === 0 arithmetically, but fabric with no repeat
// in it is not what the designer asked for.
no('a count below one full repeat does not fit', fit(1, 6, 1).fits);
ok('exactly one full repeat does', fit(7, 6, 1).fits);
ck('a border bigger than the repeat sets the floor', fit(10, 4, 6).fits, true);
no('and below it nothing fits', fit(6, 4, 6).fits);

print('\n5. An absent or meaningless multiple constrains nothing');
// x % 0 is NaN and NaN === 0 is false, so a naive rule reports every count invalid and the panel fills
// with warnings about a repeat the designer never set.
ok('a multiple of 0 leaves the count alone', fit(103, 0, 0).fits);
ok('so does a multiple of 1', fit(103, 1, 0).fits);
ok('and no repeat at all', A.FitToMultiple({ count: 103 }).fits);
ck('with nothing to report', A.FitToMultiple({ count: 103 }).multiple, 'null');

print('\n6. The nearest valid counts, with what each one measures');
// The worked example: 103 sts at 4 sts/in against a 6 + 1 repeat.
var near = A.NearestValidCounts({ count: 103, repeat: { multiple: 6, plus: 1 }, stitchesPerInch: 4, span: 1 });
ck('three options offered', near.length, 3);
ck('the one below', near[0].count + ' = ' + near[0].inches, '97 = 24.25');
ck('the calculated count itself, marked valid', near[1].count + ' ' + near[1].valid, '103 true');
ck('and marked as the one being reported on', near[1].current, true);
ck('the one above', near[2].count + ' = ' + near[2].inches, '109 = 27.25');
ck('the difference each one makes', near[0].deltaInches, -1.5);
ck('zero for the count itself', near[1].deltaInches, 0);

// A count that does NOT fit still appears, flagged, between its neighbours.
var off = A.NearestValidCounts({ count: 104, repeat: { multiple: 6, plus: 1 }, stitchesPerInch: 4, span: 1 });
ck('an invalid count is still shown', off.filter(function (r) { return r.current; })[0].count, 104);
no('flagged as not fitting', off.filter(function (r) { return r.current; })[0].valid);
ok('bracketed by the valid count either side',
   off[0].count === 103 && off[off.length - 1].count === 109);

print('\n7. Rounding a target into a stitch count');
function round(t, spi, opts) {
    opts = opts || {};
    return A.RoundStitchCount({ targetInches: t, stitchesPerInch: spi, repeat: opts.repeat,
                                strategy: opts.strategy, parity: opts.parity });
}
// The back-compat contract: with no repeat, this IS the old plain rounding. Written as a literal early
// return in the engine, not a strategy that happens to agree.
ck('no repeat, nearest, is exactly the old arithmetic',
   round(20.5, 4).stitches, A.MeasurementToStitches(20.5, 4));
ck('and on an untidy number too',
   round(23.75, 4).stitches, A.MeasurementToStitches(23.75, 4));
ck('the raw count is kept alongside the rounded one', round(23.75, 4).rawStitches, 95);

var r = round(23.75, 4, { repeat: { multiple: 6, plus: 1 } });
ck('95 does not fit 6 + 1, so it moves', r.stitches, 97);
ck('the graded measurement is reported', r.gradedInches, 24.25);
ck('and the difference it makes', r.differenceInches, 0.5);
ok('marked as fitting once moved', r.fits);

// The stated example: 23.75 in becoming 24.00 in is +0.25, which round1 cannot express.
var quarter = round(23.75, 4, { repeat: { multiple: 2, plus: 0 } });
ck('a quarter inch difference survives rounding', quarter.differenceInches, 0.25);
ck('graded to the even count', quarter.stitches, 96);

print('\n8. Which side of the target to land on');
var repeat6 = { repeat: { multiple: 6, plus: 1 } };
ck('nearest picks the closer one', round(23.75, 4, repeat6).stitches, 97);
ck('up always goes up', round(23.75, 4, { repeat: repeat6.repeat, strategy: 'up' }).stitches, 97);
ck('down always goes down', round(23.75, 4, { repeat: repeat6.repeat, strategy: 'down' }).stitches, 91);
// 100 sts sits at 25.0 in, 0.75 from both 97 (24.25) and 103 (25.75). On an exact tie, nearest prefers the
// larger count, so a garment errs toward more ease rather than less.
var tie = round(25, 4, repeat6);
ck('an exact tie goes to the larger count, favouring ease', tie.stitches, 103);
ck('a count that already fits does not move', round(25.75, 4, repeat6).stitches, 103);
ck('and reports no difference', round(25.75, 4, repeat6).differenceInches, 0);

print('\n9. Parity constrains the repeat count, not the stitch count');
// 97 sts is (97-1)/6 = 16 repeats, even; 91 is 15, odd; 103 is 17, odd. Asking for an odd repeat count
// moves DOWN to 91 rather than up to 103, because nearest is measured from the target and 22.75 in is
// closer to 23.75 than 25.75 is.
ck('16 repeats is even, so 97 stands', round(23.75, 4, { repeat: repeat6.repeat, parity: 'even' }).stitches, 97);
ck('odd takes the nearest odd count, not the next one up',
   round(23.75, 4, { repeat: repeat6.repeat, parity: 'odd' }).stitches, 91);
ck('and it is genuinely an odd number of repeats',
   (round(23.75, 4, { repeat: repeat6.repeat, parity: 'odd' }).stitches - 1) / 6 % 2, 1);
ck('any takes whichever is nearer', round(23.75, 4, { repeat: repeat6.repeat, parity: 'any' }).stitches, 97);
// Parity is meaningless without a repeat to count, and must not silently invent one.
ck('parity with no repeat changes nothing',
   round(23.75, 4, { parity: 'odd' }).stitches, A.MeasurementToStitches(23.75, 4));

print('\n10. Hostile input produces nothing, not NaN');
ck('no gauge', round(23.75, 0, repeat6).stitches, 'null');
ck('no target', round(null, 4, repeat6).stitches, 'null');
ck('a negative gauge', round(23.75, -4, repeat6).stitches, 'null');
no('and none of it reports a fit', round(23.75, 0, repeat6).fits);
ck('nearest counts on no gauge is an empty list',
   A.NearestValidCounts({ count: 103, repeat: { multiple: 6, plus: 1 } })
    .filter(function (row) { return row.inches !== null; }).length, 0);

endSuite();
