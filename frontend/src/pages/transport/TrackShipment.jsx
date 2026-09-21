import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { trackTransportRequest } from '../../services/api.js'
import GoogleMapTracker from '../../components/GoogleMapTracker.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { 
  Truck, 
  MapPin, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  Navigation, 
  RotateCw, 
  AlertCircle, 
  Package, 
  Calendar, 
  ExternalLink,
  Warehouse,
  Info
} from 'lucide-react'

function getStageIndex(status) {
  if (['PENDING', 'REQUESTED'].includes(status)) return 0
  if (['ASSIGNED', 'ACCEPTED'].includes(status)) return 1
  if (['PICKUP', 'IN_TRANSIT'].includes(status)) return 2
  if (['DELIVERED'].includes(status)) return 3
  return -1
}

function timeAgo(isoString, isTamil) {
  if (!isoString) return isTamil ? 'சமீபத்தில்' : 'recently'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return isTamil ? 'சற்றுமுன்' : 'just now'
  if (mins < 60) return isTamil ? `${mins} நிமிடங்களுக்கு முன்` : `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return isTamil ? `${hrs} மணி நேரத்திற்கு முன்` : `${hrs} hr ago`
}

export default function TrackShipment() {
  const { id } = useParams()
  const { t, isTamil } = useLanguage()
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const STATUS_CONFIG = {
    PENDING: { label: isTamil ? 'விண்ணப்பம் உறுதி செய்யப்பட்டது (வாகனம் தேடப்படுகிறது)' : 'Application Confirmed (Matching Carrier)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    REQUESTED: { label: isTamil ? 'கோரிக்கை பதிவு செய்யப்பட்டது (வாகனம் தேடப்படுகிறது)' : 'Requested (Matching Carrier)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    ACCEPTED: { label: isTamil ? 'ஓட்டுநர் ஏற்றுக்கொண்டார்' : 'Carrier Accepted', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    ASSIGNED: { label: isTamil ? 'வாகனம் நியமிக்கப்பட்டது' : 'Vehicle Assigned', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    PICKUP: { label: isTamil ? 'சரக்கு ஏற்றப்பட்டது' : 'Picked Up', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    IN_TRANSIT: { label: isTamil ? 'வழியில் உள்ளது (நேரடி ஜிபிஎஸ்)' : 'In Transit (Live GPS)', badge: 'badge-transit' },
    DELIVERED: { label: isTamil ? 'விநியோகிக்கப்பட்டது' : 'Delivered', badge: 'badge-actual' },
    CANCELLED: { label: isTamil ? 'ரத்து செய்யப்பட்டது' : 'Cancelled', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  }

  const TRACKING_STEPS = [
    { key: 'CONFIRMED', label: isTamil ? 'ஆர்டர் உறுதி செய்யப்பட்டது' : 'Order Confirmed', statuses: ['PENDING', 'REQUESTED'] },
    { key: 'ASSIGNED', label: isTamil ? 'ஓட்டுநர் நியமிக்கப்பட்டார்' : 'Carrier Assigned', statuses: ['ASSIGNED', 'ACCEPTED'] },
    { key: 'IN_TRANSIT', label: isTamil ? 'வழியில் உள்ளது' : 'In Transit', statuses: ['PICKUP', 'IN_TRANSIT'] },
    { key: 'DELIVERED', label: isTamil ? 'விநியோகிக்கப்பட்டது' : 'Delivered', statuses: ['DELIVERED'] },
  ]

  const load = useCallback(() => {
    setRefreshing(true)
    trackTransportRequest(id)
      .then((res) => setRequest(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load tracking info.'))
      .finally(() => setRefreshing(false))
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000) // auto-refresh every 15s
    return () => clearInterval(interval)
  }, [load])

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
        <Link to="/transport/my-requests" className="btn-secondary text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to My Shipments
        </Link>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        <div className="h-6 w-32 skeleton rounded-lg" />
        <div className="card h-40 skeleton rounded-2xl" />
        <div className="card h-64 skeleton rounded-2xl" />
      </div>
    )
  }

  const vehicle = request.assigned_vehicle
  const hasLocation = vehicle && vehicle.current_latitude != null && vehicle.current_longitude != null
  const currentStageIndex = getStageIndex(request.status)
  const isWarehouseDelivery = 
    request.destination_location?.toLowerCase().includes('warehouse') || 
    request.destination_location?.toLowerCase().includes('wh-') ||
    request.destination_location?.toLowerCase().includes('regulated market') ||
    request.destination_location?.toLowerCase().includes('logistics hub')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Back Link & Live Refresh Header */}
      <div className="flex items-center justify-between">
        <Link 
          to="/transport/my-requests" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {isTamil ? 'சரக்கு பக்கத்திற்கு திரும்பு' : 'Back to Shipments'}
        </Link>

        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-leaf-600' : ''}`} />
          <span>{refreshing ? (isTamil ? 'புதுப்பிக்கப்படுகிறது…' : 'Refreshing…') : (isTamil ? 'வரைபடத்தை புதுப்பி' : 'Refresh Map')}</span>
        </button>
      </div>

      {/* Shipment Status & Route Card */}
      <div className="card p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="label text-[10px]">
              {isWarehouseDelivery 
                ? (isTamil ? 'பண்ணை-கிடங்கு போக்குவரத்து உதவி' : 'Farm-to-Warehouse Transport Assistance') 
                : (isTamil ? 'நேரடி சரக்கு கண்காணிப்பு' : 'Real-Time Freight Tracking')}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {isTamil ? `சரக்கு #${request.id}` : `Shipment #${request.id}`}
            </h1>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full border self-start sm:self-center ${STATUS_CONFIG[request.status]?.badge || 'bg-slate-100 text-slate-700'}`}>
            {STATUS_CONFIG[request.status]?.label || request.status}
          </span>
        </div>

        {/* Stepper Bar */}
        {request.status !== 'CANCELLED' && currentStageIndex !== -1 && (
          <div className="py-2">
            <div className="grid grid-cols-4 text-center text-xs font-semibold text-slate-500 mb-2 gap-1">
              {TRACKING_STEPS.map((stg, sIdx) => {
                const isDone = sIdx <= currentStageIndex
                const isCurrent = sIdx === currentStageIndex

                return (
                  <div key={stg.key} className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                      isCurrent
                        ? 'bg-leaf-600 text-white ring-4 ring-leaf-100 scale-110'
                        : isDone
                        ? 'bg-leaf-600 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : sIdx + 1}
                    </div>
                    <span className={`text-[11px] truncate max-w-full ${isCurrent ? 'text-leaf-800 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'}`}>
                      {stg.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-leaf-600 rounded-full transition-all duration-500" 
                style={{ width: `${((currentStageIndex + 1) / TRACKING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Route Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-100">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="label text-[10px] mb-0.5">
                {isWarehouseDelivery ? (isTamil ? 'பண்ணை பிக்கப் (உழவர் இடம்)' : 'Farm Gate Pickup (Farmer Location)') : (isTamil ? 'பிக்கப் இடம் (மாவட்ட கிடங்கு)' : 'Pickup Location (District Warehouse)')}
              </span>
              <p className="text-sm font-bold text-slate-900">{request.pickup_location}</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-2.5 p-3 rounded-xl bg-purple-50/70 border border-purple-100">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                {isWarehouseDelivery ? <Warehouse className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              </div>
              <div>
                <span className="label text-[10px] mb-0.5 text-purple-800 font-extrabold uppercase">
                  {isWarehouseDelivery ? (isTamil ? 'இலக்கு மாவட்ட மத்திய கிடங்கு' : 'Destination District Central Warehouse') : (isTamil ? 'வாங்குபவர் இலக்கு இடம்' : 'Buyer Destination Drop')}
                </span>
                <p className="text-sm font-bold text-slate-900">{request.destination_location}</p>
              </div>
            </div>
            {request.destination_location && (
              <a
                href={
                  request.destination_latitude && request.destination_longitude
                    ? `https://www.google.com/maps/dir/?api=1&destination=${request.destination_latitude},${request.destination_longitude}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(request.destination_location + ', Tamil Nadu, India')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{isTamil ? 'வழிசெலுத்து' : 'Navigate'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {isWarehouseDelivery && (
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{isTamil ? 'பண்ணை-கிடங்கு விநியோக செயல்முறை: ' : 'Farm-to-Warehouse Delivery Flow: '}</span>
              <span>
                {isTamil 
                  ? 'நியமிக்கப்பட்ட சரக்குந்து உங்கள் பண்ணைக்கு வந்து விளைபொருட்களை ஏற்றுக்கொண்டு மாவட்ட மத்திய கிடங்கிற்கு விநியோகிக்கும். கிடங்கு ஊழியர்கள் எடையை சரிபார்த்து வாங்குபவர் ஆர்டர்களுக்கு நேரலை செய்வர்.' 
                  : 'The assigned carrier will collect your produce from your farm gate and deliver it directly to your District Central Warehouse. On arrival, warehouse staff will verify weight on the electronic weighbridge, conduct quality grading, and make it live for buyer orders.'}
              </span>
            </div>
          </div>
        )}

        {/* Specs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-slate-400" />
            {isTamil ? 'சரக்கு எடை:' : 'Cargo:'} <b>{Number(request.weight_kg)} {isTamil ? 'கிலோ' : 'kg'}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            {isTamil ? 'தேவைப்படும் நேரம்:' : 'Needed By:'} <b>{new Date(request.required_by).toLocaleString()}</b>
          </span>
          {request.notes && (
            <span className="text-slate-400 italic">
              "{request.notes}"
            </span>
          )}
        </div>

      </div>

      {/* Live Map & Vehicle Info */}
      <div className="card p-6 sm:p-8 border border-slate-200/80 shadow-soft">
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-slate-900">{isTamil ? 'கூகிள் வரைபட நேரலை கண்காணிப்பு' : 'Google Maps Live Tracking'}</h2>
          </div>
          <span className="badge-actual">{isTamil ? 'கூகிள் வரைபடம் & நேரடி ஜிபிஎஸ்' : 'Google Maps Satellite & Telemetry'}</span>
        </div>

        <div className="space-y-4">
          {/* Vehicle meta banner or assignment status */}
          {vehicle ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-xl gap-2">
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {vehicle.name} <span className="text-purple-700 font-extrabold">({vehicle.vehicle_number})</span>
                </p>
                <p className="text-xs text-slate-500">{vehicle.vehicle_type} · {isTamil ? 'கொள்ளளவு:' : 'Capacity:'} {Number(vehicle.capacity_kg)} {isTamil ? 'கிலோ' : 'kg'}</p>
              </div>

              {hasLocation ? (
                <div className="text-xs sm:text-right">
                  <span className="text-purple-900 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                    {vehicle.location_label || (isTamil ? 'ஜிபிஎஸ் செயல்படுகிறது' : 'GPS Active')}
                  </span>
                  <span className="text-slate-400 text-[11px]">{isTamil ? 'புதுப்பிக்கப்பட்டது' : 'Updated'} {timeAgo(vehicle.location_updated_at, isTamil)}</span>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-medium">
                  {isTamil ? 'ஓட்டுநர் நியமிக்கப்பட்டார் · பயணம் தொடங்கியவுடன் நேரடி ஜிபிஎஸ் செயல்படும்' : 'Transporter assigned · Live GPS active once trip commences'}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
              <span className="font-medium">{isTamil ? 'அருகிலுள்ள ஓட்டுநர் தேடப்படுகிறது. திட்டமிடப்பட்ட வழித்தடம் மற்றும் இலக்கு:' : 'Matching nearest transporter. Showing planned route & buyer destination:'}</span>
              <span className="text-amber-900 font-bold">{request.destination_location}</span>
            </div>
          )}

          {/* Real Interactive Google Maps Tracking (Always Active) */}
          <GoogleMapTracker
            vehicle={vehicle}
            pickupLocation={request.pickup_location}
            pickupLat={request.pickup_latitude}
            pickupLng={request.pickup_longitude}
            destinationLocation={request.destination_location}
            destinationLat={request.destination_latitude}
            destinationLng={request.destination_longitude}
            status={request.status}
            height={460}
          />

          <p className="text-[11px] text-slate-400 text-center">
            {isTamil ? 'வரைபட வழித்தடம் மற்றும் நேரடி இருப்பிடம் ஒவ்வொரு 15 வினாடிகளுக்கும் தானாகவே புதுப்பிக்கப்படும்.' : 'Map route and live location refresh automatically every 15 seconds.'}
          </p>
        </div>

      </div>

    </div>
  )
}

