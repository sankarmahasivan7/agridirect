import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom'
import { createListing, updateListing, listingDetail, getLiveMandiPrices } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { findMarketPrice, POPULAR_CROPS, calculateDirectTradePrice } from '../../data/marketPrices.js'
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
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  ExternalLink, 
  Zap 
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
  const [searchParams] = useSearchParams()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const { user } = useAuth()
  const farmerDistrict = user?.district || 'Tenkasi'
  const { addToast } = useToast()
  const { t, language } = useLanguage()
  const isTa = language === 'ta'
  const mandiReqTimerRef = useRef(null)

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
    expected_sell_by_date: '',
    perishability_level: 'HIGH',
    storage_requirement: '', 
    certification_info: '',
  })
  const [detectedCrop, setDetectedCrop] = useState(null)
  const [activePricePreset, setActivePricePreset] = useState('average') // 'average' | 'premium' | 'bulk' | 'custom'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Load existing listing if in edit mode
  useEffect(() => {
    if (isEditing) {
      setLoading(true)
      listingDetail(id)
        .then((res) => {
          const d = res.data
          setForm({
            product_name: d.product_name || '',
            category_name: d.category_name || 'Vegetables',
            quantity_available: d.quantity_available !== undefined ? String(d.quantity_available) : '',
            unit: d.unit || 'kg',
            price_per_unit: d.price_per_unit !== undefined ? String(d.price_per_unit) : '',
            quality_grade: d.quality_grade || '',
            harvest_date: d.harvest_date || '',
            available_from: d.available_from || '',
            available_until: d.available_until || '',
            location: d.location || '',
            min_order_quantity: d.min_order_quantity !== undefined ? String(d.min_order_quantity) : '',
            is_perishable: d.is_perishable !== undefined ? d.is_perishable : true,
            shelf_life_days: d.shelf_life_days ? String(d.shelf_life_days) : '',
            storage_requirement: d.storage_requirement || '',
            certification_info: d.certification_info || '',
          })
          const matched = findMarketPrice(d.product_name)
          if (matched) setDetectedCrop(matched)
        })
        .catch((err) => {
          setError(err.response?.data?.detail || 'Could not load listing details')
        })
        .finally(() => setLoading(false))
    }
  }, [id, isEditing])

  // Handle URL query parameters if farmer clicked "Sell at this Rate" from MarketPrices page
  useEffect(() => {
    if (isEditing) return
    const urlCrop = searchParams.get('crop')
    const urlPrice = searchParams.get('price')
    const urlCategory = searchParams.get('category')
    const urlUnit = searchParams.get('unit')

    if (urlCrop) {
      applyCropMatch(urlCrop, urlPrice ? Number(urlPrice) : null, urlCategory, urlUnit)
    }
  }, [searchParams, isEditing])

  // Query live mandi prices for farmer's registered district (e.g. Tenkasi)
  const fetchLiveDistrictMandi = (cropName) => {
    if (!cropName) return
    getLiveMandiPrices({ district: farmerDistrict, commodity: cropName })
      .then((res) => {
        const recs = res.data?.records || []
        if (recs.length > 0) {
          // Prioritize farmer's exact registered district (e.g. Tenkasi)
          const distMatch = recs.find(r => (r.district || '').toLowerCase().includes(farmerDistrict.toLowerCase())) || recs[0]
          const mPrice = Number(distMatch.modal_price_per_kg) || 35.0
          const minP = Number(distMatch.min_price_per_kg) || (mPrice - 5)
          const maxP = Number(distMatch.max_price_per_kg) || (mPrice + 5)
          const bonus = distMatch.farmer_margin_bonus || (mPrice <= 25 ? 3.0 : (mPrice <= 40 ? 4.0 : (mPrice <= 60 ? 5.0 : 6.0)))
          const recDirectPrice = distMatch.direct_trade_price || Number((mPrice + bonus).toFixed(2))

          setDetectedCrop((prev) => ({
            ...(prev || {}),
            modalPrice: mPrice,
            minPrice: minP,
            maxPrice: maxP,
            directTradePrice: recDirectPrice,
            farmerMarginBonus: bonus,
            primaryMandi: `${distMatch.market}, ${distMatch.district}`,
            primaryMandiTa: `${distMatch.market}, ${distMatch.district}`,
            district: distMatch.district,
            isLiveMandi: true,
          }))

          // Auto-fill price with the direct-from-farm fair price (+3 to +6)
          setForm((prev) => ({
            ...prev,
            price_per_unit: recDirectPrice.toFixed(2),
          }))
          setActivePricePreset('directTrade')
        }
      })
      .catch(() => {})
  }

  // Applies crop match and auto-populates price, category, unit, etc.
  const applyCropMatch = (name, overridePrice = null, overrideCat = null, overrideUnit = null) => {
    const matched = findMarketPrice(name)
    if (matched) {
      const fairInfo = calculateDirectTradePrice(matched.modalPrice)
      const defaultDirect = matched.directTradePrice || fairInfo.recommendedPrice
      const targetPrice = overridePrice !== null ? overridePrice : defaultDirect

      setDetectedCrop({
        ...matched,
        directTradePrice: defaultDirect,
        farmerMarginBonus: matched.farmerMarginBonus || fairInfo.marginBonus,
      })
      setForm((prev) => ({
        ...prev,
        product_name: name,
        category_name: overrideCat || matched.category,
        unit: overrideUnit || matched.unit,
        price_per_unit: targetPrice.toFixed(2),
        shelf_life_days: matched.shelfLifeDays ? String(matched.shelfLifeDays) : prev.shelf_life_days,
        is_perishable: matched.isPerishable !== undefined ? matched.isPerishable : prev.is_perishable,
      }))
      setActivePricePreset('directTrade')
      fetchLiveDistrictMandi(name)
    } else {
      setDetectedCrop(null)
      setForm((prev) => ({ ...prev, product_name: name }))
    }
  }

  // Handle typing in the Crop / Product Name input field
  const handleCropNameChange = (e) => {
    const val = e.target.value
    const matched = findMarketPrice(val)
    if (matched) {
      const fairInfo = calculateDirectTradePrice(matched.modalPrice)
      const defaultDirect = matched.directTradePrice || fairInfo.recommendedPrice
      setDetectedCrop({
        ...matched,
        directTradePrice: defaultDirect,
        farmerMarginBonus: matched.farmerMarginBonus || fairInfo.marginBonus,
      })
      setForm((prev) => ({
        ...prev,
        product_name: val,
        category_name: matched.category,
        unit: matched.unit,
        price_per_unit: defaultDirect.toFixed(2),
        shelf_life_days: matched.shelfLifeDays ? String(matched.shelfLifeDays) : prev.shelf_life_days,
        is_perishable: matched.isPerishable !== undefined ? matched.isPerishable : prev.is_perishable,
      }))
      setActivePricePreset('directTrade')

      if (mandiReqTimerRef.current) clearTimeout(mandiReqTimerRef.current)
      mandiReqTimerRef.current = setTimeout(() => {
        fetchLiveDistrictMandi(val)
      }, 350)
    } else {
      setDetectedCrop(null)
      setForm((prev) => ({ ...prev, product_name: val }))
    }
  }

  // Handle Quick Crop selection pills
  const handleQuickCropSelect = (crop) => {
    applyCropMatch(crop.name)
  }

  // Handle Price Presets (Direct Trade Fair, Mandi Wholesale, Premium Grade A, Bulk)
  const applyPricePreset = (preset) => {
    if (!detectedCrop) return
    setActivePricePreset(preset)
    const baseModal = detectedCrop.modalPrice || 35.0
    const bonus = detectedCrop.farmerMarginBonus || 4.0
    let newPrice = detectedCrop.directTradePrice || (baseModal + bonus)
    
    if (preset === 'directTrade') {
      newPrice = detectedCrop.directTradePrice || (baseModal + bonus)
    } else if (preset === 'mandi') {
      newPrice = baseModal
    } else if (preset === 'premium') {
      newPrice = Number((baseModal + bonus + 2.0).toFixed(2)) // +₹6 over mandi
    } else if (preset === 'bulk') {
      newPrice = Number((baseModal - 2.0).toFixed(2))
    }
    setForm((prev) => ({ ...prev, price_per_unit: newPrice.toFixed(2) }))
  }

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    if (k === 'price_per_unit') {
      setActivePricePreset('custom')
    }
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
        expected_sell_by_date: form.expected_sell_by_date || null,
        perishability_level: form.perishability_level || 'HIGH',
        harvest_date: form.harvest_date || null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      }
      if (isEditing) {
        await updateListing(id, payload)
        addToast(isTa ? `"${form.product_name}" விவரங்கள் புதுப்பிக்கப்பட்டது!` : `"${form.product_name}" updated successfully!`)
      } else {
        await createListing(payload)
        addToast(`"${form.product_name}" ${t('newListing.publishedSuccess', 'published successfully at market rate!')}`)
      }
      navigate('/farmer/listings')
    } catch (err) {
      setError(err.response?.data?.detail || (isEditing ? 'Could not update listing.' : 'Could not create listing.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link 
          to="/farmer/listings" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {isTa ? 'பட்டியல்களுக்கு திரும்புக' : 'Back to My Listings'}
        </Link>

        {/* Link to Market Rates Page */}
        <Link
          to="/market-prices"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-leaf-700 hover:text-leaf-800 bg-leaf-50 hover:bg-leaf-100 px-3 py-1.5 rounded-xl border border-leaf-200 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{t('newListing.viewMarketBoard', 'View Live Market Price Board')}</span>
          <ExternalLink className="w-3 h-3 text-leaf-500" />
        </Link>
      </div>

      <div className="card p-6 sm:p-8 border border-slate-200/80 shadow-soft">
        
        {/* Title & Banner */}
        <div className="mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isEditing 
                ? (isTa ? 'விளைபொருள் விவரங்களை மாற்றுக' : 'Edit Produce Listing')
                : t('newListing.title', 'Add Produce Listing')
              }
            </h1>
            <span className="badge-actual">
              <Zap className="w-3 h-3 inline mr-1 text-amber-500 fill-amber-400" />
              {isEditing ? (isTa ? 'நேரடி திருத்தம்' : 'Direct Edit') : 'Auto-Priced'}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            {isEditing 
              ? (isTa ? 'விளைபொருள் அளவு, விலை மற்றும் இருப்பிடத்தை இங்கேயே புதுப்பிக்கலாம்.' : 'Update listing inventory, price, quality grade, and farm gate details.')
              : t('newListing.subtitle', 'Prices are automatically matched from daily mandi market rates. Zero manual calculation needed.')
            }
          </p>
        </div>

        {/* Quick Pick Popular Crops */}
        <div className="mb-8 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-leaf-600" />
              {t('newListing.quickPick', 'Quick-Select Popular Vegetable / Crop')}:
            </span>
            <span className="text-[11px] text-slate-400">1-Tap auto-fills price & specs</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {POPULAR_CROPS.map((crop) => {
              const isSelected = detectedCrop?.id === crop.name.toLowerCase().replace(/ /g, '_')
              return (
                <button
                  type="button"
                  key={crop.name}
                  onClick={() => handleQuickCropSelect(crop)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-leaf-700 text-white shadow-sm scale-105'
                      : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200/80'
                  }`}
                >
                  <span>{crop.icon}</span>
                  <span>{isTa ? crop.nameTa : crop.name}</span>
                </button>
              )
            })}
          </div>
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
              <Package className="w-3.5 h-3.5" /> {t('newListing.cropInformation', '1. Crop Information')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Crop Name with smart detection */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">{t('newListing.cropName', 'Crop / Product Name')}</label>
                  {detectedCrop && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {t('newListing.marketDetected', 'Live Market Rate Detected')}: {isTa ? detectedCrop.nameTa : detectedCrop.name}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input 
                    className="input font-semibold text-slate-900" 
                    required 
                    placeholder={t('newListing.cropPlaceholder', 'Type crop name e.g. Tomato, Potato...')} 
                    value={form.product_name} 
                    onChange={handleCropNameChange} 
                  />
                  {detectedCrop && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                      {detectedCrop.icon}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Typing any vegetable name (e.g. "totatoe", "tomato", "potato", "onion") instantly populates today's regulated market rate.
                </p>
              </div>

              <div>
                <label className="label">{t('newListing.category', 'Category')}</label>
                <select className="input font-medium" value={form.category_name} onChange={set('category_name')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="label">{t('newListing.qualityGrade', 'Quality / Grade')}</label>
                <input 
                  className="input" 
                  value={form.quality_grade} 
                  onChange={set('quality_grade')} 
                  placeholder={t('newListing.qualityGradePlaceholder', 'e.g. Grade A, Premium Export')} 
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label">{t('newListing.certNotes', 'Certification / Organic Notes')}</label>
                <input 
                  className="input" 
                  value={form.certification_info} 
                  onChange={set('certification_info')} 
                  placeholder={t('newListing.certNotesPlaceholder', 'e.g. NPOP Certified, Chemical-Free')} 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Volume with Auto-Pricing Gauge */}
          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> {t('newListing.pricingAndVolume', '2. Quantity & Market-Backed Price')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">{t('newListing.availableQty', 'Available Quantity')}</label>
                <input 
                  className="input font-bold" 
                  type="number" 
                  step="0.01" 
                  required 
                  placeholder="e.g. 500" 
                  value={form.quantity_available} 
                  onChange={set('quantity_available')} 
                />
              </div>

              <div>
                <label className="label">{t('newListing.measurementUnit', 'Measurement Unit')}</label>
                <input 
                  className="input" 
                  required 
                  value={form.unit} 
                  onChange={set('unit')} 
                  placeholder="kg / litre / dozen" 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">{t('newListing.pricePerUnit', 'Price per Unit (₹)')}</label>
                  {detectedCrop && (
                    <span className="text-[10px] font-bold text-leaf-700">
                      {t('newListing.priceAutoBadge', 'Auto-Filled')}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input 
                    className="input pl-7 font-black text-lg text-emerald-800 bg-emerald-50/40 border-emerald-300 focus:border-emerald-500 focus:bg-white" 
                    type="number" 
                    step="0.01" 
                    required 
                    placeholder="e.g. 28.00" 
                    value={form.price_per_unit} 
                    onChange={set('price_per_unit')} 
                  />
                </div>
              </div>
            </div>

            {/* AI Mandi Market Rate Guidance Card */}
            {detectedCrop && (
              <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/90 to-leaf-50/50 rounded-2xl border border-emerald-200/80 mb-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{detectedCrop.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                          {isTa ? detectedCrop.nameTa : detectedCrop.name} — {farmerDistrict} {isTa ? 'சந்தை விலை' : 'Market Benchmark'}: ₹{detectedCrop.modalPrice.toFixed(2)}/{detectedCrop.unit}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          {isTa ? `+₹${detectedCrop.farmerMarginBonus || 4} நேரடி கூடுதல் லாபம்` : `+₹${detectedCrop.farmerMarginBonus || 4}/kg Farmer Bonus`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        📍 {detectedCrop.primaryMandi || `${farmerDistrict} Uzhavar Sandhai`} · {isTa ? 'சந்தை வரம்பு' : 'Daily Band'}: ₹{detectedCrop.minPrice} – ₹{detectedCrop.maxPrice}/{detectedCrop.unit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                      detectedCrop.trend === 'up' ? 'bg-emerald-100 text-emerald-800' : detectedCrop.trend === 'down' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {detectedCrop.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                      {detectedCrop.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                      {detectedCrop.trend === 'stable' && <Minus className="w-3 h-3" />}
                      {detectedCrop.trendPercent || '+2.5%'}
                    </span>
                  </div>
                </div>

                {/* Direct-Trade Intermediary Elimination Card */}
                <div className="p-3.5 bg-white/90 rounded-xl border border-emerald-200/90 mb-3 text-xs text-slate-700 space-y-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>
                      {isTa ? 'இடைத்தரகர் இல்லாத நேரடி லாப விலை அமைப்பு' : 'Direct-From-Farm Fair Pricing (Zero Intermediaries)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {isTa
                      ? `${farmerDistrict} சந்தையில் இடைத்தரகர்கள் விவசாயிகளிடம் ₹${detectedCrop.modalPrice.toFixed(2)} விலைக்கு வாங்கி நுகர்வோரிடம் அதிக லாபத்திற்கு விற்கின்றனர். அக்ரிடைரக்ட்டில் இடைத்தரகர் இல்லாததால் உங்களுக்கு ஒரு கிலோவிற்கு +₹${detectedCrop.farmerMarginBonus || 4}.00 கூடுதல் லாபம் (₹${(detectedCrop.directTradePrice || (detectedCrop.modalPrice + 4)).toFixed(2)}) நேரடியாக கிடைக்கிறது!`
                      : `In traditional markets, middlemen buy at the local mandi rate (₹${detectedCrop.modalPrice.toFixed(2)}/kg) and markup heavily to buyers. On AgriDirect, by bypassing intermediaries, you earn +₹${detectedCrop.farmerMarginBonus || 4}.00/kg extra profit (₹${(detectedCrop.directTradePrice || (detectedCrop.modalPrice + 4)).toFixed(2)}/kg), while buyers still pay less than retail!`
                    }
                  </p>
                </div>

                {/* 1-Click Price Adjustment Presets */}
                <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 mr-1">
                    {isTa ? 'பரிந்துரைக்கப்பட்ட விலைகள்:' : 'Price Presets:'}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => applyPricePreset('directTrade')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      activePricePreset === 'directTrade'
                        ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/40'
                        : 'bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-300'
                    }`}
                  >
                    ⭐ {isTa ? `நேரடி உழவர் விலை (+₹${detectedCrop.farmerMarginBonus || 4})` : `Direct-Trade Fair (+₹${detectedCrop.farmerMarginBonus || 4})`}: ₹{(detectedCrop.directTradePrice || (detectedCrop.modalPrice + 4)).toFixed(2)}
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPricePreset('mandi')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      activePricePreset === 'mandi'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-emerald-100/70 border border-emerald-200'
                    }`}
                  >
                    {isTa ? `${farmerDistrict} சந்தை விலை` : `${farmerDistrict} Mandi Base`}: ₹{detectedCrop.modalPrice.toFixed(2)}
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPricePreset('premium')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      activePricePreset === 'premium'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-emerald-100/70 border border-emerald-200'
                    }`}
                  >
                    {isTa ? 'முதல் தரம் (+₹6)' : 'Premium Grade A (+₹6)'}: ₹{(detectedCrop.modalPrice + 6.0).toFixed(2)}
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPricePreset('bulk')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      activePricePreset === 'bulk'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-emerald-100/70 border border-emerald-200'
                    }`}
                  >
                    {isTa ? 'விரைவு விற்பனை (-₹2)' : 'Fast Bulk (-₹2)'}: ₹{(detectedCrop.modalPrice - 2.0).toFixed(2)}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2">
              <label className="label">{t('newListing.minOrderQty', 'Minimum Order Quantity (Optional)')}</label>
              <input 
                className="input" 
                type="number" 
                step="0.01" 
                placeholder={t('newListing.minOrderPlaceholder', 'e.g. 10 (Leave blank or 0 for no minimum)')} 
                value={form.min_order_quantity} 
                onChange={set('min_order_quantity')} 
              />
            </div>
          </div>

          {/* Section 3: Availability & Logistics */}
          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {t('newListing.timelineAndLocation', '3. Timeline & Farm Gate Location')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{t('newListing.farmLocation', 'Farm / Pickup Location')}</label>
                <input 
                  className="input" 
                  value={form.location} 
                  onChange={set('location')} 
                  placeholder={t('newListing.farmLocationPlaceholder', 'e.g. Tenkasi, Tamil Nadu')} 
                />
              </div>

              <div>
                <label className="label">{t('newListing.harvestDate', 'Harvest Date')}</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.harvest_date} 
                  onChange={set('harvest_date')} 
                />
              </div>

              <div>
                <label className="label">{t('newListing.availableFrom', 'Available From')}</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.available_from} 
                  onChange={set('available_from')} 
                />
              </div>

              <div>
                <label className="label">{t('newListing.availableUntil', 'Available Until')}</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.available_until} 
                  onChange={set('available_until')} 
                />
              </div>

              <div>
                <label className="label">{t('newListing.shelfLifeDays', 'Estimated Shelf Life (Days)')}</label>
                <input 
                  className="input" 
                  type="number" 
                  value={form.shelf_life_days} 
                  onChange={set('shelf_life_days')} 
                  placeholder="e.g. 5" 
                />
              </div>

              <div>
                <label className="label">Expected Sell-By Date</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.expected_sell_by_date} 
                  onChange={set('expected_sell_by_date')} 
                />
              </div>

              <div>
                <label className="label">Perishability Level</label>
                <select 
                  className="input" 
                  value={form.perishability_level} 
                  onChange={set('perishability_level')}
                >
                  <option value="HIGH">HIGH (Leafy greens, Berries, Milk, Tomatoes)</option>
                  <option value="MEDIUM">MEDIUM (Cucumbers, Brinjal, Melons, Grapes)</option>
                  <option value="LOW">LOW (Potatoes, Onions, Garlic, Apples)</option>
                  <option value="NON_PERISHABLE">NON_PERISHABLE (Grains, Pulses, Spices)</option>
                </select>
              </div>

              <div>
                <label className="label">{t('newListing.storageReq', 'Storage Requirement')}</label>
                <input 
                  className="input" 
                  value={form.storage_requirement} 
                  onChange={set('storage_requirement')} 
                  placeholder={t('newListing.storageReqPlaceholder', 'e.g. Dry, Ambient, Cold storage (2-4°C)')} 
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
                  <span>{t('newListing.perishableLabel', 'This product is perishable (Enables expedited transport routing)')}</span>
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
                  <span>{isEditing ? (isTa ? 'மாற்றங்கள் சேமிக்கப்படுகிறது…' : 'Saving Changes…') : t('newListing.publishing', 'Publishing Listing to Marketplace…')}</span>
                </>
              ) : (
                <span>{isEditing ? (isTa ? 'மாற்றங்களைச் சேமி' : 'Save Changes') : t('newListing.publishBtn', 'Publish Listing to Marketplace')}</span>
              )}
            </button>
          </div>

        </form>

      </div>

    </div>
  )
}
