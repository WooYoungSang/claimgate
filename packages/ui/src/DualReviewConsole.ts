import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { DualReviewConsoleProps } from './contracts.js';
import { EmptyState, Field, Section, StatusBadge } from './view-helpers.js';

export function DualReviewConsole(props: DualReviewConsoleProps): ReactElement {
  const { claim, primaryReviewerLabel, secondaryReviewerLabel, disabled = false } = props;

  if (claim === null) {
    return Section({
      label: 'Source-grounded review console',
      children: [createElement('h2', { key: 'heading' }, 'Source-grounded review console'), createElement(EmptyState, { key: 'empty' }, 'Select a queued claim to review source evidence.')]
    });
  }

  return Section({
    label: 'Source-grounded review console',
    children: [
      createElement('h2', { key: 'heading' }, 'Source-grounded review console'),
      createElement('p', { key: 'copy' }, 'Reviewers decide from source anchors and evidence. Candidate extraction is not verification authority.'),
      createElement('article', { key: 'claim' },
        createElement('h3', null, claim.text),
        createElement(StatusBadge, { label: claim.riskLevel, tone: claim.riskLevel }),
        Field({ label: 'Claim state', value: claim.state }),
        Field({ label: 'Primary reviewer', value: primaryReviewerLabel }),
        secondaryReviewerLabel ? Field({ label: 'Second reviewer', value: secondaryReviewerLabel }) : null,
        claim.sourceSummary ? Field({ label: 'Source evidence', value: claim.sourceSummary }) : null,
        claim.reviewerSummary ? Field({ label: 'Reviewer note', value: claim.reviewerSummary }) : null,
        createElement('div', { role: 'group', 'aria-label': 'Reviewer actions' },
          createElement('button', { type: 'button', disabled, onClick: () => props.onVerifyFromSource?.(claim.id) }, 'Mark verified from source'),
          createElement('button', { type: 'button', disabled, onClick: () => props.onRequestCorrection?.(claim.id) }, 'Request correction'),
          createElement('button', { type: 'button', disabled, onClick: () => props.onRejectClaim?.(claim.id) }, 'Reject candidate claim')
        )
      )
    ]
  });
}
