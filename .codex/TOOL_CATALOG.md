# Tool Catalog

Total registered MCP tools: **111**.

| Tool | Description |
|------|-------------|
| `devos_acquire_fencing_token` | Issue monotonic fencing token or UoW/file-set lease to prevent stale writes in multi-agent scenarios. |
| `devos_advance_bet` | Transition a Bet using canonical Vault OS phases. Also activates a proposed Bet with target_phase='active'. |
| `devos_advance_dev_session` | Transition session from PLAN phase to IMPLEMENT phase. Order diagnostics: next_allowed_event, when present, is the advisory next event in the canonical 9-event chain; not enforced. |
| `devos_advise_bet_myosan` | LLM draft decision advisory for a Bet (read-only, non-authoritative). |
| `devos_advise_evidence_consistency` | Propose an evidence-consistency advisory for a reasoner verdict. |
| `devos_apply_template` | Apply template to existing project (adds seed artifacts). |
| `devos_backfill_legacy_fm` | Scan legacy ShapeOps notes for missing FM keys that block graph projection. |
| `devos_block_dev_session` | Block session due to external dependency (IMPLEMENT → BLOCKED). |
| `devos_checkpoint_bet` | Update bet BUILD phase checkpoint (0%, 50%, 75%, 100% completion). |
| `devos_classify_divergence` | Classify the likely cause of a vault↔graph divergence for one artifact (read-only advisory). |
| `devos_collapse_duplicate_node` | Collapse an approval-gated duplicate alias graph node into a canonical node. |
| `devos_create_adr` | Create an Architecture Decision Record (ADR) artifact for a Bet. |
| `devos_create_bet` | Create a Shape Up bet artifact (committed scope + acceptance criteria; committed_at blank until phase→committed). |
| `devos_create_charter` | Create a Charter-OS project charter artifact. |
| `devos_create_collab_session` | Create multi-AI collaboration session (orchestrator-only). |
| `devos_create_fr` | Create a functional requirement (FR) artifact (feature behavior). |
| `devos_create_gate` | Create a new Gate artifact (S30-F3 implementation + B-G2 Stage 3 verification). |
| `devos_create_handoff` | Create a Handoff in ready phase through the HandoffWriter. |
| `devos_create_nfr` | Create a non-functional requirement (NFR) artifact (quality constraint). |
| `devos_create_pitch` | Create a Shape Up pitch artifact (problem statement + initial idea). |
| `devos_create_scope` | Create a Shape Up Hill Chart Scope artifact linked to a parent Bet. |
| `devos_curator_run` | Run the curator trigger as a two-phase propose-only orchestration. Delegates to context_devos.curator.orchestrator.run with honest-stub embedding/text adapters and returns serialized transitions, proposals, ran, candidate_count, cluster_count, propose_only, and write_count=0. |
| `devos_dual_retrieve` | Dual-path retrieval (Path A vector + Path B GraphRAG synth) with diagnostics envelope. |
| `devos_end_dev_session` | Finalize dev session and optionally store lesson (last step in lifecycle). registration_only_skip=True is an opt-in registration-only close path that records an audit log and leaves strict verify as the default. provisional_uow_approval_ref is an explicit human approval reference for closing a session whose UoW cannot be resolved canonically. |
| `devos_enter_cooldown` | Enter cooldown phase for a shipped bet. |
| `devos_evaluate_guards` | Evaluate safety guards R1-R8 for artifact creation (read-only, no mutation). |
| `devos_exit_cooldown` | Exit cooldown phase and transition to closed. |
| `devos_explain_project_blueprint` | Explain a project blueprint with a non-authoritative LLM narrative advisory. |
| `devos_gate_status_update` | Update Gate.phase through the validated state machine. |
| `devos_get_adr_list` | List architecture decision records (ADRs) with status and justification. |
| `devos_get_bet_events` | Retrieve bet event history (phase changes, checkpoints, kills). |
| `devos_get_bet_progress` | Retrieve Shape Up bets with canonical Vault OS phase progress plus committed_at/shipped_at (shaping/shaped/committed/building/reviewing/handoff/shipped/blocked/parked). |
| `devos_get_bet_progress_report` | Get detailed bet progress report by phase (scope, risk, blockers). |
| `devos_get_bet_tree` | Retrieve hierarchical bet tree (parent/child bets and dependencies). |
| `devos_get_collab_session` | Retrieve collaboration session state and member list. |
| `devos_get_dashboard_summary` | Retrieve project dashboard summary (bets, tasks, metrics, status). |
| `devos_get_dependency_graph` | Retrieve project dependency graph (artifact/code/module relationships). |
| `devos_get_event_timeline` | Retrieve project event timeline (recent bet phases, kills, checkpoints). |
| `devos_get_fr_list` | List functional requirements (FRs) with acceptance criteria and status. |
| `devos_get_goal_progress` | Compute Pitch objective progress and optional UoW dependency DAG state. |
| `devos_get_index_inventory` | Return the unique-artifact inventory for a project (read-only). |
| `devos_get_journal_entries` | Retrieve project journal entries (session logs, decision notes, progress). |
| `devos_get_known_pitfalls` | Return prod-ratified pitfalls for an area, optionally narrowed by tool_name. |
| `devos_get_nfr_list` | List non-functional requirements (NFRs: performance, security, scalability). |
| `devos_get_parallel_safe_batch` | Partition ready_to_implement UoWs into file-disjoint parallel batches. |
| `devos_get_project_blueprint` | Return a paginated project blueprint inventory across ShapeOps artifacts. |
| `devos_get_project_roadmap` | Return a project-level ShapeOps lifecycle DAG snapshot. |
| `devos_get_project_state` | Retrieve full project state: summary, recent sessions, task counts. |
| `devos_get_project_summary` | Get project-level summary: active/killed bet counts, velocity, health. |
| `devos_get_relevant_lessons` | Retrieve lessons relevant to a query using Neo4j vector search. |
| `devos_get_role_tool_allowlist` | Return advisory sanctioned MCP tools for a Codex persona role. |
| `devos_get_runtime_status` | Retrieve runtime status: active session, service health, protocol version. |
| `devos_get_scope_map` | Retrieve project scope map (modules, boundaries, ownership). |
| `devos_get_session_history` | Retrieve dev session history (past sessions, outcomes, lessons). |
| `devos_get_shapeops_root_dashboard` | Retrieve ShapeOps root dashboards and recent updates. |
| `devos_get_sprint_velocity` | Get sprint velocity metrics (completed/killed bet ratio, burn chart). |
| `devos_get_task_list` | Retrieve task list (active and completed tasks with status). |
| `devos_get_uow_completion_matrix` | Get UoW completion matrix (status × phase × size breakdown). |
| `devos_get_uow_detail` | Retrieve detailed UoW (unit of work) definition and decomposition. |
| `devos_graph_coverage_audit` | Audit graph projection coverage — declared vs. observed relationship types. |
| `devos_graph_expand` | Expand graph node to reveal neighbors up to N hops away. |
| `devos_graph_query` | Run a structured READ-ONLY graph query against Neo4j. |
| `devos_handoff_accept` | Accept a Handoff (transitions ready → accepted) with Gate pre-condition validation. |
| `devos_handoff_close` | Close a Handoff (transitions accepted → closed or rejected → closed). |
| `devos_handoff_reject` | Reject a Handoff (transitions ready → rejected or accepted → rejected). |
| `devos_harness_bootstrap` | Detect stack, load preset (test/lint/build commands), validate applies_to. |
| `devos_harness_health` | Report harness health: WAL lag, lesson queue depth, stack mismatch count. |
| `devos_harness_install` | Seed a target project with managed agents, skills, CHANGELOG, and spec files. |
| `devos_harness_propagate` | Drain propagation queue and compute candidate mutations (dry-run by default). |
| `devos_health_check` | Confirm service health status (app, MCP, runtime, and backend services). |
| `devos_index_code` | Index a project's source tree into Neo4j CodeSymbol rows. max_embed_batches bounds embedding work per call when with_embeddings=True: None preserves full synchronous backfill; N embeds at most N * batch_size symbols, then re-call until embed_remaining reaches 0. |
| `devos_init_project` | Initialize project from template (creates seed Pitch and Bet). |
| `devos_join_collab_session` | Join an existing collaboration session as a participant agent. |
| `devos_kill_bet` | Kill a candidate/pre-commit Bet and record kill reason; committed Bet closeout must use shipped with ship_mode=full\|cut. |
| `devos_list_bets` | List active bets (status=active) in project. |
| `devos_list_collab_sessions` | List active collaboration sessions in a project. |
| `devos_list_pitches` | List active pitches (bets in SHAPE phase). |
| `devos_list_templates` | List available project initialization templates. |
| `devos_patch_note` | Update a machine-owned section of an Obsidian note (via Single Writer). |
| `devos_pause_dev_session` | Pause active session (IMPLEMENT → PAUSE) preserving context for later resume. |
| `devos_plan_dev_session` | Plan dev session milestones, verification steps, and task decomposition. plan_task_count=0 is valid and means no enumerated tasks yet; downstream advance with force=False rejects until tasks exist, while force=True keeps the existing override behavior. safety_class auto-derives from risk_level (CRITICAL/HIGH->A, MEDIUM->B, LOW->C); explicit safety_class must agree with risk_level mapping or VALIDATION_ERROR; UoW.safety_class graph node prop persists across verify. Order diagnostics: next_allowed_event, when present, is the advisory next event in the canonical 9-event chain; not enforced. |
| `devos_prepare_lesson` | Extract and store a lesson from dev session work (for knowledge compaction). |
| `devos_project_reproject` | Re-project vault notes (and optional explicit paths) into Neo4j ShapeOps graph. |
| `devos_query_code` | Query codebase for functions, classes, or patterns matching text. |
| `devos_ratify_projection` | Ratify (approve) a Bet \| Lesson \| UoW \| ADR artifact or close protected projection reviews. Valid target_phase per type: bet=canonical Vault OS Bet phases (default shipped; legacy shape/build/ship/reflect/done aliases accepted at the boundary), lesson={intent_created,permanent,deprecated}, uow={planned,in_progress,shipped,abandoned}, adr={proposed,accepted,superseded,deprecated}. Optional review_ids closes protected projection review_id batches with approval_ref. review_id values are server-issued; callers must use returned review_id values and must not invent them. |
| `devos_reasoner_grade_context` | Grade a retrieval context for relevance and emit KPI signals. |
| `devos_reasoner_rewrite_query` | Rewrite a user query given retrieval context (LLM caller-inject). |
| `devos_reasoner_verify_against_evidence` | Verify a claim against an evidence list (entailment verdict). |
| `devos_reconcile_divergence` | Reconcile vault↔graph divergence by re-projecting diverged artifacts (vault-wins). |
| `devos_reconcile_terminal_status` | Migrate legacy graph Bet `status` values onto the pure-visibility vocabulary (active\|draft\|waiting\|someday\|done\|archived). |
| `devos_record_evidence` | Record session artifacts (code diffs, test results, screenshots) for tracing. A-class fr_trace auto-derives server-side from the UoW->Bet->FR chain when omitted; explicit fr_trace wins. |
| `devos_record_implementation_attempt` | Record an implementation attempt and update UoW status without ratification. |
| `devos_release_fencing_token` | Release fencing token or UoW/file-set lease to signal write completion and unlock resource. |
| `devos_repair_session_uow` | Append an approved corrective SESSION_UOW_REPAIRED marker to session history. |
| `devos_resume_dev_session` | Resume paused dev session (PAUSE → IMPLEMENT) restoring prior context. |
| `devos_retrieve_context` | Retrieve project context chunks matched by query with optional tag filtering. |
| `devos_revoke_approval` | Revoke a prior devos_ratify_projection call within the grace window (Bet R-3). |
| `devos_search_context` | Search project context via semantic or BM25 query. |
| `devos_search_knowledge` | Search project knowledge base (lessons, patterns, decisions). |
| `devos_semantic_review_diff` | Pre-flag which R-SG rule ids a unified diff might touch (read-only advisory). |
| `devos_start_dev_session` | Initialize a dev session (first step in session lifecycle). bet_resolved is best-effort: False or unresolved can reflect projection lag from _get_store() reads, while bet_resolved=None with bet_resolution='unknown' is a degraded structured shape rather than a hard error. Order diagnostics: next_allowed_event, when present, is the advisory next event in the canonical 9-event chain; not enforced. |
| `devos_terminate_collab_session` | Terminate collaboration session and evict all members. |
| `devos_transition_state` | Transition a ShapeOps artifact canonical shapeops_state. |
| `devos_unblock_dev_session` | Unblock session when external dependency is resolved (BLOCKED → IMPLEMENT). |
| `devos_update_dev_session` | Update session with progress snapshots, milestones, and knowledge deltas. |
| `devos_update_pitch` | Patch an existing Pitch frontmatter block through raw YAML. |
| `devos_update_scope` | Update an existing Shape Up Hill Chart Scope hill_position. |
| `devos_validate_build_eligibility` | Judge whether a Bet's section-4 definition chain is build-eligible (read-only pre-build gate). |
| `devos_validate_project` | Validate project structure (Pitch, Bet, FR/NFR presence). |
| `devos_validate_shapeops_consistency` | Validate ShapeOps state consistency (Bet + Gate + HANDOFF + Lesson alignment). |
| `devos_verify_dev_session` | Verify dev session state before ending (scope: passed/failed/skipped checks). registration_only_skip=True is an opt-in lightweight verify skip that records skipped checks and audit evidence. A-class fr_trace auto-derives server-side from the UoW->Bet->FR chain when omitted; explicit fr_trace wins. |
