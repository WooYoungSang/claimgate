import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { FakeWorkReductionStatsProps } from './contracts.js';
import { Field, Section } from './view-helpers.js';

export function FakeWorkReductionStats(props: FakeWorkReductionStatsProps): ReactElement {
  const { stats } = props;
  const avoidedManualReviewCount = Math.max(0, stats.extractedClaimCount - stats.queuedForReviewCount - stats.sampledGreenCount);

  return Section({
    label: 'Fake-work reduction estimate',
    children: [
      createElement('h2', { key: 'heading' }, 'Fake-work reduction estimate'),
      createElement('p', { key: 'copy' }, 'Operational estimate after green sampling cost; it is not a truth or quality score.'),
      Field({ label: 'Extracted candidate claims', value: String(stats.extractedClaimCount) }),
      Field({ label: 'Queued for reviewer risk review', value: String(stats.queuedForReviewCount) }),
      Field({ label: 'Sampled green claims', value: String(stats.sampledGreenCount) }),
      Field({ label: 'Projected reviewer-approved claims', value: String(stats.projectedClaimCount) }),
      Field({ label: 'Avoided manual checks after sampling', value: String(avoidedManualReviewCount) }),
      stats.estimatedMinutesSaved !== undefined ? Field({ label: 'Estimated minutes saved', value: String(stats.estimatedMinutesSaved) }) : null
    ]
  });
}
