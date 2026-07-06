import { describe, expect, it } from 'vitest';
import { healthDataPack } from '../src/index.js';

describe('@claimgate/pack-health-data scaffold', () => {
  it('declares a second ClaimGate domain-pack package boundary', () => {
    expect(healthDataPack.packageName).toBe('@claimgate/pack-health-data');
    expect(healthDataPack.fixtureKinds).toContain('pdf-page');
  });
});
