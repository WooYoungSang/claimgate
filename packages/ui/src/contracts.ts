import type { ClaimLifecycleState, ClaimValue, SourceAnchorKind } from '@claimgate/core';

export type RiskLevel = 'red' | 'yellow' | 'green';

export interface RuleTraceViewModel {
  readonly ruleId: string;
  readonly level: RiskLevel;
  readonly message: string;
}

export interface RiskQueueItem {
  readonly id: string;
  readonly claimText: string;
  readonly riskLevel: RiskLevel;
  readonly state: ClaimLifecycleState;
  readonly sourceLabel?: string;
  readonly reviewerLabel?: string;
  readonly ruleTrace: readonly RuleTraceViewModel[];
}

export interface RiskQueueProps {
  readonly items: readonly RiskQueueItem[];
  readonly selectedClaimId?: string;
  readonly emptyLabel?: string;
  readonly onSelectClaim?: (claimId: string) => void;
}

export interface DualReviewClaimViewModel {
  readonly id: string;
  readonly text: string;
  readonly state: ClaimLifecycleState;
  readonly riskLevel: RiskLevel;
  readonly sourceSummary?: string;
  readonly reviewerSummary?: string;
}

export interface DualReviewConsoleProps {
  readonly claim: DualReviewClaimViewModel | null;
  readonly primaryReviewerLabel: string;
  readonly secondaryReviewerLabel?: string;
  readonly disabled?: boolean;
  readonly onVerifyFromSource?: (claimId: string) => void;
  readonly onRequestCorrection?: (claimId: string) => void;
  readonly onRejectClaim?: (claimId: string) => void;
}

export interface SourceAnchorViewModel {
  readonly id: string;
  readonly kind: SourceAnchorKind;
  readonly sourceLabel: string;
  readonly locationLabel: string;
  readonly quote?: string;
  readonly retrievedAt?: string;
}

export interface SourceAnchorViewerProps {
  readonly anchor: SourceAnchorViewModel | null;
  readonly missingLabel?: string;
}

export type ClaimDiffStatus = 'match' | 'mismatch' | 'needs-review' | 'aggregate-only';

export interface ClaimDiffViewModel {
  readonly claimId: string;
  readonly claimText: string;
  readonly aiValueLabel?: string;
  readonly sourceValueLabel?: string;
  readonly reviewerValueLabel?: string;
  readonly status: ClaimDiffStatus;
}

export interface ClaimDiffPanelProps {
  readonly diff: ClaimDiffViewModel | null;
}

export interface CorrectionSuggestionViewModel {
  readonly claimId: string;
  readonly originalClaimText: string;
  readonly correctedClaimText: string;
  readonly sourceValueLabel?: string;
  readonly reason: string;
  readonly reviewerLabel?: string;
}

export interface CorrectionSuggestionPanelProps {
  readonly suggestion: CorrectionSuggestionViewModel | null;
  readonly disabled?: boolean;
  readonly onAcceptCorrection?: (claimId: string) => void;
  readonly onEditCorrection?: (claimId: string) => void;
}

export interface EvidencePackPreviewItem {
  readonly claimId: string;
  readonly claimText: string;
  readonly state: Extract<ClaimLifecycleState, 'verified' | 'corrected'>;
  readonly valueLabel?: string;
  readonly sourceLabel: string;
}

export interface EvidencePackPreviewModel {
  readonly title: string;
  readonly items: readonly EvidencePackPreviewItem[];
  readonly excludedCount?: number;
}

export interface EvidencePackPreviewProps {
  readonly pack: EvidencePackPreviewModel;
  readonly onSelectClaim?: (claimId: string) => void;
}

export interface FakeWorkReductionStatsModel {
  readonly extractedClaimCount: number;
  readonly queuedForReviewCount: number;
  readonly sampledGreenCount: number;
  readonly projectedClaimCount: number;
  readonly estimatedMinutesSaved?: number;
}

export interface FakeWorkReductionStatsProps {
  readonly stats: FakeWorkReductionStatsModel;
}

export function claimIdForEvidenceItem(item: EvidencePackPreviewItem): string {
  return item.claimId;
}

export function claimTextForEvidenceItem(item: EvidencePackPreviewItem): string {
  return item.claimText;
}

export function formatClaimValue(value: ClaimValue | undefined): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  return String(value);
}

export interface ImpactGraphNodeViewModel {
  readonly id: string;
  readonly label: 'EvidencePack' | 'Claim' | 'Source' | string;
  readonly title: string;
  readonly decision?: 'verified' | 'corrected' | string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ImpactGraphEdgeViewModel {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: 'CONTAINS_CLAIM' | 'ANCHORED_TO' | string;
}

export interface ImpactGraphViewModel {
  readonly title: string;
  readonly nodes: readonly ImpactGraphNodeViewModel[];
  readonly edges: readonly ImpactGraphEdgeViewModel[];
  readonly excludedCount?: number;
}

export interface ImpactGraphViewProps {
  readonly graph: ImpactGraphViewModel;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
}

export interface ImpactReportViewModel {
  readonly title: string;
  readonly markdown: string;
  readonly html?: string;
  readonly evidenceItemCount: number;
  readonly excludedCount?: number;
}

export interface ImpactReportProps {
  readonly report: ImpactReportViewModel;
  readonly onCopyMarkdown?: (markdown: string) => void;
}
