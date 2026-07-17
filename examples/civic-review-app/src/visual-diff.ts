export type VisualDiffValue = string | number | boolean | null;

export type VisualDiffStatus = 'match' | 'mismatch' | 'missing';

export type VisualDiffValueType = 'string' | 'number' | 'boolean' | 'null' | 'missing';

export type VisualDiffSideName = 'ai' | 'source';

export interface VisualDiffInput {
  readonly aiValue?: VisualDiffValue;
  readonly sourceValue?: VisualDiffValue;
}

export interface VisualDiffSide {
  readonly side: VisualDiffSideName;
  readonly label: string;
  readonly presence: 'present' | 'missing';
  readonly valueType: VisualDiffValueType;
  readonly text: string;
  readonly accessibleLabel: string;
}

export interface VisualDiff {
  readonly status: VisualDiffStatus;
  readonly statusLabel: '값 일치' | '값 불일치' | '값 누락';
  readonly statusSymbol: '=' | '≠' | '?';
  readonly accessibleLabel: string;
  readonly missingSides: readonly VisualDiffSideName[];
  readonly ai: VisualDiffSide;
  readonly source: VisualDiffSide;
}

const sideLabels: Readonly<Record<VisualDiffSideName, string>> = {
  ai: 'AI 제안 값',
  source: '출처 근거 값'
};

function buildSide(side: VisualDiffSideName, value: VisualDiffValue | undefined): VisualDiffSide {
  const label = sideLabels[side];
  if (value === undefined) {
    return Object.freeze({
      side,
      label,
      presence: 'missing',
      valueType: 'missing',
      text: '값 없음',
      accessibleLabel: `${label}: 값 없음`
    });
  }

  if (value === null) {
    return Object.freeze({
      side,
      label,
      presence: 'present',
      valueType: 'null',
      text: '값 없음',
      accessibleLabel: `${label}: 값 없음`
    });
  }

  const valueType: Exclude<VisualDiffValueType, 'null' | 'missing'> =
    typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'boolean';
  const text = valueType === 'string' && value === ''
    ? '빈 문자열'
    : valueType === 'boolean'
      ? value ? '참' : '거짓'
      : String(value);
  const typeLabel = valueType === 'string' ? '문자열' : valueType === 'number' ? '숫자' : '불리언';

  return Object.freeze({
    side,
    label,
    presence: 'present',
    valueType,
    text,
    accessibleLabel: `${label}: ${typeLabel} ${text}`
  });
}

function describeMissingSides(missingSides: readonly VisualDiffSideName[]): string {
  if (missingSides.length === 2) return 'AI 제안 값과 출처 근거 값이 없습니다.';
  return `${sideLabels[missingSides[0]!]}이 없습니다.`;
}

export function buildVisualDiff(input: VisualDiffInput): VisualDiff {
  const ai = buildSide('ai', input.aiValue);
  const source = buildSide('source', input.sourceValue);
  const missingSides = Object.freeze(
    [ai, source]
      .filter((side) => side.presence === 'missing')
      .map((side) => side.side)
  );

  if (missingSides.length > 0) {
    return Object.freeze({
      status: 'missing',
      statusLabel: '값 누락',
      statusSymbol: '?',
      accessibleLabel: `비교 결과: 값 누락. ${describeMissingSides(missingSides)}`,
      missingSides,
      ai,
      source
    });
  }

  const matches = input.aiValue === input.sourceValue;
  return Object.freeze({
    status: matches ? 'match' : 'mismatch',
    statusLabel: matches ? '값 일치' : '값 불일치',
    statusSymbol: matches ? '=' : '≠',
    accessibleLabel: matches
      ? '비교 결과: 값 일치. 두 값의 타입과 내용이 같습니다.'
      : '비교 결과: 값 불일치. 두 값의 타입 또는 내용이 다릅니다.',
    missingSides,
    ai,
    source
  });
}
