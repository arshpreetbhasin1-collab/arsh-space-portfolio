import { useState } from 'react';
import type { Project } from '../data/projects';

// The project itself, shown as a real capture inside a minimal window frame. PaintX gets an
// interactive before/after from the repo's own showcase images.

function hostOf(url?: string) {
  if (!url) return 'local build';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ProjectPreview({ project, onExplore }: { project: Project; onExplore: () => void }) {
  const desktopShots = project.shots.filter((s) => !s.src.includes('mobile'));
  const [i, setI] = useState(0);
  const shot = desktopShots[i] ?? project.cover;

  return (
    <figure
      className="preview"
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--px', ((e.clientX - r.left) / r.width).toFixed(3));
        e.currentTarget.style.setProperty('--py', ((e.clientY - r.top) / r.height).toFixed(3));
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty('--px', '0.5');
        e.currentTarget.style.setProperty('--py', '0.5');
      }}
    >
      <span className="preview__glare" aria-hidden="true" />
      <div className="preview__bar mono" aria-hidden="true">
        <span className="preview__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="preview__url">{hostOf(project.liveUrl)}</span>
      </div>
      {project.id === 'paintx' ? (
        <CompareSlider before={project.shots[0]} after={project.shots[1]} />
      ) : (
        <button type="button" className="preview__screen" onClick={onExplore} aria-label={`Open ${project.name} preview`}>
          <img src={shot.src} alt={shot.alt} decoding="async" />
        </button>
      )}
      {project.id !== 'paintx' && desktopShots.length > 1 && (
        <div className="preview__pager" role="group" aria-label={`${project.name} screens`}>
          {desktopShots.slice(0, 4).map((s, k) => (
            <button key={s.src} type="button" aria-label={`Show screen ${k + 1}: ${s.alt}`} aria-pressed={k === i} onClick={() => setI(k)} />
          ))}
        </div>
      )}
      <figcaption className="sr-only">{shot.alt}</figcaption>
    </figure>
  );
}

function CompareSlider({ before, after }: { before: { src: string; alt: string }; after: { src: string; alt: string } }) {
  const [v, setV] = useState(52);
  return (
    <div className="compare" style={{ ['--split' as string]: `${v}%` }}>
      <img className="compare__img" src={after.src} alt={after.alt} decoding="async" />
      <img className="compare__img compare__img--before" src={before.src} alt={before.alt} decoding="async" />
      <span className="compare__handle" aria-hidden="true" />
      <span className="compare__tag compare__tag--l mono" aria-hidden="true">
        Photo
      </span>
      <span className="compare__tag compare__tag--r mono" aria-hidden="true">
        PaintX render
      </span>
      <input
        className="compare__range"
        type="range"
        min={0}
        max={100}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        aria-label="Drag to compare the original photo with the PaintX render"
      />
    </div>
  );
}
