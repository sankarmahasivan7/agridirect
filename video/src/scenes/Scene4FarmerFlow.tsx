import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ParticleBackground } from '../components/ParticleBackground';
import { BrowserFrame } from '../components/BrowserFrame';
import { SpotlightCallout } from '../components/SpotlightCallout';
import { Sprout, CheckCircle2, DollarSign, Sparkles, ArrowRight } from 'lucide-react';

export const Scene4FarmerFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step progression across 450 frames (15s)
  // Step 1: 0 - 110 (Farmer Access)
  // Step 2: 110 - 240 (Produce Details & Quantity)
  // Step 3: 240 - 350 (Setting Fair Farmer Price)
  // Step 4: 350 - 450 (Publish & Instant Logistics Match)
  const currentStep = frame < 110 ? 1 : frame < 240 ? 2 : frame < 350 ? 3 : 4;

  // Camera zoom into action areas
  const zoomScale = interpolate(
    frame,
    [0, 100, 220, 340, 450],
    [0.92, 1.05, 1.12, 1.06, 0.95]
  );
  const scrollY = interpolate(
    frame,
    [0, 120, 240, 360, 450],
    [40, 180, 320, 260, 100]
  );

  const steps = [
    { num: 1, title: 'Farmer Portal', desc: 'Secure phone/email auth' },
    { num: 2, title: 'Harvest Details', desc: 'Crop, Variety & Grade' },
    { num: 3, title: 'Direct Pricing', desc: 'Farmer sets payout rate' },
    { num: 4, title: 'Publish & Dispatch', desc: 'Auto fleet matching' },
  ];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <ParticleBackground theme="emerald" />

      {/* Top Workflow Stepper Pill */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-900/95 border border-emerald-500/50 px-6 py-2.5 rounded-full shadow-2xl backdrop-blur-xl">
        <span className="text-xs font-black uppercase tracking-wider text-emerald-400 mr-2 flex items-center gap-1.5">
          <Sprout className="w-4 h-4" /> Farmer Workflow
        </span>
        {steps.map((s) => {
          const isActive = s.num === currentStep;
          const isDone = s.num < currentStep;

          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40 scale-105'
                  : isDone
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : 'text-slate-500'
              }`}
            >
              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s.num}.</span>}
              <span>{s.title}</span>
            </div>
          );
        })}
      </div>

      {/* Browser View of Farmer Produce Listing */}
      <div className="z-20 mt-10 relative">
        <BrowserFrame
          imageSrc="assets/farmer_flow.png"
          url="https://agridirect-1-epvz.onrender.com/farmer/listings/new"
          scale={zoomScale}
          scrollY={scrollY}
          highlightText="Farmer Harvest Portal"
        />

        {/* Dynamic Cursor Spotlight Callouts */}
        {frame >= 60 && frame < 180 && (
          <SpotlightCallout
            x={780}
            y={340}
            label="1. Enter Harvest Quantity (kg)"
            clickAtFrame={100}
          />
        )}

        {frame >= 200 && frame < 330 && (
          <SpotlightCallout
            x={860}
            y={460}
            label="2. Set Direct Price (+₹4/kg Mandi Bonus)"
            clickAtFrame={240}
          />
        )}

        {frame >= 350 && (
          <SpotlightCallout
            x={1080}
            y={590}
            label="3. Publish Produce Listing"
            clickAtFrame={390}
          />
        )}
      </div>

      {/* Bottom Profit Guarantee Floating HUD */}
      <div
        style={{
          transform: `translateY(${interpolate(frame, [220, 260], [60, 0])}px)`,
          opacity: interpolate(frame, [220, 250], [0, 1]),
        }}
        className="absolute bottom-8 left-16 z-30 flex items-center gap-4 bg-slate-900/95 border border-emerald-500/60 p-4 rounded-2xl shadow-2xl backdrop-blur-md"
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Direct Payout Guarantee</div>
          <div className="text-base font-black text-white">100% of Produce Value Credited to Farmer</div>
        </div>
        <div className="ml-4 pl-4 border-l border-slate-700 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg">
          No Brokerage Deductions
        </div>
      </div>
    </div>
  );
};

