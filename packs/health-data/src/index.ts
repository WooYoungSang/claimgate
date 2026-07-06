import type { DomainPackScaffold } from '@claimgate/core';

export const healthDataPack: DomainPackScaffold = {
  id: 'health-data',
  packageName: '@claimgate/pack-health-data',
  displayName: 'Health Data Pack',
  fixtureKinds: ['pdf-page', 'text-span']
};
