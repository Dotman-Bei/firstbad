// Renders one still per board to out/storyboard/, bundling once.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boards = [['S1'], ['S2'], ['S3', 0], ['S3', 1], ['S4'], ['S5'], ['S6'], ['S7'], ['S8'], ['S9', 0], ['S9', 1], ['S10', 0], ['S10', 1], ['S11'], ['S12']];
const only = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.join(demo, 'src/index.tsx'), publicDir: path.join(demo, 'public') });
for (const [scene, phase = 0] of boards) {
  if (only.length > 0 && !only.includes(scene)) continue;
  const inputProps = { scene, phase };
  const composition = await selectComposition({ serveUrl, id: 'Board', inputProps });
  const name = `${String(scene).padStart(3, '0').replace('0S', 'S0')}${phase ? '-b' : ''}.png`;
  await renderStill({ serveUrl, composition, inputProps, output: path.join(demo, 'out/storyboard', name) });
  console.log(name);
}
