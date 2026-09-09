import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Search, 
  MapPin, 
  Package, 
  Sparkles, 
  ArrowUpRight, 
  Layers, 
  BarChart3, 
  ShieldCheck, 
  Clock, 
  Filter, 
  LayoutGrid, 
  Table as TableIcon,
  RefreshCw
} from 'lucide-react'
import { MARKET_PRICES, MANDI_LOCATIONS } from '../../data/marketPrices.js'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function MarketPrices() {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const isTa = language === 'ta'

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedMandi, setSelectedMandi] = useState('All Mandis')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const categories = ['All', 'Vegetables', 'Fruits', 'Spices', 'Grains']

  const filteredPrices = useMemo(() => {
    return MARKET_PRICES.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false
      }
      // Mandi filter
      if (selectedMandi !== 'All Mandis' && !item.primaryMandi.includes(selectedMandi.replace(' Wholesale Market', '').replace(' Central Market', '').replace(' Market', ''))) {
        return false
      }
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const nameMatch = item.name.toLowerCase().includes(q)
        const nameTaMatch = item.nameTa.toLowerCase().includes(q)
        const aliasMatch = item.aliases.some((a) => a.toLowerCase().includes(q))
        return nameMatch || nameTaMatch || aliasMatch
      }
      return true
    })
  }, [search, selectedCategory, selectedMandi])

  const handleRefresh = () => {
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }

  const handleListCrop = (item) => {
    // Navigate to new listing page with pre-filled state
    navigate(`/farmer/listings/new?crop=${encodeURIComponent(item.name)}&price=${item.modalPrice}&category=${encodeURIComponent(item.category)}&unit=${encodeURIComponent(item.unit)}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Live Ticker Bar */}
      <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-3 sm:p-4 mb-6 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-3 overflow-hidden border border-emerald-900/50">
        <div className="flex items-center gap-2 text-xs font-bold shrink-0">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="uppercase tracking-wider text-emerald-300">
            {t('marketPrices.liveTicker', 'Live Mandi Ticker')}
          </span>
          <span className="text-emerald-500 hidden sm:inline">|</span>
          <span className="text-emerald-300 font-normal">
            Updated {lastUpdated} IST
          </span>
        </div>

        {/* Scrolling Mini Ticker */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar w-full sm:w-auto text-xs py-1">
          {MARKET_PRICES.slice(0, 6).map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 shrink-0 bg-emerald-900/60 px-2.5 py-1 rounded-lg">
              <span>{c.icon}</span>
              <span className="font-semibold text-white">{isTa ? c.nameTa : c.name}:</span>
              <span className="font-extrabold text-emerald-300">₹{c.modalPrice}/{c.unit}</span>
              <span className={`text-[10px] font-bold ${c.trend === 'up' ? 'text-emerald-400' : c.trend === 'down' ? 'text-rose-400' : 'text-slate-300'}`}>
                {c.trendPercent}
              </span>
            </div>
          ))}
        </div>

        <button 
          onClick={handleRefresh}
          className="text-emerald-300 hover:text-white p-1.5 rounded-lg hover:bg-emerald-900/80 transition shrink-0"
          title="Refresh prices"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Page Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-leaf-900 via-leaf-800 to-emerald-900 text-white p-6 sm:p-10 mb-8 shadow-xl border border-leaf-700/40">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-leaf-700/60 text-leaf-200 text-xs font-semibold mb-3 border border-leaf-500/40 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>APMC & Mandi Regulated Price Intelligence</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight text-white mb-2">
            {t('marketPrices.title', 'Daily Mandi & APMC Market Rates')}
          </h1>
          <p className="text-leaf-200 text-sm sm:text-base leading-relaxed">
            {t('marketPrices.subtitle', 'Official wholesale spot prices, daily price bands, and arrival volumes across Tamil Nadu regional mandis.')}
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-leaf-700/50 text-xs text-leaf-200">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>{t('marketPrices.mandiBenchmarkNote', 'Prices verified from daily agricultural marketing boards. Guaranteed 100% grower payout.')}</span>
            </div>
          </div>
        </div>

        {/* Quick listing CTA for farmers */}
        <div className="mt-6 sm:mt-0 sm:absolute sm:top-10 sm:right-10 z-10">
          <Link
            to="/farmer/listings/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            <span>{t('marketPrices.listHarvestNow', 'List Your Harvest at Market Price')}</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Market Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <span className="label text-[10px] text-slate-500">{t('marketPrices.activeCommodities', 'Active Commodities')}</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {MARKET_PRICES.length} Crops
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Covering vegetables, fruits & grains</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <span className="label text-[10px] text-slate-500">{t('marketPrices.avgMarketPrice', 'Average Veggie Price')}</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-leaf-800 mt-1">
            ₹38.40 <span className="text-xs font-normal text-slate-500">/kg</span>
          </div>
          <p className="text-[11px] text-leaf-600 font-semibold mt-1">Direct farm gate rate</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <span className="label text-[10px] text-slate-500">{t('marketPrices.arrivalsVolume', 'Daily Arrivals')}</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            4,850 <span className="text-xs font-normal text-slate-500">Qtl</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across 8 Tamil Nadu mandis</p>
        </div>

        <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <span className="label text-[10px] text-slate-500">{t('marketPrices.priceChange', 'Market Velocity')}</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-5 h-5" /> +2.8%
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Healthy buyer demand</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 sm:p-6 border border-slate-200/80 shadow-soft mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              className="input pl-10 text-sm"
              placeholder={t('marketPrices.searchPlaceholder', 'Search crop (e.g. Tomato, Potato, Onion...)...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Mandi Dropdown */}
          <div className="sm:w-72 shrink-0">
            <select
              className="input text-xs font-semibold py-2.5"
              value={selectedMandi}
              onChange={(e) => setSelectedMandi(e.target.value)}
            >
              {MANDI_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end md:self-auto shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Card Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
          {categories.map((cat) => {
            const active = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  active 
                    ? 'bg-leaf-700 text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'All' ? (isTa ? 'அனைத்து பயிர்கள்' : 'All Crops') : cat}
              </button>
            )
          })}
          <span className="text-xs text-slate-400 ml-auto hidden sm:inline">
            Showing {filteredPrices.length} commodities
          </span>
        </div>
      </div>

      {/* Commodities Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredPrices.map((item) => (
            <div 
              key={item.id}
              className="card p-5 sm:p-6 border border-slate-200/80 shadow-2xs hover:shadow-soft hover:border-leaf-300 transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl p-2 bg-slate-50 rounded-2xl border border-slate-100 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
                        {isTa ? item.nameTa : item.name}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {isTa ? item.categoryTa : item.category}
                      </span>
                    </div>
                  </div>

                  {/* Trend pill */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    item.trend === 'up' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : item.trend === 'down' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {item.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                    {item.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                    {item.trend === 'stable' && <Minus className="w-3.5 h-3.5" />}
                    {item.trendPercent}
                  </span>
                </div>

                {/* Price Display */}
                <div className="p-3.5 bg-gradient-to-br from-leaf-50/70 to-white rounded-2xl border border-leaf-100 mb-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="label text-[10px] text-leaf-800 mb-0">
                        {t('marketPrices.modalPrice', 'Modal / Spot Price')}
                      </span>
                      <div className="text-2xl font-black text-slate-900 mt-0.5">
                        ₹{item.modalPrice.toFixed(2)}
                        <span className="text-xs font-normal text-slate-500"> /{isTa ? item.unitTa : item.unit}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="label text-[10px] text-slate-400 mb-0">Daily Band</span>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">
                        ₹{item.minPrice} – ₹{item.maxPrice}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mandi location & arrivals */}
                <div className="space-y-1.5 text-xs text-slate-600 mb-5">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{isTa ? item.primaryMandiTa : item.primaryMandi}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Arrivals: {item.arrivals}</span>
                  </div>
                </div>
              </div>

              {/* Action: Sell at this rate */}
              <button
                onClick={() => handleListCrop(item)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-leaf-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 group-hover:shadow-md"
              >
                <span>{t('marketPrices.listThisCrop', 'Sell at this Rate')}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Commodities Table View */
        <div className="card overflow-hidden border border-slate-200/80 shadow-soft mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Commodity</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Modal Price</th>
                  <th className="p-4">Daily Band (Min - Max)</th>
                  <th className="p-4">24h Trend</th>
                  <th className="p-4">Primary Wholesale Mandi</th>
                  <th className="p-4">Arrivals</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrices.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-4 font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="text-xl">{item.icon}</span>
                      <span>{isTa ? item.nameTa : item.name}</span>
                    </td>
                    <td className="p-4 text-slate-500">{isTa ? item.categoryTa : item.category}</td>
                    <td className="p-4 font-black text-slate-900 text-sm">
                      ₹{item.modalPrice.toFixed(2)} /{item.unit}
                    </td>
                    <td className="p-4 font-semibold text-slate-700">
                      ₹{item.minPrice} – ₹{item.maxPrice}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-rose-600' : 'text-slate-600'
                      }`}>
                        {item.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                        {item.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                        {item.trend === 'stable' && <Minus className="w-3.5 h-3.5" />}
                        {item.trendPercent}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 max-w-xs truncate">
                      {isTa ? item.primaryMandiTa : item.primaryMandi}
                    </td>
                    <td className="p-4 text-slate-500">{item.arrivals}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleListCrop(item)}
                        className="btn-primary py-1.5 px-3 text-xs font-bold"
                      >
                        {t('marketPrices.listThisCrop', 'Sell')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Informational Callout */}
      <div className="p-6 bg-gradient-to-br from-leaf-50 to-emerald-50 rounded-3xl border border-leaf-200 text-center max-w-3xl mx-auto space-y-2">
        <h3 className="text-base font-extrabold text-leaf-950">
          Transparent Farm Gate Sourcing
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-xl mx-auto">
          {t('marketPrices.mandiBenchmarkNote', 'Prices verified from daily agricultural marketing boards. Guaranteed 100% grower payout.')}
        </p>
      </div>

    </div>
  )
}
