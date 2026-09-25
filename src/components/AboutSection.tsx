import { about, skills } from '../data/about';
import { SplitTitle } from './SplitTitle';

export function AboutSection() {
  return (
    <article className="about" aria-labelledby="about-title">
      <div className="about__intro">
        <SplitTitle className="about__title" id="about-title" text="About" />
        <p className="about__lead" data-reveal>
          {about.intro}
        </p>
        <p className="about__focus" data-reveal>
          {about.focus}
        </p>
        <dl className="about__facts" data-reveal>
          {about.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="about__skills" data-reveal>
        <h3 className="about__skills-title">What I work with</h3>
        {skills.map((s) => (
          <div className="skill-group" key={s.group}>
            <p className="skill-group__name">{s.group}</p>
            <ul>
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}
