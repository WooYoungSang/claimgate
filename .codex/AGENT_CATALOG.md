## Agent Catalog

Total agents: **70**.

| Agent | applies_to | Description |
|-------|------------|-------------|
| `adr-author` | python, any | Author ADR artifacts from Obsidian templates; propose-only when no dedicated ADR create tool is exposed. |
| `analyst` | any | Requirements gap and analysis agent. |
| `api-engineer` | python, any | Implement context_devos/read_api/ Read MCP API. |
| `api-engineer-write` | python, any | Implement context_devos/write_api/ Write-back API. |
| `architect` | any | Architecture cross-check and decision agent. |
| `bet-advancer` | python, any | Advance Bet phase and checkpoint via devos_advance_bet/checkpoint_bet. |
| `bet-author` | python, any | Author Bet artifacts via devos_create_bet. |
| `bet-kill-keeper` | python, any | Execute Bet kill flow via devos_kill_bet with evidence. |
| `bet-ratifier` | python, any | Ratify Bet projections via devos_ratify_projection on the Bet ship line. |
| `cache-engineer` | python, any | Implement context_devos/cache/ LRU + Circuit Breaker. |
| `canonical-domain-mapper` | python, any | Maintain src/context_devos/canonical_domain/ models and mappings. |
| `code-reviewer` | any | Read-only code review pass. |
| `collab-engineer` | python, any | Implement context_devos/collab/ multi-AI collaboration. |
| `continuity-architect` | python, any | Own context_devos/continuity/ Charter and Compaction. |
| `contract-reviewer` | python, any | Read-only contract and docs review for SSOT compliance. |
| `cooldown-keeper` | python, any | Author Cooldown notes and shepherd cooldown-phase artifacts. |
| `critic` | any | Read-only plan critique agent. |
| `ctrl-tower-codex-dispatcher` | any | Control Tower orchestrator-side helper that prepares one UoW Codex MCP dispatch with SCOPE_BOUNDARY, AC mapping, and a return envelope contract. |
| `ctrl-tower-wave-ratifier` | any | Wave close helper that converts Codex MCP envelopes into critic, verifier, and human approval_ref prompts while preserving Rule 8 no self-approval. |
| `dashboard-renderer` | python, any | Propose-only renderer for src/context_devos/dashboards. |
| `designer` | any | UI / UX design agent. |
| `dev-session-engineer` | python, any | Maintain DevSession library code (state machine, journal, evidence persistence) in V3 modules after Wave-11 absorb. |
| `dev-session-runner` | python, any | Orchestrate ShapeOps DevSession lifecycle (start→plan→advance→update→verify→end) with context bootstrap, lesson preparation, and review_required HITL gate. Execution SSOT for the /dev-session skill. |
| `document-specialist` | any | External docs lookup specialist (read-only). |
| `evidence-persistence-engineer` | python, any | Persist Lesson and evidence artifacts. |
| `executor` | any | Implementation agent for scoped multi-file changes. |
| `explore` | any | Codebase exploration agent (read-only). |
| `final-integration-verifier` | python, any | Read-only E2E verifier across stacks at release time. |
| `fr-author` | python, any | Author Functional Requirement artifacts via devos_create_fr. |
| `governance-validator` | python, any | Run governance and validation passes on artifact contracts. |
| `graphrag-engineer` | python, any | Maintain context_devos/graphrag embedding and indexing modules. |
| `graphrag-perf-analyst` | python, any | Projection/retrieval 성능 측정·병목 분석·최적화 plan 작성 (read-only, 측정 evidence + 리포트만 산출). |
| `graphrag-specialist` | python, any | Cross-cutting retrieval 3-lane and dual_retrieve integration. |
| `handoff-coordinator` | python, any | Author and coordinate HANDOFF artifacts between phases. |
| `impl-evaluator` | python, any | Fix non-blocking Phase Gate issues (golden updates, mock paths). |
| `infra-architect` | python, any | Own context_devos/schema, sync, and errors subpackages. |
| `infra-engineer` | python, any | Docker, Jenkins, infra/, and deployment configuration. |
| `jenkins-deployment-engineer` | python, any | Drive Jenkins deployment pipelines and runbooks. |
| `langchain-mcp-engineer` | python, any | Engineer src/mcp_server StructuredTool registrations and LangGraph nodes. |
| `lesson-preparer` | python, any | Prepare Lesson artifacts via devos_prepare_lesson. |
| `lifecycle-architect` | python, any | Own ShapeOps lifecycle orchestration across phases (pitch -> bet -> ship). |
| `mcp-surface-engineer` | python, any | Maintain src/mcp_server tool surface contracts. |
| `nfr-author` | python, any | Author Non-Functional Requirement artifacts via devos_create_nfr. |
| `obsidian-adapter-engineer` | python, any | Maintain adapters/obsidian-source/ Obsidian vault I/O. |
| `patch-writer` | python, any | Author traceable patches with provenance links. |
| `pitch-author` | python, any | Author Pitch artifacts via devos_create_pitch. |
| `planner` | any | Planning agent for multi-step work. |
| `platform-engineer` | python, any | Own context_devos/bootstrap/ platform initialization. |
| `python-domain-engineer` | python, any | Own libs/ and adapters/ domain models for the warvis-ignis project. |
| `python-generic-engineer` | python, any | Cross-project python helpers (scripts, patches) outside libs/ domain scope. |
| `qa-tester` | python, any | Read-only Sprint gate regression runs and QA report assembly. |
| `release-engineer` | python, any | Release flow coordination agent. |
| `reporting-analyst` | python, any | Implement context_devos/reporting/ APIs. |
| `safety-engineer` | python, any | Own context_devos/safety/ Guards R1-R8. |
| `saga-engineer` | python, any | Implement context_devos/saga/ orchestrator and WAL. |
| `scope-author` | python, any | Author Scope artifacts via devos_create_scope. |
| `security-reviewer` | python, any | Read-only security review agent. |
| `session-archivist` | python, any | Session journal and archive hygiene agent. |
| `shapeops-gate-progressor` | python, any | Propose-only Gate writer that advances ShapeOps gates with evidence. |
| `shared-infra-contract-keeper` | python, any | Keep shared infra contracts (contracts/) consistent. |
| `slug-minter-guardian` | python, any | Propose-only guardian for src/context_devos/artifacts/slug_minter.py invariants. |
| `test-engineer` | python, any | Author and maintain unit, integration, contract, and e2e tests. |
| `uow-author` | python, any | Author UoW artifacts via the current devos_create_scope compatibility surface. |
| `verifier` | any | Read-only verification of completion claims with evidence. |
| `warvis-finisher` | python, any | WARVIS forge stage 5 (Quench) — finalize verified session. Calls devos_prepare_lesson + devos_end_dev_session. Handles review_required HITL gate. Never self-approves Obsidian state. |
| `warvis-initiator` | python, any | WARVIS forge stage 1 (Ignite) — start a ShapeOps DevSession via devos_start_dev_session after baseline health/identity checks. Returns harness config + dev_session_id to the main /forge coordinator. |
| `warvis-maker` | python, any | WARVIS forge stage 3 (Hammer) — implement ONE UoW within a Bet-forge wave via TDD red→green→refactor per milestone, record evidence, advance dev session. Used when implementer=claude; the DEFAULT Hammer implementer is Codex MCP (ctrl-tower-codex-dispatcher). Returns implementation envelope to main /forge coordinator. No verifier role. |
| `warvis-planner` | python, any | WARVIS forge stage 2 (Blueprint) — decompose a Bet into N UoW work-spec contracts (scope + done + FR/NFR/AC links), assign file-disjoint parallel waves, set per-UoW milestones + risk + safety_class. Read-only propose; main coordinator materializes UoW nodes. Returns blueprint envelope to main /forge coordinator. |
| `warvis-verifier` | python, any | WARVIS forge stage 4 (Temper) — run quality gates (Lint → Type → Unit → Integration → Security) and call devos_verify_dev_session. Emits PASS / PASS_WITH_WARN / BLOCK verdict. Does NOT auto-repair — returns failure list to main coordinator. |
| `writer` | any | Docs and prose writing agent. |
