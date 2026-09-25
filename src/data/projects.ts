// Projects shown along the route, in order. Screens in /public/projects are real captures.

export type ProjectTier = 'A' | 'B';

export interface ProjectShot {
  src: string;
  alt: string;
}

export interface Project {
  id: string;
  index: string;
  name: string;
  kicker: string;
  summary: string;
  notes: string[];
  stack: string[];
  tier: ProjectTier;
  status: string;
  liveUrl?: string;
  sourceUrl?: string;
  /** The live site allows being shown in an iframe. */
  embeddable: boolean;
  cover: ProjectShot;
  shots: ProjectShot[];
}

const GH = 'https://github.com/arshpreetbhasin1-collab';

export const projects: Project[] = [
  {
    id: 'paintx',
    index: '01',
    name: 'PaintX.ai',
    kicker: 'AI paint visualiser',
    summary:
      'Upload a photo of a house and preview paint colours on it before buying. Walls are detected automatically and repainted by an AI render, not a flat colour overlay.',
    notes: [
      'Two segmentation models (SAM2, SAM3) with a fallback pass that recovers wall area either one misses',
      'ID-based request deduplication that stopped React Strict Mode firing duplicate AI calls',
      'Pixel-level, luminance-preserving colour blend so shadows and texture survive the repaint',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'OpenCV.js', 'Replicate API', 'Sharp'],
    tier: 'A',
    status: '',
    liveUrl: 'https://colourvista.vercel.app',
    sourceUrl: `${GH}/colourvista`,
    embeddable: true,
    cover: { src: '/projects/paintx/showcase-1-after.webp', alt: 'PaintX.ai result: a house repainted in turquoise and yellow' },
    shots: [
      { src: '/projects/paintx/showcase-1-before.webp', alt: 'Original photo of an unpainted concrete house' },
      { src: '/projects/paintx/showcase-1-after.webp', alt: 'The same house repainted by PaintX.ai' },
      { src: '/projects/paintx/showcase-2-before.webp', alt: 'Second showcase photo, before' },
      { src: '/projects/paintx/showcase-2-after.webp', alt: 'Second showcase photo, after repaint' },
      { src: '/projects/paintx/desktop.webp', alt: 'PaintX.ai upload step: choose a photo of your house' },
    ],
  },
  {
    id: 'dayflow',
    index: '02',
    name: 'Dayflow',
    kicker: 'Workforce & HR system',
    summary:
      'Attendance, leave and payroll as one connected system, built for the Odoo × NMIT Bangalore Hackathon 2026. Every payslip number traces back to real attendance and leave records.',
    notes: [
      'Explainable payroll engine written as pure, deterministic functions',
      'Leave coverage risk computed per department before AI ever sees it',
      'An AI copilot that explains results but never calculates or approves anything',
      'Row Level Security in Postgres as the last line of defence',
    ],
    stack: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind CSS', 'shadcn/ui', 'Zod', 'Recharts', 'GSAP'],
    tier: 'A',
    status: 'Source code is private.',
    liveUrl: 'https://dayflow-mocha.vercel.app',
    embeddable: true,
    cover: { src: '/projects/dayflow/desktop.webp', alt: 'Dayflow landing: Your workday, connected' },
    shots: [
      { src: '/projects/dayflow/desktop.webp', alt: 'Dayflow hero' },
      { src: '/projects/dayflow/scroll-1.webp', alt: 'Work should not live in six different systems' },
      { src: '/projects/dayflow/scroll-3.webp', alt: 'Attendance section with live figures' },
      { src: '/projects/dayflow/mobile.webp', alt: 'Dayflow on a phone' },
    ],
  },
  {
    id: 'nothing-sus',
    index: '03',
    name: 'Nothing Sus',
    kicker: 'Live campus game platform',
    summary:
      'An Among Us–style social deduction game run as a live event for the ISA Student Chapter at Manipal University Jaipur, with separate player, host and projector views.',
    notes: [
      'A single game engine owns all state; clients only call it and render what it returns',
      'Realtime over Postgres LISTEN/NOTIFY fanned out to clients with Server-Sent Events',
      'Role and vote privacy enforced in the query layer, one Prisma transaction per action',
      'Separate 3D landing page with a React Three Fiber crewmate',
    ],
    stack: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Zod', 'GSAP', 'React Three Fiber'],
    tier: 'A',
    status: '',
    liveUrl: 'https://nothing-sus-engine.vercel.app',
    sourceUrl: `${GH}/among-us-event-platform`,
    embeddable: true,
    cover: { src: '/projects/nothing-sus/local-0.webp', alt: 'Nothing Sus landing page: ISA MUJ student chapter game room' },
    shots: [
      { src: '/projects/nothing-sus/local-0.webp', alt: 'Nothing Sus event landing with Enter Game Room' },
      { src: '/projects/nothing-sus-landing/local-0.webp', alt: 'Nothing Sus 3D intro title' },
      { src: '/projects/nothing-sus/desktop.webp', alt: 'Student account registration dialog' },
      { src: '/projects/nothing-sus/mobile.webp', alt: 'Nothing Sus on a phone' },
    ],
  },
  {
    id: 'codeforge',
    index: '04',
    name: 'CodeForge',
    kicker: 'Adaptive coding practice',
    summary:
      'A learning platform meant as a better alternative to LeetCode. Instead of pass/fail, it tracks mastery per skill, explains mistakes and picks what to practise next.',
    notes: [
      'Skill graph with prerequisites, unlocking and topological ordering as pure functions',
      'Mastery scoring that weighs difficulty, hints used and independence',
      'Sandboxed code execution with a judge that returns verdicts per test',
      'AI hints as a graded ladder that never skips to the answer',
    ],
    stack: ['Next.js', 'TypeScript', 'Supabase', 'Zod', 'Monaco', 'Vitest', 'Tailwind CSS'],
    tier: 'A',
    status: 'In progress, not deployed yet.',
    sourceUrl: `${GH}/codeforge`,
    embeddable: false,
    cover: { src: '/projects/codeforge/local-0.webp', alt: 'CodeForge landing: Don’t memorize code. Build the ability to solve.' },
    shots: [
      { src: '/projects/codeforge/local-0.webp', alt: 'CodeForge landing page, captured from a local run' },
      { src: '/projects/codeforge/local-1.webp', alt: 'CodeForge sign-in, captured from a local run' },
    ],
  },
  {
    id: 'mujattendx',
    index: '05',
    name: 'MUJAttendX',
    kicker: 'Attendance calculator',
    summary:
      'An unofficial attendance tool for Manipal University Jaipur students. It shows how many classes you must attend, or can safely miss, to stay above your target, per subject and overall.',
    notes: [
      'Manual mode runs entirely in the browser, with no account and nothing stored',
      'Optional connected mode that syncs attendance and timetable from the student portal',
    ],
    stack: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'NextAuth', 'Cheerio'],
    tier: 'B',
    status: 'Runs locally, not published yet.',
    embeddable: false,
    cover: { src: '/projects/attendx/local-0.webp', alt: 'MUJAttendX calculator, captured from a local run' },
    shots: [
      { src: '/projects/attendx/local-0.webp', alt: 'MUJAttendX calculator' },
      { src: '/projects/attendx/local-1.webp', alt: 'MUJAttendX sign-in' },
    ],
  },
  {
    id: 'word-blast',
    index: '06',
    name: 'Word Blast',
    kicker: 'Motion experiment',
    summary:
      'Type any word and watch it rendered live in eight animated treatments: bouncing letters, marquee, flip cards, typewriter, cloud, mosaic, pulse and orbit.',
    notes: ['Click-to-pop bursts, draggable letters, keyboard shortcuts and an autoplay mode'],
    stack: ['React', 'TypeScript', 'Vite', 'Motion'],
    tier: 'B',
    status: '',
    liveUrl: 'https://word-blast.vercel.app',
    sourceUrl: `${GH}/word-blast`,
    embeddable: true,
    cover: { src: '/projects/word-blast/desktop.webp', alt: 'Word Blast rendering HELLO' },
    shots: [
      { src: '/projects/word-blast/desktop.webp', alt: 'Word Blast rendering HELLO' },
      { src: '/projects/word-blast/mobile.webp', alt: 'Word Blast on a phone' },
    ],
  },
  {
    id: 'arsh-ai',
    index: '07',
    name: 'Arsh.ai',
    kicker: 'Bring-your-own-key AI app',
    summary:
      'A zero-dependency Node app: paste any API key and it identifies the provider, then enables chat, image, video and audio for it. A self-edit tab lets your own model rewrite the app safely.',
    notes: [
      'Key fingerprinting plus live probing across 18 providers',
      'Self-edit syntax-checks every file and keeps a one-click backup before writing',
    ],
    stack: ['Node.js', 'JavaScript'],
    tier: 'B',
    status: 'Runs locally, not published yet.',
    embeddable: false,
    cover: { src: '/projects/arsh-ai/local-0.webp', alt: 'Arsh.ai self-edit screen, captured from a local run' },
    shots: [{ src: '/projects/arsh-ai/local-0.webp', alt: 'Arsh.ai self-edit screen' }],
  },
];

export const projectById = (id: string) => projects.find((p) => p.id === id);
