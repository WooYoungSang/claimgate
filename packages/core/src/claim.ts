import { appendAuditEvent, createAuditEvent, type AuditActor, type AuditTrail } from './audit.js';
import { freezeSourceAnchor, sourceAnchorId, type SourceAnchor } from './source-anchor.js';

export type ClaimLifecycleState =
  | 'extracted'
  | 'anchored'
  | 'needs-evidence'
  | 'conflict'
  | 'aggregate-only'
  | 'verified'
  | 'corrected'
  | 'rejected';

export type ClaimId = string;
export type ClaimValue = string | number | boolean | null;

export interface CorrectionRecord {
  readonly originalAiValue: ClaimValue;
  readonly sourceValue: ClaimValue;
  readonly correctedValue: ClaimValue;
  readonly reason: string;
  readonly reviewerId: string;
}

export interface Claim {
  readonly id: ClaimId;
  readonly text: string;
  readonly subject?: string;
  readonly aiValue?: ClaimValue;
  readonly sourceValue?: ClaimValue;
  readonly state: ClaimLifecycleState;
  readonly anchor?: SourceAnchor;
  readonly correction?: CorrectionRecord;
  readonly audit: AuditTrail;
}

export type ClaimAnchorErrorCode = 'E_INVALID_ANCHOR_ATTACH';

export class ClaimAnchorError extends Error {
  readonly code: ClaimAnchorErrorCode;

  constructor(code: ClaimAnchorErrorCode, message: string) {
    super(message);
    this.name = 'ClaimAnchorError';
    this.code = code;
  }
}

export interface CreateExtractedClaimInput {
  readonly id: ClaimId;
  readonly text: string;
  readonly subject?: string;
  readonly aiValue?: ClaimValue;
  readonly actor?: AuditActor;
  readonly now?: () => string;
}

export interface AttachAnchorInput {
  readonly anchor: SourceAnchor;
  readonly sourceValue?: ClaimValue;
  readonly actor: AuditActor;
  readonly reason?: string;
  readonly now?: () => string;
}

const defaultNow = () => new Date().toISOString();

export function createExtractedClaim(input: CreateExtractedClaimInput): Claim {
  const timestamp = (input.now ?? defaultNow)();
  const actor = input.actor ?? { kind: 'system', id: 'ai-curator' };
  const base: Omit<Claim, 'audit'> = Object.freeze({
    id: input.id,
    text: input.text,
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.aiValue !== undefined ? { aiValue: input.aiValue } : {}),
    state: 'extracted' as const
  });

  return Object.freeze({
    ...base,
    audit: Object.freeze([
      createAuditEvent({
        claimId: input.id,
        action: 'create',
        before: null,
        after: 'extracted',
        actor,
        timestamp,
        reason: 'Claim extracted as an unverified candidate.'
      })
    ])
  });
}

export function attachAnchor(claim: Claim, input: AttachAnchorInput): Claim {
  if (claim.state !== 'extracted') {
    throw new ClaimAnchorError(
      'E_INVALID_ANCHOR_ATTACH',
      `Cannot attach Source Anchor to ${claim.state} claim; only extracted claims may be anchored.`
    );
  }

  const timestamp = (input.now ?? defaultNow)();
  const anchor = freezeSourceAnchor(input.anchor);
  return Object.freeze({
    ...claim,
    state: 'anchored' as const,
    anchor,
    ...(input.sourceValue !== undefined ? { sourceValue: input.sourceValue } : {}),
    audit: appendAuditEvent(
      claim.audit,
      createAuditEvent({
        claimId: claim.id,
        action: 'anchor',
        before: claim.state,
        after: 'anchored',
        actor: input.actor,
        timestamp,
        reason: input.reason ?? 'Source Anchor attached.',
        anchorId: sourceAnchorId(anchor)
      })
    )
  });
}

export function hasSourceAnchor(claim: Pick<Claim, 'anchor'>): boolean {
  return claim.anchor !== undefined;
}
