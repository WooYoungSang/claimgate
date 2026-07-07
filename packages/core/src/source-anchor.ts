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
  const sourceId = encodeAnchorPart(anchor.sourceId);

  switch (anchor.kind) {
    case 'excel-cell':
      return `${sourceId}:excel:sheet=${encodeAnchorPart(anchor.sheet)}:cell=${encodeAnchorPart(anchor.cell)}`;
    case 'pdf-page':
      return anchor.textRange
        ? `${sourceId}:pdf:page=${anchor.page}:range=${anchor.textRange.start}-${anchor.textRange.end}`
        : `${sourceId}:pdf:page=${anchor.page}`;
    case 'dataset-row':
      return compactJoin([
        sourceId,
        'dataset',
        `name=${encodeAnchorPart(anchor.dataset)}`,
        `row=${anchor.row}`,
        anchor.column === undefined ? undefined : `column=${encodeAnchorPart(anchor.column)}`,
        anchor.recordId === undefined ? undefined : `recordId=${encodeAnchorPart(anchor.recordId)}`
      ]);
    case 'text-span':
      return `${sourceId}:text:start=${anchor.startOffset}:end=${anchor.endOffset}`;
    case 'web-link':
      return `${sourceId}:web:url=${encodeAnchorPart(anchor.url)}`;
  }
}

export function sourceAnchorExcerpt(anchor: SourceAnchor): string | undefined {
  return anchor.excerpt ?? anchor.quote;
}

export function freezeSourceAnchor<T extends SourceAnchor>(anchor: T): T {
  if (anchor.kind === 'pdf-page') {
    return Object.freeze({
      ...anchor,
      ...(anchor.textRange ? { textRange: Object.freeze({ ...anchor.textRange }) } : {}),
      ...(anchor.boundingBox ? { boundingBox: Object.freeze([...anchor.boundingBox] as [number, number, number, number]) } : {})
    }) as unknown as T;
  }

  return Object.freeze({ ...anchor }) as unknown as T;
}

function compactJoin(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => part !== undefined && part.length > 0).join(':');
}

function encodeAnchorPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
