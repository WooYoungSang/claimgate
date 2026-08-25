#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/submission/2026-osscontest/final"


def require(value: bool, message: str) -> None:
    if not value:
        raise SystemExit(f"osscontest-final: FAIL: {message}")


def main() -> None:
    manifest = json.loads((OUT / "SUBMISSION-MANIFEST.json").read_text())
    docx = OUT / manifest["files"][0]["path"]
    pdf = OUT / manifest["files"][1]["path"]
    video = OUT / "claimgate-osscontest-demo.mp4"
    package = OUT / manifest["uploadZip"]
    for path in [docx, pdf, video, package]:
        require(path.is_file() and path.stat().st_size > 0, f"missing {path.name}")

    report = Document(docx)
    text = "\n".join(p.text for p in report.paragraphs)
    text += "\n" + "\n".join(cell.text for table in report.tables for row in table.rows for cell in row.cells)
    for phrase in ["프로젝트 등록", "시연영상", "SBOM", "AI 모델 활용", "No Anchor", "Evidence Pack"]:
        require(phrase.lower() in text.lower(), f"report phrase missing: {phrase}")

    pdfinfo = subprocess.check_output(["pdfinfo", str(pdf)], text=True)
    pages = int(re.search(r"^Pages:\s+(\d+)$", pdfinfo, re.MULTILINE).group(1))
    require(6 <= pages <= 8, f"expected 4-5 report pages plus annexes, got {pages}")

    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-show_entries", "format=duration", "-of", "json", str(video)
    ], text=True))
    duration = float(probe["format"]["duration"])
    require(1 <= duration <= 180, f"video duration {duration}s exceeds 3 minutes")
    stream = probe["streams"][0]
    require(stream["width"] >= 1280 and stream["height"] >= 720, "video resolution below 1280x720")

    with ZipFile(package) as archive:
        require(archive.testzip() is None, "ZIP CRC failure")
        require(len(archive.namelist()) == 2, "official upload ZIP must contain DOCX and PDF only")

    blockers = []
    if manifest["receiptNumber"] == "접수번호":
        blockers.append("OSSCONTEST_RECEIPT_NUMBER")
    if "YOUTUBE_URL_REQUIRED" in manifest["videoUrl"]:
        blockers.append("OSSCONTEST_VIDEO_URL")
    ahead = int(subprocess.check_output(["git", "rev-list", "--count", "@{u}..HEAD"], text=True).strip())
    if ahead:
        blockers.append(f"PUSH_{ahead}_COMMITS")
    print(f"osscontest-final: DRAFT PASS — {pages} report pages, {duration:.2f}s video, valid 2-file ZIP")
    print("osscontest-final: BLOCKERS — " + ", ".join(blockers) if blockers else "osscontest-final: READY")


if __name__ == "__main__":
    main()
