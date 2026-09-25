import { versioned } from './assetVersion';

// Scrubs a pre-rendered clip exported as numbered WebP frames.
// Frames are fetched as compressed blobs (small), and only a window around the playhead is
// decoded to ImageBitmaps off the main thread, so scrolling never waits on image decode and
// memory stays bounded. While a frame decodes, the nearest decoded one is shown.

const WINDOW = 10;
const MAX_BITMAPS = 28;

export class SequencePlayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private urls: string[];
  private blobs: (Blob | null)[];
  private bitmaps = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();
  private drawn = -1;
  private target = 0;
  private loading = false;
  private generation = 0;
  private focus: [number, number];
  onFirstFrame?: () => void;

  constructor(dir: string, count: number, trim: [number, number], focus: [number, number]) {
    this.urls = [];
    const from = Math.floor(trim[0] * (count - 1));
    const to = Math.ceil(trim[1] * (count - 1));
    for (let i = from; i <= to; i++) this.urls.push(versioned(`${dir}/${String(i).padStart(3, '0')}.webp`));
    this.blobs = new Array(this.urls.length).fill(null);
    this.focus = focus;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'plate__seq';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  get ready() {
    return this.bitmaps.size > 0;
  }

  /** Fetch every frame (compressed), first frame first, then evenly filling gaps. */
  async load() {
    if (this.loading) return;
    this.loading = true;
    const gen = ++this.generation;
    const n = this.urls.length;
    const order: number[] = [];
    const seen = new Set<number>();
    for (let step = n; step >= 1; step = Math.floor(step / 2)) {
      for (let i = 0; i < n; i += step) {
        if (seen.has(i)) continue;
        seen.add(i);
        order.push(i);
      }
      if (step === 1) break;
    }
    let cursor = 0;
    const worker = async () => {
      while (cursor < order.length && gen === this.generation) {
        const k = order[cursor++];
        try {
          const res = await fetch(this.urls[k]);
          if (!res.ok) continue;
          const blob = await res.blob();
          if (gen !== this.generation) return;
          this.blobs[k] = blob;
          if (Math.abs(k - this.target) <= WINDOW || this.bitmaps.size === 0) this.decode(k);
        } catch {
          /* a missing frame just falls back to its neighbours */
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  unload() {
    this.loading = false;
    this.generation++;
    this.blobs.fill(null);
    this.bitmaps.forEach((b) => b.close());
    this.bitmaps.clear();
    this.decoding.clear();
    this.drawn = -1;
  }

  private decode(k: number) {
    const blob = this.blobs[k];
    if (!blob || this.bitmaps.has(k) || this.decoding.has(k)) return;
    this.decoding.add(k);
    const gen = this.generation;
    createImageBitmap(blob)
      .then((bmp) => {
        this.decoding.delete(k);
        if (gen !== this.generation) return bmp.close();
        const first = this.bitmaps.size === 0;
        this.bitmaps.set(k, bmp);
        this.evict();
        if (first) this.onFirstFrame?.();
        if (Math.abs(k - this.target) < Math.abs(this.drawn - this.target)) this.drawn = -1;
      })
      .catch(() => this.decoding.delete(k));
  }

  private evict() {
    if (this.bitmaps.size <= MAX_BITMAPS) return;
    const far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - this.target) - Math.abs(a - this.target));
    for (const k of far.slice(0, this.bitmaps.size - MAX_BITMAPS)) {
      this.bitmaps.get(k)?.close();
      this.bitmaps.delete(k);
    }
  }

  resize(w: number, h: number, dpr: number) {
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.ctx.imageSmoothingQuality = 'high';
      this.drawn = -1;
    }
  }

  draw(seek: number) {
    const n = this.urls.length;
    const target = Math.round(Math.min(1, Math.max(0, seek)) * (n - 1));
    if (target !== this.target) {
      this.target = target;
      for (let d = 0; d <= WINDOW; d++) {
        this.decode(target + d);
        if (d) this.decode(target - d);
      }
    }
    if (!this.bitmaps.size) return;
    let k = -1;
    for (let d = 0; d < n; d++) {
      if (this.bitmaps.has(target - d)) { k = target - d; break; }
      if (this.bitmaps.has(target + d)) { k = target + d; break; }
    }
    if (k < 0 || k === this.drawn) return;
    const img = this.bitmaps.get(k)!;
    const { width: cw, height: ch } = this.canvas;
    const s = Math.max(cw / img.width, ch / img.height);
    const w = img.width * s;
    const h = img.height * s;
    this.ctx.drawImage(img, (cw - w) * (this.focus[0] / 100), (ch - h) * (this.focus[1] / 100), w, h);
    this.drawn = k;
  }
}
