import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { Sprout, Globe, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export const Scene8Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame: frame - 10, fps, config: { damping: 12, mass: 0.8 } });
  const textSpring = spring({ frame: frame - 30, fps, config: { damping: 14, mass: 1 } });
  const urlSpring = spring({ frame: frame - 60, fps, config: { damping: 15 } });
  const badgesSpring = spring({ frame: frame - 90, fps, config: { damping: 15 } });

  // Fade out during last 30 frames
  const fadeOut = interpolate(frame, [330, 360], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{ opacity: fadeOut }}
      className="relative w-full h-full flex flex-col items-center justify-center text-center px-16 overflow-hidden"
    >
      <ParticleBackground theme="emerald" />

      {/* Grand Brand Logo Mark */}
      <div
        style={{
          transform: `scale(${Math.max(0.6, logoSpring)})`,
          opacity: interpolate(frame, [5, 25], [0, 1]),
        }}
        className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-[0_0_80px_rgba(16,185,129,0.6)] mb-8 ring-4 ring-emerald-400/30"
      >
        <Sprout className="w-16 h-16 text-white drop-shadow-md" />
      </div>

      {/* Brand Name & Tagline */}
      <div
        style={{
          transform: `scale(${Math.max(0.85, textSpring)})`,
          opacity: interpolate(frame, [25, 50], [0, 1]),
        }}
        className="max-w-4xl z-10"
      >
        <h1 className="text-7xl font-black text-white tracking-tight mb-4 flex items-center justify-center gap-3">
          AgriDirect
        </h1>

        <p className="text-3xl font-extrabold bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent leading-snug">
          “Connecting Farmers Directly to Markets.”
        </p>

        <p className="mt-4 text-base text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed">
          Empowering India’s agrarian backbone through direct commerce, transparent pricing, and zero middleman commissions.
        </p>
      </div>

      {/* Live Website URL Pill */}
      <div
        style={{
          transform: `translateY(${(1 - urlSpring) * 40}px)`,
          opacity: interpolate(frame, [55, 80], [0, 1]),
        }}
        className="mt-10 z-10 inline-flex items-center gap-4 bg-slate-900/95 border-2 border-emerald-400/80 px-8 py-4 rounded-2xl shadow-[0_15px_40px_rgba(16,185,129,0.3)] backdrop-blur-xl group"
      >
        <Globe className="w-6 h-6 text-emerald-400 animate-pulse" />
        <span className="font-mono text-xl font-black text-white tracking-tight">
          agridirect-1-epvz.onrender.com
        </span>
        <ArrowRight className="w-5 h-5 text-emerald-400" />
      </div>

      {/* Participant Role Pills */}
      <div
        style={{
          transform: `translateY(${(1 - badgesSpring) * 30}px)`,
          opacity: interpolate(frame, [85, 110], [0, 1]),
        }}
        className="mt-8 flex items-center gap-6 z-10 text-xs font-bold text-slate-300"
      >
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Farmers: List Free & Earn +₹4/kg</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>Buyers: 100% Farm-Origin Produce</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-sky-400" />
          <span>Transporters: Verified Capacity Route Trips</span>
        </div>
      </div>
    </div>
  );
};

