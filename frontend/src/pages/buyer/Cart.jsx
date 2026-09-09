import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { createOrder, verifyPayment, failPayment, confirmQrPayment } from '../../services/api.js'
import LocationPicker from '../../components/LocationPicker.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { QRCodeSVG } from 'qrcode.react'
import phonepeQrImg from '../../assets/phonepe_qr.jpg'
import { 
  ShoppingBag, 
  Trash2, 
  Minus, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  Percent, 
  MapPin, 
  Loader2, 
  AlertCircle,
  Zap,
  Clock,
  Building2,
  PackageCheck,
  ArrowRight,
  Smartphone,
  Banknote,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  X
} from 'lucide-react'

const SUPPORTED_DISTRICTS = [
  { name: 'Tenkasi', hub: 'Tenkasi Central Agri-Warehouse' },
  { name: 'Tirunelveli', hub: 'Tirunelveli Central Agri-Warehouse' },
  { name: 'Thoothukudi', hub: 'Thoothukudi Central Agri-Warehouse' },
]

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, subtotal } = useCart()
  const { user, district: authDistrict, warehouseName: authWarehouseName } = useAuth()
  const { addToast } = useToast()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const buyerDistrict = user?.district || authDistrict || 'Tenkasi'
  const buyerWarehouse = user?.warehouse_name || authWarehouseName || `${buyerDistrict} Central Agri-Warehouse`

  const [selectedDistrict, setSelectedDistrict] = useState(buyerDistrict)
  const [deliveryLocation, setDeliveryLocation] = useState(user?.location || '')
  const [deliveryLat, setDeliveryLat] = useState(user?.default_latitude ? Number(user.default_latitude) : 8.9594)
  const [deliveryLng, setDeliveryLng] = useState(user?.default_longitude ? Number(user.default_longitude) : 77.3167)
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [placedOrder, setPlacedOrder] = useState(null)

  useEffect(() => {
    if (user?.district) {
      setSelectedDistrict(user.district)
    }
    if (user?.location && !deliveryLocation) {
      setDeliveryLocation(user.location)
    }
    if (user?.default_latitude != null && user?.default_longitude != null) {
      setDeliveryLat(Number(user.default_latitude))
      setDeliveryLng(Number(user.default_longitude))
    }
  }, [user])

  // UPI QR Code modal states
  const [showQrModal, setShowQrModal] = useState(false)
  const [activeQrOrder, setActiveQrOrder] = useState(null)
  const [utrNumber, setUtrNumber] = useState('')
  const [confirmingQr, setConfirmingQr] = useState(false)
  const [copiedVpa, setCopiedVpa] = useState(false)

  // Estimated only for UI preview; authoritative billing computed in backend
  const estLogistics = subtotal > 0 ? items.reduce((s, i) => s + Number(i.quantity), 0) * 4 : 0
  const estPlatformFee = subtotal * 0.02
  const estTotal = subtotal + estLogistics + estPlatformFee

  const totalKg = items.reduce((s, i) => s + Number(i.quantity), 0)

  const copyVpaToClipboard = (vpa) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(vpa)
      setCopiedVpa(true)
      setTimeout(() => setCopiedVpa(false), 2500)
    }
  }

  const handleCheckout = async () => {
    setError('')
    const address = deliveryLocation.trim() 
      ? `${deliveryLocation.trim()}, ${selectedDistrict}`
      : `${selectedDistrict} Central Destination`

    setLoading(true)
    try {
      if (paymentMethod === 'PAY_ON_DELIVERY') {
        const res = await createOrder({
          items: items.map((i) => ({ listing_id: i.listing_id, quantity: Number(i.quantity) })),
          delivery_location: address,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          payment_method: 'PAY_ON_DELIVERY',
        })
        const order = res.data
        setPlacedOrder(order)
        clearCart()
        addToast(`Order #${order.id} placed! Consignment routed to ${selectedDistrict} Central Warehouse.`, 'success', 6000)
        setLoading(false)
      } else {
        // Direct UPI QR Code Flow (Dynamic NPCI URI for GPay, PhonePe, Paytm, BHIM)
        const res = await createOrder({
          items: items.map((i) => ({ listing_id: i.listing_id, quantity: Number(i.quantity) })),
          delivery_location: address,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          payment_method: 'UPI',
        })
        const order = res.data
        setActiveQrOrder(order)
        setUtrNumber('')
        setShowQrModal(true)
        setLoading(false)
      }
    } catch (err) {
      setError(err.response?.data?.detail || t('cart.checkoutFailed', 'Checkout failed. Please try again.'))
      setLoading(false)
    }
  }

  const handleConfirmQrPayment = async () => {
    if (!activeQrOrder) return
    setConfirmingQr(true)
    setError('')
    try {
      const res = await confirmQrPayment({
        order_id: activeQrOrder.id,
        utr_number: utrNumber.trim() || undefined,
      })
      setShowQrModal(false)
      setPlacedOrder(res.data)
      clearCart()
      addToast(`Payment confirmed! Order #${activeQrOrder.id} dispatched to ${selectedDistrict} Hub.`, 'success', 6000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to verify UPI payment. Please check your transaction details.')
    } finally {
      setConfirmingQr(false)
    }
  }

  const handleCancelQrModal = async () => {
    if (activeQrOrder && !confirmingQr) {
      try {
        await failPayment({
          order_id: activeQrOrder.id,
          reason: 'Buyer cancelled UPI QR payment modal',
        })
      } catch (e) {
        // ignore
      }
      setShowQrModal(false)
      setActiveQrOrder(null)
      setError('Payment was cancelled. Reserved produce stock has been restored to the marketplace.')
    }
  }

  // If order was placed, display Amazon-style confirmation with package timeline
  if (placedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft-xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Order Placed, Thank You!</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Confirmation notification dispatched to your dashboard and district transporter network.
              </p>
            </div>
          </div>

          {/* Order Details Banner */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">ORDER NUMBER</span>
              <span className="font-extrabold text-slate-900 text-sm">#{placedOrder.id}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">DELIVERY HUB</span>
              <span className="font-bold text-slate-800">{selectedDistrict} Central Warehouse</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">TOTAL AMOUNT</span>
              <span className="font-black text-emerald-700 text-sm">₹{Number(placedOrder.total_amount).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">PAYMENT METHOD</span>
              <span className="font-bold text-slate-800">
                {placedOrder.payment_method === 'UPI' ? 'UPI QR Code' : 'Pay on Delivery'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">PAYMENT STATUS</span>
              <span className={`font-black text-xs px-2.5 py-0.5 rounded-full inline-block mt-0.5 ${
                placedOrder.payment_status === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {placedOrder.payment_status || 'PENDING'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">ESTIMATED DELIVERY</span>
              <span className="font-bold text-slate-800">Tomorrow, by 11:00 AM</span>
            </div>
          </div>

          {/* Amazon 4-Stage Fulfillment Tracker */}
          <div className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Consignment Fulfillment Progress
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-emerald-800 block">Ordered</span>
                <span className="text-slate-400 text-[10px]">Just now</span>
              </div>

              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto shadow-sm animate-pulse">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-amber-800 block">Warehouse</span>
                <span className="text-slate-400 text-[10px]">Packing produce</span>
              </div>

              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                  <Truck className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-500 block">Dispatched</span>
                <span className="text-slate-400 text-[10px]">Carrier match</span>
              </div>

              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-500 block">Delivered</span>
                <span className="text-slate-400 text-[10px]">To doorstep</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100">
            <Link
              to={placedOrder.transport_request_id ? `/transport/track/${placedOrder.transport_request_id}` : `/transport/track/${placedOrder.id}`}
              className="w-full sm:w-auto flex-1 bg-leaf-600 hover:bg-leaf-700 text-white font-extrabold py-3 px-6 rounded-xl text-center shadow-xs transition flex items-center justify-center gap-2 text-sm"
            >
              <Truck className="w-4 h-4" />
              Track Live Shipment
            </Link>
            <Link
              to="/buyer/orders"
              className="w-full sm:w-auto flex-1 bg-[#ffd814] hover:bg-[#f7ca00] text-slate-900 font-extrabold py-3 px-6 rounded-xl text-center shadow-xs transition text-sm"
            >
              View Order in My Orders
            </Link>
            <Link
              to="/buyer/marketplace"
              className="w-full sm:w-auto btn-secondary py-3 px-6 text-center text-xs font-semibold"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Empty cart view
  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Your AgriDirect Cart is empty</h2>
        <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
          Your shopping cart is currently empty. Discover fresh harvest crops directly from local farmers in Tenkasi, Tirunelveli, and Thoothukudi.
        </p>
        <Link
          to="/buyer/marketplace"
          className="inline-flex items-center gap-2 bg-[#ffd814] hover:bg-[#f7ca00] text-slate-900 font-extrabold py-3 px-6 rounded-xl text-sm shadow-xs transition"
        >
          <span>Explore Fresh Produce</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Page Title */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shopping Cart</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fulfilled directly through District Central Warehouses (Tenkasi, Tirunelveli, Thoothukudi)
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500">Price</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Cart Items & Delivery Hub Selector (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Cart Items Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 sm:p-6 divide-y divide-slate-100">
            {items.map((i) => {
              const itemPrice = Number(i.price_per_unit) || 0
              const itemQty = Number(i.quantity) || 0
              const lineTotal = itemPrice * itemQty
              const maxAvail = Number(i.available) || 9999

              return (
                <div key={i.listing_id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-extrabold uppercase">
                        {i.category_name || 'Produce'}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-amber-400 text-amber-500" />
                        AgriDirect Fulfilled
                      </span>
                    </div>

                    <h3 className="font-extrabold text-lg text-slate-900 capitalize">
                      {i.product_name}
                    </h3>

                    <p className="text-xs text-slate-500">
                      Sold by: <span className="font-semibold text-slate-700">{i.farmer_name || 'Verified Farmer'}</span>
                    </p>

                    <p className="text-xs font-bold text-emerald-600">
                      In Stock · {maxAvail} {i.unit} available
                    </p>

                    <p className="text-[11px] text-slate-400">
                      Eligible for FREE or flat ₹4/kg Warehouse Transit Delivery
                    </p>

                    {/* Stepper and Delete */}
                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(i.listing_id, Math.max(1, Number((itemQty - 1).toFixed(1))))}
                          disabled={itemQty <= 1}
                          className="w-7 h-7 rounded bg-white font-bold text-slate-700 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          step="1"
                          min={1}
                          max={maxAvail}
                          value={itemQty}
                          onChange={(e) => updateQuantity(i.listing_id, Math.min(maxAvail, Math.max(1, Number(e.target.value))))}
                          className="w-12 text-center text-xs font-extrabold bg-transparent border-0 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(i.listing_id, Math.min(maxAvail, Number((itemQty + 1).toFixed(1))))}
                          disabled={itemQty >= maxAvail}
                          className="w-7 h-7 rounded bg-white font-bold text-slate-700 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(i.listing_id)}
                        className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="text-right sm:min-w-[100px]">
                    <span className="text-lg font-black text-slate-900">
                      ₹{lineTotal.toFixed(2)}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      (₹{itemPrice.toFixed(2)}/{i.unit})
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Delivery Hub & Destination Address Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">
                  Delivery Destination & Warehouse Hub
                </h2>
                <p className="text-xs text-slate-500">
                  AgriDirect logistics is strictly operating within 3 authorized Tamil Nadu districts.
                </p>
              </div>
            </div>

            {/* Registered District Hub (Automatically resolved from buyer account) */}
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                        Assigned Delivery District
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Buyer Verified
                      </span>
                    </div>
                    <p className="text-base font-extrabold text-slate-900 mt-0.5">
                      {selectedDistrict} District
                    </p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[11px] text-slate-500 block font-medium">Consignment Hub</span>
                  <span className="text-xs font-bold text-slate-800">
                    {buyerWarehouse}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-amber-900/80 mt-2.5 pt-2.5 border-t border-amber-200/60 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Your orders are automatically fulfilled from the <b>{selectedDistrict}</b> warehouse hub according to your buyer profile.</span>
              </p>
            </div>

            {/* Street Address */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Street Address / Landmark ({selectedDistrict})
              </label>
              <input
                className="input text-sm"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder={`e.g. 24 Bazaar Street, near Old Bus Stand, ${selectedDistrict}`}
              />
            </div>

            {/* Location GPS Picker */}
            <LocationPicker
              latitude={deliveryLat}
              longitude={deliveryLng}
              onChange={(lat, lng) => { setDeliveryLat(lat); setDeliveryLng(lng) }}
              label="Pinpoint Delivery Coordinates"
            />
          </div>

        </div>

        {/* Right Column: Amazon Sticky Order Summary Box (4 cols) */}
        <div className="lg:col-span-4 sticky top-20">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-soft-lg p-6 space-y-4">
            
            {/* Free Delivery Banner */}
            <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Consolidated Warehouse Delivery</span>
                <span>Products will be collected from {selectedDistrict} Central Agri-Warehouse and delivered together.</span>
              </div>
            </div>

            {/* Subtotal line */}
            <div className="text-slate-900 text-sm">
              <span>Subtotal ({items.length} items, {totalKg.toFixed(1)} kg): </span>
              <span className="font-black text-xl">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Order Cost Breakdown */}
            <div className="pt-2 border-t border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal (Farmer Payout):</span>
                <span className="font-bold text-slate-800">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Logistics & Transport:</span>
                <span className="font-bold text-slate-800">₹{estLogistics.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Platform Service Fee (2%):</span>
                <span className="font-bold text-slate-800">₹{estPlatformFee.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-900 font-black text-base">
                <span>Final Order Total:</span>
                <span className="text-amber-700">₹{estTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Choose Payment Method
              </label>

              {/* PhonePe & UPI QR Code Payment */}
              <div
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                  paymentMethod === 'UPI'
                    ? 'border-purple-600 bg-purple-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'UPI'}
                  onChange={() => setPaymentMethod('UPI')}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-purple-600" />
                      PhonePe & UPI QR Code (Scan & Pay)
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                      ACCEPTED HERE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Scan official PhonePe QR code (Seyed Mohammed Safin) using PhonePe, GPay, Paytm, or BHIM.
                  </p>
                </div>
              </div>

              {/* Pay on Delivery */}
              <div
                onClick={() => setPaymentMethod('PAY_ON_DELIVERY')}
                className={`p-3 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                  paymentMethod === 'PAY_ON_DELIVERY'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'PAY_ON_DELIVERY'}
                  onChange={() => setPaymentMethod('PAY_ON_DELIVERY')}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-600" />
                    Pay on Delivery (POD)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pay ₹{estTotal.toFixed(2)} via Cash or UPI directly to your assigned carrier upon doorstep delivery.
                  </p>
                </div>
              </div>
            </div>

            {/* Amazon Yellow CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-[#ffd814] hover:bg-[#f7ca00] text-slate-950 font-black py-3.5 px-4 rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Checkout…</span>
                </>
              ) : paymentMethod === 'UPI' ? (
                <>
                  <QrCode className="w-4 h-4 text-slate-950" />
                  <span>Pay ₹{estTotal.toFixed(2)} with PhonePe / UPI QR</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                  <span>Confirm Pay on Delivery (₹{estTotal.toFixed(2)})</span>
                </>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* AgriDirect Consumer Guarantees */}
            <div className="pt-4 border-t border-slate-200 space-y-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Direct Farmer Produce with zero middlemen</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Pre-screened at {selectedDistrict} Central Warehouse</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Live GPS Carrier Assigned Automatically</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Official PhonePe UPI QR Code Checkout Modal */}
      {showQrModal && activeQrOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Top Accent Gradient */}
            <div className="h-2 bg-gradient-to-r from-purple-600 via-[#5f259f] to-indigo-700 absolute top-0 left-0 right-0" />

            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-[#5f259f] font-black text-xl shrink-0">
                  पे
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Scan & Pay via PhonePe</h3>
                  <p className="text-xs text-slate-500">Order #{activeQrOrder.id} • Official Verified QR</p>
                </div>
              </div>
              <button
                onClick={handleCancelQrModal}
                disabled={confirmingQr}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="my-3.5 p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Total Payable</span>
                <span className="text-2xl font-black text-purple-950">₹{Number(activeQrOrder.total_amount).toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-300/60 inline-block">
                  Exact Order Total
                </span>
              </div>
            </div>

            {/* Official PhonePe QR Code Frame */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="bg-white border-2 border-purple-200 rounded-2xl p-1 shadow-sm max-w-[240px] w-full text-center">
                <img
                  src={phonepeQrImg}
                  alt="Official PhonePe QR Code - Seyed Mohammed Safin"
                  className="w-full h-auto object-contain rounded-xl select-none"
                />
              </div>

              {/* Payee Details Card */}
              <div className="mt-3 w-full bg-purple-50/80 border border-purple-200/90 rounded-2xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-semibold">Payee Name:</span>
                  <span className="font-extrabold text-purple-950">SEYED MOHAMMED SAFIN</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-purple-200/60">
                  <span className="text-slate-500 font-semibold">UPI ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-purple-900 font-mono tracking-wider">
                      {activeQrOrder.upi_id || '8870862195@axl'}
                    </span>
                    <button
                      onClick={() => copyVpaToClipboard(activeQrOrder.upi_id || '8870862195@axl')}
                      className="px-2 py-0.5 bg-purple-200 hover:bg-purple-300 text-purple-900 rounded-md font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                      type="button"
                      title="Copy UPI ID"
                    >
                      {copiedVpa ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span className="text-emerald-800 font-black">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Supported UPI Apps Badges */}
              <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap text-[10px] font-bold">
                <span className="px-2 py-0.5 bg-purple-100 text-[#5f259f] rounded-md border border-purple-200">PhonePe</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">Google Pay</span>
                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md border border-sky-200">Paytm</span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200">BHIM UPI</span>
              </div>
            </div>

            {/* Mobile Direct Deep-link Button */}
            {activeQrOrder.upi_uri && (
              <div className="mt-3">
                <a
                  href={activeQrOrder.upi_uri}
                  className="w-full bg-[#5f259f] hover:bg-[#4d1e82] text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition shadow-sm"
                >
                  <Smartphone className="w-4 h-4 text-purple-200" />
                  <span>Tap to Open in PhonePe / UPI App</span>
                  <ExternalLink className="w-3 h-3 text-purple-200 ml-1" />
                </a>
              </div>
            )}

            {/* UTR / Reference ID Input */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5 text-left">
              <label className="text-[11px] font-bold text-slate-600 block">
                UPI Reference / UTR Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="12-digit UTR from your bank SMS / PhonePe"
                maxLength={20}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
              />
            </div>

            {/* Verification / Confirmation CTAs */}
            <div className="mt-4 space-y-2">
              <button
                onClick={handleConfirmQrPayment}
                disabled={confirmingQr}
                className="w-full bg-[#5f259f] hover:bg-[#4d1e82] active:scale-98 text-white font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {confirmingQr ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Payment & Dispatched…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>I Have Paid — Confirm Order</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCancelQrModal}
                disabled={confirmingQr}
                type="button"
                className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-red-600 transition cursor-pointer"
              >
                Cancel & Restore Items to Inventory
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
