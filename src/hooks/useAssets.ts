import { useEffect, useState } from 'react';
import { decodeBlob, imageSize, loadImage, type DecodedImage } from '@/services/imageProcessor';

/** Object URL for a Blob, revoked automatically. */
export function useObjectUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob || blob.size === 0) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

interface TemplateAsset {
  full: HTMLImageElement;
  preview: DecodedImage;
}
const templateCache = new Map<string, Promise<TemplateAsset>>();
const MAX_CACHED = 3;

/** Loads a full-resolution template plus a ~1600px preview bitmap for fast live editing. */
export function loadTemplateAsset(path: string): Promise<TemplateAsset> {
  const hit = templateCache.get(path);
  if (hit) return hit;
  const p = (async () => {
    const full = await loadImage(path);
    let preview: DecodedImage = full;
    try {
      const h = 1600;
      const w = Math.round((full.naturalWidth * h) / full.naturalHeight);
      if (typeof createImageBitmap === 'function' && full.naturalHeight > h) {
        preview = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
      }
    } catch {
      preview = full;
    }
    return { full, preview };
  })();
  p.catch(() => templateCache.delete(path));
  templateCache.set(path, p);
  while (templateCache.size > MAX_CACHED) {
    const oldest = templateCache.keys().next().value as string;
    templateCache.delete(oldest);
  }
  return p;
}

export function useTemplateAsset(path: string | null | undefined) {
  const [state, setState] = useState<{ asset: TemplateAsset | null; error: string | null; loading: boolean }>({ asset: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) return setState({ asset: null, error: null, loading: false });
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loadTemplateAsset(path)
      .then((asset) => alive && setState({ asset, error: null, loading: false }))
      .catch((e: Error) => alive && setState({ asset: null, error: e.message || 'Template failed to load', loading: false }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}

/** Decodes a photo Blob (EXIF-aware) for canvas rendering; closes bitmaps on change. */
export function useDecodedPhoto(blob: Blob | null | undefined) {
  const [img, setImg] = useState<DecodedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!blob || blob.size === 0) return setImg(null);
    let alive = true;
    let decoded: DecodedImage | null = null;
    decodeBlob(blob)
      .then((d) => {
        decoded = d;
        if (alive) setImg(d);
        else if ('close' in d) d.close();
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
      if (decoded && 'close' in decoded) decoded.close();
    };
  }, [blob]);
  return { img, error, size: img ? imageSize(img) : null };
}
