import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Edit3, 
  Compass, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Play,
  Check
} from 'lucide-react'
import { assignedTransportRequests, updateTransportStatus, updateVehicleLocation } from '../../services/api.js'

const NEXT_STATUS = {
  ASSIGNED: [{ label: 'Start Trip (In Transit)', value: 'IN_TRANSIT', icon: Play, primary: true }, { label: 'Cancel', value: 'CANCELLED', icon: AlertCircle, primary: false }],
  IN_TRANSIT: [{ label: 'Mark Delivered', value: 'DELIVERED', icon: Check, primary: true }],
}

function earliestDeliveryTime(request) {
  if (!request.in_transit_at || request.estimated_transit_minutes == null) return null
  return new Date(new Date(request.in_transit_at).getTime() + request.estimated_transit_minutes * 60000)
}

export default function TransporterDashboard() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [locStatus, setLocStatus] = useState('')
  const [locLoading, setLocLoading] = useState(false)
  const [error, setError] = useState('')

  // Manual override / place-search fallback state
  const [showManual, setShowManual] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState([])
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [searching, setSearching] = useState(false)

  const load = () => {
    setLoading(true)
    assignedTransportRequests()
      .then((res) => setRequests(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Re-render every 30s so the "Mark Delivered" button unlocks itself the
  // moment the estimated transit time actually elapses, without a manual refresh.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleStatusChange = async (id, newStatus) => {
    setError('')
    setUpdatingId(id)
    try {
      await updateTransportStatus(id, newStatus)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const saveLocation = async (latitude, longitude, label) => {
    try {
      await updateVehicleLocation({ latitude, longitude, location_label: label })
      setLocStatus(`GPS broadcasted: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)} (${label})`)
    } catch (err) {
      setLocStatus('Could not save location to the server.')
    }
  }

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Your browser does not support location sharing.')
      return
    }
    setLocLoading(true)
    setLocStatus('Accessing device GPS coordinates...')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocLoading(false)
        const isLowConfidence = pos.coords.accuracy > 5000
        await saveLocation(
          pos.coords.latitude, pos.coords.longitude,
          isLowConfidence ? `Approximate (±${Math.round(pos.coords.accuracy / 1000)}km, low confidence)` : 'Live GPS fix'
        )
        if (isLowConfidence) {
          setShowManual(true)
        }
      },
      () => {
        setLocLoading(false)
        setLocStatus('Location permission denied.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handlePlaceSearch = async (e) => {
    e.preventDefault()
    if (!placeQuery.trim()) return
    setSearching(true)
    setPlaceResults([])
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeQuery)}&limit=5`,
        { headers: { Accept: 'application/json' } }
      )
      const data = await res.json()
      setPlaceResults(data)
    } catch (err) {
      setLocStatus('Could not search for that place right now.')
    } finally {
      setSearching(false)
    }
  }

  const handlePickPlace = async (place) => {
    await saveLocation(place.lat, place.lon, place.display_name.split(',').slice(0, 2).join(','))
    setPlaceResults([])
    setPlaceQuery('')
    setShowManual(false)
  }

  const handleManualSave = async (e) => {
    e.preventDefault()
    if (!manualLat || !manualLng) return
    await saveLocation(Number(manualLat), Number(manualLng), 'Manually entered')
    setShowManual(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 mb-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-700/50 text-sky-200 text-xs font-semibold mb-3 border border-sky-600/50">
              <Compass className="w-3.5 h-3.5 text-sky-300" />
              Fleet Dispatch & Real-Time Telemetry
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">Transporter Fleet Hub</h1>
            <p className="text-sky-200 text-sm mt-1 max-w-xl">
              Broadcast vehicle GPS coordinates to buyers and update consignment delivery progress in real time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleShareLocation}
              disabled={locLoading}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-sky-950 font-bold text-sm flex items-center gap-2 transition shadow-md disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 ${locLoading ? 'animate-spin' : ''}`} />
              {locLoading ? 'Locating...' : 'Broadcast Live GPS'}
            </button>
            <button
              onClick={() => setShowManual((s) => !s)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold flex items-center gap-2 transition backdrop-blur-sm border border-white/10"
            >
              <Edit3 className="w-4 h-4" />
              Manual Point
            </button>
          </div>
        </div>
      </div>

      {/* GPS Status Toast */}
      {locStatus && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-sky-600 animate-pulse" />
          <span>{locStatus}</span>
        </div>
      )}

      {/* Manual Geocode / Coordinate Input Fallback */}
      {showManual && (
        <div className="card p-5 mb-6 border border-sky-200 bg-sky-50/40 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-600" /> Set Vehicle Location Manually
            </h3>
            <button onClick={() => setShowManual(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Search town or district name, or paste latitude and longitude coordinates from your GPS navigation app.
          </p>

          <form onSubmit={handlePlaceSearch} className="flex gap-2 mb-3">
            <input
              className="input flex-1"
              placeholder="e.g. Surandai, Tenkasi, Tamil Nadu"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            <button className="btn-secondary text-sm whitespace-nowrap" type="submit" disabled={searching}>
              {searching ? 'Searching...' : 'Search Town'}
            </button>
          </form>

          {placeResults.length > 0 && (
            <ul className="text-xs divide-y border border-gray-200 rounded-xl bg-white mb-4 overflow-hidden shadow-sm">
              {placeResults.map((p, idx) => (
                <li
                  key={idx}
                  className="p-3 hover:bg-sky-50 cursor-pointer flex items-center justify-between text-gray-700"
                  onClick={() => handlePickPlace(p)}
                >
                  <span className="truncate pr-2">{p.display_name}</span>
                  <span className="text-[11px] font-bold text-sky-700 shrink-0">Select</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-3 border-t border-sky-200/60">
            <p className="text-xs text-gray-500 mb-2">— Or enter numerical coordinates directly —</p>
            <form onSubmit={handleManualSave} className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="label text-xs">Latitude</label>
                <input
                  className="input w-36 text-xs"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 8.9723"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Longitude</label>
                <input
                  className="input w-36 text-xs"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 77.4258"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <button className="btn-primary text-xs py-2.5 px-4" type="submit">
                Save Coordinates
              </button>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      {/* Shipment Assignments */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold font-display text-lg text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-700" />
            Assigned Cargo Consignments
          </h2>
          <p className="text-xs text-gray-500">Trips automatically routed to your vehicle's payload capacity</p>
        </div>
        <button
          onClick={load}
          className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Trips
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-6 animate-pulse space-y-4">
              <div className="h-5 bg-gray-200 rounded w-1/4"></div>
              <div className="h-12 bg-gray-100 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16 px-4">
          <div className="w-16 h-16 bg-sky-50 text-sky-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Active Trips Assigned</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            You currently have no pending shipments. As buyers and farmers place crop orders matching your vehicle's capacity, they will show up here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const actions = NEXT_STATUS[r.status] || []
            const eta = earliestDeliveryTime(r)
            const deliveryLocked = r.status === 'IN_TRANSIT' && eta && new Date() < eta

            return (
              <div key={r.id} className="card p-6 border border-gray-100 hover:shadow-md transition">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-sm">
                      #{r.id}
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">Shipment Consignment #{r.id}</p>
                      <p className="text-xs text-gray-400">
                        Weight: <b className="text-gray-700">{Number(r.weight_kg)} kg</b>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge-actual">{r.status}</span>
                    <Link
                      to={`/transport/track/${r.id}`}
                      className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1 ml-2"
                    >
                      View GPS Map <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Route Route Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-100 mb-4 text-xs">
                  <div>
                    <span className="text-gray-400 block mb-0.5">Pickup Location</span>
                    <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-leaf-600 shrink-0" />
                      {r.pickup_location}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Destination</span>
                    <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                      {r.destination_location}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Required Delivery By</span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(r.required_by).toLocaleString()}
                    </span>
                  </div>
                  {r.notes && (
                    <div>
                      <span className="text-gray-400 block mb-0.5">Special Instructions</span>
                      <span className="text-gray-600 italic">{r.notes}</span>
                    </div>
                  )}
                </div>

                {/* Distance-based Lock Warning */}
                {eta && (
                  <div
                    className={`rounded-xl p-3.5 text-xs mb-4 flex items-start gap-2.5 border ${
                      deliveryLocked
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      {deliveryLocked ? (
                        <>
                          <p className="font-bold">Minimum Transit Time Enforced</p>
                          <p className="mt-0.5">
                            Earliest possible delivery: <b>{eta.toLocaleString()}</b> (calculated from road distance). 'Mark Delivered' unlocks automatically once this time elapses.
                          </p>
                        </>
                      ) : (
                        <p className="font-semibold">
                          Estimated transit duration has elapsed. Consignment can now be marked delivered upon arrival.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Status Action Buttons */}
                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-2 border-t border-gray-100">
                    {actions.map((a) => {
                      const isDeliveredAction = a.value === 'DELIVERED'
                      const disabled = updatingId === r.id || (isDeliveredAction && deliveryLocked)
                      const Icon = a.icon || Play

                      return (
                        <button
                          key={a.value}
                          disabled={disabled}
                          title={isDeliveredAction && deliveryLocked ? `Available after ${eta.toLocaleTimeString()}` : undefined}
                          onClick={() => handleStatusChange(r.id, a.value)}
                          className={
                            a.value === 'CANCELLED'
                              ? 'text-red-600 text-xs font-semibold px-4 py-2 hover:bg-red-50 rounded-xl transition disabled:opacity-40'
                              : a.primary
                              ? 'btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
                              : 'btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
                          }
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {updatingId === r.id ? 'Updating...' : a.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

