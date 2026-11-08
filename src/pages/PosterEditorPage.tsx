import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowLeftRight, Camera, Download, Eye, EyeOff, History, MapPin, Plus, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Celebration } from '@/components/common/Celebration';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Segmented, Skeleton, Slider, cx, toast } from '@/components/common/ui';
import { AdjustControls } from '@/components/editor/AdjustControls';
import { PhotoAdjustCanvas } from '@/components/editor/PhotoAdjustCanvas';
import { useDecodedPhoto, useTemplateAsset } from '@/hooks/useAssets';
import { STAGE_LABEL, usePosterGenerator, type GenerationStage } from '@/hooks/usePosterGenerator';
import { useTemplates } from '@/hooks/useTemplates';
import { triggerBrowserDownload } from '@/services/downloadService';
import { applyOutputRatio, renderFinalPoster } from '@/services/posterRenderer';
import { isTemplateReady } from '@/services/templateResolver';
import { useSession } from '@/store/sessionStore';
import { useSettings } from '@/store/settingsStore';
import type { DecodedImage } from '@/services/imageProcessor';
import type { CompositingMode, OutputFormat, OutputRatio, OutputSettings, PhotoAdjust, PhotoPlacement, RatioFit } from '@/types';
import { releaseCanvas } from '@/utils/canvasUtils';

const STAGES: GenerationStage[] = ['validating', 'rendering', 'encoding', 'saving', 'downloading'];

function RatioPreview({ template, photo, placement, adjust, output, mode }: { template: DecodedImage; photo: DecodedImage; placement: PhotoPlacement; adjust: PhotoAdjust; output: OutputSettings; mode: CompositingMode }) {
  const ref = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const poster = renderFinalPoster({ layers: { template }, photo, placement, adjust, mode, targetWidth: 520 });
    const out = applyOutputRatio(poster, output);
    out.toBlob((b) => b && setUrl(URL.createObjectURL(b)), 'image/jpeg', 0.85);
    if (out !== poster) releaseCanvas(out);
    releaseCanvas(poster);
  }, [template, photo, placement, adjust, output, mode]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url ? <img ref={ref} src={url} alt="Export ratio preview" className="mx-auto max-h-[60dvh] rounded-xl ring-1 ring-white/10" /> : <Skeleton className="h-96 w-full" />;
}

export default function PosterEditorPage() {
  const navigate = useNavigate();
  const session = useSession();
  const settings = useSettings();
  const { branches, templates } = useTemplates();
  const template = templates.find((t) => t.id === session.templateId);
  const branch = branches.find((b) => b.id === session.branchId);
  const { asset, error: templateError, loading: templateLoading } = useTemplateAsset(template?.imagePath);
  const { img: photoImg } = useDecodedPhoto(session.photo?.blob);
  const [showPhoto, setShowPhoto] = useState(true);
  const [ratioModal, setRatioModal] = useState(false);
  const [output, setOutput] = useState<OutputSettings>({ format: settings.outputFormat, quality: settings.jpgQuality, ratio: settings.outputRatio, ratioFit: settings.ratioFit });
  const gen = usePosterGenerator();
  const result = session.result;
  const placement = template?.photoPlacement;
  const ready = template && branch ? isTemplateReady(template, branches) : false;
  const busy = STAGES.includes(gen.stage);

  // Changing photo/branch invalidates the finished result.
  useEffect(() => {
    if (gen.stage === 'done' && !result) gen.reset();
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustKey = useMemo(() => JSON.stringify(session.adjust), [session.adjust]);
  useEffect(() => {
    if (result && session.dirty) session.setResult(null);
  }, [adjustKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session.photo) {
    return <Card><EmptyState icon={<Camera className="size-7" />} title="No customer photo" description="Capture a photo to start a poster." action={<Button variant="primary" onClick={() => navigate('/camera')}>Open camera</Button>} /></Card>;
  }
  if (!template || !branch) {
    return <Card><EmptyState icon={<MapPin className="size-7" />} title="Select a branch" description="Choose the customer's SKY branch to load its poster template." action={<Button variant="primary" onClick={() => navigate('/branches')}>Select branch</Button>} /></Card>;
  }

  const doGenerate = async (ratioApproved = false) => {
    if (!asset || !photoImg || !placement) return toast.error('Still loading', 'Wait for the template and photo to finish loading.');
    // Fixed export ratios require a visual confirmation of the crop/pad result first.
    if (output.ratio !== 'original' && !ratioApproved) return setRatioModal(true);
    const r = await gen.generate({
      template, templateImage: asset.full, branch, photo: photoImg, photoBlob: session.photo!.blob,
      photoSize: { width: session.photo!.width, height: session.photo!.height }, placement, adjust: session.adjust, output,
    });
    if (!r) return;
    if (r.deliveryStatus === 'downloaded') toast.success('Poster saved & download started');
    else if (r.deliveryStatus === 'saved-to-folder') toast.success('Poster saved to your folder');
    else if (r.deliveryStatus === 'failed') toast.warning('Saved to history – download was blocked', 'Use the Download button below.');
    else toast.success('Poster saved to history');
  };

  const manualDownload = () => {
    if (!result) return;
    const r = triggerBrowserDownload(result.posterBlob, result.fileName);
    if (r.status === 'downloaded') toast.success('Download started', result.fileName);
    else toast.error('Download blocked', r.error);
  };

  const newSession = () => {
    session.reset();
    navigate('/camera');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 4"
        title="Poster generator"
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-200">{branch.branchName}</span><span className="font-tamil text-xs">{branch.displayAddress}</span></span>}
        actions={<Button size="sm" icon={<ArrowLeftRight className="size-4" />} onClick={() => navigate('/branches')}>Change branch</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="relative grid min-h-[60dvh] place-items-center overflow-hidden p-3 sm:p-6">
          {templateError ? (
            <EmptyState icon={<AlertTriangle className="size-7" />} title="Template failed to load" description={templateError} />
          ) : templateLoading || !asset || !photoImg || !placement ? (
            <div className="flex h-[72dvh] w-full max-w-sm flex-col gap-3"><Skeleton className="flex-1" /><p className="text-center text-xs text-slate-500">Loading full-resolution template…</p></div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="h-[72dvh] w-full">
              <PhotoAdjustCanvas
                mode="poster"
                template={asset.preview}
                templateSize={{ width: template.width, height: template.height }}
                photo={photoImg}
                placement={placement}
                adjust={session.adjust}
                onAdjust={session.setAdjust}
                compositingMode={template.mode}
                showPhoto={showPhoto}
                className="h-full"
                ariaLabel="Poster preview. Drag inside the photo window to reposition the customer."
              />
            </motion.div>
          )}

          <AnimatePresence>
            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-navy-950/80 backdrop-blur-sm">
                <div className="w-72 space-y-4 text-center">
                  <Sparkles className="mx-auto size-8 animate-pulse text-electric-300" />
                  <p className="font-semibold text-white">{STAGE_LABEL[gen.stage]}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-electric-500 to-violet-500" animate={{ width: `${((STAGES.indexOf(gen.stage) + 1) / STAGES.length) * 100}%` }} transition={{ duration: 0.3 }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <aside className="space-y-4">
          {result && gen.stage === 'done' ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="space-y-4 p-5 text-center">
                <Celebration />
                <div>
                  <p className="text-lg font-bold text-white">Poster ready!</p>
                  <p className="mt-1 break-all text-xs text-slate-400">{result.fileName}</p>
                </div>
                {result.deliveryStatus === 'downloaded' && <Badge tone="green">Download started</Badge>}
                {result.deliveryStatus === 'saved-to-folder' && <Badge tone="green">{result.deliveryMessage}</Badge>}
                {result.deliveryStatus === 'failed' && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">The browser blocked the automatic download{result.deliveryMessage ? ` (${result.deliveryMessage})` : ''}. Tap the button below to download manually.</p>}
                {result.deliveryStatus === 'not-requested' && <Badge>Auto download is off</Badge>}
                <img src={result.posterUrl} alt="Finished customer poster" className="mx-auto max-h-56 rounded-xl ring-1 ring-white/10" />
                <div className="grid gap-2">
                  <a href={result.posterUrl} download={result.fileName} onClick={(e) => { e.preventDefault(); manualDownload(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15">
                    <Download className="size-4" /> {result.deliveryStatus === 'downloaded' ? 'Download again' : 'Download poster'}
                  </a>
                  <Button variant="primary" icon={<Plus className="size-4" />} onClick={newSession}>New photo session</Button>
                  <Link to={`/history/${result.recordId}`} className="inline-flex h-10 items-center justify-center gap-2 text-sm font-semibold text-electric-300 hover:text-electric-200"><History className="size-4" /> View in history</Link>
                </div>
              </Card>
            </motion.div>
          ) : (
            <>
              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Customer photo</p>
                  <Segmented size="sm" label="Preview" value={showPhoto ? 'poster' : 'template'} onChange={(v) => setShowPhoto(v === 'poster')} options={[{ value: 'poster', label: <span className="flex items-center gap-1"><Eye className="size-3.5" />Finished</span> }, { value: 'template', label: <span className="flex items-center gap-1"><EyeOff className="size-3.5" />Original</span> }]} />
                </div>
                <AdjustControls adjust={session.adjust} onChange={session.setAdjust} onReset={session.resetAdjust} compact />
              </Card>
              <Card className="space-y-4 p-5">
                <p className="text-sm font-bold text-white">Output</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">Format</span>
                  <Segmented size="sm" label="Format" value={output.format} onChange={(v: OutputFormat) => setOutput((o) => ({ ...o, format: v }))} options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
                </div>
                {output.format === 'jpg' && <Slider label="JPG quality" min={0.7} max={1} step={0.01} value={output.quality} onChange={(v) => setOutput((o) => ({ ...o, quality: v }))} format={(v) => v.toFixed(2)} />}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">Aspect ratio</span>
                  <Segmented size="sm" label="Aspect ratio" value={output.ratio} onChange={(v: OutputRatio) => setOutput((o) => ({ ...o, ratio: v }))} options={[{ value: 'original', label: 'Original' }, { value: '4:5', label: '4:5' }, { value: '9:16', label: '9:16' }]} />
                </div>
                {output.ratio !== 'original' && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">Fit</span>
                    <Segmented size="sm" label="Fit" value={output.ratioFit} onChange={(v: RatioFit) => setOutput((o) => ({ ...o, ratioFit: v }))} options={[{ value: 'pad', label: 'Pad (keep all)' }, { value: 'crop', label: 'Crop' }]} />
                  </div>
                )}
                <p className="text-xs text-slate-500">Exported at the template's real resolution ({template.width}×{template.height}px). The template is never stretched.</p>
              </Card>
              {!ready && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">This template is not verified for production. Ask an administrator to verify it in Branch Templates.</p>}
              {gen.error && <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">{gen.error}</p>}
              <motion.div whileHover={{ scale: ready ? 1.02 : 1 }}>
                <Button size="xl" variant="primary" className={cx('w-full')} disabled={!ready || !asset || !photoImg} loading={busy} icon={<Download className="size-5" />} onClick={() => doGenerate()}>
                  {settings.autoDownload ? 'GENERATE & DOWNLOAD' : 'GENERATE & SAVE'}
                </Button>
              </motion.div>
            </>
          )}
        </aside>
      </div>

      <Modal open={ratioModal} onClose={() => setRatioModal(false)} title={`Confirm ${output.ratio} export (${output.ratioFit === 'pad' ? 'padded' : 'cropped'})`} wide>
        {ratioModal && asset && photoImg && placement && <RatioPreview template={asset.preview} photo={photoImg} placement={placement} adjust={session.adjust} output={output} mode={template.mode} />}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRatioModal(false)}>Back</Button>
          <Button variant="primary" onClick={() => { setRatioModal(false); void doGenerate(true); }}>Looks good – generate</Button>
        </div>
      </Modal>
    </div>
  );
}
