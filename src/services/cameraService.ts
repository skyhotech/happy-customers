export type CameraErrorKind = 'unsupported' | 'insecure' | 'denied' | 'not-found' | 'busy' | 'overconstrained' | 'disconnected' | 'unknown';

export class CameraError extends Error {
  constructor(public kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export type ResolutionPreset = '720p' | '1080p' | '4k';
export const RESOLUTIONS: Record<ResolutionPreset, { width: number; height: number; label: string }> = {
  '720p': { width: 1280, height: 720, label: 'HD 720p' },
  '1080p': { width: 1920, height: 1080, label: 'Full HD 1080p' },
  '4k': { width: 3840, height: 2160, label: '4K' },
};

export function isCameraSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function mapCameraError(e: unknown): CameraError {
  if (e instanceof CameraError) return e;
  const name = (e as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return new CameraError('denied', 'Camera permission was denied. Allow camera access in the browser address bar, then retry.');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError('not-found', 'No camera was found on this device. You can upload a photo instead.');
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new CameraError('busy', 'The camera is busy or in use by another app (Zoom, FaceTime, another tab). Close it and retry.');
    case 'OverconstrainedError':
      return new CameraError('overconstrained', 'The selected camera does not support this resolution. Trying a lower one may help.');
    default:
      return new CameraError('unknown', (e as Error)?.message || 'Could not start the camera.');
  }
}

export interface StartCameraOptions {
  deviceId?: string;
  facingMode?: 'user' | 'environment';
  resolution: ResolutionPreset;
}

/** Requests a high-resolution stream. Falls back to lower constraints when the device refuses. */
export async function startCamera(opts: StartCameraOptions): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new CameraError('insecure', 'Camera requires a secure context. Open the app via https:// or http://localhost.');
  }
  if (!isCameraSupported()) throw new CameraError('unsupported', 'This browser does not support camera access. Please upload a photo instead.');
  const r = RESOLUTIONS[opts.resolution];
  const base: MediaTrackConstraints = opts.deviceId ? { deviceId: { exact: opts.deviceId } } : { facingMode: { ideal: opts.facingMode ?? 'user' } };
  const attempts: MediaTrackConstraints[] = [
    { ...base, width: { ideal: r.width }, height: { ideal: r.height } },
    { ...base, width: { ideal: 1280 }, height: { ideal: 720 } },
    base,
  ];
  let lastError: unknown;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      lastError = e;
      const name = (e as { name?: string })?.name;
      if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') break;
    }
  }
  throw mapCameraError(lastError);
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput');
}
