import type { ClaimGateInvariant } from '@claimgate/core';
import { createElement, type ReactElement } from 'react';

export interface ReviewShellProps {
  readonly title: string;
  readonly invariants: readonly ClaimGateInvariant[];
  readonly onSelectInvariant?: (invariant: ClaimGateInvariant) => void;
}

export function ReviewShell(props: ReviewShellProps): ReactElement {
  const { title, invariants, onSelectInvariant } = props;
  return createElement(
    'section',
    { 'aria-label': title },
    createElement('h1', null, title),
    createElement('p', null, 'Controlled ClaimGate scaffold UI. Review authority stays outside the component.'),
    createElement(
      'ul',
      null,
      invariants.map((invariant) =>
        createElement(
          'li',
          { key: invariant },
          createElement(
            'button',
            { type: 'button', onClick: () => onSelectInvariant?.(invariant) },
            invariant
          )
        )
      )
    )
  );
}
