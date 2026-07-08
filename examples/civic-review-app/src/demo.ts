import {
  applyReviewerCorrection,
  applyRiskDisposition,
  attachAnchor,
  claimGateCoreInfo,
  createEvidencePack,
  createExtractedClaim,
  listCoreInvariants,
  projectEvidencePackToGraph,
  renderEvidenceReportMarkdown,
  sourceAnchorId,
  transitionClaim,
  type Claim,
  type ClaimValue,
  type Reviewer
} from '@claimgate/core';
import type { DomainPack } from '@claimgate/core/domain-pack';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';

const packs: Record<string, DomainPack> = {
  [civicDataPack.id]: civicDataPack,
  [healthDataPack.id]: healthDataPack
};

const fixedNow = () => '2026-07-08T00:00:00.000Z';
const reviewer: Reviewer = { id: 'judge-demo-reviewer', displayName: 'Judge demo reviewer' };

export interface DemoSummary {
  readonly corePackage: string;
  readonly packId: string;
  readonly packName: string;
  readonly claimLabel: string;
  readonly fixtureId: string;
  readonly riskLevel: string;
  readonly recommendedState: string;
  readonly reportTemplate: string;
  readonly storyTitle: string;
  readonly aiBoundary: string;
  readonly sourceAnchorId: string;
  readonly sourceValue: string;
  readonly reviewerDecision: string;
  readonly correctedValue: string;
  readonly evidencePackTitle: string;
  readonly evidenceItemCount: number;
  readonly reportIncludesCorrection: boolean;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly storyBeats: readonly string[];
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
  const anchored = attachAnchor(
    createExtractedClaim({
      id: fixture.claim.id,
      text: fixture.claim.text,
      subject: fixture.claim.subject,
      aiValue: fixture.claim.aiValue,
      actor: { kind: 'system', id: 'offline-ai-curator' },
      now: fixedNow
    }),
    {
      anchor: fixture.claim.anchor,
      sourceValue: fixture.claim.sourceValue,
      actor: { kind: 'system', id: 'fixture-anchorer' },
      reason: 'Offline fixture supplied the source anchor; no OCR/parser/LLM was invoked.',
      now: fixedNow
    }
  );
  const riskDispositioned = applyRiskDisposition({
    claim: anchored,
    recommendedState: decision.recommendedState,
    reason: `Deterministic domain rule ${rule.id}: ${decision.trace[0]?.message ?? rule.description}`,
    now: fixedNow
  });
  const reviewed = reviewForDemo(riskDispositioned, fixture.claim.sourceValue);
  const evidencePack = createEvidencePack({
    id: `${pack.id}-judges-demo-evidence-pack`,
    title: `${pack.displayName} Judges Demo Evidence Pack`,
    claims: [reviewed],
    sources: [fixture.source],
    generatedAt: fixedNow(),
    metadata: {
      packId: pack.id,
      fixtureId: fixture.id,
      offline: true,
      deterministic: true
    }
  });
  const reportMarkdown = renderEvidenceReportMarkdown(evidencePack, {
    title: pack.reportTemplates[0]?.title ?? evidencePack.title,
    itemLabel: pack.labels.claimSingular,
    includeAudit: true
  });
  const graph = projectEvidencePackToGraph(evidencePack);

  return {
    corePackage: claimGateCoreInfo.packageName,
    packId: pack.id,
    packName: pack.displayName,
    claimLabel: pack.labels.claimPlural,
    fixtureId: fixture.id,
    riskLevel: decision.level,
    recommendedState: decision.recommendedState,
    reportTemplate: pack.reportTemplates[0]?.title ?? 'No report template',
    storyTitle: storyTitle(reviewed.state),
    aiBoundary: 'AI proposed the candidate; deterministic rules and a reviewer made the decision.',
    sourceAnchorId: sourceAnchorId(fixture.claim.anchor),
    sourceValue: String(fixture.claim.sourceValue ?? ''),
    reviewerDecision: reviewed.state,
    correctedValue: String(reviewed.correction?.correctedValue ?? reviewed.sourceValue ?? reviewed.aiValue ?? ''),
    evidencePackTitle: evidencePack.title,
    evidenceItemCount: evidencePack.items.length,
    reportIncludesCorrection: reportMarkdown.includes('Correction:'),
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    storyBeats: Object.freeze([
      `1. AI curator proposes: ${fixture.claim.text}`,
      `2. Source anchor grounds it: ${sourceAnchorId(fixture.claim.anchor)}`,
      `3. Deterministic rule trace: ${rule.id} => ${decision.level}/${decision.recommendedState}`,
      `4. Human reviewer decision: ${reviewed.state}`,
      `5. Evidence Pack projects ${evidencePack.items.length} verified/corrected claim.`
    ])
  };
}

export function formatDemo(summary: DemoSummary): string {
  return [
    `ClaimGate demo: ${summary.corePackage}`,
    `Story: ${summary.storyTitle}`,
    `Pack: ${summary.packName} (${summary.packId})`,
    `Claims: ${summary.claimLabel}`,
    `Fixture: ${summary.fixtureId}`,
    `Risk: ${summary.riskLevel} -> ${summary.recommendedState}`,
    `AI boundary: ${summary.aiBoundary}`,
    `Source Anchor: ${summary.sourceAnchorId}`,
    `Reviewer decision: ${summary.reviewerDecision}`,
    `Corrected/source value: ${summary.correctedValue}`,
    `Evidence Pack items: ${summary.evidenceItemCount}`,
    `Report: ${summary.reportTemplate}`,
    `Graph nodes: ${summary.graphNodeCount}, edges: ${summary.graphEdgeCount}`,
    `Invariants: ${listCoreInvariants().join(', ')}`,
    ...summary.storyBeats,
    'Offline deterministic demo complete.'
  ].join('\n');
}

function reviewForDemo(claim: Claim, correctedValue: unknown): Claim {
  if (claim.state === 'conflict') {
    return applyReviewerCorrection({
      claim,
      reviewer,
      correctedValue: correctedValue as ClaimValue,
      reason: 'Reviewer corrected the AI value to the anchored source value.',
      now: fixedNow
    });
  }

  return transitionClaim(claim, {
    to: 'verified',
    reviewer,
    reason: 'Reviewer verified the anchored source-backed claim after deterministic risk triage.',
    now: fixedNow
  });
}

function storyTitle(reviewerDecision: string): string {
  return reviewerDecision === 'corrected'
    ? 'Wrong AI claim → risk queue → reviewer correction → Evidence Pack'
    : 'Risk queue → reviewer verification → Evidence Pack';
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
