import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { create } from 'zustand';
import { forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------- Button ----------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'xl';
const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-electric-500 to-violet-500 text-white shadow-lg shadow-electric-500/25 hover:brightness-110',
  secondary: 'bg-white/8 text-white ring-1 ring-white/15 hover:bg-white/14',
  ghost: 'text-slate-200 hover:bg-white/8',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500',
  success: 'bg-emerald-500 text-white hover:bg-emerald-400',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2 rounded-2xl',
  xl: 'h-16 px-8 text-lg gap-3 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, ...rest }: ButtonProps & { label: string }) {
  return <Button aria-label={label} title={label} className={cx('!px-0 aspect-square', className)} {...rest} />;
}

// ---------------- Card / Badge / Skeleton ----------------
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-3xl bg-navy-900/70 ring-1 ring-white/8 backdrop-blur-sm', className)} {...rest}>
      {children}
    </div>
  );
}

const badgeTones = {
  blue: 'bg-electric-500/15 text-electric-200 ring-electric-400/30',
  green: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30',
  amber: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
  red: 'bg-rose-500/15 text-rose-200 ring-rose-400/30',
  slate: 'bg-white/8 text-slate-300 ring-white/15',
  violet: 'bg-violet-500/15 text-violet-200 ring-violet-400/30',
};
export function Badge({ tone = 'slate', children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1', badgeTones[tone], className)}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton rounded-2xl', className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-electric-500/20 to-violet-500/20 text-electric-200 ring-1 ring-white/10">{icon}</div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {description && <p className="mt-1 max-w-md text-sm text-slate-400">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-electric-300">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------- Form controls ----------------
export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-center justify-between gap-4 py-2', disabled && 'opacity-50')}>
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {description && <span className="block text-xs text-slate-400">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-electric-500' : 'bg-white/15')}
      >
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={cx('absolute top-1 size-5 rounded-full bg-white shadow', checked ? 'right-1' : 'left-1')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label?: string; size?: 'sm' | 'md' }) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-white/6 p-1 ring-1 ring-white/10">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx('relative rounded-lg font-semibold transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', active ? 'text-white' : 'text-slate-400 hover:text-white')}
          >
            {active && <motion.span layoutId={`seg-${group}`} className="absolute inset-0 rounded-lg bg-electric-500/80" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-semibold text-slate-300">{label}</label>
        <span className="tabular-nums text-slate-400">{format ? format(value) : value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="sky-range w-full" />
    </div>
  );
}

export function Select({ label, value, onChange, children, className }: { label?: string; value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('space-y-1.5', className)}>
      {label && <label htmlFor={id} className="block text-xs font-semibold text-slate-300">{label}</label>}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl bg-navy-800 px-3 text-sm text-white ring-1 ring-white/12 focus:outline-none focus:ring-2 focus:ring-electric-400">
        {children}
      </select>
    </div>
  );
}

// ---------------- Modal / Confirm ----------------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cx('relative max-h-[90dvh] w-full overflow-auto rounded-3xl bg-navy-900 p-6 shadow-2xl ring-1 ring-white/10', wide ? 'max-w-3xl' : 'max-w-md')}
          >
            {title && (
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel, requireText,
}: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; tone?: 'danger' | 'primary'; onConfirm: () => void; onCancel: () => void; requireText?: string }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <ConfirmBody message={message} confirmLabel={confirmLabel} tone={tone} onConfirm={onConfirm} onCancel={onCancel} requireText={requireText} />
    </Modal>
  );
}

function ConfirmBody({ message, confirmLabel, tone, onConfirm, onCancel, requireText }: { message: ReactNode; confirmLabel: string; tone: 'danger' | 'primary'; onConfirm: () => void; onCancel: () => void; requireText?: string }) {
  const [text, setText] = useState('');
  const ok = !requireText || text.trim().toUpperCase() === requireText.toUpperCase();
  return (
    <div className="space-y-5">
      <div className="text-sm leading-relaxed text-slate-300">{message}</div>
      {requireText && (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Type ${requireText} to confirm`}
          className="h-11 w-full rounded-xl bg-navy-800 px-3 text-sm text-white ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={!ok} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  );
}
// ---------------- Toasts ----------------
type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; tone: ToastTone; title: string; description?: string }
interface ToastStore { toasts: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; dismiss: (id: number) => void }
let toastSeq = 0;
export const useToasts = create<ToastStore>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.tone === 'error' ? 7000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
export const toast = {
  success: (title: string, description?: string) => useToasts.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) => useToasts.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) => useToasts.getState().push({ tone: 'info', title, description }),
  warning: (title: string, description?: string) => useToasts.getState().push({ tone: 'warning', title, description }),
};

const toastIcon: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-emerald-300" />,
  error: <XCircle className="size-5 text-rose-300" />,
  info: <Info className="size-5 text-electric-300" />,
  warning: <AlertTriangle className="size-5 text-amber-300" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-navy-800/95 p-4 shadow-xl ring-1 ring-white/12 backdrop-blur"
            role="status"
          >
            {toastIcon[t.tone]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-500 hover:text-white">
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
