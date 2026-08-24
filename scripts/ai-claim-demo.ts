import {
  applyReviewerCorrection,
  applyRiskDisposition,
  acceptSourceAnchor,
  buildExtractionProvenanceMetadata,
  createEvidencePack,
  createExtractedClaimFromCandidate,
  evidencePackToJson,
  extractionProvenanceActorId,
  extractionProvenanceAuditReason,
  extractCandidateClaims,
  projectEvidencePackToGraph,
  renderEvidenceReportMarkdown,
  sourceAnchorId,
  type CandidateClaim,
  type ClaimValue,
  type Reviewer
} from '@claimgate/core';
import {
  DEFAULT_LOCAL_GEMMA_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  LOCAL_GEMMA_TUNING_DATASET_VERSION,
  LOCAL_SPARSE_VECTOR_RAG_MODE,
  NO_REPO_TUNING_ARTIFACT_STATUS,
  assessRagGrounding,
  assertRagGroundingForExtraction,
  buildPersistentRagIndex,
  createOllamaGemmaClaimExtractor,
  searchPersistentRagIndex,
  type RagDocument
} from '@claimgate/ai-local';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';

const fixedNow = () => '2026-07-08T00:00:00.000Z';
const reviewer: Reviewer = { id: 'demo-human-reviewer', displayName: '데모 검토자' };
const defaultLocalModel = DEFAULT_LOCAL_GEMMA_MODEL;
const defaultOllamaBaseUrl = DEFAULT_OLLAMA_BASE_URL;
const ragRetrievalMode = LOCAL_SPARSE_VECTOR_RAG_MODE;
const tuningArtifactStatus = NO_REPO_TUNING_ARTIFACT_STATUS;

const DEFAULT_SOURCE_TEXT = `AI 답변: 협력국 A는 2026년에 제한 없는 현장 활동이 가능한 안전·안정 상태입니다. KOICA는 국가 B에서 2022년부터 2026년까지 농촌 식수 사업을 수행합니다. ODA는 개발도상국의 경제발전과 복지 증진을 목적으로 하는 정부 원조입니다.

출처 자료:
[외교부_국가별 안전정보] 협력국 A: 특별여행주의보·신변안전 유의가 필요한 지역으로 안내됨.
[한국국제협력단_국가별 협력사업] 대상국: 국가 A, 사업기간: 2021-2025, 시행기관: KOICA.
[한국국제협력단_ODA 용어사전] ODA는 개발도상국의 경제발전과 복지 증진을 목적으로 하는 정부 원조.`;

export type AiDemoProvider = 'auto' | 'ollama';

export interface AiClaimDemoOptions {
  readonly provider?: AiDemoProvider;
  readonly sourceText?: string;
  readonly model?: string;
  readonly ollamaBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface AiClaimDemoSummary {
  readonly provider: 'ollama';
  readonly model: string;
  readonly ragRetrievalMode: string;
  readonly tuningArtifactStatus: string;
  readonly ragDocumentIds: readonly string[];
  readonly candidateCount: number;
  readonly selectedCandidateText: string;
  readonly sourceAnchorId: string;
  readonly ruleId: string;
  readonly riskLevel: string;
  readonly recommendedState: string;
  readonly reviewerDecision: string;
  readonly evidenceItemCount: number;
  readonly reportMarkdown: string;
  readonly evidenceJson: string;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
}


export async function runAiClaimDemo(options: AiClaimDemoOptions = {}): Promise<AiClaimDemoSummary> {
  const sourceText = options.sourceText ?? DEFAULT_SOURCE_TEXT;
  const ragIndex = buildPersistentRagIndex({
    id: 'mofa-oda-local-rag-index',
    documents: mofaRagCorpus(),
    createdAt: fixedNow()
  });
  const ragHits = searchPersistentRagIndex({ index: ragIndex, query: sourceText, limit: 3 });
  assertRagGroundingForExtraction(assessRagGrounding({ ragHits, noHitPolicy: 'fail-extraction' }));
  const provider = resolveProvider(options.provider ?? envProvider());
  const model = options.model ?? process.env.CLAIMGATE_LOCAL_LLM_MODEL ?? defaultLocalModel;
  const extractionProvenance = {
    provider,
    model,
    adapterId: 'claimgate-local-gemma4-12b-rag-extractor',
    promptVersion: LOCAL_GEMMA_TUNING_DATASET_VERSION,
    ragDocumentIds: ragHits.map((hit) => hit.id),
    ragRetrievalMode,
    tuningArtifactStatus
  };
  const extractor = createOllamaGemmaClaimExtractor({
    model,
    ragHits,
    baseUrl: options.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? defaultOllamaBaseUrl,
    fetchImpl: options.fetchImpl,
    sourceTextFallback: sourceText
  });
  const candidates = await extractCandidateClaims(extractor, { id: 'demo-source' });
  if (candidates.length === 0) throw new Error('로컬 LLM 후보 추출 결과가 비었습니다.');

  const candidate = pickMofaSafetyCandidate(candidates);
  const fixture = mofaOdaPack.fixtures.find((item) => item.id === 'mofa-country-safety-mismatch') ?? mofaOdaPack.fixtures[0];
  if (!fixture) throw new Error('mofa-oda 팩에 실행 가능한 fixture가 없습니다.');
  const rule = mofaOdaPack.riskRules.find((item) => item.id === fixture.expected.ruleId);
  if (!rule) throw new Error(`fixture가 참조하는 규칙 '${fixture.expected.ruleId}'을 찾을 수 없습니다.`);

  const extracted = createExtractedClaimFromCandidate(candidate, {
    actor: { kind: 'system', id: extractionProvenanceActorId(extractionProvenance) },
    reason: extractionProvenanceAuditReason(extractionProvenance),
    now: fixedNow
  });
  const anchored = acceptSourceAnchor({
    claim: extracted,
    anchor: fixture.claim.anchor,
    sourceValue: fixture.claim.sourceValue,
    reviewer,
    reason: '검토자가 RAG로 회수한 공공데이터 출처 앵커를 후보 주장에 연결했습니다.',
    now: fixedNow
  });
  const domainClaim = {
    ...fixture.claim,
    id: anchored.id,
    text: anchored.text,
    subject: anchored.subject ?? fixture.claim.subject,
    aiValue: anchored.aiValue ?? fixture.claim.aiValue,
    sourceValue: anchored.sourceValue ?? fixture.claim.sourceValue,
    anchor: fixture.claim.anchor
  };
  const risk = rule.evaluate({ packId: mofaOdaPack.id, fixtureId: fixture.id, claim: domainClaim });
  const dispositioned = applyRiskDisposition({
    claim: anchored,
    recommendedState: risk.recommendedState,
    reason: `결정론적 도메인 규칙 ${rule.id}: ${risk.trace[0]?.message ?? rule.description}`,
    now: fixedNow
  });
  const reviewed = applyReviewerCorrection({
    claim: dispositioned,
    reviewer,
    correctedValue: fixture.claim.sourceValue as ClaimValue,
    reason: '검토자가 AI 후보 값을 외교부 출처 근거 값으로 정정했습니다.',
    now: fixedNow
  });
  const evidencePack = createEvidencePack({
    id: 'mofa-oda-local-gemma-rag-evidence-pack',
    title: '외교부 ODA 로컬 Gemma RAG 후보 추출 데모 근거 묶음',
    claims: [reviewed],
    sources: [fixture.source],
    generatedAt: fixedNow(),
    metadata: {
      ...buildExtractionProvenanceMetadata(extractionProvenance),
      packId: mofaOdaPack.id,
      fixtureId: fixture.id
    }
  });
  const reportMarkdown = renderEvidenceReportMarkdown(evidencePack, {
    title: mofaOdaPack.reportTemplates[0]?.title ?? evidencePack.title,
    itemLabel: mofaOdaPack.labels.claimSingular,
    includeAudit: true
  });
  const graph = projectEvidencePackToGraph(evidencePack);

  return Object.freeze({
    provider,
    model,
    ragRetrievalMode,
    tuningArtifactStatus,
    ragDocumentIds: Object.freeze(ragHits.map((hit) => hit.id)),
    candidateCount: candidates.length,
    selectedCandidateText: candidate.text,
    sourceAnchorId: sourceAnchorId(fixture.claim.anchor),
    ruleId: rule.id,
    riskLevel: risk.level,
    recommendedState: risk.recommendedState,
    reviewerDecision: reviewed.state,
    evidenceItemCount: evidencePack.items.length,
    reportMarkdown,
    evidenceJson: evidencePackToJson(evidencePack),
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length
  });
}

export function formatAiClaimDemo(summary: AiClaimDemoSummary): string {
  return [
    'ClaimGate Local Gemma 4 12B RAG 데모',
    `로컬 후보 추출기: ${summary.provider} (${summary.model})`,
    `RAG 회수 문서: ${summary.ragDocumentIds.join(', ')}`,
    `RAG 구현: ${summary.ragRetrievalMode}`,
    `튜닝 산출물: ${summary.tuningArtifactStatus}`,
    `후보 주장 수: ${summary.candidateCount}`,
    `선택한 후보: ${summary.selectedCandidateText}`,
    `출처 앵커: ${summary.sourceAnchorId}`,
    `결정론적 규칙: ${summary.ruleId} => ${riskLabel(summary.riskLevel)}/${stateLabel(summary.recommendedState)}`,
    'AI 권한: 후보 제안 전용; 위험 판정, 검증, 투영 권한 없음',
    `검토자 판정: ${stateLabel(summary.reviewerDecision)}`,
    `근거 묶음 항목: ${summary.evidenceItemCount}`,
    `그래프 노드/엣지: ${summary.graphNodeCount}/${summary.graphEdgeCount}`,
    'Evidence Pack JSON과 Markdown report가 생성되었습니다.'
  ].join('\n');
}

function envProvider(): AiDemoProvider {
  const value = process.env.CLAIMGATE_LOCAL_LLM_PROVIDER ?? process.env.CLAIMGATE_AI_PROVIDER;
  if (value === 'ollama' || value === 'auto') return value;
  return 'auto';
}

function resolveProvider(provider: AiDemoProvider): Exclude<AiDemoProvider, 'auto'> {
  if (provider === 'ollama') return 'ollama';
  return 'ollama';
}

function mofaRagCorpus(): readonly RagDocument[] {
  return Object.freeze(mofaOdaPack.fixtures.map((fixture) => Object.freeze({
    id: fixture.source.id,
    title: fixture.source.title,
    text: [
      fixture.title,
      fixture.claim.text,
      `AI 값: ${String(fixture.claim.aiValue ?? '')}`,
      `출처 값: ${String(fixture.claim.sourceValue ?? '')}`,
      fixture.claim.anchor.excerpt ?? fixture.claim.anchor.quote ?? '',
      fixture.source.locator ?? '',
      Object.entries(fixture.source.metadata ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join('\n')
    ].filter(Boolean).join('\n')
  })));
}

function pickMofaSafetyCandidate(candidates: readonly CandidateClaim[]): CandidateClaim {
  const candidate = candidates.find((item) => /안전|여행|현장|안정/.test(item.text) || /안전/.test(item.subject ?? ''));
  if (!candidate) {
    throw new Error('No MOFA safety candidate matched RAG safety scenario; refusing to attach MOFA safety fixture anchor to an unrelated AI candidate.');
  }
  return candidate;
}

function riskLabel(value: string): string {
  return value === 'red' ? '위험' : value === 'yellow' ? '주의' : value === 'green' ? '일치' : value;
}

function stateLabel(value: string): string {
  return ({ conflict: '충돌', corrected: '정정 완료', verified: '검증 완료', rejected: '기각', 'needs-evidence': '근거 필요', 'aggregate-only': '집계 전용' } as Record<string, string>)[value] ?? value;
}

function parseArgs(argv: readonly string[]): AiClaimDemoOptions {
  const options: { provider?: AiDemoProvider; sourceText?: string; model?: string; ollamaBaseUrl?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--provider') {
      options.provider = parseProvider(argv[++index]);
    } else if (arg.startsWith('--provider=')) {
      options.provider = parseProvider(arg.slice('--provider='.length));
    } else if (arg === '--model') {
      options.model = argv[++index];
    } else if (arg.startsWith('--model=')) {
      options.model = arg.slice('--model='.length);
    } else if (arg === '--ollama-base-url') {
      options.ollamaBaseUrl = argv[++index];
    } else if (arg.startsWith('--ollama-base-url=')) {
      options.ollamaBaseUrl = arg.slice('--ollama-base-url='.length);
    } else if (arg === '--text') {
      options.sourceText = argv[++index];
    } else if (arg.startsWith('--text=')) {
      options.sourceText = arg.slice('--text='.length);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseProvider(value: string | undefined): AiDemoProvider {
  if (value === 'auto' || value === 'ollama') return value;
  throw new Error('--provider must be auto or ollama');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAiClaimDemo(parseArgs(process.argv.slice(2)))
    .then((summary) => {
      console.log(formatAiClaimDemo(summary));
      console.log('\n--- Evidence Pack JSON ---');
      console.log(summary.evidenceJson);
      console.log('\n--- Report Markdown ---');
      console.log(summary.reportMarkdown);
    })
    .catch((error: unknown) => {
      console.error('ClaimGate Local Gemma RAG demo failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
