import { describe, expect, it } from 'vitest';
import { buildVisualDiff } from './visual-diff.js';

describe('buildVisualDiff', () => {
  it.each([
    ['ordinary strings', '서울', '서울', 'string', '서울'],
    ['zero', 0, 0, 'number', '0'],
    ['false', false, false, 'boolean', 'false'],
    ['empty strings', '', '', 'string', '빈 문자열'],
    ['null', null, null, 'null', 'null']
  ] as const)('reports matching %s without hiding the primitive type', (_name, aiValue, sourceValue, valueType, text) => {
    const diff = buildVisualDiff({ aiValue, sourceValue });

    expect(diff.status).toBe('match');
    expect(diff.statusLabel).toBe('값 일치');
    expect(diff.ai).toMatchObject({ presence: 'present', valueType, text });
    expect(diff.source).toMatchObject({ presence: 'present', valueType, text });
    expect(diff.accessibleLabel).toContain('비교 결과: 값 일치');
  });

  it.each([
    ['different strings', '안전', '주의'],
    ['string and number', '0', 0],
    ['boolean and number', false, 0],
    ['case-sensitive strings', 'ODA', 'oda'],
    ['null and empty string', null, '']
  ] as const)('reports %s as a deterministic typed mismatch', (_name, aiValue, sourceValue) => {
    const diff = buildVisualDiff({ aiValue, sourceValue });

    expect(diff.status).toBe('mismatch');
    expect(diff.statusLabel).toBe('값 불일치');
    expect(diff.accessibleLabel).toContain('비교 결과: 값 불일치');
  });

  it('distinguishes a missing value from null, false, zero, and an empty string', () => {
    expect(buildVisualDiff({ sourceValue: null })).toMatchObject({
      status: 'missing',
      missingSides: ['ai'],
      ai: { presence: 'missing', valueType: 'missing', text: '값 없음' },
      source: { presence: 'present', valueType: 'null', text: 'null' }
    });
    expect(buildVisualDiff({ aiValue: false })).toMatchObject({ status: 'missing', missingSides: ['source'] });
    expect(buildVisualDiff({ aiValue: 0, sourceValue: undefined })).toMatchObject({ status: 'missing', missingSides: ['source'] });
    expect(buildVisualDiff({ aiValue: '', sourceValue: '' }).status).toBe('match');
    expect(buildVisualDiff({})).toMatchObject({ status: 'missing', missingSides: ['ai', 'source'] });
  });

  it('provides explicit non-color labels for each status and missing side', () => {
    const diff = buildVisualDiff({ aiValue: '정상' });

    expect(diff.statusLabel).toBe('값 누락');
    expect(diff.statusSymbol).toBe('?');
    expect(diff.ai.accessibleLabel).toBe('AI 제안 값: 문자열 정상');
    expect(diff.source.accessibleLabel).toBe('Source Anchor 값: 값 없음');
    expect(diff.accessibleLabel).toBe('비교 결과: 값 누락. Source Anchor 값이 없습니다.');
  });

  it('returns text-only render data without interpreting markup or making a truth judgment', () => {
    const untrustedText = '<img src=x onerror=alert(1)>';
    const diff = buildVisualDiff({ aiValue: untrustedText, sourceValue: untrustedText });

    expect(diff.ai.text).toBe(untrustedText);
    expect(diff.source.text).toBe(untrustedText);
    expect(diff).not.toHaveProperty('html');
    expect(diff).not.toHaveProperty('isTrue');
    expect(diff).not.toHaveProperty('recommendation');
  });
});
