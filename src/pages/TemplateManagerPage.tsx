import { CheckCircle2, Download, FileWarning, ImageUp, RotateCcw, Save, ShieldAlert, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, PageHeader, Segmented, Select, Skeleton, Slider, Toggle, cx, toast } from '@/components/common/ui';
import { PlacementEditor } from '@/components/templates/PlacementEditor';
import { db } from '@/db/database';
import { useDecodedPhoto, useTemplateAsset } from '@/hooks/useAssets';
import { useTemplates } from '@/hooks/useTemplates';
import { triggerBrowserDownload } from '@/services/downloadService';
import { BASE_TEMPLATES, buildPlacementExport, isTemplateReady, parsePlacementImport } from '@/services/templateResolver';
import { useSession } from '@/store/sessionStore';
import type { PhotoPlacement, RegionShape } from '@/types';

type Filter = 'all' | 'ready' | 'attention';

/** A neutral sample "person" so placement can be previewed without a real customer photo. */
function makeSamplePhoto(): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 1200;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 1200);
  bg.addColorStop(0, '#9fb7d9');
  bg.addColorStop(1, '#53709c');
  g.fillStyle = bg;
  g.fillRect(0, 0, 900, 1200);
  g.fillStyle = '#e8c4a6';
  g.beginPath();
  g.ellipse(450, 470, 170, 210, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b3a55';
  g.beginPath();
  g.ellipse(450, 1180, 380, 420, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = 'bold 44px sans-serif';
  g.textAlign = 'center';
  g.fillText('SAMPLE PHOTO', 450, 120);
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
}

export default function TemplateManagerPage() {
  const { templates, branches, loading } = useTemplates();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PhotoPlacement | null>(null);
  const [draftBranch, setDraftBranch] = useState<string>('');
  const [draftVerified, setDraftVerified] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);
  const [sampleBlob, setSampleBlob] = useState<Blob | null>(null);
  const sessionPhoto = useSession((s) => s.photo?.blob);
  const importRef = useRef<HTMLInputElement>(null);
  const testRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionPhoto) makeSamplePhoto().then(setSampleBlob);
  }, [sessionPhoto]);
  const { img: samplePhoto } = useDecodedPhoto(sessionPhoto ?? sampleBlob);

  const list = useMemo(
    () => templates.filter((t) => (filter === 'ready' ? isTemplateReady(t, branches) : filter === 'attention' ? !isTemplateReady(t, branches) : true)),
    [templates, branches, filter],
  );
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const selectedBranch = branches.find((b) => b.id === (draftBranch || selected?.branchId));
  const { asset } = useTemplateAsset(selected?.imagePath);

  useEffect(() => {
    if (!selected) return;
    setDraft({ ...selected.photoPlacement });
    setDraftBranch(selected.branchId);
    setDraftVerified(selected.verified);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }, [list, selectedId]);

  const save = async () => {
    if (!selected || !draft) return;
    await db.templateOverrides.put({ templateId: selected.id, branchId: draftBranch, photoPlacement: draft, verified: draftVerified, updatedAt: Date.now() });
    toast.success('Template saved', draftVerified ? 'Available in the branch selector.' : 'Marked as not verified – hidden from production.');
  };
  const resetToDefault = async () => {
    if (!selected) return;
    await db.templateOverrides.delete(selected.id);
    const base = BASE_TEMPLATES.find((t) => t.id === selected.id)!;
    setDraft({ ...base.photoPlacement });
    setDraftBranch(base.branchId);
    setDraftVerified(base.verified);
    toast.info('Reset to the audited manifest values');
  };
  const setBranchVerified = async (branchId: string, verified: boolean) => {
    await db.branchOverrides.put({ branchId, verificationStatus: verified ? 'verified' : 'needs-review', updatedAt: Date.now() });
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(buildPlacementExport(templates), null, 2)], { type: 'application/json' });
    triggerBrowserDownload(blob, `SKY_TEMPLATE_PLACEMENTS_${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const { overrides, errors } = parsePlacementImport(JSON.parse(await f.text()), new Set(templates.map((t) => t.id)), new Set(branches.map((b) => b.id)));
      await db.templateOverrides.bulkPut(overrides);
      toast.success(`Imported ${overrides.length} placements`, errors.length ? `${errors.length} skipped: ${errors[0]}` : undefined);
      setSelectedId(null);
    } catch (e) {
      toast.error('Import failed', e instanceof Error ? e.message : undefined);
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const num = (k: keyof PhotoPlacement, v: number) => draft && setDraft({ ...draft, [k]: v });

  return (
    <div>
      <PageHeader
        title="Branch templates"
        subtitle="Verify branch addresses, assign templates and adjust the photo window. Only verified templates appear in the branch selector."
        actions={
          <>
            <Button size="sm" icon={<Download className="size-4" />} onClick={exportJson}>Export JSON</Button>
            <Button size="sm" icon={<Upload className="size-4" />} onClick={() => importRef.current?.click()}>Import JSON</Button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="p-3">
          <div className="mb-3 px-1"><Segmented size="sm" label="Filter templates" value={filter} onChange={(v: Filter) => setFilter(v)} options={[{ value: 'all', label: `All (${templates.length})` }, { value: 'ready', label: 'Ready' }, { value: 'attention', label: 'Attention' }]} /></div>
          {loading ? <Skeleton className="h-96" /> : (
            <ul className="max-h-[72dvh] space-y-1 overflow-auto pr-1">
              {list.map((t) => {
                const ready = isTemplateReady(t, branches);
                const b = branches.find((x) => x.id === t.branchId);
                return (
                  <li key={t.id}>
                    <button onClick={() => setSelectedId(t.id)} className={cx('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors', selectedId === t.id ? 'bg-electric-500/15 ring-1 ring-electric-400/50' : 'hover:bg-white/6')}>
                      <img src={t.thumbnailPath} alt="" loading="lazy" className="h-16 w-9 rounded-md object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{b?.branchName ?? 'Unverified Location'}</p>
                        <p className="text-xs text-slate-500">{t.sourceFile} · {t.width}×{t.height}</p>
                      </div>
                      {t.status === 'duplicate' ? <Badge tone="amber">Duplicate</Badge> : ready ? <CheckCircle2 className="size-4 text-emerald-400" aria-label="Ready" /> : <ShieldAlert className="size-4 text-amber-300" aria-label="Needs attention" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {!selected || !draft ? (
          <Card><EmptyState icon={<FileWarning className="size-7" />} title="Select a template" /></Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{selected.name}</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" icon={<ImageUp className="size-4" />} onClick={() => testRef.current?.click()}>Test photo</Button>
                  <input ref={testRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setSampleBlob(e.target.files[0])} />
                  <Segmented size="sm" label="Preview" value={showPhoto ? 'p' : 't'} onChange={(v) => setShowPhoto(v === 'p')} options={[{ value: 'p', label: 'With photo' }, { value: 't', label: 'Template' }]} />
                </div>
              </div>
              {asset ? <PlacementEditor template={asset.preview} templateSize={{ width: selected.width, height: selected.height }} placement={draft} onChange={setDraft} samplePhoto={samplePhoto} showPhoto={showPhoto} /> : <Skeleton className="mx-auto aspect-[9/16] max-h-[70dvh]" />}
              <p className="text-center text-xs text-slate-500">Drag the blue box to move, drag handles to resize. The dashed outline is the clipping shape.</p>
            </Card>

            <div className="space-y-4">
              <Card className="space-y-3 p-5">
                <p className="text-sm font-bold text-white">Branch assignment</p>
                <Select value={draftBranch} onChange={setDraftBranch}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branchName}</option>)}
                </Select>
                {selectedBranch && (
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xs text-slate-500">Printed on poster ({selected.sourceFile}):</p>
                    {selectedBranch.displayAddressLines.map((l, i) => <p key={i} className="font-tamil text-sm text-slate-200">{l}</p>)}
                    <p className="text-xs text-slate-400">{selectedBranch.phone}</p>
                    {selectedBranch.notes && <p className="mt-2 text-xs text-amber-200">⚠ {selectedBranch.notes}</p>}
                    <Toggle label="Branch address verified" description="Unverified branches are hidden from the selector." checked={selectedBranch.verificationStatus === 'verified'} onChange={(v) => setBranchVerified(selectedBranch.id, v)} />
                  </div>
                )}
                <Toggle label="Template verified for production" description={selected.status === 'duplicate' ? `Duplicate export of ${selected.duplicateOf}` : 'Required before customers can use it.'} checked={draftVerified} onChange={setDraftVerified} />
              </Card>

              <Card className="space-y-4 p-5">
                <p className="text-sm font-bold text-white">Photo region</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['x', 'y', 'width', 'height'] as const).map((k) => (
                    <label key={k} className="text-xs text-slate-400">{k}
                      <input type="number" step={0.001} min={0} max={1.2} value={draft[k]} onChange={(e) => num(k, Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg bg-navy-800 px-2 text-sm text-white ring-1 ring-white/10" />
                    </label>
                  ))}
                </div>
                <Slider label="Rotation" min={-30} max={30} step={0.5} value={draft.rotation} onChange={(v) => num('rotation', v)} format={(v) => `${v}°`} />
                <Select label="Shape" value={draft.shape} onChange={(v) => setDraft({ ...draft, shape: v as RegionShape })}>
                  <option value="path">Arch (template outline)</option>
                  <option value="rect">Rectangle</option>
                  <option value="rounded">Rounded rectangle</option>
                  <option value="ellipse">Ellipse</option>
                </Select>
                {draft.shape === 'rounded' && <Slider label="Corner radius" min={0} max={0.5} step={0.01} value={draft.cornerRadius} onChange={(v) => num('cornerRadius', v)} format={(v) => v.toFixed(2)} />}
                <Slider label="Bottom fade" min={0} max={0.4} step={0.01} value={draft.featherBottom ?? 0} onChange={(v) => num('featherBottom', v)} format={(v) => `${Math.round(v * 100)}%`} />
                <Select label="Crop mode" value={draft.cropMode} onChange={(v) => setDraft({ ...draft, cropMode: v as 'cover' | 'contain' })}>
                  <option value="cover">Cover (fill window)</option>
                  <option value="contain">Contain (show whole photo)</option>
                </Select>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={resetToDefault}>Reset</Button>
                <Button variant="primary" icon={<Save className="size-4" />} onClick={save}>Save</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
