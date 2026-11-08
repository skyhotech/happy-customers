import { FlipHorizontal2, RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import type { PhotoAdjust } from '@/types';
import { Button, IconButton, Slider } from '@/components/common/ui';

export function AdjustControls({ adjust, onChange, onReset, compact }: { adjust: PhotoAdjust; onChange: (p: Partial<PhotoAdjust>) => void; onReset: () => void; compact?: boolean }) {
  const zoom = (f: number) => onChange({ scale: Math.min(6, Math.max(0.3, +(adjust.scale * f).toFixed(3))) });
  const rot90 = (d: number) => {
    let r = adjust.rotation + d;
    if (r > 180) r -= 360;
    if (r < -180) r += 360;
    onChange({ rotation: r });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <IconButton label="Zoom out" size="sm" icon={<ZoomOut className="size-4" />} onClick={() => zoom(1 / 1.1)} />
        <div className="flex-1">
          <Slider label="Zoom" min={0.3} max={4} step={0.01} value={adjust.scale} onChange={(v) => onChange({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
        <IconButton label="Zoom in" size="sm" icon={<ZoomIn className="size-4" />} onClick={() => zoom(1.1)} />
      </div>
      <Slider label="Rotate" min={-180} max={180} step={0.5} value={adjust.rotation} onChange={(v) => onChange({ rotation: v })} format={(v) => `${v.toFixed(1)}°`} />
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
        <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={() => rot90(-90)}>Rotate left</Button>
        <Button size="sm" icon={<RotateCw className="size-4" />} onClick={() => rot90(90)}>Rotate right</Button>
        <Button size="sm" variant={adjust.mirror ? 'primary' : 'secondary'} aria-pressed={adjust.mirror} icon={<FlipHorizontal2 className="size-4" />} onClick={() => onChange({ mirror: !adjust.mirror })}>
          Mirror
        </Button>
        <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" />} onClick={onReset}>Reset</Button>
      </div>
    </div>
  );
}
