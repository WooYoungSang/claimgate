import { transitionClaim, type CorrectionInput } from '../verification.js';
import { hasSourceAnchor, type Claim, type ClaimLifecycleState, type ClaimValue } from '../claim.js';
import { isProjectableClaim } from '../projection-guards.js';
import type { Reviewer } from '../audit.js';

export type RiskLevel = 'red' | 'yellow' | 'green';
export type RiskQueueBucket = RiskLevel | 'aggregate-only';
export type RiskRuleId =
  | 'source-exists'
  | 'value-match'
  | 'unit-match'
  | 'date-match'
  | 'entity-match'
  | 'contradiction'
  | 'staleness'
  | 'aggregate-only';

export type RiskEngineErrorCode = 'E_NO_RULE_TRACE' | 'E_AI_SCORED';

export class RiskEngineError extends Error {
  readonly code: RiskEngineErrorCode;

  constructor(code: RiskEngineErrorCode, message: string) {
    super(message);
    this.name = 'RiskEngineError';
    this.code = code;
  }
}

export interface RiskRuleTrace {
  readonly ruleId: RiskRuleId;
  readonly level: RiskLevel;
  readonly message: string;
  readonly recommendedState: Extract<ClaimLifecycleState, 'needs-evidence' | 'conflict' | 'aggregate-only'>;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export interface RiskFacts {
  readonly aiUnit?: string;
  readonly sourceUnit?: string;
  readonly aiDate?: string;
  readonly sourceDate?: string;
  readonly aiEntity?: string;
  readonly sourceEntity?: string;
  readonly sourceContradiction?: boolean;
  readonly aggregateOnly?: boolean;
  readonly sourcePublishedAt?: string;
  readonly reviewedAt?: string;
  readonly maxSourceAgeDays?: number;
  /** Forbidden in v0: AI may curate candidates, never score/judge risk. */
  readonly aiRiskScore?: number;
}

export interface EvaluateRiskInput {
  readonly claim: Claim;
  readonly facts?: RiskFacts;
}

export interface RiskResult {
  readonly claimId: string;
  readonly level: RiskLevel;
  readonly queueBucket: RiskQueueBucket;
  readonly recommendedState: Extract<ClaimLifecycleState, 'needs-evidence' | 'conflict' | 'aggregate-only'>;
  readonly trace: readonly RiskRuleTrace[];
}

export interface RiskQueueOptions {
  readonly greenSampleRate?: number;
  readonly minGreenSampleCount?: number;
  readonly seed?: string;
}

export interface RiskQueueItem {
  readonly claim: Claim;
  readonly risk: RiskResult;
  readonly bucket: RiskQueueBucket;
  readonly sampledForReview: boolean;
}

export interface RiskQueueSummary {
  readonly totalClaimCount: number;
  readonly redCount: number;
  readonly yellowCount: number;
  readonly aggregateOnlyCount: number;
  readonly greenCount: number;
  readonly sampledGreenCount: number;
  readonly queuedForReviewCount: number;
}

export interface RiskQueue {
  readonly items: readonly RiskQueueItem[];
  readonly allEvaluations: readonly RiskQueueItem[];
  readonly summary: RiskQueueSummary;
}

export interface ApplyRiskDispositionInput {
  readonly claim: Claim;
  readonly recommendedState: Extract<ClaimLifecycleState, 'needs-evidence' | 'conflict' | 'aggregate-only'>;
  readonly now?: () => string;
  readonly reason?: string;
}

export interface ApplyReviewerCorrectionInput {
  readonly claim: Claim;
  readonly reviewer: Reviewer;
  readonly correctedValue: ClaimValue;
  readonly reason: string;
  readonly now?: () => string;
}

export interface FakeWorkReductionInput {
  readonly queue: RiskQueue;
  readonly reviewedClaims?: readonly Claim[];
}

export interface FakeWorkReductionStats {
  readonly totalClaimCount: number;
  readonly focusedReviewCount: number;
  readonly sampledGreenCount: number;
  readonly skippedReviewCount: number;
  readonly correctedCount: number;
  readonly rejectedCount: number;
  readonly projectedClaimCount: number;
  readonly netAvoidedReviewCount: number;
  readonly fakeWorkReducedRatio: number;
}

const riskRank: Record<RiskQueueBucket, number> = Object.freeze({ red: 0, yellow: 1, 'aggregate-only': 2, green: 3 });

export function evaluateRisk(input: EvaluateRiskInput): RiskResult {
  const { claim, facts = {} } = input;

  if (facts.aiRiskScore !== undefined) {
    throw new RiskEngineError('E_AI_SCORED', 'AI-provided risk scores are forbidden: AI may curate candidates, not judge risk.');
  }

  const trace: RiskRuleTrace[] = [];

  if (!hasSourceAnchor(claim)) {
    trace.push(ruleTrace('source-exists', 'red', 'needs-evidence', 'Claim has no Source Anchor.'));
    return finalizeRiskResult(claim.id, trace);
  }

  if (facts.sourceContradiction === true) {
    trace.push(ruleTrace('contradiction', 'red', 'conflict', 'Anchored source contains an internal contradiction.'));
  }

  let valueMatchTrace: RiskRuleTrace | undefined;
  if (claim.aiValue !== undefined && claim.sourceValue !== undefined) {
    if (sameClaimValue(claim.aiValue, claim.sourceValue)) {
      valueMatchTrace = ruleTrace('value-match', 'green', 'needs-evidence', 'AI value matches anchored source value.');
    } else {
      trace.push(
        ruleTrace('value-match', 'red', 'conflict', 'AI value differs from anchored source value.', {
          aiValue: formatClaimValue(claim.aiValue),
          sourceValue: formatClaimValue(claim.sourceValue)
        })
      );
    }
  } else {
    valueMatchTrace = ruleTrace('value-match', 'green', 'needs-evidence', 'No comparable source value mismatch was present.');
  }

  if (facts.aggregateOnly === true) {
    trace.push(ruleTrace('aggregate-only', 'yellow', 'aggregate-only', 'Only aggregate evidence exists for this claim.'));
  }

  pushMismatch(trace, 'unit-match', facts.aiUnit, facts.sourceUnit, 'Claim unit differs from anchored source unit.');
  pushMismatch(trace, 'date-match', facts.aiDate, facts.sourceDate, 'Claim period/date differs from anchored source period/date.');
  pushMismatch(trace, 'entity-match', facts.aiEntity, facts.sourceEntity, 'Claim entity differs from anchored source entity.');

  const ageDays = sourceAgeDays(facts.sourcePublishedAt, facts.reviewedAt);
  const maxAgeDays = facts.maxSourceAgeDays ?? 365;
  if (ageDays !== null && ageDays > maxAgeDays) {
    trace.push(
      ruleTrace('staleness', 'yellow', 'needs-evidence', 'Anchored source is older than the allowed freshness window.', {
        ageDays,
        maxSourceAgeDays: maxAgeDays
      })
    );
  }

  if (trace.length === 0 && valueMatchTrace !== undefined) {
    trace.push(valueMatchTrace);
  }

  return finalizeRiskResult(claim.id, trace);
}

export function assertRuleTrace(trace: readonly RiskRuleTrace[]): void {
  if (trace.length === 0) {
    throw new RiskEngineError('E_NO_RULE_TRACE', 'Every risk result must include at least one deterministic rule trace.');
  }
}

export function buildRiskQueue(inputs: readonly EvaluateRiskInput[], options: RiskQueueOptions = {}): RiskQueue {
  const allEvaluations = inputs.map((input) => {
    const risk = evaluateRisk(input);
    return freezeQueueItem({ claim: input.claim, risk, bucket: risk.queueBucket, sampledForReview: false });
  });
  const red = sortedBucket(allEvaluations, 'red');
  const yellow = sortedBucket(allEvaluations, 'yellow');
  const aggregateOnly = sortedBucket(allEvaluations, 'aggregate-only');
  const green = sortedBucket(allEvaluations, 'green');
  const sampledGreenIds = sampleGreenIds(green, options);
  const sampledGreen = green.filter((item) => sampledGreenIds.has(item.claim.id)).map((item) => freezeQueueItem({ ...item, sampledForReview: true }));
  const items = [...red, ...yellow, ...aggregateOnly, ...sampledGreen];

  return Object.freeze({
    items: Object.freeze(items),
    allEvaluations: Object.freeze(allEvaluations),
    summary: Object.freeze({
      totalClaimCount: allEvaluations.length,
      redCount: red.length,
      yellowCount: yellow.length,
      aggregateOnlyCount: aggregateOnly.length,
      greenCount: green.length,
      sampledGreenCount: sampledGreen.length,
      queuedForReviewCount: items.length
    })
  });
}

export function applyRiskDisposition(input: ApplyRiskDispositionInput): Claim {
  if (input.claim.state === input.recommendedState) {
    return input.claim;
  }

  return transitionClaim(input.claim, {
    to: input.recommendedState,
    actor: { kind: 'system', id: 'deterministic-risk-engine' },
    reason: input.reason ?? `Deterministic risk engine disposition: ${input.recommendedState}.`,
    now: input.now
  });
}

export function applyReviewerCorrection(input: ApplyReviewerCorrectionInput): Claim {
  const correction: CorrectionInput = { correctedValue: input.correctedValue, reason: input.reason };
  const conflicted = input.claim.state === 'conflict' ? input.claim : applyRiskDisposition({ claim: input.claim, recommendedState: 'conflict', now: input.now });

  return transitionClaim(conflicted, {
    to: 'corrected',
    reviewer: input.reviewer,
    correction,
    reason: input.reason,
    now: input.now
  });
}

export function calculateFakeWorkReduction(input: FakeWorkReductionInput): FakeWorkReductionStats {
  const { queue, reviewedClaims = [] } = input;
  const totalClaimCount = queue.summary.totalClaimCount;
  const sampledGreenCount = queue.summary.sampledGreenCount;
  const focusedReviewCount = queue.summary.queuedForReviewCount;
  const skippedReviewCount = Math.max(0, queue.summary.greenCount - sampledGreenCount);
  const correctedCount = reviewedClaims.filter((claim) => claim.state === 'corrected').length;
  const rejectedCount = reviewedClaims.filter((claim) => claim.state === 'rejected').length;
  const projectedClaimCount = reviewedClaims.filter(isProjectableClaim).length;
  const netAvoidedReviewCount = Math.max(0, skippedReviewCount);

  return Object.freeze({
    totalClaimCount,
    focusedReviewCount,
    sampledGreenCount,
    skippedReviewCount,
    correctedCount,
    rejectedCount,
    projectedClaimCount,
    netAvoidedReviewCount,
    fakeWorkReducedRatio: totalClaimCount === 0 ? 0 : roundRatio(netAvoidedReviewCount / totalClaimCount)
  });
}

function finalizeRiskResult(claimId: string, trace: readonly RiskRuleTrace[]): RiskResult {
  assertRuleTrace(trace);
  const hasRed = trace.some((item) => item.level === 'red');
  const hasYellow = trace.some((item) => item.level === 'yellow');
  const aggregateOnly = trace.some((item) => item.ruleId === 'aggregate-only');
  const level: RiskLevel = hasRed ? 'red' : hasYellow ? 'yellow' : 'green';
  const queueBucket: RiskQueueBucket = hasRed ? 'red' : aggregateOnly ? 'aggregate-only' : hasYellow ? 'yellow' : 'green';
  const recommendedState = recommendedStateFor(trace, level, queueBucket);

  return Object.freeze({
    claimId,
    level,
    queueBucket,
    recommendedState,
    trace: Object.freeze([...trace])
  });
}

function recommendedStateFor(
  trace: readonly RiskRuleTrace[],
  level: RiskLevel,
  queueBucket: RiskQueueBucket
): Extract<ClaimLifecycleState, 'needs-evidence' | 'conflict' | 'aggregate-only'> {
  if (queueBucket === 'aggregate-only') return 'aggregate-only';
  if (level === 'red') return trace.find((item) => item.level === 'red')?.recommendedState ?? 'conflict';
  return 'needs-evidence';
}

function ruleTrace(
  ruleId: RiskRuleId,
  level: RiskLevel,
  recommendedState: Extract<ClaimLifecycleState, 'needs-evidence' | 'conflict' | 'aggregate-only'>,
  message: string,
  details?: Readonly<Record<string, string | number | boolean>>
): RiskRuleTrace {
  return Object.freeze({ ruleId, level, recommendedState, message, ...(details ? { details: Object.freeze({ ...details }) } : {}) });
}

function pushMismatch(trace: RiskRuleTrace[], ruleId: Extract<RiskRuleId, 'unit-match' | 'date-match' | 'entity-match'>, left?: string, right?: string, message?: string): void {
  if (left !== undefined && right !== undefined && left !== right) {
    trace.push(ruleTrace(ruleId, 'yellow', 'needs-evidence', message ?? `${ruleId} mismatch.`, { ai: left, source: right }));
  }
}

function sortedBucket(items: readonly RiskQueueItem[], bucket: RiskQueueBucket): RiskQueueItem[] {
  return items
    .filter((item) => item.bucket === bucket)
    .sort((left, right) => riskRank[left.bucket] - riskRank[right.bucket] || left.claim.id.localeCompare(right.claim.id));
}

function sampleGreenIds(green: readonly RiskQueueItem[], options: RiskQueueOptions): ReadonlySet<string> {
  if (green.length === 0) return new Set<string>();
  const rate = clamp(options.greenSampleRate ?? 0.1, 0, 1);
  const minCount = Math.max(0, Math.floor(options.minGreenSampleCount ?? 1));
  const count = Math.min(green.length, Math.max(minCount, Math.ceil(green.length * rate)));
  const ordered = [...green].sort((left, right) => seededScore(right.claim.id, options.seed ?? 'claimgate-green-sampling') - seededScore(left.claim.id, options.seed ?? 'claimgate-green-sampling') || left.claim.id.localeCompare(right.claim.id));
  return new Set(ordered.slice(0, count).map((item) => item.claim.id));
}

function freezeQueueItem(item: RiskQueueItem): RiskQueueItem {
  return Object.freeze(item);
}

function sameClaimValue(left: ClaimValue, right: ClaimValue): boolean {
  return normalizeClaimValue(left) === normalizeClaimValue(right);
}

function normalizeClaimValue(value: ClaimValue): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  return JSON.stringify(value);
}

function formatClaimValue(value: ClaimValue): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return String(value);
}

function sourceAgeDays(sourcePublishedAt?: string, reviewedAt?: string): number | null {
  if (!sourcePublishedAt || !reviewedAt) return null;
  const sourceTime = Date.parse(sourcePublishedAt);
  const reviewTime = Date.parse(reviewedAt);
  if (!Number.isFinite(sourceTime) || !Number.isFinite(reviewTime)) return null;
  return Math.max(0, Math.floor((reviewTime - sourceTime) / 86_400_000));
}

function seededScore(value: string, seed: string): number {
  let hash = 2166136261;
  const input = `${seed}\u0000${value}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
