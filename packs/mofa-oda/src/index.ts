import type { DomainFixtureClaim, DomainPack, DomainRiskDecision, DomainRiskRule } from '@claimgate/core/domain-pack';
import { createMofaOdaPresentation } from './presentation.js';

export {
  createMofaOdaPresentation,
  type MofaOdaPresentation,
  type MofaOdaRiskLabelKo,
  type MofaOdaScenarioPresentation,
  type SourceSnapshot
} from './presentation.js';

const COUNTRY_SAFETY_RULE_ID = 'mofa.country-safety-mismatch';
const PROJECT_MISMATCH_RULE_ID = 'koica.project-period-or-country-mismatch';
const TERM_DEFINITION_RULE_ID = 'oda.term-definition-match';

function evidenceRef(claim: DomainFixtureClaim, fixtureId: string | undefined): string {
  return `${claim.anchor.sourceId}:${fixtureId ?? claim.id}`;
}

function valuesMatch(claim: DomainFixtureClaim): boolean {
  return claim.aiValue === claim.sourceValue;
}

function decision(
  ruleId: string,
  claim: DomainFixtureClaim,
  fixtureId: string | undefined,
  outcome: Omit<DomainRiskDecision, 'trace'>,
  message: string
): DomainRiskDecision {
  return {
    ...outcome,
    trace: [
      {
        ruleId,
        level: outcome.level,
        message,
        evidenceRef: evidenceRef(claim, fixtureId)
      }
    ]
  };
}

const countrySafetyMismatchRule: DomainRiskRule = {
  id: COUNTRY_SAFETY_RULE_ID,
  description: 'Flags claims that describe a country as safe or stable when the anchored MOFA safety fixture records caution or risk.',
  evaluate({ claim, fixtureId }) {
    const matches = valuesMatch(claim);
    return decision(
      COUNTRY_SAFETY_RULE_ID,
      claim,
      fixtureId,
      { level: matches ? 'green' : 'red', recommendedState: matches ? 'needs-evidence' : 'conflict' },
      matches
        ? 'AI safety wording matches the anchored MOFA country safety fixture.'
        : 'AI safety wording conflicts with the anchored MOFA country safety warning.'
    );
  }
};

const projectPeriodOrCountryMismatchRule: DomainRiskRule = {
  id: PROJECT_MISMATCH_RULE_ID,
  description: 'Flags KOICA project descriptions whose country, period, or agency tuple differs from the anchored fixture.',
  evaluate({ claim, fixtureId }) {
    const matches = valuesMatch(claim);
    return decision(
      PROJECT_MISMATCH_RULE_ID,
      claim,
      fixtureId,
      { level: matches ? 'green' : 'yellow', recommendedState: 'needs-evidence' },
      matches
        ? 'AI project country, period, and agency match the anchored KOICA fixture.'
        : 'AI project country, period, or agency differs from the anchored KOICA fixture.'
    );
  }
};

const termDefinitionMatchRule: DomainRiskRule = {
  id: TERM_DEFINITION_RULE_ID,
  description: 'Confirms whether an ODA term definition matches the anchored KOICA glossary fixture.',
  evaluate({ claim, fixtureId }) {
    const matches = valuesMatch(claim);
    return decision(
      TERM_DEFINITION_RULE_ID,
      claim,
      fixtureId,
      { level: matches ? 'green' : 'yellow', recommendedState: 'needs-evidence' },
      matches
        ? 'AI term definition matches the anchored KOICA ODA glossary fixture and remains eligible for green sampling.'
        : 'AI term definition differs from the anchored KOICA ODA glossary fixture.'
    );
  }
};

export const mofaOdaPack: DomainPack = {
  id: 'mofa-oda',
  packageName: '@claimgate/pack-mofa-oda',
  displayName: 'MOFA ODA Public Data Pack',
  version: '0.0.0',
  description: 'Offline deterministic fixture pack for reviewing MOFA country safety, KOICA project, and ODA terminology claims.',
  labels: {
    claimSingular: 'ODA public-data claim',
    claimPlural: 'ODA public-data claims',
    reviewerNoun: 'ODA evidence reviewer',
    sourceNoun: 'MOFA or KOICA public-data record'
  },
  entityTypes: [
    { id: 'country-safety', label: 'Country safety notice' },
    { id: 'oda-project', label: 'ODA cooperation project' },
    { id: 'oda-term', label: 'ODA glossary term' }
  ],
  anchorKinds: ['dataset-row', 'text-span'],
  riskRules: [countrySafetyMismatchRule, projectPeriodOrCountryMismatchRule, termDefinitionMatchRule],
  reportTemplates: [
    {
      id: 'mofa-oda-review-summary',
      title: 'MOFA ODA Claim Review Summary',
      sections: ['ODA claim', 'Public-data Source Anchor', 'Risk rule trace', 'Reviewer action']
    }
  ],
  fixtures: [
    {
      id: 'mofa-country-safety-mismatch',
      title: 'AI safety claim conflicts with MOFA country safety warning',
      source: {
        id: 'mofa-country-safety-information',
        kind: 'dataset',
        title: '외교부_국가별 안전정보',
        locator: 'https://www.data.go.kr/data/15000760/openapi.do',
        metadata: {
          publicDataId: 'DATA-001',
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only',
          sourceBoundary: 'public-data provenance; no live OpenAPI call'
        }
      },
      claim: {
        id: 'mofa-oda-claim-001',
        text: 'The partner country is currently safe and stable for unrestricted field activity.',
        subject: 'Partner country safety status',
        entityType: 'country-safety',
        aiValue: 'safe-and-stable',
        sourceValue: 'special-travel-advisory-caution',
        period: 'fixture-2026-07',
        anchor: {
          kind: 'dataset-row',
          sourceId: 'mofa-country-safety-information',
          dataset: '외교부_국가별 안전정보',
          row: 1,
          recordId: 'mofa-safety-fixture-country-a-202607',
          column: 'safety_notice',
          excerpt: '특별여행주의보 및 신변안전 유의가 필요한 지역으로 안내됨.'
        }
      },
      expected: {
        ruleId: COUNTRY_SAFETY_RULE_ID,
        level: 'red',
        recommendedState: 'conflict'
      }
    },
    {
      id: 'koica-project-period-or-country-mismatch',
      title: 'AI project country, period, or agency differs from KOICA project fixture',
      source: {
        id: 'koica-country-cooperation-projects',
        kind: 'dataset',
        title: '한국국제협력단_국가별 협력사업',
        locator: 'https://www.data.go.kr/data/15099198/openapi.do?recommendDataYn=Y',
        metadata: {
          publicDataId: 'DATA-002',
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only',
          sourceBoundary: 'public-data provenance; no live OpenAPI call'
        }
      },
      claim: {
        id: 'mofa-oda-claim-002',
        text: 'KOICA operates the Country B rural water project from 2022 through 2026.',
        subject: 'Country B rural water cooperation project',
        entityType: 'oda-project',
        aiValue: 'country-b|2022-2026|koica',
        sourceValue: 'country-a|2021-2025|koica',
        period: '2022-2026',
        anchor: {
          kind: 'dataset-row',
          sourceId: 'koica-country-cooperation-projects',
          dataset: '한국국제협력단_국가별 협력사업',
          row: 7,
          recordId: 'koica-project-fixture-007',
          excerpt: '대상국: Country A, 사업기간: 2021-2025, 시행기관: KOICA'
        }
      },
      expected: {
        ruleId: PROJECT_MISMATCH_RULE_ID,
        level: 'yellow',
        recommendedState: 'needs-evidence'
      }
    },
    {
      id: 'oda-term-definition-match',
      title: 'AI ODA term definition matches KOICA glossary fixture',
      source: {
        id: 'koica-oda-glossary',
        kind: 'text',
        title: '한국국제협력단_ODA 용어사전',
        locator: 'https://www.data.go.kr/data/15052909/fileData.do?recommendDataYn=Y',
        metadata: {
          publicDataId: 'DATA-003',
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only',
          sourceBoundary: 'public-data provenance; no file download at runtime'
        }
      },
      claim: {
        id: 'mofa-oda-claim-003',
        text: 'ODA is government aid designed to promote the economic development and welfare of developing countries.',
        subject: 'Official Development Assistance',
        entityType: 'oda-term',
        aiValue: 'government aid designed to promote the economic development and welfare of developing countries',
        sourceValue: 'government aid designed to promote the economic development and welfare of developing countries',
        anchor: {
          kind: 'text-span',
          sourceId: 'koica-oda-glossary',
          startOffset: 0,
          endOffset: 92,
          excerpt: 'Government aid designed to promote the economic development and welfare of developing countries.'
        }
      },
      expected: {
        ruleId: TERM_DEFINITION_RULE_ID,
        level: 'green',
        recommendedState: 'needs-evidence'
      }
    }
  ]
};

export const mofaOdaPresentation = createMofaOdaPresentation(mofaOdaPack);
