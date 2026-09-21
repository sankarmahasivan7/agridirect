import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ClipboardList, 
  Package, 
  Truck, 
  MapPin, 
  Calendar, 
  IndianRupee, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Search,
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  Star,
  Camera,
  ShieldCheck,
  XCircle,
  RotateCcw,
  X
} from 'lucide-react'
import { myOrders, getMyReviews, cancelOrder } from '../../services/api.js'
import ReviewModal from '../../components/ReviewModal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function BuyerOrders() {
  const { t, isTamil, language } = useLanguage()
  const [orders, setOrders] = useState([])
  const [reviewsList, setReviewsList] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedOrderForReview, setSelectedOrderForReview] = useState(null)
  const [selectedExistingReview, setSelectedExistingReview] = useState(null)
  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const { addToast } = useToast()

  const STATUS_CONFIG = {
    PENDING: { label: t('orders.pending', 'Pending Confirmation'), color: 'bg-amber-100 text-amber-800 border-amber-300', step: 1 },
    CONFIRMED: { label: t('orders.confirmed', 'Confirmed by Farmer'), color: 'bg-blue-100 text-blue-800 border-blue-300', step: 2 },
    PROCESSING: { label: t('orders.processing', 'Harvesting / Packing'), color: 'bg-indigo-100 text-indigo-800 border-indigo-300', step: 3 },
    READY_FOR_PICKUP: { label: t('orders.readyForPickup', 'Ready for Vehicle'), color: 'bg-purple-100 text-purple-800 border-purple-300', step: 4 },
    IN_TRANSIT: { label: t('orders.inTransit', 'On the Road (GPS Live)'), color: 'bg-sky-100 text-sky-800 border-sky-300', step: 5 },
    DELIVERED: { label: t('orders.delivered', 'Delivered Fresh'), color: 'bg-emerald-100 text-emerald-800 border-emerald-300', step: 6 },
    CANCELLED: { label: t('orders.cancelled', 'Cancelled'), color: 'bg-red-100 text-red-800 border-red-300', step: 0 }
  }

  const formatOrderDate = (dateStr) => {
    if (!dateStr) return t('orders.recentlyPlaced', 'Recently Placed')
    try {
      const isoStr = typeof dateStr === 'string' && !dateStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)
        ? `${dateStr}Z`
        : dateStr
      const d = new Date(isoStr)
      return d.toLocaleString(isTamil ? 'ta-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return t('orders.recentlyPlaced', 'Recently Placed')
    }
  }

  const getCancellationInfo = (order) => {
    if (!order || order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      return { canCancel: false, expired: false, label: null }
    }

    // 1. Prioritize backend-computed real-time fields
    if (order.seconds_remaining_to_cancel !== undefined && order.can_cancel !== undefined) {
      if (order.can_cancel && order.seconds_remaining_to_cancel > 0) {
        const mins = Math.max(1, Math.ceil(order.seconds_remaining_to_cancel / 60))
        return {
          canCancel: true,
          expired: false,
          remainingMinutes: mins,
          label: isTamil ? `${mins} நிமிடம் மீதம் உள்ளது` : `${mins}m left to cancel`
        }
      } else if (['PENDING', 'CONFIRMED'].includes(order.status)) {
        return {
          canCancel: false,
          expired: true,
          label: t('orders.cancellationClosed', 'Cancellation closed (>1 hr)')
        }
      }
    }

    // 2. Client-side fallback with strict UTC timezone normalization
    try {
      const raw = order.created_at
      if (!raw) return { canCancel: false, expired: false, label: null }
      const isoStr = typeof raw === 'string' && !raw.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(raw)
        ? `${raw}Z`
        : raw
      const created = new Date(isoStr).getTime()
      const now = Date.now()
      const elapsedMinutes = Math.floor((now - created) / 60000)
      const remainingMinutes = 60 - elapsedMinutes

      if (remainingMinutes > 0 && ['PENDING', 'CONFIRMED'].includes(order.status)) {
        return {
          canCancel: true,
          expired: false,
          remainingMinutes,
          label: isTamil ? `${remainingMinutes} நிமிடம் மீதம் உள்ளது` : `${remainingMinutes}m left to cancel`
        }
      } else {
        return {
          canCancel: false,
          expired: elapsedMinutes >= 60,
          label: t('orders.cancellationClosed', 'Cancellation closed (>1 hr)')
        }
      }
    } catch {
      return { canCancel: false, expired: false, label: null }
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return
    setCancellingId(cancelModalOrder.id)
    try {
      const res = await cancelOrder(cancelModalOrder.id)
      addToast(`Order #${cancelModalOrder.id} has been cancelled within 1 hour.`, 'info')
      setOrders((prev) => prev.map((o) => o.id === cancelModalOrder.id ? res.data : o))
      setCancelModalOrder(null)
    } catch (err) {
      addToast(err.response?.data?.detail || 'Could not cancel order.', 'error')
    } finally {
      setCancellingId(null)
    }
  }

  useEffect(() => {
    Promise.all([myOrders(), getMyReviews()])
      .then(([ordersRes, revsRes]) => {
        setOrders(ordersRes.data)
        setReviewsList(revsRes.data || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const reviewsByOrderId = {}
  for (const r of reviewsList) {
    reviewsByOrderId[r.order_id] = r
  }

  const handleOpenReview = (order) => {
    setSelectedOrderForReview(order)
    setSelectedExistingReview(reviewsByOrderId[order.id] || null)
    setReviewModalOpen(true)
  }

  const handleReviewSubmitted = (newReview) => {
    setReviewsList((prev) => {
      const filtered = prev.filter((r) => r.order_id !== newReview.order_id)
      return [newReview, ...filtered]
    })
  }

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = 
      String(o.id).includes(searchQuery) ||
      (o.delivery_location && o.delivery_location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.items && o.items.some((it) => it.product_name.toLowerCase().includes(searchQuery.toLowerCase())))
    
    const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-leaf-700" />
            {t('orders.title', 'My Orders & Invoices')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('orders.subtitle', 'Real-time fulfillment tracking from farm harvest to your doorstep.')}
          </p>
        </div>
        <Link to="/buyer/marketplace" className="btn-primary text-sm flex items-center justify-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          {t('orders.orderMore', 'Order More Produce')}
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder={t('orders.searchPlaceholder', 'Search by order ID, crop name, or location...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input sm:w-48"
        >
          <option value="ALL">{t('orders.allStatuses', 'All Statuses')}</option>
          <option value="PENDING">{t('orders.pending', 'Pending')}</option>
          <option value="CONFIRMED">{t('orders.confirmed', 'Confirmed')}</option>
          <option value="PROCESSING">{t('orders.processing', 'Processing')}</option>
          <option value="READY_FOR_PICKUP">{t('orders.readyForPickup', 'Ready for Pickup')}</option>
          <option value="IN_TRANSIT">{t('orders.inTransit', 'In Transit')}</option>
          <option value="DELIVERED">{t('orders.delivered', 'Delivered')}</option>
          <option value="CANCELLED">{t('orders.cancelled', 'Cancelled')}</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card p-6 animate-pulse space-y-4">
              <div className="h-5 bg-gray-200 rounded w-1/4"></div>
              <div className="h-12 bg-gray-100 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card text-center py-16 px-4">
          <div className="w-16 h-16 bg-leaf-50 text-leaf-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">{t('orders.noOrdersFound', 'No Orders Found')}</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            {orders.length === 0
              ? t('orders.noOrdersDesc', "You haven't placed any farm-direct orders yet. Explore our fresh marketplace to get started!")
              : t('orders.noOrdersMatch', 'No orders match your search and filter criteria.')}
          </p>
          {orders.length === 0 ? (
            <Link to="/buyer/marketplace" className="btn-primary inline-flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              {t('orders.exploreMarketplace', 'Explore Fresh Marketplace')}
            </Link>
          ) : (
            <button
              onClick={() => { setSearchQuery(''); setFilterStatus('ALL') }}
              className="btn-secondary text-sm"
            >
              {t('orders.resetFilters', 'Reset Filters')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((o) => {
            const statusInfo = STATUS_CONFIG[o.status] || {
              label: o.status,
              color: 'bg-gray-100 text-gray-700 border-gray-300',
              step: 1
            }

            return (
              <div key={o.id} className="card overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-leaf-50 text-leaf-700 flex items-center justify-center font-bold text-sm">
                      #{o.id}
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">{t('orders.orderNumber', 'Order')} #{o.id}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{formatOrderDate(o.created_at)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="badge-actual">{t('common.actual', 'Actual')}</span>
                  </div>
                </div>

                {/* Delivery Verification OTP Banner */}
                {o.delivery_otp && o.status !== 'CANCELLED' && (
                  <div className="flex items-center justify-between flex-wrap gap-2 px-3.5 py-2 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs font-bold mb-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{t('orders.deliveryOtp', 'Delivery Verification OTP:')}</span>
                      <span className="font-mono text-sm tracking-widest font-black text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-lg border border-amber-400">
                        {o.delivery_otp}
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-800 font-medium">
                      {o.status === 'DELIVERED'
                        ? t('orders.otpDelivered', '✓ Verified by delivery driver')
                        : t('orders.otpInstructions', 'Share this 6-digit OTP with your delivery driver upon doorstep arrival')}
                    </span>
                  </div>
                )}

                {/* Items List */}
                <div className="bg-gray-50/70 rounded-xl p-3.5 mb-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('orders.purchasedItems', 'Purchased Items')}</p>
                  <ul className="divide-y divide-gray-100 text-sm">
                    {o.items.map((it, idx) => (
                      <li key={idx} className="py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-leaf-500"></span>
                          <span className="font-medium text-gray-800">{it.product_name}</span>
                          <span className="text-xs text-gray-400">
                            ({Number(it.quantity)} × ₹{Number(it.price_at_purchase)})
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">₹{Number(it.line_subtotal).toLocaleString('en-IN')}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Financial Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-gray-100 text-xs mb-4">
                  <div>
                    <span className="text-gray-400 block">{t('orders.farmerPay', 'Farmer Pay (Subtotal)')}</span>
                    <span className="font-semibold text-gray-700 text-sm">₹{Number(o.subtotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">{t('orders.logisticsTransport', 'Logistics & Transport')}</span>
                    <span className="font-semibold text-gray-700 text-sm">₹{Number(o.logistics_cost).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">{t('orders.platformFee', 'Platform Fee (2%)')}</span>
                    <span className="font-semibold text-gray-700 text-sm">₹{Number(o.platform_fee).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-medium">{t('orders.totalPaid', 'Total Paid')}</span>
                    <span className="font-bold text-leaf-700 text-base">₹{Number(o.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Destination & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>{t('orders.deliveringTo', 'Delivering to:')} <b className="text-gray-700">{o.delivery_location || (isTamil ? 'பதிவு செய்யப்பட்ட முகவரி' : 'Address on file')}</b></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Rate & Review Button */}
                    {o.status !== 'CANCELLED' && (
                      reviewsByOrderId[o.id] ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReview(o)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs transition active:scale-98"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{t('orders.rated', 'Rated')} {reviewsByOrderId[o.id].rating}★ &bull; {t('orders.viewFeedback', 'View Feedback')}</span>
                          {reviewsByOrderId[o.id].image_url && <Camera className="w-3 h-3 text-amber-700 ml-0.5" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenReview(o)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-300 shadow-2xs transition active:scale-98"
                        >
                          <Star className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('orders.rateReview', 'Rate & Review Produce')}</span>
                        </button>
                      )
                    )}

                    <Link
                      to={o.transport_request_id ? `/transport/track/${o.transport_request_id}` : `/transport/track/${o.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-leaf-700 hover:text-leaf-800 hover:underline ml-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {t('orders.trackShipment', 'Track Shipment')}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    {/* 1-Hour Order Cancellation Button */}
                    {(() => {
                      const cancelInfo = getCancellationInfo(o)
                      if (cancelInfo.canCancel) {
                        return (
                          <button
                            type="button"
                            onClick={() => setCancelModalOrder(o)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 shadow-2xs transition active:scale-98"
                            title={`You can cancel within 1 hour of placement (${cancelInfo.label})`}
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>{t('orders.cancelOrder', 'Cancel Order')} ({cancelInfo.label})</span>
                          </button>
                        )
                      }
                      if (o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && cancelInfo.expired) {
                        return (
                          <span
                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 border border-gray-200"
                            title="Orders cannot be cancelled after 1 hour"
                          >
                            <Clock className="w-3 h-3 text-gray-400" />
                            {t('orders.cancellationClosed', 'Cancellation closed (>1 hr)')}
                          </span>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Produce Review & Photo Upload Modal */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        order={selectedOrderForReview}
        existingReview={selectedExistingReview}
        onReviewSubmitted={handleReviewSubmitted}
      />

      {/* 1-Hour Order Cancellation Confirmation Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-100 relative">
            <button
              onClick={() => setCancelModalOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black text-gray-900 mb-2">{t('orders.cancelModalTitle', 'Cancel Order')} #{cancelModalOrder.id}?</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              {t('orders.cancelModalDesc', 'You are within the 1-hour cancellation window. If you confirm, your order will be cancelled, reserved produce restored to the market, and any associated transport stopped.')}
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-6 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-normal">
                {t('orders.cancelTimePolicy', 'Time Policy: Cancellation is strictly restricted to 1 hour from order creation.')}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                disabled={cancellingId === cancelModalOrder.id}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition"
              >
                {t('orders.keepOrder', 'Keep Order')}
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancellingId === cancelModalOrder.id}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-md shadow-red-600/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {cancellingId === cancelModalOrder.id ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>{t('orders.cancelling', 'Cancelling...')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>{t('orders.yesCancelOrder', 'Yes, Cancel Order')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


