import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

const COLORS = ['#4f9dff', '#8b6cff', '#ffffff', '#ffb547', '#ff6b8b', '#34d399'];

/** Subtle confetti burst + animated check. Skipped entirely with reduced motion. */
export function Celebration() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 520,
        y: -(Math.random() * 260 + 120),
        r: Math.random() * 540 - 270,
        c: COLORS[i % COLORS.length],
        d: Math.random() * 0.25,
        w: Math.random() * 6 + 5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none relative grid place-items-center" aria-hidden>
      {!reduce &&
        pieces.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-sm"
            style={{ width: p.w, height: p.w * 0.45, background: p.c }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: [0, p.y, p.y + 420], opacity: [1, 1, 0], rotate: p.r }}
            transition={{ duration: 1.8, delay: p.d, ease: 'easeOut' }}
          />
        ))}
      <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }} className="grid size-16 place-items-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
        <svg viewBox="0 0 24 24" className="size-9 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.15 }} />
        </svg>
      </motion.div>
    </div>
  );
}
