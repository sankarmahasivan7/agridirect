import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
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
  ArrowLeft
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
  const { t, language } = useLanguage()
  const navigate = useNavigate()

  const ROLE_META = {
    farmer: { 
      label: t('roles.farmer', 'Farmer'), 
      icon: Sprout, 
      color: 'from-emerald-600 to-leaf-700',
      demoEmail: 'ravi.farmer@example.com',
      demoPassword: 'Farmer@123',
      hint: language === 'ta' 
        ? 'விளைச்சலை நிர்வகிக்கவும், ஆர்டர்களை பார்க்கவும், AI விலை நிலவரத்தை அறியவும்.'
        : 'Manage your listings, view live orders, and inspect AI market forecasts.'
    },
    buyer: { 
      label: t('roles.buyer', 'Buyer'), 
      icon: ShoppingBag, 
      color: 'from-blue-600 to-cyan-700',
      demoEmail: 'buyer@example.com',
      demoPassword: 'password123',
      hint: language === 'ta'
        ? 'சந்தையில் விளைபொருட்களை வாங்கவும், நேரடி டெலிவரியை கண்காணிக்கவும்.'
        : 'Browse the transparent marketplace, order direct produce, and track deliveries.'
    },
    transporter: { 
      label: t('roles.transporter', 'Transporter'), 
      icon: Truck, 
      color: 'from-purple-600 to-indigo-700',
      demoEmail: 'transporter@example.com',
      demoPassword: 'password123',
      hint: language === 'ta'
        ? 'ஒதுக்கப்பட்ட சரக்குகளைப் பெறவும், நேரடி ஜிபிஎஸ் நிலவரத்தைப் பகிரவும்.'
        : 'Accept auto-matched shipments, share live GPS, and update shipment statuses.'
    },
    admin: { 
      label: t('roles.admin', 'Admin'), 
      icon: ShieldCheck, 
      color: 'from-rose-600 to-pink-700',
      demoEmail: 'admin@agridirect.ai',
      demoPassword: 'admin@123',
      hint: language === 'ta'
        ? 'தள மேற்பார்வை, GMV புள்ளிவிவரங்கள் மற்றும் வழித்தட உகப்பாக்கம்.'
        : 'Platform operations, system verification, GMV stats, and logistics optimizer.'
    },
  }

  const meta = ROLE_META[role] || ROLE_META.farmer
  const RoleIcon = meta.icon

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, role)
      navigate(`/${role}/dashboard`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.')
      setError(err.response?.data?.detail || (language === 'ta' ? 'உள்நுழைவு தோல்வியடைந்தது. விவரங்களை சரிபார்க்கவும்.' : 'Login failed. Please check your credentials.'))
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
          <ArrowLeft className="w-3.5 h-3.5" /> {language === 'ta' ? 'பிரிவு தேர்வுக்கு திரும்புக' : 'Back to Role Selection'}
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
                {meta.label} {language === 'ta' ? 'போர்டல்' : 'Portal'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">{meta.hint}</p>
            </div>
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
              <label className="label">{t('auth.emailOrPhone', 'Email or Mobile Number')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className="input !pl-10"
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">{t('auth.password', 'Password')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  className="input !pl-10 !pr-10"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-0.5"
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
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'ta' ? 'உள்நுழைகிறது...' : 'Signing In…'}</span>
                </div>
              ) : (
                <span>
                  {language === 'ta' ? `${meta.label} கணக்கில் உள்நுழைக` : `Sign In to ${meta.label} Account`}
                </span>
              )}
            </button>
          </form>

          {/* Footer Registration Link */}
          {role !== 'admin' && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              {t('auth.dontHaveAccount', 'Don\'t have an account?')} ({meta.label}){' '}
              <Link to={`/${role}/register`} className="font-bold text-leaf-700 hover:text-leaf-800 hover:underline">
                {t('auth.registerNow', 'Register Now')}
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}


