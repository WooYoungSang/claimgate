import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.CLAIMGATE_GEOMETRY_PORT ?? '41739', 10);
const baseUrl = `http://${host}:${port}`;
const viewports = [320, 420, 820, 1180, 1440, 1920];

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
EXPECTED_PACKS = {"civic-data", "health-data", "mofa-oda"}

GEOMETRY_PROBE = r"""
() => {
  const tolerance = 1;
  const failures = [];
  const checks = [];
  const root = document.documentElement;

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

  const documentCheck = {
    name: 'document-horizontal-overflow',
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    passed: root.scrollWidth <= root.clientWidth + tolerance
  };
  checks.push(documentCheck);
  if (!documentCheck.passed) failures.push(documentCheck);

  const targets = [
    ['review-queue', '[data-guide-target="review-queue"]', '.review-layout'],
    ['source-comparison', '[data-guide-target="source-comparison"]', '.claim-workspace'],
    ['reviewer-decision', '[data-guide-target="reviewer-decision"]', '.claim-workspace'],
    ['evidence-preview', '[data-guide-target="evidence-preview"]', '.review-layout']
  ];

  for (const [name, selector, boundarySelector] of targets) {
    const element = document.querySelector(selector);
    const boundary = element?.closest(boundarySelector) ?? document.querySelector(boundarySelector);
    if (!element || !boundary) {
      const check = { name, selector, boundarySelector, passed: false, reason: 'missing-element' };
      checks.push(check);
      failures.push(check);
      continue;
    }
    const rect = element.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const inViewport = rect.left >= -tolerance && rect.right <= root.clientWidth + tolerance;
    const inBoundary = contains(boundaryRect, rect);
    const check = {
      name,
      selector,
      boundarySelector,
      rect: roundedRect(rect),
      boundaryRect: roundedRect(boundaryRect),
      inViewport,
      inBoundary,
      passed: rect.width > 0 && rect.height > 0 && inViewport && inBoundary
    };
    checks.push(check);
    if (!check.passed) failures.push(check);
  }

  const decisionBar = document.querySelector('[data-guide-target="reviewer-decision"]');
  if (decisionBar) {
    const barRect = decisionBar.getBoundingClientRect();
    const buttons = Array.from(decisionBar.querySelectorAll('.decision-actions button'));
    for (const [index, button] of buttons.entries()) {
      const rect = button.getBoundingClientRect();
      const check = {
        name: 'reviewer-decision-button-' + (index + 1),
        selector: '.decision-actions button:nth-of-type(' + (index + 1) + ')',
        rect: roundedRect(rect),
        boundaryRect: roundedRect(barRect),
        passed: rect.width > 0 && rect.height > 0 && contains(barRect, rect)
      };
      checks.push(check);
      if (!check.passed) failures.push(check);
    }
  }

  return {
    document: { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth },
    checks,
    failures
  };
}
"""


async def run():
    report = {
        "status": "PASS",
        "url": BASE_URL,
        "viewports": VIEWPORTS,
        "packs": [],
        "matrix": [],
        "failures": [],
    }
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            page = await browser.new_page(viewport={"width": VIEWPORTS[0], "height": 960})
            await page.goto(BASE_URL, wait_until="networkidle")
            launch = page.locator(".guide-launch")
            if await launch.count():
                await page.locator(".launch-secondary").click()
                await launch.wait_for(state="detached")

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
                    await page.wait_for_timeout(50)
                    geometry = await page.evaluate(GEOMETRY_PROBE)
                    entry = {
                        "pack": pack["value"],
                        "packLabel": pack["label"],
                        "viewport": {"width": width, "height": 960},
                        **geometry,
                    }
                    report["matrix"].append(entry)
                    for failure in geometry["failures"]:
                        report["failures"].append({
                            "pack": pack["value"],
                            "viewportWidth": width,
                            **failure,
                        })
        finally:
            await browser.close()

    if report["failures"]:
        report["status"] = "FAIL"
    output = report if report["failures"] else {
        "status": report["status"],
        "packs": [pack["value"] for pack in report["packs"]],
        "viewports": report["viewports"],
        "matrixCases": len(report["matrix"]),
        "checks": sum(len(entry["checks"]) for entry in report["matrix"]),
        "failures": 0,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if report["failures"] else 0


try:
    exit_code = asyncio.run(run())
except Exception as error:
    print(json.dumps({
        "status": "BLOCKED",
        "reason": "browser geometry audit could not run",
        "detail": str(error),
    }, ensure_ascii=False, indent=2))
    exit_code = 2
sys.exit(exit_code)
`;

function startPreview() {
  const child = spawn(
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
    if (child.exitCode !== null) {
      throw new Error(`Vite preview exited early (${child.exitCode}).\n${child.previewOutput()}`);
    }
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

function stopPreview(child) {
  if (child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32') child.kill('SIGTERM');
  else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}

const preview = startPreview();
try {
  await waitForPreview(preview);
  const audit = spawn(process.env.PYTHON ?? 'python3', ['-c', pythonAudit], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAIMGATE_GEOMETRY_URL: baseUrl,
      CLAIMGATE_GEOMETRY_VIEWPORTS: JSON.stringify(viewports)
    },
    stdio: 'inherit'
  });
  const exitCode = await new Promise((resolve, reject) => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      audit.kill('SIGTERM');
    }, 60_000);
    audit.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    audit.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve(timedOut ? 124 : code ?? (signal ? 1 : 0));
    });
  });
  process.exitCode = exitCode;
} finally {
  stopPreview(preview);
}
