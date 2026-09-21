import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { 
  Sprout, 
  ShoppingBag, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Truck, 
  Zap, 
  Coins, 
  CheckCircle2, 
  Repeat
} from 'lucide-react';

export const Scene6Connection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftSpring = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const centerSpring = spring({ frame: frame - 25, fps, config: { damping: 12 } });
  const rightSpring = spring({ frame: frame - 40, fps, config: { damping: 14 } });

  // Flowing energy particle offsets
  const flowProgress = (frame * 1.8) % 100;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center px-16 overflow-hidden">
      <ParticleBackground theme="emerald" />

      {/* Section Header */}
      <div
        style={{
          transform: `translateY(${interpolate(frame, [0, 25], [-40, 0])}px)`,
          opacity: interpolate(frame, [0, 20], [0, 1]),
        }}
        className="text-center mb-14 z-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-xs font-black uppercase tracking-widest mb-3">
          <Repeat className="w-4 h-4" /> Peer-to-Peer Agrarian Bridge
        </div>
        <h2 className="text-5xl font-black text-white tracking-tight">
          Eliminating Middlemen. Connecting Real People.
        </h2>
      </div>

      {/* Main Split Architecture View */}
      <div className="flex items-center justify-between w-full max-w-6xl z-20 gap-8 relative">

        {/* LEFT SIDE: FARMER */}
        <div
          style={{
            transform: `translateX(${(1 - leftSpring) * -80}px) scale(${Math.max(0.8, leftSpring)})`,
            opacity: interpolate(frame, [10, 30], [0, 1]),
          }}
          className="flex-1 bg-slate-900/90 border border-emerald-500/60 rounded-3xl p-8 shadow-[0_15px_50px_rgba(16,185,129,0.2)] backdrop-blur-xl relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
              <Sprout className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">Producer Side</div>
              <h3 className="text-2xl font-black text-white">Verified Farmers</h3>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Direct farmer-set price realization</span>
            </li>
            <li className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant direct bank UPI deposit</span>
            </li>
            <li className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Farm-gate vehicle pickup dispatch</span>
            </li>
          </ul>

          <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Earnings Margin:</span>
            <span className="text-emerald-400 font-black text-sm bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full">
              +15% to +25% Higher
            </span>
          </div>
        </div>

        {/* CENTER BEAM / PLATFORM HUB */}
        <div
          style={{
            transform: `scale(${Math.max(0.7, centerSpring)})`,
            opacity: interpolate(frame, [25, 45], [0, 1]),
          }}
          className="flex flex-col items-center justify-center relative w-72 shrink-0 z-30"
        >
          {/* Animated Connecting Beams */}
          <div className="absolute top-1/2 left-[-60px] right-[-60px] h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500 rounded-full blur-sm opacity-60 -z-10" />

          {/* Central Logo Orb */}
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 border-2 border-emerald-400 flex flex-col items-center justify-center text-white shadow-[0_0_50px_rgba(16,185,129,0.5)] relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white mb-1 shadow-md">
              <Sprout className="w-7 h-7" />
            </div>
            <span className="text-xs font-black tracking-tight text-white">AgriDirect</span>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Platform Core</span>

            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-3xl border border-emerald-400 animate-ping opacity-40 pointer-events-none" />
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-4 py-1.5 rounded-full text-[11px] font-bold text-slate-300 shadow-lg">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Digital Escrow Settlement</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-4 py-1.5 rounded-full text-[11px] font-bold text-slate-300 shadow-lg">
              <Truck className="w-3.5 h-3.5 text-sky-400" />
              <span>Verified Transport Matching</span>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: BUYER */}
        <div
          style={{
            transform: `translateX(${(1 - rightSpring) * 80}px) scale(${Math.max(0.8, rightSpring)})`,
            opacity: interpolate(frame, [35, 55], [0, 1]),
          }}
          className="flex-1 bg-slate-900/90 border border-amber-500/60 rounded-3xl p-8 shadow-[0_15px_50px_rgba(245,158,11,0.2)] backdrop-blur-xl relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/30">
              <ShoppingBag className="w-8 h-8 text-slate-950" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-amber-400">Consumer & Commercial</div>
              <h3 className="text-2xl font-black text-white">Direct Buyers</h3>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Farm-gate origin traceability</span>
            </li>
            <li className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Zero hidden commission fees</span>
            </li>
            <li className="flex items-center gap-2.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Doorstep fresh delivery within hours</span>
            </li>
          </ul>

          <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Procurement Savings:</span>
            <span className="text-amber-400 font-black text-sm bg-amber-950/80 border border-amber-800 px-3 py-1 rounded-full">
              Up to 20% Cheaper
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

