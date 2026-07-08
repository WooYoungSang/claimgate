# ClaimGate Development Report and Submission Narrative

> Status: review draft for the ClaimGate v0 submission. All implementation and performance claims in this report are scoped to the repository evidence in [`docs/submission-evidence-map.md`](submission-evidence-map.md). v0 is offline, deterministic, and fixture-first.

## 1. Executive summary

ClaimGate is a source-grounded claim review framework for public-data AI outputs. It does not try to make an AI model the final judge of truth. Instead, it turns AI-produced candidate claims into a deterministic review workflow where a human reviewer can inspect source anchors, rule traces, corrections, and projection eligibility before any reusable report or graph output is produced.

The core submission story is simple:

1. AI may help curate candidate claims.
2. Every accepted claim must be anchored to source evidence.
3. Deterministic rules prioritize review risk and explain why a claim is red, yellow, green, or aggregate-only.
4. Human reviewers make terminal decisions.
5. Only `verified` and `corrected` claims can enter the Evidence Pack, report, or graph projection.

This design directly addresses a common failure mode in public-data AI systems: the generated answer may sound plausible while its source value, period, unit, entity, or provenance is wrong. ClaimGate makes those gaps visible and reviewable instead of hiding them behind a confidence score.

## 2. Problem and philosophy

Public-data workflows often need more than a generated answer. Reviewers need to know:

- What claim was made?
- Which original source supports it?
- Did the AI value match the source value?
- Which deterministic rule put it in the review queue?
- Who verified, corrected, or rejected it?
- Which claims are safe to reuse in an evidence artifact?

ClaimGate's philosophy is **AI Curator, Not Judge**. The AI boundary is useful for candidate extraction, but authority belongs to source anchors, deterministic risk traces, and human reviewer decisions. The project intentionally avoids saying that it eliminates hallucinations or automates truth. It provides a framework for catching, correcting, and documenting risky claims.

## 3. Architecture overview

ClaimGate v0 is a pnpm TypeScript monorepo with package boundaries designed to keep trust invariants independent of UI and domain-specific judgment.

```text
packages/core/          trust model, Source Anchors, state machine, risk engine, Evidence Pack, projection guards
packages/conformance/   reusable DomainPack conformance checks
packages/ui/            controlled React components with no hidden review authority
packs/civic-data/       offline civic public-data DomainPack fixture
packs/health-data/      offline health public-data DomainPack fixture
examples/civic-review-app/  thin Vite/React composition and handoff smoke path
scripts/                deterministic demo, handoff smoke, performance evaluation, boundary lint
```

The boundary is deliberate:

- `@claimgate/core` owns invariants and pure TypeScript logic.
- Domain packs own domain labels, fixtures, risk-rule metadata, and report templates.
- UI components render controlled views and callbacks; host apps retain state and reviewer authority.
- Example apps compose core, UI, and packs without moving authority into UI or AI adapters.

## 4. Implementation narrative

### 4.1 Source-grounded claim lifecycle

The core lifecycle starts at `extracted`, moves through anchoring and deterministic review states, and reaches terminal reviewer decisions only when the transition rules allow it:

```text
extracted -> anchored -> { needs-evidence | conflict | aggregate-only } -> { verified | corrected | rejected }
```

`verified` and `corrected` require a Source Anchor and a reviewer. `rejected` is terminal but does not project into downstream evidence artifacts. Audit events record creation, anchoring, transitions, actors, timestamps, and reasons.

### 4.2 Deterministic risk queue

The risk engine evaluates anchored claims with rule traces such as source existence, value match, unit/date/entity mismatch, contradiction, staleness, and aggregate-only evidence. The queue prioritizes red/yellow work and samples green claims to defend against false negatives. AI-provided risk scores are forbidden; the risk score comes from deterministic rules.

### 4.3 Evidence Pack First

The Evidence Pack is the primary reusable artifact. Reports and graph projections are downstream views of the Evidence Pack, not a replacement for source-grounded review. Projection guards ensure only `verified` and `corrected` claims are exported.

### 4.4 Domain-pack reuse

The conformance package validates that DomainPacks provide metadata, entities, anchor kinds, deterministic risk rules, report templates, and fixtures. Two fixture packs (`civic-data` and `health-data`) demonstrate that pack swaps can change domain behavior without moving domain judgment into core.

### 4.5 AI and trust adapter boundaries

The AI extraction adapter in v0 is fixture-only. It can return candidate claims and proposed anchors, but cannot attach authority fields such as terminal states, risk scores, reviewer decisions, Evidence Packs, reports, or graph projection data.

The OpenDID/trust adapter is also mock-only and context-only. It may add review context, but it cannot replace Source Anchors, deterministic risk, or human reviewer decisions.

## 5. Evaluation and evidence

The full evidence matrix is in [`docs/submission-evidence-map.md`](submission-evidence-map.md). The most important gates are:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm demo
pnpm test/conformance
pnpm test:e2e
pnpm test:perf
```

The latest local performance run of `pnpm test:perf` exercised 5,000 deterministic synthetic claims, projected 2,500 verified/corrected claims, emitted 2,502 graph nodes and 5,000 graph edges, and completed the synthetic framework pipeline in 110.13 ms under a 5,000 ms budget. This is evidence for the deterministic framework path only. It is not a claim about production latency for arbitrary documents or real LLM calls.

The same run measured fake-work reduction after accounting for green sampling: 3,875 claims were focused review work, 125 green claims were sampled, 1,125 reviews were skipped, and the synthetic fake-work-reduced ratio was 0.225. These numbers are useful because the metric charges the framework for sampling cost rather than pretending that all green claims can be ignored.

## 6. Judge-friendly story

A three-minute judging narrative can present ClaimGate as follows:

1. **Start with the risk**: AI can produce plausible public-data claims that are wrong in value, period, unit, entity, or source context.
2. **Show the boundary**: ClaimGate does not ask the AI to judge itself. AI output begins as an extracted candidate.
3. **Show the anchor**: reviewers can inspect the source anchor behind a claim.
4. **Show the rule trace**: deterministic risk explains why the claim is red/yellow/green/aggregate-only.
5. **Show correction and audit**: a reviewer can verify, correct, or reject; the audit trail records the decision.
6. **Show Evidence Pack output**: only verified/corrected claims reach the report or graph projection.
7. **Show reuse**: swap DomainPacks to demonstrate the framework boundary across civic and health fixtures.
8. **Close with limits**: v0 is offline and deterministic; real LLM/OCR/server/DID integrations are future adapter work, not hidden claims.

## 7. Limitations and future work

v0 intentionally excludes real LLM extraction, OCR, a general-purpose PDF/Excel parser, server, database, auth, multitenancy, graph database, and real DID wallet/issuer/verifier integration. Those are adapter or platform layers for later work.

Future work can add a real LLM extractor behind the existing candidate-only contract, richer source parsers, reviewer UX refinements, CI-published package workflows, and optional trust integrations. The invariant must remain unchanged: no external adapter may bypass anchors, deterministic risk traces, reviewer terminal decisions, or verified/corrected-only projection.

## 8. Submission checklist

- [x] Report narrative exists.
- [x] Invariant evidence map exists.
- [x] Quantitative claims are linked to repeatable commands.
- [x] LLM quality is separated from framework performance.
- [x] Limitations and no-go boundaries are explicit.
- [ ] README link update is pending because another active lane currently holds a lease on `README.md`.
