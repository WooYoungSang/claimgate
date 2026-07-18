import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { hostname, tmpdir } from 'node:os';
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

test('release root and releases directory reject canonical path escape and non-directory mutations', async () => {
  const fx = await fixture();
  const outside = await mkdtemp(path.join(tmpdir(), 'claimgate-release-outside-'));
  try {
    const symlinkRoot = path.join(fx.root, 'symlink-root');
    await symlink(outside, symlinkRoot);
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: symlinkRoot, releaseId: 'v2' }),
      (error) => error instanceof DeploymentError && error.code === 'UNSAFE_RELEASE_ROOT',
    );

    await mkdir(fx.releaseRoot, { recursive: true });
    await symlink(outside, path.join(fx.releaseRoot, 'releases'));
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v2' }),
      (error) => error instanceof DeploymentError && error.code === 'UNSAFE_RELEASES_PATH',
    );
    await rm(path.join(fx.releaseRoot, 'releases'));
    await writeFile(path.join(fx.releaseRoot, 'releases'), 'not-a-directory');
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v2' }),
      (error) => error instanceof DeploymentError && error.code === 'UNSAFE_RELEASES_PATH',
    );
  } finally {
    await Promise.all([rm(fx.root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]);
  }
});

test('copy failure removes staging and permits a clean retry with the same release id', async () => {
  const fx = await fixture();
  try {
    await assert.rejects(
      deployRelease({
        artifactPath: fx.artifact,
        releaseRoot: fx.releaseRoot,
        releaseId: 'v2',
        copyArtifact: async (_source, destination) => {
          await mkdir(destination, { recursive: true });
          await writeFile(path.join(destination, 'partial.txt'), 'partial');
          throw new Error('injected copy failure');
        },
      }),
      (error) => error instanceof DeploymentError && error.code === 'STAGING_COPY_FAILED',
    );
    assert.deepEqual((await readdir(path.join(fx.releaseRoot, 'releases'))).filter((name) => name.includes('staging')), []);

    const result = await deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v2' });
    assert.equal(result.status, 'deployed');
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('release-root lock rejects same-id deployment race and is released after completion', async () => {
  const fx = await fixture();
  let enteredAfter;
  let continueAfter;
  const afterEntered = new Promise((resolve) => { enteredAfter = resolve; });
  const afterGate = new Promise((resolve) => { continueAfter = resolve; });
  try {
    const first = deployRelease({
      artifactPath: fx.artifact,
      releaseRoot: fx.releaseRoot,
      releaseId: 'v2',
      smoke: async ({ phase }) => {
        if (phase === 'after') {
          enteredAfter();
          await afterGate;
        }
        return { ok: true };
      },
    });
    await afterEntered;
    await assert.rejects(
      deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v2' }),
      (error) => error instanceof DeploymentError && error.code === 'DEPLOYMENT_LOCKED',
    );
    continueAfter();
    await first;
    const third = await deployRelease({ artifactPath: fx.artifact, releaseRoot: fx.releaseRoot, releaseId: 'v3' });
    assert.equal(third.releaseId, 'v3');
  } finally {
    continueAfter?.();
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('failed v2 rollback never overwrites a concurrently activated v3 release', async () => {
  const fx = await fixture();
  try {
    await seedCurrent(fx.releaseRoot, 'v1');
    const v3 = path.join(fx.releaseRoot, 'releases', 'v3');
    await mkdir(v3, { recursive: true });
    await writeFile(path.join(v3, 'index.html'), 'release=v3');

    await assert.rejects(
      deployRelease({
        artifactPath: fx.artifact,
        releaseRoot: fx.releaseRoot,
        releaseId: 'v2',
        smoke: async ({ phase }) => {
          if (phase !== 'after') return { ok: true };
          await rm(path.join(fx.releaseRoot, 'current'));
          await symlink(path.join('releases', 'v3'), path.join(fx.releaseRoot, 'current'));
          return { ok: false };
        },
      }),
      (error) => error instanceof DeploymentError && error.code === 'ROLLBACK_CONFLICT',
    );
    assert.equal(await readActiveRelease(fx.releaseRoot), v3);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('success is refused if current no longer points to the deployment own release', async () => {
  const fx = await fixture();
  try {
    await seedCurrent(fx.releaseRoot, 'v1');
    const v3 = path.join(fx.releaseRoot, 'releases', 'v3');
    await mkdir(v3, { recursive: true });
    await writeFile(path.join(v3, 'index.html'), 'release=v3');
    await assert.rejects(
      deployRelease({
        artifactPath: fx.artifact,
        releaseRoot: fx.releaseRoot,
        releaseId: 'v2',
        smoke: async ({ phase }) => {
          if (phase === 'after') {
            await rm(path.join(fx.releaseRoot, 'current'));
            await symlink(path.join('releases', 'v3'), path.join(fx.releaseRoot, 'current'));
          }
          return { ok: true };
        },
      }),
      (error) => error instanceof DeploymentError && error.code === 'CURRENT_CONFLICT',
    );
    assert.equal(await readActiveRelease(fx.releaseRoot), v3);
  } finally {
    await rm(fx.root, { recursive: true, force: true });
  }
});

test('credential guard rejects common credential, service-account, SSH and certificate paths', async () => {
  const names = [
    'credentials.json', 'service-account.json', '.npmrc', '.netrc', 'id_rsa', 'id_dsa', 'id_ed25519', 'id_ecdsa',
    'origin.crt', 'origin.cer', 'origin.der', 'chain.p7b', 'client.p12', 'client.pfx', 'keystore.jks', 'private.key',
  ];
  for (const name of names) {
    const fx = await fixture();
    try {
      await writeFile(path.join(fx.artifact, name), 'fixture');
      await assert.rejects(
        validateArtifact(fx.artifact),
        (error) => error instanceof DeploymentError && error.code === 'SENSITIVE_ARTIFACT_PATH',
        name,
      );
    } finally {
      await rm(fx.root, { recursive: true, force: true });
    }
  }
});

test('active and malformed deployment locks stay blocked with explicit operator recovery detail', async () => {
  for (const metadata of [
    { version: 1, token: 'active-owner', owner: 'active-test-owner', pid: process.pid, hostname: hostname(), createdAt: '2020-01-01T00:00:00.000Z' },
    { malformed: true },
  ]) {
    const fx = await fixture();
    try {
      const lock = path.join(fx.releaseRoot, '.deploy.lock');
      await mkdir(lock, { recursive: true });
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify(metadata));
      await assert.rejects(
        deployRelease({
          artifactPath: fx.artifact,
          releaseRoot: fx.releaseRoot,
          releaseId: 'v2',
          lockOptions: { staleAfterMs: 0 },
        }),
        (error) => {
          assert.ok(error instanceof DeploymentError);
          assert.equal(error.code, 'DEPLOYMENT_LOCKED');
          assert.match(error.details.recovery, /operator/i);
          return true;
        },
      );
      assert.deepEqual(JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8')), metadata);
    } finally {
      await rm(fx.root, { recursive: true, force: true });
    }
  }
});

test('a lock from a crashed local deployment is conservatively recovered after its owner is dead', async () => {
  const fx = await fixture();
  const ready = path.join(fx.root, 'child-ready');
  const moduleUrl = new URL('./release.mjs', import.meta.url).href;
  const childSource = `
    import { writeFile } from 'node:fs/promises';
    import { deployRelease } from ${JSON.stringify(moduleUrl)};
    await deployRelease({
      artifactPath: ${JSON.stringify(fx.artifact)},
      releaseRoot: ${JSON.stringify(fx.releaseRoot)},
      releaseId: 'crashed-v2',
      smoke: async ({ phase }) => {
        if (phase === 'after') {
          await writeFile(${JSON.stringify(ready)}, 'ready');
          setInterval(() => {}, 1000);
          await new Promise(() => {});
        }
        return { ok: true };
      },
    });
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', childSource], { stdio: 'ignore' });
  try {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      try {
        await readFile(ready);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    await readFile(ready);
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGKILL');
    await exited;

    const result = await deployRelease({
      artifactPath: fx.artifact,
      releaseRoot: fx.releaseRoot,
      releaseId: 'recovered-v3',
      lockOptions: { staleAfterMs: 0 },
    });
    assert.equal(result.releaseId, 'recovered-v3');
    assert.equal(await readActiveRelease(fx.releaseRoot), path.join(fx.releaseRoot, 'releases', 'recovered-v3'));
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await rm(fx.root, { recursive: true, force: true });
  }
});
