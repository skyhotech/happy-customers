import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OutputFormat, OutputRatio, RatioFit } from '@/types';
import type { ResolutionPreset } from '@/services/cameraService';

export type MotionPreference = 'system' | 'reduced' | 'full';

/** Small, non-sensitive preferences only. Images never go to localStorage. */
export interface SettingsState {
  defaultCameraId: string | null;
  mirror: boolean;
  countdown: 0 | 3 | 5 | 10;
  resolution: ResolutionPreset;
  outputFormat: OutputFormat;
  jpgQuality: number;
  outputRatio: OutputRatio;
  ratioFit: RatioFit;
  defaultBranchId: string | null;
  autoDownload: boolean;
  saveOriginalPhoto: boolean;
  preferFolder: boolean;
  motion: MotionPreference;
  consentAcknowledged: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS = {
  defaultCameraId: null,
  mirror: true,
  countdown: 3 as const,
  resolution: '1080p' as const,
  outputFormat: 'jpg' as const,
  jpgQuality: 0.95,
  outputRatio: 'original' as const,
  ratioFit: 'pad' as const,
  defaultBranchId: null,
  autoDownload: true,
  saveOriginalPhoto: true,
  preferFolder: false,
  motion: 'system' as const,
  consentAcknowledged: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    { name: 'sky-booth-settings', version: 1 },
  ),
);
