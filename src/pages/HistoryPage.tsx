import { AnimatePresence, motion } from 'motion/react';
import { CalendarRange, History as HistoryIcon, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, Segmented, Select, Skeleton, toast } from '@/components/common/ui';
import { HistoryCard } from '@/components/history/HistoryCard';
import { deleteRecord, reopenRecord, useHistoryList, type HistorySort } from '@/hooks/useHistory';
import { triggerBrowserDownload } from '@/services/downloadService';
import type { CustomerRecord } from '@/types';
import type { DateFilter } from '@/utils/dateUtils';

const PAGE = 24;

export default function HistoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [date, setDate] = useState<DateFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<HistorySort>('newest');
  const [limit, setLimit] = useState(PAGE);
  const [toDelete, setToDelete] = useState<CustomerRecord | null>(null);
  const data = useHistoryList({ search, date, from, to, sort, limit });

  const download = (r: CustomerRecord) => {
    const res = triggerBrowserDownload(r.generatedPosterBlob, r.fileName);
    if (res.status === 'downloaded') toast.success('Download started', r.fileName);
    else toast.error('Download blocked', res.error);
  };
  const edit = async (r: CustomerRecord) => {
    try {
      await reopenRecord(r, false);
      navigate('/editor');
    } catch (e) {
      toast.error('Cannot re-edit', e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div>
      <PageHeader title="Customer history" subtitle="Stored only in this browser on this device. Export a backup from Settings to keep a copy." actions={data && <span className="text-sm text-slate-400">{data.total} record{data.total === 1 ? '' : 's'}</span>} />

      <Card className="mb-6 space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} placeholder="Search by branch or address…" aria-label="Search history by branch" className="h-11 w-full rounded-xl bg-navy-800 pl-10 pr-3 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-400" />
          </div>
          <div className="overflow-x-auto">
            <Segmented label="Date filter" size="sm" value={date} onChange={(v: DateFilter) => { setDate(v); setLimit(PAGE); }} options={[{ value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: 'month', label: 'This month' }, { value: 'custom', label: 'Custom' }]} />
          </div>
          <Select value={sort} onChange={(v) => setSort(v as HistorySort)} className="lg:w-44">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="branch">Branch A–Z</option>
          </Select>
        </div>
        <AnimatePresence>
          {date === 'custom' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-wrap items-center gap-3 overflow-hidden">
              <CalendarRange className="size-4 text-slate-400" />
              <label className="text-xs text-slate-300">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 h-9 rounded-lg bg-navy-800 px-2 text-sm text-white ring-1 ring-white/10" /></label>
              <label className="text-xs text-slate-300">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 h-9 rounded-lg bg-navy-800 px-2 text-sm text-white ring-1 ring-white/10" /></label>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {!data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-[9/16]" />)}</div>
      ) : data.items.length === 0 ? (
        <Card><EmptyState icon={<HistoryIcon className="size-7" />} title={search || date !== 'all' ? 'No matching records' : 'No customer posters yet'} description={search || date !== 'all' ? 'Try another branch name or date range.' : 'Generated posters will appear here automatically.'} action={<Button variant="primary" onClick={() => navigate('/camera')}>New photo session</Button>} /></Card>
      ) : (
        <>
          <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <AnimatePresence mode="popLayout">
              {data.items.map((r, i) => <HistoryCard key={r.id} index={i} record={r} onDownload={() => download(r)} onEdit={() => edit(r)} onDelete={() => setToDelete(r)} />)}
            </AnimatePresence>
          </motion.div>
          {data.total > data.items.length && (
            <div className="mt-8 flex justify-center">
              <Button onClick={() => setLimit((l) => l + PAGE)}>Load more ({data.total - data.items.length} remaining)</Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this record?"
        message={<>This permanently deletes the customer photo and poster for <b>{toDelete?.branchNameSnapshot}</b> from this device. It cannot be undone.</>}
        confirmLabel="Delete permanently"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await deleteRecord(toDelete.id);
          setToDelete(null);
          toast.success('Record deleted');
        }}
      />
    </div>
  );
}
