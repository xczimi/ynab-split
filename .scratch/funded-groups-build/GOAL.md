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
sequential build pipeline. The design is settled — docs/funded-groups.md is the
source of intent (via /grill-me). Lean on the superpowers plugin skills at every
phase; do not freelance a bespoke process.

PIPELINE (one branch feature/funded-groups, in DEPENDENCY ORDER — each gates the next):
  1. settlement-engine — per-txn `settled` flag via cumulative, oldest-first
     transfer clearing on the flat timeline. Files: src/utils/designations/settlement.js (+ tests).
  2. grouping — partition `settled` txns into trips + non-trip calendar quarters;
     aggregate to per-group net + settled/partial/open. Files: new module under
     src/utils/designations/ (e.g. groups.js) (+ tests).
  3. grouped-view — replace the single Owes/Owed presentation with the grouped
     view. Files: new component(s) + App.vue / Budget.vue wiring.
  Build SEQUENTIALLY (2 needs 1, 3 needs 2). Use
  superpowers:dispatching-parallel-agents ONLY for genuinely independent sub-work
  inside a layer (e.g. a pure helper alongside its own test).

PHASE 0 — LOCK THE DESIGN (do NOT re-brainstorm):
  - Design is settled in docs/funded-groups.md. Don't re-open it. Two open flags
    remain in §8.
  - FIRST coding act is a SPIKE: compute the oldest-first watermark over the
    161-txn fixture (test/fixtures/sample-transactions.json) and eyeball which
    txns/groups it marks settled. If the bidirectional / never-zero data reveals a
    genuine fork, run /grill-me to resolve it with ME first. Otherwise proceed.
  - Use superpowers:writing-plans to turn docs/funded-groups.md §6 into one plan
    spanning all three layers.

PHASE 1 — BUILD THE PIPELINE:
  - superpowers:using-git-worktrees: build on an isolated worktree off ONE branch
    feature/funded-groups (a pipeline, not parallel clusters).
  - Drive execution with superpowers:subagent-driven-development /
    executing-plans — one focused agent per layer, in dependency order.
  - Every layer uses superpowers:test-driven-development (red-green-refactor)
    against the real fixture, and superpowers:systematic-debugging on any failure.
  - Per-layer bar: `npm run check` green (Jest + build); coverage stays ≥80%
    statements/functions/lines and 65% branches (`npm test -- --coverage`);
    immutable updates only; America/Vancouver via Luxon; milliunits; NO
    console.log; many small files.
  - LEAN VERIFICATION (house preference): prove engine/grouping with Jest fixture
    tests; for the view, bring it up with `npm start` (localhost:8080) and inspect
    via window.ynabDebug. Do NOT add Playwright/CDP/headless tooling. Verify the
    rendered view visually, not just green checks.
  - Close each layer with superpowers:requesting-code-review +
    verification-before-completion.

PHASE 2 — INTEGRATE & READY FOR REVIEW (the deliverable):
  - One branch, so "integration" is the green tip of feature/funded-groups with
    all three layers landed. Re-verify the WHOLE branch: `npm run check` +
    coverage, then a manual pass through the grouped view in `npm start`.
  - Reconciliation: the grouped view's open-tail total MUST agree with the
    budget-card Owes/Owed number. If they disagree, it's a bug — debug first.
  - Use superpowers:finishing-a-development-branch to tee up the hand-back.

COMPLETION BAR — stop here, hand back to me:
  DONE when feature/funded-groups has all three layers, is verified green as a
  whole (check + coverage), and the grouped view is clickable via `npm start`.
  Then STOP and surface the branch + a per-layer summary for my FINAL REVIEW. Do
  NOT push to main (auto-deploys). Do NOT merge. My calls.

Throughout: surface a question only when a choice is genuinely mine (the §8 open
flags are likely; the spike should catch them). Otherwise keep working until the
completion bar is met.
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
