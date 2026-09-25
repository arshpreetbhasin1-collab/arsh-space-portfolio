import type Lenis from 'lenis';
import type { SceneRange } from './sceneManager';

// Shared, non-React state for the running journey. UI components subscribe to scene changes
// instead of re-rendering on every scroll frame.

type Listener = (active: number) => void;

class JourneyBus {
  lenis: Lenis | null = null;
  ranges: SceneRange[] = [];
  progress = 0;
  local = 0;
  active = 0;
  private listeners = new Set<Listener>();

  on(fn: Listener) {
    this.listeners.add(fn);
    fn(this.active);
    return () => void this.listeners.delete(fn);
  }

  emit(active: number) {
    this.active = active;
    this.listeners.forEach((fn) => fn(active));
  }

  /** Scroll so scene `id` sits at its readable middle (or its start for `at: 'start'`). */
  goTo(id: string, at: 'start' | 'middle' = 'middle') {
    const r = this.ranges.find((x) => x.scene.id === id);
    if (!r) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const local = at === 'start' ? 0 : id === 'contact' ? 1 : 0.5;
    const y = (r.start + (r.end - r.start) * local) * max;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.lenis) this.lenis.scrollTo(y, { duration: reduced ? 0 : 2.4, immediate: reduced });
    else window.scrollTo(0, y);
  }
}

export const journeyBus = new JourneyBus();
