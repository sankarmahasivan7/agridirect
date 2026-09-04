import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { listingDetail, getDemandForecast, getPriceRecommendation } from '../../services/api.js'
import { useCart } from '../../context/CartContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { 
  ArrowLeft, 
  MapPin, 
  UserCheck, 
  ShieldCheck, 
  Sparkles, 
  ShoppingCart, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Plus, 
  Calendar, 
  Tag, 
  Info,
  Scale
} from 'lucide-react'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { addToast } = useToast()

  const [listing, setListing] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [priceRec, setPriceRec] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listingDetail(id)
      .then((res) => {
        setListing(res.data)
        const initialQty = Number(res.data.min_order_quantity) || 1
        setQuantity(initialQty)
        getDemandForecast(res.data.product_name, res.data.location)
          .then((r) => setForecast(r.data))
          .catch(() => {})
      })
      .finally(() => setLoading(false))

    getPriceRecommendation(id)
      .then((r) => setPriceRec(r.data))
      .catch(() => {})
  }, [id])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-6 w-32 skeleton rounded-lg" />
        <div className="card p-8 space-y-4">
          <div className="h-8 w-2/3 skeleton rounded-xl" />
          <div className="h-4 w-1/3 skeleton rounded-lg" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="h-20 skeleton rounded-xl" />
            <div className="h-20 skeleton rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Product Not Found</h2>
        <p className="text-slate-500 text-sm mb-4">This listing may have been sold or removed.</p>
        <Link to="/buyer/marketplace" className="btn-primary text-xs">
          Back to Marketplace
        </Link>
      </div>
    )
  }

  const availableQty = Number(listing.quantity_available) || 0
  const minQty = Number(listing.min_order_quantity) || 1
  const unitPrice = Number(listing.price_per_unit) || 0
  const subtotal = (Number(quantity) || 0) * unitPrice

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(minQty, Number((prev - (prev > 10 ? 5 : 1)).toFixed(2))))
  }

  const handleIncrease = () => {
    setQuantity((prev) => Math.min(availableQty, Number((prev + (prev >= 10 ? 5 : 1)).toFixed(2))))
  }

  const handleAddToCart = () => {
    const qty = Number(quantity)
    if (qty <= 0 || qty > availableQty) return
    addItem(listing, qty)
    setAdded(true)
    addToast(`Added ${qty} ${listing.unit} of ${listing.product_name} to cart!`)
    setTimeout(() => navigate('/buyer/cart'), 600)
  }

  const isFpo = !!listing.fpo_name
  const seller = listing.farmer_name || listing.fpo_name || 'Direct Producer'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Back Link */}
      <Link 
        to="/buyer/marketplace" 
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Product Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Card */}
          <div className="card p-6 sm:p-8 border border-slate-200/80 shadow-soft">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 bg-leaf-50 px-2.5 py-1 rounded-md border border-leaf-200/50">
                  {listing.category_name || 'Produce'}
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 capitalize">
                  {listing.product_name}
                </h1>
              </div>
              <span className="badge-actual shrink-0">Direct Farm Supply</span>
            </div>

            {/* Seller & Location Bar */}
            <div className="flex flex-wrap items-center gap-4 py-3 border-y border-slate-100 text-xs sm:text-sm text-slate-600 mb-6">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                {isFpo ? <ShieldCheck className="w-4 h-4 text-blue-600" /> : <UserCheck className="w-4 h-4 text-leaf-600" />}
                {seller}
              </span>
              {listing.location && (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {listing.location}
                </span>
              )}
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="label text-[10px] mb-1">Listed Price</span>
                <div className="text-xl font-extrabold text-slate-900">
                  ₹{unitPrice.toFixed(2)}
                  <span className="text-xs font-normal text-slate-500">/{listing.unit}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="label text-[10px] mb-1">Available Quantity</span>
                <div className="text-xl font-extrabold text-slate-800 flex items-center gap-1">
                  <Scale className="w-4 h-4 text-leaf-600" />
                  {availableQty.toLocaleString()} {listing.unit}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="label text-[10px] mb-1">Min Order</span>
                <div className="text-xl font-extrabold text-slate-800">
                  {minQty} {listing.unit}
                </div>
              </div>
            </div>

            {/* Secondary Metadata */}
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-2">
              {listing.quality_grade && (
                <span className="px-3 py-1 bg-slate-100 rounded-lg font-medium flex items-center gap-1 border border-slate-200">
                  <Tag className="w-3.5 h-3.5 text-slate-500" /> Grade {listing.quality_grade}
                </span>
              )}
              {listing.harvest_date && (
                <span className="px-3 py-1 bg-slate-100 rounded-lg font-medium flex items-center gap-1 border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Harvested: {listing.harvest_date}
                </span>
              )}
              {listing.is_perishable && (
                <span className="px-3 py-1 bg-rose-50 text-rose-700 rounded-lg font-semibold border border-rose-200">
                  Perishable Cargo
                </span>
              )}
              {listing.storage_requirement && (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-200">
                  Storage: {listing.storage_requirement}
                </span>
              )}
            </div>
          </div>

          {/* AI Price & Market Rate Intelligence */}
          {priceRec && (
            <div className="card p-6 border border-ai-200/80 bg-gradient-to-br from-white to-ai-50/30 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-ai-600" />
                  <h3 className="font-bold text-slate-900">AI Market Rate Assessment</h3>
                </div>
                <span className="badge-ai">Market Advisory</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-ai-100 mb-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="label text-[10px] text-ai-700">Trained Market Fair Price Band</span>
                    <p className="text-xl font-extrabold text-ai-900">
                      ₹{Number(priceRec.recommended_min)} – ₹{Number(priceRec.recommended_max)}
                      <span className="text-xs font-normal text-slate-500"> /{listing.unit}</span>
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span className="label text-[10px]">Current Farmer Listing</span>
                    <p className="text-xl font-extrabold text-emerald-700">
                      ₹{unitPrice.toFixed(2)} /{listing.unit}
                    </p>
                  </div>
                </div>
              </div>

              {priceRec.reasoning && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/60 p-3 rounded-lg border border-slate-100">
                  <b>AI Reasoning:</b> {priceRec.reasoning}
                </p>
              )}

              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0 text-ai-500" />
                This market estimate helps buyers verify fair pricing. The farmer always receives 100% of their actual listed price.
              </p>
            </div>
          )}

          {/* AI Demand Forecast Card */}
          {forecast && (
            <div className="card p-6 border border-slate-200 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">Demand Trend Intelligence</h3>
                </div>
                <span className="badge-ai">Predictive ML</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="label text-[10px]">Projected Next Week Demand</span>
                  <div className="text-lg font-bold text-slate-800">
                    {forecast.forecast_quantity ? `${forecast.forecast_quantity} units` : 'Moderate'}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="label text-[10px]">Market Trend</span>
                  <div className="text-lg font-bold text-slate-800 capitalize flex items-center gap-1.5">
                    {forecast.trend === 'increasing' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-amber-600" />
                    )}
                    {forecast.trend || 'Stable'}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Order Box (1 col) */}
        <div className="space-y-6">
          <div className="card p-6 border border-slate-200/90 shadow-soft-lg sticky top-20 bg-white">
            <h2 className="text-lg font-extrabold text-slate-900 mb-4 pb-3 border-b border-slate-100">
              Order Calculation
            </h2>

            {/* Interactive Quantity Stepper */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1.5">
                <label className="label mb-0">Order Quantity ({listing.unit})</label>
                <span className="text-[11px] text-slate-400 font-medium">
                  Max: {availableQty} {listing.unit}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrease}
                  disabled={quantity <= minQty}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  step="0.01"
                  min={minQty}
                  max={availableQty}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(availableQty, Math.max(0, Number(e.target.value))))}
                  className="input text-center text-lg font-bold py-2"
                />

                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={quantity >= availableQty}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Real-time Subtotal */}
            <div className="p-4 bg-leaf-50/70 border border-leaf-100 rounded-xl mb-5 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Farmer Price</span>
                <span>₹{unitPrice.toFixed(2)} × {quantity}</span>
              </div>
              <div className="flex justify-between items-baseline font-extrabold text-slate-900 pt-1 border-t border-leaf-200/50">
                <span className="text-sm">Farmer Subtotal</span>
                <span className="text-2xl text-leaf-800">₹{subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                + Logistics and platform fee computed transparently at checkout.
              </p>
            </div>

            {/* Add to Cart CTA */}
            <button
              onClick={handleAddToCart}
              disabled={quantity <= 0 || quantity > availableQty}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                added 
                  ? 'bg-emerald-600 text-white' 
                  : 'btn-primary'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  <span>Add to Cart & Checkout</span>
                </>
              )}
            </button>

            {quantity > availableQty && (
              <p className="text-xs text-red-600 mt-2 text-center">
                Quantity exceeds available stock ({availableQty} {listing.unit})
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Direct procurement • No hidden middleman commissions
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}

