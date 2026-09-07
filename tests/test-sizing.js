boot();
var A = CrochetAnalyticsEngine;

// A row shaped like evaluatePatternRows() output.
function row(label, yield_, chain) {
    return {
        label: label,
        status: 'valid',
        step: { initialChain: chain || 0 },
        evaluation: { calculatedYield: yield_ }
    };
}
// 2.4 sts/in, 4.5 rows/in.
var GAUGE_IN = { unit: 'in', stitchDensity: 2.4, rowDensity: 4.5 };
// The same fabric quoted in cm: 2.4/2.54 = 0.94488 sts/cm.
var GAUGE_CM = { unit: 'cm', stitchDensity: 2.4 / 2.54, rowDensity: 4.5 / 2.54 };

function sized(opts) {
    return A.CalculateFinishedSize(opts);
}

print('\n1. Arithmetic');
var r18 = [];
for (var i = 1; i <= 18; i++) r18.push(row('Rnd ' + i, i === 14 ? 96 : 80));

var inResult = sized({ rows: r18, gauge: GAUGE_IN, category: '', piece: 'round' });
ck('96 sts at 2.4 sts/in -> 40.0 in', inResult.circumferenceInches, 40);
ck('18 rows at 4.5 rows/in -> 4.0 in', inResult.lengthInches, 4);

var cmResult = sized({ rows: r18, gauge: GAUGE_CM, category: '', piece: 'round' });
ck('same fabric in cm gives the same inches', cmResult.circumferenceInches, 40);
ck('cm length matches too', cmResult.lengthInches, 4);

ck('widest row wins, not the last row', inResult.widestRow.stitches, 96);
ck('widest row is labelled', inResult.widestRow.label, 'Rnd 14');

print('\n2. Flat panels are half the circumference');
var half = sized({ rows: r18, gauge: GAUGE_IN, category: '', piece: 'half' });
ck('half doubles the width', half.circumferenceInches, 80);
ck('width itself is untouched', half.widthInches, 40);
ck('round does not double', inResult.circumferenceInches, inResult.widthInches);

print('\n3. A bare foundation chain is not fabric');
// ch 100 then rows of 96: the chain would otherwise win "widest" and overstate the piece.
var withChain = [row('Row 1', 100, 100), row('Row 2', 96), row('Row 3', 96)];
var chainRes = sized({ rows: withChain, gauge: GAUGE_IN, category: '', piece: 'round' });
ck('foundation chain excluded from widest', chainRes.widestRow.stitches, 96);
ck('and from the row count', chainRes.rowsCounted, 2);
// A first row that works into its own chain is real fabric and must NOT be dropped.
var worked = [row('Row 1', 99, 100), row('Row 2', 99)];
worked[0].step.instructionString = 'ch 100, sc in 2nd ch from hook and in each ch across';
ck('a worked first row is kept', sized({ rows: worked, gauge: GAUGE_IN }).rowsCounted, 2);

// The other spelling: a pattern opening "Ch 100." on its own line keeps that as an
// instruction rather than an initialChain, and must be excluded just the same.
function chainRow(text, yield_) {
    var r = row('Rnd 1', yield_);
    r.step.instructionString = text;
    return r;
}
var written = [chainRow('Ch 100.', 100), row('Rnd 2', 96), row('Rnd 3', 96)];
var writtenRes = sized({ rows: written, gauge: GAUGE_IN });
ck('a written-out chain row is excluded from widest', writtenRes.widestRow.stitches, 96);
ck('and from the row count', writtenRes.rowsCounted, 2);
ck('"ch 100" without the period too', sized({ rows: [chainRow('ch 100', 100), row('R2', 96)], gauge: GAUGE_IN }).rowsCounted, 1);

print('\n4. Woman 40.0 in -> three honest candidates');
var w = sized({ rows: r18, gauge: GAUGE_IN, category: 'woman', piece: 'round' });
ck('three sizes listed', w.matches.length, 3);
ck('ordered by ease, tightest first', w.matches.map(function (m) { return m.sizeLabel; }).join(','), 'Large,Medium,Small');
ck('Large ease low', w.matches[0].easeLow, -2);
ck('Large ease high', w.matches[0].easeHigh, 0);
// Midpoint ease is -1 in. CYC's negative-ease band is "approximately 2 to 4 inches
// LESS", so -1 belongs to zero ease (body skimming), not to the negative band.
ck('Large band', w.matches[0].band, 'close fitting (zero ease)');
// A garment 3 in narrower than the body really is the negative-ease band.
var tight = sized({ rows: [row('Rnd 1', Math.round(38 * 2.4))], gauge: GAUGE_IN, category: 'woman' });
ok('38 in on a Large is negative ease',
   tight.matches.some(function (m) { return m.sizeLabel === 'Large' && /negative ease/.test(m.band); }));
ck('Medium ease', w.matches[1].easeLow + '..' + w.matches[1].easeHigh, '2..4');
ck('Medium band', w.matches[1].band, 'classic fit');
ck('Small ease', w.matches[2].easeLow + '..' + w.matches[2].easeHigh, '6..8');
ck('Small band', w.matches[2].band, 'oversized');
ck('uses ease', w.usesEase, true);
ck('measure is named bust', w.measureName, 'bust');

print('\n5. Out of range says so');
var tiny = [row('Row 1', 24)];   // 24 / 2.4 = 10 in
var t = sized({ rows: tiny, gauge: GAUGE_IN, category: 'woman', piece: 'round' });
ck('10 in is off the woman chart', t.outOfRange, true);
ck('no sizes claimed', t.matches.length, 0);
ck('chart bounds reported', t.chartMin + '-' + t.chartMax, '28-62');

print('\n6. Not a garment: measured, never sized');
ck('measurement still available', inResult.available, true);
ck('but no chart consulted', inResult.charted, false);
ck('and no size claimed', inResult.matches.length, 0);

print('\n7. Single-value charts share the range path');
// 2 sts/in so every half inch is a whole number of stitches and the ease is exact.
var GAUGE_2 = { unit: 'in', stitchDensity: 2, rowDensity: 2 };
function circ(inchesWanted) { return [row('Rnd 1', inchesWanted * 2)]; }
function sized2(cat, inchesWanted) {
    return sized({ rows: circ(inchesWanted), gauge: GAUGE_2, category: cat, piece: 'round' });
}
var baby = sized2('baby', 18);
ok('baby 18 in matches 12 months at zero ease',
   baby.matches.some(function (m) { return m.sizeLabel === '12 months' && m.easeLow === 0 && m.easeHigh === 0; }));
var child = sized2('child', 25);
ok('child 25 in matches size 6', child.matches.some(function (m) { return m.sizeLabel === '6'; }));
var youth = sized2('youth', 30);
ok('youth 30 in matches size 12', youth.matches.some(function (m) { return m.sizeLabel === '12'; }));
ck('youth is its own chart, not child 12', A.CYC_BODY_MEASUREMENTS.child.sizes.length, 5);
ck('youth has three sizes', A.CYC_BODY_MEASUREMENTS.youth.sizes.length, 3);

print('\n8. Head and hand carry no ease band');
var hat = sized2('head', 19);
ck('head does not use ease', hat.usesEase, false);
ck('head is charted', hat.charted, true);
ck('two nearest sizes offered', hat.matches.length, 2);
ok('no band string on any head match', hat.matches.every(function (m) { return m.band === ''; }));
ok('19 in head lands on Child (18-20)', hat.matches[0].sizeLabel === 'Child');
// A hat is worn with negative ease; the bust/chest ease chart must not be applied to it.
ok('no ease band anywhere in a head result', hat.matches.every(function (m) { return !/fit|ease|oversized/.test(m.band); }));
var mitt = sized2('hand', 7.5);
ck('hand does not use ease', mitt.usesEase, false);
ok('7.5 in hand finds Woman Medium', mitt.matches.some(function (m) { return m.sizeLabel === 'Woman Medium'; }));

print('\n9. Chart values I had wrong from memory');
// A size entry now carries all nine measurement points, so the circumference the chart
// is indexed by is reached through measureKey rather than being the entry itself.
function labelAt(cat, lo) {
    var chart = A.CYC_BODY_MEASUREMENTS[cat];
    var hit = chart.sizes.filter(function (s) { return s[1][chart.measureKey].min === lo; })[0];
    return hit ? hit[0] : '(none)';
}
ck('woman 44-46 is X-Large, not 1X', labelAt('woman', 44), 'X-Large');
ck('woman 48-50 is 2X', labelAt('woman', 48), '2X');
ck('man reaches 5X at 62', labelAt('man', 62), '5X');
ck('man has eight sizes', A.CYC_BODY_MEASUREMENTS.man.sizes.length, 8);
ck('woman has nine sizes', A.CYC_BODY_MEASUREMENTS.woman.sizes.length, 9);
// The ease chart names, which I had as "standard-fitting" and CYC does not.
var bands = w.matches.map(function (m) { return m.band; }).join('|');
ok('no invented "standard-fitting" band', bands.indexOf('standard') === -1);

print('\n10. Nothing to measure yet');
ck('no gauge -> unavailable', sized({ rows: r18, gauge: null }).available, false);
ck('zero density -> unavailable', sized({ rows: r18, gauge: { unit: 'in', stitchDensity: 0, rowDensity: 0 } }).available, false);
ck('no rows -> unavailable', sized({ rows: [], gauge: GAUGE_IN }).available, false);
ck('only failed rows -> unavailable',
   sized({ rows: [{ label: 'Row 1', status: 'failed', step: {}, evaluation: { calculatedYield: 0 } }], gauge: GAUGE_IN }).available, false);
var noRowGauge = sized({ rows: r18, gauge: { unit: 'in', stitchDensity: 2.4, rowDensity: 0 } });
ck('no row gauge still gives a width', noRowGauge.widthInches, 40);
ck('and reports length as null, not NaN', noRowGauge.lengthInches, null);

print('\n10b. A measurement is never reported as NaN or as nonsense');
function hostile(rows) { return sized({ rows: rows, gauge: GAUGE_IN, category: 'woman', piece: 'round' }); }
var noYield = [{ label: 'R1', status: 'valid', step: {}, evaluation: {} }];
ck('a row with no calculated yield is not measurable', hostile(noYield).available, false);
ck('a zero-stitch row is not measurable', hostile([row('R1', 0)]).available, false);
ck('a negative count is not measurable', hostile([row('R1', -5)]).available, false);
// A good row alongside a broken one still measures, from the good one.
var mixed = [{ label: 'R1', status: 'valid', step: {}, evaluation: {} }, row('R2', 100)];
ck('a usable row is still measured', hostile(mixed).circumferenceInches, Math.round(100 / 2.4 * 10) / 10);
ck('and the broken row is not counted as a row', hostile(mixed).rowsCounted, 1);

print('\n11. GenerateFullReport carries sizing');
var report = A.GenerateFullReport([], { yarnWeight: 4, gauge: GAUGE_IN, rows: r18, sizingCategory: 'woman', sizingPiece: 'round' });
ok('report has a sizing block', !!report.sizing);
ck('report sizing agrees with direct call', report.sizing.circumferenceInches, 40);
ck('report sizing found the sizes', report.sizing.matches.length, 3);
var bare = A.GenerateFullReport([], { yarnWeight: 4 });
ck('report without gauge is unavailable, not broken', bare.sizing.available, false);

endSuite();
