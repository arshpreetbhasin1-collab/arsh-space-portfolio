import { projects } from '../data/projects';
import { profile } from '../data/profile';
import { about, skills } from '../data/about';

// Keyword-based answers used when /api/chat isn't available. Only repeats site data.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.+#\s-]/g, ' ');
const has = (q: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(q));

const contact = () => {
  const email = profile.links.find((l) => l.label === 'Email')?.handle;
  const gh = profile.links.find((l) => l.label === 'GitHub')?.href;
  const li = profile.links.find((l) => l.label === 'LinkedIn')?.href;
  return `The best way to reach Arshpreet is email: ${email}. His code is on GitHub (${gh}) and he's on LinkedIn (${li}).`;
};

function projectAnswer(p: (typeof projects)[number]) {
  const links = [p.liveUrl && `Live: ${p.liveUrl}`, p.sourceUrl && `Source: ${p.sourceUrl}`].filter(Boolean).join(' · ');
  return `${p.name} (${p.kicker.toLowerCase()}): ${p.summary} Built with ${p.stack.join(', ')}.${p.status ? ` ${p.status}` : ''}${links ? `\n${links}` : ''}`;
}

export function localAnswer(question: string): string {
  const q = norm(question);

  const named = projects.find((p) => q.includes(p.name.toLowerCase().replace(/\.ai$/, '')) || q.includes(p.id.replace('-', ' ')));
  if (named) return projectAnswer(named);

  if (has(q, ['contact', 'email', 'mail', 'hire', 'reach', 'linkedin', 'github', 'connect', 'talk'])) return contact();

  if (has(q, ['stud', 'college', 'universit', 'degree', 'education', 'b.tech', 'btech', 'graduat', 'manipal'])) {
    return `Arshpreet is studying ${about.facts[0].value}, graduating in ${about.facts[1].value}.`;
  }

  // A specific technology: which projects use it?
  const allTech = new Set([...skills.flatMap((s) => s.items), ...projects.flatMap((p) => p.stack)]);
  const tech = [...allTech].find((t) => {
    const key = t.toLowerCase().split(/[ (/]/)[0];
    return key.length > 2 && new RegExp(`\\b${key.replace(/[.+]/g, '\\$&')}\\b`).test(q);
  });
  if (tech) {
    const key = tech.toLowerCase().split(/[ (/]/)[0];
    const used = projects.filter((p) => p.stack.some((s) => s.toLowerCase().includes(key)));
    return used.length
      ? `Yes — Arshpreet works with ${tech}. It's used in ${used.map((p) => p.name).join(', ')}.`
      : `${tech} is part of Arshpreet's toolkit.`;
  }

  if (has(q, ['skill', 'tech', 'stack', 'language', 'know', 'tool', 'framework', 'expert', 'good at'])) {
    return `Arshpreet's toolkit:\n${skills.map((s) => `• ${s.group}: ${s.items.join(', ')}`).join('\n')}`;
  }

  if (has(q, ['project', 'built', 'build', 'work', 'portfolio', 'made', 'ship', 'app'])) {
    return `Arshpreet has ${projects.length} projects on this site:\n${projects.map((p) => `• ${p.name} — ${p.kicker}`).join('\n')}\nAsk about any of them for details.`;
  }

  if (has(q, ['ai', 'machine', 'vision', 'llm', 'model'])) {
    const ai = projects.filter((p) => /ai|replicate|opencv|sam|llm|anthropic/i.test(p.summary + p.stack.join(' ') + p.notes.join(' ')));
    return `${about.focus} On this site that shows up in ${ai.map((p) => p.name).join(', ')}.`;
  }

  if (has(q, ['who', 'about', 'yourself', 'himself', 'introduc', 'tell me', 'arshpreet'])) return `${about.intro} ${about.focus}`;

  const email = profile.links.find((l) => l.label === 'Email')?.handle;
  return `I can only help with questions about Arsh and his work, and I don't have that information. You can ask him directly at ${email}, or try "What has he built?"`;
}
