import type { DomainPack, DomainPackFixture, DomainRecommendedState, DomainRiskDecision } from '@claimgate/core/domain-pack';

export interface DomainPackFixtureResult {
  readonly fixtureId: string;
  readonly ruleId: string;
  readonly decision: DomainRiskDecision;
}

export interface DomainPackConformanceReport {
  readonly packId: string;
  readonly packageName: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly fixtureResults: readonly DomainPackFixtureResult[];
  readonly domainSignature: string;
}

export class DomainPackConformanceError extends Error {
  readonly report: DomainPackConformanceReport;

  constructor(report: DomainPackConformanceReport) {
    super(`DomainPack '${report.packId}' failed conformance: ${report.failures.join('; ')}`);
    this.name = 'DomainPackConformanceError';
    this.report = report;
  }
}

const allowedRiskDecisionKeys = new Set(['level', 'recommendedState', 'trace']);
const forbiddenRiskAuthorityKeys = new Set(['aiRiskScore', 'aiRiskLevel', 'riskScore', 'riskLevel', 'score']);
const allowedRiskTraceKeys = new Set(['ruleId', 'level', 'message', 'evidenceRef']);

export function assertDomainPackConformance(pack: DomainPack): DomainPackConformanceReport {
  const report = runDomainPackConformance(pack);
  if (!report.passed) {
    throw new DomainPackConformanceError(report);
  }
  return report;
}

export function runDomainPackConformance(pack: DomainPack): DomainPackConformanceReport {
  const failures: string[] = [];
  const fixtureResults: DomainPackFixtureResult[] = [];

  requireNonEmpty(pack.id, 'pack.id', failures);
  requireNonEmpty(pack.displayName, 'pack.displayName', failures);
  requireNonEmpty(pack.version, 'pack.version', failures);
  if (!pack.packageName.startsWith('@claimgate/pack-')) failures.push('packageName must start with @claimgate/pack-');
  if (pack.entityTypes.length === 0) failures.push('entityTypes must not be empty');
  if (pack.anchorKinds.length === 0) failures.push('anchorKinds must not be empty');
  if (pack.riskRules.length === 0) failures.push('riskRules must not be empty');
  if (pack.reportTemplates.length === 0) failures.push('reportTemplates must not be empty');
  if (pack.fixtures.length === 0) failures.push('fixtures must not be empty');
  requireNonEmpty(pack.labels.claimSingular, 'labels.claimSingular', failures);
  requireNonEmpty(pack.labels.claimPlural, 'labels.claimPlural', failures);
  requireNonEmpty(pack.labels.reviewerNoun, 'labels.reviewerNoun', failures);
  validateGreenSamplingPolicyRecommendation(pack.greenSamplingPolicyRecommendation, failures);

  const entityIds = new Set(pack.entityTypes.map((entity) => entity.id));
  const anchorKinds = new Set(pack.anchorKinds);
  const ruleById = new Map(pack.riskRules.map((rule) => [rule.id, rule]));
  const exercisedRuleIds = new Set<string>();

  for (const fixture of pack.fixtures) {
    validateFixtureShape(fixture, entityIds, anchorKinds, failures);
    const rule = ruleById.get(fixture.expected.ruleId);
    if (!rule) {
      failures.push(`fixture ${fixture.id} references missing rule ${fixture.expected.ruleId}`);
      continue;
    }
    exercisedRuleIds.add(rule.id);

    const first = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
    const second = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
    if (stableSerialize(first) !== stableSerialize(second)) {
      failures.push(`rule ${rule.id} is not deterministic for fixture ${fixture.id}`);
    }
    validateRiskDecisionShape(first, fixture.id, failures);
    if (first.level !== fixture.expected.level) {
      failures.push(`fixture ${fixture.id} expected level ${fixture.expected.level}, got ${first.level}`);
    }
    if (!isAllowedRecommendedState(first.recommendedState)) {
      failures.push(`fixture ${fixture.id} produced invalid recommendedState ${String(first.recommendedState)}`);
    }
    if (first.recommendedState !== fixture.expected.recommendedState) {
      failures.push(`fixture ${fixture.id} expected state ${fixture.expected.recommendedState}, got ${first.recommendedState}`);
    }
    if (Array.isArray(first.trace) && first.trace.length === 0) {
      failures.push(`fixture ${fixture.id} produced no rule trace`);
    }
    if (Array.isArray(first.trace) && !first.trace.some((entry) => entry.ruleId === fixture.expected.ruleId)) {
      failures.push(`fixture ${fixture.id} trace does not include ${fixture.expected.ruleId}`);
    }
    if (Array.isArray(first.trace) && !first.trace.some((entry) => isRecord(entry) && entry.level === first.level)) {
      failures.push(`fixture ${fixture.id} trace does not explain produced level ${String(first.level)}`);
    }
    for (const entry of Array.isArray(first.trace) ? first.trace : []) {
      validateRiskTraceEntryShape(entry, fixture.id, failures);
      requireNonEmpty(entry.ruleId, `fixture ${fixture.id} trace.ruleId`, failures);
      requireNonEmpty(entry.message, `fixture ${fixture.id} trace.message`, failures);
    }
    fixtureResults.push({ fixtureId: fixture.id, ruleId: rule.id, decision: first });
  }

  for (const rule of pack.riskRules) {
    if (!exercisedRuleIds.has(rule.id)) {
      failures.push(`riskRule ${rule.id} is not exercised by any fixture`);
    }
  }

  return Object.freeze({
    packId: pack.id,
    packageName: pack.packageName,
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    fixtureResults: Object.freeze(fixtureResults),
    domainSignature: domainSignature(pack)
  });
}

function validateFixtureShape(
  fixture: DomainPackFixture,
  entityIds: ReadonlySet<string>,
  anchorKinds: ReadonlySet<string>,
  failures: string[]
): void {
  requireNonEmpty(fixture.id, 'fixture.id', failures);
  requireNonEmpty(fixture.title, `fixture ${fixture.id}.title`, failures);
  requireNonEmpty(fixture.source.id, `fixture ${fixture.id}.source.id`, failures);
  requireNonEmpty(fixture.claim.id, `fixture ${fixture.id}.claim.id`, failures);
  requireNonEmpty(fixture.claim.text, `fixture ${fixture.id}.claim.text`, failures);
  if (!anchorKinds.has(fixture.claim.anchor.kind)) failures.push(`fixture ${fixture.id} anchor kind ${fixture.claim.anchor.kind} is not declared`);
  if (fixture.claim.anchor.sourceId !== fixture.source.id) {
    failures.push(`fixture ${fixture.id} anchor sourceId ${fixture.claim.anchor.sourceId} does not match source id ${fixture.source.id}`);
  }
  if (!isAllowedRiskLevel(fixture.expected.level)) {
    failures.push(`fixture ${fixture.id} expected invalid level ${String(fixture.expected.level)}`);
  }
  if (!isAllowedRecommendedState(fixture.expected.recommendedState)) {
    failures.push(`fixture ${fixture.id} expected invalid recommendedState ${String(fixture.expected.recommendedState)}`);
  }
  if (fixture.claim.entityType && !entityIds.has(fixture.claim.entityType)) failures.push(`fixture ${fixture.id} entityType ${fixture.claim.entityType} is not declared`);
}

function validateRiskDecisionShape(decision: DomainRiskDecision, fixtureId: string, failures: string[]): void {
  if (!isRecord(decision)) {
    failures.push(`fixture ${fixtureId} produced invalid risk decision`);
    return;
  }

  for (const key of Object.keys(decision)) {
    if (forbiddenRiskAuthorityKeys.has(key)) {
      failures.push(`fixture ${fixtureId} produced forbidden risk authority field ${key}`);
    } else if (!allowedRiskDecisionKeys.has(key)) {
      failures.push(`fixture ${fixtureId} produced unsupported risk decision field ${key}`);
    }
  }

  if (!isAllowedRiskLevel(decision.level)) {
    failures.push(`fixture ${fixtureId} produced invalid level ${String(decision.level)}`);
  }

  if (!Array.isArray(decision.trace)) {
    failures.push(`fixture ${fixtureId} produced invalid rule trace`);
  }
}

function validateRiskTraceEntryShape(entry: unknown, fixtureId: string, failures: string[]): void {
  if (!isRecord(entry)) {
    failures.push(`fixture ${fixtureId} produced invalid trace entry`);
    return;
  }

  for (const key of Object.keys(entry)) {
    if (!allowedRiskTraceKeys.has(key)) {
      failures.push(`fixture ${fixtureId} trace produced unsupported field ${key}`);
    }
  }

  if (!isAllowedRiskLevel(entry.level)) {
    failures.push(`fixture ${fixtureId} trace produced invalid level ${String(entry.level)}`);
  }
}

function validateGreenSamplingPolicyRecommendation(policy: DomainPack['greenSamplingPolicyRecommendation'], failures: string[]): void {
  if (policy === undefined) return;

  if (policy.owner !== 'domain-pack' && policy.owner !== 'host-application') {
    failures.push('greenSamplingPolicyRecommendation.owner must be domain-pack or host-application');
  }
  if (policy.greenSampleRate !== undefined && (!Number.isFinite(policy.greenSampleRate) || policy.greenSampleRate < 0 || policy.greenSampleRate > 1)) {
    failures.push('greenSamplingPolicyRecommendation.greenSampleRate must be between 0 and 1');
  }
  if (
    policy.minGreenSampleCount !== undefined &&
    (!Number.isFinite(policy.minGreenSampleCount) || policy.minGreenSampleCount < 0 || !Number.isInteger(policy.minGreenSampleCount))
  ) {
    failures.push('greenSamplingPolicyRecommendation.minGreenSampleCount must be a non-negative integer');
  }
  if (policy.seed !== undefined) {
    requireNonEmpty(policy.seed, 'greenSamplingPolicyRecommendation.seed', failures);
  }
  requireNonEmpty(policy.reason, 'greenSamplingPolicyRecommendation.reason', failures);
}

function isAllowedRiskLevel(value: unknown): value is DomainRiskDecision['level'] {
  return value === 'red' || value === 'yellow' || value === 'green';
}

function isAllowedRecommendedState(value: unknown): value is DomainRecommendedState {
  return value === 'needs-evidence' || value === 'conflict' || value === 'aggregate-only';
}

function requireNonEmpty(value: unknown, label: string, failures: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) failures.push(`${label} must not be empty`);
}

function domainSignature(pack: DomainPack): string {
  return [
    pack.id,
    pack.labels.claimPlural,
    pack.entityTypes.map((entity) => entity.id).sort().join(','),
    pack.anchorKinds.slice().sort().join(','),
    pack.riskRules.map((rule) => rule.id).sort().join(','),
    pack.reportTemplates.map((template) => template.id).sort().join(',')
  ].join('|');
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
