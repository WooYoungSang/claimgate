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
      message: '검토자 판정 대기 중이므로 정식 근거 묶음 투영이 차단됩니다.';
    }
  | {
      fixtureId: string;
      decision: 'rejected';
      code: 'review-rejected';
      message: '검토자가 이 주장을 기각하여 정식 근거 묶음 투영에서 제외됩니다.';
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
        message: '검토자 판정 대기 중이므로 정식 근거 묶음 투영이 차단됩니다.'
      }));
      continue;
    }

    counts[record.decision] += 1;
    if (record.decision === 'rejected') {
      guardReasons.push(Object.freeze({
        fixtureId: item.fixtureId,
        decision: record.decision,
        code: 'review-rejected',
        message: '검토자가 이 주장을 기각하여 정식 근거 묶음 투영에서 제외됩니다.'
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
