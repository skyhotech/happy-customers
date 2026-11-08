import { Camera, CameraOff, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isCameraSupported, listCameras } from '@/services/cameraService';
import { Badge } from '@/components/common/ui';

/** Camera availability without opening the camera (no stream is requested here). */
export function CameraStatus() {
  const [state, setState] = useState<{ permission: string; count: number; supported: boolean; secure: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = isCameraSupported();
      const secure = window.isSecureContext;
      let permission = 'unknown';
      try {
        const r = await navigator.permissions?.query({ name: 'camera' as PermissionName });
        permission = r?.state ?? 'unknown';
      } catch {
        /* Safari/Firefox may not support querying camera permission */
      }
      const count = supported ? (await listCameras().catch(() => [])).length : 0;
      if (alive) setState({ permission, count, supported, secure });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <Badge>Checking camera…</Badge>;
  if (!state.secure) return <Badge tone="red"><ShieldAlert className="size-3.5" /> Needs HTTPS / localhost</Badge>;
  if (!state.supported) return <Badge tone="red"><CameraOff className="size-3.5" /> Camera unsupported – upload only</Badge>;
  if (state.count === 0) return <Badge tone="amber"><CameraOff className="size-3.5" /> No camera detected</Badge>;
  if (state.permission === 'denied') return <Badge tone="red"><ShieldAlert className="size-3.5" /> Camera blocked</Badge>;
  return (
    <Badge tone="green">
      <Camera className="size-3.5" /> {state.count} camera{state.count > 1 ? 's' : ''} {state.permission === 'granted' ? 'ready' : 'available'}
    </Badge>
  );
}
