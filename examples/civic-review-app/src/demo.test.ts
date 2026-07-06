import { describe, expect, it } from 'vitest';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';

describe('example scaffold composition', () => {
  it('can swap between two domain packs', () => {
    expect([civicDataPack.id, healthDataPack.id]).toEqual(['civic-data', 'health-data']);
  });
});
