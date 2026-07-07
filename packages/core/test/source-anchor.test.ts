import { describe, expect, it } from 'vitest';
import { SOURCE_ANCHOR_KINDS, sourceAnchorId, type SourceAnchor, type Source } from '../src/index.js';

describe('Source Anchor schema', () => {
  it('declares the five canonical source anchor discriminants', () => {
    expect(SOURCE_ANCHOR_KINDS).toEqual(['excel-cell', 'pdf-page', 'dataset-row', 'text-span', 'web-link']);
  });

  it('represents source metadata independently from anchor positions', () => {
    const source: Source = {
      id: 'src-city-budget-2026',
      kind: 'excel',
      title: 'City Budget 2026',
      locator: 'fixtures/city-budget.xlsx',
      retrievedAt: '2026-07-07T00:00:00.000Z',
      checksum: 'sha256:fixture-budget'
    };

    expect(source).toMatchObject({ id: 'src-city-budget-2026', kind: 'excel', title: 'City Budget 2026' });
  });

  it('creates deterministic IDs for each anchor variant', () => {
    const anchors: readonly SourceAnchor[] = [
      { kind: 'excel-cell', sourceId: 'src-xlsx', sheet: 'Budget', cell: 'B12', excerpt: '12345', confidence: 0.99 },
      { kind: 'pdf-page', sourceId: 'src-pdf', page: 4, textRange: { start: 10, end: 25 }, excerpt: 'permit count' },
      { kind: 'dataset-row', sourceId: 'src-csv', dataset: 'permits.csv', row: 7, column: 'count', recordId: 'permit-7' },
      { kind: 'text-span', sourceId: 'src-text', startOffset: 3, endOffset: 14, excerpt: 'source text' },
      { kind: 'web-link', sourceId: 'src-web', url: 'https://example.test/report', retrievedAt: '2026-07-07T00:00:00.000Z' }
    ];

    expect(anchors.map(sourceAnchorId)).toEqual([
      'src-xlsx:excel:Budget!B12',
      'src-pdf:pdf:4:10-25',
      'src-csv:dataset:permits.csv:7:count:permit-7',
      'src-text:text:3-14',
      'src-web:web:https://example.test/report'
    ]);
  });
});
