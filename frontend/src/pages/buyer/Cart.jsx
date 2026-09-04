import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext.jsx'
import { createOrder } from '../../services/api.js'
import LocationPicker from '../../components/LocationPicker.jsx'
import { useToast } from '../../components/Toast.jsx'
import { 
  ShoppingBag, 
  Trash2, 
  Minus, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Truck, 
  Percent, 
  MapPin, 
  Loader2, 
  AlertCircle 
} from 'lucide-react'

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart, subtotal } = useCart()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [deliveryLat, setDeliveryLat] = useState(null)
  const [deliveryLng, setDeliveryLng] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Estimated only for display; the server computes and enforces the authoritative total.
  const estLogistics = subtotal > 0 ? items.reduce((s, i) => s + Number(i.quantity), 0) * 4 : 0
  const estPlatformFee = subtotal * 0.02
  const estTotal = subtotal + estLogistics + estPlatformFee

  const handleCheckout = async () => {
    setError('')
    if (!deliveryLocation.trim()) { 
      setError('Please provide a delivery address or destination label.')
      return 
    }
    setLoading(true)
    try {
      const res = await createOrder({
        items: items.map((i) => ({ listing_id: i.listing_id, quantity: Number(i.quantity) })),
        delivery_location: deliveryLocation,
        delivery_latitude: deliveryLat,
        delivery_longitude: deliveryLng,
      })
      clearCart()
      addToast(`Order placed successfully! Auto-matching vehicle…`)
      navigate('/buyer/orders')
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-leaf-50 border border-leaf-100 flex items-center justify-center text-leaf-600 mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Your Shopping Cart is Empty</h2>
        <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
          Support local agriculture by sourcing produce directly from verified farmers and FPOs.
        </p>
        <Link to="/buyer/marketplace" className="btn-primary">
          Explore Marketplace Now
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Review & Checkout</h1>
          <p className="text-xs text-slate-500 mt-1">Direct-from-farm order fulfillment</p>
        </div>
        <span className="badge-actual">
          {items.length} {items.length === 1 ? 'Item' : 'Items'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Items & Delivery Info (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Cart Item Cards */}
          <div className="space-y-3">
            <h2 className="label">Order Items</h2>
            {items.map((i) => {
              const itemPrice = Number(i.price_per_unit) || 0
              const itemQty = Number(i.quantity) || 0
              const lineTotal = itemPrice * itemQty
              const maxAvail = Number(i.available) || 9999

              return (
                <div 
                  key={i.listing_id} 
                  className="card p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 capitalize">
                      {i.product_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ₹{itemPrice.toFixed(2)} /{i.unit} · {maxAvail} {i.unit} available
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => updateQuantity(i.listing_id, Math.max(0.1, Number((itemQty - 1).toFixed(2))))}
                        disabled={itemQty <= 1}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        max={maxAvail}
                        value={itemQty}
                        onChange={(e) => updateQuantity(i.listing_id, Math.min(maxAvail, Math.max(0, Number(e.target.value))))}
                        className="w-14 text-center font-bold text-xs bg-transparent border-0 focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => updateQuantity(i.listing_id, Math.min(maxAvail, Number((itemQty + 1).toFixed(2))))}
                        disabled={itemQty >= maxAvail}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[70px]">
                      <div className="font-extrabold text-slate-900 text-sm">
                        ₹{lineTotal.toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(i.listing_id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Delivery Location & GPS */}
          <div className="card p-6 border border-slate-200/80 shadow-soft space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-leaf-600" />
              <h2 className="font-bold text-slate-900">Delivery Address & Destination Pin</h2>
            </div>

            <div>
              <label className="label">Destination Address / Landmark</label>
              <input
                className="input"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="e.g. 14 Market Road, Anna Nagar, Chennai"
                required
              />
            </div>

            <p className="text-xs text-slate-500">
              Pinning precise coordinates allows the platform to calculate physics-based transit times and match the nearest available transporter automatically.
            </p>

            <LocationPicker
              latitude={deliveryLat}
              longitude={deliveryLng}
              onChange={(lat, lng) => { setDeliveryLat(lat); setDeliveryLng(lng) }}
              label="Delivery Point"
            />
          </div>

        </div>

        {/* Pricing Architecture & Submit (1 col) */}
        <div className="space-y-6">
          <div className="card p-6 border border-slate-200/90 shadow-soft-lg sticky top-20 bg-white">
            
            <h2 className="text-lg font-extrabold text-slate-900 mb-4 pb-3 border-b border-slate-100">
              Transparent Pricing
            </h2>

            <div className="space-y-3 text-xs mb-6">
              
              <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                <span className="flex items-center gap-2 font-semibold text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Farmer Direct Pay
                </span>
                <span className="font-extrabold text-emerald-900 text-sm">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl">
                <span className="flex items-center gap-2 font-semibold text-purple-900">
                  <Truck className="w-4 h-4 text-purple-600" />
                  Logistics (Est.)
                </span>
                <span className="font-bold text-purple-900 text-sm">
                  ₹{estLogistics.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  <Percent className="w-4 h-4 text-slate-500" />
                  Platform Fee (2%)
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  ₹{estPlatformFee.toFixed(2)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between font-extrabold text-slate-900">
                <span className="text-sm">Total Payable</span>
                <span className="text-2xl text-leaf-700">₹{estTotal.toFixed(2)}</span>
              </div>

            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="btn-primary w-full py-3.5 text-sm font-bold shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Order…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Place Order</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-400 mt-3 text-center leading-relaxed">
              Upon confirmation, a delivery vehicle is automatically assigned and live GPS shipment tracking begins.
            </p>

          </div>
        </div>

      </div>

    </div>
  )
}

