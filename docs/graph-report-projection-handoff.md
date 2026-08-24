# Graph/Report Projection Handoff Readiness

ClaimGate handoff output is ordered deliberately:

1. **Evidence Pack JSON is primary.** It contains only reviewer-audited `verified` and `corrected` claims with Source Anchors.
2. **Report Markdown/HTML is an auxiliary projection** generated from the Evidence Pack for humans.
3. **Graph JSON/UI is an auxiliary projection** generated from the Evidence Pack for navigation. It is not a graph database and does not add authority.

## Projection boundary

- Non-projectable states (`extracted`, `anchored`, `needs-evidence`, `conflict`, `aggregate-only`, `rejected`) must not appear in Evidence Pack, Report, or Graph output.
- AI extraction output is candidate material only. It never verifies, corrects, scores risk, or projects claims.
- Reviewer terminal decisions and Source Anchors remain the projection gate.

## Smoke evidence

Run the handoff smoke after build:

```bash
pnpm test:handoff
```

The smoke constructs one reviewer-verified claim and one reviewer-rejected claim, then checks:

- Evidence Pack JSON includes the verified claim and excludes the rejected claim.
- Report Markdown/HTML self-identify `Projection source: Evidence Pack` and `Projection boundary: verified/corrected reviewer decisions only`.
- Graph projection is rooted at the Evidence Pack node and excludes the rejected claim.
- UI handoff components render read-only report/graph projections without hidden authority.

## v0 no-go reminders

- No graph DB, server, auth, multitenancy, OCR, hosted LLM, LLM-as-judge, or online/non-deterministic handoff. The local Gemma path is candidate extraction only.
- Graph remains auxiliary; Evidence Pack remains the reusable artifact.
