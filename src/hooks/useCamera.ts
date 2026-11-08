import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraError, listCameras, mapCameraError, startCamera, stopStream, type ResolutionPreset } from '@/services/cameraService';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error';

/**
 * Owns a MediaStream scoped to the component that uses it.
 * The stream is never stored globally and all tracks stop on unmount.
 */
export function useCamera(opts: { deviceId: string | null; resolution: ResolutionPreset; enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(opts.deviceId);
  const [track, setTrack] = useState<{ width: number; height: number; label: string } | null>(null);
  const [nonce, setNonce] = useState(0);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;
    setStatus('starting');
    setError(null);
    (async () => {
      try {
        stop();
        const stream = await startCamera({ deviceId: activeDeviceId ?? undefined, facingMode: facing, resolution: opts.resolution });
        if (cancelled) return stopStream(stream);
        streamRef.current = stream;
        const t = stream.getVideoTracks()[0];
        const s = t?.getSettings();
        setTrack({ width: s?.width ?? 0, height: s?.height ?? 0, label: t?.label ?? 'Camera' });
        t?.addEventListener('ended', () => {
          if (!cancelled) {
            setStatus('error');
            setError(new CameraError('disconnected', 'The camera was disconnected. Reconnect it and press Retry.'));
          }
        });
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setStatus('live');
        listCameras().then((d) => !cancelled && setDevices(d));
      } catch (e) {
        if (cancelled) return;
        setError(mapCameraError(e));
        setStatus('error');
        listCameras().then((d) => !cancelled && setDevices(d)).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [opts.enabled, opts.resolution, activeDeviceId, facing, nonce, stop]);

  // React to cameras being plugged/unplugged.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => listCameras().then(setDevices);
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, []);

  const switchFacing = useCallback(() => {
    if (devices.length > 1) {
      const idx = devices.findIndex((d) => d.deviceId === activeDeviceId);
      setActiveDeviceId(devices[(idx + 1) % devices.length].deviceId);
    } else {
      setActiveDeviceId(null);
      setFacing((f) => (f === 'user' ? 'environment' : 'user'));
    }
  }, [devices, activeDeviceId]);

  return {
    videoRef,
    status,
    error,
    devices,
    track,
    activeDeviceId,
    selectDevice: setActiveDeviceId,
    switchFacing,
    retry: () => setNonce((n) => n + 1),
    stop,
  };
}
