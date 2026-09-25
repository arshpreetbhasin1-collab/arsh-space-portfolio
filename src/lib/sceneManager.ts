import { scenes, type SceneDef } from '../scenes/journey';

// Maps global scroll progress (0..1) to per-scene state. Scene ranges come from the measured
// section offsets so layout, scroll and visuals always agree.

export interface SceneRange {
  scene: SceneDef;
  start: number;
  end: number;
}

export interface SceneFrame {
  progress: number;
  /** Index of the scene the camera is inside. */
  active: number;
  /** Local 0..1 progress within the active scene. */
  local: number;
  ranges: SceneRange[];
  /** Blended environment values. */
  stars: number;
  speed: number;
  tint: [number, number, number];
  particles: Record<string, number>;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class SceneManager {
  ranges: SceneRange[] = [];

  measure(sections: HTMLElement[], maxScroll: number) {
    this.ranges = scenes.map((scene, i) => {
      const el = sections[i];
      const top = el ? el.offsetTop : 0;
      const bottom = el ? el.offsetTop + el.offsetHeight - window.innerHeight : 0;
      return {
        scene,
        start: maxScroll > 0 ? clamp(top / maxScroll) : 0,
        end: maxScroll > 0 ? clamp(Math.max(bottom, top + 1) / maxScroll) : 1,
      };
    });
  }

  /** Local progress for scene i; may be <0 before it and >1 after it. */
  localOf(i: number, p: number) {
    const r = this.ranges[i];
    if (!r) return 0;
    return (p - r.start) / Math.max(1e-6, r.end - r.start);
  }

  frame(p: number): SceneFrame {
    const ranges = this.ranges;
    let active = 0;
    for (let i = 0; i < ranges.length; i++) if (p >= ranges[i].start) active = i;
    const local = clamp(this.localOf(active, p));

    // Blend environment toward the next scene over the last 30% of the current one.
    const cur = ranges[active]?.scene ?? scenes[0];
    const next = ranges[active + 1]?.scene ?? cur;
    const k = smooth(0.7, 1, local);
    const particles: Record<string, number> = { atmosphere: 0, asteroids: 0, rings: 0, embers: 0 };
    if (cur.particles !== 'none') particles[cur.particles] += 1 - k;
    if (next.particles !== 'none') particles[next.particles] += k;
    // Particle systems also fade in during the approach to their scene.
    if (next.particles !== 'none') particles[next.particles] = Math.max(particles[next.particles], smooth(0.55, 1, local));

    return {
      progress: p,
      active,
      local,
      ranges,
      stars: lerp(cur.stars, next.stars, k),
      speed: lerp(cur.speed, next.speed, k),
      tint: [lerp(cur.tint[0], next.tint[0], k), lerp(cur.tint[1], next.tint[1], k), lerp(cur.tint[2], next.tint[2], k)],
      particles,
    };
  }
}
