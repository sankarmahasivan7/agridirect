import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  User, 
  Phone, 
  Mail, 
  Lock, 
  MapPin, 
  Sprout, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Compass
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import LocationPicker from '../../components/LocationPicker.jsx'

export default function FarmerRegister() {
  const { registerFarmer } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', 
    phone: '', 
    email: '', 
    password: '',
    village_town: '', 
    district: 'Tenkasi', 
    state: 'Tamil Nadu', 
    farm_location: '', 
    farm_size_acres: '',
    farm_latitude: null, 
    farm_longitude: null,
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
      const payload = { ...form, farm_size_acres: form.farm_size_acres ? Number(form.farm_size_acres) : null }
      await registerFarmer(payload)
      navigate('/farmer/dashboard')
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-leaf-100 text-leaf-800 text-xs font-bold mb-3">
          <Sprout className="w-4 h-4 text-leaf-600" />
          Direct Farmer Producer Enrollment
        </div>
        <h1 className="text-3xl font-bold font-display text-gray-900">
          Join AgriDirect as a Farmer
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md mx-auto">
          Sell your harvest directly to verified buyers. Zero middleman commissions, guaranteed direct bank payments.
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
          {/* Section 1: Account Info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf-700 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4" /> 1. Farmer Identity & Credentials
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={form.full_name}
                    onChange={set('full_name')}
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

              <div>
                <label className="label">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    type="email"
                    required
                    placeholder="ramesh@example.com"
                    value={form.email}
                    onChange={set('email')}
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
            </div>
          </div>

          {/* Section 2: Farm Details */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-leaf-700 mb-3 flex items-center gap-1.5">
              <Sprout className="w-4 h-4" /> 2. Farm Location & Acreage
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Village / Town</label>
                <input
                  className="input"
                  placeholder="e.g. Surandai"
                  value={form.village_town}
                  onChange={set('village_town')}
                />
              </div>

              <div>
                <label className="label">District (Operational Zones Only) *</label>
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
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  ✓ Central Agri-Warehouse dispatch enabled
                </p>
              </div>

              <div>
                <label className="label">State</label>
                <input
                  className="input"
                  placeholder="e.g. Tamil Nadu"
                  value={form.state}
                  onChange={set('state')}
                />
              </div>

              <div>
                <label className="label">Farm Size (Acres)</label>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 4.5"
                  value={form.farm_size_acres}
                  onChange={set('farm_size_acres')}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label">Farm Gate Address / Landmark</label>
                <input
                  className="input"
                  placeholder="e.g. West Farm Gate, Near Canal, Surandai Road"
                  value={form.farm_location}
                  onChange={set('farm_location')}
                />
              </div>
            </div>
          </div>

          {/* Section 3: GPS Pickup Point */}
          <div className="pt-4 border-t border-gray-100">
            <div className="mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-leaf-700 flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> 3. Vehicle Pickup Coordinates
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Transport trucks use these coordinates for navigation when picking up your harvest dispatches.
              </p>
            </div>

            <LocationPicker
              latitude={form.farm_latitude}
              longitude={form.farm_longitude}
              onChange={(lat, lng) => setForm({ ...form, farm_latitude: lat, farm_longitude: lng })}
              label="Farm Harvest Pickup Point"
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
                Creating Farmer Account...
              </>
            ) : (
              <>
                <span>Register as Verified Farmer</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Already registered?{' '}
          <Link to="/farmer/login" className="text-leaf-700 font-bold hover:underline">
            Log in to Farmer Hub
          </Link>
        </p>
      </div>
    </div>
  )
}

