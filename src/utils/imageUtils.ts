export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_UPLOAD_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
/** Longest edge kept for customer photos (protects memory, still > region size). */
export const MAX_PHOTO_EDGE = 4096;

export type UploadValidation = { ok: true } | { ok: false; reason: string };

export function validateUpload(file: { name: string; type: string; size: number }): UploadValidation {
  const lower = file.name.toLowerCase();
  const typeOk = (ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(file.type) || ACCEPTED_UPLOAD_EXT.some((e) => lower.endsWith(e));
  if (!typeOk) return { ok: false, reason: 'Unsupported file type. Please use JPG, PNG or WEBP.' };
  if (file.size === 0) return { ok: false, reason: 'The selected file is empty.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: `File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` };
  return { ok: true };
}

export function fitWithin(width: number, height: number, maxEdge: number) {
  const s = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * s), height: Math.round(height * s), scale: s };
}
