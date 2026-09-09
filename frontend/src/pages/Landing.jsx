import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext.jsx'
import { 
  Sprout, 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp, 
  CheckCircle2, 
  Cpu, 
  Navigation,
  DollarSign,
  Layers,
  Sparkles
} from 'lucide-react'

export default function Landing() {
  const { t, language } = useLanguage()

  const stats = [
    { label: t('landing.statZero', 'Middleman Brokerage'), value: '0%', sub: t('landing.statZeroSub', 'Fair pricing for both sides'), icon: DollarSign },
    { label: t('landing.statDirect', 'Direct to Farmer'), value: '100%', sub: t('landing.statDirectSub', 'Full grower price realization'), icon: CheckCircle2 },
    { label: t('landing.statAi', 'Honest AI Models'), value: 'Real-time', sub: t('landing.statAiSub', 'Real mandi market intelligence'), icon: Cpu },
    { label: t('landing.statGps', 'Live GPS Fleet'), value: 'Live', sub: t('landing.statGpsSub', 'OpenStreetMap driver telemetry'), icon: Navigation },
  ]

  const roles = [
    {
      key: 'farmer',
      label: t('roles.farmer', 'Farmer'),
      badge: language === 'ta' ? 'உற்பத்தியாளர்' : 'Producers',
      desc: t('landing.farmerDesc', 'List your harvest directly, eliminate commission agents, and access AI price and demand intelligence.'),
      icon: Sprout,
      gradient: 'from-emerald-500 to-leaf-600',
      border: 'hover:border-emerald-300',
      bg: 'bg-emerald-50/50',
      iconColor: 'text-emerald-600',
      features: language === 'ta' 
        ? ['உழவர் நிர்ணயிக்கும் நேரடி விலை', 'உடனடி தேவை முன்னறிவிப்பு', 'தானியங்கி சரக்கு வாகனம் ஒதுக்கீடு']
        : ['Direct farmer-set pricing', 'Real-time demand forecasts', 'Automatic transport assignment'],
    },
    {
      key: 'buyer',
      label: t('roles.buyer', 'Buyer'),
      badge: language === 'ta' ? 'நுகர்வோர் & மொத்த வியாபாரி' : 'Consumers & Bulk',
      desc: t('landing.buyerDesc', 'Source fresh produce directly from verified farmers with zero undisclosed markups.'),
      icon: ShoppingBag,
      gradient: 'from-blue-500 to-cyan-600',
      border: 'hover:border-blue-300',
      bg: 'bg-blue-50/50',
      iconColor: 'text-blue-600',
      features: language === 'ta'
        ? ['பண்ணை இருப்பிட நம்பகத்தன்மை', 'வெளிப்படையான விலை ரசீது', 'மொத்த கொள்முதல் பொருத்தம்']
        : ['Farm-origin traceability', 'Transparent fee breakdown', 'Bulk procurement matching'],
    },
    {
      key: 'transporter',
      label: t('roles.transporter', 'Transporter'),
      badge: language === 'ta' ? 'சரக்கு & ஓட்டுநர்கள்' : 'Fleet & Drivers',
      desc: t('landing.transporterDesc', 'Receive auto-matched shipments that fit your vehicle capacity and share real-time GPS tracking.'),
      icon: Truck,
      gradient: 'from-purple-500 to-indigo-600',
      border: 'hover:border-purple-300',
      bg: 'bg-purple-50/50',
      iconColor: 'text-purple-600',
      features: language === 'ta'
        ? ['வாகன அளவுக்கு ஏற்ற சவாரி', 'நேரடி ஜிபிஎஸ் வழித்தட தகவல்', 'நியாயமான உத்தரவாத கட்டணம்']
        : ['Capacity-based matching', 'Real-time GPS trip updates', 'Fair, guaranteed trip pay'],
    },
    {
      key: 'admin',
      label: t('roles.admin', 'Administrator'),
      badge: language === 'ta' ? 'தள நிர்வாகம்' : 'Operations',
      desc: t('landing.adminDesc', 'Monitor ecosystem health, verify participants, analyze GMV, and trigger AI logistics optimization.'),
      icon: ShieldCheck,
      gradient: 'from-rose-500 to-pink-600',
      border: 'hover:border-rose-300',
      bg: 'bg-rose-50/50',
      iconColor: 'text-rose-600',
      features: language === 'ta'
        ? ['உடனடி GMV விற்பனை புள்ளிவிவரம்', 'வாகன வழித்தட உகப்பாக்கம் (VRP)', 'தள வெளிப்படைத்தன்மை தணிக்கை']
        : ['Real-time GMV analytics', 'Vehicle route optimizer', 'System audit & transparency'],
    },
  ]

  return (
    <div className="min-h-screen">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.leaf.100),theme(colors.slate.50))]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-leaf-200/80 shadow-2xs text-xs font-bold text-leaf-800 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="flex h-2 w-2 rounded-full bg-leaf-500 animate-ping" />
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t('landing.pill', 'Ethical Direct Agricultural Commerce')}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight lg:leading-tight">
            {t('landing.heroTitle', 'Direct Farm-to-Table')} —{' '}
            <span className="bg-gradient-to-r from-leaf-700 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
              {language === 'ta' ? 'இடைத்தரகர் இல்லாமல்.' : 'Without Middlemen.'}
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {t('landing.heroSubtitle', 'Eliminate middlemen. Connect farmers directly with buyers, institutions, and verified fleet logistics powered by honest AI pricing.')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/buyer/marketplace" className="btn-primary py-3.5 px-6 text-base shadow-md">
              <ShoppingBag className="w-5 h-5" />
              {t('landing.exploreMarketplace', 'Explore Marketplace')}
            </Link>
            <Link to="/farmer/register" className="btn-secondary py-3.5 px-6 text-base shadow-2xs">
              <Sprout className="w-5 h-5 text-leaf-600" />
              {t('landing.registerAsFarmer', 'Join as a Farmer')}
            </Link>
          </div>

          {/* Key Metrics Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {stats.map((s, idx) => {
              const Icon = s.icon
              return (
                <div key={idx} className="card p-5 text-left flex items-start gap-3 bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-leaf-50 border border-leaf-100 flex items-center justify-center text-leaf-700 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
                    <div className="text-xs font-semibold text-slate-700">{s.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* Role Selection Grid */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-leaf-700 bg-leaf-50 px-3 py-1 rounded-full border border-leaf-200/50">
              {language === 'ta' ? 'பயனர் பிரிவுகள்' : 'Role-Based Access'}
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-3">
              {t('landing.rolesTitle', 'Built for the Entire Agricultural Ecosystem')}
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              {t('landing.rolesSubtitle', 'Select your role to access specialized portals, intelligent pricing, and logistics routing.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((r) => {
              const Icon = r.icon
              return (
                <div
                  key={r.key}
                  className={`card card-hover group flex flex-col justify-between p-6 border border-slate-200/80 transition-all duration-300 ${r.border}`}
                >
                  <div>
                    {/* Role Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${r.gradient} flex items-center justify-center text-white shadow-md shadow-slate-200 group-hover:scale-105 transition-transform duration-300`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        {r.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-leaf-800 transition-colors">
                      {r.label}
                    </h3>
                    <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                      {r.desc}
                    </p>

                    {/* Features Checklist */}
                    <ul className="space-y-2 mb-6 text-xs text-slate-600 border-t border-slate-100 pt-4">
                      {r.features.map((f, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-leaf-600 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <Link
                      to={`/${r.key}/login`}
                      className="btn-primary w-full py-2.5 text-sm justify-center group/btn"
                    >
                      <span>{r.label} {t('landing.signInRole', 'Sign In')}</span>
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>

                    {r.key !== 'admin' && (
                      <Link
                        to={`/${r.key}/register`}
                        className="btn-secondary w-full py-2 text-xs justify-center font-medium"
                      >
                        {t('landing.registerRole', 'Register')} {r.label}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* Trust & Transparency Feature Highlight */}
      <section className="py-16 bg-slate-50 border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-slate-900">
              {t('landing.trustTitle', 'The AgriDirect AI Integrity Architecture')}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="card p-6 bg-white border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {t('landing.trust1Title', 'Zero Synthetic Inventory')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('landing.trust1Desc', 'We never fabricate ghost listings or fictitious supply. Every listed item represents physical crops ready for harvest.')}
              </p>
            </div>

            <div className="card p-6 bg-white border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {t('landing.trust2Title', 'Honest Distance Lock')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('landing.trust2Desc', 'Deliveries enforce calculated highway transit time locks to prevent fraudulent remote delivery confirmations.')}
              </p>
            </div>

            <div className="card p-6 bg-white border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 mb-4">
                <Navigation className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {t('landing.trust3Title', 'Transparent Fee Architecture')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('landing.trust3Desc', 'Buyers see the exact breakdown: 100% direct farmer payout, verified transport carrier fee, and a flat 2% platform maintenance fee.')}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-xs text-center border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-2 font-bold text-white text-base">
            <Sprout className="w-5 h-5 text-leaf-500" />
            {t('nav.brand', 'AgriDirect')} AI Platform
          </div>
          <p className="text-slate-500 max-w-xl mx-auto">
            {t('landing.footerTagline', 'Empowering India’s agrarian backbone through direct trade and transparent AI intelligence.')}
          </p>
          <p className="text-slate-600 text-[11px] mt-2">
            © 2026 AgriDirect AI. {t('landing.rightsReserved', 'All rights reserved.')}
          </p>
        </div>
      </footer>

    </div>
  )
}


