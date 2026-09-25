// Builds web assets from the source renders in assets-src/ (not in the repo):
//   stills  -> public/plates/<id>.webp (desktop) and public/plates/m/<id>.webp (mobile)
//   clips   -> public/seq/<id>/NNN.webp frame sequences + src/data/sequences.json
// Requires cwebp on PATH and an ffmpeg binary (FFMPEG env or ffmpeg-static from a sibling project).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'assets-src/flow';
// Final framing for every render: the left 89% at 16:9, anchored to the bottom since planets sit
// low in frame and the top is mostly empty space.
const CROP = 'crop=trunc(iw*0.89/2)*2:trunc(ih*0.89/2)*2:0:trunc(ih*0.11)';
const FFMPEG = process.env.FFMPEG || `${process.env.HOME}/colourvista/node_modules/ffmpeg-static/ffmpeg`;

// Phones get their own portrait framing: a 9:16 window cut from each (already cropped) frame,
// centred on where the planet actually sits, instead of letting CSS crop the middle.
const PORTRAIT_X = {
  earth: 0.5, orbit: 0.5, moon: 0.7, mercury: 0.6, venus: 0.55, mars: 0.62, jupiter: 0.55,
  saturn: 0.66, uranus: 0.58, neptune: 0.5, deep: 0.5, 'deep-space': 0.5, sun: 0.5,
};
const portrait = (id) =>
  `crop=trunc(ih*9/16/2)*2:ih:clip(iw*${PORTRAIT_X[id] ?? 0.5}-ih*9/32\\,0\\,iw-ih*9/16):0`;

const plates = {
  earth: 'pick_earth_2k.jpg',
  orbit: 'pick_earth_2k.jpg',
  moon: 'pick_moon.jpg',
  mercury: 'pick_mercury.jpg',
  venus: 'pick_venus.jpg',
  mars: 'pick_mars.jpg',
  jupiter: 'pick_jupiter.jpg',
  saturn: 'pick_saturn.jpg',
  uranus: 'pick_uranus.jpg',
  neptune: 'pick_neptune.jpg',
  deep: 'pick_deep.jpg',
  sun: 'pick_sun.jpg',
};

mkdirSync('public/plates/m', { recursive: true });
for (const [id, file] of Object.entries(plates)) {
  const src = join(SRC, file.endsWith('.jpg') && existsSync(join(SRC, file.replace('.jpg', '_2k.jpg'))) ? file.replace('.jpg', '_2k.jpg') : file);
  if (!existsSync(src)) { console.warn('missing', src); continue; }
  const tmp = `assets-src/tmp_plate_${id}.png`;
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', src, '-vf', `${CROP},scale='min(2000,iw)':-2:flags=lanczos`, tmp]);
  execFileSync('cwebp', ['-quiet', '-q', '84', '-mt', tmp, '-o', `public/plates/${id}.webp`]);
  const tmpM = `assets-src/tmp_plate_${id}_m.png`;
  execFileSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', src, '-vf', `${CROP},${portrait(id)},scale=720:-2:flags=lanczos,unsharp=5:5:0.6`, tmpM]);
  execFileSync('cwebp', ['-quiet', '-q', '76', '-mt', tmpM, '-o', `public/plates/m/${id}.webp`]);
  rmSync(tmp);
  rmSync(tmpM);
  console.log('plate', id, '<-', src);
}

// Clips: assets-src/flow/clip_<id>.mp4 -> desktop frames (1600w, 12 fps) and a lighter
// portrait mobile set (540x960, 8 fps) in public/seq/<id>/m/.
const manifest = {};
const clips = readdirSync(SRC).filter((f) => /^clip_.+\.mp4$/.test(f));
const only = process.argv.slice(2);
for (const f of (process.env.PLATES_ONLY ? [] : clips)) {
  const id = f.slice(5, -4);
  if (only.length && !only.includes(id)) continue;
  const out = `public/seq/${id}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(`${out}/m`, { recursive: true });
  const counts = {};
  for (const [variant, fps, width, q, dir] of [['d', 12, 1600, 58, out], ['m', 8, 540, 62, `${out}/m`]]) {
    const tmp = `assets-src/tmp_${id}_${variant}`;
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp);
    execFileSync(FFMPEG, ['-loglevel', 'error', '-i', join(SRC, f), '-vf', `${CROP},${variant === 'm' ? portrait(id) + ',' : ''}fps=${fps},scale='min(${width},iw)':-2:flags=lanczos`, join(tmp, '%03d.png')]);
    const frames = readdirSync(tmp).filter((x) => x.endsWith('.png')).sort();
    frames.forEach((fr, i) => execFileSync('cwebp', ['-quiet', '-q', String(q), '-mt', join(tmp, fr), '-o', join(dir, `${String(i).padStart(3, '0')}.webp`)]));
    rmSync(tmp, { recursive: true, force: true });
    counts[variant] = frames.length;
  }
  manifest[id] = counts;
  console.log('sequence', id, counts);
}
const existing = only.length || process.env.PLATES_ONLY ? JSON.parse(readFileSync('src/data/sequences.json', 'utf8')) : {};
writeFileSync('src/data/sequences.json', JSON.stringify({ ...existing, ...manifest }, null, 2) + '\n');
