boot();

var E = window.CrochetMathEngine;

function txt(el) {
    if (!el) return '';
    return ((el.innerHTML || '') + ' ' + (el.textContent || ''))
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function load(text) {
    $('new-file-btn').fire('click');
    $('bulk-input').value = text;
    $('bulk-parse-btn').fire('click');
    return $('step-sequence-body').children;
}

function rows() {
    return $('step-sequence-body').children.map(function (tr) {
        var c = tr.children;
        return {
            cls: tr.className,
            label: txt(c[0]),
            instruction: txt(c[1]),
            expected: txt(c[3]),
            calculated: (txt(c[4]).match(/^\d+/) || [''])[0],
            status: txt(c[5])
        };
    });
}

// A top-down raglan worked in joined rounds, with the front matter a self-published pattern actually
// carries. Every case here comes from one pattern read end to end; each was a row of the matrix that should
// not have been one, or a count that drifted because a round is not a row.

print('\n1. A round-opening chain is not a stitch');
// The turning chain was only recognised by the word "turn". A pattern worked in the round never turns, so
// its ch 1 was counted - and because the calculated count carries forward, the error compounded round over
// round rather than staying at one.
var base = "Row 1: ch 21, hdc in 2nd ch from hook and in each ch across (20)";
load([base,
    "Round 2: Ch 1, hdc in each st around. Sl st to 1st hdc to join. [20 sts]",
    "Round 3: Ch 1, hdc in each st around. Sl st to 1st hdc to join. [20 sts]",
    "Round 4: Ch 1, hdc in each st around. Sl st to 1st hdc to join. [20 sts]"].join('\n'));
var r = rows();
ck('round 2 holds its count', r[1].calculated, 20);
ck('round 3 does not drift', r[2].calculated, 20);
ck('and neither does round 4', r[3].calculated, 20);
ok('every round passes', r.every(function (x) { return /row-passed/.test(x.cls); }));

// The flat form still works as it did, and a chain the pattern says is a stitch is still a stitch: only
// ch 1 is taken on the strength of the round.
load([base, "Row 2: ch 1, turn, hdc in each st across (20)"].join('\n'));
ck('a turning chain with "turn" is still stripped', rows()[1].calculated, 20);
load([base, "Round 2: Ch 3 (counts as dc), dc in each st around. [21 sts]"].join('\n'));
ok('a ch 3 the pattern counts as a stitch is left alone', rows()[1].calculated !== '20');
load(["Row 1: ch 20", "Row 2: Ch 1"].join('\n'));
ck('a row that is only "Ch 1" still makes a chain', rows()[1].calculated, 1);

print('\n2. A stitch count written in two parts');
// "[60 hdc, 4 ch-1 sps]" is how a yoke states its count. It matched nothing, so the expected count read 0
// and the row was never checked - and the annotation stayed in the instruction, where "4 ch-1 sps" was
// worked as four more stitches.
load([base, "Round 2: hdc in each st around. [20 hdc, 4 ch-1 sps]"].join('\n'));
r = rows();
ck('the parts are summed into the expected count', r[1].expected, 24);
ck('and the annotation is not worked as stitches', r[1].calculated, 20);
load([base, "Round 2: hdc in each st around. [20 sts]"].join('\n'));
ck('a single-part count is unchanged', rows()[1].expected, 20);
load([base, "Round 2: hdc in each st around. (20 sts, 10 rows)"].join('\n'));
ck('a part measured in rows is not a stitch count', rows()[1].expected, 20);

print('\n3. Front matter is documentation, not rows');
// The abbreviation list, the gauge and the pattern notes are all written in the vocabulary of stitches.
// Every line was validated as a row, and the first to fail blocked the whole pattern beneath it.
load([
    "Pattern Specifications",
    "Gauge: 14 hdc x 10 rounds = 4\" x 4\" (10 cm x 10 cm)",
    "Hook Size: US H/8 (5.0 mm) or size needed to obtain gauge",
    "Yarn: Medium / Worsted Weight (Category 4) — approx. 650–750 yards",
    "Skill Level: Easy / Intermediate",
    "Abbreviations",
    "ch: chain",
    "hdc: half double crochet",
    "hdc2tog: half double crochet 2 together (decrease)",
    "Pattern Notes",
    "Starting Chains: The ch 1 at the beginning of rounds does not count as a stitch.",
    "Corner Increases: Corner increases are worked as (1 hdc, ch 1, 1 hdc) into the ch-1 space.",
    "Foundation: Ch 20. [20 sts]",
    "Round 1: Ch 1, hdc in each ch around. Sl st to 1st hdc to join. [20 sts]",
    "Round 2: Ch 1, hdc in each st around. Sl st to 1st hdc to join. [20 sts]",
    "Round 3: Ch 1, hdc in each st around. Sl st to 1st hdc to join. [20 sts]"
].join('\n'));
r = rows();
var work = r.filter(function (x) { return /row-/.test(x.cls); });
ck('only the four real rows are validated', work.length, 4);
ok('the foundation is one of them', /Ch 20/.test(work[0].instruction));
ok('and nothing failed', work.every(function (x) { return /row-passed/.test(x.cls); }));
ok('the gauge line is a note', r.some(function (x) { return /note-row/.test(x.cls) && /Gauge/.test(x.label); }));
ok('so is every abbreviation', r.filter(function (x) { return /: (chain|half double)/.test(x.label); }).length >= 2);

print('\n4. What the front matter says is read into the app');
ck('hook size', $('meta-hook').value, 'US H/8 (5.0 mm)');
ck('yarn weight', $('meta-yarn-weight').value, '4 - Medium');
ck('skill level takes the harder of a range', $('meta-difficulty').value, 'Intermediate');
ck('gauge stitches', $('gauge-stitches').value, 14);
ck('gauge rows', $('gauge-rows').value, 10);
ck('swatch width', $('gauge-width').value, 4);
ck('swatch height', $('gauge-height').value, 4);
ck('and its unit', $('gauge-unit').value, 'in');
// Read off the pattern rather than set on a dropdown, and said out loud in the health panel so the
// reader can see what it was read as - the next line is the effect, this one is the disclosure.
ok('rounds joined with a sl st are named as such',
   /Construction:[\s\S]{0,80}Rounds \(Joined\)/.test($('cumulative-status').innerHTML));
ck('so the matrix numbers rounds, not rows', rows()[rows().length - 1].label.slice(0, 3), 'Rnd');

// A value the user typed is a decision; the paste is a suggestion.
$('new-file-btn').fire('click');
$('meta-hook').value = '6.0mm (J)';
$('bulk-input').value = "Hook Size: US H/8 (5.0 mm)\nRow 1: ch 20";
$('bulk-parse-btn').fire('click');
ck('a hook the user entered is never overwritten', $('meta-hook').value, '6.0mm (J)');

print('\n5. A group worked into one chain costs one chain');
// A raglan puts its corner increases into the foundation chain. "in next st" and "in ch-1 sp" folded to a
// single target; "in next ch" did not, so each corner was charged two chains and the opening round wanted
// four more than existed.
ck('into a chain', E.parseInstructions('(hdc, ch 1, hdc) in next ch').totalCost, 1);
ck('into the last chain', E.parseInstructions('(hdc, ch 1, hdc) in last ch').totalCost, 1);
ck('and it still yields three', E.parseInstructions('(hdc, ch 1, hdc) in next ch').totalYield, 3);
ck('into a stitch, as before', E.parseInstructions('(hdc, ch 1, hdc) in next st').totalCost, 1);
ck('a granny corner is untouched', E.parseInstructions('(3 dc, ch 2, 3 dc) in corner ch-2 sp').totalYield, 8);
ck('and so is its cost', E.parseInstructions('(3 dc, ch 2, 3 dc) in next ch-2 sp').totalCost, 2);

// The whole opening round of the yoke, worked into a 56-chain ring.
load([
    "Foundation: Ch 56. Taking care not to twist the chain, sl st to the 1st ch to form a ring. [56 sts]",
    "Round 1: Ch 1, hdc in first 18 ch (Back), (hdc, ch 1, hdc) in next ch (Corner 1), hdc in next 8 ch (Right Sleeve), (hdc, ch 1, hdc) in next ch (Corner 2), hdc in next 18 ch (Front), (hdc, ch 1, hdc) in next ch (Corner 3), hdc in next 8 ch (Left Sleeve), (hdc, ch 1, hdc) in last ch (Corner 4). Sl st to 1st hdc to join. [60 hdc, 4 ch-1 sps]"
].join('\n'));
r = rows();
ok('a chain joined into a ring is a valid foundation', /row-passed/.test(r[0].cls));
ck('and it is 56 chains, not 57', r[0].calculated, 56);
ok('the yoke round works into exactly the chains it has', /row-passed/.test(r[1].cls));
ck('yielding 60 hdc and 4 chain spaces', r[1].calculated, 64);

print('\n6. A blocked row names the row that actually failed');
// blockedByLabel was one variable read at render time, and a section resets it - so every blocked row in
// the document was told to fix whichever piece failed LAST. With restart numbering that named a row number
// existing twice, and a row could be sent to fix itself.
load([
    "Row 1: ch 11, sc in 2nd ch from hook and in each ch across (10)",
    "Row 2: ch 1, turn, sc in each of next 99 sts (99)",
    "Row 3: ch 1, turn, sc in each st across (10)",
    "Sleeves (Make 2)",
    "Row 1: ch 21, sc in 2nd ch from hook and in each ch across (20)",
    "Row 2: ch 1, turn, sc in each st across (20)",
    "Row 3: ch 1, turn, sc in each of next 99 sts (99)",
    "Row 4: ch 1, turn, sc in each st across (20)"
].join('\n'));
r = rows();
var firstBlocked = r.filter(function (x) { return /row-blocked/.test(x.cls); })[0];
var lastBlocked = r.filter(function (x) { return /row-blocked/.test(x.cls); }).pop();
ok('the first section points at its own failure', /Row 2/.test(firstBlocked.status));
ok('and not at the last section\'s', !/Row 3/.test(firstBlocked.status));
ok('the second section points at its own', /Row 3/.test(lastBlocked.status));

print('\n7. An aside in brackets is not a row');
load([base, "(Section breakdown: Back = 20 hdc, Right Sleeve = 10 hdc)", "Row 2: ch 1, turn, hdc in each st across (20)"].join('\n'));
r = rows();
ok('the breakdown is a note', /note-row/.test(r[1].cls));
ok('and the row after it still counts', /row-passed/.test(r[2].cls));
load([base, "Row 2: ch 1, turn, hdc in each st across (20)"].join('\n'));
ok('a row that merely ends in brackets is still a row', /row-passed/.test(rows()[1].cls));

print('\n8. The raglan increase round');
// "*hdc in each st across to next ch-1 sp, (hdc, ch 1, hdc) in ch-1 sp; rep from * 3 more times" expands to
// four runs and four corners. The first run took every stitch available, left nothing for the other three,
// and the corners were charged on top - so a round working exactly the 64 stitches under it was reported as
// needing 68. A run that fills to the end now reserves what the rest of the row still has to pay for.
var RAGLAN = "*hdc in each st across to next ch-1 sp, (hdc, ch 1, hdc) in ch-1 sp; rep from * 3 more times, hdc in remaining sts to end.";
var ev = E.evaluateStep(0, 64, RAGLAN, 1, 0, 4);
ck('it works exactly the 64 stitches it has', ev.totalCost, 64);
ck('and makes 68 hdc plus 4 chain spaces', ev.calculatedYield, 72);
ok('so the round is valid', ev.costIsValid);

// A to-end run followed by fixed work no longer double-counts.
ck('a run before fixed work leaves room for it',
   E.parseInstructions('sc in each st across, 2 dc in last st', 20).totalCost, 20);
ck('a run with nothing after it still fills',
   E.parseInstructions('sc in each st across', 20).totalCost, 20);

print('\n9. A count qualified by the piece it counts');
// "hdc in each of the 48 Back sts" - a garment made in one piece names its pieces constantly, and with no
// room for the name between the number and the noun none of these counted: the round read as one stitch.
ck('in each of the N <piece> sts', E.parseInstructions('hdc in each of the 48 Back sts').totalCost, 48);
ck('in N <piece> chs', E.parseInstructions('hdc in 3 underarm chs').totalCost, 3);
ck('two words of piece name', E.parseInstructions('hdc in 38 skipped sleeve sts').totalCost, 38);
ck('across N <piece> sts is a run of N, not to the end',
   E.parseInstructions('hdc across 46 Back sts', 100).totalCost, 46);
ck('the whole body round adds up',
   E.parseInstructions('hdc in each of the 48 Back sts, hdc in each of the 6 Underarm chs, hdc in each of the 48 Front sts, hdc in each of the 6 Underarm chs').totalCost, 108);
// The plain forms are untouched.
ck('next N sts still works', E.parseInstructions('sc in next 3 sts').totalCost, 3);
ck('and per-position increases still double', E.parseInstructions('2 hdc in each of next 2 sts').totalYield, 4);
ck('"in 5 rows" is not a stitch count', E.parseInstructions('rep in 5 rows').totalCost, 0);

print('\n10. Stitches held for a piece are recalled by its name');
var held = E.parseHeldStitches("hdc in Corner 1 sp (Back total = 48 hdc), ch 6 (Underarm 1), skip 38 sts (Right Sleeve), ch 6 (Underarm 2), skip 38 sts (Left Sleeve)");
ck('a skip names the piece it holds for', held['Right Sleeve'], 38);
ck('and the other side too', held['Left Sleeve'], 38);
ck('a stated total is read as well', held['Back'], 48);
var breakdown = E.parseHeldStitches('(Section breakdown: Back = 48 hdc, Right Sleeve = 38 hdc, Front = 48 hdc, Left Sleeve = 38 hdc)');
ck('a breakdown line gives all four', Object.keys(breakdown).length, 4);
ck('and its counts', breakdown['Left Sleeve'], 38);
ck('an ordinary row holds nothing', E.parseHeldStitches('Row 5: ch 1, turn, sc in each st across (20)'), null);

ck('a plural title finds the sided pieces', E.matchHeldName('Sleeves', held), 38);
ck('so does a make count', E.matchHeldName('Sleeves (Make 2)', held), 38);
ck('a piece nothing was held for gets nothing', E.matchHeldName('Collar', held), null);

// End to end: the sleeve starts with the stitches the yoke skipped for it, not from zero.
load([
    "Row 1: ch 45, hdc in 2nd ch from hook and in each ch across (44)",
    "Row 2: hdc in each of the 6 Back sts, skip 38 sts (Right Sleeve). [6 sts]",
    "Sleeves (Make 2)",
    "Round 1: hdc in 38 skipped sleeve sts. [38 sts]",
    "Round 2: hdc in each st around. [38 sts]"
].join('\n'));
r = rows();
var sleeve = r.filter(function (x) { return /row-/.test(x.cls); }).slice(2);
ok('the sleeve round is worked, not blocked', /row-passed/.test(sleeve[0].cls));
ck('into the 38 the yoke held for it', sleeve[0].calculated, 38);
ok('and the round after it too', /row-passed/.test(sleeve[1].cls));

print('\n11. The titling rules are on the page');
var IH = readFile('index.html');
ok('a titling guide sits in the Pattern Input panel',
   IH.indexOf('heading-rules') > 0 && IH.indexOf('heading-rules') > IH.indexOf('<h2>Pattern Input</h2>'));
ok('it gives the capitals form', /All capitals/.test(IH));
ok('the colon form', /Ending in a colon/.test(IH));
ok('the dashes form', /Between dashes/.test(IH));
ok('and the make-count form', /With a make count/.test(IH));
ok('it warns that a title restarts the count', /restarts the stitch/.test(IH));
ok('and explains holding stitches by name', /skip 38 sts \(Right Sleeve\)/.test(IH));
ok('the guide is styled', /\.heading-rules \{/.test(readFile('style.css')));

endSuite();
