import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { useSettings } from '@/store/settingsStore';

export function Providers({ children }: { children: ReactNode }) {
  const motionPref = useSettings((s) => s.motion);
  const reducedMotion = motionPref === 'reduced' ? 'always' : motionPref === 'full' ? 'never' : 'user';
  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}
