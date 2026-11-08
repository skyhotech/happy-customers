import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderCustomerLayer, renderFinalPoster } from '@/services/posterRenderer';
import type { DecodedImage } from '@/services/imageProcessor';
import type { CompositingMode, PhotoAdjust, PhotoPlacement } from '@/types';
import { buildRegionPath, clamp, releaseCanvas, type Size } from '@/utils/canvasUtils';
import { cx } from '@/components/common/ui';

export interface PhotoAdjustCanvasProps {
  mode: 'region' | 'poster';
  photo: DecodedImage | null;
  placement: PhotoPlacement;
  adjust: PhotoAdjust;
  onAdjust?: (patch: Partial<PhotoAdjust>) => void;
  templateSize: Size;
  template?: DecodedImage | null;
  compositingMode?: CompositingMode;
  showPhoto?: boolean;
  showGuide?: boolean;
  maxHeight?: string;
  className?: string;
  ariaLabel?: string;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 6;

/**
 * Interactive preview. Drag = pan, wheel/pinch = zoom, arrow keys = nudge, +/- = zoom.
 * Rendering goes through the same compositor as the export, so what you see is what you download.
 */
export function PhotoAdjustCanvas(p: PhotoAdjustCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [css, setCss] = useState<Size>({ width: 0, height: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startAdjust: PhotoAdjust; startDist: number; startMid: { x: number; y: number } } | null>(null);
  const adjustRef = useRef(p.adjust);
  adjustRef.current = p.adjust;

  const regionPx = { width: p.placement.width * p.templateSize.width, height: p.placement.height * p.templateSize.height };
  const aspect = p.mode === 'poster' ? p.templateSize.width / p.templateSize.height : regionPx.width / regionPx.height;

  // Fit inside the wrapper while keeping aspect.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      let w = r.width;
      let h = w / aspect;
      if (h > r.height) {
        h = r.height;
        w = h * aspect;
      }
      setCss({ width: Math.floor(w), height: Math.floor(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  // Render on any change (coalesced to one frame).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !css.width) return;
    const id = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.min(1600, Math.round(css.width * dpr));
      if (p.mode === 'poster') {
        if (!p.template) return;
        renderFinalPoster({
          canvas,
          layers: { template: p.template },
          photo: p.showPhoto === false ? null : p.photo,
          placement: p.placement,
          adjust: p.adjust,
          mode: p.compositingMode ?? 'flat',
          targetWidth: targetW,
          showRegionGuide: p.showGuide,
        });
        return;
      }
      const targetH = Math.round(targetW / aspect);
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0b1530';
      ctx.fillRect(0, 0, targetW, targetH);
      if (!p.photo) return;
      // Ghost of the full crop context, then the clipped region at full opacity.
      const rectPlacement = { ...p.placement, shape: 'rect' as const, featherBottom: 0 };
      const ghost = renderCustomerLayer(p.photo, { width: targetW, height: targetH }, rectPlacement, p.adjust);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(ghost, 0, 0);
      ctx.globalAlpha = 1;
      releaseCanvas(ghost);
      const layer = renderCustomerLayer(p.photo, { width: targetW, height: targetH }, { ...p.placement, featherBottom: 0 }, p.adjust);
      ctx.drawImage(layer, 0, 0);
      releaseCanvas(layer);
      ctx.save();
      ctx.lineWidth = Math.max(2, targetW / 300);
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = 'rgba(120,170,255,0.9)';
      ctx.stroke(buildRegionPath(p.placement, targetW, targetH));
      ctx.restore();
    });
    return () => cancelAnimationFrame(id);
  }, [css, p.mode, p.photo, p.template, p.placement, p.adjust, p.showPhoto, p.showGuide, p.compositingMode, aspect]);

  const regionCss = () =>
    p.mode === 'poster'
      ? { x: p.placement.x * css.width, y: p.placement.y * css.height, width: p.placement.width * css.width, height: p.placement.height * css.height }
      : { x: 0, y: 0, width: css.width, height: css.height };

  const emit = (patch: Partial<PhotoAdjust>) => p.onAdjust?.(patch);
  const interactive = Boolean(p.onAdjust && p.photo && p.showPhoto !== false);

  const local = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const pt = local(e);
    const reg = regionCss();
    if (p.mode === 'poster' && pointers.current.size === 0 && (pt.x < reg.x || pt.x > reg.x + reg.width || pt.y < reg.y || pt.y > reg.y + reg.height)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, pt);
    startGesture();
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    const mid = pts.reduce((a, b) => ({ x: a.x + b.x / pts.length, y: a.y + b.y / pts.length }), { x: 0, y: 0 });
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { startAdjust: { ...adjustRef.current }, startDist: dist, startMid: mid };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    const mid = pts.reduce((a, b) => ({ x: a.x + b.x / pts.length, y: a.y + b.y / pts.length }), { x: 0, y: 0 });
    const reg = regionCss();
    const g = gesture.current;
    const patch: Partial<PhotoAdjust> = {
      offsetX: clamp(g.startAdjust.offsetX + (mid.x - g.startMid.x) / reg.width, -2, 2),
      offsetY: clamp(g.startAdjust.offsetY + (mid.y - g.startMid.y) / reg.height, -2, 2),
    };
    if (pts.length > 1 && g.startDist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      patch.scale = clamp(g.startAdjust.scale * (dist / g.startDist), MIN_SCALE, MAX_SCALE);
    }
    emit(patch);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) startGesture();
    else gesture.current = null;
  };

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = adjustRef.current.scale * Math.exp(-e.deltaY * 0.0015);
      p.onAdjust?.({ scale: clamp(s, MIN_SCALE, MAX_SCALE) });
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [interactive, p.onAdjust]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    const a = adjustRef.current;
    const step = e.shiftKey ? 0.05 : 0.01;
    const map: Record<string, Partial<PhotoAdjust>> = {
      ArrowLeft: { offsetX: a.offsetX - step },
      ArrowRight: { offsetX: a.offsetX + step },
      ArrowUp: { offsetY: a.offsetY - step },
      ArrowDown: { offsetY: a.offsetY + step },
      '+': { scale: clamp(a.scale * 1.05, MIN_SCALE, MAX_SCALE) },
      '=': { scale: clamp(a.scale * 1.05, MIN_SCALE, MAX_SCALE) },
      '-': { scale: clamp(a.scale / 1.05, MIN_SCALE, MAX_SCALE) },
    };
    if (map[e.key]) {
      e.preventDefault();
      emit(map[e.key]);
    }
  };

  return (
    <div ref={wrapRef} className={cx('relative grid h-full w-full place-items-center', p.className)} style={{ maxHeight: p.maxHeight }}>
      <canvas
        ref={canvasRef}
        tabIndex={interactive ? 0 : -1}
        aria-label={p.ariaLabel ?? 'Photo preview. Drag to move, scroll or pinch to zoom, arrow keys to nudge.'}
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{ width: css.width, height: css.height, touchAction: interactive ? 'none' : 'auto' }}
        className={cx('rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-400', interactive && 'cursor-grab active:cursor-grabbing')}
      />
    </div>
  );
}
