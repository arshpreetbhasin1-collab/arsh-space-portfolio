import type { Project } from '../data/projects';
import { ProjectPreview } from './ProjectPreview';
import { SplitTitle } from './SplitTitle';

const ArrowOut = () => (
  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
    <path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export function ProjectScene({ project, onExplore }: { project: Project; onExplore: (id: string) => void }) {
  const titleId = `${project.id}-title`;
  return (
    <article className={`project project--${project.tier === 'A' ? 'major' : 'minor'}`} aria-labelledby={titleId}>
      <div className="project__text">
        <SplitTitle className="project__title" id={titleId} text={project.name} />
        <p className="project__summary" data-reveal>
          {project.summary}
        </p>
        {project.tier === 'A' && (
          <ul className="project__notes" data-reveal>
            {project.notes.slice(0, 3).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="project__stack" data-reveal>
          {project.stack.join(' · ')}
        </p>
        {project.status && (
          <p className="project__note" data-reveal>
            {project.status}
          </p>
        )}
        <div className="project__actions" data-reveal>
          {project.liveUrl && (
            <a className="btn btn--primary" href={project.liveUrl} target="_blank" rel="noreferrer">
              Live site <ArrowOut />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {project.sourceUrl && (
            <a className="btn" href={project.sourceUrl} target="_blank" rel="noreferrer">
              Source <ArrowOut />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <button className="btn btn--ghost" type="button" onClick={() => onExplore(project.id)}>
            Explore
          </button>
        </div>
      </div>
      <div className="project__visual" data-reveal>
        <ProjectPreview project={project} onExplore={() => onExplore(project.id)} />
      </div>
    </article>
  );
}
