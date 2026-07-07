export const SOURCE_ANCHOR_KINDS = ['excel-cell', 'pdf-page', 'dataset-row', 'text-span', 'web-link'] as const;

export type SourceAnchorKind = (typeof SOURCE_ANCHOR_KINDS)[number];
export type SourceKind = 'excel' | 'pdf' | 'csv' | 'text' | 'web' | 'dataset';

export interface Source {
  readonly id: string;
  readonly kind: SourceKind;
  readonly title: string;
  readonly locator?: string;
  readonly retrievedAt?: string;
  readonly checksum?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

interface SourceAnchorBase {
  readonly kind: SourceAnchorKind;
  readonly sourceId: string;
  readonly excerpt?: string;
  readonly quote?: string;
  readonly confidence?: number;
}

export interface ExcelCellAnchor extends SourceAnchorBase {
  readonly kind: 'excel-cell';
  readonly sheet: string;
  readonly cell: string;
}

export interface PdfPageAnchor extends SourceAnchorBase {
  readonly kind: 'pdf-page';
  readonly page: number;
  readonly textRange?: Readonly<{ start: number; end: number }>;
  readonly boundingBox?: readonly [number, number, number, number];
}

export interface DatasetRowAnchor extends SourceAnchorBase {
  readonly kind: 'dataset-row';
  readonly dataset: string;
  readonly row: number;
  readonly column?: string;
  readonly recordId?: string;
}

export interface TextSpanAnchor extends SourceAnchorBase {
  readonly kind: 'text-span';
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface WebLinkAnchor extends SourceAnchorBase {
  readonly kind: 'web-link';
  readonly url: string;
  readonly retrievedAt?: string;
}

export type SourceAnchor = ExcelCellAnchor | PdfPageAnchor | DatasetRowAnchor | TextSpanAnchor | WebLinkAnchor;

export function sourceAnchorId(anchor: SourceAnchor): string {
  switch (anchor.kind) {
    case 'excel-cell':
      return `${anchor.sourceId}:excel:${anchor.sheet}!${anchor.cell}`;
    case 'pdf-page':
      return anchor.textRange
        ? `${anchor.sourceId}:pdf:${anchor.page}:${anchor.textRange.start}-${anchor.textRange.end}`
        : `${anchor.sourceId}:pdf:${anchor.page}`;
    case 'dataset-row':
      return compactJoin([anchor.sourceId, 'dataset', anchor.dataset, String(anchor.row), anchor.column, anchor.recordId]);
    case 'text-span':
      return `${anchor.sourceId}:text:${anchor.startOffset}-${anchor.endOffset}`;
    case 'web-link':
      return `${anchor.sourceId}:web:${anchor.url}`;
  }
}

export function sourceAnchorExcerpt(anchor: SourceAnchor): string | undefined {
  return anchor.excerpt ?? anchor.quote;
}

function compactJoin(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => part !== undefined && part.length > 0).join(':');
}
