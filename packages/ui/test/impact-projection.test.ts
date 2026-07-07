import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ImpactGraphView, ImpactReport, type ImpactGraphViewModel, type ImpactReportViewModel } from '../src/index.js';

describe('Impact projection UI handoff surfaces', () => {
  it('exports controlled graph and report projection components without hidden authority', () => {
    expect(typeof ImpactGraphView).toBe('function');
    expect(typeof ImpactReport).toBe('function');

    const graph: ImpactGraphViewModel = {
      title: 'Civic impact graph',
      nodes: [
        { id: 'claim:corrected', label: 'Claim', title: 'Corrected parks budget claim', decision: 'corrected' },
        { id: 'source:budget', label: 'Source', title: 'Budget CSV' }
      ],
      edges: [{ id: 'claim:corrected->source:budget', from: 'claim:corrected', to: 'source:budget', type: 'ANCHORED_TO' }],
      excludedCount: 3
    };
    const report: ImpactReportViewModel = {
      title: 'Civic handoff report',
      markdown: '# Civic handoff report\n\n## Finding 1: corrected',
      html: '<h1>Civic handoff report</h1><h2>Finding 1: corrected</h2>',
      evidenceItemCount: 1,
      excludedCount: 3
    };

    const rendered = [ImpactGraphView({ graph }), ImpactReport({ report })].map(serialiseElement).join('\n');

    expect(rendered).toContain('Impact graph projection');
    expect(rendered).toContain('Civic impact graph');
    expect(rendered).toContain('excluded before projection: 3');
    expect(rendered).toContain('Evidence report projection');
    expect(rendered).toContain('Evidence items: 1');
    expect(rendered).not.toMatch(/AI verified|AI-approved|AI scored|auto-promoted/i);
  });
});

function serialiseElement(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(serialiseElement).join(' ');
  if (isReactElement(node)) {
    const props = node.props as { children?: unknown; [key: string]: unknown };
    const propText = Object.entries(props)
      .filter(([key, value]) => key !== 'children' && typeof value !== 'function')
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    return `${String(node.type)} ${propText} ${serialiseElement(props.children)}`.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function isReactElement(node: unknown): node is ReactElement {
  return Boolean(node && typeof node === 'object' && 'type' in node && 'props' in node);
}
