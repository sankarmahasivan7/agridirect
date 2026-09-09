import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ShoppingBag, 
  IndianRupee, 
  Store, 
  ShoppingCart, 
  ClipboardList, 
  Truck, 
  Layers, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  RefreshCw
} from 'lucide-react'
import { buyerDashboard } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function BuyerDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  const loadData = () => {
    setLoading(true)
    buyerDashboard()
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const quickActions = [
    {
      title: t('nav.marketplace', 'Fresh Marketplace'),
      desc: t('marketplace.subtitle', 'Browse farm-direct listings with live GPS & AI pricing'),
      icon: Store,
      link: '/buyer/marketplace',
      color: 'bg-emerald-50 text-leaf-700 border-emerald-200 hover:border-leaf-500',
      badge: t('common.live', 'Live Stock')
    },
    {
      title: t('nav.cart', 'My Cart'),
      desc: t('cart.subtitle', 'Review selected produce and transparent logistics breakdown'),
      icon: ShoppingCart,
      link: '/buyer/cart',
      color: 'bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-500',
      badge: null
    },
    {
      title: t('dashboard.customerOrders', 'My Orders'),
      desc: t('dashboard.customerOrdersDesc', 'Track order statuses, invoices, and delivery fulfillment'),
      icon: ClipboardList,
      link: '/buyer/orders',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-500',
      badge: null
    },
    {
      title: t('dashboard.trackDeliveries', 'Track Shipments'),
      desc: t('dashboard.fleetTrackingDesc', 'Real-time vehicle GPS & route tracking on OpenStreetMap'),
      icon: Truck,
      link: '/transport/my-requests',
      color: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-500',
      badge: t('common.liveGps', 'Live GPS')
    },
    {
      title: t('dashboard.bulkOrder', 'Bulk Procurement'),
      desc: t('roles.buyerDesc', 'Submit institutional requirements matched to verified farmers'),
      icon: Layers,
      link: '/buyer/bulk-order',
      color: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-500',
      badge: t('common.aiPredicted', 'AI Matched')
    }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-leaf-900 via-leaf-800 to-emerald-900 text-white p-6 sm:p-8 mb-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-leaf-700/50 text-leaf-200 text-xs font-semibold mb-3 border border-leaf-600/50">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {t('dashboard.directFarmToFork', 'Direct Farm-to-Fork Sourcing')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">{t('dashboard.buyerCenter', 'Buyer Command Center')}</h1>
            <p className="text-leaf-200 text-sm mt-1 max-w-xl">
              {t('dashboard.buyerSubtitle', 'Source harvest-fresh crops directly from verified farmers with zero middleman commissions and real-time logistics tracking.')}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold flex items-center gap-2 transition backdrop-blur-sm border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('dashboard.refresh', 'Refresh')}
            </button>
            <Link
              to="/buyer/marketplace"
              className="px-5 py-2.5 rounded-xl bg-leaf-500 hover:bg-leaf-400 text-leaf-950 font-bold text-sm flex items-center gap-2 transition shadow-md"
            >
              <Store className="w-4 h-4" />
              {t('dashboard.goToMarket', 'Go to Market')}
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <div className="card border-l-4 border-l-leaf-500 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.totalOrders', 'Total Orders')}</span>
              <div className="w-10 h-10 rounded-xl bg-leaf-50 flex items-center justify-center text-leaf-700">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{data?.total_orders ?? 0}</p>
            <p className="text-xs text-leaf-700 font-medium mt-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> {t('dashboard.directFromGrowers', '100% Direct from verified growers')}
            </p>
          </div>

          <div className="card border-l-4 border-l-emerald-500 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.totalSpent', 'Total Spent')}</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-gray-900">₹{Number(data?.total_spent || 0).toLocaleString('en-IN')}</p>
              <span className="badge-actual">{t('common.actual', 'Actual')}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {data?.message || t('dashboard.cumulativeProcurement', 'Cumulative procurement total')}
            </p>
          </div>

          <div className="card border-l-4 border-l-sky-500 relative overflow-hidden group sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.estimatedSavings', 'Estimated Savings')}</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-sky-600">~15-25%</p>
              <span className="badge-ai">{t('dashboard.aiMetric', 'AI Metric')}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('dashboard.apmcSaved', 'Saved by eliminating APMC middleman brokerage')}</p>
          </div>
        </div>
      )}

      {/* Quick Navigation Hub */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-leaf-700" />
          {t('dashboard.buyerNavTools', 'Buyer Navigation & Procurement Tools')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-leaf-100 text-leaf-800">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-leaf-700 transition">
                    {action.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {action.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center text-xs font-semibold text-leaf-700 group-hover:text-leaf-800">
                  <span>{t('dashboard.open', 'Open')}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

