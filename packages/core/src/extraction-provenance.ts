import type { EvidenceMetadata } from './evidence.js';

export interface ExtractionProvenance {
  readonly provider: string;
  readonly model: string;
  readonly adapterId: string;
  readonly promptVersion: string;
  readonly ragDocumentIds: readonly string[];
  readonly ragRetrievalMode: string;
  readonly tuningArtifactStatus: string;
}

export function buildExtractionProvenanceMetadata(input: ExtractionProvenance): EvidenceMetadata {
  const provider = requireIdentifier(input.provider, 'provider');
  const model = requireNonEmpty(input.model, 'model');
  const adapterId = requireIdentifier(input.adapterId, 'adapterId');
  const promptVersion = requireNonEmpty(input.promptVersion, 'promptVersion');
  const ragDocumentIds = normalizeRagDocumentIds(input.ragDocumentIds);
  const ragRetrievalMode = requireNonEmpty(input.ragRetrievalMode, 'ragRetrievalMode');
  const tuningArtifactStatus = requireNonEmpty(input.tuningArtifactStatus, 'tuningArtifactStatus');

  return Object.freeze({
    provider,
    model,
    adapterId,
    promptVersion,
    ragDocumentIds: ragDocumentIds.join(','),
    ragRetrievalMode,
    tuningArtifactStatus,
    aiAuthority: 'candidate-only'
  });
}

export function extractionProvenanceActorId(input: Pick<ExtractionProvenance, 'provider' | 'model'>): string {
  return `extractor:${requireIdentifier(input.provider, 'provider')}:${requireNonEmpty(input.model, 'model')}`;
}

export function extractionProvenanceAuditReason(input: ExtractionProvenance): string {
  const metadata = buildExtractionProvenanceMetadata(input);
  return `Candidate claim extracted by ${metadata.provider}/${metadata.model} via ${metadata.adapterId}; prompt=${metadata.promptVersion}; rag=${metadata.ragDocumentIds}; aiAuthority=candidate-only.`;
}

function normalizeRagDocumentIds(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error('Extraction provenance ragDocumentIds must be an array.');
  }

  const ids = value.map((item) => requireIdentifier(item, 'ragDocumentIds'));
  return Object.freeze([...ids]);
}

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Extraction provenance ${field} must be non-empty.`);
  }
  return value.trim();
}

function requireIdentifier(value: string, field: string): string {
  const trimmed = requireNonEmpty(value, field);
  if (/\s/.test(trimmed)) {
    throw new Error(`Extraction provenance ${field} must not contain whitespace.`);
  }
  return trimmed;
}
