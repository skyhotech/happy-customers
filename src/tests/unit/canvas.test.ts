import { describe, expect, it } from 'vitest';
import {
  calculateCoverCrop,
  captureMatrix,
  computeExportLayout,
  computePhotoTransform,
  regionToPixels,
  rotatedBounds,
  safeScaleFor,
} from '@/utils/canvasUtils';
import { DEFAULT_ADJUST } from '@/types';
import { BASE_TEMPLATES } from '@/services/templateResolver';

const T = { width: 3516, height: 6250 };

describe('camera mirroring', () => {
  it('applies a horizontal flip exactly once when mirrored', () => {
    const [a, b, c, d, e, f] = captureMatrix(true, 1920);
    // x' = a*x + e  →  pixel 0 maps to 1920, pixel 1920 maps to 0
    expect(a * 0 + e).toBe(1920);
    expect(a * 1920 + e).toBe(0);
    expect([b, c, d, f]).toEqual([0, 0, 1, 0]);
  });
  it('is identity when not mirrored', () => {
    expect(captureMatrix(false, 1920)).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('cover crop', () => {
  it('fills the destination without distortion (landscape photo, portrait region)', () => {
    const r = calculateCoverCrop({ width: 1920, height: 1080 }, { width: 600, height: 800 });
    expect(r.drawHeight).toBeCloseTo(800);
    expect(r.drawWidth).toBeGreaterThanOrEqual(600);
    expect(r.drawWidth / r.drawHeight).toBeCloseTo(1920 / 1080);
    expect(r.offsetX).toBeCloseTo((600 - r.drawWidth) / 2);
  });
  it('contain mode fits inside', () => {
    const r = calculateCoverCrop({ width: 1920, height: 1080 }, { width: 600, height: 800 }, 'contain');
    expect(r.drawWidth).toBeCloseTo(600);
    expect(r.drawHeight).toBeLessThanOrEqual(800);
  });
  it('rejects invalid sizes', () => {
    expect(() => calculateCoverCrop({ width: 0, height: 10 }, { width: 1, height: 1 })).toThrow();
  });
});

describe('crop placement', () => {
  const region = { width: 2946, height: 2562 };
  const photo = { width: 1920, height: 1080 };

  it('centers the photo at default adjust and covers the region', () => {
    const t = computePhotoTransform(photo, region, DEFAULT_ADJUST);
    expect(t.cx).toBe(region.width / 2);
    expect(t.cy).toBe(region.height / 2);
    expect(photo.width * t.scale).toBeGreaterThanOrEqual(region.width - 0.01);
    expect(photo.height * t.scale).toBeGreaterThanOrEqual(region.height - 0.01);
  });

  it('maps offsets as fractions of the region and zoom multiplies the base scale', () => {
    const base = computePhotoTransform(photo, region, DEFAULT_ADJUST);
    const t = computePhotoTransform(photo, region, { ...DEFAULT_ADJUST, offsetX: 0.1, offsetY: -0.2, scale: 1.5 });
    expect(t.cx).toBeCloseTo(region.width * 0.6);
    expect(t.cy).toBeCloseTo(region.height * 0.3);
    expect(t.scale).toBeCloseTo(base.scale * 1.5);
  });

  it('still covers the region when the photo is rotated', () => {
    const t = computePhotoTransform(photo, region, { ...DEFAULT_ADJUST, rotation: 90 });
    const b = rotatedBounds(photo, 90);
    expect(b.width).toBeCloseTo(1080);
    expect(b.width * t.scale).toBeGreaterThanOrEqual(region.width - 0.01);
    expect(b.height * t.scale).toBeGreaterThanOrEqual(region.height - 0.01);
  });

  it('carries the mirror flag through', () => {
    expect(computePhotoTransform(photo, region, { ...DEFAULT_ADJUST, mirror: true }).flipX).toBe(true);
  });

  it('places the default Dream Diwali window inside the poster and above the footer', () => {
    const p = BASE_TEMPLATES[0].photoPlacement;
    const px = regionToPixels(p, T);
    expect(px.x).toBeGreaterThan(0);
    expect(px.x + px.width).toBeLessThan(T.width);
    expect(px.y).toBeGreaterThan(T.height * 0.2); // below the logo + title
    expect(px.y + px.height).toBeLessThan(T.height * 0.7); // above lamp tiles, tagline and address footer
  });
});

describe('export dimensions', () => {
  it('keeps the real template resolution for original ratio', () => {
    const l = computeExportLayout(T, 'original', 'pad');
    expect(l.canvas).toEqual(T);
    expect(l.draw).toEqual({ x: 0, y: 0, ...T });
  });

  it('pads to 4:5 without stretching', () => {
    const l = computeExportLayout(T, '4:5', 'pad');
    expect(l.canvas.height).toBe(6250);
    expect(l.canvas.width).toBe(5000);
    expect(l.draw.width).toBe(T.width);
    expect(l.draw.height).toBe(T.height);
    expect(l.draw.x).toBeCloseTo((5000 - 3516) / 2);
    expect(l.padded).toBe(true);
  });

  it('crops to 4:5 using the largest centered rect', () => {
    const l = computeExportLayout(T, '4:5', 'crop');
    expect(l.canvas.width).toBe(3516);
    expect(l.canvas.height).toBe(Math.round(3516 / 0.8));
    expect(l.draw.width).toBe(T.width);
  });

  it('treats 9:16 as (almost) native for these templates', () => {
    const l = computeExportLayout(T, '9:16', 'crop');
    expect(l.canvas).toEqual(T);
  });

  it('downscales only on platforms with canvas area limits', () => {
    expect(safeScaleFor(T, 120_000_000)).toBe(1);
    const s = safeScaleFor(T, 16_777_216);
    expect(T.width * s * T.height * s).toBeLessThanOrEqual(16_777_216);
  });
});
