# ClaimGate judges-first three-minute demo script

This is the deterministic offline story for `pnpm demo` and the Vite example app, plus the real local LLM story for `pnpm demo:ai:gemma` on the RTX 4090 node. The framework remains fixture-first and candidate-only: no hosted LLM, no OCR/parser dependency, and no AI truth judgment.

## Setup / smoke commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm demo
pnpm test:e2e
```

## Video preflight command

Run the recording preflight before capturing the final video:

```bash
pnpm test:video-preflight
```

This validates that the video-facing docs require the real RTX 4090 Local Gemma/Ollama path, preserve `aiAuthority=candidate-only`, and keep actual video evidence pending until a human records it.

## Local Gemma + RAG candidate extraction demo command

For the submission video, record the actual local LLM path on the RTX 4090 node. It uses a local Ollama-compatible Gemma 4 12B model to propose candidates, then ClaimGate performs source anchoring, deterministic risk, reviewer correction, Evidence Pack, report, and graph projection. The RAG context is ClaimGate's MOFA ODA offline fixture corpus retrieved through a repo-local persistent sparse-vector index, not an external vector DB or live public-data call.

```bash
# Real local LLM path for recording. Keep model files and runtime outside git.
# Default endpoint: http://127.0.0.1:11434
CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b pnpm demo:ai:gemma

# If needed:
OLLAMA_BASE_URL=http://127.0.0.1:11434 CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b pnpm demo:ai:gemma
```

The local Gemma extraction path keeps the ClaimGate boundary: Gemma can propose `CandidateClaim[]` only. RAG retrieval supplies source context, but source anchoring, risk classification, reviewer decision, Evidence Pack, report, and graph projection remain ClaimGate/human-controlled. The repository now contains a candidate-only tuning dataset generator, strict RTX 4090/free-VRAM/Python-dependency preflight, and optional LoRA training entrypoint. A local candidate-only smoke/prototype LoRA adapter has been generated for pipeline proof; it is not a production-quality tuned checkpoint and should not be described as accuracy-tuned.

Optional screenshot evidence for the React walkthrough:

```bash
pnpm --filter @claimgate/example-civic-review-app build
pnpm --filter @claimgate/example-civic-review-app dev -- --host 127.0.0.1
# capture examples/civic-review-app at the printed local URL
```

Capture the terminal output from `pnpm demo` as smoke evidence. It runs civic, health, and MOFA ODA packs through the same core/UI contract. The expected civic story includes:

- `Story: Wrong AI claim → risk queue → reviewer correction → Evidence Pack`
- `AI boundary: AI proposed the candidate; deterministic rules and a reviewer made the decision.`
- `Evidence Pack items: 1`
- `Graph nodes: 3, edges: 2`
- `Three-pack swap demo changed behavior without core/UI changes.`

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

### 2:40–3:00 — Three-pack swap proves reuse and explainability

Switch to the Health Data Pack. The same core and UI now tell a different domain story: a stale-period yellow queue becomes reviewer-verified evidence. The output changes because the pack changed, not because the core or UI hid domain judgment.

Expected health evidence:

- Pack: Health Data Pack
- Risk: `yellow -> needs-evidence`
- Reviewer decision: `verified`
- Report: `Health Statistic Review Summary`

Switch once more to the MOFA ODA Public Data Pack. This story uses the offline `외교부_국가별 안전정보` fixture: an AI safety/stability statement conflicts with the anchored warning, the deterministic `mofa.country-safety-mismatch` trace sends it to red/conflict review, and a human correction becomes the only projectable evidence.

Expected MOFA ODA evidence:

- Pack: `MOFA ODA Public Data Pack`
- Fixture: `mofa-country-safety-mismatch`
- Source Anchor: `mofa-country-safety-information:dataset:...`
- Rule trace: `mofa.country-safety-mismatch => red/conflict`
- Reviewer decision: `corrected`
- Evidence Pack items: `1`
- Report: `MOFA ODA Claim Review Summary`
- Graph: downstream projection of the reviewed Evidence Pack only

The public-data URL is provenance metadata. The demo never calls the live OpenAPI; it evaluates a deterministic fixture bundled in `@claimgate/pack-mofa-oda`.

Close with:

“ClaimGate reduces fake work by making the review path visible: candidate, anchor, deterministic rule trace, reviewer decision, Evidence Pack, report, graph. The demo is deterministic and offline, so judges can rerun it and get the same story.”

## Do-not-say boundaries

- Do not say ClaimGate’s AI verifies truth.
- Do not say the graph proves correctness by itself.
- Do not imply hosted LLM extraction, external vector DB retrieval, production-quality tuned model artifacts, OCR, server, database, auth, or online evidence exists in v0. If `pnpm tune:preflight` fails, say tuning is prepared but blocked; if only the smoke/prototype adapter exists, say pipeline proof, not quality tuning. If `pnpm tune:infer:prototype` reports `BOUNDARY_PASS_SERVING_BLOCKED`, say the adapter passes first-JSON candidate-boundary eval through a safe postprocessor, but raw strict JSON serving is not fixed and the adapter is not production-quality.
- Do not imply the MOFA/KOICA public-data URLs are fetched live or that fixture behavior proves production accuracy.
- Do not skip the reviewer decision; terminal decisions require a reviewer.

## Acceptance checklist

- [x] Wrong civic claim flows through Risk Queue, correction, Evidence Pack, Report, and Graph.
- [x] Pack swap changes behavior and report copy.
- [x] Civic, health, and MOFA ODA packs all run through the same core/UI contract.
- [x] MOFA ODA output names Source Anchor, deterministic rule trace, reviewer decision, Evidence Pack, report, and graph.
- [x] AI boundary is explicit: curator only, never judge.
- [x] `pnpm test:video-preflight` validates the recording contract.
- [x] `pnpm demo:ai:gemma` has been run on the RTX 4090 node as preflight evidence; final video capture remains pending.
- [x] `pnpm demo` remains the deterministic pack-swap smoke.
- [x] Screenshot/smoke evidence path is documented.
