# Third-Party License Review

ClaimGate source code is distributed under the [MIT License](LICENSE). The machine-readable submission evidence is generated from the locked workspace manifests and FMON module files; this document records its scope, regeneration procedure, and release decision.

## Review scope

| Surface | Coverage | Evidence |
|---|---|---|
| npm | Every external package declared directly in `dependencies`, `devDependencies`, or `peerDependencies` across the root, `packages/*`, `packs/*`, and `examples/*` manifests | `artifacts/submission/2026-osscontest/sbom/claimgate-direct-dependencies.spdx.json` |
| Go FMON | Every direct and indirect module declared in `tools/fmon/go.mod`, pinned and checksum-backed by `tools/fmon/go.sum` | Same SPDX document |
| License decision | Version, upstream repository, purpose, scope, license counts, notice posture, and unresolved risks | `artifacts/submission/2026-osscontest/sbom/license-review.json` |
| Local AI model | Gemma 4 license and non-distribution boundary | `artifacts/submission/2026-osscontest/sbom/gemma4-license-disclosure.json` |
| Integrity | SHA-256 for all generated JSON evidence | `artifacts/submission/2026-osscontest/sbom/SHA256SUMS` |

The inventory intentionally covers direct npm runtime/build/test/type dependencies rather than the complete npm transitive closure. FMON's full declared `go.mod` set is included because the Go tool records its indirect terminal dependencies explicitly. A clean install remains pinned by `pnpm-lock.yaml` and `tools/fmon/go.sum`.

## Reproduce and validate

Run from the repository root with Node.js 20+, pnpm 9, Go 1.22+, and Python 3 after restoring locked dependencies:

```bash
pnpm install --frozen-lockfile
(cd tools/fmon && go mod download)
python3 scripts/generate-osscontest-sbom.py
python3 scripts/validate-osscontest-license.py
```

The generator uses only the Python standard library, installed package metadata, `go list`, and repository lock/module files. It fails closed for a new direct npm dependency without an explicit ClaimGate purpose, missing package metadata, a missing Go checksum, an unknown upstream repository, or a license outside the reviewed permissive set. The validator regenerates into a temporary directory and requires byte-identical output.

## 2026-08-26 review result

| Ecosystem | Components | Reviewed licenses | Disposition |
|---|---:|---|---|
| npm | 12 | MIT, Apache-2.0 | PASS |
| Go FMON | 18 | MIT, BSD-3-Clause | PASS |
| Total | 30 | MIT, Apache-2.0, BSD-3-Clause | PASS |

Required MIT, Apache-2.0, and BSD-3-Clause notices must be preserved when their covered artifacts are redistributed. Unresolved risks: **none** for the dependency set represented by the generated direct-dependency SBOM.

## Gemma 4 is a separate model disclosure

The optional local candidate extractor uses a locally supplied Gemma 4 12B model. Google identifies Gemma 4 as **Apache-2.0** and the general Gemma Terms page explicitly directs Gemma 4 users to its separate license. Gemma 4 must therefore not be mislabeled as governed by the older general Gemma Terms list.

No Gemma 4 base weights, tuned adapter weights, or model binary are committed to this repository or included in the contest archive. The model is disclosed separately rather than counted as a distributed npm/Go software dependency. Its runtime role remains candidate proposal only; it has no verification, risk-scoring, anchor-acceptance, or projection authority.

- Gemma 4 model card: <https://ai.google.dev/gemma/docs/core/model_card_4>
- Gemma 4 Apache 2.0 license: <https://ai.google.dev/gemma/apache_2>
- General Gemma Terms distinction: <https://ai.google.dev/gemma/terms>

## Release gate

- **GO** only when `python3 scripts/validate-osscontest-license.py` passes and required notices are preserved.
- **NO-GO** if a dependency introduces copyleft, source-available, unknown, missing, or private/internal terms without explicit review.
- **NO-GO** if generated evidence is stale, cannot be reproduced, or if model/adapter weights enter a distribution archive without a fresh model-license review.
