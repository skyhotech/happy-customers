import { motion } from 'motion/react';
import { Check, MapPin, Phone, Star } from 'lucide-react';
import type { Branch, PosterTemplate } from '@/types';
import { cx } from '@/components/common/ui';

export function BranchCard({ branch, template, selected, isDefault, onSelect }: { branch: Branch; template?: PosterTemplate; selected: boolean; isDefault?: boolean; onSelect: () => void }) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cx('group relative flex w-full gap-4 rounded-3xl bg-navy-900/80 p-3 text-left ring-1 transition-colors', selected ? 'ring-transparent' : 'ring-white/8 hover:ring-white/20')}
    >
      {selected && <motion.span layoutId="branch-selected" className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-electric-400 shadow-[0_0_0_4px_rgba(79,157,255,0.15)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <div className="relative w-20 shrink-0 overflow-hidden rounded-2xl bg-navy-800 sm:w-24" style={{ aspectRatio: '9 / 16' }}>
        {template && <img src={template.thumbnailPath} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold leading-snug text-white">{branch.branchName}</h3>
          {selected ? (
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-electric-500 text-white"><Check className="size-4" /></span>
          ) : isDefault ? (
            <Star className="size-4 shrink-0 fill-amber-300 text-amber-300" aria-label="Default branch" />
          ) : null}
        </div>
        <p className="mt-1 flex items-start gap-1.5 font-tamil text-[13px] leading-relaxed text-slate-300">
          <MapPin className="mt-1 size-3.5 shrink-0 text-electric-300" />
          <span>{branch.displayAddressLines.map((l, i) => <span key={i} className="block">{l}</span>)}</span>
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><Phone className="size-3.5" />{branch.phone}</p>
      </div>
    </motion.button>
  );
}
