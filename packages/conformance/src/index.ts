import type { DomainPack, DomainPackFixture, DomainRiskDecision } from '@claimgate/core/domain-pack';

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

  const entityIds = new Set(pack.entityTypes.map((entity) => entity.id));
  const anchorKinds = new Set(pack.anchorKinds);
  const ruleById = new Map(pack.riskRules.map((rule) => [rule.id, rule]));

  for (const fixture of pack.fixtures) {
    validateFixtureShape(fixture, entityIds, anchorKinds, failures);
    const rule = ruleById.get(fixture.expected.ruleId);
    if (!rule) {
      failures.push(`fixture ${fixture.id} references missing rule ${fixture.expected.ruleId}`);
      continue;
    }

    const first = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
    const second = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
    if (stableSerialize(first) !== stableSerialize(second)) {
      failures.push(`rule ${rule.id} is not deterministic for fixture ${fixture.id}`);
    }
    if (first.level !== fixture.expected.level) {
      failures.push(`fixture ${fixture.id} expected level ${fixture.expected.level}, got ${first.level}`);
    }
    if (first.recommendedState !== fixture.expected.recommendedState) {
      failures.push(`fixture ${fixture.id} expected state ${fixture.expected.recommendedState}, got ${first.recommendedState}`);
    }
    if (first.trace.length === 0) {
      failures.push(`fixture ${fixture.id} produced no rule trace`);
    }
    if (!first.trace.some((entry) => entry.ruleId === fixture.expected.ruleId)) {
      failures.push(`fixture ${fixture.id} trace does not include ${fixture.expected.ruleId}`);
    }
    for (const entry of first.trace) {
      requireNonEmpty(entry.ruleId, `fixture ${fixture.id} trace.ruleId`, failures);
      requireNonEmpty(entry.message, `fixture ${fixture.id} trace.message`, failures);
    }
    fixtureResults.push({ fixtureId: fixture.id, ruleId: rule.id, decision: first });
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
  if (fixture.claim.entityType && !entityIds.has(fixture.claim.entityType)) failures.push(`fixture ${fixture.id} entityType ${fixture.claim.entityType} is not declared`);
}

function requireNonEmpty(value: string, label: string, failures: string[]): void {
  if (value.trim().length === 0) failures.push(`${label} must not be empty`);
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
