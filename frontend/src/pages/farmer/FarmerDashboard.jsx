import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { farmerDashboard } from '../../services/api.js'
import { 
  Package, 
  Clock, 
  Coins, 
  TrendingUp, 
  PlusCircle, 
  FileText, 
  Sparkles, 
  Truck, 
  ArrowUpRight,
  BarChart3
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'

export default function FarmerDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    farmerDashboard()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  // Simulated visual trend for earnings progression
  const performanceData = [
    { name: 'Mon', earnings: (data?.earnings?.net_earnings ? Number(data.earnings.net_earnings) * 0.15 : 120) },
    { name: 'Tue', earnings: (data?.earnings?.net_earnings ? Number(data.earnings.net_earnings) * 0.35 : 280) },
    { name: 'Wed', earnings: (data?.earnings?.net_earnings ? Number(data.earnings.net_earnings) * 0.50 : 450) },
    { name: 'Thu', earnings: (data?.earnings?.net_earnings ? Number(data.earnings.net_earnings) * 0.75 : 620) },
    { name: 'Fri', earnings: (data?.earnings?.net_earnings ? Number(data.earnings.net_earnings) : 950) },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Farmer Workspace</h1>
            <span className="badge-actual">Producer Verified</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Manage your produce listings, monitor buyer demand, and track earnings without commissions.
          </p>
        </div>

        <Link to="/farmer/listings/new" className="btn-primary py-2.5 px-4 text-sm font-semibold shadow-md">
          <PlusCircle className="w-4 h-4" />
          Add New Harvest Listing
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-6 h-32 skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            
            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="label text-[10px] text-slate-500">Active Listings</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {data.active_listings_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Directly discoverable in marketplace</p>
            </div>

            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="label text-[10px] text-slate-500">Pending Orders</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {data.pending_orders_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Awaiting your fulfillment confirmation</p>
            </div>

            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="label text-[10px] text-slate-500 mb-0">Net Take-Home Pay</span>
                  <span className="badge-actual text-[10px] py-0 px-2">100% Direct</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-leaf-800">
                ₹{Number(data.earnings.net_earnings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                {data.earnings.message || 'Zero middleman deductions taken.'}
              </p>
            </div>

          </div>

          {/* Performance Trend Chart */}
          <div className="card p-6 border border-slate-200/80 shadow-soft mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-leaf-600" />
                <h2 className="text-base font-bold text-slate-900">Revenue & Fulfillment Velocity</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">Weekly Performance</span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="leafGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip 
                    formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Earnings']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Area type="monotone" dataKey="earnings" stroke="#16a34a" strokeWidth={2.5} fillOpacity={1} fill="url(#leafGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Action Hub */}
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
        Quick Action Hub
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <Link 
          to="/farmer/listings" 
          className="card card-hover p-5 border border-slate-200/80 group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-leaf-700 transition-colors">
              Manage Produce Listings
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Toggle availability, update pricing, or view active listings.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-leaf-700 mt-4 pt-3 border-t border-slate-100">
            <span>View Listings</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link 
          to="/farmer/orders" 
          className="card card-hover p-5 border border-slate-200/80 group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
              Customer Orders
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Confirm incoming purchase requests and mark harvests ready for pickup.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-blue-700 mt-4 pt-3 border-t border-slate-100">
            <span>Process Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link 
          to="/farmer/ai-insights" 
          className="card card-hover p-5 border border-ai-200/80 group flex flex-col justify-between bg-gradient-to-br from-white to-ai-50/20"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-ai-100 text-ai-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-ai-700 transition-colors">
              AI Market Intelligence
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Consult machine learning forecasts for upcoming crop demand & fair price bands.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-ai-700 mt-4 pt-3 border-t border-slate-100">
            <span>Inspect AI Forecast</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link 
          to="/transport/my-requests" 
          className="card card-hover p-5 border border-slate-200/80 group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
              Fleet & Live Tracking
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Monitor active transporter pickup coordinates and transit schedules.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-purple-700 mt-4 pt-3 border-t border-slate-100">
            <span>Track Vehicles</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

      </div>

    </div>
  )
}

