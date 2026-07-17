# Private-to-Public OSS Release Readiness

Status: readiness checklist prepared; repository visibility must remain private until a separate human/operator public-release decision.

## Release boundary

This document supports a future public OSS transition. It does **not** authorize any of the following:

- publishing packages;
- pushing this branch;
- flipping GitHub repository visibility;
- uploading private vault/runtime state;
- marking the ShapeOps Bet as shipped or HANDOFF accepted.

## Public-readiness checklist

### 1. Repository hygiene

- [ ] No `.env`, secret, credential, private key, local database, private vault export, or runtime session directory is tracked.
- [ ] `.gitignore` excludes local secrets, vault exports, runtime state, caches, generated archives, and dependency folders.
- [ ] Agent/runtime harness files are reviewed before public release; if they expose private operator endpoints or vault-specific instructions, publish from a sanitized export branch instead of this working branch.
- [ ] `README.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, `THIRD_PARTY_LICENSES.md`, and reproducibility docs are present.

Suggested path audit:

```bash
git ls-files | grep -Ei '(^|/)(\.env|secrets?|private|vault|vault-export|obsidian-vault|\.omx|\.omc/state|\.codex/(sessions|logs)|\.claude/(sessions|logs))' || true
```

Suggested content audit before public visibility flip:

```bash
grep -RInE '(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|192\.168\.[0-9]{1,3}\.|10\.[0-9]{1,3}\.|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.)' \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  .
```

A non-empty content audit is not automatically a vulnerability, but it is a **NO-GO** until each match is triaged and either removed, documented as harmless, or moved to a private-only branch.

### 2. Security and privacy

- [ ] `SECURITY.md` describes supported versions, vulnerability reporting, and v0 boundaries.
- [ ] No real personal data, non-public source documents, private reviewer notes, or vault exports are required by examples/tests.
- [ ] v0 includes no server, DB, auth, multitenancy, real DID wallet/issuer/verifier, OCR, real LLM extraction, or online demo dependency.

### 3. License and third-party review

- [ ] Project `LICENSE` is MIT.
- [ ] `THIRD_PARTY_LICENSES.md` records a reproducible license inventory command and review snapshot.
- [ ] Any non-permissive, unknown, missing, or private/internal dependency license is resolved before public release.

### 4. Reproducibility

- [ ] `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm demo` pass from a clean clone.
- [ ] `pnpm test/conformance`, `pnpm test:e2e`, and `pnpm test:perf` pass or have documented public-release disposition.
- [ ] Tests and demos remain deterministic after dependencies are installed.

### 5. ClaimGate invariant protection

- [ ] No Anchor, No Claim remains enforced.
- [ ] AI Curator, Not Judge remains enforced.
- [ ] Deterministic risk owns rule trace and red/yellow/green classification.
- [ ] Evidence Pack First remains enforced.
- [ ] Only `verified` and `corrected` claims project downstream.

## Go/no-go criteria

| Decision | Criteria |
|---|---|
| GO for reviewer handoff | Required docs exist, local validation passes, and private/runtime exposure findings are triaged. |
| PASS_WITH_WARN for this Bet lane | Docs/gates are implemented, but public visibility remains blocked by explicit human release review. |
| NO-GO for public flip | Any untriaged secret/private endpoint/private data finding, failing reproducibility gate, missing license/security surface, or v0 No-Go violation. |

## Current readiness note

As of 2026-07-17 KST, this branch includes an offline deterministic `@claimgate/pack-mofa-oda` prototype and a civic/health/MOFA three-pack demo. It intentionally does not publish, push, change repository visibility, ratify a Bet, or submit to an external portal.

## MOFA ODA July prototype readiness

Implemented current evidence:

- `packs/mofa-oda/src/index.ts`: DATA-001~003 provenance, three Source Anchors, and red/yellow/green deterministic rules.
- `packs/mofa-oda/test/pack.test.ts`: stable fixture/source/rule outcomes and DomainPack conformance.
- `package.json` `test/conformance`: conformance + civic + health + MOFA pack coverage.
- `examples/civic-review-app` and `scripts/swap-pack-demo`: one core/UI contract with three distinct semantic stories.
- `docs/demo-script.md`: MOFA reviewer walkthrough from Source Anchor to Evidence Pack/report/graph.

Required readiness commands:

```bash
pnpm typecheck
pnpm test/conformance
pnpm demo
pnpm test
pnpm lint
```

Fresh verification snapshot (2026-07-17 KST):

- `pnpm typecheck`: PASS across core, conformance, UI, three packs, and the example app.
- `pnpm test/conformance`: PASS, 11 tests (conformance 4 + civic 2 + health 2 + MOFA ODA 3).
- `pnpm demo`: PASS, three distinct civic/health/MOFA semantic stories.
- `pnpm test`: PASS, full build plus 82 tests across 21 test files.
- `pnpm lint`: PASS, package-boundary lint plus workspace TypeScript lint.

Remaining FUTURE / No-Go boundaries:

- live MOFA/KOICA OpenAPI or file download;
- real LLM extraction or LLM-as-judge;
- OCR or general PDF/Excel parsing;
- server, DB, auth, multitenancy, or production graph database;
- production factual accuracy, adoption, reviewer time-saving, or SLA claims.

Human-only actions remain external submission, release/public visibility, protected Bet/HANDOFF transitions, and ratification. This document is evidence for review, not self-approval.
