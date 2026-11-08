import { motion } from 'motion/react';
import { Download, Eye, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CustomerRecord } from '@/types';
import { useObjectUrl } from '@/hooks/useAssets';
import { formatDateTime } from '@/utils/dateUtils';
import { Badge, IconButton } from '@/components/common/ui';

export function HistoryCard({ record, onDownload, onEdit, onDelete, index = 0 }: { record: CustomerRecord; onDownload: () => void; onEdit: () => void; onDelete: () => void; index?: number }) {
  const thumb = useObjectUrl(record.thumbnailBlob);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 12) * 0.03 } }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="group overflow-hidden rounded-3xl bg-navy-900/80 ring-1 ring-white/8"
    >
      <Link to={`/history/${record.id}`} className="block overflow-hidden bg-navy-800" style={{ aspectRatio: '9 / 14' }} aria-label={`View poster for ${record.branchNameSnapshot}`}>
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" /> : <div className="skeleton h-full w-full" />}
      </Link>
      <div className="space-y-2 p-3">
        <div>
          <h3 className="truncate text-sm font-bold text-white" title={record.branchNameSnapshot}>{record.branchNameSnapshot}</h3>
          <p className="line-clamp-1 font-tamil text-xs text-slate-400" title={record.branchAddressSnapshot}>{record.branchAddressSnapshot}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(record.createdAt)}</p>
        </div>
        <div className="flex items-center justify-between">
          {record.downloadStatus === 'failed' ? <Badge tone="amber">Not downloaded</Badge> : <span />}
          <div className="flex gap-1">
            <Link to={`/history/${record.id}`} aria-label="View" title="View" className="grid size-9 place-items-center rounded-xl text-slate-200 hover:bg-white/10"><Eye className="size-4" /></Link>
            <IconButton label="Download again" size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={onDownload} />
            <IconButton label="Re-edit" size="sm" variant="ghost" icon={<Pencil className="size-4" />} onClick={onEdit} disabled={record.originalPhotoBlob.size === 0} />
            <IconButton label="Delete" size="sm" variant="ghost" className="hover:!bg-rose-500/20 hover:text-rose-200" icon={<Trash2 className="size-4" />} onClick={onDelete} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
