import type { Transaction } from 'dexie';
import type { CustomerRecord } from '@/types';

/**
 * IndexedDB schema history. Never edit an existing version — add a new one.
 *  v1: sessions, templateOverrides, kv
 *  v2: branchOverrides table, updatedAt + downloadStatus indexes, backfill outputSettings
 */
export const SCHEMA_V1 = {
  sessions: 'id, createdAt, branchId, templateId',
  templateOverrides: 'templateId',
  kv: 'key',
};

export const SCHEMA_V2 = {
  sessions: 'id, createdAt, updatedAt, branchId, templateId, downloadStatus, [branchId+createdAt]',
  templateOverrides: 'templateId',
  branchOverrides: 'branchId',
  kv: 'key',
};

export async function upgradeToV2(tx: Transaction) {
  await tx
    .table<CustomerRecord>('sessions')
    .toCollection()
    .modify((r) => {
      r.updatedAt ??= r.createdAt;
      r.downloadStatus ??= 'downloaded';
      r.outputSettings ??= { format: 'jpg', quality: 0.95, ratio: 'original', ratioFit: 'pad' };
    });
}
