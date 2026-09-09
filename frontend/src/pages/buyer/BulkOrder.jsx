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
  RefreshCw,
  Truck,
  Award,
  Clock,
  Info
} from 'lucide-react'
import { createBulkRequirement } from '../../services/api.js'

export default function BulkOrder() {
  const [form, setForm] = useState({ 
    product_name: '', 
    required_quantity: '', 
    unit: 'kg', 
    needed_by: '', 
    delivery_location: '',
    quality_grade: ''
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
        quality_grade: form.quality_grade || null,
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
    <div className="max-w-4xl mx-auto px-4 py-8">
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
          Specify institutional or restaurant needs. Our multi-criteria engine searches real active farmer listings, rank-matches on quality, distance, perishability &amp; cost, and coordinates collective fulfillment with 100% honesty.
        </p>
      </div>

      {/* Form Card */}
      <div className="card p-6 mb-6 shadow-sm border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label flex items-center gap-1.5 font-medium">
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
              <label className="label flex items-center gap-1.5 font-medium">
                <Scale className="w-4 h-4 text-leaf-700" />
                Required Quantity *
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="e.g. 1000"
                value={form.required_quantity}
                onChange={set('required_quantity')}
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5 font-medium">
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
              <label className="label flex items-center gap-1.5 font-medium">
                <Award className="w-4 h-4 text-leaf-700" />
                Quality Grade Preference
              </label>
              <select className="input" value={form.quality_grade} onChange={set('quality_grade')}>
                <option value="">Any Grade (Broadest match)</option>
                <option value="Grade A">Grade A (Premium Quality)</option>
                <option value="Grade B">Grade B (Standard Market Quality)</option>
                <option value="Grade C">Grade C (Processing / Economy)</option>
                <option value="Organic">Organic Certified</option>
              </select>
            </div>

            <div>
              <label className="label flex items-center gap-1.5 font-medium">
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

            <div className="sm:col-span-2">
              <label className="label flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-gray-500" />
                Delivery Location / City *
              </label>
              <input
                className="input"
                required
                placeholder="e.g. Coimbatore, Madurai, Chennai, Salem"
                value={form.delivery_location}
                onChange={set('delivery_location')}
              />
            </div>
          </div>

          <button
            className="btn-primary w-full py-3 mt-3 flex items-center justify-center gap-2 font-bold shadow-md"
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
        <div className="card p-6 border border-gray-100 shadow-md animate-fade-in space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold font-display text-lg text-gray-900">Procurement Match Results</h2>
              <p className="text-xs text-gray-500 mt-0.5">Checked across verified farmer database listings</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-actual">100% Real Database Data</span>
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-leaf-50 text-leaf-700 border border-leaf-200">
                Direct Seller Model
              </span>
            </div>
          </div>

          {/* Fulfillment Meter */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
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

          {/* Supply Gap Alert or Full Match Notice */}
          {Number(result.supply_gap) > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-amber-900">
                  {Number(result.matched_quantity)} {result.unit || form.unit} available, {Number(result.supply_gap)} {result.unit || form.unit} supply gap.
                </p>
                <p className="mt-1 text-amber-800">
                  AgriDirect guarantees <b>100% honesty</b> — we NEVER invent or fabricate ghost supply to close shortages. You can proceed with the available {Number(result.matched_quantity)} {result.unit || form.unit} from verified farmers, or place a scheduled harvest pre-order.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-900">
                  Requirement 100% Satisfied!
                </p>
                <p className="mt-0.5 text-emerald-800">
                  All {Number(result.matched_quantity)} {result.unit || form.unit} collectively matched across {result.matches?.length || 0} verified producers without any intermediaries.
                </p>
              </div>
            </div>
          )}

          {/* Transparent Price Breakdown Cards */}
          {result.matches?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Transparent Cost Separation (Direct Coordination)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Total Farmer Price</p>
                  <p className="text-base font-extrabold text-gray-900 mt-1">₹{Number(result.total_farmer_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">100% to producers</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Logistics Cost</p>
                  <p className="text-base font-extrabold text-blue-700 mt-1">₹{Number(result.total_logistics_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Distance &amp; weight rule</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Platform Fee (2%)</p>
                  <p className="text-base font-extrabold text-purple-700 mt-1">₹{Number(result.total_platform_fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">AgriDirect escrow fee</p>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase">Total Delivered Cost</p>
                  <p className="text-base font-extrabold text-emerald-800 mt-1">₹{Number(result.total_delivered_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-emerald-700 mt-0.5">All-inclusive final</p>
                </div>
              </div>
            </div>
          )}

          {/* Matches List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Matched Producer Lots ({result.matches?.length || 0})
              </h3>
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-gray-400" />
                Ranked by Compatibility, Grade, Freshness &amp; Distance
              </span>
            </div>

            {result.matches?.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Scale className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                No active listings currently match this product. Try adjusting your search or check back soon.
              </div>
            ) : (
              <div className="space-y-3">
                {result.matches.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-gray-200 bg-white hover:border-leaf-300 transition shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-leaf-100 text-leaf-800 flex items-center justify-center font-bold text-xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">{m.seller_name || m.farmer_name || 'Direct Producer'}</span>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-emerald-100 text-emerald-700">
                              Direct Farmer
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {m.location || 'Local Farm'}
                            {m.distance_km != null && (
                              <span className="text-gray-400">· ~{Number(m.distance_km)} km</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {m.quality_grade && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {m.quality_grade}
                          </span>
                        )}
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-leaf-800 block">
                            {Number(m.matched_quantity)} {result.unit || form.unit}
                          </span>
                          <span className="text-xs text-gray-500">
                            allocated batch
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lot Pricing Breakdown */}
                    <div className="mt-3 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 block">Farmer Price:</span>
                        <span className="font-bold text-gray-900">
                          ₹{Number(m.price_per_unit)}/{result.unit || form.unit}
                        </span>
                        <span className="text-gray-400 block text-[10px]">
                          (₹{Number(m.farmer_subtotal || (m.matched_quantity * m.price_per_unit)).toFixed(2)})
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Logistics:</span>
                        <span className="font-bold text-blue-700">
                          ₹{Number(m.logistics_cost || 0).toFixed(2)}
                        </span>
                        <span className="text-gray-400 block text-[10px]">transit fee</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Platform Fee:</span>
                        <span className="font-bold text-purple-700">
                          ₹{Number(m.platform_fee || 0).toFixed(2)}
                        </span>
                        <span className="text-gray-400 block text-[10px]">2% escrow</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500 block">Delivered Subtotal:</span>
                        <span className="font-extrabold text-gray-900 text-sm">
                          ₹{Number(m.delivered_subtotal || (m.farmer_subtotal || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Farmer remains seller · AgriDirect coordinates only
                      </span>
                      {m.shelf_life_days && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          Shelf Life: {m.shelf_life_days} days
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
