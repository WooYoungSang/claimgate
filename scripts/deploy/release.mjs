#!/usr/bin/env node

import { cp, lstat, mkdir, opendir, readlink, realpath, rename, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELEASE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,63})$/;
const SENSITIVE_COMPONENT = /^(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\..*)?|service[-_.]?account(?:\..*)?|id_(?:rsa|dsa|ed25519)(?:\..*)?|secrets?|.*(?:[._-](?:secret|token))(?:[._-].*)?|.*\.(?:crt|pem|key|p12|pfx|kdbx|age|gpg))$/i;

export class DeploymentError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DeploymentError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function isContained(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

async function pathState(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function initializeReleaseRoot(releaseRoot) {
  const requestedRoot = path.resolve(releaseRoot);
  const rootState = await pathState(requestedRoot);
  if (rootState && (rootState.isSymbolicLink() || !rootState.isDirectory())) {
    throw new DeploymentError('UNSAFE_RELEASE_ROOT', 'Release root must be a real directory');
  }
  if (!rootState) await mkdir(requestedRoot, { recursive: true });

  const root = await realpath(requestedRoot);
  const releasesPath = path.join(root, 'releases');
  const releasesState = await pathState(releasesPath);
  if (releasesState && (releasesState.isSymbolicLink() || !releasesState.isDirectory())) {
    throw new DeploymentError('UNSAFE_RELEASES_PATH', 'Releases path must be a real directory');
  }
  if (!releasesState) await mkdir(releasesPath);

  const releases = await realpath(releasesPath);
  if (!isContained(root, releases)) {
    throw new DeploymentError('UNSAFE_RELEASES_PATH', 'Releases path escapes the release root');
  }
  return { root, releases };
}

async function acquireDeploymentLock(root) {
  const lock = path.join(root, '.deploy.lock');
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new DeploymentError('DEPLOYMENT_LOCKED', 'Another deployment is already active');
    }
    throw error;
  }
  return async () => rm(lock, { recursive: true, force: true });
}

async function inspectArtifact(directory, root = directory) {
  const entries = await opendir(directory);
  for await (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (SENSITIVE_COMPONENT.test(entry.name)) {
      throw new DeploymentError('SENSITIVE_ARTIFACT_PATH', 'Artifact contains a credential-shaped path', { path: relative });
    }
    const state = await lstat(absolute);
    if (state.isSymbolicLink()) {
      throw new DeploymentError('UNSAFE_ARTIFACT', 'Artifact symlinks are not deployable', { path: relative });
    }
    if (state.isDirectory()) await inspectArtifact(absolute, root);
    else if (!state.isFile()) {
      throw new DeploymentError('UNSAFE_ARTIFACT', 'Artifact contains a non-regular entry', { path: relative });
    }
  }
}

export async function validateArtifact(artifactPath) {
  const requested = path.resolve(artifactPath);
  const state = await pathState(requested);
  if (!state?.isDirectory() || state.isSymbolicLink()) {
    throw new DeploymentError('INVALID_ARTIFACT', 'Artifact must be an existing directory');
  }
  const artifact = await realpath(requested);
  const indexState = await pathState(path.join(artifact, 'index.html'));
  if (!indexState?.isFile() || indexState.isSymbolicLink()) {
    throw new DeploymentError('INVALID_ARTIFACT', 'Artifact must contain a regular index.html');
  }
  await inspectArtifact(artifact);
  return artifact;
}

export async function readActiveRelease(releaseRoot) {
  const root = path.resolve(releaseRoot);
  const current = path.join(root, 'current');
  const state = await pathState(current);
  if (!state) return null;
  if (!state.isSymbolicLink()) {
    throw new DeploymentError('UNSAFE_CURRENT_PATH', 'Active release path must be a symbolic link');
  }
  const target = await readlink(current);
  const resolved = path.resolve(root, target);
  const releases = path.join(root, 'releases');
  if (!isContained(releases, resolved)) {
    throw new DeploymentError('UNSAFE_CURRENT_PATH', 'Active release points outside the release directory');
  }
  try {
    const canonical = await realpath(resolved);
    const canonicalReleases = await realpath(releases);
    if (!isContained(canonicalReleases, canonical)) throw new Error('outside');
    return canonical;
  } catch {
    throw new DeploymentError('UNSAFE_CURRENT_PATH', 'Active release target is missing or escapes the release directory');
  }
}

async function atomicSwitch(releaseRoot, releasePath) {
  const root = path.resolve(releaseRoot);
  const current = path.join(root, 'current');
  await readActiveRelease(root);
  if (releasePath === null) {
    await rm(current, { force: true });
    return;
  }
  const absoluteRelease = path.resolve(releasePath);
  const releases = path.join(root, 'releases');
  if (!isContained(releases, absoluteRelease)) {
    throw new DeploymentError('UNSAFE_RELEASE_PATH', 'Release target must stay inside the release directory');
  }
  const target = path.relative(root, absoluteRelease);
  const temporary = path.join(root, `.current-${process.pid}-${Date.now()}`);
  await symlink(target, temporary);
  try {
    await rename(temporary, current);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function smokePassed(smoke, input) {
  try {
    const result = await smoke(input);
    return result?.ok === true;
  } catch {
    return false;
  }
}

async function assertActiveRelease(root, expectedRelease, code) {
  const activeRelease = await readActiveRelease(root);
  if (activeRelease !== expectedRelease) {
    throw new DeploymentError(code, 'Active release changed during deployment', {
      expectedRelease,
      activeRelease,
    });
  }
}

async function stageRelease({ artifact, releases, releaseId, copyArtifact }) {
  const nextRelease = path.join(releases, releaseId);
  if (!isContained(releases, nextRelease)) {
    throw new DeploymentError('UNSAFE_RELEASE_PATH', 'Release target escapes the canonical releases directory');
  }
  if (await pathState(nextRelease)) {
    throw new DeploymentError('RELEASE_EXISTS', 'Release ID already exists and will not be overwritten', { releaseId });
  }

  const staging = path.join(releases, `.staging-${releaseId}-${process.pid}-${Date.now()}`);
  try {
    try {
      await copyArtifact(artifact, staging, {
        recursive: true,
        errorOnExist: true,
        force: false,
        preserveTimestamps: true,
      });
    } catch (error) {
      throw new DeploymentError('STAGING_COPY_FAILED', 'Artifact copy into staging failed', {
        releaseId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const canonicalStaging = await validateArtifact(staging);
    if (!isContained(releases, canonicalStaging)) {
      throw new DeploymentError('UNSAFE_RELEASE_PATH', 'Staged artifact escapes the canonical releases directory');
    }
    try {
      await rename(staging, nextRelease);
    } catch (error) {
      if (error.code === 'EEXIST' || error.code === 'ENOTEMPTY') {
        throw new DeploymentError('RELEASE_EXISTS', 'Release ID appeared during staging and was not overwritten', { releaseId });
      }
      throw error;
    }
    return nextRelease;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function deployRelease({ artifactPath, releaseRoot, releaseId, smoke, copyArtifact = cp }) {
  if (!RELEASE_ID.test(releaseId) || releaseId === '.' || releaseId === '..') {
    throw new DeploymentError('INVALID_RELEASE_ID', 'Release ID must be a bounded path-safe identifier');
  }

  const artifact = await validateArtifact(artifactPath);
  const { root, releases } = await initializeReleaseRoot(releaseRoot);
  const releaseLock = await acquireDeploymentLock(root);
  try {
    const previousRelease = await readActiveRelease(root);
    const nextRelease = await stageRelease({ artifact, releases, releaseId, copyArtifact });

    if (smoke && !await smokePassed(smoke, { phase: 'before', activeRelease: previousRelease, previousRelease })) {
      await rm(nextRelease, { recursive: true, force: true });
      throw new DeploymentError('PRE_DEPLOY_SMOKE_FAILED', 'Pre-deployment smoke failed; active release was not changed', {
        releaseId,
        activeRelease: previousRelease,
      });
    }

    await atomicSwitch(root, nextRelease);
    if (smoke && !await smokePassed(smoke, { phase: 'after', activeRelease: nextRelease, previousRelease })) {
      await assertActiveRelease(root, nextRelease, 'ROLLBACK_CONFLICT');
      await atomicSwitch(root, previousRelease);
      const rollbackVerified = previousRelease === null
        ? await readActiveRelease(root) === null
        : await smokePassed(smoke, { phase: 'rollback', activeRelease: previousRelease, previousRelease });
      throw new DeploymentError('POST_DEPLOY_SMOKE_FAILED', 'Post-deployment smoke failed; previous release was restored', {
        releaseId,
        activeRelease: previousRelease,
        rollbackPerformed: true,
        rollbackVerified,
      });
    }

    await assertActiveRelease(root, nextRelease, 'CURRENT_CONFLICT');
    return Object.freeze({
      status: 'deployed',
      releaseId,
      activeRelease: nextRelease,
      previousRelease,
      rollbackPerformed: false,
      rollbackVerified: null,
    });
  } finally {
    await releaseLock();
  }
}

function parseArgs(argv) {
  const options = { smokeUrl: null, noSmoke: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--no-smoke') options.noSmoke = true;
    else if (['--artifact', '--release-root', '--release-id', '--smoke-url'].includes(argument)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new DeploymentError('INVALID_ARGUMENT', `${argument} requires a value`);
      const key = { '--artifact': 'artifactPath', '--release-root': 'releaseRoot', '--release-id': 'releaseId', '--smoke-url': 'smokeUrl' }[argument];
      options[key] = value;
    } else throw new DeploymentError('INVALID_ARGUMENT', `Unknown argument: ${argument}`);
  }
  for (const key of ['artifactPath', 'releaseRoot', 'releaseId']) {
    if (!options[key]) throw new DeploymentError('INVALID_ARGUMENT', `Missing required option: ${key}`);
  }
  if (options.noSmoke === Boolean(options.smokeUrl)) {
    throw new DeploymentError('INVALID_ARGUMENT', 'Choose exactly one of --smoke-url or --no-smoke');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let smoke;
  if (options.smokeUrl) {
    const { probePublicSite } = await import('./smoke.mjs');
    smoke = async () => probePublicSite(options.smokeUrl);
  }
  const result = await deployRelease({ ...options, smoke });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safe = error instanceof DeploymentError
      ? { status: 'failed', code: error.code, details: error.details }
      : { status: 'failed', code: 'UNEXPECTED_ERROR' };
    process.stderr.write(`${JSON.stringify(safe)}\n`);
    process.exitCode = 1;
  });
}
