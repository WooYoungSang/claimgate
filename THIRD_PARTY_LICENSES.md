# Third-Party License Review

ClaimGate itself is licensed under the MIT License; see [`LICENSE`](LICENSE).

This file is the public-release license review surface for npm workspace dependencies. It is not a substitute for the package manager's generated notices; it records the review gate and the command used to refresh it.

## Refresh command

Run from the repository root after `pnpm install`:

```bash
pnpm licenses list --json > /tmp/claimgate-licenses.json
node - <<'NODE'
const fs = require('fs');
const licenses = JSON.parse(fs.readFileSync('/tmp/claimgate-licenses.json', 'utf8'));
for (const [license, packages] of Object.entries(licenses)) {
  console.log(`${license}: ${packages.length}`);
}
NODE
```

## 2026-07-08 review snapshot

| License | Package count | Public-release note |
|---|---:|---|
| MIT | 120 | Compatible with project MIT distribution. |
| Apache-2.0 | 4 | Compatible; preserve notices where required. |
| CC-BY-4.0 | 1 | Review attribution requirements before public release. |
| ISC | 6 | Compatible with permissive distribution. |
| BSD-3-Clause | 2 | Compatible; preserve notices. |
| BSD-2-Clause | 1 | Compatible; preserve notices. |

## Go/no-go rule

- **GO** only if generated dependency licenses remain permissive and required notices are preserved.
- **NO-GO** if a dependency introduces copyleft, source-available, unknown, missing, or private/internal license terms that have not been reviewed.
- **NO-GO** if generated license output cannot be reproduced from a clean install.
