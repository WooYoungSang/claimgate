import type { DomainPackScaffold } from '@claimgate/core';

export const civicDataPack: DomainPackScaffold = {
  id: 'civic-data',
  packageName: '@claimgate/pack-civic-data',
  displayName: 'Civic Data Pack',
  fixtureKinds: ['csv-row', 'web-link']
};
