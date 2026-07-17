#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const defaultConfigPath = path.join(path.dirname(modulePath), 'Caddyfile');
const APP_SHELL = /\bid=["']root["']/i;
const SCRIPT_ASSET = /<script\b[^>]*\bsrc=["']([^"']+\.(?:m?js)(?:\?[^"']*)?)["'][^>]*>/i;
const EXPECTED_SECURITY_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; style-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
});

function normalizeDnsRecords(records) {
  return [...new Set(records.flatMap((record) => {
    if (typeof record === 'string') return [record];
    return [record?.address, record?.value].filter(Boolean).map(String);
  }))].sort();
}

export async function resolveDnsAddresses(hostname, options = {}) {
  const resolver = options.resolver ?? new Resolver();
  const signal = options.signal;
  const cancel = () => {
    try {
      resolver.cancel();
    } catch {
      // Resolver cancellation is best-effort; the shared deadline still fails closed.
    }
  };
  if (signal?.aborted) {
    cancel();
    throw signal.reason ?? new Error('DNS probe aborted');
  }
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const results = await Promise.allSettled([
      resolver.resolve4(hostname),
      resolver.resolve6(hostname),
    ]);
    if (signal?.aborted) throw signal.reason ?? new Error('DNS probe aborted');
    const records = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    if (records.length === 0 && results.every((result) => result.status === 'rejected')) {
      throw new Error('DNS A and AAAA resolution failed');
    }
    return normalizeDnsRecords(records);
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

export async function inspectTlsConnection(hostname, { port = 443, timeoutMs = 8_000, signal, connect = tls.connect } = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: hostname, port, servername: hostname, rejectUnauthorized: true });
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    };
    const abort = () => fail(signal?.reason ?? new Error('TLS probe aborted'));
    const timer = setTimeout(() => fail(new Error('TLS probe timeout')), timeoutMs);
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    socket.once('secureConnect', () => {
      if (settled) return;
      settled = true;
      cleanup();
      const certificate = socket.getPeerCertificate();
      const result = {
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        validTo: certificate.valid_to ?? null,
      };
      socket.end();
      resolve(result);
    });
    socket.once('error', fail);
  });
}

function remainingTime(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

async function withDeadline(operation, deadlineAt, controller) {
  const remaining = remainingTime(deadlineAt);
  if (remaining === 0 || controller.signal.aborted) throw controller.signal.reason ?? new Error('Public probe deadline exceeded');
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Public probe deadline exceeded');
          controller.abort(error);
          reject(error);
        }, remaining);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function safeFetch(fetchImpl, url, deadlineAt, controller) {
  return withDeadline(
    () => fetchImpl(url, { redirect: 'follow', signal: controller.signal }),
    deadlineAt,
    controller,
  );
}

function header(response, name) {
  return response?.headers?.get(name)?.trim() ?? '';
}

function noCache(value) {
  return /(?:^|,)\s*(?:no-cache|no-store|must-revalidate|max-age=0)(?:\s*(?:,|$)|=)/i.test(value);
}

function immutableCache(value) {
  const age = Number(value.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? -1);
  return /(?:^|,)\s*public(?:\s*,|$)/i.test(value) && age >= 31_536_000 && /(?:^|,)\s*immutable(?:\s*,|$)/i.test(value);
}

function contentTypeMatches(assetPath, value) {
  const pathname = new URL(assetPath, 'https://fixture.invalid').pathname;
  if (/\.css$/i.test(pathname)) return /^text\/css\b/i.test(value);
  return /^(?:text|application)\/(?:javascript|ecmascript)\b/i.test(value);
}

function tlsIsHealthy(result, now) {
  if (!result?.authorized || !['TLSv1.2', 'TLSv1.3'].includes(result.protocol)) return false;
  const expiry = Date.parse(result.validTo ?? '');
  return Number.isFinite(expiry) && expiry > now.getTime();
}

function finalUrlIsExpected(response, origin) {
  try {
    const finalUrl = new URL(response?.url);
    return finalUrl.protocol === 'https:' && finalUrl.origin === origin;
  } catch {
    return false;
  }
}

function normalizedHeader(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function securityHeadersAreExact(response) {
  return Object.entries(EXPECTED_SECURITY_HEADERS).every(([name, expected]) => (
    normalizedHeader(header(response, name)) === expected
  ));
}

function shellAssetIdentity(assetPath, origin) {
  try {
    const asset = new URL(assetPath, origin);
    return asset.origin === origin ? `${asset.pathname}${asset.search}` : null;
  } catch {
    return null;
  }
}

function normalizedShellDigest(body) {
  const normalized = body.replace(/\s+/g, ' ').trim();
  return normalized ? createHash('sha256').update(normalized).digest('hex') : null;
}

export async function probePublicSite(input, dependencies = {}) {
  const checks = [];
  const add = (id, ok, detail) => checks.push(Object.freeze({ id, ok: Boolean(ok), detail }));
  let url;
  try {
    url = new URL(input);
  } catch {
    add('https', false, 'invalid URL');
    return Object.freeze({ ok: false, url: String(input), checks: Object.freeze(checks), failureCount: 1, assetPath: null, dns: { addresses: [] }, tls: null, edge: {} });
  }

  const https = url.protocol === 'https:';
  add('https', https, https ? 'HTTPS URL' : 'HTTPS is required');
  if (!https) {
    return Object.freeze({ ok: false, url: url.href, checks: Object.freeze(checks), failureCount: 1, assetPath: null, dns: { addresses: [] }, tls: null, edge: {} });
  }

  const timeoutMs = dependencies.timeoutMs ?? 8_000;
  const dnsResolve = dependencies.dnsResolve ?? resolveDnsAddresses;
  const tlsInspect = dependencies.tlsInspect ?? inspectTlsConnection;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const now = (dependencies.now ?? (() => new Date()))();
  const deadlineAt = Date.now() + timeoutMs;
  const controller = new AbortController();
  const deadlineTimer = setTimeout(() => controller.abort(new Error('Public probe deadline exceeded')), timeoutMs);

  try {
    let addresses = [];
    try {
      addresses = normalizeDnsRecords(await withDeadline(
        () => dnsResolve(url.hostname, { signal: controller.signal, timeoutMs: remainingTime(deadlineAt) }),
        deadlineAt,
        controller,
      ));
    } catch {
      addresses = [];
    }
    add('dns', addresses.length > 0, addresses.length > 0 ? `${addresses.length} address record(s)` : 'DNS resolution failed');

    let tlsResult = null;
    try {
      tlsResult = await withDeadline(
        () => tlsInspect(url.hostname, { signal: controller.signal, timeoutMs: remainingTime(deadlineAt), port: Number(url.port || 443) }),
        deadlineAt,
        controller,
      );
    } catch {
      tlsResult = null;
    }
    add('tls', tlsIsHealthy(tlsResult, now), tlsResult ? `${tlsResult.protocol ?? 'unknown'}; certificate expiry present` : 'TLS handshake failed');

    let rootResponse = null;
    let rootBody = '';
    try {
      rootResponse = await safeFetch(fetchImpl, url, deadlineAt, controller);
      rootBody = await withDeadline(() => rootResponse.text(), deadlineAt, controller);
    } catch {
      rootResponse = null;
    }
    const rootType = header(rootResponse, 'content-type');
    const rootCache = header(rootResponse, 'cache-control');
    const shellFound = APP_SHELL.test(rootBody);
    const assetPath = rootBody.match(SCRIPT_ASSET)?.[1] ?? null;
    const rootFinalUrlOk = finalUrlIsExpected(rootResponse, url.origin);
    add('root-final-url', rootFinalUrlOk, rootResponse?.url || 'root final URL missing');
    add('root-status', rootResponse?.status === 200, rootResponse ? `HTTP ${rootResponse.status}` : 'root fetch failed');
    add('root-content-type', /^text\/html\b/i.test(rootType), rootType || 'missing content-type');
    add('root-cache', noCache(rootCache), rootCache || 'missing cache-control');
    add('root-shell', shellFound && Boolean(assetPath), shellFound && assetPath ? 'app shell and script asset found' : 'app shell or script asset missing');

    const spaUrl = new URL('/__claimgate_spa_probe__', url);
    let spaResponse = null;
    let spaBody = '';
    try {
      spaResponse = await safeFetch(fetchImpl, spaUrl, deadlineAt, controller);
      spaBody = await withDeadline(() => spaResponse.text(), deadlineAt, controller);
    } catch {
      spaResponse = null;
    }
    const spaType = header(spaResponse, 'content-type');
    const spaCache = header(spaResponse, 'cache-control');
    const spaAssetPath = spaBody.match(SCRIPT_ASSET)?.[1] ?? null;
    add('spa-final-url', finalUrlIsExpected(spaResponse, url.origin), spaResponse?.url || 'SPA final URL missing');
    add('spa-status', spaResponse?.status === 200, spaResponse ? `HTTP ${spaResponse.status}` : 'SPA fallback fetch failed');
    add('spa-content-type', /^text\/html\b/i.test(spaType), spaType || 'missing content-type');
    add('spa-cache', noCache(spaCache), spaCache || 'missing cache-control');
    add('spa-shell', APP_SHELL.test(spaBody), APP_SHELL.test(spaBody) ? 'app shell found' : 'app shell missing');
    add(
      'html-security-headers',
      securityHeadersAreExact(rootResponse) && securityHeadersAreExact(spaResponse),
      'root and SPA require exact nosniff, referrer, frame, permissions and CSP policy',
    );
    const rootAssetIdentity = shellAssetIdentity(assetPath, url.origin);
    const spaAssetIdentity = shellAssetIdentity(spaAssetPath, url.origin);
    const rootShellDigest = normalizedShellDigest(rootBody);
    const spaShellDigest = normalizedShellDigest(spaBody);
    add(
      'spa-shell-identity',
      Boolean(rootAssetIdentity) && spaAssetIdentity === rootAssetIdentity && Boolean(rootShellDigest) && spaShellDigest === rootShellDigest,
      spaShellDigest ?? 'SPA shell missing',
    );

    let assetResponse = null;
    if (assetPath) {
      try {
        const assetUrl = new URL(assetPath, url);
        if (assetUrl.origin === url.origin) assetResponse = await safeFetch(fetchImpl, assetUrl, deadlineAt, controller);
      } catch {
        assetResponse = null;
      }
    }
    const assetType = header(assetResponse, 'content-type');
    const assetCache = header(assetResponse, 'cache-control');
    add('asset-final-url', finalUrlIsExpected(assetResponse, url.origin), assetResponse?.url || 'asset final URL missing');
    add('asset-status', assetResponse?.status === 200, assetResponse ? `HTTP ${assetResponse.status}` : 'same-origin asset fetch failed');
    add('asset-content-type', Boolean(assetPath) && contentTypeMatches(assetPath, assetType), assetType || 'missing content-type');
    add('asset-cache', immutableCache(assetCache), assetCache || 'missing cache-control');

    const failureCount = checks.filter(({ ok }) => !ok).length;
    return Object.freeze({
      ok: failureCount === 0,
      url: url.href,
      checks: Object.freeze(checks),
      failureCount,
      assetPath,
      dns: Object.freeze({ addresses: Object.freeze(addresses) }),
      tls: tlsResult ? Object.freeze({ ...tlsResult }) : null,
      edge: Object.freeze({
        server: header(rootResponse, 'server') || null,
        cfRayPresent: Boolean(header(rootResponse, 'cf-ray')),
        cfCacheStatus: header(rootResponse, 'cf-cache-status') || null,
      }),
    });
  } finally {
    clearTimeout(deadlineTimer);
    if (!controller.signal.aborted) controller.abort(new Error('Public probe completed'));
  }
}

export function validateCaddyConfig(config) {
  const failures = [];
  const requireMatch = (pattern, label) => {
    if (!pattern.test(config)) failures.push(label);
  };
  requireMatch(/\bmofa\.warvis\.org\s*\{/, 'mofa.warvis.org public host is missing');
  requireMatch(/root\s+\*\s+\{\$CLAIMGATE_SITE_ROOT:\/srv\/claimgate\/current\}/, 'versioned current release root is missing');
  requireMatch(/try_files\s+\{path\}\s+\/index\.html/, 'SPA fallback to index.html is missing');
  requireMatch(/file_server\b/, 'static file server is missing');
  requireMatch(/max-age=31536000,\s*immutable/, 'immutable asset cache is missing');
  requireMatch(/no-cache,\s*no-store,\s*must-revalidate/, 'HTML and fallback no-cache policy is missing');
  requireMatch(/X-Content-Type-Options\s+["']?nosniff/i, 'nosniff header is missing');
  requireMatch(/Referrer-Policy\s+"strict-origin-when-cross-origin"/i, 'exact referrer policy is missing');
  requireMatch(/X-Frame-Options\s+"DENY"/i, 'exact frame policy is missing');
  requireMatch(/Permissions-Policy\s+"camera=\(\), microphone=\(\), geolocation=\(\)"/i, 'exact permissions policy is missing');
  requireMatch(/Content-Security-Policy\s+"default-src 'self'; style-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"/i, 'exact content security policy is missing');
  if (/(?:CLOUDFLARE|CF)_?(?:API_?)?TOKEN|dns\s+cloudflare/i.test(config)) {
    failures.push('credential-free TLS boundary was violated');
  }
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function parseArgs(argv) {
  const options = { configOnly: false, configPath: defaultConfigPath, url: null, timeoutMs: 8_000 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--config-only') options.configOnly = true;
    else if (argument === '--url' || argument === '--config' || argument === '--timeout-ms') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      if (argument === '--timeout-ms') {
        const timeoutMs = Number(value);
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new Error('--timeout-ms must be an integer from 1 to 60000');
        options.timeoutMs = timeoutMs;
      } else options[argument === '--url' ? 'url' : 'configPath'] = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.configOnly && !options.url) throw new Error('Use --url <https-url> or --config-only');
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = await readFile(path.resolve(options.configPath), 'utf8');
  const configResult = validateCaddyConfig(config);
  if (options.configOnly) {
    process.stdout.write(`${JSON.stringify({ status: configResult.ok ? 'PASS' : 'FAIL', config: configResult })}\n`);
    return configResult.ok ? 0 : 1;
  }
  const probe = await probePublicSite(options.url, { timeoutMs: options.timeoutMs });
  const envelope = {
    status: configResult.ok && probe.ok ? 'PASS' : 'FAIL',
    observedAt: new Date().toISOString(),
    environment: 'public-read-only',
    config: configResult,
    probe,
  };
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  return envelope.status === 'PASS' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const exitAfterFlush = (code, stream) => {
    const failSafe = setTimeout(() => process.exit(code), 100);
    failSafe.unref();
    stream.write('', () => {
      clearTimeout(failSafe);
      process.exit(code);
    });
  };
  main().then(
    (code) => exitAfterFlush(code, process.stdout),
    () => {
      process.stderr.write(`${JSON.stringify({ status: 'FAIL', code: 'PUBLIC_PROBE_ERROR' })}\n`);
      exitAfterFlush(1, process.stderr);
    },
  );
}
