import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { probePublicSite, resolveDnsAddresses, validateCaddyConfig } from './smoke.mjs';

const shell = '<!doctype html><div id="root"></div><script type="module" src="/assets/app-abc123.js"></script>';

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
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
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
    { id: 'root-status' },
    { id: 'root-content-type' },
    { id: 'root-cache' },
    { id: 'root-shell' },
    { id: 'root-security-headers' },
    { id: 'spa-status' },
    { id: 'spa-content-type' },
    { id: 'spa-cache' },
    { id: 'spa-shell' },
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
  for (const id of ['root-cache', 'root-security-headers', 'spa-status', 'spa-content-type', 'spa-cache', 'spa-shell', 'asset-content-type', 'asset-cache']) {
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
  const addresses = await resolveDnsAddresses('mofa.warvis.org', async (hostname, options) => {
    assert.equal(hostname, 'mofa.warvis.org');
    assert.deepEqual(options, { all: true, verbatim: true });
    return [{ address: '203.0.113.10', family: 4 }, { address: '2001:db8::10', family: 6 }];
  });
  assert.deepEqual(addresses, ['2001:db8::10', '203.0.113.10']);
});

test('repository Caddy contract has host, SPA fallback, cache split and no credential plugin', async () => {
  const config = await readFile(new URL('./Caddyfile', import.meta.url), 'utf8');
  const result = validateCaddyConfig(config);
  assert.deepEqual(result, { ok: true, failures: [] });

  const mutations = [
    [config.replace('mofa.warvis.org', 'localhost'), 'public host'],
    [config.replace('try_files {path} /index.html', 'try_files {path}'), 'SPA fallback'],
    [config.replace('max-age=31536000, immutable', 'max-age=60'), 'immutable asset cache'],
    [`${config}\ntls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} }`, 'credential-free TLS'],
  ];
  for (const [mutated, label] of mutations) {
    assert.equal(validateCaddyConfig(mutated).ok, false, `${label} mutation must fail`);
  }
});
