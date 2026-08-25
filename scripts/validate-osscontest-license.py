#!/usr/bin/env python3
"""Fail-closed validation for the OSS Contest SBOM and model disclosure."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SBOM_DIR = ROOT / "artifacts/submission/2026-osscontest/sbom"
FILES = (
    "claimgate-direct-dependencies.spdx.json",
    "gemma4-license-disclosure.json",
    "license-review.json",
    "SHA256SUMS",
)


def fail(message: str) -> None:
    raise AssertionError(message)


def validate() -> None:
    for filename in FILES:
        if not (SBOM_DIR / filename).is_file():
            fail(f"missing generated license artifact: {filename}")

    with tempfile.TemporaryDirectory(prefix="claimgate-sbom-") as directory:
        regenerated = Path(directory)
        subprocess.run(
            [sys.executable, str(ROOT / "scripts/generate-osscontest-sbom.py"), "--out-dir", str(regenerated)],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        for filename in FILES:
            if (SBOM_DIR / filename).read_bytes() != (regenerated / filename).read_bytes():
                fail(f"generated artifact is stale or nondeterministic: {filename}")

    spdx = json.loads((SBOM_DIR / FILES[0]).read_text(encoding="utf-8"))
    if spdx.get("spdxVersion") != "SPDX-2.3" or spdx.get("dataLicense") != "CC0-1.0":
        fail("SBOM must use SPDX 2.3 JSON with CC0-1.0 document data license")
    packages = spdx.get("packages", [])
    package_ids = {package.get("SPDXID") for package in packages}
    if len(package_ids) != len(packages) or "SPDXRef-ClaimGate" not in package_ids:
        fail("SPDX package identifiers must be unique and include ClaimGate")
    dependency_packages = [package for package in packages if package.get("SPDXID") != "SPDXRef-ClaimGate"]
    for package in dependency_packages:
        license_id = package.get("licenseDeclared")
        if license_id not in {"MIT", "Apache-2.0", "BSD-3-Clause"}:
            fail(f"unreviewed dependency license: {package.get('name')}={license_id}")
        if package.get("licenseConcluded") != license_id:
            fail(f"declared/concluded license mismatch: {package.get('name')}")
        if not str(package.get("homepage", "")).startswith("https://"):
            fail(f"missing HTTPS upstream repository: {package.get('name')}")
        refs = package.get("externalRefs") or []
        if len(refs) != 1 or refs[0].get("referenceType") != "purl":
            fail(f"missing package URL: {package.get('name')}")

    review = json.loads((SBOM_DIR / "license-review.json").read_text(encoding="utf-8"))
    counts = review.get("componentCounts", {})
    if counts.get("npm") != 12 or counts.get("go") != 18 or counts.get("total") != 30:
        fail(f"unexpected dependency coverage: {counts}")
    if review.get("verdict") != "PASS" or review.get("unresolvedRisks") != []:
        fail("license review must have PASS verdict and no unresolved risks")
    if len(dependency_packages) != counts["total"]:
        fail("SPDX dependency count does not match license review")
    review_components = review.get("components", [])
    npm_names = {component.get("name") for component in review_components if component.get("ecosystem") == "npm"}
    declared_npm_names: set[str] = set()
    manifests = [ROOT / "package.json"]
    for directory in ("packages", "packs", "examples"):
        manifests.extend(sorted((ROOT / directory).glob("*/package.json")))
    for manifest in manifests:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        for section in ("dependencies", "devDependencies", "peerDependencies"):
            for name, specifier in (data.get(section) or {}).items():
                if not name.startswith("@claimgate/") and not str(specifier).startswith("workspace:"):
                    declared_npm_names.add(name)
    if npm_names != declared_npm_names:
        fail(f"npm SBOM coverage mismatch: expected={sorted(declared_npm_names)}, actual={sorted(npm_names)}")

    go_names = {component.get("name") for component in review_components if component.get("ecosystem") == "go"}
    go_mod = (ROOT / "tools/fmon/go.mod").read_text(encoding="utf-8")
    declared_go_names = set(re.findall(r"^\s+([^\s]+)\s+v[^\s]+(?:\s+// indirect)?$", go_mod, flags=re.MULTILINE))
    if go_names != declared_go_names:
        fail(f"Go SBOM coverage mismatch: expected={sorted(declared_go_names)}, actual={sorted(go_names)}")

    spdx_purls = {
        ref["referenceLocator"]
        for package in dependency_packages
        for ref in package.get("externalRefs", [])
        if ref.get("referenceType") == "purl"
    }
    review_purls = {component.get("purl") for component in review_components}
    if spdx_purls != review_purls:
        fail("SPDX package URLs do not match the reviewed component inventory")

    disclosure = json.loads((SBOM_DIR / "gemma4-license-disclosure.json").read_text(encoding="utf-8"))
    license_info = disclosure.get("license", {})
    distribution = disclosure.get("distribution", {})
    if license_info.get("spdxId") != "Apache-2.0":
        fail("Gemma 4 must be disclosed under its separate Apache-2.0 license")
    distinction = str(license_info.get("distinction", ""))
    if "general Gemma Terms" not in distinction or "not governed by the older Gemma Terms" not in distinction:
        fail("Gemma 4 disclosure must distinguish its license from general Gemma Terms")
    if any(
        distribution.get(field) is not False
        for field in ("weightsCommittedToRepository", "weightsIncludedInSubmissionArchive", "adapterWeightsCommittedToRepository")
    ):
        fail("model or adapter weights must not be represented as distributed artifacts")
    if disclosure.get("reviewDisposition") != "PASS_NOT_DISTRIBUTED" or disclosure.get("unresolvedRisks") != []:
        fail("Gemma 4 disclosure review is unresolved")

    expected_checksums = []
    for filename in sorted(FILES[:3]):
        expected_checksums.append(f"{hashlib.sha256((SBOM_DIR / filename).read_bytes()).hexdigest()}  {filename}")
    actual_checksums = (SBOM_DIR / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
    if actual_checksums != expected_checksums:
        fail("SHA256SUMS does not match generated JSON artifacts")

    notes = (ROOT / "THIRD_PARTY_LICENSES.md").read_text(encoding="utf-8")
    required_phrases = (
        "python3 scripts/generate-osscontest-sbom.py",
        "python3 scripts/validate-osscontest-license.py",
        "Unresolved risks: **none**",
        "Gemma 4",
        "Apache-2.0",
    )
    for phrase in required_phrases:
        if phrase not in notes:
            fail(f"THIRD_PARTY_LICENSES.md missing required evidence: {phrase}")


if __name__ == "__main__":
    try:
        validate()
    except (AssertionError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"OSS Contest license validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
    print("OSS Contest license validation: PASS (30 dependencies, Gemma 4 disclosed separately)")
