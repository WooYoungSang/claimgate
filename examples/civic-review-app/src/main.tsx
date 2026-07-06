import { claimGateCoreInfo } from '@claimgate/core';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';
import { ReviewShell } from '@claimgate/ui';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { create } from 'zustand';
import './styles.css';

interface DemoState {
  readonly selectedPackId: string;
  readonly selectPack: (id: string) => void;
}

const packs = [civicDataPack, healthDataPack] as const;
const useDemoStore = create<DemoState>((set) => ({
  selectedPackId: civicDataPack.id,
  selectPack: (id) => set({ selectedPackId: id })
}));

function App(): React.ReactElement {
  const selectedPackId = useDemoStore((state) => state.selectedPackId);
  const selectPack = useDemoStore((state) => state.selectPack);
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? civicDataPack;

  return (
    <main>
      <ReviewShell title="ClaimGate Scaffold Demo" invariants={claimGateCoreInfo.invariants} />
      <section aria-label="Domain pack swap">
        <h2>Pack swap demo</h2>
        <p>Selected pack: {selectedPack.displayName}</p>
        {packs.map((pack) => (
          <button key={pack.id} type="button" onClick={() => selectPack(pack.id)}>
            Use {pack.displayName}
          </button>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
