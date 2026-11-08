export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
export const daysAgo = (n: number, d = new Date()) => startOfDay(d) - (n - 1) * 86_400_000;

export type DateFilter = 'all' | 'today' | '7d' | 'month' | 'custom';

export function dateRangeFor(filter: DateFilter, custom?: { from?: string; to?: string }, now = new Date()): [number, number] {
  switch (filter) {
    case 'today':
      return [startOfDay(now), Infinity];
    case '7d':
      return [daysAgo(7, now), Infinity];
    case 'month':
      return [startOfMonth(now), Infinity];
    case 'custom': {
      const from = custom?.from ? new Date(custom.from + 'T00:00:00').getTime() : 0;
      const to = custom?.to ? new Date(custom.to + 'T23:59:59.999').getTime() : Infinity;
      return [from, to];
    }
    default:
      return [0, Infinity];
  }
}

const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (ts: number) => dtf.format(new Date(ts));

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
