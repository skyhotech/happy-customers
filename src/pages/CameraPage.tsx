import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Expand, FlipHorizontal2, ImageUp, RefreshCw, ShieldCheck, Shrink, SwitchCamera, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, IconButton, Segmented, Select, cx, toast } from '@/components/common/ui';
import { useCamera } from '@/hooks/useCamera';
import { useCountdown } from '@/hooks/useCountdown';
import { usePhotoCapture } from '@/hooks/usePhotoCapture';
import { RESOLUTIONS, type ResolutionPreset } from '@/services/cameraService';
import { useSession } from '@/store/sessionStore';
import { useSettings } from '@/store/settingsStore';
import { ACCEPTED_UPLOAD_EXT } from '@/utils/imageUtils';

export default function CameraPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [mirror, setMirror] = useState(settings.mirror);
  const [countdownSecs, setCountdownSecs] = useState<0 | 3 | 5 | 10>(settings.countdown);
  const [resolution, setResolution] = useState<ResolutionPreset>(settings.resolution);
  const [fullscreen, setFullscreen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [frozen, setFrozen] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cam = useCamera({ deviceId: settings.defaultCameraId, resolution, enabled: true });
  const countdown = useCountdown();
  const { capture, upload, busy } = usePhotoCapture();
  const existingPhoto = useSession((s) => s.photo);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      toast.info('Fullscreen is not available in this browser.');
    }
  };

  const doCapture = async () => {
    const video = cam.videoRef.current;
    if (!video) return;
    setFlash(true);
    try {
      await capture(video, mirror);
      const photo = useSession.getState().photo;
      if (photo) setFrozen(photo.url);
      cam.stop(); // release the camera as soon as we have the frame
      setTimeout(() => navigate('/review'), 650);
    } catch (e) {
      toast.error('Capture failed', e instanceof Error ? e.message : undefined);
    } finally {
      setTimeout(() => setFlash(false), 280);
    }
  };

  const onShutter = () => {
    if (countdown.running) return countdown.cancel();
    countdown.start(countdownSecs, doCapture);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      await upload(f);
      navigate('/review');
    } catch (e) {
      toast.error('Could not use this photo', e instanceof Error ? e.message : undefined);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Keyboard: Space/Enter = shutter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.key === 'Enter') && cam.status === 'live' && (e.target as HTMLElement)?.tagName !== 'SELECT' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        e.preventDefault();
        onShutter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const live = cam.status === 'live';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div ref={stageRef} className={cx('relative overflow-hidden rounded-[2rem] bg-black ring-1 ring-white/10', fullscreen ? 'grid place-items-center' : 'aspect-[3/4] sm:aspect-video')}>
        <motion.video
          ref={cam.videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Live camera preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: live ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="h-full w-full object-cover"
          style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
        />

        {frozen && <motion.img src={frozen} alt="Captured photo" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 h-full w-full object-cover" />}

        {cam.status === 'starting' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <span className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-electric-400" />
              <p className="text-sm">Starting camera… allow access if your browser asks.</p>
            </div>
          </div>
        )}

        {cam.status === 'error' && cam.error && (
          <div className="absolute inset-0 grid place-items-center bg-navy-950/90 p-6">
            <div className="max-w-md space-y-4 text-center">
              <AlertTriangle className="mx-auto size-10 text-amber-300" />
              <p className="font-semibold text-white">{cam.error.message}</p>
              {cam.error.kind === 'denied' && (
                <p className="text-xs text-slate-400">Chrome: click the camera icon in the address bar → Allow. Safari: Settings for this website → Camera → Allow. Then press Retry.</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {cam.error.kind !== 'unsupported' && cam.error.kind !== 'insecure' && <Button icon={<RefreshCw className="size-4" />} onClick={cam.retry}>Retry</Button>}
                <Button variant="primary" icon={<ImageUp className="size-4" />} onClick={() => fileRef.current?.click()}>Upload a photo instead</Button>
              </div>
            </div>
          </div>
        )}

        {/* Top controls */}
        {live && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-3">
            <Badge tone="green"><span className="size-2 animate-pulse rounded-full bg-emerald-400" /> Live{cam.track?.width ? ` · ${cam.track.width}×${cam.track.height}` : ''}</Badge>
            <div className="flex gap-2">
              <IconButton label={mirror ? 'Disable mirror' : 'Enable mirror'} size="sm" variant={mirror ? 'primary' : 'secondary'} icon={<FlipHorizontal2 className="size-4" />} onClick={() => setMirror((m) => !m)} />
              <IconButton label="Switch camera" size="sm" icon={<SwitchCamera className="size-4" />} onClick={cam.switchFacing} />
              <IconButton label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} size="sm" icon={fullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />} onClick={toggleFullscreen} />
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown.remaining !== null && (
            <motion.div key={countdown.remaining} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.35 }} className="absolute inset-0 grid place-items-center">
              <span className="text-[9rem] font-extrabold text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]">{countdown.remaining}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flash */}
        <AnimatePresence>{flash && <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} />}</AnimatePresence>

        {/* Shutter */}
        {live && !frozen && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/70 to-transparent pb-6 pt-14">
            <motion.button
              aria-label={countdown.running ? 'Cancel countdown' : 'Capture photo'}
              onClick={onShutter}
              disabled={busy}
              whileTap={{ scale: 0.9 }}
              className="relative grid size-20 place-items-center rounded-full"
            >
              <motion.span className="absolute inset-0 rounded-full border-4 border-white" animate={countdown.running ? { scale: [1, 1.12, 1], opacity: [1, 0.6, 1] } : {}} transition={{ duration: 1, repeat: Infinity }} />
              <span className={cx('size-16 rounded-full transition-colors', countdown.running ? 'bg-rose-500' : 'bg-white')}>
                {countdown.running && <X className="m-auto mt-4 size-8 text-white" />}
              </span>
            </motion.button>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="space-y-5 p-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><Timer className="size-4" /> Countdown</p>
            <Segmented label="Countdown" value={countdownSecs} onChange={(v) => setCountdownSecs(v)} options={[0, 3, 5, 10].map((v) => ({ value: v as 0 | 3 | 5 | 10, label: v === 0 ? 'Off' : `${v}s` }))} />
          </div>
          {cam.devices.length > 0 && (
            <Select label="Camera" value={cam.activeDeviceId ?? ''} onChange={(v) => cam.selectDevice(v || null)}>
              <option value="">Automatic</option>
              {cam.devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
            </Select>
          )}
          <Select label="Resolution (where supported)" value={resolution} onChange={(v) => setResolution(v as ResolutionPreset)}>
            {Object.entries(RESOLUTIONS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </Select>
          <Button className="w-full" icon={<ImageUp className="size-4" />} onClick={() => fileRef.current?.click()} loading={busy && !live}>Upload existing photo</Button>
          <input ref={fileRef} type="file" accept={['image/jpeg', 'image/png', 'image/webp', ...ACCEPTED_UPLOAD_EXT].join(',')} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {existingPhoto && <Button variant="ghost" className="w-full" onClick={() => navigate('/review')}>Back to current photo</Button>}
        </Card>
        <Card className="flex gap-3 p-4 text-xs leading-relaxed text-slate-400">
          <ShieldCheck className="size-5 shrink-0 text-emerald-300" />
          <p>
            <span className="font-semibold text-slate-200">Consent:</span> Ask the customer before taking their photo. It will be used for a SKY “Happy Customers” poster and kept only on this device's browser storage. It is never uploaded. Delete it any time in History.
          </p>
        </Card>
      </aside>
    </div>
  );
}
