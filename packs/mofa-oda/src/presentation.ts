import type { DomainPack, DomainPackFixture, DomainRiskLevel } from '@claimgate/core/domain-pack';

export type MofaOdaRiskLabelKo = '즉시 검토' | '추가 확인' | '표본 검토';

export interface SourceSnapshot {
  readonly source: DomainPackFixture['source'];
  readonly anchor: DomainPackFixture['claim']['anchor'];
  readonly title: string;
  readonly locator: string;
  readonly accessMode: string;
  readonly boundary: string;
  readonly excerpt: string;
}

export interface MofaOdaScenarioPresentation {
  readonly fixtureId: string;
  readonly headlineKo: string;
  readonly claimLabelKo: string;
  readonly sourceLabelKo: string;
  readonly reviewerPromptKo: string;
  readonly riskLevel: DomainRiskLevel;
  readonly riskLabelKo: MofaOdaRiskLabelKo;
  readonly ruleId: string;
  readonly sourceSnapshot: SourceSnapshot;
}

export interface MofaOdaPresentation {
  readonly titleKo: string;
  readonly descriptionKo: string;
  readonly scenarios: readonly MofaOdaScenarioPresentation[];
}

interface ScenarioCopy {
  readonly headlineKo: string;
  readonly claimLabelKo: string;
  readonly sourceLabelKo: string;
  readonly reviewerPromptKo: string;
  readonly riskLabelKo: MofaOdaRiskLabelKo;
}

const SCENARIO_COPY: Readonly<Record<string, ScenarioCopy>> = Object.freeze({
  'mofa-country-safety-mismatch': Object.freeze({
    headlineKo: '안전하다는 AI 주장, 외교부 국가별 안전정보와 충돌',
    claimLabelKo: 'AI 제안: 제한 없이 현장 활동이 가능한 안전 지역',
    sourceLabelKo: '공공데이터 근거: 특별여행주의보 및 신변안전 유의 지역',
    reviewerPromptKo: '외교부 안전정보를 기준으로 주장을 정정하고 근거를 남겨 주세요.',
    riskLabelKo: '즉시 검토'
  }),
  'koica-project-period-or-country-mismatch': Object.freeze({
    headlineKo: 'KOICA 사업 국가·기간 정보에 추가 확인이 필요',
    claimLabelKo: 'AI 제안: Country B에서 2022~2026년 농촌 식수 사업 수행',
    sourceLabelKo: '공공데이터 근거: Country A, 2021~2025년, 시행기관 KOICA',
    reviewerPromptKo: '대상 국가와 사업 기간을 확인한 뒤 검증·정정·기각을 결정해 주세요.',
    riskLabelKo: '추가 확인'
  }),
  'oda-term-definition-match': Object.freeze({
    headlineKo: 'ODA 용어 정의가 공식 용어사전과 일치',
    claimLabelKo: 'AI 제안: 개발도상국의 경제발전과 복지 증진을 위한 정부 원조',
    sourceLabelKo: '공공데이터 근거: 한국국제협력단 ODA 용어사전 정의 일치',
    reviewerPromptKo: '일치 사례도 표본 검토하여 누락된 근거가 없는지 확인해 주세요.',
    riskLabelKo: '표본 검토'
  })
});

export function createMofaOdaPresentation(pack: DomainPack): MofaOdaPresentation {
  const scenarios = pack.fixtures.map((fixture) => createScenario(fixture));

  return Object.freeze({
    titleKo: '외교부 ODA 공공데이터 주장 검토',
    descriptionKo: '오프라인 fixture와 결정론적 규칙으로 AI 후보 주장과 공공데이터 근거를 비교합니다.',
    scenarios: Object.freeze(scenarios)
  });
}

function createScenario(fixture: DomainPackFixture): MofaOdaScenarioPresentation {
  const copy = SCENARIO_COPY[fixture.id];
  if (!copy) {
    throw new Error(`MOFA ODA fixture '${fixture.id}' is missing Korean presentation copy.`);
  }

  const sourceBoundary = fixture.source.metadata?.sourceBoundary;
  const accessMode = fixture.source.metadata?.accessMode;

  return Object.freeze({
    fixtureId: fixture.id,
    ...copy,
    riskLevel: fixture.expected.level,
    ruleId: fixture.expected.ruleId,
    sourceSnapshot: Object.freeze({
      source: fixture.source,
      anchor: fixture.claim.anchor,
      title: fixture.source.title,
      locator: fixture.source.locator ?? '',
      accessMode: typeof accessMode === 'string' ? accessMode : 'offline-fixture-only',
      boundary: typeof sourceBoundary === 'string' ? sourceBoundary : 'offline fixture provenance',
      excerpt: fixture.claim.anchor.excerpt ?? fixture.claim.anchor.quote ?? ''
    })
  });
}
