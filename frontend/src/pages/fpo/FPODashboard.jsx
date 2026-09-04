import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, 
  Layers, 
  Scale, 
  Plus, 
  Truck, 
  Package, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Building2, 
  RefreshCw,
  ShoppingBag
} from 'lucide-react'
import { fpoDashboard, myListings } from '../../services/api.js'

export default function FPODashboard() {
  const [data, setData] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    Promise.all([fpoDashboard(), myListings()])
      .then(([dashRes, listRes]) => {
        setData(dashRes.data)
        setListings(listRes.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const quickActions = [
    {
      title: 'Aggregate New Batch',
      desc: 'Create a bulk listing pooling member harvest crops',
      icon: Plus,
      link: '/farmer/listings/new',
      color: 'bg-emerald-50 text-leaf-700 border-emerald-200 hover:border-leaf-500',
      badge: 'New Listing'
    },
    {
      title: 'Manage FPO Batches',
      desc: 'Update inventory levels, pricing, or deactivate batches',
      icon: Package,
      link: '/farmer/listings',
      color: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-500',
      badge: null
    },
    {
      title: 'Request Bulk Logistics',
      desc: 'Auto-match member crop pickups with verified fleet trucks',
      icon: Truck,
      link: '/transport/request',
      color: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-500',
      badge: 'Fleet Match'
    },
    {
      title: 'Track Dispatch Routes',
      desc: 'Monitor in-transit shipments on live OpenStreetMap',
      icon: Layers,
      link: '/transport/my-requests',
      color: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-500',
      badge: 'Live GPS'
    }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-800 via-amber-900 to-earth-900 text-white p-6 sm:p-8 mb-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-700/50 text-amber-200 text-xs font-semibold mb-3 border border-amber-600/50">
              <Building2 className="w-3.5 h-3.5" />
              Farmer Producer Organization Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">FPO Collective Center</h1>
            <p className="text-amber-100/90 text-sm mt-1 max-w-xl">
              Pool harvest volume across member smallholder farmers to negotiate higher institutional prices and optimize shared logistics.
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
            <Link
              to="/farmer/listings/new"
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-sm flex items-center gap-2 transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              Create Batch
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="card border-l-4 border-l-amber-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Member Farmers</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{data?.member_count ?? 0}</p>
            <p className="text-xs text-amber-700 font-medium mt-2">Registered smallholders in cooperative</p>
          </div>

          <div className="card border-l-4 border-l-leaf-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Active Batches</span>
              <div className="w-10 h-10 rounded-xl bg-leaf-50 flex items-center justify-center text-leaf-700">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-gray-900">{data?.active_listings_count ?? 0}</p>
              <span className="badge-actual">Live</span>
            </div>
            <p className="text-xs text-leaf-700 font-medium mt-2">Aggregated lots open for buyer orders</p>
          </div>

          <div className="card border-l-4 border-l-sky-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Aggregated Supply</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-gray-900">{data?.total_supply_available ?? '0 units'}</p>
              <span className="badge-actual">Actual</span>
            </div>
            <p className="text-xs text-sky-700 font-medium mt-2">Verified pool ready for dispatch</p>
          </div>
        </div>
      )}

      {/* Quick Navigation Hub */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-amber-700" />
          FPO Collective Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon
            return (
              <Link
                key={idx}
                to={action.link}
                className="group relative bg-white border border-gray-100 rounded-xl p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${action.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {action.badge && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-amber-700 transition">
                    {action.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {action.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center text-xs font-semibold text-amber-700 group-hover:text-amber-800">
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Current Collective Listings */}
      <div className="card p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold font-display text-lg text-gray-900">Current Collective Batches</h2>
            <p className="text-xs text-gray-500 mt-0.5">Active lots listed under your FPO collective</p>
          </div>
          <Link
            to="/farmer/listings/new"
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Batch
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-800">No FPO Batches Listed Yet</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
              Aggregate produce from your member farmers to create your first bulk listing on AgriDirect AI.
            </p>
            <Link to="/farmer/listings/new" className="btn-primary inline-flex items-center gap-2 text-xs">
              <Plus className="w-3.5 h-3.5" /> Create First FPO Batch
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {listings.map((l) => (
              <div key={l.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50/50 px-2 rounded-lg transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                    🌾
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{l.product_name}</p>
                    <p className="text-xs text-gray-400">
                      {l.harvest_date ? `Harvested ${l.harvest_date}` : 'Fresh Harvest'} · {l.farm_location || 'Local FPO Hub'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-extrabold text-sm text-gray-900 block">
                      {Number(l.quantity_available)} {l.unit}
                    </span>
                    <span className="text-xs font-semibold text-leaf-700">
                      ₹{Number(l.price_per_unit)} / {l.unit}
                    </span>
                  </div>
                  <span className={l.is_active ? 'badge-actual' : 'badge-demo'}>
                    {l.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

