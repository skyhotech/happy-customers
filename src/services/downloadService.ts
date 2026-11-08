import { kvGet, kvSet } from '@/db/database';

export type DeliveryResult =
  | { status: 'downloaded'; fileName: string }
  | { status: 'saved-to-folder'; fileName: string; folderName: string }
  | { status: 'failed'; fileName: string; error: string };

const FOLDER_KEY = 'downloadFolderHandle';

type PermissionMode = { mode: 'readwrite' };
interface DirHandle {
  name: string;
  kind: 'directory';
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
  queryPermission?(o: PermissionMode): Promise<PermissionState>;
  requestPermission?(o: PermissionMode): Promise<PermissionState>;
}

export const isFolderPickerSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickDownloadFolder(): Promise<string | null> {
  if (!isFolderPickerSupported()) return null;
  const handle = (await (window as unknown as { showDirectoryPicker(o?: object): Promise<DirHandle> }).showDirectoryPicker({ mode: 'readwrite', id: 'sky-posters' })) as DirHandle;
  await kvSet(FOLDER_KEY, handle);
  return handle.name;
}

export async function getDownloadFolderName(): Promise<string | null> {
  const h = await kvGet<DirHandle>(FOLDER_KEY);
  return h?.name ?? null;
}

export async function clearDownloadFolder() {
  await kvSet(FOLDER_KEY, null);
}

async function fileExists(dir: DirHandle, name: string) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Never overwrite: appends -2, -3 … when a file with the same name already exists. */
async function uniqueName(dir: DirHandle, name: string) {
  if (!(await fileExists(dir, name))) return name;
  const dot = name.lastIndexOf('.');
  const base = name.slice(0, dot);
  const ext = name.slice(dot);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!(await fileExists(dir, candidate))) return candidate;
  }
  throw new Error('Could not find a free file name.');
}

async function saveToFolder(blob: Blob, fileName: string): Promise<DeliveryResult | null> {
  const dir = await kvGet<DirHandle>(FOLDER_KEY);
  if (!dir) return null;
  let perm = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  if (perm === 'prompt') perm = (await dir.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
  if (perm !== 'granted') return null;
  const name = await uniqueName(dir, fileName);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return { status: 'saved-to-folder', fileName: name, folderName: dir.name };
}

/**
 * Standard browser download via a temporary anchor. Must be called from (or shortly after) a user gesture.
 * Returns 'downloaded' only when the download was successfully triggered; browsers do not report completion.
 */
export function triggerBrowserDownload(blob: Blob, fileName: string): Extract<DeliveryResult, { status: 'downloaded' | 'failed' }> {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    const u = url;
    setTimeout(() => URL.revokeObjectURL(u), 60_000);
    return { status: 'downloaded', fileName };
  } catch (e) {
    if (url) URL.revokeObjectURL(url);
    return { status: 'failed', fileName, error: e instanceof Error ? e.message : 'Download was blocked by the browser.' };
  }
}

/** Saves to the chosen folder when configured and permitted; otherwise a standard download. */
export async function deliverPoster(blob: Blob, fileName: string, opts: { preferFolder: boolean }): Promise<DeliveryResult> {
  if (opts.preferFolder && isFolderPickerSupported()) {
    try {
      const r = await saveToFolder(blob, fileName);
      if (r) return r;
    } catch {
      /* fall back to a standard download */
    }
  }
  return triggerBrowserDownload(blob, fileName);
}
