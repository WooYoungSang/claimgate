# ClaimGate Submission Language Kit

This kit keeps README, report, and video wording aligned with implemented ClaimGate v0 behavior. It is intentionally conservative: submission language must stay below implementation truth.

## Short pitch

ClaimGate is an offline, deterministic framework for reviewing risky public-data AI output. It converts AI-produced candidate claims into source-grounded reviewer work, then ships an auditable Evidence Pack containing only verified or corrected claims.

## 30-second demo narration

"The AI output starts as candidates, not truth. ClaimGate asks: where is the original source anchor, what deterministic rule trace explains the risk, and what did the reviewer decide? Unsupported or conflicting claims stay out of the Evidence Pack. Verified and corrected claims become reusable evidence that can also project into a report or graph."

## 3-minute video spine

1. **Problem** — public-data AI demos can look confident while hiding source gaps, value mismatches, or stale evidence.
2. **Boundary** — ClaimGate is offline and deterministic in v0; AI proposes candidates; reviewers decide.
3. **Workflow** — source anchors, deterministic risk trace, reviewer correction, Evidence Pack projection.
4. **Differentiation** — Evidence Pack is the primary artifact; graph/report/trust signals are projections or context.
5. **Honest scope** — no real LLM extraction, OCR, server, DB, auth, multitenancy, graph DB, or real DID wallet in v0.

## Forbidden phrases and replacements

| Do not say | Why it is unsafe | say this instead |
|---|---|---|
| AI verifies claims | Grants AI hidden truth authority. | AI proposes candidates; reviewers decide. |
| AI judges truth | Confuses candidate extraction with reviewer authority. | Deterministic rules surface risk; human reviewers verify, correct, or reject. |
| AI scores final risk | Risk is deterministic and traceable, not AI-scored. | Deterministic rules assign risk levels with rule traces. |
| trust score decides truth | Trust context cannot replace source evidence. | Trust signals provide context; Source Anchors and reviewer decisions remain authoritative. |
| graph is the source of truth | Graph is a projection, not primary evidence. | Evidence Pack is the primary artifact; graph/report views project from it. |
| fully automated fact checking | Overclaims v0 and hides reviewer work. | Offline, deterministic v0 reduces review work without removing reviewer authority. |
| validates any document | Implies OCR/general parser scope. | Fixture-first v0 supports simple offline public-data fixtures. |
| DID verified the claim | Real DID verifier/wallet is out of scope and non-authoritative. | Mock trust signal attached; it does not replace anchors or reviewer decisions. |

## Report-ready language

- **No Anchor, No Claim** — a claim cannot be accepted unless it points to original source evidence.
- **AI Curator, Not Judge** — candidate extraction is useful, but it carries zero final authority.
- **Risk-first Review** — deterministic traces focus reviewer attention on red/yellow issues while sampling green items.
- **Evidence Pack First** — the reusable result is the Evidence Pack; report and graph surfaces are downstream projections.
- **Fake Work Reduced** — the metric is net review effort after sampling, not a promise of hands-free truth.

## Anti-positioning

ClaimGate should be positioned against hidden-authority AI systems, not as one of them. Do not compete on "more autonomous AI judgment." Compete on inspectable source anchors, deterministic rule traces, explicit reviewer authority, and projection eligibility guards.

## Scope statement

ClaimGate v0 is an offline, deterministic v0 framework. It excludes real LLM extraction, OCR, general-purpose PDF/Excel parsing, server, database, authentication, multitenancy, online demos, graph database deployment, and real DID wallet/issuer/verifier integration.
