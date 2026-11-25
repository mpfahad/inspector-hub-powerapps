/** Lightweight CSV/TSV row parser (quoted fields, comma or tab). */
export function parseDelimitedRows(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delim = lines[0].includes('\t') && !lines[0].includes(',') ? '\t' : ',';
  const rows: string[][] = [];

  for (const line of lines) {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === delim) {
        cols.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

export function rowsSkipHeader(rows: string[][], headerHints: string[]): string[][] {
  if (rows.length === 0) return rows;
  const first = rows[0].map((c) => c.toLowerCase());
  const looksLikeHeader = headerHints.some((h) => first.some((c) => c.includes(h.toLowerCase())));
  return looksLikeHeader ? rows.slice(1) : rows;
}
