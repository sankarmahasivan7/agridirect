import React, { useState } from 'react'
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
  RefreshCw
} from 'lucide-react'
import { createTransportRequest } from '../../services/api.js'

export default function RequestTransport() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    pickup_location: '', 
    destination_location: '', 
    required_by: '', 
    weight_kg: '', 
    notes: '',
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

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
      setError(err.response?.data?.detail || 'Could not create transport request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold mb-3 border border-sky-200">
          <Truck className="w-3.5 h-3.5" />
          Automated Freight Dispatch Engine
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">
          Request Transport Dispatch
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Our intelligent logistics engine auto-matches verified local carriers whose payload capacity fits your agricultural produce.
        </p>
      </div>

      {/* Form Card */}
      <div className="card p-6 mb-6 shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-leaf-600" />
                Pickup Location / Farm Point *
              </label>
              <input
                className="input"
                required
                placeholder="e.g. Surandai Farm Gate 2, Tenkasi"
                value={form.pickup_location}
                onChange={set('pickup_location')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-600" />
                Destination / Mandi / Store *
              </label>
              <input
                className="input"
                required
                placeholder="e.g. Madurai Central Market, Madurai"
                value={form.destination_location}
                onChange={set('destination_location')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-500" />
                Needed By Date & Time *
              </label>
              <input
                className="input"
                type="datetime-local"
                required
                value={form.required_by}
                onChange={set('required_by')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-gray-500" />
                Total Cargo Weight (kg) *
              </label>
              <input
                className="input"
                type="number"
                min="1"
                required
                placeholder="e.g. 850"
                value={form.weight_kg}
                onChange={set('weight_kg')}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-gray-500" />
                Handling Notes & Instructions (Optional)
              </label>
              <input
                className="input"
                placeholder="e.g. Perishable ripe tomatoes, please keep crates shaded and ventilated."
                value={form.notes}
                onChange={set('notes')}
              />
            </div>
          </div>

          <button
            className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2 font-bold shadow-md"
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Matching Vehicles in Fleet...
              </>
            ) : (
              <>
                <Truck className="w-4 h-4" />
                Request Freight Carrier
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Dispatch Request Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="card p-6 border border-emerald-200 bg-emerald-50/30 shadow-md animate-fade-in">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-gray-900">Dispatch Order #{result.id} Created</h2>
            </div>
            <span className={result.status === 'ASSIGNED' ? 'badge-actual' : 'badge-demo'}>
              {result.status}
            </span>
          </div>

          {result.assigned_vehicle ? (
            <div className="bg-white p-4 rounded-xl border border-emerald-200 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matched Vehicle</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Ready for Dispatch
                </span>
              </div>
              <p className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Truck className="w-4 h-4 text-leaf-700" />
                {result.assigned_vehicle.name} ({result.assigned_vehicle.vehicle_number})
              </p>
              <p className="text-xs text-gray-600">
                Vehicle Capacity: <b>{Number(result.assigned_vehicle.capacity_kg)} kg</b> (fits your {form.weight_kg} kg cargo load)
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-800 mb-4">
              <p className="font-semibold">Queued for Vehicle Matching</p>
              <p className="mt-0.5">
                No carrier matching {form.weight_kg} kg is free right now. Your request is queued and will automatically pair as soon as a suitable carrier completes their current trip.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/transport/my-requests')}
              className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5"
            >
              View My Shipments <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setResult(null)
                setForm({ pickup_location: '', destination_location: '', required_by: '', weight_kg: '', notes: '' })
              }}
              className="btn-secondary text-xs flex-1"
            >
              Book Another Dispatch
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

