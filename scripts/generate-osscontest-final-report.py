#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "artifacts/submission/2026-osscontest"
TEMPLATE = BASE / "template/official-result-report-template.docx"
OUT = BASE / "final"
RECEIPT = os.environ.get("OSSCONTEST_RECEIPT_NUMBER", "접수번호")
TEAM = os.environ.get("OSSCONTEST_TEAM_NAME", "ClaimGate")
DOCX = OUT / f"2026 오픈소스 개발자대회 결과보고서_{RECEIPT}({TEAM}).docx"
PDF = OUT / f"2026 오픈소스 개발자대회 결과보고서_{RECEIPT}({TEAM}).pdf"
REPO_URL = "https://github.com/WooYoungSang/warvis-claimgate"
VIDEO_URL = os.environ.get("OSSCONTEST_VIDEO_URL", "[YOUTUBE_URL_REQUIRED]")


def set_cell(cell, text: str, bold: bool = False) -> None:
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(text)
    run.bold = bold


def add_lines(cell, lines: list[str]) -> None:
    cell.text = ""
    for index, text in enumerate(lines):
        p = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
        p.style = cell.paragraphs[0].style
        p.paragraph_format.space_after = Pt(2)
        p.add_run(text)


def set_all_font(doc: Document) -> None:
    for paragraph in doc.paragraphs:
        for run in paragraph.runs:
            run.font.name = "Malgun Gothic"
            run.font.size = Pt(10)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.font.name = "Malgun Gothic"
                        run.font.size = Pt(10)


def add_picture(cell, path: Path, width: float) -> None:
    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Inches(width))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if not TEMPLATE.exists():
        raise SystemExit(f"missing official template: {TEMPLATE}")
    doc = Document(TEMPLATE)
    tables = doc.tables

    # 참가 정보
    info = tables[2]
    set_cell(info.cell(1, 1), TEAM)
    set_cell(info.cell(1, 3), "1명")
    set_cell(info.cell(2, 1), "일반")
    set_cell(info.cell(2, 3), "자유과제")

    report = tables[3]
    set_cell(report.cell(1, 1), "ClaimGate")
    set_cell(report.cell(2, 1), REPO_URL)
    set_cell(report.cell(3, 1), VIDEO_URL)
    set_cell(report.cell(4, 1), "AI·공공데이터 출력의 주장을 Source Anchor, 결정론적 위험 규칙, 사람의 검토, Evidence Pack으로 연결하는 오픈소스 claim review framework")
    add_lines(report.cell(6, 1), [
        "• 생성형 AI가 만든 자연스러운 문장도 출처·값·날짜·기관이 틀릴 수 있으나, 기존 도구는 생성 이후의 책임 있는 검토와 인계를 제품화하지 못한다.",
        "• 목표: AI는 후보 주장과 근거 후보만 제안하고, 공식 데이터의 위치·명시적 규칙·사람의 최종 판정으로 검증된 주장만 재사용한다.",
        "• 핵심 원칙: No Anchor, No Claim / AI Curator, Not Judge / Evidence Pack First.",
    ])
    add_lines(report.cell(7, 1), [
        "• Node.js 20+, TypeScript strict, pnpm monorepo, React 18, Vite, Vitest, tsup",
        "• 선택적 로컬 AI: Ollama-compatible Gemma 4 12B(candidate-only), repo-local sparse RAG",
        "• Go 1.22 도구: kbctl JSON 지식정본 CLI, FMON Bubble Tea read-model TUI",
        "• 기본 경로는 서버·DB·인증·호스팅 LLM 없이 offline deterministic fixture-first로 재현 가능",
    ])
    add_lines(report.cell(8, 1), [
        "• @claimgate/core: Claim·Source Anchor·review state·risk trace·Evidence Pack 불변식",
        "• @claimgate/ui: 숨은 판정 권한이 없는 controlled React components",
        "• @claimgate/pack-*: civic / health / MOFA ODA fixture와 도메인 판단 규칙",
        "• @claimgate/ai-local: 후보 추출과 RAG provenance만 담당하며 검증·위험결정·투영 권한 없음",
        "• 데이터 흐름: Candidate → accepted Source Anchor → deterministic risk → Human Review → Evidence Pack → Report/Graph",
    ])
    add_picture(report.cell(8, 1), ROOT / "artifacts/submission/2026-mofa-ai/final-presentation/assets/01-guided-demo-start.png", 5.4)
    add_lines(report.cell(9, 1), [
        "[핵심 기능] 출처 없는 검증 차단, 데이터 행·셀·문장 범위 Source Anchor, 값/단위/날짜/기관 불일치 rule trace, Green Sampling, reviewer terminal decision, verified/corrected-only Evidence Pack.",
        "[개발 과정] core 불변식 테스트 → 3개 DomainPack conformance → MOFA ODA 3개 위험 시나리오 → controlled UI → local Gemma candidate-only adapter → 제출 과장 방지·재현성·성능·보안 게이트.",
        "[실행] pnpm install --frozen-lockfile && pnpm eval:framework. 데모: pnpm demo. 실제 local model 경로: pnpm demo:ai:gemma.",
        "[검증] workspace unit tests 192개, core 103개, local-AI 20개, conformance 8개. clean-clone, deployment contract, submission evidence, kbctl/fmon 검증 포함.",
    ])
    add_picture(report.cell(9, 1), ROOT / "artifacts/submission/2026-mofa-ai/final-presentation/assets/02-review-workspace.png", 5.4)
    add_lines(report.cell(10, 1), [
        "• 활용: 공공기관·연구·보건·시민데이터 등 AI 초안의 고위험 문장을 근거 중심 reviewer workflow로 전환.",
        "• 오픈소스 확장: core/UI 계약은 유지하고 DomainPack만 교체하여 커뮤니티가 fixture·rule·copy를 추가 가능.",
        "• 향후: 읽기 전용 공공데이터 adapter, 제한 파일럿, 검토시간·재확인시간·정정 재사용률 측정. 현재는 운영 정확도·고객 채택·시간 절감 수치를 주장하지 않음.",
    ])
    add_lines(report.cell(11, 1), [
        "[혁신성] AI 답변을 더 잘 생성하는 대신, 주장 단위의 근거·위험·사람의 결정·재사용 산출물을 하나의 검토 프로토콜로 만든다.",
        "[관리체계] MIT LICENSE, CONTRIBUTING, SECURITY, THIRD_PARTY_LICENSES, 125개 commit, kbctl SSOT, 자동 lint/typecheck/test/negative controls. 개인 프로젝트이므로 허위 PR/협업 이력을 주장하지 않는다.",
        "[한계] live OpenAPI·production vector DB·운영 정확도·실사용 효과는 future scope. 공개 배포의 cache/security header 5개는 아직 hardening 필요.",
        "[로드맵] v0 framework 안정화 → ODA 시제품 → 실무 파일럿 → adapter 생태계와 community DomainPack registry.",
        "[소감] AI 시대의 핵심은 생성량보다 검증 가능한 판단과 인계다. 코드·문서·검증을 함께 공개해 재사용 가능한 신뢰 경계를 만들었다.",
    ])

    # 붙임 1: direct/runtime-focused SBOM. Full transitive inventory is reproducible with pnpm licenses list --json.
    sbom = [
        ("React", "18.3.1", "MIT", "https://github.com/facebook/react", "UI rendering"),
        ("React DOM", "18.3.1", "MIT", "https://github.com/facebook/react", "Browser UI integration"),
        ("Zustand", "4.5.5", "MIT", "https://github.com/pmndrs/zustand", "Example app state"),
        ("TypeScript", "5.7.2", "Apache-2.0", "https://github.com/microsoft/TypeScript", "Strict type checking"),
        ("Vite", "5.4.11", "MIT", "https://github.com/vitejs/vite", "Example build/preview"),
        ("Vitest", "2.1.8", "MIT", "https://github.com/vitest-dev/vitest", "Unit/conformance tests"),
        ("tsup", "8.3.5", "MIT", "https://github.com/egoist/tsup", "Library bundling"),
        ("tsx", "4.19.2", "MIT", "https://github.com/privatenumber/tsx", "TypeScript scripts"),
        ("Bubble Tea", "1.3.4", "MIT", "https://github.com/charmbracelet/bubbletea", "FMON TUI runtime"),
        ("Bubbles", "0.20.0", "MIT", "https://github.com/charmbracelet/bubbles", "FMON viewport"),
        ("Lip Gloss", "1.0.0", "MIT", "https://github.com/charmbracelet/lipgloss", "FMON terminal styling"),
    ]
    sbom_table = tables[5]
    for row in sbom_table.rows[1:]:
        for cell in row.cells:
            set_cell(cell, "")
    while len(sbom_table.rows) < len(sbom) + 1:
        sbom_table.add_row()
    for index, item in enumerate(sbom, 1):
        values = (str(index),) + item
        for col, value in enumerate(values):
            set_cell(sbom_table.cell(index, col), value)

    ai = tables[8]
    set_cell(ai.cell(1, 0), "▣ 유형 1: 외부 모델 그대로 활용 — local Ollama-compatible Gemma 4 12B를 후보 주장 생성에 선택적으로 연결. 기본 fixture 경로는 모델 없이 동작.\n□ 유형 2\n□ 유형 3")
    set_cell(ai.cell(3, 1), "Gemma 4 12B (Google), Ollama model tag gemma4:12b")
    set_cell(ai.cell(3, 3), "Gemma Terms of Use (open-weight; 사용 조건 별도 준수)")
    set_cell(ai.cell(5, 1), "해당 없음 — 제출되는 기본 제품은 추가 학습 가중치를 탑재하지 않음")
    set_cell(ai.cell(6, 1), "해당 없음")
    set_cell(ai.cell(7, 1), "해당 없음 — local LoRA prototype은 pipeline evidence이며 배포 제품 가중치가 아님")
    set_cell(ai.cell(8, 1), "해당 없음")
    set_cell(ai.cell(10, 1), "MIT License")
    set_cell(ai.cell(10, 3), REPO_URL)
    set_cell(ai.cell(11, 1), "OpenAI Codex 계열 도구를 코드 작성·문서화·리뷰 보조에 활용. 모든 변경은 테스트·typecheck·lint·negative controls로 검증했으며 상용 AI API는 제품 runtime 필수 의존성이 아님.")

    # 제출 시 삭제하도록 명시된 첫 안내 표 제거.
    guide = doc.tables[0]._element
    guide.getparent().remove(guide)
    set_all_font(doc)
    doc.save(DOCX)

    pdf_dir = Path("/tmp/claimgate-osscontest-report-pdf")
    pdf_dir.mkdir(exist_ok=True)
    subprocess.run([
        "libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(pdf_dir), str(DOCX)
    ], check=True)
    generated = pdf_dir / (DOCX.stem + ".pdf")
    PDF.write_bytes(generated.read_bytes())
    print(DOCX)
    print(PDF)


if __name__ == "__main__":
    main()
