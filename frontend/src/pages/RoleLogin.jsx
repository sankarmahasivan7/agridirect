import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { 
  Sprout, 
  ShoppingBag, 
  Building2, 
  Truck, 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  Sparkles
} from 'lucide-react'

const ROLE_META = {
  farmer: { 
    label: 'Farmer', 
    icon: Sprout, 
    color: 'from-emerald-600 to-leaf-700',
    demoEmail: 'ravi.farmer@example.com',
    demoPassword: 'Farmer@123',
    hint: 'Manage your listings, view live orders, and inspect AI market forecasts.'
  },
  buyer: { 
    label: 'Buyer', 
    icon: ShoppingBag, 
    color: 'from-blue-600 to-cyan-700',
    demoEmail: 'buyer@example.com',
    demoPassword: 'password123',
    hint: 'Browse the transparent marketplace, order direct produce, and track deliveries.'
  },
  fpo: { 
    label: 'FPO / Cooperative', 
    icon: Building2, 
    color: 'from-amber-600 to-orange-700',
    demoEmail: 'fpo@example.com',
    demoPassword: 'password123',
    hint: 'Aggregate member crops, create collective listings, and request bulk transport.'
  },
  transporter: { 
    label: 'Transporter', 
    icon: Truck, 
    color: 'from-purple-600 to-indigo-700',
    demoEmail: 'transporter@example.com',
    demoPassword: 'password123',
    hint: 'Accept auto-matched shipments, share live GPS, and update shipment statuses.'
  },
  admin: { 
    label: 'Admin', 
    icon: ShieldCheck, 
    color: 'from-rose-600 to-pink-700',
    demoEmail: 'admin@agridirect.ai',
    demoPassword: 'admin@123',
    hint: 'Platform operations, system verification, GMV stats, and logistics optimizer.'
  },
}

export default function RoleLogin({ role }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const meta = ROLE_META[role] || ROLE_META.farmer
  const RoleIcon = meta.icon

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleFillDemo = () => {
    setEmail(meta.demoEmail)
    setPassword(meta.demoPassword)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, role)
      navigate(`/${role}/dashboard`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Role Selection
        </Link>

        {/* Card */}
        <div className="card p-8 border border-slate-200/80 shadow-soft-lg">
          
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${meta.color} flex items-center justify-center text-white shadow-md shadow-slate-200`}>
              <RoleIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {meta.label} Portal
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">{meta.hint}</p>
            </div>
          </div>

          {/* Quick Demo Fill Pill */}
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Quick Demo Testing?</span>
              <p className="text-[11px] text-slate-400">Pre-fill demo credentials</p>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs active:scale-95 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Auto-Fill
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Account Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  className="input pl-10"
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  className="input pl-10 pr-10"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              className="btn-primary w-full py-3 text-sm font-bold shadow-md mt-2"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In…</span>
                </>
              ) : (
                <span>Sign In to {meta.label} Account</span>
              )}
            </button>
          </form>

          {/* Footer Registration Link */}
          {role !== 'admin' && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              Don't have a {meta.label} account yet?{' '}
              <Link to={`/${role}/register`} className="font-bold text-leaf-700 hover:text-leaf-800 hover:underline">
                Register here
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

