import { describe, expect, it } from 'vitest';
import {
  attachAnchor,
  createEvidencePack,
  reissueEvidencePack,
  revokeEvidencePack,
  supersedeEvidencePack,
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

  it('preserves AI/RAG provenance metadata without accepting authority metadata', () => {
    const pack = createEvidencePack({
      id: 'pack-ai-provenance',
      title: 'AI provenance pack',
      claims: [verifiedClaim('verified-ai-provenance')],
      sources: [source],
      generatedAt: now(),
      metadata: {
        provider: 'ollama',
        model: 'gemma4:12b',
        ragDocumentIds: 'src-civic-1',
        aiAuthority: 'candidate-only'
      }
    });

    expect(pack.metadata).toMatchObject({
      provider: 'ollama',
      model: 'gemma4:12b',
      ragDocumentIds: 'src-civic-1',
      aiAuthority: 'candidate-only'
    });
    expect(() =>
      createEvidencePack({
        id: 'pack-authority-leak',
        title: 'Authority leak pack',
        claims: [verifiedClaim('verified-authority-leak')],
        sources: [source],
        generatedAt: now(),
        metadata: { reviewerDecision: 'verified' }
      })
    ).toThrow('Evidence Pack metadata may record provenance only; verification, risk, review, and projection authority fields are forbidden.');
    expect(() =>
      createEvidencePack({
        id: 'pack-ai-authority-leak',
        title: 'AI authority leak pack',
        claims: [verifiedClaim('verified-ai-authority-leak')],
        sources: [source],
        generatedAt: now(),
        metadata: { aiAuthority: 'verified' }
      })
    ).toThrow('Evidence Pack metadata aiAuthority must be candidate-only.');
  });

  it('models supersede relation without mutating the previous Evidence Pack snapshot', () => {
    const previous = createEvidencePack({
      id: 'pack-v1',
      title: 'Civic Evidence Pack v1',
      claims: [verifiedClaim('claim-v1')],
      sources: [source],
      generatedAt: now()
    });
    const previousJson = evidencePackToJson(previous);

    const next = supersedeEvidencePack(previous, {
      id: 'pack-v2',
      title: 'Civic Evidence Pack v2',
      claims: [correctedClaim('claim-v2')],
      sources: [source],
      generatedAt: '2026-07-08T00:00:00.000Z',
      reason: 'Claim corrected after a later reviewer pass.'
    });

    expect(evidencePackToJson(previous)).toBe(previousJson);
    expect(previous.lifecycle.state).toBe('generated');
    expect(next.lifecycle).toEqual({
      state: 'generated-with-supersedes',
      supersedes: 'pack-v1',
      supersedeReason: 'Claim corrected after a later reviewer pass.'
    });
    expect(next.metadata.supersedes).toBe('pack-v1');
    expect(next.items.map((item) => item.claimId)).toEqual(['claim-v2']);
  });


  it('reissues an Evidence Pack as a new immutable snapshot with explicit replacement metadata', () => {
    const previous = createEvidencePack({
      id: 'pack-reissue-v1',
      title: 'Civic Evidence Pack reissue v1',
      claims: [verifiedClaim('claim-reissue-v1')],
      sources: [source],
      generatedAt: now(),
      metadata: { releaseChannel: 'demo' }
    });

    const reissued = reissueEvidencePack(previous, {
      id: 'pack-reissue-v2',
      title: 'Civic Evidence Pack reissue v2',
      claims: [verifiedClaim('claim-reissue-v2')],
      sources: [source],
      generatedAt: '2026-07-09T00:00:00.000Z',
      reason: 'Reissued after reviewer added a more precise source snapshot.',
      metadata: { releaseChannel: 'demo' }
    });

    expect(previous.lifecycle).toEqual({ state: 'generated' });
    expect(reissued.lifecycle).toEqual({
      state: 'generated-with-supersedes',
      supersedes: 'pack-reissue-v1',
      supersedeReason: 'Reissued after reviewer added a more precise source snapshot.',
      reissueOf: 'pack-reissue-v1'
    });
    expect(reissued.metadata).toMatchObject({
      releaseChannel: 'demo',
      supersedes: 'pack-reissue-v1',
      reissueOf: 'pack-reissue-v1',
      supersedeReason: 'Reissued after reviewer added a more precise source snapshot.'
    });
  });

  it('records revocation separately without mutating the Evidence Pack snapshot', () => {
    const pack = createEvidencePack({
      id: 'pack-revoke-v1',
      title: 'Civic Evidence Pack revoke v1',
      claims: [verifiedClaim('claim-revoke-v1')],
      sources: [source],
      generatedAt: now()
    });
    const before = evidencePackToJson(pack);

    const revocation = revokeEvidencePack(pack, {
      reviewer,
      reason: 'Published source was withdrawn by the upstream provider.',
      revokedAt: '2026-07-10T00:00:00.000Z',
      replacementPackId: 'pack-reissue-v2'
    });

    expect(evidencePackToJson(pack)).toBe(before);
    expect(pack.lifecycle).toEqual({ state: 'generated' });
    expect(revocation).toEqual({
      packId: 'pack-revoke-v1',
      decision: 'revoked',
      revokedAt: '2026-07-10T00:00:00.000Z',
      reviewer,
      reason: 'Published source was withdrawn by the upstream provider.',
      replacementPackId: 'pack-reissue-v2'
    });
    expect(Object.isFrozen(revocation)).toBe(true);
  });

  it('requires non-empty lifecycle reasons and new ids for supersede/reissue/revoke', () => {
    const pack = createEvidencePack({
      id: 'pack-lifecycle-guard',
      title: 'Lifecycle guard',
      claims: [verifiedClaim('claim-lifecycle-guard')],
      sources: [source],
      generatedAt: now()
    });

    expect(() =>
      supersedeEvidencePack(pack, {
        id: 'pack-lifecycle-guard',
        title: 'Same id pack',
        claims: [verifiedClaim('claim-lifecycle-guard-2')],
        sources: [source],
        reason: 'same id is forbidden'
      })
    ).toThrow(/must use a new id/);

    expect(() =>
      reissueEvidencePack(pack, {
        id: 'pack-lifecycle-reissue',
        title: 'Reissue without reason',
        claims: [verifiedClaim('claim-lifecycle-guard-3')],
        sources: [source],
        reason: ' '
      })
    ).toThrow(/requires a non-empty reason/);

    expect(() =>
      revokeEvidencePack(pack, {
        reviewer,
        reason: '',
        revokedAt: '2026-07-10T00:00:00.000Z'
      })
    ).toThrow(/requires a non-empty reason/);
  });

});
