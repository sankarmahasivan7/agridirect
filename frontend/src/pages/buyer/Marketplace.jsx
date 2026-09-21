import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { browseMarketplace } from '../../services/api.js'
import ListingCard from '../../components/ListingCard.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { 
  Search, 
  MapPin, 
  RotateCcw, 
  ShoppingBag, 
  ArrowUpDown, 
  Zap, 
  Check, 
  Building2,
  ChevronDown,
  Filter,
  Sparkles,
  ChevronRight
} from 'lucide-react'

const DEPARTMENTS = [
  { key: 'All', labelEn: 'All Departments', labelTa: 'அனைத்து பிரிவுகள்' },
  { key: 'Vegetables', labelEn: 'Vegetables', labelTa: 'காய்கறிகள்' },
  { key: 'Fruits', labelEn: 'Fruits', labelTa: 'பழங்கள்' },
  { key: 'Dairy', labelEn: 'Dairy', labelTa: 'பால் பண்ணை' },
  { key: 'Rice', labelEn: 'Rice & Grains', labelTa: 'அரிசி / தானியங்கள்' },
  { key: 'Wheat', labelEn: 'Wheat & Flour', labelTa: 'கோதுமை' },
  { key: 'Pulses', labelEn: 'Pulses & Lentils', labelTa: 'பருப்பு வகைகள்' },
  { key: 'Spices', labelEn: 'Spices & Herbs', labelTa: 'மசாலா பொருட்கள்' },
  { key: 'Other', labelEn: 'Other Farm Crops', labelTa: 'பிற பயிர்கள்' },
]

const DISTRICT_HUBS = [
  { key: 'All', nameEn: 'All 3 Districts', nameTa: 'அனைத்து 3 மாவட்டங்கள்', hub: 'All District Warehouses' },
  { key: 'Tenkasi', nameEn: 'Tenkasi', nameTa: 'தென்காசி', hub: 'Tenkasi Central Warehouse' },
  { key: 'Tirunelveli', nameEn: 'Tirunelveli', nameTa: 'திருநெல்வேலி', hub: 'Tirunelveli Central Warehouse' },
  { key: 'Thoothukudi', nameEn: 'Thoothukudi', nameTa: 'தூத்துக்குடி', hub: 'Thoothukudi Central Warehouse' },
]

export default function Marketplace() {
  const { t, language } = useLanguage()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDepartment, setSelectedDepartment] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('All')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState('featured') // featured, price_low, price_high, rating, nearest, newest
  const [buyerCoords, setBuyerCoords] = useState(null)
  const [channel, setChannel] = useState('consumer')

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBuyerCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        },
        () => {},
        { timeout: 5000 }
      )
    }
  }, [])

  const load = (params = {}) => {
    setLoading(true)
    const p = { ...params }
    if (buyerCoords) {
      p.buyer_lat = buyerCoords.lat
      p.buyer_lon = buyerCoords.lon
    }
    if (channel) {
      p.channel = channel
    }
    browseMarketplace(p)
      .then((res) => setListings(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const params = {}
    if (selectedDepartment && selectedDepartment !== 'All') params.category = selectedDepartment
    if (searchQuery.trim()) params.q = searchQuery.trim()
    if (selectedDistrict && selectedDistrict !== 'All') params.location = selectedDistrict
    load(params)
  }, [selectedDepartment, selectedDistrict, buyerCoords, channel])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const params = {}
    if (selectedDepartment && selectedDepartment !== 'All') params.category = selectedDepartment
    if (searchQuery.trim()) params.q = searchQuery.trim()
    if (selectedDistrict && selectedDistrict !== 'All') params.location = selectedDistrict
    load(params)
  }

  const handleReset = () => {
    setSearchQuery('')
    setSelectedDepartment('All')
    setSelectedDistrict('All')
    setInStockOnly(false)
    setSortBy('featured')
    load({})
  }

  // Filter in-stock and client-side sorting
  const filteredListings = listings.filter((l) => {
    if (inStockOnly && Number(l.quantity_available) <= 0) return false
    return true
  })

  const sortedListings = [...filteredListings].sort((a, b) => {
    if (sortBy === 'price_low') return Number(a.price_per_unit) - Number(b.price_per_unit)
    if (sortBy === 'price_high') return Number(b.price_per_unit) - Number(a.price_per_unit)
    if (sortBy === 'rating') {
      const rateA = a.quality_grade === 'Grade A' ? 5 : 4
      const rateB = b.quality_grade === 'Grade B' ? 5 : 4
      return rateB - rateA
    }
    if (sortBy === 'nearest') {
      const distA = a.distance_km != null ? Number(a.distance_km) : Infinity
      const distB = b.distance_km != null ? Number(b.distance_km) : Infinity
      return distA - distB
    }
    if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    // 'featured': prioritizes fresh, verified, then id
    return (b.id || 0) - (a.id || 0)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Direct-Trade Subheader / Deliver-To Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white px-5 py-3 rounded-2xl mb-6 shadow-md border border-slate-700/60">
        <div className="flex items-center gap-2.5 text-xs">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 flex items-center justify-center text-amber-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
              {t('marketplace.deliverToRegion', 'Deliver to Region')}
            </span>
            <span className="font-extrabold text-slate-100">
              {selectedDistrict !== 'All' 
                ? `${language === 'ta' ? (DISTRICT_HUBS.find(h => h.key === selectedDistrict)?.nameTa || selectedDistrict) : selectedDistrict} ${t('marketplace.districtHub', 'District Hub')}` 
                : t('marketplace.allHubsTitle', 'Tenkasi • Tirunelveli • Thoothukudi')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-emerald-300 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            {t('marketplace.directFarmFulfilled', '100% Direct Farm Fulfilled')}
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-300 font-medium">
            {t('marketplace.zeroMiddlemanMarkups', 'Zero Middleman Markups')}
          </span>
        </div>
      </div>

      {/* Main Search Bar */}
      <div className="mb-6">
        <form onSubmit={handleSearchSubmit} className="flex rounded-2xl shadow-soft border border-slate-200/90 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 overflow-hidden bg-white transition-all">
          
          {/* Department Dropdown */}
          <div className="relative border-r border-slate-200 bg-slate-50/90 hover:bg-slate-100 transition">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="appearance-none bg-transparent pl-3 pr-8 py-3.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.key} value={dept.key}>
                  {language === 'ta' ? dept.labelTa : dept.labelEn}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-4 pointer-events-none" />
          </div>

          {/* Search Input */}
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('marketplace.searchProducePlaceholder', 'Search farm-fresh produce (e.g. Brinjal, Tomatoes, Onion, Coconut, Rice)...')}
              className="w-full py-3.5 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Search CTA Button */}
          <button
            type="submit"
            className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-6 sm:px-8 py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 transition-all shrink-0 shadow-xs active:scale-[0.98]"
          >
            <Search className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">{t('common.search', 'Search')}</span>
          </button>
        </form>
      </div>

      {/* Advance Produce Priority Booking Banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-850 p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-emerald-700/60">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base tracking-tight text-white">
                {t('marketplace.upcomingDemandPrompt', 'Need Vegetables or Crops in Upcoming Days?')}
              </span>
              <span className="text-2xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                {t('marketplace.priorityBooking', 'Priority Booking')}
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              {t('marketplace.priorityBookingDesc', 'Apply early! Your request is broadcast immediately to all registered farmers, and newly delivered crops are auto-assigned to you with #1 Priority.')}
            </p>
          </div>
        </div>
        <Link
          to="/buyer/advance-demands"
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black shadow-md shadow-emerald-950/20 transition active:scale-95"
        >
          <span>{t('marketplace.bookInAdvance', 'Book in Advance')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* District Hub Filter Chips & Options Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
        
        {/* District Hub Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> {t('marketplace.hub', 'Hub')}:
          </span>
          {DISTRICT_HUBS.map((hub) => {
            const isSelected = selectedDistrict === hub.key
            return (
              <button
                key={hub.key}
                type="button"
                onClick={() => setSelectedDistrict(hub.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                }`}
              >
                {language === 'ta' ? hub.nameTa : hub.nameEn}
              </button>
            )
          })}
        </div>

        {/* Right Filter & Sort Controls */}
        <div className="flex items-center gap-4 text-xs font-medium">
          {/* In-Stock Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span className="text-slate-700 font-semibold">{t('marketplace.inStockOnly', 'In Stock Only')}</span>
          </label>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 hidden sm:inline">{t('marketplace.sortBy', 'Sort')}:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="featured">{t('marketplace.sortFeatured', 'Featured')}</option>
              <option value="price_low">{t('marketplace.sortPriceLow', 'Price: Low to High')}</option>
              <option value="price_high">{t('marketplace.sortPriceHigh', 'Price: High to Low')}</option>
              <option value="rating">{t('marketplace.sortRating', 'Avg. Customer Review')}</option>
              <option value="nearest">{t('marketplace.sortNearest', 'Nearest District Warehouse')}</option>
              <option value="newest">{t('marketplace.sortNewest', 'Newest Harvests')}</option>
            </select>
          </div>

          {(searchQuery || selectedDepartment !== 'All' || selectedDistrict !== 'All' || inStockOnly) && (
            <button
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              title={t('marketplace.resetFilters', 'Reset Filters')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-500">
        <p>
          {t('marketplace.showing', 'Showing')}{' '}
          <span className="font-bold text-slate-900">{sortedListings.length}</span>{' '}
          {t('marketplace.resultsIn', 'results in')}{' '}
          <span className="font-semibold text-slate-800">
            {selectedDepartment === 'All' 
              ? (language === 'ta' ? 'அனைத்து பிரிவுகள்' : 'All Departments') 
              : (language === 'ta' ? (DEPARTMENTS.find(d => d.key === selectedDepartment)?.labelTa || selectedDepartment) : selectedDepartment)}
          </span>
          {selectedDistrict !== 'All' && ` (${language === 'ta' ? (DISTRICT_HUBS.find(h => h.key === selectedDistrict)?.nameTa || selectedDistrict) : selectedDistrict} ${t('marketplace.hub', 'Hub')})`}
        </p>
      </div>

      {/* Product Grid / Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="h-6 w-1/3 skeleton rounded-full" />
              <div className="h-6 w-3/4 skeleton rounded-lg" />
              <div className="h-4 w-1/2 skeleton rounded-md" />
              <div className="h-10 w-full skeleton rounded-xl" />
              <div className="h-8 w-full skeleton rounded-xl" />
            </div>
          ))}
        </div>
      ) : sortedListings.length === 0 ? (
        <div className="bg-white rounded-3xl text-center py-20 border-dashed border-2 border-slate-200 p-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-800 mb-1">
            {t('marketplace.noProduceFound', 'No matching produce found')}
          </h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            {t('marketplace.noProduceFoundDesc', 'Try checking your spelling, selecting "All Departments", or exploring our supported district warehouses in Tenkasi, Tirunelveli, and Thoothukudi.')}
          </p>
          <button
            onClick={handleReset}
            className="btn-primary py-2 px-5 text-xs shadow-sm inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('marketplace.resetFilters', 'Reset Filters')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedListings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

    </div>
  )
}
