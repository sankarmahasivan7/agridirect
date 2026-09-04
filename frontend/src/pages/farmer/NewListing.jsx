import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createListing } from '../../services/api.js'
import { useToast } from '../../components/Toast.jsx'
import { 
  ArrowLeft, 
  Package, 
  Tag, 
  Scale, 
  DollarSign, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react'

const CATEGORIES = [
  'Vegetables', 
  'Fruits', 
  'Rice', 
  'Wheat', 
  'Pulses', 
  'Spices', 
  'Dairy', 
  'Poultry', 
  'Livestock', 
  'Other'
]

export default function NewListing() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [form, setForm] = useState({
    product_name: '', 
    category_name: 'Vegetables', 
    quantity_available: '', 
    unit: 'kg',
    price_per_unit: '', 
    quality_grade: '', 
    harvest_date: '', 
    available_from: '', 
    available_until: '',
    location: '', 
    min_order_quantity: '', 
    is_perishable: true, 
    shelf_life_days: '',
    storage_requirement: '', 
    certification_info: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [k]: v })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        quantity_available: Number(form.quantity_available),
        price_per_unit: Number(form.price_per_unit),
        min_order_quantity: form.min_order_quantity ? Number(form.min_order_quantity) : 0,
        shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : null,
        harvest_date: form.harvest_date || null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      }
      await createListing(payload)
      addToast(`Listing for "${form.product_name}" published successfully!`)
      navigate('/farmer/listings')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create listing.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Back Link */}
      <Link 
        to="/farmer/listings" 
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to My Listings
      </Link>

      <div className="card p-6 sm:p-8 border border-slate-200/80 shadow-soft">
        
        <div className="mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Add Produce Listing</h1>
            <span className="badge-actual">Direct Listing</span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Specify your exact crop details and price. Buyers will see your harvest directly without broker alterations.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-6">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Produce Identification */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> 1. Crop Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Crop / Product Name</label>
                <input 
                  className="input" 
                  required 
                  placeholder="e.g. Organic Roma Tomato" 
                  value={form.product_name} 
                  onChange={set('product_name')} 
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category_name} onChange={set('category_name')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Quality / Grade</label>
                <input 
                  className="input" 
                  value={form.quality_grade} 
                  onChange={set('quality_grade')} 
                  placeholder="e.g. Grade A, Premium Export" 
                />
              </div>

              <div>
                <label className="label">Certification / Organic Notes</label>
                <input 
                  className="input" 
                  value={form.certification_info} 
                  onChange={set('certification_info')} 
                  placeholder="e.g. NPOP Certified, Chemical-Free" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Volume */}
          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> 2. Quantity & Farmer Price
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Available Quantity</label>
                <input 
                  className="input" 
                  type="number" 
                  step="0.01" 
                  required 
                  placeholder="e.g. 500" 
                  value={form.quantity_available} 
                  onChange={set('quantity_available')} 
                />
              </div>

              <div>
                <label className="label">Measurement Unit</label>
                <input 
                  className="input" 
                  required 
                  value={form.unit} 
                  onChange={set('unit')} 
                  placeholder="kg / litre / dozen" 
                />
              </div>

              <div>
                <label className="label">Price per Unit (₹)</label>
                <input 
                  className="input font-bold" 
                  type="number" 
                  step="0.01" 
                  required 
                  placeholder="e.g. 25.00" 
                  value={form.price_per_unit} 
                  onChange={set('price_per_unit')} 
                />
              </div>

              <div className="sm:col-span-3">
                <label className="label">Minimum Order Quantity (Optional)</label>
                <input 
                  className="input" 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g. 10 (Leave blank or 0 for no minimum)" 
                  value={form.min_order_quantity} 
                  onChange={set('min_order_quantity')} 
                />
              </div>
            </div>
          </div>

          {/* Section 3: Availability & Logistics */}
          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 3. Timeline & Farm Location
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Farm / Pickup Location</label>
                <input 
                  className="input" 
                  value={form.location} 
                  onChange={set('location')} 
                  placeholder="e.g. Tenkasi, Tamil Nadu" 
                />
              </div>

              <div>
                <label className="label">Harvest Date</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.harvest_date} 
                  onChange={set('harvest_date')} 
                />
              </div>

              <div>
                <label className="label">Available From</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.available_from} 
                  onChange={set('available_from')} 
                />
              </div>

              <div>
                <label className="label">Available Until</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.available_until} 
                  onChange={set('available_until')} 
                />
              </div>

              <div>
                <label className="label">Estimated Shelf Life (Days)</label>
                <input 
                  className="input" 
                  type="number" 
                  value={form.shelf_life_days} 
                  onChange={set('shelf_life_days')} 
                  placeholder="e.g. 5" 
                />
              </div>

              <div>
                <label className="label">Storage Requirement</label>
                <input 
                  className="input" 
                  value={form.storage_requirement} 
                  onChange={set('storage_requirement')} 
                  placeholder="e.g. Dry, Ambient, Cold storage" 
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-200/60 cursor-pointer hover:bg-slate-100 transition">
                  <input 
                    type="checkbox" 
                    checked={form.is_perishable} 
                    onChange={set('is_perishable')} 
                    className="rounded text-leaf-600 focus:ring-leaf-500 w-4 h-4" 
                  /> 
                  <span>This product is perishable (Enables expedited transport routing)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button 
              className="btn-primary w-full py-3.5 text-sm font-bold shadow-md flex items-center justify-center gap-2" 
              disabled={loading} 
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Listing to Marketplace…</span>
                </>
              ) : (
                <span>Publish Listing to Marketplace</span>
              )}
            </button>
          </div>

        </form>

      </div>

    </div>
  )
}

