import type { CostumeReport } from '@splk/api-contracts';
/** Preserve Unicode/line breaks and stop spreadsheet formula interpretation of user text. */
export function reportCsv(report: CostumeReport): string {
  const lines: (string | number | null)[][] = [[report.title, report.generatedAt, report.notice]];
  for (const section of report.sections) lines.push([], [section.title], section.columns, ...section.rows);
  return '\ufeff' + lines.map((cells) => cells.map((value) => {
    let text = String(value ?? ''); if (typeof value === 'string' && /^[\s\x00-\x1f]*[=+@-]/u.test(text)) text = "'" + text;
    return /[;"\r\n]/u.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }).join(';')).join('\r\n') + '\r\n';
}
