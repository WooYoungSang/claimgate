import { describe, expect, it } from 'vitest';
import {
  attachAnchor,
  ClaimAnchorError,
  createExtractedClaim,
  transitionClaim,
  VerificationError,
  type Reviewer
} from '../src/index.js';

const reviewer: Reviewer = { id: 'reviewer-1', displayName: 'Civic Reviewer' };
const fixedNow = () => '2026-07-07T00:00:00.000Z';
const csvAnchor = {
  kind: 'csv-row',
  sourceId: 'source-csv-1',
  row: 12,
  column: 'population',
  quote: '12345'
} as const;

function invalidAnchorAttachError(state: string) {
  return new ClaimAnchorError(
    'E_INVALID_ANCHOR_ATTACH',
    `Cannot attach Source Anchor to ${state} claim; only extracted claims may be anchored.`
  );
}

function anchoredClaim() {
  const extracted = createExtractedClaim({
    id: 'claim-1',
    text: 'City population is 12,345.',
    aiValue: '12,000',
    subject: 'City population'
  });

  return attachAnchor(extracted, {
    anchor: csvAnchor,
    sourceValue: '12,345',
    actor: { kind: 'system', id: 'anchor-fixture' },
    now: fixedNow
  });
}

describe('ClaimGate verification state machine', () => {
  it('rejects invalid transitions with E_INVALID_TRANSITION', () => {
    const extracted = createExtractedClaim({
      id: 'claim-1',
      text: 'City population is 12,345.',
      aiValue: '12,000'
    });

    expect(() =>
      transitionClaim(extracted, {
        to: 'verified',
        reviewer,
        now: fixedNow
      })
    ).toThrow(new VerificationError('E_INVALID_TRANSITION', 'Cannot transition from extracted to verified.'));
  });

  it('rejects direct extracted to needs-evidence transitions', () => {
    const extracted = createExtractedClaim({
      id: 'claim-1',
      text: 'City population is 12,345.',
      aiValue: '12,000'
    });

    expect(() =>
      transitionClaim(extracted, {
        to: 'needs-evidence',
        actor: { kind: 'system', id: 'risk-fixture' },
        now: fixedNow
      })
    ).toThrow(new VerificationError('E_INVALID_TRANSITION', 'Cannot transition from extracted to needs-evidence.'));
  });

  it('enforces No Anchor, No Claim for malformed verified and corrected terminal transitions', () => {
    const extracted = createExtractedClaim({
      id: 'claim-1',
      text: 'City population is 12,345.',
      aiValue: '12,000'
    });
    const needsEvidence = { ...extracted, state: 'needs-evidence' as const };

    expect(() =>
      transitionClaim(needsEvidence, {
        to: 'verified',
        reviewer,
        now: fixedNow
      })
    ).toThrow(new VerificationError('E_NO_ANCHOR', 'A claim needs a Source Anchor before it can become verified.'));

    expect(() =>
      transitionClaim(needsEvidence, {
        to: 'corrected',
        reviewer,
        correction: { correctedValue: '12,345', reason: 'Source value mismatch.' },
        now: fixedNow
      })
    ).toThrow(new VerificationError('E_NO_ANCHOR', 'A claim needs a Source Anchor before it can become corrected.'));
  });

  it('requires a reviewer for terminal decisions', () => {
    const needsEvidence = transitionClaim(anchoredClaim(), {
      to: 'needs-evidence',
      actor: { kind: 'system', id: 'risk-fixture' },
      now: fixedNow
    });

    expect(() =>
      transitionClaim(needsEvidence, {
        to: 'verified',
        now: fixedNow
      })
    ).toThrow(new VerificationError('E_NO_REVIEWER', 'Terminal verification decisions require a reviewer.'));
  });

  it('only attaches a Source Anchor to extracted claims', () => {
    const anchored = anchoredClaim();
    const needsEvidence = transitionClaim(anchored, {
      to: 'needs-evidence',
      actor: { kind: 'system', id: 'risk-fixture' },
      now: fixedNow
    });

    expect(() =>
      attachAnchor(anchored, {
        anchor: csvAnchor,
        actor: { kind: 'system', id: 'anchor-fixture' },
        now: fixedNow
      })
    ).toThrow(invalidAnchorAttachError('anchored'));

    expect(() =>
      attachAnchor(needsEvidence, {
        anchor: csvAnchor,
        actor: { kind: 'system', id: 'anchor-fixture' },
        now: fixedNow
      })
    ).toThrow(invalidAnchorAttachError('needs-evidence'));
  });

  it('does not reopen terminal claims by attaching a Source Anchor', () => {
    const verified = transitionClaim(
      transitionClaim(anchoredClaim(), {
        to: 'needs-evidence',
        actor: { kind: 'system', id: 'risk-fixture' },
        now: fixedNow
      }),
      { to: 'verified', reviewer, now: fixedNow }
    );

    expect(() =>
      attachAnchor(verified, {
        anchor: csvAnchor,
        actor: { kind: 'system', id: 'anchor-fixture' },
        now: fixedNow
      })
    ).toThrow(invalidAnchorAttachError('verified'));
  });

  it('records append-only audit events without mutating prior claim snapshots', () => {
    const anchored = anchoredClaim();
    const beforeAuditLength = anchored.audit.length;

    const needsEvidence = transitionClaim(anchored, {
      to: 'needs-evidence',
      actor: { kind: 'system', id: 'risk-fixture' },
      reason: 'Rule source-exists requires reviewer confirmation.',
      now: fixedNow
    });

    const verified = transitionClaim(needsEvidence, {
      to: 'verified',
      reviewer,
      reason: 'Reviewer confirmed against source row.',
      now: fixedNow
    });

    expect(anchored.audit).toHaveLength(beforeAuditLength);
    expect(needsEvidence.audit).toHaveLength(beforeAuditLength + 1);
    expect(verified.audit).toHaveLength(beforeAuditLength + 2);
    expect(verified.audit.at(-1)).toMatchObject({
      action: 'transition',
      before: 'needs-evidence',
      after: 'verified',
      actor: { kind: 'reviewer', id: reviewer.id }
    });
  });

  it('corrected preserves the original AI value, source value, and correction reason', () => {
    const conflict = transitionClaim(anchoredClaim(), {
      to: 'conflict',
      actor: { kind: 'system', id: 'value-match-rule' },
      reason: 'AI value differs from source value.',
      now: fixedNow
    });

    const corrected = transitionClaim(conflict, {
      to: 'corrected',
      reviewer,
      correction: {
        correctedValue: '12,345',
        reason: 'CSV source row is authoritative.'
      },
      now: fixedNow
    });

    expect(corrected.state).toBe('corrected');
    expect(corrected.aiValue).toBe('12,000');
    expect(corrected.sourceValue).toBe('12,345');
    expect(corrected.correction).toEqual({
      originalAiValue: '12,000',
      sourceValue: '12,345',
      correctedValue: '12,345',
      reason: 'CSV source row is authoritative.',
      reviewerId: reviewer.id
    });
  });
});
