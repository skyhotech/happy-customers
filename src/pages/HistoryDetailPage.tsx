import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import { ArrowLeft, Copy, Download, FileImage, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Skeleton, toast } from '@/components/common/ui';
import { db } from '@/db/database';
import { useObjectUrl } from '@/hooks/useAssets';
import { deleteRecord, reopenRecord } from '@/hooks/useHistory';
import { triggerBrowserDownload } from '@/services/downloadService';
import { formatBytes, formatDateTime } from '@/utils/dateUtils';

export default function HistoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const record = useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [id], null);
  const posterUrl = useObjectUrl(record?.generatedPosterBlob);
  const photoUrl = useObjectUrl(record?.originalPhotoBlob);
  const [confirm, setConfirm] = useState(false);

  if (record === null) return <Skeleton className="h-[70dvh]" />;
  if (!record) return <Card><EmptyState icon={<FileImage className="size-7" />} title="Record not found" description="It may have been deleted." action={<Button onClick={() => navigate('/history')}>Back to history</Button>} /></Card>;

  const canEdit = record.originalPhotoBlob.size > 0;
  const reopen = async (duplicate: boolean) => {
    try {
      await reopenRecord(record, duplicate);
      navigate(duplicate ? '/branches' : '/editor');
    } catch (e) {
      toast.error('Cannot open', e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div>
      <Link to="/history" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft className="size-4" /> History</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="grid place-items-center p-4">
          {posterUrl ? <motion.img initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} src={posterUrl} alt={`Poster for ${record.branchNameSnapshot}`} className="max-h-[78dvh] rounded-2xl shadow-2xl ring-1 ring-white/10" /> : <Skeleton className="h-[70dvh] w-full" />}
        </Card>
        <aside className="space-y-4">
          <Card className="space-y-3 p-5">
            <h1 className="text-xl font-extrabold text-white">{record.branchNameSnapshot}</h1>
            <p className="flex items-start gap-2 font-tamil text-sm text-slate-300"><MapPin className="mt-0.5 size-4 shrink-0 text-electric-300" />{record.branchAddressSnapshot}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-slate-500">Created</dt><dd className="text-slate-200">{formatDateTime(record.createdAt)}</dd>
              {record.updatedAt !== record.createdAt && (<><dt className="text-slate-500">Edited</dt><dd className="text-slate-200">{formatDateTime(record.updatedAt)}</dd></>)}
              <dt className="text-slate-500">Size</dt><dd className="text-slate-200">{record.imageWidth}×{record.imageHeight} · {formatBytes(record.generatedPosterBlob.size)}</dd>
              <dt className="text-slate-500">File</dt><dd className="break-all text-slate-200">{record.fileName}</dd>
              <dt className="text-slate-500">Mirror</dt><dd className="text-slate-200">{record.mirrorEnabled ? 'Mirrored' : 'Not mirrored'}</dd>
              <dt className="text-slate-500">Download</dt><dd><Badge tone={record.downloadStatus === 'failed' ? 'amber' : 'slate'}>{record.downloadStatus}</Badge></dd>
            </dl>
          </Card>
          <div className="grid gap-2">
            <Button variant="primary" size="lg" icon={<Download className="size-5" />} onClick={() => {
              const r = triggerBrowserDownload(record.generatedPosterBlob, record.fileName);
              if (r.status === 'downloaded') { toast.success('Download started', record.fileName); void db.sessions.update(record.id, { downloadStatus: 'downloaded' }); }
              else toast.error('Download blocked', r.error);
            }}>Download again</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button icon={<Pencil className="size-4" />} disabled={!canEdit} onClick={() => reopen(false)}>Edit poster</Button>
              <Button icon={<Copy className="size-4" />} disabled={!canEdit} onClick={() => reopen(true)}>Reuse photo</Button>
            </div>
            <Button variant="ghost" className="text-rose-300 hover:!bg-rose-500/15" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>Delete record</Button>
          </div>
          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold text-slate-400">Original photo</p>
            {photoUrl ? <img src={photoUrl} alt="Original customer photo" className="w-full rounded-xl" /> : <p className="text-xs text-slate-500">Original photo not stored (Image storage setting).</p>}
          </Card>
        </aside>
      </div>
      <ConfirmDialog open={confirm} title="Delete this record?" message="The customer photo and poster will be permanently deleted from this device." confirmLabel="Delete permanently" onCancel={() => setConfirm(false)} onConfirm={async () => { await deleteRecord(record.id); toast.success('Record deleted'); navigate('/history'); }} />
    </div>
  );
}
