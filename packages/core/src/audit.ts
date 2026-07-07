import type { ClaimLifecycleState } from './claim.js';

export interface Reviewer {
  readonly id: string;
  readonly displayName?: string;
}

export type AuditActor =
  | { readonly kind: 'system'; readonly id: string }
  | { readonly kind: 'reviewer'; readonly id: string; readonly displayName?: string };

export type AuditAction = 'create' | 'anchor' | 'transition';

export interface AuditEvent {
  readonly id: string;
  readonly claimId: string;
  readonly action: AuditAction;
  readonly before: ClaimLifecycleState | null;
  readonly after: ClaimLifecycleState;
  readonly actor: AuditActor;
  readonly timestamp: string;
  readonly reason?: string;
  readonly anchorId?: string;
  readonly trustCredentialRef?: string;
}

export type AuditTrail = readonly AuditEvent[];

export interface AuditEventInput {
  readonly claimId: string;
  readonly action: AuditAction;
  readonly before: ClaimLifecycleState | null;
  readonly after: ClaimLifecycleState;
  readonly actor: AuditActor;
  readonly timestamp: string;
  readonly reason?: string;
  readonly anchorId?: string;
  readonly trustCredentialRef?: string;
}

export function reviewerActor(reviewer: Reviewer): AuditActor {
  return {
    kind: 'reviewer',
    id: reviewer.id,
    ...(reviewer.displayName ? { displayName: reviewer.displayName } : {})
  };
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return freezeAuditEvent({
    id: `${input.claimId}:${input.action}:${input.before ?? 'none'}:${input.after}:${input.timestamp}`,
    ...input
  });
}

export function appendAuditEvent(audit: AuditTrail, event: AuditEvent): AuditTrail {
  return Object.freeze([...audit, freezeAuditEvent(event)]);
}

function freezeAuditEvent(event: AuditEvent): AuditEvent {
  return Object.freeze({ ...event, actor: Object.freeze({ ...event.actor }) });
}
