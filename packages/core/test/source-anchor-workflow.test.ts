import { describe, expect, it } from 'vitest';
import {
  acceptProposedSourceAnchor,
  acceptSourceAnchor,
  createExtractedClaimFromCandidate,
  rejectProposedSourceAnchor,
  type CandidateClaim,
  type SourceAnchor
} from '../src/index.js';

const fixedNow = () => '2026-07-08T00:00:00.000Z';
const reviewer = { id: 'anchor-reviewer-1', displayName: 'Anchor Reviewer' };
const anchor: SourceAnchor = {
  kind: 'dataset-row',
  sourceId: 'mofa-country-safety-information',
  dataset: 'country-safety.csv',
  row: 2,
  column: 'advisory',
  excerpt: '특별여행주의보·신변안전 유의'
};
const candidate: CandidateClaim = {
  id: 'claim-mofa-safety',
  text: '협력국 A는 제한 없는 현장 활동이 가능한 안전·안정 상태입니다.',
  state: 'extracted',
  subject: '협력국 A 안전 상태',
  aiValue: '안전·안정',
  proposedAnchor: anchor
};

describe('Source Anchor acceptance workflow', () => {
  it('accepts a reviewed Source Anchor through reviewer authority instead of AI authority', () => {
    const claim = createExtractedClaimFromCandidate(candidate, {
      actor: { kind: 'system', id: 'local-gemma:gemma4:12b' },
      now: fixedNow
    });

    const anchored = acceptSourceAnchor({
      claim,
      anchor,
      sourceValue: '특별여행주의보·신변안전 유의',
      reviewer,
      reason: 'RAG로 회수한 공공데이터 행과 후보 주장을 대조해 앵커를 수락했습니다.',
      now: fixedNow
    });

    expect(anchored.state).toBe('anchored');
    expect(anchored.sourceValue).toBe('특별여행주의보·신변안전 유의');
    expect(anchored.anchor).toMatchObject({ sourceId: 'mofa-country-safety-information', row: 2 });
    expect(anchored.audit.at(-1)).toMatchObject({
      action: 'anchor',
      actor: { kind: 'reviewer', id: 'anchor-reviewer-1', displayName: 'Anchor Reviewer' },
      reason: 'Accepted Source Anchor: RAG로 회수한 공공데이터 행과 후보 주장을 대조해 앵커를 수락했습니다.'
    });
  });

  it('accepts an extractor-proposed anchor only when claim and candidate match', () => {
    const claim = createExtractedClaimFromCandidate(candidate, { now: fixedNow });

    const anchored = acceptProposedSourceAnchor({
      claim,
      candidate,
      sourceValue: '특별여행주의보·신변안전 유의',
      reviewer,
      reason: '제안 앵커가 회수된 출처 행과 일치합니다.',
      now: fixedNow
    });

    expect(anchored.state).toBe('anchored');
    expect(anchored.anchor).toMatchObject({ sourceId: 'mofa-country-safety-information', row: 2 });
    expect(anchored.audit.at(-1)?.reason).toBe('Accepted extractor-proposed Source Anchor: 제안 앵커가 회수된 출처 행과 일치합니다.');
  });

  it('rejects accepting a proposed anchor for a different claim', () => {
    const claim = createExtractedClaimFromCandidate({ ...candidate, id: 'other-claim' }, { now: fixedNow });

    expect(() =>
      acceptProposedSourceAnchor({
        claim,
        candidate,
        sourceValue: '특별여행주의보·신변안전 유의',
        reviewer,
        reason: '다른 claim에는 붙일 수 없습니다.',
        now: fixedNow
      })
    ).toThrow(/Proposed Source Anchor candidate id must match claim id/);
  });

  it('rejects accepting an absent proposed anchor', () => {
    const candidateWithoutProposal = { ...candidate, proposedAnchor: undefined };
    const claim = createExtractedClaimFromCandidate(candidateWithoutProposal, { now: fixedNow });

    expect(() =>
      acceptProposedSourceAnchor({
        claim,
        candidate: candidateWithoutProposal,
        sourceValue: '특별여행주의보·신변안전 유의',
        reviewer,
        reason: '없는 제안 앵커는 수락할 수 없습니다.',
        now: fixedNow
      })
    ).toThrow(/Candidate has no proposed Source Anchor/);
  });

  it('records a rejected proposed anchor without attaching it to a Claim', () => {
    const rejection = rejectProposedSourceAnchor({
      candidate,
      reviewer,
      reason: '후보가 복합 주장이라 원자 claim으로 분해해야 합니다.',
      now: fixedNow
    });

    expect(rejection).toMatchObject({
      candidateId: 'claim-mofa-safety',
      decision: 'rejected',
      reviewer,
      rejectedAt: '2026-07-08T00:00:00.000Z',
      reason: '후보가 복합 주장이라 원자 claim으로 분해해야 합니다.'
    });
    expect(rejection.proposedAnchor).toMatchObject({ sourceId: 'mofa-country-safety-information', row: 2 });
  });

  it('requires a human-readable reason for acceptance and rejection decisions', () => {
    const claim = createExtractedClaimFromCandidate(candidate, { now: fixedNow });

    expect(() =>
      acceptSourceAnchor({
        claim,
        anchor,
        reviewer,
        reason: ' ',
        now: fixedNow
      })
    ).toThrow(/requires a non-empty reason/);

    expect(() =>
      rejectProposedSourceAnchor({
        candidate,
        reviewer,
        reason: '',
        now: fixedNow
      })
    ).toThrow(/requires a non-empty reason/);
  });
});
