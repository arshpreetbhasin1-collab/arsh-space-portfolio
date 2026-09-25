import { profile } from '../data/profile';
import { journeyBus } from '../lib/journeyBus';
import { SplitTitle } from './SplitTitle';

export function FinalSection() {
  return (
    <div className="final">
      <p className="final__name" data-reveal>
        {profile.name}
      </p>
      <SplitTitle className="final__title" text="Let’s build something." />
      <p className="final__statement" data-reveal>
        {profile.statement}
      </p>
      <ul className="final__links" data-reveal>
        {profile.links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target={l.href.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer">
              <span className="final__label">{l.label}</span>
              <span className="final__handle">{l.handle}</span>
              <span className="final__arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className="final__foot" data-reveal>
        <button type="button" onClick={() => journeyBus.goTo('earth', 'start')}>
          ↑ Fly back to Earth
        </button>
      </div>
    </div>
  );
}
