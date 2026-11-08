import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SkyBoothDB, StorageQuotaError, isQuotaError, saveRecord } from '@/db/database';
import { SCHEMA_V1 } from '@/db/migrations';
import { exportFullBackup, exportMetadataJson, importBackup } from '@/services/backupService';
import type { CustomerRecord } from '@/types';
import { DEFAULT_ADJUST } from '@/types';
import { BASE_TEMPLATES } from '@/services/templateResolver';

let n = 0;
function makeRecord(over: Partial<CustomerRecord> = {}): CustomerRecord {
  n++;
  const bytes = (v: number) => new Blob([new Uint8Array([0xff, 0xd8, v, n])], { type: 'image/jpeg' });
  return {
    id: `rec-${n}`,
    createdAt: Date.UTC(2026, 10, 1) + n * 1000,
    updatedAt: Date.UTC(2026, 10, 1) + n * 1000,
    branchId: 'br-arcot-sandy-bazaar',
    branchNameSnapshot: 'Arcot – Sandy Bazaar',
    branchAddressSnapshot: 'எண். 86, சாண்டி பஜார், கலவை ரோடு, ஆற்காடு',
    templateId: 'tpl-dream-diwali-9',
    originalPhotoBlob: bytes(1),
    generatedPosterBlob: bytes(2),
    thumbnailBlob: bytes(3),
    fileName: `SKY_HAPPY_CUSTOMER_ARCOT_${n}.jpg`,
    imageWidth: 3516,
    imageHeight: 6250,
    mirrorEnabled: true,
    cropSettings: DEFAULT_ADJUST,
    placementSettings: BASE_TEMPLATES[0].photoPlacement,
    outputSettings: { format: 'jpg', quality: 0.95, ratio: 'original', ratioFit: 'pad' },
    downloadStatus: 'downloaded',
    ...over,
  };
}

const blobBytes = async (b: Blob) => Array.from(new Uint8Array(await b.arrayBuffer()));

describe('IndexedDB history', () => {
  let db: SkyBoothDB;
  beforeEach(() => {
    db = new SkyBoothDB(`test-${Math.random()}`);
  });
  afterEach(async () => {
    await db.delete();
  });

  it('stores Blobs (not base64) and reads them back intact', async () => {
    const r = makeRecord();
    await saveRecord(r, db);
    const got = (await db.sessions.get(r.id))!;
    expect(got.generatedPosterBlob).toBeInstanceOf(Blob);
    expect(await blobBytes(got.generatedPosterBlob)).toEqual(await blobBytes(r.generatedPosterBlob));
    expect(got.cropSettings).toEqual(DEFAULT_ADJUST);
  });

  it('queries by date and branch, sorts newest first', async () => {
    await saveRecord(makeRecord({ createdAt: 1000 }), db);
    await saveRecord(makeRecord({ createdAt: 3000, branchId: 'br-x' }), db);
    await saveRecord(makeRecord({ createdAt: 2000 }), db);
    const newest = await db.sessions.orderBy('createdAt').reverse().toArray();
    expect(newest.map((r) => r.createdAt)).toEqual([3000, 2000, 1000]);
    expect(await db.sessions.where('createdAt').aboveOrEqual(2000).count()).toBe(2);
    expect(await db.sessions.where('branchId').equals('br-x').count()).toBe(1);
  });

  it('survives reopening the database (refresh / restart)', async () => {
    const name = db.name;
    await saveRecord(makeRecord(), db);
    db.close();
    const reopened = new SkyBoothDB(name);
    expect(await reopened.sessions.count()).toBe(1);
    db = reopened;
  });

  it('deletes records permanently', async () => {
    const r = makeRecord();
    await saveRecord(r, db);
    await db.sessions.delete(r.id);
    expect(await db.sessions.get(r.id)).toBeUndefined();
  });

  it('migrates v1 data to v2 (backfills fields)', async () => {
    const name = `migrate-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    const legacy = makeRecord() as Partial<CustomerRecord>;
    delete legacy.updatedAt;
    delete legacy.downloadStatus;
    delete legacy.outputSettings;
    await v1.table('sessions').put(legacy);
    v1.close();
    const v2 = new SkyBoothDB(name);
    const got = (await v2.sessions.get(legacy.id!))!;
    expect(v2.verno).toBe(2);
    expect(got.updatedAt).toBe(got.createdAt);
    expect(got.downloadStatus).toBe('downloaded');
    expect(got.outputSettings.format).toBe('jpg');
    await v2.delete();
  });

  it('maps quota errors to a friendly StorageQuotaError', async () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ inner: { name: 'QuotaExceededError' } })).toBe(true);
    const failing = { sessions: { put: async () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); } } } as unknown as SkyBoothDB;
    await expect(saveRecord(makeRecord(), failing)).rejects.toBeInstanceOf(StorageQuotaError);
  });
});

describe('backup & restore', () => {
  let db: SkyBoothDB;
  beforeEach(() => {
    db = new SkyBoothDB(`backup-${Math.random()}`);
  });
  afterEach(async () => {
    await db.delete();
  });

  it('round-trips records including the actual images', async () => {
    const a = makeRecord();
    const b = makeRecord();
    await saveRecord(a, db);
    await saveRecord(b, db);
    const zip = await exportFullBackup(db);
    expect(zip.type).toBe('application/zip');

    await db.sessions.clear();
    const res = await importBackup(zip, {}, db);
    expect(res).toMatchObject({ imported: 2, skipped: 0 });
    const restored = (await db.sessions.get(a.id))!;
    expect(await blobBytes(restored.originalPhotoBlob)).toEqual(await blobBytes(a.originalPhotoBlob));
    expect(await blobBytes(restored.generatedPosterBlob)).toEqual(await blobBytes(a.generatedPosterBlob));
    expect(restored.branchAddressSnapshot).toBe(a.branchAddressSnapshot);
  });

  it('skips existing records unless overwrite is requested', async () => {
    await saveRecord(makeRecord(), db);
    const zip = await exportFullBackup(db);
    expect((await importBackup(zip, {}, db)).skipped).toBe(1);
    expect((await importBackup(zip, { overwrite: true }, db)).imported).toBe(1);
  });

  it('rejects files that are not backups', async () => {
    await expect(importBackup(new Blob(['hello']), {}, db)).rejects.toThrow(/not a valid backup/);
  });

  it('exports metadata JSON without image data', async () => {
    await saveRecord(makeRecord(), db);
    const json = JSON.parse(await (await exportMetadataJson(db)).text());
    expect(json.records).toHaveLength(1);
    expect(json.records[0].generatedPosterBlob).toBeUndefined();
    expect(json.records[0].fileName).toMatch(/^SKY_HAPPY_CUSTOMER_/);
  });
});
