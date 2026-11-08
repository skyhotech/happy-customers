import { ArrowRight, Camera, Crop } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/common/ui';
import { AdjustControls } from '@/components/editor/AdjustControls';
import { PhotoAdjustCanvas } from '@/components/editor/PhotoAdjustCanvas';
import { useDecodedPhoto } from '@/hooks/useAssets';
import { useTemplates } from '@/hooks/useTemplates';
import { useSession } from '@/store/sessionStore';

export default function ReviewPage() {
  const navigate = useNavigate();
  const { photo, adjust, setAdjust, resetAdjust, branchId, templateId } = useSession();
  const { img } = useDecodedPhoto(photo?.blob);
  const { readyTemplates, templates } = useTemplates();
  // Crop frame = the actual photo window of the chosen (or first available) template.
  const frameTemplate = templates.find((t) => t.id === templateId) ?? readyTemplates[0];

  if (!photo) {
    return <Card><EmptyState icon={<Camera className="size-7" />} title="No photo yet" description="Capture or upload a customer photo first." action={<Button variant="primary" onClick={() => navigate('/camera')}>Open camera</Button>} /></Card>;
  }

  return (
    <div>
      <PageHeader eyebrow="Step 2" title="Review customer photo" subtitle="Drag to reposition, pinch or scroll to zoom. The outline shows the exact poster photo window." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="grid min-h-[50dvh] place-items-center p-4 sm:p-6">
          {img && frameTemplate ? (
            <PhotoAdjustCanvas
              mode="region"
              photo={img}
              placement={frameTemplate.photoPlacement}
              templateSize={{ width: frameTemplate.width, height: frameTemplate.height }}
              adjust={adjust}
              onAdjust={setAdjust}
              className="h-[58dvh]"
            />
          ) : (
            <Skeleton className="h-[58dvh] w-full" />
          )}
        </Card>
        <aside className="space-y-4">
          <Card className="space-y-4 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-white"><Crop className="size-4 text-electric-300" /> Crop & adjust</p>
            <AdjustControls adjust={adjust} onChange={setAdjust} onReset={resetAdjust} compact />
            <p className="text-xs text-slate-500">
              Edits are non-destructive: the original {photo.width}×{photo.height} photo is kept unchanged until the session ends.
              {photo.capturedMirrored && ' Captured as a mirrored selfie.'}
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" icon={<Camera className="size-5" />} onClick={() => navigate('/camera')}>Retake</Button>
            <Button size="lg" variant="primary" onClick={() => navigate(branchId && templateId ? '/editor' : '/branches')}>
              Use Photo <ArrowRight className="size-5" />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
