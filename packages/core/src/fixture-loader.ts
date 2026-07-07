import { normalizeCandidateClaim, sortCandidateClaims, type CandidateClaim, type ClaimExtractor, type ClaimExtractorSource } from './extraction.js';
import type { Source } from './source-anchor.js';

export interface ExtractionFixture {
  readonly id: string;
  readonly source: Source;
  readonly candidates: readonly CandidateClaim[];
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export class FixtureClaimExtractor implements ClaimExtractor {
  readonly id: string;
  readonly mode = 'fixture' as const;
  private readonly fixturesBySourceId: ReadonlyMap<string, ExtractionFixture>;

  constructor(fixtures: readonly ExtractionFixture[], options: { readonly id?: string } = {}) {
    this.id = options.id ?? 'fixture-claim-extractor';
    this.fixturesBySourceId = new Map(fixtures.map((fixture) => [fixture.source.id, freezeExtractionFixture(fixture)]));
  }

  extractClaims(source: ClaimExtractorSource): readonly CandidateClaim[] {
    const fixture = this.fixturesBySourceId.get(source.id);
    return fixture ? sortCandidateClaims(fixture.candidates) : Object.freeze([]);
  }

  listSources(): readonly Source[] {
    return Object.freeze([...this.fixturesBySourceId.values()].map((fixture) => fixture.source));
  }
}

export function parseExtractionFixture(payload: string | unknown): ExtractionFixture {
  const raw: unknown = typeof payload === 'string' ? JSON.parse(payload) : payload;

  if (!isRecord(raw)) {
    throw new TypeError('Extraction fixture must be an object.');
  }

  const id = requireString(raw.id, 'fixture.id');
  const source = normalizeSource(raw.source);
  const candidates = normalizeCandidates(raw.candidates);
  const metadata = raw.metadata === undefined ? undefined : normalizeMetadata(raw.metadata);

  return freezeExtractionFixture({
    id,
    source,
    candidates,
    ...(metadata ? { metadata } : {})
  });
}

export function parseExtractionFixtures(payloads: readonly (string | unknown)[]): readonly ExtractionFixture[] {
  return Object.freeze(payloads.map(parseExtractionFixture));
}

export function freezeExtractionFixture(fixture: ExtractionFixture): ExtractionFixture {
  return Object.freeze({
    ...fixture,
    source: Object.freeze({
      ...fixture.source,
      ...(fixture.source.metadata ? { metadata: Object.freeze({ ...fixture.source.metadata }) } : {})
    }),
    candidates: Object.freeze(fixture.candidates.map(normalizeCandidateClaim)),
    ...(fixture.metadata ? { metadata: Object.freeze({ ...fixture.metadata }) } : {})
  });
}

function normalizeCandidates(value: unknown): readonly CandidateClaim[] {
  if (!Array.isArray(value)) {
    throw new TypeError('fixture.candidates must be an array.');
  }

  return Object.freeze(value.map(normalizeCandidateClaim));
}

function normalizeSource(value: unknown): Source {
  if (!isRecord(value)) {
    throw new TypeError('fixture.source must be an object.');
  }

  return Object.freeze({
    id: requireString(value.id, 'fixture.source.id'),
    kind: normalizeSourceKind(value.kind),
    title: requireString(value.title, 'fixture.source.title'),
    ...(typeof value.locator === 'string' ? { locator: value.locator } : {}),
    ...(typeof value.retrievedAt === 'string' ? { retrievedAt: value.retrievedAt } : {}),
    ...(typeof value.checksum === 'string' ? { checksum: value.checksum } : {}),
    ...(value.metadata ? { metadata: normalizeMetadata(value.metadata) } : {})
  });
}

function normalizeSourceKind(value: unknown): Source['kind'] {
  const kinds = new Set<Source['kind']>(['excel', 'pdf', 'csv', 'text', 'web', 'dataset']);
  if (typeof value === 'string' && kinds.has(value as Source['kind'])) {
    return value as Source['kind'];
  }

  throw new TypeError('fixture.source.kind must be a supported SourceKind.');
}

function normalizeMetadata(value: unknown): Readonly<Record<string, string | number | boolean>> {
  if (!isRecord(value)) {
    throw new TypeError('metadata must be an object.');
  }

  const metadata: Record<string, string | number | boolean> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (!['string', 'number', 'boolean'].includes(typeof entry)) {
      throw new TypeError('metadata values must be string, number, or boolean.');
    }

    metadata[key] = entry as string | number | boolean;
  }

  return Object.freeze(metadata);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
