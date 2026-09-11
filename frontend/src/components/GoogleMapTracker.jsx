import React, { useEffect, useRef, useState, useCallback } from 'react'
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
  const markersRef = useRef([])
  const directionsRendererRef = useRef(null)
  const trafficLayerRef = useRef(null)

  const [mapLoaded, setMapLoaded] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [trafficActive, setTrafficActive] = useState(false)
  const [mapType, setMapType] = useState('roadmap')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const vehicleCoords = vehicle && vehicle.current_latitude != null && vehicle.current_longitude != null
    ? { lat: Number(vehicle.current_latitude), lng: Number(vehicle.current_longitude) }
    : null

  const pickupCoords = resolveCoord(pickupLocation, pickupLat, pickupLng)
  const destCoords = resolveCoord(destinationLocation, destinationLat, destinationLng)

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

  // 2. Initialize Google Map instance
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google?.maps) return

    const initialCenter = vehicleCoords || pickupCoords || destCoords || { lat: 8.9594, lng: 77.3167 }

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12,
        mapTypeId: mapType,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        zoomControl: true,
      })

      mapInstanceRef.current = map

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#059669', // Emerald green route
          strokeWeight: 5,
          strokeOpacity: 0.85,
        }
      })

      trafficLayerRef.current = new window.google.maps.TrafficLayer()
    }
  }, [mapLoaded])

  // 3. Render Markers & Driving Route
  const updateMapLayers = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return

    const map = mapInstanceRef.current

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // Marker A: Pickup Warehouse Hub
    if (pickupCoords) {
      const pickupMarker = new window.google.maps.Marker({
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
        label: {
          text: '🏭',
          fontSize: '14px',
        }
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
            <b style="color: #059669;">🏭 Pickup Warehouse Hub</b>
            <p style="margin: 2px 0 0; color: #1E293B;">${pickupLocation || 'District Central Hub'}</p>
          </div>
        `
      })
      pickupMarker.addListener('click', () => infoWindow.open(map, pickupMarker))
      markersRef.current.push(pickupMarker)
      bounds.extend(pickupCoords)
      hasPoints = true
    }

    // Marker B: Destination Address
    if (destCoords) {
      const destMarker = new window.google.maps.Marker({
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
        label: {
          text: '📍',
          fontSize: '14px',
        }
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
            <b style="color: #2563EB;">📍 Delivery Destination</b>
            <p style="margin: 2px 0 0; color: #1E293B;">${destinationLocation || 'Buyer Delivery Address'}</p>
          </div>
        `
      })
      destMarker.addListener('click', () => infoWindow.open(map, destMarker))
      markersRef.current.push(destMarker)
      bounds.extend(destCoords)
      hasPoints = true
    }

    // Marker C: Live Carrier / Vehicle Position
    if (vehicleCoords) {
      const isBike = (vehicle?.vehicle_type || '').toLowerCase().includes('bike')
      const vehicleMarker = new window.google.maps.Marker({
        position: vehicleCoords,
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
        label: {
          text: isBike ? '🛵' : '🚚',
          fontSize: '16px',
        }
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: sans-serif; font-size: 12px; padding: 6px;">
            <b style="color: #6D28D9; font-size: 13px;">${vehicle?.name || 'Assigned Transporter'}</b>
            <p style="margin: 2px 0; font-weight: 700; color: #1E293B;">${vehicle?.vehicle_number || ''}</p>
            <p style="margin: 2px 0; color: #64748B;">${vehicle?.vehicle_type || 'Vehicle'} · Capacity: ${vehicle?.capacity_kg ? Number(vehicle.capacity_kg) + ' kg' : ''}</p>
            <p style="margin: 4px 0 0; color: #059669; font-weight: 600;">● Live Telemetry: ${vehicle?.location_label || 'In Transit'}</p>
          </div>
        `
      })
      infoWindow.open(map, vehicleMarker)
      vehicleMarker.addListener('click', () => infoWindow.open(map, vehicleMarker))
      markersRef.current.push(vehicleMarker)
      bounds.extend(vehicleCoords)
      hasPoints = true
    }

    // Fit map bounds
    if (hasPoints) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
    }

    // 4. Calculate real road directions
    const origin = vehicleCoords || pickupCoords
    const destination = destCoords

    if (origin && destination && directionsRendererRef.current) {
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
  }, [vehicleCoords, pickupCoords, destCoords, vehicle, pickupLocation, destinationLocation])

  useEffect(() => {
    if (mapLoaded) {
      updateMapLayers()
    }
  }, [mapLoaded, updateMapLayers])

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
    if (vehicleCoords) {
      mapInstanceRef.current.panTo(vehicleCoords)
      mapInstanceRef.current.setZoom(14)
    } else if (pickupCoords) {
      mapInstanceRef.current.panTo(pickupCoords)
      mapInstanceRef.current.setZoom(13)
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
        {vehicleCoords && (
          <iframe
            title="OpenStreetMap Fallback"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${vehicleCoords.lng - 0.02}%2C${vehicleCoords.lat - 0.02}%2C${vehicleCoords.lng + 0.02}%2C${vehicleCoords.lat + 0.02}&layer=mapnik&marker=${vehicleCoords.lat}%2C${vehicleCoords.lng}`}
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
          title="Recenter on Carrier"
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