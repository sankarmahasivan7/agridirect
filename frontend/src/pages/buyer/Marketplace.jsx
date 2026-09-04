import React, { useEffect, useState } from 'react'
import { browseMarketplace } from '../../services/api.js'
import ListingCard from '../../components/ListingCard.jsx'
import { 
  Search, 
  Filter, 
  X, 
  SlidersHorizontal, 
  MapPin, 
  RotateCcw, 
  Sparkles,
  ShoppingBag,
  ArrowUpDown
} from 'lucide-react'

const CATEGORIES = [
  'All',
  'Vegetables',
  'Fruits',
  'Dairy',
  'Rice',
  'Wheat',
  'Pulses',
  'Spices',
  'Other'
]

export default function Marketplace() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState('newest') // newest, price_low, price_high, qty_high

  const load = (params = {}) => {
    setLoading(true)
    browseMarketplace(params)
      .then((res) => setListings(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const params = {}
    if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory
    if (searchQuery.trim()) params.q = searchQuery.trim()
    if (locationQuery.trim()) params.location = locationQuery.trim()
    load(params)
  }, [selectedCategory])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const params = {}
    if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory
    if (searchQuery.trim()) params.q = searchQuery.trim()
    if (locationQuery.trim()) params.location = locationQuery.trim()
    load(params)
  }

  const handleReset = () => {
    setSearchQuery('')
    setLocationQuery('')
    setSelectedCategory('All')
    setSortBy('newest')
    load({})
  }

  // Client-side sorting for responsive UX
  const sortedListings = [...listings].sort((a, b) => {
    if (sortBy === 'price_low') return Number(a.price_per_unit) - Number(b.price_per_unit)
    if (sortBy === 'price_high') return Number(b.price_per_unit) - Number(a.price_per_unit)
    if (sortBy === 'qty_high') return Number(b.quantity_available) - Number(a.quantity_available)
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Direct Marketplace</h1>
            <span className="badge-actual">Live Supply</span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Browse real harvests directly listed by verified farmers and FPOs. 100% of price goes to growers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 shadow-2xs">
            <ShoppingBag className="w-4 h-4 text-leaf-600" />
            <span>{listings.length} {listings.length === 1 ? 'Product' : 'Products'} Available</span>
          </div>
        </div>
      </div>

      {/* Unified Search & Filters Bar */}
      <div className="card p-4 mb-6 border border-slate-200/80 shadow-soft">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-3">
          
          {/* Main search */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              className="input pl-11 text-sm"
              placeholder="Search produce (e.g. Tomato, Milk, Onion, Wheat)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Location input */}
          <div className="relative w-full lg:w-64">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              className="input pl-10 text-sm"
              placeholder="Filter by city/region…"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />
            {locationQuery && (
              <button
                type="button"
                onClick={() => setLocationQuery('')}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button className="btn-primary py-2.5 px-5 text-sm font-semibold whitespace-nowrap" type="submit">
              Search
            </button>

            {(searchQuery || locationQuery || selectedCategory !== 'All') && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset all filters"
                className="btn-secondary py-2.5 px-3 text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

        </form>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4 pt-3 border-t border-slate-100 no-scrollbar">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Category:</span>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-leaf-600 text-white shadow-sm shadow-leaf-600/30'
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>

      </div>

      {/* Sort & Quick Meta Controls */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{sortedListings.length}</span> live listing(s)
        </p>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-leaf-500/20"
          >
            <option value="newest">Latest Listings</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="qty_high">Highest Quantity Available</option>
          </select>
        </div>
      </div>

      {/* Product Grid / Loading / Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="card p-0 overflow-hidden border border-slate-200/80">
              <div className="h-20 skeleton" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-3/4 skeleton rounded-lg" />
                <div className="h-4 w-1/2 skeleton rounded-lg" />
                <div className="h-16 w-full skeleton rounded-xl" />
                <div className="h-9 w-full skeleton rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedListings.length === 0 ? (
        <div className="card text-center py-20 border-dashed border-2 border-slate-200 bg-white">
          <div className="w-16 h-16 rounded-2xl bg-leaf-50 border border-leaf-100 flex items-center justify-center text-leaf-600 mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">No products match your search</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Try adjusting your search keywords, clearing location filters, or exploring another category.
          </p>
          <button
            onClick={handleReset}
            className="btn-secondary text-xs py-2 px-4 shadow-2xs inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedListings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

    </div>
  )
}

