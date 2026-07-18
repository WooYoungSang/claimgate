#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const DEFAULT_PORTFOLIO_PATH =
  "artifacts/portfolio/claimgate-shapeops-closeout.json";
export const DEFAULT_RUNBOOK_PATH =
  "docs/demo/shapeops-portfolio-closeout-runbook.md";

const PROTECTED_PREFIX = "docs/submission/2026-mofa-ai/";
const BASE_COMMIT = "ff7973cb7e54040998ad468bbda8017de74f9df6";

const EXPECTED_BETS = [
  [
    "bet-warvis-claimgate--claimgate-demo-browser-geometry-regression-suite",
    "bb3c993d3172373bbb6bc47336bf597926aac1a2",
    "merge: browser geometry regression Bet",
  ],
  [
    "bet-warvis-claimgate--claimgate-demo-end-to-end-judge-flow-qa",
    "b9daa72d21a04ce860403847554e33f940570d38",
    "merge: end-to-end judge flow QA Bet",
  ],
  [
    "bet-warvis-claimgate--claimgate-demo-korean-runbook-and-screen-copy-sync",
    "91fc4d0fe5e6ace3d7d4e2877b14c268d73f7f6a",
    "merge: Korean demo runbook sync Bet",
  ],
  [
    "bet-warvis-claimgate--claimgate-clean-clone-reproducibility-gate",
    "f4af33f7761f45546f46c08c8d36501dc59306cc",
    "merge: clean clone reproducibility Bet",
  ],
  [
    "bet-warvis-claimgate--claimgate-demo-deployment-and-cloudflare-hardening",
    "890d427e7bdd296113fbbf7b40480b45f1c757ee",
    "merge: deployment and Cloudflare hardening Bet",
  ],
  [
    "bet-warvis-claimgate--claimgate-mofa-submission-video-and-final-evidence-bundle",
    "ff7973cb7e54040998ad468bbda8017de74f9df6",
    "merge: MOFA submission evidence Bet",
  ],
];

const DEPLOYMENT_FAILURES = [
  "root-cache",
  "spa-cache",
  "html-security-headers",
  "js-asset-cache",
  "css-asset-cache",
];

const CLEAN_CLONE_NITS = [
  "symlink-named-node_modules-detection",
  "signal-self-test-readiness-race",
  "integrated-failure-json-assertion-strengthening",
];

const REQUIRED_NO_GO = [
  "live-openapi",
  "real-llm",
  "ocr",
  "server",
  "database",
  "authentication",
  "production-accuracy",
  "agent-self-ratification",
  "agent-external-deployment-or-submission",
];

const OPERATOR_WORK = [
  ["operator-production-caddy", true],
  ["operator-green-public-probe", false],
  ["operator-record-video", false],
  ["operator-measure-two-rehearsals", false],
  ["operator-upload-and-submit", true],
  ["operator-ratify-lifecycle-closeouts", true],
];

const RUNBOOK_TRUTHS = [
  "`main`에 병합됐지만 ShapeOps `phase`는 모두 `reviewing`",
  "대상 6 / `main` 병합 6 / `reviewing` 6 / `shipped` 0 / agent 자기 승인 0.",
  "production node에는 아직 적용되지 않았다.",
  "정확히 다음 5개 실패",
  "실제 3분 영상은 촬영되지 않았다.",
  "독립 리허설 2회는 요구되지만 실측값은 0회다.",
  "이름이 `node_modules`인 symlink 탐지 강화",
  "signal self-test 준비 완료 시점 경쟁(race) 제거",
  "통합 failure JSON report assertion 강화",
  "어떤 terminal transition도 수행하지 않았다.",
];

const exact = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);

const git = (args, cwd) =>
  spawnSync("git", args, { cwd, encoding: "utf8" });

const mergeInfo = (commit, cwd) => {
  const result = git(["show", "-s", "--format=%s", commit], cwd);
  return result.status === 0 ? result.stdout.trim() : null;
};

const resolvesAsCommit = (commit, cwd) =>
  /^[a-f0-9]{40}$/u.test(commit ?? "") &&
  git(["cat-file", "-e", `${commit}^{commit}`], cwd).status === 0;

const isHeadAncestor = (commit, cwd) =>
  resolvesAsCommit(commit, cwd) &&
  git(["merge-base", "--is-ancestor", commit, "HEAD"], cwd).status === 0;

const pushExactError = (errors, actual, expected, message) => {
  if (!exact(actual, expected)) errors.push(message);
};

const defaultSummary = () => ({
  targetBetCount: 0,
  mergedToMainCount: 0,
  reviewingCount: 0,
  shippedCount: 0,
  pendingOperatorWorkCount: 0,
  deploymentFailureCount: 0,
  measuredRehearsalCount: 0,
  cleanCloneNitCount: 0,
  terminalTransitionCount: 0,
});

export const validatePortfolioCloseout = async (
  portfolio,
  {
    rootDir = process.cwd(),
    runbookText,
    packageJson,
  } = {},
) => {
  const errors = [];
  const root = resolve(rootDir);
  const runbook =
    runbookText ??
    (await readFile(resolve(root, DEFAULT_RUNBOOK_PATH), "utf8"));
  const pkg =
    packageJson ??
    JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

  if (portfolio?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (
    portfolio?.portfolioBetId !==
    "bet-warvis-claimgate--claimgate-shapeops-portfolio-reconciliation-and-closeout"
  ) {
    errors.push("portfolio Bet identity mismatch");
  }
  if (portfolio?.portfolioStatus !== "operator-closeout-pending") {
    errors.push("portfolio status must remain operator-closeout-pending");
  }

  const actualIds = (portfolio?.bets ?? []).map((bet) => bet.id);
  const expectedIds = EXPECTED_BETS.map(([id]) => id);
  pushExactError(
    errors,
    actualIds,
    expectedIds,
    "Bet inventory must exactly match the six earlier Bets",
  );

  for (const [id, commit, subject] of EXPECTED_BETS) {
    const bet = portfolio?.bets?.find((item) => item.id === id);
    if (!bet) continue;
    if (bet.phase !== "reviewing") {
      errors.push(`${id} must remain phase=reviewing`);
    }
    if (bet.mergedToMain !== true) {
      errors.push(`${id} must record mergedToMain=true`);
    }
    if (!resolvesAsCommit(bet.mergeCommit, root)) {
      errors.push(`${id} merge commit does not resolve`);
    } else if (!isHeadAncestor(bet.mergeCommit, root)) {
      errors.push(`${id} merge commit is not an ancestor of HEAD`);
    }
    if (bet.mergeCommit !== commit || mergeInfo(bet.mergeCommit, root) !== subject) {
      errors.push(`${id} merge subject mismatch`);
    }
    if (bet.mergeSubject !== subject) {
      errors.push(`${id} declared merge subject mismatch`);
    }
    if (!Array.isArray(bet.evidenceRefs) || bet.evidenceRefs.length === 0) {
      errors.push(`${id} requires evidenceRefs`);
    }
    for (const ref of bet.evidenceRefs ?? []) {
      const path = ref.split("#", 1)[0];
      if (path.startsWith(PROTECTED_PREFIX)) {
        errors.push(`protected submission path is forbidden: ${path}`);
      } else if (!existsSync(resolve(root, path))) {
        errors.push(`evidence path does not exist: ${path}`);
      }
    }
    if (!Array.isArray(bet.outstanding) || bet.outstanding.length === 0) {
      errors.push(`${id} requires outstanding operator work`);
    }
    if (typeof bet.nextGate !== "string" || bet.nextGate.length === 0) {
      errors.push(`${id} requires nextGate`);
    }
  }

  const deployment = portfolio?.bets?.find((bet) => bet.publicDeployment)
    ?.publicDeployment;
  if (
    !deployment ||
    deployment.status !== "pending" ||
    deployment.productionCaddyApplied !== false ||
    deployment.probeObservedExit !== 1 ||
    deployment.failureCount !== 5 ||
    !exact(deployment.failureIds, DEPLOYMENT_FAILURES)
  ) {
    errors.push("public deployment contract mismatch: keep exact five pending failures");
  }

  const video = portfolio?.bets?.find((bet) => bet.video)?.video;
  if (
    !video ||
    video.storyboardOnly !== true ||
    video.recorded !== false ||
    video.uploaded !== false ||
    video.rehearsalCountRequired !== 2 ||
    video.rehearsalCountMeasured !== 0 ||
    video.evidenceSlotCount !== 8 ||
    video.completedEvidenceSlotCount !== 0
  ) {
    errors.push("video contract must remain storyboard-only and pending");
  }

  const nits = portfolio?.bets?.find((bet) => bet.carryForwardNits)
    ?.carryForwardNits;
  pushExactError(
    errors,
    nits,
    CLEAN_CLONE_NITS,
    "clean-clone carry-forward NITs must exactly match",
  );
  pushExactError(
    errors,
    portfolio?.requiredNoGo,
    REQUIRED_NO_GO,
    "requiredNoGo must exactly match FUTURE/No-Go boundaries",
  );

  const operatorShape = (portfolio?.operatorWork ?? []).map((item) => [
    item.id,
    item.requiresApproval,
  ]);
  pushExactError(
    errors,
    operatorShape,
    OPERATOR_WORK,
    "operator work inventory must exactly match",
  );
  if ((portfolio?.operatorWork ?? []).some((item) => item.status !== "pending")) {
    errors.push("operator work must remain pending");
  }
  if ((portfolio?.terminalTransitionsPerformed ?? []).length !== 0) {
    errors.push("terminal transitions must remain empty");
  }
  if (portfolio?.summary?.selfApprovedTransitionCount !== 0) {
    errors.push("self-approved transition count must be zero");
  }

  const expectedSummary = {
    targetBetCount: 6,
    mergedToMainCount: 6,
    reviewingCount: 6,
    shippedCount: 0,
    selfApprovedTransitionCount: 0,
  };
  pushExactError(
    errors,
    portfolio?.summary,
    expectedSummary,
    "portfolio summary must exactly match 6 merged / 6 reviewing / 0 shipped",
  );

  for (const truth of RUNBOOK_TRUTHS) {
    if (!runbook.includes(truth)) {
      errors.push(`runbook exact truth missing: ${truth}`);
    }
  }
  for (const [id, commit] of EXPECTED_BETS) {
    if (!runbook.includes(`\`${commit.slice(0, 7)}\``)) {
      errors.push(`runbook merge ref missing: ${id}`);
    }
  }
  for (const noGo of ["live OpenAPI", "real LLM", "OCR", "production accuracy"]) {
    if (!runbook.includes(noGo)) errors.push(`runbook No-Go missing: ${noGo}`);
  }

  const expectedPortfolioScript =
    "node --test scripts/validate-shapeops-portfolio-closeout.test.mjs && node scripts/validate-shapeops-portfolio-closeout.mjs";
  if (pkg?.scripts?.["test:portfolio-closeout"] !== expectedPortfolioScript) {
    errors.push("portfolio test script must be exact and non-recursive");
  }
  const defaultTest = pkg?.scripts?.test ?? "";
  const invocationCount = defaultTest
    .split("pnpm test:portfolio-closeout")
    .length - 1;
  if (invocationCount !== 1) {
    errors.push("default test must invoke portfolio closeout gate exactly once");
  }

  const protectedDiff = git(
    ["diff", "--name-only", BASE_COMMIT, "--", PROTECTED_PREFIX],
    root,
  );
  if (protectedDiff.status !== 0 || protectedDiff.stdout.trim() !== "") {
    errors.push("protected submission path diff must remain zero");
  }

  const summary = errors.length === 0
    ? {
        targetBetCount: portfolio.bets.length,
        mergedToMainCount: portfolio.bets.filter((bet) => bet.mergedToMain).length,
        reviewingCount: portfolio.bets.filter((bet) => bet.phase === "reviewing").length,
        shippedCount: portfolio.bets.filter((bet) => bet.phase === "shipped").length,
        pendingOperatorWorkCount: portfolio.operatorWork.filter(
          (item) => item.status === "pending",
        ).length,
        deploymentFailureCount: deployment.failureCount,
        measuredRehearsalCount: video.rehearsalCountMeasured,
        cleanCloneNitCount: nits.length,
        terminalTransitionCount: portfolio.terminalTransitionsPerformed.length,
      }
    : defaultSummary();

  return { ok: errors.length === 0, errors, summary };
};

export const validatePortfolioCloseoutFiles = async (
  portfolioPath = DEFAULT_PORTFOLIO_PATH,
  { rootDir = process.cwd() } = {},
) => {
  const root = resolve(rootDir);
  const portfolio = JSON.parse(
    await readFile(resolve(root, portfolioPath), "utf8"),
  );
  return validatePortfolioCloseout(portfolio, { rootDir: root });
};

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const result = await validatePortfolioCloseoutFiles(process.argv[2]);
  console.log(
    JSON.stringify(
      {
        status: result.ok ? "PASS" : "FAIL",
        bundlePath: process.argv[2] ?? DEFAULT_PORTFOLIO_PATH,
        ...result,
      },
      null,
      2,
    ),
  );
  if (!result.ok) process.exitCode = 1;
}
