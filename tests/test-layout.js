boot();
var html = readFile('index.html'), css = readFile('style.css');

print('\n1. Usage instructions under the subtitle');
ck('usage-note present', /class="usage-note"/.test(html), true);
ck('sits inside <header>', html.indexOf('usage-note') < html.indexOf('</header>'), true);
ck('after the subtitle', html.indexOf('Mathematical Crochet Pattern Validator') < html.indexOf('usage-note'), true);
var note = html.match(/<p class="usage-note">([\s\S]*?)<\/p>/)[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
var sentences = note.split(/\.\s+|\.$/).filter(function(s){return s.trim().length>0;});
// Rewritten for a sixth-grade reading level, so the count went up and the length came down. Short
// sentences are the point; the assertion guards the length, not the count.
ck('several short sentences', sentences.length >= 5, true);
var longest = Math.max.apply(null, sentences.map(function(s){ return s.trim().split(/\s+/).length; }));
ck('no sentence runs long (<= 18 words), longest is ' + longest, longest <= 18, true);
var words = note.split(/\s+/).length;
ck('the whole note stays short (<= 90 words), it is ' + words, words <= 90, true);
ck('styled', /\.usage-note \{/.test(css), true);

print('\n2. Custom stitch table no longer escapes its panel');
var tbl = html.match(/<div class="table-responsive">\s*<table[^>]*id="custom-stitch-table"/);
ck('wrapped in .table-responsive', !!tbl, true);
ck('wrapper scrolls', /\.table-responsive \{[^}]*overflow-x: auto/.test(css), true);
ck('table has a min-width', /\.custom-st-table \{[^}]*min-width/.test(css), true);
// Remove moved to the first column, so the wrapping definition cell is now the third.
ck('definition cell wraps', /\.custom-st-table td:nth-child\(3\)[^}]*word-break/.test(css), true);
ck('remove column stays narrow', /\.custom-st-table th:first-child[^}]*white-space: nowrap/.test(css), true);
ck('long definitions break in the list', /\.list-container \{[^}]*overflow-wrap: anywhere/.test(css), true);
ck('form grid reflows when narrow', /\.form-container \{[^}]*auto-fit/.test(css), true);

print('\n3. Toggles moved above the column titles');
var opts = html.indexOf('matrix-view-options');
var thead = html.indexOf('<th>Row #</th>');
var h3 = html.indexOf('Pattern Validation Matrix');
ck('after the panel heading', h3 < opts, true);
ck('before the column titles', opts < thead, true);
ck('only one options block', (html.match(/class="matrix-view-options"/g)||[]).length, 1);
ck('border moved to the bottom edge', /\.matrix-view-options \{[^}]*border-bottom/.test(css), true);
ck('no leftover border-top', /\.matrix-view-options \{[^}]*border-top/.test(css), false);

print('\n4. Math Verified column centred');
ck('column centred', /#matrix-section \.matrix-table th:nth-child\(6\)/.test(css), true);
ck('scoped to the validation matrix', /#matrix-section \.matrix-table td:nth-child\(6\) \{ text-align: center/.test(css), true);
ck('detail lines stay left', /td:nth-child\(6\) \.math-reason/.test(css), true);

print('\n5. Toggles still work after the move');
$('bulk-input').value = [
 "Row 1: ch 16, sc in 2nd ch from hook and in each ch across (15)",
 "Rows 2-6: ch 1, turn, sc in each st across (15)"
].join('\n');
$('bulk-parse-btn').fire('click');
function body(){ return $('step-sequence-body').children; }
function cellsOf(tr){ return tr.children.map(function(c){return (c.innerHTML||'')+(c.textContent||'');}).join(' '); }
ck('6 rows', body().length, 6);
$('toggle-collapse-repeats').checked = true; $('toggle-collapse-repeats').fire('change');
ck('collapses to 2', body().length, 2);
$('toggle-trend-markers').checked = false; $('toggle-trend-markers').fire('change');
ck('markers hidden', /trend-badge/.test(body().map(cellsOf).join(' ')), false);

// Panel system. These guard the consolidation: one rule per thing, spacing in tokens, and nothing styled
// inline where a class would do.
print('\n6. Spacing lives in tokens');
['--space-1','--space-2','--space-3','--space-4','--space-6','--panel-pad','--panel-gap','--head-gap']
    .forEach(function(t){ ck(t+' defined', new RegExp(t.replace('--','\\-\\-')+':').test(css), true); });
ck('panel padding uses the token', /\.panel, \.panel-card \{[^}]*padding: var\(--panel-pad\)/.test(css), true);
ck('column gap uses the token', /\.left-column, \.right-column \{[^}]*gap: var\(--panel-gap\)/.test(css), true);
ck('heading gap uses the token', /\.panel h2 \{[^}]*margin-bottom: var\(--head-gap\)/.test(css), true);

print('\n7. One rule per thing, not two kept in sync');
ck('panel and card share a rule', /\.panel, \.panel-card \{/.test(css), true);
ck('no separate .panel-card block', /^\.panel-card \{/m.test(css), false);
ck('h2 and panel-header h3 share a rule', /\.panel h2, \.panel-header h3 \{/.test(css), true);
// The .panel-header h3 rule used to be written out twice in a row.
var dupes = (function () {
    // Media-query bodies are stripped first: a selector restated inside one is a responsive override, not
    // a duplicate (.complexity-count is exactly that). @supports goes the same way - a selector restated
    // inside one is the fallback for a browser that cannot do what the outer rule asked for, which is a
    // conditional override rather than a second copy to keep in sync. #app-sidebar is exactly that:
    // frosted glass outside, flat teal gradient where there is no backdrop-filter.
    var flat = css.replace(/@(?:media|supports)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ');
    var seen = {}, dup = [];
    flat.replace(/([^{}]+)\{[^}]*\}/g, function (whole, sel) {
        var s = sel.split('*/').pop().trim().replace(/\s+/g, ' ');
        if (!s || s.charAt(0) === '@') return whole;
        if (seen[s]) dup.push(s); else seen[s] = 1;
        return whole;
    });
    return dup;
})();
ck('no selector declared twice' + (dupes.length ? ' (' + dupes.join(', ') + ')' : ''), dupes.length, 0);

print('\n8. Classes that were referenced but never styled');
['density-card','result-item'].forEach(function(n){
    ck('.'+n+' has a rule', new RegExp('\\.'+n+'[\\s,{:]').test(css), true);
});
['bulk-import-section','header-row','left-column-panel','save-load-section','health-score'].forEach(function(n){
    ck('dead class .'+n+' removed from markup', new RegExp('class="[^"]*\\b'+n+'\\b').test(html), false);
});

print('\n9. Styling moved out of the markup');
var inlineHtml = (html.match(/style="/g) || []).length;
ck('index.html inline styles under 5, is ' + inlineHtml, inlineHtml < 5, true);
var appSrc = readFile('app.js');
var inlineApp = (appSrc.match(/style="/g) || []).length;
// The only survivor should be the complexity bar's width, which is a computed value.
ck('app.js inline styles under 3, is ' + inlineApp, inlineApp < 3, true);
ck('the survivor is the computed bar width', /style="width: \$\{pct\}%/.test(appSrc), true);
['field-label','field-row','unit-input','input-pair','link-button','row-button','gauge-output']
    .forEach(function(n){ ck('.'+n+' defined', new RegExp('\\.'+n+'[\\s,{:]').test(css), true); });

print('\n10. Nothing in a column can refuse to shrink');
// The left column is as narrow as 260px between the 950 and 1100px breakpoints. Anything that cannot
// shrink below its content pushes out of the panel instead of wrapping.
function rule(sel) {
    var re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    var m = css.match(re);
    return m ? m[1].replace(/\s+/g, ' ') : '';
}
// A fieldset is the special case: browsers give it min-inline-size: min-content, so it alone will not
// shrink to its container unless told to. This was the reported bug.
ck('fieldset can shrink', /min-width: 0/.test(rule('fieldset.input-group')), true);
ck('columns can shrink', /min-width: 0/.test(rule('.left-column, .right-column')), true);
ck('and so can their panels', /min-width: 0/.test(rule('.left-column > *, .right-column > *')), true);
ck('gauge fields wrap instead of squeezing', /flex-wrap: wrap/.test(rule('.field-row')), true);
ck('density cards wrap too', /flex-wrap: wrap/.test(rule('#density-summary')), true);
ck('density card can shrink', /min-width: 0/.test(rule('.density-card')), true);
ck('gauge result lines wrap', /flex-wrap: wrap/.test(rule('.result-item')), true);

// A grid track sized `auto` or a bare pixel value cannot go below its content either.
[['.health-checks > li', 'long check details'],
 ['.size-measure', 'finished-size readouts'],
 ['.size-matches li', 'size match rows'],
 ['.complexity-row', 'complexity bars']
].forEach(function (pair) {
    var cols = (rule(pair[0]).match(/grid-template-columns:([^;]*)/) || [, ''])[1];
    ck(pair[1] + ' use minmax(0, ...)', /minmax\(\s*0/.test(cols), true);
    // minmax(0, auto) is fine - it is a bare `auto` track, outside any minmax, that cannot shrink. Blank
    // the minmax() calls before looking.
    var outside = cols.replace(/minmax\([^)]*\)/g, ' ');
    ck(pair[1] + ' have no bare auto track', /(^|\s)auto(\s|$)/.test(outside), false);
});

print('\n11. Nested bullets are not caught by the outer row layout');
// .health-checks li matched the bullets inside a check's detail list too, making each a 2-column grid with
// an empty 18px icon column and squeezing the text.
ck('the row grid is scoped to direct children', /\.health-checks > li \{/.test(css), true);
ck('no unscoped .health-checks li rule', /\.health-checks li \{/.test(css), false);
// The markers hang into the icon gutter so the text lines up with a single-line detail.
ck('detail bullets hang left', /\.check-detail-list \{[^}]*margin: 0 0 0 -/.test(css), true);

print('\n12. The left column and its contents scale together');
// The track is widened and the contents zoomed by the same factor, so the column lays out the same content
// it always did and simply renders it larger. Change one without the other and the column either overflows
// or leaves a gap.
ck('--left-zoom defined', /--left-zoom:\s*1\.10/.test(css), true);
ck('the column uses it', /\.left-column \{ zoom: var\(--left-zoom\);? \}/.test(css), true);
ck('and drops it once stacked', /max-width: 950px\)\s*\{ \.left-column \{ zoom: 1/.test(css), true);
var tracks = (css.match(/grid-template-columns: minmax\(330px, 1\.10fr\)/) || [])[0];
ck('wide track matches the zoom', !!tracks, true);
ck('narrow track matches too', /minmax\(286px, 1\.10fr\)/.test(css), true);
// 286 / 1.10 = 260 CSS px, so the effective narrow width is what the overflow guards in section 10 were
// sized against. If this drifts, those guards need revisiting.
ck('effective narrow width is still ~260 CSS px', Math.round(286 / 1.10), 260);

print('\n13. Placeholder text is the brand teal, and still readable');
// An empty field is cued by colour rather than only by being blank. What is pinned is the contrast, not
// the hex: a test on the value only says the colour did not change, while a test on the ratio says the
// placeholder can still be read, and tells whoever retunes the palette exactly what they broke.
function tokenValue(name) {
    var m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-f]{6})', 'i'));
    return m ? m[1].toLowerCase() : null;
}
function contrast(a, b) {
    function lum(hex) {
        var parts = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16) / 255; });
        var c = parts.map(function (v) {
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    var hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b));
    return (hi + 0.05) / (lo + 0.05);
}

// --primary is an alias for --brand-teal, so the hex has to come from the brand token.
ck('--primary is the brand teal', /--primary:\s*var\(--brand-teal\)/.test(css), true);
var placeholderColor = tokenValue('brand-teal');
var fieldBg = tokenValue('surface-subtle');
ck('the brand teal has a value', !!placeholderColor, true);
ck('and so does the form background it sits on', fieldBg, '#faf9f6');

var rule = (css.match(/textarea::placeholder,[\s\S]*?\}/) || [''])[0];
ck('placeholders are styled', rule.length > 0, true);
ck('text inputs are covered', /input\[type="text"\]::placeholder/.test(rule), true);
ck('number inputs too', /input\[type="number"\]::placeholder/.test(rule), true);
ck('through the token, not a raw hex', /color: var\(--primary\)/.test(rule), true);
ck('no raw hex in the rule', /#[0-9a-f]{3,6}/i.test(rule), false);
// Firefox fades placeholders by default, which would undo the contrast measured below.
ck('opacity is pinned', /opacity: 1/.test(rule), true);

// The reason the colour is usable at all.
var ratio = contrast(placeholderColor, fieldBg);
ck('placeholder clears WCAG AA at 4.5:1 (currently ' + ratio.toFixed(2) + ':1)', ratio >= 4.5, true);
// Focus lightens the field to --panel-bg, which can only raise the ratio - but if the focus background is
// ever darkened, the resting check above stops covering the worst case.
ck('and on the focused field too', contrast(placeholderColor, tokenValue('brand-white')) >= 4.5, true);
// The teal carries text as printed; the coral does not, which is why it is not used here. Swapping
// --accent in would look like a brand tidy-up and quietly make these unreadable.
ck('the coral would have failed (' + contrast(tokenValue('brand-coral'), fieldBg).toFixed(2) + ':1)',
   contrast(tokenValue('brand-coral'), fieldBg) < 4.5, true);
ck('so the rule does not reach for it', /var\(--accent\)/.test(rule), false);

endSuite();
