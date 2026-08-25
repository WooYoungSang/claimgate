#!/usr/bin/env python3
"""Generate deterministic OSS Contest license evidence from locked local metadata."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "artifacts/submission/2026-osscontest/sbom"
CREATED = "2026-08-26T00:00:00Z"
ALLOWED_LICENSES = {"MIT", "Apache-2.0", "BSD-3-Clause"}

NPM_PURPOSES = {
    "@types/node": "TypeScript declarations for the Node.js APIs used by build and test scripts.",
    "@types/react": "TypeScript declarations for React components.",
    "@types/react-dom": "TypeScript declarations for React DOM rendering.",
    "@vitejs/plugin-react": "React transform support for the Vite example build.",
    "react": "Controlled-component runtime for the evaluator UI.",
    "react-dom": "Browser renderer for the evaluator UI.",
    "tsup": "TypeScript package bundling for ClaimGate workspace packages.",
    "tsx": "TypeScript runner for local demos and evaluator scripts.",
    "typescript": "Strict TypeScript compiler and type checker.",
    "vite": "Static development and production build tool for the example UI.",
    "vitest": "Deterministic unit and conformance test runner.",
    "zustand": "Local client-side review workflow state for the example UI.",
}

NPM_SCOPES = {
    "@types/node": "types",
    "@types/react": "types",
    "@types/react-dom": "types",
    "@vitejs/plugin-react": "build",
    "react": "runtime",
    "react-dom": "runtime",
    "tsup": "build",
    "tsx": "build",
    "typescript": "build",
    "vite": "build",
    "vitest": "test",
    "zustand": "runtime",
}

GO_PURPOSES = {
    "github.com/charmbracelet/bubbles": "Reusable terminal UI components for FMON.",
    "github.com/charmbracelet/bubbletea": "Terminal UI runtime for FMON.",
    "github.com/charmbracelet/lipgloss": "Terminal layout and styling for FMON.",
}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def package_manifests() -> list[Path]:
    paths = [ROOT / "package.json"]
    for directory in ("packages", "packs", "examples"):
        paths.extend(sorted((ROOT / directory).glob("*/package.json")))
    return paths


def normalize_repository(repository: Any, homepage: str | None) -> str:
    if isinstance(repository, dict):
        repository = repository.get("url")
    if isinstance(repository, str):
        if re.fullmatch(r"[\w.-]+/[\w.-]+", repository):
            repository = f"https://github.com/{repository}"
        repository = re.sub(r"^(?:git\+)?git://", "https://", repository)
        repository = re.sub(r"^git\+", "", repository)
        repository = re.sub(r"^git@github\.com:", "https://github.com/", repository)
        repository = re.sub(r"\.git$", "", repository)
        if repository.startswith("https://"):
            return repository
    if homepage and homepage.startswith("https://"):
        return homepage.rstrip("/#")
    raise ValueError("dependency has no HTTPS repository or homepage metadata")


def resolve_npm_metadata(name: str, importers: list[Path]) -> dict[str, Any]:
    candidates = [manifest.parent / "node_modules" / name / "package.json" for manifest in importers]
    candidates.append(ROOT / "node_modules" / name / "package.json")
    for path in candidates:
        if path.is_file():
            return read_json(path)
    raise FileNotFoundError(f"installed package metadata not found for {name}; run pnpm install --frozen-lockfile")


def npm_components() -> list[dict[str, Any]]:
    declarations: dict[str, dict[str, Any]] = {}
    for manifest in package_manifests():
        data = read_json(manifest)
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            for name, specifier in (data.get(section) or {}).items():
                if name.startswith("@claimgate/") or str(specifier).startswith("workspace:"):
                    continue
                record = declarations.setdefault(name, {"importers": [], "sections": set(), "specifiers": set()})
                record["importers"].append(manifest)
                record["sections"].add(section)
                record["specifiers"].add(str(specifier))

    unknown = sorted(set(declarations) - set(NPM_PURPOSES))
    if unknown:
        raise ValueError(f"add an explicit purpose for new direct npm dependencies: {', '.join(unknown)}")

    lock_text = (ROOT / "pnpm-lock.yaml").read_text(encoding="utf-8")
    components = []
    for name in sorted(declarations):
        declaration = declarations[name]
        metadata = resolve_npm_metadata(name, declaration["importers"])
        version = str(metadata.get("version", ""))
        license_id = str(metadata.get("license", ""))
        if not version or license_id not in ALLOWED_LICENSES:
            raise ValueError(f"unreviewed npm dependency metadata: {name}@{version} license={license_id!r}")
        lock_key = re.escape(f"{name}@{version}")
        if not re.search(rf"^  ['\"]?{lock_key}['\"]?:", lock_text, flags=re.MULTILINE):
            raise ValueError(f"pnpm-lock.yaml has no package entry for installed dependency {name}@{version}")
        components.append(
            {
                "ecosystem": "npm",
                "name": name,
                "version": version,
                "license": license_id,
                "repository": normalize_repository(metadata.get("repository"), metadata.get("homepage")),
                "purpose": NPM_PURPOSES[name],
                "scope": NPM_SCOPES[name],
                "declaredSpecifiers": sorted(declaration["specifiers"]),
                "declaredBy": sorted(str(path.relative_to(ROOT)) for path in declaration["importers"]),
                "purl": f"pkg:npm/{quote(name, safe='/')}@{version}".replace("@types/", "%40types/"),
            }
        )
    return components


def parse_go_mod() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    in_require = False
    for raw_line in (ROOT / "tools/fmon/go.mod").read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line == "require (":
            in_require = True
            continue
        if in_require and line == ")":
            in_require = False
            continue
        if not in_require or not line or line.startswith("//"):
            continue
        match = re.fullmatch(r"(\S+)\s+(\S+)(?:\s+//\s+indirect)?", line)
        if not match:
            raise ValueError(f"unsupported tools/fmon/go.mod require line: {raw_line}")
        records.append({"path": match.group(1), "version": match.group(2), "indirect": "// indirect" in line})
    return records


def go_module_metadata() -> dict[str, dict[str, Any]]:
    result = subprocess.run(
        ["go", "list", "-m", "-json", "all"],
        cwd=ROOT / "tools/fmon",
        check=True,
        text=True,
        capture_output=True,
    )
    decoder = json.JSONDecoder()
    values: dict[str, dict[str, Any]] = {}
    offset = 0
    while offset < len(result.stdout):
        while offset < len(result.stdout) and result.stdout[offset].isspace():
            offset += 1
        if offset >= len(result.stdout):
            break
        value, offset = decoder.raw_decode(result.stdout, offset)
        values[value["Path"]] = value
    return values


def detect_go_license(module_dir: Path) -> str:
    candidates = sorted(module_dir.glob("LICENSE*")) + sorted(module_dir.glob("COPYING*"))
    texts = [path.read_text(encoding="utf-8", errors="ignore") for path in candidates]
    readme = module_dir / "README.md"
    if readme.is_file():
        texts.append(readme.read_text(encoding="utf-8", errors="ignore"))
    joined = "\n".join(texts)
    if "Permission is hereby granted, free of charge" in joined or re.search(r"## License\s+MIT\b", joined):
        return "MIT"
    if "Redistribution and use in source and binary forms" in joined and "Neither the name" in joined:
        return "BSD-3-Clause"
    raise ValueError(f"could not identify a reviewed license in {module_dir}")


def go_repository(module_path: str) -> str:
    if module_path.startswith("github.com/"):
        parts = module_path.split("/")
        return "https://" + "/".join(parts[:3])
    if module_path.startswith("golang.org/x/"):
        return "https://go.googlesource.com/" + module_path.removeprefix("golang.org/x/")
    raise ValueError(f"add repository mapping for Go module {module_path}")


def go_components() -> list[dict[str, Any]]:
    listed = go_module_metadata()
    go_sum = (ROOT / "tools/fmon/go.sum").read_text(encoding="utf-8")
    components = []
    for record in sorted(parse_go_mod(), key=lambda item: item["path"]):
        path = record["path"]
        version = record["version"]
        metadata = listed.get(path)
        if not metadata or metadata.get("Version") != version or not metadata.get("Dir"):
            raise ValueError(f"Go module is not available at its declared version: {path}@{version}; run go mod download")
        if f"{path} {version} h1:" not in go_sum:
            raise ValueError(f"tools/fmon/go.sum has no module checksum for {path}@{version}")
        components.append(
            {
                "ecosystem": "go",
                "name": path,
                "version": version,
                "license": detect_go_license(Path(metadata["Dir"])),
                "repository": go_repository(path),
                "purpose": GO_PURPOSES.get(path, "Transitive terminal/runtime support for the FMON local TUI."),
                "scope": "indirect" if record["indirect"] else "runtime",
                "declaredSpecifiers": [version],
                "declaredBy": ["tools/fmon/go.mod"],
                "purl": f"pkg:golang/{path}@{version}",
            }
        )
    return components


def spdx_id(component: dict[str, Any]) -> str:
    value = re.sub(r"[^A-Za-z0-9.-]", "-", f"{component['ecosystem']}-{component['name']}-{component['version']}")
    return "SPDXRef-" + value


def build_spdx(components: list[dict[str, Any]]) -> dict[str, Any]:
    digest_input = "\n".join(component["purl"] for component in components).encode()
    namespace_digest = hashlib.sha256(digest_input).hexdigest()[:20]
    packages: list[dict[str, Any]] = [
        {
            "SPDXID": "SPDXRef-ClaimGate",
            "name": "ClaimGate",
            "versionInfo": "0.0.0",
            "downloadLocation": "NOASSERTION",
            "filesAnalyzed": False,
            "licenseConcluded": "MIT",
            "licenseDeclared": "MIT",
            "copyrightText": "NOASSERTION",
            "primaryPackagePurpose": "APPLICATION",
            "supplier": "NOASSERTION",
        }
    ]
    relationships = []
    for component in components:
        identifier = spdx_id(component)
        packages.append(
            {
                "SPDXID": identifier,
                "name": component["name"],
                "versionInfo": component["version"],
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": False,
                "licenseConcluded": component["license"],
                "licenseDeclared": component["license"],
                "copyrightText": "NOASSERTION",
                "homepage": component["repository"],
                "primaryPackagePurpose": "LIBRARY",
                "supplier": "NOASSERTION",
                "sourceInfo": (
                    f"repository={component['repository']}; scope={component['scope']}; "
                    f"purpose={component['purpose']}"
                ),
                "externalRefs": [
                    {
                        "referenceCategory": "PACKAGE-MANAGER",
                        "referenceType": "purl",
                        "referenceLocator": component["purl"],
                    }
                ],
            }
        )
        relationships.append(
            {"spdxElementId": "SPDXRef-ClaimGate", "relationshipType": "DEPENDS_ON", "relatedSpdxElement": identifier}
        )
    return {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": "ClaimGate OSS Contest direct dependency SBOM",
        "documentNamespace": f"https://claimgate.dev/spdx/osscontest/{namespace_digest}",
        "creationInfo": {"created": CREATED, "creators": ["Tool: scripts/generate-osscontest-sbom.py"]},
        "documentDescribes": ["SPDXRef-ClaimGate"],
        "packages": packages,
        "relationships": relationships,
    }


def build_review(components: list[dict[str, Any]]) -> dict[str, Any]:
    counts = Counter(component["license"] for component in components)
    return {
        "schemaVersion": "claimgate.license-review/v1",
        "generatedAt": CREATED,
        "scope": "external direct npm dependencies across all workspace manifests and every module declared by tools/fmon/go.mod",
        "sourceInputs": [
            "package.json",
            "packages/*/package.json",
            "packs/*/package.json",
            "examples/*/package.json",
            "pnpm-lock.yaml",
            "installed package.json metadata from pnpm install --frozen-lockfile",
            "tools/fmon/go.mod",
            "tools/fmon/go.sum",
            "local Go module metadata from go list -m -json all",
        ],
        "componentCounts": {
            "npm": sum(component["ecosystem"] == "npm" for component in components),
            "go": sum(component["ecosystem"] == "go" for component in components),
            "total": len(components),
        },
        "licenseCounts": dict(sorted(counts.items())),
        "approvedLicenseIds": sorted(ALLOWED_LICENSES),
        "requiredNoticePosture": {
            "Apache-2.0": "Preserve license and any upstream NOTICE content when redistributing covered artifacts.",
            "BSD-3-Clause": "Preserve copyright, license conditions, and disclaimer.",
            "MIT": "Preserve copyright and permission notice.",
        },
        "unresolvedRisks": [],
        "verdict": "PASS",
        "components": components,
    }


def build_gemma_disclosure() -> dict[str, Any]:
    return {
        "schemaVersion": "claimgate.ai-model-license-disclosure/v1",
        "reviewedAt": "2026-08-26",
        "model": "Gemma 4 12B instruction-tuned",
        "modelIdUsedByOptionalLocalPipeline": "google/gemma-4-12B-it / local Ollama tag gemma4:12b",
        "provider": "Google DeepMind",
        "projectRole": "Optional local candidate-claim extraction only; never truth judgment, risk scoring, source-anchor acceptance, or projection authority.",
        "license": {
            "spdxId": "Apache-2.0",
            "officialLicenseUrl": "https://ai.google.dev/gemma/apache_2",
            "officialModelCardUrl": "https://ai.google.dev/gemma/docs/core/model_card_4",
            "distinction": (
                "The general Gemma Terms of Use page explicitly directs Gemma 4 users to the separate Gemma 4 license. "
                "Gemma 4 is identified by Google as Apache 2.0; it is not governed by the older Gemma Terms list."
            ),
            "generalGemmaTermsUrl": "https://ai.google.dev/gemma/terms",
        },
        "distribution": {
            "weightsCommittedToRepository": False,
            "weightsIncludedInSubmissionArchive": False,
            "adapterWeightsCommittedToRepository": False,
            "operatorProvidesLocalModel": True,
            "sbomTreatment": "Disclosure only; no model weights are a distributed ClaimGate software dependency.",
        },
        "unresolvedRisks": [],
        "reviewDisposition": "PASS_NOT_DISTRIBUTED",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    out_dir = args.out_dir if args.out_dir.is_absolute() else ROOT / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    components = npm_components() + go_components()
    outputs = {
        "claimgate-direct-dependencies.spdx.json": build_spdx(components),
        "license-review.json": build_review(components),
        "gemma4-license-disclosure.json": build_gemma_disclosure(),
    }
    for filename, value in outputs.items():
        write_json(out_dir / filename, value)

    checksum_lines = []
    for filename in sorted(outputs):
        digest = hashlib.sha256((out_dir / filename).read_bytes()).hexdigest()
        checksum_lines.append(f"{digest}  {filename}")
    (out_dir / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")
    display_path = out_dir.relative_to(ROOT) if out_dir.is_relative_to(ROOT) else out_dir
    print(f"generated {len(components)} dependency records in {display_path}")


if __name__ == "__main__":
    main()
