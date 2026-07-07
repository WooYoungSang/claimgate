import { appendAuditEvent, createAuditEvent, reviewerActor, type AuditActor, type Reviewer } from './audit.js';
import { hasSourceAnchor, type Claim, type ClaimLifecycleState, type ClaimValue, type CorrectionRecord } from './claim.js';
import { sourceAnchorId } from './source-anchor.js';

export type VerificationErrorCode = 'E_NO_ANCHOR' | 'E_NO_REVIEWER' | 'E_INVALID_TRANSITION' | 'E_CORRECTION_REQUIRED';

export class VerificationError extends Error {
  readonly code: VerificationErrorCode;

  constructor(code: VerificationErrorCode, message: string) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
  }
}

export interface CorrectionInput {
  readonly correctedValue: ClaimValue;
  readonly reason: string;
}

export interface TransitionClaimInput {
  readonly to: ClaimLifecycleState;
  readonly actor?: AuditActor;
  readonly reviewer?: Reviewer;
  readonly correction?: CorrectionInput;
  readonly reason?: string;
  readonly now?: () => string;
}

const defaultNow = () => new Date().toISOString();

const allowedTransitions: Readonly<Record<ClaimLifecycleState, readonly ClaimLifecycleState[]>> = Object.freeze({
  extracted: ['anchored'],
  anchored: ['needs-evidence', 'conflict', 'aggregate-only'],
  'needs-evidence': ['verified', 'corrected', 'rejected'],
  conflict: ['verified', 'corrected', 'rejected'],
  'aggregate-only': ['verified', 'corrected', 'rejected'],
  verified: [],
  corrected: [],
  rejected: []
});

const terminalStates = new Set<ClaimLifecycleState>(['verified', 'corrected', 'rejected']);
const anchorRequiredTerminalStates = new Set<ClaimLifecycleState>(['verified', 'corrected']);

export function canTransition(from: ClaimLifecycleState, to: ClaimLifecycleState): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionClaim(claim: Claim, input: TransitionClaimInput): Claim {
  if (!canTransition(claim.state, input.to)) {
    throw new VerificationError('E_INVALID_TRANSITION', `Cannot transition from ${claim.state} to ${input.to}.`);
  }

  if (anchorRequiredTerminalStates.has(input.to) && !hasSourceAnchor(claim)) {
    throw new VerificationError('E_NO_ANCHOR', `A claim needs a Source Anchor before it can become ${input.to}.`);
  }

  if (terminalStates.has(input.to) && !input.reviewer) {
    throw new VerificationError('E_NO_REVIEWER', 'Terminal verification decisions require a reviewer.');
  }

  if (input.to === 'corrected' && !input.correction) {
    throw new VerificationError('E_CORRECTION_REQUIRED', 'Corrected claims require a corrected value and correction reason.');
  }

  const actor = input.reviewer ? reviewerActor(input.reviewer) : input.actor ?? { kind: 'system', id: 'verification-state-machine' };
  const timestamp = (input.now ?? defaultNow)();
  const correction = input.to === 'corrected' && input.reviewer && input.correction ? buildCorrection(claim, input.reviewer, input.correction) : undefined;

  return Object.freeze({
    ...claim,
    state: input.to,
    ...(correction ? { correction } : {}),
    audit: appendAuditEvent(
      claim.audit,
      createAuditEvent({
        claimId: claim.id,
        action: 'transition',
        before: claim.state,
        after: input.to,
        actor,
        timestamp,
        reason: input.reason ?? transitionReason(input.to),
        ...(claim.anchor ? { anchorId: sourceAnchorId(claim.anchor) } : {})
      })
    )
  });
}

function buildCorrection(claim: Claim, reviewer: Reviewer, correction: CorrectionInput): CorrectionRecord {
  return Object.freeze({
    originalAiValue: claim.aiValue ?? null,
    sourceValue: claim.sourceValue ?? null,
    correctedValue: correction.correctedValue,
    reason: correction.reason,
    reviewerId: reviewer.id
  });
}

function transitionReason(state: ClaimLifecycleState): string {
  switch (state) {
    case 'needs-evidence':
      return 'Claim requires reviewer evidence before projection.';
    case 'conflict':
      return 'Claim conflicts with anchored source value.';
    case 'aggregate-only':
      return 'Claim can only be reviewed at aggregate level.';
    case 'verified':
      return 'Reviewer verified the anchored claim.';
    case 'corrected':
      return 'Reviewer corrected the claim against anchored source evidence.';
    case 'rejected':
      return 'Reviewer rejected the claim.';
    case 'anchored':
      return 'Claim received a Source Anchor.';
    case 'extracted':
      return 'Claim extracted as an unverified candidate.';
  }
}
