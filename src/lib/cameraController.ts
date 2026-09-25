import type { SceneManager } from './sceneManager';
import { lerp, smooth } from './sceneManager';
import type { SceneDef } from '../scenes/journey';

// All camera movement lives here: the 3D camera's path through the starfield and the
// "virtual camera" moves applied to the cinematic plates. Both are pure functions of scroll
// progress (plus a small pointer offset), so scrubbing backwards retraces the same path.

export interface PlateState {
  opacity: number;
  scale: number;
  x: number; // vw
  y: number; // vh
  rotate: number; // deg
  brightness: number;
  /** 0..1 position used for scrubbing a pre-rendered sequence. */
  seek: number;
}

export interface CameraState {
  z: number;
  x: number;
  y: number;
  roll: number;
  /** Whiteout used at the Sun climax. */
  flare: number;
}

const HIDDEN: PlateState = { opacity: 0, scale: 1, x: 0, y: 0, rotate: 0, brightness: 1, seek: 0 };

export class SpaceCameraController {
  pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  reduced = false;
  private manager: SceneManager;

  constructor(manager: SceneManager) {
    this.manager = manager;
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
  }

  /** Distance travelled through the starfield: integral of each scene's speed. */
  travel(p: number) {
    let z = 0;
    for (const r of this.manager.ranges) {
      if (p <= r.start) break;
      const span = Math.min(p, r.end) - r.start;
      z += span * r.scene.speed;
      if (p < r.end) break;
    }
    // Warp bursts: a quick surge of forward travel around every scene boundary, which the
    // starfield turns into streaks, so crossing from one stop to the next feels like a jump.
    let warp = 0;
    for (let i = 1; i < this.manager.ranges.length; i++) {
      const b = this.manager.ranges[i].start;
      warp += smooth(b - 0.014, b + 0.014, p);
    }
    return z * 6000 + warp * 1400;
  }

  camera(p: number, dt: number): CameraState {
    const k = 1 - Math.pow(0.001, dt);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * k;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * k;
    const sway = this.reduced ? 0 : 1;
    const sunIdx = this.manager.ranges.findIndex((r) => r.scene.id === 'sun');
    const sunT = sunIdx >= 0 ? this.manager.localOf(sunIdx, p) : 0;
    return {
      z: -this.travel(p),
      x: this.pointer.x * 18 * sway,
      y: -this.pointer.y * 10 * sway,
      roll: Math.sin(p * Math.PI * 3) * 0.035 * sway,
      flare: smooth(0.72, 0.95, sunT) * (1 - smooth(1.02, 1.25, sunT)),
    };
  }

  /**
   * Every backdrop is full-bleed at 1:1 — no zoom, so footage stays as sharp as it was
   * rendered. Travel comes from the scrubbed footage itself and crossfades between scenes.
   */
  plate(scene: SceneDef, t: number): PlateState {
    const plate = scene.plate;
    if (!plate) return HIDDEN;
    const first = plate.motion === 'depart';
    // The next scene dissolves in on top; this one only fades once it is fully covered, so
    // there is never a dip to black between stops.
    const opacity = (first ? 1 : smooth(-0.3, 0.02, t)) * (1 - smooth(1.35, 1.6, t));
    const seek = first ? Math.min(1, Math.max(0, t / 1.25)) : Math.min(1, Math.max(0, (t + 0.3) / 1.6));
    if (plate.motion === 'engulf') {
      // The Sun is a still: a restrained push-in plus rising exposure carries the climax.
      const a = smooth(-0.3, 1, t);
      return { opacity, scale: 1 + a * 0.12 * (this.reduced ? 0 : 1), x: 0, y: 0, rotate: 0, brightness: lerp(0.9, 1.45, a), seek };
    }
    return { opacity, scale: 1, x: 0, y: 0, rotate: 0, brightness: plate.exposure ?? 1, seek };
  }
}
