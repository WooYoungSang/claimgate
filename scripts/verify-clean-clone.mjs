#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEN_MINUTES_MS = 10 * 60 * 1_000;

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
    outputDir: 'tmp/clean-clone-evidence',
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

export function buildReport(input) {
  const failedCommands = input.results.filter((result) => result.exitCode !== 0).map((result) => result.id);
  const withinTenMinuteTarget = input.durationMs <= TEN_MINUTES_MS;
  const inheritedNodeModules = input.nodeModulesPresentBeforeInstall;
  const status = failedCommands.length === 0 && withinTenMinuteTarget && !inheritedNodeModules ? 'PASS' : 'FAIL';

  return {
    schemaVersion: 1,
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
    tenMinuteTargetMs: TEN_MINUTES_MS,
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
    .map((result) => `| ${result.id} | \`${result.command}\` | ${result.exitCode} | ${(result.durationMs / 1_000).toFixed(3)} | \`${result.logFile}\` |`)
    .join('\n');

  return `# ClaimGate clean-clone reproducibility evidence

- Status: **${report.status}**
- Repository ref: \`${report.repositoryRef}\`
- Node / pnpm: \`${report.environment.node}\` / \`${report.environment.pnpm}\`
- Total: ${seconds}s / 600.000s target (${report.withinTenMinuteTarget ? 'within target' : 'over target'})
- Inherited \`node_modules\`: ${report.inheritedNodeModules ? 'YES (FAIL)' : 'no'}
- Install policy: \`pnpm install --offline --frozen-lockfile\` (registry fetch disabled)

| Step | Command | Exit | Seconds | Log |
|---|---|---:|---:|---|
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
  });
  if (result.error || result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout.trim();
}

async function runLogged(commandSpec, cwd, outputDirectory, environment) {
  const commandText = [commandSpec.command, ...commandSpec.args].join(' ');
  const logFile = `${commandSpec.id}.log`;
  const logPath = path.join(outputDirectory, logFile);
  const log = createWriteStream(logPath, { flags: 'w' });
  const started = Date.now();

  process.stdout.write(`\n[clean-clone] ${commandText}\n`);
  log.write(`$ ${commandText}\n`);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
      resolve(1);
    });
    child.on('close', (code, signal) => {
      if (signal) log.write(`\nterminated by signal: ${signal}\n`);
      resolve(code ?? 1);
    });
  });

  const durationMs = Date.now() - started;
  log.write(`\nexit=${exitCode} duration_ms=${durationMs}\n`);
  await new Promise((resolve, reject) => {
    log.end(resolve);
    log.on('error', reject);
  });

  return { id: commandSpec.id, command: commandText, exitCode, durationMs, logFile };
}

export async function runCleanClone(options) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceRepository = runChecked('git', ['rev-parse', '--show-toplevel'], { cwd: scriptDirectory });
  const repositoryRef = runChecked('git', ['rev-parse', `${options.repositoryRef}^{commit}`], { cwd: sourceRepository });
  const outputDirectory = path.resolve(sourceRepository, options.outputDir);
  await mkdir(outputDirectory, { recursive: true });

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'claimgate-clean-clone-'));
  const cloneDirectory = path.join(temporaryRoot, 'checkout');
  const startedAt = new Date().toISOString();
  const totalStarted = Date.now();

  try {
    runChecked('git', ['clone', '--local', '--no-hardlinks', '--no-checkout', sourceRepository, cloneDirectory]);
    runChecked('git', ['checkout', '--detach', repositoryRef], { cwd: cloneDirectory });

    const nodeModulesPresentBeforeInstall = existsSync(path.join(cloneDirectory, 'node_modules'));
    const pnpmVersion = runChecked('pnpm', ['--version'], { cwd: cloneDirectory });
    const environment = {
      ...process.env,
      CI: '1',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    };
    const results = [];
    for (const command of REQUIRED_COMMANDS) {
      results.push(await runLogged(command, cloneDirectory, outputDirectory, environment));
    }

    const finishedAt = new Date().toISOString();
    const report = buildReport({
      repositoryRef,
      sourceRepository,
      nodeVersion: process.version,
      pnpmVersion,
      startedAt,
      finishedAt,
      durationMs: Date.now() - totalStarted,
      nodeModulesPresentBeforeInstall,
      results,
    });
    const reportStem = `clean-clone-${repositoryRef.slice(0, 12)}`;
    const jsonPath = path.join(outputDirectory, `${reportStem}.json`);
    const markdownPath = path.join(outputDirectory, `${reportStem}.md`);
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
      writeFile(markdownPath, formatMarkdown(report), 'utf8'),
    ]);

    process.stdout.write(`\n[clean-clone] ${report.status}: ${markdownPath}\n`);
    return { report, jsonPath, markdownPath, cloneDirectory };
  } finally {
    if (options.keepClone) {
      process.stdout.write(`[clean-clone] retained clone: ${cloneDirectory}\n`);
    } else {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runCleanClone(options);
  process.exitCode = result.report.status === 'PASS' ? 0 : 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`[clean-clone] ERROR: ${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
