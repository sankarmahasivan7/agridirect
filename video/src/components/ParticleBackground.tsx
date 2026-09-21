import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface ParticleBackgroundProps {
  theme?: 'emerald' | 'dark' | 'problem' | 'gold';
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ theme = 'emerald' }) => {
  const frame = useCurrentFrame();

  const getGradients = () => {
    switch (theme) {
      case 'problem':
        return {
          bg: 'from-slate-950 via-zinc-900 to-rose-950',
          orb1: 'rgba(239, 68, 68, 0.12)',
          orb2: 'rgba(244, 63, 94, 0.08)',
          grid: 'rgba(244, 63, 94, 0.04)',
        };
      case 'gold':
        return {
          bg: 'from-slate-950 via-emerald-950 to-amber-950',
          orb1: 'rgba(245, 158, 11, 0.15)',
          orb2: 'rgba(16, 185, 129, 0.12)',
          grid: 'rgba(251, 191, 36, 0.05)',
        };
      case 'dark':
        return {
          bg: 'from-slate-950 via-slate-900 to-slate-950',
          orb1: 'rgba(16, 185, 129, 0.10)',
          orb2: 'rgba(99, 102, 241, 0.08)',
          grid: 'rgba(255, 255, 255, 0.03)',
        };
      case 'emerald':
      default:
        return {
          bg: 'from-slate-950 via-emerald-950 to-teal-950',
          orb1: 'rgba(16, 185, 129, 0.18)',
          orb2: 'rgba(45, 212, 191, 0.12)',
          grid: 'rgba(16, 185, 129, 0.05)',
        };
    }
  };

  const palette = getGradients();

  // Floating particles
  const particles = Array.from({ length: 18 }).map((_, i) => {
    const startX = (i * 105) % 1920;
    const speed = 0.4 + (i % 5) * 0.2;
    const yOffset = (frame * speed * 2 + i * 80) % 1150;
    const y = 1100 - yOffset;
    const size = 3 + (i % 4) * 2;
    const opacity = interpolate(
      Math.sin(frame * 0.05 + i),
      [-1, 1],
      [0.2, 0.7]
    );

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: startX,
          top: y,
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: theme === 'problem' ? '#f87171' : '#34d399',
          boxShadow: `0 0 ${size * 3}px ${theme === 'problem' ? '#ef4444' : '#10b981'}`,
          opacity,
        }}
      />
    );
  });

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${palette.bg} overflow-hidden pointer-events-none`}>
      {/* Dynamic Ambient Glow Orbs */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '20%',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.orb1} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          transform: `scale(${1 + Math.sin(frame * 0.03) * 0.08})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.orb2} 0%, transparent 70%)`,
          filter: 'blur(70px)',
          transform: `scale(${1 + Math.cos(frame * 0.02) * 0.1})`,
        }}
      />

      {/* Subtle Perspective Grid Pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${palette.grid} 1px, transparent 1px), linear-gradient(90deg, ${palette.grid} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          opacity: 0.6,
        }}
      />

      {/* Floating dust/light particles */}
      {particles}
    </div>
  );
};

