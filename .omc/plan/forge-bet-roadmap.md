# ClaimGate Bet-level `$forge` Parallel Implementation Roadmap

- Project: `warvis-claimgate`
- Repo: `/home/jang/Workspace/warvis-claimgate`
- Roadmap status: updated for Bet-level parallel execution after WARVIS harness refresh
- Updated: 2026-07-07 Asia/Seoul
- Canonical SSOT: WARVIS Obsidian vault, not this file
- Local role: reusable evidence/cache roadmap under `.omc/plan`

## 0. Current `$forge` contract after harness refresh

The refreshed WARVIS harness defines `$forge` as a **Bet-level pipeline**:

```text
argument-hint: <project_id> <bet_id> [obsidian=<vault_path>] [risk_authorized] [implementer=codex|claude] [-- <inline spec>]
```

Key contract from `.agents/skills/forge/SKILL.md`:

- **forge의 단위 = Bet**.
- Forge decomposes one committed/build-eligible Bet into N UoW work-spec contracts during Blueprint.
- Hammer implements file-disjoint UoW waves in parallel.
- Each UoW keeps its own DevOS 9-event dev_session lifecycle.
- Bet-level `phase`/Hill Chart remains canonical; UoW lifecycle is orthogonal.
- `implementer=codex` is the default.

Operational correction for this project:

- The main session should orchestrate **Bet-level parallel lanes**, not one Bet lane forever serially.
- Each Bet lane runs in a separate worktree and should be handled by one agent/session owning exactly one Bet.
- True simultaneous `$forge` for multiple Bets should happen in separate Codex sessions/panes or team lanes because the forge skill itself says multi-Bet true concurrency requires separate sessions per Bet.
- Dependency barriers still apply: a Bet lane may be prepared/Blueprinted early, but Hammer/merge must not violate package/API dependencies.

## 1. Source verification against Obsidian entry prompt

Checked source note:

- `00-capture/claimgate-framework-dev-handoff-entry-prompt.md`

Coverage status in this roadmap:

| Entry prompt section | Reflected here? | Roadmap location |
|---|---:|---|
| Source corpus: SSOT, 8 Bets, ADR 12, FR 13, NFR 8, constitution | Yes | §§2, 6, 9 |
| Product essence and 4 invariants | Yes | §3 |
| Boundary: core trust invariants, pack domain judgment | Yes | §§3, 4, 6 |
| Tech stack: pnpm monorepo, TS strict, Vitest, React 18, Vite, pure TS core, Zustand in examples, React Flow auxiliary, Playwright smoke, optional Zod, Node LTS | Yes | §4 |
| Package tree and package responsibilities | Yes | §4 |
| Deterministic risk rules and error invariants | Yes | §5 |
| Verification state machine and projection eligibility | Yes | §5 |
| Bet order and ADR/FR/NFR mapping | Yes | §6 |
| Commit protocol / human Gate / phase timestamps / UoW scaffold | Yes | §§7, 9, 10 |
| No-Go guardrails | Yes | §8 |
| Definition of Done | Yes | §9 |
| WARVIS operating rules: Obsidian MCP, phase-only, machine-status mirror, optional session tracking | Yes | §§7, 10 |
| First execution instruction | Yes | §12 next-session entry prompt |
| Bet-level parallel execution requested by user | Yes | §§0, 6, 7, 12 |

## 2. Source corpus to load in next session

Read in this order:

1. Refreshed `$forge` skill:
   - `.agents/skills/forge/SKILL.md`
2. Obsidian official read order:
   - `99_constitution/vault-os.md`
   - `01-dashboard/ops-control.md`
   - `01-dashboard/system-home.md`
3. Entry prompt note:
   - `00-capture/claimgate-framework-dev-handoff-entry-prompt.md`
4. Project SSOT:
   - `20-projects/50-ssot/ssot-warvis-claimgate-framework--project-definition.md`
5. Bet notes:
   - `20-projects/20-bets/bet-warvis-claimgate-framework--monorepo-scaffold.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--core-and-state.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--source-evidence.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--risk-review-console.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--domain-pack-reuse.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--ai-extraction-adapter.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--shared-ui-kit.md`
   - `20-projects/20-bets/bet-warvis-claimgate-framework--trust-adapter.md`
6. Definition chain:
   - ADR 001~012 under `20-projects/30-adrs/`
   - FR 13 under `20-projects/40-fr/`
   - NFR 8 under `20-projects/41-nfr/`
7. Constitution/procedure references:
   - `99_constitution/vault-os` §0.3 Write Router, §0.6 Lifecycle Timestamps
   - `99_constitution/ref-lifecycle` §12 closed loop, H14/H21/H22

## 3. Non-negotiable product invariants

ClaimGate is a source-grounded claim review framework for selecting dangerous public-AI output claims and reviewing/correcting/approving them with original-source evidence.

Code-enforced and test-proven invariants:

- No Anchor, No Claim: a claim without Source Anchor cannot become `verified` or `corrected`.
- AI Curator, Not Judge: AI never decides risk or truth. AI rating value is zero authority.
- Risk-first Review: prioritize red/yellow claims; green claims are sampled.
- Evidence Pack First: the final reusable artifact is Evidence Pack, not graph.
- Fake Work Reduced: measure net review-cost reduction after sampling cost; do not overclaim.
- Core = trust invariants; Pack = domain judgment.
- Core must have zero domain knowledge and must never import pack code.

Projection invariant:

- Only `verified` and `corrected` claims may project into Evidence Pack, Report, or Graph.

## 4. Technical and structural decisions

Stack:

- Single pnpm monorepo.
- TypeScript strict.
- Vitest tests.
- React 18 + Vite UI.
- Pure TypeScript core, framework-independent.
- Example app owns app state with Zustand; core stays stateless.
- React Flow is auxiliary graph view only.
- Playwright for E2E smoke.
- Optional Zod for schema validation.
- Node LTS.
- Offline and deterministic; no server/DB/auth/multitenancy in v0.

Package boundaries:

```text
claimgate/
  packages/core/          # @claimgate/core: models, state machine, deterministic risk engine, evidence pack, projection, domain-pack contract, conformance
  packages/ui/            # @claimgate/ui: domain-agnostic controlled React components, no hidden authority/state ownership
  packs/<domain>/         # domain judgment: entities, risk rules, anchors, reports, copy, fixtures, conformance.test
  examples/<domain>-app/  # thin composition of core + ui + pack; swapping pack yields another app
  docs/
  fixtures/
  scripts/swap-pack-demo
  LICENSE                 # MIT
  README.md
  CONTRIBUTING.md
  CHANGELOG.md
  pnpm-workspace.yaml
```

## 5. Deterministic risk and verification workflow

Common deterministic risk rules owned by core:

- `source-exists`: no anchor → red (`needs-evidence`)
- `value-match`: AI value differs from source value → red (`conflict`)
- `unit/date/entity`: unit/period/agency mismatch → yellow~red
- `contradiction`: source-internal contradiction → red
- `staleness`: source age exceeded → yellow
- `aggregate-only`: only aggregate exists → yellow and separate `aggregate-only` state

Risk requirements:

- Every claim must keep a rule trace explaining which rule produced which level.
- DomainPack may extend domain-specific rules/thresholds.
- Common rules are core invariants.
- Errors: `E_NO_RULE_TRACE`, `E_AI_SCORED`.
- Green sampling: minimum N% of green claims, default 0.1, random human review for false-negative defense.

Verification state machine:

```text
extracted → anchored → { needs-evidence | conflict | aggregate-only } → { verified | corrected | rejected }
```

State requirements:

- AI output always starts at `extracted`.
- Terminal transitions (`verified`, `corrected`, `rejected`) require reviewer.
- Guards enforce transitions.
- Every transition records audit event: actor, action, before, after, timestamp.
- `corrected` preserves original source value and correction reason.
- Errors: `E_NO_ANCHOR`, `E_INVALID_TRANSITION`, `E_NO_REVIEWER`.
- Projection leak tests must prove ineligible states never enter Evidence Pack/Report/Graph.

Source Anchor v0 shape:

- Discriminated union of `excel-cell`, `pdf-page`, `csv-row`, `text-span`, `web-link`.
- v0 source scope: text PDF, CSV, simple XLSX fixtures.

## 6. Bet lanes, dependency barriers, and parallel plan

Bet-level parallel execution model:

- One Bet = one forge lane = one owner agent/session = one isolated worktree.
- Each lane runs `$forge warvis-claimgate <bet_id> ... implementer=codex`.
- Main session coordinates dependency barriers, merge order, and integration gates.
- All lanes can perform read/eligibility/preflight concurrently.
- Hammer/merge starts only when dependency inputs are stable.

### Wave 0 — scaffold barrier

| Bet | Appetite | Key refs | Parallel policy |
|---|---:|---|---|
| `monorepo-scaffold` | 1d | ADR-001/002/004, NFR submission-readiness/performance | Must Hammer+merge first |

### Wave 1 — core contract barrier

| Bet | Appetite | Key refs | Parallel policy |
|---|---:|---|---|
| `core-and-state` | 2d | ADR-005, FR verification-workflow/audit-log, NFR explainability | Starts after scaffold merge; must stabilize core API |

### Wave 2 — parallel API/data/UI-contract lanes after core

| Bet | Appetite | Key refs | Parallel policy |
|---|---:|---|---|
| `source-evidence` | 2d | ADR-006/007, FR anchor-evidence-pack/report-graph, NFR source-traceability | Starts after core |
| `domain-pack-reuse` | 3d | ADR-009/010, FR domain-pack-console/conformance-kit/example-app, NFR reusability | Starts after core; may depend on source contracts for final integration |
| `shared-ui-kit` | 2d | ADR-011, FR review-console-ui, NFR demo-reliability | Starts after stable core component contracts; final integration waits for evidence/risk APIs |

### Wave 3 — parallel adapter/review lanes after source/evidence contracts

| Bet | Appetite | Key refs | Parallel policy |
|---|---:|---|---|
| `risk-review-console` | 3d | ADR-003, FR risk-queue/correction/fake-work, NFR determinism/explainability | Starts after core + source/evidence contracts |
| `ai-extraction-adapter` | 1d | ADR-008, FR ai-extraction-adapter, NFR privacy | Starts after core + source/evidence contracts |
| `trust-adapter` | 1d | ADR-012, FR trust-adapter-mock, NFR privacy | Starts after source/evidence; must not bypass anchors/risk |

### Wave 4 — integration/handoff barrier

- Rebase all Bet branches on latest `main`.
- Run full repo gates: install, lint, typecheck, test, demo, smoke.
- Verify DoD and NFR gates.
- Prepare Lessons/Handoff; final Bet shipped remains operator-owned.

## 7. Worktree topology and commands

Main repo:

```bash
/home/jang/Workspace/warvis-claimgate
```

Worktree root:

```bash
/home/jang/Workspace/warvis-claimgate-worktrees
```

Branch convention:

```text
forge/<bet-slug>
```

Worktree convention:

```text
/home/jang/Workspace/warvis-claimgate-worktrees/<bet-slug>
```

Prepare all Bet worktrees from clean, up-to-date `main`:

```bash
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
mkdir -p /home/jang/Workspace/warvis-claimgate-worktrees

for bet in \
  monorepo-scaffold \
  core-and-state \
  source-evidence \
  risk-review-console \
  domain-pack-reuse \
  ai-extraction-adapter \
  shared-ui-kit \
  trust-adapter
do
  git worktree add -b "forge/${bet}" \
    "/home/jang/Workspace/warvis-claimgate-worktrees/${bet}" \
    main || true
done
```

Bet command matrix:

```bash
# 1. monorepo-scaffold
$forge warvis-claimgate bet-warvis-claimgate-framework--monorepo-scaffold \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--monorepo-scaffold.md \
  implementer=codex \
  -- Implement the ClaimGate v0 pnpm monorepo scaffold: package boundaries, build/test/demo scripts, README, CONTRIBUTING, CHANGELOG, MIT license, and workspace structure. Preserve ignored agent/runtime directories.

# 2. core-and-state
$forge warvis-claimgate bet-warvis-claimgate-framework--core-and-state \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--core-and-state.md \
  implementer=codex \
  -- Implement pure TypeScript ClaimGate core model, claim/source/anchor types, verification state machine, deterministic transitions, audit events, projection guards, and invariant tests.

# 3. source-evidence
$forge warvis-claimgate bet-warvis-claimgate-framework--source-evidence \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--source-evidence.md \
  implementer=codex \
  -- Implement Source Anchor discriminated unions, Source, Evidence Pack, report/graph projection primitives, and deterministic fixture tests. Only verified/corrected claims may project.

# 4. risk-review-console
$forge warvis-claimgate bet-warvis-claimgate-framework--risk-review-console \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--risk-review-console.md \
  implementer=codex \
  -- Implement deterministic risk review workflow, rule trace, red/yellow/green queue behavior, green sampling, correction workflow, fake-work-reduced metric, and minimal console/demo surface.

# 5. domain-pack-reuse
$forge warvis-claimgate bet-warvis-claimgate-framework--domain-pack-reuse \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--domain-pack-reuse.md \
  implementer=codex \
  -- Implement DomainPack interfaces, conformance kit, two fixture packs proving reuse, swap-pack demo script, and documentation.

# 6. ai-extraction-adapter
$forge warvis-claimgate bet-warvis-claimgate-framework--ai-extraction-adapter \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--ai-extraction-adapter.md \
  implementer=codex \
  -- Implement AI extraction adapter contract and fake/offline adapter. AI proposes candidate claims/anchors only and never verifies, judges, scores risk, or projects claims.

# 7. shared-ui-kit
$forge warvis-claimgate bet-warvis-claimgate-framework--shared-ui-kit \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--shared-ui-kit.md \
  implementer=codex \
  -- Implement controlled React UI primitives for ClaimGate state, evidence, review, risk trace, and fixture demos. UI owns no hidden authority.

# 8. trust-adapter
$forge warvis-claimgate bet-warvis-claimgate-framework--trust-adapter \
  obsidian=20-projects/20-bets/bet-warvis-claimgate-framework--trust-adapter.md \
  implementer=codex \
  -- Implement trust/provenance mock adapter contract and offline fixture adapter. Trust signals inform review context but do not replace anchors, deterministic risk, or final verification.
```

## 8. No-Go guardrails

Stop and re-shape if any lane attempts:

- Real LLM extraction in v0.
- OCR.
- General-purpose PDF/Excel parser.
- Server, DB, auth, multitenancy.
- Graph DB.
- Real DID wallet/issuer/verifier; trust is mock adapter boundary only.
- Online/non-deterministic demo.
- Automatic fact promotion from AI output.
- Core importing pack/domain knowledge.
- UI owning hidden review authority.
- AI assigning final risk/truth.

## 9. Definition of Done and verification gates

Per-Bet DoD:

- All Success items in the Bet note pass.
- Acceptance artifacts exist.
- Mapped NFR gates pass.
- Each Bet’s produced UoWs are verified/dispositioned.

Global v0 DoD:

- Same fixture produces same risk levels, traces, projections, and snapshot bytes.
- Fresh clone can run offline within 10 minutes:

```bash
pnpm install
pnpm test
pnpm demo
```

- LICENSE is MIT.
- README, CONTRIBUTING, CHANGELOG exist.
- Conformance kit passes for two packs.
- Pack swap changes the example app behavior/domain.
- Fixture contains intentionally wrong claims proving Risk Queue and correction workflow.

Recommended repo gates:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm demo
```

## 10. WARVIS / ShapeOps operating protocol

- Vault state updates must go through Obsidian MCP / approved Single Writer path; do not directly edit vault filesystem.
- `phase` is canonical workflow state.
- Do not add workflow truth to `status` frontmatter.
- `committed_at` and `shipped_at` are one-time freeze stamps on transition.
- Machine-status mirror must sync with `phase` where applicable.
- Bet commit is human/operator approval: agents propose commit; agents do not self-commit shaped Bets.
- On approval: Bet `phase → committed`, `committed_at` stamped once; parent Pitch atomically `phase → accepted` per H22.
- Implementation starts at `phase: building`.
- Progress updates must either update Bet `hill_position` 0..10 or record `hill_position_nochange_reason`.
- Completion: child UoWs shipped/dispositioned first; Bet may move toward handoff. Final `phase: shipped` remains operator-ratified.

## 11. Stop conditions

Stop the affected Bet lane and report blocker if:

- Obsidian SSOT cannot be read and DevOS indexed context is insufficient.
- `devos_validate_build_eligibility` returns `build_eligible=false`.
- Build eligibility is degraded/null and no operator decision exists.
- Bet is `shaped` and not operator-committed.
- Parent Pitch is not accepted.
- ADR/FR/NFR required chain is incomplete.
- Blueprint proposes scope expansion beyond appetite instead of scope hammering.
- Any UoW risk is `CRITICAL`.
- Any UoW risk is `HIGH` without `risk_authorized`.
- Worktree creation fails or branch has unrelated uncommitted changes.
- File-overlap/fencing conflict occurs inside a wave.
- Temper blocks the same UoW twice.
- Lifecycle state repair would require forced transition.

## 12. Next-session entry prompt

Use the prompt in the final answer of the session that updates this roadmap. It should say:

- Use Korean for user-facing replies.
- Read this roadmap and refreshed forge skill first.
- Bet-level parallel lanes are required.
- One Bet per agent/session/worktree.
- Dependency barriers govern Hammer/merge.
- Use `$forge` with Bet IDs, not UoW IDs.
