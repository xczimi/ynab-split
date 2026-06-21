# Funded Groups build — `/goal` orchestration prompt

The Funded Groups settlement view (already designed in
[`docs/funded-groups.md`](../../docs/funded-groups.md) via `/grill-me`), built as
a sequential pipeline by a team-leader loop. Paste the block below after `/goal`
to start the autonomous loop. The loop **stops for your final review** before
anything lands on `main` (pushing `main` auto-deploys).

## Layers (one branch — built in dependency order, each gates the next)

| Layer | Depends on | Scope | Main files |
|---|---|---|---|
| `settlement-engine` | — | per-transaction `settled` flag via oldest-first transfer-clearing watermark | `src/utils/designations/settlement.js` (+ tests) |
| `grouping` | engine | partition `settled` txns into trips + non-trip quarters; aggregate group net + status | new module under `src/utils/designations/` (+ tests) |
| `grouped-view` | grouping | replace the single Owes/Owed presentation with the grouped view | new component(s) + `App.vue` / `Budget.vue` wiring |

This is a **pipeline, not parallel clusters**: layer 2 needs 1, layer 3 needs 2.
`App.vue` is the integration seam (central state hub) — the view layer wires
through it last. The source of intent for every layer is `docs/funded-groups.md`.

---

## The `/goal` prompt

```
/goal Act as TEAM LEADER orchestrating the Funded Groups settlement view as a
sequential build pipeline. The design is ALREADY settled — docs/funded-groups.md
is the source of intent (reached via /grill-me). Stay coherent with this repo's
prior feature cycles by leaning on the superpowers plugin skills at every phase;
do not freelance a bespoke process.

PIPELINE (one branch, built in DEPENDENCY ORDER — each layer gates the next):
  1. settlement-engine — per-transaction `settled` flag via cumulative,
     oldest-first transfer clearing on the flat timeline.
     Files: src/utils/designations/settlement.js (+ tests).
  2. grouping — partition `settled`-flagged txns into trips + non-trip calendar
     quarters; aggregate to per-group net + settled/partial/open.
     Files: new module under src/utils/designations/ (e.g. groups.js) (+ tests).
  3. grouped-view — replace the single Owes/Owed presentation with the grouped
     view. Files: new component(s) + App.vue / Budget.vue wiring.
  Build them SEQUENTIALLY (2 needs 1, 3 needs 2). Use
  superpowers:dispatching-parallel-agents ONLY for genuinely independent
  sub-work inside a layer (e.g. a pure helper alongside its own test).

PHASE 0 — LOCK THE DESIGN (mostly done — do NOT re-brainstorm):
  - The design is settled in docs/funded-groups.md. Do not re-open settled
    decisions. Two open flags remain in §8.
  - FIRST coding act is a SPIKE: compute the oldest-first watermark over the
    161-transaction fixture (test/fixtures/sample-transactions.json) and eyeball
    which transactions/groups it marks settled. If the bidirectional / never-zero
    data reveals a genuine fork, run /grill-me to resolve it with ME before
    building further. Otherwise proceed.
  - Use superpowers:writing-plans to turn docs/funded-groups.md §6 into one
    implementation plan spanning all three layers.

PHASE 1 — BUILD THE PIPELINE:
  - superpowers:using-git-worktrees: build on an isolated worktree off ONE branch
    feature/funded-groups (a pipeline, not parallel clusters).
  - Drive execution with superpowers:subagent-driven-development /
    executing-plans — one focused agent per layer, in dependency order.
  - Every layer uses superpowers:test-driven-development (red-green-refactor)
    against the real fixture, and superpowers:systematic-debugging on any failure.
  - Per-layer bar: `npm run check` green (Jest + build); coverage stays at/above
    80% statements/functions/lines and 65% branches (`npm test -- --coverage`);
    immutable updates only (never mutate); America/Vancouver via Luxon; amounts in
    milliunits; NO console.log; many small files.
  - VERIFICATION IS LEAN BY HOUSE PREFERENCE: prove engine/grouping correctness
    with Jest integration tests over the fixture; for the view, bring it up with
    `npm start` (localhost:8080) and inspect via window.ynabDebug. Do NOT add
    Playwright/CDP/headless-browser tooling. Verify the rendered view visually,
    not just green checks.
  - Close each layer with superpowers:requesting-code-review +
    verification-before-completion before calling it done.

PHASE 2 — INTEGRATE & READY FOR REVIEW (the deliverable):
  - It is one branch, so "integration" is the green tip of feature/funded-groups
    with all three layers landed. Re-verify the WHOLE branch: `npm run check` +
    coverage, then a manual pass through the grouped view in `npm start`.
  - Reconciliation check: the grouped view's open-tail total MUST agree with the
    existing budget-card Owes/Owed number. If they disagree, that's a bug — debug
    before declaring done.
  - Use superpowers:finishing-a-development-branch to tee up the hand-back.

COMPLETION BAR — stop here, hand back to me:
  DONE when feature/funded-groups has all three layers, is verified green as a
  whole (check + coverage), and the grouped view is clickable locally via
  `npm start`. Then STOP and surface the branch + a per-layer summary for my
  FINAL REVIEW. Do NOT push to main — pushing main auto-deploys via GitHub
  Actions. Do NOT merge. Those are my calls after review.

Throughout: surface a question to me only when a choice is genuinely mine (the §8
open flags are the likely ones; the up-front spike should catch them). Otherwise
keep working across turns until the completion bar is met.
```

---

## Notes

- **Why one branch, not parallel clusters:** the feature is a dependency pipeline
  (engine → grouping → view); parallel worktrees would just block on each other.
  The agentic value here is sequential subagent-driven execution with a
  code-review + verification gate *per layer*, not fan-out.
- **Lean verification:** this repo prefers minimal tooling — `window.ynabDebug`
  exports and Jest fixtures over Playwright/CDP. The prompt forbids heavyweight
  browser automation on purpose.
- **Design already done:** `docs/funded-groups.md` is the settled intent, so
  PHASE 0 is a fixture spike (to validate the bidirectional/never-zero edge in
  §8), not a fresh brainstorm. `/grill-me` only re-engages if the data forks.
- **Safety:** deployment is automatic on push to `main`, so the loop never pushes
  `main` on its own — it stops at a verified `feature/funded-groups` branch seeded
  locally for review, and merge/deploy stay your calls.
