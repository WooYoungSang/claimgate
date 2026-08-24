import type { Reviewer } from './audit.js';
import type { Claim, ClaimValue, CorrectionRecord } from './claim.js';
import { assertProjectableClaim, isProjectableClaim } from './projection-guards.js';
import { freezeSourceAnchor, isValidSourceAnchor, sourceAnchorId, type Source, type SourceAnchor } from './source-anchor.js';

export { SOURCE_ANCHOR_KINDS, sourceAnchorExcerpt, sourceAnchorId, type Source, type SourceAnchor, type SourceAnchorKind, type SourceKind } from './source-anchor.js';
export type { DatasetRowAnchor, ExcelCellAnchor, PdfPageAnchor, TextSpanAnchor, WebLinkAnchor } from './source-anchor.js';

export type EvidenceDecision = 'verified' | 'corrected';
export type EvidenceMetadata = Readonly<Record<string, string | number | boolean>>;
export type EvidencePackLifecycleState = 'generated' | 'generated-with-supersedes';
export type EvidenceMetadataErrorCode = 'E_AUTHORITY_METADATA';
export type EvidencePackProjectionErrorCode = 'E_INVALID_EVIDENCE_PACK_PROJECTION';
export type EvidencePackLifecycleErrorCode = 'E_INVALID_EVIDENCE_PACK_LIFECYCLE';

export class EvidenceMetadataError extends Error {
  readonly code: EvidenceMetadataErrorCode;

  constructor(message: string) {
    super(message);
    this.name = 'EvidenceMetadataError';
    this.code = 'E_AUTHORITY_METADATA';
  }
}

export class EvidencePackProjectionError extends Error {
  readonly code: EvidencePackProjectionErrorCode;

  constructor(message = 'Evidence Pack projector requires verified/corrected reviewer-audited items with matching Source Anchors.') {
    super(message);
    this.name = 'EvidencePackProjectionError';
    this.code = 'E_INVALID_EVIDENCE_PACK_PROJECTION';
  }
}

export class EvidencePackLifecycleError extends Error {
  readonly code: EvidencePackLifecycleErrorCode;

  constructor(message: string) {
    super(message);
    this.name = 'EvidencePackLifecycleError';
    this.code = 'E_INVALID_EVIDENCE_PACK_LIFECYCLE';
  }
}

export interface EvidencePackLifecycle {
  readonly state: EvidencePackLifecycleState;
  readonly supersedes?: string;
  readonly supersedeReason?: string;
  readonly reissueOf?: string;
}

export interface EvidenceItem {
  readonly claimId: string;
  readonly claimText: string;
  readonly reviewerDecision: EvidenceDecision;
  readonly normalizedValue: ClaimValue | undefined;
  readonly sourceAnchorId: string;
  readonly sourceAnchor: SourceAnchor;
  readonly reviewerId: string;
  readonly correctionHistory: readonly CorrectionRecord[];
  readonly auditEventCount: number;
}

export interface EvidencePack {
  readonly id: string;
  readonly title: string;
  readonly generatedAt: string;
  readonly sources: readonly Source[];
  readonly items: readonly EvidenceItem[];
  readonly metadata: EvidenceMetadata;
  readonly lifecycle: EvidencePackLifecycle;
}

export interface CreateEvidencePackInput {
  readonly id: string;
  readonly title: string;
  readonly claims: readonly Claim[];
  readonly sources?: readonly Source[];
  readonly generatedAt?: string;
  readonly metadata?: EvidenceMetadata;
  readonly lifecycle?: EvidencePackLifecycle;
}

export interface SupersedeEvidencePackInput extends CreateEvidencePackInput {
  readonly reason: string;
}

export type ReissueEvidencePackInput = SupersedeEvidencePackInput;

export interface RevokeEvidencePackInput {
  readonly reviewer: Reviewer;
  readonly reason: string;
  readonly revokedAt?: string;
  readonly replacementPackId?: string;
}

export interface EvidencePackRevocation {
  readonly packId: string;
  readonly decision: 'revoked';
  readonly revokedAt: string;
  readonly reviewer: Reviewer;
  readonly reason: string;
  readonly replacementPackId?: string;
}

const defaultNow = () => new Date().toISOString();

export function createEvidencePack(input: CreateEvidencePackInput): EvidencePack {
  const items = input.claims.filter(isProjectableClaim).map(evidenceItemFromClaim).sort(compareByClaimId);
  const referencedSourceIds = new Set(items.map((item) => item.sourceAnchor.sourceId));
  const inputSources = input.sources ?? [];
  const inputSourceIds = new Set(inputSources.map((source) => source.id));
  const missingSourceIds = [...referencedSourceIds].filter((sourceId) => !inputSourceIds.has(sourceId)).sort();

  if (missingSourceIds.length > 0) {
    throw new Error(`Evidence Pack is missing sources referenced by projectable claims: ${missingSourceIds.join(', ')}`);
  }

  const sources = inputSources
    .filter((source) => referencedSourceIds.has(source.id))
    .map((source) => freezeSource(source))
    .sort((left, right) => left.id.localeCompare(right.id));

  return deepFreezeEvidencePack({
    id: input.id,
    title: input.title,
    generatedAt: input.generatedAt ?? defaultNow(),
    sources,
    items,
    metadata: freezeEvidenceMetadata(input.metadata),
    lifecycle: freezeEvidencePackLifecycle(input.lifecycle ?? { state: 'generated' })
  });
}

export function supersedeEvidencePack(previous: EvidencePack, input: SupersedeEvidencePackInput): EvidencePack {
  return createSupersedingEvidencePack(previous, input, false);
}

export function reissueEvidencePack(previous: EvidencePack, input: ReissueEvidencePackInput): EvidencePack {
  return createSupersedingEvidencePack(previous, input, true);
}

export function revokeEvidencePack(pack: EvidencePack, input: RevokeEvidencePackInput): EvidencePackRevocation {
  const reason = requireLifecycleReason(input.reason, 'Revoking Evidence Pack');

  return Object.freeze({
    packId: pack.id,
    decision: 'revoked' as const,
    revokedAt: input.revokedAt ?? defaultNow(),
    reviewer: Object.freeze({ ...input.reviewer }),
    reason,
    ...(input.replacementPackId ? { replacementPackId: input.replacementPackId } : {})
  });
}

function createSupersedingEvidencePack(previous: EvidencePack, input: SupersedeEvidencePackInput, isReissue: boolean): EvidencePack {
  if (previous.id === input.id) {
    throw new EvidencePackLifecycleError('Superseding Evidence Pack must use a new id.');
  }

  const reason = requireLifecycleReason(input.reason, isReissue ? 'Reissuing Evidence Pack' : 'Superseding Evidence Pack');

  return createEvidencePack({
    ...input,
    metadata: freezeEvidenceMetadata({
      ...(input.metadata ?? {}),
      supersedes: previous.id,
      ...(isReissue ? { reissueOf: previous.id } : {}),
      supersedeReason: reason
    }),
    lifecycle: {
      state: 'generated-with-supersedes',
      supersedes: previous.id,
      supersedeReason: reason,
      ...(isReissue ? { reissueOf: previous.id } : {})
    }
  });
}

function requireLifecycleReason(reason: string, operation: string): string {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new EvidencePackLifecycleError(`${operation} requires a non-empty reason.`);
  }
  return trimmed;
}

export function evidenceItemFromClaim(claim: Claim): EvidenceItem {
  assertProjectableClaim(claim);
  const terminalAudit = [...claim.audit].reverse().find((event) => event.action === 'transition' && event.after === claim.state && event.actor.kind === 'reviewer');
  const correctionHistory = claim.state === 'corrected' && claim.correction ? [claim.correction] : [];

  return Object.freeze({
    claimId: claim.id,
    claimText: claim.text,
    reviewerDecision: claim.state,
    normalizedValue: claim.state === 'corrected' ? claim.correction?.correctedValue : claim.sourceValue ?? claim.aiValue,
    sourceAnchorId: sourceAnchorId(claim.anchor),
    sourceAnchor: freezeSourceAnchor(claim.anchor),
    reviewerId: terminalAudit?.actor.kind === 'reviewer' ? terminalAudit.actor.id : claim.correction?.reviewerId ?? 'unknown-reviewer',
    correctionHistory: Object.freeze(correctionHistory.map((correction) => Object.freeze({ ...correction }))),
    auditEventCount: claim.audit.length
  });
}

export function evidencePackToJson(pack: EvidencePack): string {
  return JSON.stringify(pack, null, 2);
}

export function assertEvidencePackProjectable(pack: EvidencePack): asserts pack is EvidencePack {
  if (!Array.isArray(pack.sources) || !Array.isArray(pack.items)) {
    throw new EvidencePackProjectionError();
  }

  const sourceIds = new Set(pack.sources.map((source) => source.id));

  for (const item of pack.items) {
    if (item.reviewerDecision !== 'verified' && item.reviewerDecision !== 'corrected') {
      throw new EvidencePackProjectionError();
    }

    if (typeof item.reviewerId !== 'string' || item.reviewerId.trim().length === 0 || item.reviewerId === 'unknown-reviewer') {
      throw new EvidencePackProjectionError();
    }

    if (!Number.isInteger(item.auditEventCount) || item.auditEventCount <= 0) {
      throw new EvidencePackProjectionError();
    }

    if (!isValidSourceAnchor(item.sourceAnchor) || item.sourceAnchorId !== sourceAnchorId(item.sourceAnchor)) {
      throw new EvidencePackProjectionError();
    }

    if (!sourceIds.has(item.sourceAnchor.sourceId)) {
      throw new EvidencePackProjectionError();
    }

    if (item.reviewerDecision === 'corrected' && item.correctionHistory.length === 0) {
      throw new EvidencePackProjectionError();
    }
  }
}

function compareByClaimId(left: EvidenceItem, right: EvidenceItem): number {
  return left.claimId.localeCompare(right.claimId);
}

function freezeSource(source: Source): Source {
  return Object.freeze({ ...source, ...(source.metadata ? { metadata: Object.freeze({ ...source.metadata }) } : {}) });
}

const authorityMetadataKeys = new Set([
  'anchor',
  'sourcevalue',
  'risklevel',
  'riskscore',
  'risktrace',
  'reviewerdecision',
  'verified',
  'corrected',
  'projected',
  'projection',
  'evidencepack',
  'report',
  'graph'
]);

function freezeEvidenceMetadata(metadata: EvidenceMetadata | undefined): EvidenceMetadata {
  const normalized = { ...(metadata ?? {}) };

  for (const [key, value] of Object.entries(normalized)) {
    const normalizedKey = key.toLowerCase();
    if (authorityMetadataKeys.has(normalizedKey)) {
      throw new EvidenceMetadataError(
        'Evidence Pack metadata may record provenance only; verification, risk, review, and projection authority fields are forbidden.'
      );
    }
    if (normalizedKey === 'aiauthority' && value !== 'candidate-only') {
      throw new EvidenceMetadataError('Evidence Pack metadata aiAuthority must be candidate-only.');
    }
  }

  return Object.freeze(normalized);
}

function freezeEvidencePackLifecycle(lifecycle: EvidencePackLifecycle): EvidencePackLifecycle {
  if (lifecycle.state === 'generated-with-supersedes') {
    if (lifecycle.supersedes === undefined || lifecycle.supersedes.trim().length === 0) {
      throw new EvidencePackLifecycleError('Superseding Evidence Pack lifecycle requires supersedes.');
    }
    if (lifecycle.supersedeReason === undefined || lifecycle.supersedeReason.trim().length === 0) {
      throw new EvidencePackLifecycleError('Superseding Evidence Pack lifecycle requires a non-empty reason.');
    }
  }

  if (lifecycle.state === 'generated' && (lifecycle.supersedes !== undefined || lifecycle.supersedeReason !== undefined || lifecycle.reissueOf !== undefined)) {
    throw new EvidencePackLifecycleError('Base generated Evidence Pack lifecycle cannot carry supersede or reissue fields.');
  }

  return Object.freeze({ ...lifecycle });
}

function deepFreezeEvidencePack(pack: EvidencePack): EvidencePack {
  return Object.freeze({
    ...pack,
    sources: Object.freeze([...pack.sources]),
    items: Object.freeze([...pack.items]),
    metadata: freezeEvidenceMetadata(pack.metadata),
    lifecycle: freezeEvidencePackLifecycle(pack.lifecycle)
  });
}
