import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';
import { mofaOdaPack, mofaOdaPresentation } from '@claimgate/pack-mofa-oda';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { create } from 'zustand';
import {
  appendReviewRecord,
  buildEvidenceExport,
  buildReviewQueue,
  coerceCorrectionValue,
  createReviewRecord,
  defaultPackId,
  reviewDecisionState,
  type DemoReviewDecision,
  type ReviewRecord,
  type ReviewRecordMap,
  type ReviewQueueItem
} from './demo.js';
import {
  AI_CURATOR_FIXTURE_PIPELINE,
  GUIDED_DEMO_START,
  GUIDED_DEMO_STEPS,
  createGuidedDemoState,
  currentGuidedDemoStep,
  reduceGuidedDemo
} from './guided-demo.js';
import { summarizeReviewOutcome } from './review-outcome.js';
import { buildVisualDiff } from './visual-diff.js';
import './styles.css';

interface DemoState {
  readonly selectedPackId: string;
  readonly selectedFixtureId?: string;
  readonly records: ReviewRecordMap;
  readonly previewOpen: boolean;
  readonly selectPack: (id: string) => void;
  readonly selectFixture: (id: string) => void;
  readonly recordReview: (fixtureId: string, record: ReviewRecord) => void;
  readonly resetReviews: () => void;
  readonly setPreviewOpen: (open: boolean) => void;
}

interface DecisionDraft {
  readonly decision: Exclude<DemoReviewDecision, 'pending'>;
  readonly correctedValue: string;
  readonly reason: string;
}

const packs = [civicDataPack, healthDataPack, mofaOdaPack] as const;
const useDemoStore = create<DemoState>((set) => ({
  selectedPackId: defaultPackId(window.location.hostname),
  records: {},
  previewOpen: false,
  selectPack: (id) => set({ selectedPackId: id, selectedFixtureId: undefined, records: {}, previewOpen: false }),
  selectFixture: (id) => set({ selectedFixtureId: id }),
  recordReview: (fixtureId, record) => set((state) => ({ records: appendReviewRecord(state.records, fixtureId, record) })),
  resetReviews: () => set({ selectedFixtureId: undefined, records: {}, previewOpen: false }),
  setPreviewOpen: (open) => set({ previewOpen: open })
}));

function App(): React.ReactElement {
  const [decisionDraft, setDecisionDraft] = React.useState<DecisionDraft | null>(null);
  const [guidedDemo, dispatchGuidedDemo] = React.useReducer(reduceGuidedDemo, undefined, createGuidedDemoState);
  const guideLaunchRef = React.useRef<HTMLElement>(null);
  const selectedPackId = useDemoStore((state) => state.selectedPackId);
  const selectedFixtureId = useDemoStore((state) => state.selectedFixtureId);
  const records = useDemoStore((state) => state.records);
  const previewOpen = useDemoStore((state) => state.previewOpen);
  const selectPack = useDemoStore((state) => state.selectPack);
  const selectFixture = useDemoStore((state) => state.selectFixture);
  const recordReview = useDemoStore((state) => state.recordReview);
  const resetReviews = useDemoStore((state) => state.resetReviews);
  const setPreviewOpen = useDemoStore((state) => state.setPreviewOpen);
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? mofaOdaPack;
  const queue = buildReviewQueue(selectedPack.id);
  const selected = queue.find((item) => item.fixtureId === selectedFixtureId) ?? queue[0];

  React.useEffect(() => {
    if (guidedDemo.mode !== 'start') return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(guideLaunchRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    focusable()[0]?.focus();
    const keepFocusInLaunch = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const buttons = focusable();
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInLaunch);
    return () => {
      document.removeEventListener('keydown', keepFocusInLaunch);
      if (previouslyFocused && previouslyFocused !== document.body) previouslyFocused.focus();
    };
  }, [guidedDemo.mode]);

  if (!selected) return <main className="empty-state">선택한 DomainPack에 fixture가 없습니다.</main>;

  const decisionFor = (item: ReviewQueueItem): DemoReviewDecision => records[item.fixtureId]?.decision ?? item.initialDecision;
  const currentDecision = decisionFor(selected);
  const currentDecisionState = reviewDecisionState(currentDecision);
  const evidenceItems = queue.filter((item) => reviewDecisionState(decisionFor(item)).evidenceEligible);
  const reviewedCount = queue.filter((item) => decisionFor(item) !== 'pending').length;
  const evidenceExport = buildEvidenceExport(selectedPack.id, records);
  const reviewOutcome = summarizeReviewOutcome(queue, records, evidenceExport);
  const currentRecord = records[selected.fixtureId];
  const guidedStep = currentGuidedDemoStep(guidedDemo);
  const visualDiff = buildVisualDiff({ aiValue: selected.aiValue, sourceValue: selected.sourceValue });
  const mofaScenario = selectedPack.id === mofaOdaPack.id
    ? mofaOdaPresentation.scenarios.find((scenario) => scenario.fixtureId === selected.fixtureId)
    : undefined;

  const openDecision = (decision: DecisionDraft['decision']): void => {
    setDecisionDraft({
      decision,
      correctedValue: decision === 'corrected' ? String(selected.sourceValue ?? '') : '',
      reason: decision === 'corrected'
        ? 'Source Anchor와 AI 제안 값이 달라 근거값으로 정정합니다.'
        : decision === 'verified'
          ? 'Source Anchor와 일치함을 검토자가 확인했습니다.'
          : '공공데이터 근거 검토 결과 Evidence Pack에서 제외합니다.'
    });
  };

  const submitDecision = (): void => {
    if (!decisionDraft) return;
    recordReview(selected.fixtureId, createReviewRecord(decisionDraft.decision, {
      ...decisionDraft,
      correctedValue: decisionDraft.decision === 'corrected'
        ? coerceCorrectionValue(decisionDraft.correctedValue, selected.sourceValue)
        : undefined
    }));
    setDecisionDraft(null);
  };

  const resetAll = (): void => {
    setDecisionDraft(null);
    resetReviews();
    dispatchGuidedDemo({ type: 'reset' });
  };

  const startGuidedDemo = (): void => {
    setDecisionDraft(null);
    selectPack(mofaOdaPack.id);
    dispatchGuidedDemo({ type: 'reset' });
    dispatchGuidedDemo({ type: 'start' });
  };

  return (
    <main className="app-frame">
      <aside className="side-rail" aria-label="ClaimGate primary navigation">
        <div className="brand-mark" aria-label="ClaimGate">
          <span>CG</span>
        </div>
        <nav className="rail-nav" aria-label="Workspace sections">
          <button type="button" className="rail-button active" aria-label="Review queue"><Icon name="queue" /></button>
          <button type="button" className="rail-button" aria-label="Evidence packs"><Icon name="evidence" /></button>
          <button type="button" className="rail-button" aria-label="Rule registry"><Icon name="rules" /></button>
        </nav>
        <div className="rail-footer"><span className="avatar">JW</span></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="breadcrumb"><span>ClaimGate</span><i>/</i><strong>{selectedPack.displayName}</strong></div>
            <h1>공공데이터 주장 검토</h1>
          </div>
          <div className="topbar-actions">
            <span className="runtime-badge"><i /> Offline fixture</span>
            <span className="ai-boundary-badge"><Icon name="spark" /> AI Curator · fixture proposal only</span>
            {guidedDemo.mode === 'free-exploration' && (
              <button type="button" className="guide-restart-button" onClick={startGuidedDemo}>가이드 데모</button>
            )}
            <label className="pack-select">
              <span className="sr-only">DomainPack 선택</span>
              <select value={selectedPack.id} onChange={(event) => { setDecisionDraft(null); selectPack(event.target.value); }}>
                {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.displayName}</option>)}
              </select>
            </label>
          </div>
        </header>

        <section className="status-strip" aria-label="Review status">
          <div className="status-copy">
            <span className="section-kicker">Review run · 2026-07</span>
            <strong>{mofaScenario?.headlineKo ?? selectedPack.displayName}</strong>
            <p>{mofaScenario?.reviewerPromptKo ?? 'AI가 제안한 주장을 출처와 규칙으로 검토하고, 사람의 판정만 Evidence Pack에 반영합니다.'}</p>
          </div>
          <div className="run-controls">
            <div className="run-progress" aria-label={`${queue.length}건 중 ${reviewedCount}건 판정`}>
              <div className="progress-label"><span>Review progress</span><strong>{reviewedCount} / {queue.length}</strong></div>
              <div className="progress-track"><i style={{ width: `${Math.round((reviewedCount / queue.length) * 100)}%` }} /></div>
            </div>
            <button type="button" className="reset-button" onClick={resetAll}>처음부터</button>
          </div>
        </section>

        {guidedStep && (
          <section className="guide-coach" aria-live="polite" aria-label={`가이드 ${guidedStep.order}단계`}>
            <span className="guide-step-number">{guidedStep.order}</span>
            <div className="guide-coach-copy">
              <span className="section-kicker">Guided judge demo · {guidedStep.order} / {GUIDED_DEMO_STEPS.length}</span>
              <strong>{guidedStep.title}</strong>
              <p>{guidedStep.instruction}</p>
            </div>
            <div className="guide-coach-actions">
              <button type="button" className="guide-skip" onClick={() => dispatchGuidedDemo({ type: 'skip' })}>가이드 건너뛰기</button>
              <button
                type="button"
                className="guide-next"
                onClick={() => dispatchGuidedDemo({ type: 'next' })}
                disabled={guidedStep.id === 'human-review' && !currentRecord}
              >
                {guidedStep.id === 'evidence-pack' ? '가이드 완료' : '다음 단계'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {guidedDemo.mode === 'free-exploration' && guidedDemo.exitReason === 'completed' && (
          <div className="guide-complete" role="status"><Icon name="check" /><span><strong>4단계 가이드 완료</strong> 이제 모든 DomainPack을 자유롭게 검토할 수 있습니다.</span></div>
        )}

        <ol className="demo-flow" aria-label="Four-step judge demo flow">
          {GUIDED_DEMO_STEPS.map((step) => {
            const active = guidedStep?.id === step.id;
            const complete = guidedDemo.completedStepIds.includes(step.id);
            return (
              <li key={step.id} className={`${active ? 'active' : ''} ${complete ? 'complete' : ''}`} aria-current={active ? 'step' : undefined}>
                <span>{complete ? <Icon name="check" /> : step.order}</span>
                <div><strong>{step.shortLabel}</strong><small>{step.title}</small></div>
              </li>
            );
          })}
        </ol>

        <section className="review-layout">
          <aside className={`queue-panel ${guidedStep?.target === 'review-queue' ? 'guided-focus' : ''}`} aria-label="Claim review queue">
            <div className="panel-title-row">
              <div><span className="section-kicker">Queue</span><h2>검토할 주장</h2></div>
              <span className="count-badge">{queue.length}</span>
            </div>
            <div className="queue-filters" aria-label="Risk legend">
              <span><i className="risk-dot red" /> 위험</span>
              <span><i className="risk-dot yellow" /> 주의</span>
              <span><i className="risk-dot green" /> 일치</span>
            </div>
            <div className="queue-list">
              {queue.map((item, index) => {
                const itemDecision = reviewDecisionState(decisionFor(item));
                const active = item.fixtureId === selected.fixtureId;
                return (
                  <button
                    type="button"
                    key={item.fixtureId}
                    className={`queue-item ${active ? 'active' : ''}`}
                    onClick={() => selectFixture(item.fixtureId)}
                    aria-pressed={active}
                  >
                    <span className={`risk-bar ${item.riskLevel}`} />
                    <span className="queue-item-body">
                      <span className="queue-meta"><b>CLM-{String(index + 1).padStart(3, '0')}</b><i className={`risk-pill ${item.riskLevel}`}>{riskLabel(item.riskLevel)}</i></span>
                      <strong>{selectedPack.id === mofaOdaPack.id
                        ? mofaOdaPresentation.scenarios.find((scenario) => scenario.fixtureId === item.fixtureId)?.headlineKo ?? item.subject
                        : item.subject}</strong>
                      <small>{item.claimText}</small>
                      <span className={`decision-label ${decisionFor(item)}`}>{itemDecision.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <article className="claim-workspace" aria-label="Selected claim review">
            <div className="claim-header">
              <div>
                <span className="section-kicker">Selected claim</span>
                <div className="claim-title-row">
                  <h2>{selected.subject}</h2>
                  <span className={`risk-pill large ${selected.riskLevel}`}>{riskLabel(selected.riskLevel)}</span>
                </div>
                <p>{selected.title}</p>
              </div>
              <span className={`review-state ${currentDecision}`}>{currentDecisionState.label}</span>
            </div>

            <section className={`comparison ${guidedStep?.target === 'source-comparison' ? 'guided-focus' : ''}`} aria-label="AI claim and source comparison">
              <div className="comparison-card ai-claim">
                <div className="card-label"><Icon name="spark" /><span>AI 제안</span><small>Curator only</small></div>
                <blockquote>{mofaScenario?.claimLabelKo ?? selected.claimText}</blockquote>
                <dl><dt>{visualDiff.ai.label}</dt><dd>{visualDiff.ai.text}</dd></dl>
              </div>
              <div className={`comparison-divider ${visualDiff.status}`} aria-label={visualDiff.accessibleLabel}><span aria-hidden="true">{visualDiff.statusSymbol}</span><small>{visualDiff.statusLabel}</small></div>
              <div className="comparison-card source-claim">
                <div className="card-label"><Icon name="source" /><span>Source Anchor</span><small>Offline snapshot</small></div>
                <blockquote>{mofaScenario?.sourceLabelKo ?? selected.sourceExcerpt}</blockquote>
                <dl><dt>{visualDiff.source.label}</dt><dd>{visualDiff.source.text}</dd></dl>
              </div>
            </section>

            <section className="source-record" aria-label="Source provenance">
              <div className="source-icon"><Icon name="database" /></div>
              <div>
                <span className="section-kicker">Public-data provenance</span>
                <strong>{mofaScenario?.sourceSnapshot.title ?? selected.sourceTitle}</strong>
                <p>{mofaScenario?.sourceSnapshot.locator ?? selected.sourceAnchorId}</p>
              </div>
              <div className="source-boundary"><i /><span>{mofaScenario?.sourceSnapshot.boundary ?? selected.sourceBoundary}</span></div>
            </section>

            <section className="rule-trace" aria-label="Deterministic rule trace">
              <div className="panel-title-row compact">
                <div><span className="section-kicker">Deterministic trace</span><h3>판정 규칙</h3></div>
                <span className="engine-badge">Rule Engine v0</span>
              </div>
              <div className="trace-line">
                <span className="trace-check"><Icon name="check" /></span>
                <div><code>{selected.ruleId}</code><p>{selected.ruleMessage}</p></div>
                <strong className={`trace-result ${selected.riskLevel}`}>{selected.riskLevel} → {selected.recommendedState}</strong>
              </div>
            </section>

            <section className={`decision-bar ${guidedStep?.target === 'reviewer-decision' ? 'guided-focus' : ''}`} aria-label="Reviewer decision controls">
              <div><span className="section-kicker">Human decision</span><strong>이 주장을 어떻게 처리할까요?</strong></div>
              <div className="decision-actions">
                <button type="button" disabled={Boolean(currentRecord)} aria-pressed={currentDecision === 'rejected'} className={currentDecision === 'rejected' ? 'selected reject' : 'reject'} onClick={() => openDecision('rejected')}>기각</button>
                <button type="button" disabled={Boolean(currentRecord)} aria-pressed={currentDecision === 'corrected'} className={currentDecision === 'corrected' ? 'selected correct' : 'correct'} onClick={() => openDecision('corrected')}>근거값으로 정정</button>
                <button type="button" disabled={Boolean(currentRecord)} aria-pressed={currentDecision === 'verified'} className={currentDecision === 'verified' ? 'selected verify' : 'verify'} onClick={() => openDecision('verified')}><Icon name="check" /> 검증 완료</button>
              </div>
            </section>
            {currentRecord && (
              <section className="audit-note" aria-label="Reviewer audit record">
                <Icon name="audit" />
                <div><span className="section-kicker">Audit record</span><strong>{currentRecord.reason}</strong><small>{currentRecord.reviewerId} · {currentRecord.decidedAt}</small></div>
              </section>
            )}
          </article>

          <aside className={`evidence-panel ${guidedStep?.target === 'evidence-preview' ? 'guided-focus' : ''}`} aria-label="Evidence Pack preview">
            <div className="evidence-heading">
              <span className="evidence-icon"><Icon name="evidence" /></span>
              <div><span className="section-kicker">Projection</span><h2>Evidence Pack</h2></div>
              <span className="count-badge dark">{reviewOutcome.canonicalIncludedCount}</span>
            </div>
            <p className="evidence-intro">검증 또는 정정된 주장만 보고서와 그래프에 투영됩니다.</p>

            <div className={`eligibility-card ${currentDecisionState.evidenceEligible ? 'eligible' : 'blocked'}`}>
              <span>{currentDecisionState.evidenceEligible ? <Icon name="shield" /> : <Icon name="lock" />}</span>
              <div><small>현재 주장</small><strong>{currentDecisionState.evidenceEligible ? 'Projection eligible' : 'Projection blocked'}</strong></div>
            </div>

            <div className="evidence-list">
              {evidenceItems.map((item) => (
                <div className="evidence-item" key={item.fixtureId}>
                  <span className={`evidence-status ${decisionFor(item)}`}><Icon name="check" /></span>
                  <div><strong>{item.subject}</strong><small>{reviewDecisionState(decisionFor(item)).label} · {item.sourceTitle}</small></div>
                </div>
              ))}
              {evidenceItems.length === 0 && <p className="empty-evidence">판정된 주장이 없습니다.</p>}
            </div>

            <div className="pack-summary">
              <div><span>Report</span><strong>{selectedPack.reportTemplates[0]?.title ?? 'Evidence report'}</strong></div>
              <div><span>Mode</span><strong>Offline · deterministic</strong></div>
              <div><span>Authority</span><strong>Human reviewer</strong></div>
            </div>
            <section className="outcome-summary" aria-label="Review outcome counts">
              <div className="outcome-heading"><span className="section-kicker">Review outcome</span><strong>{reviewOutcome.reviewedCount} / {reviewOutcome.totalCount} 판정</strong></div>
              <dl>
                <div><dt>대기</dt><dd>{reviewOutcome.decisionCounts.pending}</dd></div>
                <div><dt>검증</dt><dd>{reviewOutcome.decisionCounts.verified}</dd></div>
                <div><dt>정정</dt><dd>{reviewOutcome.decisionCounts.corrected}</dd></div>
                <div><dt>기각</dt><dd>{reviewOutcome.decisionCounts.rejected}</dd></div>
              </dl>
              {reviewOutcome.guardReasons.length > 0 && (
                <ul className="guard-reasons" aria-label="Projection guard reasons">
                  {reviewOutcome.guardReasons.map((reason) => (
                    <li key={reason.fixtureId}><Icon name="lock" /><span><code>{reason.code}</code>{guardReasonLabel(reason.code)}</span></li>
                  ))}
                </ul>
              )}
            </section>
            <button type="button" className="export-button" disabled={evidenceItems.length === 0} onClick={() => setPreviewOpen(true)}><Icon name="export" /> Evidence Pack 미리보기</button>
            <p className="prototype-note">시제품 데이터입니다. 실시간 API·LLM·OCR·운영 정확도 평가는 포함하지 않습니다.</p>
          </aside>
        </section>
      </section>

      {previewOpen && (
        <Modal labelledBy="evidence-dialog-title" onClose={() => setPreviewOpen(false)}>
          <section className="evidence-dialog">
            <div className="dialog-heading">
              <div><span className="section-kicker">Static preview</span><h2 id="evidence-dialog-title">{selectedPack.displayName} Evidence Pack</h2></div>
              <button type="button" data-autofocus className="dialog-close" onClick={() => setPreviewOpen(false)} aria-label="Evidence Pack 미리보기 닫기">×</button>
            </div>
            <p>검토자가 검증하거나 정정한 주장만 포함된 offline fixture 결과입니다.</p>
            <div className="dialog-items">
              {evidenceItems.map((item) => (
                <article key={item.fixtureId}>
                  <span className={`risk-pill ${item.riskLevel}`}>{riskLabel(item.riskLevel)}</span>
                  <div><strong>{item.subject}</strong><p>{item.claimText}</p><small>{item.sourceTitle} · {reviewDecisionState(decisionFor(item)).label}</small></div>
                </article>
              ))}
            </div>
            <div className="download-actions">
              <button type="button" onClick={() => downloadText(`${selectedPack.id}-evidence-pack.json`, evidenceExport.json, 'application/json')}><Icon name="download" /> JSON 다운로드</button>
              <button type="button" onClick={() => downloadText(`${selectedPack.id}-evidence-pack.md`, evidenceExport.markdown, 'text/markdown')}><Icon name="download" /> Markdown 다운로드</button>
            </div>
            <footer><span>Offline · deterministic · fixture-first</span><strong>{evidenceExport.itemCount} projectable claim{evidenceExport.itemCount === 1 ? '' : 's'}</strong></footer>
          </section>
        </Modal>
      )}

      {decisionDraft && (
        <Modal labelledBy="decision-dialog-title" onClose={() => setDecisionDraft(null)}>
          <section className="decision-dialog">
            <div className="dialog-heading">
              <div><span className="section-kicker">Human review</span><h2 id="decision-dialog-title">{decisionTitle(decisionDraft.decision)}</h2></div>
              <button type="button" className="dialog-close" onClick={() => setDecisionDraft(null)} aria-label="판정 입력 닫기">×</button>
            </div>
            <p className="dialog-lede">AI 제안이나 위험 규칙이 아니라 검토자가 최종 값과 사유를 기록합니다.</p>
            <div className="decision-context"><span>{selected.subject}</span><strong>{selected.claimText}</strong></div>
            {decisionDraft.decision === 'corrected' && (
              <label className="form-field"><span>정정 값</span><input data-autofocus value={decisionDraft.correctedValue} onChange={(event) => setDecisionDraft({ ...decisionDraft, correctedValue: event.target.value })} /></label>
            )}
            <label className="form-field"><span>판정 사유</span><textarea data-autofocus={decisionDraft.decision !== 'corrected' || undefined} rows={4} value={decisionDraft.reason} onChange={(event) => setDecisionDraft({ ...decisionDraft, reason: event.target.value })} /></label>
            <div className="form-boundary"><Icon name="shield" /><span>reviewer: demo-reviewer · audit timestamp는 deterministic fixture 시간으로 기록됩니다.</span></div>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setDecisionDraft(null)}>취소</button>
              <button type="button" className="primary" onClick={submitDecision} disabled={!decisionDraft.reason.trim() || (decisionDraft.decision === 'corrected' && !decisionDraft.correctedValue.trim())}>판정 기록</button>
            </div>
          </section>
        </Modal>
      )}

      {guidedDemo.mode === 'start' && (
        <section ref={guideLaunchRef} className="guide-launch" role="dialog" aria-modal="true" aria-labelledby="guide-launch-title">
          <div className="guide-launch-card">
            <div className="guide-launch-brand"><span>ClaimGate</span><strong>MOFA ODA prototype</strong></div>
            <span className="section-kicker">{GUIDED_DEMO_START.eyebrow}</span>
            <h2 id="guide-launch-title">{GUIDED_DEMO_START.title}</h2>
            <p className="guide-launch-lede">{GUIDED_DEMO_START.description}</p>
            <div className="curator-pipeline" aria-label="AI Curator fixture pipeline">
              <div><small>Input</small><strong>사전 생성 오프라인 fixture</strong></div>
              <span aria-hidden="true">→</span>
              <div><small>AI Curator</small><strong>후보 주장 제안 시뮬레이션</strong></div>
              <span aria-hidden="true">→</span>
              <div><small>Authority</small><strong>제안 전용 · 판정 불가</strong></div>
            </div>
            <p className="curator-boundary"><Icon name="shield" />{AI_CURATOR_FIXTURE_PIPELINE.boundary}</p>
            <div className="guide-launch-actions">
              <button type="button" className="launch-primary" data-autofocus onClick={startGuidedDemo}>{GUIDED_DEMO_START.primaryLabel}</button>
              <button type="button" className="launch-secondary" onClick={() => dispatchGuidedDemo({ type: 'explore' })}>{GUIDED_DEMO_START.secondaryLabel}</button>
            </div>
            <footer><span>Offline</span><span>Deterministic</span><span>Fixture-first</span><span>No live AI / API / OCR</span></footer>
          </div>
        </section>
      )}
    </main>
  );
}

function Modal({ labelledBy, onClose, children }: { readonly labelledBy: string; readonly onClose: () => void; readonly children: React.ReactNode }): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], select, [tabindex]:not([tabindex="-1"])') ?? []);
    const preferred = containerRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusable()[0])?.focus();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div ref={containerRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onMouseDown={onClose}>
      <div onMouseDown={(event) => event.stopPropagation()}>{children}</div>
    </div>
  );
}

function downloadText(filename: string, contents: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: `${mimeType};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function decisionTitle(decision: Exclude<DemoReviewDecision, 'pending'>): string {
  if (decision === 'corrected') return '근거값으로 정정';
  if (decision === 'verified') return '검증 완료';
  return '주장 기각';
}

function riskLabel(level: ReviewQueueItem['riskLevel']): string {
  return level === 'red' ? 'RED' : level === 'yellow' ? 'YELLOW' : 'GREEN';
}

function guardReasonLabel(code: 'review-pending' | 'review-rejected'): string {
  return code === 'review-pending'
    ? '검토자 판정 전에는 canonical Evidence Pack 투영이 차단됩니다.'
    : '검토자가 기각한 주장은 canonical Evidence Pack에서 제외됩니다.';
}

function Icon({ name }: { readonly name: string }): React.ReactElement {
  const paths: Record<string, React.ReactNode> = {
    queue: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="2" cy="5" r=".6" /><circle cx="2" cy="12" r=".6" /><circle cx="2" cy="19" r=".6" /></>,
    evidence: <><path d="M7 3h10l3 3v15H4V3h3Z" /><path d="M8 10h8M8 14h8M8 18h5" /></>,
    rules: <><path d="M5 4h14v5H5zM5 15h14v5H5z" /><path d="M9 9v6M15 9v6" /></>,
    spark: <><path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" /></>,
    source: <><path d="M5 3h14v18H5z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6L12 3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    export: <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v7h14v-7" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
    audit: <><path d="M6 3h12v18H6z" /><path d="m9 10 2 2 4-4M9 16h6" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

createRoot(document.getElementById('root')!).render(<App />);
