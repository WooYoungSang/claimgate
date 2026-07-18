import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_BUNDLE_PATH,
  parseStoryboardContract,
  validateEvidenceBundle,
  validateEvidenceBundleFile,
} from "./validate-mofa-submission-evidence.mjs";

const loadBundle = async () =>
  JSON.parse(await readFile(DEFAULT_BUNDLE_PATH, "utf8"));

const clone = (value) => structuredClone(value);

const digest = (value) =>
  createHash("sha256").update(value).digest("hex");

const loadImmutableStoryboard = () =>
  execFileSync("git", [
    "show",
    "c830bf3bdfb3c837c88da0cb7a64f01e291ad4ff:docs/demo/mofa-oda-submission-video-storyboard.md",
  ], { encoding: "utf8" });

test("canonical MOFA submission evidence bundle passes", async () => {
  const result = await validateEvidenceBundleFile(DEFAULT_BUNDLE_PATH);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.summary.claimCount, 8);
  assert.equal(result.summary.verifiedCount, 5);
  assert.equal(result.summary.pendingCount, 2);
  assert.equal(result.summary.futureCount, 1);
  assert.equal(result.summary.plannedDurationSeconds, 180);
  assert.equal(result.summary.deploymentFailureCount, 5);
});

test("missing required claim fails closed", async () => {
  const bundle = await loadBundle();
  bundle.claims = bundle.claims.filter((claim) => claim.id !== "claim-runbook");
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing required claim: claim-runbook/);
});

test("verified claim without immutable refs fails closed", async () => {
  const bundle = await loadBundle();
  const claim = bundle.claims.find((item) => item.id === "claim-runbook");
  claim.commandRefs = [];
  claim.commitRefs = [];
  claim.evidenceRefs = [];
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /verified claim claim-runbook requires commandRefs/);
  assert.match(result.errors.join("\n"), /verified claim claim-runbook requires commitRefs/);
  assert.match(result.errors.join("\n"), /verified claim claim-runbook requires evidenceRefs/);
});

test("stale evidence checksum mutation fails", async () => {
  const bundle = await loadBundle();
  bundle.evidence[0].sha256 = "0".repeat(64);
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /checksum mismatch: evidence-runbook/);
});

test("unresolvable commit mutation fails", async () => {
  const bundle = await loadBundle();
  const invalid = "f".repeat(40);
  bundle.baselineCommit = invalid;
  bundle.commands[0].commitRef = invalid;
  bundle.claims[0].commitRefs = [invalid];
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /commit does not resolve/);
});

test("public deployment cannot be overclaimed while five failures remain", async () => {
  const bundle = await loadBundle();
  bundle.deployment.status = "pass";
  bundle.claims.find((claim) => claim.id === "claim-public-deployment").status =
    "verified";
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /deployment status must remain pending/);
  assert.match(result.errors.join("\n"), /claim-public-deployment must remain pending/);
});

test("actual video cannot be overclaimed before evidence slots and rehearsals", async () => {
  const bundle = await loadBundle();
  bundle.video.actualRecording = "complete";
  bundle.video.rehearsalsCompleted = 2;
  bundle.claims.find((claim) => claim.id === "claim-three-minute-video").status =
    "verified";
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /actual recording must remain pending/);
  assert.match(result.errors.join("\n"), /claim-three-minute-video must remain pending/);
});

test("video timing outside 165-195 seconds fails", async () => {
  const bundle = await loadBundle();
  bundle.video.plannedDurationSeconds = 200;
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /planned duration must be within 165-195 seconds/);
});

test("missing shot or rehearsal evidence slot fails", async () => {
  const bundle = await loadBundle();
  const videoClaim = bundle.claims.find(
    (claim) => claim.id === "claim-three-minute-video",
  );
  videoClaim.evidenceSlots.pop();
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /video evidence slots must exactly match/);
});

test("missing No-Go boundary fails", async () => {
  const bundle = await loadBundle();
  bundle.requiredNoGo = bundle.requiredNoGo.filter((item) => item !== "real-llm");
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing required No-Go: real-llm/);
});

test("claim references must resolve to declared command and evidence IDs", async () => {
  const bundle = await loadBundle();
  const claim = bundle.claims.find((item) => item.id === "claim-runbook");
  claim.commandRefs.push("cmd-does-not-exist");
  claim.evidenceRefs.push("evidence-does-not-exist");
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown command ref cmd-does-not-exist/);
  assert.match(result.errors.join("\n"), /unknown evidence ref evidence-does-not-exist/);
});

test("command snapshot mutation fails", async () => {
  const bundle = await loadBundle();
  bundle.commands.find((command) => command.id === "cmd-runbook").command =
    "pnpm test";
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /command snapshot mismatch: cmd-runbook/);
});

test("verified claim cannot cite the failing public probe", async () => {
  const bundle = await loadBundle();
  bundle.claims
    .find((claim) => claim.id === "claim-runbook")
    .commandRefs.push("cmd-public-probe");
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /verified claim claim-runbook references failing command cmd-public-probe/,
  );
});

test("extra claim and unexpected scope fields fail closed", async () => {
  const bundle = await loadBundle();
  bundle.claims.push({
    ...clone(bundle.claims[0]),
    id: "claim-unreviewed-extra",
  });
  bundle.scope.unexpectedReadiness = "production-ready";
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /claim inventory must exactly match/);
  assert.match(result.errors.join("\n"), /scope keys must exactly match/);
});

test("exact claim meaning rejects production, live API and real LLM overclaims", async () => {
  const bundle = await loadBundle();
  const claim = bundle.claims.find((item) => item.id === "claim-offline-boundary");
  claim.statement = "Production accuracy verified with a real LLM and live OpenAPI.";
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /statement mismatch: claim-offline-boundary/);
});

test("claim command and evidence refs cannot be swapped", async () => {
  const bundle = await loadBundle();
  const runbook = bundle.claims.find((item) => item.id === "claim-runbook");
  const geometry = bundle.claims.find((item) => item.id === "claim-browser-geometry");
  [runbook.commandRefs, geometry.commandRefs] = [
    geometry.commandRefs,
    runbook.commandRefs,
  ];
  [runbook.evidenceRefs, geometry.evidenceRefs] = [
    geometry.evidenceRefs,
    runbook.evidenceRefs,
  ];
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /reference mapping mismatch/);
});

test("every evidence entry requires an explicit immutable commitRef", async () => {
  const bundle = await loadBundle();
  delete bundle.evidence[0].commitRef;
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /evidence-runbook requires commitRef/);
});

test("workspace-only evidence fallback is forbidden", async () => {
  const bundle = await loadBundle();
  const workspaceOnlyPath =
    "artifacts/submission/2026-mofa-ai/claim-evidence-bundle.json";
  const content = await readFile(workspaceOnlyPath);
  bundle.evidence[0].path = workspaceOnlyPath;
  bundle.evidence[0].sha256 = digest(content);
  bundle.evidence[0].commitRef = bundle.baselineCommit;
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /git evidence path missing/);
});

test("storyboard JSON timing must match the immutable Markdown contract", async () => {
  const bundle = await loadBundle();
  bundle.video.plannedDurationSeconds = 170;
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /storyboard duration mismatch/);
});

test("observed command result artifact and digest are mandatory", async () => {
  const bundle = await loadBundle();
  delete bundle.results;
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /results artifact binding is required/);
});

test("observed output digest mutation fails", async () => {
  const bundle = await loadBundle();
  bundle.results = {
    path: "artifacts/submission/2026-mofa-ai/verification-results.json",
    commitRef: bundle.baselineCommit,
  };
  const result = await validateEvidenceBundle(bundle);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /verification results/);
});

test("immutable storyboard timing mutation fails", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| SHOT-01 | 00:00–00:20 | 20초 |",
    "| SHOT-01 | 00:00–00:20 | 10초 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duration must total 180 seconds/);
});

test("immutable storyboard must start SHOT-01 at 00:00", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| SHOT-01 | 00:00–00:20 | 20초 |",
    "| SHOT-01 | 00:01–00:20 | 20초 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SHOT-01 must start at 00:00/);
});

test("immutable storyboard overlap fails continuity", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| SHOT-02 | 00:20–00:50 | 30초 |",
    "| SHOT-02 | 00:19–00:50 | 30초 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /SHOT-02 must start at previous end 00:20/,
  );
});

test("immutable storyboard gap fails continuity", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| SHOT-02 | 00:20–00:50 | 30초 |",
    "| SHOT-02 | 00:21–00:50 | 30초 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /SHOT-02 must start at previous end 00:20/,
  );
});

test("immutable storyboard range length must equal declared duration", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| SHOT-03 | 00:50–01:25 | 35초 |",
    "| SHOT-03 | 00:50–01:24 | 35초 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /SHOT-03 range length must equal declared duration 35 seconds/,
  );
});

test("immutable storyboard must end final shot at 03:00", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| SHOT-06 | 02:40–03:00 | 20초 |",
    "| SHOT-06 | 02:40–03:01 | 20초 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SHOT-06 must end at 03:00/);
});

test("immutable storyboard evidence-slot mutation fails", () => {
  const markdown = loadImmutableStoryboard().replaceAll(
    "video:shot-06:pending",
    "video:shot-06:complete",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /eight pending evidence slots/);
});

test("immutable storyboard No-Go mutation fails", () => {
  const markdown = loadImmutableStoryboard().replaceAll("real LLM", "real model");
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing contract phrase: real LLM/);
});

test("immutable storyboard deployment/video pending mutation fails", () => {
  const markdown = loadImmutableStoryboard()
    .replace("**보류(pending)**", "**검증 완료**")
    .replace("실제 영상 촬영/업로드/외부 제출은 미실시", "실제 영상 촬영/업로드/외부 제출 완료");
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /보류\(pending\)/);
  assert.match(result.errors.join("\n"), /미실시/);
});

test("immutable storyboard No-Go cannot be negated as implemented", () => {
  const markdown = loadImmutableStoryboard().replace(
    "production accuracy는 FUTURE / No-Go다.",
    "production accuracy는 FUTURE / No-Go가 아니라 구현 완료다.",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exact product boundary line/);
});

test("immutable storyboard deployment pending cannot be negated as complete", () => {
  const markdown = loadImmutableStoryboard().replace(
    "실패 5건으로 **보류(pending)** 상태이며 성공으로 제시하지 않는다.",
    "실패 5건은 무효이며 **보류(pending)** 상태가 아니라 완료다.",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exact product boundary line/);
});

test("immutable storyboard recording and upload pending cannot be negated", () => {
  const markdown = loadImmutableStoryboard().replace(
    "실제 영상 촬영/업로드/외부 제출은 미실시",
    "실제 영상 촬영/업로드/외부 제출은 미실시가 아니라 완료",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exact video status line/);
});

test("immutable storyboard rehearsal rows must remain pending", () => {
  const markdown = loadImmutableStoryboard().replace(
    "| `video:rehearsal-1:pending` | 리허설 실측 시간과 결과 | pending |",
    "| `video:rehearsal-1:pending` | 리허설 실측 시간과 결과 | 완료 |",
  );
  const result = parseStoryboardContract(markdown);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /evidence rows must remain pending/);
});
