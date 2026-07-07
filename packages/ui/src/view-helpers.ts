import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { RiskLevel } from './contracts.js';

export function Section(props: { readonly label: string; readonly children: ReactNode }) {
  return createElement('section', { 'aria-label': props.label }, withStableKeys(props.children));
}

function withStableKeys(children: ReactNode): ReactNode {
  if (!Array.isArray(children)) return children;
  return children.map((child, index) => {
    if (isValidElement(child) && child.key === null) {
      return cloneElement(child as ReactElement, { key: `section-child-${index}` });
    }
    return child;
  });
}

export function Field(props: { readonly label: string; readonly value: ReactNode }) {
  return createElement(
    'p',
    null,
    createElement('strong', null, `${props.label}: `),
    props.value
  );
}

export function StatusBadge(props: { readonly label: string; readonly tone?: RiskLevel | 'neutral' }) {
  return createElement('span', { 'data-tone': props.tone ?? 'neutral' }, props.label);
}

export function EmptyState(props: { readonly children?: ReactNode }) {
  return createElement('p', { role: 'status' }, props.children);
}
