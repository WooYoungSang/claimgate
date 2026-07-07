import type { Claim, ClaimLifecycleState, ClaimValue } from './claim.js';
import type { SourceAnchor } from './evidence.js';

export type ProjectionErrorCode = 'E_NOT_PROJECTABLE';

export class ProjectionError extends Error {
  readonly code: ProjectionErrorCode;

  constructor(code: ProjectionErrorCode, message: string) {
    super(message);
    this.name = 'ProjectionError';
    this.code = code;
  }
}

export interface ProjectedClaim {
  readonly id: string;
  readonly text: string;
  readonly state: Extract<ClaimLifecycleState, 'verified' | 'corrected'>;
  readonly value: ClaimValue | undefined;
  readonly sourceAnchor: SourceAnchor;
  readonly auditEventCount: number;
}

export function isProjectableState(state: ClaimLifecycleState): state is Extract<ClaimLifecycleState, 'verified' | 'corrected'> {
  return state === 'verified' || state === 'corrected';
}

export function isProjectableClaim(claim: Claim): boolean {
  return isProjectableState(claim.state) && claim.anchor !== undefined;
}

export function assertProjectableClaim(claim: Claim): asserts claim is Claim & {
  readonly state: Extract<ClaimLifecycleState, 'verified' | 'corrected'>;
  readonly anchor: SourceAnchor;
} {
  if (!isProjectableClaim(claim)) {
    throw new ProjectionError('E_NOT_PROJECTABLE', 'Only verified or corrected claims may be projected.');
  }
}

export function filterProjectableClaims<T extends Claim>(claims: readonly T[]): T[] {
  return claims.filter(isProjectableClaim);
}

export function projectClaim(claim: Claim): ProjectedClaim {
  assertProjectableClaim(claim);
  return Object.freeze({
    id: claim.id,
    text: claim.text,
    state: claim.state,
    value: claim.state === 'corrected' ? claim.correction?.correctedValue : claim.sourceValue ?? claim.aiValue,
    sourceAnchor: claim.anchor,
    auditEventCount: claim.audit.length
  });
}
