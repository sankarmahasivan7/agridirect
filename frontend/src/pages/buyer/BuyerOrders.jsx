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
  ShoppingBag
} from 'lucide-react'
import { myOrders } from '../../services/api.js'

const STATUS_CONFIG = {
  PENDING: { label: 'Pending Confirmation', color: 'bg-amber-100 text-amber-800 border-amber-300', step: 1 },
  CONFIRMED: { label: 'Confirmed by Farmer', color: 'bg-blue-100 text-blue-800 border-blue-300', step: 2 },
  PROCESSING: { label: 'Harvesting / Packing', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', step: 3 },
  READY_FOR_PICKUP: { label: 'Ready for Vehicle', color: 'bg-purple-100 text-purple-800 border-purple-300', step: 4 },
  IN_TRANSIT: { label: 'On the Road (GPS Live)', color: 'bg-sky-100 text-sky-800 border-sky-300', step: 5 },
  DELIVERED: { label: 'Delivered Fresh', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', step: 6 },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300', step: 0 }
}

export default function BuyerOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')

  useEffect(() => {
    myOrders()
      .then((res) => setOrders(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

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
            My Orders & Invoices
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time fulfillment tracking from farm harvest to your doorstep.
          </p>
        </div>
        <Link to="/buyer/marketplace" className="btn-primary text-sm flex items-center justify-center gap-2">
          <ShoppingBag className="w-4 h-4" />
          Order More Produce
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order ID, crop name, or location..."
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
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="READY_FOR_PICKUP">Ready for Pickup</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
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
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Orders Found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            {orders.length === 0
              ? "You haven't placed any farm-direct orders yet. Explore our fresh marketplace to get started!"
              : 'No orders match your search and filter criteria.'}
          </p>
          {orders.length === 0 ? (
            <Link to="/buyer/marketplace" className="btn-primary inline-flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Explore Fresh Marketplace
            </Link>
          ) : (
            <button
              onClick={() => { setSearchQuery(''); setFilterStatus('ALL') }}
              className="btn-secondary text-sm"
            >
              Reset Filters
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
                      <p className="font-bold text-gray-900">Order #{o.id}</p>
                      <p className="text-xs text-gray-400">Direct Purchase</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="badge-actual">Actual</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-gray-50/70 rounded-xl p-3.5 mb-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Purchased Items</p>
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
                    <span className="text-gray-400 block">Farmer Pay (Subtotal)</span>
                    <span className="font-semibold text-gray-700 text-sm">₹{Number(o.subtotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Logistics & Transport</span>
                    <span className="font-semibold text-gray-700 text-sm">₹{Number(o.logistics_cost).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Platform Fee (2%)</span>
                    <span className="font-semibold text-gray-700 text-sm">₹{Number(o.platform_fee).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-medium">Total Paid</span>
                    <span className="font-bold text-leaf-700 text-base">₹{Number(o.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Destination & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>Delivering to: <b className="text-gray-700">{o.delivery_location || 'Address on file'}</b></span>
                  </div>
                  <Link
                    to="/transport/my-requests"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-leaf-700 hover:text-leaf-800 hover:underline"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Track Shipment Status
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

