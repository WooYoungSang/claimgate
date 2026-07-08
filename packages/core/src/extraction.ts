import { createExtractedClaim, type Claim, type ClaimValue, type CreateExtractedClaimInput } from './claim.js';
import { freezeSourceAnchor, type Source, type SourceAnchor } from './source-anchor.js';

export type MaybePromise<T> = T | Promise<T>;

export type CandidateClaimState = 'extracted';

export interface CandidateClaim {
  readonly id: string;
  readonly text: string;
  readonly state: CandidateClaimState;
  readonly subject?: string;
  readonly aiValue?: ClaimValue;
  /**
   * Anchor proposed by the extractor. It is not attached to the core Claim until
   * a separate anchoring/review workflow accepts it.
   */
  readonly proposedAnchor?: SourceAnchor;
  readonly fixtureNotes?: readonly string[];
}

export interface ClaimExtractorSource {
  readonly id: string;
}

export interface ClaimExtractor {
  readonly id: string;
  readonly mode: 'fixture' | 'llm-adapter-boundary';
  extractClaims(source: ClaimExtractorSource): MaybePromise<readonly CandidateClaim[]>;
}

export type ClaimExtractorAllowedCapability = 'candidate-claim-proposal' | 'source-anchor-proposal';

export type ClaimExtractorForbiddenAuthority =
  | 'verify-truth'
  | 'score-risk'
  | 'attach-anchor'
  | 'reviewer-decision'
  | 'project-evidence';

export interface ClaimExtractorBoundary {
  readonly mode: ClaimExtractor['mode'];
  readonly outputContract: 'CandidateClaim[]';
  readonly providerCalls: 'forbidden-in-v0';
  readonly allowedCapabilities: readonly ClaimExtractorAllowedCapability[];
  readonly forbiddenAuthorities: readonly ClaimExtractorForbiddenAuthority[];
}

export const CLAIM_EXTRACTOR_ALLOWED_CAPABILITIES = Object.freeze([
  'candidate-claim-proposal',
  'source-anchor-proposal'
] as const satisfies readonly ClaimExtractorAllowedCapability[]);

export const CLAIM_EXTRACTOR_FORBIDDEN_AUTHORITIES = Object.freeze([
  'verify-truth',
  'score-risk',
  'attach-anchor',
  'reviewer-decision',
  'project-evidence'
] as const satisfies readonly ClaimExtractorForbiddenAuthority[]);

export type CandidateAuthorityErrorCode = 'E_AI_AUTHORITY_LEAK';

export class CandidateAuthorityError extends Error {
  readonly code: CandidateAuthorityErrorCode;

  constructor(message = 'AI extraction candidates may only contain extracted candidates and proposed anchors; judge/risk/projection authority is forbidden.') {
    super(message);
    this.name = 'CandidateAuthorityError';
    this.code = 'E_AI_AUTHORITY_LEAK';
  }
}

const forbiddenAuthorityKeys = new Set([
  'anchor',
  'sourceValue',
  'riskScore',
  'riskLevel',
  'riskTrace',
  'reviewerDecision',
  'verified',
  'corrected',
  'projected',
  'projection',
  'evidencePack',
  'report',
  'graph'
]);

export function assertCandidateClaim(candidate: CandidateClaim): void {
  assertNoAuthorityLeak(candidate as unknown as Record<string, unknown>);

  if (candidate.state !== 'extracted') {
    throw new CandidateAuthorityError();
  }
}

export function assertCandidateClaims(candidates: readonly CandidateClaim[]): readonly CandidateClaim[] {
  for (const candidate of candidates) {
    assertCandidateClaim(candidate);
  }

  return Object.freeze([...candidates]);
}

export async function extractCandidateClaims(
  extractor: ClaimExtractor,
  source: ClaimExtractorSource
): Promise<readonly CandidateClaim[]> {
  const candidates = await extractor.extractClaims(source);
  return assertCandidateClaims(candidates);
}

export function describeClaimExtractorBoundary(mode: ClaimExtractor['mode'] = 'fixture'): ClaimExtractorBoundary {
  return Object.freeze({
    mode,
    outputContract: 'CandidateClaim[]' as const,
    providerCalls: 'forbidden-in-v0' as const,
    allowedCapabilities: CLAIM_EXTRACTOR_ALLOWED_CAPABILITIES,
    forbiddenAuthorities: CLAIM_EXTRACTOR_FORBIDDEN_AUTHORITIES
  });
}

export function normalizeCandidateClaim(input: unknown): CandidateClaim {
  if (!isRecord(input)) {
    throw new TypeError('Candidate claim must be an object.');
  }

  assertNoAuthorityLeak(input);

  const id = requireString(input.id, 'candidate.id');
  const text = requireString(input.text, 'candidate.text');
  const state = input.state === undefined ? 'extracted' : input.state;

  if (state !== 'extracted') {
    throw new CandidateAuthorityError();
  }

  const proposedAnchor = input.proposedAnchor === undefined ? undefined : freezeSourceAnchor(input.proposedAnchor as SourceAnchor);
  const fixtureNotes = input.fixtureNotes === undefined ? undefined : normalizeStringArray(input.fixtureNotes, 'candidate.fixtureNotes');

  return Object.freeze({
    id,
    text,
    state: 'extracted' as const,
    ...(typeof input.subject === 'string' ? { subject: input.subject } : {}),
    ...(isClaimValue(input.aiValue) ? { aiValue: input.aiValue } : {}),
    ...(proposedAnchor ? { proposedAnchor } : {}),
    ...(fixtureNotes ? { fixtureNotes } : {})
  });
}

export function createExtractedClaimFromCandidate(
  candidate: CandidateClaim,
  options: Pick<CreateExtractedClaimInput, 'actor' | 'now'> = {}
): Claim {
  assertCandidateClaim(candidate);

  return createExtractedClaim({
    id: candidate.id,
    text: candidate.text,
    ...(candidate.subject ? { subject: candidate.subject } : {}),
    ...(candidate.aiValue !== undefined ? { aiValue: candidate.aiValue } : {}),
    ...options
  });
}

export function createExtractedClaimsFromCandidates(
  candidates: readonly CandidateClaim[],
  options: Pick<CreateExtractedClaimInput, 'actor' | 'now'> = {}
): readonly Claim[] {
  return Object.freeze(candidates.map((candidate) => createExtractedClaimFromCandidate(candidate, options)));
}

export function sortCandidateClaims(candidates: readonly CandidateClaim[]): readonly CandidateClaim[] {
  return Object.freeze([...candidates].sort((left, right) => left.id.localeCompare(right.id)));
}

function assertNoAuthorityLeak(candidate: Record<string, unknown>): void {
  for (const key of Object.keys(candidate)) {
    if (forbiddenAuthorityKeys.has(key)) {
      throw new CandidateAuthorityError();
    }
  }
}

function isClaimValue(value: unknown): value is ClaimValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return value;
}

function normalizeStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError(`${field} must be an array of strings.`);
  }

  return Object.freeze([...value]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type { Source };
