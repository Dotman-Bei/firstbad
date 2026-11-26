import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Board } from './Boards';
import { Film } from './Film';
import plan from './generated/plan.json';

const Root: React.FC = () => (
  <>
    <Composition id="Board" component={Board} durationInFrames={1} fps={30} width={1920} height={1080} defaultProps={{ scene: 'S1', phase: 0 }} />
    <Composition id="Film" component={Film} durationInFrames={plan.scenes.reduce((a, s) => a + s.frames, 0)} fps={plan.fps} width={1920} height={1080} />
  </>
);

registerRoot(Root);
