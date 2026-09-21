import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Edit3, 
  Compass, 
  ShieldCheck, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  Check,
  Package,
  Layers,
  IndianRupee,
  Building2,
  Box,
  Route,
} from 'lucide-react'
import { 
  availableTransportJobs,
  myTransportJobs,
  acceptTransportJob,
  updateTransportJobStatus,
  updateVehicleLocation,
  getOptimizedRoutes,
  getAiLogisticsPlans,
  explainAiRoute,
  availableBatches,
  myBatches,
  acceptBatch,
  updateBatchStatus,
} from '../../services/api.js'
import { useLanguage } from '../../context/LanguageContext.jsx'

const BATCH_STAGES = [
  { key: 'BATCH_CREATED', label: 'Created', desc: 'Orders Batched' },
  { key: 'TRANSPORTER_ASSIGNED', label: 'Assigned', desc: 'Driver Matched' },
  { key: 'ACCEPTED', label: 'Accepted', desc: 'Driver Claimed' },
  { key: 'READY_FOR_PICKUP', label: 'Ready', desc: 'Warehouses Staged' },
  { key: 'PICKED_UP', label: 'Picked Up', desc: 'Cargo Loaded' },
  { key: 'IN_TRANSIT', label: 'In Transit', desc: 'Highway Transit' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Last Mile Drops' },
  { key: 'DELIVERED', label: 'Delivered', desc: 'All Drops Done' },
]

function getBatchStageIndex(status) {
  const idx = BATCH_STAGES.findIndex((s) => s.key === status)
  return idx >= 0 ? idx : 0
}

const BATCH_NEXT_ACTIONS = {
  BATCH_CREATED: [
    { label: 'Accept Consolidated Batch', next: 'ACCEPTED', color: 'bg-indigo-600 hover:bg-indigo-500 text-white' },
  ],
  TRANSPORTER_ASSIGNED: [
    { label: 'Accept Consolidated Batch', next: 'ACCEPTED', color: 'bg-indigo-600 hover:bg-indigo-500 text-white' },
  ],
  ACCEPTED: [
    { label: 'Set Ready for Warehouse Pickups', next: 'READY_FOR_PICKUP', color: 'bg-sky-600 hover:bg-sky-500 text-white' },
  ],
  READY_FOR_PICKUP: [
    { label: 'Confirm Warehouses Picked Up', next: 'PICKED_UP', color: 'bg-blue-600 hover:bg-blue-500 text-white' },
  ],
  PICKED_UP: [
    { label: 'Start Transit to Destination District', next: 'IN_TRANSIT', color: 'bg-indigo-600 hover:bg-indigo-500 text-white' },
  ],
  IN_TRANSIT: [
    { label: 'Arrived at Delivery Area (Out for Delivery)', next: 'OUT_FOR_DELIVERY', color: 'bg-purple-600 hover:bg-purple-500 text-white' },
  ],
  OUT_FOR_DELIVERY: [
    { label: 'Mark All Deliveries Completed', next: 'DELIVERED', color: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
  ],
}

const DELIVERY_STEPS = [
  { key: 'PENDING', label: 'Pending', desc: 'Order Placed' },
  { key: 'ACCEPTED', label: 'Accepted', desc: 'Job Claimed' },
  { key: 'PICKUP', label: 'Pickup', desc: 'Farm Gate' },
  { key: 'IN_TRANSIT', label: 'In Transit', desc: 'En Route' },
  { key: 'DELIVERED', label: 'Delivered', desc: 'Delivered' },
]

function getStepIndex(status) {
  if (status === 'PENDING') return 0
  if (status === 'ACCEPTED' || status === 'ASSIGNED') return 1
  if (status === 'PICKUP') return 2
  if (status === 'IN_TRANSIT') return 3
  if (status === 'DELIVERED') return 4
  return 0
}

const NEXT_STATUS = {
  ACCEPTED: [
    { label: 'Pick Up from Supplier', value: 'PICKUP', icon: Play, primary: true },
    { label: 'Cancel', value: 'CANCELLED', icon: AlertCircle, primary: false },
  ],
  ASSIGNED: [
    { label: 'Pick Up from Supplier', value: 'PICKUP', icon: Play, primary: true },
    { label: 'Cancel', value: 'CANCELLED', icon: AlertCircle, primary: false },
  ],
  PICKUP: [
    { label: 'Start Trip (In Transit)', value: 'IN_TRANSIT', icon: Play, primary: true },
    { label: 'Cancel', value: 'CANCELLED', icon: AlertCircle, primary: false },
  ],
  IN_TRANSIT: [
    { label: 'Mark Delivered', value: 'DELIVERED', icon: Check, primary: true },
  ],
}

function earliestDeliveryTime(request) {
  if (!request.in_transit_at || request.estimated_transit_minutes == null) return null
  return new Date(new Date(request.in_transit_at).getTime() + request.estimated_transit_minutes * 60000)
}

function earliestBatchDeliveryTime(batch) {
  if (!batch.in_transit_at || batch.estimated_transit_minutes == null) return null
  return new Date(new Date(batch.in_transit_at).getTime() + batch.estimated_transit_minutes * 60000)
}

function DeliveryBatchCard({ batch, onAccept, onStatusChange, updatingId, isAvailable, isActive, isCompleted }) {
  const { t, isTamil } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const [stopOtps, setStopOtps] = useState({})
  const stageIdx = getBatchStageIndex(batch.status)
  const nextActions = BATCH_NEXT_ACTIONS[batch.status] || []
  const isUpdating = updatingId === batch.id

  const pickupStops = (batch.stops || []).filter((s) => s.stop_type === 'PICKUP')
  const deliveryStops = (batch.stops || []).filter((s) => s.stop_type === 'DELIVERY')

  const allBatchOtpsFilled = deliveryStops.length > 0
    ? deliveryStops.every(s => (stopOtps[s.order_id || s.id] || '').trim().length === 6)
    : true

  // Future Produce Availability & Warehouse Pickup Lock
  const todayStr = new Date().toISOString().split('T')[0]
  const isProduceFuture = Boolean(batch.earliest_available_date && batch.earliest_available_date > todayStr)
  const formattedBatchAvailDate = batch.earliest_available_date
    ? new Date(batch.earliest_available_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const shortBatchAvailDate = batch.earliest_available_date
    ? new Date(batch.earliest_available_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null

  // Warehouse pickup locked before harvest arrival
  const isPickupLocked = isProduceFuture && ['BATCH_CREATED', 'ACCEPTED', 'READY_FOR_PICKUP'].includes(batch.status)

  // Transit Duration Lock
  const batchEta = earliestBatchDeliveryTime(batch)
  const now = new Date()
  const isDeliveryLocked = (batch.status === 'IN_TRANSIT' || batch.status === 'OUT_FOR_DELIVERY') && Boolean(batchEta && now < batchEta)

  let remainingSeconds = 0
  if (isDeliveryLocked && batchEta) {
    remainingSeconds = Math.max(0, Math.ceil((batchEta.getTime() - now.getTime()) / 1000))
  }
  const remainingMins = Math.floor(remainingSeconds / 60)
  const remainingSecs = remainingSeconds % 60
  const timeFormatted = `${remainingMins}m ${remainingSecs < 10 ? '0' : ''}${remainingSecs}s`

  return (
    <div className="card p-5 border-2 border-indigo-100 bg-gradient-to-b from-white to-indigo-50/20 hover:shadow-lg transition-all rounded-2xl mb-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
            <Layers className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-base">{batch.batch_code}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                Consolidated Batch
              </span>
              {isProduceFuture && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-700" />
                  Produce Available {shortBatchAvailDate}
                </span>
              )}
              {Number(batch.total_quantity_kg) <= 50 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                  🛵 Bike (≤ 50 kg • Immediate)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  🚛 Truck (≥ 35% Min Fill)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Destination Area: <b className="text-indigo-900 font-bold">{batch.delivery_area}</b> &bull; Created {new Date(batch.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
            batch.status === 'DELIVERED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : batch.status === 'BATCH_CREATED'
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-sky-100 text-sky-800 border border-sky-200'
          }`}>
            {batch.status}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-white border border-slate-200 mb-3 text-center">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo Weight</p>
          <p className="text-base font-black text-slate-900">{Number(batch.total_quantity_kg).toFixed(1)} <span className="text-xs font-normal">kg</span></p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Orders</p>
          <p className="text-base font-black text-indigo-600">{batch.total_orders_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Delivery Drops</p>
          <p className="text-base font-black text-slate-900">{batch.total_customers_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Est. Distance</p>
          <p className="text-base font-black text-slate-900">~{Number(batch.estimated_distance_km || 0).toFixed(0)} <span className="text-xs font-normal">km</span></p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch Payout</p>
          <p className="text-base font-black text-emerald-600">₹{Number(batch.estimated_logistics_cost || 0).toFixed(0)}</p>
        </div>
      </div>

      {/* 8-Stage Progress Stepper (shown when active or completed) */}
      {(isActive || isCompleted) && (
        <div className="my-4 px-1">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-300"
              style={{ width: `${(stageIdx / (BATCH_STAGES.length - 1)) * 100}%` }}
            />
            {BATCH_STAGES.map((st, i) => {
              const isPassed = i <= stageIdx
              const isCurrent = i === stageIdx
              return (
                <div key={st.key} className="relative z-10 flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold border-2 transition-all ${
                    isPassed 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'bg-white border-slate-300 text-slate-400'
                  } ${isCurrent ? 'ring-4 ring-indigo-100 scale-110' : ''}`}>
                    {isPassed ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-[9px] mt-1 font-bold whitespace-nowrap hidden sm:block ${isCurrent ? 'text-indigo-900' : isPassed ? 'text-slate-700' : 'text-slate-400'}`}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Itinerary Summary */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-3 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Route className="w-4 h-4 text-indigo-600" />
            Consolidated Itinerary ({pickupStops.length} Warehouse Pickups &bull; {deliveryStops.length} Drops)
          </span>
          <button 
            onClick={() => setExpanded(!expanded)}
            className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {expanded ? 'Hide Details' : 'View Stops'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[10px]">PICKUPS</span>
            <span className="truncate">{pickupStops.map((p) => p.location_name).join(' \u2192 ') || 'Districts Central Warehouses'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px]">DROPS</span>
            <span>{deliveryStops.length} Customer drop destinations in {batch.delivery_area}</span>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
            <p className="font-bold text-slate-500 uppercase text-[10px]">Sequenced Stops:</p>
            <div className="divide-y divide-slate-100 text-xs">
              {(batch.stops || []).map((stop) => {
                const isDelivery = stop.stop_type === 'DELIVERY'
                const navUrl = stop.latitude && stop.longitude
                  ? `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`
                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.location_name + ', Tamil Nadu, India')}`

                return (
                  <div key={stop.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                        isDelivery ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {stop.sequence}
                      </span>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            isDelivery ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isDelivery ? 'Buyer Drop' : 'Warehouse Pickup'}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{stop.location_name}</span>
                        </div>
                        {stop.customer_name && <span className="text-[11px] text-slate-500">Customer: {stop.customer_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-slate-600">{Number(stop.cargo_kg)} kg</span>
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 transition"
                        title="Open stop destination in Google Maps"
                      >
                        <Navigation className="w-2.5 h-2.5" />
                        <span>Map</span>
                      </a>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stop.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {stop.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Produce Availability Notice for Warehouse Pickups */}
      {isPickupLocked && (
        <div className="rounded-xl p-3.5 text-xs mb-3 flex items-start gap-2.5 border bg-amber-50 border-amber-300 text-amber-950">
          <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-amber-900">
              Awaiting Farmer Deposit at District Central Warehouse Hub
            </p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              This batch contains scheduled produce available from <b>{formattedBatchAvailDate}</b>. You can accept and stage the batch in advance, but Central Warehouse pickup remains locked until <b>{formattedBatchAvailDate}</b> when the farmer arrives and deposits the harvest.
            </p>
          </div>
        </div>
      )}

      {/* Transit Distance & Duration Enforced Notice */}
      {batchEta && (
        <div
          className={`rounded-xl p-3.5 text-xs mb-3 flex items-start gap-2.5 border ${
            isDeliveryLocked
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
          <div>
            {isDeliveryLocked ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900">Highway Transit In Progress (Minimum Transit Time Enforced)</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                    Unlocks in {timeFormatted}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-700">
                  Estimated road distance: ~<b>{Number(batch.estimated_distance_km || 0).toFixed(0)} km</b> ({batch.estimated_transit_minutes || 0} mins). Earliest delivery timestamp: <b>{batchEta.toLocaleTimeString()}</b>. "Mark All Deliveries Completed" unlocks automatically when transit duration has elapsed.
                </p>
              </>
            ) : (
              <p className="font-semibold text-emerald-800">
                Estimated highway transit duration has elapsed. Consignment can now be marked delivered upon arrival at destinations.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Buyer Delivery OTP Verification Section */}
      {isActive && nextActions.some((act) => act.next === 'DELIVERED') && (
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 mb-3 text-xs">
          <div className="flex items-center gap-2 mb-2 font-bold text-indigo-950">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Buyer Delivery Verification (OTP Required)</span>
          </div>
          <p className="text-slate-600 mb-3 text-[11px]">
            To complete delivery, request the 6-digit verification code from each buyer upon arrival. The "Mark All Deliveries Completed" button will unlock once all customer OTPs are entered.
          </p>
          <div className="space-y-2">
            {deliveryStops.map((stop) => {
              const stopKey = stop.order_id || stop.id
              const curOtp = stopOtps[stopKey] || ''
              return (
                <div key={stop.id} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded-lg border border-indigo-100">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-xs truncate">
                      {stop.customer_name || 'Customer'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{stop.location_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={curOtp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setStopOtps((prev) => ({ ...prev, [stopKey]: val }))
                      }}
                      className="w-28 px-2.5 py-1 text-center font-mono font-bold tracking-widest text-xs border rounded-md border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/30"
                    />
                    {curOtp.length === 6 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-[10px] text-slate-400 shrink-0">6 digits</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {isAvailable && (
          <button
            onClick={() => onAccept(batch.id)}
            disabled={isUpdating}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-md disabled:opacity-50"
          >
            {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Claim Consolidated Batch ({Number(batch.total_quantity_kg).toFixed(0)} kg &bull; ₹{Number(batch.estimated_logistics_cost).toFixed(0)})
          </button>
        )}

        {isActive && nextActions.map((act) => {
          const isPickupAction = act.next === 'READY_FOR_PICKUP' || act.next === 'PICKED_UP'
          const isDeliveryAction = act.next === 'DELIVERED'
          const isOtpMissing = isDeliveryAction && !allBatchOtpsFilled
          const isActionLocked = (isPickupAction && isPickupLocked) || (isDeliveryAction && isDeliveryLocked) || isOtpMissing
          const disabled = isUpdating || isActionLocked

          let actionLabel = act.label
          if (isPickupAction && isPickupLocked) {
            actionLabel = `🔒 Warehouse Pickup Unlocks on ${shortBatchAvailDate}`
          } else if (isDeliveryAction && isDeliveryLocked) {
            actionLabel = `⏳ In Transit... (Unlocks in ${timeFormatted})`
          } else if (isDeliveryAction && isOtpMissing) {
            actionLabel = `🔒 Enter Buyer OTP to Complete Delivery`
          }

          const handleClick = () => {
            if (isDeliveryAction) {
              const combinedOtp = Object.values(stopOtps).join(',')
              onStatusChange(batch.id, act.next, combinedOtp)
            } else {
              onStatusChange(batch.id, act.next)
            }
          }

          return (
            <button
              key={act.next}
              onClick={handleClick}
              disabled={disabled}
              title={
                isPickupAction && isPickupLocked
                  ? `Produce has not been harvested/deposited yet. Warehouse pickup unlocks on ${formattedBatchAvailDate}.`
                  : isDeliveryAction && isDeliveryLocked
                  ? `Minimum transit duration enforced. Unlocks at ${batchEta.toLocaleTimeString()}`
                  : isDeliveryAction && isOtpMissing
                  ? 'Buyer OTP verification required before delivery can be marked completed.'
                  : undefined
              }
              className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                isActionLocked ? 'bg-slate-200 text-slate-500 border border-slate-300' : act.color
              }`}
            >
              {isUpdating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isPickupAction && isPickupLocked ? (
                <Clock className="w-3.5 h-3.5" />
              ) : isDeliveryAction && isDeliveryLocked ? (
                <Clock className="w-3.5 h-3.5 animate-pulse" />
              ) : isDeliveryAction && isOtpMissing ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {actionLabel}
            </button>
          )
        })}

        {isCompleted && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Delivered & Paid (₹{Number(batch.estimated_logistics_cost).toFixed(0)})
          </span>
        )}
      </div>
    </div>
  )
}

export default function TransporterDashboard() {
  const { t, isTamil } = useLanguage()
  const [activeTab, setActiveTab] = useState('ai_route') // 'ai_route' (Recommended) | 'available' | 'active' | 'completed'
  const [availableList, setAvailableList] = useState([])
  const [myJobsList, setMyJobsList] = useState([])
  const [availableBatchesList, setAvailableBatchesList] = useState([])
  const [myBatchesList, setMyBatchesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [locStatus, setLocStatus] = useState('')
  const [locLoading, setLocLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [jobOtps, setJobOtps] = useState({})

  // AI Optimized Route state
  const [routeOpt, setRouteOpt] = useState(null)
  const [routeOptLoading, setRouteOptLoading] = useState(false)
  const [aiPlans, setAiPlans] = useState(null)
  const [aiPlansLoading, setAiPlansLoading] = useState(false)
  const [planExplanations, setPlanExplanations] = useState({})
  const [explainingKey, setExplainingKey] = useState(null)

  const loadOptimizedRoutes = () => {
    setRouteOptLoading(true)
    setAiPlansLoading(true)
    Promise.all([
      getOptimizedRoutes().catch((err) => {
        console.error('getOptimizedRoutes error:', err)
        return { data: null }
      }),
      getAiLogisticsPlans().catch((err) => {
        console.error('getAiLogisticsPlans error:', err)
        return { data: null }
      }),
    ])
      .then(([optRes, planRes]) => {
        if (optRes.data) setRouteOpt(optRes.data)
        if (planRes.data) setAiPlans(planRes.data)
      })
      .finally(() => {
        setRouteOptLoading(false)
        setAiPlansLoading(false)
      })
  }

  const handleExplainPlan = async (plan, explicitKey) => {
    const key = explicitKey || plan.plan_code || `${plan.vehicle_name}-${plan.destination_area}`
    
    // Toggle: if already open, close it
    if (planExplanations[key]) {
      setPlanExplanations((prev) => {
        const copy = { ...prev }
        delete copy[key]
        return copy
      })
      return
    }

    setExplainingKey(key)
    try {
      const res = await explainAiRoute({ route_plan: plan })
      if (res.data?.explanation) {
        setPlanExplanations((prev) => ({ ...prev, [key]: res.data.explanation }))
      } else {
        throw new Error('Empty AI explanation response')
      }
    } catch (err) {
      console.warn('Backend explain endpoint fallback:', err)
      const isBike = plan.vehicle_category === 'Bike'
      const stops = plan.stops || []
      const pickupCount = stops.filter((s) => s.stop_type === 'PICKUP').length
      const dropCount = stops.filter((s) => s.stop_type === 'DELIVERY').length
      const fallback = isBike
        ? `AI Logistics Decision: Assigned ${plan.vehicle_name} (Bike) because total cargo is ${plan.cargo_weight_kg} kg (within the 50 kg bike payload limit). Bikes dispatch immediately without waiting for a 35% truck fill threshold, fulfilling ${plan.total_orders_count} orders over ~${plan.estimated_road_distance_km} km.`
        : (plan.dispatch_eligible
            ? `AI Logistics Decision: Combined ${plan.total_orders_count} orders into ${plan.vehicle_name}. Cargo of ${plan.cargo_weight_kg} kg achieves ${plan.fill_percentage}% capacity fill (meets ≥35% threshold). Sequenced ${pickupCount} warehouse pickup(s) and ${dropCount} delivery drops to optimize road distance.`
            : `AI Logistics Decision: Consolidated ${plan.total_orders_count} orders (${plan.cargo_weight_kg} kg) for ${plan.vehicle_name}. Fill level is ${plan.fill_percentage}%, which is below the mandatory 35% dispatch threshold (${plan.minimum_dispatch_kg} kg). Consignment is held to combine with incoming orders in ${plan.destination_area} to prevent fuel waste.`)
      setPlanExplanations((prev) => ({
        ...prev,
        [key]: fallback,
      }))
    } finally {
      setExplainingKey(null)
    }
  }

  // Manual override / place-search fallback state
  const [showManual, setShowManual] = useState(false)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState([])
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [searching, setSearching] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      availableTransportJobs().catch(() => ({ data: [] })),
      myTransportJobs().catch(() => ({ data: [] })),
      availableBatches().catch(() => ({ data: [] })),
      myBatches().catch(() => ({ data: [] })),
    ])
      .then(([availRes, myRes, availBatchRes, myBatchRes]) => {
        setAvailableList(availRes.data || [])
        setMyJobsList(myRes.data || [])
        setAvailableBatchesList(availBatchRes.data || [])
        setMyBatchesList(myBatchRes.data || [])
      })
      .catch((err) => {
        console.error(err)
        setError('Could not load transport consignments.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    loadOptimizedRoutes()
  }, [])

  // Re-render every 1s so the "Mark Delivered" button and countdown timer update smoothly
  const [, forceTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleAccept = async (id) => {
    setError('')
    setSuccessMsg('')
    setUpdatingId(id)
    try {
      await acceptTransportJob(id)
      setSuccessMsg(`Consignment #${id} accepted! It is now under Active Consignments.`)
      load()
      setActiveTab('active')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not accept transport job.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleStatusChange = async (id, newStatus, otp = null) => {
    if (newStatus === 'CANCELLED') {
      const confirmCancel = window.confirm('Are you sure you want to cancel this consignment? It will be removed from your active deliveries.')
      if (!confirmCancel) return
    }
    setError('')
    setSuccessMsg('')
    setUpdatingId(id)
    try {
      await updateTransportJobStatus(id, newStatus, otp)
      setSuccessMsg(`Consignment #${id} updated to ${newStatus}.`)
      load()
      loadOptimizedRoutes()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const saveLocation = async (latitude, longitude, label) => {
    try {
      await updateVehicleLocation({ latitude, longitude, location_label: label })
      setLocStatus(`GPS broadcasted: ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)} (${label})`)
    } catch (err) {
      setLocStatus('Could not save location to the server.')
    }
  }

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Your browser does not support location sharing.')
      return
    }
    setLocLoading(true)
    setLocStatus('Accessing device GPS coordinates...')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocLoading(false)
        const isLowConfidence = pos.coords.accuracy > 5000
        await saveLocation(
          pos.coords.latitude, pos.coords.longitude,
          isLowConfidence ? `Approximate (±${Math.round(pos.coords.accuracy / 1000)}km, low confidence)` : 'Live GPS fix'
        )
        if (isLowConfidence) {
          setShowManual(true)
        }
      },
      () => {
        setLocLoading(false)
        setLocStatus('Location permission denied.')
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
      const data = await res.json()
      setPlaceResults(data)
    } catch (err) {
      setLocStatus('Could not search for that place right now.')
    } finally {
      setSearching(false)
    }
  }

  const handlePickPlace = async (place) => {
    await saveLocation(place.lat, place.lon, place.display_name.split(',').slice(0, 2).join(','))
    setPlaceResults([])
    setPlaceQuery('')
    setShowManual(false)
  }

  const handleManualSave = async (e) => {
    e.preventDefault()
    if (!manualLat || !manualLng) return
    await saveLocation(Number(manualLat), Number(manualLng), 'Manually entered')
    setShowManual(false)
  }

  const handleAcceptBatch = async (batchId) => {
    setError('')
    setSuccessMsg('')
    setUpdatingId(batchId)
    try {
      await acceptBatch(batchId)
      setSuccessMsg(`Consolidated Batch claimed successfully! Moved to Active Consignments.`)
      load()
      setActiveTab('active')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not claim delivery batch.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleBatchStatusChange = async (batchId, nextStatus, otp = null) => {
    if (nextStatus === 'CANCELLED') {
      const confirmCancel = window.confirm('Are you sure you want to cancel this batch? It will be removed from your active deliveries.')
      if (!confirmCancel) return
    }
    setError('')
    setSuccessMsg('')
    setUpdatingId(batchId)
    try {
      await updateBatchStatus(batchId, nextStatus, otp)
      setSuccessMsg(`Consolidated Batch transitioned to ${nextStatus}.`)
      load()
      loadOptimizedRoutes()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update batch status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const activeBatches = myBatchesList.filter((b) => b.status !== 'DELIVERED' && b.status !== 'CANCELLED')
  const completedBatches = myBatchesList.filter((b) => b.status === 'DELIVERED')

  const activeJobs = myJobsList.filter((r) => r.status !== 'DELIVERED' && r.status !== 'CANCELLED')
  const completedJobs = myJobsList.filter((r) => r.status === 'DELIVERED')

  const batchEarnings = completedBatches.reduce((acc, b) => acc + (Number(b.estimated_logistics_cost) || 0), 0)
  const totalEarnings = completedJobs.reduce((acc, r) => acc + (Number(r.logistics_cost) || 0), 0) + batchEarnings

  const renderStrategyBadge = (req) => {
    if (req.logistics_strategy === 'warehouse') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-semibold">
          <Building2 className="w-3.5 h-3.5 text-teal-600" />
          {req.hub_name || 'District Warehouse Dispatch'}
        </span>
      )
    }
    if (req.logistics_strategy === 'aggregation_hub') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold">
          <Building2 className="w-3.5 h-3.5 text-purple-600" />
          {req.hub_name || 'Aggregation Transit Hub (>80km)'}
        </span>
      )
    }
    if (req.logistics_strategy === 'consolidated') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
          <Layers className="w-3.5 h-3.5 text-emerald-600" />
          Consolidated Delivery (-20% Fee)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-xs font-semibold">
        <Truck className="w-3.5 h-3.5 text-sky-600" />
        Direct Farm-to-Buyer
      </span>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 mb-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-700/50 text-sky-200 text-xs font-semibold mb-3 border border-sky-600/50">
              <Compass className="w-3.5 h-3.5 text-sky-300" />
              {t('transporter.dashboardTitle', 'Fleet & Dispatch Command')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display">{t('transporter.dashboardTitle', 'Transporter Fleet Hub')}</h1>
            <p className="text-sky-200 text-sm mt-1 max-w-xl">
              {t('transporter.dashboardSubtitle', 'Accept real farm crop delivery jobs, track consignment stages, and broadcast live GPS coordinates to buyers and sellers.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleShareLocation}
              disabled={locLoading}
              className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4 shadow-lg shadow-leaf-950/20"
            >
              <MapPin className={`w-4 h-4 ${locLoading ? 'animate-bounce' : ''}`} />
              {locLoading ? t('common.loading', 'Loading...') : t('transporter.trackGps', 'Broadcast Live GPS')}
            </button>
            <button
              onClick={() => setShowManual(!showManual)}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20"
            >
              {showManual ? t('common.close', 'Close Manual') : t('common.edit', 'Manual GPS / Town')}
            </button>
          </div>
        </div>
      </div>

      {/* GPS Status Toast */}
      {locStatus && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-sky-600 animate-pulse" />
          <span>{locStatus}</span>
        </div>
      )}

      {/* Manual Geolocation Fallback Box */}
      {showManual && (
        <div className="card p-5 border border-sky-200 bg-sky-50/40 rounded-2xl mb-6 text-slate-800 animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-600" />
              Set Vehicle Location Manually (OpenStreetMap Search)
            </h3>
            <span className="text-[11px] text-slate-500">Free, no Google API key required</span>
          </div>

          <form onSubmit={handlePlaceSearch} className="flex gap-2 mb-3">
            <input
              className="input flex-1"
              placeholder="e.g. Tenkasi, Tamil Nadu"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
            />
            <button className="btn-secondary text-sm whitespace-nowrap" type="submit" disabled={searching}>
              {searching ? t('common.loading', 'Searching...') : t('common.search', 'Search Town')}
            </button>
          </form>

          {placeResults.length > 0 && (
            <ul className="text-xs divide-y border border-gray-200 rounded-xl bg-white mb-4 overflow-hidden shadow-sm">
              {placeResults.map((p, idx) => (
                <li
                  key={idx}
                  className="p-3 hover:bg-sky-50 cursor-pointer flex items-center justify-between text-gray-700"
                  onClick={() => handlePickPlace(p)}
                >
                  <span className="truncate pr-2">{p.display_name}</span>
                  <span className="text-[11px] font-bold text-sky-700 shrink-0">Select</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-3 border-t border-sky-200/60">
            <p className="text-xs text-gray-500 mb-2">— Or enter numerical coordinates directly —</p>
            <form onSubmit={handleManualSave} className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="label text-xs">Latitude</label>
                <input
                  className="input w-36 text-xs"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 8.9500"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Longitude</label>
                <input
                  className="input w-36 text-xs"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 77.3167"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <button className="btn-primary text-xs py-2.5 px-4" type="submit">
                {t('common.save', 'Save Coordinates')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl p-4 mb-6 flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
          <p className="text-xs font-semibold">{successMsg}</p>
        </div>
      )}

      {/* Dashboard KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('transporter.tabAvailableJobs', 'Available Jobs')}</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              <Box className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{availableBatchesList.length + availableList.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {availableBatchesList.length} batched consignments &bull; {availableList.length} direct jobs
          </p>
        </div>

        <div className="card p-4 border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('shipments.activeTrips', 'Active Shipments')}</span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{activeBatches.length + activeJobs.length}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {activeBatches.length} active batches &bull; {activeJobs.length} active trips
          </p>
        </div>

        <div className="card p-4 border border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('transporter.tabCompletedTrips', 'Completed Deliveries')}</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">₹{totalEarnings.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {completedBatches.length} completed batches &bull; {completedJobs.length} direct orders
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('ai_route')
              loadOptimizedRoutes()
            }}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'ai_route'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            {t('transporter.tabRouteOpt', 'AI Optimized Routes')}
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-extrabold uppercase">
              Recommended Trip
            </span>
            {aiPlans?.dispatch_plans?.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-black">
                {aiPlans.dispatch_plans.length} Ready
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('available')}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'available'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Box className="w-4 h-4" />
            {t('transporter.tabAvailableBatches', 'Available Consignments')}
            {availableBatchesList.length + availableList.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-extrabold">
                {availableBatchesList.length + availableList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'active'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            {t('transporter.tabActiveTrips', 'Active Consignments')}
            {activeBatches.length + activeJobs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-800 font-extrabold">
                {activeBatches.length + activeJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'completed'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('transporter.tabCompletedTrips', 'Completed Deliveries')}
            <span className="text-xs text-slate-400">({completedBatches.length + completedJobs.length})</span>
          </button>
        </div>

        <button
          onClick={load}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold pb-3"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Tab 1: Available Transport Jobs */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="card p-6 animate-pulse space-y-4">
                  <div className="h-5 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-12 bg-slate-100 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : (availableBatchesList.length === 0 && availableList.length === 0) ? (
            <div className="card text-center py-16 px-4">
              <div className="w-16 h-16 bg-sky-50 text-sky-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Box className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{t('transporter.noJobs', 'No Available Jobs at the Moment')}</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                {t('transporter.noJobsDesc', 'There are no pending hub or farm pickups available right now. Check back soon or pull down to refresh.')}
              </p>
            </div>
          ) : (
            <>
              {/* Consolidated Batches Section */}
              {availableBatchesList.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-extrabold text-slate-900 text-base">Consolidated Multi-Order Delivery Batches</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-black">
                        {availableBatchesList.length} Batches Ready
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Multi-warehouse sequenced pickups</span>
                  </div>
                  {availableBatchesList.map((batch) => (
                    <DeliveryBatchCard
                      key={batch.id}
                      batch={batch}
                      isAvailable={true}
                      onAccept={handleAcceptBatch}
                      updatingId={updatingId}
                    />
                  ))}
                </div>
              )}

              {/* Individual Transport Jobs */}
              {availableList.length > 0 && (
                <div className="space-y-4">
                  {availableBatchesList.length > 0 && (
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">
                      Direct Single-Order Transport Jobs
                    </h4>
                  )}
                  {availableList.map((r) => (
                    <div key={r.id} className="card p-6 border border-slate-200 hover:shadow-md transition">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-sm">
                      #{r.id}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">Consignment Job #{r.id}</p>
                        {r.order_id && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            Order #{r.order_id}
                          </span>
                        )}
                        {r.available_from && r.available_from > new Date().toISOString().split('T')[0] && (
                          <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-700" />
                            Produce Available {new Date(r.available_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Cargo Weight: <b className="text-gray-800">{Number(r.weight_kg)} kg</b>
                        {r.vehicle_capacity_kg && (
                          <span className="ml-2">| Capacity Req: <b className="text-gray-800">{Number(r.vehicle_capacity_kg)} kg</b></span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderStrategyBadge(r)}
                    <span className="badge-actual">{r.status}</span>
                  </div>
                </div>

                {/* Route details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 text-xs">
                  <div>
                    <span className="text-gray-400 block mb-0.5">Pickup Location (District Warehouse)</span>
                    <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-leaf-600 shrink-0" />
                      {r.pickup_location}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Delivery Destination (Buyer)</span>
                    <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                      {r.destination_location}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Estimated Road Distance</span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-slate-400" />
                      {r.distance_km ? `${Number(r.distance_km).toFixed(1)} km` : 'Local delivery'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Delivery Target Date</span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(r.required_by).toLocaleDateString()}
                    </span>
                  </div>
                  {r.notes && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-400 block mb-0.5">Cargo Manifest</span>
                      <span className="text-gray-700 italic">{r.notes}</span>
                    </div>
                  )}
                </div>

                {/* Footer: Fee & Accept Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">Logistics Fee:</span>
                    <span className="text-lg font-black text-slate-900 flex items-center text-leaf-700">
                      ₹{r.logistics_cost ? Number(r.logistics_cost).toFixed(2) : '30.00'}
                    </span>
                    <span className="text-[11px] text-slate-400">(Configured formula)</span>
                  </div>

                  <button
                    onClick={() => handleAccept(r.id)}
                    disabled={updatingId === r.id}
                    className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {updatingId === r.id ? 'Accepting...' : 'Accept Consignment'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)}

      {/* Tab 2: Active Consignments */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {loading ? (
            <div className="card p-6 animate-pulse space-y-4">
              <div className="h-5 bg-slate-200 rounded w-1/4"></div>
              <div className="h-12 bg-slate-100 rounded"></div>
            </div>
          ) : (activeBatches.length === 0 && activeJobs.length === 0) ? (
            <div className="card text-center py-16 px-4">
              <div className="w-16 h-16 bg-sky-50 text-sky-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{t('transporter.noConsignments', 'No Active Consignments')}</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                {t('transporter.noConsignmentsDesc', 'You do not have any trips in progress. Accept an available job to start delivering.')}
              </p>
            </div>
          ) : (
            <>
              {/* Active Batches Section */}
              {activeBatches.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-extrabold text-slate-900 text-base">Active Consolidated Batches</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-black">
                        {activeBatches.length} In Progress
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">8-Stage Multi-Warehouse Execution</span>
                  </div>
                  {activeBatches.map((batch) => (
                    <DeliveryBatchCard
                      key={batch.id}
                      batch={batch}
                      isActive={true}
                      onStatusChange={handleBatchStatusChange}
                      updatingId={updatingId}
                    />
                  ))}
                </div>
              )}

              {/* Individual Active Shipments */}
              {activeJobs.length > 0 && (
                <div className="space-y-4">
                  {activeBatches.length > 0 && (
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">
                      Direct Single-Order Active Trips
                    </h4>
                  )}
                  {activeJobs.map((r) => {
                    const actions = NEXT_STATUS[r.status] || []
                    const eta = earliestDeliveryTime(r)
                    const now = new Date()
                    const deliveryLocked = r.status === 'IN_TRANSIT' && Boolean(eta && now < eta)
                    const curStepIndex = getStepIndex(r.status)

                    // Produce availability & warehouse pickup lock
                    const todayStr = new Date().toISOString().split('T')[0]
                    const isReqFuture = Boolean(r.available_from && r.available_from > todayStr)
                    const formattedReqAvailDate = r.available_from
                      ? new Date(r.available_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : null
                    const shortReqAvailDate = r.available_from
                      ? new Date(r.available_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : null
                    const isPickupLocked = isReqFuture && (r.status === 'PENDING' || r.status === 'ACCEPTED' || r.status === 'ASSIGNED')

                    let remainingSecs = 0
                    if (deliveryLocked && eta) {
                      remainingSecs = Math.max(0, Math.ceil((eta.getTime() - now.getTime()) / 1000))
                    }
                    const remMins = Math.floor(remainingSecs / 60)
                    const remSec = remainingSecs % 60
                    const jobTimeFormatted = `${remMins}m ${remSec < 10 ? '0' : ''}${remSec}s`

                    return (
                      <div key={r.id} className="card p-6 border border-slate-200 hover:shadow-md transition">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-black text-sm">
                              #{r.id}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900">Active Consignment #{r.id}</p>
                                {r.order_id && (
                                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                    Order #{r.order_id}
                                  </span>
                                )}
                                {isReqFuture && (
                                  <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-700" />
                                    Produce Available {shortReqAvailDate}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                Weight: <b className="text-gray-800">{Number(r.weight_kg)} kg</b>
                                <span className="ml-2">| Fee: <b className="text-leaf-700">₹{Number(r.logistics_cost || 30).toFixed(2)}</b></span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderStrategyBadge(r)}
                            <Link
                              to={`/transport/track/${r.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition"
                            >
                              <MapPin className="w-3.5 h-3.5 text-rose-600" />
                              <span>Live Map & Buyer Drop</span>
                              <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
                            </Link>
                          </div>
                        </div>

                        {/* 5-Stage Stepper: PENDING -> ACCEPTED -> PICKUP -> IN_TRANSIT -> DELIVERED */}
                        <div className="my-5 px-2">
                          <div className="flex items-center justify-between relative">
                            <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0" />
                            <div 
                              className="absolute top-1/2 left-0 h-1 bg-sky-600 -translate-y-1/2 z-0 transition-all duration-300"
                              style={{ width: `${(curStepIndex / 4) * 100}%` }}
                            />
                            {DELIVERY_STEPS.map((step, idx) => {
                              const isDone = idx < curStepIndex
                              const isCurrent = idx === curStepIndex
                              return (
                                <div key={step.key} className="relative z-10 flex flex-col items-center">
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                                      isDone
                                        ? 'bg-sky-600 text-white shadow'
                                        : isCurrent
                                        ? 'bg-sky-500 text-white ring-4 ring-sky-100'
                                        : 'bg-white border-2 border-slate-300 text-slate-400'
                                    }`}
                                  >
                                    {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                  </div>
                                  <span className={`text-[11px] mt-1 font-bold ${isCurrent ? 'text-sky-800' : isDone ? 'text-slate-700' : 'text-slate-400'}`}>
                                    {step.label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Route Card */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100 mb-4 text-xs">
                          <div>
                            <span className="text-gray-400 block mb-0.5">Pickup Location (District Warehouse)</span>
                            <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-leaf-600 shrink-0" />
                              {r.pickup_location}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white rounded-lg border border-rose-100 shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-extrabold uppercase text-rose-600 tracking-wide">Buyer Drop Destination</span>
                              <Link
                                to={`/transport/track/${r.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800"
                              >
                                <span>Open Live Map</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                              {r.destination_location}
                            </span>
                          </div>
                        </div>

                        {/* Produce Availability Pickup Lock Notice */}
                        {isPickupLocked && (
                          <div className="rounded-xl p-3.5 text-xs mb-4 flex items-start gap-2.5 border bg-amber-50 border-amber-300 text-amber-950">
                            <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-amber-900">Awaiting Farmer Harvest Deposit at Warehouse</p>
                              <p className="mt-0.5 text-amber-800">
                                Produce is scheduled for harvest on <b>{formattedReqAvailDate}</b>. Transporter warehouse pickup unlocks on that date once the farmer deposits the harvest.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Distance-based Lock Warning */}
                        {eta && (
                          <div
                            className={`rounded-xl p-3.5 text-xs mb-4 flex items-start gap-2.5 border ${
                              deliveryLocked
                                ? 'bg-amber-50 border-amber-300 text-amber-950'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            }`}
                          >
                            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
                            <div>
                              {deliveryLocked ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold">Minimum Transit Time Enforced</p>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800">
                                      Unlocks in {jobTimeFormatted}
                                    </span>
                                  </div>
                                  <p className="mt-0.5">
                                    Earliest delivery timestamp: <b>{eta.toLocaleString()}</b> (calculated from road distance). 'Mark Delivered' unlocks once transit time elapses.
                                  </p>
                                </>
                              ) : (
                                <p className="font-semibold">
                                  Estimated transit duration has elapsed. Consignment can now be marked delivered upon arrival.
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Buyer Delivery OTP Verification Section */}
                        {actions.some((a) => a.value === 'DELIVERED') && (
                          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 mb-4 text-xs">
                            <div className="flex items-center gap-2 mb-1.5 font-bold text-indigo-950">
                              <ShieldCheck className="w-4 h-4 text-indigo-600" />
                              <span>Buyer Delivery Verification (OTP Required)</span>
                            </div>
                            <p className="text-slate-600 mb-2.5 text-[11px]">
                              Ask the buyer at the destination for their 6-digit delivery OTP. The "Mark Delivered" button is locked until you enter the matching OTP.
                            </p>
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-digit OTP"
                                value={jobOtps[r.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                                  setJobOtps((prev) => ({ ...prev, [r.id]: val }))
                                }}
                                className="w-40 px-3 py-1.5 text-center font-mono font-bold tracking-widest text-sm border rounded-lg border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              />
                              {(jobOtps[r.id] || '').length === 6 ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-1 rounded-md">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Deliver
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-medium">6 digits required to unlock</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {actions.length > 0 && (
                          <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-100">
                            {actions.map((a) => {
                              const isPickupAction = a.value === 'PICKUP'
                              const isDeliveredAction = a.value === 'DELIVERED'
                              const isOtpMissing = isDeliveredAction && (jobOtps[r.id] || '').trim().length !== 6
                              const actionLocked = (isPickupAction && isPickupLocked) || (isDeliveredAction && deliveryLocked) || isOtpMissing
                              const disabled = updatingId === r.id || actionLocked
                              const Icon = a.icon || Play

                              let btnLabel = a.label
                              if (isPickupAction && isPickupLocked) {
                                btnLabel = `🔒 Warehouse Pickup Unlocks on ${shortReqAvailDate}`
                              } else if (isDeliveredAction && deliveryLocked) {
                                btnLabel = `⏳ In Transit... (Unlocks in ${jobTimeFormatted})`
                              } else if (isDeliveredAction && isOtpMissing) {
                                btnLabel = `🔒 Enter Buyer OTP to Unlock`
                              }

                              return (
                                <button
                                  key={a.value}
                                  disabled={disabled}
                                  title={
                                    isPickupAction && isPickupLocked
                                      ? `Produce not yet deposited by farmer. Pickup unlocks on ${formattedReqAvailDate}.`
                                      : isDeliveredAction && deliveryLocked
                                      ? `Available after ${eta.toLocaleTimeString()}`
                                      : isDeliveredAction && isOtpMissing
                                      ? 'Enter the 6-digit OTP provided by the buyer to unlock delivery.'
                                      : undefined
                                  }
                                  onClick={() => handleStatusChange(r.id, a.value, isDeliveredAction ? (jobOtps[r.id] || '').trim() : null)}
                                  className={
                                    a.value === 'CANCELLED'
                                      ? 'text-red-600 text-xs font-semibold px-4 py-2 hover:bg-red-50 rounded-xl transition disabled:opacity-40'
                                      : actionLocked
                                      ? 'bg-slate-200 text-slate-500 border border-slate-300 text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold'
                                      : a.primary
                                      ? 'btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
                                      : 'btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
                                  }
                                >
                                  {isDeliveredAction && isOtpMissing ? (
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <Icon className={`w-3.5 h-3.5 ${isDeliveredAction && deliveryLocked ? 'animate-pulse' : ''}`} />
                                  )}
                                  {updatingId === r.id ? 'Updating...' : btnLabel}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
          </div>
        )}
      </>
    )}
  </div>
)}

      {/* Tab 3: Completed Deliveries */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {(completedBatches.length === 0 && completedJobs.length === 0) ? (
            <div className="card text-center py-16 px-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{t('transporter.noCompleted', 'No Completed Deliveries Yet')}</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                {t('transporter.noCompletedDesc', 'Deliveries completed by your fleet will be archived here for payout reconciliation.')}
              </p>
            </div>
          ) : (
            <>
              {/* Completed Batches */}
              {completedBatches.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-2 pb-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-extrabold text-slate-900 text-base">Completed Batches</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-black">
                      {completedBatches.length} Delivered
                    </span>
                  </div>
                  {completedBatches.map((batch) => (
                    <DeliveryBatchCard
                      key={batch.id}
                      batch={batch}
                      isCompleted={true}
                    />
                  ))}
                </div>
              )}

              {/* Individual Completed Jobs */}
              {completedJobs.length > 0 && (
                <div className="space-y-4">
                  {completedBatches.length > 0 && (
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2">
                      Direct Single-Order Completed Deliveries
                    </h4>
                  )}
                  {completedJobs.map((r) => (
                    <div key={r.id} className="card p-5 border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-sm">
                      #{r.id}
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">Consignment #{r.id} Delivered</p>
                      <p className="text-xs text-gray-400">Order #{r.order_id} | {Number(r.weight_kg)} kg</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-leaf-700">
                      +₹{Number(r.logistics_cost || 30).toFixed(2)}
                    </span>
                    <span className="badge-actual bg-emerald-50 text-emerald-700 border-emerald-200">
                      DELIVERED
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400">From:</span> {r.pickup_location}
                  </div>
                  <div>
                    <span className="text-slate-400">To:</span> {r.destination_location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)}

      {/* Tab 4: AI Optimized Route */}
      {activeTab === 'ai_route' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-md">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-bold mb-1 border border-indigo-400/30">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                AI OPTIMIZED ROUTE
              </div>
              <h2 className="text-xl font-bold">Multi-Stop Dispatch Optimizer</h2>
              <p className="text-xs text-indigo-200 mt-0.5 max-w-xl">
                Powered by Google OR-Tools constraint solver. Optimizes total distance, payload capacity, minimal trips, and prioritizes perishable crops to minimize transit spoilage.
              </p>
            </div>
            <button
              onClick={loadOptimizedRoutes}
              disabled={routeOptLoading}
              className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 self-start sm:self-auto shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${routeOptLoading ? 'animate-spin' : ''}`} />
              Re-optimize Routes
            </button>
          </div>

          {routeOptLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="card p-6 animate-pulse space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-10 bg-slate-100 rounded"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : (!routeOpt?.has_jobs || routeOpt?.trips?.length === 0) && (!aiPlans?.has_routes || (aiPlans.dispatch_plans?.length === 0 && aiPlans.waiting_consolidation?.length === 0)) ? (
            <div className="card text-center py-16 px-4 border-2 border-dashed border-slate-200">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                <Sparkles className="w-7 h-7" />
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 mb-2">
                AI OPTIMIZED ROUTE
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t('transporter.noRealJobs', 'No Real Logistics Jobs Available')}</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto mb-4 leading-relaxed">
                {t('transporter.noRealJobsDesc', 'No active orders require freight transport currently. Check back later or refresh.')}
              </p>
              <button onClick={load} className="btn-secondary text-xs">
                Check for New Jobs
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Warehouses Pilot Network */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { district: 'Tenkasi', coords: '8.9594° N, 77.3167° E', role: 'Produce Aggregation & Direct Dispatch' },
                  { district: 'Tirunelveli', coords: '8.7139° N, 77.7567° E', role: 'Central Cross-Dock & Highway Transit' },
                  { district: 'Thoothukudi', coords: '8.7642° N, 78.1348° E', role: 'Coastal Commercial & Port Logistics' }
                ].map((wh) => (
                  <div key={wh.district} className="card p-3.5 border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900 text-xs">{wh.district} Central Agri-Warehouse</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500">{wh.coords}</p>
                    <p className="text-[11px] text-slate-600 mt-1">{wh.role}</p>
                  </div>
                ))}
              </div>

              {/* AI Decision & Vehicle Dispatch Rules */}
              {aiPlans && (aiPlans.dispatch_plans?.length > 0 || aiPlans.waiting_consolidation?.length > 0) && (
                <div className="space-y-4">
                  {/* Ready to Dispatch Plans */}
                  {aiPlans.dispatch_plans?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Ready for Dispatch ({aiPlans.dispatch_plans.length} Vehicle Route{aiPlans.dispatch_plans.length > 1 ? 's' : ''})
                        </h3>
                        <span className="text-[11px] text-slate-500 font-medium">Google Road Network + Gemini AI Layer</span>
                      </div>

                      {aiPlans.dispatch_plans.map((plan, pIdx) => {
                        const planKey = plan.plan_code || `${plan.vehicle_name}-${pIdx}`
                        const isBike = plan.vehicle_category === 'Bike'
                        return (
                          <div key={planKey} className="card p-5 border border-emerald-200 bg-gradient-to-b from-white to-emerald-50/20 rounded-2xl shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-emerald-100">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${isBike ? 'bg-purple-600' : 'bg-emerald-600'}`}>
                                  {isBike ? '🛵' : '🚛'}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-900 text-sm">{plan.vehicle_name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isBike ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                      {isBike ? 'Bike (≤50kg Immediate Dispatch)' : 'Truck (≥35% Min Fill Satisfied)'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Destination Area: <b className="text-slate-800">{plan.destination_area}</b> &bull; {plan.total_orders_count} Order(s) &bull; ~{plan.estimated_road_distance_km} km
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleExplainPlan(plan, planKey)}
                                  disabled={explainingKey === planKey}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 transition"
                                >
                                  <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${explainingKey === planKey ? 'animate-spin' : ''}`} />
                                  {explainingKey === planKey ? 'AI Explaining...' : 'Explain Decision'}
                                </button>
                              </div>
                            </div>

                            {/* Capacity Fill Gauge */}
                            <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-center text-xs mb-1.5">
                                <span className="font-bold text-slate-700">Payload Fill Capacity</span>
                                <span className="font-black text-slate-900">{plan.cargo_weight_kg} kg / {plan.vehicle_capacity_kg} kg ({plan.fill_percentage}%)</span>
                              </div>
                              <div className="relative w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-3 rounded-full transition-all ${isBike ? 'bg-purple-600' : 'bg-emerald-600'}`}
                                  style={{ width: `${Math.min(100, plan.fill_percentage)}%` }}
                                />
                                {!isBike && (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10"
                                    style={{ left: '35%' }}
                                    title="35% Minimum Dispatch Threshold"
                                  />
                                )}
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>0 kg</span>
                                {!isBike && <span className="text-amber-600 font-bold">35% Min Fill ({plan.minimum_dispatch_kg} kg)</span>}
                                <span>Max {plan.vehicle_capacity_kg} kg</span>
                              </div>
                            </div>

                            {/* AI Explanation Accordion */}
                            {planExplanations[planKey] && (
                              <div className="mb-4 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 leading-relaxed animate-fade-in">
                                <div className="flex items-center gap-1.5 font-bold text-indigo-950 mb-1">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Gemini Decision Rationale:</span>
                                </div>
                                <p>{planExplanations[planKey]}</p>
                              </div>
                            )}

                            {/* Sequenced Warehouse & Delivery Stops */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sequenced Stops:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {plan.stops?.map((stop, sIdx) => (
                                  <div key={sIdx} className="p-2.5 rounded-lg border border-slate-100 bg-white flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white ${stop.stop_type === 'PICKUP' ? 'bg-amber-600' : 'bg-sky-600'}`}>
                                        {stop.sequence}
                                      </span>
                                      <div>
                                        <span className="font-bold text-slate-800">{stop.location_name}</span>
                                        {stop.is_multi_warehouse && (
                                          <span className="ml-1.5 px-1.5 py-0.2 bg-teal-100 text-teal-800 text-[9px] rounded font-bold">
                                            Multi-Warehouse
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className={`font-mono text-[11px] font-bold ${stop.stop_type === 'PICKUP' ? 'text-amber-700' : 'text-sky-700'}`}>
                                      {stop.stop_type === 'PICKUP' ? `+${stop.cargo_kg} kg` : `-${stop.cargo_kg} kg`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Waiting for Consolidation Section */}
                  {aiPlans.waiting_consolidation?.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          Orders Waiting for Vehicle Consolidation ({aiPlans.waiting_consolidation.length})
                        </h3>
                        <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Truck 35% Fill Threshold Enforced
                        </span>
                      </div>

                      {aiPlans.waiting_consolidation.map((plan, pIdx) => {
                        const planKey = plan.plan_code || `waiting-${pIdx}`
                        return (
                          <div key={planKey} className="card p-4 border border-amber-200 bg-amber-50/20 rounded-2xl">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-amber-100 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{plan.vehicle_name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                  Below 35% Fill ({plan.fill_percentage}%)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleExplainPlan(plan, planKey)}
                                disabled={explainingKey === planKey}
                                className={`px-2.5 py-1 rounded font-bold text-xs flex items-center gap-1 transition ${
                                  planExplanations[planKey]
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                                }`}
                              >
                                <Sparkles className={`w-3 h-3 ${explainingKey === planKey ? 'animate-spin' : ''}`} />
                                {explainingKey === planKey
                                  ? 'Explaining...'
                                  : planExplanations[planKey]
                                  ? 'Hide Reason'
                                  : 'Why Held?'}
                              </button>
                            </div>
                            <p className="text-xs text-slate-600 mb-2">{plan.rule_explanation}</p>
                            {planExplanations[planKey] && (
                              <div className="p-3 rounded-lg bg-white border border-amber-200 text-xs text-slate-700 mb-2 leading-relaxed">
                                {planExplanations[planKey]}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500">
                              Destination: <b>{plan.destination_area}</b> &bull; Total Cargo: <b>{plan.cargo_weight_kg} kg</b> (Required: ≥ {plan.minimum_dispatch_kg} kg)
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Technical Solver Telemetry Header */}
              {routeOpt?.trips?.length > 0 && (
                <>
                  <div className="pt-4 border-t border-slate-200">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      OR-Tools Constraint Solver Telemetry & Routing
                    </h3>
                  </div>
                </>
              )}

              {/* Optimization KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-4 border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Distance</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{routeOpt.total_distance_km} km</p>
                  <span className="text-[10px] text-slate-500">Optimized shortest tour</span>
                </div>

                <div className="card p-4 border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Trips</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{routeOpt.total_trips}</p>
                  <span className="text-[10px] text-slate-500">{routeOpt.total_jobs_considered} jobs consolidated</span>
                </div>

                <div className="card p-4 border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Est. Transit Time</span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {Math.floor(routeOpt.estimated_total_time_minutes / 60)}h {routeOpt.estimated_total_time_minutes % 60}m
                  </p>
                  <span className="text-[10px] text-slate-500">Includes handling stops</span>
                </div>

                <div className="card p-4 border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Capacity</span>
                  <p className="text-xl font-black text-slate-900 mt-1">{routeOpt.vehicle_capacity_kg} kg</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">Strict limit enforced</span>
                </div>
              </div>

              {/* Trips Breakdown */}
              {routeOpt.trips.map((trip) => (
                <div key={trip.trip_index} className="card p-6 border border-slate-200 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-xs">
                          Trip #{trip.trip_index}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">
                          Consolidated Dispatch Route ({trip.jobs_serviced.length} Consignments)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Distance: <b>{trip.trip_distance_km} km</b> • Est. Time: <b>{trip.trip_duration_minutes} min</b> • Peak Load: <b>{trip.max_load_kg} kg</b>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-950">Capacity Utilization:</span>
                      <div className="w-24 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-2.5 rounded-full" 
                          style={{ width: `${Math.min(100, trip.capacity_utilization_pct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-indigo-700">{trip.capacity_utilization_pct}%</span>
                    </div>
                  </div>

                  {/* Stops Sequence */}
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {trip.stops.map((stop) => {
                      const isDepot = stop.stop_type === 'DEPOT'
                      const isPickup = stop.stop_type === 'PICKUP'
                      const isDelivery = stop.stop_type === 'DELIVERY'
                      return (
                        <div key={stop.stop_sequence} className="relative flex items-start gap-3 text-xs">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ring-4 ring-white shrink-0 -ml-6 ${
                            isDepot 
                              ? 'bg-slate-700 text-white' 
                              : isPickup 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-sky-600 text-white'
                          }`}>
                            {stop.stop_sequence}
                          </span>

                          <div className="flex-1 p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  isDepot 
                                    ? 'bg-slate-200 text-slate-800' 
                                    : isPickup 
                                      ? 'bg-emerald-100 text-emerald-800' 
                                      : 'bg-sky-100 text-sky-800'
                                }`}>
                                  {stop.stop_type}
                                </span>

                                {stop.transport_request_id && (
                                  <span className="font-mono text-slate-500 text-[11px]">
                                    Job #{stop.transport_request_id}
                                  </span>
                                )}

                                {stop.perishability_urgency && stop.perishability_urgency !== 'NORMAL' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    stop.perishability_urgency === 'CRITICAL'
                                      ? 'bg-red-100 text-red-800 animate-pulse'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {stop.perishability_urgency} Perishable Priority
                                  </span>
                                )}
                              </div>

                              <p className="font-bold text-slate-900 text-xs">
                                {stop.location_label}
                              </p>

                              {stop.job_notes && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Cargo: {stop.job_notes}
                                </p>
                              )}
                            </div>

                            <div className="flex sm:flex-col sm:items-end gap-3 text-right">
                              {stop.weight_kg > 0 && (
                                <span className={`font-extrabold ${isPickup ? 'text-emerald-700' : 'text-sky-700'}`}>
                                  {isPickup ? `+${stop.weight_kg} kg (Load)` : `-${stop.weight_kg} kg (Deliver)`}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500">
                                Current payload: <b>{stop.cumulative_load_kg} kg</b>
                              </span>
                              {stop.distance_from_prev_km > 0 && (
                                <span className="text-[10px] text-slate-400">
                                  +{stop.distance_from_prev_km} km
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Data Ground Truth Separation Notice */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <b>Ground Truth Integrity Notice:</b> Consignment IDs, pickup locations, buyer destinations, and lot weights are directly from actual database orders. Stop sequencing, vehicle capacity load tracking, and routing distances are computed advisory predictions by the AI optimizer.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


