import { describe, expect, it } from 'vitest';
import {
  attachAnchor,
  createEvidencePack,
  createExtractedClaim,
  projectEvidencePackToGraph,
  renderEvidenceReportHtml,
  renderEvidenceReportMarkdown,
  transitionClaim,
  type Claim,
  type Reviewer,
  type Source
} from '../src/index.js';

const reviewer: Reviewer = { id: 'reviewer-1' };
const now = () => '2026-07-07T00:00:00.000Z';
const sources: readonly Source[] = [
  { id: 'src-a', kind: 'web', title: 'Agency release', locator: 'https://agency.test/release' },
  { id: 'src-b', kind: 'text', title: 'Local transcript', locator: 'fixtures/transcript.txt' }
];

function reviewedClaim(id: string, state: 'verified' | 'corrected'): Claim {
  const anchored = attachAnchor(createExtractedClaim({ id, text: `Claim ${id}`, aiValue: state === 'verified' ? 'ok' : 'bad', now }), {
    anchor:
      state === 'verified'
        ? { kind: 'web-link', sourceId: 'src-a', url: 'https://agency.test/release', excerpt: 'ok' }
        : { kind: 'text-span', sourceId: 'src-b', startOffset: 0, endOffset: 4, excerpt: 'good' },
    sourceValue: state === 'verified' ? 'ok' : 'good',
    actor: { kind: 'system', id: 'anchor-fixture' },
    now
  });
  const reviewable = transitionClaim(anchored, {
    to: state === 'verified' ? 'needs-evidence' : 'conflict',
    actor: { kind: 'system', id: 'risk-fixture' },
    now
  });

  return transitionClaim(reviewable, {
    to: state,
    reviewer,
    ...(state === 'corrected' ? { correction: { correctedValue: 'good', reason: 'Corrected from transcript.' } } : {}),
    now
  });
}

describe('Evidence Pack projectors', () => {
  it('projects deterministic graph nodes and edges without a graph database', () => {
    const pack = createEvidencePack({
      id: 'pack-projector',
      title: 'Projection Pack',
      claims: [reviewedClaim('verified', 'verified'), reviewedClaim('corrected', 'corrected')],
      sources,
      generatedAt: now()
    });

    expect(projectEvidencePackToGraph(pack)).toMatchInlineSnapshot(`
      {
        "edges": [
          {
            "from": "evidence-pack:pack-projector",
            "id": "evidence-pack:pack-projector->claim:corrected",
            "to": "claim:corrected",
            "type": "CONTAINS_CLAIM",
          },
          {
            "from": "evidence-pack:pack-projector",
            "id": "evidence-pack:pack-projector->claim:verified",
            "to": "claim:verified",
            "type": "CONTAINS_CLAIM",
          },
          {
            "from": "claim:corrected",
            "id": "claim:corrected->source:src-b",
            "to": "source:src-b",
            "type": "ANCHORED_TO",
          },
          {
            "from": "claim:verified",
            "id": "claim:verified->source:src-a",
            "to": "source:src-a",
            "type": "ANCHORED_TO",
          },
        ],
        "nodes": [
          {
            "id": "claim:corrected",
            "label": "Claim",
            "properties": {
              "decision": "corrected",
              "sourceAnchorId": "src-b:text:0-4",
              "text": "Claim corrected",
              "value": "good",
            },
          },
          {
            "id": "claim:verified",
            "label": "Claim",
            "properties": {
              "decision": "verified",
              "sourceAnchorId": "src-a:web:https://agency.test/release",
              "text": "Claim verified",
              "value": "ok",
            },
          },
          {
            "id": "evidence-pack:pack-projector",
            "label": "EvidencePack",
            "properties": {
              "generatedAt": "2026-07-07T00:00:00.000Z",
              "itemCount": 2,
              "title": "Projection Pack",
            },
          },
          {
            "id": "source:src-a",
            "label": "Source",
            "properties": {
              "kind": "web",
              "locator": "https://agency.test/release",
              "title": "Agency release",
            },
          },
          {
            "id": "source:src-b",
            "label": "Source",
            "properties": {
              "kind": "text",
              "locator": "fixtures/transcript.txt",
              "title": "Local transcript",
            },
          },
        ],
      }
    `);
  });

  it('renders markdown and HTML report primitives from the same Evidence Pack', () => {
    const rejected = transitionClaim(
      transitionClaim(
        attachAnchor(createExtractedClaim({ id: 'rejected', text: 'This must not leak', aiValue: 'bad', now }), {
          anchor: { kind: 'web-link', sourceId: 'src-a', url: 'https://agency.test/reject' },
          sourceValue: 'good',
          actor: { kind: 'system', id: 'anchor-fixture' },
          now
        }),
        { to: 'needs-evidence', actor: { kind: 'system', id: 'risk-fixture' }, now }
      ),
      { to: 'rejected', reviewer, now }
    );
    const pack = createEvidencePack({
      id: 'pack-report',
      title: 'Reusable Evidence',
      claims: [rejected, reviewedClaim('verified', 'verified'), reviewedClaim('corrected', 'corrected')],
      sources,
      generatedAt: now()
    });

    const markdown = renderEvidenceReportMarkdown(pack, { title: 'Civic Report', itemLabel: 'Finding' });
    const html = renderEvidenceReportHtml(pack, { title: 'Health Report', itemLabel: 'Claim' });

    expect(markdown).toContain('# Civic Report');
    expect(markdown).toContain('## Finding 1: corrected');
    expect(markdown).toContain('Claim corrected');
    expect(markdown).not.toContain('This must not leak');
    expect(html).toContain('<h1>Health Report</h1>');
    expect(html).toContain('Claim verified');
    expect(html).not.toContain('This must not leak');
    expect(markdown).not.toEqual(html);
  });
});
