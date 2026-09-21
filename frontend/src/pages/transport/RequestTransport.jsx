import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Scale, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck,
  RefreshCw,
  Warehouse,
  Info,
  Building2,
  Check
} from 'lucide-react'
import { createTransportRequest } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

const WAREHOUSE_OPTIONS = [
  {
    district: 'Tenkasi',
    districtTa: 'தென்காசி',
    name: 'Tenkasi Central Agri-Warehouse',
    nameTa: 'தென்காசி மத்திய வேளாண் கிடங்கு',
    code: 'WH-TKS-01',
    address: 'Tenkasi Regulated Market Complex, Old Bus Stand Road, Tenkasi - 627811',
    value: 'Tenkasi Central Agri-Warehouse, Tenkasi Regulated Market Complex, Tenkasi',
    hours: '06:00 AM - 08:00 PM',
  },
  {
    district: 'Tirunelveli',
    districtTa: 'திருநெல்வேலி',
    name: 'Tirunelveli Central Agri-Warehouse',
    nameTa: 'திருநெல்வேலி மத்திய வேளாண் கிடங்கு',
    code: 'WH-TNV-01',
    address: 'Tirunelveli Agro-Logistics Hub, Bypass Road, Tirunelveli - 627005',
    value: 'Tirunelveli Central Agri-Warehouse, Tirunelveli Agro-Logistics Hub, Tirunelveli',
    hours: '06:00 AM - 08:00 PM',
  },
  {
    district: 'Thoothukudi',
    districtTa: 'தூத்துக்குடி',
    name: 'Thoothukudi Central Agri-Warehouse',
    nameTa: 'தூத்துக்குடி மத்திய வேளாண் கிடங்கு',
    code: 'WH-TUT-01',
    address: 'Port-Agri Warehousing Center, Harbour Express Highway, Thoothukudi - 628004',
    value: 'Thoothukudi Central Agri-Warehouse, Port-Agri Warehousing Center, Thoothukudi',
    hours: '06:00 AM - 08:00 PM',
  },
]

export default function RequestTransport() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, isTamil } = useLanguage()

  // Default pickup location from user profile
  const defaultFarmLocation = 
    user?.farmer_profile?.farm_location ||
    [user?.farmer_profile?.village_town, user?.farmer_profile?.district || user?.district].filter(Boolean).join(', ') ||
    (user?.district ? `${user.district}, Tamil Nadu` : '')

  // Default destination warehouse matching user's district
  const userDistrict = user?.farmer_profile?.district || user?.district || 'Tenkasi'
  const defaultWarehouse = WAREHOUSE_OPTIONS.find(
    (w) => w.district.toLowerCase() === userDistrict.toLowerCase()
  ) || WAREHOUSE_OPTIONS[0]

  const [form, setForm] = useState({
    pickup_location: defaultFarmLocation,
    destination_location: defaultWarehouse.value,
    required_by: '',
    weight_kg: '',
    notes: '',
  })

  useEffect(() => {
    if (defaultFarmLocation && !form.pickup_location) {
      setForm((prev) => ({ ...prev, pickup_location: defaultFarmLocation }))
    }
  }, [defaultFarmLocation])

  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleWarehouseSelect = (val) => {
    setForm((prev) => ({ ...prev, destination_location: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await createTransportRequest({
        ...form,
        weight_kg: Number(form.weight_kg),
        required_by: new Date(form.required_by).toISOString(),
      })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || (isTamil ? 'போக்குவரத்து கோரிக்கையை சமர்ப்பிக்க முடியவில்லை.' : 'Could not submit transport assistance request.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-3 border border-emerald-200">
          <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
          <span>{isTamil ? 'பண்ணை-கிடங்கு போக்குவரத்து உதவி' : 'Farm-to-Warehouse Logistics Assistance'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 tracking-tight">
          {isTamil ? 'பண்ணை-கிடங்கு போக்குவரத்திற்கு விண்ணப்பிக்கவும்' : 'Apply for Farm-to-Warehouse Transport'}
        </h1>
        <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
          {isTamil 
            ? 'உங்கள் அறுவடை விளைபொருளை மாவட்ட மத்திய கிடங்கிற்கு கொண்டு வர வாகன வசதி இல்லையென்றால், அக்ரிடயரக்ட் பிக்கப் வாகனத்தைப் பெற இங்கு விண்ணப்பிக்கவும்.'
            : 'If you don\'t have transport facilities (tractor, mini-truck, or auto) to bring your harvest to the District Central Warehouse, apply here to request an AgriDirect pickup carrier.'}
        </p>
      </div>

      {/* Free Direct Delivery Advisory Banner */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-amber-50/30 border border-emerald-200/80 shadow-2xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Warehouse className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
              <span>{isTamil ? 'சொந்த வாகனம் உள்ளதா? நேரடி கிடங்கு விநியோகம் 100% இலவசம் (₹0)' : 'Have your own vehicle? Direct Warehouse Delivery is 100% Free (₹0)'}</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                {isTamil ? 'பரிந்துரைக்கப்படுகிறது' : 'Recommended'}
              </span>
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isTamil
                ? 'தென்காசி, திருநெல்வேலி அல்லது தூத்துக்குடி மத்திய கிடங்குகளுக்கு நேரடியாகக் கொண்டு வரும் உழவர்களுக்கு எவ்வித போக்குவரத்துப் பிடித்தமும் இல்லை, உடனடி மின்னணு எடை ரசீது மற்றும் நேரடி சந்தைப் பட்டியல் கிடைக்கும்.'
                : 'Farmers who can transport their own produce directly to Tenkasi, Tirunelveli, or Thoothukudi Central Agri-Warehouses incur zero transport deduction, receive instant digital weighbridge slips, and get immediate buyer marketplace listing.'}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isTamil ? 'வாகன வசதி இல்லாத போது மட்டுமே பண்ணை பிக்கப்பிற்கு விண்ணப்பிக்கவும்.' : 'Only apply below if you lack transport facilities and need farm-gate pickup.'}</span>
          </span>
          <Link
            to="/transport/my-requests"
            className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
          >
            <span>{isTamil ? 'கிடங்கு இடங்கள் & நேரத்தைக் காண்க' : 'View Warehouse Locations & Hours'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Transport Assistance Application Form */}
      <div className="card p-6 sm:p-8 shadow-soft border border-slate-200/80">
        <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-100">
          <Truck className="w-5 h-5 text-purple-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">{isTamil ? 'பண்ணை பிக்கப் விண்ணப்பப் படிவம்' : 'Farm Pickup Application Form'}</h2>
            <p className="text-xs text-slate-500">{isTamil ? 'அறுவடை எடை மற்றும் நேரத்தின் அடிப்படையில் உள்ளூர் வாகனங்களை இணைக்கும்.' : 'Auto-matches verified local carriers based on harvest weight & pickup time.'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Pickup Point (Farm Location) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>{isTamil ? 'பண்ணை பிக்கப் இடம் *' : 'Farm Gate Pickup Location *'}</span>
              </label>
              {defaultFarmLocation && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, pickup_location: defaultFarmLocation }))}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  {isTamil ? 'சுயவிவர முகவரியைப் பயன்படுத்து' : 'Use Profile Address'}
                </button>
              )}
            </div>
            <input
              className="input text-sm"
              required
              placeholder={isTamil ? 'எ.கா. தெற்கு தெரு பண்ணை, சுரண்டை, தென்காசி' : 'e.g. South Street Farm Gate, Surandai, Tenkasi'}
              value={form.pickup_location}
              onChange={set('pickup_location')}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {isTamil ? 'ஓட்டுநர் நேரடியாக வந்து அடைய சரியான கிராமம், அடையாளம் அல்லது முகவரியை உள்ளிடவும்.' : 'Enter your exact village, landmark, or farm coordinates so the driver can reach you directly.'}
            </p>
          </div>

          {/* Destination Central Warehouse Selector */}
          <div>
            <label className="label flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
              <Warehouse className="w-4 h-4 text-purple-600" />
              <span>{isTamil ? 'இலக்கு மாவட்ட மத்திய வேளாண் கிடங்கு *' : 'Destination District Central Agri-Warehouse *'}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
              {WAREHOUSE_OPTIONS.map((wh) => {
                const isSelected = form.destination_location === wh.value
                return (
                  <button
                    key={wh.code}
                    type="button"
                    onClick={() => handleWarehouseSelect(wh.value)}
                    className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          {isTamil ? wh.districtTa : wh.district}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{isTamil ? wh.nameTa : wh.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{wh.address}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 mt-2 block">
                      {isTamil ? 'நேரம்:' : 'Hours:'} {wh.hours}
                    </span>
                  </button>
                )
              })}
            </div>

            <input
              type="text"
              className="input text-xs text-slate-600 bg-slate-50"
              value={form.destination_location}
              onChange={set('destination_location')}
              placeholder={isTamil ? 'அல்லது குறிப்பிட்ட கிடங்கு முகவரியை உள்ளிடவும்' : 'Or specify custom warehouse location'}
            />
          </div>

          {/* Date & Cargo Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>{isTamil ? 'பிக்கப் தேவைப்படும் நேரம் *' : 'Pickup Required By (Date & Time) *'}</span>
              </label>
              <input
                className="input text-sm"
                type="datetime-local"
                required
                value={form.required_by}
                onChange={set('required_by')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                <Scale className="w-4 h-4 text-slate-500" />
                <span>{isTamil ? 'மொத்த அறுவடை எடை (கிலோ) *' : 'Total Harvest Weight (kg) *'}</span>
              </label>
              <input
                className="input text-sm"
                type="number"
                min="1"
                required
                placeholder="e.g. 500"
                value={form.weight_kg}
                onChange={set('weight_kg')}
              />
            </div>
          </div>

          {/* Handling Notes */}
          <div>
            <label className="label flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>{isTamil ? 'விளைபொருள் விவரங்கள் & பிக்கப் அடையாளக் குறிப்புகள் (விருப்பத்தேர்வு)' : 'Crop Details & Pickup Landmark Instructions (Optional)'}</span>
            </label>
            <input
              className="input text-sm"
              placeholder={isTamil ? 'எ.கா. 500 கிலோ தக்காளி, பள்ளிக்கு பின்னால் 200 மீட்டரில் பண்ணை' : 'e.g. 500 kg fresh Brinjal in crates, farm located 200m behind primary school'}
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          {/* Submit Button */}
          <button
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-md transition-all mt-2"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{isTamil ? 'வாகன இருப்பு சரிபார்க்கப்பட்டு சமர்ப்பிக்கப்படுகிறது…' : 'Checking Fleet Availability & Submitting…'}</span>
              </>
            ) : (
              <>
                <Truck className="w-4 h-4" />
                <span>{isTamil ? 'பண்ணை பிக்கப் போக்குவரத்திற்கு விண்ணப்பிக்கவும்' : 'Apply for Farm Pickup Transport'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{isTamil ? 'கோரிக்கையை செயல்படுத்த முடியவில்லை' : 'Could not process transport request'}</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Success Result Card */}
      {result && (
        <div className="card p-6 sm:p-7 border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 shadow-md animate-fade-in space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">{isTamil ? `போக்குவரத்து கோரிக்கை #${result.id} உருவாக்கப்பட்டது` : `Transport Request #${result.id} Created`}</h3>
                <p className="text-xs text-slate-500">{isTamil ? 'வழித்தடம்: பண்ணை ➔ மாவட்ட மத்திய கிடங்கு' : 'Route: Farm Gate ➔ District Warehouse'}</p>
              </div>
            </div>
            <span className={result.status === 'ASSIGNED' ? 'badge-actual' : 'badge-demo'}>
              {result.status}
            </span>
          </div>

          {result.assigned_vehicle ? (
            <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{isTamil ? 'நியமிக்கப்பட்ட சரக்குந்து' : 'Assigned Transporter'}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {isTamil ? 'பிக்கப்பிற்கு உறுதி செய்யப்பட்டது' : 'Confirmed for Pickup'}
                </span>
              </div>
              <p className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600" />
                {result.assigned_vehicle.name} <span className="text-purple-700 font-bold">({result.assigned_vehicle.vehicle_number})</span>
              </p>
              <p className="text-xs text-slate-600">
                {isTamil ? 'வாகன வகை:' : 'Vehicle Type:'} <b>{result.assigned_vehicle.vehicle_type}</b> · {isTamil ? 'கொள்ளளவு:' : 'Payload Capacity:'} <b>{Number(result.assigned_vehicle.capacity_kg)} {isTamil ? 'கிலோ' : 'kg'}</b>
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold">{isTamil ? 'வாகன ஒதுக்கீட்டிற்கான வரிசையில் உள்ளது' : 'Queued for Transporter Pairing'}</p>
              <p className="text-[11px] text-amber-800">
                {isTamil
                  ? `உங்கள் ${form.weight_kg} கிலோவிற்கு ஏற்ற அனைத்து சரக்குந்துகளும் தற்போது பயணத்தில் உள்ளன. அருகிலுள்ள ஓட்டுநர் தங்கள் சவாரியை முடித்தவுடன் தானாகவே ஒதுக்கப்படுவர்.`
                  : `All carriers matching ${form.weight_kg} kg are currently on active trips. Your pickup application is registered and will auto-assign as soon as the nearest driver completes their route.`}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to={`/transport/track/${result.id}`}
              className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5 py-2.5 font-bold"
            >
              <span>{isTamil ? 'கூகிள் வரைபடத்தில் கண்காணிக்க' : 'Track Live on Google Maps'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/transport/my-requests"
              className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1.5 py-2.5"
            >
              <span>{isTamil ? 'என் அனைத்து சரக்குகளையும் காண்க' : 'View All My Shipments'}</span>
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}
