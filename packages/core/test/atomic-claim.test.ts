import { describe, expect, it } from 'vitest';
import {
  decomposeCompositeClaimDraft,
  type CompositeClaimDraft,
  type SourceAnchor
} from '../src/index.js';

const safetyAnchor: SourceAnchor = {
  kind: 'dataset-row',
  sourceId: 'mofa-country-safety-information',
  dataset: 'country-safety.csv',
  row: 1,
  column: 'safety_notice',
  excerpt: '특별여행주의보 및 신변안전 유의'
};
const projectAnchor: SourceAnchor = {
  kind: 'dataset-row',
  sourceId: 'koica-country-cooperation-projects',
  dataset: 'koica-projects.csv',
  row: 4,
  column: 'period',
  excerpt: '사업기간: 2021-2025'
};

describe('Atomic Claim decomposition', () => {
  it('decomposes a multi-fact draft into extracted CandidateClaim atoms with at most one proposed anchor each', () => {
    const composite: CompositeClaimDraft = {
      id: 'answer-mofa-oda-composite',
      text: '협력국 A는 안전하고 KOICA는 2022-2026년에 식수 사업을 수행합니다.',
      parts: [
        {
          id: 'answer-mofa-oda-composite/safety',
          text: '협력국 A는 제한 없는 현장 활동이 가능한 안전·안정 상태입니다.',
          subject: '협력국 A 안전 상태',
          aiValue: '안전·안정',
          proposedAnchor: safetyAnchor
        },
        {
          id: 'answer-mofa-oda-composite/project-period',
          text: 'KOICA는 국가 A에서 2022년부터 2026년까지 농촌 식수 사업을 수행합니다.',
          subject: 'KOICA 국가 A 식수 사업 기간',
          aiValue: '2022-2026',
          proposedAnchor: projectAnchor
        }
      ]
    };

    const atoms = decomposeCompositeClaimDraft(composite);

    expect(atoms).toHaveLength(2);
    expect(atoms.map((atom) => atom.id)).toEqual([
      'answer-mofa-oda-composite/safety',
      'answer-mofa-oda-composite/project-period'
    ]);
    expect(atoms.every((atom) => atom.state === 'extracted')).toBe(true);
    expect(atoms[0]?.proposedAnchor).toMatchObject({ sourceId: 'mofa-country-safety-information' });
    expect(atoms[1]?.proposedAnchor).toMatchObject({ sourceId: 'koica-country-cooperation-projects' });
    expect(atoms[0]?.fixtureNotes).toContain('decomposed-from:answer-mofa-oda-composite');
    expect(Object.isFrozen(atoms)).toBe(true);
    expect(Object.isFrozen(atoms[0])).toBe(true);
  });

  it('rejects composite drafts with fewer than two atomic parts', () => {
    expect(() =>
      decomposeCompositeClaimDraft({
        id: 'single-fact-draft',
        text: 'Only one fact.',
        parts: [
          {
            id: 'single-fact-draft/only',
            text: 'Only one fact.',
            proposedAnchor: safetyAnchor
          }
        ]
      })
    ).toThrow(/Composite claim decomposition requires at least two atomic parts/);
  });

  it('rejects duplicate atomic ids because Evidence Pack projection depends on stable claim identity', () => {
    expect(() =>
      decomposeCompositeClaimDraft({
        id: 'duplicate-atomic-draft',
        text: 'Two facts with duplicate ids.',
        parts: [
          { id: 'duplicate-atom', text: 'Fact one.', proposedAnchor: safetyAnchor },
          { id: 'duplicate-atom', text: 'Fact two.', proposedAnchor: projectAnchor }
        ]
      })
    ).toThrow(/Atomic claim ids must be unique/);
  });

  it('rejects multi-anchor part shapes instead of silently choosing one anchor', () => {
    expect(() =>
      decomposeCompositeClaimDraft({
        id: 'multi-anchor-part-draft',
        text: 'A part attempts to carry multiple anchors.',
        parts: [
          {
            id: 'multi-anchor-part-draft/unsafe',
            text: 'Unsafe atomic part.',
            proposedAnchor: safetyAnchor,
            proposedAnchors: [safetyAnchor, projectAnchor]
          } as unknown as CompositeClaimDraft['parts'][number],
          { id: 'multi-anchor-part-draft/safe', text: 'Safe atomic part.', proposedAnchor: projectAnchor }
        ]
      })
    ).toThrow(/Atomic claim part supports one primary proposed Source Anchor/);
  });

  it('rejects authority fields in atomic parts because decomposition is not review or projection', () => {
    expect(() =>
      decomposeCompositeClaimDraft({
        id: 'authority-leak-draft',
        text: 'A part attempts to verify itself.',
        parts: [
          {
            id: 'authority-leak-draft/verified',
            text: 'Fact one.',
            proposedAnchor: safetyAnchor,
            reviewerDecision: 'verified'
          } as unknown as CompositeClaimDraft['parts'][number],
          { id: 'authority-leak-draft/safe', text: 'Fact two.', proposedAnchor: projectAnchor }
        ]
      })
    ).toThrow(/AI extraction candidates may only contain extracted candidates/);
  });
});
