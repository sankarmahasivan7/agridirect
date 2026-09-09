import React, { useState, useEffect } from 'react'
import { 
  X, 
  Star, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Camera, 
  Trash2, 
  Eye, 
  Sparkles,
  ShoppingBag
} from 'lucide-react'
import { submitReview } from '../services/api.js'

export default function ReviewModal({ isOpen, onClose, order, existingReview = null, onReviewSubmitted }) {
  const [selectedItemId, setSelectedItemId] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const items = order?.items || []

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5)
      setComment(existingReview.comment || '')
      setSelectedItemId(existingReview.listing_id ? String(existingReview.listing_id) : (items[0]?.listing_id ? String(items[0].listing_id) : ''))
      setImagePreview(existingReview.image_url ? (existingReview.image_url.startsWith('http') ? existingReview.image_url : `http://localhost:8000${existingReview.image_url}`) : '')
      setIsEditing(false)
    } else {
      setRating(5)
      setComment('')
      setImageFile(null)
      setImagePreview('')
      setSelectedItemId(items[0]?.listing_id ? String(items[0].listing_id) : '')
      setIsEditing(true)
    }
    setErrorMsg('')
    setSuccessMsg('')
  }, [existingReview, order, isOpen])

  if (!isOpen || !order) return null

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg('Image size must be less than 10MB.')
        return
      }
      setImageFile(file)
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
      setErrorMsg('')
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) {
      setErrorMsg('Please select a star rating (1 to 5).')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('order_id', order.id)
      formData.append('rating', rating)
      if (selectedItemId) {
        formData.append('listing_id', selectedItemId)
      }
      if (comment.trim()) {
        formData.append('comment', comment.trim())
      }
      if (imageFile) {
        formData.append('image', imageFile)
      }

      const res = await submitReview(formData)
      setSuccessMsg('Feedback and produce photo submitted successfully!')
      if (onReviewSubmitted) {
        onReviewSubmitted(res.data)
      }
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const ratingDescriptions = {
    1: '1/5 - Very Bad / Waste / Rotten Vegetables',
    2: '2/5 - Poor Quality / Damaged Produce',
    3: '3/5 - Average Harvest Quality',
    4: '4/5 - Good & Fresh Produce',
    5: '5/5 - Outstanding Fresh Quality!'
  }

  const isWaste = rating <= 2

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {existingReview && !isEditing ? 'Customer Review Details' : 'Produce Feedback & Quality Rating'}
              </h3>
              <p className="text-xs text-slate-500">Order #{order.id} &bull; Direct Farm Fulfillment</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Existing Review View Mode */}
        {existingReview && !isEditing ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-5 h-5 ${
                        s <= existingReview.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  ))}
                  <span className="text-sm font-extrabold text-slate-800 ml-1">
                    {existingReview.rating} / 5
                  </span>
                </div>
                {existingReview.is_waste_reported && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    Quality Issue Flagged
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Produce: </span>
                {existingReview.product_name}
              </div>

              {existingReview.comment && (
                <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-100 leading-relaxed">
                  "{existingReview.comment}"
                </div>
              )}

              {/* Photo Evidence Preview */}
              {imagePreview && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Uploaded Produce Photo Evidence
                  </p>
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 group max-h-56 bg-black/5 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Uploaded produce evidence"
                      className="max-h-56 w-full object-contain rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Edit My Feedback
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-primary text-xs py-2 px-5"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Submission / Editing Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Target Item Selector if multi-item */}
            {items.length > 1 && (
              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1">
                  Select Produce to Review
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="input text-xs"
                >
                  {items.map((it, idx) => (
                    <option key={idx} value={it.listing_id}>
                      {it.product_name} ({it.quantity} kg)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {items.length === 1 && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-xs text-slate-700">
                <ShoppingBag className="w-4 h-4 text-leaf-600 shrink-0" />
                <span>Reviewing: <b>{items[0]?.product_name}</b> ({items[0]?.quantity} kg)</span>
              </div>
            )}

            {/* Interactive 5-Star Selector */}
            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1">
                Quality Rating (1 to 5 Stars)
              </label>
              <div className="flex items-center gap-2 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 focus:outline-none transition-transform hover:scale-115 active:scale-95"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= (hoverRating || rating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                          : 'fill-slate-100 text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-700 ml-2">
                  {ratingDescriptions[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* Waste Alert Banner */}
            {isWaste && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-amber-950">Produce Quality Issue / Waste Veg Report</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Please take a photo of the waste/damaged vegetables below. This evidence will be immediately flagged to the farmer so quality standards are upheld.
                  </p>
                </div>
              </div>
            )}

            {/* Review Comment Area */}
            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1">
                Detailed Feedback / Notes for Farmer & Next Buyers
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience: freshness, condition, taste, or any rotten/waste produce noticed upon delivery..."
                rows={3}
                className="input text-xs resize-none"
              />
            </div>

            {/* Photo Upload Box */}
            <div>
              <label className="label text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Upload Produce Photo (Proof of Quality / Waste)</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional but Recommended</span>
              </label>

              {imagePreview ? (
                <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Produce preview"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-2xs"
                  />
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-slate-800 truncate">
                      {imageFile ? imageFile.name : 'Uploaded Produce Photo'}
                    </p>
                    <p className="text-[11px] text-slate-400">Photo will be verified and displayed to farmer & buyers</p>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="mt-1 text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Photo
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/60 hover:bg-amber-50/20 transition-all text-center group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-amber-600 transition-colors mb-2">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-amber-900">
                    Click to take photo or choose file
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    JPG, PNG, or WEBP up to 10MB
                  </span>
                </label>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary text-xs py-2 px-6 font-bold shadow-soft flex items-center gap-1.5"
              >
                {submitting ? (
                  <span>Submitting Feedback...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Produce Feedback</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  )
}

