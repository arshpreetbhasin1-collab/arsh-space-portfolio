import * as THREE from 'three';

// The craft the visitor rides behind. Built from primitives (no model download): a lathed
// fuselage, swept wings, a dorsal fin and twin engines with glow and a particle exhaust.
// Seen from a chase camera, nose pointing away from the viewer (-z).

export interface ShipInput {
  dt: number;
  time: number;
  /** 0..1 smoothed travel speed. */
  speed: number;
  pointerX: number;
  pointerY: number;
  /** 0 at page load → 1 once it has flown out ahead of the camera. */
  launch: number;
  /** 1 while a project is being read: the ship eases aside and dims. */
  hold: number;
  /** 1 at the end: the ship comes in to land beside the closing headline. */
  land: number;
  narrow: boolean;
  reduced: boolean;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,214,160,0.9)');
  grad.addColorStop(0.45, 'rgba(255,150,70,0.35)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const scale0 = (narrow: boolean) => (narrow ? 0.85 : 0.9);

function buildPad() {
  const pad = new THREE.Group();
  const deck = new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.85, roughness: 0.38 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xf5b971 });
  pad.add(new THREE.Mesh(new THREE.CylinderGeometry(11, 12.6, 1.4, 72), deck));
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(12.62, 12.62, 0.35, 72, 1, true), trim);
  rim.position.y = 0.4;
  pad.add(rim);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.12, 8, 120), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.72;
  pad.add(ring);
  // Rim beacons that chase around the edge while the ship comes in.
  const beacons: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe3bd, transparent: true }));
    b.position.set(Math.cos(a) * 11.6, 0.8, Math.sin(a) * 11.6);
    pad.add(b);
    beacons.push(b);
  }
  return { pad, beacons };
}

export class Spaceship {
  readonly group = new THREE.Group();
  /** Landing pad for the final page; added to the scene alongside the ship. */
  readonly pad: THREE.Group;
  private beacons: THREE.Mesh[];
  private body = new THREE.Group();
  private glows: THREE.Sprite[] = [];
  private exhaust: THREE.Points;
  private exhaustData: { life: Float32Array; vel: Float32Array };
  private nozzles: THREE.Vector3[] = [];
  private cursor = 0;
  private roll = 0;
  private pitch = 0;
  private lastLaunch = -1;

  constructor() {
    const built = buildPad();
    this.pad = built.pad;
    this.beacons = built.beacons;
    this.pad.visible = false;
    const hull = new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.85, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.6, roughness: 0.45 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b1420, metalness: 1, roughness: 0.08, emissive: 0x0a1a2a, emissiveIntensity: 0.4 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf5b971, emissiveIntensity: 1.6 });

    // Fuselage: profile revolved around its axis, then laid along z (nose to -z).
    const profile = [
      [0, -13],
      [0.55, -12],
      [1.35, -9],
      [2.1, -5],
      [2.45, 0],
      [2.35, 5],
      [2.0, 8.5],
      [1.6, 10],
      [0, 10.2],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const fuselageGeo = new THREE.LatheGeometry(profile, 40);
    fuselageGeo.rotateX(-Math.PI / 2);
    fuselageGeo.scale(1, 0.72, 1);
    const fuselage = new THREE.Mesh(fuselageGeo, hull);
    this.body.add(fuselage);

    // Canopy.
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 16), glass);
    canopy.scale.set(0.85, 0.55, 2.4);
    canopy.position.set(0, 1.35, -4.2);
    this.body.add(canopy);

    // Swept wings.
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -3.5);
    wingShape.lineTo(11.5, 4.2);
    wingShape.lineTo(12.2, 6.4);
    wingShape.lineTo(9.8, 6.4);
    wingShape.lineTo(0, 5.2);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.35, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 2 });
    wingGeo.rotateX(Math.PI / 2);
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, hull);
      w.scale.x = side;
      w.position.set(side * 1.6, -0.2, 0);
      w.rotation.z = side * -0.06;
      this.body.add(w);
      // Thin accent strip along the trailing edge.
      const strip = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.08, 0.14), accent);
      strip.position.set(side * 6.6, -0.05, 6.2);
      strip.rotation.y = side * 0.06;
      this.body.add(strip);
    }

    // Dorsal fin.
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(5.4, 0);
    finShape.lineTo(6.2, 3.6);
    finShape.lineTo(4.6, 3.6);
    finShape.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.25, bevelEnabled: false }), dark);
    fin.rotation.y = -Math.PI / 2;
    fin.position.set(0.12, 1.2, 3.6);
    this.body.add(fin);

    // Engines.
    const engineGeo = new THREE.CylinderGeometry(1.05, 1.25, 6.5, 24, 1, true);
    engineGeo.rotateX(Math.PI / 2);
    const capGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.3, 24);
    capGeo.rotateX(Math.PI / 2);
    const glowTex = glowTexture();
    for (const side of [-1, 1]) {
      const pos = new THREE.Vector3(side * 3.6, -0.35, 7.6);
      const eng = new THREE.Mesh(engineGeo, dark);
      eng.position.copy(pos);
      this.body.add(eng);
      const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a8 }));
      cap.position.copy(pos).add(new THREE.Vector3(0, 0, 3.2));
      this.body.add(cap);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.position.copy(cap.position).add(new THREE.Vector3(0, 0, 0.6));
      glow.scale.setScalar(6);
      this.glows.push(glow);
      this.body.add(glow);
      this.nozzles.push(cap.position.clone().add(new THREE.Vector3(0, 0, 0.5)));
    }

    // Exhaust: short-lived particles streaming back toward the camera.
    const n = 260;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.exhaustData = { life: new Float32Array(n), vel: new Float32Array(n * 3) };
    this.exhaust = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uSize: { value: 26 * Math.min(window.devicePixelRatio || 1, 2) } },
        vertexShader: `attribute float alpha; varying float vA; uniform float uSize;
          void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * alpha * (60.0 / -mv.z); }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(1.0, 0.72 + 0.2 * vA, 0.45 + 0.4 * vA, a * vA * 0.8); }`,
      }),
    );
    this.exhaust.frustumCulled = false;
    this.body.add(this.exhaust);

    this.group.add(this.body);
    this.group.scale.setScalar(0.9);
  }

  update(i: ShipInput) {
    const { dt, time } = i;
    const calm = i.reduced ? 0 : 1;

    // Where the ship sits on screen: out ahead in travel, eased low and aside while reading.
    const base = i.narrow ? new THREE.Vector3(0, 13, -78) : new THREE.Vector3(0, -15, -72);
    const holdPos = i.narrow ? new THREE.Vector3(9, 44, -100) : new THREE.Vector3(-12, -27, -84);
    const landPos = i.narrow ? new THREE.Vector3(11, 40, -76) : new THREE.Vector3(36, 4, -64);
    const land = i.land * i.land * (3 - 2 * i.land);
    const target = base.clone().lerp(holdPos, i.hold * (1 - land)).lerp(landPos, land);
    target.z += i.speed * -10 * calm;
    // Landing: a swoop down from above, then a settle onto the pad with a faint hover.
    target.y += Math.sin(land * Math.PI) * 10 + (land > 0.97 ? Math.sin(time * 1.4) * 0.12 : 0);

    // Launch: rises past the viewer from the lower right, clear of the name, then settles into
    // its chase position. Driven directly by scroll so it retraces when scrolling back up.
    const l = Math.min(1, Math.max(0, i.launch));
    const le = 1 - Math.pow(1 - l, 3);
    const start = i.narrow ? new THREE.Vector3(10, -34, -12) : new THREE.Vector3(24, -26, -10);
    const arc = new THREE.Vector3(0, Math.sin(le * Math.PI) * 6, 0);
    const launchPos = start.clone().lerp(target, le).add(arc);

    const k = 1 - Math.pow(0.02, dt);
    const jump = Math.abs(i.launch - this.lastLaunch) > 0.5;
    this.lastLaunch = i.launch;
    if (l < 1 || jump) this.group.position.lerp(launchPos, jump ? 1 : Math.min(1, k * 3));
    else this.group.position.lerp(target, k);
    this.group.position.x += Math.sin(time * 0.45) * 0.6 * calm * dt * 4;
    this.group.position.y += Math.sin(time * 0.8) * 0.35 * calm * dt * 4;

    // The pad rises into place beneath the landing spot; beacons chase until touchdown.
    this.pad.visible = land > 0.02;
    if (this.pad.visible) {
      this.pad.position.set(landPos.x, landPos.y - 4.6 + (1 - land) * -34, landPos.z);
      this.pad.rotation.set(0.34, 0.2, 0);
      this.pad.scale.setScalar(scale0(i.narrow) * 1.05);
      const chase = (time * 6) % this.beacons.length;
      this.beacons.forEach((b, k) => {
        const d = Math.min(Math.abs(k - chase), this.beacons.length - Math.abs(k - chase));
        (b.material as THREE.MeshBasicMaterial).opacity = land > 0.97 ? 0.85 : Math.max(0.15, 1 - d * 0.35);
      });
    }

    // Banking follows the pointer with a slow sway; during launch it banks into the climb.
    const rollTarget = (-i.pointerX * 0.45 + Math.sin(time * 0.35) * 0.08) * calm + (1 - le) * -0.6;
    const pitchTarget = (i.pointerY * 0.12 - i.speed * 0.06) * calm + (1 - le) * 0.25;
    this.roll += (rollTarget - this.roll) * k;
    this.pitch += (pitchTarget - this.pitch) * k;
    // On landing it turns three-quarters toward the viewer so the whole craft is visible.
    this.body.rotation.set((0.12 + this.pitch) * (1 - land) + land * 0.34, -i.pointerX * 0.18 * calm * (1 - land) + land * 0.75, this.roll * (1 - land));

    // Hidden on the very first screen; it fades in as it passes the lens.
    const vRaw = Math.min(1, Math.max(0, (l - 0.01) / 0.14));
    const visible = vRaw * vRaw * (3 - 2 * vRaw);
    this.setOpacity(visible);
    const scale = (i.narrow ? 0.85 : 0.9) * (1 - i.hold * (1 - land) * (i.narrow ? 0.4 : 0.25)) * (1 + land * 0.15);
    this.group.scale.setScalar(scale);
    this.group.visible = visible > 0.01;

    const power = (0.55 + i.speed * 0.9) * (1 - land * 0.8);
    const flicker = 1 + Math.sin(time * 38) * 0.04 * calm;
    for (const g of this.glows) {
      g.scale.setScalar((5 + power * 5) * flicker * (i.narrow ? 0.32 : 1));
      (g.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.55 + power * 0.5) * visible;
    }

    // Exhaust particles.
    const pos = this.exhaust.geometry.attributes.position as THREE.BufferAttribute;
    const alpha = this.exhaust.geometry.attributes.alpha as THREE.BufferAttribute;
    const { life, vel } = this.exhaustData;
    const n = life.length;
    const spawn = i.reduced ? 0 : Math.floor(120 * dt * (1 + i.speed * 3) * (1 - land * 0.85));
    for (let s = 0; s < spawn; s++) {
      const p = this.cursor++ % n;
      const nz = this.nozzles[p % 2];
      pos.setXYZ(p, nz.x + (Math.random() - 0.5) * 0.9, nz.y + (Math.random() - 0.5) * 0.9, nz.z);
      vel[p * 3] = (Math.random() - 0.5) * 1.2;
      vel[p * 3 + 1] = (Math.random() - 0.5) * 1.2;
      vel[p * 3 + 2] = 22 + Math.random() * 14 + i.speed * 40;
      life[p] = 1;
    }
    for (let p = 0; p < n; p++) {
      if (life[p] <= 0) {
        alpha.setX(p, 0);
        continue;
      }
      life[p] -= dt * 2.4;
      pos.setXYZ(p, pos.getX(p) + vel[p * 3] * dt, pos.getY(p) + vel[p * 3 + 1] * dt, pos.getZ(p) + vel[p * 3 + 2] * dt);
      alpha.setX(p, Math.max(0, life[p]) * visible);
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
  }

  private materials: THREE.Material[] | null = null;
  private opacity = -1;
  private setOpacity(o: number) {
    if (Math.abs(o - this.opacity) < 0.002) return;
    this.opacity = o;
    if (!this.materials) {
      this.materials = [];
      this.body.traverse((obj) => {
        const m = (obj as THREE.Mesh).material as THREE.Material | undefined;
        if (m && obj !== this.exhaust && !(obj instanceof THREE.Sprite)) this.materials!.push(m);
      });
    }
    const solid = o > 0.995;
    for (const m of this.materials) {
      m.transparent = !solid;
      m.opacity = o;
      m.depthWrite = solid;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose();
    });
  }
}
