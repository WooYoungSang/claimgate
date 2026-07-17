import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { create } from 'zustand';
import {
  buildReviewQueue,
  defaultPackId,
  reviewDecisionState,
  type DemoReviewDecision,
  type ReviewQueueItem
} from './demo.js';
import './styles.css';

interface DemoState {
  readonly selectedPackId: string;
  readonly selectedFixtureId?: string;
  readonly decisions: Readonly<Record<string, DemoReviewDecision>>;
  readonly previewOpen: boolean;
  readonly selectPack: (id: string) => void;
  readonly selectFixture: (id: string) => void;
  readonly decide: (fixtureId: string, decision: DemoReviewDecision) => void;
  readonly setPreviewOpen: (open: boolean) => void;
}

const packs = [civicDataPack, healthDataPack, mofaOdaPack] as const;
const useDemoStore = create<DemoState>((set) => ({
  selectedPackId: defaultPackId(window.location.hostname),
  decisions: {},
  previewOpen: false,
  selectPack: (id) => set({ selectedPackId: id, selectedFixtureId: undefined, decisions: {}, previewOpen: false }),
  selectFixture: (id) => set({ selectedFixtureId: id }),
  decide: (fixtureId, decision) => set((state) => ({ decisions: { ...state.decisions, [fixtureId]: decision } })),
  setPreviewOpen: (open) => set({ previewOpen: open })
}));

function App(): React.ReactElement {
  const dialogRef = React.useRef<HTMLElement>(null);
  const previewButtonRef = React.useRef<HTMLButtonElement>(null);
  const selectedPackId = useDemoStore((state) => state.selectedPackId);
  const selectedFixtureId = useDemoStore((state) => state.selectedFixtureId);
  const decisions = useDemoStore((state) => state.decisions);
  const previewOpen = useDemoStore((state) => state.previewOpen);
  const selectPack = useDemoStore((state) => state.selectPack);
  const selectFixture = useDemoStore((state) => state.selectFixture);
  const decide = useDemoStore((state) => state.decide);
  const setPreviewOpen = useDemoStore((state) => state.setPreviewOpen);
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? mofaOdaPack;
  const queue = buildReviewQueue(selectedPack.id);
  const selected = queue.find((item) => item.fixtureId === selectedFixtureId) ?? queue[0];

  React.useEffect(() => {
    if (!previewOpen) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : previewButtonRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], select, [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPreviewOpen(false);
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
  }, [previewOpen, setPreviewOpen]);

  if (!selected) return <main className="empty-state">선택한 DomainPack에 fixture가 없습니다.</main>;

  const decisionFor = (item: ReviewQueueItem): DemoReviewDecision => decisions[item.fixtureId] ?? item.initialDecision;
  const currentDecision = decisionFor(selected);
  const currentDecisionState = reviewDecisionState(currentDecision);
  const evidenceItems = queue.filter((item) => reviewDecisionState(decisionFor(item)).evidenceEligible);
  const reviewedCount = queue.filter((item) => decisionFor(item) !== 'pending').length;

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
            <label className="pack-select">
              <span className="sr-only">DomainPack 선택</span>
              <select value={selectedPack.id} onChange={(event) => selectPack(event.target.value)}>
                {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.displayName}</option>)}
              </select>
            </label>
          </div>
        </header>

        <section className="status-strip" aria-label="Review status">
          <div className="status-copy">
            <span className="section-kicker">Review run · 2026-07</span>
            <strong>{selectedPack.displayName}</strong>
            <p>AI가 제안한 주장을 출처와 규칙으로 검토하고, 사람의 판정만 Evidence Pack에 반영합니다.</p>
          </div>
          <div className="run-progress" aria-label={`${queue.length}건 중 ${reviewedCount}건 판정`}>
            <div className="progress-label"><span>Review progress</span><strong>{reviewedCount} / {queue.length}</strong></div>
            <div className="progress-track"><i style={{ width: `${Math.round((reviewedCount / queue.length) * 100)}%` }} /></div>
          </div>
        </section>

        <section className="review-layout">
          <aside className="queue-panel" aria-label="Claim review queue">
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
                      <strong>{item.subject}</strong>
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

            <section className="comparison" aria-label="AI claim and source comparison">
              <div className="comparison-card ai-claim">
                <div className="card-label"><Icon name="spark" /><span>AI 제안</span><small>Curator only</small></div>
                <blockquote>{selected.claimText}</blockquote>
                <dl><dt>정규화 값</dt><dd>{displayValue(selected.aiValue)}</dd></dl>
              </div>
              <div className="comparison-divider" aria-hidden="true"><span>VS</span></div>
              <div className="comparison-card source-claim">
                <div className="card-label"><Icon name="source" /><span>Source Anchor</span><small>Offline snapshot</small></div>
                <blockquote>{selected.sourceExcerpt}</blockquote>
                <dl><dt>근거 값</dt><dd>{displayValue(selected.sourceValue)}</dd></dl>
              </div>
            </section>

            <section className="source-record" aria-label="Source provenance">
              <div className="source-icon"><Icon name="database" /></div>
              <div>
                <span className="section-kicker">Public-data provenance</span>
                <strong>{selected.sourceTitle}</strong>
                <p>{selected.sourceAnchorId}</p>
              </div>
              <div className="source-boundary"><i /><span>{selected.sourceBoundary}</span></div>
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

            <section className="decision-bar" aria-label="Reviewer decision controls">
              <div><span className="section-kicker">Human decision</span><strong>이 주장을 어떻게 처리할까요?</strong></div>
              <div className="decision-actions">
                <button type="button" aria-pressed={currentDecision === 'rejected'} className={currentDecision === 'rejected' ? 'selected reject' : 'reject'} onClick={() => decide(selected.fixtureId, 'rejected')}>기각</button>
                <button type="button" aria-pressed={currentDecision === 'corrected'} className={currentDecision === 'corrected' ? 'selected correct' : 'correct'} onClick={() => decide(selected.fixtureId, 'corrected')}>근거값으로 정정</button>
                <button type="button" aria-pressed={currentDecision === 'verified'} className={currentDecision === 'verified' ? 'selected verify' : 'verify'} onClick={() => decide(selected.fixtureId, 'verified')}><Icon name="check" /> 검증 완료</button>
              </div>
            </section>
          </article>

          <aside className="evidence-panel" aria-label="Evidence Pack preview">
            <div className="evidence-heading">
              <span className="evidence-icon"><Icon name="evidence" /></span>
              <div><span className="section-kicker">Projection</span><h2>Evidence Pack</h2></div>
              <span className="count-badge dark">{evidenceItems.length}</span>
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
            <button ref={previewButtonRef} type="button" className="export-button" disabled={evidenceItems.length === 0} onClick={() => setPreviewOpen(true)}><Icon name="export" /> Evidence Pack 미리보기</button>
            <p className="prototype-note">시제품 데이터입니다. 실시간 API·LLM·OCR·운영 정확도 평가는 포함하지 않습니다.</p>
          </aside>
        </section>
      </section>

      {previewOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPreviewOpen(false)}>
          <section ref={dialogRef} className="evidence-dialog" role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-heading">
              <div><span className="section-kicker">Static preview</span><h2 id="evidence-dialog-title">{selectedPack.displayName} Evidence Pack</h2></div>
              <button type="button" data-dialog-close className="dialog-close" onClick={() => setPreviewOpen(false)} aria-label="Evidence Pack 미리보기 닫기">×</button>
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
            <footer><span>Offline · deterministic · fixture-first</span><strong>{evidenceItems.length} projectable claim{evidenceItems.length === 1 ? '' : 's'}</strong></footer>
          </section>
        </div>
      )}
    </main>
  );
}

function riskLabel(level: ReviewQueueItem['riskLevel']): string {
  return level === 'red' ? 'RED' : level === 'yellow' ? 'YELLOW' : 'GREEN';
}

function displayValue(value: string): string {
  return value.replaceAll('|', ' · ').replaceAll('-', ' ');
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
    export: <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v7h14v-7" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

createRoot(document.getElementById('root')!).render(<App />);
