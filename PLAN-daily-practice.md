# Build plan — Daily Practice, the stitch cabinet, and lesson badges

A specification for the next block of work on Stitch Math. Written to be handed to a coding agent
working in this repository. Read `ARCHITECTURE.md` and `CONTRIBUTING.md` first; nothing here overrides
them.

**Do this before anything else:** the working tree currently holds an uncommitted refactor (roughly
1,244 lines removed across `app.js`, `index.html`, `style.css` and `tests/test-shell.js`). It passes —
107 node:test cases, all green — but this plan must land on a committed base, or a mistake in it will
be impossible to separate from a mistake in that. Commit it first.

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

Three practices, one panel. Read a row. Meet a stitch. Log a swatch.

---

## Invariants

These are load-bearing. Breaking one is a failure of the work, not a trade-off.

1. **`validator.js` and `analytics.js` never touch the DOM.** All new UI lives in `app.js`.
2. **No dependencies.** `npm test` and CI run with no install step. Nothing added here changes that.
3. **Nothing pays twice.** Every new award is date-stamped or ledgered, exactly as `awardProgress`
   already does with `paidSaves`, `dayExports` and `questDate`.
4. **Nothing is invented.** Every figure traces to something the person actually did.
5. **The answer is never hard-coded.** Practice rows are graded by `CrochetMathEngine`, never by a
   number stored beside the row. This is the single most important rule in the document — see §1.
6. **The wire formats are frozen.** `KIND`, `DB_NAME` and the `stitchmath_` localStorage keys do not
   change. `persistence.js` says why at each one.
7. **Tests are the safety net, not an afterthought.** Each section below names the suite to write.
   Follow the house style: `tests/test-*.js` using `boot()`, `ok`, `ck`, `no` and `print`, driving the
   app **through its own controls** rather than by assigning state directly — `tests/test-templates.js`
   is the model to copy, and its header explains why.

---

## 1. Daily Practice — the panel

### What it is

One panel with three slots, each independently completable, each resetting at local midnight. A person
who completes **any** slot has done a day's work: the streak advances. This is the change that makes
the streak reachable for someone who is not writing a pattern.

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

This is rule 5, and the reason for it is worth stating plainly: a practice question whose answer is
stored beside it will eventually disagree with the validator, and then the app teaches something its
own checker contradicts. Grading through `evaluateStep` makes that impossible by construction. It also
means the practice improves for free every time the engine gets better.

**Where the rows come from.** A new `PRACTICE_ROWS` constant in `app.js`, in the same spirit as
`PATTERN_TEMPLATES` — curated, ordered, each carrying the point it teaches. Not generated: a generated
row can be arithmetically valid and pedagogically meaningless, and the whole value here is that a human
chose what is worth learning on day nine.

Shape:

```js
{
    id: 'inc-every-other',       // stable, used as the ledger key
    tier: 1,                     // 1 easy … 4 hard; the draw walks up as the collection grows
    available: 12,               // stitches going in
    instruction: 'ch 1, turn, [sc, inc] x 6',
    teaches: 'An increase works two stitches into one, so six of them add six.'
}
```

Start with about twenty, spread across tiers. Each must survive the test in §1.4.

**The draw.** Deterministic from the date, so the same day gives the same row on every device and a
reload is not a reroll. Reuse the existing pattern — `hashString(today() + '#practice')`, the same
approach `drawStitch` uses, for the same reason its comment gives.

**After answering.** Right or wrong, show the engine's own working: the calculated yield and the
`teaches` line. A wrong answer is the moment someone is most willing to read the explanation; spending
it on a red cross wastes it. Do not allow a second attempt at the same day's row — the point is the
thinking, not the guessing.

### Slot B — Meet a stitch

This already exists as the Daily Stitch Roll (`roll-reel`, `roll-stitch`, `roll-term`, `roll-tier`,
`roll-reward`, `roll-again`). It needs no new mechanic, only a new home and one addition: a **"I've
worked this"** control that marks the stitch into `progress.collection` directly, rather than only
crediting it when it turns up in a compiled pattern.

Keep `rerollStitch` and its `REROLL_COST` exactly as they are.

### Slot C — Log a swatch

Already pays 10 points through `awardProgress('swatch')`, and already lives on the Gauge Profile view.
This slot is a shortcut and a prompt, not a new feature: show whether a swatch has been logged today,
and link to the gauge panel.

Beginners are told constantly to swatch and almost never do. Making it one third of a visible daily
habit is the most genuinely useful thing on this list, and it costs almost nothing to build.

### 1.4 Tests — `tests/test-practice.js`

The suite is the specification for `PRACTICE_ROWS`, exactly as `test-templates.js` is for the
templates. It must assert:

- **Every row validates clean.** Run each through `evaluateStep` and require `costIsValid` and a
  `calculatedYield` greater than zero. A practice row that the engine cannot read teaches the opposite
  of what it is for.
- **Every row has a distinct `id`**, and the ids are stable — they are ledger keys.
- **Every row has non-empty `teaches`**, and `tier` between 1 and 4.
- **No row's answer is stored anywhere.** Assert by inspection of the constant: it has no `answer`,
  `yield` or `count` field. This is rule 5 enforced mechanically rather than by memory.
- **The draw is deterministic**: the same date yields the same row id twice in a row.
- **The draw is stable across a reload**: answering, re-booting and reading again gives the same row.
- **A correct answer pays once.** Answer, re-answer, assert the balance moved exactly once.
- **Any one slot advances the streak**, with no pattern in the Studio at all. This is the whole point
  of the block — assert it directly.

---

## 2. The stitch cabinet

`progress.collection` is already tracked, keyed by stitch token, already carries rarity through
`ROLL_TIERS`, and the glossary already has a term for each. It is currently rendered as a single
progress bar (`rec-collection-bar`). A collection you cannot browse is not a collection: the pull comes
from seeing the holes.

**Build:** a grid panel on the **Stitch Library** view (`nav-library`) — it is the stitch reference
already, and this belongs beside it rather than in a game corner.

- One card per entry in `rollPool()`.
- Locked: the abbreviation only, greyed, no term. Enough to show something is missing.
- Unlocked: abbreviation, glossary term, complexity tier, and the date first worked.
- A count at the top: *34 of 61 stitches worked.*

Record the date when a stitch is first collected. The store currently sets `collection[name] = true`;
change it to store the date string instead, and treat any truthy value as collected so existing stores
keep working. Do not migrate — this is the same additive rule `readProgress` already follows, and its
comment explains it.

**Tests — extend `tests/test-progress.js` or add `tests/test-collection.js`:**

- Every pool entry renders a card; locked and unlocked states are distinguishable.
- Working a stitch for the first time moves it from locked to unlocked, and the count with it.
- An older store with `collection[token] === true` still reads as collected.
- The count matches `rollPool().length` — no card is orphaned by a token the pool no longer has.

---

## 3. Lesson badges

The linter already emits a `lesson` on many findings — the granny-square one, *4X clusters on round X
because each corner adds two*, is genuinely good teaching. It appears once and vanishes.

**Build:** `progress.lessons`, an object of `fixId → date-first-earned`.

**The trigger, and this is the part to get right.** A lesson is earned when the person **applies the
fix through the app's own control** — the path that already uses `fix.edit`. Not when the finding
appears, and not when it is dismissed. Earning it on appearance rewards writing bad patterns; earning
it on dismissal rewards ignoring advice. Applying the fix is the only event that means the lesson
landed.

Show them on the Analytics view as a short list: the lesson text, and when it was first earned. No
points attached — this is a record of understanding, and pricing it in points would invite farming.

**Tests:**

- Applying a fix with a `lesson` records its id once, with a date.
- Applying the same fix again does not re-record or change the date.
- Dismissing a finding records nothing.
- A fix with no `lesson` records nothing.

---

## 4. Streak forgiveness

`touchStreak` currently resets `lastMilestone` to 0 whenever the streak returns to 1. One missed day
therefore un-earns every milestone. That is the mechanic that makes people quit on day eight and not
come back, and it is punishing the wrong thing — a person who worked twenty days and missed one has not
undone the twenty.

**Build:**

- `progress.restDays` — a small banked allowance. Earn one per seven consecutive days, cap at two.
- On a gap of exactly one day, spend a rest day if one is banked: the streak continues, the bank drops.
- On a longer gap, or with none banked, reset as it does now.
- `bestStreak` and `lastMilestone` semantics are otherwise unchanged.

**Also:** render the streak as seven dots — worked, rested, missed — rather than a bare number. A number
makes a miss feel like a failure; a row of dots makes it feel like a week with a gap in it, which is
what it is.

**Tests — extend the progress suite:**

- Seven consecutive days bank one rest day; fourteen bank two; twenty-one still bank two.
- A one-day gap with a rest day banked continues the streak and decrements the bank.
- A one-day gap with none banked resets to 1 and clears `lastMilestone`, as today.
- A three-day gap resets regardless of the bank.
- Milestones still pay once each and only forwards.

---

## 5. Two decisions to make, not to build

**The points sink.** Since the Locker came out, the only thing points buy is a reroll. Currency that
buys nothing stops motivating. Two honest resolutions:

- *Give it something to buy* — most plausibly a reveal on the day's practice row, or an advanced
  template unlocked early. Both are small.
- *Stop calling it a balance.* The rank ladder — Chain Starter through Gauge Whisperer — is already
  doing the real motivating work, and it is computed from lifetime earnings so it never walks backwards.
  Points could simply be the number behind the rank.

The second is less work and more honest. Decide before building either.

**An off switch.** There is currently no way to hide the game layer, and the paying audience is
professional pattern designers, to whom points and ranks read differently than to a beginner. Add a
checkbox to `SETTING_SPECS` — group *Studio*, label something like *Show practice and progress* — and
have the panels honour it. It is cheap now and expensive to retrofit once four more features assume the
layer is always visible.

---

## Non-goals

Named so they do not creep in:

- **No accounts, no server, no leaderboards, no sharing.** All of those need a backend, and the app's
  central promise is that a designer's work never leaves their machine.
- **No notifications or reminders.** Nothing here should manufacture an obligation to open the app.
  What Stitch Math can honestly offer daily is practice worth doing; a nag is a different product.
- **No streak-loss penalties beyond the reset.** No lost points, no lost rank.
- **No generated practice rows.** See §1.

## Build order

1. Commit the in-flight refactor.
2. §4 streak forgiveness — smallest, self-contained, and it makes the rest safe to test against.
3. §2 the cabinet — the data already exists; this is mostly rendering.
4. §1 Daily Practice — the largest piece and the reason for the block.
5. §3 lesson badges.
6. §5 decisions, then whichever of them you choose.

Run `npm test` after each. The suite is 107 cases and a few thousand assertions; it runs in under a
minute and it is the only thing standing between a refactor and a silent regression.
