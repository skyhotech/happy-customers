import { useCallback, useState } from 'react';
import { captureVideoFrame, normalizeImageOrientation } from '@/services/imageProcessor';
import { useSession } from '@/store/sessionStore';
import { validateUpload } from '@/utils/imageUtils';

/** Camera capture + file upload into the current session (originals stay in memory until the session ends). */
export function usePhotoCapture() {
  const setPhoto = useSession((s) => s.setPhoto);
  const [busy, setBusy] = useState(false);

  const capture = useCallback(
    async (video: HTMLVideoElement, mirror: boolean) => {
      setBusy(true);
      try {
        const { blob, width, height } = await captureVideoFrame(video, mirror);
        setPhoto({ blob, width, height, source: 'camera', capturedMirrored: mirror });
      } finally {
        setBusy(false);
      }
    },
    [setPhoto],
  );

  const upload = useCallback(
    async (file: File) => {
      const v = validateUpload(file);
      if (!v.ok) throw new Error(v.reason);
      setBusy(true);
      try {
        const { blob, width, height } = await normalizeImageOrientation(file);
        setPhoto({ blob, width, height, source: 'upload', capturedMirrored: false });
      } finally {
        setBusy(false);
      }
    },
    [setPhoto],
  );

  return { capture, upload, busy };
}
