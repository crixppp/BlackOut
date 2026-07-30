import { useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

export function useWakeLock(enabled: boolean, active: boolean): boolean {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const requestLock = async () => {
      if (!enabled || !active || document.visibilityState !== 'visible') {
        return;
      }
      const wakeLock = (navigator as Navigator & NavigatorWithWakeLock).wakeLock;
      if (!wakeLock) {
        return;
      }
      try {
        const lock = await wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        lockRef.current = lock;
        setLocked(true);
        lock.addEventListener('release', () => setLocked(false));
      } catch {
        setLocked(false);
      }
    };

    requestLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lockRef.current?.release().catch(() => undefined);
      lockRef.current = null;
      setLocked(false);
    };
  }, [active, enabled]);

  return locked;
}
