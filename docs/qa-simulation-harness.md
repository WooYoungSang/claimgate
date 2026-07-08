# ClaimGate User Scenario Simulation QA Harness

This is the judge-facing scenario matrix for the committed Bet `bet-warvis-claimgate-framework--claimgate-user-scenario-simulation-qa-harness`.

The harness is deliberately offline and deterministic. It proves ClaimGate's v0 philosophy with existing repository fixtures, docs, tests, and scripts. It does **not** add real LLM extraction, OCR, PDF/Excel parsing, server, database, auth, multitenancy, graph database persistence, or real DID wallet/verifier behavior.

## How to run the QA harness

Minimal scenario-document validation:

```bash
pnpm test:simulation-qa
```

Primary judge gate bundle:

```bash
pnpm test:submission-control-plane
pnpm eval:framework
```

Expanded local verification used by this Bet lane:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Scenario matrix

| ID | Philosophy / QA risk | Given | When | Then | Command | Expected evidence |
|---|---|---|---|---|---|---|
| S01 | No Anchor No Claim | An extracted claim has no Source Anchor. | A reviewer transition tries to make it `verified` or `corrected`. | The transition is rejected and the claim cannot project. | `pnpm test -- --run packages/core/test/verification-state-machine.test.ts packages/core/test/source-anchor.test.ts` | Tests assert `E_NO_ANCHOR` / malformed terminal transitions are blocked. |
| S02 | AI Curator Not Judge | Fixture AI output proposes candidates and proposed anchors only. | Authority-like fields are present or implied by extracted output. | The adapter boundary rejects truth, final risk, terminal review, and projection authority. | `pnpm test -- --run packages/core/test/extraction.test.ts` | Candidate-only extraction passes; authority smuggling stays forbidden. |
| S03 | Risk-first Review | Civic fixture claims include mismatched values and sampled greens. | Deterministic risk queue is built. | Red/yellow/green classification is rule-traced; green sampling remains visible. | `pnpm test -- --run packages/core/test/risk/risk-engine.test.ts packages/core/test/risk/risk-queue.test.ts` | Rule traces exist and queue summaries include review-priority behavior. |
| S04 | Evidence Pack First | Claims are in mixed review states. | Evidence Pack, report, and graph projections are generated. | Only `verified` and `corrected` claims enter reusable output. | `pnpm test -- --run packages/core/test/evidence-pack.test.ts packages/core/test/projection-guards.test.ts packages/core/test/projectors.test.ts` | Projection guard tests exclude extracted, anchored, conflict, aggregate-only, rejected, and needs-evidence claims. |
| S05 | DomainPack reuse | Civic and health packs encode different domain rules. | The same conformance kit checks both packs. | Core/UI stay reusable while pack-owned judgment changes behavior. | `pnpm test/conformance` | Civic and health DomainPack tests pass with different expected fixture risk flows. |
| S06 | Pack swap demo | The example app composes core + UI + selected pack. | The demo is run with fixture packs. | The output story changes by pack without core/UI edits. | `pnpm demo` | Demo output shows civic/health pack-specific behavior and Evidence Pack counts. |
| S07 | UI hidden authority | UI components receive controlled props from the host app. | Review, report, graph, and Evidence Pack components render. | UI exposes no hidden state-machine authority, no reviewer auto-decision, and no projection promotion. | `pnpm test -- --run packages/ui/test/ui-boundary.test.ts packages/ui/test/impact-projection.test.ts` | UI tests assert controlled components and read-only projections. |
| S08 | Public export hygiene | A sanitized public export is prepared from the private working repo. | The submission control plane and hygiene checklist are inspected. | Private runtime state, secrets, local endpoints, and internal agent harness paths are not part of the public export. | `pnpm test:submission-control-plane` | Control plane validator confirms release checklist, no-publish notes, evidence gates, and private-until-ready language. |
| S09 | Anti-overclaim | Submission copy describes fixture-first v0 behavior. | A judge reads product and submission language. | Copy avoids production fact-checking, hallucination-elimination, real LLM quality, and external-service performance claims. | `pnpm test -- --run packages/core/test/product-manifesto-docs.test.ts` | Docs tests keep safe language around AI boundary and Evidence Pack authority. |
| S10 | Fixture-only performance framing | Synthetic framework workload runs locally. | Performance evaluation computes timing and throughput. | Results are reported as offline fixture framework throughput only, not LLM or production latency. | `pnpm test:perf` | JSON report includes deterministic claim count, projected count, budget, and throughput from `scripts/framework-performance-eval.ts`. |
| S11 | End-to-end handoff smoke | A reviewed claim has a Source Anchor and reviewer decision. | Handoff smoke serializes Evidence Pack JSON and report/graph projections. | Evidence Pack JSON is primary; report/graph are downstream projections. | `pnpm test:e2e` | Handoff smoke asserts rejected claims stay out and report/HTML cite Evidence Pack as source. |
| S12 | Full framework gate | All v0 invariants are tested together after dependencies are installed. | A judge runs the evaluator smoke command. | Lint, typecheck, unit tests, demo, conformance, handoff smoke, and performance eval complete offline. | `pnpm eval:framework` | The one-command gate exits 0 and prints the deterministic performance report. |

## Given / When / Then simulation details

### S01 — No Anchor No Claim

**Given** an extracted claim without a Source Anchor.

**When** a reviewer attempts a terminal state such as `verified` or `corrected`.

**Then** core guards reject the transition and projection guards keep the claim out of Evidence Pack, report, and graph views.

**Command**

```bash
pnpm test -- --run packages/core/test/verification-state-machine.test.ts packages/core/test/source-anchor.test.ts
```

**Expected evidence**: state-machine tests fail closed with `E_NO_ANCHOR`-class behavior and source-anchor tests prove anchors are required before terminal trust states.

### S02 — AI Curator Not Judge

**Given** an offline AI fixture proposes claim candidates and possible anchors.

**When** extracted payloads attempt to include terminal review, final risk scoring, Evidence Pack, report, or graph authority.

**Then** the AI adapter boundary strips or rejects those authority channels; deterministic rules and reviewers remain authoritative.

**Command**

```bash
pnpm test -- --run packages/core/test/extraction.test.ts
```

**Expected evidence**: extraction tests pass with candidate-only output and reject authority-smuggling fields.

### S03 — Risk-first Review

**Given** public-data fixture claims with mismatches, aggregate-only cases, and greens.

**When** deterministic risk rules build the review queue.

**Then** red/yellow claims are prioritized, every decision has a rule trace, and green sampling is explicit rather than ignored.

**Command**

```bash
pnpm test -- --run packages/core/test/risk/risk-engine.test.ts packages/core/test/risk/risk-queue.test.ts
```

**Expected evidence**: risk tests assert deterministic levels, trace-bearing decisions, and stable sampled-green behavior.

### S04 — Evidence Pack First

**Given** reviewed and unreviewed claims coexist.

**When** Evidence Pack, report, and graph projections are produced.

**Then** Evidence Pack JSON is the primary reusable artifact and report/graph outputs are projections from only `verified` and `corrected` claims.

**Command**

```bash
pnpm test -- --run packages/core/test/evidence-pack.test.ts packages/core/test/projection-guards.test.ts packages/core/test/projectors.test.ts
```

**Expected evidence**: projection tests exclude all ineligible states and report/HTML self-identify Evidence Pack as the source.

### S05 — DomainPack reuse

**Given** civic and health packs provide different labels, fixtures, and risk rules.

**When** the shared conformance kit runs.

**Then** both packs satisfy the same contract while preserving pack-specific domain judgment outside core.

**Command**

```bash
pnpm test/conformance
```

**Expected evidence**: conformance passes for `@claimgate/pack-civic-data` and `@claimgate/pack-health-data` without core importing pack code.

### S06 — Pack swap demo

**Given** the example app composes core, UI, and a selected DomainPack.

**When** the demo script runs.

**Then** the story changes by pack while the trust workflow remains source anchor → deterministic risk → reviewer decision → Evidence Pack.

**Command**

```bash
pnpm demo
```

**Expected evidence**: demo output includes pack-specific story text and Evidence Pack item counts.

### S07 — UI hidden authority

**Given** UI components render review, Evidence Pack, report, and graph data.

**When** the UI tests render those components.

**Then** components remain controlled/read-only surfaces and do not own verification, risk, projection, or reviewer authority.

**Command**

```bash
pnpm test -- --run packages/ui/test/ui-boundary.test.ts packages/ui/test/impact-projection.test.ts
```

**Expected evidence**: UI tests assert controlled props and read-only projections.

### S08 — Public export hygiene

**Given** this private worktree contains internal harness context that is not a public deliverable.

**When** a sanitized public export is checked through the submission control plane.

**Then** public release remains blocked until internal runtime surfaces, secrets, local endpoints, and private notes are absent or explicitly triaged.

**Command**

```bash
pnpm test:submission-control-plane
```

**Expected evidence**: the validator confirms submission inventory, private-until-ready notes, no external submission, do-not-publish language, and evidence gate coverage.

### S09 — Anti-overclaim

**Given** ClaimGate v0 is fixture-first and deterministic.

**When** judge-facing language describes the project.

**Then** it says ClaimGate is a source-grounded review framework, not an automatic truth engine, hallucination eliminator, real-LLM benchmark, or production fact-checker.

**Command**

```bash
pnpm test -- --run packages/core/test/product-manifesto-docs.test.ts
```

**Expected evidence**: docs tests keep README, manifesto, and language kit aligned around conservative authority claims.

### S10 — Fixture-only performance framing

**Given** the framework performance script creates synthetic claims in memory.

**When** it measures queueing, reviewer transitions, Evidence Pack creation, projections, serialization, and fake-work reduction.

**Then** the report is interpreted only as local fixture framework throughput, never LLM quality or arbitrary-document performance.

**Command**

```bash
pnpm test:perf
```

**Expected evidence**: output JSON includes `claimCount`, `projectedClaimCount`, `budgetMs`, `throughputClaimsPerSecond`, and fake-work metrics from a deterministic workload.

### S11 — End-to-end handoff smoke

**Given** a reviewed source-grounded claim and an ineligible rejected claim.

**When** the handoff smoke creates Evidence Pack JSON plus report/graph projections.

**Then** Evidence Pack is the primary handoff artifact and rejected claims never leak into report or graph output.

**Command**

```bash
pnpm test:e2e
```

**Expected evidence**: handoff smoke asserts Evidence Pack JSON contains reviewer-approved claims and report/HTML state `Projection source: Evidence Pack`.

### S12 — Full framework gate

**Given** dependencies are installed from `pnpm-lock.yaml`.

**When** the evaluator smoke runs.

**Then** package boundaries, type checks, tests, demo, conformance, handoff smoke, and performance eval all pass offline.

**Command**

```bash
pnpm eval:framework
```

**Expected evidence**: command exits 0; any failure is a release-review blocker.

## Public hygiene scan recipe

Run this in the sanitized export checkout before public release, not in the private development worktree:

```bash
git ls-files | grep -Ei '(^|/)(\.agent|\.agents|\.codex|\.claude|\.omc|\.omx|CLAUDE\.md|AGENTS\.md|\.mcp\.json|\.env|secrets?)' && exit 1 || true
```

Content scan for common secret/private endpoint patterns:

```bash
grep -RInE '(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|192\.168\.[0-9]{1,3}\.|10\.[0-9]{1,3}\.|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.)' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  .
```

A non-empty scan is a **NO-GO** until each match is triaged. This private worktree intentionally contains agent/harness files; the public export must not.

## QA report interpretation

- PASS means the scenario matrix is present, deterministic, and mapped to runnable local commands.
- PASS means ClaimGate's v0 philosophy is demonstrated by fixtures and tests.
- PASS does **not** mean ClaimGate performs real-world automatic fact checking.
- PASS does **not** mean LLM quality, OCR quality, server throughput, graph database behavior, or real DID verification has been evaluated.
- Report any deferred integration as out of scope rather than as hidden capability.
