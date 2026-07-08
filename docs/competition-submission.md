# ClaimGate OSS Contest Submission Control Plane

This document is the private-until-ready control plane for the ClaimGate OSS contest submission lane.
It tracks the contest deadline/control checklist, submission artifact inventory, evidence gate matrix,
final go/no-go workflow, and private operating notes without submitting externally or publishing the repo.

Scope source: `bet-warvis-claimgate-framework--claimgate-oss-contest-submission-control-plane`.

## Operating boundaries

- No external submission from this repository or agent lane.
- Do not publish, flip repository visibility, tag a public release, upload a video, or send a contest form without a separate human/operator approval.
- Keep ClaimGate v0 offline and deterministic: no real LLM extraction, OCR, server, DB, auth, multitenancy, graph DB, real DID wallet/issuer/verifier, or online demo.
- Preserve invariants: No Anchor, No Claim; AI Curator, Not Judge; deterministic risk with rule trace; Evidence Pack First; verified/corrected-only projection.

## Contest deadline and control checklist

The contest-system deadline must be verified by a human in the contest portal before any external action.
Until then, the lane treats the deadline as visible but unconfirmed and blocks public submission.

| Control item | Owner | Required evidence | Gate state |
|---|---|---|---|
| Contest deadline confirmed in source portal | Human operator | Screenshot/link retained outside repo if private | BLOCKED until human confirms |
| Submission account/entrant identity confirmed | Human operator | Account owner confirmation | BLOCKED until human confirms |
| Private-to-public readiness reviewed | Release owner | Private/public checklist or approval ref | PENDING |
| Source repository URL selected | Release owner | Final URL and target branch/tag | PENDING |
| README landing story ready | Submission narrative lane | README and docs review evidence | PENDING |
| Report/development narrative ready | Narrative lane | Report artifact and validation ref | PENDING |
| Demo/video story ready | Demo lane | Video/script artifact and smoke evidence | PENDING |
| License and OSS metadata ready | This lane | `LICENSE`, package metadata, README OSS section | READY in repo, final review pending |
| Reproducibility commands pass offline | This lane | `pnpm install`, `pnpm test`, `pnpm demo` or current gate refs | PENDING fresh-run |
| Security/privacy/no-secret sweep complete | This lane | grep/checklist evidence | PENDING |
| Final go/no-go held | Human operator | Explicit approval/refusal note | NOT STARTED |

## Submission artifact inventory

| Artifact | Current repo/source path | Required before submission | Status |
|---|---|---|---|
| Source code | repository root | Clean branch/tag selected; no secrets; no private notes | PENDING public-release lane |
| README landing page | `README.md` | Judges-first story, quickstart, invariants, demo commands | PARTIAL; README edit deferred due file lease conflict |
| MIT license | `LICENSE` | License present and unchanged | READY |
| Contribution guide | `CONTRIBUTING.md` | Contributor expectations visible | READY |
| Changelog | `CHANGELOG.md` | v0 submission entry or current summary | PENDING review |
| Package boundary docs | `docs/package-boundaries.md` | Core/UI/pack/no-go boundaries visible | READY |
| AI boundary docs | `docs/ai-extraction-boundary.md` | AI curator/non-judge boundary visible | READY |
| Domain pack docs | `docs/domain-packs.md` | Reuse/conformance story visible | READY |
| Trust adapter docs | `docs/opendid-trust-adapter.md` | Mock-only trust boundary visible | READY |
| Submission control plane | `docs/competition-submission.md` | This file validated by `pnpm test:submission-control-plane` | READY when validation passes |
| Offline demo | `pnpm demo` | Deterministic output and pack swap evidence | PENDING fresh-run |
| Test evidence | `pnpm test`, conformance, e2e/perf as applicable | Latest command log captured | PENDING fresh-run |
| Report/video assets | external or future `docs/` paths | Final asset links and checksums | PENDING narrative/demo lanes |

## Evidence gate matrix

| Gate | What must be proven | Suggested command/evidence | Go condition | No-go condition |
|---|---|---|---|---|
| Build/install reproducibility | Fresh offline workspace can install and run | `pnpm install`; cache policy noted | PASS | Missing deps or network-only demo |
| Lint/boundary safety | Package boundaries and repo lint pass | `pnpm lint` | PASS | Core imports UI/pack/example or hidden authority appears |
| Type safety | Strict TypeScript compiles | `pnpm typecheck` | PASS | Type errors or skipped packages |
| Unit/invariant tests | ClaimGate invariants hold | `pnpm test` | PASS | No Anchor No Claim, AI Curator Not Judge, deterministic risk, Evidence Pack First, or verified/corrected-only projection breaks |
| Domain conformance | Two packs prove reuse | `pnpm test/conformance` | PASS | Only one pack passes or pack swap fails |
| Demo smoke | Offline deterministic demo runs | `pnpm demo` | PASS | Online dependency, nondeterministic output, or server requirement |
| Handoff smoke | Demo app handoff path works | `pnpm test:e2e` | PASS or consciously deferred | Broken handoff path without waiver |
| Performance eval | Framework-scale eval has current result | `pnpm test:perf` | PASS or consciously deferred | Missing result for claimed performance story |
| Submission doc gate | Control plane remains complete | `pnpm test:submission-control-plane` | PASS | Missing deadline/checklist/inventory/evidence/go-no-go/private notes |
| Secret/privacy sweep | No secrets or private portal data committed | changed-file secret scan plus manual review | PASS/no findings | Secret or private account evidence in repo |
| Human approval | Public submission decision is explicit | `approval_ref` from operator | APPROVED | No approval, conflicting gates, or HANDOFF not accepted |

## Final go/no-go workflow

1. Freeze candidate branch/tag locally; do not push or publish from this agent lane.
2. Run the evidence gate matrix and paste command refs into the final submission report.
3. Verify the contest-system deadline and portal requirements with a human operator.
4. Confirm artifact inventory: source URL, README, report, video/demo, license, reproducibility, security/privacy sweep.
5. Hold final decision:
   - GO only if all required gates pass and a human/operator gives an explicit approval ref.
   - NO-GO if any blocker remains, the deadline is unverified, repo visibility is still private without release approval, or evidence is stale.
6. If GO, a separate human/operator lane performs external submission/publish. This lane remains evidence-only.
7. If NO-GO, record blockers and keep the repository private until remediated.

## Private-until-ready operating notes

- Treat this file as an internal control plane until the public-release lane approves visibility.
- Do not store contest credentials, private portal screenshots, private account names, or unpublished video links in this repo.
- Use evidence references, checksums, or external secure storage pointers for private materials.
- Keep repo artifacts deterministic and fixture-first so judges can reproduce without network services.
- Public wording must not overclaim: ClaimGate reviews source-grounded claims; AI proposes candidates only and never judges truth.
- The final public flip, contest form submission, and HANDOFF acceptance are protected lifecycle actions and require human/operator approval.

## Current lane result

| Item | Result |
|---|---|
| Build eligibility | PASS via `devos_validate_build_eligibility` on 2026-07-08 |
| Worktree isolation | PASS: `forge/claimgate-oss-contest-submission-control-plane` |
| File lease | PASS_WITH_WARN: README lease conflict; README edit scope-hammered out |
| Local validator | `pnpm test:submission-control-plane` |
| External submission | NOT PERFORMED |
| Public publish | NOT PERFORMED |
