export type GuidedDemoStepId = 'candidate' | 'source-anchor' | 'human-review' | 'evidence-pack';

export interface GuidedDemoStartConfig {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly primaryAction: 'guided';
  readonly primaryLabel: string;
  readonly secondaryAction: 'free-exploration';
  readonly secondaryLabel: string;
}

export interface AiCuratorFixturePipeline {
  readonly input: '사전 생성 오프라인 고정 예시 데이터';
  readonly process: '후보 주장 추출 모의 실행';
  readonly output: '후보 주장 제안';
  readonly authority: '제안 전용';
  readonly boundary: string;
}

export interface GuidedDemoStep {
  readonly id: GuidedDemoStepId;
  readonly order: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly shortLabel: string;
  readonly instruction: string;
  readonly target: 'review-queue' | 'source-comparison' | 'reviewer-decision' | 'evidence-preview';
}

export const GUIDED_DEMO_START: Readonly<GuidedDemoStartConfig> = Object.freeze({
  eyebrow: 'ClaimGate 검토 가이드',
  title: '근거 중심 검토 흐름을 따라가세요',
  description: '오프라인 고정 예시 데이터의 후보 주장부터 사람의 판정과 근거 묶음까지 네 단계로 확인합니다.',
  primaryAction: 'guided',
  primaryLabel: '가이드 데모 시작',
  secondaryAction: 'free-exploration',
  secondaryLabel: '자유롭게 둘러보기'
});

export const AI_CURATOR_FIXTURE_PIPELINE: Readonly<AiCuratorFixturePipeline> = Object.freeze({
  input: '사전 생성 오프라인 고정 예시 데이터',
  process: '후보 주장 추출 모의 실행',
  output: '후보 주장 제안',
  authority: '제안 전용',
  boundary: 'AI는 후보만 제안하며, 결정론적 규칙과 사람 검토자가 판정합니다.'
});

export const GUIDED_DEMO_STEPS: readonly Readonly<GuidedDemoStep>[] = Object.freeze([
  Object.freeze({
    id: 'candidate',
    order: 1,
    title: '후보 주장 확인',
    shortLabel: '주장 선택',
    instruction: 'AI 후보 제안기가 만든 고정 예시 데이터 기반 후보를 검토 대기열에서 선택합니다.',
    target: 'review-queue'
  }),
  Object.freeze({
    id: 'source-anchor',
    order: 2,
    title: '출처 근거 비교',
    shortLabel: '근거 비교',
    instruction: '후보 값과 출처 근거 값을 나란히 비교합니다.',
    target: 'source-comparison'
  }),
  Object.freeze({
    id: 'human-review',
    order: 3,
    title: '사람의 판정 기록',
    shortLabel: '사람 판정',
    instruction: '검토자가 판정과 사유를 기록합니다. AI와 규칙은 최종 판정을 내리지 않습니다.',
    target: 'reviewer-decision'
  }),
  Object.freeze({
    id: 'evidence-pack',
    order: 4,
    title: '근거 묶음 확인',
    shortLabel: '근거 묶음',
    instruction: '검증 또는 정정되어 투영 가능한 주장만 결과물에 포함되는지 확인합니다.',
    target: 'evidence-preview'
  })
]);

export type GuidedDemoMode = 'start' | 'guided' | 'free-exploration';
export type GuidedDemoExitReason = 'skipped' | 'completed' | 'chosen' | null;

export interface GuidedDemoState {
  readonly mode: GuidedDemoMode;
  readonly currentStepId: GuidedDemoStepId | null;
  readonly completedStepIds: readonly GuidedDemoStepId[];
  readonly exitReason: GuidedDemoExitReason;
}

export type GuidedDemoAction =
  | { readonly type: 'start' }
  | { readonly type: 'next' }
  | { readonly type: 'skip' }
  | { readonly type: 'explore' }
  | { readonly type: 'reset' };

function state(input: GuidedDemoState): Readonly<GuidedDemoState> {
  return Object.freeze({
    ...input,
    completedStepIds: Object.freeze([...input.completedStepIds])
  });
}

export function createGuidedDemoState(): Readonly<GuidedDemoState> {
  return state({
    mode: 'start',
    currentStepId: null,
    completedStepIds: [],
    exitReason: null
  });
}

export function currentGuidedDemoStep(current: GuidedDemoState): Readonly<GuidedDemoStep> | undefined {
  if (current.mode !== 'guided' || current.currentStepId === null) return undefined;
  return GUIDED_DEMO_STEPS.find((step) => step.id === current.currentStepId);
}

export function reduceGuidedDemo(
  current: Readonly<GuidedDemoState>,
  action: GuidedDemoAction
): Readonly<GuidedDemoState> {
  if (action.type === 'reset') return createGuidedDemoState();

  if (action.type === 'start') {
    if (current.mode !== 'start') return current;
    return state({ mode: 'guided', currentStepId: GUIDED_DEMO_STEPS[0]!.id, completedStepIds: [], exitReason: null });
  }

  if (action.type === 'explore') {
    if (current.mode !== 'start') return current;
    return state({ mode: 'free-exploration', currentStepId: null, completedStepIds: [], exitReason: 'chosen' });
  }

  if (action.type === 'skip') {
    if (current.mode !== 'guided') return current;
    return state({
      mode: 'free-exploration',
      currentStepId: null,
      completedStepIds: current.completedStepIds,
      exitReason: 'skipped'
    });
  }

  if (current.mode !== 'guided' || current.currentStepId === null) return current;

  const currentIndex = GUIDED_DEMO_STEPS.findIndex((step) => step.id === current.currentStepId);
  if (currentIndex < 0) return current;

  const completedStepIds = current.completedStepIds.includes(current.currentStepId)
    ? current.completedStepIds
    : [...current.completedStepIds, current.currentStepId];
  const nextStep = GUIDED_DEMO_STEPS[currentIndex + 1];

  if (!nextStep) {
    return state({ mode: 'free-exploration', currentStepId: null, completedStepIds, exitReason: 'completed' });
  }

  return state({ mode: 'guided', currentStepId: nextStep.id, completedStepIds, exitReason: null });
}
