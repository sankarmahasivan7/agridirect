import React, { useEffect, useState } from 'react'
import { sellerOrders, updateOrderStatus } from '../../services/api.js'
import { useToast } from '../../components/Toast.jsx'
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  Truck, 
  MapPin, 
  Calendar, 
  AlertCircle, 
  Loader2,
  XCircle,
  PackageCheck
} from 'lucide-react'

const NEXT_STATUS = {
  PENDING: [{ label: 'Confirm Order', value: 'CONFIRMED', color: 'btn-primary' }, { label: 'Reject', value: 'CANCELLED', color: 'btn-secondary text-red-600 border-red-200 hover:bg-red-50' }],
  CONFIRMED: [{ label: 'Start Processing', value: 'PROCESSING', color: 'btn-primary' }, { label: 'Cancel', value: 'CANCELLED', color: 'btn-secondary text-red-600' }],
  PROCESSING: [{ label: 'Mark Ready for Pickup', value: 'READY_FOR_PICKUP', color: 'btn-primary' }],
  READY_FOR_PICKUP: [{ label: 'Hand Over to Transporter', value: 'IN_TRANSIT', color: 'btn-primary' }],
  IN_TRANSIT: [{ label: 'Mark Delivered', value: 'DELIVERED', color: 'btn-primary' }],
  DELIVERED: [],
  CANCELLED: [],
}

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  READY_FOR_PICKUP: 'bg-purple-50 text-purple-700 border-purple-200',
  IN_TRANSIT: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
}

const ORDER_STAGES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED']

export default function FarmerOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')
  const { addToast } = useToast()

  const load = () => {
    setLoading(true)
    sellerOrders()
      .then((res) => setOrders(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleStatusChange = async (orderId, newStatus) => {
    setError('')
    setUpdatingId(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      addToast(`Order #${orderId} moved to ${newStatus}.`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update order status.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Customer Orders</h1>
          <p className="text-slate-500 text-sm mt-1">
            Fulfill direct buyer purchases. Confirming orders makes them eligible for route-optimized vehicle dispatch.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-6 h-36 skeleton rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-20 border-dashed border-2 border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-leaf-50 border border-leaf-100 flex items-center justify-center text-leaf-600 mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">No Orders Received Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            When buyers purchase your listed produce, orders will appear here for confirmation and logistics dispatch.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((o) => {
            const actions = NEXT_STATUS[o.status] || []
            const currentStageIndex = ORDER_STAGES.indexOf(o.status)

            return (
              <div 
                key={o.id} 
                className="card p-6 border border-slate-200/80 shadow-soft space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-extrabold text-slate-900">
                      Order #{o.id}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${STATUS_BADGE[o.status] || 'bg-slate-100 text-slate-700'}`}>
                      {o.status}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400">
                    Received: {new Date(o.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                {/* Progress Stepper Bar (for non-cancelled orders) */}
                {o.status !== 'CANCELLED' && currentStageIndex !== -1 && (
                  <div className="py-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5 overflow-x-auto gap-2">
                      {ORDER_STAGES.map((stg, sIdx) => {
                        const isDone = sIdx <= currentStageIndex
                        const isCurrent = sIdx === currentStageIndex

                        return (
                          <div 
                            key={stg} 
                            className={`flex items-center gap-1 whitespace-nowrap ${
                              isCurrent ? 'text-leaf-700 font-bold' : isDone ? 'text-slate-700' : 'text-slate-300'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-leaf-600 animate-ping' : isDone ? 'bg-leaf-600' : 'bg-slate-200'}`} />
                            <span>{stg.replace(/_/g, ' ')}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-leaf-600 rounded-full transition-all duration-500" 
                        style={{ width: `${((currentStageIndex + 1) / ORDER_STAGES.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Ordered Items List */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-2">
                  <span className="label text-[10px]">Harvest Ordered:</span>
                  <ul className="divide-y divide-slate-100 text-sm text-slate-700">
                    {o.items.map((it, idx) => (
                      <li key={idx} className="py-1.5 flex justify-between items-center">
                        <span className="font-semibold">
                          {Number(it.quantity)} × {it.product_name}
                        </span>
                        <span className="font-bold text-slate-900">
                          ₹{Number(it.line_subtotal).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Destination & Meta */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 pt-1">
                  {o.delivery_location && (
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Destination: <b className="text-slate-800">{o.delivery_location}</b>
                    </span>
                  )}

                  {/* Actions */}
                  {actions.length > 0 && (
                    <div className="flex items-center gap-2">
                      {actions.map((a) => (
                        <button
                          key={a.value}
                          disabled={updatingId === o.id}
                          onClick={() => handleStatusChange(o.id, a.value)}
                          className={`${a.color} text-xs py-2 px-3.5 font-bold shadow-2xs`}
                        >
                          {updatingId === o.id ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
                            </span>
                          ) : (
                            a.label
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

