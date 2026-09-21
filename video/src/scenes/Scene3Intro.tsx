import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { CheckCircle2, ShieldCheck, Sprout, TrendingUp, Navigation, Zap } from 'lucide-react';

export const Scene3Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for browser mockup
  const browserEnter = spring({ frame: frame - 10, fps, config: { damping: 14, mass: 0.9 } });
  
  // Dynamic camera pan & zoom over time
  const cameraScale = interpolate(frame, [0, 80, 200, 360], [0.72, 0.92, 1.02, 1.08], {
    extrapolateRight: 'clamp',
  });
  const scrollY = interpolate(frame, [60, 240, 360], [0, 220, 360], {
    extrapolateRight: 'clamp',
  });

  const featureCards = [
    { title: 'Zero Commission', desc: '100% direct grower realization', icon: Zap, color: 'text-emerald-400' },
    { title: 'Live Mandi Ticker', desc: 'Real Agmarknet price benchmark', icon: TrendingUp, color: 'text-amber-400' },
    { title: 'Fleet Logistics', desc: 'OpenStreetMap route dispatch', icon: Navigation, color: 'text-sky-400' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground theme="emerald" />

      {/* Floating Header Banner */}
      <div
        style={{
          transform: `translateY(${interpolate(frame, [0, 25], [-60, 0])}px)`,
          opacity: interpolate(frame, [0, 20], [0, 1]),
        }}
        className="absolute top-8 left-16 z-30 flex items-center gap-4 bg-slate-900/90 border border-emerald-500/40 px-6 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <div className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            AgriDirect <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-bold">Platform Live</span>
          </div>
          <div className="text-xs text-slate-400">Direct Farmer-to-Consumer Commerce</div>
        </div>
      </div>

      {/* Browser Mockup displaying the Real Website */}
      <div
        style={{
          transform: `scale(${browserEnter}) translateY(${interpolate(frame, [0, 40], [100, 20])}px)`,
          opacity: interpolate(frame, [5, 25], [0, 1]),
        }}
        className="z-20 mt-12"
      >
        <BrowserFrame
          imageSrc="assets/home.png"
          url="https://agridirect-1-epvz.onrender.com"
          scale={cameraScale}
          scrollY={scrollY}
          highlightText="Direct Farm-to-Table"
        />
      </div>

      {/* Side floating feature chips */}
      <div className="absolute right-12 bottom-12 z-30 flex flex-col gap-3">
        {featureCards.map((feat, i) => {
          const chipSpring = spring({ frame: frame - (70 + i * 25), fps, config: { damping: 15 } });
          const Icon = feat.icon;

          return (
            <div
              key={i}
              style={{
                transform: `translateX(${(1 - chipSpring) * 120}px)`,
                opacity: interpolate(frame, [70 + i * 25, 90 + i * 25], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
              className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xl backdrop-blur-md w-72"
            >
              <div className={`p-2.5 rounded-xl bg-slate-800 border border-slate-700 ${feat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white">{feat.title}</div>
                <div className="text-[11px] text-slate-400 font-medium">{feat.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

