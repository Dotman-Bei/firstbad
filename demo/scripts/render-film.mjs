// Renders the film, or with --stills <seconds...> only those frames (for a quick visual check).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.join(demo, 'src/index.tsx'), publicDir: path.join(demo, 'public') });
const composition = await selectComposition({ serveUrl, id: 'Film' });
if (args[0] === '--stills') {
  const plan = JSON.parse(fs.readFileSync(path.join(demo, 'src/generated/plan.json'), 'utf8'));
  let start = 0;
  const starts = Object.fromEntries(plan.scenes.map((s) => { const at = start; start += s.frames; return [s.id, at]; }));
  for (const spec of args.slice(1)) {
    const [id, seconds] = spec.split(':');
    const output = path.join(demo, 'out/check', `${id}-${seconds}.png`);
    await renderStill({ serveUrl, composition, frame: starts[id] + Math.round(Number(seconds) * plan.fps), output, scale: 0.5 });
    console.log(output);
  }
} else {
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    crf: 18,
    audioBitrate: '192k',
    outputLocation: path.join(demo, 'out/film.mp4'),
    onProgress: ({ progress }) => {
      const decile = Math.floor(progress * 10);
      if (decile > last) { last = decile; console.log(`render ${decile * 10}%`); }
    },
  });
  console.log('render done');
}
