#!/usr/bin/env node

import { cp, lstat, mkdir, opendir, readlink, realpath, rename, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RELEASE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,63})$/;
const SENSITIVE_COMPONENT = /^(?:\.env(?:\..*)?|secrets?|.*(?:[._-](?:secret|token))(?:[._-].*)?|.*\.(?:pem|key|p12|pfx|kdbx|age|gpg))$/i;

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

export async function deployRelease({ artifactPath, releaseRoot, releaseId, smoke }) {
  if (!RELEASE_ID.test(releaseId) || releaseId === '.' || releaseId === '..') {
    throw new DeploymentError('INVALID_RELEASE_ID', 'Release ID must be a bounded path-safe identifier');
  }

  const artifact = await validateArtifact(artifactPath);
  const root = path.resolve(releaseRoot);
  const releases = path.join(root, 'releases');
  await mkdir(releases, { recursive: true });
  const previousRelease = await readActiveRelease(root);
  const nextRelease = path.join(releases, releaseId);
  if (await pathState(nextRelease)) {
    throw new DeploymentError('RELEASE_EXISTS', 'Release ID already exists and will not be overwritten', { releaseId });
  }

  await cp(artifact, nextRelease, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });

  if (smoke && !await smokePassed(smoke, { phase: 'before', activeRelease: previousRelease, previousRelease })) {
    await rm(nextRelease, { recursive: true, force: true });
    throw new DeploymentError('PRE_DEPLOY_SMOKE_FAILED', 'Pre-deployment smoke failed; active release was not changed', {
      releaseId,
      activeRelease: previousRelease,
    });
  }

  await atomicSwitch(root, nextRelease);
  if (smoke && !await smokePassed(smoke, { phase: 'after', activeRelease: nextRelease, previousRelease })) {
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

  return Object.freeze({
    status: 'deployed',
    releaseId,
    activeRelease: nextRelease,
    previousRelease,
    rollbackPerformed: false,
    rollbackVerified: null,
  });
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
