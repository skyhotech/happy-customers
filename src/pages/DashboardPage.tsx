import { motion } from 'motion/react';
import { ArrowRight, Camera, Download, HardDrive, History, ImageIcon, LayoutTemplate, Settings, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card, EmptyState, Skeleton } from '@/components/common/ui';
import { CameraStatus } from '@/components/camera/CameraStatus';
import { useDashboardStats, useStorageInfo } from '@/hooks/useHistory';
import { useObjectUrl } from '@/hooks/useAssets';
import { useTemplates } from '@/hooks/useTemplates';
import { triggerBrowserDownload } from '@/services/downloadService';
import { useSession } from '@/store/sessionStore';
import type { CustomerRecord } from '@/types';
import { formatBytes, formatDateTime } from '@/utils/dateUtils';
import { toast } from '@/components/common/ui';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

function Stat({ label, value, icon }: { label: string; value: number | undefined; icon: React.ReactNode }) {
  return (
    <motion.div variants={item}>
      <Card className="flex items-center gap-4 p-5">
        <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-electric-500/25 to-violet-500/25 text-electric-200">{icon}</div>
        <div>
          {value === undefined ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-extrabold tabular-nums text-white">{value}</p>}
          <p className="text-xs font-medium text-slate-400">{label}</p>
        </div>
      </Card>
    </motion.div>
  );
}

function RecentThumb({ r }: { r: CustomerRecord }) {
  const url = useObjectUrl(r.thumbnailBlob);
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-navy-800 ring-1 ring-white/8" style={{ aspectRatio: '9 / 14' }}>
      <Link to={`/history/${r.id}`} aria-label={`Open ${r.branchNameSnapshot}`}>
        {url ? <img src={url} alt="" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" /> : <div className="skeleton h-full w-full" />}
      </Link>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-navy-950/95 to-transparent p-2 pt-8">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">{r.branchNameSnapshot}</p>
          <p className="text-[10px] text-slate-400">{formatDateTime(r.createdAt)}</p>
        </div>
        <button
          aria-label="Quick re-download"
          title="Download again"
          onClick={() => {
            const res = triggerBrowserDownload(r.generatedPosterBlob, r.fileName);
            if (res.status === 'downloaded') toast.success('Download started', r.fileName);
            else toast.error('Download blocked', res.error);
          }}
          className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/15 text-white backdrop-blur hover:bg-electric-500"
        >
          <Download className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const stats = useDashboardStats();
  const storage = useStorageInfo();
  const { readyTemplates, selectable, loading } = useTemplates();
  const reset = useSession((s) => s.reset);
  const navigate = useNavigate();

  const start = () => {
    reset();
    navigate('/camera');
  };

  const tiles = [
    { to: '/camera', label: 'New Photo Session', desc: 'Capture a customer selfie', icon: Camera, onClick: start },
    { to: '/history', label: 'Customer History', desc: 'Search & re-download', icon: History },
    { to: '/templates', label: 'Branch Templates', desc: `${readyTemplates.length} ready posters`, icon: LayoutTemplate },
    { to: '/settings', label: 'Settings', desc: 'Camera, export & backup', icon: Settings },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.section variants={item} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-6 ring-1 ring-white/10 sm:p-10">
        <motion.div aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-gradient-to-br from-electric-500/30 to-violet-500/30 blur-3xl" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <img src="/assets/logos/sky-logo.jpg" alt="SKY Mobile & Electronics logo" className="size-20 rounded-full ring-4 ring-white/15 sm:size-24" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-electric-300">SKY Mobile & Electronics</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">SKY HAPPY CUSTOMERS</h1>
              <p className="mt-1 text-lg font-medium text-slate-300">Smart Photo Booth</p>
            </div>
          </div>
          <motion.button
            onClick={start}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-electric-500 to-violet-500 px-8 py-5 text-lg font-extrabold tracking-wide text-white shadow-xl shadow-electric-600/30 sm:w-auto"
          >
            <Camera className="size-6" />
            START NEW PHOTO SESSION
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-2">
          <CameraStatus />
          {!loading && <Badge tone="blue"><Sparkles className="size-3.5" /> {selectable.length} branches available</Badge>}
          {storage?.supported && (
            <Badge tone={storage.quota && storage.usage / storage.quota > 0.8 ? 'amber' : 'slate'}>
              <HardDrive className="size-3.5" /> {formatBytes(storage.usage)} used of {formatBytes(storage.quota)}
              {storage.persisted ? ' · persistent' : ''}
            </Badge>
          )}
        </div>
      </motion.section>

      <motion.section variants={container} className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Statistics">
        <Stat label="Total customer sessions" value={stats?.total} icon={<ImageIcon className="size-5" />} />
        <Stat label="Photos generated today" value={stats?.today} icon={<Sparkles className="size-5" />} />
        <Stat label="Generated this month" value={stats?.month} icon={<History className="size-5" />} />
        <Stat label="Verified templates" value={loading ? undefined : readyTemplates.length} icon={<LayoutTemplate className="size-5" />} />
      </motion.section>

      <motion.section variants={container} className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Quick actions">
        {tiles.map(({ to, label, desc, icon: Icon, onClick }) => (
          <motion.div key={to} variants={item} whileHover={{ y: -4 }}>
            <Link to={to} onClick={(e) => { if (onClick) { e.preventDefault(); onClick(); } }} className="group flex h-full flex-col gap-3 rounded-3xl bg-navy-900/70 p-5 ring-1 ring-white/8 transition-colors hover:ring-electric-400/50">
              <Icon className="size-7 text-electric-300 transition-transform group-hover:scale-110" />
              <div>
                <p className="font-bold text-white">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.section>

      <motion.section variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent customer photographs</h2>
          <Link to="/history" className="text-sm font-semibold text-electric-300 hover:text-electric-200">View all →</Link>
        </div>
        {!stats ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[9/14]" />)}</div>
        ) : stats.recent.length === 0 ? (
          <Card><EmptyState icon={<Camera className="size-7" />} title="No customer photos yet" description="Start a new photo session to create your first Happy Customer poster. Everything stays on this device." /></Card>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{stats.recent.map((r) => <RecentThumb key={r.id} r={r} />)}</div>
        )}
      </motion.section>
    </motion.div>
  );
}
