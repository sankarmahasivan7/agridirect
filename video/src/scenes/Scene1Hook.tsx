import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { Sprout, Sparkles, TrendingUp } from 'lucide-react';

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 12, mass: 0.8 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1]);

  const textSpring = spring({ frame: frame - 25, fps, config: { damping: 14, mass: 1 } });
  const subTextSpring = spring({ frame: frame - 60, fps, config: { damping: 15, mass: 1 } });
  const badgeSpring = spring({ frame: frame - 90, fps, config: { damping: 15, mass: 1 } });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground theme="emerald" />

      {/* Top Floating Badge */}
      <div
        style={{
          transform: `translateY(${(1 - logoScale) * 40}px) scale(${Math.max(0, logoScale)})`,
          opacity: logoOpacity,
        }}
        className="mb-8 inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-emerald-950/80 border border-emerald-400/60 shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-xl text-emerald-300 font-bold text-sm tracking-wide"
      >
        <Sprout className="w-5 h-5 text-emerald-400" />
        <span className="uppercase text-xs tracking-widest font-black">A New Agrarian Vision</span>
        <Sparkles className="w-4 h-4 text-amber-400" />
      </div>

      {/* Central Question Hook Typography */}
      <div className="max-w-5xl text-center px-12 z-10">
        <h1
          style={{
            transform: `scale(${Math.max(0.8, textSpring)})`,
            opacity: interpolate(frame, [20, 45], [0, 1]),
          }}
          className="text-6xl sm:text-7xl font-black text-white tracking-tight leading-[1.15]"
        >
          “What if farmers could sell{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent underline decoration-emerald-500/50 decoration-wavy underline-offset-8">
            directly
          </span>{' '}
          to buyers?”
        </h1>

        {/* Subtitle text */}
        <p
          style={{
            transform: `translateY(${(1 - subTextSpring) * 30}px)`,
            opacity: interpolate(frame, [55, 80], [0, 1]),
          }}
          className="mt-8 text-2xl text-slate-300 font-medium max-w-3xl mx-auto leading-relaxed"
        >
          No commission agents. No hidden markups. 100% direct grower payout powered by honest AI pricing.
        </p>
      </div>

      {/* Bottom Metric Pill */}
      <div
        style={{
          transform: `translateY(${(1 - badgeSpring) * 30}px)`,
          opacity: interpolate(frame, [85, 110], [0, 1]),
        }}
        className="mt-14 flex items-center gap-8 bg-slate-900/90 border border-slate-700/80 px-8 py-4 rounded-2xl shadow-2xl backdrop-blur-lg z-10"
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-slate-400 text-sm font-semibold">Brokerage Fee:</span>
          <span className="text-emerald-400 font-black text-lg">0% Flat</span>
        </div>
        <div className="h-6 w-px bg-slate-700" />
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400 text-sm font-semibold">Farmer Realization:</span>
          <span className="text-amber-400 font-black text-lg">+₹3 to +₹6/kg Higher</span>
        </div>
      </div>
    </div>
  );
};

