import React, { useEffect, useState } from 'react'
import logoImg from '../assets/logo_trans.png'

export default function SplashScreen({ onFinish }) {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Show splash for 2.5 seconds, then trigger smooth fade out
    const timer = setTimeout(() => {
      setFadeOut(true)
      const removeTimer = setTimeout(() => {
        setVisible(false)
        if (onFinish) onFinish()
      }, 500)
      return () => clearTimeout(removeTimer)
    }, 2500)

    return () => clearTimeout(timer)
  }, [onFinish])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050c0a] text-white transition-opacity duration-500 ease-out select-none ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient glowing gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,rgba(6,182,212,0.08)_40%,transparent_70%)] pointer-events-none" />

      {/* Main Container */}
      <div className="relative flex flex-col items-center justify-center px-6 text-center">
        {/* Glowing Pulsating Outer Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-teal-500/20 blur-xl animate-pulse" />
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-black/60 border border-emerald-500/30 p-2 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex items-center justify-center">
            <img
              src={logoImg}
              alt="AgriDirect Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(52,211,153,0.6)] animate-in zoom-in-90 duration-700"
            />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="mt-8 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            AgriDirect
          </h1>
          <p className="text-xs sm:text-sm font-semibold tracking-widest text-emerald-300/80 uppercase">
            Direct Farmer Commerce • AI Logistics
          </p>
        </div>

        {/* Sleek Animated Progress Indicator */}
        <div className="mt-10 w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <div className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-full animate-[progress_2.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  )
}

