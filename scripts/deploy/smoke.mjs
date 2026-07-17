#!/usr/bin/env node

import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const defaultConfigPath = path.join(path.dirname(modulePath), 'Caddyfile');
const APP_SHELL = /\bid=["']root["']/i;
const SCRIPT_ASSET = /<script\b[^>]*\bsrc=["']([^"']+\.(?:m?js)(?:\?[^"']*)?)["'][^>]*>/i;

function normalizeDnsRecords(records) {
  return [...new Set(records.flatMap((record) => {
    if (typeof record === 'string') return [record];
    return [record?.address, record?.value].filter(Boolean).map(String);
  }))].sort();
}

export async function resolveDnsAddresses(hostname, lookupImpl = lookup) {
  return normalizeDnsRecords(await lookupImpl(hostname, { all: true, verbatim: true }));
}

async function defaultTlsInspect(hostname, port = 443, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: true });
    const timer = setTimeout(() => socket.destroy(new Error('TLS probe timeout')), timeoutMs);
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      const result = {
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        validTo: certificate.valid_to ?? null,
      };
      socket.end();
      resolve(result);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function safeFetch(fetchImpl, url, timeoutMs) {
  return fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
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
  const tlsInspect = dependencies.tlsInspect ?? ((hostname) => defaultTlsInspect(hostname, Number(url.port || 443), timeoutMs));
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const now = (dependencies.now ?? (() => new Date()))();

  let addresses = [];
  try {
    addresses = normalizeDnsRecords(await dnsResolve(url.hostname));
  } catch {
    addresses = [];
  }
  add('dns', addresses.length > 0, addresses.length > 0 ? `${addresses.length} address record(s)` : 'DNS resolution failed');

  let tlsResult = null;
  try {
    tlsResult = await tlsInspect(url.hostname);
  } catch {
    tlsResult = null;
  }
  add('tls', tlsIsHealthy(tlsResult, now), tlsResult ? `${tlsResult.protocol ?? 'unknown'}; certificate expiry present` : 'TLS handshake failed');

  let rootResponse = null;
  let rootBody = '';
  try {
    rootResponse = await safeFetch(fetchImpl, url, timeoutMs);
    rootBody = await rootResponse.text();
  } catch {
    rootResponse = null;
  }
  const rootType = header(rootResponse, 'content-type');
  const rootCache = header(rootResponse, 'cache-control');
  const shellFound = APP_SHELL.test(rootBody);
  const assetPath = rootBody.match(SCRIPT_ASSET)?.[1] ?? null;
  add('root-status', rootResponse?.status === 200, rootResponse ? `HTTP ${rootResponse.status}` : 'root fetch failed');
  add('root-content-type', /^text\/html\b/i.test(rootType), rootType || 'missing content-type');
  add('root-cache', noCache(rootCache), rootCache || 'missing cache-control');
  add('root-shell', shellFound && Boolean(assetPath), shellFound && assetPath ? 'app shell and script asset found' : 'app shell or script asset missing');
  add('root-security-headers', header(rootResponse, 'x-content-type-options').toLowerCase() === 'nosniff' && Boolean(header(rootResponse, 'referrer-policy')), 'nosniff and referrer-policy required');

  const spaUrl = new URL('/__claimgate_spa_probe__', url);
  let spaResponse = null;
  let spaBody = '';
  try {
    spaResponse = await safeFetch(fetchImpl, spaUrl, timeoutMs);
    spaBody = await spaResponse.text();
  } catch {
    spaResponse = null;
  }
  const spaType = header(spaResponse, 'content-type');
  const spaCache = header(spaResponse, 'cache-control');
  add('spa-status', spaResponse?.status === 200, spaResponse ? `HTTP ${spaResponse.status}` : 'SPA fallback fetch failed');
  add('spa-content-type', /^text\/html\b/i.test(spaType), spaType || 'missing content-type');
  add('spa-cache', noCache(spaCache), spaCache || 'missing cache-control');
  add('spa-shell', APP_SHELL.test(spaBody), APP_SHELL.test(spaBody) ? 'app shell found' : 'app shell missing');

  let assetResponse = null;
  if (assetPath) {
    try {
      const assetUrl = new URL(assetPath, url);
      if (assetUrl.origin === url.origin) assetResponse = await safeFetch(fetchImpl, assetUrl, timeoutMs);
    } catch {
      assetResponse = null;
    }
  }
  const assetType = header(assetResponse, 'content-type');
  const assetCache = header(assetResponse, 'cache-control');
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
  requireMatch(/Referrer-Policy\s+["']?strict-origin-when-cross-origin/i, 'referrer policy is missing');
  if (/(?:CLOUDFLARE|CF)_?(?:API_?)?TOKEN|dns\s+cloudflare/i.test(config)) {
    failures.push('credential-free TLS boundary was violated');
  }
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

function parseArgs(argv) {
  const options = { configOnly: false, configPath: defaultConfigPath, url: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--config-only') options.configOnly = true;
    else if (argument === '--url' || argument === '--config') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      options[argument === '--url' ? 'url' : 'configPath'] = value;
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
    if (!configResult.ok) process.exitCode = 1;
    return;
  }
  const probe = await probePublicSite(options.url);
  const envelope = {
    status: configResult.ok && probe.ok ? 'PASS' : 'FAIL',
    observedAt: new Date().toISOString(),
    environment: 'public-read-only',
    config: configResult,
    probe,
  };
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  if (envelope.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  main().catch(() => {
    process.stderr.write(`${JSON.stringify({ status: 'FAIL', code: 'PUBLIC_PROBE_ERROR' })}\n`);
    process.exitCode = 1;
  });
}
