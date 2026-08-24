import { describe, expect, it } from 'vitest';
import {
  createExtractedClaimsFromCandidates,
  describeClaimExtractorBoundary,
  extractCandidateClaims,
  FixtureClaimExtractor,
  parseExtractionFixture,
  type CandidateClaim,
  type ClaimExtractor,
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

  it('normalizes and freezes proposed anchors from adapter output without attaching them to core Claims', async () => {
    const mutableProposedAnchor = {
      kind: 'dataset-row' as const,
      sourceId: source.id,
      dataset: 'civic-budget-2026.csv',
      row: 2,
      column: 'population'
    };
    const futureAdapter: ClaimExtractor = {
      id: 'future-llm-proposed-anchor-test-double',
      mode: 'llm-adapter-boundary',
      extractClaims: () => [
        {
          id: 'candidate-with-proposed-anchor',
          text: 'City population is 12,345.',
          state: 'extracted',
          aiValue: '12,345',
          proposedAnchor: mutableProposedAnchor
        }
      ]
    };

    const [candidate] = await extractCandidateClaims(futureAdapter, source);
    mutableProposedAnchor.row = 99;
    const [claim] = createExtractedClaimsFromCandidates([candidate!], { now: () => '2026-07-07T00:00:00.000Z' });

    expect(candidate?.proposedAnchor).toMatchObject({ sourceId: source.id, row: 2 });
    expect(Object.isFrozen(candidate?.proposedAnchor)).toBe(true);
    expect(claim?.state).toBe('extracted');
    expect(claim?.anchor).toBeUndefined();
  });

  it('rejects multi-anchor proposal shapes instead of silently choosing or ignoring anchors', async () => {
    const futureAdapter: ClaimExtractor = {
      id: 'future-llm-multi-anchor-test-double',
      mode: 'llm-adapter-boundary',
      extractClaims: () =>
        [
          {
            id: 'composite-candidate',
            text: 'Composite claim needs more than one source.',
            state: 'extracted',
            proposedAnchors: [
              { kind: 'dataset-row', sourceId: source.id, dataset: 'a.csv', row: 1 },
              { kind: 'dataset-row', sourceId: source.id, dataset: 'b.csv', row: 2 }
            ]
          }
        ] as unknown as readonly CandidateClaim[]
    };

    await expect(extractCandidateClaims(futureAdapter, source)).rejects.toThrow(/AI extraction candidates may only contain extracted candidates/);
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

    expect(() => parseExtractionFixture(authorityLeak)).toThrow(/AI extraction candidates may only contain extracted candidates/);
  });

  it('models the future LLM adapter as a candidate-only boundary without provider calls in v0', () => {
    const boundary = describeClaimExtractorBoundary('llm-adapter-boundary');

    expect(boundary.outputContract).toBe('CandidateClaim[]');
    expect(boundary.providerCalls).toBe('forbidden-in-v0');
    expect(boundary.allowedCapabilities).toEqual(['candidate-claim-proposal', 'source-anchor-proposal']);
    expect(boundary.forbiddenAuthorities).toEqual(
      expect.arrayContaining(['verify-truth', 'score-risk', 'attach-anchor', 'reviewer-decision', 'project-evidence'])
    );
  });

  it('rejects future adapter outputs that attempt AI verification, risk scoring, or projection authority', async () => {
    const futureAdapter: ClaimExtractor = {
      id: 'future-llm-boundary-test-double',
      mode: 'llm-adapter-boundary',
      extractClaims: () =>
        [
          {
            id: 'bad-future-claim',
            text: 'LLM attempted to verify this claim.',
            state: 'extracted',
            aiValue: 42,
            riskLevel: 'green',
            reviewerDecision: 'verified',
            projected: true
          }
        ] as unknown as readonly CandidateClaim[]
    };

    await expect(extractCandidateClaims(futureAdapter, source)).rejects.toThrow(/AI extraction candidates may only contain extracted candidates/);
  });

  it('rejects unknown candidate fields instead of silently dropping hidden authority metadata', async () => {
    const futureAdapter: ClaimExtractor = {
      id: 'future-llm-hidden-authority-test-double',
      mode: 'llm-adapter-boundary',
      extractClaims: () =>
        [
          {
            id: 'hidden-authority-claim',
            text: 'LLM hid a review decision in metadata.',
            state: 'extracted',
            metadata: {
              reviewerDecision: 'verified',
              reviewerId: 'ai-reviewer'
            }
          }
        ] as unknown as readonly CandidateClaim[]
    };

    await expect(extractCandidateClaims(futureAdapter, source)).rejects.toThrow(/AI extraction candidates may only contain extracted candidates/);
  });

  it('rejects authority fields hidden inside proposed Source Anchor objects', async () => {
    const futureAdapter: ClaimExtractor = {
      id: 'future-llm-hidden-anchor-authority-test-double',
      mode: 'llm-adapter-boundary',
      extractClaims: () =>
        [
          {
            id: 'hidden-anchor-authority-claim',
            text: 'LLM hid a review decision inside the proposed anchor.',
            state: 'extracted',
            proposedAnchor: {
              kind: 'dataset-row',
              sourceId: source.id,
              dataset: 'civic-budget-2026.csv',
              row: 2,
              reviewerDecision: 'verified'
            }
          }
        ] as unknown as readonly CandidateClaim[]
    };

    await expect(extractCandidateClaims(futureAdapter, source)).rejects.toThrow();
  });

  it('keeps fixture loading deterministic and fixture-first, including intentional wrong claims', () => {
    const parsed = parseExtractionFixture(JSON.stringify(fixture));
    const candidates: readonly CandidateClaim[] = parsed.candidates;

    expect(parsed).toEqual(fixture);
    expect(candidates.map((candidate) => candidate.id)).toEqual(['claim-population-ok', 'claim-budget-wrong']);
    expect(candidates.some((candidate) => candidate.fixtureNotes?.includes('intentional-error:value-mismatch'))).toBe(true);
  });
});
