import React from 'react';
import { Img, staticFile } from 'remotion';
import { Lock, Globe, RotateCw, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';

interface BrowserFrameProps {
  imageSrc: string;
  url?: string;
  scrollY?: number; // Pan inside screenshot
  scale?: number;
  translateX?: number;
  translateY?: number;
  tiltX?: number;
  tiltY?: number;
  highlightText?: string;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  imageSrc,
  url = 'https://agridirect-1-epvz.onrender.com',
  scrollY = 0,
  scale = 1,
  translateX = 0,
  translateY = 0,
  tiltX = 0,
  tiltY = 0,
  highlightText,
}) => {
  return (
    <div
      style={{
        transform: `perspective(1200px) scale(${scale}) translate(${translateX}px, ${translateY}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
        transformOrigin: 'center center',
        transition: 'transform 0.1s linear',
      }}
      className="relative w-[1560px] h-[880px] rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.55)] border border-slate-700/60 bg-slate-900"
    >
      {/* Browser Chrome Bar */}
      <div className="h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20 relative">
        {/* Window Traffic Lights */}
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          
          <div className="flex items-center gap-3 ml-6 text-slate-500">
            <ArrowLeft className="w-4 h-4 opacity-50" />
            <ArrowRight className="w-4 h-4 opacity-50" />
            <RotateCw className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* URL Pill */}
        <div className="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 rounded-xl px-6 py-1.5 text-xs text-slate-300 w-[620px] shadow-inner">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400 font-semibold">https://</span>
          <span className="font-mono text-slate-200 tracking-tight font-medium truncate">{url.replace('https://', '')}</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400/90 uppercase tracking-wider bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Verified
          </span>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
          {highlightText && (
            <span className="bg-emerald-600 text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-md shadow-emerald-600/30 animate-pulse">
              {highlightText}
            </span>
          )}
          <Globe className="w-4 h-4 text-slate-500" />
        </div>
      </div>

      {/* Viewport Screen Content */}
      <div className="relative w-full h-[824px] overflow-hidden bg-white">
        <div
          style={{
            transform: `translateY(-${scrollY}px)`,
            transition: 'transform 0.05s linear',
          }}
          className="w-full"
        >
          <Img
            src={staticFile(imageSrc)}
            className="w-full object-top"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
};

