import { claimGateCoreInfo, listCoreInvariants } from '@claimgate/core';
import type { DomainPack } from '@claimgate/core/domain-pack';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';

const packs: Record<string, DomainPack> = {
  [civicDataPack.id]: civicDataPack,
  [healthDataPack.id]: healthDataPack
};

export interface DemoSummary {
  readonly corePackage: string;
  readonly packId: string;
  readonly packName: string;
  readonly claimLabel: string;
  readonly fixtureId: string;
  readonly riskLevel: string;
  readonly recommendedState: string;
  readonly reportTemplate: string;
}

export function runDemo(packId: string): DemoSummary {
  const pack = packs[packId];
  if (!pack) {
    throw new Error(`Unknown pack '${packId}'. Available packs: ${Object.keys(packs).join(', ')}`);
  }

  const fixture = pack.fixtures[0];
  const rule = fixture ? pack.riskRules.find((candidate) => candidate.id === fixture.expected.ruleId) : undefined;
  if (!fixture || !rule) {
    throw new Error(`Pack '${pack.id}' is missing a runnable fixture or expected rule.`);
  }

  const decision = rule.evaluate({ packId: pack.id, fixtureId: fixture.id, claim: fixture.claim });
  return {
    corePackage: claimGateCoreInfo.packageName,
    packId: pack.id,
    packName: pack.displayName,
    claimLabel: pack.labels.claimPlural,
    fixtureId: fixture.id,
    riskLevel: decision.level,
    recommendedState: decision.recommendedState,
    reportTemplate: pack.reportTemplates[0]?.title ?? 'No report template'
  };
}

export function formatDemo(summary: DemoSummary): string {
  return [
    `ClaimGate demo: ${summary.corePackage}`,
    `Pack: ${summary.packName} (${summary.packId})`,
    `Claims: ${summary.claimLabel}`,
    `Fixture: ${summary.fixtureId}`,
    `Risk: ${summary.riskLevel} -> ${summary.recommendedState}`,
    `Report: ${summary.reportTemplate}`,
    `Invariants: ${listCoreInvariants().join(', ')}`,
    'Offline deterministic demo complete.'
  ].join('\n');
}

function cliPackId(argv: readonly string[]): string {
  const packFlag = argv.find((arg) => arg.startsWith('--pack='));
  if (packFlag) return packFlag.slice('--pack='.length);
  const packIndex = argv.indexOf('--pack');
  if (packIndex >= 0 && argv[packIndex + 1]) return argv[packIndex + 1]!;
  return civicDataPack.id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(formatDemo(runDemo(cliPackId(process.argv.slice(2)))));
}
