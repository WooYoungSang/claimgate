---
name: claimgate-forge-roadmap
description: Execute the ClaimGate Bet-level parallel forge roadmap from .omc/plan/forge-bet-roadmap.md using one worktree/session per Bet lane.
argument-hint: "[start|status|next]"
host_environments: [codex, claude]
---

# ClaimGate Forge Roadmap

Use for `warvis-claimgate` only.

1. Read `.agents/skills/forge/SKILL.md` and `.omc/plan/forge-bet-roadmap.md`.
2. Read Obsidian SSOT in order: `99_constitution/vault-os.md` → `01-dashboard/ops-control.md` → `01-dashboard/system-home.md` → `00-capture/claimgate-framework-dev-handoff-entry-prompt.md` → target Bet note.
3. Prepare one isolated worktree per Bet lane under `/home/jang/Workspace/warvis-claimgate-worktrees/<bet-slug>`.
4. Invoke `$forge` with Bet IDs, not UoW IDs.
5. Run lanes in dependency waves: scaffold → core → source/domain/ui → risk/ai/trust → integration.
6. Stop on build-eligibility failure, uncommitted Bet, missing Pitch acceptance, incomplete ADR/FR/NFR chain, CRITICAL risk, unauthorized HIGH risk, file-overlap, lifecycle inconsistency, or Temper BLOCK twice.
