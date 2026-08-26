# Harness — ClaimGate OSS Contest Submission Control Plane

- Bet: `bet-claimgate-framework--claimgate-oss-contest-submission-control-plane`
- Project: `claimgate-framework`
- Worktree: `/home/jang/Workspace/claimgate-worktrees/claimgate-oss-contest-submission-control-plane`
- Branch: `forge/claimgate-oss-contest-submission-control-plane`
- Implementer: `codex`
- Obsidian: `20-projects/20-bets/bet-claimgate-framework--claimgate-oss-contest-submission-control-plane.md`

## Definition chain

- Pitch: `pitch-claimgate-framework--claimgate-oss-contest-submission-control-plane` (validated as accepted by build eligibility)
- ADR: `adr-claimgate-framework--004-submission-strategy`
- FR: `fr-claimgate-framework--competition-submission-control-plane`
- NFR: `nfr-claimgate-framework--submission-readiness`

## Gate strategy

- Primary: `pnpm test:submission-control-plane`
- Repo gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- No external submit/publish. No protected lifecycle self-approval.

## HITL points

- Confirm actual contest deadline in source portal.
- Approve public repository flip / source URL.
- Approve final contest submission.
- Resolve README lease conflict if README submission section must be edited later.
