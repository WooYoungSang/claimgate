export const CLAIMGATE_CORE_BOUNDARY = 'pure-typescript-core' as const;

export type ClaimGateInvariant =
  | 'no-anchor-no-claim'
  | 'ai-curator-not-judge'
  | 'risk-first-review'
  | 'evidence-pack-first'
  | 'verified-corrected-only-projection';

export type ClaimLifecycleState =
  | 'extracted'
  | 'anchored'
  | 'needs-evidence'
  | 'conflict'
  | 'aggregate-only'
  | 'verified'
  | 'corrected'
  | 'rejected';

export interface ClaimGatePackageInfo {
  readonly packageName: string;
  readonly boundary: string;
  readonly invariants: readonly ClaimGateInvariant[];
}

export interface DomainPackScaffold {
  readonly id: string;
  readonly packageName: `@claimgate/pack-${string}`;
  readonly displayName: string;
  readonly fixtureKinds: readonly string[];
}

export const claimGateCoreInfo: ClaimGatePackageInfo = {
  packageName: '@claimgate/core',
  boundary: CLAIMGATE_CORE_BOUNDARY,
  invariants: [
    'no-anchor-no-claim',
    'ai-curator-not-judge',
    'risk-first-review',
    'evidence-pack-first',
    'verified-corrected-only-projection'
  ]
};

export function listCoreInvariants(): readonly ClaimGateInvariant[] {
  return claimGateCoreInfo.invariants;
}

export function isProjectableState(state: ClaimLifecycleState): boolean {
  return state === 'verified' || state === 'corrected';
}
