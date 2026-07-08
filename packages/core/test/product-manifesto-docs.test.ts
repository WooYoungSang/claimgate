import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const rootPath = (relativePath: string) => new URL(`../../../${relativePath}`, import.meta.url);

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(rootPath(relativePath), 'utf8');
}

const requiredInvariants = [
  'No Anchor, No Claim',
  'AI Curator, Not Judge',
  'Risk-first Review',
  'Evidence Pack First',
  'Fake Work Reduced'
];

const forbiddenClaims = [
  'AI verifies claims',
  'trust score decides truth',
  'graph is the source of truth',
  'fully automated fact checking'
];

describe('ClaimGate product manifesto documentation', () => {
  it('maps each manifesto slogan to implemented code and regression tests', async () => {
    const manifesto = await readRepoFile('docs/product-manifesto.md');

    for (const invariant of requiredInvariants) {
      expect(manifesto).toContain(invariant);
    }

    expect(manifesto).toContain('packages/core/src/verification.ts');
    expect(manifesto).toContain('packages/core/test/verification-state-machine.test.ts');
    expect(manifesto).toContain('packages/core/src/extraction.ts');
    expect(manifesto).toContain('packages/core/test/extraction.test.ts');
    expect(manifesto).toContain('packages/core/src/evidence.ts');
    expect(manifesto).toContain('packages/core/test/evidence-pack.test.ts');
    expect(manifesto).toContain('packages/core/test/projection-guards.test.ts');
    expect(manifesto).toContain('packages/ui/src/FakeWorkReductionStats.ts');
  });

  it('provides anti-positioning replacements for unsafe submission language', async () => {
    const languageKit = await readRepoFile('docs/submission-language-kit.md');

    for (const phrase of forbiddenClaims) {
      expect(languageKit).toContain(phrase);
    }

    expect(languageKit).toContain('say this instead');
    expect(languageKit).toContain('AI proposes candidates; reviewers decide');
    expect(languageKit).toContain('Evidence Pack is the primary artifact');
    expect(languageKit).toContain('offline, deterministic v0');
  });

  it('keeps README connected to the manifesto without granting AI hidden authority', async () => {
    const readme = await readRepoFile('README.md');

    expect(readme).toContain('docs/product-manifesto.md');
    expect(readme).toContain('docs/submission-language-kit.md');
    expect(readme).toContain('AI Curator, Not Judge');
    expect(readme).toContain('No Anchor, No Claim');
    expect(readme).not.toMatch(/AI verifies claims|AI judges truth|AI scores final risk/i);
  });
});
