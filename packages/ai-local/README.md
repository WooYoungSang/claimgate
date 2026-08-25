# @claimgate/ai-local

Local candidate-only AI adapters for ClaimGate.

This package owns the optional RTX 4090 Local Gemma/Ollama demo boundary outside `@claimgate/core`. It provides:

- `createOllamaGemmaClaimExtractor` — an Ollama-compatible `ClaimExtractor` that returns `CandidateClaim[]` only.
- `retrieveLexicalRagContext` — compatibility lexical retrieval helper.
- `buildPersistentRagIndex` / `searchPersistentRagIndex` — repo-local persistent sparse-vector RAG over offline fixture corpora.
- `buildGemmaTuningJsonl` / `assertGemmaTuningJsonlCandidateOnly` — candidate-only Gemma tuning dataset helpers.
- `assessRagGrounding` / `assertRagGroundingForExtraction` — explicit no-hit/conflict policy gates.
- `createNoHitNeedsEvidenceCandidate` — optional extracted candidate for no-hit workflows without fabricated anchors.
- `retainRagConflictCandidate` — keeps conflict candidates as extracted input for deterministic risk/reviewer workflow.
- local endpoint/model tag guards that reject hosted URLs and URL-like model names.
- provenance constants for RAG mode and tuning artifact status.

Authority boundary:

- AI may propose candidate claims.
- AI must not verify truth, score risk, attach final Source Anchors, make reviewer decisions, or project Evidence Packs/reports/graphs.
- RAG no-hit must not be treated as evidence; it either fails extraction or becomes an extracted needs-evidence candidate without a proposed anchor.
- RAG conflict remains candidate input and is not a truth decision.

This is not an external vector DB or hosted retrieval package. Fine-tuned weights remain local and uncommitted; the repository commits only reproducible dataset, training-report, and bounded evaluation evidence.

The current candidate-only LoRA uses six fixture-derived training records and a non-overlapping three-record holdout. A 60-step RTX 4090 QLoRA run with response-only loss and EOS-terminated completions records `BOUNDARY_PASS_SERVING_READY`: strict JSON 3/3, candidate-only 3/3, exact fixture text 3/3, and zero authority violations. This is a bounded fixture-holdout result, not production extraction accuracy.

With the local adapter present, run the full candidate → deterministic risk → reviewer → Evidence Pack demo through the adapter:

```bash
CLAIMGATE_GEMMA_LORA_ADAPTER=artifacts/local-ai/gemma-candidate-lora-serving-ready pnpm demo:ai:gemma
```
