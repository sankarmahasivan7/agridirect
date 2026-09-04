import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Layers, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  MapPin, 
  Scale, 
  IndianRupee, 
  Sparkles, 
  ShieldCheck,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import { createBulkRequirement } from '../../services/api.js'

export default function BulkOrder() {
  const [form, setForm] = useState({ 
    product_name: '', 
    required_quantity: '', 
    unit: 'kg', 
    needed_by: '', 
    delivery_location: '' 
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
      const res = await createBulkRequirement({
        ...form,
        required_quantity: Number(form.required_quantity),
        needed_by: form.needed_by || null,
      })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not process bulk requirement.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate percentage matched if result is available
  const matchPercent = result && Number(result.required_quantity) > 0
    ? Math.min(100, Math.round((Number(result.matched_quantity) / Number(result.required_quantity)) * 100))
    : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold mb-3 border border-purple-200">
          <Sparkles className="w-3.5 h-3.5" />
          Multi-Farm Supply Aggregation
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">
          Bulk Produce Procurement
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Specify your institutional or restaurant needs. Our algorithm aggregates real active farmer batches with transparent pricing and zero fake inventory.
        </p>
      </div>

      {/* Form Card */}
      <div className="card p-6 mb-6 shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-leaf-700" />
                Commodity / Crop Name *
              </label>
              <input
                className="input"
                required
                placeholder="e.g. Tomato, Onion, Basmati Rice, Potato"
                value={form.product_name}
                onChange={set('product_name')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-leaf-700" />
                Required Quantity *
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="e.g. 500"
                value={form.required_quantity}
                onChange={set('required_quantity')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                Unit of Measure *
              </label>
              <select className="input" value={form.unit} onChange={set('unit')}>
                <option value="kg">kg (Kilograms)</option>
                <option value="quintal">quintal (100 kg)</option>
                <option value="tonne">tonne (1,000 kg)</option>
                <option value="crate">crate (approx. 25 kg)</option>
                <option value="dozen">dozen</option>
              </select>
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-500" />
                Required By Date (Optional)
              </label>
              <input
                className="input"
                type="date"
                value={form.needed_by}
                onChange={set('needed_by')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-500" />
                Delivery Location / City
              </label>
              <input
                className="input"
                placeholder="e.g. Madurai, Coimbatore, Chennai"
                value={form.delivery_location}
                onChange={set('delivery_location')}
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
                Matching Against Active Batches...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Match Against Real Farmer Listings
              </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Matching Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="card p-6 border border-gray-100 shadow-md animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold font-display text-lg text-gray-900">Procurement Match Results</h2>
              <p className="text-xs text-gray-500 mt-0.5">Checked across verified farmer stocks</p>
            </div>
            <span className="badge-actual">Actual Listings</span>
          </div>

          {/* Fulfillment Meter */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Fulfillment Level</span>
              <span className="text-sm font-extrabold text-leaf-700">{matchPercent}% Available</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  matchPercent >= 100 ? 'bg-emerald-500' : matchPercent > 50 ? 'bg-leaf-500' : 'bg-amber-500'
                }`}
                style={{ width: `${matchPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Required: <b>{Number(result.required_quantity)} {result.unit || form.unit}</b></span>
              <span>Matched: <b className="text-leaf-700">{Number(result.matched_quantity)} {result.unit || form.unit}</b></span>
            </div>
          </div>

          {/* Supply Gap Alert */}
          {Number(result.supply_gap) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-amber-800 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Potential Supply Gap: {Number(result.supply_gap)} {result.unit || form.unit}</p>
                <p className="mt-0.5 text-amber-700">
                  AgriDirect AI guarantees <b>100% honesty</b> — no synthetic or ghost inventory was added to cover this shortage. You can place the order for the matched {Number(result.matched_quantity)} units, or notify member FPOs.
                </p>
              </div>
            </div>
          )}

          {/* Matches List */}
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Matched Supplier Lots ({result.matches?.length || 0})
          </h3>

          {result.matches?.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Scale className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              No active listings currently match this product. Try broadening your commodity search or check back soon.
            </div>
          ) : (
            <div className="space-y-2.5 mb-6">
              {result.matches.map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-white hover:border-leaf-300 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-leaf-50 text-leaf-700 flex items-center justify-center font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{m.farmer_or_fpo}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Producer
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-gray-900 block">
                      {Number(m.matched_quantity)} {result.unit || form.unit}
                    </span>
                    <span className="text-xs text-gray-500">
                      @ ₹{Number(m.price_per_unit)} / unit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end">
            <Link to="/buyer/marketplace" className="btn-secondary text-sm text-center">
              Browse All Active Produce
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

