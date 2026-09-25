import type { CameraState } from './cameraController';

// 2D starfield used when WebGL is unavailable, so the page never falls back to flat black.

export class FallbackStars {
  private ctx: CanvasRenderingContext2D | null;
  private stars: { x: number; y: number; z: number; r: number }[] = [];
  private w = 0;
  private h = 0;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    for (let i = 0; i < 700; i++) this.stars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), r: Math.random() });
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  render(cam: CameraState, env: { stars: number }) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    const travel = -cam.z / 2400;
    for (const s of this.stars) {
      const z = 1 - ((s.z + travel) % 1);
      const k = 0.35 / Math.max(0.05, z);
      const x = this.w / 2 + s.x * this.w * k * 0.5;
      const y = this.h / 2 + s.y * this.h * k * 0.5;
      if (x < 0 || y < 0 || x > this.w || y > this.h) continue;
      ctx.globalAlpha = Math.min(1, (1 - z) * 1.4) * (0.35 + env.stars * 0.65);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, 0.6 + s.r * (1 - z) * 1.8, 0.6 + s.r * (1 - z) * 1.8);
    }
    ctx.globalAlpha = 1;
  }
}
