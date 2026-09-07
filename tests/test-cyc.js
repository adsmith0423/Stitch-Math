boot();
var A = CrochetAnalyticsEngine;

print('\n1. CYC project levels (Standards & Guidelines p.12)');
function level(s){ return A.CalculateDifficulty({ sc: s }).level; }   // sc complexity weight = 1
ck('40  -> Basic',                 level(40), 'Basic');
ck('60  -> Basic (upper edge)',    level(60), 'Basic');
ck('61  -> Easy',                  level(61), 'Easy');
ck('90  -> Easy',                  level(90), 'Easy');
ck('120 -> Easy (upper edge)',     level(120), 'Easy');
ck('121 -> Intermediate',          level(121), 'Intermediate');
ck('200 -> Intermediate',          level(200), 'Intermediate');
ck('275 -> Intermediate (edge)',   level(275), 'Intermediate');
ck('400 -> Complex',               level(400), 'Complex');

print('\n2. Four bands need four distinct colours');
var colours = [40,90,200,400].map(function(s){ return A.CalculateDifficulty({sc:s}).badgeColor; });
ck('four distinct colours', new Set(colours).size, 4);
ck('Easy uses the new token', colours[1], 'var(--level-easy)');

print('\n3. Markup and token');
var html = readFile('index.html'), css = readFile('style.css');
ok('dropdown offers Basic',   /<option>Basic<\/option>/.test(html));
ok('dropdown offers Easy',    /<option>Easy<\/option>/.test(html));
ok('dropdown offers Complex', /<option>Complex<\/option>/.test(html));
ok('old Beginner/Advanced options gone', !/<option>(Beginner|Advanced)<\/option>/.test(html));
ok('stat badge default is Basic', /id="stat-difficulty"[^>]*>Basic</.test(html));
ok('--level-easy defined', /--level-easy:\s*#707152/.test(css));

print('\n4. Yarn weight 0 no longer falls back to Worsted');
var TOTALS = { sc: 500 };
var lace = A.EstimateYarnYardage(TOTALS, 0);
var med  = A.EstimateYarnYardage(TOTALS, 4);
ok('lace yardage differs from medium', lace.totalYards !== med.totalYards);
ok('lace uses less yarn than worsted', lace.totalYards < med.totalYards);
ok('lace names itself Lace, not Worsted', /Lace/.test(lace.yarnWeightName));
ck('medium unchanged (regression)', /Worsted/.test(med.yarnWeightName), true);

print('\n5. Yarn weight descriptors match CYC p.22');
ok('Lace lists 10 count crochet thread', /0 - Lace \(Lace, 10 count crochet thread\)/.test(html));
ok('Fingering filed under Super Fine',   /1 - Super Fine \(Sock, Fingering, Baby\)/.test(html));
ok('Fingering NOT under Lace',           !/0 - Lace \([^)]*Fingering/.test(html));
ok('Bulky lists Rug',                    /5 - Bulky \(Chunky, Craft, Rug\)/.test(html));
ok('Super Bulky lists Bulky',            /6 - Super Bulky \(Bulky, Roving\)/.test(html));
ok('Jumbo lists Roving',                 /7 - Jumbo \(Jumbo, Roving\)/.test(html));

print('\n6. Stitch counts only where the count changes (CYC p.33)');
function load(lines){ $('bulk-input').value = lines.join('\n'); $('bulk-parse-btn').fire('click'); }
function panel(){ return $('cumulative-status').innerHTML; }
function score(){ var m = panel().match(/health-number">(\d+)</); return m ? +m[1] : null; }
function check(name){ var re = new RegExp('check-(pass|warn|fail)"><span class="check-icon">[^<]*</span><span class="check-name">'+name+'<');
    var m = panel().match(re); return m ? m[1] : null; }

// Plain rows written without counts are correct per CYC and must not be penalised.
load([
 "Row 1: ch 9, sc in 2nd ch from hook and in each ch across (8)",
 "Row 2: ch 1, turn, sc in each st across",
 "Row 3: ch 1, turn, sc in each st across",
 "Row 4: ch 1, turn, sc in each st across"
]);
ck('plain unchanged rows are not penalised', check('Formatting'), 'pass');
ck('score is a clean 100', score(), 100);

// A row that DOES change the count still needs one.
load([
 "Row 1: ch 9, sc in 2nd ch from hook and in each ch across (8)",
 "Row 2: ch 1, turn, sc in each st across",
 "Row 3: ch 1, turn, 2 sc in each st across"
]);
ck('a count-changing row without a count warns', check('Formatting'), 'warn');
ok('and names the CYC rule', /required where the count changes/.test(panel()));
ck('score drops below 100', score() < 100, true);

// Same pattern with the count supplied -> clean again.
load([
 "Row 1: ch 9, sc in 2nd ch from hook and in each ch across (8)",
 "Row 2: ch 1, turn, sc in each st across",
 "Row 3: ch 1, turn, 2 sc in each st across (16)"
]);
ck('supplying the count clears it', check('Formatting'), 'pass');
ck('back to 100', score(), 100);

endSuite();

print('\n7. Projects saved on the old three-level scale migrate');
function loadSaved(level){
  var saves = {};
  saves['Old'] = { rawText: "Row 1: ch 9, sc in 2nd ch from hook and in each ch across (8)",
                   metadata: { difficulty: level } };
  localStorage.setItem('stitchmath_saves', JSON.stringify(saves));
  $('load-select').value = 'Old';
  $('load-btn').fire('click');
  return $('meta-difficulty').value;
}
ck('Beginner    -> Basic',        loadSaved('Beginner'), 'Basic');
ck('Advanced    -> Complex',      loadSaved('Advanced'), 'Complex');
ck('Intermediate unchanged',      loadSaved('Intermediate'), 'Intermediate');
ck('a current level is untouched', loadSaved('Easy'), 'Easy');
// A project saved with no level is not a manual choice, so the calculator fills it.
// That is the designed behaviour, not a blank field.
ck('no saved level hands back to the calculator', loadSaved('') !== '', true);

endSuite();
