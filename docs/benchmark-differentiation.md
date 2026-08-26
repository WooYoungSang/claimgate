# ClaimGate Benchmark Differentiation and Award Strategy

_Last checked: 2026-07-08 KST. Scope: source-backed benchmark notes and submission action mapping for `bet-claimgate-framework--claimgate-benchmark-differentiation-and-award-strategy`._

## Positioning guardrail

ClaimGate should be presented as a **source-grounded claim review framework**, not as an automatic truth engine. The safe claim is:

> ClaimGate helps reviewers prioritize risky AI-produced public-data claims, attach source anchors, apply deterministic rule traces, and project only reviewer-verified or reviewer-corrected claims into reusable evidence artifacts.

Do **not** say:

- ClaimGate proves truth automatically.
- ClaimGate replaces fact-checkers, reviewers, or public-data domain experts.
- ClaimGate is objectively better than the benchmarked projects.
- AI output is authoritative once routed through ClaimGate.

## Source corpus

| ID | Project / source | Type | Source/date note | Relevant product signal | ClaimGate interpretation |
|---|---|---|---|---|---|
| S1 | 2026 Open Source Developer Contest notice | Contest target | NIPA notice, published 2026-06-15; checked 2026-07-08. URL: <https://www.nipa.kr/home/2-2/16815> | The contest evaluates written material, source code, demo video, function tests, and license checks through a 30/70 written/presentation path. | Submission materials must connect code evidence to a clear judging story, not only implementation completeness. |
| S2 | OSS Contest overview | Contest context | OSS.kr overview page; checked 2026-07-08. URL: <https://www.oss.kr/pages/2> | The contest emphasizes open-source talent, collaboration, project categories, and social-problem projects. | ClaimGate should frame public-data AI claim review as an OSS/social-problem infrastructure project. |
| S3 | AutoRAG | Prior winner / adjacent RAG tooling | OSS.kr hub says AutoRAG was a 2024 student grand-prize winner; checked 2026-07-08. URL: <https://www.oss.kr/opensource/hub/56927>. Project README: <https://github.com/Marker-Inc-Korea/AutoRAG> | Strong product narrative: automate RAG pipeline evaluation and optimization for a user's own data. | ClaimGate should not compete on RAG optimization. It differentiates by review-state authority, source anchors, deterministic risk traces, and Evidence Pack projection. |
| S4 | Hot Updater | Prior winner / OSS productization benchmark | OSS.kr hub says Hot Updater was a 2025 general grand-prize winner; checked 2026-07-08. URL: <https://www.oss.kr/opensource/hub/56946>. Project site: <https://hot-updater.dev/> | Clear install path, self-hosted positioning, docs-first product surface, and rollback/plugin story. | ClaimGate needs a similarly crisp quickstart, invariant list, and self-contained offline demo story. |
| S5 | Mincho | Prior winner / philosophy benchmark | OSS.kr hub says Mincho was a 2024 general silver-prize winner; checked 2026-07-08. URL: <https://www.oss.kr/opensource/hub/56932>. Project README: <https://github.com/mincho-js/mincho> | Strong philosophy: design-system expression and semantic hierarchy are part of the product thesis. | ClaimGate should make its philosophy explicit: AI Curator Not Judge, No Anchor No Claim, Evidence Pack First. |
| S6 | BrainTrace | Prior winner / GraphRAG benchmark | OSS.kr hub says BrainTrace was a 2025 student encouragement-prize winner; checked 2026-07-08. URL: <https://www.oss.kr/opensource/hub/56961> | Knowledge-management and GraphRAG framing can look adjacent to ClaimGate's graph/report outputs. | ClaimGate should explain that graph/report outputs are downstream projections, not the core artifact or verification authority. |
| S7 | Ragas | Adjacent RAG evaluation OSS | Ragas docs introduction; checked 2026-07-08. URL: <https://docs.ragas.io/en/stable/> | Systematic evaluation loops and metrics for LLM/RAG applications. | ClaimGate should distinguish deterministic public-claim review workflow from LLM/RAG quality metrics. |
| S8 | TruLens RAG Triad | Adjacent RAG evaluation concept | TruLens RAG Triad docs; checked 2026-07-08. URL: <https://www.trulens.org/getting_started/core_concepts/rag_triad/> | Context relevance, groundedness, and answer relevance provide a RAG correctness frame. | ClaimGate can cite groundedness as adjacent, then show stricter reviewer terminal states and source-anchor projection guards. |
| S9 | Loki | Adjacent fact-verification system | ACL Anthology COLING 2025 demo paper; checked 2026-07-08. URL: <https://aclanthology.org/2025.coling-demos.4/> | Human-centered fact verification decomposes claims, evidence retrieval, and verification assistance. | ClaimGate should acknowledge similar human-assist direction while differentiating by offline DomainPack conformance, deterministic rule trace, and verified/corrected-only Evidence Pack output. |
| S10 | DeepEval | Adjacent LLM evaluation OSS | DeepEval docs/GitHub; checked 2026-07-08. URL: <https://deepeval.com/docs/introduction> | Test-like evaluation framework for LLM applications, including RAG/agent metrics. | ClaimGate should avoid LLM-as-judge authority and highlight deterministic risk + reviewer decision requirements. |

## Benchmark comparison matrix

| Axis | AutoRAG | Hot Updater | Mincho | BrainTrace / GraphRAG | Ragas / TruLens / DeepEval | Loki / fact verification | ClaimGate v0 differentiation |
|---|---|---|---|---|---|---|---|
| Primary job | Find/optimize a RAG pipeline for a dataset. | Ship React Native OTA updates with self-hostable infrastructure. | Provide an expressive CSS-in-TypeScript system. | Manage knowledge with graph/RAG framing. | Evaluate LLM/RAG quality through metrics and traces. | Assist fact-verification workflow. | Review public-data AI claims with source anchors, deterministic risk, human terminal decisions, and Evidence Pack projection. |
| Authority model | Evaluation selects pipeline candidates. | Deployment/rollback authority is operational. | Style-system semantics are developer-controlled. | Knowledge graph helps retrieval/organization. | Metrics can score outputs; some approaches use LLM evaluators. | System assists human judgment. | AI is curator only; deterministic rules classify risk; reviewer decides terminal state. |
| Evidence anchor | Evaluation dataset/corpus. | Release/build artifacts and deployment metadata. | Design-system primitives and source code. | Knowledge graph sources. | Context/trace/evaluation datasets. | Retrieved evidence. | Source Anchor is mandatory before verified/corrected; no anchor means no accepted claim. |
| Reusable artifact | Optimized RAG pipeline/config. | OTA update framework and deployment workflow. | CSS-in-JS package. | Knowledge management app/system. | Evaluation reports/metrics. | Verification assistance output. | Evidence Pack first, then report/graph projections from verified/corrected claims only. |
| Demo expectation | Show optimization loop and measurable improvement. | Show install, deploy, rollback, plugin story. | Show concise API and philosophy. | Show knowledge graph value. | Show metrics improving eval confidence. | Show claim/evidence pipeline with human usefulness. | Show one intentionally wrong AI claim, risk queue, reviewer correction, Evidence Pack, report/graph output, and pack swap. |
| Risk if ClaimGate copies the pattern | It could sound like another RAG evaluator. | It could overfocus on packaging and miss trust invariants. | It could become manifesto-only. | It could overstate graph as truth. | It could imply metric score equals fact verification. | It could overpromise automated fact checking. | Keep the message: ClaimGate is a deterministic review framework for source-grounded claims; no automatic truth judgment. |

## Five-sentence differentiation table

| Sentence | Safe use |
|---|---|
| ClaimGate is not a RAG optimizer; it is a review framework for AI-produced public-data claims. | README positioning, report abstract. |
| AI may propose candidate claims and anchors, but it never verifies, scores final risk, or projects claims. | AI boundary section and demo narration. |
| Every accepted claim must pass through a Source Anchor, deterministic rule trace, and reviewer terminal decision. | Invariant list and judging slides. |
| The reusable output is an Evidence Pack; reports and graphs are projections from verified/corrected claims only. | Demo conclusion and architecture diagram. |
| DomainPacks prove reuse by changing domain judgment without changing core trust invariants. | OSS/reusability judging evidence. |

## Award-readiness actions

These actions are phrased as **readiness improvements**, not guaranteed award-probability claims.

| Action | Benchmark insight | Owner surface | Verification target | Priority |
|---|---|---|---|---|
| Add a short benchmark-positioning paragraph to README. | Hot Updater and AutoRAG have simple product positioning. | `README.md` | README links this matrix and avoids automatic-truth wording. | P0 |
| Add a 3-minute demo script that starts with one wrong AI claim and ends with an Evidence Pack. | Winning OSS products make the value visible fast. | Demo script / `docs/competition-submission.md` | Script names invariant checkpoints: anchor, risk trace, reviewer, projection. | P0 |
| Put the five-sentence differentiation table in the development report. | Mincho-style philosophy is memorable when concise. | Report appendix | Report has ≤5 core sentences and no competitor disparagement. | P0 |
| Add a judging evidence checklist. | NIPA notice includes written/source/demo/function/license surfaces. | `docs/competition-submission.md` | Checklist maps code evidence to written report, source, demo, function tests, license. | P0 |
| Keep graph/report as downstream projection, not core promise. | BrainTrace/GraphRAG adjacency can confuse the story. | README/demo/report | Graph section says projection is generated only after verified/corrected states. | P1 |
| Compare against RAG eval tools respectfully. | Ragas/TruLens/DeepEval are adjacent but solve evaluation metrics. | Benchmark matrix | Matrix says ClaimGate complements, not replaces, eval frameworks. | P1 |
| Add conformance evidence beside DomainPack claims. | OSS judges need reusable proof, not just architecture claims. | Report appendix | `pnpm test/conformance` result included with two pack names. | P1 |
| Add anti-overclaim language to submission copy. | Fact-verification tools often risk appearing fully automatic. | README/report | Copy says human reviewer remains authority. | P0 |

## README insertion candidate

`README.md` currently has a short OSS-first strategy section. Once the active README lease is free, insert a concise paragraph under that section:

```md
ClaimGate's contest differentiation is documented in [docs/benchmark-differentiation.md](docs/benchmark-differentiation.md). The project is intentionally positioned away from automatic truth-judgment claims: AI proposes candidates only, deterministic rules produce review traces, reviewers make terminal decisions, and only verified/corrected claims project into Evidence Packs, reports, or graphs.
```

## Acceptance checklist

- [x] Prior winners and adjacent tools are compared with source/date notes.
- [x] ClaimGate differences avoid AI truth-judgment claims.
- [x] Findings are converted into README/demo/report backlog items.
- [x] No competitor assets, wording, or UI structures are copied.
- [x] README edit is queued but not applied while another lane holds a README lease.
