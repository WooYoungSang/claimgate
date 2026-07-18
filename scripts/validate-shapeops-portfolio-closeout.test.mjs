import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_PORTFOLIO_PATH,
  validatePortfolioCloseout,
  validatePortfolioCloseoutFiles,
} from "./validate-shapeops-portfolio-closeout.mjs";

const loadPortfolio = async () =>
  JSON.parse(await readFile(DEFAULT_PORTFOLIO_PATH, "utf8"));

const loadRunbook = () =>
  readFile("docs/demo/shapeops-portfolio-closeout-runbook.md", "utf8");

const mutate = async (callback) => {
  const portfolio = await loadPortfolio();
  callback(portfolio);
  return validatePortfolioCloseout(portfolio, {
    runbookText: await loadRunbook(),
  });
};

test("canonical ShapeOps portfolio closeout packet passes", async () => {
  const result = await validatePortfolioCloseoutFiles();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.summary, {
    targetBetCount: 6,
    mergedToMainCount: 6,
    reviewingCount: 6,
    shippedCount: 0,
    pendingOperatorWorkCount: 6,
    deploymentFailureCount: 5,
    measuredRehearsalCount: 0,
    cleanCloneNitCount: 3,
    terminalTransitionCount: 0,
  });
});

test("missing or extra Bet fails the exact portfolio inventory", async () => {
  let result = await mutate((portfolio) => portfolio.bets.pop());
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Bet inventory must exactly match/);

  result = await mutate((portfolio) =>
    portfolio.bets.push({ ...portfolio.bets[0], id: "unexpected-bet" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Bet inventory must exactly match/);
});

test("merged code cannot overclaim a shipped ShapeOps phase", async () => {
  const result = await mutate((portfolio) => {
    portfolio.bets[0].phase = "shipped";
    portfolio.summary.reviewingCount = 5;
    portfolio.summary.shippedCount = 1;
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /must remain phase=reviewing/);
});

test("merge identity and ancestry are immutable", async () => {
  const result = await mutate((portfolio) => {
    portfolio.bets[0].mergeCommit = "f".repeat(40);
    portfolio.bets[0].mergeSubject = "fabricated merge";
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /merge commit does not resolve/);
  assert.match(result.errors.join("\n"), /merge subject mismatch/);
});

test("public deployment must preserve the exact five failures", async () => {
  const result = await mutate((portfolio) => {
    const deployment = portfolio.bets.find((bet) => bet.publicDeployment);
    deployment.publicDeployment.status = "pass";
    deployment.publicDeployment.productionCaddyApplied = true;
    deployment.publicDeployment.probeObservedExit = 0;
    deployment.publicDeployment.failureCount = 0;
    deployment.publicDeployment.failureIds = [];
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /public deployment contract mismatch/);
});

test("actual video, upload and rehearsals cannot be overclaimed", async () => {
  const result = await mutate((portfolio) => {
    const video = portfolio.bets.find((bet) => bet.video).video;
    video.storyboardOnly = false;
    video.recorded = true;
    video.uploaded = true;
    video.rehearsalCountMeasured = 2;
    video.completedEvidenceSlotCount = 8;
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /video contract must remain storyboard-only and pending/);
});

test("all three clean-clone carry-forward NITs are required", async () => {
  const result = await mutate((portfolio) => {
    portfolio.bets.find((bet) => bet.carryForwardNits).carryForwardNits.pop();
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /clean-clone carry-forward NITs must exactly match/);
});

test("FUTURE and No-Go boundaries are exact", async () => {
  const result = await mutate((portfolio) => {
    portfolio.requiredNoGo = portfolio.requiredNoGo.filter(
      (item) => item !== "real-llm",
    );
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /requiredNoGo must exactly match/);
});

test("operator work cannot be marked complete by the agent", async () => {
  const result = await mutate((portfolio) => {
    portfolio.operatorWork[0].status = "completed";
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /operator work must remain pending/);
});

test("terminal transition and self-approval claims fail closed", async () => {
  const result = await mutate((portfolio) => {
    portfolio.terminalTransitionsPerformed.push("ship");
    portfolio.summary.selfApprovedTransitionCount = 1;
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /terminal transitions must remain empty/);
  assert.match(result.errors.join("\n"), /self-approved transition count must be zero/);
});

test("evidence references cannot enter the protected submission path", async () => {
  const result = await mutate((portfolio) => {
    portfolio.bets[0].evidenceRefs.push(
      "docs/submission/2026-mofa-ai/claim-evidence-matrix.md",
    );
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /protected submission path is forbidden/);
});

test("runbook must preserve the six reviewing and five-failure truth", async () => {
  const portfolio = await loadPortfolio();
  const runbook = (await loadRunbook())
    .replace("`reviewing` 6", "`reviewing` 0")
    .replace("정확히 다음 5개 실패", "실패 없음");
  const result = await validatePortfolioCloseout(portfolio, {
    runbookText: runbook,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /runbook exact truth missing/);
});

test("default package gate is present once and remains non-recursive", async () => {
  const portfolio = await loadPortfolio();
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  packageJson.scripts["test:portfolio-closeout"] = "pnpm test";
  const result = await validatePortfolioCloseout(portfolio, {
    runbookText: await loadRunbook(),
    packageJson,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /portfolio test script must be exact and non-recursive/);
});
