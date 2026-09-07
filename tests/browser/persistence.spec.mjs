/**
 * The storage path no other suite can reach.
 *
 * Everything pure about persistence.js - the envelope, its validator, the migration dispatcher, the
 * retention rule, the callback contract - is covered by the headless suites and covered well. The
 * IndexedDB adapter is not, and cannot be: the two Node/JSC runners have no indexedDB, no Blob and no
 * microtask queue, which is why the adapter was deliberately written to hold no decisions.
 *
 * That was a fair trade while a project file was the real copy. It is not any more. With cloud sync
 * descoped, this adapter IS the database - if it drops a write, the work is gone and there is no
 * second copy anywhere. So the sequence a designer actually performs gets tested against a real
 * browser and a real IndexedDB: type, autosave, RELOAD, and get the work back.
 *
 * Run:  node tests/browser/persistence.spec.mjs            (needs a Chromium via Playwright)
 * These are separate from `npm test` on purpose - that runs everywhere with no dependencies, and this
 * needs a browser. A red run here is still a release blocker.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.webmanifest': 'application/manifest+json',
                '.png': 'image/png' };

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS  ' + name); }
                             else { fail++; console.log('  FAIL  ' + name); } };
const ck = (name, got, want) => {
    if (got === want) { pass++; console.log('  PASS  ' + name); }
    else { fail++; console.log(`  FAIL  ${name}\n         expected ${want}, got ${got}`); }
};

/* Served over http rather than opened from file://, because IndexedDB on a file:// origin behaves
   differently across browsers and a suite that passes for the wrong reason is worse than none. */
function serve() {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        const file = path.join(ROOT, rel);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404); res.end('not found'); return;
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1',
        () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/index.html` })));
}

const PATTERN = 'Row 1: ch 13, sc in 2nd ch from hook and in each ch across (12)\n'
              + 'Row 2: ch 1, turn, sc in each st across (12)';

/**
 * page.evaluate, retried through a navigation.
 *
 * The router writes the view into location.hash on boot. That is a same-document navigation, but it
 * still tears down an evaluate that happens to be in flight - which surfaces as "execution context was
 * destroyed" and reads exactly like a storage failure while being nothing of the kind. Retrying is the
 * honest fix: the thing under test is what IndexedDB kept, not how fast the page settled.
 */
async function evaluateSettled(page, fn, tries = 5) {
    let last;
    for (let i = 0; i < tries; i++) {
        try { return await page.evaluate(fn); }
        catch (err) {
            last = err;
            if (!/context was destroyed|Execution context/i.test(String(err))) throw err;
            await page.waitForTimeout(400);
        }
    }
    throw last;
}

/* A store call whose callback never fires would otherwise hang the run for ever, which is the least
   useful way for a storage suite to fail. Every await below is bounded. */
const withTimeout = (promise, ms, what) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms))
]);

const { server, url } = await serve();
const browser = await chromium.launch();

try {
    // ---- 1. The adapter that actually runs -------------------------------------------------
    console.log('\n1. The real IndexedDB adapter is the one in use');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url); await page.waitForTimeout(1200);

    const adapter = await evaluateSettled(page, async () => {
        const p = window.StitchPersistence;
        const store = p.createStore();
        return await new Promise(resolve => {
            store.saveCurrent(p.buildEnvelope({ projectName: 'probe', body: { rawText: 'x' } }),
                () => resolve(store.adapterName()));
        });
    });
    ck('the store resolves to idb, not the memory fallback', adapter, 'idb');
    ck('and no error was raised getting there', errors.length, 0);

    // ---- 2. Save, reload, recover ------------------------------------------------------------
    console.log('\n2. Autosave survives a reload - the sequence a designer performs');
    await page.click('#nav-studio'); await page.waitForTimeout(300);
    await page.fill('#bulk-input', PATTERN);
    await page.click('#bulk-parse-btn');
    // Autosave is debounced; give it room to fire and to write.
    await page.waitForTimeout(2500);
    const statusBefore = await page.textContent('#save-status');
    ok('the status line reports a save rather than a failure', /Saved|Autosave on/.test(statusBefore));

    // waitUntil rather than a bare reload: evaluating into a context the navigation is still tearing
    // down fails with "execution context was destroyed", which looks like a storage bug and is not one.
    await page.reload({ waitUntil: 'load' });
    const offered = await withTimeout(evaluateSettled(page, async () => {
        const p = window.StitchPersistence;
        const store = p.createStore();
        // loadCurrent takes (projectId, cb). The id is derived from the project name, so the envelope
        // builder is asked for it rather than a literal being written here - a hard-coded id would
        // pass for the wrong reason the day projectIdFor changes.
        const id = p.buildEnvelope({ projectName: document.getElementById('project-name').value }).projectId;
        return await new Promise(resolve => {
            // A callback that never fires would hang the page rather than fail the suite.
            const bail = setTimeout(() => resolve('__never-called__'), 8000);
            store.loadCurrent(id, r => {
                clearTimeout(bail);
                resolve(r.ok && r.value ? r.value.body.rawText : null);
            });
        });
    }), 20000, 'the reloaded project');
    ok('loadCurrent answered at all', offered !== '__never-called__');
    ok('the pattern is still in the store after a reload', !!offered && offered.indexOf('ch 13') !== -1);
    ck('and it is the whole pattern, not a truncated one', (offered || '').split('\n').length, 2);

    // ---- 3. Snapshots and the retention rule, against a real cursor --------------------------
    console.log('\n3. Snapshots write and prune through a real cursor');
    const snaps = await withTimeout(evaluateSettled(page, async () => {
        const p = window.StitchPersistence;
        const store = p.createStore();
        const env = (n) => p.buildEnvelope({ projectName: 'ring', body: { rawText: 'row ' + n } });
        for (let i = 0; i < 8; i++) {
            await new Promise(r => store.snapshot(env(i), 'manual-save', r));
        }
        return await new Promise(r => store.listSnapshots(env(0).projectId,
            res => r(res.ok ? res.value.length : -1)));
    }), 30000, 'the snapshot ring');
    ck('eight snapshots are pruned to the five the rule keeps', snaps, 5);

    // ---- 4. The memory fallback says so ------------------------------------------------------
    // The worst version of this failure is a silent one: autosave appears to work all session and
    // everything vanishes on reload. The status line has to name it.
    console.log('\n4. A refused database is reported, not hidden');
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.addInitScript(() => {
        // Refuse at open, the way a browser with storage disabled does.
        Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('refused'); } } });
    });
    await page2.goto(url); await page2.waitForTimeout(1500);
    await page2.click('#nav-studio'); await page2.waitForTimeout(300);
    await page2.fill('#bulk-input', PATTERN);
    await page2.click('#bulk-parse-btn'); await page2.waitForTimeout(2500);
    const blockedLine = await page2.textContent('#save-status');
    ok('the status line names the failure rather than claiming a save',
       /unavailable/i.test(blockedLine));
    ok('and the app still works with no store at all',
       (await page2.locator('#step-sequence-body tr').count()) === 2);

    console.log(`\n${pass} passed, ${fail} failed`);
} finally {
    await browser.close();
    server.close();
}
process.exit(fail ? 1 : 0);
