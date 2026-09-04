import React, { useState } from 'react'
import { MapPin, Navigation, Search, Compass, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

export default function LocationPicker({ latitude, longitude, onChange, label = 'Location' }) {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location detection.')
      return
    }
    setLoading(true)
    setStatus('Acquiring high-accuracy GPS fix…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        const isLowConfidence = pos.coords.accuracy > 5000
        onChange(pos.coords.latitude, pos.coords.longitude)
        setStatus(
          isLowConfidence
            ? `Approximate location set (±${Math.round(pos.coords.accuracy / 1000)}km) — search or refine below if needed.`
            : `GPS Coordinates locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        )
        if (isLowConfidence) setShowManual(true)
      },
      () => {
        setLoading(false)
        setStatus('Location permission denied. Please enter place name or coordinates below.')
        setShowManual(true)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handlePlaceSearch = async (e) => {
    e.preventDefault()
    if (!placeQuery.trim()) return
    setSearching(true)
    setPlaceResults([])
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeQuery)}&limit=5`,
        { headers: { Accept: 'application/json' } }
      )
      setPlaceResults(await res.json())
    } catch {
      setStatus('Could not search for that place right now.')
    } finally {
      setSearching(false)
    }
  }

  const handlePickPlace = (place) => {
    onChange(Number(place.lat), Number(place.lon))
    setStatus(`Selected: ${place.display_name.split(',').slice(0, 2).join(',')}`)
    setPlaceResults([])
    setPlaceQuery('')
    setShowManual(false)
  }

  const handleManualSave = (e) => {
    e.preventDefault()
    if (!manualLat || !manualLng) return
    onChange(Number(manualLat), Number(manualLng))
    setStatus(`Coordinates saved: ${Number(manualLat).toFixed(4)}, ${Number(manualLng).toFixed(4)}`)
    setShowManual(false)
  }

  const hasCoords = latitude != null && longitude != null

  return (
    <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseGPS}
            disabled={loading}
            className="btn-secondary text-xs sm:text-sm py-2 px-3.5 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 border-slate-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-leaf-600" />
                <span>Locating GPS…</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 text-leaf-600" />
                <span>Auto-Detect GPS for {label}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowManual((s) => !s)}
            className="text-xs font-semibold text-leaf-700 hover:text-leaf-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-leaf-50 transition"
          >
            <span>{showManual ? 'Hide search' : 'Search / Coordinates'}</span>
            {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {hasCoords && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
          </span>
        )}
      </div>

      {status && (
        <p className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {status}
        </p>
      )}

      {showManual && (
        <div className="mt-3 p-3.5 border border-slate-200 rounded-xl bg-white shadow-2xs space-y-3">
          <div>
            <label className="label text-[10px]">Search City / Market / Landmark</label>
            <form onSubmit={handlePlaceSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  className="input pl-9 text-xs"
                  placeholder="e.g. Surandai, Tenkasi, Tamil Nadu"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                />
              </div>
              <button
                className="btn-secondary text-xs px-3.5 py-2 whitespace-nowrap"
                type="submit"
                disabled={searching}
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </form>
          </div>

          {placeResults.length > 0 && (
            <ul className="text-xs divide-y border border-slate-100 rounded-xl max-h-40 overflow-y-auto bg-slate-50/50">
              {placeResults.map((p, idx) => (
                <li
                  key={idx}
                  className="p-2.5 hover:bg-emerald-50 hover:text-leaf-800 cursor-pointer flex items-center gap-2 transition"
                  onClick={() => handlePickPlace(p)}
                >
                  <MapPin className="w-3.5 h-3.5 text-leaf-600 shrink-0" />
                  <span className="truncate">{p.display_name}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-2 border-t border-slate-100">
            <p className="label text-[10px] mb-2">— Or Enter Coordinates Directly —</p>
            <form onSubmit={handleManualSave} className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Latitude</label>
                <input
                  className="input w-32 text-xs py-1.5"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 8.9754"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Longitude</label>
                <input
                  className="input w-32 text-xs py-1.5"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 77.4258"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <button className="btn-primary text-xs py-2 px-4" type="submit">
                Set Coordinates
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

