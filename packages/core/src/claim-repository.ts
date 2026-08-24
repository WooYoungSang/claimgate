import type { Claim } from './claim.js';
import { claimReviewVersion } from './verification.js';

export interface ClaimSnapshot {
  readonly claim: Claim;
  readonly version: number;
}

export interface SaveClaimSnapshotInput {
  readonly claim: Claim;
  readonly expectedVersion: number;
}

export interface ClaimRepository {
  get(id: string): ClaimSnapshot | undefined;
  save(input: SaveClaimSnapshotInput): ClaimSnapshot;
}

export class ClaimRepositoryConcurrencyError extends Error {
  readonly code = 'E_STALE_CLAIM_SNAPSHOT' as const;
  readonly claimId: string;
  readonly expectedVersion: number;
  readonly currentVersion: number;

  constructor(claimId: string, expectedVersion: number, currentVersion: number) {
    super(`Stale claim snapshot for ${claimId}: expected version ${expectedVersion} but current version is ${currentVersion}.`);
    this.name = 'ClaimRepositoryConcurrencyError';
    this.claimId = claimId;
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
  }
}

export function createInMemoryClaimRepository(initialClaims: readonly Claim[] = []): ClaimRepository {
  const snapshots = new Map<string, ClaimSnapshot>();

  for (const claim of initialClaims) {
    snapshots.set(claim.id, freezeSnapshot(claim));
  }

  return Object.freeze({
    get(id: string): ClaimSnapshot | undefined {
      const snapshot = snapshots.get(id);
      return snapshot ? freezeSnapshot(snapshot.claim) : undefined;
    },
    save(input: SaveClaimSnapshotInput): ClaimSnapshot {
      const current = snapshots.get(input.claim.id);
      const currentVersion = current?.version ?? 0;
      if (input.expectedVersion !== currentVersion) {
        throw new ClaimRepositoryConcurrencyError(input.claim.id, input.expectedVersion, currentVersion);
      }

      const next = freezeSnapshot(input.claim);
      snapshots.set(input.claim.id, next);
      return next;
    }
  });
}

function freezeSnapshot(claim: Claim): ClaimSnapshot {
  return Object.freeze({ claim, version: claimReviewVersion(claim) });
}
