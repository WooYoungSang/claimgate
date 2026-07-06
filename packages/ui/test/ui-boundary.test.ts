import { describe, expect, it } from 'vitest';
import { ReviewShell } from '../src/index.js';

describe('@claimgate/ui scaffold', () => {
  it('exports a controlled review shell component', () => {
    expect(typeof ReviewShell).toBe('function');
  });
});
