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

  it('does not collide dataset row IDs when column and recordId contain separators', () => {
    const withColonInColumn: SourceAnchor = {
      kind: 'dataset-row',
      sourceId: 'src-csv',
      dataset: 'permits.csv',
      row: 7,
      column: 'count:permit',
      recordId: '7'
    };
    const withColonInRecordId: SourceAnchor = {
      kind: 'dataset-row',
      sourceId: 'src-csv',
      dataset: 'permits.csv',
      row: 7,
      column: 'count',
      recordId: 'permit:7'
    };

    expect(sourceAnchorId(withColonInColumn)).not.toBe(sourceAnchorId(withColonInRecordId));
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
      'src-xlsx:excel:sheet=Budget:cell=B12',
      'src-pdf:pdf:page=4:range=10-25',
      'src-csv:dataset:name=permits.csv:row=7:column=count:recordId=permit-7',
      'src-text:text:start=3:end=14',
      'src-web:web:url=https%3A%2F%2Fexample.test%2Freport'
    ]);
  });
});
