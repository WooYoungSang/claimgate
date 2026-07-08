import assert from 'node:assert/strict';
import {
  attachAnchor,
  createEvidencePack,
  createExtractedClaim,
  evidencePackToJson,
  projectEvidencePackToGraph,
  renderEvidenceReportHtml,
  renderEvidenceReportMarkdown,
  transitionClaim,
  type Reviewer
} from '@claimgate/core';
import { ImpactGraphView, ImpactReport } from '@claimgate/ui';

const now = () => '2026-07-07T00:00:00.000Z';
const reviewer: Reviewer = { kind: 'reviewer', id: 'handoff-reviewer' };
const source = { id: 'src-budget', kind: 'csv' as const, title: 'Budget CSV', locator: 'fixture://handoff/budget.csv' };

function anchoredClaim(id: string, text: string, aiValue: string) {
  return attachAnchor(createExtractedClaim({ id, text, aiValue, now }), {
    anchor: { kind: 'dataset-row', sourceId: source.id, dataset: 'budget.csv', row: 12, column: 'amount' },
    sourceValue: '$4M',
    actor: { kind: 'system', id: 'handoff-anchorer' },
    now
  });
}

const reviewed = transitionClaim(
  transitionClaim(anchoredClaim('claim-verified', 'The city spent $4M on parks.', '$4M'), { to: 'needs-evidence', actor: { kind: 'system', id: 'deterministic-risk-engine' }, now }),
  {
    to: 'verified',
    reviewer,
    reason: 'Reviewer confirmed the anchored source.',
    now
  }
);
const rejected = transitionClaim(
  transitionClaim(anchoredClaim('claim-rejected', 'The city spent $9M on parks.', '$9M'), { to: 'conflict', actor: { kind: 'system', id: 'deterministic-risk-engine' }, now }),
  { to: 'rejected', reviewer, reason: 'Reviewer rejected a mismatched candidate.', now }
);
const pack = createEvidencePack({ id: 'handoff-pack', title: 'ClaimGate handoff pack', claims: [rejected, reviewed], sources: [source], generatedAt: now() });
const evidencePackJson = evidencePackToJson(pack);
const graph = projectEvidencePackToGraph(pack);
const markdown = renderEvidenceReportMarkdown(pack, { includeAudit: true });
const html = renderEvidenceReportHtml(pack, { includeAudit: true });

assert.equal(pack.items.length, 1, 'only reviewed verified/corrected claims enter evidence pack');
assert.match(evidencePackJson, /"reviewerDecision": "verified"/, 'Evidence Pack JSON is the primary handoff artifact');
assert.doesNotMatch(evidencePackJson, /claim-rejected/, 'rejected claims stay out of Evidence Pack JSON');
assert.equal(graph.nodes.some((node) => node.id === 'evidence-pack:handoff-pack'), true, 'graph projection is rooted in the evidence pack');
assert.equal(graph.nodes.some((node) => node.id === 'claim:claim-verified'), true, 'verified claim projects to graph');
assert.equal(graph.nodes.some((node) => node.id.includes('claim-rejected')), false, 'rejected claim stays out of graph');
assert.match(markdown, /Projection source: Evidence Pack/);
assert.match(markdown, /Projection boundary: verified\/corrected reviewer decisions only/);
assert.doesNotMatch(markdown, /claim-rejected|spent \$9M/);
assert.match(markdown, /Finding 1: verified|Claim 1: verified/);
assert.match(html, /Projection source: Evidence Pack/);
assert.match(html, /Projection boundary: verified\/corrected reviewer decisions only/);
assert.doesNotMatch(html, /claim-rejected|spent \$9M/);
assert.match(html, /ClaimGate handoff pack/);

const graphUi = ImpactGraphView({
  graph: {
    title: 'Handoff graph',
    nodes: graph.nodes.map((node) => ({ id: node.id, label: node.label, title: String(node.properties.title ?? node.properties.text ?? node.id), decision: String(node.properties.decision ?? '') })),
    edges: graph.edges,
    excludedCount: 1
  }
});
const reportUi = ImpactReport({ report: { title: pack.title, markdown, html, evidenceItemCount: pack.items.length, excludedCount: 1 } });

assert.equal(typeof graphUi.type, 'string');
assert.equal(typeof reportUi.type, 'string');
console.log(
  JSON.stringify(
    {
      status: 'PASS',
      artifact_order: ['EvidencePack JSON', 'Report Markdown/HTML', 'Graph JSON'],
      primary: { kind: 'EvidencePack', id: pack.id, projected_claims: pack.items.length },
      auxiliary: { report_bytes: markdown.length + html.length, graph_nodes: graph.nodes.length, graph_edges: graph.edges.length },
      excluded_non_projectable_claims: 1
    },
    null,
    2
  )
);
