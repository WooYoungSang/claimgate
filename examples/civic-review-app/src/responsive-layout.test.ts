import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function mediaBlock(start: string, end: string): string {
  const startIndex = css.indexOf(start);
  const endIndex = css.indexOf(end, startIndex + start.length);
  return css.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

describe('responsive review workstation layout policy', () => {
  it('stacks the workstation at compact desktop widths instead of stretching a narrow queue column', () => {
    const compactDesktop = mediaBlock('@media (max-width: 1180px)', '@media (max-width: 820px)');

    expect(compactDesktop).toMatch(/\.review-layout\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(compactDesktop).toMatch(/\.queue-list\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it('uses wrapping grids rather than clipped horizontal lanes on tablet and mobile', () => {
    const tablet = mediaBlock('@media (max-width: 820px)', '@media (max-width: 600px)');
    const mobile = mediaBlock('@media (max-width: 420px)', '@media (prefers-reduced-motion: reduce)');

    expect(tablet).toMatch(/\.demo-flow\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(tablet).toMatch(/\.queue-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(tablet).not.toMatch(/\.demo-flow\s*\{[^}]*overflow-x:\s*auto/);
    expect(tablet).not.toMatch(/\.queue-list\s*\{[^}]*overflow-x:\s*auto/);
    expect(mobile).toMatch(/\.queue-list\s*\{[^}]*grid-template-columns:\s*1fr/);
  });
});
