import {
  applyReviewerCorrection,
  applyRiskDisposition,
  attachAnchor,
  claimGateCoreInfo,
  createEvidencePack,
  createExtractedClaim,
  evidencePackToJson,
  listCoreInvariants,
  projectEvidencePackToGraph,
  renderEvidenceReportMarkdown,
  sourceAnchorExcerpt,
  sourceAnchorId,
  transitionClaim,
  type Claim,
  type ClaimValue,
  type Reviewer
} from '@claimgate/core';
import type { DomainPack } from '@claimgate/core/domain-pack';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';

const packs: Record<string, DomainPack> = {
  [civicDataPack.id]: civicDataPack,
  [healthDataPack.id]: healthDataPack,
  [mofaOdaPack.id]: mofaOdaPack
};

const fixedNow = () => '2026-07-08T00:00:00.000Z';
const reviewer: Reviewer = { id: 'judge-demo-reviewer', displayName: '판정 데모 검토자' };

export type DemoReviewDecision = 'pending' | 'verified' | 'corrected' | 'rejected';

export interface ReviewRecord {
  readonly decision: Exclude<DemoReviewDecision, 'pending'>;
  readonly correctedValue?: ClaimValue;
  readonly reason: string;
  readonly reviewerId: string;
  readonly decidedAt: string;
}

export type ReviewRecordMap = Readonly<Record<string, ReviewRecord>>;

export interface EvidenceExport {
  readonly itemCount: number;
  readonly json: string;
  readonly markdown: string;
}

export interface ReviewQueueItem {
  readonly fixtureId: string;
  readonly claimId: string;
  readonly title: string;
  readonly subject: string;
  readonly claimText: string;
  readonly aiValue: ClaimValue | undefined;
  readonly sourceValue: ClaimValue | undefined;
  readonly sourceTitle: string;
  readonly sourceLocator: string;
  readonly sourceAnchorId: string;
  readonly sourceExcerpt: string;
  readonly sourceBoundary: string;
  readonly ruleId: string;
  readonly ruleMessage: string;
  readonly riskLevel: 'red' | 'yellow' | 'green';
  readonly recommendedState: string;
  readonly initialDecision: DemoReviewDecision;
  readonly evidenceEligible: boolean;
}

export function reviewDecisionState(decision: DemoReviewDecision): { readonly label: string; readonly evidenceEligible: boolean } {
  const states = {
    pending: { label: '검토 대기', evidenceEligible: false },
    verified: { label: '검증 완료', evidenceEligible: true },
    corrected: { label: '정정 완료', evidenceEligible: true },
    rejected: { label: '기각', evidenceEligible: false }
  } as const;

  return states[decision];
}

function riskLevelLabel(level: string): string {
  return ({ red: '위험', yellow: '주의', green: '일치' } as const)[level as 'red' | 'yellow' | 'green'] ?? level;
}

function reviewStateLabel(state: string): string {
  return ({
    pending: '검토 대기',
    verified: '검증 완료',
    corrected: '정정 완료',
    rejected: '기각',
    conflict: '충돌',
    'needs-evidence': '근거 필요',
    'aggregate-only': '집계 전용'
  } as const)[state as 'pending' | 'verified' | 'corrected' | 'rejected' | 'conflict' | 'needs-evidence' | 'aggregate-only'] ?? state;
}

function localizeEvidenceMarkdown(markdown: string): string {
  return markdown
    .replaceAll('Projection source: Evidence Pack', '투영 출처: 근거 묶음')
    .replaceAll('Projection boundary: verified/corrected reviewer decisions only', '투영 범위: 검증 완료/정정 완료로 판정된 주장만 포함')
    .replaceAll('Generated:', '생성 시각:')
    .replaceAll('Evidence items:', '근거 항목:')
    .replaceAll(': corrected', ' · 검토자 판정: 정정 완료')
    .replaceAll(': verified', ' · 검토자 판정: 검증 완료')
    .replaceAll('- Claim:', '- 주장:')
    .replaceAll('- Value:', '- 값:')
    .replaceAll('- Source Anchor:', '- 출처 근거:')
    .replaceAll('- Reviewer:', '- 검토자:')
    .replaceAll('- Correction:', '- 정정 이력:')
    .replaceAll('- Audit events:', '- 감사 이벤트:');
}

export function createReviewRecord(
  decision: Exclude<DemoReviewDecision, 'pending'>,
  input: { readonly correctedValue?: ClaimValue; readonly reason?: string }
): ReviewRecord {
  const correctedValue = typeof input.correctedValue === 'string' ? input.correctedValue.trim() : input.correctedValue;
  const reason = input.reason?.trim() ?? '';
  if (decision === 'corrected' && (correctedValue === undefined || correctedValue === null || correctedValue === '')) {
    throw new Error('정정 판정에는 정정 값이 필요합니다.');
  }
  if (!reason) {
    throw new Error(`${decision === 'corrected' ? '정정' : '검토자'} 판정에는 검토 사유가 필요합니다.`);
  }

  return Object.freeze({
    decision,
    ...(correctedValue !== undefined ? { correctedValue } : {}),
    reason,
    reviewerId: '데모-검토자',
    decidedAt: fixedNow()
  });
}

export function coerceCorrectionValue(draft: string, sourceValue: ClaimValue | undefined): ClaimValue {
  if (typeof sourceValue === 'number') {
    const numeric = Number(draft);
    if (!Number.isFinite(numeric)) throw new Error('숫자 정정 값은 유한한 수여야 합니다.');
    return numeric;
  }
  if (typeof sourceValue === 'boolean') {
    const normalized = draft.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') throw new Error('불리언 정정 값은 true 또는 false여야 합니다.');
    return normalized === 'true';
  }
  return draft;
}

export function appendReviewRecord(records: ReviewRecordMap, fixtureId: string, record: ReviewRecord): ReviewRecordMap {
  if (records[fixtureId]) {
    throw new Error(`고정 예시 데이터 '${fixtureId}'에는 이미 최종 검토 기록이 있습니다. 변경하려면 검토 실행을 초기화하세요.`);
  }
  return Object.freeze({ ...records, [fixtureId]: record });
}

export function buildEvidenceExport(packId: string, records: ReviewRecordMap): EvidenceExport {
  const pack = packs[packId];
  if (!pack) {
    throw new Error(`알 수 없는 팩 '${packId}'입니다. 사용 가능한 팩: ${Object.keys(packs).join(', ')}`);
  }
  const reviewedClaims = pack.fixtures.flatMap((fixture) => {
    const record = records[fixture.id];
    if (!record) return [];
    const rule = pack.riskRules.find((candidate) => candidate.id === fixture.expected.ruleId);
    if (!rule) throw new Error(`고정 예시 데이터 '${fixture.id}'가 존재하지 않는 규칙 '${fixture.expected.ruleId}'을 참조합니다.`);
    const risk = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
    const anchored = attachAnchor(
      createExtractedClaim({
        id: fixture.claim.id,
        text: fixture.claim.text,
        subject: fixture.claim.subject,
        aiValue: fixture.claim.aiValue,
        actor: { kind: 'system', id: 'offline-ai-curator' },
        now: fixedNow
      }),
      {
        anchor: fixture.claim.anchor,
        sourceValue: fixture.claim.sourceValue,
        actor: { kind: 'system', id: 'fixture-anchorer' },
        reason: '오프라인 고정 예시 데이터가 출처 근거를 제공했으며 실시간 API, OCR, 모델 호출은 사용하지 않았습니다.',
        now: fixedNow
      }
    );
    const dispositioned = applyRiskDisposition({
      claim: anchored,
      recommendedState: risk.recommendedState,
      reason: `결정론적 도메인 규칙 ${rule.id}: ${risk.trace[0]?.message ?? rule.description}`,
      now: fixedNow
    });
    const recordReviewer: Reviewer = { id: record.reviewerId, displayName: '데모 검토자' };
    if (record.decision === 'corrected') {
      return [applyReviewerCorrection({ claim: dispositioned, reviewer: recordReviewer, correctedValue: record.correctedValue ?? null, reason: record.reason, now: fixedNow })];
    }
    return [transitionClaim(dispositioned, { to: record.decision, reviewer: recordReviewer, reason: record.reason, now: fixedNow })];
  });
  const evidencePack = createEvidencePack({
    id: `${pack.id}-offline-demo-evidence-pack`,
    title: pack.reportTemplates[0]?.title ?? `${pack.displayName} 근거 묶음`,
    claims: reviewedClaims,
    sources: pack.fixtures.map((fixture) => fixture.source),
    generatedAt: fixedNow(),
    metadata: {
      packId: pack.id,
      offline: true,
      deterministic: true,
      fixtureFirst: true,
      aiBoundary: 'AI 후보 제안은 고정 예시 데이터에 근거하며 실시간 모델 호출은 사용하지 않았습니다.'
    }
  });
  const markdown = localizeEvidenceMarkdown([
    '> 오프라인 · 결정론적 · 고정 예시 데이터 우선',
    '> AI 후보는 사전 생성된 고정 예시 데이터입니다. 실시간 LLM, API, OCR, 서버, 데이터베이스, 인증은 사용하지 않습니다.',
    '',
    renderEvidenceReportMarkdown(evidencePack, { title: evidencePack.title, itemLabel: pack.labels.claimSingular, includeAudit: true })
  ].join('\n'));

  return Object.freeze({ itemCount: evidencePack.items.length, json: evidencePackToJson(evidencePack), markdown });
}

export function buildReviewQueue(packId: string): readonly ReviewQueueItem[] {
  const pack = packs[packId];
  if (!pack) {
    throw new Error(`알 수 없는 팩 '${packId}'입니다. 사용 가능한 팩: ${Object.keys(packs).join(', ')}`);
  }

  return Object.freeze(
    pack.fixtures.map((fixture) => {
      const rule = pack.riskRules.find((candidate) => candidate.id === fixture.expected.ruleId);
      if (!rule) throw new Error(`고정 예시 데이터 '${fixture.id}'가 존재하지 않는 규칙 '${fixture.expected.ruleId}'을 참조합니다.`);
      const decision = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
      const initialDecision: DemoReviewDecision = 'pending';

      return Object.freeze({
        fixtureId: fixture.id,
        claimId: fixture.claim.id,
        title: fixture.title,
        subject: fixture.claim.subject ?? fixture.claim.id,
        claimText: fixture.claim.text,
        aiValue: fixture.claim.aiValue,
        sourceValue: fixture.claim.sourceValue,
        sourceTitle: fixture.source.title,
        sourceLocator: fixture.source.locator ?? '',
        sourceAnchorId: sourceAnchorId(fixture.claim.anchor),
        sourceExcerpt: sourceAnchorExcerpt(fixture.claim.anchor) ?? '고정 예시 데이터 출처 근거 기록',
        sourceBoundary: String(fixture.source.metadata?.sourceBoundary ?? '오프라인 고정 예시 데이터 출처 이력'),
        ruleId: rule.id,
        ruleMessage: decision.trace[0]?.message ?? rule.description,
        riskLevel: decision.level,
        recommendedState: decision.recommendedState,
        initialDecision,
        evidenceEligible: reviewDecisionState(initialDecision).evidenceEligible
      });
    })
  );
}

export function defaultPackId(hostname: string | undefined): string {
  return hostname?.toLowerCase() === 'mofa.warvis.org' ? mofaOdaPack.id : civicDataPack.id;
}

export interface DemoSummary {
  readonly corePackage: string;
  readonly packId: string;
  readonly packName: string;
  readonly claimLabel: string;
  readonly fixtureId: string;
  readonly riskLevel: string;
  readonly recommendedState: string;
  readonly reportTemplate: string;
  readonly storyTitle: string;
  readonly aiBoundary: string;
  readonly sourceAnchorId: string;
  readonly sourceValue: string;
  readonly reviewerDecision: string;
  readonly correctedValue: string;
  readonly evidencePackTitle: string;
  readonly evidenceItemCount: number;
  readonly reportIncludesCorrection: boolean;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly storyBeats: readonly string[];
}

export function runDemo(packId: string): DemoSummary {
  const pack = packs[packId];
  if (!pack) {
    throw new Error(`알 수 없는 팩 '${packId}'입니다. 사용 가능한 팩: ${Object.keys(packs).join(', ')}`);
  }

  const fixture = pack.fixtures[0];
  const rule = fixture ? pack.riskRules.find((candidate) => candidate.id === fixture.expected.ruleId) : undefined;
  if (!fixture || !rule) {
    throw new Error(`팩 '${pack.id}'에 실행 가능한 고정 예시 데이터 또는 예상 규칙이 없습니다.`);
  }

  const decision = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
  const anchored = attachAnchor(
    createExtractedClaim({
      id: fixture.claim.id,
      text: fixture.claim.text,
      subject: fixture.claim.subject,
      aiValue: fixture.claim.aiValue,
      actor: { kind: 'system', id: 'offline-ai-curator' },
      now: fixedNow
    }),
    {
      anchor: fixture.claim.anchor,
      sourceValue: fixture.claim.sourceValue,
      actor: { kind: 'system', id: 'fixture-anchorer' },
      reason: '오프라인 고정 예시 데이터가 출처 근거를 제공했으며 OCR, 파서, LLM은 사용하지 않았습니다.',
      now: fixedNow
    }
  );
  const riskDispositioned = applyRiskDisposition({
    claim: anchored,
    recommendedState: decision.recommendedState,
    reason: `결정론적 도메인 규칙 ${rule.id}: ${decision.trace[0]?.message ?? rule.description}`,
    now: fixedNow
  });
  const reviewed = reviewForDemo(riskDispositioned, fixture.claim.sourceValue);
  const evidencePack = createEvidencePack({
    id: `${pack.id}-judges-demo-evidence-pack`,
    title: `${pack.displayName} 판정 데모 근거 묶음`,
    claims: [reviewed],
    sources: [fixture.source],
    generatedAt: fixedNow(),
    metadata: {
      packId: pack.id,
      fixtureId: fixture.id,
      offline: true,
      deterministic: true
    }
  });
  const reportMarkdown = renderEvidenceReportMarkdown(evidencePack, {
    title: pack.reportTemplates[0]?.title ?? evidencePack.title,
    itemLabel: pack.labels.claimSingular,
    includeAudit: true
  });
  const graph = projectEvidencePackToGraph(evidencePack);

  return {
    corePackage: claimGateCoreInfo.packageName,
    packId: pack.id,
    packName: pack.displayName,
    claimLabel: pack.labels.claimPlural,
    fixtureId: fixture.id,
    riskLevel: decision.level,
    recommendedState: decision.recommendedState,
    reportTemplate: pack.reportTemplates[0]?.title ?? '보고서 서식 없음',
    storyTitle: storyTitle(reviewed.state),
    aiBoundary: 'AI는 후보만 제안하고 결정론적 규칙과 사람 검토자가 판정했습니다.',
    sourceAnchorId: sourceAnchorId(fixture.claim.anchor),
    sourceValue: String(fixture.claim.sourceValue ?? ''),
    reviewerDecision: reviewed.state,
    correctedValue: String(reviewed.correction?.correctedValue ?? reviewed.sourceValue ?? reviewed.aiValue ?? ''),
    evidencePackTitle: evidencePack.title,
    evidenceItemCount: evidencePack.items.length,
    reportIncludesCorrection: reportMarkdown.includes('Correction:'),
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    storyBeats: Object.freeze([
      `1. AI 후보 제안: ${fixture.claim.text}`,
      `2. 출처 근거 연결: ${sourceAnchorId(fixture.claim.anchor)}`,
      `3. 결정론적 규칙 추적: ${rule.id} => ${riskLevelLabel(decision.level)}/${reviewStateLabel(decision.recommendedState)}`,
      `4. 사람 검토자 판정: ${reviewStateLabel(reviewed.state)}`,
      `5. 근거 묶음이 검증·정정된 주장 ${evidencePack.items.length}건을 보고서와 그래프에 투영합니다.`
    ])
  };
}

export function formatDemo(summary: DemoSummary): string {
  return [
    `ClaimGate 데모: ${summary.corePackage}`,
    `이야기: ${summary.storyTitle}`,
    `팩: ${summary.packName} (${summary.packId})`,
    `주장: ${summary.claimLabel}`,
    `고정 예시 데이터: ${summary.fixtureId}`,
    `위험도: ${riskLevelLabel(summary.riskLevel)} -> ${reviewStateLabel(summary.recommendedState)}`,
    `AI 경계: ${summary.aiBoundary}`,
    `출처 근거: ${summary.sourceAnchorId}`,
    `검토자 판정: ${reviewStateLabel(summary.reviewerDecision)}`,
    `정정·출처 값: ${summary.correctedValue}`,
    `근거 묶음 항목: ${summary.evidenceItemCount}`,
    `보고서: ${summary.reportTemplate}`,
    `그래프 노드: ${summary.graphNodeCount}, 엣지: ${summary.graphEdgeCount}`,
    `불변 조건: ${listCoreInvariants().join(', ')}`,
    ...summary.storyBeats,
    '오프라인 결정론적 데모가 완료되었습니다.'
  ].join('\n');
}

function reviewForDemo(claim: Claim, correctedValue: unknown): Claim {
  if (claim.state === 'conflict') {
    return applyReviewerCorrection({
      claim,
      reviewer,
      correctedValue: correctedValue as ClaimValue,
      reason: '검토자가 AI 값을 출처 근거 값으로 정정했습니다.',
      now: fixedNow
    });
  }

  return transitionClaim(claim, {
    to: 'verified',
    reviewer,
    reason: '검토자가 결정론적 위험 분류 후 출처 근거가 연결된 주장을 검증했습니다.',
    now: fixedNow
  });
}

function storyTitle(reviewerDecision: string): string {
  return reviewerDecision === 'corrected'
    ? '잘못된 AI 주장 → 위험 대기열 → 검토자 정정 → 근거 묶음'
    : '위험 대기열 → 검토자 검증 → 근거 묶음';
}

function cliPackId(argv: readonly string[]): string {
  const packFlag = argv.find((arg) => arg.startsWith('--pack='));
  if (packFlag) return packFlag.slice('--pack='.length);
  const packIndex = argv.indexOf('--pack');
  if (packIndex >= 0 && argv[packIndex + 1]) return argv[packIndex + 1]!;
  return civicDataPack.id;
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  console.log(formatDemo(runDemo(cliPackId(process.argv.slice(2)))));
}
