import { useEffect, useRef, useState } from 'react';
import { projectById } from '../data/projects';
import { journeyBus } from '../lib/journeyBus';

// "Explore": the real site in a frame when the deployment allows embedding, plus every
// captured screen. Always offers the external link in case a frame is blocked later.

export function ProjectDialog({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const project = projectId ? projectById(projectId) : undefined;
  const [tab, setTab] = useState<'live' | 'screens'>('live');
  const [frameLoaded, setFrameLoaded] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (project && !d.open) {
      setTab(project.embeddable && project.liveUrl ? 'live' : 'screens');
      setFrameLoaded(false);
      d.showModal();
      journeyBus.lenis?.stop();
    } else if (!project && d.open) d.close();
  }, [project]);

  const close = () => {
    journeyBus.lenis?.start();
    onClose();
  };

  const canEmbed = !!(project?.embeddable && project.liveUrl);

  return (
    <dialog
      ref={ref}
      className="explore"
      aria-labelledby="explore-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {project && (
        <div className="explore__panel">
          <header className="explore__head">
            <div>
              <h2 id="explore-title">{project.name}</h2>
            </div>
            <div className="explore__tools">
              {canEmbed && (
                <div className="explore__tabs" role="tablist" aria-label="View">
                  <button role="tab" aria-selected={tab === 'live'} onClick={() => setTab('live')}>
                    Live
                  </button>
                  <button role="tab" aria-selected={tab === 'screens'} onClick={() => setTab('screens')}>
                    Screens
                  </button>
                </div>
              )}
              {project.liveUrl && (
                <a className="btn btn--primary" href={project.liveUrl} target="_blank" rel="noreferrer">
                  Open site
                </a>
              )}
              <button className="btn btn--ghost explore__close" onClick={() => ref.current?.close()} aria-label="Close preview">
                Close
              </button>
            </div>
          </header>
          <div className="explore__body">
            {tab === 'live' && canEmbed ? (
              <div className="explore__frame">
                {!frameLoaded && <p className="explore__loading mono">Connecting to {new URL(project.liveUrl!).host}…</p>}
                <iframe
                  title={`${project.name} live site`}
                  src={project.liveUrl}
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  referrerPolicy="no-referrer"
                  onLoad={() => setFrameLoaded(true)}
                />
              </div>
            ) : (
              <ul className="explore__shots">
                {project.shots.map((s) => (
                  <li key={s.src} className={s.src.includes('mobile') ? 'is-mobile' : ''}>
                    <img src={s.src} alt={s.alt} loading="lazy" decoding="async" />
                  </li>
                ))}
              </ul>
            )}
            <aside className="explore__notes">
              <p>{project.summary}</p>
              <ul>
                {project.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      )}
    </dialog>
  );
}
