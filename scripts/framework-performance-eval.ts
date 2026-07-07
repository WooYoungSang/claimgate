import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  attachAnchor,
  buildRiskQueue,
  calculateFakeWorkReduction,
  createEvidencePack,
  createExtractedClaim,
  evidencePackToJson,
  projectEvidencePackToGraph,
  renderEvidenceReportHtml,
  renderEvidenceReportMarkdown,
  transitionClaim,
  type Claim,
  type EvaluateRiskInput,
  type Reviewer,
  type Source
} from '@claimgate/core';

const CLAIM_COUNT = Number.parseInt(process.env.CLAIMGATE_PERF_CLAIMS ?? '5000', 10);
const TOTAL_BUDGET_MS = Number.parseInt(process.env.CLAIMGATE_PERF_BUDGET_MS ?? '5000', 10);
const now = () => '2026-07-07T00:00:00.000Z';
const reviewer: Reviewer = { kind: 'reviewer', id: 'perf-reviewer' };
const source: Source = { id: 'src-performance', kind: 'csv', title: 'Performance fixture CSV', locator: 'fixture://performance/claims.csv' };

function timed<T>(label: string, fn: () => T): { readonly label: string; readonly durationMs: number; readonly value: T } {
  const start = performance.now();
  const value = fn();
  const durationMs = performance.now() - start;
  return { label, durationMs, value };
}

const build = timed('build deterministic claims and risk inputs', () => {
  const claims: Claim[] = [];
  const riskInputs: EvaluateRiskInput[] = [];

  for (let index = 0; index < CLAIM_COUNT; index += 1) {
    const bucket = index % 4;
    const aiValue = bucket === 0 || bucket === 3 ? `value-${index}` : `candidate-${index}`;
    const sourceValue = bucket === 1 || bucket === 2 ? `source-${index}` : aiValue;
    const extracted = createExtractedClaim({
      id: `claim-${String(index).padStart(5, '0')}`,
      text: `Synthetic performance claim #${String(index).padStart(5, '0')}`,
      subject: `entity-${index % 50}`,
      aiValue,
      now
    });
    const anchored = attachAnchor(extracted, {
      anchor: { kind: 'dataset-row', sourceId: source.id, dataset: 'performance.csv', row: index + 1, column: 'value' },
      sourceValue,
      actor: { kind: 'system', id: 'performance-fixture' },
      now
    });
    claims.push(anchored);
    riskInputs.push({ claim: anchored, facts: bucket === 3 ? { aggregateOnly: true } : undefined });
  }

  return { claims, riskInputs };
});

const queue = timed('evaluate deterministic risk queue', () =>
  buildRiskQueue(build.value.riskInputs, { greenSampleRate: 0.1, minGreenSampleCount: 10, seed: 'framework-performance-eval' })
);

const review = timed('apply reviewer terminal decisions', () => {
  const reviewed: Claim[] = [];

  for (const item of queue.value.allEvaluations) {
    const numericId = Number.parseInt(item.claim.id.replace(/\D/g, ''), 10);
    if (numericId % 4 === 0) {
      reviewed.push(
        transitionClaim(transitionClaim(item.claim, { to: 'needs-evidence', actor: { kind: 'system', id: 'deterministic-risk-engine' }, now }), {
          to: 'verified',
          reviewer,
          reason: 'Synthetic reviewer verified matching source value.',
          now
        })
      );
    } else if (numericId % 4 === 1) {
      reviewed.push(
        transitionClaim(transitionClaim(item.claim, { to: 'conflict', actor: { kind: 'system', id: 'deterministic-risk-engine' }, now }), {
          to: 'corrected',
          reviewer,
          correction: { correctedValue: item.claim.sourceValue ?? null, reason: 'Synthetic reviewer corrected to source value.' },
          now
        })
      );
    } else if (numericId % 4 === 2) {
      reviewed.push(
        transitionClaim(transitionClaim(item.claim, { to: 'conflict', actor: { kind: 'system', id: 'deterministic-risk-engine' }, now }), {
          to: 'rejected',
          reviewer,
          reason: 'Synthetic reviewer rejected a mismatched claim.',
          now
        })
      );
    } else {
      reviewed.push(transitionClaim(item.claim, { to: 'aggregate-only', actor: { kind: 'system', id: 'deterministic-risk-engine' }, now }));
    }
  }

  return reviewed;
});

const pack = timed('create evidence pack', () =>
  createEvidencePack({ id: 'perf-pack', title: 'Performance Evidence Pack', claims: review.value, sources: [source], generatedAt: now() })
);
const graph = timed('project graph JSON', () => projectEvidencePackToGraph(pack.value));
const markdown = timed('render markdown report', () => renderEvidenceReportMarkdown(pack.value, { includeAudit: true }));
const html = timed('render HTML report', () => renderEvidenceReportHtml(pack.value, { includeAudit: true }));
const json = timed('serialize evidence pack JSON', () => evidencePackToJson(pack.value));
const stats = timed('calculate fake-work reduction', () => calculateFakeWorkReduction({ queue: queue.value, reviewedClaims: review.value }));

const timings = [build, queue, review, pack, graph, markdown, html, json, stats].map(({ label, durationMs }) => ({ label, durationMs: round(durationMs) }));
const totalDurationMs = round(timings.reduce((sum, item) => sum + item.durationMs, 0));
const projectedClaimCount = pack.value.items.length;
const report = {
  claimCount: CLAIM_COUNT,
  projectedClaimCount,
  graphNodes: graph.value.nodes.length,
  graphEdges: graph.value.edges.length,
  markdownBytes: Buffer.byteLength(markdown.value),
  htmlBytes: Buffer.byteLength(html.value),
  jsonBytes: Buffer.byteLength(json.value),
  riskSummary: queue.value.summary,
  fakeWorkReduction: stats.value,
  timings,
  totalDurationMs,
  budgetMs: TOTAL_BUDGET_MS,
  throughputClaimsPerSecond: round((CLAIM_COUNT / Math.max(totalDurationMs, 1)) * 1000)
};

assert.equal(queue.value.summary.totalClaimCount, CLAIM_COUNT);
assert.equal(projectedClaimCount, Math.ceil(CLAIM_COUNT / 2), 'verified + corrected claims should be exactly half of synthetic corpus');
assert.equal(graph.value.nodes.some((node) => node.id.includes('claim-00002')), false, 'rejected claims must not project to graph');
assert.equal(markdown.value.includes('Synthetic performance claim #00002'), false, 'rejected claims must not project to report');
assert.ok(totalDurationMs < TOTAL_BUDGET_MS, `framework performance budget exceeded: ${totalDurationMs}ms >= ${TOTAL_BUDGET_MS}ms`);

console.log(JSON.stringify(report, null, 2));
console.log('ClaimGate framework performance eval PASS');

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
