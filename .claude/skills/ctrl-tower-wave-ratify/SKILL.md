---
name: ctrl-tower-wave-ratify
description: Assemble critic, verifier, and human approval_ref prompts for a Wave envelope bundle while preserving Rule 8 no self-approval.
host_environments: [claude]
---

# ctrl-tower-wave-ratify

Use this skill when a Claude Code orchestrator needs to close a Wave envelope
bundle by generating critic / verifier / human approval_ref prompts in the
correct order, without ever issuing the ratify call itself.

## Contract

- Read-only assembly surface — never calls `devos_ratify_projection`, never
  patches vault frontmatter, never amends commits, never pushes.
- Preserves Rule 8 (no self-approval): critic, verifier, and operator
  prompts are emitted as three separate read-only contexts; the
  operator-facing prompt only REQUESTS an `approval_ref`, it does not
  assert one.
- Operates by direct tool use (`Read` for envelope JSON, `Grep` for AC
  ledgers, `Bash` for `git log` / `find`); does not shell out to any
  project-local helper script.
- Output must include per-UoW AC PASS counts, open issue counts, and
  stale-sha detection so a Wave with tampered envelopes blocks rather
  than silently passing.
- Wave close는 per-UoW envelope 검증에 더해, 그 UoW들이 속한 Bet의 Agent
  Execution Contract(AEC, 헌법 2026-06-26) Acceptance Criteria(FR/NFR/AC
  링크 + Done Criteria)가 충족됐는지 ratify summary에 포함한다 — 어떤 UoW가
  Bet AEC의 Ownership Boundary/Acceptance를 벗어나면 STOP(operator route).
- Respects the Codex MCP × Claude Code collaboration contract: verdict
  schemas are `code-reviewer ∈ {APPROVE, APPROVE_WITH_NIT,
  REQUEST_CHANGES}` and `architect ∈ {ARCHITECTURALLY_SOUND,
  SOUND_WITH_FOLLOWUPS, RECONSIDER}` with `max_review_rounds = 3`.

## Ratify Recipe

Perform the following steps with `Read` / `Grep` / `Bash`; do not invoke
any external helper script.

1. **Collect envelopes for the wave.** Operator supplies a wave id and an
   envelope root (commonly `docs/evidence/` per UoW, or a campaign
   directory under `.omx/campaigns/<campaign>/waves/<wave-id>/`). Use
   `Bash` `find <root> -name 'envelope*.json' -type f` to enumerate.
   If zero envelopes resolve, STOP and ask the operator to confirm the
   wave id.
2. **Summarise each envelope.** For each envelope file:
   - `Read` the JSON.
   - Extract `uow`, `head_sha`, `ac_results` (pass count vs total),
     `open_issues` (count + severities), and any `stale_sha` flag.
   - Cross-check `head_sha` against the corresponding worktree
     (`git -C <worktree> rev-parse HEAD`) when available; mismatch ⇒
     `stale_sha=true`.
   - Required fields are `uow`, `head_sha`, `ac_results`. Missing any of
     these triggers a STOP condition unless the operator explicitly
     waived staleness.
3. **Compose the critic prompt (round 1).** Generate a read-only context
   prompt that:
   - States `mutate_code: false`, `mutate_vault: false`,
     `commit_authority: none`.
   - Includes the per-UoW summary table from step 2.
   - Asks for verdict `APPROVE | APPROVE_WITH_NIT | REQUEST_CHANGES`
     with severities `BLOCK | HIGH | MED | LOW | NIT`.
   - Explicitly forbids the words `APPROVE` / `RATIFY` / `SHIP` as
     standalone approvals on behalf of the operator.
   - Notes the `max_review_rounds = 3` cap and that round-3
     REQUEST_CHANGES escalates to the operator (no auto-retry).
4. **Compose the verifier prompt.** Generate a separate read-only context
   that re-runs evidence checks:
   - Lists reproduction commands the verifier should execute (test
     invocations, `git log --oneline <base>..HEAD`, envelope diff vs
     working tree).
   - Asks for `SHIP | BLOCK` verdict tied to evidence references, not
     opinion.
   - Reminds the verifier they MUST NOT issue the ratify call.
5. **Compose the operator approval_ref request prompt.** Generate the
   human-facing prompt that:
   - Summarises the critic and verifier findings (links / pasted
     excerpts), the AC totals, and any carry-forward items.
   - REQUESTS an `approval_ref` of the form
     `user-<project>-<scope>-<YYYYMMDD>`. The skill MUST NOT mint one.
   - Lists the downstream actions blocked behind the approval (merge,
     push, Jenkins trigger, ratify commit) so the operator sees the
     blast radius before approving.
6. **(Optional) Persist the bundle.** If the operator requests it, write
   the three prompts plus the envelope summary table to a single
   evidence file under a campaign-scoped path the operator names. Do not
   choose a vault path; only repo-local or `.omx`-style evidence
   directories.

## STOP Conditions

- Any envelope is missing required fields (`uow`, `head_sha`,
  `ac_results`).
- Any envelope is stale (`stale_sha=true`) and the operator did not
  explicitly waive staleness for this wave.
- **Envelope-backup missing at the canonical path** (Phase 7 T1-SG-1, §10).
  Each UoW in the wave MUST have an orchestrator-owned envelope backup at
  `.omx/campaigns/<campaign-id>/envelopes/<uow-slug>-<wave-id>.json`. If
  any UoW resolves only to an in-stdout YAML or a Codex-side dump (no
  canonical backup), STOP and surface the gap — the orchestrator is the
  sole owner of envelope-backup creation, and Codex implementer commit
  sets must not include envelope-backup files. See
  `docs/orchestration/CODEX-MCP-PATTERN.md` §10 for the 5-clause
  ownership contract.
- A critic or verifier prompt contains standalone approval verbs
  (`APPROVE`, `RATIFY`, `SHIP`) outside of the explicit verdict-schema
  enumeration — the operator alone may approve.
- Wave id resolves to zero envelopes (operator likely supplied wrong id
  or envelope root).
- Round 3 of critic review returns REQUEST_CHANGES — escalate to the
  operator instead of dispatching a round-4 lane.

## Evidence checklist

- Each emitted prompt is saveable as text or JSON.
- `mutate_vault: false` is preserved in every prompt.
- Reviewer / verifier / human ratifier roles stay in separate contexts.
- Stale-sha bundles produce a BLOCK summary, not a silent skip.
- `approval_ref` placeholder follows the
  `user-<project>-<scope>-<YYYYMMDD>` shape and is never minted by the
  skill itself.

## L4/L5 governance ratify gate

Before composing the operator approval_ref prompt, the ratify skill MUST
confirm that the wave's governance gates actually fired on the live call
path (not just in prose). Pull the relevant fields from each envelope /
event timeline and surface them in the ratify summary. Wave with a gate
declared applicable but never fired = STOP condition (block ratify, route
to spec revision — this is the "dead-rule" pattern architect D-9 hunts).

- **C9 prior_art (H17)** — for envelopes that include a Bet shaping→shaped
  transition, confirm `create_bet` was called with `prior_art_refs[]` OR
  that `problem_statement` recall hit a lesson; if `WARVIS_PRIOR_ART_GATE_ENFORCE`
  was ON during the wave, missing both = BLOCK.
- **C6 safety_class floor (H13/H16)** — for each verify-stage envelope,
  confirm the `typed_verification` flat dict satisfies the declared
  safety_class floor (A={build,test,static,fr_trace,hazard} /
  B={build,test,static} / C={build,test}). Floor field present but
  evidence_ref strings empty = BLOCK.
- **C5 lease (H12)** — for code-edit envelopes, confirm a `file_set`
  fencing token was acquired and that the actual edited files are a
  subset of the lease `file_paths[]`. Edits outside lease scope = BLOCK.
- **C7 appetite (H14)** — confirm no appetite-limit increase landed
  without `approver_actor_class="human"`. Agent self-raised appetite =
  BLOCK.
- **C12 supersession (H23)** — for kill-bet envelopes, confirm the
  `cascade_summary` (direct_dependents / transitive_dependents /
  forced_block_ids / fanout_truncated) was surfaced to the orchestrator
  review surface and any `forced_block_ids[]` are routed to review (not
  silently auto-blocked).
- **C13 scope_delta (H24)** — confirm any `devos_update_scope` grow or
  shrink-commit delta carries an operator `approval_ref`. Narrowing-only
  is agent-OK.
- **C14 origin_ref (H25)** — confirm no envelope attempts to reopen a
  shipped Bet; defect-fix lanes must show a new Bet with
  `origin_ref="<shipped-bet-id>"` and an `ORIGINATES_FROM` edge.

The ratify operator prompt MUST include a per-Bet L4/L5 governance
summary table so the operator sees which gates fired (or were N/A) before
approving.

## Env-State Surfacing

Every Wave ratify envelope summary MUST surface the current environment state
and wave context before critic, verifier, or operator prompts are composed.
Capture these fields when present and mark absent values explicitly as
`UNSET`: `WARVIS_LLM_PROVIDER`, `WARVIS_CURATOR_LLM_PROVIDER`,
`WARVIS_PRIOR_ART_GATE_ENFORCE`, `WARVIS_LEASE_STORE`,
`WARVIS_AGENT_APPETITE_MAX_ITER`, `WARVIS_AGENT_APPETITE_MAX_TOKENS`,
`WARVIS_AGENT_APPETITE_MAX_WALLCLOCK_MS`, `OWNER_PROD_DEPLOY_REQUESTED`,
`PROD_APPROVAL_REF`, `SAFETY_GUARDS_ENFORCE`, and
`WARVIS_SAFETY_BYPASS_APPROVAL_REF`. The same summary MUST include wave id,
campaign id when available, `approval_ref` placeholder or supplied value,
base SHA, target HEAD, envelope HEAD, worktree path, and stale-sha verdict.
These fields are evidence for review routing only; the skill still MUST NOT
mint approvals, ratify, push, or patch vault state.
