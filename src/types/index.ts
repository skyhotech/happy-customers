// ---------- Branches ----------
export type VerificationStatus = 'verified' | 'needs-review' | 'unverified';

export interface Branch {
  id: string;
  branchName: string;
  locality: string;
  /** Exact address as printed on the poster (Tamil), single line. */
  displayAddress: string;
  displayAddressLines: string[];
  phone: string;
  /** Normalized string used only for search. */
  searchAddress: string;
  aliases: string[];
  templateIds: string[];
  sourceFiles: string[];
  verificationStatus: VerificationStatus;
  verificationMethod?: string;
  notes: string | null;
}

// ---------- Templates ----------
export type CompositingMode = 'flat' | 'transparent-window' | 'layered';
export type RegionShape = 'rect' | 'rounded' | 'ellipse' | 'path';
export type CropMode = 'cover' | 'contain';

/** Region geometry in normalized template coordinates (0–1). */
export interface PhotoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Region rotation in degrees. */
  rotation: number;
  shape: RegionShape;
  /** Corner radius as a fraction of min(region w, h). */
  cornerRadius: number;
  /** SVG path in region-unit coordinates (0–1), used when shape === 'path'. */
  path?: string;
  /** Fraction (0–0.5) of region height faded to transparent at the bottom edge. */
  featherBottom?: number;
  cropMode: CropMode;
  /** Default photo adjustment for this template. */
  scale: number;
  photoOffsetX: number;
  photoOffsetY: number;
  mirror: boolean;
}

export interface OverlayConfiguration {
  foregroundImagePath: string | null;
  backgroundImagePath: string | null;
}

export type TemplateStatus = 'ready' | 'duplicate' | 'needs-manual-placement';

export interface PosterTemplate {
  id: string;
  name: string;
  branchId: string;
  imagePath: string;
  thumbnailPath: string;
  width: number;
  height: number;
  aspectRatio: number;
  sourceFile: string;
  mode: CompositingMode;
  photoPlacement: PhotoPlacement;
  overlayConfiguration: OverlayConfiguration;
  verified: boolean;
  status: TemplateStatus;
  duplicateOf: string | null;
}

/** Admin overrides persisted in IndexedDB. */
export interface TemplateOverride {
  templateId: string;
  branchId?: string;
  photoPlacement?: PhotoPlacement;
  verified?: boolean;
  updatedAt: number;
}

export interface BranchOverride {
  branchId: string;
  verificationStatus: VerificationStatus;
  updatedAt: number;
}

// ---------- Editor ----------
/** Non-destructive photo adjustments, relative to the target region. */
export interface PhotoAdjust {
  /** Zoom multiplier on top of cover/contain fit (>= 0.2). */
  scale: number;
  /** Offset as a fraction of region width/height. */
  offsetX: number;
  offsetY: number;
  /** Free rotation in degrees. */
  rotation: number;
  mirror: boolean;
}

export const DEFAULT_ADJUST: PhotoAdjust = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, mirror: false };

export type OutputFormat = 'jpg' | 'png';
export type OutputRatio = 'original' | '4:5' | '9:16';
export type RatioFit = 'crop' | 'pad';

export interface OutputSettings {
  format: OutputFormat;
  quality: number;
  ratio: OutputRatio;
  ratioFit: RatioFit;
}

// ---------- History ----------
export type DownloadStatus = 'pending' | 'downloaded' | 'saved-to-folder' | 'failed' | 'not-requested';

export interface CustomerRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  branchId: string;
  branchNameSnapshot: string;
  branchAddressSnapshot: string;
  templateId: string;
  originalPhotoBlob: Blob;
  generatedPosterBlob: Blob;
  thumbnailBlob: Blob;
  fileName: string;
  imageWidth: number;
  imageHeight: number;
  mirrorEnabled: boolean;
  cropSettings: PhotoAdjust;
  placementSettings: PhotoPlacement;
  outputSettings: OutputSettings;
  downloadStatus: DownloadStatus;
  /** Optional, never required. */
  customerLabel?: string;
}

export type CustomerRecordMeta = Omit<CustomerRecord, 'originalPhotoBlob' | 'generatedPosterBlob' | 'thumbnailBlob'>;
