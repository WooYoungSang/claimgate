import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { inspectTlsConnection, probePublicSite, resolveDnsAddresses, validateCaddyConfig } from './smoke.mjs';

const shell = '<!doctype html><div id="root"></div><script type="module" src="/assets/app-abc123.js"></script>';
const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; style-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
};

function response(body, { status = 200, headers = {}, url } = {}) {
  const value = new Response(body, { status, headers });
  if (url) Object.defineProperty(value, 'url', { configurable: true, value: url });
  return value;
}

function healthyDependencies(overrides = {}) {
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url.includes('/assets/')) {
      return response('console.log("ok")', {
        headers: {
          'content-type': 'text/javascript; charset=utf-8',
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        },
        url,
      });
    }
    return response(shell, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
        ...securityHeaders,
      },
      url,
    });
  };
  return {
    fetchImpl,
    dnsResolve: async () => ['203.0.113.10', '2001:db8::10'],
    tlsInspect: async () => ({ authorized: true, protocol: 'TLSv1.3', validTo: 'Jul 31 23:59:59 2026 GMT' }),
    now: () => new Date('2026-07-17T00:00:00Z'),
    ...overrides,
  };
}

test('HTTPS, DNS, TLS, app shell, SPA fallback and immutable asset contract all pass', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies());

  assert.equal(report.ok, true);
  assert.equal(report.failureCount, 0);
  assert.equal(report.assetPath, '/assets/app-abc123.js');
  assert.deepEqual(report.dns.addresses, ['2001:db8::10', '203.0.113.10']);
  assert.ok(report.checks.every(({ ok }) => ok));
  assert.deepEqual(report.checks.map(({ id }) => ({
    id,
  })), [
    { id: 'https' },
    { id: 'dns' },
    { id: 'tls' },
    { id: 'root-final-url' },
    { id: 'root-status' },
    { id: 'root-content-type' },
    { id: 'root-cache' },
    { id: 'root-shell' },
    { id: 'spa-final-url' },
    { id: 'spa-status' },
    { id: 'spa-content-type' },
    { id: 'spa-cache' },
    { id: 'spa-shell' },
    { id: 'html-security-headers' },
    { id: 'spa-shell-identity' },
    { id: 'asset-final-url' },
    { id: 'asset-status' },
    { id: 'asset-content-type' },
    { id: 'asset-cache' },
  ]);
});

test('wrong SPA fallback, cache headers and asset content type fail loud', async () => {
  const dependencies = healthyDependencies({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/assets/')) {
        return response('<html>wrong</html>', { headers: { 'content-type': 'text/html', 'cache-control': 'max-age=30' }, url });
      }
      if (url.includes('__claimgate_spa_probe__')) {
        return response('not found', { status: 404, headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=60' }, url });
      }
      return response(shell, { headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=86400' }, url });
    },
  });

  const report = await probePublicSite('https://mofa.warvis.org', dependencies);
  assert.equal(report.ok, false);
  for (const id of ['root-cache', 'html-security-headers', 'spa-status', 'spa-content-type', 'spa-cache', 'spa-shell', 'asset-content-type', 'asset-cache']) {
    assert.equal(report.checks.find((check) => check.id === id)?.ok, false, `${id} must fail`);
  }
});

test('missing DNS and unauthorized or expired TLS are independent failures', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    dnsResolve: async () => [],
    tlsInspect: async () => ({ authorized: false, protocol: 'TLSv1.2', validTo: 'Jul 01 00:00:00 2026 GMT' }),
  }));

  assert.equal(report.ok, false);
  assert.equal(report.checks.find(({ id }) => id === 'dns').ok, false);
  assert.equal(report.checks.find(({ id }) => id === 'tls').ok, false);
});

test('followed redirects must preserve HTTPS and the expected origin for every response', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/assets/')) {
        return response('console.log("ok")', {
          headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' },
          url: 'https://assets.invalid/app-abc123.js',
        });
      }
      if (url.includes('__claimgate_spa_probe__')) {
        return response(shell, {
          headers: { 'content-type': 'text/html', 'cache-control': 'no-cache', ...securityHeaders },
          url: 'http://mofa.warvis.org/__claimgate_spa_probe__',
        });
      }
      return response(shell, {
        headers: { 'content-type': 'text/html', 'cache-control': 'no-cache', ...securityHeaders },
        url: 'https://redirect.invalid/',
      });
    },
  }));

  for (const id of ['root-final-url', 'spa-final-url', 'asset-final-url']) {
    assert.equal(report.checks.find((check) => check.id === id)?.ok, false, `${id} must fail`);
  }
});

test('SPA fallback must reference the exact same versioned shell asset as root', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/assets/')) {
        return response('console.log("ok")', { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }, url });
      }
      const body = url.includes('__claimgate_spa_probe__')
        ? shell.replace('app-abc123.js', 'app-wrong999.js')
        : shell;
      return response(body, { headers: { 'content-type': 'text/html', 'cache-control': 'no-cache', ...securityHeaders }, url });
    },
  }));

  assert.equal(report.checks.find(({ id }) => id === 'spa-shell').ok, true);
  assert.equal(report.checks.find(({ id }) => id === 'spa-shell-identity').ok, false);
});

test('SPA fallback must match the normalized full root shell, not only its script asset', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/assets/')) {
        return response('console.log("ok")', { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }, url });
      }
      const body = url.includes('__claimgate_spa_probe__')
        ? shell.replace('<div id="root">', '<main data-mutated="true"><div id="root">')
        : shell;
      return response(body, { headers: { 'content-type': 'text/html', 'cache-control': 'no-cache', ...securityHeaders }, url });
    },
  }));
  assert.equal(report.checks.find(({ id }) => id === 'spa-shell-identity').ok, false);
});

test('SPA fallback independently requires the exact five security headers', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/assets/')) {
        return response('console.log("ok")', { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }, url });
      }
      const headers = { 'content-type': 'text/html', 'cache-control': 'no-cache', ...securityHeaders };
      if (url.includes('__claimgate_spa_probe__')) delete headers['content-security-policy'];
      return response(shell, { headers, url });
    },
  }));
  assert.equal(report.checks.find(({ id }) => id === 'html-security-headers').ok, false);
});

test('DNS and the complete probe have one hard deadline even for non-cooperative dependencies', async () => {
  const started = Date.now();
  const observed = await Promise.race([
    probePublicSite('https://mofa.warvis.org', healthyDependencies({
      timeoutMs: 40,
      dnsResolve: async () => new Promise(() => {}),
      tlsInspect: async () => new Promise(() => {}),
      fetchImpl: async () => new Promise(() => {}),
    })).then((report) => ({ report })),
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 250)),
  ]);

  assert.equal(observed.timedOut, undefined, 'probe exceeded its hard deadline');
  assert.ok(Date.now() - started < 250);
  assert.equal(observed.report.checks.find(({ id }) => id === 'dns').ok, false);
});

test('security header policy is exact and fails closed on weak or missing values', async () => {
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/assets/')) {
        return response('console.log("ok")', { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }, url });
      }
      return response(shell, {
        headers: {
          'content-type': 'text/html',
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'unsafe-url',
          'x-frame-options': 'SAMEORIGIN',
        },
        url,
      });
    },
  }));
  assert.equal(report.checks.find(({ id }) => id === 'html-security-headers').ok, false);
});

test('plain HTTP is rejected before any network probe runs', async () => {
  let calls = 0;
  const report = await probePublicSite('http://mofa.warvis.org', healthyDependencies({
    fetchImpl: async () => { calls += 1; throw new Error('must not fetch'); },
    dnsResolve: async () => { calls += 1; return []; },
    tlsInspect: async () => { calls += 1; return {}; },
  }));
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(({ id }) => id === 'https').ok, false);
  assert.equal(calls, 0);
});

test('DNS probe uses normal address lookup instead of unsupported ANY queries', async () => {
  const calls = [];
  const resolver = {
    resolve4: async (hostname) => { calls.push(['A', hostname]); return ['203.0.113.10']; },
    resolve6: async (hostname) => { calls.push(['AAAA', hostname]); return ['2001:db8::10']; },
    cancel: () => {},
  };
  const addresses = await resolveDnsAddresses('mofa.warvis.org', { resolver });
  assert.deepEqual(calls, [['A', 'mofa.warvis.org'], ['AAAA', 'mofa.warvis.org']]);
  assert.deepEqual(addresses, ['2001:db8::10', '203.0.113.10']);
});

test('DNS resolver cancellation is propagated through the shared abort signal', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const rejects = [];
  const pending = () => new Promise((_, reject) => rejects.push(reject));
  const resolver = {
    resolve4: pending,
    resolve6: pending,
    cancel: () => {
      cancelled = true;
      for (const reject of rejects) reject(new Error('cancelled'));
    },
  };
  const result = resolveDnsAddresses('mofa.warvis.org', { resolver, signal: controller.signal });
  controller.abort(new Error('deadline'));
  await assert.rejects(result);
  assert.equal(cancelled, true);
});

test('TLS abort destroys the in-flight socket and rejects immediately', async () => {
  const controller = new AbortController();
  const socket = new EventEmitter();
  let destroyed = false;
  socket.destroy = () => { destroyed = true; };
  socket.end = () => {};
  socket.getPeerCertificate = () => ({});
  socket.getProtocol = () => null;
  const pending = inspectTlsConnection('mofa.warvis.org', {
    signal: controller.signal,
    timeoutMs: 5_000,
    connect: () => socket,
  });
  controller.abort(new Error('deadline'));
  await assert.rejects(pending, /deadline/);
  assert.equal(destroyed, true);
});

test('fetch receives the shared abort signal and later stages receive only remaining budget', async () => {
  let fetchAborted = false;
  let dnsBudget;
  let tlsBudget;
  const report = await probePublicSite('https://mofa.warvis.org', healthyDependencies({
    timeoutMs: 50,
    dnsResolve: async (_hostname, options) => {
      dnsBudget = options.timeoutMs;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return ['203.0.113.10'];
    },
    tlsInspect: async (_hostname, options) => {
      tlsBudget = options.timeoutMs;
      return { authorized: true, protocol: 'TLSv1.3', validTo: 'Jul 31 23:59:59 2026 GMT' };
    },
    fetchImpl: async (_input, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        fetchAborted = true;
        reject(options.signal.reason);
      }, { once: true });
    }),
  }));
  assert.equal(report.ok, false);
  assert.equal(fetchAborted, true);
  assert.ok(dnsBudget <= 50 && dnsBudget > 0);
  assert.ok(tlsBudget < dnsBudget && tlsBudget > 0);
});

test('actual smoke CLI exits within its hard deadline despite a non-cooperative active handle', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'claimgate-smoke-cli-'));
  const preload = path.join(root, 'preload.mjs');
  await writeFile(preload, `
    globalThis.fetch = async () => new Promise(() => {});
    setInterval(() => {}, 1000);
  `);
  const started = Date.now();
  const child = spawn(process.execPath, ['--import', preload, new URL('./smoke.mjs', import.meta.url).pathname, '--url', 'https://localhost:9', '--timeout-ms', '80'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];
  child.stdout.on('data', (chunk) => output.push(chunk));
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 800);
  try {
    const [code, signal] = await new Promise((resolve) => child.once('exit', (exitCode, exitSignal) => resolve([exitCode, exitSignal])));
    assert.equal(signal, null, 'CLI required external SIGKILL');
    assert.equal(code, 1);
    assert.ok(Date.now() - started < 600, `CLI wall clock exceeded: ${Date.now() - started}ms`);
    assert.match(Buffer.concat(output).toString('utf8'), /"status":\s*"FAIL"/);
  } finally {
    clearTimeout(watchdog);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await rm(root, { recursive: true, force: true });
  }
});

test('UI progress is semantic and contains no CSP-blocked inline style', async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL('../../examples/civic-review-app/src/main.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../examples/civic-review-app/src/styles.css', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(main, /style=\{\{/);
  assert.match(main, /<progress[\s\S]*?value=\{reviewedCount\}[\s\S]*?max=\{queue\.length\}/);
  assert.match(styles, /progress\.progress-track/);
  assert.match(styles, /::-webkit-progress-value/);
  assert.match(styles, /::-moz-progress-bar/);
});

test('repository Caddy contract has host, SPA fallback, cache split and no credential plugin', async () => {
  const config = await readFile(new URL('./Caddyfile', import.meta.url), 'utf8');
  const result = validateCaddyConfig(config);
  assert.deepEqual(result, { ok: true, failures: [] });

  const mutations = [
    [config.replace('mofa.warvis.org', 'localhost'), 'public host'],
    [config.replace('try_files {path} /index.html', 'try_files {path}'), 'SPA fallback'],
    [config.replace('max-age=31536000, immutable', 'max-age=60'), 'immutable asset cache'],
    [config.replace('Referrer-Policy "strict-origin-when-cross-origin"', 'Referrer-Policy "unsafe-url"'), 'referrer policy'],
    [config.replace('X-Frame-Options "DENY"', 'X-Frame-Options "SAMEORIGIN"'), 'frame policy'],
    [config.replace('Permissions-Policy "camera=(), microphone=(), geolocation=()"', 'Permissions-Policy "camera=(*)"'), 'permissions policy'],
    [config.replace("style-src 'self';", "style-src 'unsafe-inline';"), 'CSP style policy'],
    [config.replace(/\n\s*Content-Security-Policy[^\n]*/, ''), 'content security policy'],
    [`${config}\ntls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} }`, 'credential-free TLS'],
  ];
  for (const [mutated, label] of mutations) {
    assert.equal(validateCaddyConfig(mutated).ok, false, `${label} mutation must fail`);
  }
});
