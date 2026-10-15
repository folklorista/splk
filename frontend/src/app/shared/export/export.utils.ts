// Export a tisk přehledů (krojový sklad, docházka). CSV se středníky a BOM, aby se v Excelu
// správně otevřela čeština.

function escapeCell(value: string | number | undefined | null): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | undefined | null)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, rows: (string | number | undefined | null)[][]): void {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Tisková podoba stránky – navigace a ovládací prvky skrývá @media print (styles.scss, třída .no-print)
export function printPage(): void {
  window.print();
}

export function formatDate(iso: string | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '';
}
