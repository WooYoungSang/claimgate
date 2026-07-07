import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { EvidencePackPreviewProps } from './contracts.js';
import { claimIdForEvidenceItem, claimTextForEvidenceItem } from './contracts.js';
import { EmptyState, Field, Section, StatusBadge } from './view-helpers.js';

export function EvidencePackPreview(props: EvidencePackPreviewProps): ReactElement {
  const { pack, onSelectClaim } = props;

  return Section({
    label: 'Evidence Pack preview',
    children: [
      createElement('h2', { key: 'heading' }, 'Evidence Pack preview'),
      createElement('p', { key: 'copy' }, 'Projected from reviewer-approved claims only. Non-projectable states stay excluded.'),
      Field({ label: 'Pack title', value: pack.title }),
      pack.items.length === 0
        ? createElement(EmptyState, { key: 'empty' }, 'No verified or corrected claims are ready for the evidence pack.')
        : createElement(
            'ol',
            { key: 'items' },
            pack.items.map((item) => {
              const claimId = claimIdForEvidenceItem(item);
              return createElement(
                'li',
                { key: claimId },
                createElement('h3', null, claimTextForEvidenceItem(item)),
                createElement(StatusBadge, { label: item.state, tone: 'green' }),
                item.valueLabel ? Field({ label: 'Projected value', value: item.valueLabel }) : null,
                Field({ label: 'Source', value: item.sourceLabel }),
                createElement('button', { type: 'button', onClick: () => onSelectClaim?.(claimId) }, 'Inspect evidence claim')
              );
            })
          ),
      pack.excludedCount !== undefined ? Field({ label: 'Excluded non-projectable claims', value: String(pack.excludedCount) }) : null
    ]
  });
}
