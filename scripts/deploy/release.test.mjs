import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { DeploymentError, deployRelease, readActiveRelease, validateArtifact } from './release.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'claimgate-release-'));
  const artifact = path.join(root, 'artifact');
  const releaseRoot = path.join(root, 'site');
  await mkdir(path.join(artifact, 'assets'), { recursive: true });
  await Promise.all([
    writeFile(path.join(artifact, 'index.html'), '<!doctype html><div id="root"></div>'),
    writeFile(path.join(artifact, 'assets/app.js'), 'console.log("fixture")'),
  ]);
  return { root, artifact, releaseRoot };
}

async function seedCurrent(releaseRoot, releaseId = 'v1') {
  const release = path.join(releaseRoot, 'releases', releaseId);
  await mkdir(release, { recursive: true });
  await writeFile(path.join(release, 'index.html'), `release=${releaseId}`);
  await symlink(path.join('releases', releaseId), path.join(releaseRoot, 'current'));
  return release;
}

test('validated artifact becomes the active release through one relative symlink switch', async () => {
  const fx = await fixture();
  try {
    const previous = await seedCurrent(fx.releaseRoot);
    const phases = [];
    const result = await deployRelease({
      artifactPath: fx.artifact,
      releaseRoot: fx.releaseRoot,
      releaseId: 'v2',
      smoke: async ({ phase, activeRelease }) => {
        phases.push([phase, activeRelease]);
        return { ok: true };
      },
    });

    const active = await readActiveRelease(fx.releaseRoot);
    assert.equal(active, path.join(fx.releaseRoot, 'releases', 'v2'));
    assert.equal(await readlink(path.join(fx.releaseRoot, 'current')), path.join('releases', 'v2'));
    assert.deepEqual(phases, [
      ['before', previous],
      ['after', path.join(fx.releaseRoot, 'releases', 'v2')],
    ]);
    assert.deepEqual(result, {
      status: 'deployed',
      releaseId: 'v2',
      activeRelease: path.join(fx.releaseRoot, 'releases', 'v2'),
      previousRelease: previous,
      rollbackPerformed: false,
      rollbackVerified: null,
    });
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('post-switch smoke failure atomically restores and verifies the previous release', async () => {
  const fx = await fixture();
  try {
    const previous = await seedCurrent(fx.releaseRoot);
    const phases = [];
    await assert.rejects(
      deployRelease({
        artifactPath: fx.artifact,
        releaseRoot: fx.releaseRoot,
        releaseId: 'v2',
        smoke: async ({ phase, activeRelease }) => {
          phases.push([phase, activeRelease]);
          return { ok: phase !== 'after' };
        },
      }),
      (error) => {
        assert.ok(error instanceof DeploymentError);
        assert.equal(error.code, 'POST_DEPLOY_SMOKE_FAILED');
        assert.equal(error.details.rollbackPerformed, true);
        assert.equal(error.details.rollbackVerified, true);
        return true;
      },
    );

    assert.equal(await readActiveRelease(fx.releaseRoot), previous);
    assert.deepEqual(phases.map(([phase]) => phase), ['before', 'after', 'rollback']);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('failed pre-switch smoke and invalid artifacts never change the active release', async () => {
  const fx = await fixture();
  try {
    const previous = await seedCurrent(fx.releaseRoot);
    await assert.rejects(
      deployRelease({
        artifactPath: fx.artifact,
        releaseRoot: fx.releaseRoot,
        releaseId: 'v2',
        smoke: async () => ({ ok: false }),
      }),
      (error) => error instanceof DeploymentError && error.code === 'PRE_DEPLOY_SMOKE_FAILED',
    );
    assert.equal(await readActiveRelease(fx.releaseRoot), previous);

    await rm(path.join(fx.artifact, 'index.html'));
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v3' }),
      (error) => error instanceof DeploymentError && error.code === 'INVALID_ARTIFACT',
    );
    assert.equal(await readActiveRelease(fx.releaseRoot), previous);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('artifact validation rejects symlinks and credential-shaped filenames', async () => {
  const fx = await fixture();
  try {
    await symlink('/etc/passwd', path.join(fx.artifact, 'assets', 'escape'));
    await assert.rejects(
      validateArtifact(fx.artifact),
      (error) => error instanceof DeploymentError && error.code === 'UNSAFE_ARTIFACT',
    );
    await rm(path.join(fx.artifact, 'assets', 'escape'));
    await writeFile(path.join(fx.artifact, '.env.production'), 'fixture');
    await assert.rejects(
      validateArtifact(fx.artifact),
      (error) => error instanceof DeploymentError && error.code === 'SENSITIVE_ARTIFACT_PATH',
    );
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('release identifiers and an existing non-symlink current path fail closed', async () => {
  const fx = await fixture();
  try {
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: '../escape' }),
      (error) => error instanceof DeploymentError && error.code === 'INVALID_RELEASE_ID',
    );
    await mkdir(fx.releaseRoot, { recursive: true });
    await writeFile(path.join(fx.releaseRoot, 'current'), 'not-a-symlink');
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v2' }),
      (error) => error instanceof DeploymentError && error.code === 'UNSAFE_CURRENT_PATH',
    );
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});
