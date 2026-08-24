import type { ClaimLifecycleState, ClaimValue } from './claim.js';
import type { Source, SourceAnchor, SourceAnchorKind } from './evidence.js';

export type DomainPackId = string;
export type DomainRiskLevel = 'red' | 'yellow' | 'green';
export type DomainRecommendedState = Extract<ClaimLifecycleState, 'needs-evidence' | 'conflict' | 'aggregate-only'>;

export interface DomainPackLabels {
  readonly claimSingular: string;
  readonly claimPlural: string;
  readonly reviewerNoun: string;
  readonly sourceNoun?: string;
}

export interface DomainEntityType {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface DomainRiskTraceEntry {
  readonly ruleId: string;
  readonly level: DomainRiskLevel;
  readonly message: string;
  readonly evidenceRef?: string;
}

export interface DomainRiskDecision {
  readonly level: DomainRiskLevel;
  readonly recommendedState: DomainRecommendedState;
  readonly trace: readonly DomainRiskTraceEntry[];
}

export interface DomainGreenSamplingPolicyRecommendation {
  readonly owner: 'domain-pack' | 'host-application';
  readonly greenSampleRate?: number;
  readonly minGreenSampleCount?: number;
  readonly seed?: string;
  readonly reason: string;
}

export interface DomainRiskInput {
  readonly packId: DomainPackId;
  readonly fixtureId?: string;
  readonly claim: DomainFixtureClaim;
}

export interface DomainRiskRule {
  readonly id: string;
  readonly description: string;
  readonly evaluate: (input: DomainRiskInput) => DomainRiskDecision;
}

export interface DomainReportTemplate {
  readonly id: string;
  readonly title: string;
  readonly sections: readonly string[];
}

export interface DomainFixtureClaim {
  readonly id: string;
  readonly text: string;
  readonly subject?: string;
  readonly entityType?: string;
  readonly aiValue?: ClaimValue;
  readonly sourceValue?: ClaimValue;
  readonly unit?: string;
  readonly period?: string;
  readonly anchor: SourceAnchor;
}

export interface DomainPackFixture {
  readonly id: string;
  readonly title: string;
  readonly source: Source;
  readonly claim: DomainFixtureClaim;
  readonly expected: {
    readonly ruleId: string;
    readonly level: DomainRiskLevel;
    readonly recommendedState: DomainRecommendedState;
  };
}

export interface DomainPack {
  readonly id: DomainPackId;
  readonly packageName: `@claimgate/pack-${string}`;
  readonly displayName: string;
  readonly version: string;
  readonly description: string;
  readonly labels: DomainPackLabels;
  readonly entityTypes: readonly DomainEntityType[];
  readonly anchorKinds: readonly SourceAnchorKind[];
  readonly riskRules: readonly DomainRiskRule[];
  readonly reportTemplates: readonly DomainReportTemplate[];
  readonly greenSamplingPolicyRecommendation?: DomainGreenSamplingPolicyRecommendation;
  readonly fixtures: readonly DomainPackFixture[];
}

export function fixtureAnchorKind(fixture: DomainPackFixture): SourceAnchorKind {
  return fixture.claim.anchor.kind;
}
