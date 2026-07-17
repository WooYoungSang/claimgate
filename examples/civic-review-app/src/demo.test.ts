import { describe, expect, it } from 'vitest';
import { defaultPackId, formatDemo, runDemo } from './demo.js';

describe('example DomainPack composition', () => {
  it('defaults the public MOFA hostname to the MOFA ODA pack', () => {
    expect(defaultPackId('mofa.warvis.org')).toBe('mofa-oda');
    expect(defaultPackId('localhost')).toBe('civic-data');
  });

  it('can swap between three domain packs without changing core or UI', () => {
    const civic = runDemo('civic-data');
    const health = runDemo('health-data');
    const mofaOda = runDemo('mofa-oda');

    expect(civic.packId).toBe('civic-data');
    expect(health.packId).toBe('health-data');
    expect(mofaOda.packId).toBe('mofa-oda');
    expect(civic.riskLevel).toBe('red');
    expect(health.riskLevel).toBe('yellow');
    expect(mofaOda.riskLevel).toBe('red');
    expect(civic.claimLabel).not.toBe(health.claimLabel);
    expect(mofaOda.claimLabel).not.toBe(civic.claimLabel);
    expect(mofaOda.fixtureId).toBe('mofa-country-safety-mismatch');
  });

  it('prints deterministic pack-specific output', () => {
    expect(formatDemo(runDemo('civic-data'))).toContain('Civic Budget Review Summary');
    expect(formatDemo(runDemo('health-data'))).toContain('Health Statistic Review Summary');
    expect(formatDemo(runDemo('mofa-oda'))).toContain('MOFA ODA Claim Review Summary');
  });

  it('tells the MOFA ODA public-data review story through reviewed projections', () => {
    const output = formatDemo(runDemo('mofa-oda'));

    expect(output).toContain('Pack: MOFA ODA Public Data Pack (mofa-oda)');
    expect(output).toContain('Fixture: mofa-country-safety-mismatch');
    expect(output).toContain('mofa.country-safety-mismatch => red/conflict');
    expect(output).toContain('Source Anchor: mofa-country-safety-information');
    expect(output).toContain('Reviewer decision: corrected');
    expect(output).toContain('Evidence Pack items: 1');
    expect(output).toContain('Report: MOFA ODA Claim Review Summary');
    expect(output).toContain('Graph nodes:');
    expect(output).toContain('Evidence Pack projects 1 verified/corrected claim into the report and graph.');
    expect(output).toContain('Offline deterministic demo complete.');
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
