boot();

var A = CrochetAnalyticsEngine;
function step(trace, name) {
    var hit = trace.steps.filter(function (s) { return s.name === name; })[0];
    return hit ? hit.value : '(missing)';
}

print('\n1. The worked example from the brief');
// Size XL front: 46 in bust, +4 ease, half the circumference, 4 sts/in, 6 + 1 repeat.
var t = A.TraceMeasurement({
    label: 'front', body: 46, ease: { value: 4, mode: 'in' }, allocation: 0.5,
    stitchesPerInch: 4, repeat: { multiple: 6, plus: 1 }
});
ck('body bust', step(t, 'Body front'), '46 in');
ck('selected ease', step(t, 'Selected ease'), '+4 in');
ck('finished circumference', step(t, 'Finished circumference'), '50 in');
ck('front allocation', step(t, 'Piece allocation'), '50%');
ck('target front width', step(t, 'Target front width'), '25 in');
ck('gauge', step(t, 'Gauge'), '4 sts/in');
ck('raw count', step(t, 'Raw count'), '100 sts');
ck('required multiple', step(t, 'Required multiple'), '6 + 1');
ck('final count', step(t, 'Final count'), '103 sts');
ck('actual width', step(t, 'Actual front width'), '25.75 in');
// The number the designer most needs and is least likely to work out: a whole number
// of stitches does not land on the ease that was asked for.
ck('actual total ease', step(t, 'Actual total ease'), '+5.5 in');
ck('and it says what was asked for instead',
   t.steps.filter(function (s) { return s.name === 'Actual total ease'; })[0].note,
   'asked for +4 in');
ck('the final count is returned as a number too', t.finalCount, 103);

print('\n2. Nothing in the trace is computed a second way');
// Every figure has to match the function that actually produced it, or the trace is
// describing a calculation the grader did not perform.
ck('the ease matches ApplyEase', step(t, 'Finished circumference'),
   A.ApplyEase(46, { value: 4, mode: 'in' }) + ' in');
ck('the count matches RoundStitchCount', t.finalCount,
   A.RoundStitchCount({ targetInches: 25, stitchesPerInch: 4,
                        repeat: { multiple: 6, plus: 1 } }).stitches);

print('\n3. A piece worked in the round is not halved');
var round = A.TraceMeasurement({ label: 'body', body: 46, ease: { value: 4, mode: 'in' },
                                 allocation: 1, stitchesPerInch: 4, piece: 'round' });
ck('the whole circumference is the target', step(round, 'Target body width'), '50 in');
ck('and the count covers all of it', round.finalCount, 200);

print('\n4. Lengths trace differently, because they are different');
var length = A.TraceMeasurement({ label: 'armhole depth', body: 7.25, axis: 'length',
                                  rowsPerInch: 3 });
ck('a length reports rows', step(length, 'Gauge'), '3 rows/in');
ck('and rounds to whole rows', step(length, 'Final count'), '22 rows');
// The target is reported to a tenth first, as every measurement in the grader is, so
// 7.25 in becomes 7.3 and the raw row count follows from that rather than from 7.25.
ck('with the raw figure beside it', step(length, 'Raw count'), '21.9 rows');
ck('and the target it came from', step(length, 'Target armhole depth'), '7.3 in');
// A length is not split between a front and a back, and no stitch repeat runs up it.
ck('no piece allocation', step(length, 'Piece allocation'), '(missing)');
ck('no stitch multiple', step(length, 'Required multiple'), '(missing)');
ck('and the difference is named for what it is', step(length, 'Actual total ease'), '(missing)');
ok('being a difference, not an ease', /in/.test(step(length, 'Actual difference')));

print('\n5. Percentage ease is labelled as such');
var pct = A.TraceMeasurement({ label: 'bust', body: 40, ease: { value: 10, mode: 'percent' },
                               stitchesPerInch: 4 });
ck('ten per cent of forty is four', step(pct, 'Selected ease'), '+4 in');
ck('and the note says where that came from',
   pct.steps.filter(function (s) { return s.name === 'Selected ease'; })[0].note,
   '10% of the body measurement');

print('\n6. Negative ease traces as readily as positive');
var neg = A.TraceMeasurement({ label: 'bust', body: 40, ease: { value: -2, mode: 'in' },
                               stitchesPerInch: 4 });
ck('the ease is negative', step(neg, 'Selected ease'), '-2 in');
ck('and the finished measurement smaller', step(neg, 'Finished circumference'), '38 in');

print('\n7. What cannot be traced is said, not guessed');
var noGauge = A.TraceMeasurement({ label: 'bust', body: 40, ease: { value: 4, mode: 'in' } });
ck('no gauge, no count', noGauge.finalCount, 'null');
ck('and the trace says so', step(noGauge, 'Gauge'), 'not set');
ok('with the consequence spelled out',
   /no sts count can be worked out/.test(
       noGauge.steps.filter(function (s) { return s.name === 'Gauge'; })[0].note));
ck('no body measurement, no trace at all', A.TraceMeasurement({}).steps.length, 0);
ck('and no NaN', /NaN/.test(JSON.stringify(A.TraceMeasurement({}))), false);

endSuite();
