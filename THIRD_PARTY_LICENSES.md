# Third-Party License Notes

ClaimGate is licensed under the MIT License. This file summarizes the direct third-party packages declared in `package.json` for evaluator review. It is not a generated legal bill of materials; run your organization's license tooling before production redistribution.

## Direct development dependencies

| Package | Role in v0 | License posture |
|---|---|---|
| `@types/node` | Node.js TypeScript types | Development-only type package; review upstream license metadata before redistribution. |
| `@types/react` | React TypeScript types | Development-only type package; review upstream license metadata before redistribution. |
| `@types/react-dom` | React DOM TypeScript types | Development-only type package; review upstream license metadata before redistribution. |
| `@vitejs/plugin-react` | Vite React build support | Development/build tooling; review upstream license metadata before redistribution. |
| `tsup` | Package bundling | Development/build tooling; review upstream license metadata before redistribution. |
| `tsx` | Local TypeScript script runner | Development/evaluator tooling; review upstream license metadata before redistribution. |
| `typescript` | TypeScript compiler | Development/build tooling; review upstream license metadata before redistribution. |
| `vite` | Example app build tooling | Development/demo tooling; review upstream license metadata before redistribution. |
| `vitest` | Test runner | Development/test tooling; review upstream license metadata before redistribution. |

## Runtime posture

The v0 framework does not require a server runtime, database, auth provider, hosted LLM SDK, OCR SDK, DID SDK, graph DB driver, or network service for the default evaluator path.

## Recommended evaluator command

```bash
pnpm install --frozen-lockfile
pnpm eval:framework
```

This verifies the framework using the lockfile and local fixtures. It does not replace a formal license audit for distribution.

## Public-release license gate

Refresh from the repository root after `pnpm install` with an organization-approved license tool, for example:

```bash
pnpm licenses list --json > /tmp/claimgate-licenses.json
```

GO only if generated dependency licenses remain permissive and required notices are preserved. NO-GO if a dependency introduces copyleft, source-available, unknown, missing, or private/internal license terms that have not been reviewed, or if generated license output cannot be reproduced from a clean install.
