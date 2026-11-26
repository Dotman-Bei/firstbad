import React from 'react';
import type { Caption } from '@remotion/captions';
import { Audio } from '@remotion/media';
import { Series, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Board } from './Boards';
import plan from './generated/plan.json';

type Word = { text: string; start: number; end: number };

// Word timings as Caption objects, grouped into short pages that break at sentence and clause ends.
export const pages = (words: Word[]) => {
  const captions: Caption[] = words.map((w) => ({ text: w.text, startMs: w.start * 1000, endMs: w.end * 1000, timestampMs: w.start * 1000, confidence: null }));
  const out: { text: string; startMs: number }[] = [];
  let line: Caption[] = [];
  const flush = () => {
    if (line.length > 0) out.push({ text: line.map((c) => c.text).join(' '), startMs: line[0]!.startMs });
    line = [];
  };
  captions.forEach((c, i) => {
    line.push(c);
    const length = line.map((x) => x.text).join(' ').length;
    const sentence = /[.?!]["']?$/.test(c.text);
    const clause = /[,:;]$/.test(c.text) && length > 38;
    const nextTooLong = captions[i + 1] !== undefined && length + captions[i + 1]!.text.length > 68;
    if (sentence || clause || nextTooLong) flush();
  });
  flush();
  return out;
};

const Scene: React.FC<{ scene: (typeof plan.scenes)[number] }> = ({ scene }) => {
  const { fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const all = pages(scene.words);
  const current = [...all].reverse().find((p) => t * 1000 >= p.startMs - 80);
  return (
    <>
      <Board scene={scene.id} t={t} caption={current?.text ?? ''} />
      <Audio src={staticFile(`audio/${scene.id}.wav`)} />
    </>
  );
};

export const Film: React.FC = () => (
  <Series>
    {plan.scenes.map((s) => (
      <Series.Sequence key={s.id} durationInFrames={s.frames}>
        <Scene scene={s} />
      </Series.Sequence>
    ))}
  </Series>
);
