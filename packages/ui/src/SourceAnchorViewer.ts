import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { SourceAnchorViewerProps } from './contracts.js';
import { EmptyState, Field, Section } from './view-helpers.js';

export function SourceAnchorViewer(props: SourceAnchorViewerProps): ReactElement {
  const { anchor, missingLabel = 'No Source Anchor has been selected by the host app.' } = props;
  if (anchor === null) {
    return Section({ label: 'Source anchor', children: [createElement('h2', { key: 'heading' }, 'Source anchor'), createElement(EmptyState, { key: 'empty' }, missingLabel)] });
  }

  return Section({
    label: 'Source anchor',
    children: [
      createElement('h2', { key: 'heading' }, 'Source anchor'),
      createElement('p', { key: 'copy' }, 'Original-source location used by reviewers for claim decisions.'),
      Field({ label: 'Source', value: anchor.sourceLabel }),
      Field({ label: 'Anchor kind', value: anchor.kind }),
      Field({ label: 'Location', value: anchor.locationLabel }),
      anchor.quote ? createElement('blockquote', { key: 'quote' }, anchor.quote) : null,
      anchor.retrievedAt ? Field({ label: 'Retrieved', value: anchor.retrievedAt }) : null,
      Field({ label: 'Anchor id', value: anchor.id })
    ]
  });
}
