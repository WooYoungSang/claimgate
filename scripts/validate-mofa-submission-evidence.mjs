#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const DEFAULT_BUNDLE_PATH =
  "artifacts/submission/2026-mofa-ai/claim-evidence-bundle.json";

const BASELINE_COMMIT = "890d427e7bdd296113fbbf7b40480b45f1c757ee";
const STORYBOARD_COMMIT = "c830bf3bdfb3c837c88da0cb7a64f01e291ad4ff";
const OBSERVED_COMMIT = "0b8d0eb45c37bfadaf17962eea6419240e6ff26f";
const RESULTS_COMMIT = "2b3208cc18b6c995540e47434db1a3893041a985";
const RESULTS_PATH =
  "artifacts/submission/2026-mofa-ai/verification-results.json";
const RESULTS_SHA =
  "7b2fc61e6ae75dfa86ee34016328e4c92c6a3a449196db308da944913e2f7b5e";

const SCOPE = {
  offline: true,
  deterministic: true,
  fixtureFirst: true,
  externalSubmission: "operator-only-pending",
  video: "storyboard-only-pending",
  deployment: "pending-five-failures",
};

const REQUIRED_NO_GO = [
  "live-openapi",
  "real-llm",
  "ocr",
  "server",
  "database",
  "authentication",
  "production-accuracy",
  "external-submission-without-operator",
];

const DEPLOYMENT_FAILURES = [
  "root-cache",
  "spa-cache",
  "html-security-headers",
  "js-asset-cache",
  "css-asset-cache",
];

const VIDEO_SLOTS = [
  "video:shot-01:pending",
  "video:shot-02:pending",
  "video:shot-03:pending",
  "video:shot-04:pending",
  "video:shot-05:pending",
  "video:shot-06:pending",
  "video:rehearsal-1:pending",
  "video:rehearsal-2:pending",
];

const SHOT_IDS = [
  "SHOT-01",
  "SHOT-02",
  "SHOT-03",
  "SHOT-04",
  "SHOT-05",
  "SHOT-06",
];

const EXACT_VIDEO_STATUS_LINE =
  "> **상태:** 촬영 계획 검증 완료 · 실제 영상 촬영/업로드/외부 제출은 미실시";
const EXACT_PRODUCT_BOUNDARY_LINE =
  "> **제품 경계:** offline / deterministic / fixture-first 시제품이다. live OpenAPI, real LLM, OCR, 서버·DB·auth, production accuracy는 FUTURE / No-Go다. 공개 URL의 현재 배포 점검은 실패 5건으로 **보류(pending)** 상태이며 성공으로 제시하지 않는다.";
const EXACT_DEPLOYMENT_OBSERVATION_LINE =
  "2026-07-18 UTC 기준 `pnpm probe:deployment`은 exit 1, failureCount 5였다.";
const EXACT_DEPLOYMENT_CONCLUSION_LINE =
  "따라서 공개 URL은 페이지 확인 참고값일 뿐 최종 배포 PASS 증거가 아니다. 촬영은 로컬 대체 경로로 재현하며, 공개 환경이 수정되면 같은 명령을 다시 실행해 별도 evidence로 남긴다.";
const EXACT_REHEARSAL_CHECK_LINE =
  "- [ ] 독립 리허설 2회가 각각 165–195초이고 예상 상태가 100% 일치";
const EXACT_OPERATOR_UPLOAD_LINE =
  "- [ ] 외부 업로드/제출은 운영자가 별도 승인하고 수행";
const EXACT_VIDEO_PENDING_LINE =
  "이 체크리스트가 미완료인 동안 `three-minute-video-verified`는 **pending**이다.";

const COMMANDS = {
  "cmd-runbook": ["pnpm test:runbook", 0, "result-runbook"],
  "cmd-judge-flow": ["pnpm test:judge-flow", 0, "result-judge-flow"],
  "cmd-geometry": ["pnpm test:geometry", 0, "result-geometry"],
  "cmd-clean-clone": [
    "pnpm test:clean-clone:self",
    0,
    "result-clean-clone-self",
  ],
  "cmd-conformance": ["pnpm test/conformance", 0, "result-conformance"],
  "cmd-demo": ["pnpm demo", 0, "result-demo"],
  "cmd-public-probe": ["pnpm probe:deployment", 1, "result-public-probe"],
};

const EVIDENCE = {
  "evidence-runbook": {
    path: "docs/demo/mofa-oda-3-minute-runbook.md",
    sha256: "73c83e9eac28099d040ee4436332ded70d6ac257744459ed9e1aebb6287bb9d7",
    commitRef: BASELINE_COMMIT,
  },
  "evidence-storyboard": {
    path: "docs/demo/mofa-oda-submission-video-storyboard.md",
    sha256: "8eb48bc733f776bcfe3933ecc9ee90bd2e8ffca2f2c873ea5e3dd13cb10efb35",
    commitRef: STORYBOARD_COMMIT,
  },
  "evidence-claim-matrix": {
    path: "docs/submission/2026-mofa-ai/claim-evidence-matrix.md",
    sha256: "c7652de9662602597511e73b8a2674246904c1bbc07b636ce2ea3c4b14f165f5",
    commitRef: BASELINE_COMMIT,
  },
  "evidence-browser-audit": {
    path: "scripts/browser-geometry-audit.mjs",
    sha256: "73abe3087c83087283e80bb54eb1320afdb736a73e4b4c99c63862c5b5bfad5b",
    commitRef: BASELINE_COMMIT,
  },
  "evidence-deployment-probe": {
    path: "scripts/deploy/smoke.mjs",
    sha256: "7d626b8ee7c87a5d2b45cf10b4b84412dd5fa16f50ffc94b33acf1a5a1b54fdb",
    commitRef: BASELINE_COMMIT,
  },
  "evidence-clean-clone": {
    path: "scripts/verify-clean-clone.mjs",
    sha256: "87a44398e3c19c4c1e25c974a1be52dda20e666848b4d3b2a336f351af9caaa9",
    commitRef: BASELINE_COMMIT,
  },
  "evidence-verification-results": {
    path: RESULTS_PATH,
    sha256: RESULTS_SHA,
    commitRef: RESULTS_COMMIT,
  },
};

const CLAIMS = {
  "claim-offline-boundary": {
    statement: "현재 시제품은 offline / deterministic / fixture-first이다.",
    status: "verified",
    commandRefs: ["cmd-conformance", "cmd-demo"],
    commitRefs: [BASELINE_COMMIT, OBSERVED_COMMIT],
    evidenceRefs: [
      "evidence-claim-matrix",
      "evidence-runbook",
      "evidence-verification-results",
    ],
  },
  "claim-three-pack-judge-flow": {
    statement:
      "civic, health, mofa-oda 세 팩의 사람 판정 흐름을 결정론적으로 검증한다.",
    status: "verified",
    commandRefs: ["cmd-judge-flow"],
    commitRefs: [BASELINE_COMMIT, OBSERVED_COMMIT],
    evidenceRefs: [
      "evidence-browser-audit",
      "evidence-verification-results",
    ],
  },
  "claim-browser-geometry": {
    statement:
      "브라우저 geometry 계약은 저장소 기준 환경에서 회귀 검증된다.",
    status: "verified",
    commandRefs: ["cmd-geometry"],
    commitRefs: [BASELINE_COMMIT, OBSERVED_COMMIT],
    evidenceRefs: [
      "evidence-browser-audit",
      "evidence-verification-results",
    ],
  },
  "claim-runbook": {
    statement: "MOFA 3분 런북의 화면 문구와 180초 구조를 검증한다.",
    status: "verified",
    commandRefs: ["cmd-runbook"],
    commitRefs: [BASELINE_COMMIT, STORYBOARD_COMMIT, OBSERVED_COMMIT],
    evidenceRefs: [
      "evidence-runbook",
      "evidence-storyboard",
      "evidence-verification-results",
    ],
  },
  "claim-clean-clone": {
    statement: "clean-clone 재현 절차는 검증 명령으로 추적된다.",
    status: "verified",
    commandRefs: ["cmd-clean-clone"],
    commitRefs: [BASELINE_COMMIT, OBSERVED_COMMIT],
    evidenceRefs: [
      "evidence-clean-clone",
      "evidence-verification-results",
    ],
  },
  "claim-public-deployment": {
    statement:
      "공개 배포 hardening은 운영 node에 아직 적용되지 않아 검증 보류다.",
    status: "pending",
    commandRefs: ["cmd-public-probe"],
    commitRefs: [BASELINE_COMMIT, OBSERVED_COMMIT],
    evidenceRefs: [
      "evidence-deployment-probe",
      "evidence-verification-results",
    ],
    observedFailureCount: 5,
    observedFailureIds: DEPLOYMENT_FAILURES,
  },
  "claim-three-minute-video": {
    statement:
      "3분 제출 영상의 촬영·리허설·업로드는 운영자 작업으로 남아 있다.",
    status: "pending",
    commandRefs: [],
    commitRefs: [STORYBOARD_COMMIT],
    evidenceRefs: ["evidence-storyboard"],
    evidenceSlots: VIDEO_SLOTS,
  },
  "claim-future-boundaries": {
    statement:
      "live OpenAPI, real LLM, OCR, 서버·DB·auth, production accuracy는 FUTURE / No-Go다.",
    status: "future",
    commandRefs: [],
    commitRefs: [BASELINE_COMMIT],
    evidenceRefs: ["evidence-claim-matrix", "evidence-runbook"],
  },
};

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const ISO_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?Z$/u;

const digest = (content) =>
  createHash("sha256").update(content).digest("hex");
const same = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);
const exactKeys = (actual, expected) =>
  same(Object.keys(actual ?? {}).sort(), [...expected].sort());

const git = (args, cwd) =>
  spawnSync("git", args, {
    cwd,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  });

const commitResolves = (commit, cwd) =>
  COMMIT.test(commit ?? "") &&
  git(["cat-file", "-e", commit + "^{commit}"], cwd).status === 0;

const commitIsHeadAncestor = (commit, cwd) =>
  commitResolves(commit, cwd) &&
  git(["merge-base", "--is-ancestor", commit, "HEAD"], cwd).status === 0;

const gitShow = (commit, path, cwd) => {
  const result = git(["show", commit + ":" + path], cwd);
  return result.status === 0 ? result.stdout : null;
};

const assertCommit = (commit, label, rootDir, errors) => {
  if (!commitResolves(commit, rootDir)) {
    errors.push("commit does not resolve: " + commit);
  } else if (!commitIsHeadAncestor(commit, rootDir)) {
    errors.push(
      "commit is not an ancestor of HEAD: " + label + " (" + commit + ")",
    );
  }
};

export const parseStoryboardContract = (markdown) => {
  const errors = [];
  const shots = [];
  const rowPattern =
    /^\| (SHOT-\d{2}) \| (\d{2}:\d{2})–(\d{2}:\d{2}) \| (\d+)초 \|[^|]+\|[^|]+\| \x60([^\x60]+)\x60 \|$/u;

  const parseTimestamp = (value) => {
    const match = /^(\d{2}):(\d{2})$/u.exec(value);
    if (!match || Number(match[2]) >= 60) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  for (const line of markdown.split(/\r?\n/u)) {
    const match = line.match(rowPattern);
    if (match) {
      shots.push({
        id: match[1],
        start: match[2],
        end: match[3],
        startSeconds: parseTimestamp(match[2]),
        endSeconds: parseTimestamp(match[3]),
        durationSeconds: Number(match[4]),
        evidenceSlot: match[5],
      });
    }
  }

  const evidenceRows = [];
  const evidenceRowPattern =
    /^\| \x60(video:(?:shot-\d{2}|rehearsal-[12]):pending)\x60 \| [^|]+ \| ([^|]+) \| [^|]+ \|$/u;
  for (const line of markdown.split(/\r?\n/u)) {
    const match = line.match(evidenceRowPattern);
    if (match) {
      evidenceRows.push({ id: match[1], status: match[2].trim() });
    }
  }

  const slotMatches = [
    ...markdown.matchAll(
      /\x60(video:(?:shot-\d{2}|rehearsal-[12]):pending)\x60/gu,
    ),
  ].map((match) => match[1]);
  const slots = [...new Set(slotMatches)];

  if (!same(shots.map((shot) => shot.id), SHOT_IDS)) {
    errors.push("storyboard must contain SHOT-01 through SHOT-06 in order");
  }
  if (shots.reduce((sum, shot) => sum + shot.durationSeconds, 0) !== 180) {
    errors.push("storyboard duration must total 180 seconds");
  }
  if (shots[0]?.start !== "00:00") {
    errors.push("SHOT-01 must start at 00:00");
  }
  for (const [index, shot] of shots.entries()) {
    if (shot.startSeconds === null || shot.endSeconds === null) {
      errors.push(shot.id + " has an invalid HH:MM range");
      continue;
    }
    if (shot.endSeconds - shot.startSeconds !== shot.durationSeconds) {
      errors.push(
        shot.id + " range length must equal declared duration " +
          shot.durationSeconds + " seconds",
      );
    }
    const previous = shots[index - 1];
    if (previous && shot.startSeconds !== previous.endSeconds) {
      errors.push(
        shot.id + " must start at previous end " + previous.end,
      );
    }
  }
  if (shots.at(-1)?.end !== "03:00") {
    errors.push("SHOT-06 must end at 03:00");
  }
  if (!same(
    shots.map((shot) => shot.evidenceSlot),
    VIDEO_SLOTS.slice(0, 6),
  )) {
    errors.push("storyboard shot evidence slots mismatch");
  }
  if (!same(slots.sort(), [...VIDEO_SLOTS].sort())) {
    errors.push("storyboard must contain exactly eight pending evidence slots");
  }
  if (
    !same(evidenceRows.map((row) => row.id), VIDEO_SLOTS) ||
    evidenceRows.some((row) => row.status !== "pending")
  ) {
    errors.push("storyboard evidence rows must remain pending");
  }

  const lines = new Set(markdown.split(/\r?\n/u));
  for (const [line, label] of [
    [EXACT_VIDEO_STATUS_LINE, "exact video status line"],
    [EXACT_PRODUCT_BOUNDARY_LINE, "exact product boundary line"],
    [EXACT_DEPLOYMENT_OBSERVATION_LINE, "exact deployment observation line"],
    [EXACT_DEPLOYMENT_CONCLUSION_LINE, "exact deployment conclusion line"],
    [EXACT_REHEARSAL_CHECK_LINE, "exact rehearsal pending line"],
    [EXACT_OPERATOR_UPLOAD_LINE, "exact operator upload line"],
    [EXACT_VIDEO_PENDING_LINE, "exact video pending line"],
  ]) {
    if (!lines.has(line)) {
      errors.push("storyboard missing " + label);
    }
  }

  for (const phrase of [
    "**총 길이:** 180초(3분)",
    "= **180초**",
    "offline / deterministic / fixture-first",
    "live OpenAPI",
    "real LLM",
    "OCR",
    "서버·DB·auth",
    "production accuracy",
    "**보류(pending)**",
    "failureCount 5",
    "root-cache",
    "spa-cache",
    "html-security-headers",
    "js-asset-cache",
    "css-asset-cache",
    "실제 영상 촬영/업로드/외부 제출은 미실시",
    "three-minute-video-verified",
    "**pending**",
  ]) {
    if (!markdown.includes(phrase)) {
      errors.push("storyboard missing contract phrase: " + phrase);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    shots,
    evidenceSlots: slots.sort(),
    plannedDurationSeconds: shots.reduce(
      (sum, shot) => sum + shot.durationSeconds,
      0,
    ),
  };
};

const validateResults = (bundle, rootDir, errors) => {
  const binding = bundle?.results;
  if (!binding || typeof binding !== "object") {
    errors.push("results artifact binding is required");
    return null;
  }
  const expectedBinding = {
    path: RESULTS_PATH,
    commitRef: RESULTS_COMMIT,
    sha256: RESULTS_SHA,
  };
  if (!same(binding, expectedBinding)) {
    errors.push("verification results binding mismatch");
  }
  assertCommit(binding.commitRef, "verification results", rootDir, errors);
  const content = gitShow(binding.commitRef, binding.path, rootDir);
  if (!content) {
    errors.push("verification results Git object is missing");
    return null;
  }
  if (digest(content) !== binding.sha256) {
    errors.push("verification results checksum mismatch");
  }

  let artifact;
  try {
    artifact = JSON.parse(content.toString("utf8"));
  } catch {
    errors.push("verification results JSON is invalid");
    return null;
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.resultCount !== Object.keys(COMMANDS).length ||
    artifact.sourceCommit !== OBSERVED_COMMIT ||
    !Array.isArray(artifact.records)
  ) {
    errors.push("verification results schema mismatch");
    return artifact;
  }

  const resultIds = new Set();
  const commandIds = new Set();
  for (const record of artifact.records) {
    if (resultIds.has(record.id)) {
      errors.push("duplicate result id: " + record.id);
    }
    if (commandIds.has(record.commandId)) {
      errors.push("duplicate result command: " + record.commandId);
    }
    resultIds.add(record.id);
    commandIds.add(record.commandId);

    const command = COMMANDS[record.commandId];
    if (
      !command ||
      record.command !== command[0] ||
      record.observedExit !== command[1] ||
      record.id !== command[2] ||
      record.commitRef !== OBSERVED_COMMIT
    ) {
      errors.push("verification result mapping mismatch: " + record.commandId);
    }
    if (!ISO_TIME.test(record.observedAt ?? "")) {
      errors.push(
        "verification result observedAt invalid: " + record.commandId,
      );
    }
    if (
      !SHA256.test(record.outputDigest ?? "") ||
      digest(JSON.stringify(record.output)) !== record.outputDigest
    ) {
      errors.push(
        "verification result output digest mismatch: " + record.commandId,
      );
    }
    assertCommit(
      record.commitRef,
      "verification result " + record.commandId,
      rootDir,
      errors,
    );
  }

  if (!same([...commandIds].sort(), Object.keys(COMMANDS).sort())) {
    errors.push("verification results command inventory mismatch");
  }
  return artifact;
};

export const validateEvidenceBundle = async (
  bundle,
  { rootDir = process.cwd() } = {},
) => {
  const errors = [];

  if (bundle?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (bundle?.baselineCommit !== BASELINE_COMMIT) {
    errors.push("baselineCommit mismatch");
  }
  assertCommit(bundle?.baselineCommit, "baseline", rootDir, errors);

  if (!same(bundle?.scope, SCOPE)) {
    errors.push("scope keys must exactly match the allowed scope contract");
  }
  if (!same(bundle?.requiredNoGo, REQUIRED_NO_GO)) {
    for (const boundary of REQUIRED_NO_GO) {
      if (!(bundle?.requiredNoGo ?? []).includes(boundary)) {
        errors.push("missing required No-Go: " + boundary);
      }
    }
    errors.push("No-Go inventory or order mismatch");
  }

  const results = validateResults(bundle, rootDir, errors);
  const records = new Map(
    (results?.records ?? []).map((item) => [item.id, item]),
  );

  const commands = Array.isArray(bundle?.commands) ? bundle.commands : [];
  if (!same(commands.map((command) => command.id), Object.keys(COMMANDS))) {
    errors.push("command inventory must exactly match");
  }
  for (const command of commands) {
    if (!exactKeys(command, [
      "id",
      "command",
      "expectedExit",
      "commitRef",
      "resultRef",
      "observedExit",
      "observedAt",
      "outputDigest",
    ])) {
      errors.push("command schema mismatch: " + command.id);
    }
    const expected = COMMANDS[command.id];
    const record = records.get(command.resultRef);
    if (
      !expected ||
      command.command !== expected[0] ||
      command.expectedExit !== expected[1] ||
      command.resultRef !== expected[2] ||
      command.commitRef !== OBSERVED_COMMIT
    ) {
      errors.push("command snapshot mismatch: " + command.id);
    }
    if (
      !record ||
      command.observedExit !== record.observedExit ||
      command.observedAt !== record.observedAt ||
      command.outputDigest !== record.outputDigest ||
      command.commitRef !== record.commitRef
    ) {
      errors.push("command observed result mismatch: " + command.id);
    }
    assertCommit(command.commitRef, "command " + command.id, rootDir, errors);
  }

  const evidence = Array.isArray(bundle?.evidence) ? bundle.evidence : [];
  if (!same(evidence.map((item) => item.id), Object.keys(EVIDENCE))) {
    errors.push("evidence inventory must exactly match");
  }
  const evidenceIds = new Set();
  let storyboard = null;

  for (const item of evidence) {
    evidenceIds.add(item.id);
    if (!exactKeys(item, ["id", "path", "sha256", "commitRef"])) {
      errors.push(item.id + " requires commitRef and exact evidence schema");
    }
    if (!item.commitRef) errors.push(item.id + " requires commitRef");
    const expected = EVIDENCE[item.id];
    if (!expected || !same(
      {
        path: item.path,
        sha256: item.sha256,
        commitRef: item.commitRef,
      },
      expected,
    )) {
      errors.push("evidence mapping mismatch: " + item.id);
    }

    if (
      typeof item.path !== "string" ||
      isAbsolute(item.path) ||
      relative(rootDir, resolve(rootDir, item.path)).startsWith("..")
    ) {
      errors.push("unsafe evidence path: " + item.id);
      continue;
    }
    assertCommit(item.commitRef, "evidence " + item.id, rootDir, errors);
    const content = gitShow(item.commitRef, item.path, rootDir);
    if (!content) {
      errors.push("git evidence path missing: " + item.id);
      continue;
    }
    if (!SHA256.test(item.sha256 ?? "") || digest(content) !== item.sha256) {
      errors.push("checksum mismatch: " + item.id);
    }
    if (item.id === "evidence-storyboard") {
      storyboard = parseStoryboardContract(content.toString("utf8"));
      errors.push(...storyboard.errors);
    }
  }

  const claims = Array.isArray(bundle?.claims) ? bundle.claims : [];
  if (
    claims.length !== Object.keys(CLAIMS).length ||
    !same(claims.map((claim) => claim.id), Object.keys(CLAIMS))
  ) {
    errors.push("claim inventory must exactly match");
  }
  for (const requiredId of Object.keys(CLAIMS)) {
    if (!claims.some((claim) => claim.id === requiredId)) {
      errors.push("missing required claim: " + requiredId);
    }
  }

  for (const claim of claims) {
    const expected = CLAIMS[claim.id];
    const allowedKeys = [
      "id",
      "statement",
      "status",
      "commandRefs",
      "commitRefs",
      "evidenceRefs",
      ...(claim.id === "claim-public-deployment"
        ? ["observedFailureCount", "observedFailureIds"]
        : []),
      ...(claim.id === "claim-three-minute-video"
        ? ["evidenceSlots"]
        : []),
    ];
    if (!exactKeys(claim, allowedKeys)) {
      errors.push("claim schema mismatch: " + claim.id);
    }
    if (!expected) continue;
    if (claim.statement !== expected.statement) {
      errors.push("statement mismatch: " + claim.id);
    }
    if (claim.status !== expected.status) {
      errors.push("status mismatch: " + claim.id);
    }
    if (claim.status === "verified") {
      if ((claim.commandRefs ?? []).length === 0) {
        errors.push("verified claim " + claim.id + " requires commandRefs");
      }
      if ((claim.commitRefs ?? []).length === 0) {
        errors.push("verified claim " + claim.id + " requires commitRefs");
      }
      if ((claim.evidenceRefs ?? []).length === 0) {
        errors.push("verified claim " + claim.id + " requires evidenceRefs");
      }
    }
    if (
      !same(claim.commandRefs, expected.commandRefs) ||
      !same(claim.commitRefs, expected.commitRefs) ||
      !same(claim.evidenceRefs, expected.evidenceRefs)
    ) {
      errors.push("reference mapping mismatch: " + claim.id);
    }
    if (
      claim.id === "claim-public-deployment" &&
      (claim.observedFailureCount !== 5 ||
        !same(claim.observedFailureIds, DEPLOYMENT_FAILURES))
    ) {
      errors.push("claim-public-deployment failure snapshot mismatch");
    }
    if (
      claim.id === "claim-three-minute-video" &&
      !same(claim.evidenceSlots, VIDEO_SLOTS)
    ) {
      errors.push(
        "video evidence slots must exactly match six shots and two rehearsals",
      );
    }
    for (const commit of claim.commitRefs ?? []) {
      assertCommit(commit, "claim " + claim.id, rootDir, errors);
    }
    for (const ref of claim.evidenceRefs ?? []) {
      if (!evidenceIds.has(ref)) {
        errors.push("unknown evidence ref " + ref + " in " + claim.id);
      }
    }
    for (const ref of claim.commandRefs ?? []) {
      const command = commands.find((item) => item.id === ref);
      if (!command) {
        errors.push("unknown command ref " + ref + " in " + claim.id);
      } else if (
        claim.status === "verified" &&
        command.observedExit !== 0
      ) {
        errors.push(
          "verified claim " + claim.id +
            " references failing command " + ref,
        );
      }
    }
  }

  if (
    bundle?.deployment?.status !== "pending" ||
    bundle?.deployment?.failureCount !== 5 ||
    !same(bundle?.deployment?.failureIds, DEPLOYMENT_FAILURES)
  ) {
    errors.push(
      "deployment status must remain pending with exact five failures",
    );
  }
  if (
    claims.find((claim) => claim.id === "claim-public-deployment")?.status !==
    "pending"
  ) {
    errors.push("claim-public-deployment must remain pending");
  }
  if (
    bundle?.video?.actualRecording !== "pending" ||
    bundle?.video?.rehearsalsCompleted !== 0
  ) {
    errors.push(
      "actual recording must remain pending until operator evidence exists",
    );
  }
  if (
    claims.find((claim) => claim.id === "claim-three-minute-video")?.status !==
    "pending"
  ) {
    errors.push("claim-three-minute-video must remain pending");
  }
  if (
    bundle?.video?.plannedDurationSeconds !== 180 ||
    bundle?.video?.allowedDurationSeconds?.min !== 165 ||
    bundle?.video?.allowedDurationSeconds?.max !== 195 ||
    !same(bundle?.video?.shotIds, SHOT_IDS)
  ) {
    errors.push(
      "planned duration must be within 165-195 seconds and equal 180",
    );
  }
  if (
    storyboard &&
    storyboard.plannedDurationSeconds !==
      bundle.video.plannedDurationSeconds
  ) {
    errors.push("storyboard duration mismatch");
  }

  const counts = claims.reduce(
    (result, claim) => {
      if (claim.status === "verified") result.verifiedCount += 1;
      if (claim.status === "pending") result.pendingCount += 1;
      if (claim.status === "future") result.futureCount += 1;
      return result;
    },
    { verifiedCount: 0, pendingCount: 0, futureCount: 0 },
  );
  if (!same(counts, {
    verifiedCount: 5,
    pendingCount: 2,
    futureCount: 1,
  })) {
    errors.push(
      "claim status counts must exactly equal 5 verified, 2 pending, 1 future",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      claimCount: claims.length,
      ...counts,
      evidenceCount: evidence.length,
      commandCount: commands.length,
      plannedDurationSeconds:
        bundle?.video?.plannedDurationSeconds ?? null,
      deploymentStatus: bundle?.deployment?.status ?? null,
      deploymentFailureCount:
        bundle?.deployment?.failureCount ?? null,
      baselineCommit: bundle?.baselineCommit ?? null,
      resultsCommit: bundle?.results?.commitRef ?? null,
    },
  };
};

export const validateEvidenceBundleFile = async (
  bundlePath = DEFAULT_BUNDLE_PATH,
  options = {},
) => {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  return validateEvidenceBundle(bundle, options);
};

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const bundlePath = process.argv[2] ?? DEFAULT_BUNDLE_PATH;
  try {
    const result = await validateEvidenceBundleFile(bundlePath);
    process.stdout.write(
      JSON.stringify(
        {
          status: result.ok ? "PASS" : "FAIL",
          bundlePath,
          ...result,
        },
        null,
        2,
      ) + "\n",
    );
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      JSON.stringify(
        {
          status: "FAIL",
          bundlePath,
          errors: [
            error instanceof Error ? error.message : String(error),
          ],
        },
        null,
        2,
      ) + "\n",
    );
    process.exitCode = 1;
  }
}
