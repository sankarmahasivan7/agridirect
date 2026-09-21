import React from 'react';
import { Sequence } from 'remotion';

import { Scene1Hook } from './scenes/Scene1Hook';
import { Scene2Problem } from './scenes/Scene2Problem';
import { Scene3Intro } from './scenes/Scene3Intro';
import { Scene4FarmerFlow } from './scenes/Scene4FarmerFlow';
import { Scene5BuyerFlow } from './scenes/Scene5BuyerFlow';
import { Scene6Connection } from './scenes/Scene6Connection';
import { Scene7SmartAgri } from './scenes/Scene7SmartAgri';
import { Scene8Closing } from './scenes/Scene8Closing';

export const AgriDirectPromo: React.FC = () => {
  return (
    <div className="relative w-full h-full bg-slate-950 font-sans text-white select-none">
      {/* 🎬 0–8 sec (Frames 0–240) — Hook */}
      <Sequence from={0} durationInFrames={240} name="Hook">
        <Scene1Hook />
      </Sequence>

      {/* 🌾 8–18 sec (Frames 240–540) — Problem */}
      <Sequence from={240} durationInFrames={300} name="Problem">
        <Scene2Problem />
      </Sequence>

      {/* 🚜 18–30 sec (Frames 540–900) — Introducing AgriDirect */}
      <Sequence from={540} durationInFrames={360} name="Introducing AgriDirect">
        <Scene3Intro />
      </Sequence>

      {/* 🧑🌾 30–45 sec (Frames 900–1350) — Farmer Workflow */}
      <Sequence from={900} durationInFrames={450} name="Farmer Workflow">
        <Scene4FarmerFlow />
      </Sequence>

      {/* 🛒 45–58 sec (Frames 1350–1740) — Buyer Workflow */}
      <Sequence from={1350} durationInFrames={390} name="Buyer Workflow">
        <Scene5BuyerFlow />
      </Sequence>

      {/* 🤝 58–68 sec (Frames 1740–2040) — Direct Connection */}
      <Sequence from={1740} durationInFrames={300} name="Direct Connection">
        <Scene6Connection />
      </Sequence>

      {/* 📊 68–78 sec (Frames 2040–2340) — Smart Agriculture */}
      <Sequence from={2040} durationInFrames={300} name="Smart Agriculture">
        <Scene7SmartAgri />
      </Sequence>

      {/* 🌱 78–90 sec (Frames 2340–2700) — Closing & Brand CTA */}
      <Sequence from={2340} durationInFrames={360} name="Closing & CTA">
        <Scene8Closing />
      </Sequence>
    </div>
  );
};

