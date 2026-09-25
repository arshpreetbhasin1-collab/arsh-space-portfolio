import { useEffect, useState } from 'react';
import { journeyBus } from '../lib/journeyBus';
import { projects } from '../data/projects';
import { scenes } from '../scenes/journey';

const openGuide = () => window.dispatchEvent(new CustomEvent('guide:open'));

export function Navigation() {
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    journeyBus.lenis?.stop();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', onKey);
    return () => {
      journeyBus.lenis?.start();
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const go = (id: string) => {
    setMenu(false);
    // Let the menu close before travelling so the journey is visible.
    setTimeout(() => journeyBus.goTo(id), 60);
  };

  return (
    <>
      <a
        className="skip-link"
        href="#orbit"
        onClick={(e) => (e.preventDefault(), journeyBus.goTo('orbit'), document.querySelector<HTMLElement>('#orbit a, #orbit button')?.focus({ preventScroll: true }))}
      >
        Skip to work
      </a>
      <header className="nav">
        <button className="nav__brand" type="button" onClick={() => journeyBus.goTo('earth', 'start')} aria-label="Arshpreet Singh, back to Earth">
          Arshpreet Singh
        </button>
        <nav className="nav__links" aria-label="Primary">
          <button type="button" onClick={() => journeyBus.goTo('about')}>
            About
          </button>
          <button type="button" onClick={() => journeyBus.goTo('orbit')}>
            Work
          </button>
          <button type="button" onClick={() => journeyBus.goTo('contact')}>
            Contact
          </button>
        </nav>
        <div className="nav__mobile">
          <button type="button" className="nav__pill" onClick={openGuide}>
            <span className="guide__orb" aria-hidden="true" /> Ask
          </button>
          <button type="button" className="nav__pill" aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu((v) => !v)}>
            {menu ? 'Close' : 'Menu'}
          </button>
        </div>
      </header>
      <div id="mobile-menu" className={`menu${menu ? ' is-open' : ''}`} aria-hidden={!menu} inert={!menu}>
        <nav aria-label="Journey">
          <button type="button" className="menu__item" onClick={() => go('about')}>
            <span>About</span>
          </button>
          <p className="menu__group">Work</p>
          {projects.map((p) => {
            const scene = scenes.find((s) => s.projectId === p.id);
            return scene ? (
              <button key={p.id} type="button" className="menu__item menu__item--sub" onClick={() => go(scene.id)}>
                <span>{p.name}</span>
                <small>{p.kicker}</small>
              </button>
            ) : null;
          })}
          <button type="button" className="menu__item" onClick={() => go('contact')}>
            <span>Contact</span>
          </button>
        </nav>
      </div>
    </>
  );
}
