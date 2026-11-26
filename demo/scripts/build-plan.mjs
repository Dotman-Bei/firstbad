// src/generated/plan.json: scene lengths and word timings, from the synthesized narration. Also prepares the clips.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
// Scene lengths in seconds. Each holds its key frame a little after the narration ends; the total keeps the 4:00 target.
const SECONDS = { S1: 16, S2: 14, S3: 28, S4: 22, S5: 22.5, S6: 21, S7: 20, S8: 23.5, S9: 25, S10: 24, S11: 12.5, S12: 10 };

const scenes = Object.entries(SECONDS).map(([id, seconds]) => {
  const audio = JSON.parse(fs.readFileSync(path.join(demo, 'public/audio', `${id}.json`), 'utf8'));
  if (!audio.aligned) throw new Error(`${id}: word timings not aligned`);
  if (audio.duration + 0.4 > seconds) throw new Error(`${id}: narration ${audio.duration.toFixed(1)}s does not fit ${seconds}s`);
  return { id, seconds, frames: Math.round(seconds * FPS), narrationSeconds: audio.duration, words: audio.words };
});
fs.writeFileSync(path.join(demo, 'src/generated/plan.json'), JSON.stringify({ fps: FPS, scenes }, null, 1));

const clips = path.join(demo, 'public/clips');
// The live take: one contiguous segment (2.0 s to 22.0 s of the raw capture), no cuts inside it.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2.0', '-t', '20', '-i', path.join(demo, 'capture/s3-live-raw.mp4'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', path.join(clips, 's3-live.mp4')]);
for (const name of ['s5-share', 's10-share']) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(clips, `${name}.mp4`), '-frames:v', '1', path.join(demo, 'public/preview', `${name}-first.png`)]);
}
const total = scenes.reduce((a, s) => a + s.seconds, 0);
console.log(`plan: ${scenes.length} scenes, ${total}s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')})`);
