# ClaimGate Product Manifesto

ClaimGate is not a fact-checking oracle. It is an offline, deterministic review framework that turns risky public-data AI output into source-grounded reviewer work and reusable Evidence Packs.

The product promise is deliberately narrow: ClaimGate reduces fake work by forcing every accepted claim through visible anchors, rule traces, reviewer decisions, and projection guards. It does not give AI hidden authority.

## Manifesto in one paragraph

ClaimGate helps reviewers catch the claims that matter, attach the original source evidence, correct or reject unsupported output, and ship an Evidence Pack that another team can audit. AI may curate candidates, but deterministic rules and human reviewers decide what can be trusted. If a claim has no anchor, it cannot become a claim we stand behind.

## Product invariants

### No Anchor, No Claim

A claim without a Source Anchor cannot become `verified` or `corrected`. The reviewer workflow starts from source-grounded evidence, not from AI confidence.

- Code: `packages/core/src/verification.ts`, `packages/core/src/source-anchor.ts`
- Tests: `packages/core/test/verification-state-machine.test.ts`, `packages/core/test/source-anchor.test.ts`
- Demo behavior: unanchored extracted claims stay in non-terminal review states until a source anchor is attached.

### AI Curator, Not Judge

AI output is candidate input only. It can propose claim text, values, and possible anchors; it cannot attach authority, verify truth, score final risk, or project claims.

- Code: `packages/core/src/extraction.ts`
- Tests: `packages/core/test/extraction.test.ts`
- Demo behavior: fixture extraction returns `state: "extracted"` candidates only, with proposed anchors separated from attached anchors.

### Risk-first Review

ClaimGate queues red/yellow/green/aggregate-only review work from deterministic rules and non-empty rule traces. Green sampling remains part of the workflow so low-risk claims do not become an unchecked blind spot.

- Code: `packages/core/src/domain-pack.ts`, `packs/civic-data/src/index.ts`, `packs/health-data/src/index.ts`
- Tests: `packages/core/test/domain-pack.test.ts`, `packages/conformance/test/conformance.test.ts`
- Demo behavior: pack fixtures produce deterministic risk levels and traces before reviewer terminal decisions.

### Evidence Pack First

The Evidence Pack is the primary artifact. Reports and graphs are projections from verified/corrected evidence, not replacement sources of truth.

- Code: `packages/core/src/evidence.ts`, `packages/core/src/projection-guards.ts`
- Tests: `packages/core/test/evidence-pack.test.ts`, `packages/core/test/projection-guards.test.ts`, `packages/ui/test/impact-projection.test.ts`
- Demo behavior: only `verified` and `corrected` claims enter Evidence Pack, report, or graph projection output.

### Fake Work Reduced

ClaimGate is valuable when it lowers net reviewer cost after sampling cost, not when it merely generates a larger dashboard. The metric must stay operational and conservative.

- Code: `packages/ui/src/FakeWorkReductionStats.ts`
- Tests: `packages/ui/test/ui-boundary.test.ts`
- Demo behavior: review statistics present savings as an estimate after queueing and sampling, not as an automated truth guarantee.

## Anti-positioning

ClaimGate is not:

- an AI judge;
- a trust-score oracle;
- a graph database product;
- a general PDF/OCR/parser pipeline;
- a server, auth, or multi-tenant workflow;
- a real DID wallet, issuer, or verifier.

ClaimGate is:

- a deterministic review workflow for public-data AI outputs;
- a source-anchor and evidence-pack contract;
- a reusable domain-pack boundary;
- an offline demoable framework that keeps reviewer authority explicit.

## Invariant-to-test map

| Slogan | Implementation truth | Regression evidence |
|---|---|---|
| No Anchor, No Claim | Terminal review states require an attached Source Anchor and reviewer audit. | `packages/core/test/verification-state-machine.test.ts`; `packages/core/test/source-anchor.test.ts` |
| AI Curator, Not Judge | Extraction fixtures create candidate claims only and reject authority-smuggling fields. | `packages/core/test/extraction.test.ts` |
| Risk-first Review | DomainPack rules return deterministic levels and rule traces before review. | `packages/core/test/domain-pack.test.ts`; `packages/conformance/test/conformance.test.ts` |
| Evidence Pack First | Projection includes only verified/corrected claims and serializes deterministic Evidence Packs. | `packages/core/test/evidence-pack.test.ts`; `packages/core/test/projection-guards.test.ts` |
| Fake Work Reduced | UI reports review-cost reduction after sampling cost, as an estimate. | `packages/ui/src/FakeWorkReductionStats.ts`; `packages/ui/test/ui-boundary.test.ts` |

## Submission-safe product language

Use these claims in README, report, and video surfaces:

- "ClaimGate turns risky AI-produced public-data claims into source-grounded reviewer work."
- "AI proposes candidates; reviewers decide."
- "Every accepted claim traces to a Source Anchor and an auditable Evidence Pack."
- "Risk-first queues focus review effort while green sampling protects against false negatives."
- "Trust signals and graphs are context/projections; they do not replace anchors, deterministic rules, or reviewer decisions."
