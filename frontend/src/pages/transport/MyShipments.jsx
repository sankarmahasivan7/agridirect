import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Truck, 
  MapPin, 
  Calendar, 
  Scale, 
  ArrowRight, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  Navigation,
  ChevronRight,
  RefreshCw,
  Warehouse,
  Phone,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { myTransportRequests } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

const DISTRICT_WAREHOUSES = [
  {
    district: 'Tenkasi',
    districtTa: 'தென்காசி',
    name: 'Tenkasi Central Agri-Warehouse',
    nameTa: 'தென்காசி மத்திய வேளாண் கிடங்கு',
    code: 'WH-TKS-01',
    address: 'Tenkasi Regulated Market Complex, Old Bus Stand Road, Tenkasi - 627811',
    phone: '+91 4633 222100',
    hours: '06:00 AM - 08:00 PM',
    lat: 8.9594,
    lon: 77.3167,
  },
  {
    district: 'Tirunelveli',
    districtTa: 'திருநெல்வேலி',
    name: 'Tirunelveli Central Agri-Warehouse',
    nameTa: 'திருநெல்வேலி மத்திய வேளாண் கிடங்கு',
    code: 'WH-TNV-01',
    address: 'Tirunelveli Agro-Logistics Hub, Bypass Road, Tirunelveli - 627005',
    phone: '+91 462 2334100',
    hours: '06:00 AM - 08:00 PM',
    lat: 8.7139,
    lon: 77.7567,
  },
  {
    district: 'Thoothukudi',
    districtTa: 'தூத்துக்குடி',
    name: 'Thoothukudi Central Agri-Warehouse',
    nameTa: 'தூத்துக்குடி மத்திய வேளாண் கிடங்கு',
    code: 'WH-TUT-01',
    address: 'Port-Agri Warehousing Center, Harbour Express Highway, Thoothukudi - 628004',
    phone: '+91 461 2352100',
    hours: '06:00 AM - 08:00 PM',
    lat: 8.7642,
    lon: 78.1348,
  },
]

export default function MyShipments() {
  const { role, user } = useAuth()
  const { t, isTamil } = useLanguage()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const isFarmer = role === 'farmer'

  const STATUS_CONFIG = {
    PENDING: { label: isTamil ? 'சரக்குந்து தேடப்படுகிறது' : 'Finding Transporter', color: 'bg-amber-100 text-amber-800 border-amber-300', pulse: true },
    REQUESTED: { label: isTamil ? 'சரக்குந்து தேடப்படுகிறது' : 'Finding Transporter', color: 'bg-amber-100 text-amber-800 border-amber-300', pulse: true },
    ACCEPTED: { label: isTamil ? 'ஓட்டுநர் நியமிக்கப்பட்டார்' : 'Transporter Assigned', color: 'bg-blue-100 text-blue-800 border-blue-300', pulse: false },
    ASSIGNED: { label: isTamil ? 'ஓட்டுநர் நியமிக்கப்பட்டார்' : 'Transporter Assigned', color: 'bg-blue-100 text-blue-800 border-blue-300', pulse: false },
    PICKUP: { label: isTamil ? 'சரக்கு ஏற்றப்பட்டது' : 'Picked Up', color: 'bg-purple-100 text-purple-800 border-purple-300', pulse: true },
    IN_TRANSIT: { label: isTamil ? 'வழியில் உள்ளது (நேரடி ஜிபிஎஸ்)' : 'In Transit (Live GPS)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', pulse: true },
    DELIVERED: { label: isTamil ? 'கிடங்கிற்கு வழங்கப்பட்டது' : 'Delivered to Warehouse', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', pulse: false },
    CANCELLED: { label: isTamil ? 'ரத்து செய்யப்பட்டது' : 'Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-300', pulse: false },
  }

  const loadData = () => {
    setLoading(true)
    myTransportRequests()
      .then((res) => setRequests(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase()
    return (
      String(r.id).includes(q) ||
      r.pickup_location.toLowerCase().includes(q) ||
      r.destination_location.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold mb-2 border border-purple-200">
            <Warehouse className="w-3.5 h-3.5" />
            <span>{isTamil ? 'மாவட்ட கிடங்கு போக்குவரத்து & வாகன கண்காணிப்பு' : 'District Warehouse Logistics & Fleet Tracking'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">
            {isFarmer 
              ? (isTamil ? 'கிடங்கு விநியோகம் & போக்குவரத்து' : 'Warehouse Delivery & Transport') 
              : (isTamil ? 'சரக்கு போக்குவரத்து & டெலிவரிகள்' : 'Logistics & Shipments')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isFarmer 
              ? (isTamil ? 'மாவட்ட மத்திய கிடங்கிற்கு நேரடியாக விநியோகிக்கவும் (₹0 கட்டணம்) அல்லது பண்ணை பிக்கப் போக்குவரத்தை கண்காணிக்கவும்.' : 'Deliver directly to your District Central Warehouse (₹0 fee) or monitor assisted farm pickup transport.') 
              : (isTamil ? 'சரக்கு ஏற்றுமதி, விநியோக நிலைகள் மற்றும் நேரடி ஜிபிஎஸ் இருப்பிடங்களைக் கண்காணிக்கவும்.' : 'Monitor freight dispatches, delivery milestones, and live driver GPS positions.')}
          </p>
        </div>

        {isFarmer && (
          <Link 
            to="/transport/request" 
            className="btn-primary text-xs sm:text-sm inline-flex items-center justify-center gap-2 py-2.5 px-4 shadow-md font-bold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isTamil ? 'கிடங்கு போக்குவரத்திற்கு விண்ணப்பிக்கவும்' : 'Apply for Transport to Warehouse'}</span>
          </Link>
        )}
      </div>

      {/* Farmer Guidance: Direct Drop vs Assisted Transport */}
      {isFarmer && (
        <div className="space-y-4">
          
          {/* Option 1: Direct Warehouse Drop (₹0 Cost) */}
          <div className="card p-6 border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {isTamil ? 'விருப்பம் 1: நேரடி கிடங்கு விநியோகம் (சுயமாக கொண்டு வருதல்)' : 'Option 1: Direct Warehouse Delivery (Self-Drop)'}
                    </h2>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                      {isTamil ? '₹0 போக்குவரத்து கட்டணம் · இலவசம்' : '₹0 Transport Fee · Free'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isTamil ? 'டிராக்டர், வேன் அல்லது சொந்த வாகனம் இருந்தால் பரிந்துரைக்கப்படுகிறது.' : 'Recommended if you have a tractor, van, auto, or transport arrangement.'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 self-start sm:self-center">
                {isTamil ? 'உடனடி எடைமேடை & சந்தைப் பட்டியல்' : 'Instant Weighbridge & Listing'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isTamil 
                ? 'உழவர்கள் தங்கள் அறுவடை விளைபொருட்களை நியமிக்கப்பட்ட மாவட்ட மத்திய வேளாண் கிடங்கிற்கு நேரடியாகக் கொண்டு வரலாம். வந்தவுடன் மின்னணு எடைபோடுதல், தர ஆய்வு மற்றும் வாங்குபவர்களுக்கு எவ்வித கமிஷனும் இன்றி நேரடி சந்தை வெளியீடு செய்யப்படுகிறது.'
                : 'Farmers can deliver harvested produce directly to their designated District Central Agri-Warehouse. On arrival, enjoy instant electronic weighing, produce inspection grading, and immediate marketplace publication for buyers with zero platform transport deductions.'}
            </p>

            {/* 3 District Central Warehouses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {DISTRICT_WAREHOUSES.map((wh) => (
                <div 
                  key={wh.code} 
                  className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {isTamil ? wh.districtTa : wh.district}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{wh.code}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-xs mt-2">{isTamil ? wh.nameTa : wh.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{wh.address}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{wh.hours}</span>
                      </span>
                      <a href={`tel:${wh.phone}`} className="font-semibold text-emerald-700 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {isTamil ? 'அழைக்க' : 'Call'}
                      </a>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${wh.lat},${wh.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition"
                    >
                      <Navigation className="w-3 h-3 text-emerald-600" />
                      <span>{isTamil ? 'கிடங்கிற்கான வழித்தடம்' : 'Directions to Warehouse'}</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Option 2: Need Transport Assistance? */}
          <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white border border-purple-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-purple-950">
                  {isTamil ? 'விருப்பம் 2: வாகனம் இல்லையா? பண்ணை-கிடங்கு போக்குவரத்து உதவிக்கு விண்ணப்பிக்கவும்' : 'Option 2: No Vehicle? Apply for Farm-to-Warehouse Transport Assistance'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {isTamil
                    ? 'உங்களிடம் வாகன வசதி இல்லை என்றால், விண்ணப்பிக்கவும்; அக்ரிடயரக்ட் சரக்குந்து உங்கள் பண்ணைக்கே வந்து விளைபொருட்களை ஏற்றிக் கொண்டு செல்லும்.'
                    : 'If you do not have transport facilities, submit an application and our dispatch engine will send an AgriDirect carrier to collect your produce directly from your farm.'}
                </p>
              </div>
            </div>

            <Link
              to="/transport/request"
              className="btn-primary text-xs font-bold py-2.5 px-4 shrink-0 inline-flex items-center gap-1.5"
            >
              <span>{isTamil ? 'பண்ணை பிக்கப் பெறுக' : 'Apply for Farm Pickup'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      )}

      {/* Active Transport Requests List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isFarmer 
                ? (isTamil ? 'செயலில் உள்ள போக்குவரத்து விண்ணப்பங்கள்' : 'Active Transport Assistance Requests') 
                : (isTamil ? 'அனைத்து சரக்கு விநியோகங்கள்' : 'All Freight Shipments')}
            </h2>
            <p className="text-xs text-slate-500">
              {isTamil ? 'வாகன ஒதுக்கீடு, ஓட்டுநரின் ஜிபிஎஸ் வழித்தடம் மற்றும் விநியோக நிறைவை கண்காணிக்கவும்.' : 'Track vehicle pairing, driver transit coordinates, and delivery completion.'}
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={isTamil ? 'ஐடி, வழித்தடம், நிலை மூலம் தேடுக…' : 'Search by ID, route, status…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input text-xs pl-9 pr-8 py-2 w-full"
            />
            {search && (
              <button 
                onClick={() => setSearch('')} 
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="card p-6 space-y-3 skeleton rounded-2xl h-32" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12 px-4 border border-slate-200">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Truck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {search 
                ? (isTamil ? 'பொருந்தும் போக்குவரத்து எதுவும் இல்லை' : 'No Matching Transport Requests') 
                : (isTamil ? 'செயலில் உள்ள போக்குவரத்து எதுவும் இல்லை' : 'No Active Transport Requests')}
            </h3>
            <p className="text-slate-500 text-xs max-w-md mx-auto mb-5 leading-relaxed">
              {search 
                ? (isTamil ? 'வேறு வார்த்தையைத் தேடவும் அல்லது வடிகட்டலை அழிக்கவும்.' : 'Try adjusting your search keywords or clear the filter.') 
                : isFarmer 
                  ? (isTamil ? 'உங்கள் சொந்த வாகனத்தில் விளைபொருட்களை கொண்டு வந்தால் போக்குவரத்து கோரிக்கை தேவையில்லை! பண்ணை பிக்கப் தேவைப்பட்டால் கீழே விண்ணப்பிக்கவும்.' : 'If you deliver your harvest directly to the District Warehouse using your own vehicle, no transport request is required! If you need vehicle pickup from your farm, click below to apply.')
                  : (isTamil ? 'போக்குவரத்து தகவல்கள் எதுவும் கிடைக்கவில்லை.' : 'No transport dispatches found.')}
            </p>
            {isFarmer && (
              <Link to="/transport/request" className="btn-primary inline-flex items-center gap-2 text-xs font-bold">
                <Plus className="w-3.5 h-3.5" />
                <span>{isTamil ? 'கிடங்கு போக்குவரத்திற்கு விண்ணப்பிக்கவும்' : 'Apply for Transport to Warehouse'}</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const st = STATUS_CONFIG[r.status] || { 
                label: r.status, 
                color: 'bg-slate-100 text-slate-700 border-slate-300', 
                pulse: false 
              }

              return (
                <Link
                  key={r.id}
                  to={`/transport/track/${r.id}`}
                  className="card card-hover p-5 block border border-slate-200/80 shadow-2xs group transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                          #{r.id}
                        </span>

                        <div className="flex items-center gap-2 flex-wrap text-sm font-bold text-slate-900 group-hover:text-purple-700 transition">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{r.pickup_location}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          <span className="flex items-center gap-1">
                            <Warehouse className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                            <span>{r.destination_location}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pl-10">
                        <span className="flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5 text-slate-400" />
                          <span>{isTamil ? 'எடை:' : 'Weight:'} <b>{Number(r.weight_kg)} {isTamil ? 'கிலோ' : 'kg'}</b></span>
                        </span>

                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{isTamil ? 'தேவைப்படும் நாள்:' : 'Needed:'} <b>{new Date(r.required_by).toLocaleDateString()}</b></span>
                        </span>

                        {r.assigned_vehicle && (
                          <span className="flex items-center gap-1 text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                            <Truck className="w-3.5 h-3.5" />
                            <span>{r.assigned_vehicle.name} ({r.assigned_vehicle.vehicle_number})</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 shrink-0">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${st.color} flex items-center gap-1.5`}>
                        {st.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />}
                        <span>{st.label}</span>
                      </span>

                      <span className="text-xs font-bold text-purple-700 flex items-center gap-1 group-hover:underline">
                        <span>{isTamil ? 'நேரடி ஜிபிஎஸ்' : 'Live GPS Track'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
