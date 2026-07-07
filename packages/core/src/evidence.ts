import type { Claim, ClaimValue, CorrectionRecord } from './claim.js';
import { assertProjectableClaim, isProjectableClaim } from './projection-guards.js';
import { freezeSourceAnchor, sourceAnchorId, type Source, type SourceAnchor } from './source-anchor.js';

export { SOURCE_ANCHOR_KINDS, sourceAnchorExcerpt, sourceAnchorId, type Source, type SourceAnchor, type SourceAnchorKind, type SourceKind } from './source-anchor.js';
export type { DatasetRowAnchor, ExcelCellAnchor, PdfPageAnchor, TextSpanAnchor, WebLinkAnchor } from './source-anchor.js';

export type EvidenceDecision = 'verified' | 'corrected';
export type EvidenceMetadata = Readonly<Record<string, string | number | boolean>>;

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
}

export interface CreateEvidencePackInput {
  readonly id: string;
  readonly title: string;
  readonly claims: readonly Claim[];
  readonly sources?: readonly Source[];
  readonly generatedAt?: string;
  readonly metadata?: EvidenceMetadata;
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
    metadata: Object.freeze({ ...(input.metadata ?? {}) })
  });
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

function compareByClaimId(left: EvidenceItem, right: EvidenceItem): number {
  return left.claimId.localeCompare(right.claimId);
}

function freezeSource(source: Source): Source {
  return Object.freeze({ ...source, ...(source.metadata ? { metadata: Object.freeze({ ...source.metadata }) } : {}) });
}

function deepFreezeEvidencePack(pack: EvidencePack): EvidencePack {
  return Object.freeze({
    ...pack,
    sources: Object.freeze([...pack.sources]),
    items: Object.freeze([...pack.items]),
    metadata: Object.freeze({ ...pack.metadata })
  });
}
