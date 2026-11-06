# Expand the rescue game — 100 passes

## Objective and role
Implement 100 distinct, verified improvements to the existing dependency-free
browser game, with more puzzles, skills, action, music, effects, and play controls.
Own implementation and verification in this checkout. Preserve the original eight
levels and walker toy. The user explicitly authorizes pushing to main and deploying.

## Context and approach
Codebase-memory indexed the repository and identified Game as the simulation owner,
Renderer as the Canvas owner, and game.js as input/menu/persistence orchestration.
Keep that division. Add procedural Web Audio rather than downloaded music assets.
Extend the authored campaign rather than substitute random, unverified levels.
No new runtime dependencies. Existing Pages publishes main at the repository root.

## Acceptance criteria
- 100 numbered implementation passes, with actual changed-source fingerprints and
  executed verification in iterations.jsonl; reruns alone do not count.
- At least 24 solvable levels and 16 usable skills, preserving the original eight.
- New interactive puzzles, original music, distinct effects, and accessible controls.
- Automated complete level solutions and mechanic regression tests remain green.
- Render and exercise desktop and narrow layouts; inspect screenshots and a clip.
- Publish verified batches to main throughout; verify final CI and Pages delivery.

## Loop
Observe current state and relevant source; orient against the contracts; select
one concrete improvement; implement it; run tests; diagnose failures without
weakening expectations; record the outcome and learning; continue until 100 passes.
Failed checks must be fixed before recording a pass or publishing. Use graph tools
first for unfamiliar code exploration, and read every file before editing it.
Record compact generated state after each pass. No separate reviewer or scribe is
needed: capture relevant lessons in the record and regression tests here.

## Completion
Stop only after the 100 passes, final combined verification, and confirmed delivery,
or a genuine external blocker. Never call an unverified or unpublished change live.
Report the expanded game, count, evidence, live link, and material limitations.
