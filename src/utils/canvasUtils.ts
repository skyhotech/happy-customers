import type { CropMode, OutputRatio, PhotoAdjust, PhotoPlacement, RatioFit } from '@/types';

export interface Size {
  width: number;
  height: number;
}
export interface Rect extends Size {
  x: number;
  y: number;
}

/** Converts normalized (0–1) placement geometry into pixel space of a canvas. */
export function regionToPixels(p: Pick<PhotoPlacement, 'x' | 'y' | 'width' | 'height'>, canvas: Size): Rect {
  return {
    x: p.x * canvas.width,
    y: p.y * canvas.height,
    width: p.width * canvas.width,
    height: p.height * canvas.height,
  };
}

/** Size of the photo bounding box after rotating by `deg`. */
export function rotatedBounds(size: Size, deg: number): Size {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { width: size.width * c + size.height * s, height: size.width * s + size.height * c };
}

/**
 * Base scale that makes `src` fully cover (or fit inside) `dst` while preserving aspect ratio.
 * Never distorts: one uniform scale factor.
 */
export function calculateCoverCrop(src: Size, dst: Size, mode: CropMode = 'cover'): { scale: number; drawWidth: number; drawHeight: number; offsetX: number; offsetY: number } {
  if (src.width <= 0 || src.height <= 0) throw new Error('Invalid source size');
  const sx = dst.width / src.width;
  const sy = dst.height / src.height;
  const scale = mode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const drawWidth = src.width * scale;
  const drawHeight = src.height * scale;
  return { scale, drawWidth, drawHeight, offsetX: (dst.width - drawWidth) / 2, offsetY: (dst.height - drawHeight) / 2 };
}

export interface PhotoTransform {
  /** Center of the photo inside the region box (px, region-local). */
  cx: number;
  cy: number;
  /** Uniform scale applied to the source photo pixels. */
  scale: number;
  rotationRad: number;
  flipX: boolean;
}

/**
 * Computes how the customer photo is drawn inside a region box.
 * Cover is computed against the rotated photo bounds so free rotation never leaves gaps at scale 1.
 */
export function computePhotoTransform(photo: Size, region: Size, adjust: PhotoAdjust, mode: CropMode = 'cover'): PhotoTransform {
  const bounds = rotatedBounds(photo, adjust.rotation);
  const base = calculateCoverCrop(bounds, region, mode).scale;
  return {
    cx: region.width / 2 + adjust.offsetX * region.width,
    cy: region.height / 2 + adjust.offsetY * region.height,
    scale: base * Math.max(0.05, adjust.scale),
    rotationRad: (adjust.rotation * Math.PI) / 180,
    flipX: adjust.mirror,
  };
}

/** Transform matrix used when capturing a video frame. Mirror is applied exactly once. */
export function captureMatrix(mirror: boolean, width: number): [number, number, number, number, number, number] {
  return mirror ? [-1, 0, 0, 1, width, 0] : [1, 0, 0, 1, 0, 0];
}

export function ratioValue(ratio: OutputRatio, template: Size): number {
  if (ratio === '4:5') return 4 / 5;
  if (ratio === '9:16') return 9 / 16;
  return template.width / template.height;
}

export interface ExportLayout {
  canvas: Size;
  /** Where the full poster is drawn on the export canvas. */
  draw: Rect;
  padded: boolean;
}

/**
 * Computes export canvas dimensions for an optional fixed ratio.
 * crop: canvas is the largest centered sub-rect of the poster with that ratio.
 * pad:  canvas grows so the whole poster fits, letterboxed.
 * The poster itself is never stretched.
 */
export function computeExportLayout(template: Size, ratio: OutputRatio, fit: RatioFit): ExportLayout {
  const target = ratioValue(ratio, template);
  const current = template.width / template.height;
  if (ratio === 'original' || Math.abs(target - current) < 0.0005) {
    return { canvas: { ...template }, draw: { x: 0, y: 0, ...template }, padded: false };
  }
  if (fit === 'crop') {
    if (target < current) {
      const w = Math.round(template.height * target);
      return { canvas: { width: w, height: template.height }, draw: { x: -(template.width - w) / 2, y: 0, ...template }, padded: false };
    }
    const h = Math.round(template.width / target);
    return { canvas: { width: template.width, height: h }, draw: { x: 0, y: -(template.height - h) / 2, ...template }, padded: false };
  }
  if (target > current) {
    const w = Math.round(template.height * target);
    return { canvas: { width: w, height: template.height }, draw: { x: (w - template.width) / 2, y: 0, ...template }, padded: true };
  }
  const h = Math.round(template.width / target);
  return { canvas: { width: template.width, height: h }, draw: { x: 0, y: (h - template.height) / 2, ...template }, padded: true };
}

/** Max safe canvas area. iOS/iPadOS Safari caps canvases at 16,777,216 px. */
export function maxCanvasArea(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): number {
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  return iOS ? 16_777_216 : 120_000_000;
}

/** Uniform downscale factor (<= 1) needed to fit a canvas into the platform's max area. */
export function safeScaleFor(size: Size, maxArea = maxCanvasArea()): number {
  const area = size.width * size.height;
  return area <= maxArea ? 1 : Math.sqrt(maxArea / area) * 0.995;
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Builds the clip path for a region in region-local pixel coordinates. */
export function buildRegionPath(placement: PhotoPlacement, w: number, h: number): Path2D {
  const path = new Path2D();
  switch (placement.shape) {
    case 'ellipse':
      path.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      return path;
    case 'rounded': {
      const r = clamp(placement.cornerRadius, 0, 0.5) * Math.min(w, h);
      path.roundRect(0, 0, w, h, r);
      return path;
    }
    case 'path':
      if (placement.path) {
        const unit = new Path2D(placement.path);
        const scaled = new Path2D();
        scaled.addPath(unit, new DOMMatrix([w, 0, 0, h, 0, 0]));
        return scaled;
      }
      path.rect(0, 0, w, h);
      return path;
    default:
      path.rect(0, 0, w, h);
      return path;
  }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

/** Frees canvas backing memory (important on iOS). */
export function releaseCanvas(c: HTMLCanvasElement | null | undefined) {
  if (!c) return;
  c.width = 1;
  c.height = 1;
}
