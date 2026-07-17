import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_COMMANDS,
  buildReport,
  formatMarkdown,
  parseArgs,
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
  assert.equal(report.inheritedNodeModules, false);
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
