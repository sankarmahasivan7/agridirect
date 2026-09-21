import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Truck, 
  User, 
  Phone, 
  Mail, 
  Lock, 
  FileText, 
  MapPin, 
  Scale, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  RefreshCw,
  Compass
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import GoogleSignInButton from '../../components/GoogleSignInButton.jsx'

const VEHICLE_TYPES = [
  'Mini Truck (e.g. Tata Ace, Bolero Maxi)',
  'Tempo / 407 (Medium Freight)',
  'Pickup Truck (1-2 Ton)',
  'Delivery Van (Insulated / Covered)',
  'Tractor Trolley (Bulk Ag Harvest)',
  'Two-Wheeler (Express Micro-Delivery)',
]

const TAMIL_VEHICLE_TYPES = {
  'Mini Truck (e.g. Tata Ace, Bolero Maxi)': 'மினி டிரக் (டாடா ஏஸ், போலிரோ மேக்ஸி)',
  'Tempo / 407 (Medium Freight)': 'டெம்போ / 407 (நடுத்தர சரக்கு)',
  'Pickup Truck (1-2 Ton)': 'பிக்கப் டிரக் (1-2 டன்)',
  'Delivery Van (Insulated / Covered)': 'டெலிவரி வேன் (மூடப்பட்ட / குளிரூட்டப்பட்ட)',
  'Tractor Trolley (Bulk Ag Harvest)': 'டிராக்டர் டிராலி (மொத்த விவசாய அறுவடை)',
  'Two-Wheeler (Express Micro-Delivery)': 'இருசக்கர வாகனம் (விரைவு சிறிய டெலிவரி)',
}

export default function TransporterRegister() {
  const { registerTransporter } = useAuth()
  const { t, isTamil } = useLanguage()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '', 
    phone: '', 
    email: '', 
    password: '',
    license_number: '', 
    district: 'Tenkasi',
    base_location: '',
    vehicle_name: '', 
    vehicle_number: '', 
    vehicle_type: 'Mini Truck', 
    capacity_kg: '',
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
      await registerTransporter({ ...form, capacity_kg: Number(form.capacity_kg) })
      navigate('/transporter/dashboard')
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
          <Truck className="w-4 h-4 text-sky-600" />
          {t('auth.transporterPill', 'Carrier & Fleet Network Enrollment')}
        </div>
        <h1 className="text-3xl font-bold font-display text-gray-900">
          {t('auth.transporterRegisterTitle', 'Join AgriDirect as a Transporter')}
        </h1>
        <p className="text-gray-500 text-sm mt-1.5 max-w-md mx-auto">
          {t('auth.transporterRegisterSubtitle', "Get automatically assigned cargo trips matching your truck's capacity. Fair freight rates and immediate delivery verification.")}
        </p>
      </div>

      <div className="card p-6 sm:p-8 border border-gray-100 shadow-lg">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-4 mb-6">
            <p className="font-bold">{t('auth.registrationError', 'Registration Error')}</p>
            <p className="mt-0.5">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Carrier Profile */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4" /> {t('auth.transporterProfileHeading', '1. Transporter / Driver Profile')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">{t('auth.fullNameLabel', 'Full Name *')}</label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder={t('auth.fullNamePlaceholder', 'e.g. Murugan Velu')}
                    value={form.full_name}
                    onChange={set('full_name')}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('auth.licenseLabel', 'Driving License Number *')}</label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder={t('auth.licensePlaceholder', 'e.g. TN-72-20180001234')}
                    value={form.license_number}
                    onChange={set('license_number')}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t('auth.operatingDistrictLabel', 'Operating District (Warehouse Zone) *')}</label>
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
                  ✓ {t('auth.dispatchZoneNote', 'Dispatch assignments originate from this district warehouse')}
                </p>
              </div>

              <div>
                <label className="label">{t('auth.baseLocationLabel', 'Base Town / Vehicle Stand *')}</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    required
                    placeholder={t('auth.baseLocationPlaceholder', 'e.g. Tenkasi Market Stand')}
                    value={form.base_location}
                    onChange={set('base_location')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Account & Login */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> {t('auth.loginSectionHeading', '2. Login & Communications')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('auth.phoneLabel', 'Mobile Number *')}</label>
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
                <label className="label">{t('auth.emailLabel', 'Email Address *')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    className="input !pl-10"
                    type="email"
                    required
                    placeholder="murugan@example.com"
                    value={form.email}
                    onChange={set('email')}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="label">{t('auth.passwordMin8Label', 'Account Password (min 8 chars) *')}</label>
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

          {/* Section 3: Registered Vehicle */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-3 flex items-center gap-1.5">
              <Truck className="w-4 h-4" /> {t('auth.vehicleSectionHeading', '3. Registered Vehicle Specifications')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('auth.vehicleNameLabel', 'Vehicle Model / Name *')}</label>
                <input
                  className="input"
                  required
                  placeholder={t('auth.vehicleNamePlaceholder', 'e.g. Tata Ace Gold / Mahindra Bolero')}
                  value={form.vehicle_name}
                  onChange={set('vehicle_name')}
                />
              </div>

              <div>
                <label className="label">{t('auth.vehicleNumberLabel', 'Registration / Number Plate *')}</label>
                <input
                  className="input font-mono uppercase"
                  required
                  placeholder={t('auth.vehicleNumberPlaceholder', 'e.g. TN-72-AB-1234')}
                  value={form.vehicle_number}
                  onChange={set('vehicle_number')}
                />
              </div>

              <div>
                <label className="label">{t('auth.vehicleTypeLabel', 'Vehicle Classification *')}</label>
                <select className="input" value={form.vehicle_type} onChange={set('vehicle_type')}>
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {isTamil ? (TAMIL_VEHICLE_TYPES[type] || type) : type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-sky-600" />
                    {t('auth.capacityLabel', 'Payload Capacity (kg) *')}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {form.vehicle_type.toLowerCase().includes('two-wheeler') || form.vehicle_type.toLowerCase().includes('bike')
                      ? t('auth.bikeMaxLimit', 'Bike (Max 50 kg)')
                      : t('auth.truckMinFill', 'Truck (35% min fill for dispatch)')}
                  </span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max={form.vehicle_type.toLowerCase().includes('two-wheeler') || form.vehicle_type.toLowerCase().includes('bike') ? 50 : undefined}
                  required
                  placeholder={form.vehicle_type.toLowerCase().includes('two-wheeler') || form.vehicle_type.toLowerCase().includes('bike') ? "e.g. 50" : "e.g. 500"}
                  value={form.capacity_kg}
                  onChange={set('capacity_kg')}
                />
                <p className="text-[11px] mt-1 text-slate-500 leading-tight">
                  {form.vehicle_type.toLowerCase().includes('two-wheeler') || form.vehicle_type.toLowerCase().includes('bike')
                    ? t('auth.bikeRule', '🛵 Bike Rule: Max 50 kg. Dispatched immediately for small loads (no 35% minimum fill requirement).')
                    : t('auth.truckRule', `🚛 Truck Rule: Requires ≥35% capacity to dispatch${form.capacity_kg ? ` (min ${(Number(form.capacity_kg) * 0.35).toFixed(1)} kg)` : ''}. Under-35% batches wait for compatible orders.`)}
                </p>
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
                {t('auth.registeringCarrier', 'Registering Transporter & Fleet Vehicle...')}
              </>
            ) : (
              <>
                <span>{t('auth.createTransporterBtn', 'Register as Carrier Transporter')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5">
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider absolute">
              {t('auth.orRegisterWith', 'or register with')}
            </span>
          </div>
          <GoogleSignInButton role="transporter" label="Continue with Google" />
        </div>

        <p className="text-sm text-gray-500 mt-6 text-center">
          {t('auth.alreadyHaveAccount', 'Already registered?')}{' '}
          <Link to="/transporter/login" className="text-sky-800 font-bold hover:underline">
            {t('auth.loginToTransporterHub', 'Log in to Transporter Hub')}
          </Link>
        </p>
      </div>
    </div>
  )
}

