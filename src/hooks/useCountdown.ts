import { useCallback, useEffect, useRef, useState } from 'react';

/** Visible countdown that resolves a callback at zero. Cancel-safe. */
export function useCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setRemaining(null);
  }, []);

  const start = useCallback(
    (seconds: number, onDone: () => void) => {
      cancel();
      if (seconds <= 0) return onDone();
      setRemaining(seconds);
      let left = seconds;
      timer.current = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          cancel();
          onDone();
        } else setRemaining(left);
      }, 1000);
    },
    [cancel],
  );

  useEffect(() => cancel, [cancel]);
  return { remaining, start, cancel, running: remaining !== null };
}
