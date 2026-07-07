import { type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  ClaimDiffPanel,
  CorrectionSuggestionPanel,
  DualReviewConsole,
  EvidencePackPreview,
  FakeWorkReductionStats,
  ReviewShell,
  RiskQueue,
  SourceAnchorViewer,
  type ClaimDiffViewModel,
  type CorrectionSuggestionViewModel,
  type DualReviewConsoleProps,
  type EvidencePackPreviewModel,
  type FakeWorkReductionStatsModel,
  type RiskQueueItem,
  type SourceAnchorViewModel
} from '../src/index.js';

describe('@claimgate/ui controlled component contracts', () => {
  it('exports all shared UI kit components', () => {
    expect(typeof ReviewShell).toBe('function');
    expect(typeof RiskQueue).toBe('function');
    expect(typeof DualReviewConsole).toBe('function');
    expect(typeof SourceAnchorViewer).toBe('function');
    expect(typeof ClaimDiffPanel).toBe('function');
    expect(typeof CorrectionSuggestionPanel).toBe('function');
    expect(typeof EvidencePackPreview).toBe('function');
    expect(typeof FakeWorkReductionStats).toBe('function');
  });

  it('keeps RiskQueue controlled with selection props and callbacks only', () => {
    const selected: string[] = [];
    const items: RiskQueueItem[] = [
      {
        id: 'claim-red',
        claimText: 'Agency reported 100 permits.',
        riskLevel: 'red',
        state: 'conflict',
        sourceLabel: 'Permit CSV row 12',
        ruleTrace: [{ ruleId: 'value-match', level: 'red', message: 'AI value differs from source value.' }]
      },
      {
        id: 'claim-green',
        claimText: 'Agency reported 10 offices.',
        riskLevel: 'green',
        state: 'anchored',
        sourceLabel: 'Annual report p. 3',
        ruleTrace: [{ ruleId: 'source-exists', level: 'green', message: 'Source anchor exists.' }]
      }
    ];

    const tree = RiskQueue({
      items,
      selectedClaimId: 'claim-red',
      onSelectClaim: (id) => selected.push(id)
    });

    expect(serialiseElement(tree)).toContain('Reviewer risk queue');
    expect(serialiseElement(tree)).toContain('Selected by app state');
    invokeButtons(tree, 'Review anchored source');
    expect(selected).toEqual(['claim-red', 'claim-green']);
  });

  it('keeps DualReviewConsole callbacks external and copy avoids AI verification authority', () => {
    const actions: string[] = [];
    const props: DualReviewConsoleProps = {
      claim: {
        id: 'claim-1',
        text: 'The city spent $4M on parks.',
        state: 'needs-evidence',
        riskLevel: 'red',
        sourceSummary: 'Budget PDF page 9',
        reviewerSummary: 'Needs reviewer decision after source comparison.'
      },
      primaryReviewerLabel: 'Reviewer A',
      secondaryReviewerLabel: 'Reviewer B',
      onVerifyFromSource: (id) => actions.push(`verify:${id}`),
      onRequestCorrection: (id) => actions.push(`correct:${id}`),
      onRejectClaim: (id) => actions.push(`reject:${id}`)
    };

    const tree = DualReviewConsole(props);
    const text = serialiseElement(tree);

    expect(text).toContain('Source-grounded review console');
    expect(text).toContain('Reviewer A');
    expect(text).not.toMatch(/AI verified|AI-approved|AI scored/i);
    invokeButtons(tree);
    expect(actions).toEqual(['verify:claim-1', 'correct:claim-1', 'reject:claim-1']);
  });

  it('renders aggregate-only claim diffs with a neutral status tone', () => {
    const diff: ClaimDiffViewModel = {
      claimId: 'claim-aggregate',
      claimText: 'The dataset reports a citywide average response time.',
      aiValueLabel: 'Average response time: 12 minutes',
      sourceValueLabel: 'Aggregate-only source value',
      status: 'aggregate-only'
    };

    expect(serialiseElement(ClaimDiffPanel({ diff }))).toContain('tone=neutral');
  });

  it('renders source, diff, correction, evidence, and fake-work panels without owning projection state', () => {
    const source: SourceAnchorViewModel = {
      id: 'source-1:csv:12:amount',
      kind: 'csv-row',
      sourceLabel: 'Budget CSV',
      locationLabel: 'row 12 · amount',
      quote: 'Parks, 4000000',
      retrievedAt: '2026-07-07T00:00:00.000Z'
    };
    const diff: ClaimDiffViewModel = {
      claimId: 'claim-1',
      claimText: 'The city spent $5M on parks.',
      aiValueLabel: '$5M',
      sourceValueLabel: '$4M',
      reviewerValueLabel: '$4M',
      status: 'mismatch'
    };
    const correction: CorrectionSuggestionViewModel = {
      claimId: 'claim-1',
      originalClaimText: 'The city spent $5M on parks.',
      correctedClaimText: 'The city spent $4M on parks.',
      sourceValueLabel: '$4M',
      reason: 'Anchored source value differs from extracted candidate.',
      reviewerLabel: 'Reviewer A'
    };
    const evidence: EvidencePackPreviewModel = {
      title: 'Civic review evidence pack',
      items: [
        { claimId: 'claim-1', claimText: 'The city spent $4M on parks.', state: 'corrected', sourceLabel: 'Budget CSV row 12' },
        { claimId: 'claim-2', claimText: 'The city opened 3 parks.', state: 'verified', sourceLabel: 'Annual report page 3' }
      ],
      excludedCount: 4
    };
    const stats: FakeWorkReductionStatsModel = {
      extractedClaimCount: 20,
      queuedForReviewCount: 8,
      sampledGreenCount: 2,
      projectedClaimCount: 2,
      estimatedMinutesSaved: 45
    };

    const rendered = [
      SourceAnchorViewer({ anchor: source }),
      ClaimDiffPanel({ diff }),
      CorrectionSuggestionPanel({ suggestion: correction, onAcceptCorrection: (id) => expect(id).toBe('claim-1') }),
      EvidencePackPreview({ pack: evidence, onSelectClaim: (id) => expect(id).toMatch(/^claim-/) }),
      FakeWorkReductionStats({ stats })
    ].map(serialiseElement).join('\n');

    expect(rendered).toContain('Source anchor');
    expect(rendered).toContain('Reviewer correction suggestion');
    expect(rendered).toContain('Evidence Pack preview');
    expect(rendered).toContain('Projected from reviewer-approved claims only');
    expect(rendered).toContain('Fake-work reduction estimate');
    expect(rendered).not.toMatch(/AI verified|AI-approved|AI scored/i);
  });
});

function serialiseElement(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(serialiseElement).join(' ');
  if (isReactElement(node)) {
    const props = node.props as { children?: unknown; [key: string]: unknown };
    const propText = Object.entries(props)
      .filter(([key, value]) => key !== 'children' && typeof value !== 'function')
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
    return `${String(node.type)} ${propText} ${serialiseElement(props.children)}`.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function invokeButtons(node: unknown, label?: string): void {
  if (isReactElement(node)) {
    const props = node.props as { children?: unknown; onClick?: () => void };
    const childrenText = serialiseElement(props.children);
    if (typeof props.onClick === 'function' && (label === undefined || childrenText.includes(label))) {
      props.onClick();
    }
    invokeButtons(props.children, label);
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => invokeButtons(child, label));
  }
}

function isReactElement(node: unknown): node is ReactElement {
  return Boolean(node && typeof node === 'object' && 'type' in node && 'props' in node);
}
