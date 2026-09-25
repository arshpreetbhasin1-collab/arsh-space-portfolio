// The journey: one ordered list of scenes. Each scene owns a stretch of the page (its section
// height) and describes how the environment looks while the camera passes through it.
// Everything that moves is derived from the global scroll progress via these definitions.

export type PlateMotion =
  /** Starts filling the frame and recedes (leaving Earth). */
  | 'depart'
  /** Approaches from distance, holds, then slides past the camera. */
  | 'flyby'
  /** Barely moves; a backdrop you drift through. */
  | 'drift'
  /** Keeps growing until it overwhelms the frame (the Sun). */
  | 'engulf';

export type Particles = 'none' | 'atmosphere' | 'asteroids' | 'rings' | 'embers';

export interface SceneDef {
  id: string;
  label: string;
  /** Section height in viewport heights; sets how long the camera lingers. */
  length: number;
  plate?: {
    src: string;
    mobileSrc: string;
    motion: PlateMotion;
    /** Point in the image the camera is travelling toward (CSS percentages). */
    focus: [number, number];
    /** Direction the body slides as it passes: -1 left, 1 right. */
    exitSide?: -1 | 1;
    /** Brightness multiplier at hold. */
    exposure?: number;
    /** Show the still (sharper) until scrolling starts, then hand over to the footage. */
    stillFirst?: boolean;
  };
  /** Pre-rendered clip scrubbed as an image sequence; `trim` picks the part of it to use. */
  sequence?: { dir: string; trim?: [number, number] };
  stars: number;
  particles: Particles;
  /** Relative travel speed through the starfield. */
  speed: number;
  tint: [number, number, number];
  projectId?: string;
  /** Faint 3D orbit rings around the planet: its screen position (0..1) and ring tilt. */
  rings?: { x: number; y: number; tilt: number };
  /** Short line shown for travel-only scenes. */
  caption?: string;
  inProgress?: boolean;
}

export const scenes: SceneDef[] = [
  {
    id: 'earth',
    label: 'Earth',
    length: 2.2,
    plate: { src: '/plates/earth.webp', mobileSrc: '/plates/m/earth.webp', motion: 'depart', focus: [55, 80], stillFirst: true },
    sequence: { dir: '/seq/earth', trim: [0, 0.42] },
    stars: 0.25,
    particles: 'none',
    speed: 0.3,
    tint: [0.05, 0.12, 0.25],
  },
  {
    id: 'atmosphere',
    label: 'Atmosphere',
    length: 1.3,
    stars: 0.6,
    particles: 'atmosphere',
    speed: 1.6,
    tint: [0.03, 0.08, 0.18],
    caption: 'Leaving the atmosphere',
  },
  {
    id: 'about',
    label: 'About',
    length: 2.4,
    plate: { src: '/plates/orbit.webp', mobileSrc: '/plates/m/orbit.webp', motion: 'drift', focus: [70, 85], exposure: 0.45 },
    stars: 0.9,
    particles: 'none',
    speed: 0.5,
    tint: [0.02, 0.05, 0.1],
  },
  {
    id: 'orbit',
    label: 'Low orbit',
    length: 2.6,
    plate: { src: '/plates/orbit.webp', mobileSrc: '/plates/m/orbit.webp', motion: 'drift', focus: [70, 85], exposure: 0.55 },
    stars: 0.85,
    particles: 'none',
    speed: 0.5,
    tint: [0.02, 0.04, 0.09],
    projectId: 'paintx',
  },
  {
    id: 'moon',
    label: 'Moon',
    length: 2.6,
    plate: { src: '/plates/moon.webp', mobileSrc: '/plates/m/moon.webp', motion: 'flyby', focus: [70, 50], exitSide: 1 },
    sequence: { dir: '/seq/moon' },
    stars: 0.5,
    particles: 'none',
    speed: 0.6,
    tint: [0.02, 0.02, 0.02],
    projectId: 'dayflow',
  },
  {
    id: 'mercury',
    rings: { x: 0.64, y: 0.58, tilt: 1.2 },
    label: 'Mercury',
    length: 1.9,
    plate: { src: '/plates/mercury.webp', mobileSrc: '/plates/m/mercury.webp', motion: 'flyby', focus: [70, 48], exitSide: 1 },
    sequence: { dir: '/seq/mercury' },
    stars: 0.7,
    particles: 'none',
    speed: 0.8,
    tint: [0.03, 0.03, 0.03],
    projectId: 'mujattendx',
  },
  {
    id: 'venus',
    rings: { x: 0.62, y: 0.6, tilt: 1.28 },
    label: 'Venus',
    length: 1.9,
    plate: { src: '/plates/venus.webp', mobileSrc: '/plates/m/venus.webp', motion: 'flyby', focus: [62, 50], exitSide: 1 },
    sequence: { dir: '/seq/venus' },
    stars: 0.6,
    particles: 'none',
    speed: 0.8,
    tint: [0.1, 0.07, 0.03],
    projectId: 'word-blast',
  },
  {
    id: 'mars',
    label: 'Mars',
    length: 2.6,
    plate: { src: '/plates/mars.webp', mobileSrc: '/plates/m/mars.webp', motion: 'flyby', focus: [66, 45], exitSide: 1 },
    sequence: { dir: '/seq/mars' },
    stars: 0.7,
    particles: 'none',
    speed: 1,
    tint: [0.12, 0.05, 0.02],
    projectId: 'nothing-sus',
  },
  {
    id: 'jupiter',
    label: 'Jupiter',
    length: 2.8,
    plate: { src: '/plates/jupiter.webp', mobileSrc: '/plates/m/jupiter.webp', motion: 'flyby', focus: [62, 55], exitSide: 1 },
    sequence: { dir: '/seq/jupiter' },
    stars: 0.55,
    particles: 'none',
    speed: 0.7,
    tint: [0.1, 0.07, 0.04],
    projectId: 'codeforge',
    inProgress: true,
  },
  {
    id: 'saturn',
    label: 'Saturn',
    length: 2.8,
    plate: { src: '/plates/saturn.webp', mobileSrc: '/plates/m/saturn.webp', motion: 'flyby', focus: [60, 45], exitSide: 1 },
    sequence: { dir: '/seq/saturn' },
    stars: 0.6,
    particles: 'rings',
    speed: 0.9,
    tint: [0.08, 0.07, 0.05],
    projectId: 'arsh-ai',
  },
  {
    id: 'uranus',
    rings: { x: 0.66, y: 0.55, tilt: 1.1 },
    label: 'Uranus',
    length: 1.9,
    plate: { src: '/plates/uranus.webp', mobileSrc: '/plates/m/uranus.webp', motion: 'flyby', focus: [68, 50], exitSide: 1 },
    sequence: { dir: '/seq/uranus', trim: [0, 0.75] },
    stars: 0.5,
    particles: 'none',
    speed: 0.7,
    tint: [0.02, 0.06, 0.07],
  },
  {
    id: 'neptune',
    rings: { x: 0.55, y: 0.56, tilt: 1.24 },
    label: 'Neptune',
    length: 1.6,
    plate: { src: '/plates/neptune.webp', mobileSrc: '/plates/m/neptune.webp', motion: 'flyby', focus: [66, 50], exitSide: 1, exposure: 0.9 },
    sequence: { dir: '/seq/neptune' },
    stars: 0.4,
    particles: 'none',
    speed: 0.6,
    tint: [0.01, 0.03, 0.08],
    caption: '4.5 billion kilometres from home',
  },
  {
    id: 'deep-space',
    label: 'Deep space',
    length: 2,
    plate: { src: '/plates/deep.webp', mobileSrc: '/plates/m/deep.webp', motion: 'drift', focus: [50, 50], exposure: 0.8 },
    sequence: { dir: '/seq/deep-space' },
    stars: 1,
    particles: 'none',
    speed: 0.35,
    tint: [0.02, 0.02, 0.05],
    caption: '',
  },
  {
    id: 'sun',
    label: 'Sun',
    length: 2.6,
    plate: { src: '/plates/sun.webp', mobileSrc: '/plates/m/sun.webp', motion: 'engulf', focus: [50, 70] },
    stars: 0.3,
    particles: 'embers',
    speed: 1.2,
    tint: [0.35, 0.15, 0.02],
  },
  {
    id: 'contact',
    label: 'Contact',
    length: 1.9,
    // Full circle: home is back on the horizon when the ship lands.
    plate: { src: '/plates/orbit.webp', mobileSrc: '/plates/m/orbit.webp', motion: 'drift', focus: [50, 90], exposure: 0.32 },
    stars: 0.35,
    particles: 'none',
    speed: 0.15,
    tint: [0, 0, 0],
  },
];

export const sceneIndex = (id: string) => scenes.findIndex((s) => s.id === id);
