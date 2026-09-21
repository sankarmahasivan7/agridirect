import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { SpotlightCallout } from '../components/SpotlightCallout';
import { ShoppingBag, CheckCircle2, QrCode, ShieldCheck, Truck, Sparkles } from 'lucide-react';

export const Scene5BuyerFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Steps:
  // 1: 0 - 90 (Browse Marketplace)
  // 2: 90 - 200 (Select Produce & Origin)
  // 3: 200 - 300 (Transparent Fee Breakdown)
  // 4: 300 - 390 (Instant UPI Checkout)
  const currentStep = frame < 90 ? 1 : frame < 200 ? 2 : frame < 300 ? 3 : 4;

  const zoomScale = interpolate(
    frame,
    [0, 100, 210, 330, 390],
    [0.92, 1.08, 1.14, 1.05, 0.96]
  );
  const scrollY = interpolate(
    frame,
    [0, 100, 220, 340, 390],
    [50, 240, 380, 290, 120]
  );

  const steps = [
    { num: 1, title: 'Browse Fresh Produce', desc: 'Real farm harvests' },
    { num: 2, title: 'Select & Inspect', desc: 'Grade A verification' },
    { num: 3, title: 'Transparent Fees', desc: 'Clear cost breakdown' },
    { num: 4, title: 'Instant Order', desc: 'UPI QR / Cash on Delivery' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground theme="gold" />

      {/* Stepper Header */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-900/95 border border-amber-500/50 px-6 py-2.5 rounded-full shadow-2xl backdrop-blur-xl">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400 mr-2 flex items-center gap-1.5">
          <ShoppingBag className="w-4 h-4" /> Buyer Workflow
        </span>
        {steps.map((s) => {
          const isActive = s.num === currentStep;
          const isDone = s.num < currentStep;

          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40 scale-105'
                  : isDone
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  : 'text-slate-500'
              }`}
            >
              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s.num}.</span>}
              <span>{s.title}</span>
            </div>
          );
        })}
      </div>

      {/* Browser View of Real Marketplace */}
      <div className="z-20 mt-10 relative">
        <BrowserFrame
          imageSrc="assets/marketplace.png"
          url="https://agridirect-1-epvz.onrender.com/buyer/marketplace"
          scale={zoomScale}
          scrollY={scrollY}
          highlightText="Direct Farm Marketplace"
        />

        {/* Cursors on UI elements */}
        {frame >= 50 && frame < 160 && (
          <SpotlightCallout
            x={620}
            y={360}
            label="1. View Farm Origin & Freshness"
            clickAtFrame={90}
          />
        )}

        {frame >= 180 && frame < 290 && (
          <SpotlightCallout
            x={880}
            y={460}
            label="2. Inspect Item & Add to Cart"
            clickAtFrame={220}
          />
        )}

        {frame >= 300 && (
          <SpotlightCallout
            x={1120}
            y={520}
            label="3. 1-Click Order Confirmation"
            clickAtFrame={340}
          />
        )}
      </div>

      {/* Bottom Floating Settlement Card */}
      <div
        style={{
          transform: `translateY(${interpolate(frame, [180, 220], [60, 0])}px)`,
          opacity: interpolate(frame, [180, 210], [0, 1]),
        }}
        className="absolute bottom-8 right-16 z-30 bg-slate-900/95 border border-amber-500/50 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Fee Transparency</div>
            <div className="text-sm font-black text-white">0% Hidden Charges</div>
          </div>
        </div>

        <div className="h-7 w-px bg-slate-700" />

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Payment Modes</div>
            <div className="text-sm font-black text-white">Dynamic UPI & Cash on Delivery</div>
          </div>
        </div>
      </div>
    </div>
  );
};

