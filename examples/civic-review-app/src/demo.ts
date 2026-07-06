import { claimGateCoreInfo, listCoreInvariants } from '@claimgate/core';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';

const packNames = [civicDataPack.displayName, healthDataPack.displayName].join(' + ');
console.log(`ClaimGate demo: ${claimGateCoreInfo.packageName} with ${packNames}`);
console.log(`Invariants: ${listCoreInvariants().join(', ')}`);
console.log('Offline deterministic scaffold demo complete.');
