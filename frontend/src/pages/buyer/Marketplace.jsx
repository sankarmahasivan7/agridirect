import React, { useEffect, useState } from 'react'
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
  Filter
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
  { key: 'All', name: 'All 3 Districts', hub: 'All District Warehouses' },
  { key: 'Tenkasi', name: 'Tenkasi', hub: 'Tenkasi Central Warehouse' },
  { key: 'Tirunelveli', name: 'Tirunelveli', hub: 'Tirunelveli Central Warehouse' },
  { key: 'Thoothukudi', name: 'Thoothukudi', hub: 'Thoothukudi Central Warehouse' },
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
      
      {/* Top Amazon-Style Subheader / Deliver-To Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-2xl mb-6 shadow-md">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-slate-400 block text-[10px]">Deliver to</span>
            <span className="font-bold text-slate-100">
              {selectedDistrict !== 'All' ? `${selectedDistrict} District Hub` : 'Tenkasi, Tirunelveli & Thoothukudi Hubs'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
            <Zap className="w-3.5 h-3.5 fill-amber-300" />
            100% Warehouse Fulfilled
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="hidden sm:inline text-slate-300 font-medium">
            Zero Middleman Markup
          </span>
        </div>
      </div>

      {/* Amazon-Style Main Search Bar */}
      <div className="mb-6">
        <form onSubmit={handleSearchSubmit} className="flex rounded-2xl shadow-soft border-2 border-slate-200 focus-within:border-amber-500 overflow-hidden bg-white transition-all">
          
          {/* Department Dropdown */}
          <div className="relative border-r border-slate-200 bg-slate-100/90 hover:bg-slate-200/90 transition">
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
              placeholder="Search AgriDirect produce (e.g. Tomatoes, Fresh Spinach, Groundnuts, Milk)..."
              className="w-full py-3.5 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Search CTA Button in Amazon Golden Orange */}
          <button
            type="submit"
            className="bg-[#febd69] hover:bg-[#f3a847] text-slate-900 px-6 sm:px-8 py-3.5 font-extrabold text-sm flex items-center justify-center gap-2 transition-colors shrink-0"
          >
            <Search className="w-4 h-4 text-slate-900" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>
      </div>

      {/* District Hub Filter Chips & Options Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
        
        {/* District Hub Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Hub:
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
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {hub.name}
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
            <span className="text-slate-700 font-semibold">In Stock Only</span>
          </label>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="featured">Featured</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="rating">Avg. Customer Review</option>
              <option value="nearest">Nearest District Warehouse</option>
              <option value="newest">Newest Harvests</option>
            </select>
          </div>

          {(searchQuery || selectedDepartment !== 'All' || selectedDistrict !== 'All' || inStockOnly) && (
            <button
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Results Count Header */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-500">
        <p>
          Showing <span className="font-bold text-slate-900">{sortedListings.length}</span> results in{' '}
          <span className="font-semibold text-slate-800">
            {selectedDepartment === 'All' ? 'All Departments' : selectedDepartment}
          </span>
          {selectedDistrict !== 'All' && ` (${selectedDistrict} Hub)`}
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
            No matching produce found
          </h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Try checking your spelling, selecting "All Departments", or exploring our supported district warehouses in Tenkasi, Tirunelveli, and Thoothukudi.
          </p>
          <button
            onClick={handleReset}
            className="btn-primary py-2 px-5 text-xs shadow-sm inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
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
