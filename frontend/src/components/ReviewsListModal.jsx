import React, { useEffect, useState } from 'react'
import { 
  X, 
  Star, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  UserCheck, 
  Eye, 
  ThumbsUp,
  Image as ImageIcon
} from 'lucide-react'
import { getListingReviews } from '../services/api.js'

export default function ReviewsListModal({ isOpen, onClose, listing }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  useEffect(() => {
    if (isOpen && listing?.id) {
      setLoading(true)
      getListingReviews(listing.id)
        .then((res) => setData(res.data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false))
    }
  }, [isOpen, listing?.id])

  if (!isOpen || !listing) return null

  const reviews = data?.reviews || []
  const avgRating = data?.average_rating || 0
  const totalReviews = data?.total_reviews || 0
  const breakdown = data?.rating_breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  // Extract all photos uploaded by buyers for quick photo gallery
  const photos = reviews
    .filter((r) => Boolean(r.image_url))
    .map((r) => ({
      url: r.image_url.startsWith('http') ? r.image_url : `http://localhost:8000${r.image_url}`,
      buyer: r.buyer_name,
      rating: r.rating,
      comment: r.comment,
    }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative my-8 max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 capitalize">
                {listing.product_name} &bull; Customer Reviews
              </h3>
              <p className="text-xs text-slate-500">
                Grown by <span className="font-bold text-slate-700">{listing.farmer_name || 'Verified Farmer'}</span> &bull; {listing.location || 'Tamil Nadu'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-24 bg-slate-100 animate-pulse rounded-2xl" />
              <div className="h-32 bg-slate-100 animate-pulse rounded-2xl" />
            </div>
          ) : totalReviews === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-amber-400" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">No Reviews Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                This harvest batch has not received customer reviews yet. Be the first verified buyer to order and share your produce photos!
              </p>
            </div>
          ) : (
            <>
              {/* Rating Summary Card */}
              <div className="p-5 bg-gradient-to-br from-amber-50/40 via-white to-slate-50 rounded-2xl border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900">{avgRating}</span>
                    <span className="text-slate-400 text-sm font-semibold">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 my-1 justify-center sm:justify-start">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= Math.round(avgRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Based on <b>{totalReviews} verified purchase{totalReviews > 1 ? 's' : ''}</b>
                  </p>
                </div>

                {/* Rating Breakdown Bars */}
                <div className="flex-1 max-w-xs space-y-1 text-xs">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const count = breakdown[s] || 0
                    const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className="w-5 text-slate-500 font-semibold">{s}★</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] text-slate-400 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Customer Photos Gallery */}
              {photos.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Customer Produce Photos ({photos.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {photos.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPhoto(p.url)}
                        className="relative rounded-xl overflow-hidden aspect-square border border-slate-200 hover:border-amber-400 transition-all group focus:outline-none"
                      >
                        <img
                          src={p.url}
                          alt="Customer produce photo"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Verified Buyer Reviews ({reviews.length})
                </h4>

                <div className="divide-y divide-slate-100 space-y-4">
                  {reviews.map((rev) => {
                    const photoUrl = rev.image_url
                      ? (rev.image_url.startsWith('http') ? rev.image_url : `http://localhost:8000${rev.image_url}`)
                      : null

                    return (
                      <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-leaf-100 text-leaf-800 font-bold text-xs flex items-center justify-center">
                              {rev.buyer_name ? rev.buyer_name[0].toUpperCase() : 'B'}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                {rev.buyer_name}
                                <span className="text-[10px] font-normal text-emerald-600 flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-amber-400">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= rev.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-slate-200 text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {rev.comment && (
                          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            "{rev.comment}"
                          </p>
                        )}

                        {/* Uploaded Produce Photo in review item */}
                        {photoUrl && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(photoUrl)}
                              className="relative rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 inline-block focus:outline-none group max-w-[140px]"
                            >
                              <img
                                src={photoUrl}
                                alt="Produce proof"
                                className="w-32 h-24 object-cover group-hover:scale-105 transition"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                <Eye className="w-3.5 h-3.5" /> Inspect
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-2 px-5"
          >
            Close
          </button>
        </div>

        {/* Lightbox / Enlarged Photo View */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
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
                alt="Enlarged produce photo"
                className="max-h-[75vh] w-auto rounded-2xl object-contain mx-auto"
              />
              <p className="text-center text-xs text-slate-500 mt-2 font-medium">
                Customer uploaded produce inspection photo
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

