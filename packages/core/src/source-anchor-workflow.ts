import { reviewerActor, type Reviewer } from './audit.js';
import { attachAnchor, type Claim, type ClaimValue } from './claim.js';
import { normalizeCandidateClaim, type CandidateClaim } from './extraction.js';
import { freezeSourceAnchor, type SourceAnchor } from './source-anchor.js';

export type SourceAnchorWorkflowErrorCode =
  | 'E_SOURCE_ANCHOR_REVIEW_REQUIRED'
  | 'E_SOURCE_ANCHOR_PROPOSAL_MISMATCH';

export class SourceAnchorWorkflowError extends Error {
  readonly code: SourceAnchorWorkflowErrorCode;

  constructor(code: SourceAnchorWorkflowErrorCode, message: string) {
    super(message);
    this.name = 'SourceAnchorWorkflowError';
    this.code = code;
  }
}

export interface AcceptSourceAnchorInput {
  readonly claim: Claim;
  readonly anchor: SourceAnchor;
  readonly sourceValue?: ClaimValue;
  readonly reviewer: Reviewer;
  readonly reason: string;
  readonly trustCredentialRef?: string;
  readonly now?: () => string;
}

export interface AcceptProposedSourceAnchorInput extends Omit<AcceptSourceAnchorInput, 'anchor'> {
  readonly candidate: CandidateClaim;
}

export interface RejectProposedSourceAnchorInput {
  readonly candidate: CandidateClaim;
  readonly reviewer: Reviewer;
  readonly reason: string;
  readonly now?: () => string;
}

export interface RejectedProposedSourceAnchor {
  readonly candidateId: string;
  readonly decision: 'rejected';
  readonly reviewer: Reviewer;
  readonly rejectedAt: string;
  readonly reason: string;
  readonly proposedAnchor?: SourceAnchor;
}

const defaultNow = () => new Date().toISOString();

export function acceptSourceAnchor(input: AcceptSourceAnchorInput): Claim {
  assertReviewReason(input.reason, 'Source Anchor acceptance');

  return attachAnchor(input.claim, {
    anchor: input.anchor,
    ...(input.sourceValue !== undefined ? { sourceValue: input.sourceValue } : {}),
    actor: reviewerActor(input.reviewer),
    reason: `Accepted Source Anchor: ${input.reason.trim()}`,
    ...(input.trustCredentialRef ? { trustCredentialRef: input.trustCredentialRef } : {}),
    now: input.now
  });
}

export function acceptProposedSourceAnchor(input: AcceptProposedSourceAnchorInput): Claim {
  const candidate = normalizeCandidateClaim(input.candidate);

  if (candidate.id !== input.claim.id) {
    throw new SourceAnchorWorkflowError(
      'E_SOURCE_ANCHOR_PROPOSAL_MISMATCH',
      'Proposed Source Anchor candidate id must match claim id.'
    );
  }

  if (candidate.proposedAnchor === undefined) {
    throw new SourceAnchorWorkflowError(
      'E_SOURCE_ANCHOR_REVIEW_REQUIRED',
      'Candidate has no proposed Source Anchor to accept.'
    );
  }

  return attachAnchor(input.claim, {
    anchor: candidate.proposedAnchor,
    ...(input.sourceValue !== undefined ? { sourceValue: input.sourceValue } : {}),
    actor: reviewerActor(input.reviewer),
    reason: `Accepted extractor-proposed Source Anchor: ${input.reason.trim()}`,
    ...(input.trustCredentialRef ? { trustCredentialRef: input.trustCredentialRef } : {}),
    now: input.now
  });
}

export function rejectProposedSourceAnchor(input: RejectProposedSourceAnchorInput): RejectedProposedSourceAnchor {
  assertReviewReason(input.reason, 'Source Anchor rejection');
  const candidate = normalizeCandidateClaim(input.candidate);

  return Object.freeze({
    candidateId: candidate.id,
    decision: 'rejected' as const,
    reviewer: Object.freeze({ ...input.reviewer }),
    rejectedAt: (input.now ?? defaultNow)(),
    reason: input.reason.trim(),
    ...(candidate.proposedAnchor ? { proposedAnchor: freezeSourceAnchor(candidate.proposedAnchor) } : {})
  });
}

function assertReviewReason(reason: string, decision: string): void {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new SourceAnchorWorkflowError(
      'E_SOURCE_ANCHOR_REVIEW_REQUIRED',
      `${decision} requires a non-empty reason.`
    );
  }
}
