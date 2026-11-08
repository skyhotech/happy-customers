const pad = (n: number, l = 2) => String(n).padStart(l, '0');

/** Uppercase, ASCII-only, underscore-separated, max 40 chars. */
export function sanitizeFilenamePart(input: string, maxLength = 40): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, maxLength)
    .replace(/_+$/g, '');
  return cleaned || 'BRANCH';
}

export function shortUniqueId(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function formatStamp(date: Date): { ymd: string; hms: string } {
  return {
    ymd: `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    hms: `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
  };
}

/** SKY_HAPPY_CUSTOMER_{BRANCH}_{YYYYMMDD}_{HHmmss}_{UNIQUEID}.{ext} */
export function buildPosterFilename(branchName: string, date: Date, ext: 'jpg' | 'png' = 'jpg', uniqueId = shortUniqueId()): string {
  const { ymd, hms } = formatStamp(date);
  return `SKY_HAPPY_CUSTOMER_${sanitizeFilenamePart(branchName)}_${ymd}_${hms}_${sanitizeFilenamePart(uniqueId, 12)}.${ext}`;
}

export function withExtension(fileName: string, ext: 'jpg' | 'png'): string {
  return fileName.replace(/\.(jpe?g|png)$/i, '') + '.' + ext;
}
