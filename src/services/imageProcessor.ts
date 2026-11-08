import { captureMatrix, createCanvas, releaseCanvas } from '@/utils/canvasUtils';
import { fitWithin, MAX_PHOTO_EDGE } from '@/utils/imageUtils';

export class ImageDecodeError extends Error {
  constructor(message = 'The image could not be decoded. It may be corrupt or in an unsupported format.') {
    super(message);
    this.name = 'ImageDecodeError';
  }
}

export type DecodedImage = HTMLImageElement | ImageBitmap;

export function imageSize(img: DecodedImage) {
  return 'naturalWidth' in img ? { width: img.naturalWidth, height: img.naturalHeight } : { width: img.width, height: img.height };
}

/** Loads an image from a URL or Blob. Blob URLs are revoked once decoded. */
export function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const isBlob = typeof src !== 'string';
    const url = isBlob ? URL.createObjectURL(src) : src;
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (img.decode) await img.decode().catch(() => undefined);
        resolve(img);
      } finally {
        if (isBlob) URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      if (isBlob) URL.revokeObjectURL(url);
      reject(new ImageDecodeError(isBlob ? undefined : `Could not load image: ${src}`));
    };
    img.src = url;
  });
}

/** Decodes a Blob honoring EXIF orientation (createImageBitmap 'from-image', fallback <img>). */
export async function decodeBlob(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img>, which also applies EXIF orientation in modern browsers */
    }
  }
  return loadImage(blob);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed (image may be too large for this device).'))), type, quality);
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Canvas export failed'));
    }
  });
}

export interface NormalizedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Bakes EXIF orientation into pixels and caps the longest edge at MAX_PHOTO_EDGE.
 * Output is a JPEG (0.95) with orientation 1, so every later step sees upright pixels.
 */
export async function normalizeImageOrientation(blob: Blob, maxEdge = MAX_PHOTO_EDGE): Promise<NormalizedPhoto> {
  const img = await decodeBlob(blob);
  const src = imageSize(img);
  if (!src.width || !src.height) throw new ImageDecodeError();
  const { width, height } = fitWithin(src.width, src.height, maxEdge);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  if ('close' in img) img.close();
  try {
    const out = await canvasToBlob(canvas, 'image/jpeg', 0.95);
    return { blob: out, width, height };
  } finally {
    releaseCanvas(canvas);
  }
}

/**
 * Captures the current video frame at its real resolution.
 * The mirror transform is applied exactly once here, so the stored photo matches the mirrored preview.
 */
export async function captureVideoFrame(video: HTMLVideoElement, mirror: boolean): Promise<NormalizedPhoto> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error('Camera is not ready yet.');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.setTransform(...captureMatrix(mirror, width));
  ctx.drawImage(video, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try {
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
    return { blob, width, height };
  } finally {
    releaseCanvas(canvas);
  }
}

export async function makeThumbnail(blob: Blob, maxEdge = 480, quality = 0.8): Promise<Blob> {
  const img = await decodeBlob(blob);
  const src = imageSize(img);
  const { width, height } = fitWithin(src.width, src.height, maxEdge);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  if ('close' in img) img.close();
  try {
    return await canvasToBlob(canvas, 'image/jpeg', quality);
  } finally {
    releaseCanvas(canvas);
  }
}
