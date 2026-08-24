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

This is not an external vector DB or hosted retrieval package. It can create a candidate-only tuning dataset and run a strict training preflight, but it contains no committed production fine-tuned model artifact. The optional training script can generate a local ignored smoke/prototype adapter that must be recorded separately.

Prototype LoRA inference status: `pnpm tune:infer:prototype` currently records `BOUNDARY_PASS_SERVING_BLOCKED` for raw strict JSON on the 20-step adapter. First-JSON candidate extraction passes on 3/3 tiny local examples and the TypeScript adapter now validates/consumes only that first candidate JSON object; raw strict JSON serving remains blocked, and the adapter is not production-quality.
