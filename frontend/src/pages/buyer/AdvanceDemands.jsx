import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  Users,
  ShieldCheck,
  TrendingUp,
  MapPin,
  ChevronRight,
  Package,
  RotateCcw,
  XCircle,
  BellRing
} from 'lucide-react'
import { myAdvanceDemands, createAdvanceDemand, cancelAdvanceDemand } from '../../services/api.js'
import { useToast } from '../../components/Toast.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function AdvanceDemands() {
  const { t, isTamil, language } = useLanguage()
  const [demands, setDemands] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const { addToast } = useToast()

  const POPULAR_CROPS = isTamil 
    ? ['தக்காளி', 'கத்தரிக்காய்', 'வெங்காயம்', 'உருளைக்கிழங்கு', 'வெண்டைக்காய்', 'பச்சை மிளகாய்', 'முட்டைக்கோஸ்', 'கேரட்']
    : ['Tomato', 'Brinjal', 'Onion', 'Potato', 'Bhendi (Okra)', 'Green Chilli', 'Cabbage', 'Carrot']

  // Form state
  const defaultNeededDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  }

  const [formData, setFormData] = useState({
    product_name: '',
    required_quantity: '',
    unit: 'kg',
    needed_by: defaultNeededDate(),
    delivery_location: 'Tenkasi',
    quality_grade: 'Grade A',
    notes: ''
  })

  const fetchDemands = async () => {
    try {
      const res = await myAdvanceDemands()
      setDemands(res.data || [])
    } catch (err) {
      console.error('Failed to load advance demands', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDemands()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.product_name.trim()) {
      addToast(isTamil ? 'பயிர் பெயரை உள்ளிடவும்' : 'Please specify a crop name', 'error')
      return
    }
    if (!formData.required_quantity || Number(formData.required_quantity) <= 0) {
      addToast(isTamil ? 'சரியான அளவை உள்ளிடவும்' : 'Please enter a valid quantity', 'error')
      return
    }
    if (!formData.needed_by) {
      addToast(isTamil ? 'தேவைப்படும் நாளைத் தேர்ந்தெடுக்கவும்' : 'Please choose a required date', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await createAdvanceDemand({
        ...formData,
        required_quantity: parseFloat(formData.required_quantity)
      })
      addToast(isTamil ? 'முன்பதிவு அனைத்து உழவர்களுக்கும் அனுப்பப்பட்டது!' : 'Advance demand broadcasted to all registered farmers! First priority auto-assignment active.', 'success')
      setDemands((prev) => [res.data, ...prev])
      setFormData({
        product_name: '',
        required_quantity: '',
        unit: 'kg',
        needed_by: defaultNeededDate(),
        delivery_location: 'Tenkasi',
        quality_grade: 'Grade A',
        notes: ''
      })
    } catch (err) {
      addToast(err.response?.data?.detail || (isTamil ? 'முன்பதிவு சமர்ப்பிக்க முடியவில்லை' : 'Failed to submit advance demand'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (demandId) => {
    if (!window.confirm(isTamil ? 'இந்த முன்பதிவை ரத்துசெய்ய விரும்புகிறீர்களா?' : 'Are you sure you want to cancel this advance booking? Any allocated stock will be returned to the open market.')) {
      return
    }
    setCancellingId(demandId)
    try {
      const res = await cancelAdvanceDemand(demandId)
      addToast(isTamil ? 'முன்பதிவு ரத்துசெய்யப்பட்டது.' : 'Advance booking request cancelled.', 'info')
      setDemands((prev) => prev.map((d) => (d.id === demandId ? res.data : d)))
    } catch (err) {
      addToast(err.response?.data?.detail || (isTamil ? 'ரத்து செய்ய முடியவில்லை' : 'Failed to cancel advance booking'), 'error')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-leaf-700 text-white p-6 sm:p-10 mb-8 shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-emerald-100 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t('advanceDemands.guaranteedDirect', 'Guaranteed Direct Sourcing • Priority Allocation')}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            {t('advanceDemands.title', 'Advance Produce Booking & Early Priority Demand')}
          </h1>
          <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed mb-6">
            {t('advanceDemands.subtitle', 'Need fresh crops in the coming days? Apply early! Your demand is broadcast immediately to all registered farmers in Tenkasi, Tirunelveli, and Thoothukudi. When farmers supply produce, our AI assigns it to you with #1 Priority before anyone else.')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-emerald-100">
              <BellRing className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <span>{t('advanceDemands.instantPush', 'Instant push notification to all farmers')}</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-100">
              <ShieldCheck className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span>{t('advanceDemands.priorityReservation', 'Strict 1st-applicant priority reservation')}</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-100">
              <TrendingUp className="w-4 h-4 text-sky-300 flex-shrink-0" />
              <span>{t('advanceDemands.noMarkup', 'No middleman markup • Direct farmer rate')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form Column (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-7 sticky top-24">
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">{t('advanceDemands.bookTitle', 'Book Produce in Advance')}</h2>
                <p className="text-xs text-gray-500">{t('advanceDemands.bookSubtitle', 'Apply early for guaranteed arrival')}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Crop Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  {t('advanceDemands.cropNameLabel', 'Produce / Crop Name *')}
                </label>
                <input
                  type="text"
                  placeholder={t('advanceDemands.cropNamePlaceholder', 'e.g. Brinjal, Tomato, Country Onion...')}
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                />
                {/* Quick select pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POPULAR_CROPS.map((crop) => (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => setFormData({ ...formData, product_name: crop })}
                      className={`text-2xs px-2.5 py-1 rounded-lg border font-bold transition ${
                        formData.product_name === crop
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {crop}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    {t('advanceDemands.quantityLabel', 'Quantity Needed *')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 500"
                    value={formData.required_quantity}
                    onChange={(e) => setFormData({ ...formData, required_quantity: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    {t('advanceDemands.unitLabel', 'Unit')}
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    <option value="kg">{t('common.kg', 'kg')}</option>
                    <option value="quintal">{t('common.quintal', 'quintal')}</option>
                    <option value="crate">{t('common.crate', 'crate')}</option>
                  </select>
                </div>
              </div>

              {/* Needed By Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  {t('advanceDemands.neededByLabel', 'Needed By Date *')}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.needed_by}
                    onChange={(e) => setFormData({ ...formData, needed_by: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    required
                  />
                </div>
              </div>

              {/* Delivery District / Location */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  {t('advanceDemands.deliveryLocationLabel', 'Delivery Destination / District *')}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={formData.delivery_location}
                    onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    <option value="Tenkasi">{isTamil ? 'தென்காசி மத்திய கிடங்கு மையம்' : 'Tenkasi Central Hub'}</option>
                    <option value="Tirunelveli">{isTamil ? 'திருநெல்வேலி மத்திய கிடங்கு மையம்' : 'Tirunelveli Central Hub'}</option>
                    <option value="Thoothukudi">{isTamil ? 'தூத்துக்குடி மத்திய கிடங்கு மையம்' : 'Thoothukudi Central Hub'}</option>
                    <option value="Sankarankovil">{isTamil ? 'சங்கரன்கோவில்' : 'Sankarankovil'}</option>
                    <option value="Ambasamudram">{isTamil ? 'அம்பாசமுத்திரம்' : 'Ambasamudram'}</option>
                    <option value="Kovilpatti">{isTamil ? 'கோவில்பட்டி' : 'Kovilpatti'}</option>
                  </select>
                </div>
              </div>

              {/* Quality Grade */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  {t('advanceDemands.qualityGradeLabel', 'Quality Grade')}
                </label>
                <select
                  value={formData.quality_grade}
                  onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                >
                  <option value="Grade A">{isTamil ? 'கிரேடு A (முதல் தரம் / ஏற்றுமதி தரம்)' : 'Grade A (Premium / Export Quality)'}</option>
                  <option value="Grade B">{isTamil ? 'கிரேடு B (நிலையான சந்தை தரம்)' : 'Grade B (Standard Market Quality)'}</option>
                  <option value="Any">{isTamil ? 'எந்தவொரு புதிய அறுவடையும்' : 'Any Fresh Harvest'}</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {submitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>{t('advanceDemands.submitting', 'Broadcasting to Farmers...')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{t('advanceDemands.submitBtn', 'Broadcast Advance Demand')}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right List Column (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <span>{t('advanceDemands.myDemandsTitle', 'My Advance Priority Bookings')}</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {demands.length}
              </span>
            </h2>
            <button
              onClick={fetchDemands}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {t('common.refresh', 'Refresh')}
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border border-gray-100">
              <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              <p className="text-sm font-medium">{isTamil ? 'உங்கள் முன்பதிவுகள் சரிபார்க்கப்படுகின்றன...' : 'Checking your advance reservations...'}</p>
            </div>
          ) : demands.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-2xs">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800 mb-1">{t('advanceDemands.noDemandsTitle', 'No advance demands submitted yet')}</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                {t('advanceDemands.noDemandsDesc', 'Apply early using the form on the left. Farmers will be notified immediately to prepare your crops!')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {demands.map((demand) => {
                const reqQty = Number(demand.required_quantity) || 0
                const matchedQty = Number(demand.matched_quantity) || 0
                const pct = reqQty > 0 ? Math.min(100, Math.round((matchedQty / reqQty) * 100)) : 0
                const isFullyMatched = demand.status === 'MATCHED'
                const isPartiallyMatched = demand.status === 'PARTIALLY_MATCHED'
                const isClosed = demand.status === 'CLOSED'

                return (
                  <div
                    key={demand.id}
                    className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6 transition hover:shadow-md"
                  >
                    {/* Top Row: Title + Status */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-gray-900">{demand.product_name}</h3>
                          <span className="text-xs font-bold text-gray-500">#{demand.id}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {isTamil ? 'தேவைப்படும் நாள்:' : 'Needed by:'} <b>{demand.needed_by || (isTamil ? 'விரைவில்' : 'Soon')}</b>
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {demand.delivery_location || 'Tenkasi'}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div>
                        {isFullyMatched ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            {isTamil ? 'முதல் முன்னுரிமை நிறைவுற்றது (100%)' : '1st Priority Fulfilled (100%)'}
                          </span>
                        ) : isPartiallyMatched ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            {isTamil ? `பகுதி ஒதுக்கீடு (${pct}%)` : `Partially Assigned (${pct}%)`}
                          </span>
                        ) : isClosed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            <XCircle className="w-3.5 h-3.5 text-gray-400" />
                            {t('advanceDemands.statusCancelled', 'Closed')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <BellRing className="w-3.5 h-3.5 text-amber-700" />
                            {t('advanceDemands.statusOpen', 'Broadcasted to All Farmers')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Progress Bar */}
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 mb-4">
                      <div className="flex justify-between items-center text-xs font-bold text-gray-700 mb-1.5">
                        <span>{isTamil ? 'ஒதுக்கப்பட்ட அளவு:' : 'Reserved Allocation:'}</span>
                        <span>
                          {matchedQty} / {reqQty} {demand.unit} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFullyMatched ? 'bg-emerald-500' : 'bg-leaf-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Matched Farmer List */}
                    {demand.matches && demand.matches.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          {isTamil ? 'ஒதுக்கப்பட்ட உழவர்கள் (முன்னுரிமை ஒதுக்கீடு):' : 'Assigned Farmers (Priority Allocation):'}
                        </p>
                        {demand.matches.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span className="font-black text-gray-900">{m.farmer_name}</span>
                              <span className="text-emerald-700 font-bold">
                                &bull; {m.matched_quantity} {demand.unit} {isTamil ? 'ஒதுக்கப்பட்டது' : 'Reserved'}
                              </span>
                            </div>
                            {m.farmer_price && (
                              <span className="font-bold text-gray-700">
                                ₹{m.farmer_price}/{demand.unit}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic mb-4">
                        {isTamil
                          ? 'உழவர்களின் விளைபொருள் வரத்துக்காக காத்திருக்கிறது. மத்திய கிடங்கிற்கு உழவர்கள் விளைபொருளை கொண்டு வரும் போது தானாகவே உங்களுக்கே முதல் முன்னுரிமையில் ஒதுக்கப்படும்!'
                          : 'Waiting for farmer harvest delivery. When fresh produce is brought to the central warehouse, it will automatically allocate to you with #1 Priority!'}
                      </p>
                    )}

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
                      <span className="text-gray-400">
                        {isTamil ? 'சமர்ப்பிக்கப்பட்டது:' : 'Submitted:'} {new Date(demand.created_at).toLocaleDateString()}
                      </span>
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => handleCancel(demand.id)}
                          disabled={cancellingId === demand.id}
                          className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline transition"
                        >
                          {cancellingId === demand.id ? (isTamil ? 'ரத்து செய்யப்படுகிறது...' : 'Cancelling...') : t('advanceDemands.cancelBooking', 'Cancel Request')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

