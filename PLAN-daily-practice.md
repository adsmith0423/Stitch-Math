# Build plan — practice mode, ranks, and the daily habit

A specification for the next block of work on Stitch Math. Written to be handed to a coding agent
working in this repository. Read `ARCHITECTURE.md` and `CONTRIBUTING.md` first; nothing here overrides
them.

Base commit: `78abb56` — *removed the avatar feature; left the folder containing assets and left enough
in code to return feature if necessary*. 107 node:test cases, all green.

---

## Why this block exists

Every way to earn points today presupposes a person who is **already writing a pattern**: a project
saved, a swatch measured, a file exported, a clean compile, stitches worked. A beginner has none of
those. The progress store's own comment says there is no participation trophy for opening the app —
that principle is correct and must not be weakened. But it means a learner currently has no way to earn
anything at all, and the whole layer is invisible to exactly the person it is meant to serve.

The gap is not rewards. It is that there is nothing for a beginner to *do*. This block gives them
something, and it is deliberately the thing the app is uniquely able to offer: **practice, graded by an
engine that actually knows the answer.**

It also draws a line the product needs. The paying audience is professional pattern designers, to whom
streaks and levels read very differently than to a beginner. So the first thing built is the switch
that lets them turn it all off — built first precisely so everything after it is built inside the gate
rather than retrofitted into one.

---

## Invariants

These are load-bearing. Breaking one is a failure of the work, not a trade-off.

1. **`validator.js` and `analytics.js` never touch the DOM.** All new UI lives in `app.js`.
2. **No dependencies.** `npm test` and CI run with no install step. Nothing added here changes that.
3. **Nothing pays twice.** Every new award is date-stamped or ledgered, exactly as `awardProgress`
   already does with `paidSaves`, `dayExports` and `questDate`.
4. **Nothing is invented.** Every figure traces to something the person actually did.
5. **The answer is never hard-coded.** Practice rows are graded by `CrochetMathEngine`, never by a
   number stored beside the row. This is the single most important rule in the document — see §3.
6. **The wire formats are frozen.** `KIND`, `DB_NAME` and the `stitchmath_` localStorage keys do not
   change. `persistence.js` says why at each one.
7. **Every new surface honours the mode flag from the day it is written** (§1). No feature in this
   plan may be built and gated later.
8. **Tests are the safety net, not an afterthought.** Each section names the suite to write. Follow the
   house style: `tests/test-*.js` using `boot()`, `ok`, `ck`, `no` and `print`, driving the app
   **through its own controls** rather than by assigning state directly — `tests/test-templates.js` is
   the model to copy, and its header explains why.

---

## 1. The mode switch

### The setting

One checkbox in `SETTING_SPECS`, on the Settings view.

```js
{ id: 'toggle-practice-mode', kind: 'checkbox', group: 'Practice and progress',
  label: 'Show daily practice, streak and rank',
  note: 'Turn this off for a plain working tool. Nothing is lost — your record keeps counting, '
      + 'and it is all still here if you turn it back on.' }
```

**It describes what is shown, not who the person is.** Not "beginner mode" — nobody wants to tick a box
that calls them a beginner, and a professional using the practice rows to check their own dialect
should not have to identify as one either.

**Default on.** A beginner will not go looking in Settings for a feature they do not know exists; a
professional will find the switch within a minute of wanting it. Defaulting off protects the audience
that needs no protecting, at the cost of the one this block exists for.

It is a view preference, not project data: it belongs with the other `viewPrefs`, never in the project
envelope. A `.json` a designer sends to a tester must not carry a UI preference with it.

### What it hides

The whole progress layer, and nothing else. One boolean, one meaning — no partial hiding and no second
set of labels for the same feature, which doubles the copy and invites the two versions to drift.

Off means these are not rendered:

| Surface | Where |
|---|---|
| Points / rank block in the sidebar | `.sidebar-points` in `index.html` — **needs an id adding** |
| The progress pill in the topbar | `#status-pill` |
| Studio Record card | `.card-record` — **needs an id adding** |
| Daily Stitch Roll card | the card holding `#roll-reel` — **needs an id adding** |
| Daily quest card | the card holding `#quest-text` — **needs an id adding** |
| Daily Practice panel | new, §3 |
| Stitch cabinet | new, §4 |
| Lessons list | new, §5 |

Adding those four container ids is part of this section. Gating by class or by walking to
`parentElement` is brittle in exactly the way `test-templates.js`'s header warns about.

### What it does **not** change

**The store keeps recording.** `awardProgress`, `recordWork`, `touchStreak` and the collection all run
exactly as they do now. Only rendering is suppressed.

This matters: someone who switches off in March and back on in June should find six months of history
waiting, not a reset. It is also the simpler implementation — one gate at the render boundary rather
than a condition threaded through every award path, where a missed branch silently costs somebody their
streak. Nothing leaves the device either way, so there is no privacy cost to recording quietly.

### Tests — `tests/test-practice-mode.js`

- Default is on for a store that has never seen the setting.
- Toggling off hides every surface in the table; toggling on restores them.
- **Working with the mode off still records.** Save a project with it off, turn it on, assert the
  points, the streak and the record figures all moved. This is the regression that would hurt most and
  be noticed least.
- The setting survives a reload.
- The setting is absent from a project envelope built by `buildEnvelope`.

---

## 2. Rank, not currency

Points are no longer presented as a balance. The rank ladder — Chain Starter through Gauge Whisperer —
carries the motivation, and it already does the job properly: `rankFor` is computed from lifetime
earnings, so it never walks backwards.

Points do not go away. They still drive levels, which still drive rank. They stop being a *wallet*.

### What changes

**The sidebar block** leads with rank instead of a total. Rank name, and a bar showing progress to the
next rank. The bar can still be driven by points internally — keep the arithmetic, drop the display.
`#points-total` stops showing a number; `#points-next` reads as *2 levels to Pattern Explorer* rather
than *Next level at 100 pts*.

**Rerolls become a daily allowance rather than a purchase.** This is the one place a visible balance was
load-bearing: `Re-roll · 40 pts` and `Re-roll needs 40 pts` cannot be understood without one. Replace
with a small per-day cap — two is a reasonable start — read from the `progress.roll.rerolls` counter
that already exists.

It is also better on its own terms. Telling a beginner that looking at a different stitch costs them
progress teaches the wrong lesson about curiosity.

### What to preserve, deliberately unused

`REROLL_COST`, `progress.spent`, and the `lifetime = points + spent` arithmetic in `renderProgress` all
**stay**. They are the machinery a currency needs, and the avatar and its accessories are the use case
that would need it. Leave a comment at `REROLL_COST` saying exactly that: kept against the return of a
spend, not dead code someone should tidy away.

This mirrors what `readProgress` already does with the version 4 and 5 fields, and its comment explains
the reasoning better than this one does.

### Tests — extend the progress suite

- Rank renders from lifetime earnings and does not fall when points are spent.
- No points *balance* appears in the sidebar or the pill.
- A third reroll in one day is refused; the counter resets tomorrow.
- `REROLL_COST` and `spent` still exist and `lifetime` still includes `spent` — assert them, so a future
  tidy-up has to argue with a test rather than a comment.

---

## 3. Daily Practice

### What it is

One panel with three slots, each independently completable, each resetting at local midnight. A person
who completes **any** slot has done a day's work: the streak advances. This is the change that makes the
streak reachable for someone who is not writing a pattern.

Inside the §1 gate.

### Slot A — Read a row

Show a row of crochet and the count going into it. Ask what comes out.

```
You have 12 stitches.

    Row 2: ch 1, turn, [sc, inc] x 6

How many stitches will this row make?          [ 18 ]  [ Check ]
```

**Where the answer comes from.** Not from the data. From the engine:

```js
const evaluation = window.CrochetMathEngine.evaluateStep(
    0,                    // initialChain
    row.available,        // availableStitches
    row.instruction,      // instructionString
    1,                    // rowMultiplier
    0,                    // expectedYield — 0 so the engine reports rather than judges
    0,                    // availableCorners
    0                     // unstatedSkip
);
const answer = evaluation.calculatedYield;
```

This is invariant 5, and the reason is worth stating plainly: a practice question whose answer is stored
beside it will eventually disagree with the validator, and then the app teaches something its own
checker contradicts. Grading through `evaluateStep` makes that impossible by construction, and the
practice improves for free every time the engine does.

**Where the rows come from.** A new `PRACTICE_ROWS` constant in `app.js`, in the same spirit as
`PATTERN_TEMPLATES` — curated, ordered, each carrying the point it teaches. Not generated: a generated
row can be arithmetically valid and pedagogically meaningless, and the value here is that a human chose
what is worth learning on day nine.

```js
{
    id: 'inc-every-other',       // stable, used as the ledger key
    tier: 1,                     // 1 easy … 4 hard; the draw walks up as the collection grows
    available: 12,               // stitches going in
    instruction: 'ch 1, turn, [sc, inc] x 6',
    teaches: 'An increase works two stitches into one, so six of them add six.'
}
```

Start with about twenty across the tiers. Each must survive §3.4.

**The draw.** Deterministic from the date, so the same day gives the same row on every device and a
reload is not a reroll. Reuse the existing approach — `hashString(today() + '#practice')`, as
`drawStitch` does, for the reason its comment gives.

**After answering.** Right or wrong, show the engine's working: the calculated yield and the `teaches`
line. A wrong answer is the moment someone is most willing to read the explanation, and spending it on a
red cross wastes it. No second attempt at the same day's row — the point is the thinking, not the
guessing.

### Slot B — Meet a stitch

The Daily Stitch Roll already exists (`roll-reel`, `roll-stitch`, `roll-term`, `roll-tier`,
`roll-reward`, `roll-again`). It needs a new home in this panel and one addition: an **"I've worked
this"** control that marks the stitch into `progress.collection` directly, rather than only crediting it
when it appears in a compiled pattern.

Reroll behaviour changes per §2.

### Slot C — Log a swatch

Already pays 10 points through `awardProgress('swatch')` and already lives on Gauge Profile. This slot is
a prompt and a shortcut, not a new feature: show whether a swatch has been logged today, and link
through.

Beginners are told constantly to swatch and almost never do. Making it a third of a visible daily habit
is the most genuinely useful thing in this block, and nearly free to build.

### 3.4 Tests — `tests/test-practice.js`

The suite is the specification for `PRACTICE_ROWS`, as `test-templates.js` is for the templates.

- **Every row validates clean** through `evaluateStep`: `costIsValid`, and `calculatedYield` above zero.
  A practice row the engine cannot read teaches the opposite of what it is for.
- **Every row has a distinct, stable `id`** — they are ledger keys.
- **Every row has non-empty `teaches`**, and `tier` between 1 and 4.
- **No row stores its answer.** Assert the constant has no `answer`, `yield` or `count` field —
  invariant 5 enforced mechanically rather than by memory.
- **The draw is deterministic**: same date, same row id, twice running.
- **The draw survives a reload**: answer, re-boot, same row.
- **A correct answer pays once.** Answer, answer again, assert the total moved once.
- **Any one slot advances the streak** with no pattern in the Studio at all. This is the point of the
  block; assert it directly.

---

## 4. The stitch cabinet

`progress.collection` is already tracked by token, already carries rarity through `ROLL_TIERS`, and the
glossary already has a term for each. It renders today as one progress bar (`rec-collection-bar`). A
collection you cannot browse is not a collection: the pull comes from seeing the holes.

Inside the §1 gate.

**Build:** a grid on the **Stitch Library** view (`nav-library`) — it is the stitch reference already,
and this belongs beside it rather than in a game corner.

- One card per `rollPool()` entry.
- Locked: abbreviation only, greyed, no term. Enough to show something is missing.
- Unlocked: abbreviation, glossary term, complexity tier, date first worked.
- A count above it: *34 of 61 stitches worked.*

Store the date when a stitch is first collected. The store currently sets `collection[name] = true`;
write the date string instead and treat any truthy value as collected, so existing stores keep working.
No migration — the same additive rule `readProgress` already follows, for the reason its comment gives.

**Tests — `tests/test-collection.js`:**

- Every pool entry renders a card; locked and unlocked are distinguishable.
- First working of a stitch moves it from locked to unlocked, and the count with it.
- An older store with `collection[token] === true` still reads as collected.
- The count matches `rollPool().length` — no card orphaned by a token the pool no longer has.

---

## 5. Lesson badges

The linter already emits a `lesson` on many findings — the granny-square one, *4X clusters on round X
because each corner adds two*, is genuinely good teaching. It appears once and vanishes.

Inside the §1 gate.

**Build:** `progress.lessons`, an object of `fixId → date first earned`.

**The trigger, and this is the part to get right.** A lesson is earned when the person **applies the fix
through the app's own control** — the path that already uses `fix.edit`. Not when the finding appears,
and not when it is dismissed. Earning it on appearance rewards writing bad patterns; earning it on
dismissal rewards ignoring advice. Applying the fix is the only event that means the lesson landed.

Show them on Analytics as a short list: the lesson text and when it was first earned. **No points** —
this is a record of understanding, and pricing it would invite farming.

**Tests:**

- Applying a fix carrying a `lesson` records its id once, with a date.
- Applying the same fix again does not re-record or change the date.
- Dismissing a finding records nothing.
- A fix with no `lesson` records nothing.

---

## 6. Streak forgiveness

`touchStreak` resets `lastMilestone` to 0 whenever the streak returns to 1, so one missed day un-earns
every milestone. That is the mechanic that makes people quit on day eight and not come back, and it
punishes the wrong thing: someone who worked twenty days and missed one has not undone the twenty.

**Build:**

- `progress.restDays` — one banked per seven consecutive days, cap two.
- A gap of exactly one day spends a rest day if one is banked: streak continues, bank drops.
- A longer gap, or none banked, resets as it does now.
- `bestStreak` and `lastMilestone` semantics otherwise unchanged.

**Also:** render the streak as seven dots — worked, rested, missed — rather than a bare number. A number
makes a miss feel like failure; a row of dots makes it a week with a gap in it, which is what it is.

**Tests — extend the progress suite:**

- Seven consecutive days bank one; fourteen bank two; twenty-one still bank two.
- A one-day gap with a rest banked continues the streak and decrements the bank.
- A one-day gap with none banked resets to 1 and clears `lastMilestone`, as today.
- A three-day gap resets regardless of the bank.
- Milestones still pay once each and only forwards.

---

## Non-goals

Named so they do not creep in:

- **No accounts, no server, no leaderboards, no sharing.** All need a backend, and the central promise
  is that a designer's work never leaves their machine.
- **No notifications or reminders.** Nothing here should manufacture an obligation to open the app.
  What Stitch Math can honestly offer daily is practice worth doing; a nag is a different product.
- **No streak-loss penalties beyond the reset.** No lost points, no lost rank.
- **No generated practice rows.** See §3.
- **No second vocabulary for professional mode.** It hides the layer; it does not rename it.
- **Do not remove the spend machinery.** See §2.

## Build order

1. **§1 the mode switch** — first, so everything after is built inside the gate. This is the whole
   reason it is first; retrofitting a gate around four finished features is how the two versions start
   to drift.
2. **§2 rank, not currency** — small, and it settles what the sidebar says before new panels copy it.
3. **§6 streak forgiveness** — self-contained, and it makes the rest safe to test against.
4. **§4 the cabinet** — the data exists; this is mostly rendering.
5. **§3 Daily Practice** — the largest piece and the reason for the block.
6. **§5 lesson badges.**

Run `npm test` after each. The suite is 107 cases and several thousand assertions, it runs in under a
minute, and it is the only thing standing between a refactor and a silent regression.
