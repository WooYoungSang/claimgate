import { createElement } from 'react';
import type { ImpactReportProps } from './contracts.js';
import { Field, Section } from './view-helpers.js';

export function ImpactReport(props: ImpactReportProps) {
  const { report, onCopyMarkdown } = props;
  const markdownPreview = firstNonEmptyLines(report.markdown, 6).join('\n');

  return Section({
    label: 'Evidence report projection',
    children: [
      createElement('h2', { key: 'heading' }, 'Evidence report projection'),
      createElement(
        'p',
        { key: 'copy' },
        'Read-only report preview generated from verified or corrected Evidence Pack items. The host app owns export and handoff decisions.'
      ),
      Field({ label: 'Title', value: report.title }),
      Field({ label: 'Evidence items', value: `Evidence items: ${report.evidenceItemCount}` }),
      Field({ label: 'Excluded before projection', value: `excluded before projection: ${report.excludedCount ?? 0}` }),
      createElement('pre', { key: 'markdown', 'aria-label': 'Markdown report preview' }, markdownPreview),
      report.html ? Field({ label: 'HTML bytes', value: report.html.length }) : null,
      createElement(
        'button',
        { key: 'copy', type: 'button', onClick: () => onCopyMarkdown?.(report.markdown) },
        'Copy markdown for handoff'
      )
    ]
  });
}

function firstNonEmptyLines(value: string, limit: number): readonly string[] {
  return value.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, limit);
}
