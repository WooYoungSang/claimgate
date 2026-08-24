import { hasAdditionalAnchorCollections, type ClaimValue } from './claim.js';
import { normalizeCandidateClaim, type CandidateClaim } from './extraction.js';
import type { SourceAnchor } from './source-anchor.js';

export type AtomicClaimDecompositionErrorCode = 'E_INVALID_ATOMIC_CLAIM_DECOMPOSITION';

export class AtomicClaimDecompositionError extends Error {
  readonly code: AtomicClaimDecompositionErrorCode;

  constructor(message: string) {
    super(message);
    this.name = 'AtomicClaimDecompositionError';
    this.code = 'E_INVALID_ATOMIC_CLAIM_DECOMPOSITION';
  }
}

export interface AtomicClaimPartDraft {
  readonly id: string;
  readonly text: string;
  readonly subject?: string;
  readonly aiValue?: ClaimValue;
  readonly proposedAnchor?: SourceAnchor;
  readonly fixtureNotes?: readonly string[];
}

export interface CompositeClaimDraft {
  readonly id: string;
  readonly text: string;
  readonly parts: readonly AtomicClaimPartDraft[];
}

export function decomposeCompositeClaimDraft(draft: CompositeClaimDraft): readonly CandidateClaim[] {
  assertNonEmptyText(draft.id, 'Composite claim id');
  assertNonEmptyText(draft.text, 'Composite claim text');

  if (!Array.isArray(draft.parts) || draft.parts.length < 2) {
    throw new AtomicClaimDecompositionError('Composite claim decomposition requires at least two atomic parts.');
  }

  const ids = new Set<string>();
  return Object.freeze(draft.parts.map((part) => {
    if (hasAdditionalAnchorCollections(part)) {
      throw new AtomicClaimDecompositionError('Atomic claim part supports one primary proposed Source Anchor; multi-anchor parts must be decomposed further.');
    }

    assertNonEmptyText(part.id, 'Atomic claim id');
    assertNonEmptyText(part.text, 'Atomic claim text');

    if (ids.has(part.id)) {
      throw new AtomicClaimDecompositionError('Atomic claim ids must be unique.');
    }
    ids.add(part.id);

    const candidate = normalizeCandidateClaim({
      ...part,
      state: 'extracted' as const,
      fixtureNotes: [...(part.fixtureNotes ?? []), `decomposed-from:${draft.id}`]
    });

    return candidate;
  }));
}

function assertNonEmptyText(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AtomicClaimDecompositionError(`${label} must be non-empty.`);
  }
}
