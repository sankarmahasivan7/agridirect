import React, { useEffect, useRef, useState, useMemo } from 'react'
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Layers, 
  Compass, 
  Maximize2, 
  Minimize2, 
  AlertTriangle,
  Clock,
  Gauge,
  ExternalLink
} from 'lucide-react'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyD08T4vwxMBN7_ij0T0_vUx0r9hMNb4EQA'

// Fallback regional coordinates for Southern Tamil Nadu towns & hubs
const DEFAULT_COORDS = {
  tenkasi: { lat: 8.9594, lng: 77.3167 },
  tirunelveli: { lat: 8.7139, lng: 77.7567 },
  thoothukudi: { lat: 8.7642, lng: 78.1348 },
  surandai: { lat: 8.9774, lng: 77.4262 },
  courtallam: { lat: 8.9304, lng: 77.2694 },
  alangulam: { lat: 8.8711, lng: 77.5020 },
  kadayanallur: { lat: 9.0768, lng: 77.3450 },
  sankarankovil: { lat: 9.1724, lng: 77.5325 },
  ambasamudram: { lat: 8.7058, lng: 77.4583 },
  palayamkottai: { lat: 8.7180, lng: 77.7420 },
  kovilpatti: { lat: 9.1742, lng: 77.8687 },
  valliyur: { lat: 8.3789, lng: 77.6133 },
  nanguneri: { lat: 8.4897, lng: 77.6586 },
}

function resolveCoord(name, lat, lng) {
  if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)) && Number(lat) !== 0) {
    return { lat: Number(lat), lng: Number(lng) }
  }
  if (!name) return null
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(DEFAULT_COORDS)) {
    if (lower.includes(k)) return v
  }
  return null
}

export default function GoogleMapTracker({
  vehicle,
  pickupLocation,
  pickupLat,
  pickupLng,
  destinationLocation,
  destinationLat,
  destinationLng,
  status,
  height = 440,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const trafficLayerRef = useRef(null)

  // Persistent marker references
  const pickupMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const vehicleMarkerRef = useRef(null)
  const destInfoWindowRef = useRef(null)
  const vehicleInfoWindowRef = useRef(null)

  const hasFittedBoundsRef = useRef(false)
  const lastRouteKeyRef = useRef('')

  const [mapLoaded, setMapLoaded] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [trafficActive, setTrafficActive] = useState(false)
  const [mapType, setMapType] = useState('roadmap')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Geocoded fallbacks if raw coordinates are missing
  const [geocodedDest, setGeocodedDest] = useState(null)
  const [geocodedPickup, setGeocodedPickup] = useState(null)

  // Static or resolved coordinates
  const vehCoords = useMemo(() => {
    if (vehicle && vehicle.current_latitude != null && vehicle.current_longitude != null) {
      const lat = Number(vehicle.current_latitude)
      const lng = Number(vehicle.current_longitude)
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
        return { lat, lng }
      }
    }
    return null
  }, [vehicle?.current_latitude, vehicle?.current_longitude])

  const initialPickupCoords = useMemo(() => {
    return resolveCoord(pickupLocation, pickupLat, pickupLng)
  }, [pickupLocation, pickupLat, pickupLng])

  const initialDestCoords = useMemo(() => {
    return resolveCoord(destinationLocation, destinationLat, destinationLng)
  }, [destinationLocation, destinationLat, destinationLng])

  // Load Google Maps script once
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true)
      return
    }

    const existingScript = document.getElementById('google-maps-script')
    if (existingScript) {
      existingScript.addEventListener('load', () => setMapLoaded(true))
      existingScript.addEventListener('error', () => setLoadError('Failed to load Google Maps script'))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry`
    script.async = true
    script.defer = true
    script.onload = () => setMapLoaded(true)
    script.onerror = () => setLoadError('Unable to connect to Google Maps API.')
    document.head.appendChild(script)
  }, [])

  // Geocode destination if missing GPS coordinates
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps || initialDestCoords || !destinationLocation) return

    const geocoder = new window.google.maps.Geocoder()
    const query = destinationLocation.toLowerCase().includes('tamil nadu')
      ? destinationLocation
      : `${destinationLocation}, Tamil Nadu, India`

    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location
        setGeocodedDest({ lat: loc.lat(), lng: loc.lng() })
      }
    })
  }, [mapLoaded, initialDestCoords, destinationLocation])

  // Geocode pickup if missing GPS coordinates
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps || initialPickupCoords || !pickupLocation) return

    const geocoder = new window.google.maps.Geocoder()
    const query = pickupLocation.toLowerCase().includes('tamil nadu')
      ? pickupLocation
      : `${pickupLocation}, Tamil Nadu, India`

    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location
        setGeocodedPickup({ lat: loc.lat(), lng: loc.lng() })
      }
    })
  }, [mapLoaded, initialPickupCoords, pickupLocation])

  const effectivePickupCoords = initialPickupCoords || geocodedPickup
  const effectiveDestCoords = initialDestCoords || geocodedDest

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google?.maps) return

    const initialCenter = vehCoords || effectiveDestCoords || effectivePickupCoords || { lat: 8.9594, lng: 77.3167 }

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12,
        mapTypeId: mapType,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative',
        maxZoom: 18,
        minZoom: 7,
      })

      mapInstanceRef.current = map

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: map,
        preserveViewport: true, // Prevents camera jumps!
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2563EB', // Clear highway blue route
          strokeWeight: 6,
          strokeOpacity: 0.85,
        }
      })

      trafficLayerRef.current = new window.google.maps.TrafficLayer()
    }
  }, [mapLoaded])

  // Update Markers & Route stably
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return

    const map = mapInstanceRef.current
    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // --- Marker A: Pickup Warehouse Hub ---
    if (effectivePickupCoords) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new window.google.maps.Marker({
          position: effectivePickupCoords,
          map: map,
          title: `Pickup: ${pickupLocation || 'Warehouse Hub'}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: '#10B981', // Emerald
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          },
          label: { text: '🏭', fontSize: '14px' }
        })
        const info = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <b style="color: #059669;">🏭 Pickup Warehouse Hub</b>
              <p style="margin: 2px 0 0; color: #1E293B; font-weight: 600;">${pickupLocation || 'District Central Hub'}</p>
            </div>
          `
        })
        pickupMarkerRef.current.addListener('click', () => info.open(map, pickupMarkerRef.current))
      } else {
        pickupMarkerRef.current.setPosition(effectivePickupCoords)
      }
      bounds.extend(effectivePickupCoords)
      hasPoints = true
    }

    // --- Marker B: Buyer Destination Address (Prominent & Labeled) ---
    if (effectiveDestCoords) {
      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${effectiveDestCoords.lat},${effectiveDestCoords.lng}`
      if (!destMarkerRef.current) {
        destMarkerRef.current = new window.google.maps.Marker({
          position: effectiveDestCoords,
          map: map,
          title: `Buyer Destination: ${destinationLocation || 'Customer Delivery'}`,
          zIndex: 998,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: '#DC2626', // High-visibility red pin for destination
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          },
          label: { text: '📍', fontSize: '16px' }
        })

        destInfoWindowRef.current = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 12px; padding: 6px; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
                <span style="background: #FEE2E2; color: #DC2626; font-weight: 800; font-size: 10px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">Destination Drop</span>
              </div>
              <b style="color: #0F172A; font-size: 13px;">${destinationLocation || 'Customer Doorstep'}</b>
              <div style="margin-top: 8px;">
                <a 
                  href="${navUrl}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style="display: inline-block; background: #2563EB; color: #FFFFFF; padding: 5px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; text-decoration: none;"
                >
                  🧭 Navigate in Google Maps &rarr;
                </a>
              </div>
            </div>
          `
        })

        destMarkerRef.current.addListener('click', () => {
          destInfoWindowRef.current.open(map, destMarkerRef.current)
        })

        // Open destination info window by default so the driver clearly sees the buyer location!
        destInfoWindowRef.current.open(map, destMarkerRef.current)
      } else {
        destMarkerRef.current.setPosition(effectiveDestCoords)
      }
      bounds.extend(effectiveDestCoords)
      hasPoints = true
    }

    // --- Marker C: Live Vehicle Position ---
    if (vehCoords) {
      const isBike = (vehicle?.vehicle_type || '').toLowerCase().includes('bike')
      if (!vehicleMarkerRef.current) {
        vehicleMarkerRef.current = new window.google.maps.Marker({
          position: vehCoords,
          map: map,
          title: `${vehicle?.name || 'Carrier'} (${vehicle?.vehicle_number || ''})`,
          zIndex: 999,
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 8,
            fillColor: '#7C3AED', // Purple
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5,
            rotation: 0,
          },
          label: { text: isBike ? '🛵' : '🚚', fontSize: '16px' }
        })

        vehicleInfoWindowRef.current = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 12px; padding: 6px;">
              <b style="color: #6D28D9; font-size: 13px;">${vehicle?.name || 'Assigned Carrier'}</b>
              <p style="margin: 2px 0; font-weight: 700; color: #1E293B;">${vehicle?.vehicle_number || ''}</p>
              <p style="margin: 2px 0; color: #64748B;">${vehicle?.vehicle_type || 'Vehicle'} · Capacity: ${vehicle?.capacity_kg ? Number(vehicle.capacity_kg) + ' kg' : ''}</p>
              <p style="margin: 4px 0 0; color: #059669; font-weight: 600;">● Live GPS: ${vehicle?.location_label || 'In Transit'}</p>
            </div>
          `
        })

        vehicleMarkerRef.current.addListener('click', () => {
          vehicleInfoWindowRef.current.open(map, vehicleMarkerRef.current)
        })
      } else {
        vehicleMarkerRef.current.setPosition(vehCoords)
      }
      bounds.extend(vehCoords)
      hasPoints = true
    }

    // Auto-fit bounds ONLY ONCE on initial load
    if (hasPoints && !hasFittedBoundsRef.current) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
      hasFittedBoundsRef.current = true
    }

    // Route calculation
    const origin = vehCoords || effectivePickupCoords
    const destination = effectiveDestCoords

    if (origin && destination && directionsRendererRef.current) {
      const routeKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`
      if (routeKey !== lastRouteKeyRef.current) {
        lastRouteKeyRef.current = routeKey
        const directionsService = new window.google.maps.DirectionsService()
        directionsService.route(
          {
            origin: origin,
            destination: destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, statusResult) => {
            if (statusResult === window.google.maps.DirectionsStatus.OK && result) {
              directionsRendererRef.current.setDirections(result)
              const leg = result.routes[0]?.legs[0]
              if (leg) {
                setRouteInfo({
                  distanceText: leg.distance.text,
                  durationText: leg.duration.text,
                  startAddress: leg.start_address,
                  endAddress: leg.end_address,
                })
              }
            }
          }
        )
      }
    }
  }, [mapLoaded, vehCoords, effectivePickupCoords, effectiveDestCoords, vehicle?.name, vehicle?.vehicle_number, vehicle?.location_label])

  const toggleTraffic = () => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return
    if (trafficActive) {
      trafficLayerRef.current.setMap(null)
      setTrafficActive(false)
    } else {
      trafficLayerRef.current.setMap(mapInstanceRef.current)
      setTrafficActive(true)
    }
  }

  const toggleMapType = () => {
    if (!mapInstanceRef.current) return
    const nextType = mapType === 'roadmap' ? 'satellite' : 'roadmap'
    mapInstanceRef.current.setMapTypeId(nextType)
    setMapType(nextType)
  }

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current

    if (vehCoords && effectiveDestCoords) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(vehCoords)
      bounds.extend(effectiveDestCoords)
      if (effectivePickupCoords) bounds.extend(effectivePickupCoords)
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
    } else if (vehCoords) {
      map.panTo(vehCoords)
      map.setZoom(14)
    } else if (effectiveDestCoords) {
      map.panTo(effectiveDestCoords)
      map.setZoom(14)
    } else if (effectivePickupCoords) {
      map.panTo(effectivePickupCoords)
      map.setZoom(13)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 relative" style={{ height }}>
        <div className="p-3.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Google Maps Notice: Showing OpenStreetMap Live View.
          </span>
        </div>
        {vehCoords && (
          <iframe
            title="OpenStreetMap Fallback"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${vehCoords.lng - 0.02}%2C${vehCoords.lat - 0.02}%2C${vehCoords.lng + 0.02}%2C${vehCoords.lat + 0.02}&layer=mapnik&marker=${vehCoords.lat}%2C${vehCoords.lng}`}
          />
        )}
      </div>
    )
  }

  const externalNavUrl = effectiveDestCoords 
    ? `https://www.google.com/maps/dir/?api=1&destination=${effectiveDestCoords.lat},${effectiveDestCoords.lng}`
    : null

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-soft bg-slate-100 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''}`} style={{ height: isFullscreen ? '100vh' : height }}>
      
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating HUD: Real-time Route, Distance & Buyer Destination Info */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 max-w-[85%] sm:max-w-md">
        {routeInfo && (
          <div className="flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200/80 text-xs font-semibold text-slate-800">
            <div className="flex items-center gap-1 text-emerald-700 font-extrabold">
              <Navigation className="w-3.5 h-3.5" />
              <span>Google Driving Route</span>
            </div>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-slate-500" />
              <b>{routeInfo.distanceText}</b>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1 text-purple-700">
              <Clock className="w-3.5 h-3.5" />
              <b>ETA: {routeInfo.durationText}</b>
            </span>
          </div>
        )}

        {/* Buyer Destination Callout Banner on the Map */}
        <div className="flex items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-xl shadow-md text-xs border border-slate-700">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-ping" />
            <span className="font-bold text-rose-300 shrink-0">Buyer Drop:</span>
            <span className="truncate text-slate-100 font-medium">{destinationLocation || 'Customer Location'}</span>
          </div>
          {externalNavUrl && (
            <a 
              href={externalNavUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg shadow-sm transition"
            >
              <span>GPS Nav</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Floating HUD Controls (Right) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          title="Fit Route & Recenter"
          className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md text-slate-700 hover:text-purple-600 shadow-md border border-slate-200/80 flex items-center justify-center transition active:scale-95"
        >
          <Compass className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleTraffic}
          title={trafficActive ? 'Hide Live Traffic' : 'Show Live Highway Traffic'}
          className={`w-9 h-9 rounded-xl backdrop-blur-md shadow-md border flex items-center justify-center transition active:scale-95 ${
            trafficActive 
              ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300' 
              : 'bg-white/95 text-slate-700 hover:text-emerald-700 border-slate-200/80'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleMapType}
          title="Toggle Satellite/Roadmap"
          className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md text-slate-700 hover:text-slate-900 shadow-md border border-slate-200/80 text-[11px] font-bold flex items-center justify-center transition active:scale-95"
        >
          {mapType === 'roadmap' ? 'SAT' : 'MAP'}
        </button>

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title="Toggle Fullscreen"
          className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md text-slate-700 hover:text-slate-900 shadow-md border border-slate-200/80 flex items-center justify-center transition active:scale-95"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom Status Legend */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between flex-wrap gap-2 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-slate-900/85 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[11px] shadow pointer-events-auto">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Pickup Hub
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" /> Carrier
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1 font-bold text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Buyer Destination
          </span>
        </div>

        <div className="bg-white/95 backdrop-blur-md text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-bold border border-slate-200/90 shadow pointer-events-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Google Maps Live Engine
        </div>
      </div>

    </div>
  )
}