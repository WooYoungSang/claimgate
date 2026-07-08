# ClaimGate judges-first three-minute demo script

This is the deterministic offline story for `pnpm demo` and the Vite example app. It is intentionally fixture-first: no network, no real LLM extraction, no OCR/parser dependency, and no AI truth judgment.

## Setup / smoke commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm demo
pnpm test:e2e
```

Optional screenshot evidence for the React walkthrough:

```bash
pnpm --filter @claimgate/example-civic-review-app build
pnpm --filter @claimgate/example-civic-review-app dev -- --host 127.0.0.1
# capture examples/civic-review-app at the printed local URL
```

Capture the terminal output from `pnpm demo` as smoke evidence. The expected civic story includes:

- `Story: Wrong AI claim → risk queue → reviewer correction → Evidence Pack`
- `AI boundary: AI proposed the candidate; deterministic rules and a reviewer made the decision.`
- `Evidence Pack items: 1`
- `Graph nodes: 3, edges: 2`
- `Pack swap demo changed behavior without core/UI changes.`

## Three-minute talk track

### 0:00–0:25 — Problem: judges need proof, not architecture

“ClaimGate is for risky public-data AI outputs. The AI can produce a polished claim, but a judge or reviewer needs to know: where did this claim come from, what source anchors it, what deterministic rule flagged it, and what exactly becomes reusable evidence?”

Show the hero line in the app or terminal:

> Wrong AI claim → risk queue → reviewer correction → Evidence Pack

### 0:25–0:55 — AI curator, not judge

“Here the AI is only a curator. It proposes a candidate claim from an offline fixture. It does not score risk, verify truth, or project a report. ClaimGate records that boundary explicitly.”

Point to the output line:

> AI proposed the candidate; deterministic rules and a reviewer made the decision.

### 0:55–1:35 — Source anchor and deterministic risk trace

Use the civic pack first. The fixture says the parks budget is 12 million USD, but the source row says 10. The source anchor is a deterministic dataset-row reference, and the domain rule emits a red `conflict` trace.

Evidence to call out:

- Pack: Civic Data Pack
- Fixture: `civic-budget-mismatch`
- Source Anchor: `civic-budget-fy2026:dataset:name=civic-budget-fy2026:row=4:column=amount_usd_m`
- Risk: `red -> conflict`

### 1:35–2:10 — Reviewer correction creates the Evidence Pack

“The reviewer corrects the AI value to the source value. Only then does ClaimGate create an Evidence Pack item. This is the important invariant: the reusable output is not the AI answer; it is the reviewed, anchored evidence.”

Expected output:

- Reviewer decision: `corrected`
- Corrected/source value: `10`
- Evidence Pack items: `1`
- Report: `Civic Budget Review Summary`
- Graph nodes/edges: `3 / 2`

### 2:10–2:40 — Projection is verified/corrected-only

“The graph and report are downstream projections of the Evidence Pack. They do not contain extracted-only, rejected, or unanchored claims. This protects judges from a pretty graph built on unreviewed AI text.”

Tie back to invariants:

- No Anchor, No Claim
- Evidence Pack First
- Verified/corrected-only projection

### 2:40–3:00 — Pack swap proves reuse and explainability

Switch to the Health Data Pack. The same core and UI now tell a different domain story: a stale-period yellow queue becomes reviewer-verified evidence. The output changes because the pack changed, not because the core or UI hid domain judgment.

Expected health evidence:

- Pack: Health Data Pack
- Risk: `yellow -> needs-evidence`
- Reviewer decision: `verified`
- Report: `Health Statistic Review Summary`

Close with:

“ClaimGate reduces fake work by making the review path visible: candidate, anchor, deterministic rule trace, reviewer decision, Evidence Pack, report, graph. The demo is deterministic and offline, so judges can rerun it and get the same story.”

## Do-not-say boundaries

- Do not say ClaimGate’s AI verifies truth.
- Do not say the graph proves correctness by itself.
- Do not imply real LLM extraction, OCR, server, database, auth, or online evidence exists in v0.
- Do not skip the reviewer decision; terminal decisions require a reviewer.

## Acceptance checklist

- [x] Wrong civic claim flows through Risk Queue, correction, Evidence Pack, Report, and Graph.
- [x] Pack swap changes behavior and report copy.
- [x] AI boundary is explicit: curator only, never judge.
- [x] Demo commands are offline and deterministic.
- [x] Screenshot/smoke evidence path is documented.
