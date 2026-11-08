import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Camera, MapPinOff, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BranchCard } from '@/components/branches/BranchCard';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Skeleton, cx, toast } from '@/components/common/ui';
import { useTemplates } from '@/hooks/useTemplates';
import { resolveTemplatesForBranch, searchBranches } from '@/services/templateResolver';
import { useSession } from '@/store/sessionStore';
import { useSettings } from '@/store/settingsStore';
import type { Branch, PosterTemplate } from '@/types';

export default function BranchSelectionPage() {
  const navigate = useNavigate();
  const { photo, branchId, selectBranch } = useSession();
  const defaultBranchId = useSettings((s) => s.defaultBranchId);
  const { selectable, templates, branches, loading } = useTemplates();
  const [query, setQuery] = useState('');
  const [chooser, setChooser] = useState<{ branch: Branch; options: PosterTemplate[] } | null>(null);

  const results = useMemo(() => {
    const r = searchBranches(query, selectable);
    if (query || !defaultBranchId) return r;
    return [...r.filter((b) => b.id === defaultBranchId), ...r.filter((b) => b.id !== defaultBranchId)];
  }, [query, selectable, defaultBranchId]);

  if (!photo) {
    return <Card><EmptyState icon={<Camera className="size-7" />} title="Take the customer photo first" description="The branch poster is generated around the customer photo." action={<Button variant="primary" onClick={() => navigate('/camera')}>Open camera</Button>} /></Card>;
  }

  const choose = (b: Branch) => {
    const options = resolveTemplatesForBranch(b.id, templates, branches);
    if (options.length === 0) {
      toast.warning('No verified poster for this branch', 'Ask an administrator to verify a template in Branch Templates.');
      return;
    }
    if (options.length > 1) return setChooser({ branch: b, options });
    selectBranch(b.id, options[0].id);
    navigate('/editor');
  };

  return (
    <div>
      <PageHeader eyebrow="Step 3" title="Select the SKY branch" subtitle="The verified poster for that branch loads automatically. Addresses are shown exactly as printed on the poster." actions={<Badge tone="blue">{selectable.length} verified branches</Badge>} />
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search branch, town, street, Tamil address or phone…"
          aria-label="Search branches"
          className="h-14 w-full rounded-2xl bg-navy-900/80 pl-12 pr-12 text-base text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-400"
        />
        {query && <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-white"><X className="size-5" /></button>}
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : results.length === 0 ? (
        <Card><EmptyState icon={<MapPinOff className="size-7" />} title="No matching branch" description={selectable.length ? 'Try a town name such as “Vellore” or a street fragment.' : 'No verified branch templates are available. Verify templates in Branch Templates.'} /></Card>
      ) : (
        <motion.div layout className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {results.map((b) => (
              <BranchCard key={b.id} branch={b} template={templates.find((t) => t.id === b.templateIds[0])} selected={branchId === b.id} isDefault={b.id === defaultBranchId} onSelect={() => choose(b)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {branchId && (
        <div className="sticky bottom-24 mt-6 flex justify-end md:bottom-6">
          <Button size="lg" variant="primary" onClick={() => navigate('/editor')}>Continue to poster <ArrowRight className="size-5" /></Button>
        </div>
      )}

      <Modal open={!!chooser} onClose={() => setChooser(null)} title={chooser ? `Choose a poster – ${chooser.branch.branchName}` : ''} wide>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {chooser?.options.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                selectBranch(chooser.branch.id, t.id);
                setChooser(null);
                navigate('/editor');
              }}
              className={cx('overflow-hidden rounded-2xl ring-1 ring-white/10 transition hover:ring-electric-400')}
            >
              <img src={t.thumbnailPath} alt={t.name} className="w-full" style={{ aspectRatio: `${t.width}/${t.height}` }} />
              <p className="p-2 text-left text-xs font-semibold text-slate-300">{t.name}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
