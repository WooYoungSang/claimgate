import { describe, expect, it } from 'vitest';
import { civicDataPack } from '../src/index.js';

describe('@claimgate/pack-civic-data scaffold', () => {
  it('declares a ClaimGate domain-pack package boundary', () => {
    expect(civicDataPack.packageName).toBe('@claimgate/pack-civic-data');
    expect(civicDataPack.fixtureKinds).toContain('csv-row');
  });
});
