import React from 'react'
import { Link } from 'react-router-dom'
import { 
  Sprout, 
  ShoppingBag, 
  Building2, 
  Truck, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp, 
  CheckCircle2, 
  Cpu, 
  Navigation,
  DollarSign,
  Layers
} from 'lucide-react'

const roles = [
  {
    key: 'farmer',
    label: 'Farmer',
    badge: 'Producers',
    desc: 'List your harvest directly, eliminate commission agents, and access AI price and demand intelligence.',
    icon: Sprout,
    gradient: 'from-emerald-500 to-leaf-600',
    border: 'hover:border-emerald-300',
    bg: 'bg-emerald-50/50',
    iconColor: 'text-emerald-600',
    features: ['Direct farmer-set pricing', 'Real-time demand forecasts', 'Automatic transport assignment'],
  },
  {
    key: 'buyer',
    label: 'Buyer',
    badge: 'Consumers & Bulk',
    desc: 'Source fresh produce directly from verified farmers and FPOs with zero undisclosed markups.',
    icon: ShoppingBag,
    gradient: 'from-blue-500 to-cyan-600',
    border: 'hover:border-blue-300',
    bg: 'bg-blue-50/50',
    iconColor: 'text-blue-600',
    features: ['Farm-origin traceability', 'Transparent fee breakdown', 'Bulk procurement matching'],
  },
  {
    key: 'fpo',
    label: 'FPO / Cooperatives',
    badge: 'Aggregators',
    desc: 'Aggregate member farmers’ harvests into commercial volumes and negotiate fair institutional deals.',
    icon: Building2,
    gradient: 'from-amber-500 to-orange-600',
    border: 'hover:border-amber-300',
    bg: 'bg-amber-50/50',
    iconColor: 'text-amber-600',
    features: ['Member supply pooling', 'Multi-farmer listings', 'Direct logistics booking'],
  },
  {
    key: 'transporter',
    label: 'Transporter',
    badge: 'Fleet & Drivers',
    desc: 'Receive auto-matched shipments that fit your vehicle capacity and share real-time GPS tracking.',
    icon: Truck,
    gradient: 'from-purple-500 to-indigo-600',
    border: 'hover:border-purple-300',
    bg: 'bg-purple-50/50',
    iconColor: 'text-purple-600',
    features: ['Capacity-based matching', 'Real-time GPS trip updates', 'Fair, guaranteed trip pay'],
  },
  {
    key: 'admin',
    label: 'Platform Admin',
    badge: 'Operations',
    desc: 'Monitor ecosystem health, verify participants, analyze GMV, and trigger AI logistics optimization.',
    icon: ShieldCheck,
    gradient: 'from-rose-500 to-pink-600',
    border: 'hover:border-rose-300',
    bg: 'bg-rose-50/50',
    iconColor: 'text-rose-600',
    features: ['Real-time GMV analytics', 'Vehicle route optimizer', 'System audit & transparency'],
  },
]

const stats = [
  { label: 'Middleman Markup', value: '0%', sub: 'Direct farmer-to-buyer', icon: DollarSign },
  { label: 'Price Transparency', value: '100%', sub: 'Separated farmer & freight pay', icon: CheckCircle2 },
  { label: 'AI Forecasting', value: 'Real-time', sub: 'Demand & fair rate advisory', icon: Cpu },
  { label: 'Logistics Fleet', value: 'GPS Live', sub: 'Route-optimized delivery', icon: Navigation },
]

export default function Landing() {
  return (
    <div className="min-h-screen">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.leaf.100),theme(colors.slate.50))]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-leaf-200/80 shadow-2xs text-xs font-bold text-leaf-800 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="flex h-2 w-2 rounded-full bg-leaf-500 animate-ping" />
            Direct Agriculture Commerce Platform & AI Intelligence
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight lg:leading-tight">
            Connecting Farmers Directly with Buyers —{' '}
            <span className="bg-gradient-to-r from-leaf-700 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Without Middlemen.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Transparent farmer-set prices, AI-driven demand forecasting, and automated, trackable GPS logistics for a fair agricultural supply chain.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/buyer/marketplace" className="btn-primary py-3.5 px-6 text-base shadow-md">
              <ShoppingBag className="w-5 h-5" />
              Explore Marketplace
            </Link>
            <Link to="/farmer/register" className="btn-secondary py-3.5 px-6 text-base shadow-2xs">
              <Sprout className="w-5 h-5 text-leaf-600" />
              Register as Farmer
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
              Role-Based Access
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-3">
              Choose Your Platform Workspace
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Each portal provides dedicated workflows tailored specifically for farmers, institutional buyers, transport fleets, and aggregators.
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
                      <span>{r.label} Sign In</span>
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>

                    {r.key !== 'admin' && (
                      <Link
                        to={`/${r.key}/register`}
                        className="btn-secondary w-full py-2 text-xs justify-center font-medium"
                      >
                        Create New {r.label} Account
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="card p-6 bg-white border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Honest Price Architecture</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The farmer receives 100% of their listed price. Logistics and platform fees are itemized transparently at checkout so both farmer and buyer see exact numbers.
              </p>
            </div>

            <div className="card p-6 bg-white border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">AI Demand & Price Intelligence</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Machine learning models analyze historical patterns and seasonality to recommend fair market price ranges and forecast upcoming buyer demand without ever altering farmer listings.
              </p>
            </div>

            <div className="card p-6 bg-white border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 mb-4">
                <Navigation className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Automated Fleet Matching</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                When buyers place orders, vehicles with matching weight capacity are instantly assigned based on proximity, complete with live GPS position tracking and route estimation.
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
            AgriDirect AI Platform
          </div>
          <p className="text-slate-500">
            Empowering direct farmer livelihoods through fair commerce, real demand intelligence, and honest logistics.
          </p>
        </div>
      </footer>

    </div>
  )
}

