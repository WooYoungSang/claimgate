# Contributing to ClaimGate

Thank you for improving ClaimGate. v0 changes must preserve the offline, deterministic, fixture-first contract.

## Local checks

Run the full local gate before proposing a change:

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

For narrower local loops, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, or `pnpm demo` directly. Do not mask failing exits with `|| true`.

## Boundary rules

- Keep `packages/core` pure TypeScript and framework-independent.
- Do not add server, database, auth, multitenancy, OCR, real LLM extraction, graph DB, or real DID wallet/issuer/verifier code in v0.
- UI components must stay controlled and must not own hidden verification authority.
- AI adapters may propose candidates only; they must not verify truth, score final risk, or project claims.
- Projection code must only include verified/corrected claims.

## Tests

Behavioral work should follow RED → GREEN → REFACTOR. Scaffold-only changes should at least keep lint, typecheck, test, build, and demo green.
