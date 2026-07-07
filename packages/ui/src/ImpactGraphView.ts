import { createElement } from 'react';
import type { ImpactGraphEdgeViewModel, ImpactGraphViewProps } from './contracts.js';
import { EmptyState, Field, Section, StatusBadge } from './view-helpers.js';

const edgeLabels: Readonly<Record<string, string>> = {
  CONTAINS_CLAIM: 'contains claim',
  ANCHORED_TO: 'anchored to source'
};

export function ImpactGraphView(props: ImpactGraphViewProps) {
  const { graph, onSelectNode, onSelectEdge } = props;
  const nodes = [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const edges = [...graph.edges].sort(compareEdge);

  return Section({
    label: 'Impact graph projection',
    children: [
      createElement('h2', { key: 'heading' }, 'Impact graph projection'),
      createElement(
        'p',
        { key: 'copy' },
        'Read-only projection from an Evidence Pack. It visualizes reviewer-approved evidence only and never promotes AI output.'
      ),
      Field({ label: 'Title', value: graph.title }),
      Field({ label: 'Nodes', value: nodes.length }),
      Field({ label: 'Edges', value: edges.length }),
      Field({ label: 'Excluded before projection', value: `excluded before projection: ${graph.excludedCount ?? 0}` }),
      nodes.length === 0
        ? createElement(EmptyState, { key: 'empty-nodes' }, 'No verified or corrected claims are available for graph projection.')
        : createElement(
            'ul',
            { key: 'nodes', 'aria-label': 'Projected graph nodes' },
            nodes.map((node) =>
              createElement(
                'li',
                { key: node.id },
                createElement('button', { type: 'button', onClick: () => onSelectNode?.(node.id) }, node.title),
                ' ',
                StatusBadge({ label: node.label, tone: node.label === 'Claim' ? 'green' : 'neutral' }),
                node.decision ? ` decision=${node.decision}` : ''
              )
            )
          ),
      edges.length === 0
        ? createElement(EmptyState, { key: 'empty-edges' }, 'No graph edges are available for projection.')
        : createElement(
            'ul',
            { key: 'edges', 'aria-label': 'Projected graph edges' },
            edges.map((edge) =>
              createElement(
                'li',
                { key: edge.id },
                createElement('button', { type: 'button', onClick: () => onSelectEdge?.(edge.id) }, edgeLabel(edge)),
                ` ${edge.from} → ${edge.to}`
              )
            )
          )
    ]
  });
}

function edgeLabel(edge: ImpactGraphEdgeViewModel): string {
  return edgeLabels[edge.type] ?? edge.type;
}

function compareEdge(left: ImpactGraphEdgeViewModel, right: ImpactGraphEdgeViewModel): number {
  return left.type.localeCompare(right.type) || left.id.localeCompare(right.id);
}
