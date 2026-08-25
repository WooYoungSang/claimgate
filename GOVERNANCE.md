# ClaimGate Governance

ClaimGate is an open-source project under the MIT License. This document describes how the project is maintained today and how participation can grow without implying contributor activity that has not happened.

## Current model

ClaimGate currently uses a **single-maintainer** governance model.

- **Maintainer:** [@WooYoungSang](https://github.com/WooYoungSang)
- The maintainer triages issues, reviews pull requests, manages releases, and makes final project decisions.
- There are currently no appointed co-maintainers, committers, or working groups.
- No response-time or release-date service-level agreement is promised.

The current model is a statement of project responsibility, not a claim that all proposals will be accepted.

## Decision process

### Routine changes

Bug fixes, documentation improvements, tests, fixtures, and narrowly scoped refactors can be proposed through an issue or pull request. The maintainer evaluates them against:

1. the documented problem and reproducible evidence;
2. ClaimGate's product invariants and package boundaries;
3. backward-compatibility and maintenance cost;
4. deterministic test coverage; and
5. the v0 offline, fixture-first scope.

The maintainer records the outcome in the issue or pull request. A merge is the final acceptance signal.

### Significant changes

Open a feature issue before implementing a change that affects public APIs, package boundaries, persisted artifact formats, domain terminology, reviewer authority, risk rules, or release scope. The proposal should include alternatives, migration impact, tests, and unresolved questions.

ClaimGate uses `kbctl` as its repository-local design and domain-decision index. The maintainer is responsible for recording accepted domain decisions or knowledge gaps there; contributors do not need to edit generated design views directly.

### Non-negotiable invariants

Changes may not bypass these project contracts:

- **No Anchor, No Claim:** an unanchored claim cannot become verified or corrected.
- **AI Curator, Not Judge:** AI may propose candidates and anchors only; it cannot verify, assign final risk, or project claims.
- **Deterministic risk:** final labels come from explicit rules with traces.
- **Evidence Pack First:** only verified or corrected claims enter reports or graph projections.
- **Core purity:** `@claimgate/core` remains framework-independent TypeScript.

A proposal to change an invariant requires an explicit public rationale and maintainer decision before code work starts. Until such a decision is accepted, the existing invariant controls.

## Roles and progression

Anyone may report bugs, request features, improve docs, or propose code. Repository permissions are earned through sustained, constructive participation; they are not automatic.

Possible future roles are:

- **Contributor:** anyone with an accepted contribution.
- **Triager:** a contributor trusted to reproduce reports and organize issues.
- **Maintainer:** a contributor trusted with review, release, and governance responsibility.

The project has not appointed these additional roles yet. If participation grows, the maintainer may nominate a contributor based on demonstrated judgment, respectful collaboration, review quality, and repeated preservation of project invariants. Role changes will be documented publicly in this file.

## Issue and pull request lifecycle

1. Use the closest issue form and provide reproducible evidence.
2. The maintainer labels, scopes, closes, or requests more information as availability permits.
3. For non-trivial work, wait for scope agreement before investing in a large implementation.
4. Open a focused pull request linked to the issue, including tests and documentation.
5. Address review findings without rewriting unrelated history or files.
6. The maintainer merges, requests changes, or closes with a reason.

Issues may be closed when they are out of scope, duplicate, inactive after a request for information, unsafe, or incompatible with project invariants. They may be reopened when new evidence resolves the reason for closure.

## Releases and compatibility

ClaimGate is pre-1.0. The maintainer chooses release contents from verified work and the public [`ROADMAP.md`](ROADMAP.md). Before a release, affected gates should pass and user-visible changes should be recorded in [`CHANGELOG.md`](CHANGELOG.md).

Pre-1.0 APIs may change. Breaking changes should still include a clear rationale, migration notes when applicable, and test updates.

## Security and conduct

- Report vulnerabilities through [`SECURITY.md`](SECURITY.md), not a public bug report.
- Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- Contribution requirements are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Amendments

Governance changes use the same significant-change process: open a public issue, explain the problem and trade-offs, and update this document when the maintainer accepts the change. The Git history is the amendment record.
