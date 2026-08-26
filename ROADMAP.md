# ClaimGate Roadmap

Last updated: 2026-08-26

This roadmap communicates direction, not guaranteed dates. ClaimGate is currently a solo-maintained, pre-1.0 project. Priorities may change based on reproducible issues, contributor capacity, and evidence from real review scenarios.

## Available now: deterministic v0 framework

- Framework-independent claim, source-anchor, risk-trace, review, and Evidence Pack contracts.
- Deterministic reviewer workflow enforcing No Anchor, No Claim and verified/corrected-only projection.
- Controlled React review components and an offline example application.
- Civic data, health data, and MOFA ODA DomainPacks with fixture-driven conformance tests.
- Report and graph projection guards.
- Reproducible local lint, typecheck, unit, conformance, end-to-end, and performance-smoke commands.
- Repo-local persistent sparse retrieval for the optional MOFA ODA candidate-extraction demo.

The default v0 path remains offline and fixture-first. It does not claim production hosting, live public-data retrieval, autonomous fact checking, or model-decided truth.

## Active: submission and candidate-extraction hardening

- Improve public onboarding, governance, issue intake, licensing evidence, and evaluator-facing documentation.
- Close the optional Local Gemma adapter loop from candidate-only LoRA training evidence to reproducible local serving and holdout evaluation.
- Require machine-consumable candidate output and reject attempts to assign reviewer, risk, anchoring, or projection authority to the model.
- Keep the deterministic framework usable without a model or external service.

Fine-tuning is an optional adapter milestone, not a prerequisite for the core review framework. Completion will be claimed only when repository checks and retained evaluation evidence support it.

## Next: extensibility and adoption evidence

- Document a complete third-party DomainPack authoring walkthrough.
- Stabilize conformance fixtures and compatibility expectations for pack authors.
- Add more negative tests for malicious or malformed candidate proposals and projection attempts.
- Collect issue-driven feedback from people evaluating ClaimGate outside the original scenarios.
- Define a versioning and deprecation policy before a stable public API release.

## Later: explicitly out of v0

The following are possible future directions, not implemented features or commitments:

- live public-data adapters with provenance-preserving snapshots;
- production-grade retrieval evaluation and pluggable embedding/vector backends;
- server persistence, authentication, and multi-user review workflows;
- accessibility and localization validation across more host applications;
- stable package publication and a broader DomainPack ecosystem.

Any work in these areas must preserve reviewer authority, deterministic risk traces, source anchors, and Evidence Pack projection guards.

## How to influence priorities

Use the [issue chooser](https://github.com/WooYoungSang/claimgate/issues/new/choose) and select the feature request form for a problem-backed proposal or the DomainPack proposal form for a new domain. Include the affected user, evidence, smallest useful outcome, alternatives, and invariant impact. See [`GOVERNANCE.md`](GOVERNANCE.md) for how decisions are made.

Before starting a substantial implementation, wait for scope alignment from the maintainer. This avoids implying that roadmap placement guarantees acceptance or a delivery date.
