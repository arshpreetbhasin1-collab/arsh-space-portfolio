import { scenes } from '../scenes/journey';
import type { SceneManager } from './sceneManager';
import type { SpaceCameraController } from './cameraController';
import { SequencePlayer } from './sequencePlayer';
import { loadImage } from './assetLoader';
import sequenceManifest from '../data/sequences.json';
import { versioned } from './assetVersion';

// Backdrop layer: one plate per scene (a still, with a scrubbed clip on top where there is one).
// Only plates near the camera are loaded; far ones are released.

interface Plate {
  index: number;
  el: HTMLDivElement;
  img: HTMLImageElement;
  src: string;
  seq?: SequencePlayer;
  shade: HTMLDivElement;
  loaded: boolean;
  visible: boolean;
  last: string;
  seqMix: number;
}

const manifest = sequenceManifest as Record<string, { d: number; m: number }>;

export class PlateLayer {
  root: HTMLDivElement;
  private plates: Plate[] = [];
  private mobile: boolean;
  private useSequences: boolean;
  private manager: SceneManager;
  private controller: SpaceCameraController;

  constructor(root: HTMLDivElement, manager: SceneManager, controller: SpaceCameraController, opts: { mobile: boolean; sequences: boolean }) {
    this.root = root;
    this.manager = manager;
    this.controller = controller;
    this.mobile = opts.mobile;
    this.useSequences = opts.sequences;
    scenes.forEach((scene, index) => {
      if (!scene.plate) return;
      const el = document.createElement('div');
      el.className = `plate plate--${scene.id}`;
      // Phone assets are already cut to portrait around the planet, so they are centred as-is.
      const focus: [number, number] = this.mobile ? [50, 50] : scene.plate.focus;
      el.style.transformOrigin = `${focus[0]}% ${focus[1]}%`;
      el.style.setProperty('--focus', `${focus[0]}% ${focus[1]}%`);
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      // A failed image leaves the CSS gradient behind it instead of a broken icon.
      img.onerror = () => img.remove();
      el.appendChild(img);
      let seq: SequencePlayer | undefined;
      const entry = scene.sequence ? manifest[scene.id] : undefined;
      const frames = entry ? (this.mobile ? entry.m : entry.d) : 0;
      if (scene.sequence && frames > 0 && this.useSequences) {
        const dir = this.mobile ? `${scene.sequence.dir}/m` : scene.sequence.dir;
        seq = new SequencePlayer(dir, frames, scene.sequence.trim ?? [0, 1], focus);
        seq.onFirstFrame = () => el.classList.add(scene.plate!.stillFirst ? 'has-seq-mix' : 'has-seq');
        el.appendChild(seq.canvas);
      }
      // Exposure is done with an overlay rather than CSS filter: filters force a repaint of
      // the whole plate every frame, an opacity change on a sibling does not.
      const shade = document.createElement('div');
      shade.className = 'plate__shade';
      el.appendChild(shade);
      root.appendChild(el);
      this.plates.push({ index, el, img, shade, src: versioned(this.mobile ? scene.plate.mobileSrc : scene.plate.src), seq, loaded: false, visible: false, last: '', seqMix: -1 });
    });
  }

  /** Resolves once the first scene's plate is decoded (used by the loader). */
  async primeFirst(onProgress?: (f: number) => void) {
    const first = this.plates[0];
    if (!first) return;
    await loadImage(first.src);
    first.img.src = first.src;
    first.loaded = true;
    onProgress?.(0.6);
    if (first.seq) {
      first.seq.load();
      await new Promise<void>((r) => {
        const t = setTimeout(r, 2500);
        const prev = first.seq!.onFirstFrame;
        first.seq!.onFirstFrame = () => (prev?.(), clearTimeout(t), r());
      });
    }
    onProgress?.(1);
  }

  resize(w: number, h: number) {
    // Match screen density up to the frames' own width; beyond that it's cost without detail.
    const frameW = this.mobile ? 540 : 1600;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, frameW / w));
    for (const p of this.plates) p.seq?.resize(w, h, dpr);
  }

  update(progress: number, active: number) {
    for (const p of this.plates) {
      // Keep the current stop and two ahead ready; release anything well behind.
      const near = p.index >= active - 1 && p.index <= active + 2;
      if (near && !p.loaded) {
        p.loaded = true;
        p.img.src = p.src;
        p.seq?.load();
      } else if (!near && p.loaded && (p.index < active - 2 || p.index > active + 3)) {
        p.loaded = false;
        p.img.removeAttribute('src');
        p.seq?.unload();
        p.el.classList.remove('has-seq');
      }

      const t = this.manager.localOf(p.index, progress);
      const s = this.controller.plate(scenes[p.index], t);
      const visible = s.opacity > 0.002;
      if (visible !== p.visible) {
        p.visible = visible;
        p.el.style.visibility = visible ? 'visible' : 'hidden';
      }
      if (!visible) continue;
      const key = `${s.opacity.toFixed(3)}|${s.scale.toFixed(4)}|${s.brightness.toFixed(2)}`;
      if (key !== p.last) {
        p.last = key;
        p.el.style.opacity = String(s.opacity);
        p.el.style.transform = s.scale === 1 ? '' : `scale(${s.scale})`;
        const b = s.brightness;
        p.shade.style.opacity = b < 1 ? String(1 - b) : String(Math.min(1, (b - 1) * 1.4));
        p.shade.classList.toggle('is-glow', b > 1);
      }
      p.seq?.draw(s.seek);
      if (p.seq && scenes[p.index].plate?.stillFirst) {
        // Cross from the still to the footage over the first stretch of scroll.
        const k = Math.min(1, Math.max(0, (t - 0.03) / 0.15));
        if (Math.abs(k - p.seqMix) > 0.004) {
          p.seqMix = k;
          p.seq.canvas.style.opacity = k.toFixed(3);
        }
      }
    }
  }

  dispose() {
    for (const p of this.plates) p.seq?.unload();
    this.root.innerHTML = '';
  }
}
