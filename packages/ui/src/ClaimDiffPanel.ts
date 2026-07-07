import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { ClaimDiffPanelProps, ClaimDiffStatus } from './contracts.js';
import { EmptyState, Field, Section, StatusBadge } from './view-helpers.js';

export function ClaimDiffPanel(props: ClaimDiffPanelProps): ReactElement {
  const { diff } = props;
  if (diff === null) {
    return Section({ label: 'Claim/source difference', children: [createElement('h2', { key: 'heading' }, 'Claim/source difference'), createElement(EmptyState, { key: 'empty' }, 'Select a claim to compare candidate and source values.')] });
  }

  return Section({
    label: 'Claim/source difference',
    children: [
      createElement('h2', { key: 'heading' }, 'Claim/source difference'),
      createElement('p', { key: 'copy' }, 'Differences are review cues only; reviewer action remains external.'),
      createElement(StatusBadge, { key: 'status', label: diff.status, tone: toneForDiffStatus(diff.status) }),
      Field({ label: 'Claim', value: diff.claimText }),
      Field({ label: 'Candidate value', value: diff.aiValueLabel ?? '—' }),
      Field({ label: 'Source value', value: diff.sourceValueLabel ?? '—' }),
      diff.reviewerValueLabel ? Field({ label: 'Reviewer value', value: diff.reviewerValueLabel }) : null
    ]
  });
}

function toneForDiffStatus(status: ClaimDiffStatus): 'red' | 'yellow' | 'green' | 'neutral' {
  switch (status) {
    case 'mismatch':
      return 'red';
    case 'needs-review':
      return 'yellow';
    case 'aggregate-only':
      return 'neutral';
    case 'match':
      return 'green';
  }
}
