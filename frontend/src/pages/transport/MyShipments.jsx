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
  RefreshCw
} from 'lucide-react'
import { myTransportRequests } from '../../services/api.js'

const STATUS_CONFIG = {
  REQUESTED: { label: 'Finding Vehicle', color: 'bg-amber-100 text-amber-800 border-amber-300', pulse: true },
  ASSIGNED: { label: 'Vehicle Assigned', color: 'bg-blue-100 text-blue-800 border-blue-300', pulse: false },
  IN_TRANSIT: { label: 'On Road (Live GPS)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', pulse: true },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', pulse: false },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-300', pulse: false },
}

export default function MyShipments() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-leaf-700" />
            Shipment Logistics & Tracking
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitor freight consignments, dispatch timelines, and live driver GPS positions.
          </p>
        </div>
        <Link to="/transport/request" className="btn-primary text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          Request New Transport
        </Link>
      </div>

      {/* Search Bar */}
      <div className="card p-3.5 mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 ml-1 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search by shipment #, route, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm bg-transparent border-none outline-none text-gray-800 placeholder-gray-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600 px-2">
            Clear
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-6 animate-pulse space-y-4">
              <div className="h-5 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 px-4">
          <div className="w-16 h-16 bg-leaf-50 text-leaf-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Shipments Found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            {requests.length === 0
              ? "You haven't requested any vehicle dispatches yet."
              : 'No transport requests match your search criteria.'}
          </p>
          <Link to="/transport/request" className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Request Transport Dispatch
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((r) => {
            const st = STATUS_CONFIG[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700 border-gray-300' }
            const isInTransit = r.status === 'IN_TRANSIT'

            return (
              <Link
                key={r.id}
                to={`/transport/track/${r.id}`}
                className="card p-5 block hover:shadow-md hover:border-leaf-300 transition-all border border-gray-100 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-leaf-50 text-leaf-700 flex items-center justify-center font-bold text-xs">
                        #{r.id}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap font-bold text-gray-900 group-hover:text-leaf-700 transition">
                        <span>{r.pickup_location}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        <span>{r.destination_location}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pl-10">
                      <span className="flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-gray-400" />
                        <b>{Number(r.weight_kg)} kg</b>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        Required: {new Date(r.required_by).toLocaleDateString()}
                      </span>
                      {r.assigned_vehicle && (
                        <span className="flex items-center gap-1 text-leaf-700 font-semibold">
                          <Truck className="w-3.5 h-3.5" />
                          {r.assigned_vehicle.vehicle_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${st.color} flex items-center gap-1.5`}>
                      {st.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>}
                      {st.label}
                    </span>
                    <span className="text-xs font-semibold text-leaf-700 flex items-center gap-1 group-hover:underline">
                      Track Live <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

