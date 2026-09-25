// Skills are limited to things used in the projects on this site.

export const about = {
  intro:
    'I’m Arshpreet Singh Bhasin, a B.Tech Computer Science student at Manipal University Jaipur. I build full-stack web apps and creative frontends, and I care about both halves: the data model and API underneath, and how the interface feels to use.',
  focus: 'I’m most interested in AI-assisted development, multi-model orchestration and applied computer vision.',
  facts: [
    { label: 'Studying', value: 'B.Tech CSE, Manipal University Jaipur' },
    { label: 'Graduating', value: '2029' },
    { label: 'Focus', value: 'Full-stack & creative frontend' },
  ],
};

export const skills: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['TypeScript', 'JavaScript', 'Python', 'Java', 'SQL', 'HTML & CSS'] },
  { group: 'Frontend', items: ['React', 'Next.js (App Router)', 'Tailwind CSS', 'shadcn/ui', 'Motion', 'GSAP', 'Lenis', 'Three.js / React Three Fiber', 'Vite'] },
  { group: 'Backend & data', items: ['Node.js', 'Server Actions & Route Handlers', 'Supabase (Auth, RLS)', 'PostgreSQL', 'Prisma', 'Zod', 'NextAuth', 'Server-Sent Events'] },
  { group: 'AI & vision', items: ['Replicate API', 'OpenCV.js', 'SAM2 / SAM3 segmentation', 'Anthropic API', 'Multi-provider LLM APIs'] },
  { group: 'Tooling', items: ['Git & GitHub', 'Vercel', 'Vitest', 'ESLint / Oxlint'] },
];
