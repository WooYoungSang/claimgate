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
export type SourceAnchorErrorCode = 'E_INVALID_SOURCE_ANCHOR';

export class SourceAnchorError extends Error {
  readonly code: SourceAnchorErrorCode;

  constructor(message: string) {
    super(message);
    this.name = 'SourceAnchorError';
    this.code = 'E_INVALID_SOURCE_ANCHOR';
  }
}

const sourceAnchorBaseKeys = ['kind', 'sourceId', 'excerpt', 'quote', 'confidence'] as const;
const sourceAnchorAllowedKeys: Readonly<Record<SourceAnchorKind, readonly string[]>> = Object.freeze({
  'excel-cell': Object.freeze([...sourceAnchorBaseKeys, 'sheet', 'cell']),
  'pdf-page': Object.freeze([...sourceAnchorBaseKeys, 'page', 'textRange', 'boundingBox']),
  'dataset-row': Object.freeze([...sourceAnchorBaseKeys, 'dataset', 'row', 'column', 'recordId']),
  'text-span': Object.freeze([...sourceAnchorBaseKeys, 'startOffset', 'endOffset']),
  'web-link': Object.freeze([...sourceAnchorBaseKeys, 'url', 'retrievedAt'])
});

export function sourceAnchorId(anchor: SourceAnchor): string {
  assertSourceAnchor(anchor);
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
  assertSourceAnchor(anchor);

  if (anchor.kind === 'pdf-page') {
    return Object.freeze({
      ...anchor,
      ...(anchor.textRange ? { textRange: Object.freeze({ ...anchor.textRange }) } : {}),
      ...(anchor.boundingBox ? { boundingBox: Object.freeze([...anchor.boundingBox] as [number, number, number, number]) } : {})
    }) as unknown as T;
  }

  return Object.freeze({ ...anchor }) as unknown as T;
}

export function assertSourceAnchor(anchor: SourceAnchor): void {
  if (typeof anchor !== 'object' || anchor === null || Array.isArray(anchor)) {
    throw new SourceAnchorError('Source Anchor must be an object.');
  }

  if (!SOURCE_ANCHOR_KINDS.includes(anchor.kind)) {
    throw new SourceAnchorError('Source Anchor requires a supported kind.');
  }

  assertKnownSourceAnchorKeys(anchor);

  if (!hasNonEmptyText(anchor.sourceId)) {
    throw new SourceAnchorError('Source Anchor requires a non-empty sourceId.');
  }

  switch (anchor.kind) {
    case 'excel-cell':
      requireNonEmptyText(anchor.sheet, 'Source Anchor excel-cell requires a non-empty sheet.');
      requireNonEmptyText(anchor.cell, 'Source Anchor excel-cell requires a non-empty cell.');
      return;
    case 'pdf-page':
      requirePositiveInteger(anchor.page, 'Source Anchor pdf-page requires a positive page number.');
      if (anchor.textRange !== undefined) {
        assertTextRange(anchor.textRange);
      }
      if (anchor.boundingBox !== undefined) {
        assertBoundingBox(anchor.boundingBox);
      }
      return;
    case 'dataset-row':
      requireNonEmptyText(anchor.dataset, 'Source Anchor dataset-row requires a non-empty dataset.');
      requirePositiveInteger(anchor.row, 'Source Anchor dataset-row requires a positive row number.');
      return;
    case 'text-span':
      if (!Number.isInteger(anchor.startOffset) || !Number.isInteger(anchor.endOffset) || anchor.startOffset < 0 || anchor.endOffset <= anchor.startOffset) {
        throw new SourceAnchorError('Source Anchor text-span requires a valid start/end offset range.');
      }
      return;
    case 'web-link':
      requireNonEmptyText(anchor.url, 'Source Anchor web-link requires a non-empty url.');
      return;
  }
}

function assertKnownSourceAnchorKeys(anchor: SourceAnchor): void {
  const allowedKeys = new Set(sourceAnchorAllowedKeys[anchor.kind]);

  for (const key of Object.keys(anchor)) {
    if (!allowedKeys.has(key)) {
      throw new SourceAnchorError(`Source Anchor contains unsupported field: ${key}.`);
    }
  }
}

function assertTextRange(textRange: PdfPageAnchor['textRange']): void {
  if (typeof textRange !== 'object' || textRange === null || Array.isArray(textRange)) {
    throw new SourceAnchorError('Source Anchor pdf-page textRange must be an object.');
  }

  const allowedKeys = new Set(['start', 'end']);
  for (const key of Object.keys(textRange)) {
    if (!allowedKeys.has(key)) {
      throw new SourceAnchorError(`Source Anchor pdf-page textRange contains unsupported field: ${key}.`);
    }
  }

  if (!Number.isInteger(textRange.start) || !Number.isInteger(textRange.end) || textRange.start < 0 || textRange.end <= textRange.start) {
    throw new SourceAnchorError('Source Anchor pdf-page textRange requires a valid start/end range.');
  }
}

function assertBoundingBox(boundingBox: PdfPageAnchor['boundingBox']): void {
  if (!Array.isArray(boundingBox) || boundingBox.length !== 4 || boundingBox.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new SourceAnchorError('Source Anchor pdf-page boundingBox must contain four finite numbers.');
  }
}

export function isValidSourceAnchor(anchor: SourceAnchor | undefined): anchor is SourceAnchor {
  if (anchor === undefined) {
    return false;
  }

  try {
    assertSourceAnchor(anchor);
    return true;
  } catch {
    return false;
  }
}

function compactJoin(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => part !== undefined && part.length > 0).join(':');
}

function encodeAnchorPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function requireNonEmptyText(value: string, message: string): void {
  if (!hasNonEmptyText(value)) {
    throw new SourceAnchorError(message);
  }
}

function requirePositiveInteger(value: number, message: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SourceAnchorError(message);
  }
}

function hasNonEmptyText(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
