# ClaimGate Competition Submission Appendix

_Last checked: 2026-07-08 KST. This appendix maps benchmark findings to submission evidence. It is a report appendix draft, not a shipped/ratified claim._

## Submission thesis

ClaimGate is an offline deterministic framework for reviewing public-data claims that originate from AI output. It does not ask judges to trust an AI model. It shows a safer handoff:

1. AI proposes candidate claims only.
2. Source Anchors are required before acceptance.
3. Deterministic rule traces classify review risk.
4. Human reviewers make terminal decisions.
5. Evidence Packs, reports, and graphs project only verified/corrected claims.

## Judging evidence map

| Judging surface | ClaimGate evidence | Verification command / artifact |
|---|---|---|
| Written report | Differentiation matrix and five-sentence thesis. | `docs/benchmark-differentiation.md` |
| Source code | Core trust invariants, DomainPack conformance, UI controlled components. | `pnpm lint`, `pnpm typecheck`, `pnpm test` |
| Demo video | One intentionally wrong AI claim goes through risk queue, reviewer correction, Evidence Pack, and report/graph projection. | `pnpm demo`, `pnpm test:e2e` |
| Function test | Offline deterministic tests and conformance for two packs. | `pnpm test/conformance` |
| License check | MIT license and no server/DB/auth/network dependency in v0 demo. | `LICENSE`, `pnpm lint` boundary check |

## Demo narrative draft

1. Start with an AI-produced public-data claim that looks plausible but has a source-value mismatch.
2. Show the AI boundary: the candidate is `extracted`; it has no authority to verify itself.
3. Attach/check a Source Anchor and run deterministic risk rules.
4. Show the red/yellow/green queue and rule trace.
5. Apply a reviewer correction.
6. Project only the verified/corrected claims into the Evidence Pack and report/graph outputs.
7. Swap DomainPack fixtures to prove the same core framework handles another domain without core/UI edits.

## Anti-overclaim copy rules

Use:

- "source-grounded review framework"
- "deterministic risk trace"
- "reviewer-terminal workflow"
- "AI candidate curator"
- "Evidence Pack projection"

Avoid:

- "automated truth"
- "AI fact-checker replaces reviewers"
- "guaranteed hallucination-free"
- "better than Ragas/TruLens/Loki/AutoRAG"
- "graph proves the claim"

## Backlog from benchmark matrix

| Backlog item | Source insight | Done when |
|---|---|---|
| README benchmark paragraph | Prior winners communicate product value quickly. | README links `docs/benchmark-differentiation.md` after README lease is available. |
| 3-minute demo script | Judges need quick proof of value. | Demo script covers AI candidate, anchor, risk trace, reviewer, Evidence Pack. |
| Report appendix | Written evaluation needs source-backed differentiation. | This appendix plus benchmark matrix are included in the development report. |
| Conformance evidence callout | Reusability needs mechanical proof. | Report includes `pnpm test/conformance` and pack-swap evidence. |
| Graph/report boundary warning | GraphRAG adjacency can blur authority. | Submission copy says graph/report are projections, not truth sources. |
