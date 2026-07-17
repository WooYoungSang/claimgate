#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, opendir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEN_MINUTES_MS = 10 * 60 * 1_000;
const TERMINATION_GRACE_MS = 1_000;
const EVIDENCE_ROOT = 'tmp/clean-clone-evidence';

export const REQUIRED_COMMANDS = Object.freeze([
  Object.freeze({ id: 'install', command: 'pnpm', args: Object.freeze(['install', '--offline', '--frozen-lockfile']) }),
  Object.freeze({ id: 'build', command: 'pnpm', args: Object.freeze(['build']) }),
  Object.freeze({ id: 'typecheck', command: 'pnpm', args: Object.freeze(['typecheck']) }),
  Object.freeze({ id: 'conformance', command: 'pnpm', args: Object.freeze(['test/conformance']) }),
  Object.freeze({ id: 'demo', command: 'pnpm', args: Object.freeze(['demo']) }),
  Object.freeze({ id: 'test', command: 'pnpm', args: Object.freeze(['test']) }),
]);

export function parseArgs(argv) {
  const parsed = {
    repositoryRef: 'HEAD',
    outputDir: EVIDENCE_ROOT,
    keepClone: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--ref') {
      parsed.repositoryRef = requireValue(argv, ++index, '--ref');
    } else if (argument === '--output-dir') {
      parsed.outputDir = requireValue(argv, ++index, '--output-dir');
    } else if (argument === '--keep-clone') {
      parsed.keepClone = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return parsed;
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function isContained(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

async function resolveThroughNearestExisting(candidate) {
  let existing = candidate;
  const suffix = [];
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(await realpath(existing), ...suffix);
}

export async function resolveOutputDirectory(sourceRepository, requestedOutputDir) {
  if (path.isAbsolute(requestedOutputDir)) {
    throw new Error('--output-dir must be relative to the repository');
  }

  const repository = await realpath(sourceRepository);
  const allowedRoot = path.resolve(repository, EVIDENCE_ROOT);
  const lexicalCandidate = path.resolve(repository, requestedOutputDir);
  if (!isContained(allowedRoot, lexicalCandidate)) {
    throw new Error(`--output-dir must stay within ${EVIDENCE_ROOT}`);
  }

  await mkdir(allowedRoot, { recursive: true });
  const realAllowedRoot = await realpath(allowedRoot);
  if (!isContained(repository, realAllowedRoot)) {
    throw new Error('repository evidence root resolves outside the repository');
  }
  const resolvedCandidate = await resolveThroughNearestExisting(lexicalCandidate);
  if (!isContained(realAllowedRoot, resolvedCandidate)) {
    throw new Error('--output-dir resolves outside the repository evidence root');
  }

  await mkdir(resolvedCandidate, { recursive: true });
  const finalDirectory = await realpath(resolvedCandidate);
  if (!isContained(realAllowedRoot, finalDirectory)) {
    throw new Error('--output-dir resolves outside the repository evidence root');
  }
  return finalDirectory;
}

export async function findNestedNodeModules(rootDirectory) {
  const found = [];
  const pending = [rootDirectory];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await opendir(directory);
    for await (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.name === '.git') continue;
      if (entry.name === 'node_modules') {
        found.push(path.relative(rootDirectory, absolute).split(path.sep).join('/'));
      } else {
        pending.push(absolute);
      }
    }
  }
  return found.sort();
}

export function buildReport(input) {
  const failedCommands = input.results.filter((result) => result.exitCode !== 0).map((result) => result.id);
  const withinTenMinuteTarget = input.durationMs <= TEN_MINUTES_MS;
  const inheritedNodeModules = input.inheritedNodeModules ?? (input.nodeModulesPresentBeforeInstall ? ['node_modules'] : []);
  const status = failedCommands.length === 0 && withinTenMinuteTarget && inheritedNodeModules.length === 0 ? 'PASS' : 'FAIL';

  return {
    schemaVersion: 2,
    status,
    repositoryRef: input.repositoryRef,
    sourceRepository: input.sourceRepository,
    environment: {
      node: input.nodeVersion,
      pnpm: input.pnpmVersion,
      platform: `${process.platform}/${process.arch}`,
    },
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    hardDeadlineMs: TEN_MINUTES_MS,
    withinTenMinuteTarget,
    offlineInstallEnforced: true,
    inheritedNodeModules,
    failedCommands,
    commands: input.results,
    boundaries: {
      fixtureFirst: true,
      networkFetchDuringInstall: false,
      liveApi: false,
      realLlm: false,
      ocr: false,
      serverDatabaseAuth: false,
    },
  };
}

export function formatMarkdown(report) {
  const seconds = (report.durationMs / 1_000).toFixed(3);
  const rows = report.commands
    .map((result) => `| ${result.id} | \`${result.command}\` | ${result.exitCode} | ${(result.durationMs / 1_000).toFixed(3)} | ${result.timedOut ? 'HARD TIMEOUT' : 'completed'} | \`${result.logFile}\` |`)
    .join('\n');

  return `# ClaimGate clean-clone reproducibility evidence

- Status: **${report.status}**
- Repository ref: \`${report.repositoryRef}\`
- Node / pnpm: \`${report.environment.node}\` / \`${report.environment.pnpm}\`
- Total: ${seconds}s / 600.000s hard deadline (${report.withinTenMinuteTarget ? 'within target' : 'over target'})
- Inherited nested \`node_modules\`: ${report.inheritedNodeModules.length > 0 ? report.inheritedNodeModules.map((item) => `\`${item}\``).join(', ') : 'none'}
- Install policy: \`pnpm install --offline --frozen-lockfile\` (registry fetch disabled)

| Step | Command | Exit | Seconds | Deadline | Log |
|---|---|---:|---:|---|---|
${rows}

## Scope boundary

This evidence covers an offline, deterministic, fixture-first local Git clone. It does not claim live OpenAPI, real LLM, OCR, server/DB/auth, package publishing, production accuracy, or external release readiness.
`;
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'pipe',
    timeout: options.timeout,
    killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout.trim();
}

function remainingBudget(deadlineAt) {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw new Error('Clean-clone 600-second hard deadline exhausted during setup');
  return remaining;
}

function signalProcessGroup(child, signal) {
  if (!child.pid) return false;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    return false;
  }
}

async function closeLog(log) {
  await new Promise((resolve, reject) => {
    log.once('error', reject);
    log.end(resolve);
  });
}

async function runLogged({ commandSpec, cwd, outputDirectory, environment, hardBudgetMs, terminationGraceMs, abortSignal }) {
  const commandText = [commandSpec.command, ...commandSpec.args].join(' ');
  const logFile = `${commandSpec.id}.log`;
  const logPath = path.join(outputDirectory, logFile);
  const log = createWriteStream(logPath, { flags: 'w' });
  const started = Date.now();
  const terminationSignals = [];
  let timedOut = false;
  let aborted = false;
  let termTimer;
  let hardKillTimer;
  let abortKillTimer;

  process.stdout.write(`\n[clean-clone] ${commandText}\n`);
  log.write(`$ ${commandText}\nhard_budget_ms=${hardBudgetMs}\n`);

  const outcome = await new Promise((resolve) => {
    let settled = false;
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd,
      env: environment,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(termTimer);
      clearTimeout(hardKillTimer);
      clearTimeout(abortKillTimer);
      abortSignal?.removeEventListener('abort', abortHandler);
      resolve({ exitCode, signal, pid: child.pid });
    };
    const terminate = (signal) => {
      if (signalProcessGroup(child, signal)) terminationSignals.push(signal);
    };
    const abortHandler = () => {
      aborted = true;
      terminate('SIGTERM');
      abortKillTimer = setTimeout(() => terminate('SIGKILL'), terminationGraceMs);
    };

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      log.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      log.write(chunk);
    });
    child.on('error', (error) => {
      log.write(`\nspawn error: ${error.message}\n`);
      finish(1, null);
    });
    child.on('close', (code, signal) => finish(code ?? 1, signal));

    if (abortSignal?.aborted) abortHandler();
    else abortSignal?.addEventListener('abort', abortHandler, { once: true });

    const termAfterMs = Math.max(0, hardBudgetMs - terminationGraceMs);
    termTimer = setTimeout(() => {
      timedOut = true;
      terminate('SIGTERM');
    }, termAfterMs);
    hardKillTimer = setTimeout(() => {
      timedOut = true;
      terminate('SIGKILL');
    }, hardBudgetMs);
  });

  const durationMs = Date.now() - started;
  const exitCode = timedOut ? 124 : aborted ? 130 : outcome.exitCode;
  if (outcome.signal) log.write(`\nterminated_by=${outcome.signal}\n`);
  log.write(`\nexit=${exitCode} duration_ms=${durationMs} timed_out=${timedOut} aborted=${aborted}\n`);
  await closeLog(log);

  return {
    id: commandSpec.id,
    command: commandText,
    exitCode,
    durationMs,
    logFile,
    pid: outcome.pid,
    timedOut,
    aborted,
    terminationSignals,
    hardBudgetMs,
  };
}

function exhaustedResult(commandSpec, remainingBudgetMsAtStart, reason) {
  return {
    id: commandSpec.id,
    command: [commandSpec.command, ...commandSpec.args].join(' '),
    exitCode: reason === 'aborted' ? 130 : 124,
    durationMs: 0,
    logFile: `${commandSpec.id}.log`,
    pid: null,
    timedOut: reason === 'deadline',
    aborted: reason === 'aborted',
    terminationSignals: [],
    hardBudgetMs: 0,
    remainingBudgetMsAtStart,
    notStartedReason: reason,
  };
}

export async function runCommandSequence({ commands, cwd, outputDirectory, environment, deadlineAt, terminationGraceMs = TERMINATION_GRACE_MS, abortSignal }) {
  const results = [];
  for (const commandSpec of commands) {
    const remainingBudgetMsAtStart = Math.max(0, deadlineAt - Date.now());
    if (abortSignal?.aborted) {
      results.push(exhaustedResult(commandSpec, remainingBudgetMsAtStart, 'aborted'));
      continue;
    }
    if (remainingBudgetMsAtStart <= 0) {
      results.push(exhaustedResult(commandSpec, remainingBudgetMsAtStart, 'deadline'));
      continue;
    }
    const result = await runLogged({
      commandSpec,
      cwd,
      outputDirectory,
      environment,
      hardBudgetMs: remainingBudgetMsAtStart,
      terminationGraceMs: Math.min(terminationGraceMs, remainingBudgetMsAtStart),
      abortSignal,
    });
    results.push({ ...result, remainingBudgetMsAtStart });
  }
  return results;
}

function installSignalAbortHandlers() {
  const controller = new AbortController();
  let interruptedSignal = null;
  const handlers = new Map();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => {
      interruptedSignal ??= signal;
      controller.abort(signal);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  return {
    signal: controller.signal,
    getInterruptedSignal: () => interruptedSignal,
    remove: () => handlers.forEach((handler, signal) => process.removeListener(signal, handler)),
  };
}

export async function runCleanClone(options) {
  const startedAt = new Date().toISOString();
  const totalStarted = Date.now();
  const deadlineAt = totalStarted + TEN_MINUTES_MS;
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceRepository = runChecked('git', ['rev-parse', '--show-toplevel'], {
    cwd: scriptDirectory,
    timeout: remainingBudget(deadlineAt),
  });
  const repositoryRef = runChecked('git', ['rev-parse', `${options.repositoryRef}^{commit}`], {
    cwd: sourceRepository,
    timeout: remainingBudget(deadlineAt),
  });
  const outputDirectory = await resolveOutputDirectory(sourceRepository, options.outputDir);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'claimgate-clean-clone-'));
  const cloneDirectory = path.join(temporaryRoot, 'checkout');
  const signalHandlers = installSignalAbortHandlers();
  let completedNormally = false;

  try {
    runChecked('git', ['clone', '--local', '--no-hardlinks', '--no-checkout', sourceRepository, cloneDirectory], {
      timeout: remainingBudget(deadlineAt),
    });
    runChecked('git', ['checkout', '--detach', repositoryRef], {
      cwd: cloneDirectory,
      timeout: remainingBudget(deadlineAt),
    });

    const inheritedNodeModules = await findNestedNodeModules(cloneDirectory);
    const pnpmVersion = runChecked('pnpm', ['--version'], {
      cwd: cloneDirectory,
      timeout: remainingBudget(deadlineAt),
    });
    const environment = {
      ...process.env,
      CI: '1',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    };
    const results = await runCommandSequence({
      commands: REQUIRED_COMMANDS,
      cwd: cloneDirectory,
      outputDirectory,
      environment,
      deadlineAt,
      abortSignal: signalHandlers.signal,
    });

    const finishedAt = new Date().toISOString();
    const report = buildReport({
      repositoryRef,
      sourceRepository,
      nodeVersion: process.version,
      pnpmVersion,
      startedAt,
      finishedAt,
      durationMs: Date.now() - totalStarted,
      inheritedNodeModules,
      results,
    });
    const reportStem = `clean-clone-${repositoryRef.slice(0, 12)}`;
    const jsonPath = path.join(outputDirectory, `${reportStem}.json`);
    const markdownPath = path.join(outputDirectory, `${reportStem}.md`);
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
      writeFile(markdownPath, formatMarkdown(report), 'utf8'),
    ]);

    completedNormally = !signalHandlers.getInterruptedSignal();
    process.stdout.write(`\n[clean-clone] ${report.status}: ${markdownPath}\n`);
    return { report, jsonPath, markdownPath, cloneDirectory, interruptedSignal: signalHandlers.getInterruptedSignal() };
  } finally {
    signalHandlers.remove();
    if (options.keepClone && completedNormally) {
      process.stdout.write(`[clean-clone] retained clone: ${cloneDirectory}\n`);
    } else {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

async function waitForFile(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(file) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!existsSync(file)) throw new Error(`Timed out waiting for ${file}`);
}

async function runSignalSelfTestChild(stateFile) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repository = runChecked('git', ['rev-parse', '--show-toplevel'], { cwd: scriptDirectory });
  const outputDirectory = await resolveOutputDirectory(repository, `tmp/clean-clone-evidence/signal-self-test-${process.pid}`);
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'claimgate-signal-cleanup-'));
  const signalHandlers = installSignalAbortHandlers();
  try {
    await writeFile(stateFile, JSON.stringify({ temporaryRoot, outputDirectory }), 'utf8');
    const [signalResult] = await runCommandSequence({
      commands: [{ id: 'signal-stubborn', command: process.execPath, args: ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"] }],
      cwd: temporaryRoot,
      outputDirectory,
      environment: process.env,
      deadlineAt: Date.now() + 60_000,
      terminationGraceMs: 100,
      abortSignal: signalHandlers.signal,
    });
    if (signalResult.pid) {
      try {
        process.kill(signalResult.pid, 0);
        throw new Error(`signal cleanup left child ${signalResult.pid} running`);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  } finally {
    signalHandlers.remove();
    await Promise.all([
      rm(temporaryRoot, { recursive: true, force: true }),
      rm(outputDirectory, { recursive: true, force: true }),
    ]);
  }
  process.exitCode = signalHandlers.getInterruptedSignal() === 'SIGINT' ? 130 : 143;
}

async function runSelfTest() {
  const scriptPath = fileURLToPath(import.meta.url);
  const stateRoot = await mkdtemp(path.join(tmpdir(), 'claimgate-clean-clone-self-test-'));
  const stateFile = path.join(stateRoot, 'signal-state.json');
  let child;
  let state;
  let failureClone;
  let failureOutput;
  try {
    child = spawn(process.execPath, [scriptPath, '--signal-self-test-child', stateFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForFile(stateFile, 3_000);
    state = JSON.parse(await readFile(stateFile, 'utf8'));
    child.kill('SIGTERM');
    const exit = await new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    if (exit.code !== 143) throw new Error(`signal cleanup child exited unexpectedly: ${JSON.stringify(exit)}`);
    if (existsSync(state.temporaryRoot) || existsSync(state.outputDirectory)) {
      throw new Error('signal cleanup left temporary clone/output directories behind');
    }

    const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
    const repository = runChecked('git', ['rev-parse', '--show-toplevel'], { cwd: scriptDirectory });
    failureClone = await mkdtemp(path.join(tmpdir(), 'claimgate-injected-failure-clone-'));
    failureOutput = await resolveOutputDirectory(repository, `tmp/clean-clone-evidence/failure-self-test-${process.pid}`);
    const continuationMarker = path.join(failureClone, 'continued.txt');
    try {
      const failureResults = await runCommandSequence({
        commands: [
          { id: 'injected-failure', command: process.execPath, args: ['-e', 'process.exit(19)'] },
          { id: 'post-failure', command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(continuationMarker)}, 'continued')`] },
        ],
        cwd: failureClone,
        outputDirectory: failureOutput,
        environment: process.env,
        deadlineAt: Date.now() + 2_000,
        terminationGraceMs: 100,
      });
      if (failureResults[0].exitCode !== 19 || failureResults[1].exitCode !== 0 || !existsSync(continuationMarker)) {
        throw new Error(`injected failure continuation mismatch: ${JSON.stringify(failureResults)}`);
      }
    } finally {
      await Promise.all([
        rm(failureClone, { recursive: true, force: true }),
        rm(failureOutput, { recursive: true, force: true }),
      ]);
    }
    if (existsSync(failureClone) || existsSync(failureOutput)) {
      throw new Error('injected failure self-test left temporary clone/output directories behind');
    }

    const output = await mkdtemp(path.join(tmpdir(), 'claimgate-stubborn-self-test-'));
    try {
      const [result] = await runCommandSequence({
        commands: [{ id: 'stubborn', command: process.execPath, args: ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"] }],
        cwd: output,
        outputDirectory: output,
        environment: process.env,
        deadlineAt: Date.now() + 350,
        terminationGraceMs: 100,
      });
      if (result.exitCode !== 124 || !result.terminationSignals.includes('SIGKILL')) {
        throw new Error(`stubborn child did not hard-timeout: ${JSON.stringify(result)}`);
      }
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  } finally {
    if (child && child.exitCode === null) child.kill('SIGKILL');
    await rm(stateRoot, { recursive: true, force: true });
    if (state) {
      await Promise.all([
        rm(state.temporaryRoot, { recursive: true, force: true }),
        rm(state.outputDirectory, { recursive: true, force: true }),
      ]);
    }
    if (failureClone || failureOutput) {
      await Promise.all([
        failureClone ? rm(failureClone, { recursive: true, force: true }) : Promise.resolve(),
        failureOutput ? rm(failureOutput, { recursive: true, force: true }) : Promise.resolve(),
      ]);
    }
  }
  process.stdout.write('clean-clone self-test: deadline, process-group escalation, signal cleanup, injected-failure cleanup PASS\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-test') {
    await runSelfTest();
    return;
  }
  if (argv[0] === '--signal-self-test-child') {
    await runSignalSelfTestChild(requireValue(argv, 1, '--signal-self-test-child'));
    return;
  }

  const options = parseArgs(argv);
  const result = await runCleanClone(options);
  if (result.interruptedSignal === 'SIGINT') process.exitCode = 130;
  else if (result.interruptedSignal === 'SIGTERM') process.exitCode = 143;
  else process.exitCode = result.report.status === 'PASS' ? 0 : 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`[clean-clone] ERROR: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
