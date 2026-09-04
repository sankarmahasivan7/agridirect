import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { myListings, getDemandForecast, getPriceRecommendation } from '../../services/api.js'
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  HelpCircle, 
  ShieldCheck, 
  Package, 
  BarChart2, 
  Info,
  CheckCircle2
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'

export default function AIInsights() {
  const [listings, setListings] = useState([])
  const [selected, setSelected] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [priceRec, setPriceRec] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    myListings()
      .then((res) => {
        setListings(res.data)
        if (res.data.length > 0) setSelected(res.data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    getDemandForecast(selected.product_name, selected.location)
      .then((res) => setForecast(res.data))
      .catch(() => {})

    getPriceRecommendation(selected.id)
      .then((res) => setPriceRec(res.data))
      .catch(() => {})
  }, [selected])

  // Simulated daily demand projection chart data based on forecast
  const baseQty = forecast?.forecast_quantity ? Number(forecast.forecast_quantity) / 7 : 35
  const chartData = [
    { day: 'Mon', demand: Math.round(baseQty * 0.85) },
    { day: 'Tue', demand: Math.round(baseQty * 0.95) },
    { day: 'Wed', demand: Math.round(baseQty * 1.1) },
    { day: 'Thu', demand: Math.round(baseQty * 1.05) },
    { day: 'Fri', demand: Math.round(baseQty * 1.3) },
    { day: 'Sat', demand: Math.round(baseQty * 1.4) },
    { day: 'Sun', demand: Math.round(baseQty * 0.75) },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI Market Intelligence</h1>
            <span className="badge-ai">Advisory Only</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Machine learning models analyze regional demand patterns to help you price profitably. Your listings never change automatically.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-12 w-64 skeleton rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card h-48 skeleton rounded-2xl" />
            <div className="card h-48 skeleton rounded-2xl" />
          </div>
        </div>
      ) : listings.length === 0 ? (
        <div className="card text-center py-20 border-dashed border-2 border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-ai-50 border border-ai-100 flex items-center justify-center text-ai-600 mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">No Active Listings Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
            Publish your first produce listing to activate personalized AI price and demand forecasts.
          </p>
          <Link to="/farmer/listings/new" className="btn-primary">
            Create Your First Listing
          </Link>
        </div>
      ) : (
        <>
          {/* Listing Picker */}
          <div className="card p-4 border border-slate-200/80 shadow-soft mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-leaf-600" />
              <span className="text-sm font-bold text-slate-800">Select Harvest Listing:</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {listings.map((l) => {
                const isSelected = selected?.id === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelected(l)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-ai-600 text-white shadow-sm shadow-ai-600/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {l.product_name} ({l.location || 'Local'})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Core Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            
            {/* Price Recommendation Card */}
            <div className="card p-6 border border-slate-200 shadow-soft flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-ai-600" />
                    <h2 className="text-base font-bold text-slate-900">Fair Market Rate Band</h2>
                  </div>
                  <span className="badge-ai">Trained Model</span>
                </div>

                {priceRec ? (
                  <>
                    <div className="p-4 bg-ai-50/50 border border-ai-100 rounded-xl mb-4">
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-ai-700 font-bold uppercase tracking-wider">
                          Recommended Price Range
                        </span>
                        <span className="text-2xl font-extrabold text-ai-900">
                          ₹{Number(priceRec.recommended_min)} – ₹{Number(priceRec.recommended_max)}
                          <span className="text-xs font-normal text-slate-500"> /{selected.unit}</span>
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline pt-2 border-t border-ai-100">
                        <span className="text-xs text-slate-600 font-semibold">Your Current Listed Price</span>
                        <span className="text-lg font-extrabold text-emerald-700">
                          ₹{Number(priceRec.actual_farmer_price).toFixed(2)} /{selected.unit}
                        </span>
                      </div>
                    </div>

                    {priceRec.reasoning && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <b>Market Dynamics:</b> {priceRec.reasoning}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400 py-6 text-center">Loading price intelligence…</p>
                )}
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <b>You maintain 100% price autonomy.</b> This indicator informs you of buyer purchasing thresholds without any automated changes.
                </span>
              </div>
            </div>

            {/* Demand Forecast Chart */}
            <div className="card p-6 border border-slate-200 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-leaf-600" />
                  <h2 className="text-base font-bold text-slate-900">Weekly Demand Projection</h2>
                </div>
                {forecast?.trend && (
                  <span className="badge-actual">
                    {forecast.trend === 'increasing' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-amber-600 inline mr-1" />
                    )}
                    {forecast.trend} trend
                  </span>
                )}
              </div>

              <div className="h-52 w-full mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip 
                      formatter={(v) => [`${v} units`, 'Projected Demand']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="demand" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {forecast?.mae != null && (
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  <span>Accuracy Metrics:</span>
                  <span className="font-semibold text-slate-600">MAE: {forecast.mae}</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-600">RMSE: {forecast.rmse}</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-600">R²: {forecast.r2}</span>
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  )
}

