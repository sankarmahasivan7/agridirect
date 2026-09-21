import React, { useEffect, useState, useMemo } from 'react'
import { sellerOrders } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { 
  ShoppingBag, 
  User, 
  MapPin, 
  Calendar, 
  Warehouse, 
  Package, 
  Coins, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Layers,
  Scale,
  Sparkles,
  Truck
} from 'lucide-react'

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending Warehouse Dispatch',
    tamil: 'கிடங்கு விநியோக நிலுவை',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    dotCls: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Order Confirmed',
    tamil: 'ஆர்டர் உறுதி செய்யப்பட்டது',
    badgeCls: 'bg-blue-50 text-blue-800 border-blue-200',
    dotCls: 'bg-blue-500',
  },
  PROCESSING: {
    label: 'Processing at Warehouse',
    tamil: 'கிடங்கில் செயல்படுத்தப்படுகிறது',
    badgeCls: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dotCls: 'bg-indigo-500',
  },
  READY_FOR_PICKUP: {
    label: 'Ready at Hub',
    tamil: 'கிடங்கில் தயாராக உள்ளது',
    badgeCls: 'bg-purple-50 text-purple-800 border-purple-200',
    dotCls: 'bg-purple-500',
  },
  IN_TRANSIT: {
    label: 'Out for Delivery',
    tamil: 'வாடிக்கையாளருக்கு செல்லும் வழியில்',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
    dotCls: 'bg-sky-500',
  },
  DELIVERED: {
    label: 'Delivered to Customer',
    tamil: 'வாடிக்கையாளருக்கு வழங்கப்பட்டது',
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotCls: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    tamil: 'ரத்து செய்யப்பட்டது',
    badgeCls: 'bg-rose-50 text-rose-800 border-rose-200',
    dotCls: 'bg-rose-500',
  },
}

export default function FarmerOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const { isTamil } = useLanguage()

  useEffect(() => {
    setLoading(true)
    sellerOrders()
      .then((res) => {
        setOrders(Array.isArray(res.data) ? res.data : [])
      })
      .catch((err) => {
        console.error('Failed to load seller orders', err)
      })
      .finally(() => setLoading(false))
  }, [])

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalKg = 0
    let totalRevenue = 0
    orders.forEach((o) => {
      const items = o.items || []
      items.forEach((it) => {
        totalKg += Number(it.quantity || 0)
      })
      totalRevenue += Number(o.farmer_settlement_amount || o.subtotal || 0)
    })
    return {
      orderCount: orders.length,
      totalKg: totalKg.toFixed(1),
      totalRevenue: totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    }
  }, [orders])

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter !== 'ALL' && o.status !== statusFilter) {
        return false
      }
      // Search term filter
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase()
      const orderIdStr = String(o.id || '')
      const destStr = String(o.delivery_location || '').toLowerCase()
      const customerStr = String(o.customer_name || o.buyer_name || '').toLowerCase()
      const itemsMatch = (o.items || []).some((it) =>
        String(it.product_name || '').toLowerCase().includes(q)
      )
      return (
        orderIdStr.includes(q) ||
        destStr.includes(q) ||
        customerStr.includes(q) ||
        itemsMatch
      )
    })
  }, [orders, statusFilter, searchTerm])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-leaf-100 border border-leaf-200 flex items-center justify-center text-leaf-700">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {isTamil ? 'வாடிக்கையாளர் ஆர்டர்கள்' : 'Customer Orders'}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                {isTamil
                  ? 'வாடிக்கையாளர் ஆர்டர்கள், அளவுகள் மற்றும் விலைகளின் முழு விபரம்.'
                  : 'Detailed breakdown of which customer ordered your produce, quantities (kg), and prices.'}
              </p>
            </div>
          </div>
        </div>

        {/* Warehouse Strategy Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start md:self-auto">
          <Warehouse className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {isTamil 
              ? 'கிடங்கு உத்தி: நேரடி கிடங்கு வழங்கல் முறை செயல்படுத்தப்பட்டுள்ளது' 
              : 'Warehouse Strategy: Direct Warehouse Drop-off Model'}
          </span>
        </div>
      </div>

      {/* Warehouse Strategy Explanatory Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-leaf-50/90 via-emerald-50/50 to-amber-50/40 border border-leaf-200/80 shadow-2xs flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-leaf-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
          <Warehouse className="w-4 h-4" />
        </div>
        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-900">
            {isTamil ? 'கிடங்கு விநியோக உத்தி நடைமுறையில் உள்ளது:' : 'Regional Warehouse Fulfillment Strategy Active:'}
          </span>{' '}
          {isTamil
            ? 'விவசாயிகள் தங்கள் விளைபொருட்களை நேரடியாக பிராந்திய கிடங்கில் (தென்காசி, திருநெல்வேலி, தூத்துக்குடி) ஒப்படைக்கின்றனர். பண்ணையிலிருந்து தனிப்பட்ட பிக்-அப் தேவையில்லை. கிடங்கிலிருந்து இறுதி வாடிக்கையாளருக்கு தானாகவே விநியோகம் செய்யப்படுகிறது.'
            : 'You provide harvest directly to your regional warehouse hub. Transporter farm-gate pickup is bypassed because inventory is fulfilled and dispatched straight from the warehouse to customers.'}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Orders */}
        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isTamil ? 'மொத்த ஆர்டர்கள்' : 'Total Orders'}
            </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {metrics.orderCount}
            </div>
          </div>
        </div>

        {/* Total Quantity in kg */}
        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isTamil ? 'மொத்த அளவு (கிலோ)' : 'Total Quantity Sold'}
            </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {metrics.totalKg} <span className="text-sm font-semibold text-slate-500">kg</span>
            </div>
          </div>
        </div>

        {/* Total Farmer Payout */}
        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isTamil ? 'மொத்த வரவு தொகை' : 'Farmer Net Earnings'}
            </div>
            <div className="text-2xl font-black text-leaf-700 mt-0.5">
              ₹{metrics.totalRevenue}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isTamil
                ? 'வாடிக்கையாளர் பெயர், விளைபொருள், இடம் மூலம் தேடுங்கள்...'
                : 'Search by customer name, produce, order # or location...'
            }
            className="input pl-10 text-xs sm:text-sm py-2"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', en: 'All Orders', ta: 'அனைத்தும்' },
            { id: 'CONFIRMED', en: 'Confirmed', ta: 'உறுதி' },
            { id: 'PROCESSING', en: 'Processing', ta: 'செயல்முறை' },
            { id: 'IN_TRANSIT', en: 'In Transit', ta: 'வழியில்' },
            { id: 'DELIVERED', en: 'Delivered', ta: 'வழங்கப்பட்டது' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-leaf-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isTamil ? tab.ta : tab.en}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-6 h-40 skeleton rounded-2xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-2 border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-leaf-50 border border-leaf-100 flex items-center justify-center text-leaf-600 mx-auto mb-3">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {isTamil ? 'ஆர்டர்கள் எதுவும் கிடைக்கவில்லை' : 'No Orders Found'}
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto mt-1">
            {searchTerm || statusFilter !== 'ALL'
              ? isTamil
                ? 'உங்கள் தேடலுக்கு ஏற்ற ஆர்டர்கள் இல்லை. வேறு வார்த்தையை பயன்படுத்தி பார்க்கவும்.'
                : 'No orders match your filter criteria. Try clearing search.'
              : isTamil
                ? 'வாடிக்கையாளர்கள் உங்கள் விளைபொருட்களை ஆர்டர் செய்யும்போது, அவை இங்கே உடனடியாக தோன்றும்.'
                : 'When customers place orders for your warehouse-stocked produce, customer names and kg details will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((o) => {
            const statusInfo = STATUS_CONFIG[o.status] || {
              label: o.status || 'Received',
              tamil: o.status || 'பெறப்பட்டது',
              badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
              dotCls: 'bg-slate-400',
            }

            // Customer Name identification
            const customerName =
              o.customer_name ||
              o.buyer_name ||
              o.buyer?.full_name ||
              (o.delivery_location
                ? `${isTamil ? 'வாடிக்கையாளர்' : 'Customer'} (${o.delivery_location.split(',')[0].trim()})`
                : `${isTamil ? 'வாடிக்கையாளர்' : 'Customer'} #${o.buyer_id || o.id}`)

            const totalOrderKg = (o.items || []).reduce(
              (acc, it) => acc + Number(it.quantity || 0),
              0
            )

            const farmerEarnings = Number(o.farmer_settlement_amount || o.subtotal || 0)

            return (
              <div
                key={o.id}
                className="card border border-slate-200/90 shadow-soft hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Order Top Bar */}
                <div className="p-4 sm:p-5 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      Order #{o.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusInfo.badgeCls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotCls}`} />
                      {isTamil ? statusInfo.tamil : statusInfo.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <Warehouse className="w-3 h-3 text-emerald-600" />
                      {isTamil ? 'கிடங்கு இருப்பு' : 'Warehouse Stock'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(o.created_at || Date.now()).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Main Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Customer Information Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    {/* Customer Name */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-leaf-100 text-leaf-700 flex items-center justify-center font-bold shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                          {isTamil ? 'வாடிக்கையாளர் பெயர்' : 'Customer Name'}
                        </span>
                        <span className="text-slate-900 font-bold text-sm">
                          {customerName}
                        </span>
                      </div>
                    </div>

                    {/* Delivery Destination */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                          {isTamil ? 'விநியோக இடம்' : 'Delivery Destination'}
                        </span>
                        <span className="text-slate-900 font-semibold text-xs truncate block" title={o.delivery_location || 'Customer Address'}>
                          {o.delivery_location || (isTamil ? 'உள்ளூர் விநியோக முகவரி' : 'Local Delivery Address')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Produce & Quantity Table (Customer Orders Details: kg & price) */}
                  <div className="overflow-hidden border border-slate-100 rounded-xl">
                    <div className="bg-slate-100/70 px-4 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex justify-between">
                      <span>{isTamil ? 'ஆர்டர் செய்யப்பட்ட விளைபொருட்கள்' : 'Harvest Ordered'}</span>
                      <span>{isTamil ? 'அளவு மற்றும் விலை விபரம்' : 'Quantity & Price Breakdown'}</span>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                      {(o.items || []).map((it, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm hover:bg-slate-50/50 transition-colors"
                        >
                          {/* Produce Name */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-leaf-50 border border-leaf-200 text-leaf-700 flex items-center justify-center font-bold text-xs shrink-0">
                              🌱
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 text-sm block">
                                {it.product_name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {isTamil ? 'நேரடி கிடங்கு சப்ளை' : 'Direct Warehouse Supply'}
                              </span>
                            </div>
                          </div>

                          {/* KG & Rate */}
                          <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
                            {/* Quantity in KG */}
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                                {isTamil ? 'அளவு' : 'Quantity'}
                              </span>
                              <span className="font-extrabold text-slate-900 text-sm">
                                {Number(it.quantity).toFixed(1)}{' '}
                                <span className="text-xs font-semibold text-leaf-700">kg</span>
                              </span>
                            </div>

                            {/* Unit Price per KG */}
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                                {isTamil ? 'விலை / கிலோ' : 'Rate / kg'}
                              </span>
                              <span className="font-semibold text-slate-600 text-xs">
                                ₹{Number(it.price_at_purchase).toFixed(2)}
                              </span>
                            </div>

                            {/* Subtotal */}
                            <div className="text-right min-w-[70px]">
                              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                                {isTamil ? 'மொத்தம்' : 'Subtotal'}
                              </span>
                              <span className="font-bold text-slate-900 text-sm">
                                ₹{Number(it.line_subtotal).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Footer Breakdown */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-100">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Scale className="w-3.5 h-3.5 text-slate-400" />
                        {isTamil ? 'மொத்த எடை:' : 'Total Weight:'}{' '}
                        <b className="text-slate-800">{totalOrderKg.toFixed(1)} kg</b>
                      </span>

                      {o.payment_method && (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Coins className="w-3.5 h-3.5 text-slate-400" />
                          {isTamil ? 'கட்டணம்:' : 'Payment:'}{' '}
                          <b className="text-slate-800">{o.payment_method.replace(/_/g, ' ')}</b>
                        </span>
                      )}
                    </div>

                    {/* Farmer Settlement Amount */}
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-slate-500 font-semibold text-xs">
                        {isTamil ? 'விவசாயி வரவு (நிகர வருவாய்):' : 'Farmer Net Payout:'}
                      </span>
                      <span className="text-lg font-black text-leaf-700">
                        ₹{farmerEarnings.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Warehouse Handover Note */}
                  <div className="text-[11px] text-slate-400 bg-slate-50/50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-100">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>
                      {isTamil
                        ? 'கிடங்கு உத்தி மூலம் இந்த ஆர்டர் பூர்த்தி செய்யப்படுகிறது. விவசாயி பண்ணையிலிருந்து தனிப்பட்ட பிக்-அப் தேவையில்லை.'
                        : 'Fulfilled via Regional Warehouse. Doorstep delivery is handled automatically from the warehouse inventory.'}
                    </span>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
