## MCP Tool Catalog

Source: contracts/mcp/tool_registry.json (live SSOT, 111 tools at render time). The previous hand-curated catalog is retired — this table mirrors the registry directly.

| Tool | Category | One-line summary |
|------|----------|------------------|
| `devos_advance_dev_session` | DevSession | Transition session from PLAN phase to IMPLEMENT phase. Order diagnostics: next_allowed_event, when present, is the advisory next event in the canonical 9-event chain; not enforced. |
| `devos_block_dev_session` | DevSession | Block session due to external dependency (IMPLEMENT → BLOCKED). |
| `devos_end_dev_session` | DevSession | Finalize dev session and optionally store lesson (last step in lifecycle). registration_only_skip=True is an opt-in registration-only close path that records an audit log and leaves strict verify as the default. provisional_uow_approval_ref is an explicit human approval reference for closing a session whose UoW cannot be resolved canonically. |
| `devos_pause_dev_session` | DevSession | Pause active session (IMPLEMENT → PAUSE) preserving context for later resume. |
| `devos_plan_dev_session` | DevSession | Plan dev session milestones, verification steps, and task decomposition. plan_task_count=0 is valid and means no enumerated tasks yet; downstream advance with force=False rejects until tasks exist, while force=True keeps the existing override behavior. safety_class auto-derives from risk_level (CRITICAL/HIGH->A, MEDIUM->B, LOW->C); explicit safety_class must agree with risk_level mapping or VALIDATION_ERROR; UoW.safety_class graph node prop persists across verify. Order diagnostics: next_allowed_event, when present, is the advisory next event in the canonical 9-event chain; not enforced. |
| `devos_prepare_lesson` | DevSession | Extract and store a lesson from dev session work (for knowledge compaction). |
| `devos_record_evidence` | DevSession | Record session artifacts (code diffs, test results, screenshots) for tracing. A-class fr_trace auto-derives server-side from the UoW->Bet->FR chain when omitted; explicit fr_trace wins. |
| `devos_record_implementation_attempt` | DevSession | Record an implementation attempt and update UoW status without ratification. |
| `devos_resume_dev_session` | DevSession | Resume paused dev session (PAUSE → IMPLEMENT) restoring prior context. |
| `devos_revoke_approval` | DevSession | Revoke a prior devos_ratify_projection call within the grace window (Bet R-3). |
| `devos_start_dev_session` | DevSession | Initialize a dev session (first step in session lifecycle). bet_resolved is best-effort: False or unresolved can reflect projection lag from _get_store() reads, while bet_resolved=None with bet_resolution='unknown' is a degraded structured shape rather than a hard error. Order diagnostics: next_allowed_event, when present, is the advisory next event in the canonical 9-event chain; not enforced. |
| `devos_unblock_dev_session` | DevSession | Unblock session when external dependency is resolved (BLOCKED → IMPLEMENT). |
| `devos_update_dev_session` | DevSession | Update session with progress snapshots, milestones, and knowledge deltas. |
| `devos_verify_dev_session` | DevSession | Verify dev session state before ending (scope: passed/failed/skipped checks). registration_only_skip=True is an opt-in lightweight verify skip that records skipped checks and audit evidence. A-class fr_trace auto-derives server-side from the UoW->Bet->FR chain when omitted; explicit fr_trace wins. |
| `devos_advance_bet` | Bet and UoW | Transition a Bet using canonical Vault OS phases. Also activates a proposed Bet with target_phase='active'. |
| `devos_checkpoint_bet` | Bet and UoW | Update bet BUILD phase checkpoint (0%, 50%, 75%, 100% completion). |
| `devos_create_bet` | Bet and UoW | Create a Shape Up bet artifact (committed scope + acceptance criteria; committed_at blank until phase→committed). |
| `devos_create_pitch` | Bet and UoW | Create a Shape Up pitch artifact (problem statement + initial idea). |
| `devos_create_scope` | Bet and UoW | Create a Shape Up Hill Chart Scope artifact linked to a parent Bet. |
| `devos_get_bet_events` | Bet and UoW | Retrieve bet event history (phase changes, checkpoints, kills). |
| `devos_get_bet_progress` | Bet and UoW | Retrieve Shape Up bets with canonical Vault OS phase progress plus committed_at/shipped_at (shaping/shaped/committed/building/reviewing/handoff/shipped/blocked/parked). |
| `devos_get_bet_progress_report` | Bet and UoW | Get detailed bet progress report by phase (scope, risk, blockers). |
| `devos_get_bet_tree` | Bet and UoW | Retrieve hierarchical bet tree (parent/child bets and dependencies). |
| `devos_get_uow_completion_matrix` | Bet and UoW | Get UoW completion matrix (status × phase × size breakdown). |
| `devos_get_uow_detail` | Bet and UoW | Retrieve detailed UoW (unit of work) definition and decomposition. |
| `devos_kill_bet` | Bet and UoW | Kill a candidate/pre-commit Bet and record kill reason; committed Bet closeout must use shipped with ship_mode=full\|cut. |
| `devos_list_bets` | Bet and UoW | List active bets (status=active) in project. |
| `devos_list_pitches` | Bet and UoW | List active pitches (bets in SHAPE phase). |
| `devos_update_scope` | Bet and UoW | Update an existing Shape Up Hill Chart Scope hill_position. |
| `devos_apply_template` | Artifact creation | Apply template to existing project (adds seed artifacts). |
| `devos_create_adr` | Artifact creation | Create an Architecture Decision Record (ADR) artifact for a Bet. |
| `devos_create_fr` | Artifact creation | Create a functional requirement (FR) artifact (feature behavior). |
| `devos_create_gate` | Artifact creation | Create a new Gate artifact (S30-F3 implementation + B-G2 Stage 3 verification). |
| `devos_create_nfr` | Artifact creation | Create a non-functional requirement (NFR) artifact (quality constraint). |
| `devos_list_templates` | Artifact creation | List available project initialization templates. |
| `devos_enter_cooldown` | Gate, Handoff, Cooldown | Enter cooldown phase for a shipped bet. |
| `devos_exit_cooldown` | Gate, Handoff, Cooldown | Exit cooldown phase and transition to closed. |
| `devos_gate_status_update` | Gate, Handoff, Cooldown | Update Gate.phase through the validated state machine. |
| `devos_handoff_accept` | Gate, Handoff, Cooldown | Accept a Handoff (transitions ready → accepted) with Gate pre-condition validation. |
| `devos_handoff_close` | Gate, Handoff, Cooldown | Close a Handoff (transitions accepted → closed or rejected → closed). |
| `devos_handoff_reject` | Gate, Handoff, Cooldown | Reject a Handoff (transitions ready → rejected or accepted → rejected). |
| `devos_dual_retrieve` | Retrieval and Knowledge | Dual-path retrieval (Path A vector + Path B GraphRAG synth) with diagnostics envelope. |
| `devos_get_journal_entries` | Retrieval and Knowledge | Retrieve project journal entries (session logs, decision notes, progress). |
| `devos_get_known_pitfalls` | Retrieval and Knowledge | Return prod-ratified pitfalls for an area, optionally narrowed by tool_name. |
| `devos_get_relevant_lessons` | Retrieval and Knowledge | Retrieve lessons relevant to a query using Neo4j vector search. |
| `devos_patch_note` | Retrieval and Knowledge | Update a machine-owned section of an Obsidian note (via Single Writer). |
| `devos_query_code` | Retrieval and Knowledge | Query codebase for functions, classes, or patterns matching text. |
| `devos_retrieve_context` | Retrieval and Knowledge | Retrieve project context chunks matched by query with optional tag filtering. |
| `devos_search_context` | Retrieval and Knowledge | Search project context via semantic or BM25 query. |
| `devos_search_knowledge` | Retrieval and Knowledge | Search project knowledge base (lessons, patterns, decisions). |
| `devos_reasoner_grade_context` | Reasoner | Grade a retrieval context for relevance and emit KPI signals. |
| `devos_reasoner_rewrite_query` | Reasoner | Rewrite a user query given retrieval context (LLM caller-inject). |
| `devos_reasoner_verify_against_evidence` | Reasoner | Verify a claim against an evidence list (entailment verdict). |
| `devos_backfill_legacy_fm` | Graph, Coverage, Scope | Scan legacy ShapeOps notes for missing FM keys that block graph projection. |
| `devos_graph_coverage_audit` | Graph, Coverage, Scope | Audit graph projection coverage — declared vs. observed relationship types. |
| `devos_graph_expand` | Graph, Coverage, Scope | Expand graph node to reveal neighbors up to N hops away. |
| `devos_graph_query` | Graph, Coverage, Scope | Run a structured READ-ONLY graph query against Neo4j. |
| `devos_get_adr_list` | Dashboard and Reports | List architecture decision records (ADRs) with status and justification. |
| `devos_get_dashboard_summary` | Dashboard and Reports | Retrieve project dashboard summary (bets, tasks, metrics, status). |
| `devos_get_dependency_graph` | Dashboard and Reports | Retrieve project dependency graph (artifact/code/module relationships). |
| `devos_get_event_timeline` | Dashboard and Reports | Retrieve project event timeline (recent bet phases, kills, checkpoints). |
| `devos_get_fr_list` | Dashboard and Reports | List functional requirements (FRs) with acceptance criteria and status. |
| `devos_get_goal_progress` | Dashboard and Reports | Compute Pitch objective progress and optional UoW dependency DAG state. |
| `devos_get_index_inventory` | Dashboard and Reports | Return the unique-artifact inventory for a project (read-only). |
| `devos_get_nfr_list` | Dashboard and Reports | List non-functional requirements (NFRs: performance, security, scalability). |
| `devos_get_project_blueprint` | Dashboard and Reports | Return a paginated project blueprint inventory across ShapeOps artifacts. |
| `devos_get_project_roadmap` | Dashboard and Reports | Return a project-level ShapeOps lifecycle DAG snapshot. |
| `devos_get_project_summary` | Dashboard and Reports | Get project-level summary: active/killed bet counts, velocity, health. |
| `devos_get_scope_map` | Dashboard and Reports | Retrieve project scope map (modules, boundaries, ownership). |
| `devos_get_session_history` | Dashboard and Reports | Retrieve dev session history (past sessions, outcomes, lessons). |
| `devos_get_shapeops_root_dashboard` | Dashboard and Reports | Retrieve ShapeOps root dashboards and recent updates. |
| `devos_get_sprint_velocity` | Dashboard and Reports | Get sprint velocity metrics (completed/killed bet ratio, burn chart). |
| `devos_get_task_list` | Dashboard and Reports | Retrieve task list (active and completed tasks with status). |
| `devos_validate_shapeops_consistency` | Dashboard and Reports | Validate ShapeOps state consistency (Bet + Gate + HANDOFF + Lesson alignment). |
| `devos_create_collab_session` | Collab session | Create multi-AI collaboration session (orchestrator-only). |
| `devos_get_collab_session` | Collab session | Retrieve collaboration session state and member list. |
| `devos_join_collab_session` | Collab session | Join an existing collaboration session as a participant agent. |
| `devos_list_collab_sessions` | Collab session | List active collaboration sessions in a project. |
| `devos_terminate_collab_session` | Collab session | Terminate collaboration session and evict all members. |
| `devos_harness_bootstrap` | Harness | Detect stack, load preset (test/lint/build commands), validate applies_to. |
| `devos_harness_health` | Harness | Report harness health: WAL lag, lesson queue depth, stack mismatch count. |
| `devos_harness_install` | Harness | Seed a target project with managed agents, skills, CHANGELOG, and spec files. |
| `devos_harness_propagate` | Harness | Drain propagation queue and compute candidate mutations (dry-run by default). |
| `devos_acquire_fencing_token` | Fencing tokens and Safety | Issue monotonic fencing token or UoW/file-set lease to prevent stale writes in multi-agent scenarios. |
| `devos_evaluate_guards` | Fencing tokens and Safety | Evaluate safety guards R1-R8 for artifact creation (read-only, no mutation). |
| `devos_release_fencing_token` | Fencing tokens and Safety | Release fencing token or UoW/file-set lease to signal write completion and unlock resource. |
| `devos_ratify_projection` | Projection | Ratify (approve) a Bet \| Lesson \| UoW \| ADR artifact or close protected projection reviews. Valid target_phase per type: bet=canonical Vault OS Bet phases (default shipped; legacy shape/build/ship/reflect/done aliases accepted at the boundary), lesson={intent_created,permanent,deprecated}, uow={planned,in_progress,shipped,abandoned}, adr={proposed,accepted,superseded,deprecated}. Optional review_ids closes protected projection review_id batches with approval_ref. review_id values are server-issued; callers must use returned review_id values and must not invent them. |
| `devos_get_project_state` | Project lifecycle | Retrieve full project state: summary, recent sessions, task counts. |
| `devos_get_runtime_status` | Project lifecycle | Retrieve runtime status: active session, service health, protocol version. |
| `devos_health_check` | Project lifecycle | Confirm service health status (app, MCP, runtime, and backend services). |
| `devos_index_code` | Project lifecycle | Index a project's source tree into Neo4j CodeSymbol rows. max_embed_batches bounds embedding work per call when with_embeddings=True: None preserves full synchronous backfill; N embeds at most N * batch_size symbols, then re-call until embed_remaining reaches 0. |
| `devos_init_project` | Project lifecycle | Initialize project from template (creates seed Pitch and Bet). |
| `devos_project_reproject` | Project lifecycle | Re-project vault notes (and optional explicit paths) into Neo4j ShapeOps graph. |
| `devos_validate_project` | Project lifecycle | Validate project structure (Pitch, Bet, FR/NFR presence). |
| `devos_advise_bet_myosan` | Other | LLM draft decision advisory for a Bet (read-only, non-authoritative). |
| `devos_advise_evidence_consistency` | Other | Propose an evidence-consistency advisory for a reasoner verdict. |
| `devos_classify_divergence` | Other | Classify the likely cause of a vault↔graph divergence for one artifact (read-only advisory). |
| `devos_collapse_duplicate_node` | Other | Collapse an approval-gated duplicate alias graph node into a canonical node. |
| `devos_create_charter` | Other | Create a Charter-OS project charter artifact. |
| `devos_create_handoff` | Other | Create a Handoff in ready phase through the HandoffWriter. |
| `devos_curator_run` | Other | Run the curator trigger as a two-phase propose-only orchestration. Delegates to context_devos.curator.orchestrator.run with honest-stub embedding/text adapters and returns serialized transitions, proposals, ran, candidate_count, cluster_count, propose_only, and write_count=0. |
| `devos_explain_project_blueprint` | Other | Explain a project blueprint with a non-authoritative LLM narrative advisory. |
| `devos_get_parallel_safe_batch` | Other | Partition ready_to_implement UoWs into file-disjoint parallel batches. |
| `devos_get_role_tool_allowlist` | Other | Return advisory sanctioned MCP tools for a Codex persona role. |
| `devos_reconcile_divergence` | Other | Reconcile vault↔graph divergence by re-projecting diverged artifacts (vault-wins). |
| `devos_reconcile_terminal_status` | Other | Migrate legacy graph Bet `status` values onto the pure-visibility vocabulary (active\|draft\|waiting\|someday\|done\|archived). |
| `devos_repair_session_uow` | Other | Append an approved corrective SESSION_UOW_REPAIRED marker to session history. |
| `devos_semantic_review_diff` | Other | Pre-flag which R-SG rule ids a unified diff might touch (read-only advisory). |
| `devos_transition_state` | Other | Transition a ShapeOps artifact canonical shapeops_state. |
| `devos_update_pitch` | Other | Patch an existing Pitch frontmatter block through raw YAML. |
| `devos_validate_build_eligibility` | Other | Judge whether a Bet's section-4 definition chain is build-eligible (read-only pre-build gate). |

Catalog count: 111 tools.