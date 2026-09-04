import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, UserCheck, ShieldCheck, ShoppingCart, Check, ArrowUpRight, Scale, Tag } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from './Toast.jsx'

const CATEGORY_COLORS = {
  Vegetables: 'from-emerald-500/10 to-emerald-600/5 text-emerald-700 border-emerald-200/50',
  Fruits: 'from-amber-500/10 to-orange-600/5 text-orange-700 border-orange-200/50',
  Dairy: 'from-blue-500/10 to-sky-600/5 text-blue-700 border-blue-200/50',
  Rice: 'from-yellow-500/10 to-amber-600/5 text-amber-800 border-amber-200/50',
  Wheat: 'from-amber-500/10 to-yellow-600/5 text-amber-700 border-amber-200/50',
  Pulses: 'from-lime-500/10 to-emerald-600/5 text-lime-800 border-lime-200/50',
  Spices: 'from-rose-500/10 to-red-600/5 text-rose-700 border-rose-200/50',
  Other: 'from-slate-500/10 to-slate-600/5 text-slate-700 border-slate-200/50',
}

export default function ListingCard({ listing }) {
  const { addItem } = useCart()
  const { addToast } = useToast()
  const [added, setAdded] = useState(false)

  const qty = Number(listing.quantity_available) || 0
  const minQty = Number(listing.min_order_quantity) || 1
  const price = Number(listing.price_per_unit) || 0
  const seller = listing.farmer_name || listing.fpo_name || 'Verified Farmer'
  const isFpo = !!listing.fpo_name

  const categoryStyle = CATEGORY_COLORS[listing.category_name] || CATEGORY_COLORS.Other

  const handleQuickAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const orderQty = minQty > 0 ? minQty : 1
    addItem(listing, orderQty)
    setAdded(true)
    addToast(`Added ${orderQty} ${listing.unit} of ${listing.product_name} to cart!`)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="card card-hover group flex flex-col justify-between overflow-hidden relative border border-slate-200/70 p-0">
      
      {/* Card Header with Category Gradient Banner */}
      <div className={`p-4 bg-gradient-to-br ${categoryStyle} border-b flex items-start justify-between gap-2`}>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/80 backdrop-blur-sm shadow-2xs border border-white/60">
            {listing.category_name || 'Produce'}
          </span>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1 capitalize group-hover:text-leaf-700 transition-colors">
            {listing.product_name}
          </h3>
        </div>

        <span className="badge-actual shrink-0 shadow-2xs">
          Direct Listing
        </span>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Seller & Location Tag */}
          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-slate-600 mb-4 pb-3 border-b border-slate-100">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
              {isFpo ? <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> : <UserCheck className="w-3.5 h-3.5 text-leaf-600" />}
              {seller}
            </span>
            {listing.location && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {listing.location}
              </span>
            )}
          </div>

          {/* Pricing & Stock Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="label text-[10px] mb-0.5">Farmer Price</span>
              <div className="text-xl font-extrabold text-slate-900 flex items-baseline gap-1">
                <span>₹{price.toFixed(2)}</span>
                <span className="text-xs font-normal text-slate-500">/{listing.unit}</span>
              </div>
            </div>

            <div>
              <span className="label text-[10px] mb-0.5">Available Stock</span>
              <div className="text-base font-bold text-slate-800 flex items-baseline gap-1">
                <Scale className="w-3.5 h-3.5 text-leaf-600" />
                <span>{qty.toLocaleString()} {listing.unit}</span>
              </div>
            </div>
          </div>

          {/* Extra Attributes */}
          <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
            {listing.quality_grade && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium flex items-center gap-1 border border-slate-200/50">
                <Tag className="w-3 h-3 text-slate-500" /> Grade {listing.quality_grade}
              </span>
            )}
            {minQty > 1 && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-medium border border-amber-200/50">
                Min: {minQty} {listing.unit}
              </span>
            )}
            {listing.is_perishable && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md font-medium border border-rose-200/50">
                Perishable
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          <Link
            to={`/buyer/product/${listing.id}`}
            className="btn-secondary col-span-3 text-xs sm:text-sm py-2 px-3 justify-center text-slate-700 group/btn"
          >
            Details
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
          </Link>

          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={qty <= 0}
            className={`col-span-2 text-xs sm:text-sm py-2 px-2 rounded-xl font-semibold inline-flex items-center justify-center gap-1 transition-all ${
              added
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-leaf-600 hover:bg-leaf-700 text-white shadow-sm hover:shadow-md active:scale-95'
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>+ Cart</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}

