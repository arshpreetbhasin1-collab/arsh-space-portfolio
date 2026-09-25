import { useEffect, useState } from 'react';

export function LoadingScreen({ progress, done }: { progress: number; done: boolean }) {
  const [phase, setPhase] = useState<'loading' | 'arrive' | 'gone'>('loading');
  useEffect(() => {
    if (!done) return;
    const a = setTimeout(() => setPhase('arrive'), 350);
    const b = setTimeout(() => setPhase('gone'), 1900);
    return () => (clearTimeout(a), clearTimeout(b));
  }, [done]);
  if (phase === 'gone') return null;
  return (
    <div className={`loader loader--${phase}`} role="status" aria-live="polite">
      <div className="loader__inner mono">
        <p className="loader__line">{phase === 'loading' ? 'Initializing journey' : 'Earth'}</p>
        <div className="loader__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className="loader__pct" aria-hidden="true">
          {String(Math.round(progress * 100)).padStart(3, '0')}
        </p>
      </div>
    </div>
  );
}
