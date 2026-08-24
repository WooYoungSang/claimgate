import { assertEvidencePackProjectable, type EvidenceItem, type EvidencePack } from '../evidence.js';

export interface EvidenceReportTemplate {
  readonly title?: string;
  readonly itemLabel?: string;
  readonly includeAudit?: boolean;
  readonly includeCorrections?: boolean;
}

export function renderEvidenceReportMarkdown(pack: EvidencePack, template: EvidenceReportTemplate = {}): string {
  assertEvidencePackProjectable(pack);

  const title = template.title ?? pack.title;
  const itemLabel = template.itemLabel ?? 'Claim';
  const includeAudit = template.includeAudit ?? false;
  const includeCorrections = template.includeCorrections ?? true;
  const lines = [
    `# ${escapeMarkdown(title)}`,
    '',
    'Projection source: Evidence Pack',
    'Projection boundary: verified/corrected reviewer decisions only',
    `Generated: ${escapeMarkdown(pack.generatedAt)}`,
    `Evidence items: ${pack.items.length}`,
    ''
  ];

  for (const [index, item] of pack.items.entries()) {
    lines.push(`## ${escapeMarkdown(itemLabel)} ${index + 1}: ${escapeMarkdown(item.reviewerDecision)}`);
    lines.push(`- Claim: ${escapeMarkdown(item.claimText)}`);
    lines.push(`- Value: ${escapeMarkdown(formatValue(item.normalizedValue))}`);
    lines.push(`- Source Anchor: ${escapeMarkdown(item.sourceAnchorId)}`);
    lines.push(`- Reviewer: ${escapeMarkdown(item.reviewerId)}`);
    if (includeCorrections && item.correctionHistory.length > 0) {
      for (const correction of item.correctionHistory) {
        lines.push(
          `- Correction: ${escapeMarkdown(formatValue(correction.originalAiValue))} → ${escapeMarkdown(formatValue(correction.correctedValue))} (${escapeMarkdown(correction.reason)})`
        );
      }
    }
    if (includeAudit) {
      lines.push(`- Audit events: ${item.auditEventCount}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderEvidenceReportHtml(pack: EvidencePack, template: EvidenceReportTemplate = {}): string {
  assertEvidencePackProjectable(pack);

  const title = template.title ?? pack.title;
  const itemLabel = template.itemLabel ?? 'Claim';
  const includeAudit = template.includeAudit ?? false;
  const includeCorrections = template.includeCorrections ?? true;
  const items = pack.items.map((item, index) => renderEvidenceItemHtml(item, index, itemLabel, includeAudit, includeCorrections)).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><p>Projection source: Evidence Pack</p><p>Projection boundary: verified/corrected reviewer decisions only</p><p>Generated: ${escapeHtml(pack.generatedAt)}</p><p>Evidence items: ${pack.items.length}</p>${items}</body></html>`;
}

function renderEvidenceItemHtml(
  item: EvidenceItem,
  index: number,
  itemLabel: string,
  includeAudit: boolean,
  includeCorrections: boolean
): string {
  const corrections = includeCorrections
    ? item.correctionHistory
        .map(
          (correction) =>
            `<li>Correction: ${escapeHtml(formatValue(correction.originalAiValue))} → ${escapeHtml(formatValue(correction.correctedValue))} (${escapeHtml(correction.reason)})</li>`
        )
        .join('')
    : '';
  const audit = includeAudit ? `<li>Audit events: ${item.auditEventCount}</li>` : '';

  return `<section><h2>${escapeHtml(itemLabel)} ${index + 1}: ${escapeHtml(item.reviewerDecision)}</h2><ul><li>Claim: ${escapeHtml(item.claimText)}</li><li>Value: ${escapeHtml(formatValue(item.normalizedValue))}</li><li>Source Anchor: ${escapeHtml(item.sourceAnchorId)}</li><li>Reviewer: ${escapeHtml(item.reviewerId)}</li>${corrections}${audit}</ul></section>`;
}

function formatValue(value: unknown): string {
  return value === undefined ? '' : String(value);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeMarkdown(value: string): string {
  return escapeHtml(value.replace(/[\r\n]+/g, ' ')).replace(/([\\`*_{}\[\]()#+!|])/g, '\\$1');
}
