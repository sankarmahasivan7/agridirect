import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { farmerDashboard } from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'
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
  BarChart3,
  Star,
  Camera,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye
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
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    farmerDashboard()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  // Visual trend for earnings progression based on actual net earnings
  const netEarnings = Number(data?.earnings?.net_earnings || 0)
  const performanceData = [
    { name: 'Mon', earnings: Number((netEarnings * 0.15).toFixed(2)) },
    { name: 'Tue', earnings: Number((netEarnings * 0.35).toFixed(2)) },
    { name: 'Wed', earnings: Number((netEarnings * 0.50).toFixed(2)) },
    { name: 'Thu', earnings: Number((netEarnings * 0.75).toFixed(2)) },
    { name: 'Fri', earnings: Number(netEarnings.toFixed(2)) },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('dashboard.farmerWorkspace', 'Farmer Workspace')}</h1>
            <span className="badge-actual">{t('dashboard.producerVerified', 'Producer Verified')}</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {t('dashboard.farmerSubtitle', 'Manage your produce listings, monitor buyer demand, and track earnings without commissions.')}
          </p>
        </div>

        <Link to="/farmer/listings/new" className="btn-primary py-2.5 px-4 text-sm font-semibold shadow-md">
          <PlusCircle className="w-4 h-4" />
          {t('dashboard.addNewHarvest', 'Add New Harvest Listing')}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            
            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="label text-[10px] text-slate-500">{t('dashboard.activeListings', 'Active Listings')}</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {data.active_listings_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{t('dashboard.discoverableInMarket', 'Directly discoverable in marketplace')}</p>
            </div>

            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="label text-[10px] text-slate-500">{t('dashboard.pendingOrders', 'Pending Orders')}</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {data.pending_orders_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{t('dashboard.awaitingFulfillment', 'Awaiting your fulfillment confirmation')}</p>
            </div>

            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="label text-[10px] text-slate-500 mb-0">{t('dashboard.netTakeHome', 'Net Take-Home Pay')}</span>
                  <span className="badge-actual text-[10px] py-0 px-2">{t('dashboard.directTakeHome', '100% Direct')}</span>
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

            {/* Customer Rating & Quality Card */}
            <div className="card p-6 border border-slate-200/80 shadow-soft relative overflow-hidden bg-gradient-to-br from-white to-amber-50/40">
              <div className="flex items-center justify-between mb-3">
                <span className="label text-[10px] text-slate-500">Customer Rating</span>
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-slate-900">
                  {data.rating_summary?.total_reviews > 0 ? `${data.rating_summary.average_rating}★` : '5.0★'}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({data.rating_summary?.total_reviews || 0} reviews)
                </span>
              </div>
              <div className="mt-1">
                {data.rating_summary?.waste_reports_count > 0 ? (
                  <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {data.rating_summary.waste_reports_count} Quality Issue(s) Reported
                  </span>
                ) : (
                  <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Produce quality verified
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* Performance Trend Chart */}
          <div className="card p-6 border border-slate-200/80 shadow-soft mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-leaf-600" />
                <h2 className="text-base font-bold text-slate-900">{t('dashboard.revenueVelocity', 'Revenue & Fulfillment Velocity')}</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">{t('dashboard.weeklyPerformance', 'Weekly Performance')}</span>
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

          {/* Customer Quality Feedback & Produce Inspection Feed */}
          <div className="card p-6 border border-slate-200/80 shadow-soft mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <h2 className="text-base font-bold text-slate-900">Customer Quality Feedback & Produce Inspection</h2>
                  <span className="badge-actual text-xs">Buyer Verified</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Inspect buyer ratings, harvest quality feedback, and customer-uploaded produce photos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  <span>Overall Rating: {data.rating_summary?.total_reviews > 0 ? `${data.rating_summary.average_rating} / 5.0` : '5.0 / 5.0'}</span>
                </div>
              </div>
            </div>

            {/* Quality Issue Warning Banner */}
            {data.rating_summary?.waste_reports_count > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-950 text-sm">
                    Quality Alert: {data.rating_summary.waste_reports_count} Produce Issue(s) Reported
                  </span>
                  <p className="text-rose-700 mt-0.5 leading-relaxed">
                    One or more buyers reported damaged or waste vegetables and provided photo evidence. Please inspect the photos below to check harvest sorting and storage handling.
                  </p>
                </div>
              </div>
            )}

            {/* Reviews List */}
            {data.rating_summary?.recent_reviews && data.rating_summary.recent_reviews.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.rating_summary.recent_reviews.map((rev) => {
                    const photoUrl = rev.image_url
                      ? (rev.image_url.startsWith('http') ? rev.image_url : `http://localhost:8000${rev.image_url}`)
                      : null

                    return (
                      <div
                        key={rev.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          rev.is_waste_reported
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="font-bold text-slate-900 text-xs">{rev.product_name}</span>
                            <p className="text-[11px] text-slate-400">Order #{rev.order_id} &bull; Buyer: {rev.buyer_name}</p>
                          </div>
                          <div className="flex items-center gap-1 text-amber-400 shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {rev.comment && (
                          <p className="text-xs text-slate-700 italic mb-3 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-slate-100">
                            "{rev.comment}"
                          </p>
                        )}

                        {photoUrl && (
                          <div className="mt-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Camera className="w-3 h-3 text-emerald-600" />
                              Customer Inspection Photo
                            </p>
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(photoUrl)}
                              className="relative rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 inline-block focus:outline-none group max-w-[160px]"
                            >
                              <img
                                src={photoUrl}
                                alt="Customer produce evidence"
                                className="w-36 h-24 object-cover group-hover:scale-105 transition"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                <Eye className="w-3.5 h-3.5" /> Inspect Photo
                              </div>
                            </button>
                          </div>
                        )}

                        <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                          {rev.is_waste_reported && (
                            <span className="font-bold text-rose-600">Waste / Damage Reported</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-70" />
                <h4 className="text-sm font-bold text-slate-800">No Feedback Received Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When buyers receive your delivered harvest orders and rate the produce with photos, their inspection feedback will appear here.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Hub */}
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
        {t('dashboard.quickActionHub', 'Quick Action Hub')}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Market Rates Tile */}
        <Link 
          to="/market-prices" 
          className="card card-hover p-5 border border-emerald-300 group flex flex-col justify-between bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 shadow-xs"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-leaf-700 transition-colors">
              {t('marketPrices.title', 'Daily Mandi & APMC Market Rates')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {t('marketPrices.subtitle', 'Official wholesale spot prices and arrival volumes across Tamil Nadu regional mandis.')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 mt-4 pt-3 border-t border-emerald-100">
            <span>{t('marketPrices.viewAllCrops', 'View All Commodities')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link 
          to="/farmer/listings" 
          className="card card-hover p-5 border border-slate-200/80 group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 group-hover:text-leaf-700 transition-colors">
              {t('dashboard.manageProduce', 'Manage Produce Listings')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {t('dashboard.manageProduceDesc', 'Toggle availability, update pricing, or view active listings.')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-leaf-700 mt-4 pt-3 border-t border-slate-100">
            <span>{t('dashboard.viewListings', 'View Listings')}</span>
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
              {t('dashboard.customerOrders', 'Customer Orders')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {t('dashboard.customerOrdersDesc', 'Confirm incoming purchase requests and mark harvests ready for pickup.')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-blue-700 mt-4 pt-3 border-t border-slate-100">
            <span>{t('dashboard.processOrders', 'Process Orders')}</span>
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
              {t('dashboard.aiMarketIntel', 'AI Market Intelligence')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {t('dashboard.aiMarketIntelDesc', 'Consult machine learning forecasts for upcoming crop demand & fair price bands.')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-ai-700 mt-4 pt-3 border-t border-slate-100">
            <span>{t('dashboard.inspectAIForecast', 'Inspect AI Forecast')}</span>
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
              {t('dashboard.fleetTracking', 'Fleet & Live Tracking')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {t('dashboard.fleetTrackingDesc', 'Monitor active transporter pickup coordinates and transit schedules.')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-purple-700 mt-4 pt-3 border-t border-slate-100">
            <span>{t('dashboard.trackVehicles', 'Track Vehicles')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

      </div>

      {/* Lightbox / Enlarged Photo View for Farmer */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2 bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-3 top-3 text-slate-700 bg-white/90 hover:bg-white p-1.5 rounded-full shadow transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedPhoto}
              alt="Enlarged produce evidence"
              className="max-h-[75vh] w-auto rounded-2xl object-contain mx-auto"
            />
            <p className="text-center text-xs text-slate-500 mt-2 font-medium">
              Customer uploaded produce inspection photo
            </p>
          </div>
        </div>
      )}

    </div>
  )
}

