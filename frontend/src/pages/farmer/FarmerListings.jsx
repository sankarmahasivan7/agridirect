import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { myListings, deleteListing, updateListing } from '../../services/api.js'
import { useToast } from '../../components/Toast.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'
import { 
  Package, 
  Plus, 
  Trash2, 
  MapPin, 
  Tag, 
  Scale, 
  ToggleLeft, 
  ToggleRight, 
  Calendar,
  AlertCircle,
  Edit3
} from 'lucide-react'

export default function FarmerListings() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)
  const { addToast } = useToast()
  const { language, isTamil } = useLanguage()
  const isTa = isTamil

  const load = () => {
    setLoading(true)
    myListings()
      .then((res) => setListings(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id, name) => {
    if (!confirm(isTa ? `"${name}" பட்டியலை நிச்சயமாக நீக்க விரும்புகிறீர்களா?` : `Are you sure you want to delete the listing for "${name}"?`)) return
    try {
      await deleteListing(id)
      addToast(isTa ? `"${name}" பட்டியல் நீக்கப்பட்டது.` : `Deleted listing "${name}".`)
      load()
    } catch (err) {
      addToast(isTa ? 'பட்டியலை நீக்க முடியவில்லை.' : 'Could not delete listing.', 'error')
    }
  }

  const handleToggleActive = async (listing) => {
    setTogglingId(listing.id)
    try {
      await updateListing(listing.id, { is_active: !listing.is_active })
      addToast(isTa ? `பட்டியல் ${!listing.is_active ? 'செயலில் உள்ளது' : 'முடக்கப்பட்டது'} என மாற்றப்பட்டது.` : `Listing marked as ${!listing.is_active ? 'Active' : 'Inactive'}.`)
      load()
    } catch (err) {
      addToast(isTa ? 'பட்டியல் நிலையை மாற்ற முடியவில்லை.' : 'Could not update listing status.', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {isTa ? 'விளைபொருள் பட்டியல்கள்' : 'Produce Listings'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isTa 
              ? 'உங்கள் நேரடி சந்தை பொருட்களை நிர்வகிக்கவும். செயலில் உள்ள பட்டியல்கள் வாங்குபவர்களுக்கு உடனடியாக தோன்றும்.' 
              : 'Manage your direct marketplace items. Active listings are immediately visible to buyers.'}
          </p>
        </div>
        <Link to="/farmer/listings/new" className="btn-primary py-2.5 px-4 text-sm font-semibold shadow-md">
          <Plus className="w-4 h-4" />
          {isTa ? 'புதிய பட்டியல் சேர்' : 'Add New Listing'}
        </Link>
      </div>

      {/* Perishability Notice Banner */}
      {listings.some(l => l.is_active && (l.perishability_status === 'CRITICAL' || l.perishability_status === 'URGENT' || l.perishability_status === 'SELL SOON')) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">
              {isTa ? 'அழுகக்கூடிய விளைபொருள் அறிவிப்பு: சில விளைபொருட்கள் காலாவதி தேதியை நெருங்குகின்றன' : 'Perishability Notice: Active lot(s) approaching sell-by date'}
            </p>
            <p className="mt-0.5 text-amber-800">
              {isTa ? 'கழிவைத் தவிர்க்கவும் விரைவாக விற்கவும் அருகிலுள்ள மொத்த வாங்குபவர்கள் மற்றும் உணவகங்களுக்கு முன்னுரிமை அளிக்கப்படுகிறது.' : 'Our algorithm is actively prioritizing nearby bulk buyers, restaurants, and food processors to accelerate off-take and reduce avoidable waste.'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card p-6 h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="card text-center py-20 border-dashed border-2 border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-leaf-50 border border-leaf-100 flex items-center justify-center text-leaf-600 mx-auto mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">
            {isTa ? 'பட்டியல்கள் எதுவும் இதுவரை உருவாக்கப்படவில்லை' : 'No Listings Created Yet'}
          </h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
            {isTa ? 'இடைத்தரகர் கமிஷன் இன்றி வாங்குபவர்களுடன் நேரடியாக இணைய உங்கள் விளைச்சலைப் பட்டியலிடுங்கள்.' : 'Add your harvested or expected crops to connect with buyers directly at zero commission.'}
          </p>
          <Link to="/farmer/listings/new" className="btn-primary">
            {isTa ? 'உங்கள் முதல் பட்டியலை உருவாக்கவும்' : 'Create Your First Listing'}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((l) => {
            const isToggling = togglingId === l.id

            return (
              <div 
                key={l.id} 
                className="card p-6 border border-slate-200/80 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-extrabold text-xl text-slate-900 capitalize">
                      {l.product_name}
                    </h3>
                    <span className={l.is_active ? 'badge-actual' : 'badge-demo'}>
                      {l.is_active ? (isTa ? 'சந்தையில் செயலில் உள்ளது' : 'Active on Marketplace') : (isTa ? 'இடைநிறுத்தப்பட்டது' : 'Paused / Inactive')}
                    </span>
                    {l.perishability_status && (
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                        l.perishability_status === 'CRITICAL'
                          ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                          : l.perishability_status === 'URGENT'
                          ? 'bg-orange-50 text-orange-700 border-orange-300'
                          : l.perishability_status === 'SELL SOON'
                          ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {l.perishability_status}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-leaf-600" />
                      {Number(l.quantity_available)} {l.unit} {isTa ? 'இருப்பு உள்ளது' : 'available'}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      ₹{Number(l.price_per_unit).toFixed(2)} /{l.unit}
                    </span>
                    {l.expected_sell_by_date && (
                      <>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">
                          {isTa ? 'விற்பனைக்குள்:' : 'Sell-by:'} <b className="text-slate-800">{l.expected_sell_by_date}</b>
                        </span>
                      </>
                    )}
                    {l.location && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {l.location}
                        </span>
                      </>
                    )}
                    {l.quality_grade && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          {isTa ? 'தரம்' : 'Grade'} {l.quality_grade}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 self-end sm:self-center">
                  <Link
                    to={`/farmer/listings/edit/${l.id}`}
                    className="btn-secondary text-xs py-2 px-3 font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 shadow-2xs"
                    title="Edit listing"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isTa ? 'மாற்றுக' : 'Edit'}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(l)}
                    disabled={isToggling}
                    className={`btn-secondary text-xs py-2 px-3 font-semibold ${
                      l.is_active 
                        ? 'text-amber-700 hover:bg-amber-50 border-amber-200' 
                        : 'text-leaf-700 hover:bg-leaf-50 border-leaf-200'
                    }`}
                  >
                    {l.is_active ? (
                      <>
                        <ToggleRight className="w-4 h-4 text-leaf-600" />
                        <span>{isTa ? 'முடக்கு' : 'Deactivate'}</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                        <span>{isTa ? 'செயல்படுத்து' : 'Activate'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(l.id, l.product_name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title={isTa ? 'பட்டியலை நீக்கு' : 'Delete listing'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

