import type { EvidenceExport, ReviewRecord, ReviewRecordMap, ReviewQueueItem } from './demo.js';

export interface ReviewDecisionCounts {
  readonly pending: number;
  readonly verified: number;
  readonly corrected: number;
  readonly rejected: number;
}

export type ProjectionGuardReason = Readonly<
  | {
      fixtureId: string;
      decision: 'pending';
      code: 'review-pending';
      message: 'Reviewer decision is pending; canonical Evidence Pack projection remains blocked.';
    }
  | {
      fixtureId: string;
      decision: 'rejected';
      code: 'review-rejected';
      message: 'Reviewer rejected this claim; canonical Evidence Pack projection excludes it.';
    }
>;

export interface ReviewOutcomeSummary {
  readonly totalCount: number;
  readonly reviewedCount: number;
  readonly decisionCounts: ReviewDecisionCounts;
  readonly canonicalIncludedCount: number;
  readonly isReviewComplete: boolean;
  readonly guardReasons: readonly ProjectionGuardReason[];
}

type ReviewQueueIdentity = Pick<ReviewQueueItem, 'fixtureId'>;
type CanonicalEvidencePackResult = Pick<EvidenceExport, 'itemCount'>;

/**
 * Summarizes host-app audit records while leaving projection eligibility to
 * the canonical Evidence Pack result supplied by `buildEvidenceExport`.
 */
export function summarizeReviewOutcome(
  queue: readonly ReviewQueueIdentity[],
  records: ReviewRecordMap,
  canonicalEvidencePack: CanonicalEvidencePackResult
): ReviewOutcomeSummary {
  const counts = {
    pending: 0,
    verified: 0,
    corrected: 0,
    rejected: 0
  };
  const guardReasons: ProjectionGuardReason[] = [];

  for (const item of queue) {
    const record: ReviewRecord | undefined = Object.hasOwn(records, item.fixtureId)
      ? records[item.fixtureId]
      : undefined;

    if (!record) {
      counts.pending += 1;
      guardReasons.push(Object.freeze({
        fixtureId: item.fixtureId,
        decision: 'pending',
        code: 'review-pending',
        message: 'Reviewer decision is pending; canonical Evidence Pack projection remains blocked.'
      }));
      continue;
    }

    counts[record.decision] += 1;
    if (record.decision === 'rejected') {
      guardReasons.push(Object.freeze({
        fixtureId: item.fixtureId,
        decision: record.decision,
        code: 'review-rejected',
        message: 'Reviewer rejected this claim; canonical Evidence Pack projection excludes it.'
      }));
    }
  }

  return Object.freeze({
    totalCount: queue.length,
    reviewedCount: queue.length - counts.pending,
    decisionCounts: Object.freeze(counts),
    canonicalIncludedCount: canonicalEvidencePack.itemCount,
    isReviewComplete: counts.pending === 0,
    guardReasons: Object.freeze(guardReasons)
  });
}
