import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { MousePointer2 } from 'lucide-react';

interface SpotlightCalloutProps {
  x: number;
  y: number;
  label?: string;
  clickAtFrame?: number; // frame at which click ripple triggers
  showSpotlight?: boolean;
}

export const SpotlightCallout: React.FC<SpotlightCalloutProps> = ({
  x,
  y,
  label,
  clickAtFrame = 30,
  showSpotlight = true,
}) => {
  const frame = useCurrentFrame();

  const isClicked = frame >= clickAtFrame;
  const clickProgress = isClicked ? Math.min(1, (frame - clickAtFrame) / 15) : 0;
  const rippleScale = interpolate(clickProgress, [0, 1], [0.8, 2.4]);
  const rippleOpacity = interpolate(clickProgress, [0, 0.8, 1], [0.9, 0.3, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* Glowing Spotlight Circle */}
      {showSpotlight && (
        <div
          style={{
            position: 'absolute',
            left: -80,
            top: -80,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(16, 185, 129, 0.08) 50%, transparent 70%)',
            border: '2px solid rgba(52, 211, 153, 0.7)',
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.5)',
            transform: `scale(${1 + Math.sin(frame * 0.1) * 0.06})`,
          }}
        />
      )}

      {/* Click Ripple Wave */}
      {isClicked && clickProgress < 1 && (
        <div
          style={{
            position: 'absolute',
            left: -40,
            top: -40,
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '3px solid #10b981',
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* Mouse Cursor */}
      <div
        style={{
          transform: `scale(${isClicked && clickProgress < 0.3 ? 0.9 : 1})`,
          transition: 'transform 0.05s',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
        }}
        className="flex items-start gap-2.5"
      >
        <MousePointer2 className="w-7 h-7 text-emerald-400 fill-emerald-500 stroke-slate-950 stroke-[2.5]" />
        
        {label && (
          <div className="bg-slate-900/95 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border border-emerald-400 shadow-xl shadow-emerald-950/40 backdrop-blur-md">
            {label}
          </div>
        )}
      </div>
    </div>
  );
};

