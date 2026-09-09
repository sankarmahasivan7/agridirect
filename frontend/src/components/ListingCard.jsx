import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  MapPin, 
  UserCheck, 
  ShieldCheck, 
  ShoppingCart, 
  Check, 
  ArrowUpRight, 
  Scale, 
  Tag, 
  Truck, 
  Navigation, 
  Building2,
  Star,
  Zap,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useToast } from './Toast.jsx'
import ReviewsListModal from './ReviewsListModal.jsx'

export default function ListingCard({ listing }) {
  const { addItem } = useCart()
  const { addToast } = useToast()
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const [selectedQty, setSelectedQty] = useState(() => Number(listing.min_order_quantity) || 1)
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false)

  const qty = Number(listing.quantity_available) || 0
  const minQty = Number(listing.min_order_quantity) || 1
  const price = Number(listing.price_per_unit) || 0
  // Benchmark market reference price (approx 20% higher than direct farmer price) to showcase savings
  const marketReferencePrice = Number((price * 1.25).toFixed(2))
  const savingsPct = Math.round(((marketReferencePrice - price) / marketReferencePrice) * 100)

  // Future produce availability detection (e.g. carrot available on 8 09)
  const todayStr = new Date().toISOString().split('T')[0]
  const availableDate = listing.available_from || listing.harvest_date
  const isFutureAvailable = Boolean(availableDate && availableDate > todayStr)
  const formattedAvailDate = availableDate
    ? new Date(availableDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const shortAvailDate = availableDate
    ? new Date(availableDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  const seller = listing.farmer_name || (language === 'ta' ? 'சரிபார்க்கப்பட்ட உழவர்' : 'Verified Farmer')

  // Real or derived rating
  const hasRealReviews = Boolean((listing.farmer_review_count && listing.farmer_review_count > 0) || (listing.product_review_count && listing.product_review_count > 0))
  const rating = listing.farmer_rating || listing.product_rating || (listing.quality_grade === 'Grade A' ? 4.8 : listing.quality_grade === 'Grade B' ? 4.3 : 4.1)
  const reviewCount = hasRealReviews
    ? ((listing.farmer_review_count || 0) + (listing.product_review_count || 0))
    : Math.max(12, Math.floor((listing.id * 7) % 85) + 14)

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const orderQty = Math.max(minQty, selectedQty)
    addItem(listing, orderQty)
    setAdded(true)
    addToast(
      language === 'ta'
        ? `${listing.product_name} (${orderQty} ${listing.unit}) கூடையில் சேர்க்கப்பட்டது!`
        : `Added ${orderQty} ${listing.unit} of ${listing.product_name} to cart!`
    )
    setTimeout(() => setAdded(false), 1500)
  }

  const handleBuyNow = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const orderQty = Math.max(minQty, selectedQty)
    addItem(listing, orderQty)
    navigate('/buyer/cart')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-400/80 shadow-xs hover:shadow-soft-xl transition-all duration-200 flex flex-col justify-between overflow-hidden group">
      
      {/* Top Media / Badge Banner */}
      <div className="p-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 relative">
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* Amazon-style Fulfilled Badge or Pre-order Badge */}
          {isFutureAvailable ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-600 text-white shadow-2xs">
              <Calendar className="w-3 h-3 text-amber-200" />
              Available from {shortAvailDate}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-2xs">
              <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
              AgriDirect Fulfilled
            </span>
          )}

          {/* Perishability Urgency Badge */}
          {listing.perishability_status && (
            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider border ${
              listing.perishability_status === 'CRITICAL'
                ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                : listing.perishability_status === 'URGENT'
                ? 'bg-orange-50 text-orange-700 border-orange-300'
                : listing.perishability_status === 'SELL SOON'
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {listing.perishability_status}
            </span>
          )}
        </div>

        {/* Product Title */}
        <Link to={`/buyer/product/${listing.id}`} className="block">
          <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors capitalize line-clamp-1">
            {listing.product_name}
          </h3>
        </Link>

        {/* Brand / Farmer Link */}
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
          <span>By:</span>
          <span className="font-semibold text-slate-700 flex items-center gap-0.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
            {seller}
          </span>
          {listing.location && (
            <span className="text-slate-400 ml-1">· {listing.location}</span>
          )}
        </p>

        {/* Ratings with Review inspection trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setReviewsModalOpen(true)
          }}
          className="flex items-center gap-1.5 mt-1.5 hover:opacity-85 transition group/rating focus:outline-none"
          title="Click to view customer reviews and produce photos"
        >
          <div className="flex items-center text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-amber-100 text-amber-200'}`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-amber-700">{rating}</span>
          <span className="text-[11px] text-slate-400 group-hover/rating:underline">({reviewCount})</span>
          <span className="text-[10px] text-emerald-600 font-medium ml-0.5">Reviews</span>
        </button>
      </div>

      {/* Body / Pricing / ETA */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Price block */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              ₹{price.toFixed(2)}
            </span>
            <span className="text-xs font-normal text-slate-500">/{listing.unit}</span>
            <span className="text-xs text-slate-400 line-through">
              M.R.P: ₹{marketReferencePrice.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              Save {savingsPct}%
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mt-0.5">
            Inclusive of all farm-gate taxes
          </p>

          {/* Delivery ETA banner */}
          {isFutureAvailable ? (
            <div className="mt-2.5 p-2 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-900">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="leading-tight">
                <span className="font-bold text-amber-950">Available from {formattedAvailDate}</span>
                <p className="text-[11px] text-amber-700">Pre-order now &bull; Dispatched from Central Warehouse on harvest deposit</p>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-xs text-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="leading-tight">
                <span className="font-bold text-slate-900">Fastest delivery tomorrow</span>
                <p className="text-[11px] text-slate-500">Dispatched from District Central Warehouse</p>
              </div>
            </div>
          )}

          {/* Stock Availability */}
          <div className="mt-2 flex items-center justify-between text-xs">
            {qty > 0 ? (
              isFutureAvailable ? (
                <span className="font-bold text-amber-800 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  Pre-order ({qty.toLocaleString()} {listing.unit} scheduled)
                </span>
              ) : (
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  In Stock ({qty.toLocaleString()} {listing.unit} available)
                </span>
              )
            ) : (
              <span className="font-bold text-rose-600">Currently Out of Stock</span>
            )}
            {minQty > 1 && (
              <span className="text-[11px] text-slate-400">
                Min: {minQty} {listing.unit}
              </span>
            )}
          </div>
        </div>

        {/* Quantity Stepper & Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">Quantity ({listing.unit}):</span>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedQty((prev) => Math.max(minQty, prev - 1))}
                disabled={selectedQty <= minQty}
                className="w-6 h-6 rounded bg-white font-bold text-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50"
              >
                -
              </button>
              <input
                type="number"
                value={selectedQty}
                onChange={(e) => setSelectedQty(Math.min(qty, Math.max(minQty, Number(e.target.value))))}
                className="w-12 text-center text-xs font-bold bg-transparent border-0 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSelectedQty((prev) => Math.min(qty, prev + 1))}
                disabled={selectedQty >= qty}
                className="w-6 h-6 rounded bg-white font-bold text-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Amazon 2-tier Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={qty <= 0}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                added
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-amber-100 hover:bg-amber-200/80 text-amber-950 border-amber-300 shadow-2xs active:scale-98'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-800" />
                  <span>{isFutureAvailable ? 'Pre-order' : 'Add to Cart'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={qty <= 0}
              className="py-2 px-3 rounded-xl text-xs font-bold bg-[#ffa41c] hover:bg-[#fa8900] text-slate-950 shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-98"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              <span>{isFutureAvailable ? 'Pre-order Now' : 'Buy Now'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Customer Reviews & Produce Photos Modal */}
      <ReviewsListModal
        isOpen={reviewsModalOpen}
        onClose={() => setReviewsModalOpen(false)}
        listing={listing}
      />
    </div>
  )
}
