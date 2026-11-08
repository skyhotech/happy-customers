import { motion, useReducedMotion } from 'motion/react';
import { Camera, History, Home, LayoutTemplate, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useBlocker, useLocation } from 'react-router-dom';
import { ConfirmDialog, Toaster, cx } from '@/components/common/ui';
import { hasUnfinishedSession, useSession } from '@/store/sessionStore';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/camera', label: 'New Session', icon: Camera },
  { to: '/history', label: 'History', icon: History },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const FLOW = ['/camera', '/review', '/branches', '/editor'];
const STEPS = [
  { path: '/camera', label: 'Capture' },
  { path: '/review', label: 'Review' },
  { path: '/branches', label: 'Branch' },
  { path: '/editor', label: 'Poster' },
];
const isFlow = (p: string) => FLOW.includes(p);

function FlowStepper({ pathname }: { pathname: string }) {
  const idx = STEPS.findIndex((s) => s.path === pathname);
  if (idx < 0) return null;
  return (
    <ol className="mx-auto mb-5 flex max-w-xl items-center gap-2" aria-label="Session progress">
      {STEPS.map((s, i) => (
        <li key={s.path} className="flex flex-1 items-center gap-2">
          <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors', i < idx ? 'bg-electric-500 text-white' : i === idx ? 'bg-gradient-to-br from-electric-500 to-violet-500 text-white ring-4 ring-electric-500/20' : 'bg-white/8 text-slate-400')} aria-current={i === idx ? 'step' : undefined}>
            {i + 1}
          </span>
          <span className={cx('hidden text-xs font-semibold sm:block', i === idx ? 'text-white' : 'text-slate-500')}>{s.label}</span>
          {i < STEPS.length - 1 && <span className={cx('h-px flex-1', i < idx ? 'bg-electric-500' : 'bg-white/10')} />}
        </li>
      ))}
    </ol>
  );
}

function AmbientBackground() {
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-navy-950" aria-hidden>
      <motion.div
        className="absolute -left-40 -top-40 size-[38rem] rounded-full bg-electric-600/20 blur-3xl"
        animate={reduce ? undefined : { x: [0, 80, 0], y: [0, 40, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-48 -right-32 size-[34rem] rounded-full bg-violet-600/15 blur-3xl"
        animate={reduce ? undefined : { x: [0, -60, 0], y: [0, -50, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(79,157,255,0.08),transparent_60%)]" />
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const reset = useSession((s) => s.reset);

  // Warn before leaving the photo flow with an unfinished session.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isFlow(currentLocation.pathname) && !isFlow(nextLocation.pathname) && hasUnfinishedSession());

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnfinishedSession()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <div className="min-h-dvh text-slate-100">
      <AmbientBackground />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-navy-950">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-white/6 bg-navy-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-3">
            <img src="/assets/logos/sky-logo.jpg" alt="SKY Mobile & Electronics" className="size-10 rounded-full ring-2 ring-white/20" />
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-[0.14em] text-white">SKY HAPPY CUSTOMERS</span>
              <span className="block text-[11px] font-medium text-slate-400">Smart Photo Booth</span>
            </span>
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors', isActive || (to === '/camera' && isFlow(location.pathname)) ? 'text-white' : 'text-slate-400 hover:text-white')}>
                {({ isActive }) => (
                  <>
                    {(isActive || (to === '/camera' && isFlow(location.pathname))) && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-white/8 ring-1 ring-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <Icon className="relative size-4" />
                    <span className="relative">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">
        <FlowStepper pathname={location.pathname} />
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
          <Outlet />
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-navy-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Main">
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', isActive || (to === '/camera' && isFlow(location.pathname)) ? 'text-electric-300' : 'text-slate-500')}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard this photo session?"
        message="The customer photo has not been turned into a poster yet. Leaving now will discard it from this session."
        confirmLabel="Discard & leave"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          reset();
          blocker.proceed?.();
        }}
      />
      <Toaster />
    </div>
  );
}
