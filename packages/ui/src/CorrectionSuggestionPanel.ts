import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { CorrectionSuggestionPanelProps } from './contracts.js';
import { EmptyState, Field, Section } from './view-helpers.js';

export function CorrectionSuggestionPanel(props: CorrectionSuggestionPanelProps): ReactElement {
  const { suggestion, disabled = false } = props;
  if (suggestion === null) {
    return Section({ label: 'Reviewer correction suggestion', children: [createElement('h2', { key: 'heading' }, 'Reviewer correction suggestion'), createElement(EmptyState, { key: 'empty' }, 'No reviewer correction has been proposed.')] });
  }

  return Section({
    label: 'Reviewer correction suggestion',
    children: [
      createElement('h2', { key: 'heading' }, 'Reviewer correction suggestion'),
      createElement('p', { key: 'copy' }, 'A correction becomes authoritative only when the host app records reviewer approval.'),
      Field({ label: 'Original candidate claim', value: suggestion.originalClaimText }),
      Field({ label: 'Corrected claim', value: suggestion.correctedClaimText }),
      suggestion.sourceValueLabel ? Field({ label: 'Source value', value: suggestion.sourceValueLabel }) : null,
      Field({ label: 'Reason', value: suggestion.reason }),
      suggestion.reviewerLabel ? Field({ label: 'Reviewer', value: suggestion.reviewerLabel }) : null,
      createElement('div', { key: 'actions', role: 'group', 'aria-label': 'Correction actions' },
        createElement('button', { type: 'button', disabled, onClick: () => props.onAcceptCorrection?.(suggestion.claimId) }, 'Accept correction in host app'),
        createElement('button', { type: 'button', disabled, onClick: () => props.onEditCorrection?.(suggestion.claimId) }, 'Edit correction')
      )
    ]
  });
}
