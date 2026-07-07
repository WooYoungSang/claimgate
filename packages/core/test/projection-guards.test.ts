import { describe, expect, it } from 'vitest';
import {
  attachAnchor,
  createExtractedClaim,
  filterProjectableClaims,
  isProjectableClaim,
  projectClaim,
  ProjectionError,
  sourceAnchorId,
  transitionClaim,
  type Claim,
  type ClaimLifecycleState,
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

const notProjectableError = new ProjectionError(
  'E_NOT_PROJECTABLE',
  'Only reviewer-audited verified or corrected claims with Source Anchor may be projected.'
);

function claim(id: string) {
  return attachAnchor(
    createExtractedClaim({ id, text: `Claim ${id}`, aiValue: 'wrong' }),
    { anchor, sourceValue: 'actual source value', actor: { kind: 'system', id: 'fixture' }, now }
  );
}

function forgedReviewerTransition(
  claimToForge: Claim,
  input: {
    readonly before: ClaimLifecycleState | null;
    readonly after: ClaimLifecycleState;
    readonly anchorId?: string;
    readonly reviewerId?: string;
  }
): Claim['audit'][number] {
  return {
    id: `${claimToForge.id}:forged:${input.before ?? 'none'}:${input.after}`,
    claimId: claimToForge.id,
    action: 'transition',
    before: input.before,
    after: input.after,
    actor: { kind: 'reviewer', id: input.reviewerId ?? reviewer.id },
    timestamp: now(),
    reason: 'Forged terminal audit edge.',
    ...(input.anchorId ? { anchorId: input.anchorId } : {})
  };
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
    expect(() => projectClaim(claim('anchored'))).toThrow(notProjectableError);
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

  it('rejects malformed verified claims without a reviewer terminal audit event', () => {
    const anchored = claim('malformed-verified');
    const malformedVerified = { ...anchored, state: 'verified' as const } satisfies Claim;

    expect(isProjectableClaim(malformedVerified)).toBe(false);
    expect(() => projectClaim(malformedVerified)).toThrow(notProjectableError);
  });

  it('rejects malformed corrected claims without correction records', () => {
    const conflict = transitionClaim(claim('malformed-corrected'), {
      to: 'conflict',
      actor: { kind: 'system', id: 'value-match-rule' },
      now
    });
    const malformedCorrected = {
      ...transitionClaim(conflict, {
        to: 'verified',
        reviewer,
        now
      }),
      state: 'corrected' as const
    } satisfies Claim;

    expect(isProjectableClaim(malformedCorrected)).toBe(false);
    expect(() => projectClaim(malformedCorrected)).toThrow(notProjectableError);
  });

  it('rejects forged reviewer terminal audits whose predecessor is not reviewable', () => {
    const anchored = claim('forged-before-extracted');
    const forgedVerified = {
      ...anchored,
      state: 'verified' as const,
      audit: Object.freeze([
        ...anchored.audit,
        forgedReviewerTransition(anchored, {
          before: 'extracted',
          after: 'verified',
          anchorId: sourceAnchorId(anchor)
        })
      ])
    } satisfies Claim;

    expect(isProjectableClaim(forgedVerified)).toBe(false);
    expect(() => projectClaim(forgedVerified)).toThrow(notProjectableError);
  });

  it('rejects reviewer terminal audits whose anchor does not match the current Source Anchor', () => {
    const needsEvidence = transitionClaim(claim('forged-anchor-mismatch'), {
      to: 'needs-evidence',
      actor: { kind: 'system', id: 'risk-fixture' },
      now
    });
    const forgedVerified = {
      ...needsEvidence,
      state: 'verified' as const,
      audit: Object.freeze([
        ...needsEvidence.audit,
        forgedReviewerTransition(needsEvidence, {
          before: 'needs-evidence',
          after: 'verified',
          anchorId: 'source-text-1:text:0-3'
        })
      ])
    } satisfies Claim;

    expect(isProjectableClaim(forgedVerified)).toBe(false);
    expect(() => projectClaim(forgedVerified)).toThrow(notProjectableError);
  });

  it('rejects corrected claims whose correction reviewer differs from the terminal audit reviewer', () => {
    const corrected = transitionClaim(
      transitionClaim(claim('corrected-reviewer-mismatch'), {
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
    const forgedCorrected = {
      ...corrected,
      correction: { ...corrected.correction!, reviewerId: 'reviewer-2' }
    } satisfies Claim;

    expect(isProjectableClaim(forgedCorrected)).toBe(false);
    expect(() => projectClaim(forgedCorrected)).toThrow(notProjectableError);
  });
});
