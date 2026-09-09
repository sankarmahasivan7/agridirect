import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  User, 
  Building2, 
  ShoppingBag, 
  Mail, 
  Phone, 
  Lock, 
  MapPin, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Compass, 
  RefreshCw,
  Store
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'

const BUYER_TYPES = [
  { value: 'consumer', label: 'Individual Consumer' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'hotel', label: 'Hotel / Hospitality' },
  { value: 'retailer', label: 'Retail Grocer' },
  { value: 'supermarket', label: 'Supermarket Chain' },
  { value: 'food_processor', label: 'Food Processor / Agro-Mill' },
]

export default function BuyerRegister() {
  const { registerBuyer } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', 
    business_name: '', 
    buyer_type: 'consumer', 
    email: '', 
    phone: '', 
    password: '', 
    district: 'Tenkasi',
    location: '',
    default_latitude: null, 
    default_longitude: null,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await registerBuyer(form)
      navigate('/buyer/marketplace')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold mb-3">
          <Store className="w-4 h-4 text-sky-600" />
          Wholesale & Consumer Sourcing
        </div>
        <h1 className="text-3xl font-bold font-display text-gray-900">
          Create Your Buyer Account
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md mx-auto">
          Source farm-fresh vegetables, fruits, and grains directly with full logistics tracking and no broker markups.
        </p>
      </div>

      <div className="card p-6 sm:p-8 border border-gray-100 shadow-lg">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-4 mb-6">
            <p className="font-bold">Registration Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Buyer Profile */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf-700 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4" /> 1. Buyer Profile & Type
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Contact / Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder="e.g. Priya Sundaram"
                    value={form.full_name}
                    onChange={set('full_name')}
                  />
                </div>
              </div>

              <div>
                <label className="label">Procurement Role / Type *</label>
                <select className="input" value={form.buyer_type} onChange={set('buyer_type')}>
                  {BUYER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Business / Firm Name (Optional)</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    placeholder="e.g. Annapurna Fresh Kitchen"
                    value={form.business_name}
                    onChange={set('business_name')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Login Credentials */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf-700 mb-3 flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> 2. Login & Communications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    type="email"
                    required
                    placeholder="priya@example.com"
                    value={form.email}
                    onChange={set('email')}
                  />
                </div>
              </div>

              <div>
                <label className="label">Mobile Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={set('phone')}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Password (min 8 chars) *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10 !pr-10"
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Operating District *</label>
                <select
                  className="input font-medium bg-white"
                  required
                  value={form.district}
                  onChange={set('district')}
                >
                  <option value="Tenkasi">Tenkasi (தென்காசி)</option>
                  <option value="Tirunelveli">Tirunelveli (திருநெல்வேலி)</option>
                  <option value="Thoothukudi">Thoothukudi (தூத்துக்குடி)</option>
                </select>
                <p className="text-[11px] text-sky-700 mt-1 font-medium">
                  ✓ Serviced by district central warehouse
                </p>
              </div>

              <div>
                <label className="label">Default Delivery Street Address *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder="e.g. 14 Market Road, Tenkasi"
                    value={form.location}
                    onChange={set('location')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Delivery GPS Pin */}
          <div className="pt-4 border-t border-gray-100">
            <div className="mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-leaf-700 flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> 3. Default Delivery Coordinates
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Saved delivery point used to automatically calculate transport distances and match nearest vehicles.
              </p>
            </div>

            <LocationPicker
              latitude={form.default_latitude}
              longitude={form.default_longitude}
              onChange={(lat, lng) => setForm({ ...form, default_latitude: lat, default_longitude: lng })}
              label="Default Delivery Point"
            />
          </div>

          <button
            className="btn-primary w-full py-3.5 font-bold flex items-center justify-center gap-2 shadow-md text-base"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating Buyer Account...
              </>
            ) : (
              <>
                <span>Create Buyer Account & Start Sourcing</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Already registered?{' '}
          <Link to="/buyer/login" className="text-leaf-700 font-bold hover:underline">
            Log in to Buyer Hub
          </Link>
        </p>
      </div>
    </div>
  )
}

