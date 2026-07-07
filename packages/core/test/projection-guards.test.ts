import { describe, expect, it } from 'vitest';
import {
  attachAnchor,
  createExtractedClaim,
  filterProjectableClaims,
  isProjectableClaim,
  projectClaim,
  ProjectionError,
  transitionClaim,
  type Reviewer
} from '../src/index.js';

const reviewer: Reviewer = { id: 'reviewer-1' };
const now = () => '2026-07-07T00:00:00.000Z';
const anchor = {
  kind: 'text-span',
  sourceId: 'source-text-1',
  startOffset: 4,
  endOffset: 18,
  quote: 'actual source value'
} as const;

function claim(id: string) {
  return attachAnchor(
    createExtractedClaim({ id, text: `Claim ${id}`, aiValue: 'wrong' }),
    { anchor, sourceValue: 'actual source value', actor: { kind: 'system', id: 'fixture' }, now }
  );
}

describe('projection eligibility guards', () => {
  it('only allows verified and corrected claims to project', () => {
    const anchored = claim('anchored');
    const needsEvidence = transitionClaim(claim('needs-evidence'), {
      to: 'needs-evidence',
      actor: { kind: 'system', id: 'risk-fixture' },
      now
    });
    const rejected = transitionClaim(needsEvidence, {
      to: 'rejected',
      reviewer,
      reason: 'Reviewer rejected unsupported claim.',
      now
    });
    const verified = transitionClaim(
      transitionClaim(claim('verified'), {
        to: 'needs-evidence',
        actor: { kind: 'system', id: 'risk-fixture' },
        now
      }),
      { to: 'verified', reviewer, now }
    );
    const corrected = transitionClaim(
      transitionClaim(claim('corrected'), {
        to: 'conflict',
        actor: { kind: 'system', id: 'value-match-rule' },
        now
      }),
      {
        to: 'corrected',
        reviewer,
        correction: { correctedValue: 'actual source value', reason: 'Source wins.' },
        now
      }
    );

    expect(isProjectableClaim(anchored)).toBe(false);
    expect(isProjectableClaim(rejected)).toBe(false);
    expect(filterProjectableClaims([anchored, needsEvidence, rejected, verified, corrected]).map((item) => item.id)).toEqual([
      'verified',
      'corrected'
    ]);
  });

  it('throws when a non-verified/corrected state is projected', () => {
    expect(() => projectClaim(claim('anchored'))).toThrow(
      new ProjectionError('E_NOT_PROJECTABLE', 'Only verified or corrected claims may be projected.')
    );
  });

  it('projects corrected claims with corrected value while retaining audit trace', () => {
    const corrected = transitionClaim(
      transitionClaim(claim('corrected'), {
        to: 'conflict',
        actor: { kind: 'system', id: 'value-match-rule' },
        now
      }),
      {
        to: 'corrected',
        reviewer,
        correction: { correctedValue: 'actual source value', reason: 'Source wins.' },
        now
      }
    );

    expect(projectClaim(corrected)).toMatchObject({
      id: 'corrected',
      state: 'corrected',
      value: 'actual source value',
      sourceAnchor: anchor,
      auditEventCount: corrected.audit.length
    });
  });
});
