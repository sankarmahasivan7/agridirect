import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Package, Truck, CheckCircle2, Info, X } from 'lucide-react'
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../services/api.js'
import { useToast } from './Toast.jsx'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const previousCountRef = useRef(0)
  const dropdownRef = useRef(null)
  const { addToast } = useToast()
  const navigate = useNavigate()

  // Poll for unread notification count every 10s
  useEffect(() => {
    let mounted = true

    const checkUnread = async () => {
      try {
        const res = await getUnreadNotificationCount()
        const count = res.data?.unread_count || 0
        if (!mounted) return

        // If count increased, trigger in-app push notification toast!
        if (count > previousCountRef.current && previousCountRef.current >= 0) {
          try {
            const listRes = await getNotifications(1)
            const latest = listRes.data?.[0]
            if (latest && !latest.is_read) {
              addToast(`🔔 ${latest.title}: ${latest.message || ''}`, 'info', 5000)
            }
          } catch (e) {
            // ignore
          }
        }
        previousCountRef.current = count
        setUnreadCount(count)
      } catch (err) {
        // silent fail when unauthenticated or network error
      }
    }

    checkUnread()
    const interval = setInterval(checkUnread, 10000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [addToast])

  // Load full notification list when dropdown is opened
  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await getNotifications(30)
      setNotifications(res.data || [])
    } catch (err) {
      console.error('Failed to load notifications', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications()
    }
    setIsOpen(!isOpen)
  }

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
        previousCountRef.current = Math.max(0, previousCountRef.current - 1)
      } catch (err) {
        console.error('Failed to mark read', err)
      }
    }
    if (notif.link) {
      setIsOpen(false)
      navigate(notif.link)
    }
  }

  const handleMarkAllRead = async (e) => {
    e.stopPropagation()
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
      previousCountRef.current = 0
    } catch (err) {
      console.error('Failed to mark all as read', err)
    }
  }

  const getNotifIcon = (type) => {
    switch (type) {
      case 'ORDER':
        return <Package className="w-4 h-4 text-emerald-600 shrink-0" />
      case 'TRANSPORT':
        return <Truck className="w-4 h-4 text-purple-600 shrink-0" />
      case 'DELIVERY':
        return <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
      default:
        return <Info className="w-4 h-4 text-amber-600 shrink-0" />
    }
  }

  const formatTimeAgo = (dateStr) => {
    try {
      const now = new Date()
      const past = new Date(dateStr)
      const diffMs = now - past
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return `${Math.floor(diffHours / 24)}d ago`
    } catch {
      return ''
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        title="Notifications"
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-leaf-500"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-soft-2xl border border-slate-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-leaf-100 text-leaf-800 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-semibold text-leaf-600 hover:text-leaf-800 hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading updates...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-0.5">You're all caught up with live platform updates.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3 ${
                    !notif.is_read ? 'bg-leaf-50/40' : ''
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-slate-100 shrink-0">
                    {getNotifIcon(notif.notification_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs font-bold truncate ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>
                    {notif.message && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    )}
                  </div>
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-leaf-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>District Hub Alerts Active</span>
            <span className="text-leaf-600 font-semibold">Tenkasi • Tirunelveli • Thoothukudi</span>
          </div>
        </div>
      )}
    </div>
  )
}

