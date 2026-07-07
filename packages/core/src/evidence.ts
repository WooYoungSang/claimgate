export type SourceAnchorKind = 'excel-cell' | 'pdf-page' | 'csv-row' | 'text-span' | 'web-link';

interface SourceAnchorBase {
  readonly kind: SourceAnchorKind;
  readonly sourceId: string;
  readonly quote?: string;
}

export interface ExcelCellAnchor extends SourceAnchorBase {
  readonly kind: 'excel-cell';
  readonly sheet: string;
  readonly cell: string;
}

export interface PdfPageAnchor extends SourceAnchorBase {
  readonly kind: 'pdf-page';
  readonly page: number;
  readonly boundingBox?: readonly [number, number, number, number];
}

export interface CsvRowAnchor extends SourceAnchorBase {
  readonly kind: 'csv-row';
  readonly row: number;
  readonly column?: string;
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

export type SourceAnchor = ExcelCellAnchor | PdfPageAnchor | CsvRowAnchor | TextSpanAnchor | WebLinkAnchor;

export interface SourceReference {
  readonly id: string;
  readonly title: string;
  readonly uri?: string;
  readonly retrievedAt?: string;
}

export function sourceAnchorId(anchor: SourceAnchor): string {
  switch (anchor.kind) {
    case 'excel-cell':
      return `${anchor.sourceId}:excel:${anchor.sheet}!${anchor.cell}`;
    case 'pdf-page':
      return `${anchor.sourceId}:pdf:${anchor.page}`;
    case 'csv-row':
      return `${anchor.sourceId}:csv:${anchor.row}${anchor.column ? `:${anchor.column}` : ''}`;
    case 'text-span':
      return `${anchor.sourceId}:text:${anchor.startOffset}-${anchor.endOffset}`;
    case 'web-link':
      return `${anchor.sourceId}:web:${anchor.url}`;
  }
}
