# Studio workflow for a human + AI team

## People and responsibilities
Creative Director/Producer: owner. Original concept co-creator: owner's child. Game design/architecture planning and QA: ChatGPT. Coding, test execution and PRs: Cloud Codex. Final acceptance & publishing: owner.

## Before code
Keep Vision/GDD/Art Bible, Decision Log, Economy, Architecture, P0 Audit and Roadmap updated. Small tasks with a clear Definition of Done; avoid unbounded mega-prompts.

## Each implementation cycle
1. Read latest decisions and select one milestone.
2. Create feature branch and pre-change checkpoint; do not overwrite stable code.
3. Make focused, reversible code changes. Keep no more than necessary parallel tasks.
4. Execute static/automated tests and report outputs faithfully.
5. Capture real desktop/phone-size screenshots; request human playability/visual judgement.
6. Fix regressions; put work in PR, merge only after review.
7. Tag approved version and deploy **only** after explicit project/lot approval.

## Release safety
Maintain separate dev and stable branches where useful; P0 staging lot distinct from production. P0 updates must never disconnect players or corrupt saves; test schema migrations/backups before live changes. No secret keys in repo, PR descriptions, screenshots or chat transcripts.

## Definition of Done example
For procedural planets: same seed reproduces class/resources/visuals; price stays within proposed 2–20 ATT (except free starter); all 3 reference classes distinct; geometry works in realistic browser runtime; mobile fallbacks; screenshots reviewed.
