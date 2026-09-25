import type { ElementType } from 'react';

// Headline split into masked words and letters so it can rise into place letter by letter.
// Screen readers get the plain text through aria-label.
export function SplitTitle({ as: Tag = 'h2', text, className, id }: { as?: ElementType; text: string; className: string; id?: string }) {
  return (
    <Tag className={`${className} split`} id={id} aria-label={text} data-split>
      {text.split(' ').map((word, w, all) => (
        <span key={w}>
          <span className="split__word" aria-hidden="true">
            {[...word].map((c, i) => (
              <span className="split__char" key={i}>
                {c}
              </span>
            ))}
          </span>
          {w < all.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
