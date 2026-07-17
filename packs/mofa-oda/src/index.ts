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
  description: '외교부 출처 근거가 주의 또는 위험을 기록했는데도 안전하거나 안정적이라고 표현한 주장을 표시합니다.',
  evaluate({ claim, fixtureId }) {
    const matches = valuesMatch(claim);
    return decision(
      COUNTRY_SAFETY_RULE_ID,
      claim,
      fixtureId,
      { level: matches ? 'green' : 'red', recommendedState: matches ? 'needs-evidence' : 'conflict' },
      matches
        ? 'AI 안전 표현이 외교부 국가별 안전정보의 출처 근거와 일치합니다.'
        : 'AI 안전 표현이 외교부 국가별 안전정보의 경고 내용과 충돌합니다.'
    );
  }
};

const projectPeriodOrCountryMismatchRule: DomainRiskRule = {
  id: PROJECT_MISMATCH_RULE_ID,
  description: '국가·기간·기관 조합이 KOICA 출처 근거와 다른 사업 설명을 표시합니다.',
  evaluate({ claim, fixtureId }) {
    const matches = valuesMatch(claim);
    return decision(
      PROJECT_MISMATCH_RULE_ID,
      claim,
      fixtureId,
      { level: matches ? 'green' : 'yellow', recommendedState: 'needs-evidence' },
      matches
        ? 'AI 사업의 국가·기간·기관이 KOICA 출처 근거와 일치합니다.'
        : 'AI 사업의 국가·기간 또는 기관이 KOICA 출처 근거와 다릅니다.'
    );
  }
};

const termDefinitionMatchRule: DomainRiskRule = {
  id: TERM_DEFINITION_RULE_ID,
  description: 'ODA 용어 정의가 KOICA 용어사전 출처 근거와 일치하는지 확인합니다.',
  evaluate({ claim, fixtureId }) {
    const matches = valuesMatch(claim);
    return decision(
      TERM_DEFINITION_RULE_ID,
      claim,
      fixtureId,
      { level: matches ? 'green' : 'yellow', recommendedState: 'needs-evidence' },
      matches
        ? 'AI 용어 정의가 KOICA ODA 용어사전의 출처 근거와 일치하여 일치 표본 검토 대상이 됩니다.'
        : 'AI 용어 정의가 KOICA ODA 용어사전의 출처 근거와 다릅니다.'
    );
  }
};

export const mofaOdaPack: DomainPack = {
  id: 'mofa-oda',
  packageName: '@claimgate/pack-mofa-oda',
  displayName: '외교부 ODA 공공데이터 팩',
  version: '0.0.0',
  description: '외교부 국가별 안전정보, KOICA 사업, ODA 용어 주장을 검토하는 오프라인 결정론적 고정 예시 데이터 팩입니다.',
  labels: {
    claimSingular: 'ODA 공공데이터 주장',
    claimPlural: 'ODA 공공데이터 주장',
    reviewerNoun: 'ODA 근거 검토자',
    sourceNoun: '외교부 또는 KOICA 공공데이터 기록'
  },
  entityTypes: [
    { id: 'country-safety', label: '국가별 안전 안내' },
    { id: 'oda-project', label: 'ODA 협력사업' },
    { id: 'oda-term', label: 'ODA 용어사전 항목' }
  ],
  anchorKinds: ['dataset-row', 'text-span'],
  riskRules: [countrySafetyMismatchRule, projectPeriodOrCountryMismatchRule, termDefinitionMatchRule],
  reportTemplates: [
    {
      id: 'mofa-oda-review-summary',
      title: '외교부 ODA 주장 검토 요약',
      sections: ['ODA 주장', '공공데이터 출처 근거', '위험 규칙 추적', '검토자 조치']
    }
  ],
  fixtures: [
    {
      id: 'mofa-country-safety-mismatch',
      title: 'AI 안전 주장이 외교부 국가별 안전 경고와 충돌',
      source: {
        id: 'mofa-country-safety-information',
        kind: 'dataset',
        title: '외교부_국가별 안전정보',
        locator: 'https://www.data.go.kr/data/15000760/openapi.do',
        metadata: {
          publicDataId: 'DATA-001',
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only',
          sourceBoundary: '공공데이터 출처 이력 · 실시간 OpenAPI 호출 없음'
        }
      },
      claim: {
        id: 'mofa-oda-claim-001',
        text: '협력국은 제한 없는 현장 활동이 가능한 안전·안정 상태입니다.',
        subject: '협력국 안전 상태',
        entityType: 'country-safety',
        aiValue: '안전·안정',
        sourceValue: '특별여행주의보·신변안전 유의',
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
      title: 'AI 사업 국가·기간·기관이 KOICA 자료와 불일치',
      source: {
        id: 'koica-country-cooperation-projects',
        kind: 'dataset',
        title: '한국국제협력단_국가별 협력사업',
        locator: 'https://www.data.go.kr/data/15099198/openapi.do?recommendDataYn=Y',
        metadata: {
          publicDataId: 'DATA-002',
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only',
          sourceBoundary: '공공데이터 출처 이력 · 실시간 OpenAPI 호출 없음'
        }
      },
      claim: {
        id: 'mofa-oda-claim-002',
        text: 'KOICA는 국가 B에서 2022년부터 2026년까지 농촌 식수 사업을 수행합니다.',
        subject: '국가 B 농촌 식수 협력사업',
        entityType: 'oda-project',
        aiValue: '국가-b|2022-2026|koica',
        sourceValue: '국가-a|2021-2025|koica',
        period: '2022-2026',
        anchor: {
          kind: 'dataset-row',
          sourceId: 'koica-country-cooperation-projects',
          dataset: '한국국제협력단_국가별 협력사업',
          row: 7,
          recordId: 'koica-project-fixture-007',
          excerpt: '대상국: 국가 A, 사업기간: 2021-2025, 시행기관: KOICA'
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
      title: 'AI ODA 용어 정의가 KOICA 용어사전과 일치',
      source: {
        id: 'koica-oda-glossary',
        kind: 'text',
        title: '한국국제협력단_ODA 용어사전',
        locator: 'https://www.data.go.kr/data/15052909/fileData.do?recommendDataYn=Y',
        metadata: {
          publicDataId: 'DATA-003',
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only',
          sourceBoundary: '공공데이터 출처 이력 · 실행 중 파일 다운로드 없음'
        }
      },
      claim: {
        id: 'mofa-oda-claim-003',
        text: 'ODA는 개발도상국의 경제발전과 복지 증진을 목적으로 하는 정부 원조입니다.',
        subject: '공적개발원조',
        entityType: 'oda-term',
        aiValue: '개발도상국의 경제발전과 복지 증진을 목적으로 하는 정부 원조',
        sourceValue: '개발도상국의 경제발전과 복지 증진을 목적으로 하는 정부 원조',
        anchor: {
          kind: 'text-span',
          sourceId: 'koica-oda-glossary',
          startOffset: 0,
          endOffset: 34,
          excerpt: '개발도상국의 경제발전과 복지 증진을 목적으로 하는 정부 원조.'
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
