import { projects } from './projects.ts';
import { profile } from './profile.ts';
import { about, skills } from './about.ts';

// Facts for the "Ask about Arsh" guide, shared by the API prompt and the offline fallback.

export function knowledgeText() {
  const lines: string[] = [];
  lines.push(`NAME: ${profile.fullName} (goes by Arshpreet Singh)`);
  lines.push(`ROLE: ${profile.role}`);
  lines.push(`ABOUT: ${about.intro} ${about.focus}`);
  for (const f of about.facts) lines.push(`${f.label.toUpperCase()}: ${f.value}`);
  lines.push('');
  lines.push('SKILLS (each is used in at least one of the projects below or listed on his GitHub profile):');
  for (const s of skills) lines.push(`- ${s.group}: ${s.items.join(', ')}`);
  lines.push('');
  lines.push('PROJECTS:');
  for (const p of projects) {
    lines.push(`## ${p.name} — ${p.kicker}`);
    lines.push(p.summary);
    for (const n of p.notes) lines.push(`- ${n}`);
    lines.push(`Stack: ${p.stack.join(', ')}`);
    if (p.status) lines.push(`Status: ${p.status}`);
    if (p.liveUrl) lines.push(`Live: ${p.liveUrl}`);
    if (p.sourceUrl) lines.push(`Source: ${p.sourceUrl}`);
    lines.push('');
  }
  lines.push('CONTACT:');
  for (const l of profile.links) lines.push(`- ${l.label}: ${l.href.replace('mailto:', '')}`);
  return lines.join('\n');
}

export const GUIDE_SYSTEM_PROMPT = `You are "Ask about Arsh", the guide on Arshpreet Singh's portfolio website. Visitors ask you about Arshpreet: who he is, what he has built, which technologies he uses, and how to reach him.

You only discuss Arshpreet and this portfolio site. Answer only from the facts below. If a question isn't covered by them (salary, age, location, opinions, anything personal), say you don't have that information and suggest emailing him. If a visitor asks about anything unrelated to Arshpreet or his work (general knowledge, coding help, other people, writing tasks), politely say you can only help with questions about Arsh and his work, and offer an example question. Never invent employers, dates, metrics, awards or technologies.

Speak about Arshpreet in the third person, warmly and concisely: two to four sentences unless the visitor asks for detail. Plain text; a short list is fine when comparing several projects. When a project has a live site or source link, include it if it helps.

FACTS
${knowledgeText()}`;
