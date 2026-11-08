import { create } from 'zustand';
import { DEFAULT_ADJUST, type PhotoAdjust, type PhotoPlacement } from '@/types';

export interface SessionPhoto {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  source: 'camera' | 'upload' | 'history';
  /** True when the mirror was baked in at capture time. */
  capturedMirrored: boolean;
}

export interface SessionResult {
  recordId: string;
  fileName: string;
  posterUrl: string;
  posterBlob: Blob;
  deliveryStatus: 'downloaded' | 'saved-to-folder' | 'failed' | 'not-requested';
  deliveryMessage?: string;
}

interface SessionState {
  photo: SessionPhoto | null;
  adjust: PhotoAdjust;
  branchId: string | null;
  templateId: string | null;
  /** Per-session placement tweak (zoom/pan inside region), relative to template default. */
  placementOverride: Partial<PhotoPlacement> | null;
  /** When re-editing an existing history record. */
  sourceRecordId: string | null;
  result: SessionResult | null;
  dirty: boolean;
  setPhoto: (p: Omit<SessionPhoto, 'url'> | null) => void;
  setAdjust: (patch: Partial<PhotoAdjust>) => void;
  resetAdjust: () => void;
  selectBranch: (branchId: string | null, templateId?: string | null) => void;
  selectTemplate: (templateId: string | null) => void;
  setResult: (r: Omit<SessionResult, 'posterUrl'> | null) => void;
  startFromRecord: (args: { recordId: string; photo: Omit<SessionPhoto, 'url'>; adjust: PhotoAdjust; branchId: string; templateId: string; duplicate: boolean }) => void;
  reset: () => void;
}

export const useSession = create<SessionState>()((set, get) => ({
  photo: null,
  adjust: { ...DEFAULT_ADJUST },
  branchId: null,
  templateId: null,
  placementOverride: null,
  sourceRecordId: null,
  result: null,
  dirty: false,

  setPhoto: (p) => {
    const prev = get().photo;
    if (prev) URL.revokeObjectURL(prev.url);
    const prevResult = get().result;
    if (prevResult) URL.revokeObjectURL(prevResult.posterUrl);
    set({
      photo: p ? { ...p, url: URL.createObjectURL(p.blob) } : null,
      adjust: { ...DEFAULT_ADJUST },
      result: null,
      dirty: Boolean(p),
    });
  },
  setAdjust: (patch) => set((s) => ({ adjust: { ...s.adjust, ...patch }, dirty: true })),
  resetAdjust: () => set({ adjust: { ...DEFAULT_ADJUST } }),
  selectBranch: (branchId, templateId = null) => set({ branchId, templateId, dirty: true }),
  selectTemplate: (templateId) => set({ templateId }),
  setResult: (r) => {
    const prev = get().result;
    if (prev) URL.revokeObjectURL(prev.posterUrl);
    set({ result: r ? { ...r, posterUrl: URL.createObjectURL(r.posterBlob) } : null, dirty: r ? false : get().dirty });
  },
  startFromRecord: ({ recordId, photo, adjust, branchId, templateId, duplicate }) => {
    get().reset();
    set({
      photo: { ...photo, url: URL.createObjectURL(photo.blob) },
      adjust,
      branchId,
      templateId,
      sourceRecordId: duplicate ? null : recordId,
      dirty: true,
    });
  },
  reset: () => {
    const { photo, result } = get();
    if (photo) URL.revokeObjectURL(photo.url);
    if (result) URL.revokeObjectURL(result.posterUrl);
    set({ photo: null, adjust: { ...DEFAULT_ADJUST }, branchId: null, templateId: null, placementOverride: null, sourceRecordId: null, result: null, dirty: false });
  },
}));

/** A session is "unfinished" when a photo exists and no poster has been generated since the last change. */
export const hasUnfinishedSession = () => {
  const s = useSession.getState();
  return Boolean(s.photo && s.dirty);
};
