// Small priority image loader. Decodes images off the main thread where supported and
// resolves even on failure (callers fall back to posters / CSS).

const cache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        (img.decode ? img.decode() : Promise.resolve()).catch(() => undefined).then(() => resolve(img));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

/** Loads a list with limited concurrency, reporting progress. */
export async function loadAll(srcs: string[], onProgress?: (done: number, total: number) => void, concurrency = 6) {
  let done = 0;
  let i = 0;
  const results: (HTMLImageElement | null)[] = new Array(srcs.length).fill(null);
  const worker = async () => {
    while (i < srcs.length) {
      const k = i++;
      results[k] = await loadImage(srcs[k]);
      onProgress?.(++done, srcs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, srcs.length) }, worker));
  return results;
}

export function forget(src: string) {
  cache.delete(src);
}
