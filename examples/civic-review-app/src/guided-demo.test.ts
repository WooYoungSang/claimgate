import { describe, expect, it } from 'vitest';
import {
  AI_CURATOR_FIXTURE_PIPELINE,
  GUIDED_DEMO_START,
  GUIDED_DEMO_STEPS,
  createGuidedDemoState,
  currentGuidedDemoStep,
  reduceGuidedDemo
} from './guided-demo.js';

describe('domain-neutral guided demo orchestration', () => {
  it('defines a start screen and four domain-neutral review steps', () => {
    expect(GUIDED_DEMO_START).toMatchObject({
      primaryAction: 'guided',
      secondaryAction: 'free-exploration'
    });
    expect(GUIDED_DEMO_STEPS.map((step) => step.id)).toEqual([
      'candidate',
      'source-anchor',
      'human-review',
      'evidence-pack'
    ]);
    expect(GUIDED_DEMO_STEPS).toHaveLength(4);
    expect(JSON.stringify({ start: GUIDED_DEMO_START, steps: GUIDED_DEMO_STEPS })).not.toMatch(/mofa|koica|oda/i);
  });

  it('frames AI Curator as an offline proposal pipeline without decision authority', () => {
    expect(AI_CURATOR_FIXTURE_PIPELINE).toEqual({
      input: 'pre-generated offline fixture',
      process: 'candidate extraction simulation',
      output: 'candidate claim proposal',
      authority: 'proposal-only',
      boundary: 'AI proposes candidates only; deterministic rules and a human reviewer make decisions.'
    });
  });

  it('starts deterministically at the first guided step without mutating the initial state', () => {
    const initial = createGuidedDemoState();
    const started = reduceGuidedDemo(initial, { type: 'start' });

    expect(initial).toEqual({
      mode: 'start',
      currentStepId: null,
      completedStepIds: [],
      exitReason: null
    });
    expect(started).toEqual({
      mode: 'guided',
      currentStepId: 'candidate',
      completedStepIds: [],
      exitReason: null
    });
    expect(currentGuidedDemoStep(started)?.id).toBe('candidate');
  });

  it('advances all four steps before opening free exploration', () => {
    const started = reduceGuidedDemo(createGuidedDemoState(), { type: 'start' });
    const source = reduceGuidedDemo(started, { type: 'next' });
    const review = reduceGuidedDemo(source, { type: 'next' });
    const evidence = reduceGuidedDemo(review, { type: 'next' });
    const completed = reduceGuidedDemo(evidence, { type: 'next' });

    expect(source.currentStepId).toBe('source-anchor');
    expect(review.currentStepId).toBe('human-review');
    expect(evidence.currentStepId).toBe('evidence-pack');
    expect(completed).toEqual({
      mode: 'free-exploration',
      currentStepId: null,
      completedStepIds: ['candidate', 'source-anchor', 'human-review', 'evidence-pack'],
      exitReason: 'completed'
    });
    expect(currentGuidedDemoStep(completed)).toBeUndefined();
  });

  it('supports skipping a tour and choosing free exploration from the start screen', () => {
    const skipped = reduceGuidedDemo(
      reduceGuidedDemo(createGuidedDemoState(), { type: 'start' }),
      { type: 'skip' }
    );
    const explored = reduceGuidedDemo(createGuidedDemoState(), { type: 'explore' });

    expect(skipped).toEqual({
      mode: 'free-exploration',
      currentStepId: null,
      completedStepIds: [],
      exitReason: 'skipped'
    });
    expect(explored).toEqual({
      mode: 'free-exploration',
      currentStepId: null,
      completedStepIds: [],
      exitReason: 'chosen'
    });
  });

  it('resets every path to the same deterministic start state', () => {
    const progressed = reduceGuidedDemo(
      reduceGuidedDemo(
        reduceGuidedDemo(createGuidedDemoState(), { type: 'start' }),
        { type: 'next' }
      ),
      { type: 'skip' }
    );

    expect(reduceGuidedDemo(progressed, { type: 'reset' })).toEqual(createGuidedDemoState());
    expect(reduceGuidedDemo(createGuidedDemoState(), { type: 'reset' })).toEqual(createGuidedDemoState());
  });

  it('treats navigation outside guided mode as a deterministic no-op', () => {
    const initial = createGuidedDemoState();
    const explored = reduceGuidedDemo(initial, { type: 'explore' });

    expect(reduceGuidedDemo(initial, { type: 'next' })).toBe(initial);
    expect(reduceGuidedDemo(explored, { type: 'next' })).toBe(explored);
    expect(reduceGuidedDemo(explored, { type: 'skip' })).toBe(explored);
  });
});
