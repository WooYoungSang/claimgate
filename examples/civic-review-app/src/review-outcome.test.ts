import { describe, expect, it } from 'vitest';
import { buildEvidenceExport, buildReviewQueue, createReviewRecord } from './demo.js';
import { summarizeReviewOutcome } from './review-outcome.js';

describe('review outcome projection guard', () => {
  const queue = buildReviewQueue('mofa-oda');

  it('resets to an all-pending outcome with no canonical Evidence Pack items', () => {
    const outcome = summarizeReviewOutcome(queue, {}, { itemCount: 0 });

    expect(outcome.decisionCounts).toEqual({
      pending: 3,
      verified: 0,
      corrected: 0,
      rejected: 0
    });
    expect(outcome.reviewedCount).toBe(0);
    expect(outcome.canonicalIncludedCount).toBe(0);
    expect(outcome.isReviewComplete).toBe(false);
    expect(outcome.guardReasons).toEqual(
      queue.map((item) => ({
        fixtureId: item.fixtureId,
        decision: 'pending',
        code: 'review-pending',
        message: 'Reviewer decision is pending; canonical Evidence Pack projection remains blocked.'
      }))
    );
  });

  it('reports partial review counts and separate pending/rejected guard reasons', () => {
    const records = {
      [queue[0]!.fixtureId]: createReviewRecord('corrected', {
        correctedValue: queue[0]!.sourceValue,
        reason: 'Source Anchor 값으로 정정'
      }),
      [queue[1]!.fixtureId]: createReviewRecord('rejected', {
        reason: '추가 근거 확인 전 제외'
      })
    } as const;
    const canonicalPack = buildEvidenceExport('mofa-oda', records);

    const outcome = summarizeReviewOutcome(queue, records, canonicalPack);

    expect(outcome.decisionCounts).toEqual({
      pending: 1,
      verified: 0,
      corrected: 1,
      rejected: 1
    });
    expect(outcome.reviewedCount).toBe(2);
    expect(outcome.canonicalIncludedCount).toBe(1);
    expect(outcome.isReviewComplete).toBe(false);
    expect(outcome.guardReasons).toEqual([
      {
        fixtureId: queue[1]!.fixtureId,
        decision: 'rejected',
        code: 'review-rejected',
        message: 'Reviewer rejected this claim; canonical Evidence Pack projection excludes it.'
      },
      {
        fixtureId: queue[2]!.fixtureId,
        decision: 'pending',
        code: 'review-pending',
        message: 'Reviewer decision is pending; canonical Evidence Pack projection remains blocked.'
      }
    ]);
  });

  it('keeps rejected claims guarded after review completes and trusts the canonical pack count', () => {
    const records = {
      [queue[0]!.fixtureId]: createReviewRecord('corrected', {
        correctedValue: queue[0]!.sourceValue,
        reason: 'Source Anchor 값으로 정정'
      }),
      [queue[1]!.fixtureId]: createReviewRecord('rejected', {
        reason: '근거 불충분으로 제외'
      }),
      [queue[2]!.fixtureId]: createReviewRecord('verified', {
        reason: '공식 용어사전과 일치'
      })
    } as const;
    const canonicalPack = buildEvidenceExport('mofa-oda', records);

    const outcome = summarizeReviewOutcome(queue, records, canonicalPack);

    expect(outcome.decisionCounts).toEqual({
      pending: 0,
      verified: 1,
      corrected: 1,
      rejected: 1
    });
    expect(outcome.reviewedCount).toBe(3);
    expect(outcome.canonicalIncludedCount).toBe(2);
    expect(outcome.isReviewComplete).toBe(true);
    expect(outcome.guardReasons).toEqual([
      expect.objectContaining({ fixtureId: queue[1]!.fixtureId, code: 'review-rejected' })
    ]);
  });

  it('does not infer inclusion from decisions when the canonical pack result says zero', () => {
    const records = {
      [queue[2]!.fixtureId]: createReviewRecord('verified', {
        reason: '공식 용어사전과 일치'
      })
    } as const;

    const outcome = summarizeReviewOutcome(queue, records, { itemCount: 0 });

    expect(outcome.decisionCounts.verified).toBe(1);
    expect(outcome.canonicalIncludedCount).toBe(0);
  });
});
