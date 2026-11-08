import { useEffect, useRef } from 'react';
import { renderFinalPoster } from '@/services/posterRenderer';
import type { DecodedImage } from '@/services/imageProcessor';
import type { PhotoPlacement } from '@/types';
import { DEFAULT_ADJUST } from '@/types';
import { clamp } from '@/utils/canvasUtils';

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const handlePos: Record<Exclude<Handle, 'move'>, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
};

/** Visual drag-and-resize editor for a template's photo region (normalized coordinates). */
export function PlacementEditor({
  template, templateSize, placement, onChange, samplePhoto, showPhoto,
}: { template: DecodedImage; templateSize: { width: number; height: number }; placement: PhotoPlacement; onChange: (p: PhotoPlacement) => void; samplePhoto: DecodedImage | null; showPhoto: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ handle: Handle; start: { x: number; y: number }; startP: PhotoPlacement } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    const box = boxRef.current;
    if (!c || !box) return;
    const id = requestAnimationFrame(() => {
      const w = Math.min(1400, Math.round(box.clientWidth * Math.min(2, devicePixelRatio || 1)));
      renderFinalPoster({ canvas: c, layers: { template }, photo: showPhoto ? samplePhoto : null, placement, adjust: DEFAULT_ADJUST, mode: 'flat', targetWidth: w, showRegionGuide: true });
    });
    return () => cancelAnimationFrame(id);
  }, [template, placement, samplePhoto, showPhoto]);

  const onDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, start: { x: e.clientX, y: e.clientY }, startP: { ...placement } };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.start.x) / box.width;
    const dy = (e.clientY - d.start.y) / box.height;
    const s = d.startP;
    let { x, y, width, height } = s;
    if (d.handle === 'move') {
      x = s.x + dx;
      y = s.y + dy;
    } else {
      if (d.handle.includes('e')) width = s.width + dx;
      if (d.handle.includes('s')) height = s.height + dy;
      if (d.handle.includes('w')) { x = s.x + dx; width = s.width - dx; }
      if (d.handle.includes('n')) { y = s.y + dy; height = s.height - dy; }
    }
    width = clamp(width, 0.02, 1.2);
    height = clamp(height, 0.02, 1.2);
    onChange({ ...s, x: +x.toFixed(4), y: +y.toFixed(4), width: +width.toFixed(4), height: +height.toFixed(4) });
  };
  const onUp = () => (drag.current = null);

  return (
    <div
      ref={boxRef}
      className="relative mx-auto w-full max-w-[min(100%,46dvh)] select-none overflow-visible rounded-2xl ring-1 ring-white/10"
      style={{ aspectRatio: `${templateSize.width} / ${templateSize.height}` }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full rounded-2xl" aria-label="Template placement preview" />
      <div
        role="slider"
        aria-label="Photo region – drag to move, use handles to resize"
        aria-valuetext={`x ${placement.x}, y ${placement.y}, width ${placement.width}, height ${placement.height}`}
        tabIndex={0}
        onPointerDown={onDown('move')}
        className="absolute cursor-move border-2 border-electric-400/70 bg-electric-400/5"
        style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.width * 100}%`, height: `${placement.height * 100}%`, transform: `rotate(${placement.rotation}deg)`, touchAction: 'none' }}
      >
        {HANDLES.map((h) => (
          <span key={h} onPointerDown={onDown(h)} className={`absolute size-4 rounded-full border-2 border-white bg-electric-500 shadow ${handlePos[h as Exclude<Handle, 'move'>]}`} style={{ touchAction: 'none' }} />
        ))}
      </div>
    </div>
  );
}
