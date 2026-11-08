import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '@/db/database';
import { dateRangeFor, startOfDay, startOfMonth, type DateFilter } from '@/utils/dateUtils';
import { getStorageInfo, type StorageInfo } from '@/services/backupService';
import { decodeBlob, imageSize } from '@/services/imageProcessor';
import { useSession } from '@/store/sessionStore';
import type { CustomerRecord } from '@/types';

export type HistorySort = 'newest' | 'oldest' | 'branch';

export interface HistoryQuery {
  search: string;
  date: DateFilter;
  from?: string;
  to?: string;
  sort: HistorySort;
  limit: number;
}

/** Paginated, filtered history list (live). */
export function useHistoryList(q: HistoryQuery) {
  return useLiveQuery(async () => {
    const [from, to] = dateRangeFor(q.date, { from: q.from, to: q.to });
    const needle = q.search.trim().toLowerCase();
    let coll = db.sessions.where('createdAt').between(from, to === Infinity ? Number.MAX_SAFE_INTEGER : to, true, true);
    if (q.sort === 'newest') coll = coll.reverse();
    if (needle) {
      coll = coll.filter((r) => r.branchNameSnapshot.toLowerCase().includes(needle) || r.branchAddressSnapshot.toLowerCase().includes(needle) || (r.customerLabel ?? '').toLowerCase().includes(needle));
    }
    const total = await coll.clone().count();
    let items: CustomerRecord[];
    if (q.sort === 'branch') {
      items = (await coll.sortBy('branchNameSnapshot')).slice(0, q.limit);
    } else {
      items = await coll.limit(q.limit).toArray();
    }
    return { items, total };
  }, [q.search, q.date, q.from, q.to, q.sort, q.limit]);
}

/** Real statistics from IndexedDB. */
export function useDashboardStats() {
  return useLiveQuery(async () => {
    const [total, today, month, recent] = await Promise.all([
      db.sessions.count(),
      db.sessions.where('createdAt').aboveOrEqual(startOfDay()).count(),
      db.sessions.where('createdAt').aboveOrEqual(startOfMonth()).count(),
      db.sessions.orderBy('createdAt').reverse().limit(6).toArray(),
    ]);
    return { total, today, month, recent };
  }, []);
}

export function useStorageInfo(refreshKey: unknown = 0) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const count = useLiveQuery(() => db.sessions.count(), []);
  useEffect(() => {
    getStorageInfo().then(setInfo).catch(() => setInfo(null));
  }, [count, refreshKey]);
  return info;
}

export async function deleteRecord(id: string) {
  await db.sessions.delete(id);
}

/**
 * Re-opens a saved record in the editor. duplicate=false updates the same record on save,
 * duplicate=true starts a new session that reuses the photo (and can target another branch).
 */
export async function reopenRecord(record: CustomerRecord, duplicate: boolean) {
  if (!record.originalPhotoBlob || record.originalPhotoBlob.size === 0) {
    throw new Error('The original photo was not stored for this record (Image storage setting), so it cannot be re-edited.');
  }
  const img = await decodeBlob(record.originalPhotoBlob);
  const size = imageSize(img);
  if ('close' in img) img.close();
  useSession.getState().startFromRecord({
    recordId: record.id,
    duplicate,
    photo: { blob: record.originalPhotoBlob, width: size.width, height: size.height, source: 'history', capturedMirrored: record.mirrorEnabled !== record.cropSettings.mirror },
    adjust: { ...record.cropSettings },
    branchId: record.branchId,
    templateId: record.templateId,
  });
}
