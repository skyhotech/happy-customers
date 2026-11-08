import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { db, StorageQuotaError, isQuotaError, type SkyBoothDB } from '@/db/database';
import type { CustomerRecord, CustomerRecordMeta } from '@/types';

export const BACKUP_KIND = 'sky-happy-customers-backup';
export const BACKUP_VERSION = 1;

type BlobField = 'originalPhotoBlob' | 'generatedPosterBlob' | 'thumbnailBlob';
const BLOB_FIELDS: BlobField[] = ['originalPhotoBlob', 'generatedPosterBlob', 'thumbnailBlob'];

interface ManifestEntry extends CustomerRecordMeta {
  files: Partial<Record<BlobField, { path: string; type: string }>>;
}

export interface BackupManifest {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  count: number;
  records: ManifestEntry[];
}

function stripBlobs(r: CustomerRecord): CustomerRecordMeta {
  const { originalPhotoBlob: _a, generatedPosterBlob: _b, thumbnailBlob: _c, ...meta } = r;
  return meta;
}

const extFor = (type: string) => (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg');

/** Metadata-only JSON export (no images). */
export async function exportMetadataJson(database: SkyBoothDB = db): Promise<Blob> {
  const records = await database.sessions.orderBy('createdAt').toArray();
  const payload = { kind: 'sky-happy-customers-metadata', version: 1, exportedAt: new Date().toISOString(), records: records.map(stripBlobs) };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

/** Image-inclusive backup: a ZIP with manifest.json + every original photo, poster and thumbnail. */
export async function exportFullBackup(database: SkyBoothDB = db, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const records = await database.sessions.orderBy('createdAt').toArray();
  const files: Zippable = {};
  const entries: ManifestEntry[] = [];
  let done = 0;
  for (const r of records) {
    const entry: ManifestEntry = { ...stripBlobs(r), files: {} };
    for (const f of BLOB_FIELDS) {
      const blob = r[f];
      if (!blob) continue;
      const path = `${f.replace('Blob', '')}/${r.id}.${extFor(blob.type)}`;
      files[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
      entry.files[f] = { path, type: blob.type || 'image/jpeg' };
    }
    entries.push(entry);
    onProgress?.(++done, records.length);
  }
  const manifest: BackupManifest = { kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), count: entries.length, records: entries };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  const zipped = zipSync(files);
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export interface RestoreResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/** Restores a backup ZIP. Existing records with the same id are skipped unless `overwrite`. */
export async function importBackup(file: Blob, opts: { overwrite?: boolean } = {}, database: SkyBoothDB = db): Promise<RestoreResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('This file is not a valid backup ZIP.');
  }
  const raw = entries['manifest.json'];
  if (!raw) throw new Error('Backup is missing manifest.json.');
  const manifest = JSON.parse(strFromU8(raw)) as BackupManifest;
  if (manifest.kind !== BACKUP_KIND) throw new Error('Unrecognized backup format.');
  if (manifest.version > BACKUP_VERSION) throw new Error('This backup was made by a newer app version.');

  const result: RestoreResult = { imported: 0, skipped: 0, errors: [] };
  const toPut: CustomerRecord[] = [];
  for (const m of manifest.records) {
    if (!m.id || !m.createdAt) { result.errors.push('Record without id skipped.'); continue; }
    if (!opts.overwrite && (await database.sessions.get(m.id))) { result.skipped++; continue; }
    const { files, ...meta } = m;
    const blobs: Partial<Record<BlobField, Blob>> = {};
    let missing = false;
    for (const f of BLOB_FIELDS) {
      const ref = files[f];
      const bytes = ref ? entries[ref.path] : undefined;
      if (!bytes) { if (f !== 'thumbnailBlob') missing = true; continue; }
      blobs[f] = new Blob([bytes as BlobPart], { type: ref!.type });
    }
    if (missing) { result.errors.push(`Images missing for record ${m.id}; skipped.`); continue; }
    toPut.push({ ...(meta as CustomerRecordMeta), ...(blobs as Record<BlobField, Blob>), thumbnailBlob: blobs.thumbnailBlob ?? blobs.generatedPosterBlob! });
  }
  try {
    await database.sessions.bulkPut(toPut);
  } catch (e) {
    if (isQuotaError(e)) throw new StorageQuotaError();
    throw e;
  }
  result.imported = toPut.length;
  return result;
}

export function backupFileName(prefix = 'SKY_HAPPY_CUSTOMERS_BACKUP', ext = 'zip') {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
  supported: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return { usage: 0, quota: 0, persisted: false, supported: false };
  const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(false)]);
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted, supported: true };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
