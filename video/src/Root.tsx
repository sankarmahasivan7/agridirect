import React from 'react';
import { Composition } from 'remotion';
import { AgriDirectPromo } from './AgriDirectPromo';
import './style.css';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="AgriDirectPromo"
        component={AgriDirectPromo}
        durationInFrames={2700} // 90 seconds
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};

