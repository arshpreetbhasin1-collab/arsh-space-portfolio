import { scenes } from '../scenes/journey';
import { projectById } from '../data/projects';
import { ProjectScene } from './ProjectScene';
import { FinalSection } from './FinalSection';
import { AboutSection } from './AboutSection';
import { journeyBus } from '../lib/journeyBus';

// The readable layer. Each scene is a tall section with a sticky, viewport-sized stage, so
// content stays in normal document order for keyboard and screen-reader users while the
// visual layer behind it is driven by the same scroll position.

export function JourneySections({ onExplore }: { onExplore: (id: string) => void }) {
  return (
    <>
      {scenes.map((scene) => {
        const project = scene.projectId ? projectById(scene.projectId) : undefined;
        return (
          <section
            key={scene.id}
            id={scene.id}
            data-scene={scene.id}
            className={`scene scene--${scene.id}${project ? ' scene--project' : ''}`}
            style={{ ['--len' as string]: scene.length }}
            aria-label={project ? `${project.name}, near ${scene.label}` : scene.label}
          >
            <div className="scene__sticky">
              {scene.id === 'earth' && <Hero />}
              {project && <ProjectScene project={project} onExplore={onExplore} />}
              {!project && scene.caption !== undefined && scene.id !== 'earth' && <TravelCaption caption={scene.caption} id={scene.id} />}
              {scene.id === 'about' && <AboutSection />}
              {scene.id === 'sun' && <SunCaption />}
              {scene.id === 'contact' && <FinalSection />}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Hero() {
  return (
    <div className="hero">
      <div className="hero__top">
        <h1 className="hero__title" aria-label="Arshpreet Singh">
          {['Arshpreet', 'Singh'].map((word) => (
            <span className="hero__word" key={word} aria-hidden="true">
              {[...word].map((c, i) => (
                <span className="hero__char" key={i}>
                  {c}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="hero__role" data-reveal>
          Full-Stack Developer
        </p>
      </div>
      <div className="hero__bottom">
        <button className="hero__cue" data-reveal onClick={() => journeyBus.goTo('orbit')}>
          <span className="hero__cue-line" aria-hidden="true" />
          Scroll to explore
        </button>
      </div>
    </div>
  );
}

function TravelCaption({ caption, id }: { caption: string; id: string }) {
  return (
    <div className={`travel travel--${id}`}>
      {caption && (
        <p className="travel__caption" data-reveal>
          {caption}
        </p>
      )}
    </div>
  );
}

function SunCaption() {
  return (
    <div className="travel travel--sun">
      <p className="travel__caption travel__caption--large" data-reveal>
        Seven projects behind you.
      </p>
    </div>
  );
}
