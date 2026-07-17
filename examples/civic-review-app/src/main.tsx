import { claimGateCoreInfo } from '@claimgate/core';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';
import { ReviewShell } from '@claimgate/ui';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { create } from 'zustand';
import { runDemo } from './demo.js';
import './styles.css';

interface DemoState {
  readonly selectedPackId: string;
  readonly selectPack: (id: string) => void;
}

const packs = [civicDataPack, healthDataPack, mofaOdaPack] as const;
const useDemoStore = create<DemoState>((set) => ({
  selectedPackId: civicDataPack.id,
  selectPack: (id) => set({ selectedPackId: id })
}));

function App(): React.ReactElement {
  const selectedPackId = useDemoStore((state) => state.selectedPackId);
  const selectPack = useDemoStore((state) => state.selectPack);
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? civicDataPack;
  const story = runDemo(selectedPack.id);

  return (
    <main className="demo-shell">
      <section className="hero" aria-label="ClaimGate judges-first demo story">
        <p className="eyebrow">Offline deterministic ClaimGate demo</p>
        <h1>{story.storyTitle}</h1>
        <p className="lede">
          In three minutes, judges see a risky AI-produced claim grounded to a source anchor, triaged by deterministic rules,
          corrected or verified by a reviewer, then projected into an Evidence Pack, report, and graph.
        </p>
        <div className="hero-metrics" aria-label="Demo evidence metrics">
          <span>Risk {story.riskLevel}</span>
          <span>{story.evidenceItemCount} Evidence Pack item</span>
          <span>{story.graphNodeCount} graph nodes</span>
        </div>
      </section>

      <ReviewShell title="ClaimGate invariant contract" invariants={claimGateCoreInfo.invariants} />

      <section className="panel" aria-label="Domain pack swap">
        <div className="panel-heading">
          <p className="eyebrow">Pack swap / same core</p>
          <h2>{selectedPack.displayName}</h2>
          <p>{selectedPack.description}</p>
        </div>
        <div className="pack-buttons" role="group" aria-label="Choose demo DomainPack">
          {packs.map((pack) => (
            <button key={pack.id} type="button" className={pack.id === selectedPack.id ? 'active' : ''} onClick={() => selectPack(pack.id)}>
              Use {pack.displayName}
            </button>
          ))}
        </div>
      </section>

      <section className="story-grid" aria-label="Three-minute walkthrough">
        {story.storyBeats.map((beat) => (
          <article key={beat} className="story-card">
            <p>{beat}</p>
          </article>
        ))}
      </section>

      <section className="panel details" aria-label="Explainability and authority boundary">
        <h2>Explainability, not AI authority</h2>
        <dl>
          <div>
            <dt>AI boundary</dt>
            <dd>{story.aiBoundary}</dd>
          </div>
          <div>
            <dt>Source anchor</dt>
            <dd>{story.sourceAnchorId}</dd>
          </div>
          <div>
            <dt>Reviewer decision</dt>
            <dd>
              {story.reviewerDecision} → {story.correctedValue}
            </dd>
          </div>
          <div>
            <dt>Projection</dt>
            <dd>
              {story.evidencePackTitle}; report “{story.reportTemplate}”; graph edges {story.graphEdgeCount}.
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
