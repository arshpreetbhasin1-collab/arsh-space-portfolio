// Picks a quality tier once at startup from cheap signals, then lets the render loop
// step down if frame times stay high.

export type QualityTier = 'high' | 'medium' | 'low';

export function detectTier(): QualityTier {
  const w = window.innerWidth;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (w < 700 || mem <= 3 || cores <= 4) return 'low';
  if (coarse || w < 1100 || mem <= 6) return 'medium';
  return 'high';
}

/** Tracks a rolling frame-time average and reports sustained slowness. */
export class FrameBudget {
  private avg = 16;
  private slowFor = 0;
  sample(dtMs: number): boolean {
    this.avg += (Math.min(dtMs, 100) - this.avg) * 0.05;
    this.slowFor = this.avg > 26 ? this.slowFor + dtMs : 0;
    if (this.slowFor > 2500) {
      this.slowFor = 0;
      return true;
    }
    return false;
  }
}
