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
  Gauge
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
}

function resolveCoord(name, lat, lng) {
  if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
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
  height = 420,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const trafficLayerRef = useRef(null)

  // Persistent marker references to avoid recreating / flickering
  const pickupMarkerRef = useRef(null)
  const destMarkerRef = useRef(null)
  const vehicleMarkerRef = useRef(null)
  const vehicleInfoWindowRef = useRef(null)

  // Track if we already did initial fit to prevent infinite auto-zoom jumping
  const hasFittedBoundsRef = useRef(false)
  const lastRouteKeyRef = useRef('')

  const [mapLoaded, setMapLoaded] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [trafficActive, setTrafficActive] = useState(false)
  const [mapType, setMapType] = useState('roadmap')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Stable coordinate objects
  const vehCoords = useMemo(() => {
    if (vehicle && vehicle.current_latitude != null && vehicle.current_longitude != null) {
      return { lat: Number(vehicle.current_latitude), lng: Number(vehicle.current_longitude) }
    }
    return null
  }, [vehicle?.current_latitude, vehicle?.current_longitude])

  const pickupCoords = useMemo(() => {
    return resolveCoord(pickupLocation, pickupLat, pickupLng)
  }, [pickupLocation, pickupLat, pickupLng])

  const destCoords = useMemo(() => {
    return resolveCoord(destinationLocation, destinationLat, destinationLng)
  }, [destinationLocation, destinationLat, destinationLng])

  // 1. Load Google Maps JS API script once
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

  // 2. Initialize Google Map instance once
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google?.maps) return

    const initialCenter = vehCoords || pickupCoords || destCoords || { lat: 8.9594, lng: 77.3167 }

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12,
        mapTypeId: mapType,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative', // smooth, non-glitchy scroll
        maxZoom: 18,
        minZoom: 7,
      })

      mapInstanceRef.current = map

      // IMPORTANT: preserveViewport: true prevents DirectionsRenderer from auto-zooming / jumping!
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: map,
        preserveViewport: true,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#059669', // Emerald green road route
          strokeWeight: 5,
          strokeOpacity: 0.85,
        }
      })

      trafficLayerRef.current = new window.google.maps.TrafficLayer()
    }
  }, [mapLoaded])

  // 3. Update Markers & Route stably
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return

    const map = mapInstanceRef.current
    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // --- Marker A: Pickup Hub ---
    if (pickupCoords) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new window.google.maps.Marker({
          position: pickupCoords,
          map: map,
          title: `Pickup: ${pickupLocation || 'Warehouse Hub'}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#10B981',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5,
          },
          label: { text: '🏭', fontSize: '14px' }
        })
        const info = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <b style="color: #059669;">🏭 Pickup Warehouse Hub</b>
              <p style="margin: 2px 0 0; color: #1E293B;">${pickupLocation || 'District Central Hub'}</p>
            </div>
          `
        })
        pickupMarkerRef.current.addListener('click', () => info.open(map, pickupMarkerRef.current))
      } else {
        pickupMarkerRef.current.setPosition(pickupCoords)
      }
      bounds.extend(pickupCoords)
      hasPoints = true
    }

    // --- Marker B: Destination Address ---
    if (destCoords) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new window.google.maps.Marker({
          position: destCoords,
          map: map,
          title: `Destination: ${destinationLocation || 'Customer Delivery'}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#3B82F6',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5,
          },
          label: { text: '📍', fontSize: '14px' }
        })
        const info = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <b style="color: #2563EB;">📍 Delivery Destination</b>
              <p style="margin: 2px 0 0; color: #1E293B;">${destinationLocation || 'Buyer Delivery Address'}</p>
            </div>
          `
        })
        destMarkerRef.current.addListener('click', () => info.open(map, destMarkerRef.current))
      } else {
        destMarkerRef.current.setPosition(destCoords)
      }
      bounds.extend(destCoords)
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
            scale: 7,
            fillColor: '#7C3AED',
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
              <b style="color: #6D28D9; font-size: 13px;">${vehicle?.name || 'Assigned Transporter'}</b>
              <p style="margin: 2px 0; font-weight: 700; color: #1E293B;">${vehicle?.vehicle_number || ''}</p>
              <p style="margin: 2px 0; color: #64748B;">${vehicle?.vehicle_type || 'Vehicle'} · Capacity: ${vehicle?.capacity_kg ? Number(vehicle.capacity_kg) + ' kg' : ''}</p>
              <p style="margin: 4px 0 0; color: #059669; font-weight: 600;">● Live Telemetry: ${vehicle?.location_label || 'In Transit'}</p>
            </div>
          `
        })

        vehicleMarkerRef.current.addListener('click', () => {
          vehicleInfoWindowRef.current.open(map, vehicleMarkerRef.current)
        })
      } else {
        vehicleMarkerRef.current.setPosition(vehCoords)
        // Update InfoWindow content without recreating
        if (vehicleInfoWindowRef.current) {
          vehicleInfoWindowRef.current.setContent(`
            <div style="font-family: sans-serif; font-size: 12px; padding: 6px;">
              <b style="color: #6D28D9; font-size: 13px;">${vehicle?.name || 'Assigned Transporter'}</b>
              <p style="margin: 2px 0; font-weight: 700; color: #1E293B;">${vehicle?.vehicle_number || ''}</p>
              <p style="margin: 2px 0; color: #64748B;">${vehicle?.vehicle_type || 'Vehicle'} · Capacity: ${vehicle?.capacity_kg ? Number(vehicle.capacity_kg) + ' kg' : ''}</p>
              <p style="margin: 4px 0 0; color: #059669; font-weight: 600;">● Live Telemetry: ${vehicle?.location_label || 'In Transit'}</p>
            </div>
          `)
        }
      }
      bounds.extend(vehCoords)
      hasPoints = true
    }

    // --- Auto-fit bounds ONLY ONCE on initial load ---
    if (hasPoints && !hasFittedBoundsRef.current) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
      hasFittedBoundsRef.current = true
    }

    // --- Directions Service: Only request route if origin or destination actually changed ---
    const origin = vehCoords || pickupCoords
    const destination = destCoords

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
  }, [mapLoaded, vehCoords, pickupCoords, destCoords, vehicle?.name, vehicle?.vehicle_number, vehicle?.location_label])

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

  // Recenter smoothly without jarring jumps
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current

    if (vehCoords && destCoords) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(vehCoords)
      bounds.extend(destCoords)
      if (pickupCoords) bounds.extend(pickupCoords)
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
    } else if (vehCoords) {
      map.panTo(vehCoords)
      map.setZoom(14)
    } else if (pickupCoords) {
      map.panTo(pickupCoords)
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

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-soft bg-slate-100 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''}`} style={{ height: isFullscreen ? '100vh' : height }}>
      
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating HUD: Real-time Route & ETA */}
      {routeInfo && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200/80 text-xs font-semibold text-slate-800">
          <div className="flex items-center gap-1 text-emerald-700 font-extrabold">
            <Navigation className="w-3.5 h-3.5" />
            <span>Google Live Route</span>
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
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Hub
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" /> Live Vehicle
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Destination
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