import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { RiskQueueItem, RiskQueueProps } from './contracts.js';
import { EmptyState, Field, Section, StatusBadge } from './view-helpers.js';

const riskOrder: Record<RiskQueueItem['riskLevel'], number> = { red: 0, yellow: 1, green: 2 };

export function RiskQueue(props: RiskQueueProps): ReactElement {
  const { items, selectedClaimId, emptyLabel = 'No claims are queued for reviewer attention.', onSelectClaim } = props;
  const sortedItems = [...items].sort((left, right) => riskOrder[left.riskLevel] - riskOrder[right.riskLevel]);

  return Section({
    label: 'Reviewer risk queue',
    children: [
      createElement('h2', { key: 'heading' }, 'Reviewer risk queue'),
      createElement(
        'p',
        { key: 'copy' },
        'Claims are ordered by deterministic risk trace. Selection and review authority stay in the host app.'
      ),
      sortedItems.length === 0
        ? createElement(EmptyState, { key: 'empty' }, emptyLabel)
        : createElement(
            'ol',
            { key: 'items' },
            sortedItems.map((item) =>
              createElement(
                'li',
                { key: item.id, 'aria-current': item.id === selectedClaimId ? 'true' : undefined },
                createElement('h3', null, item.claimText),
                createElement(StatusBadge, { label: item.riskLevel, tone: item.riskLevel }),
                Field({ label: 'Lifecycle state', value: item.state }),
                item.sourceLabel ? Field({ label: 'Source', value: item.sourceLabel }) : null,
                item.reviewerLabel ? Field({ label: 'Reviewer', value: item.reviewerLabel }) : null,
                item.id === selectedClaimId ? createElement('p', null, 'Selected by app state') : null,
                createElement(
                  'ul',
                  { 'aria-label': `Rule trace for ${item.id}` },
                  item.ruleTrace.map((trace) =>
                    createElement('li', { key: `${item.id}:${trace.ruleId}` }, `${trace.ruleId} · ${trace.level} · ${trace.message}`)
                  )
                ),
                createElement(
                  'button',
                  { type: 'button', onClick: () => onSelectClaim?.(item.id) },
                  'Review anchored source'
                )
              )
            )
          )
    ]
  });
}
