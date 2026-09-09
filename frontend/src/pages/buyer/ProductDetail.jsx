import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { listingDetail, getDemandForecast, getPriceRecommendation, getListingReviews } from '../../services/api.js'
import { useCart } from '../../context/CartContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
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
  Scale,
  Star,
  Camera,
  CheckCircle2,
  X,
  Eye
} from 'lucide-react'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { addToast } = useToast()
  const { t } = useLanguage()

  const [listing, setListing] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [priceRec, setPriceRec] = useState(null)
  const [reviewsData, setReviewsData] = useState(null)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
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

    getListingReviews(id)
      .then((r) => setReviewsData(r.data))
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
        <h2 className="text-xl font-bold text-slate-800 mb-2">{t('product.notFound', 'Product Not Found')}</h2>
        <p className="text-slate-500 text-sm mb-4">{t('product.notFoundDesc', 'This listing may have been sold or removed.')}</p>
        <Link to="/buyer/marketplace" className="btn-primary text-xs">
          {t('product.backToMarket', 'Back to Marketplace')}
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
    addToast(`${t('product.addedToCart', 'Added to cart!')} (${qty} ${listing.unit})`)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleBuyNow = () => {
    const qty = Number(quantity)
    if (qty <= 0 || qty > availableQty) return
    addItem(listing, qty)
    navigate('/buyer/cart')
  }

  const seller = listing.farmer_name || 'Direct Producer'

  // Produce availability & pre-order detection
  const todayStr = new Date().toISOString().split('T')[0]
  const availableDate = listing.available_from || listing.harvest_date
  const isFutureAvailable = Boolean(availableDate && availableDate > todayStr)
  const formattedAvailDate = availableDate
    ? new Date(availableDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const shortAvailDate = availableDate
    ? new Date(availableDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Back Link */}
      <Link 
        to="/buyer/marketplace" 
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {t('product.backToMarket', 'Back to Marketplace')}
      </Link>

      {/* Future Produce Availability Pre-Order Alert */}
      {isFutureAvailable && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start sm:items-center gap-3.5 text-amber-950 shadow-sm">
          <div className="p-2.5 bg-amber-200/80 rounded-xl text-amber-900 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-amber-950">
                Scheduled Harvest / Pre-order Item
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-600 text-white">
                Available from {formattedAvailDate}
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              This produce is scheduled for harvest/availability on <b>{formattedAvailDate}</b>. You can place your pre-order now to lock in supply. The produce will be aggregated at your District Central Warehouse hub upon farmer deposit, and transporters will dispatch it on the availability date.
            </p>
          </div>
        </div>
      )}

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
              {isFutureAvailable ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-600 text-white shadow-xs shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  Available from {shortAvailDate}
                </span>
              ) : (
                <span className="badge-actual shrink-0">{t('product.directSupply', 'Direct Farm Supply')}</span>
              )}
            </div>

            {/* Seller & Location Bar */}
            <div className="flex flex-wrap items-center gap-4 py-3 border-y border-slate-100 text-xs sm:text-sm text-slate-600 mb-6">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                <UserCheck className="w-4 h-4 text-leaf-600" />
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
                <span className="label text-[10px] mb-1">{t('product.listedPrice', 'Listed Price')}</span>
                <div className="text-xl font-extrabold text-slate-900">
                  ₹{unitPrice.toFixed(2)}
                  <span className="text-xs font-normal text-slate-500">/{listing.unit}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="label text-[10px] mb-1">{isFutureAvailable ? 'Scheduled Quantity' : t('product.availableQty', 'Available Quantity')}</span>
                <div className="text-xl font-extrabold text-slate-800 flex items-center gap-1">
                  <Scale className="w-4 h-4 text-leaf-600" />
                  {availableQty.toLocaleString()} {listing.unit}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="label text-[10px] mb-1">{t('product.minOrder', 'Min Order')}</span>
                <div className="text-xl font-extrabold text-slate-800">
                  {minQty} {listing.unit}
                </div>
              </div>
            </div>

            {/* Secondary Metadata */}
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-2">
              {listing.quality_grade && (
                <span className="px-3 py-1 bg-slate-100 rounded-lg font-medium flex items-center gap-1 border border-slate-200">
                  <Tag className="w-3.5 h-3.5 text-slate-500" /> {t('product.grade', 'Grade')} {listing.quality_grade}
                </span>
              )}
              {listing.available_from && (
                <span className="px-3 py-1 bg-amber-50 text-amber-900 rounded-lg font-semibold flex items-center gap-1 border border-amber-200">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" /> Available From: {formattedAvailDate}
                </span>
              )}
              {listing.harvest_date && (
                <span className="px-3 py-1 bg-slate-100 rounded-lg font-medium flex items-center gap-1 border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> {t('product.harvested', 'Harvested')}: {listing.harvest_date}
                </span>
              )}
              {listing.is_perishable && (
                <span className="px-3 py-1 bg-rose-50 text-rose-700 rounded-lg font-semibold border border-rose-200">
                  {t('product.perishableCargo', 'Perishable Cargo')}
                </span>
              )}
              {listing.storage_requirement && (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-200">
                  {t('product.storage', 'Storage')}: {listing.storage_requirement}
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
                  <h3 className="font-bold text-slate-900">{t('product.aiAssessment', 'AI Market Rate Assessment')}</h3>
                </div>
                <span className="badge-ai">{t('product.marketAdvisory', 'Market Advisory')}</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-ai-100 mb-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="label text-[10px] text-ai-700">{t('product.fairPriceBand', 'Fair Price Band')}</span>
                    <p className="text-xl font-extrabold text-ai-900">
                      ₹{Number(priceRec.recommended_min)} – ₹{Number(priceRec.recommended_max)}
                      <span className="text-xs font-normal text-slate-500"> /{listing.unit}</span>
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span className="label text-[10px]">{t('product.farmerListing', 'Current Farmer Listing')}</span>
                    <p className="text-xl font-extrabold text-emerald-700">
                      ₹{unitPrice.toFixed(2)} /{listing.unit}
                    </p>
                  </div>
                </div>
              </div>

              {priceRec.reasoning && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/60 p-3 rounded-lg border border-slate-100">
                  <b>{t('product.aiReasoning', 'AI Reasoning')}:</b> {priceRec.reasoning}
                </p>
              )}

              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0 text-ai-500" />
                {t('product.aiPriceNote', 'This market estimate helps buyers verify fair pricing. The farmer always receives 100% of their actual listed price.')}
              </p>
            </div>
          )}

          {/* AI Demand Forecast Card */}
          {forecast && (
            <div className="card p-6 border border-slate-200 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">{t('product.demandTrendIntel', 'Demand Trend Intelligence')}</h3>
                </div>
                <span className="badge-ai">{t('product.predictiveML', 'Predictive ML')}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="label text-[10px]">{t('product.projectedDemand', 'Projected Next Week Demand')}</span>
                  <div className="text-lg font-bold text-slate-800">
                    {forecast.forecast_quantity ? `${forecast.forecast_quantity} units` : 'Moderate'}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="label text-[10px]">{t('product.marketTrend', 'Market Trend')}</span>
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

          {/* Customer Reviews & Quality Photos Section */}
          <div className="card p-6 border border-slate-200 shadow-soft">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Customer Reviews & Produce Photos
                </h3>
              </div>
              <span className="badge-actual text-xs">Verified Purchases</span>
            </div>

            {reviewsData && reviewsData.total_reviews > 0 ? (
              <div className="space-y-6">
                {/* Rating Overview & Breakdown */}
                <div className="p-4 bg-gradient-to-br from-amber-50/40 via-white to-slate-50 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-slate-900">{reviewsData.average_rating}</span>
                      <span className="text-slate-400 text-sm font-semibold">/ 5.0</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 my-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= Math.round(reviewsData.average_rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-slate-200 text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Based on <b>{reviewsData.total_reviews} verified customer review{reviewsData.total_reviews > 1 ? 's' : ''}</b>
                    </p>
                  </div>

                  <div className="flex-1 max-w-xs space-y-1 text-xs">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const count = reviewsData.rating_breakdown?.[s] || 0
                      const pct = reviewsData.total_reviews > 0 ? Math.round((count / reviewsData.total_reviews) * 100) : 0
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <span className="w-5 text-slate-500 font-semibold">{s}★</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-[11px] text-slate-400 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Customer Photo Gallery */}
                {reviewsData.reviews.filter((r) => r.image_url).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Customer Inspection Photos ({reviewsData.reviews.filter((r) => r.image_url).length})
                      </h4>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {reviewsData.reviews.filter((r) => r.image_url).map((r, idx) => {
                        const imgUrl = r.image_url.startsWith('http') ? r.image_url : `http://localhost:8000${r.image_url}`
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedPhoto(imgUrl)}
                            className="relative rounded-xl overflow-hidden aspect-square border border-slate-200 hover:border-amber-400 transition-all group focus:outline-none"
                          >
                            <img src={imgUrl} alt="Customer produce photo" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Customer Reviews Feed */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Recent Buyer Feedback
                  </h4>
                  <div className="divide-y divide-slate-100 space-y-4">
                    {reviewsData.reviews.map((rev) => {
                      const photoUrl = rev.image_url
                        ? (rev.image_url.startsWith('http') ? rev.image_url : `http://localhost:8000${rev.image_url}`)
                        : null
                      return (
                        <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-leaf-100 text-leaf-800 font-bold text-xs flex items-center justify-center">
                                {rev.buyer_name ? rev.buyer_name[0].toUpperCase() : 'B'}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                  {rev.buyer_name}
                                  <span className="text-[10px] font-normal text-emerald-600 flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                                  </span>
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-amber-400">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
                                />
                              ))}
                            </div>
                          </div>

                          {rev.comment && (
                            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                              "{rev.comment}"
                            </p>
                          )}

                          {photoUrl && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedPhoto(photoUrl)}
                                className="relative rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 inline-block focus:outline-none group max-w-[140px]"
                              >
                                <img src={photoUrl} alt="Customer produce photo" className="w-32 h-24 object-cover group-hover:scale-105 transition" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                  <Eye className="w-3.5 h-3.5" /> Inspect
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                <Star className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-60" />
                <h4 className="text-sm font-bold text-slate-800">No Customer Reviews Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Be the first to order this fresh produce batch and share your feedback and photos with the community!
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Sidebar Order Box (1 col) */}
        <div className="space-y-6">
          <div className="card p-6 border border-slate-200/90 shadow-soft-lg sticky top-20 bg-white">
            <h2 className="text-lg font-extrabold text-slate-900 mb-4 pb-3 border-b border-slate-100">
              {t('product.orderCalculation', 'Order Calculation')}
            </h2>

            {/* Interactive Quantity Stepper */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1.5">
                <label className="label mb-0">{t('product.orderQuantity', 'Order Quantity')} ({listing.unit})</label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {t('product.maxAvailable', 'Max')}: {availableQty} {listing.unit}
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
                <span>{t('product.farmerPrice', 'Farmer Price')}</span>
                <span>₹{unitPrice.toFixed(2)} × {quantity}</span>
              </div>
              <div className="flex justify-between items-baseline font-extrabold text-slate-900 pt-1 border-t border-leaf-200/50">
                <span className="text-sm">{t('product.farmerSubtotal', 'Farmer Subtotal')}</span>
                <span className="text-2xl text-leaf-800">₹{subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                {t('product.logisticsNote', '+ Logistics and platform fee computed transparently at checkout.')}
              </p>
            </div>

            {/* Amazon-style Dual Action CTAs */}
            <div className="space-y-2.5">
              <button
                onClick={handleAddToCart}
                disabled={quantity <= 0 || quantity > availableQty}
                className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-2 border ${
                  added 
                    ? 'bg-emerald-600 text-white border-emerald-600' 
                    : 'bg-amber-100 hover:bg-amber-200/80 text-amber-950 border-amber-300'
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('product.addedToCart', 'Added to Cart!')}</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 text-amber-800" />
                    <span>{isFutureAvailable ? `Pre-order (${quantity} ${listing.unit})` : 'Add to Cart'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={quantity <= 0 || quantity > availableQty}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-[#ffa41c] hover:bg-[#fa8900] text-slate-950 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <span>{isFutureAvailable ? `⚡ Pre-order Now (Available ${shortAvailDate})` : '⚡ Buy Now'}</span>
              </button>
            </div>

            {quantity > availableQty && (
              <p className="text-xs text-red-600 mt-2 text-center">
                {t('product.quantityExceeds', 'Quantity exceeds available stock')} ({availableQty} {listing.unit})
              </p>
            )}

            {isFutureAvailable ? (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
                <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Produce available from {formattedAvailDate}
                </p>
                <p className="text-slate-500">
                  Farmer deposits produce at District Central Warehouse on availability date. Transporter pickup unlocks immediately thereafter.
                </p>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
                <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Dispatched via District Central Warehouse Hub
                </p>
                <p className="text-slate-400">
                  Logistics network exclusively supports Tenkasi, Tirunelveli, and Thoothukudi.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Lightbox / Enlarged Photo View */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2 bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-3 top-3 text-slate-700 bg-white/90 hover:bg-white p-1.5 rounded-full shadow transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedPhoto}
              alt="Enlarged produce inspection"
              className="max-h-[75vh] w-auto rounded-2xl object-contain mx-auto"
            />
            <p className="text-center text-xs text-slate-500 mt-2 font-medium">
              Verified buyer produce inspection photo
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

