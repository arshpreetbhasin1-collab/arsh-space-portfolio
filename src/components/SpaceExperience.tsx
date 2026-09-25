import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SceneManager, smooth } from '../lib/sceneManager';
import { SpaceCameraController } from '../lib/cameraController';
import { PlateLayer } from '../lib/plateLayer';
import { detectTier, FrameBudget, type QualityTier } from '../lib/performance';
import { FallbackStars } from '../lib/fallbackStars';
import { journeyBus } from '../lib/journeyBus';
import { JourneySections } from './JourneySections';
import { Navigation } from './Navigation';
import { LoadingScreen } from './LoadingScreen';
import { ProjectDialog } from './ProjectDialog';
import { ChatGuide } from './ChatGuide';
import { useReducedMotion } from '../hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);
// Mobile browser toolbars change the viewport height while scrolling; don't re-measure for that.
ScrollTrigger.config({ ignoreMobileResize: true });

export function SpaceExperience() {
  const plateRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flareRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [loadProgress, setLoadProgress] = useState(0.1);
  const [ready, setReady] = useState(false);
  const [openProject, setOpenProject] = useState<string | null>(null);

  useEffect(() => {
    const journey = journeyRef.current!;
    const sections = Array.from(journey.querySelectorAll<HTMLElement>('[data-scene]'));
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    let tier: QualityTier = detectTier();

    let cancelled = false;
    const manager = new SceneManager();
    const controller = new SpaceCameraController(manager);
    controller.reduced = reduced;
    const plates = new PlateLayer(plateRef.current!, manager, controller, { mobile, sequences: !reduced });

    // Real-time layer, with a 2D fallback if WebGL is unavailable or fails.
    let space: import('../three/SpaceCanvas').SpaceCanvas | null = null;
    let fallback: FallbackStars | null = null;
    const canvas = canvasRef.current!;
    const startFallback = () => {
      document.documentElement.classList.add('no-webgl');
      fallback = new FallbackStars(canvas);
      fallback.resize(window.innerWidth, window.innerHeight);
    };
    // Created after the first plate is up so WebGL start-up never delays the opening frame.
    const startSpace = () =>
      import('../three/SpaceCanvas')
        .then(({ SpaceCanvas }) => {
          if (cancelled) return;
          space = new SpaceCanvas(canvas, tier, mobile);
          space.resize(window.innerWidth, window.innerHeight);
          canvas.classList.add('is-live');
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            space?.dispose();
            space = null;
            startFallback();
          });
        })
        .catch(() => startFallback());

    // Smooth scrolling drives ScrollTrigger; ScrollTrigger drives one master timeline.
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.1, smoothWheel: !reduced, wheelMultiplier: 1 });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    journeyBus.lenis = lenis;

    let master: gsap.core.Timeline | null = null;
    let maxScroll = 1;

    const build = () => {
      master?.scrollTrigger?.kill();
      master?.kill();
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      manager.measure(sections, maxScroll);
      journeyBus.ranges = manager.ranges;

      master = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: journey, start: 'top top', end: 'bottom bottom', scrub: true },
      });
      // A spacer keeps the timeline exactly 1 unit long so positions map 1:1 to scroll progress.
      master.set({}, {}, 1);

      // Text choreography for every scene, positioned on the same master timeline.
      manager.ranges.forEach((r, i) => {
        const el = sections[i];
        const span = r.end - r.start;
        const at = (local: number) => Math.max(0, r.start + local * span);
        const items = el.querySelectorAll<HTMLElement>('[data-reveal]');
        const splitChars = el.querySelectorAll<HTMLElement>('[data-split] .split__char');
        const isHero = r.scene.id === 'earth';
        const isLast = i === manager.ranges.length - 1;
        if (!items.length && !splitChars.length) return;
        const d3 = reduced || mobile ? 0 : 1;
        const lift = reduced ? 0 : 1;
        if (isHero) {
          // Leaving Earth: the name stays with the planet. It shrinks back as Earth recedes while
          // each letter sinks, softens and fades in a quick wave from left to right.
          const title = el.querySelector<HTMLElement>('.hero__title');
          const chars = el.querySelectorAll<HTMLElement>('.hero__char');
          if (title) master!.fromTo(title, { scale: 1, y: 0 }, { scale: reduced ? 1 : 0.86, y: 30 * d3, transformOrigin: '0% 0%', duration: span * 0.24 }, at(0.04));
          master!.fromTo(
            chars,
            { autoAlpha: 1, y: 0, filter: 'blur(0px)' },
            { autoAlpha: 0, y: 26 * lift, filter: d3 ? 'blur(10px)' : 'blur(0px)', stagger: { each: span * 0.0045 }, duration: span * 0.1 },
            at(0.08),
          );
          master!.fromTo(items, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 14 * d3, duration: span * 0.08 }, at(0.05));
          return;
        }
        // Headlines rise letter by letter from behind a mask (with a slight 3D tilt on desktop).
        if (splitChars.length) {
          master!.fromTo(
            splitChars,
            { yPercent: 115, rotationX: -60 * d3, autoAlpha: 0, transformPerspective: 600, transformOrigin: '50% 100%' },
            { yPercent: 0, rotationX: 0, autoAlpha: 1, stagger: { each: span * 0.004 }, duration: span * 0.1 },
            at(0.07),
          );
          if (!isLast)
            master!.fromTo(
              splitChars,
              { yPercent: 0, autoAlpha: 1 },
              { yPercent: -110, autoAlpha: 0, stagger: { each: span * 0.002 }, duration: span * 0.08, immediateRender: false },
              at(0.82),
            );
        }
        // Content arrives out of depth (tilting up from below the camera) and leaves by
        // swinging past the viewer, so each stop reads as a place you fly through.
        const text = [...items].filter((el) => !el.classList.contains('project__visual'));
        const visual = el.querySelector<HTMLElement>('.project__visual');
        master!.fromTo(
          text,
          { autoAlpha: 0, y: (d3 ? 40 : 24) * lift, z: -180 * d3, rotationX: -32 * d3, transformPerspective: 1000, transformOrigin: '50% 100%' },
          { autoAlpha: 1, y: 0, z: 0, rotationX: 0, stagger: span * 0.022, duration: span * 0.16 },
          at(0.08),
        );
        if (visual)
          master!.fromTo(
            visual,
            { autoAlpha: 0, x: 160 * d3, y: (d3 ? 0 : 30) * lift, z: -700 * d3, rotationY: 42 * d3, transformPerspective: 1400 },
            { autoAlpha: 1, x: 0, y: 0, z: 0, rotationY: 0, duration: span * 0.22 },
            at(0.06),
          );
        if (!isLast) {
          // Explicit from-values keep exits identical when scrubbing backwards.
          master!.fromTo(
            text,
            { autoAlpha: 1, z: 0, y: 0, rotationX: 0 },
            { autoAlpha: 0, z: 220 * d3, y: -24 * lift, rotationX: 14 * d3, stagger: span * 0.008, duration: span * 0.12, immediateRender: false },
            at(0.8),
          );
          if (visual)
            master!.fromTo(
              visual,
              { autoAlpha: 1, x: 0, y: 0, z: 0, rotationY: 0 },
              { autoAlpha: 0, x: -120 * d3, y: -20 * (1 - d3) * lift, z: 420 * d3, rotationY: -28 * d3, duration: span * 0.14, immediateRender: false },
              at(0.8),
            );
        }
      });
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      space?.resize(w, h);
      fallback?.resize(w, h);
      plates.resize(w, h);
      ScrollTrigger.refresh();
      build();
    };

    const budget = new FrameBudget();
    let lastActive = -1;
    let lastAtmo = -1;
    let shipHold = 0;
    let lastFlare = -1;
    let tilt = 0;
    let lastTiltKey = '';
    let lastTime = performance.now();
    const tick = (time: number) => {
      lenis.raf(time * 1000);
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      // Visual progress comes straight from the (smoothed) scroll position, so re-measuring
      // or rebuilding the timeline can never make the scene jump.
      const p = Math.min(1, Math.max(0, (lenis.animatedScroll ?? window.scrollY) / maxScroll));
      const frame = manager.frame(p);
      const cam = controller.camera(p, dt);
      plates.update(p, frame.active);
      const localOfId = (id: string) => {
        const k = manager.ranges.findIndex((r) => r.scene.id === id);
        return k < 0 ? -9 : manager.localOf(k, p);
      };
      const sceneWeight = (id: string) => {
        const t = localOfId(id);
        return smooth(-0.25, 0.1, t) * (1 - smooth(0.9, 1.2, t));
      };
      const earthT = manager.localOf(0, p);
      const sunIdx = manager.ranges.findIndex((r) => r.scene.id === 'sun');
      const sunT = sunIdx >= 0 ? manager.localOf(sunIdx, p) : -1;
      const contactT = manager.localOf(manager.ranges.length - 1, p);
      const cur = manager.ranges[frame.active]?.scene;
      const hold = cur?.projectId || cur?.id === 'about' ? smooth(0.12, 0.3, frame.local) * (1 - smooth(0.78, 0.95, frame.local)) : 0;
      shipHold += (hold - shipHold) * Math.min(1, dt * 3);
      space?.render(cam, frame, dt, reduced, {
        launch: smooth(0.02, 0.55, earthT),
        hold: shipHold,
        land: smooth(-0.35, 0.55, contactT),
        pointerX: controller.pointer.x,
        pointerY: controller.pointer.y,
      }, {
        // Satellite pass: from the middle of the Earth scene to the end of the atmosphere.
        satellite: (() => {
          const a = manager.ranges[0], b = manager.ranges[1];
          if (!a || !b) return -1;
          const from = a.start + (a.end - a.start) * 0.35;
          return (p - from) / Math.max(1e-6, b.end - from);
        })(),
        rings: cur?.rings
          ? { ...cur.rings, weight: smooth(-0.05, 0.25, frame.local) * (1 - smooth(0.8, 1, frame.local)) }
          : { x: 0.5, y: 0.5, tilt: 1.2, weight: 0 },
      }, smooth(-0.3, 0.2, sunT) * (1 - smooth(0.95, 1.15, sunT)) * (0.75 + 0.25 * smooth(0.2, 0.9, sunT)), {
        deep: sceneWeight('neptune') * 0.35 + sceneWeight('deep-space'),
        comet: localOfId('deep-space') * 0.9 + 0.05,
        jupiter: sceneWeight('jupiter'),
        calmSky: cur?.projectId || cur?.id === 'about' ? 0 : 1,
      });
      fallback?.render(cam, frame);

      // 3D scroll (desktop): the reading layer pitches with scroll speed and turns toward the
      // pointer while the backdrop counter-rotates slightly. Phones skip it to stay smooth.
      if (!reduced && !mobile) {
        const v = Math.max(-1, Math.min(1, (lenis.velocity || 0) / 60));
        tilt += (v - tilt) * Math.min(1, dt * 5);
        const px = controller.pointer.x;
        const py = controller.pointer.y;
        const key = `${tilt.toFixed(3)}|${px.toFixed(3)}|${py.toFixed(3)}`;
        if (key !== lastTiltKey) {
          lastTiltKey = key;
          const root = document.documentElement.style;
          root.setProperty('--tilt', `${(tilt * 7).toFixed(2)}deg`);
          root.setProperty('--push', `${(Math.abs(tilt) * -90).toFixed(1)}px`);
          root.setProperty('--look', `${(px * 3.2).toFixed(2)}deg`);
          root.setProperty('--nod', `${(-py * 2.2).toFixed(2)}deg`);
        }
      }
      if (Math.abs(cam.flare - lastFlare) > 0.004) {
        lastFlare = cam.flare;
        flareRef.current!.style.opacity = cam.flare.toFixed(3);
        flareRef.current!.style.visibility = cam.flare > 0.002 ? 'visible' : 'hidden';
      }
      const atmoT = manager.localOf(1, p);
      const atmo = frame.active <= 2 ? Math.max(0, Math.min(1, 0.45 + atmoT * 1.4) * (1 - Math.max(0, Math.min(1, (atmoT - 0.55) / 0.6)))) : 0;
      if (Math.abs(atmo - lastAtmo) > 0.003) {
        lastAtmo = atmo;
        document.documentElement.style.setProperty('--atmo', atmo.toFixed(3));
        document.documentElement.classList.toggle('atmo-off', atmo < 0.002);
      }

      if (frame.active !== lastActive) {
        lastActive = frame.active;
        journeyBus.emit(frame.active);
      }
      journeyBus.progress = p;
      journeyBus.local = frame.local;

      if (budget.sample(dt * 1000) && tier !== 'low') {
        tier = tier === 'high' ? 'medium' : 'low';
        document.documentElement.dataset.tier = tier;
      }
    };

    const start = async () => {
      document.documentElement.dataset.tier = tier;
      onResize();
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      await Promise.all([
        plates.primeFirst((f) => !cancelled && setLoadProgress(0.25 + f * 0.6)),
        // Fonts are self-hosted and usually instant; never hold the journey hostage to them.
        Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1200))]),
      ]);
      if (cancelled) return;
      setLoadProgress(1);
      setReady(true);
      // Opening title: letters assemble in 3D as the loader clears.
      let intro: gsap.core.Tween | null = null;
      const endIntro = () => {
        intro?.progress(1);
        lenis.off('scroll', endIntro);
      };
      lenis.on('scroll', endIntro);
      if (!reduced && mobile)
        intro = gsap.fromTo('.hero__char', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.035, delay: 0.5 });
      else if (!reduced)
        intro = gsap.fromTo(
          '.hero__char',
          { rotationX: -95, z: -260, y: 60, autoAlpha: 0, transformPerspective: 700, transformOrigin: '50% 50% -30' },
          { rotationX: 0, z: 0, y: 0, autoAlpha: 1, duration: 1.4, ease: 'expo.out', stagger: 0.045, delay: 0.55 },
        );
      lenis.start();
      startSpace();
      // Honour deep links such as #contact once the journey is measured.
      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash) {
        const target = document.getElementById(hash);
        if (target) setTimeout(() => lenis.scrollTo(target, { immediate: true }), 50);
      }
    };
    start();

    let magnet: HTMLElement | null = null;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      // Magnetic buttons: the one under the cursor leans toward it.
      const hit = (e.target as HTMLElement).closest?.<HTMLElement>('.btn, .guide__launcher, .final__links a');
      if (magnet && magnet !== hit) {
        magnet.style.removeProperty('--mx');
        magnet.style.removeProperty('--my');
      }
      magnet = hit ?? null;
      if (magnet && !reduced) {
        const r = magnet.getBoundingClientRect();
        magnet.style.setProperty('--mx', `${((e.clientX - (r.left + r.width / 2)) * 0.22).toFixed(1)}px`);
        magnet.style.setProperty('--my', `${((e.clientY - (r.top + r.height / 2)) * 0.3).toFixed(1)}px`);
      }
      controller.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    };
    // Keyboard users: when focus lands in a scene, bring that scene to its readable middle.
    const onFocusIn = (e: FocusEvent) => {
      const section = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]');
      if (!section || section.id === 'earth') return;
      const i = sections.indexOf(section);
      const r = manager.ranges[i];
      if (!r) return;
      const local = manager.localOf(i, journeyBus.progress);
      if (local > 0.3 && local < 0.75) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      lenis.scrollTo((r.start + (r.end - r.start) * 0.5) * max, { immediate: reduced, duration: 1.2 });
    };
    // Re-measure when the viewport width changes (height-only changes come from mobile
    // browser toolbars and would make the journey jump).
    let lastW = window.innerWidth;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        if (coarse && window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        onResize();
      });
    });
    ro.observe(document.documentElement);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('focusin', onFocusIn);

    return () => {
      cancelled = true;
      gsap.ticker.remove(tick);
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('focusin', onFocusIn);
      master?.scrollTrigger?.kill();
      master?.kill();
      lenis.destroy();
      journeyBus.lenis = null;
      plates.dispose();
      (space as { dispose(): void } | null)?.dispose();
    };
  }, [reduced]);

  return (
    <>
      <LoadingScreen progress={loadProgress} done={ready} />
      <div className="stage" aria-hidden="true">
        <div className="stage__plates" ref={plateRef} />
        <div className="stage__atmo" />
        <canvas className="stage__canvas" ref={canvasRef} />
        <div className="stage__flare" ref={flareRef} />
        <div className="stage__vignette" />
      </div>
      <Navigation />
      <main id="journey" className="journey" ref={journeyRef}>
        <JourneySections onExplore={setOpenProject} />
      </main>
      <ProjectDialog projectId={openProject} onClose={() => setOpenProject(null)} />
      {ready && <ChatGuide />}
    </>
  );
}

