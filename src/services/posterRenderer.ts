import type { CompositingMode, OutputSettings, PhotoAdjust, PhotoPlacement } from '@/types';
import {
  buildRegionPath,
  computeExportLayout,
  computePhotoTransform,
  createCanvas,
  regionToPixels,
  releaseCanvas,
  safeScaleFor,
  type Size,
} from '@/utils/canvasUtils';
import { canvasToBlob, imageSize, type DecodedImage } from './imageProcessor';

export { loadImage, normalizeImageOrientation } from './imageProcessor';
export { calculateCoverCrop } from '@/utils/canvasUtils';

export interface RenderLayers {
  /** Template artwork (flat poster, or the frame with a transparent window). */
  template: DecodedImage;
  /** Optional separate background (layered mode). */
  background?: DecodedImage | null;
  /** Optional artwork that must stay above the customer photo. */
  foreground?: DecodedImage | null;
}

export interface RenderOptions {
  layers: RenderLayers;
  photo: DecodedImage | null;
  placement: PhotoPlacement;
  adjust: PhotoAdjust;
  mode: CompositingMode;
  /** Output width in px; defaults to the template's real width. Height keeps the template ratio. */
  targetWidth?: number;
  /** Draws a dashed outline of the photo region (admin/editor only, never in exports). */
  showRegionGuide?: boolean;
  /** Reuse a canvas for live previews. */
  canvas?: HTMLCanvasElement;
}

/** Applies a horizontal mirror around the origin. */
export function applyMirrorTransform(ctx: CanvasRenderingContext2D, mirror: boolean) {
  if (mirror) ctx.scale(-1, 1);
}

export function applyRotation(ctx: CanvasRenderingContext2D, rad: number) {
  if (rad) ctx.rotate(rad);
}

/**
 * Renders the customer photo into a region-sized layer: clipped to the region shape,
 * cover-fitted, zoom/pan/rotate/mirror applied, optional bottom feather.
 */
export function renderCustomerLayer(photo: DecodedImage, region: Size, placement: PhotoPlacement, adjust: PhotoAdjust): HTMLCanvasElement {
  const layer = createCanvas(region.width, region.height);
  const ctx = layer.getContext('2d')!;
  const w = layer.width;
  const h = layer.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.clip(buildRegionPath(placement, w, h));
  const src = imageSize(photo);
  const t = computePhotoTransform(src, { width: w, height: h }, adjust, placement.cropMode);
  ctx.translate(t.cx, t.cy);
  applyRotation(ctx, t.rotationRad);
  applyMirrorTransform(ctx, t.flipX);
  ctx.scale(t.scale, t.scale);
  ctx.drawImage(photo, -src.width / 2, -src.height / 2, src.width, src.height);
  ctx.restore();

  const feather = Math.min(0.5, Math.max(0, placement.featherBottom ?? 0));
  if (feather > 0) {
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, h * (1 - feather), 0, h);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    // One full-size fill: the gradient clamps to opaque above its start, so the top stays intact.
    // (destination-in clears everything outside the filled shape, so never split this into two fills.)
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  return layer;
}

export function renderForegroundOverlay(ctx: CanvasRenderingContext2D, overlay: DecodedImage | null | undefined, size: Size) {
  if (overlay) ctx.drawImage(overlay, 0, 0, size.width, size.height);
}

function drawRegionGuide(ctx: CanvasRenderingContext2D, placement: PhotoPlacement, size: Size) {
  const r = regionToPixels(placement, size);
  ctx.save();
  ctx.translate(r.x + r.width / 2, r.y + r.height / 2);
  ctx.rotate((placement.rotation * Math.PI) / 180);
  ctx.translate(-r.width / 2, -r.height / 2);
  const lw = Math.max(2, size.width / 400);
  ctx.lineWidth = lw;
  ctx.setLineDash([lw * 4, lw * 3]);
  ctx.strokeStyle = 'rgba(56,132,255,0.95)';
  ctx.stroke(buildRegionPath(placement, r.width, r.height));
  ctx.strokeStyle = 'rgba(56,132,255,0.45)';
  ctx.strokeRect(0, 0, r.width, r.height);
  ctx.restore();
}

/**
 * Composites the final poster at the template's real resolution (or `targetWidth`).
 * The same function powers the live preview and the export, so they always match.
 */
export function renderFinalPoster(opts: RenderOptions): HTMLCanvasElement {
  const tSize = imageSize(opts.layers.template);
  if (!tSize.width || !tSize.height) throw new Error('Template image is not decoded.');
  let width = opts.targetWidth ?? tSize.width;
  let height = Math.round((width * tSize.height) / tSize.width);
  const safe = safeScaleFor({ width, height });
  width = Math.round(width * safe);
  height = Math.round(height * safe);

  const canvas = opts.canvas ?? createCanvas(width, height);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const size = { width, height };

  const drawCustomer = () => {
    if (!opts.photo) return;
    const r = regionToPixels(opts.placement, size);
    const layer = renderCustomerLayer(opts.photo, r, opts.placement, opts.adjust);
    ctx.save();
    ctx.translate(r.x + r.width / 2, r.y + r.height / 2);
    ctx.rotate((opts.placement.rotation * Math.PI) / 180);
    ctx.drawImage(layer, -r.width / 2, -r.height / 2, r.width, r.height);
    ctx.restore();
    releaseCanvas(layer);
  };

  switch (opts.mode) {
    case 'transparent-window':
      // Photo sits behind the template; the template's transparent opening reveals it.
      drawCustomer();
      ctx.drawImage(opts.layers.template, 0, 0, width, height);
      break;
    case 'layered':
      if (opts.layers.background) ctx.drawImage(opts.layers.background, 0, 0, width, height);
      else ctx.drawImage(opts.layers.template, 0, 0, width, height);
      drawCustomer();
      renderForegroundOverlay(ctx, opts.layers.foreground, size);
      break;
    default:
      // Flat poster: the photo is drawn on top, strictly inside the approved region.
      ctx.drawImage(opts.layers.template, 0, 0, width, height);
      drawCustomer();
      renderForegroundOverlay(ctx, opts.layers.foreground, size);
  }

  if (opts.showRegionGuide) drawRegionGuide(ctx, opts.placement, size);
  return canvas;
}

/** Applies an optional fixed export ratio (crop or pad — never stretch). */
export function applyOutputRatio(poster: HTMLCanvasElement, output: OutputSettings): HTMLCanvasElement {
  const layout = computeExportLayout({ width: poster.width, height: poster.height }, output.ratio, output.ratioFit);
  if (layout.canvas.width === poster.width && layout.canvas.height === poster.height) return poster;
  const out = createCanvas(layout.canvas.width, layout.canvas.height);
  const ctx = out.getContext('2d')!;
  if (layout.padded) {
    // Soft blurred backdrop from the poster itself; solid fallback where filter is unsupported.
    ctx.fillStyle = '#f7e6dc';
    ctx.fillRect(0, 0, out.width, out.height);
    if ('filter' in ctx) {
      ctx.save();
      ctx.filter = `blur(${Math.round(out.width / 40)}px) brightness(1.05)`;
      const s = Math.max(out.width / poster.width, out.height / poster.height) * 1.1;
      ctx.drawImage(poster, (out.width - poster.width * s) / 2, (out.height - poster.height * s) / 2, poster.width * s, poster.height * s);
      ctx.restore();
    }
  }
  ctx.drawImage(poster, layout.draw.x, layout.draw.y, layout.draw.width, layout.draw.height);
  return out;
}

export async function exportPosterBlob(canvas: HTMLCanvasElement, output: OutputSettings): Promise<Blob> {
  const type = output.format === 'png' ? 'image/png' : 'image/jpeg';
  return canvasToBlob(canvas, type, output.format === 'png' ? undefined : output.quality);
}

/** Full pipeline: composite at real resolution → ratio → Blob. Frees canvases afterwards. */
export async function generatePoster(opts: Omit<RenderOptions, 'targetWidth' | 'canvas' | 'showRegionGuide'>, output: OutputSettings) {
  let poster: HTMLCanvasElement | null = null;
  let final: HTMLCanvasElement | null = null;
  try {
    poster = renderFinalPoster(opts);
    final = applyOutputRatio(poster, output);
    const blob = await exportPosterBlob(final, output);
    return { blob, width: final.width, height: final.height };
  } finally {
    if (final && final !== poster) releaseCanvas(final);
    releaseCanvas(poster);
  }
}
