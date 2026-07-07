import { describe, expect, it } from 'vitest';
import {
  createExtractedClaimsFromCandidates,
  FixtureClaimExtractor,
  parseExtractionFixture,
  type CandidateClaim,
  type ExtractionFixture
} from '../src/index.js';

const source = {
  id: 'civic-budget-2026',
  kind: 'csv',
  title: 'Civic budget 2026 fixture',
  locator: 'fixture://examples/fixtures/civic-data.claims.json'
} as const;

const fixture: ExtractionFixture = {
  id: 'civic-data-fixture',
  source,
  candidates: [
    {
      id: 'claim-population-ok',
      text: 'City population is 12,345.',
      subject: 'population',
      aiValue: '12,345',
      state: 'extracted',
      proposedAnchor: {
        kind: 'dataset-row',
        sourceId: source.id,
        dataset: 'civic-budget-2026.csv',
        row: 2,
        column: 'population',
        quote: '12345'
      }
    },
    {
      id: 'claim-budget-wrong',
      text: 'Parks budget is 9,000,000.',
      subject: 'parks budget',
      aiValue: 9_000_000,
      state: 'extracted',
      proposedAnchor: {
        kind: 'dataset-row',
        sourceId: source.id,
        dataset: 'civic-budget-2026.csv',
        row: 4,
        column: 'parks_budget',
        quote: '7000000'
      },
      fixtureNotes: ['intentional-error:value-mismatch']
    }
  ]
};

describe('AI extraction adapter boundary', () => {
  it('exposes a ClaimExtractor contract that returns extracted candidate claims only', async () => {
    const extractor = new FixtureClaimExtractor([fixture]);

    const candidates = await extractor.extractClaims(source);

    expect(candidates.map((candidate) => candidate.id)).toEqual(['claim-budget-wrong', 'claim-population-ok']);
    expect(candidates.every((candidate) => candidate.state === 'extracted')).toBe(true);
    expect(candidates[0]?.proposedAnchor).toMatchObject({ sourceId: source.id });
    expect(candidates[0]).not.toHaveProperty('anchor');
    expect(candidates[0]).not.toHaveProperty('riskLevel');
    expect(candidates[0]).not.toHaveProperty('reviewerDecision');
  });

  it('turns candidates into core Claims without attaching anchors or promoting state', () => {
    const claims = createExtractedClaimsFromCandidates(fixture.candidates, { now: () => '2026-07-07T00:00:00.000Z' });

    expect(claims).toHaveLength(2);
    expect(claims.map((claim) => claim.state)).toEqual(['extracted', 'extracted']);
    expect(claims.every((claim) => claim.anchor === undefined)).toBe(true);
    expect(claims.map((claim) => claim.audit[0]?.actor)).toEqual([
      { kind: 'system', id: 'ai-curator' },
      { kind: 'system', id: 'ai-curator' }
    ]);
  });

  it('rejects fixture records that smuggle judge, risk, projection, or terminal state authority', () => {
    const authorityLeak = JSON.stringify({
      id: 'bad-fixture',
      source,
      candidates: [
        {
          id: 'bad-claim',
          text: 'AI says this is verified.',
          state: 'verified',
          riskScore: 0.99,
          projected: true
        }
      ]
    });

    expect(() => parseExtractionFixture(authorityLeak)).toThrow(/AI extraction fixtures may only contain extracted candidates/);
  });

  it('keeps fixture loading deterministic and fixture-first, including intentional wrong claims', () => {
    const parsed = parseExtractionFixture(JSON.stringify(fixture));
    const candidates: readonly CandidateClaim[] = parsed.candidates;

    expect(parsed).toEqual(fixture);
    expect(candidates.map((candidate) => candidate.id)).toEqual(['claim-population-ok', 'claim-budget-wrong']);
    expect(candidates.some((candidate) => candidate.fixtureNotes?.includes('intentional-error:value-mismatch'))).toBe(true);
  });
});
