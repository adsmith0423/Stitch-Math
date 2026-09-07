boot();
var html = readFile('index.html');

print('\nValidation matrix headers');
['User Total','Calc Total','Math Verified'].forEach(function(h){
    // Matched around the attributes rather than as a literal: the matrix headers carry scope="col"
    // now, and pinning the exact string was pinning the absence of an accessibility attribute.
    ck('has "'+h+'"', new RegExp('<th[^>]*>' + h + '</th>').test(html), true);
});
['<th>Expected</th>','<th>Calculated</th>','<th>Math Check</th>'].forEach(function(h){
    ck('old header gone: '+h, html.indexOf(h) === -1, true);
});

print('\nPlaceholders: measurement inputs blank');
['gauge-height','gauge-rows','gauge-width','gauge-stitches'].forEach(function(id){
    var m = html.match(new RegExp('id="'+id+'"[^>]*'));
    ck(id+' has none', /placeholder=/.test(m[0]), false);
});
print('\nPlaceholders: kept where the format is non-obvious');
['swatch-weight','gauge-hook-size','gauge-notes','calc-skein-weight','calc-skein-length'].forEach(function(id){
    var m = html.match(new RegExp('id="'+id+'"[^>]*'));
    ck(id+' still has one', /placeholder=/.test(m[0]), true);
});

print('\nDifficulty badge contrast token');
ck('Intermediate uses --warning-text', readFile('analytics.js').indexOf('var(--warning-text)') !== -1, true);
ck('no longer --cat-shaping', /badgeColor = "var\(--cat-shaping\)"/.test(readFile('analytics.js')), false);

print('\nThis round of label changes');
ck('header reads Row Mult', /<th[^>]*>Row Mult<\/th>/.test(html), true);
// Scoped to the validation matrix. The print table has its own, deliberately shorter "Mult" header, and
// scanning the whole document caught that instead - it only passed before because that cell happened to
// carry an inline style attribute.
var matrixHead = html.slice(html.indexOf('id="matrix-section"'), html.indexOf('id="step-sequence-body"'));
ck('old <th>Mult</th> gone from the matrix', /<th[^>]*>Mult<\/th>/.test(matrixHead), false);
ck('custom stitch label is Stitch', html.indexOf('<label for="custom-st-name">Stitch</label>') !== -1, true);
ck('label Stitches Used', html.indexOf('<label for="custom-st-cost">Stitches Used</label>') !== -1, true);
ck('label Stitches Made', html.indexOf('<label for="custom-st-yield">Stitches Made</label>') !== -1, true);
ck('placeholder Cost', /id="custom-st-cost"[^>]*placeholder="Cost"/.test(html), true);
ck('placeholder Yield', /id="custom-st-yield"[^>]*placeholder="Yield"/.test(html), true);
ck('old Abbrev. gone', html.indexOf('Abbrev.') === -1, true);
ck('old Cost (Used) gone', html.indexOf('Cost (Used)') === -1, true);
ck('old Yield (Made) gone', html.indexOf('Yield (Made)') === -1, true);
ck('converter uses select-with-unit', html.indexOf('class="select-with-unit"') !== -1, true);
ck('segmented-control gone from html', html.indexOf('segmented-control') === -1, true);
ck('segmented-control gone from css', readFile('style.css').indexOf('segmented-control') === -1, true);
ck('unit control has a gap', /\.select-with-unit \{[^}]*gap: 8px/.test(readFile('style.css')), true);
ck('toggles present', /id="toggle-trend-markers"/.test(html) && /id="toggle-collapse-repeats"/.test(html), true);

endSuite();
