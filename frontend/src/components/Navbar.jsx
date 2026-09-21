import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { 
  Sprout, 
  LayoutDashboard, 
  ShoppingBag, 
  Truck, 
  ShoppingCart, 
  LogOut, 
  Sparkles,
  User,
  Globe,
  TrendingUp,
  Warehouse,
  ClipboardList
} from 'lucide-react'
import NotificationBell from './NotificationBell.jsx'

export default function Navbar() {
  const { isAuthenticated, role, logout } = useAuth()
  const { items } = useCart()
  const { language, setLanguage, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const ROLE_BADGES = {
    farmer: { label: t('roles.farmer', 'Farmer'), color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    buyer: { label: t('roles.buyer', 'Buyer'), color: 'bg-blue-100 text-blue-800 border-blue-200' },
    transporter: { label: t('roles.transporter', 'Transporter'), color: 'bg-purple-100 text-purple-800 border-purple-200' },
    admin: { label: t('roles.admin', 'Admin'), color: 'bg-rose-100 text-rose-800 border-rose-200' },
  }

  const dashboardPath = role ? `/${role}/dashboard` : '/'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`))

  const cartCount = items.reduce((sum, item) => sum + (Number(item.quantity) > 0 ? 1 : 0), 0)

  const LanguageSwitcher = () => (
    <div className="flex items-center rounded-xl bg-slate-100/90 p-0.5 border border-slate-200/80 shadow-inner">
      <Globe className="w-3.5 h-3.5 text-slate-500 mx-1 shrink-0" />
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
          language === 'en'
            ? 'bg-white text-emerald-800 shadow-xs'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        title="Switch to English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('ta')}
        className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all ${
          language === 'ta'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        title="தமிழுக்கு மாறவும் (Switch to Tamil)"
      >
        தமிழ்
      </button>
    </div>
  )

  // Define Bottom Navigation Tabs based on Role
  const getBottomTabs = () => {
    if (!isAuthenticated) {
      return [
        { path: '/', label: t('nav.home', 'Home'), icon: Sprout },
        { path: '/market-prices', label: t('nav.marketPrices', 'Rates'), icon: TrendingUp, hasLiveDot: true },
        { path: '/buyer/login', label: t('roles.buyer', 'Buyer'), icon: ShoppingBag },
        { path: '/farmer/login', label: t('roles.farmer', 'Farmer'), icon: User },
        { path: '/transporter/login', label: t('roles.transporter', 'Logistics'), icon: Truck },
      ]
    }

    if (role === 'buyer') {
      return [
        { path: '/buyer/marketplace', label: t('nav.marketplace', 'Market'), icon: ShoppingBag },
        { path: '/market-prices', label: t('nav.marketPrices', 'Rates'), icon: TrendingUp, hasLiveDot: true },
        { path: '/buyer/orders', label: t('nav.orders', 'Orders'), icon: ClipboardList },
        { path: '/buyer/advance-demands', label: t('nav.advanceBooking', 'Advance'), icon: Sparkles },
        { path: '/buyer/cart', label: t('nav.cart', 'Cart'), icon: ShoppingCart, badge: cartCount },
      ]
    }

    if (role === 'farmer') {
      return [
        { path: '/farmer/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
        { path: '/market-prices', label: t('nav.marketPrices', 'Rates'), icon: TrendingUp, hasLiveDot: true },
        { path: '/farmer/orders', label: t('nav.orders', 'Orders'), icon: ClipboardList },
        { path: '/transport/my-requests', label: t('nav.warehouseTransport', 'Warehouse'), icon: Warehouse },
        { path: '/farmer/ai-insights', label: t('nav.aiInsights', 'AI Insight'), icon: Sparkles },
      ]
    }

    if (role === 'transporter') {
      return [
        { path: '/transporter/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
        { path: '/market-prices', label: t('nav.marketPrices', 'Rates'), icon: TrendingUp, hasLiveDot: true },
        { path: '/transport/my-requests', label: t('nav.shipments', 'Jobs'), icon: Truck },
        { path: '/', label: t('nav.home', 'Home'), icon: Sprout },
      ]
    }

    // Admin
    return [
      { path: '/admin/dashboard', label: t('nav.dashboard', 'Admin Hub'), icon: LayoutDashboard },
      { path: '/market-prices', label: t('nav.marketPrices', 'Rates'), icon: TrendingUp, hasLiveDot: true },
      { path: '/', label: t('nav.home', 'Home'), icon: Sprout },
    ]
  }

  const bottomTabs = getBottomTabs()

  return (
    <>
      {/* TOP HEADER NAVBAR */}
      <nav className="glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-700/25 ring-2 ring-emerald-500/20 group-hover:scale-105 transition-all duration-200">
                <Sprout className="w-5 h-5 text-emerald-100" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                  {t('nav.brand', 'AgriDirect')}
                </span>
                <span className="hidden sm:block text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1">
                  {t('nav.brandSubtitle', 'Direct Farmer Commerce')}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation (md and above) */}
            <div className="hidden md:flex items-center gap-2">
              
              {/* Live Market Rates Nav Item */}
              <Link
                to="/market-prices"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive('/market-prices')
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>{t('nav.marketPrices', 'Market Rates')}</span>
                <span className="relative flex h-2 w-2 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold">
                  Live
                </span>
              </Link>

              <div className="h-5 w-px bg-slate-200 mx-1" />

              {/* Language Switcher */}
              <LanguageSwitcher />

              <div className="h-5 w-px bg-slate-200 mx-1" />

              {isAuthenticated ? (
                <>
                  <Link
                    to={dashboardPath}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
                      isActive(dashboardPath)
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-emerald-600" />
                    {t('nav.dashboard', 'Dashboard')}
                  </Link>

                  {role === 'buyer' && (
                    <Link
                      to="/buyer/marketplace"
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
                        isActive('/buyer/marketplace')
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      {t('nav.marketplace', 'Marketplace')}
                    </Link>
                  )}

                  {role === 'buyer' && (
                    <Link
                      to="/buyer/orders"
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
                        isActive('/buyer/orders')
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4 text-emerald-600" />
                      {t('nav.orders', 'My Orders')}
                    </Link>
                  )}

                  {role === 'buyer' && (
                    <Link
                      to="/buyer/advance-demands"
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
                        isActive('/buyer/advance-demands')
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>{t('nav.advanceBooking', 'Advance Booking')}</span>
                    </Link>
                  )}

                  {['farmer', 'buyer'].includes(role) && (
                    <Link
                      to="/transport/my-requests"
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
                        isActive('/transport')
                          ? 'bg-purple-50 text-purple-900 border border-purple-200/80 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                      }`}
                    >
                      {role === 'farmer' ? (
                        <Warehouse className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Truck className="w-4 h-4 text-purple-600" />
                      )}
                      {role === 'farmer' ? t('nav.warehouseTransport', 'Warehouse & Transport') : t('nav.shipments', 'Shipments')}
                    </Link>
                  )}

                  {role === 'farmer' && (
                    <Link
                      to="/farmer/ai-insights"
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
                        isActive('/farmer/ai-insights')
                          ? 'bg-ai-50 text-ai-700 border border-ai-200/80 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-ai-600 hover:bg-ai-50/50 font-medium'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-ai-600" />
                      {t('nav.aiInsights', 'AI Insights')}
                    </Link>
                  )}

                  {/* In-app Push Notification Bell */}
                  <NotificationBell />

                  {role === 'buyer' && (
                    <Link
                      to="/buyer/cart"
                      className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 hover:text-emerald-800 hover:bg-emerald-50/60 transition-all"
                    >
                      <ShoppingCart className="w-4 h-4 text-emerald-600" />
                      {t('nav.cart', 'Cart')}
                      {cartCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-emerald-600 rounded-full shadow-xs">
                          {cartCount}
                        </span>
                      )}
                    </Link>
                  )}

                  {/* Role Pill & Logout */}
                  <div className="h-6 w-px bg-slate-200 mx-1.5" />

                  <div className="flex items-center gap-2 pl-1">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_BADGES[role]?.color || 'bg-slate-100 text-slate-700'}`}>
                      <User className="w-3.5 h-3.5" />
                      {ROLE_BADGES[role]?.label || role}
                    </div>

                    <button
                      onClick={handleLogout}
                      title={t('nav.signOut', 'Sign Out')}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/"
                    className="text-sm font-semibold text-slate-700 hover:text-emerald-700 px-3 py-2 transition"
                  >
                    {t('nav.exploreRoles', 'Explore Roles')}
                  </Link>
                  <Link
                    to="/buyer/login"
                    className="btn-primary text-sm py-2 px-4 shadow-sm"
                  >
                    {t('nav.getStarted', 'Get Started')}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Top Actions (Language Switcher, Bell, and Logout - NO HAMBURGER!) */}
            <div className="flex items-center gap-2 md:hidden">
              <LanguageSwitcher />

              {isAuthenticated && <NotificationBell />}

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  title={t('nav.signOut', 'Sign Out')}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  to="/buyer/login"
                  className="btn-primary text-xs py-1.5 px-2.5 shadow-xs font-bold"
                >
                  {t('nav.signIn', 'Sign In')}
                </Link>
              )}
            </div>

          </div>
        </div>
      </nav>

      {/* MOBILE BOTTOM NAVIGATION BAR - Sleek Modern App-Style Bar */}
      <aside
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] px-2 py-1.5"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {bottomTabs.map((tab, idx) => {
            const active = isActive(tab.path)
            const Icon = tab.icon

            return (
              <Link
                key={idx}
                to={tab.path}
                className={`relative flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 active:scale-95 select-none ${
                  active 
                    ? 'text-emerald-700 font-bold' 
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                {/* Active Indicator Top Pill */}
                {active && (
                  <span className="absolute -top-1.5 w-6 h-1 rounded-full bg-emerald-600 shadow-xs" />
                )}

                <div className="relative p-1">
                  <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110 text-emerald-600 stroke-[2.2]' : 'stroke-[1.8]'}`} />

                  {/* Cart Count Badge */}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[17px] h-4 px-1 rounded-full bg-emerald-600 text-[10px] font-black text-white flex items-center justify-center shadow-xs">
                      {tab.badge}
                    </span>
                  )}

                  {/* Live Pulse Dot for Market Rates */}
                  {tab.hasLiveDot && (
                    <span className="absolute top-0 right-0 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </div>

                <span className={`text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-[62px] ${active ? 'text-emerald-900 font-black' : 'text-slate-500 font-semibold'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </aside>
    </>
  )
}
