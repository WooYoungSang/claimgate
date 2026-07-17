import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  REQUIRED_COMMANDS,
  buildReport,
  findNestedNodeModules,
  formatMarkdown,
  parseArgs,
  resolveOutputDirectory,
  runCommandSequence,
} from './verify-clean-clone.mjs';

test('uses the complete offline clean-clone command manifest in acceptance order', () => {
  assert.deepEqual(REQUIRED_COMMANDS, [
    { id: 'install', command: 'pnpm', args: ['install', '--offline', '--frozen-lockfile'] },
    { id: 'build', command: 'pnpm', args: ['build'] },
    { id: 'typecheck', command: 'pnpm', args: ['typecheck'] },
    { id: 'conformance', command: 'pnpm', args: ['test/conformance'] },
    { id: 'demo', command: 'pnpm', args: ['demo'] },
    { id: 'test', command: 'pnpm', args: ['test'] },
  ]);
});

test('passes only when every exit code is zero and the ten-minute target is met', () => {
  const report = buildReport({
    repositoryRef: 'abc123',
    sourceRepository: '/repo',
    nodeVersion: 'v20.0.0',
    pnpmVersion: '9.0.0',
    startedAt: '2026-07-17T00:00:00.000Z',
    finishedAt: '2026-07-17T00:09:00.000Z',
    durationMs: 540_000,
    nodeModulesPresentBeforeInstall: false,
    results: REQUIRED_COMMANDS.map(({ id, command, args }) => ({
      id,
      command: [command, ...args].join(' '),
      exitCode: 0,
      durationMs: 90_000,
      logFile: `${id}.log`,
    })),
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.withinTenMinuteTarget, true);
  assert.equal(report.offlineInstallEnforced, true);
  assert.deepEqual(report.inheritedNodeModules, []);
});

test('fails loud on a non-zero command without masking later results', () => {
  const results = REQUIRED_COMMANDS.map(({ id, command, args }) => ({
    id,
    command: [command, ...args].join(' '),
    exitCode: id === 'demo' ? 7 : 0,
    durationMs: 1,
    logFile: `${id}.log`,
  }));
  const report = buildReport({
    repositoryRef: 'abc123',
    sourceRepository: '/repo',
    nodeVersion: 'v20.0.0',
    pnpmVersion: '9.0.0',
    startedAt: '2026-07-17T00:00:00.000Z',
    finishedAt: '2026-07-17T00:00:01.000Z',
    durationMs: 1_000,
    nodeModulesPresentBeforeInstall: false,
    results,
  });

  assert.equal(report.status, 'FAIL');
  assert.deepEqual(report.failedCommands, ['demo']);
  assert.equal(report.commands.length, REQUIRED_COMMANDS.length);
  assert.match(formatMarkdown(report), /\| demo \| `pnpm demo` \| 7 \|/);
});

test('fails the definition-of-done target when total duration exceeds ten minutes', () => {
  const report = buildReport({
    repositoryRef: 'abc123',
    sourceRepository: '/repo',
    nodeVersion: 'v20.0.0',
    pnpmVersion: '9.0.0',
    startedAt: '2026-07-17T00:00:00.000Z',
    finishedAt: '2026-07-17T00:10:00.001Z',
    durationMs: 600_001,
    nodeModulesPresentBeforeInstall: false,
    results: REQUIRED_COMMANDS.map(({ id, command, args }) => ({
      id,
      command: [command, ...args].join(' '),
      exitCode: 0,
      durationMs: 100_000,
      logFile: `${id}.log`,
    })),
  });

  assert.equal(report.status, 'FAIL');
  assert.equal(report.withinTenMinuteTarget, false);
});

test('parses explicit source ref and evidence directory without hidden defaults', () => {
  assert.deepEqual(parseArgs(['--ref', 'HEAD~1', '--output-dir', 'tmp/evidence', '--keep-clone']), {
    repositoryRef: 'HEAD~1',
    outputDir: 'tmp/evidence',
    keepClone: true,
  });
  assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);
});

test('rejects absolute and traversal output paths outside the repository evidence root', async () => {
  const repository = await mkdtemp(path.join(tmpdir(), 'claimgate-output-contract-'));
  try {
    await assert.rejects(
      resolveOutputDirectory(repository, '/tmp/escaped-clean-clone-evidence'),
      /must be relative/,
    );
    await assert.rejects(
      resolveOutputDirectory(repository, '../../escaped-clean-clone-evidence'),
      /must stay within/,
    );
    const allowed = await resolveOutputDirectory(repository, 'tmp/clean-clone-evidence/review');
    assert.equal(allowed, path.join(repository, 'tmp/clean-clone-evidence/review'));
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test('rejects symlink output traversal even when its lexical path is inside the evidence root', async () => {
  if (process.platform === 'win32') return;
  const repository = await mkdtemp(path.join(tmpdir(), 'claimgate-output-symlink-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'claimgate-output-outside-'));
  try {
    const evidenceRoot = path.join(repository, 'tmp/clean-clone-evidence');
    await mkdir(evidenceRoot, { recursive: true });
    const { symlink } = await import('node:fs/promises');
    await symlink(outside, path.join(evidenceRoot, 'escape'));
    await assert.rejects(
      resolveOutputDirectory(repository, 'tmp/clean-clone-evidence/escape/report'),
      /resolves outside/,
    );
  } finally {
    await Promise.all([
      rm(repository, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});

test('rejects an evidence root symlink that resolves outside the repository', async () => {
  if (process.platform === 'win32') return;
  const repository = await mkdtemp(path.join(tmpdir(), 'claimgate-output-root-symlink-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'claimgate-output-root-outside-'));
  try {
    await mkdir(path.join(repository, 'tmp'), { recursive: true });
    const { symlink } = await import('node:fs/promises');
    await symlink(outside, path.join(repository, 'tmp/clean-clone-evidence'));
    await assert.rejects(
      resolveOutputDirectory(repository, 'tmp/clean-clone-evidence/report'),
      /evidence root resolves outside/,
    );
  } finally {
    await Promise.all([
      rm(repository, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  }
});

test('recursively detects nested inherited node_modules while ignoring Git internals', async () => {
  const clone = await mkdtemp(path.join(tmpdir(), 'claimgate-node-modules-scan-'));
  try {
    await Promise.all([
      mkdir(path.join(clone, 'packages/a/node_modules'), { recursive: true }),
      mkdir(path.join(clone, '.git/objects/node_modules'), { recursive: true }),
    ]);
    assert.deepEqual(await findNestedNodeModules(clone), ['packages/a/node_modules']);
  } finally {
    await rm(clone, { recursive: true, force: true });
  }
});

test('hard-times-out a stubborn process group and escalates from SIGTERM to SIGKILL', async () => {
  if (process.platform === 'win32') return;
  const output = await mkdtemp(path.join(tmpdir(), 'claimgate-stubborn-child-'));
  try {
    const started = Date.now();
    const results = await runCommandSequence({
      commands: [{
        id: 'stubborn',
        command: process.execPath,
        args: ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{}, 1000)"],
      }],
      cwd: output,
      outputDirectory: output,
      environment: process.env,
      deadlineAt: Date.now() + 350,
      terminationGraceMs: 100,
    });

    assert.equal(results[0].exitCode, 124);
    assert.equal(results[0].timedOut, true);
    assert.deepEqual(results[0].terminationSignals, ['SIGTERM', 'SIGKILL']);
    assert.ok(Date.now() - started < 1_500, 'hard deadline must not leave a hanging child');
    assert.throws(() => process.kill(results[0].pid, 0), /ESRCH/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('records injected failure, continues later commands, and keeps per-command remaining budgets', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'claimgate-failure-policy-'));
  const marker = path.join(output, 'continued.txt');
  try {
    const results = await runCommandSequence({
      commands: [
        { id: 'fail', command: process.execPath, args: ['-e', 'process.exit(7)'] },
        { id: 'continue', command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes')`] },
      ],
      cwd: output,
      outputDirectory: output,
      environment: process.env,
      deadlineAt: Date.now() + 2_000,
      terminationGraceMs: 100,
    });

    assert.deepEqual(results.map(({ exitCode }) => exitCode), [7, 0]);
    assert.equal(await import('node:fs').then(({ readFileSync }) => readFileSync(marker, 'utf8')), 'yes');
    assert.ok(results.every((result) => result.remainingBudgetMsAtStart > 0));
    assert.ok(results[1].remainingBudgetMsAtStart <= results[0].remainingBudgetMsAtStart);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
