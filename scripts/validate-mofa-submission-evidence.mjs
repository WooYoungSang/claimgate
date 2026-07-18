#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const DEFAULT_BUNDLE_PATH =
  "artifacts/submission/2026-mofa-ai/claim-evidence-bundle.json";

const REQUIRED_CLAIMS = [
  "claim-offline-boundary",
  "claim-three-pack-judge-flow",
  "claim-browser-geometry",
  "claim-runbook",
  "claim-clean-clone",
  "claim-public-deployment",
  "claim-three-minute-video",
  "claim-future-boundaries",
];

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

const REQUIRED_DEPLOYMENT_FAILURES = [
  "root-cache",
  "spa-cache",
  "html-security-headers",
  "js-asset-cache",
  "css-asset-cache",
];

const REQUIRED_VIDEO_SLOTS = [
  "video:shot-01:pending",
  "video:shot-02:pending",
  "video:shot-03:pending",
  "video:shot-04:pending",
  "video:shot-05:pending",
  "video:shot-06:pending",
  "video:rehearsal-1:pending",
  "video:rehearsal-2:pending",
];

const REQUIRED_COMMANDS = new Map([
  ["cmd-runbook", ["pnpm test:runbook", 0]],
  ["cmd-judge-flow", ["pnpm test:judge-flow", 0]],
  ["cmd-geometry", ["pnpm test:geometry", 0]],
  ["cmd-clean-clone", ["pnpm verify:clean-clone", 0]],
  ["cmd-conformance", ["pnpm test/conformance", 0]],
  ["cmd-demo", ["pnpm demo", 0]],
  ["cmd-public-probe", ["pnpm probe:deployment", 1]],
]);

const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

const sha256 = (content) =>
  createHash("sha256").update(content).digest("hex");

const uniqueIds = (items, label, errors) => {
  const ids = new Set();
  for (const item of items ?? []) {
    if (!item || typeof item.id !== "string" || item.id.length === 0) {
      errors.push(`${label} entry requires id`);
      continue;
    }
    if (ids.has(item.id)) {
      errors.push(`duplicate ${label} id: ${item.id}`);
    }
    ids.add(item.id);
  }
  return ids;
};

const exactSet = (actual, expected) =>
  actual.length === expected.length &&
  [...actual].sort().every((item, index) => item === [...expected].sort()[index]);

const git = (args, cwd) =>
  spawnSync("git", args, {
    cwd,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  });

const commitResolves = (commit, cwd) => {
  if (!COMMIT.test(commit ?? "")) return false;
  return git(["cat-file", "-e", `${commit}^{commit}`], cwd).status === 0;
};

const readAnchoredEvidence = async (evidence, bundle, rootDir, errors) => {
  const target = resolve(rootDir, evidence.path ?? "");
  const rel = relative(rootDir, target);
  if (
    typeof evidence.path !== "string" ||
    evidence.path.length === 0 ||
    isAbsolute(evidence.path) ||
    rel.startsWith("..")
  ) {
    errors.push(`unsafe evidence path: ${evidence.id ?? "<unknown>"}`);
    return null;
  }

  // Files that existed at baselineCommit are read from that immutable Git
  // object, not from the possibly dirty working tree. Newly created bundle
  // evidence (the storyboard) is read from the workspace.
  const baselineObject = git(
    ["show", `${bundle.baselineCommit}:${evidence.path}`],
    rootDir,
  );
  if (baselineObject.status === 0) return baselineObject.stdout;

  try {
    return await readFile(target);
  } catch {
    errors.push(`evidence path missing: ${evidence.id} (${evidence.path})`);
    return null;
  }
};

export const validateEvidenceBundle = async (
  bundle,
  { rootDir = process.cwd() } = {},
) => {
  const errors = [];

  if (bundle?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!COMMIT.test(bundle?.baselineCommit ?? "")) {
    errors.push("baselineCommit must be a full 40-character SHA");
  } else if (!commitResolves(bundle.baselineCommit, rootDir)) {
    errors.push(`commit does not resolve: ${bundle.baselineCommit}`);
  }

  const noGo = Array.isArray(bundle?.requiredNoGo) ? bundle.requiredNoGo : [];
  for (const boundary of REQUIRED_NO_GO) {
    if (!noGo.includes(boundary)) {
      errors.push(`missing required No-Go: ${boundary}`);
    }
  }

  const commands = Array.isArray(bundle?.commands) ? bundle.commands : [];
  const evidence = Array.isArray(bundle?.evidence) ? bundle.evidence : [];
  const claims = Array.isArray(bundle?.claims) ? bundle.claims : [];
  const commandIds = uniqueIds(commands, "command", errors);
  const evidenceIds = uniqueIds(evidence, "evidence", errors);
  const claimIds = uniqueIds(claims, "claim", errors);

  for (const required of REQUIRED_CLAIMS) {
    if (!claimIds.has(required)) errors.push(`missing required claim: ${required}`);
  }

  for (const command of commands) {
    if (typeof command.command !== "string" || command.command.length === 0) {
      errors.push(`command ${command.id} requires an executable command`);
    }
    if (![0, 1].includes(command.expectedExit)) {
      errors.push(`command ${command.id} expectedExit must be 0 or 1`);
    }
    const expected = REQUIRED_COMMANDS.get(command.id);
    if (!expected) {
      errors.push(`unexpected command id: ${command.id}`);
    } else if (
      command.command !== expected[0] ||
      command.expectedExit !== expected[1]
    ) {
      errors.push(`command snapshot mismatch: ${command.id}`);
    }
    if (!commitResolves(command.commitRef, rootDir)) {
      errors.push(`commit does not resolve: ${command.commitRef}`);
    }
  }

  for (const item of evidence) {
    if (!SHA256.test(item.sha256 ?? "")) {
      errors.push(`evidence ${item.id} requires a full sha256`);
      continue;
    }
    const content = await readAnchoredEvidence(item, bundle, rootDir, errors);
    if (content && sha256(content) !== item.sha256) {
      errors.push(`checksum mismatch: ${item.id}`);
    }
  }

  for (const claim of claims) {
    const commandRefs = Array.isArray(claim.commandRefs) ? claim.commandRefs : [];
    const commitRefs = Array.isArray(claim.commitRefs) ? claim.commitRefs : [];
    const evidenceRefs = Array.isArray(claim.evidenceRefs) ? claim.evidenceRefs : [];

    if (claim.status === "verified") {
      if (commandRefs.length === 0) {
        errors.push(`verified claim ${claim.id} requires commandRefs`);
      }
      if (commitRefs.length === 0) {
        errors.push(`verified claim ${claim.id} requires commitRefs`);
      }
      if (evidenceRefs.length === 0) {
        errors.push(`verified claim ${claim.id} requires evidenceRefs`);
      }
    }

    for (const ref of commandRefs) {
      if (!commandIds.has(ref)) {
        errors.push(`unknown command ref ${ref} in ${claim.id}`);
      } else if (
        claim.status === "verified" &&
        commands.find((command) => command.id === ref)?.expectedExit !== 0
      ) {
        errors.push(`verified claim ${claim.id} references failing command ${ref}`);
      }
    }
    for (const ref of evidenceRefs) {
      if (!evidenceIds.has(ref)) errors.push(`unknown evidence ref ${ref} in ${claim.id}`);
    }
    for (const ref of commitRefs) {
      if (!commitResolves(ref, rootDir)) errors.push(`commit does not resolve: ${ref}`);
    }
  }

  const deploymentClaim = claims.find(
    (claim) => claim.id === "claim-public-deployment",
  );
  if (bundle?.deployment?.status !== "pending") {
    errors.push("deployment status must remain pending while recorded failures exist");
  }
  if (deploymentClaim?.status !== "pending") {
    errors.push("claim-public-deployment must remain pending");
  }
  if (bundle?.deployment?.failureCount !== 5) {
    errors.push("deployment failureCount must remain 5 for this observed snapshot");
  }
  if (
    !exactSet(
      bundle?.deployment?.failureIds ?? [],
      REQUIRED_DEPLOYMENT_FAILURES,
    )
  ) {
    errors.push("deployment failureIds do not match the observed five failures");
  }
  if (
    deploymentClaim?.observedFailureCount !== 5 ||
    !exactSet(
      deploymentClaim?.observedFailureIds ?? [],
      REQUIRED_DEPLOYMENT_FAILURES,
    )
  ) {
    errors.push("claim-public-deployment failure snapshot is stale or incomplete");
  }

  const videoClaim = claims.find(
    (claim) => claim.id === "claim-three-minute-video",
  );
  if (videoClaim?.status !== "pending") {
    errors.push("claim-three-minute-video must remain pending");
  }
  if (bundle?.video?.actualRecording !== "pending") {
    errors.push("actual recording must remain pending until operator evidence exists");
  }
  if (bundle?.video?.rehearsalsCompleted !== 0) {
    errors.push("rehearsalsCompleted must remain 0 until measured evidence exists");
  }
  const duration = bundle?.video?.plannedDurationSeconds;
  const min = bundle?.video?.allowedDurationSeconds?.min;
  const max = bundle?.video?.allowedDurationSeconds?.max;
  if (min !== 165 || max !== 195 || duration < min || duration > max) {
    errors.push("planned duration must be within 165-195 seconds");
  }
  if (!exactSet(bundle?.video?.shotIds ?? [], [
    "SHOT-01",
    "SHOT-02",
    "SHOT-03",
    "SHOT-04",
    "SHOT-05",
    "SHOT-06",
  ])) {
    errors.push("video shotIds must exactly match SHOT-01 through SHOT-06");
  }
  if (!exactSet(videoClaim?.evidenceSlots ?? [], REQUIRED_VIDEO_SLOTS)) {
    errors.push("video evidence slots must exactly match six shots and two rehearsals");
  }

  const futureClaim = claims.find(
    (claim) => claim.id === "claim-future-boundaries",
  );
  if (futureClaim?.status !== "future") {
    errors.push("claim-future-boundaries must remain future");
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

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      claimCount: claims.length,
      ...counts,
      evidenceCount: evidence.length,
      commandCount: commands.length,
      plannedDurationSeconds: duration,
      deploymentStatus: bundle?.deployment?.status ?? null,
      deploymentFailureCount: bundle?.deployment?.failureCount ?? null,
      baselineCommit: bundle?.baselineCommit ?? null,
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
      `${JSON.stringify(
        {
          status: result.ok ? "PASS" : "FAIL",
          bundlePath,
          ...result,
        },
        null,
        2,
      )}\n`,
    );
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          status: "FAIL",
          bundlePath,
          errors: [error instanceof Error ? error.message : String(error)],
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 1;
  }
}
