# ClaimGate Agent Guide

## Project

- Project: ClaimGate
- Product: open-source claim review framework for source-grounded AI/public-data outputs
- Stack: TypeScript strict, pnpm monorepo, React 18, Vite, Vitest, tsup
- Runtime target: Node >=20
- v0 boundary: offline, deterministic, fixture-first; no server, database, auth, multitenancy, OCR, online retrieval, or hosted model dependency in the core demo path

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm demo
pnpm demo:ai:mock
pnpm test:kbctl
pnpm audit:harness:gpt56
```

## kbctl is the context SSOT

- The repo-local authority for ClaimGate product context, DDD modelling, design decisions, knowledge gaps, ubiquitous language, events, contexts, invariants, aggregates, use cases, implementation notes, roadmap/workpacket state, and contest-submission planning is `governance/knowledge/claimgate-kb.json`.
- Access and mutate that knowledge base only through `./kbctl` unless repairing the tool itself.
- Before design, refactor, submission, or architecture work, query first: `./kbctl search <query> --kind ...`, `./kbctl list <kind>`, or `./kbctl get <kind> <id>`.
- Unknown domain behavior becomes a `question`/Knowledge Gap. Do not fill unknowns from inference.
- Decisions become `decision` records and should update linked rule/question/term/event/command/aggregate/usecase records when applicable.
- Human-readable design Markdown is a generated view only. Store canonical records with `./kbctl create|update ...`, then render with `./kbctl render all --out .` when needed.
- After KB or generated-view changes, run `./kbctl verify`.

## ClaimGate product invariants

- No Anchor, No Claim: a claim without a Source Anchor cannot become `verified` or `corrected`.
- AI Curator, Not Judge: AI/local LLM/RAG may propose candidate claims and anchors only. It must not verify, score truth, decide risk, or project claims.
- Deterministic risk: risk labels come from explicit rules with rule traces, not model opinion.
- Evidence Pack First: only `verified` or `corrected` claims may enter Evidence Pack, report, or graph projections.
- Core purity: `@claimgate/core` stays framework-independent TypeScript. It must not import UI, examples, or domain packs.
- UI boundary: `@claimgate/ui` owns controlled React components only.
- DomainPack boundary: packs own fixtures, domain rules, and judgment policy extensions; they cannot override core invariants.

## DDD/refactor protocol

Use the kbctl-backed protocol already captured in the KB:

1. choose one business scenario;
2. write the domain story;
3. split KNOWN / ASSUMED / UNKNOWN / CONFLICTED;
4. use a metaphor only as a discovery hypothesis;
5. record metaphor mismatch as Knowledge Gap;
6. convert answers to ubiquitous language, events, commands, invariants, aggregates, use cases;
7. implement one vertical slice with tests;
8. feed implementation questions back into the KB.

## GPT-5.6-sol harness rules

- Active local target model: `gpt-5.6-sol`.
- Keep prompts lean: state instructions once, define success criteria, approval boundaries, and verification.
- Put durable project policy in `AGENTS.md`; reusable workflows in `.agents/skills`; narrow specialist roles in `.codex/agents`; deterministic lifecycle checks in hooks.
- Hooks must be small, deterministic, trust-reviewable, and local-repo only.
- Do not rely on external lifecycle servers or private operator services for ClaimGate development context; use `kbctl` wherever repo-local knowledge is sufficient.

## Safety

- Do not read or echo secrets (`.env`, `secrets/**`, `*secret*`, private keys, tokens).
- Ask before force-push, deployment, external sending, secret access, or destructive operations not explicitly requested.
- Keep diffs small when possible. For behavior changes, prefer RED → GREEN → REFACTOR and run targeted tests before broad suites.
- Before claiming completion, report validation evidence or the reason validation could not run.
