import React, { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { trackTransportRequest } from '../../services/api.js'
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
  Calendar
} from 'lucide-react'

const STATUS_CONFIG = {
  PENDING: { label: 'Order Confirmed (Matching Transporter)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  REQUESTED: { label: 'Requested (Matching Transporter)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED: { label: 'Transporter Accepted', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  ASSIGNED: { label: 'Vehicle Assigned', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  PICKUP: { label: 'Picked Up from Warehouse', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  IN_TRANSIT: { label: 'In Transit to Destination', badge: 'badge-transit' },
  DELIVERED: { label: 'Delivered', badge: 'badge-actual' },
  CANCELLED: { label: 'Cancelled', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const TRACKING_STEPS = [
  { key: 'CONFIRMED', label: 'Order Confirmed', statuses: ['PENDING', 'REQUESTED'] },
  { key: 'ASSIGNED', label: 'Carrier Assigned', statuses: ['ASSIGNED', 'ACCEPTED'] },
  { key: 'IN_TRANSIT', label: 'In Transit', statuses: ['PICKUP', 'IN_TRANSIT'] },
  { key: 'DELIVERED', label: 'Delivered', statuses: ['DELIVERED'] },
]

function getStageIndex(status) {
  if (['PENDING', 'REQUESTED'].includes(status)) return 0
  if (['ASSIGNED', 'ACCEPTED'].includes(status)) return 1
  if (['PICKUP', 'IN_TRANSIT'].includes(status)) return 2
  if (['DELIVERED'].includes(status)) return 3
  return -1
}

function timeAgo(isoString) {
  if (!isoString) return 'recently'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hr ago`
}

export default function TrackShipment() {
  const { id } = useParams()
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Back Link & Live Refresh Header */}
      <div className="flex items-center justify-between">
        <Link 
          to="/transport/my-requests" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Shipments
        </Link>

        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-leaf-600' : ''}`} />
          <span>{refreshing ? 'Refreshing…' : 'Refresh Map'}</span>
        </button>
      </div>

      {/* Shipment Status & Route Card */}
      <div className="card p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="label text-[10px]">Real-Time Tracking</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Shipment #{request.id}
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
              <span className="label text-[10px] mb-0.5">Pickup Location (District Warehouse)</span>
              <p className="text-sm font-bold text-slate-900">{request.pickup_location}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <span className="label text-[10px] mb-0.5">Delivery Destination</span>
              <p className="text-sm font-bold text-slate-900">{request.destination_location}</p>
            </div>
          </div>
        </div>

        {/* Specs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-slate-400" />
            Cargo: <b>{Number(request.weight_kg)} kg</b>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            Needed By: <b>{new Date(request.required_by).toLocaleString()}</b>
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
            <h2 className="text-lg font-bold text-slate-900">Vehicle & GPS Position</h2>
          </div>
          <span className="badge-actual">Hardware GPS Feed</span>
        </div>

        {!vehicle ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">Awaiting Transporter Assignment</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Vehicles with suitable capacity are auto-matched based on proximity to the pickup point.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Vehicle meta banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-purple-50/50 border border-purple-100 rounded-xl gap-2">
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {vehicle.name} <span className="text-purple-700 font-extrabold">({vehicle.vehicle_number})</span>
                </p>
                <p className="text-xs text-slate-500">{vehicle.vehicle_type} · Capacity: {Number(vehicle.capacity_kg)} kg</p>
              </div>

              {hasLocation && (
                <div className="text-xs sm:text-right">
                  <span className="text-purple-900 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                    {vehicle.location_label || 'GPS Active'}
                  </span>
                  <span className="text-slate-400 text-[11px]">Updated {timeAgo(vehicle.location_updated_at)}</span>
                </div>
              )}
            </div>

            {/* Interactive OpenStreetMap Container */}
            {hasLocation ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative" style={{ height: 360 }}>
                <iframe
                  title="Live vehicle location"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(vehicle.current_longitude) - 0.02}%2C${Number(vehicle.current_latitude) - 0.02}%2C${Number(vehicle.current_longitude) + 0.02}%2C${Number(vehicle.current_latitude) + 0.02}&layer=mapnik&marker=${vehicle.current_latitude}%2C${vehicle.current_longitude}`}
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No GPS Coordinates Transmitted Yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  The driver hasn't broadcasted their GPS position yet. The map will load automatically once shared.
                </p>
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center">
              Tracking refreshes automatically every 15 seconds.
            </p>

          </div>
        )}

      </div>

    </div>
  )
}

