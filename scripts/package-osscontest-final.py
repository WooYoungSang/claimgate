#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/submission/2026-osscontest/final"
RECEIPT = os.environ.get("OSSCONTEST_RECEIPT_NUMBER", "접수번호")
TEAM = os.environ.get("OSSCONTEST_TEAM_NAME", "ClaimGate")
STEM = f"2026 오픈소스 개발자대회 결과보고서_{RECEIPT}({TEAM})"
FILES = [OUT / f"{STEM}.docx", OUT / f"{STEM}.pdf"]
ZIP = OUT / f"2026 오픈소스 개발자대회 제출파일_{RECEIPT}({TEAM}).zip"


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    missing = [path.name for path in FILES if not path.is_file()]
    if missing:
        raise SystemExit(f"missing official report files: {', '.join(missing)}")
    with ZipFile(ZIP, "w", ZIP_DEFLATED) as archive:
        for path in FILES:
            archive.write(path, arcname=path.name)
    manifest = {
        "schema": "claimgate.osscontest-submission/v1",
        "officialNotices": [
            "https://osscontest.kr/notice/39",
            "https://osscontest.kr/notice/41",
        ],
        "receiptNumber": RECEIPT,
        "team": TEAM,
        "repository": "https://github.com/WooYoungSang/claimgate",
        "videoUrl": os.environ.get("OSSCONTEST_VIDEO_URL", "[YOUTUBE_URL_REQUIRED]"),
        "reportBodyPageLimit": 5,
        "uploadContents": "DOCX and PDF only; source and YouTube video are linked from the report",
        "uploadZip": ZIP.name,
        "uploadZipBytes": ZIP.stat().st_size,
        "uploadZipSha256": digest(ZIP),
        "licenseEvidence": [
            "../sbom/claimgate-direct-dependencies.spdx.json",
            "../sbom/license-review.json",
            "../sbom/gemma4-license-disclosure.json",
            "../sbom/SHA256SUMS",
        ],
        "files": [{"path": path.name, "bytes": path.stat().st_size, "sha256": digest(path)} for path in FILES],
    }
    (OUT / "SUBMISSION-MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(ZIP)


if __name__ == "__main__":
    main()
