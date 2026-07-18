import assert from "node:assert/strict";
import { readFile, symlink, unlink } from "node:fs/promises";
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

const BASELINE_MAIN_REF = "ff7973cb7e54040998ad468bbda8017de74f9df6";
const REPOSITORY_ROOT_COMMIT = "b17d3800363eb38c494ac32e9dced0dcbedd057a";

const mutate = async (callback, options = {}) => {
  const portfolio = await loadPortfolio();
  callback(portfolio);
  return validatePortfolioCloseout(portfolio, {
    runbookText: await loadRunbook(),
    ...options,
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

test("a branch-only commit cannot substitute for a merge on main", async () => {
  const result = await mutate(
    (portfolio) => {
      portfolio.bets[0].mergeCommit =
        "536e1cd2907a67870fd8580ea013f57652c87c75";
      portfolio.bets[0].mergeSubject =
        "docs: reconcile ClaimGate ShapeOps portfolio";
    },
    { mainRef: BASELINE_MAIN_REF },
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /not an ancestor of main reference/);
});

test("main ancestry uses the injected immutable reference", async () => {
  const portfolio = await loadPortfolio();
  const result = await validatePortfolioCloseout(portfolio, {
    runbookText: await loadRunbook(),
    mainRef: REPOSITORY_ROOT_COMMIT,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /not an ancestor of main reference/);
});

test("canonical packet stays green when main advances to the branch HEAD", async () => {
  const portfolio = await loadPortfolio();
  const result = await validatePortfolioCloseout(portfolio, {
    runbookText: await loadRunbook(),
    mainRef: "HEAD",
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
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

test("unknown and conflicting completion fields fail exact schemas", async () => {
  const result = await mutate((portfolio) => {
    portfolio.productionReady = true;
    portfolio.source.implementedFeatures = ["live-openapi", "real-llm"];
    portfolio.summary.selfApproved = true;
    portfolio.bets[0].shipped = true;
    portfolio.bets[0].verifiedSignals.push("production-ready");
    portfolio.bets.find((bet) => bet.publicDeployment).publicDeployment.ratified = true;
    portfolio.bets.find((bet) => bet.video).video.actualVideoUrl =
      "https://example.invalid/fake.mp4";
    portfolio.operatorWork[0].completed = true;
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exact schema|exact packet/);
});

test("evidence references are exact and cannot swap to absolute paths", async () => {
  let result = await mutate((portfolio) => {
    portfolio.bets[0].evidenceRefs[0] = "/etc/passwd";
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /relative repository path|evidence mapping/);

  result = await mutate((portfolio) => {
    const first = portfolio.bets[0];
    const second = portfolio.bets[1];
    [first.evidenceRefs, second.evidenceRefs] = [
      second.evidenceRefs,
      first.evidenceRefs,
    ];
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /evidence mapping/);
});

test("dot-segment protected paths and repository escapes fail closed", async () => {
  let result = await mutate((portfolio) => {
    portfolio.bets[0].evidenceRefs[0] =
      "./docs/submission/2026-mofa-ai/claim-evidence-matrix.md";
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /protected submission path|evidence mapping/);

  result = await mutate((portfolio) => {
    portfolio.bets[0].evidenceRefs[0] = "../warvis-claimgate/package.json";
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /repository escape|evidence mapping/);
});

test("symlink escapes and evidence fragment substitutions fail closed", async () => {
  const link = `artifacts/portfolio/.portfolio-evidence-escape-${process.pid}`;
  await symlink("/etc/passwd", link);
  try {
    let result = await mutate((portfolio) => {
      portfolio.bets[0].evidenceRefs[0] = link;
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /repository escape/);

    result = await mutate((portfolio) => {
      portfolio.bets[0].evidenceRefs[1] =
        "artifacts/submission/2026-mofa-ai/verification-results.json#result-judge-flow";
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /evidence mapping/);
  } finally {
    await unlink(link);
  }
});

test("runbook contradictions fail even when all original truth lines remain", async () => {
  const portfolio = await loadPortfolio();
  const runbook = `${await loadRunbook()}\n\nproduction Caddy 적용 완료. 공개 probe exit 0. 실제 영상 촬영·업로드 완료. 두 번의 리허설 실측 완료. 모든 Bet ship/ratify 완료. live OpenAPI와 real LLM 구현 완료.\n`;
  const result = await validatePortfolioCloseout(portfolio, { runbookText: runbook });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /runbook immutable digest mismatch/);
});

test("Bet-specific exact values reject nextGate and evidence overclaims", async () => {
  const result = await mutate((portfolio) => {
    portfolio.bets[0].nextGate = "already-shipped";
    portfolio.bets[1].outstanding = [];
    portfolio.bets[2].verifiedSignals = ["production-accuracy-verified"];
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exact packet|exact values/);
});
