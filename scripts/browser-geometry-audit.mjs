import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.CLAIMGATE_GEOMETRY_PORT ?? '41739', 10);
const baseUrl = `http://${host}:${port}`;
const viewports = [320, 420, 820, 1180, 1440, 1920];
const interactionViewports = [320, 820, 1920];
const managedChildren = new Set();

const pythonAudit = String.raw`
import asyncio
import json
import os
import sys

try:
    from playwright.async_api import async_playwright
except ModuleNotFoundError as error:
    print(json.dumps({
        "status": "BLOCKED",
        "reason": "global Python Playwright is unavailable",
        "detail": str(error),
    }, ensure_ascii=False, indent=2))
    sys.exit(2)

BASE_URL = os.environ["CLAIMGATE_GEOMETRY_URL"]
VIEWPORTS = json.loads(os.environ["CLAIMGATE_GEOMETRY_VIEWPORTS"])
INTERACTION_VIEWPORTS = json.loads(os.environ["CLAIMGATE_GEOMETRY_INTERACTION_VIEWPORTS"])
EXPECTED_PACKS = {"civic-data", "health-data", "mofa-oda"}
JUDGE_FLOW = os.environ.get("CLAIMGATE_JUDGE_FLOW") == "1"
MUTATE_DECISION_EXPECTATIONS = os.environ.get("CLAIMGATE_JUDGE_FLOW_SWAP_EXPECTATIONS") == "1"
PACK_EXPECTATIONS = {
    "civic-data": {"claimId": "civic-claim-001", "aiValue": 12, "sourceValue": 10},
    "health-data": {"claimId": "health-claim-001", "aiValue": 94, "sourceValue": 94},
    "mofa-oda": {
        "claimId": "mofa-oda-claim-001",
        "aiValue": "안전·안정",
        "sourceValue": "특별여행주의보·신변안전 유의",
    },
}
DECISION_EXPECTATIONS = {
    "corrected": {"label": "정정 완료", "reason": "출처 근거와 AI 제안 값이 달라 근거값으로 정정합니다."},
    "verified": {"label": "검증 완료", "reason": "출처 근거와 일치함을 검토자가 확인했습니다."},
}
EXPECTED_STATES = {
    "guide-launch",
    "free-exploration",
    "decision-dialog-rejected",
    "decision-dialog-corrected",
    "guided-review-queue",
    "guided-source-comparison",
    "guided-reviewer-decision",
    "decision-dialog-verified",
    "reviewed-decision",
    "guided-evidence-preview",
    "evidence-dialog",
}

GEOMETRY_PROBE = r"""
(config) => {
  const tolerance = 1;
  const failures = [];
  const checks = [];
  const root = document.documentElement;

  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const roundedRect = (rect) => ({
    left: Math.round(rect.left * 100) / 100,
    top: Math.round(rect.top * 100) / 100,
    right: Math.round(rect.right * 100) / 100,
    bottom: Math.round(rect.bottom * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100
  });
  const contains = (outer, inner) =>
    inner.left >= outer.left - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.bottom <= outer.bottom + tolerance;
  const intersects = (left, right) =>
    Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance &&
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance;
  const record = (check) => {
    checks.push(check);
    if (!check.passed) failures.push(check);
  };

  record({
    kind: 'document-overflow',
    name: 'document-horizontal-overflow',
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    passed: root.scrollWidth <= root.clientWidth + tolerance
  });

  for (const requirement of config.requiredCounts) {
    const count = document.querySelectorAll(requirement.selector).length;
    const passed = requirement.exact === undefined ? count >= requirement.minimum : count === requirement.exact;
    record({
      kind: 'required-count',
      name: requirement.name,
      selector: requirement.selector,
      expected: requirement.exact === undefined ? { minimum: requirement.minimum } : { exact: requirement.exact },
      actual: count,
      passed
    });
  }

  for (const target of config.containmentTargets) {
    const element = document.querySelector(target.selector);
    const boundary = element?.closest(target.boundarySelector) ?? document.querySelector(target.boundarySelector);
    if (!visible(element) || !visible(boundary)) {
      record({
        kind: 'containment',
        name: target.name,
        selector: target.selector,
        boundarySelector: target.boundarySelector,
        reason: 'missing-or-hidden',
        passed: false
      });
      continue;
    }
    const rect = element.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const inViewport = rect.left >= -tolerance && rect.right <= root.clientWidth + tolerance;
    const inBoundary = contains(boundaryRect, rect);
    record({
      kind: 'containment',
      name: target.name,
      selector: target.selector,
      boundarySelector: target.boundarySelector,
      rect: roundedRect(rect),
      boundaryRect: roundedRect(boundaryRect),
      inViewport,
      inBoundary,
      passed: inViewport && inBoundary
    });
  }

  for (const selector of config.scrollSelectors) {
    const elements = Array.from(document.querySelectorAll(selector)).filter(visible);
    for (const [index, element] of elements.entries()) {
      const style = getComputedStyle(element);
      const horizontalOverflow = element.scrollWidth - element.clientWidth;
      const verticalOverflow = element.scrollHeight - element.clientHeight;
      const verticallyClipped = verticalOverflow > tolerance && ['hidden', 'clip'].includes(style.overflowY);
      const rect = element.getBoundingClientRect();
      const directChildren = Array.from(element.children).filter(visible);
      const escapedChild = directChildren.find((child) => {
        const childRect = child.getBoundingClientRect();
        return childRect.left < rect.left - tolerance || childRect.right > rect.right + tolerance;
      });
      record({
        kind: 'internal-overflow',
        name: selector + '[' + index + ']',
        selector,
        rect: roundedRect(rect),
        client: { width: element.clientWidth, height: element.clientHeight },
        scroll: { width: element.scrollWidth, height: element.scrollHeight },
        overflow: { x: style.overflowX, y: style.overflowY },
        horizontalOverflow,
        verticalOverflow,
        escapedChild: escapedChild ? escapedChild.tagName.toLowerCase() + '.' + escapedChild.className : null,
        passed: horizontalOverflow <= tolerance && !verticallyClipped && !escapedChild
      });
    }
  }

  for (const group of config.pairwiseGroups) {
    const elements = Array.from(document.querySelectorAll(group.selector)).filter(visible);
    for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
        const leftRect = elements[leftIndex].getBoundingClientRect();
        const rightRect = elements[rightIndex].getBoundingClientRect();
        record({
          kind: 'sibling-intersection',
          name: group.name + '-' + (leftIndex + 1) + '-' + (rightIndex + 1),
          selector: group.selector,
          leftRect: roundedRect(leftRect),
          rightRect: roundedRect(rightRect),
          passed: !intersects(leftRect, rightRect)
        });
      }
    }
  }

  return { state: config.state, checks, failures };
}
"""

BASE_COUNTS = [
    {"name": "topbar", "selector": ".topbar", "exact": 1},
    {"name": "status-strip", "selector": ".status-strip", "exact": 1},
    {"name": "demo-flow", "selector": ".demo-flow", "exact": 1},
    {"name": "review-layout", "selector": ".review-layout", "exact": 1},
    {"name": "review-queue", "selector": "[data-guide-target='review-queue']", "exact": 1},
    {"name": "queue-items", "selector": ".queue-item", "minimum": 1},
    {"name": "claim-workspace", "selector": ".claim-workspace", "exact": 1},
    {"name": "source-comparison", "selector": "[data-guide-target='source-comparison']", "exact": 1},
    {"name": "comparison-cards", "selector": ".comparison-card", "exact": 2},
    {"name": "comparison-divider", "selector": ".comparison-divider", "exact": 1},
    {"name": "source-record", "selector": ".source-record", "exact": 1},
    {"name": "rule-trace", "selector": ".rule-trace", "exact": 1},
    {"name": "reviewer-decision", "selector": "[data-guide-target='reviewer-decision']", "exact": 1},
    {"name": "decision-buttons", "selector": ".decision-actions > button", "exact": 3},
    {"name": "evidence-preview", "selector": "[data-guide-target='evidence-preview']", "exact": 1},
    {"name": "pack-options", "selector": ".pack-select option", "exact": 3},
]

CONTAINMENT_TARGETS = [
    {"name": "topbar", "selector": ".topbar", "boundarySelector": ".workspace"},
    {"name": "status-strip", "selector": ".status-strip", "boundarySelector": ".workspace"},
    {"name": "demo-flow", "selector": ".demo-flow", "boundarySelector": ".workspace"},
    {"name": "review-layout", "selector": ".review-layout", "boundarySelector": ".workspace"},
    {"name": "review-queue", "selector": "[data-guide-target='review-queue']", "boundarySelector": ".review-layout"},
    {"name": "source-comparison", "selector": "[data-guide-target='source-comparison']", "boundarySelector": ".claim-workspace"},
    {"name": "source-record", "selector": ".source-record", "boundarySelector": ".claim-workspace"},
    {"name": "rule-trace", "selector": ".rule-trace", "boundarySelector": ".claim-workspace"},
    {"name": "reviewer-decision", "selector": "[data-guide-target='reviewer-decision']", "boundarySelector": ".claim-workspace"},
    {"name": "evidence-preview", "selector": "[data-guide-target='evidence-preview']", "boundarySelector": ".review-layout"},
]

SCROLL_SELECTORS = [
    ".topbar", ".topbar-actions", ".status-strip", ".demo-flow", ".review-layout",
    ".queue-panel", ".queue-list", ".queue-item", ".claim-workspace", ".comparison",
    ".comparison-card", ".source-record", ".rule-trace", ".trace-line", ".decision-bar",
    ".decision-actions", ".decision-actions > button", ".evidence-panel", ".outcome-summary",
    ".guide-launch-card", ".curator-pipeline", ".guide-coach", ".guide-coach-actions",
    ".dialog-backdrop > div", ".decision-dialog", ".evidence-dialog", ".dialog-actions",
    ".download-actions",
]

PAIRWISE_GROUPS = [
    {"name": "topbar-groups", "selector": ".topbar > div"},
    {"name": "review-columns", "selector": ".review-layout > .queue-panel, .review-layout > .claim-workspace, .review-layout > .evidence-panel"},
    {"name": "comparison-parts", "selector": ".comparison > .comparison-card, .comparison > .comparison-divider"},
    {"name": "source-record-parts", "selector": ".source-record > *"},
    {"name": "rule-trace-parts", "selector": ".trace-line > *"},
    {"name": "decision-buttons", "selector": ".decision-actions > button"},
    {"name": "guide-launch-actions", "selector": ".guide-launch-actions > button"},
    {"name": "guide-coach-parts", "selector": ".guide-coach > *"},
    {"name": "dialog-actions", "selector": ".dialog-actions > button"},
    {"name": "download-actions", "selector": ".download-actions > button"},
]


def state_counts(state):
    decision_dialog = state.startswith("decision-dialog-")
    evidence_dialog = state == "evidence-dialog"
    guided = state.startswith("guided-") or state in {
        "decision-dialog-verified",
        "reviewed-decision",
        "evidence-dialog",
    }
    counts = list(BASE_COUNTS)
    counts.extend([
        {"name": "guide-launch-state", "selector": ".guide-launch", "exact": 1 if state == "guide-launch" else 0},
        {"name": "guide-coach-state", "selector": ".guide-coach", "exact": 1 if guided else 0},
        {"name": "guided-focus-state", "selector": ".guided-focus", "exact": 1 if guided else 0},
        {"name": "dialog-backdrop-state", "selector": ".dialog-backdrop", "exact": 1 if decision_dialog or evidence_dialog else 0},
        {"name": "decision-dialog-state", "selector": ".decision-dialog", "exact": 1 if decision_dialog else 0},
        {"name": "evidence-dialog-state", "selector": ".evidence-dialog", "exact": 1 if evidence_dialog else 0},
        {"name": "audit-note-state", "selector": ".audit-note", "exact": 1 if state in {"reviewed-decision", "guided-evidence-preview", "evidence-dialog"} else 0},
    ])
    if state == "guide-launch":
        counts.extend([
            {"name": "launch-buttons", "selector": ".guide-launch-actions > button", "exact": 2},
            {"name": "curator-pipeline", "selector": ".curator-pipeline", "exact": 1},
        ])
    if decision_dialog:
        counts.extend([
            {"name": "decision-dialog-actions", "selector": ".decision-dialog .dialog-actions > button", "exact": 2},
            {"name": "decision-dialog-close", "selector": ".decision-dialog .dialog-close", "exact": 1},
        ])
    if state in {"reviewed-decision", "guided-evidence-preview", "evidence-dialog"}:
        counts.extend([
            {"name": "disabled-decision-buttons", "selector": ".decision-actions > button:disabled", "exact": 3},
            {"name": "evidence-items", "selector": ".evidence-item", "minimum": 1},
        ])
    if evidence_dialog:
        counts.extend([
            {"name": "download-actions", "selector": ".evidence-dialog .download-actions > button", "exact": 2},
            {"name": "evidence-dialog-close", "selector": ".evidence-dialog .dialog-close", "exact": 1},
        ])
    return counts


def state_containment(state):
    targets = list(CONTAINMENT_TARGETS)
    if state == "guide-launch":
        targets.append({"name": "guide-launch-card", "selector": ".guide-launch-card", "boundarySelector": ".guide-launch"})
    if state.startswith("guided-"):
        targets.append({"name": "guide-coach", "selector": ".guide-coach", "boundarySelector": ".workspace"})
    if state.startswith("decision-dialog-"):
        targets.append({"name": "decision-dialog", "selector": ".decision-dialog", "boundarySelector": ".dialog-backdrop"})
    if state == "evidence-dialog":
        targets.append({"name": "evidence-dialog", "selector": ".evidence-dialog", "boundarySelector": ".dialog-backdrop"})
    return targets


async def measure(page, report, state, width, pack=None):
    geometry = await page.evaluate(GEOMETRY_PROBE, {
        "state": state,
        "requiredCounts": state_counts(state),
        "containmentTargets": state_containment(state),
        "scrollSelectors": SCROLL_SELECTORS,
        "pairwiseGroups": PAIRWISE_GROUPS,
    })
    entry = {
        "state": state,
        "pack": pack,
        "viewport": {"width": width, "height": 960},
        **geometry,
    }
    report["measurements"].append(entry)
    report["states"].add(state)
    for failure in geometry["failures"]:
        report["failures"].append({
            "state": state,
            "pack": pack,
            "viewportWidth": width,
            **failure,
        })


async def enter_free_exploration(page):
    launch = page.locator(".guide-launch")
    if await launch.count():
        await page.locator(".launch-secondary").click()
        await launch.wait_for(state="detached")


def record_contract(report, pack, step, name, passed, expected, actual):
    check = {
        "pack": pack,
        "step": step,
        "name": name,
        "expected": expected,
        "actual": actual,
        "passed": passed,
    }
    report["checks"].append(check)
    if not passed:
        report["failures"].append(check)


async def select_pack(page, pack):
    await page.goto(BASE_URL, wait_until="networkidle")
    await enter_free_exploration(page)
    selector = page.locator(".pack-select select")
    await selector.select_option(value=pack)
    await page.wait_for_function(
        "value => document.querySelector('.pack-select select')?.value === value",
        arg=pack,
    )
    await page.wait_for_timeout(30)


async def reset_review(page):
    await page.locator(".reset-button").click()
    await page.locator(".guide-launch").wait_for(state="visible")
    await enter_free_exploration(page)


async def record_decision(page, decision):
    selector = {
        "rejected": ".decision-actions .reject",
        "corrected": ".decision-actions .correct",
        "verified": ".decision-actions .verify",
    }[decision]
    await page.locator(selector).click()
    dialog = page.locator(".decision-dialog")
    await dialog.wait_for(state="visible")
    await dialog.locator(".primary").click()
    await dialog.wait_for(state="detached")
    await page.locator(".audit-note").wait_for(state="visible")


async def capture_download(page, button_index):
    async with page.expect_download(timeout=3_000) as download_info:
        await page.locator(".evidence-dialog .download-actions > button").nth(button_index).click()
    download = await download_info.value
    path = await download.path()
    with open(path, "rb") as handle:
        contents = handle.read().decode("utf-8")
    return download.suggested_filename, contents


async def assert_empty_projection(page, report, pack, step):
    export_disabled = await page.locator(".export-button").is_disabled()
    evidence_count = await page.locator(".evidence-item").count()
    projected_count = (await page.locator(".evidence-heading .count-badge").inner_text()).strip()
    record_contract(report, pack, step, "preview-download-guard", export_disabled, True, export_disabled)
    record_contract(report, pack, step, "no-evidence-items", evidence_count == 0, 0, evidence_count)
    record_contract(report, pack, step, "canonical-projection-count", projected_count == "0", "0", projected_count)


async def assert_reset(page, report, pack, step):
    await assert_empty_projection(page, report, pack, step)
    decisions = await page.locator(".decision-label").all_inner_texts()
    disabled_buttons = await page.locator(".decision-actions > button:disabled").count()
    audit_count = await page.locator(".audit-note").count()
    record_contract(
        report, pack, step, "all-claims-return-to-pending",
        bool(decisions) and all(label.strip() == "검토 대기" for label in decisions),
        ["검토 대기"] * len(decisions), decisions,
    )
    record_contract(report, pack, step, "decision-buttons-reenabled", disabled_buttons == 0, 0, disabled_buttons)
    record_contract(report, pack, step, "audit-history-cleared", audit_count == 0, 0, audit_count)


def expected_decision(decision):
    if not MUTATE_DECISION_EXPECTATIONS:
        return decision
    return "verified" if decision == "corrected" else "corrected"


def display_value(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


async def assert_projected_downloads(page, report, pack, decision, run_label):
    expected_path = expected_decision(decision)
    expectation = PACK_EXPECTATIONS[pack]
    decision_expectation = DECISION_EXPECTATIONS[expected_path]
    claim_text = (await page.locator(".queue-item.active small").inner_text()).strip()
    decision_label = (await page.locator(".queue-item.active .decision-label").inner_text()).strip()
    evidence_count = await page.locator(".evidence-item").count()
    export_disabled = await page.locator(".export-button").is_disabled()
    record_contract(report, pack, run_label, "decision-label", decision_label == decision_expectation["label"], decision_expectation["label"], decision_label)
    record_contract(report, pack, run_label, "one-canonical-evidence-item", evidence_count == 1, 1, evidence_count)
    record_contract(report, pack, run_label, "preview-enabled", not export_disabled, "enabled", "disabled" if export_disabled else "enabled")

    await page.locator(".export-button").click()
    dialog = page.locator(".evidence-dialog")
    await dialog.wait_for(state="visible")
    footer = (await dialog.locator("footer strong").inner_text()).strip()
    record_contract(report, pack, run_label, "preview-canonical-count", footer == "1건 투영 가능", "1건 투영 가능", footer)

    json_name, json_contents = await capture_download(page, 0)
    markdown_name, markdown_contents = await capture_download(page, 1)
    expected_json_name = f"{pack}-evidence-pack.json"
    expected_markdown_name = f"{pack}-evidence-pack.md"

    record_contract(report, pack, run_label, "json-filename", json_name == expected_json_name, expected_json_name, json_name)
    record_contract(report, pack, run_label, "markdown-filename", markdown_name == expected_markdown_name, expected_markdown_name, markdown_name)
    try:
        parsed_json = json.loads(json_contents)
        json_valid = isinstance(parsed_json, dict)
    except json.JSONDecodeError:
        parsed_json = {}
        json_valid = False
    items = parsed_json.get("items", []) if json_valid else []
    item = items[0] if len(items) == 1 else {}
    expected_history = [{
        "originalAiValue": expectation["aiValue"],
        "sourceValue": expectation["sourceValue"],
        "correctedValue": expectation["sourceValue"],
        "reason": DECISION_EXPECTATIONS["corrected"]["reason"],
        "reviewerId": "데모-검토자",
    }] if expected_path == "corrected" else []
    record_contract(report, pack, run_label, "json-content-valid", json_valid, "JSON object", "JSON object" if json_valid else "invalid JSON")
    record_contract(report, pack, run_label, "json-exact-single-item", len(items) == 1, 1, len(items))
    record_contract(report, pack, run_label, "json-claim-id", item.get("claimId") == expectation["claimId"], expectation["claimId"], item.get("claimId"))
    record_contract(report, pack, run_label, "json-reviewer-decision", item.get("reviewerDecision") == expected_path, expected_path, item.get("reviewerDecision"))
    record_contract(report, pack, run_label, "json-normalized-value", item.get("normalizedValue") == expectation["sourceValue"], expectation["sourceValue"], item.get("normalizedValue"))
    record_contract(report, pack, run_label, "json-reviewer-id", item.get("reviewerId") == "데모-검토자", "데모-검토자", item.get("reviewerId"))
    record_contract(report, pack, run_label, "json-correction-history", item.get("correctionHistory") == expected_history, expected_history, item.get("correctionHistory"))
    correction_reason_present = DECISION_EXPECTATIONS["corrected"]["reason"] in json_contents
    reason_boundary_matches = correction_reason_present if expected_path == "corrected" else not correction_reason_present
    record_contract(report, pack, run_label, "json-correction-reason-boundary", reason_boundary_matches, "exact reason present" if expected_path == "corrected" else "correction reason absent", "matched" if reason_boundary_matches else "mismatch")
    record_contract(report, pack, run_label, "json-content-pack-specific", parsed_json.get("metadata", {}).get("packId") == pack, pack, parsed_json.get("metadata", {}).get("packId"))
    record_contract(report, pack, run_label, "json-content-claim", item.get("claimText") == claim_text, claim_text, item.get("claimText"))
    record_contract(report, pack, run_label, "json-content-fixed-time", parsed_json.get("generatedAt") == "2026-07-08T00:00:00.000Z", "2026-07-08T00:00:00.000Z", parsed_json.get("generatedAt"))

    markdown_decision = f"검토자 판정: {decision_expectation['label']}"
    expected_correction = (
        f"- 정정 이력: {display_value(expectation['aiValue'])} → {display_value(expectation['sourceValue'])} "
        f"({DECISION_EXPECTATIONS['corrected']['reason']})"
    )
    record_contract(report, pack, run_label, "markdown-content-claim", f"- 주장: {claim_text}" in markdown_contents, f"- 주장: {claim_text}", "present" if f"- 주장: {claim_text}" in markdown_contents else "missing")
    record_contract(report, pack, run_label, "markdown-reviewer-decision", markdown_decision in markdown_contents, markdown_decision, "present" if markdown_decision in markdown_contents else "missing")
    record_contract(report, pack, run_label, "markdown-reviewer-id", "- 검토자: 데모-검토자" in markdown_contents, "- 검토자: 데모-검토자", "present" if "- 검토자: 데모-검토자" in markdown_contents else "missing")
    correction_matches = expected_correction in markdown_contents if expected_path == "corrected" else "- 정정 이력:" not in markdown_contents
    record_contract(report, pack, run_label, "markdown-correction-boundary", correction_matches, expected_correction if expected_path == "corrected" else "정정 이력 부재", "matched" if correction_matches else "mismatch")
    record_contract(report, pack, run_label, "markdown-content-count", "근거 항목: 1" in markdown_contents, "근거 항목: 1", "present" if "근거 항목: 1" in markdown_contents else "missing")
    record_contract(report, pack, run_label, "markdown-content-fixed-time", "생성 시각: 2026-07-08T00:00:00.000Z" in markdown_contents, "생성 시각: 2026-07-08T00:00:00.000Z", "present" if "생성 시각: 2026-07-08T00:00:00.000Z" in markdown_contents else "missing")
    await page.keyboard.press("Escape")
    await dialog.wait_for(state="detached")
    return {"json": json_contents, "markdown": markdown_contents}


async def run_judge_flow():
    report = {"status": "PASS", "packs": sorted(EXPECTED_PACKS), "checks": [], "failures": []}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            page = await browser.new_page(viewport={"width": 1440, "height": 960}, accept_downloads=True)
            for pack in sorted(EXPECTED_PACKS):
                await select_pack(page, pack)
                await assert_empty_projection(page, report, pack, "pending")

                await record_decision(page, "rejected")
                await assert_empty_projection(page, report, pack, "rejected")
                rejected_label = (await page.locator(".queue-item.active .decision-label").inner_text()).strip()
                record_contract(report, pack, "rejected", "rejected-state-visible", rejected_label == "기각", "기각", rejected_label)

                await reset_review(page)
                await assert_reset(page, report, pack, "reset-after-reject")

                await record_decision(page, "corrected")
                corrected_first = await assert_projected_downloads(page, report, pack, "corrected", "corrected-first")

                await reset_review(page)
                await assert_reset(page, report, pack, "reset-after-correct")

                await record_decision(page, "corrected")
                corrected_repeat = await assert_projected_downloads(page, report, pack, "corrected", "corrected-repeat")
                record_contract(report, pack, "corrected-repeat", "json-byte-stable-after-reset", corrected_repeat["json"] == corrected_first["json"], "byte-for-byte equal", "equal" if corrected_repeat["json"] == corrected_first["json"] else "different")
                record_contract(report, pack, "corrected-repeat", "markdown-byte-stable-after-reset", corrected_repeat["markdown"] == corrected_first["markdown"], "byte-for-byte equal", "equal" if corrected_repeat["markdown"] == corrected_first["markdown"] else "different")

                await reset_review(page)
                await assert_reset(page, report, pack, "reset-after-correct-repeat")

                await record_decision(page, "verified")
                verified_first = await assert_projected_downloads(page, report, pack, "verified", "verified-first")

                await reset_review(page)
                await assert_reset(page, report, pack, "reset-after-verify")

                await record_decision(page, "verified")
                verified_repeat = await assert_projected_downloads(page, report, pack, "verified", "verified-repeat")
                record_contract(report, pack, "verified-repeat", "json-byte-stable-after-reset", verified_repeat["json"] == verified_first["json"], "byte-for-byte equal", "equal" if verified_repeat["json"] == verified_first["json"] else "different")
                record_contract(report, pack, "verified-repeat", "markdown-byte-stable-after-reset", verified_repeat["markdown"] == verified_first["markdown"], "byte-for-byte equal", "equal" if verified_repeat["markdown"] == verified_first["markdown"] else "different")

                await reset_review(page)
                await assert_reset(page, report, pack, "reset-after-verify-repeat")
        finally:
            await browser.close()

    if report["failures"]:
        report["status"] = "FAIL"
    print(json.dumps({
        "status": report["status"],
        "packs": report["packs"],
        "decisions": ["rejected", "corrected", "verified"],
        "resetPaths": 5,
        "checks": len(report["checks"]),
        "failureCount": len(report["failures"]),
        "failures": report["failures"],
    }, ensure_ascii=False, indent=2))
    return 1 if report["failures"] else 0


async def run():
    report = {
        "status": "PASS",
        "url": BASE_URL,
        "viewports": VIEWPORTS,
        "interactionViewports": INTERACTION_VIEWPORTS,
        "packs": [],
        "states": set(),
        "measurements": [],
        "failures": [],
    }
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            page = await browser.new_page(viewport={"width": VIEWPORTS[0], "height": 960})
            await page.goto(BASE_URL, wait_until="networkidle")
            await enter_free_exploration(page)
            pack_select = page.locator(".pack-select select")
            packs = await pack_select.locator("option").evaluate_all(
                "options => options.map(option => ({ value: option.value, label: option.textContent.trim() }))"
            )
            report["packs"] = packs
            actual_packs = {pack["value"] for pack in packs}
            if actual_packs != EXPECTED_PACKS:
                report["failures"].append({
                    "name": "three-pack-matrix",
                    "expected": sorted(EXPECTED_PACKS),
                    "actual": sorted(actual_packs),
                })

            for width in VIEWPORTS:
                await page.set_viewport_size({"width": width, "height": 960})
                for pack in packs:
                    await pack_select.select_option(value=pack["value"])
                    await page.wait_for_function(
                        "value => document.querySelector('.pack-select select')?.value === value",
                        arg=pack["value"],
                    )
                    await page.wait_for_timeout(30)
                    await measure(page, report, "free-exploration", width, pack["value"])

            for width in INTERACTION_VIEWPORTS:
                await page.set_viewport_size({"width": width, "height": 960})
                await page.goto(BASE_URL, wait_until="networkidle")
                await enter_free_exploration(page)
                for decision in ["rejected", "corrected"]:
                    await page.locator(".decision-actions ." + ("reject" if decision == "rejected" else "correct")).click()
                    await page.locator(".decision-dialog").wait_for(state="visible")
                    await measure(page, report, "decision-dialog-" + decision, width, "mofa-oda")
                    await page.keyboard.press("Escape")
                    await page.locator(".decision-dialog").wait_for(state="detached")

                await page.goto(BASE_URL, wait_until="networkidle")
                await measure(page, report, "guide-launch", width, "mofa-oda")
                await page.locator(".launch-primary").click()
                await page.locator(".guide-coach").wait_for(state="visible")
                await measure(page, report, "guided-review-queue", width, "mofa-oda")
                await page.locator(".guide-next").click()
                await page.wait_for_timeout(30)
                await measure(page, report, "guided-source-comparison", width, "mofa-oda")
                await page.locator(".guide-next").click()
                await page.wait_for_timeout(30)
                await measure(page, report, "guided-reviewer-decision", width, "mofa-oda")
                await page.locator(".decision-actions .verify").click()
                await page.locator(".decision-dialog").wait_for(state="visible")
                await measure(page, report, "decision-dialog-verified", width, "mofa-oda")
                await page.locator(".decision-dialog .primary").click()
                await page.locator(".audit-note").wait_for(state="visible")
                await measure(page, report, "reviewed-decision", width, "mofa-oda")
                await page.locator(".guide-next").click()
                await page.wait_for_timeout(30)
                await measure(page, report, "guided-evidence-preview", width, "mofa-oda")
                await page.locator(".export-button").click()
                await page.locator(".evidence-dialog").wait_for(state="visible")
                await measure(page, report, "evidence-dialog", width, "mofa-oda")
                await page.keyboard.press("Escape")
                await page.locator(".evidence-dialog").wait_for(state="detached")
        finally:
            await browser.close()

    missing_states = EXPECTED_STATES - report["states"]
    if missing_states:
        report["failures"].append({
            "name": "interaction-state-matrix",
            "expected": sorted(EXPECTED_STATES),
            "actual": sorted(report["states"]),
            "missing": sorted(missing_states),
        })
    report["states"] = sorted(report["states"])
    if report["failures"]:
        report["status"] = "FAIL"
    output = {
        "status": report["status"],
        "packs": [pack["value"] for pack in report["packs"]],
        "viewports": report["viewports"],
        "interactionViewports": report["interactionViewports"],
        "states": report["states"],
        "measurements": len(report["measurements"]),
        "checks": sum(len(entry["checks"]) for entry in report["measurements"]),
        "failureCount": len(report["failures"]),
        "failures": report["failures"][:100],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if report["failures"] else 0


try:
    exit_code = asyncio.run(run_judge_flow() if JUDGE_FLOW else run())
except Exception as error:
    print(json.dumps({
        "status": "BLOCKED",
        "reason": "browser geometry audit could not run",
        "detail": str(error),
    }, ensure_ascii=False, indent=2))
    exit_code = 2
sys.exit(exit_code)
`;

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, options);
  child.processGroup = process.platform !== 'win32' && Boolean(options.detached);
  managedChildren.add(child);
  child.once('exit', () => managedChildren.delete(child));
  return child;
}

function waitForExit(child, timeoutMs) {
  if (hasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(hasExited(child));
    }, timeoutMs);
    child.once('exit', onExit);
  });
}

function signalProcess(child, signal) {
  if (hasExited(child)) return false;
  try {
    if (child.processGroup && child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function terminateProcess(child, label, graceMs = 1_500) {
  if (hasExited(child)) return { label, signal: null, escalated: false, exited: true };
  signalProcess(child, 'SIGTERM');
  if (await waitForExit(child, graceMs)) {
    return { label, signal: 'SIGTERM', escalated: false, exited: true };
  }
  signalProcess(child, 'SIGKILL');
  const exited = await waitForExit(child, graceMs);
  if (!exited) throw new Error(`${label} did not exit after SIGKILL`);
  return { label, signal: 'SIGKILL', escalated: true, exited: true };
}

async function cleanupManagedChildren() {
  const children = [...managedChildren];
  return Promise.all(children.map((child, index) => terminateProcess(child, `managed-child-${index + 1}`)));
}

function installSignalCleanup() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      void cleanupManagedChildren().finally(() => process.kill(process.pid, signal));
    });
  }
}

async function runCleanupSelfTest() {
  const graceful = spawnManaged(process.execPath, ['-e', "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000)"], {
    detached: process.platform !== 'win32',
    stdio: 'ignore'
  });
  const stubborn = spawnManaged(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], {
    detached: process.platform !== 'win32',
    stdio: 'ignore'
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const gracefulResult = await terminateProcess(graceful, 'graceful-child', 500);
  const stubbornResult = await terminateProcess(stubborn, 'stubborn-child', 250);
  if (gracefulResult.escalated || !stubbornResult.escalated) {
    throw new Error('cleanup escalation contract failed');
  }
  console.log(JSON.stringify({ status: 'PASS', graceful: gracefulResult, forced: stubbornResult }, null, 2));
}

function startPreview() {
  const child = spawnManaged(
    'pnpm',
    ['--filter', '@claimgate/example-civic-review-app', 'exec', 'vite', 'preview', '--host', host, '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.previewOutput = () => output;
  return child;
}

async function waitForPreview(child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (hasExited(child)) throw new Error(`Vite preview exited early (${child.exitCode}).\n${child.previewOutput()}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${baseUrl}.\n${child.previewOutput()}`);
}

function waitForAudit(child) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      void terminateProcess(child, 'python-geometry-audit').catch(reject);
    }, 60_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve(timedOut ? 124 : code ?? (signal ? 1 : 0));
    });
  });
}

async function runGeometryAudit(judgeFlow = false) {
  const preview = startPreview();
  try {
    await waitForPreview(preview);
    const audit = spawnManaged(process.env.PYTHON ?? 'python3', ['-c', pythonAudit], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAIMGATE_GEOMETRY_URL: baseUrl,
        CLAIMGATE_GEOMETRY_VIEWPORTS: JSON.stringify(viewports),
        CLAIMGATE_GEOMETRY_INTERACTION_VIEWPORTS: JSON.stringify(interactionViewports),
        CLAIMGATE_JUDGE_FLOW: judgeFlow ? '1' : '0'
      },
      stdio: 'inherit'
    });
    process.exitCode = await waitForAudit(audit);
  } finally {
    const cleanup = await cleanupManagedChildren();
    console.log(JSON.stringify({ cleanup }, null, 2));
  }
}

installSignalCleanup();
if (process.argv.includes('--cleanup-self-test')) await runCleanupSelfTest();
else await runGeometryAudit(process.argv.includes('--judge-flow'));
