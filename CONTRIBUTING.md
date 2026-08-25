# Contributing to ClaimGate

Thank you for improving ClaimGate. The project is currently solo-maintained, but bug reports, documentation fixes, tests, and focused feature proposals are welcome. Participation follows the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), and decisions follow [`GOVERNANCE.md`](GOVERNANCE.md).

## Before you start

1. Search open and closed issues before filing a new one.
2. Use the closest issue form and include a minimal reproduction or concrete user problem.
3. For public API, package-boundary, persisted-format, domain-rule, or governance changes, get issue-level scope agreement before opening a large pull request.
4. Never include secrets, private source documents, real credentials, or production personal data.

Small typo and documentation fixes may go directly to a pull request. Opening an issue does not reserve the work or guarantee acceptance.

## Development setup

ClaimGate requires Node.js 20+ and pnpm 9. Clone the repository, then run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm eval:framework
```

The default framework evaluation is local and fixture-first after dependencies are installed. Go 1.22+ is needed only for `kbctl`/FMON tooling. The optional Local Gemma path has separate hardware and runtime requirements and is not required for ordinary framework contributions.

## Local checks

Run the full local gate before proposing a change:

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

For narrower local loops, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, or `pnpm demo` directly. Do not mask failing exits with `|| true`.

Run the smallest relevant check while iterating, then the full gate before requesting review. If a check cannot run in your environment, state exactly which command was skipped and why.

## Boundary rules

- Keep `packages/core` pure TypeScript and framework-independent.
- Treat server, database, auth, multitenancy, OCR, hosted model, graph DB, or real DID wallet/issuer/verifier work as out of v0 unless a maintainer-approved roadmap change explicitly scopes it.
- UI components must stay controlled and must not own hidden verification authority.
- AI adapters may propose candidates only; they must not verify truth, score final risk, or project claims.
- Projection code must only include verified/corrected claims.
- DomainPacks may add fixtures, deterministic rules, and judgment-policy extensions, but they cannot override core invariants.

See [`docs/package-boundaries.md`](docs/package-boundaries.md) and [`docs/product-manifesto.md`](docs/product-manifesto.md) before changing these seams.

## Tests

Behavioral work should follow RED → GREEN → REFACTOR. Scaffold-only changes should at least keep lint, typecheck, test, build, and demo green.

- Add a regression test that fails before a behavior fix and passes after it.
- Keep fixtures deterministic and safe to publish.
- Test rejected transitions and authority violations, not only happy paths.
- For a DomainPack, exercise every declared risk rule through conformance fixtures.

## Pull requests

Keep pull requests focused and reviewable. Include:

- the user-visible problem and linked issue;
- the chosen approach and important alternatives;
- affected invariants or package boundaries;
- commands run and their outcomes;
- screenshots or artifact samples for visible changes; and
- migration notes for breaking changes.

Do not mix generated artifacts, broad formatting, unrelated cleanup, or dependency upgrades into a behavioral change. Do not fabricate benchmark, contributor, user, or review evidence.

The maintainer may request changes, split an oversized pull request, or close work that conflicts with the accepted scope. A merge is the acceptance signal.

## Documentation and project knowledge

Update user-facing docs when behavior or commands change. ClaimGate's domain/design source of truth is managed with `./kbctl`; do not hand-edit generated design views. If implementation reveals unknown domain behavior, call it out in the issue or pull request so the maintainer can record a knowledge gap instead of inventing a rule.

## Security reports

Do not disclose vulnerabilities in public issues. Follow [`SECURITY.md`](SECURITY.md). For ordinary bugs with no sensitive impact, use the bug report form.
