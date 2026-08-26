# Forge Plan — ClaimGate OSS Contest Submission Control Plane

## UoW set

| UoW | Title | Risk | Safety | File set |
|---|---|---|---|---|
| `uow-claimgate-framework--oss-contest-submission-control-plane` | Submission control plane doc and validator | LOW | C | `docs/competition-submission.md`, `scripts/validate-submission-control-plane.mjs`, `package.json`, `.omc/plans/*submission-control-plane*.md` |

## Wave assignment

- Wave 1: `uow-claimgate-framework--oss-contest-submission-control-plane`

## Done when

- Contest deadline/control checklist is visible.
- Submission artifact inventory maps deliverables to evidence.
- Evidence gate matrix defines go/no-go conditions.
- Final go/no-go workflow blocks public/external actions without human approval.
- Private-until-ready operating notes forbid secrets, publishing, and external submission.
- `pnpm test:submission-control-plane` validates the control plane.

## Scope hammer

`README.md` was excluded after a file lease conflict. The control plane records README status as PARTIAL/deferred instead of editing a shared file.
