import { describe, expect, it } from 'vitest';
import { CLAIMGATE_CORE_BOUNDARY, isProjectableState, listCoreInvariants } from '../src/index.js';

describe('@claimgate/core scaffold', () => {
  it('declares the pure TypeScript core boundary', () => {
    expect(CLAIMGATE_CORE_BOUNDARY).toBe('pure-typescript-core');
    expect(listCoreInvariants()).toContain('no-anchor-no-claim');
    expect(listCoreInvariants()).toContain('ai-curator-not-judge');
  });

  it('keeps projection eligibility limited to verified/corrected states', () => {
    expect(isProjectableState('verified')).toBe(true);
    expect(isProjectableState('corrected')).toBe(true);
    expect(isProjectableState('anchored')).toBe(false);
    expect(isProjectableState('conflict')).toBe(false);
  });
});
