import React, { useEffect, useState } from 'react'
import { 
  Users, 
  ShoppingBag, 
  IndianRupee, 
  TrendingUp, 
  Truck, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Route, 
  Activity,
  ArrowRight,
  PieChart as PieIcon
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts'
import { adminDashboard, optimizeLogistics } from '../../services/api.js'

const USER_COLORS = ['#16a34a', '#0284c7', '#d97706']

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [logistics, setLogistics] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    adminDashboard()
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOptimize = async () => {
    setLogistics({ loading: true })
    try {
      const res = await optimizeLogistics(1000)
      setLogistics(res.data)
    } catch (err) {
      setLogistics({ available: false, message: 'Optimization engine error.' })
    }
  }

  // Chart data preparation
  const userDistribution = data ? [
    { name: 'Farmers', count: data.farmers, color: '#16a34a' },
    { name: 'Buyers', count: data.buyers, color: '#0284c7' },
    { name: 'FPOs', count: data.fpos, color: '#d97706' },
  ] : []

  const stats = data ? [
    { label: 'Total Registered Users', value: data.total_users, icon: Users, color: 'text-blue-600 bg-blue-50', actual: false },
    { label: 'Active Farm Listings', value: data.active_listings, icon: Layers, color: 'text-leaf-700 bg-leaf-50', actual: true },
    { label: 'Completed Orders', value: data.total_orders, icon: ShoppingBag, color: 'text-purple-600 bg-purple-50', actual: true },
    { label: 'Gross Merchandise Value', value: `₹${Number(data.gmv || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-emerald-600 bg-emerald-50', actual: true },
    { label: 'Platform Fee Revenue', value: `₹${Number(data.platform_fee_revenue || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50', actual: true },
  ] : []

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-gray-900 to-emerald-950 text-white p-6 sm:p-8 mb-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-leaf-700/40 text-leaf-300 text-xs font-semibold mb-3 border border-leaf-600/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              Platform Administration & Analytics
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">System Control & Operations</h1>
            <p className="text-gray-300 text-sm mt-1 max-w-xl">
              Audit platform-wide transaction liquidity, direct farmer payouts, user registrations, and multi-stop logistics routing.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold flex items-center gap-2 transition backdrop-blur-sm border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card p-5 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Metrics Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {stats.map((st, idx) => {
              const Icon = st.icon
              return (
                <div key={idx} className="card p-5 border border-gray-100 hover:shadow-md transition">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{st.label}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${st.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-extrabold text-gray-900">{st.value}</p>
                    {st.actual && <span className="badge-actual">Actual</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {data.note && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl p-4 mb-8 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">System Integrity Note: </span>
                <span>{data.note}</span>
              </div>
            </div>
          )}

          {/* Charts & Breakdown Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* User Breakdown Bar Chart */}
            <div className="card p-6 border border-gray-100 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">User Network Distribution</h3>
                  <p className="text-xs text-gray-500">Breakdown of platform participants</p>
                </div>
                <span className="badge-actual">Actual DB Records</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userDistribution} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={12} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={48}>
                      {userDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Platform Health Card */}
            <div className="card p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Ecosystem Balance</h3>
                <p className="text-xs text-gray-500 mb-4">Active participants ratio</p>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50 border border-green-200">
                    <span className="font-semibold text-green-900">Verified Farmers</span>
                    <span className="font-extrabold text-green-700">{data.farmers}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="font-semibold text-blue-900">Registered Buyers</span>
                    <span className="font-extrabold text-blue-700">{data.buyers}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="font-semibold text-amber-900">Farmer Cooperatives (FPOs)</span>
                    <span className="font-extrabold text-amber-700">{data.fpos}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 text-[11px] text-gray-400 mt-4">
                Direct buyer-to-farmer transactions preserve 100% grower margin without auction fee deductions.
              </div>
            </div>
          </div>

          {/* Logistics Optimizer Section */}
          <div className="card p-6 border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <Route className="w-5 h-5 text-leaf-700" />
                  <h3 className="font-bold font-display text-lg text-gray-900">
                    AI Logistics Route Optimizer
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cluster multiple farm pickup points into optimal multi-stop carrier routes
                </p>
              </div>
              <button
                onClick={handleOptimize}
                disabled={logistics?.loading}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-2"
              >
                <Sparkles className={`w-3.5 h-3.5 ${logistics?.loading ? 'animate-spin' : ''}`} />
                {logistics?.loading ? 'Solving Multi-Stop VRP...' : 'Run Route Optimizer'}
              </button>
            </div>

            {logistics?.loading && (
              <div className="text-center py-12 text-gray-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-leaf-700" />
                Executing OR-Tools Vehicle Routing Problem (VRP) algorithm...
              </div>
            )}

            {logistics && !logistics.loading && !logistics.available && (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-xs text-gray-500">
                <Truck className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                {logistics.message || 'No unassigned shipments available to cluster at this time.'}
              </div>
            )}

            {logistics?.available && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">Optimized Vehicle Dispatches:</span>
                  <span className="badge-ai">{logistics.routes?.length || 0} Routes Planned</span>
                </div>
                {logistics.routes.map((r, idx) => {
                  const fillPct = Math.round((r.total_load_kg / r.capacity_kg) * 100)
                  return (
                    <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-white hover:border-leaf-300 transition">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-leaf-700" />
                          <span className="font-bold text-sm text-gray-900">{r.vehicle}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Payload Fill:</span>
                          <span className="font-bold text-leaf-700">{r.total_load_kg} kg / {r.capacity_kg} kg ({fillPct}%)</span>
                        </div>
                      </div>

                      {/* Capacity Meter */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-leaf-500 rounded-full"
                          style={{ width: `${Math.min(100, fillPct)}%` }}
                        ></div>
                      </div>

                      {/* Stops list */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-400 font-medium">Stops:</span>
                        {r.stops.map((s, sIdx) => (
                          <React.Fragment key={sIdx}>
                            <span className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 font-semibold text-gray-700">
                              {s.label}
                            </span>
                            {sIdx < r.stops.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

