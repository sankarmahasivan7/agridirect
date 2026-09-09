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
import { 
  adminDashboard, 
  optimizeLogistics,
  triggerAutoBatch,
  listBatches,
  batchAdminStats,
} from '../../services/api.js'

const USER_COLORS = ['#16a34a', '#0284c7', '#d97706']

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [logistics, setLogistics] = useState(null)
  const [loading, setLoading] = useState(true)

  // Batched Delivery State
  const [batchStats, setBatchStats] = useState(null)
  const [batchesList, setBatchesList] = useState([])
  const [batchDistrict, setBatchDistrict] = useState('')
  const [autoBatching, setAutoBatching] = useState(false)
  const [batchMsg, setBatchMsg] = useState('')

  const loadData = () => {
    setLoading(true)
    Promise.all([
      adminDashboard().catch((err) => { console.error(err); return { data: null } }),
      batchAdminStats().catch((err) => { console.error(err); return { data: null } }),
      listBatches().catch((err) => { console.error(err); return { data: [] } }),
    ])
      .then(([dashRes, statsRes, batchesRes]) => {
        if (dashRes.data) setData(dashRes.data)
        if (statsRes.data) setBatchStats(statsRes.data)
        if (batchesRes.data) setBatchesList(batchesRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleTriggerBatch = async () => {
    setAutoBatching(true)
    setBatchMsg('')
    try {
      const res = await triggerAutoBatch(batchDistrict || undefined)
      setBatchMsg(`Consolidation engine completed! ${res.data?.length || 0} delivery batch(es) created or updated.`)
      // Refresh stats & list
      batchAdminStats().then((s) => s.data && setBatchStats(s.data))
      listBatches().then((b) => b.data && setBatchesList(b.data))
    } catch (err) {
      setBatchMsg(err.response?.data?.detail || 'Error executing multi-order batching engine.')
    } finally {
      setAutoBatching(false)
    }
  }

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
    { name: 'Transporters', count: data.transporters || 0, color: '#7c3aed' },
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
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                    <span className="font-semibold text-purple-900">Fleet Transporters</span>
                    <span className="font-extrabold text-purple-700">{data.transporters || 0}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 text-[11px] text-gray-400 mt-4">
                Direct buyer-to-farmer transactions preserve 100% grower margin without auction fee deductions.
              </div>
            </div>
          </div>

          {/* Batched Delivery Operations & 3PL Logistics Control */}
          <div className="card p-6 border-2 border-indigo-100 bg-gradient-to-b from-white to-indigo-50/20 shadow-md mb-8 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-indigo-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
                    <Layers className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-extrabold font-display text-lg text-slate-900">
                      Consolidated Batched Delivery & 3PL Fleet Allocation
                    </h3>
                    <p className="text-xs text-slate-500">
                      Multi-order grouped vehicle trips across Tenkasi, Tirunelveli, and Thoothukudi Central Warehouses
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <select
                  value={batchDistrict}
                  onChange={(e) => setBatchDistrict(e.target.value)}
                  className="input py-2 px-3 text-xs w-44 bg-white border border-indigo-200 rounded-xl"
                >
                  <option value="">All Supported Districts</option>
                  <option value="Tenkasi">Tenkasi</option>
                  <option value="Tirunelveli">Tirunelveli</option>
                  <option value="Thoothukudi">Thoothukudi</option>
                </select>

                <button
                  onClick={handleTriggerBatch}
                  disabled={autoBatching}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${autoBatching ? 'animate-spin' : ''}`} />
                  {autoBatching ? 'Consolidating Orders...' : 'Run Auto-Batching Engine'}
                </button>
              </div>
            </div>

            {batchMsg && (
              <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{batchMsg}</span>
              </div>
            )}

            {/* Batch Metrics Grid */}
            {batchStats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Batches</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{batchStats.total_batches}</p>
                  <p className="text-[10px] text-slate-400">{batchStats.total_orders_in_batches} orders grouped</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Claims</p>
                  <p className="text-xl font-black text-amber-600 mt-1">{batchStats.pending_batches}</p>
                  <p className="text-[10px] text-amber-600/70">Awaiting 3PL drivers</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Transit</p>
                  <p className="text-xl font-black text-sky-600 mt-1">{batchStats.active_transport_jobs}</p>
                  <p className="text-[10px] text-sky-600/70">On the road</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivered</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">{batchStats.completed_deliveries}</p>
                  <p className="text-[10px] text-emerald-600/70">{batchStats.total_customers_served} customers served</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo Weight</p>
                  <p className="text-xl font-black text-slate-900 mt-1">{batchStats.total_cargo_transported_kg} <span className="text-xs font-normal">kg</span></p>
                  <p className="text-[10px] text-slate-400">Total freight moved</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warehouses</p>
                  <p className="text-xl font-black text-purple-600 mt-1">3</p>
                  <p className="text-[10px] text-purple-600/70">TKS &bull; TNV &bull; TUT</p>
                </div>
              </div>
            )}

            {/* Warehouse Hubs Badges */}
            <div className="p-3 rounded-xl bg-white border border-indigo-100 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-700">Farmer Aggregation Hubs (Logistics Infrastructure Only &bull; No Commercial Resale):</span>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-semibold">
                  Tenkasi Central Agri-Warehouse
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                  Tirunelveli Central Agri-Warehouse
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                  Thoothukudi Port Agri-Warehouse
                </span>
              </div>
            </div>

            {/* Batches Table */}
            {batchesList.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-500">
                No consolidated delivery batches created yet. Click "Run Auto-Batching Engine" above or place orders across districts.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Batch Code</th>
                        <th className="py-3 px-4">Destination District</th>
                        <th className="py-3 px-4">Cargo Weight</th>
                        <th className="py-3 px-4">Orders</th>
                        <th className="py-3 px-4">Stops</th>
                        <th className="py-3 px-4">Est. Payout</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchesList.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-900">{b.batch_code}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{b.delivery_area} Hub</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{Number(b.total_quantity_kg).toFixed(1)} kg</td>
                          <td className="py-3 px-4">{b.total_orders_count} customer order(s)</td>
                          <td className="py-3 px-4">{b.stops ? b.stops.length : 0} stops</td>
                          <td className="py-3 px-4 font-extrabold text-emerald-600">₹{Number(b.estimated_logistics_cost || 0).toFixed(0)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              b.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'BATCH_CREATED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

