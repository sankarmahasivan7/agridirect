import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { AlertOctagon, TrendingDown, Clock, MapPinOff, Users, ArrowDownRight } from 'lucide-react';

export const Scene2Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame: frame - 5, fps, config: { damping: 14 } });

  const problems = [
    {
      title: 'Predatory Middlemen',
      stat: '30% – 45%',
      sub: 'Taken by commission agents before reaching the grower',
      icon: Users,
      delay: 20,
    },
    {
      title: 'Uncertain Mandi Prices',
      stat: 'Opaque Rates',
      sub: 'Farmers forced into distress sales without real-time benchmark',
      icon: TrendingDown,
      delay: 45,
    },
    {
      title: 'Limited Market Access',
      stat: '< 25 km Radius',
      sub: 'Trapped in localized markets with minimal buyer discovery',
      icon: MapPinOff,
      delay: 70,
    },
    {
      title: 'Delayed Cash Settlements',
      stat: '15 – 45 Days',
      sub: 'Prolonged credit cycles creating severe agrarian cash distress',
      icon: Clock,
      delay: 95,
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-16 overflow-hidden">
      <ParticleBackground theme="problem" />

      {/* Header Tag */}
      <div
        style={{
          transform: `translateY(${(1 - titleSpring) * 30}px)`,
          opacity: interpolate(frame, [0, 20], [0, 1]),
        }}
        className="text-center mb-12 z-10"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-400 text-xs font-black uppercase tracking-widest mb-4">
          <AlertOctagon className="w-4 h-4" /> The Broken Traditional Supply Chain
        </div>
        <h2 className="text-5xl font-black text-white tracking-tight">
          Why Indian Agriculture Needs An Urgent Transformation
        </h2>
      </div>

      {/* 4 Problem Cards Grid */}
      <div className="grid grid-cols-4 gap-6 w-full max-w-6xl z-10">
        {problems.map((prob, idx) => {
          const cardSpring = spring({ frame: frame - prob.delay, fps, config: { damping: 14, mass: 0.9 } });
          const Icon = prob.icon;

          return (
            <div
              key={idx}
              style={{
                transform: `translateY(${(1 - cardSpring) * 50}px) scale(${Math.max(0.8, cardSpring)})`,
                opacity: interpolate(frame, [prob.delay, prob.delay + 20], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
              className="bg-slate-900/90 border border-rose-500/30 rounded-3xl p-7 flex flex-col justify-between shadow-[0_15px_40px_rgba(239,68,68,0.15)] backdrop-blur-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />

              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-5 shadow-inner">
                  <Icon className="w-6 h-6" />
                </div>

                <div className="text-3xl font-black text-rose-400 tracking-tight flex items-baseline gap-1 mb-2">
                  {prob.stat}
                  <ArrowDownRight className="w-5 h-5 text-rose-500" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                  {prob.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {prob.sub}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-bold text-rose-400/80">
                <span>Traditional Model</span>
                <span className="bg-rose-500/20 px-2 py-0.5 rounded text-rose-300">Exploitative</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

