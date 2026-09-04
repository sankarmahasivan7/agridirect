import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Building2, 
  FileText, 
  Users, 
  Mail, 
  Phone, 
  Lock, 
  MapPin, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

export default function FPORegister() {
  const { registerFPO } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    organization_name: '', 
    registration_number: '', 
    email: '', 
    phone: '',
    password: '', 
    location: '', 
    member_count: '',
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
      const payload = { ...form, member_count: form.member_count ? Number(form.member_count) : 0 }
      await registerFPO(payload)
      navigate('/fpo/dashboard')
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-3">
          <Building2 className="w-4 h-4 text-amber-700" />
          Cooperative Collective Enrollment
        </div>
        <h1 className="text-3xl font-bold font-display text-gray-900">
          Register Your FPO / Cooperative
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md mx-auto">
          Aggregate crop yields from multiple member farmers, secure bulk procurement contracts, and streamline logistics.
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
          {/* Section 1: FPO Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-amber-700" /> 1. Organization Legal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">FPO / Cooperative Name *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10"
                    required
                    placeholder="e.g. Tenkasi Farmer Producer Co. Ltd."
                    value={form.organization_name}
                    onChange={set('organization_name')}
                  />
                </div>
              </div>

              <div>
                <label className="label">Govt. Registration / CIN Number</label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10"
                    placeholder="e.g. U01409TZ2021PTC..."
                    value={form.registration_number}
                    onChange={set('registration_number')}
                  />
                </div>
              </div>

              <div>
                <label className="label">Enrolled Member Farmer Count</label>
                <div className="relative">
                  <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10"
                    type="number"
                    min="1"
                    placeholder="e.g. 150"
                    value={form.member_count}
                    onChange={set('member_count')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Administrator */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-amber-700" /> 2. Administrator & Login Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Official Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10"
                    type="email"
                    required
                    placeholder="info@tenkasifpo.org"
                    value={form.email}
                    onChange={set('email')}
                  />
                </div>
              </div>

              <div>
                <label className="label">Contact Phone Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10"
                    required
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={set('phone')}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Account Password (min 8 chars) *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10 pr-10"
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
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Registered Office Location / District</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    className="input pl-10"
                    placeholder="e.g. Tenkasi Main Road, Tirunelveli District"
                    value={form.location}
                    onChange={set('location')}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            className="btn-primary w-full py-3.5 font-bold flex items-center justify-center gap-2 shadow-md text-base"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Registering FPO Collective...
              </>
            ) : (
              <>
                <span>Register FPO Collective</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Already registered?{' '}
          <Link to="/fpo/login" className="text-amber-800 font-bold hover:underline">
            Log in to FPO Collective
          </Link>
        </p>
      </div>
    </div>
  )
}

