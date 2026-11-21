/** Small, dependency-free download helpers. Real files, real bytes. */

export function downloadBlob(filename: string, content: string, mime = 'application/json'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function downloadText(filename: string, text: string): void {
  downloadBlob(filename, text, 'text/plain');
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  downloadBlob(filename, rows.map((row) => row.map(escape).join(',')).join('\n'), 'text/csv');
}
