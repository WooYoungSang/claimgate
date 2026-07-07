import { describe, expect, it } from 'vitest';
import {
  attachAnchor,
  createEvidencePack,
  createExtractedClaim,
  evidenceItemFromClaim,
  evidencePackToJson,
  transitionClaim,
  type Claim,
  type Reviewer,
  type Source,
  type SourceAnchor
} from '../src/index.js';

const reviewer: Reviewer = { id: 'reviewer-1', displayName: 'Civic Reviewer' };
const now = () => '2026-07-07T00:00:00.000Z';
const source: Source = {
  id: 'src-civic-1',
  kind: 'csv',
  title: 'Civic fixture CSV',
  locator: 'fixtures/civic.csv',
  checksum: 'sha256:civic-fixture'
};

function extracted(id: string, text: string, aiValue: string | number): Claim {
  return createExtractedClaim({ id, text, aiValue, now });
}

function anchored(id: string, anchor: SourceAnchor, aiValue: string | number, sourceValue: string | number): Claim {
  return attachAnchor(extracted(id, `Claim ${id}`, aiValue), {
    anchor,
    sourceValue,
    actor: { kind: 'system', id: 'anchor-fixture' },
    now
  });
}

function verifiedClaim(id: string): Claim {
  return transitionClaim(
    transitionClaim(
      anchored(id, { kind: 'dataset-row', sourceId: source.id, dataset: 'civic.csv', row: 2, column: 'value', excerpt: '100' }, '100', '100'),
      { to: 'needs-evidence', actor: { kind: 'system', id: 'risk-fixture' }, now }
    ),
    { to: 'verified', reviewer, reason: 'Reviewer confirmed the source row.', now }
  );
}

function correctedClaim(id: string): Claim {
  return transitionClaim(
    transitionClaim(
      anchored(id, { kind: 'text-span', sourceId: source.id, startOffset: 5, endOffset: 12, excerpt: 'correct' }, 'wrong', 'correct'),
      { to: 'conflict', actor: { kind: 'system', id: 'value-match-rule' }, now }
    ),
    { to: 'corrected', reviewer, correction: { correctedValue: 'correct', reason: 'Source value is authoritative.' }, now }
  );
}

describe('Evidence Pack', () => {
  it('includes only verified and corrected projectable claims', () => {
    const rejected = transitionClaim(
      transitionClaim(
        anchored('rejected', { kind: 'web-link', sourceId: source.id, url: 'https://example.test/rejected' }, 'bad', 'good'),
        { to: 'needs-evidence', actor: { kind: 'system', id: 'risk-fixture' }, now }
      ),
      { to: 'rejected', reviewer, reason: 'Unsupported by source.', now }
    );
    const aggregateOnly = transitionClaim(
      anchored('aggregate', { kind: 'pdf-page', sourceId: source.id, page: 9, excerpt: 'aggregate only' }, '12', '12'),
      { to: 'aggregate-only', actor: { kind: 'system', id: 'risk-fixture' }, now }
    );

    const pack = createEvidencePack({
      id: 'pack-civic-1',
      title: 'Civic Evidence Pack',
      claims: [rejected, verifiedClaim('verified'), aggregateOnly, correctedClaim('corrected')],
      sources: [source],
      generatedAt: now()
    });

    expect(pack.items.map((item) => item.claimId)).toEqual(['corrected', 'verified']);
    expect(pack.items.map((item) => item.reviewerDecision)).toEqual(['corrected', 'verified']);
    expect(pack.items[0]).toMatchObject({
      claimId: 'corrected',
      normalizedValue: 'correct',
      correctionHistory: [{ correctedValue: 'correct', reason: 'Source value is authoritative.', reviewerId: reviewer.id }]
    });
    expect(pack.sources).toEqual([source]);
  });

  it('rejects direct EvidenceItem projection for malformed verified claims without reviewer terminal audit', () => {
    const malformedVerified = {
      ...anchored('malformed-verified', { kind: 'text-span', sourceId: source.id, startOffset: 1, endOffset: 4 }, 'bad', 'good'),
      state: 'verified' as const
    } satisfies Claim;

    expect(() => evidenceItemFromClaim(malformedVerified)).toThrow('Only reviewer-audited verified or corrected claims with Source Anchor may be projected.');
  });

  it('fails fast when projectable items reference sources missing from the pack input', () => {
    expect(() =>
      createEvidencePack({
        id: 'pack-missing-source',
        title: 'Missing Source Pack',
        claims: [verifiedClaim('verified-missing-source')],
        sources: [],
        generatedAt: now()
      })
    ).toThrow('Evidence Pack is missing sources referenced by projectable claims: src-civic-1');
  });

  it('serializes deterministically with stable ordering', () => {
    const pack = createEvidencePack({
      id: 'pack-deterministic',
      title: 'Deterministic Pack',
      claims: [verifiedClaim('b-claim'), correctedClaim('a-claim')],
      sources: [source],
      generatedAt: now()
    });

    const json = evidencePackToJson(pack);
    const parsed = JSON.parse(json);

    expect(json).toBe(evidencePackToJson(pack));
    expect(parsed.id).toBe('pack-deterministic');
    expect(parsed.sources.map((item: Source) => item.id)).toEqual(['src-civic-1']);
    expect(parsed.items.map((item: { claimId: string }) => item.claimId)).toEqual(['a-claim', 'b-claim']);
    expect(parsed.items[0]).toMatchObject({
      claimId: 'a-claim',
      reviewerDecision: 'corrected',
      normalizedValue: 'correct',
      sourceAnchorId: 'src-civic-1:text:start=5:end=12',
      correctionHistory: [{ correctedValue: 'correct', reason: 'Source value is authoritative.' }]
    });
    expect(parsed.items[1]).toMatchObject({
      claimId: 'b-claim',
      reviewerDecision: 'verified',
      normalizedValue: '100',
      sourceAnchorId: 'src-civic-1:dataset:name=civic.csv:row=2:column=value',
      correctionHistory: []
    });
  });
});
