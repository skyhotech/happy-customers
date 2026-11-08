import Dexie, { type EntityTable } from 'dexie';
import type { BranchOverride, CustomerRecord, TemplateOverride } from '@/types';
import { SCHEMA_V1, SCHEMA_V2, upgradeToV2 } from './migrations';

export interface KvRow {
  key: string;
  value: unknown;
}

export class SkyBoothDB extends Dexie {
  sessions!: EntityTable<CustomerRecord, 'id'>;
  templateOverrides!: EntityTable<TemplateOverride, 'templateId'>;
  branchOverrides!: EntityTable<BranchOverride, 'branchId'>;
  kv!: EntityTable<KvRow, 'key'>;

  constructor(name = 'sky-happy-customers') {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2).upgrade(upgradeToV2);
  }
}

export const db = new SkyBoothDB();

export class StorageQuotaError extends Error {
  constructor() {
    super('Device storage is full. Export a backup and delete older history entries, then try again.');
    this.name = 'StorageQuotaError';
  }
}

export function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string } };
  return err?.name === 'QuotaExceededError' || err?.inner?.name === 'QuotaExceededError';
}

export async function saveRecord(record: CustomerRecord, database: SkyBoothDB = db) {
  try {
    await database.sessions.put(record);
  } catch (e) {
    if (isQuotaError(e)) throw new StorageQuotaError();
    throw e;
  }
}

export async function kvGet<T>(key: string, database: SkyBoothDB = db): Promise<T | undefined> {
  return (await database.kv.get(key))?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown, database: SkyBoothDB = db) {
  await database.kv.put({ key, value });
}
