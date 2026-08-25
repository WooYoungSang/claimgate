#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/submission/2026-mofa-ai/final-presentation"
PACKAGE = OUT / "claimgate-oda-final-presentation-package.zip"

FILES = [
    "claimgate-oda-final-presentation.pdf",
    "claimgate-oda-final-presentation.pptx",
    "claimgate-oda-speaker-notes.md",
    "README.md",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    missing = [name for name in FILES if not (OUT / name).is_file()]
    if missing:
        raise SystemExit(f"missing final presentation files: {', '.join(missing)}")

    records = [
        {
            "path": name,
            "bytes": (OUT / name).stat().st_size,
            "sha256": sha256(OUT / name),
        }
        for name in FILES
    ]
    sums_path = OUT / "SHA256SUMS.txt"
    sums_path.write_text("".join(f"{item['sha256']}  {item['path']}\n" for item in records))

    manifest = {
        "schema": "claimgate.mofa-final-presentation/v1",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "officialNotice": "https://www.mofa.go.kr/www/brd/m_4075/view.do?seq=369403",
        "officialRequirement": "발표자료(자유양식, 프레젠테이션 파일 등), 발표대상자 해당",
        "recommendedUpload": "claimgate-oda-final-presentation.pdf",
        "editableSource": "claimgate-oda-final-presentation.pptx",
        "slideCount": 10,
        "defaultPitchMinutes": 5,
        "files": records,
        "boundaries": [
            "offline deterministic fixture-first prototype",
            "AI proposes candidates only",
            "live OpenAPI and production accuracy are future scope",
        ],
    }
    manifest_path = OUT / "SUBMISSION-MANIFEST.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    package_files = FILES + ["SHA256SUMS.txt", "SUBMISSION-MANIFEST.json"]
    with ZipFile(PACKAGE, "w", ZIP_DEFLATED) as archive:
        for name in package_files:
            archive.write(OUT / name, arcname=name)
    print(PACKAGE)


if __name__ == "__main__":
    main()
