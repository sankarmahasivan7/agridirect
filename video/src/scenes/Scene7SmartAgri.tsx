import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { Cpu, TrendingUp, Navigation, BarChart3, Database, ShieldAlert } from 'lucide-react';

export const Scene7SmartAgri: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoomScale = interpolate(frame, [0, 80, 220, 300], [0.88, 1.02, 1.08, 0.94]);
  const scrollY = interpolate(frame, [0, 100, 200, 300], [40, 180, 340, 160]);

  const aiFeatures = [
    {
      title: 'Real Agmarknet Mandi Rates',
      desc: 'Live government benchmarks for Tenkasi, Tirunelveli & Thoothukudi',
      icon: Database,
      badge: 'Data.gov.in',
      color: 'border-emerald-500/60 text-emerald-400',
    },
    {
      title: 'Advance Demand Forecaster',
      desc: 'Matches upcoming buyer reservations to harvest schedules',
      icon: Cpu,
      badge: 'AI Predictive Engine',
      color: 'border-indigo-500/60 text-indigo-400',
    },
    {
      title: 'GPS Fleet Telemetry',
      desc: 'Vehicle capacity routing & live highway transit locks',
      icon: Navigation,
      badge: 'OpenStreetMap API',
      color: 'border-amber-500/60 text-amber-400',
    },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground theme="dark" />

      {/* Top Header */}
      <div
        style={{
          transform: `translateY(${interpolate(frame, [0, 20], [-40, 0])}px)`,
          opacity: interpolate(frame, [0, 15], [0, 1]),
        }}
        className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-900/95 border border-indigo-500/50 px-6 py-2.5 rounded-full shadow-2xl backdrop-blur-xl"
      >
        <Cpu className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-black uppercase tracking-wider text-white">
          Intelligent Mandi Architecture & AI Logistics
        </span>
      </div>

      {/* Browser View of Real Market Rates */}
      <div className="z-20 mt-10 relative">
        <BrowserFrame
          imageSrc="assets/market_prices.png"
          url="https://agridirect-1-epvz.onrender.com/market-prices"
          scale={zoomScale}
          scrollY={scrollY}
          highlightText="Government Mandi Feeds"
        />
      </div>

      {/* Floating Bottom AI Metric Badges */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-5 w-full max-w-5xl justify-center">
        {aiFeatures.map((feat, i) => {
          const cardSpring = spring({ frame: frame - (40 + i * 20), fps, config: { damping: 14 } });
          const Icon = feat.icon;

          return (
            <div
              key={i}
              style={{
                transform: `translateY(${(1 - cardSpring) * 40}px)`,
                opacity: interpolate(frame, [40 + i * 20, 60 + i * 20], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
              className={`flex-1 bg-slate-900/95 border ${feat.color} rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-start gap-3.5`}
            >
              <div className="p-2.5 rounded-xl bg-slate-800 shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-bold text-white leading-tight">{feat.title}</h4>
                  <span className="text-[9px] font-extrabold uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {feat.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  {feat.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

