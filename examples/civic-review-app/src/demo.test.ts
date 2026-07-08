import { describe, expect, it } from 'vitest';
import { formatDemo, runDemo } from './demo.js';

describe('example DomainPack composition', () => {
  it('can swap between two domain packs without changing core or UI', () => {
    const civic = runDemo('civic-data');
    const health = runDemo('health-data');

    expect(civic.packId).toBe('civic-data');
    expect(health.packId).toBe('health-data');
    expect(civic.riskLevel).toBe('red');
    expect(health.riskLevel).toBe('yellow');
    expect(civic.claimLabel).not.toBe(health.claimLabel);
  });

  it('prints deterministic pack-specific output', () => {
    expect(formatDemo(runDemo('civic-data'))).toContain('Civic Budget Review Summary');
    expect(formatDemo(runDemo('health-data'))).toContain('Health Statistic Review Summary');
  });

  it('tells the judges-first correction to Evidence Pack story', () => {
    const civic = runDemo('civic-data');
    const output = formatDemo(civic);

    expect(civic.storyTitle).toBe('Wrong AI claim → risk queue → reviewer correction → Evidence Pack');
    expect(civic.aiBoundary).toBe('AI proposed the candidate; deterministic rules and a reviewer made the decision.');
    expect(civic.sourceAnchorId).toContain('civic-budget-fy2026');
    expect(civic.reviewerDecision).toBe('corrected');
    expect(civic.evidenceItemCount).toBe(1);
    expect(civic.graphNodeCount).toBeGreaterThanOrEqual(3);
    expect(civic.reportIncludesCorrection).toBe(true);
    expect(output).toContain('Story: Wrong AI claim → risk queue → reviewer correction → Evidence Pack');
    expect(output).toContain('AI boundary: AI proposed the candidate; deterministic rules and a reviewer made the decision.');
    expect(output).toContain('Evidence Pack items: 1');
    expect(output).toContain('Graph nodes:');
  });

});
