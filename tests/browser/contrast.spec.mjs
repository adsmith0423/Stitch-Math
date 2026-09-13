/**
 * What Readable actually paints.
 *
 * test-readable.js checks the tokens: every colour pair the theme declares carries text at 7:1.
 * That is necessary and it is not sufficient - a token can be perfect and a rule can still put
 * --ink-soft on a pastel, or leave a component painting its own colour that no token reaches. The
 * only way to know is to lay the page out and read the pixels back.
 *
 * So this walks every element that holds visible text, on six views, and computes the contrast of
 * its computed colour against the first opaque background behind it. AAA is the bar: 7:1, or 4.5:1
 * for text at 24px, or 18.66px bold. Readable must have ZERO below it. Day and night are measured
 * on the same pass and only reported - they are not held to AAA and never claimed to be, and the
 * numbers are printed so the difference Readable makes is a figure rather than an adjective.
 *
 * Run:  node tests/browser/contrast.spec.mjs      (needs a Chromium via Playwright)
 * Separate from `npm test` for the same reason the storage suite is: that runs everywhere with no
 * dependencies, and this needs a layout engine. A red run here is still a release blocker.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('\nThis suite drives a real browser, which needs Playwright installed once:\n');
    console.error('    npm install --save-dev playwright');
    console.error('    npx playwright install chromium\n');
    console.error('Then run `npm run test:contrast` again. `npm test` needs none of this.\n');
    process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.webmanifest': 'application/manifest+json',
                '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); }
                             else { fail++; console.log('  FAIL  ' + name); } };

function serve() {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        const file = path.join(ROOT, rel);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'text/plain' });
        res.end(fs.readFileSync(file));
    });
    return new Promise(resolve => server.listen(0, () => resolve(server)));
}

/* Runs inside the page. Kept as one function with no closure over anything outside it, because it
   is serialised across the bridge. */
const AUDIT = () => {
    const channel = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = (r, g, b) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const parse = s => (s.match(/[\d.]+/g) || []).map(Number);
    /* The first ancestor painting something opaque. Walking up is the only honest answer: a
       translucent panel over a gradient has no single background colour, and by day that is most
       of the page - which is exactly why day is reported rather than asserted. */
    const backdrop = el => {
        let n = el;
        while (n && n !== document.documentElement) {
            const v = parse(getComputedStyle(n).backgroundColor);
            if (v.length >= 3 && (v[3] === undefined || v[3] > 0.95)) return v;
            n = n.parentElement;
        }
        return [255, 255, 255];
    };
    const misses = [];
    let counted = 0;
    document.querySelectorAll('body *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        const box = el.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) return;
        // Only elements holding their OWN text. Without this every wrapper is counted again for
        // the text of its children and one bad label is reported a dozen times.
        const own = [...el.childNodes]
            .filter(n => n.nodeType === 3 && n.textContent.trim())
            .map(n => n.textContent.trim()).join(' ');
        if (!own) return;
        const fg = parse(cs.color);
        if (fg.length < 3 || (fg[3] !== undefined && fg[3] < 0.95)) return;
        const bg = backdrop(el);
        const a = lum(fg[0], fg[1], fg[2]), b = lum(bg[0], bg[1], bg[2]);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        counted++;
        if (ratio < (large ? 4.5 : 7)) {
            misses.push({ text: own.slice(0, 44), ratio: Number(ratio.toFixed(2)),
                          size, colour: cs.color, on: `rgb(${bg.slice(0, 3).join(',')})` });
        }
    });
    return { counted, misses };
};

const VIEWS = ['nav-studio', 'nav-dashboard', 'nav-patterns',
               'nav-analytics', 'nav-settings', 'nav-practice'];
const PATTERN = 'Ch 6\nRow 1: sc in each ch across. (6)\nRow 2: [sc, inc] x 4 (11)';

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const totals = {};

for (const mode of ['day', 'night', 'readable']) {
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
    await page.goto(base + '/index.html');
    await page.waitForTimeout(900);
    await page.evaluate(() => document.getElementById('nav-settings')?.click());
    await page.waitForTimeout(200);
    await page.selectOption('#theme-mode', mode);
    await page.waitForTimeout(200);
    // A page with a compiled pattern on it, so the matrix, the badges and the graph are all drawn.
    await page.evaluate(() => document.getElementById('nav-studio').click());
    await page.waitForTimeout(200);
    await page.fill('#bulk-input', PATTERN);
    await page.click('#bulk-parse-btn');
    await page.waitForTimeout(700);

    let counted = 0; const misses = [];
    for (const nav of VIEWS) {
        await page.evaluate(id => document.getElementById(id)?.click(), nav);
        await page.waitForTimeout(300);
        const r = await page.evaluate(AUDIT);
        counted += r.counted;
        r.misses.forEach(m => misses.push(Object.assign({ view: nav }, m)));
    }
    totals[mode] = { counted, misses };
    await page.context().close();
}
await browser.close();
server.close();

console.log('\n1. Every visible text node, six views, three appearances');
for (const mode of ['day', 'night', 'readable']) {
    const t = totals[mode];
    console.log(`  ${mode.padEnd(9)} ${t.counted} text nodes, ${t.misses.length} below AAA`);
}
ok('the audit actually found the page', totals.readable.counted > 300);
ok('and measured the same page in each appearance',
   totals.day.counted === totals.readable.counted && totals.night.counted === totals.readable.counted);

console.log('\n2. Readable is AAA everywhere, with nothing excused');
if (totals.readable.misses.length) {
    totals.readable.misses.slice(0, 20).forEach(m => console.log(
        `        ${String(m.ratio).padStart(5)}:1  ${m.size}px  ${m.view}  ${JSON.stringify(m.text)}  ${m.colour} on ${m.on}`));
}
ok(`no text below AAA in Readable, found ${totals.readable.misses.length}`,
   totals.readable.misses.length === 0);

console.log('\n3. And it is a real improvement, not a relabelling');
// Day and night are NOT held to AAA - they are a designed page and they are allowed to be. The
// assertion is that Readable is decisively better than both, which is the whole reason it exists.
console.log(`        day ${totals.day.misses.length} below AAA, night ${totals.night.misses.length}, readable ${totals.readable.misses.length}`);
ok('Readable clears more than day does', totals.readable.misses.length < totals.day.misses.length);
ok('and more than night does', totals.readable.misses.length < totals.night.misses.length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
