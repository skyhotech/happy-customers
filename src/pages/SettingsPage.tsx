import { Archive, CloudDownload, Database, FileJson, FolderOpen, HardDrive, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, PageHeader, Segmented, Select, Slider, Toggle, toast } from '@/components/common/ui';
import { db } from '@/db/database';
import { useStorageInfo } from '@/hooks/useHistory';
import { useTemplates } from '@/hooks/useTemplates';
import { backupFileName, exportFullBackup, exportMetadataJson, importBackup, requestPersistentStorage } from '@/services/backupService';
import { listCameras, RESOLUTIONS, type ResolutionPreset } from '@/services/cameraService';
import { clearDownloadFolder, getDownloadFolderName, isFolderPickerSupported, pickDownloadFolder, triggerBrowserDownload } from '@/services/downloadService';
import { useSettings, type MotionPreference } from '@/store/settingsStore';
import type { OutputRatio, RatioFit } from '@/types';
import { formatBytes } from '@/utils/dateUtils';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-electric-200">{icon}{title}</h2>
      {children}
    </Card>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <span className="text-sm font-semibold text-white">{label}</span>
    {children}
  </div>
);

export default function SettingsPage() {
  const s = useSettings();
  const [refresh, setRefresh] = useState(0);
  const storage = useStorageInfo(refresh);
  const { readyTemplates, branches, selectable } = useTemplates();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [offline, setOffline] = useState<{ done: number; total: number } | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listCameras().then(setCameras).catch(() => undefined);
    getDownloadFolderName().then(setFolder).catch(() => undefined);
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error('Something went wrong', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
      setRefresh((r) => r + 1);
    }
  };

  const prepareOffline = () =>
    run('offline', async () => {
      const urls = readyTemplates.map((t) => t.imagePath);
      setOffline({ done: 0, total: urls.length });
      const cache = 'caches' in window ? await caches.open('sky-templates-v1') : null;
      let done = 0;
      for (const u of urls) {
        if (cache && !(await cache.match(u))) await cache.add(u);
        else if (!cache) await fetch(u);
        setOffline({ done: ++done, total: urls.length });
      }
      toast.success('Templates cached for offline use', `${urls.length} posters`);
    });

  const usedPct = storage?.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences are saved in this browser. Customer images are stored in IndexedDB, never in localStorage." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Camera" icon={<CloudDownload className="size-4" />}>
          <Select label="Default camera" value={s.defaultCameraId ?? ''} onChange={(v) => s.set({ defaultCameraId: v || null })}>
            <option value="">Automatic (front / user-facing)</option>
            {cameras.map((c, i) => <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1} (grant permission to see names)`}</option>)}
          </Select>
          <Select label="Preferred resolution" value={s.resolution} onChange={(v) => s.set({ resolution: v as ResolutionPreset })}>
            {Object.entries(RESOLUTIONS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </Select>
          <Toggle label="Mirror selfie preview" description="Captured photo matches the mirrored preview (applied once)." checked={s.mirror} onChange={(v) => s.set({ mirror: v })} />
          <Row label="Countdown"><Segmented size="sm" value={s.countdown} onChange={(v) => s.set({ countdown: v })} options={[0, 3, 5, 10].map((v) => ({ value: v as 0 | 3 | 5 | 10, label: v ? `${v}s` : 'Off' }))} /></Row>
        </Section>

        <Section title="Poster output" icon={<FileJson className="size-4" />}>
          <Row label="Default format"><Segmented size="sm" value={s.outputFormat} onChange={(v) => s.set({ outputFormat: v })} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} /></Row>
          <Slider label="JPG quality" min={0.7} max={1} step={0.01} value={s.jpgQuality} onChange={(v) => s.set({ jpgQuality: v })} format={(v) => v.toFixed(2)} />
          <Row label="Aspect ratio"><Segmented size="sm" value={s.outputRatio} onChange={(v: OutputRatio) => s.set({ outputRatio: v })} options={[{ value: 'original', label: 'Original' }, { value: '4:5', label: '4:5' }, { value: '9:16', label: '9:16' }]} /></Row>
          <Row label="Ratio fit"><Segmented size="sm" value={s.ratioFit} onChange={(v: RatioFit) => s.set({ ratioFit: v })} options={[{ value: 'pad', label: 'Pad' }, { value: 'crop', label: 'Crop' }]} /></Row>
          <Select label="Default branch" value={s.defaultBranchId ?? ''} onChange={(v) => s.set({ defaultBranchId: v || null })}>
            <option value="">None</option>
            {selectable.map((b) => <option key={b.id} value={b.id}>{b.branchName}</option>)}
          </Select>
          <Toggle label="Auto download after generating" checked={s.autoDownload} onChange={(v) => s.set({ autoDownload: v })} />
          {isFolderPickerSupported() ? (
            <div className="space-y-2 rounded-xl bg-white/5 p-3">
              <Toggle label="Save into a chosen folder" description={folder ? `Folder: ${folder}` : 'Chrome/Edge only. Falls back to normal downloads.'} checked={s.preferFolder && !!folder} onChange={(v) => s.set({ preferFolder: v })} disabled={!folder} />
              <div className="flex gap-2">
                <Button size="sm" icon={<FolderOpen className="size-4" />} onClick={() => run('folder', async () => { const n = await pickDownloadFolder(); if (n) { setFolder(n); s.set({ preferFolder: true }); toast.success('Folder selected', n); } })}>Choose folder</Button>
                {folder && <Button size="sm" variant="ghost" onClick={() => run('folder', async () => { await clearDownloadFolder(); setFolder(null); s.set({ preferFolder: false }); })}>Forget folder</Button>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">This browser saves posters to its standard Downloads location.</p>
          )}
        </Section>

        <Section title="Storage" icon={<HardDrive className="size-4" />}>
          {storage?.supported ? (
            <>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-400"><span>{formatBytes(storage.usage)} used</span><span>{formatBytes(storage.quota)} available to this site</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${usedPct > 80 ? 'bg-amber-400' : 'bg-electric-500'}`} style={{ width: `${Math.max(1, usedPct)}%` }} /></div>
              </div>
              <Row label="Persistent storage">
                {storage.persisted ? <Badge tone="green">Granted</Badge> : <Button size="sm" onClick={() => run('persist', async () => { const ok = await requestPersistentStorage(); ok ? toast.success('Persistent storage granted') : toast.warning('Browser declined persistent storage', 'Install the app or bookmark it to improve the chance.'); })}>Request</Button>}
              </Row>
            </>
          ) : <p className="text-sm text-slate-400">Storage estimates are not available in this browser.</p>}
          <Toggle label="Store original photos" description="Needed to re-edit posters later. Turning off saves space." checked={s.saveOriginalPhoto} onChange={(v) => s.set({ saveOriginalPhoto: v })} />
          <div className="space-y-2">
            <Button className="w-full" icon={<CloudDownload className="size-4" />} loading={busy === 'offline'} onClick={prepareOffline}>Prepare {readyTemplates.length} templates for offline use</Button>
            {offline && <p className="text-center text-xs text-slate-500">{offline.done}/{offline.total} cached</p>}
          </div>
          <p className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-slate-400">
            History lives in this browser profile on this device only. It survives refreshes and restarts, but clearing site data, private browsing, or the browser's storage cleanup can delete it. Export a backup regularly.
          </p>
        </Section>

        <Section title="Backup & restore" icon={<Archive className="size-4" />}>
          <Button className="w-full" variant="primary" icon={<Archive className="size-4" />} loading={busy === 'backup'} onClick={() => run('backup', async () => { const b = await exportFullBackup(); triggerBrowserDownload(b, backupFileName()); toast.success('Backup downloaded', formatBytes(b.size)); })}>Export full backup (with images)</Button>
          <Button className="w-full" icon={<FileJson className="size-4" />} loading={busy === 'meta'} onClick={() => run('meta', async () => { const b = await exportMetadataJson(); triggerBrowserDownload(b, backupFileName('SKY_HISTORY_METADATA', 'json')); })}>Export history metadata (JSON)</Button>
          <Button className="w-full" icon={<Upload className="size-4" />} loading={busy === 'restore'} onClick={() => restoreRef.current?.click()}>Import / restore backup</Button>
          <input ref={restoreRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) run('restore', async () => { const r = await importBackup(f); toast.success(`Restored ${r.imported} records`, r.skipped ? `${r.skipped} already existed` : r.errors[0]); });
            e.target.value = '';
          }} />
        </Section>

        <Section title="Interface & privacy" icon={<ShieldCheck className="size-4" />}>
          <Row label="Animations"><Segmented size="sm" value={s.motion} onChange={(v: MotionPreference) => s.set({ motion: v })} options={[{ value: 'system', label: 'System' }, { value: 'reduced', label: 'Reduced' }, { value: 'full', label: 'Full' }]} /></Row>
          <p className="text-xs leading-relaxed text-slate-400">Photos are processed entirely on this device. Nothing is uploaded, and no analytics or third-party services receive customer images. The verified templates cover {branches.length} audited branches.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => { s.reset(); toast.info('Settings reset'); }}>Reset settings</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setClearOpen(true)}>Clear all history</Button>
          </div>
        </Section>

        <Section title="Database" icon={<Database className="size-4" />}>
          <p className="text-xs text-slate-400">IndexedDB “sky-happy-customers”, schema v{db.verno}. Admin template changes are stored separately and are not affected by clearing history.</p>
        </Section>
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="Clear ALL customer history?"
        message="Every stored customer photo and poster on this device will be permanently deleted. Export a backup first if you might need them."
        confirmLabel="Delete everything"
        requireText="DELETE"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => run('clear', async () => { await db.sessions.clear(); setClearOpen(false); toast.success('History cleared'); })}
      />
    </div>
  );
}
