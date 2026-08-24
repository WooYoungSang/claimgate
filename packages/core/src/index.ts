export const CLAIMGATE_CORE_BOUNDARY = 'pure-typescript-core' as const;

export type ClaimGateInvariant =
  | 'no-anchor-no-claim'
  | 'ai-curator-not-judge'
  | 'risk-first-review'
  | 'evidence-pack-first'
  | 'verified-corrected-only-projection';

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

export * from './audit.js';
export * from './claim.js';
export * from './source-anchor.js';
export * from './source-anchor-workflow.js';
export * from './extraction-provenance.js';
export * from './claim-repository.js';
export * from './evidence.js';
export * from './projection-guards.js';
export * from './verification.js';
export * from './projectors/graph.js';
export * from './projectors/report.js';
export * from './extraction.js';
export * from './atomic-claim.js';
export * from './fixture-loader.js';
export * from './domain-pack.js';

export * from './risk/index.js';
