import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { 
  Sprout, 
  LayoutDashboard, 
  ShoppingBag, 
  Truck, 
  ShoppingCart, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  User,
  ShieldAlert
} from 'lucide-react'

const ROLE_BADGES = {
  farmer: { label: 'Farmer', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  buyer: { label: 'Buyer', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  fpo: { label: 'FPO', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  transporter: { label: 'Transporter', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  admin: { label: 'Admin', color: 'bg-rose-100 text-rose-800 border-rose-200' },
}

export default function Navbar() {
  const { isAuthenticated, role, logout } = useAuth()
  const { items } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const dashboardPath = role ? `/${role}/dashboard` : '/'

  const handleLogout = () => {
    logout()
    navigate('/')
    setMobileOpen(false)
  }

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)

  const cartCount = items.reduce((sum, item) => sum + (Number(item.quantity) > 0 ? 1 : 0), 0)

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-leaf-700 to-leaf-500 flex items-center justify-center text-white shadow-md shadow-leaf-600/30 group-hover:scale-105 transition-transform duration-200">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                AgriDirect <span className="bg-gradient-to-r from-leaf-600 to-emerald-500 bg-clip-text text-transparent">AI</span>
              </span>
              <span className="hidden sm:block text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1">Direct Farmer Commerce</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to={dashboardPath}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive(dashboardPath)
                      ? 'bg-leaf-50 text-leaf-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-leaf-600" />
                  Dashboard
                </Link>

                {role === 'buyer' && (
                  <Link
                    to="/buyer/marketplace"
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive('/buyer/marketplace')
                        ? 'bg-leaf-50 text-leaf-800 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 text-leaf-600" />
                    Marketplace
                  </Link>
                )}

                {['farmer', 'buyer', 'fpo'].includes(role) && (
                  <Link
                    to="/transport/my-requests"
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive('/transport')
                        ? 'bg-leaf-50 text-leaf-800 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-purple-600" />
                    Shipments
                  </Link>
                )}

                {role === 'farmer' && (
                  <Link
                    to="/farmer/ai-insights"
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive('/farmer/ai-insights')
                        ? 'bg-ai-50 text-ai-700 font-semibold'
                        : 'text-slate-600 hover:text-ai-600 hover:bg-ai-50/50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-ai-600" />
                    AI Insights
                  </Link>
                )}

                {role === 'buyer' && (
                  <Link
                    to="/buyer/cart"
                    className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 hover:text-leaf-800 hover:bg-leaf-50 transition-all"
                  >
                    <ShoppingCart className="w-4 h-4 text-leaf-600" />
                    Cart
                    {cartCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-leaf-600 rounded-full animate-bounce">
                        {cartCount}
                      </span>
                    )}
                  </Link>
                )}

                {/* Role Pill & Logout */}
                <div className="h-6 w-px bg-slate-200 mx-2" />

                <div className="flex items-center gap-2.5 pl-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_BADGES[role]?.color || 'bg-slate-100 text-slate-700'}`}>
                    <User className="w-3.5 h-3.5" />
                    {ROLE_BADGES[role]?.label || role}
                  </div>

                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="text-sm font-semibold text-slate-700 hover:text-leaf-700 px-3 py-2 transition"
                >
                  Explore Roles
                </Link>
                <Link
                  to="/buyer/login"
                  className="btn-primary text-sm py-2 px-4 shadow-sm"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            {role === 'buyer' && cartCount > 0 && (
              <Link to="/buyer/cart" className="relative p-2 text-slate-700">
                <ShoppingCart className="w-5 h-5 text-leaf-600" />
                <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold text-white bg-leaf-600 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-5 space-y-2 animate-in fade-in duration-200">
          {isAuthenticated ? (
            <>
              <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Logged in as</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${ROLE_BADGES[role]?.color}`}>
                  {ROLE_BADGES[role]?.label || role}
                </span>
              </div>

              <Link
                to={dashboardPath}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-leaf-50 hover:text-leaf-700"
              >
                <LayoutDashboard className="w-5 h-5 text-leaf-600" />
                {ROLE_BADGES[role]?.label || role} Dashboard
              </Link>

              {role === 'buyer' && (
                <Link
                  to="/buyer/marketplace"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-leaf-50 hover:text-leaf-700"
                >
                  <ShoppingBag className="w-5 h-5 text-leaf-600" />
                  Marketplace
                </Link>
              )}

              {['farmer', 'buyer', 'fpo'].includes(role) && (
                <Link
                  to="/transport/my-requests"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-leaf-50 hover:text-leaf-700"
                >
                  <Truck className="w-5 h-5 text-purple-600" />
                  Shipments & Tracking
                </Link>
              )}

              {role === 'farmer' && (
                <Link
                  to="/farmer/ai-insights"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-ai-50 hover:text-ai-700"
                >
                  <Sparkles className="w-5 h-5 text-ai-600" />
                  AI Intelligence & Forecasting
                </Link>
              )}

              {role === 'buyer' && (
                <Link
                  to="/buyer/cart"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-700 font-medium hover:bg-leaf-50 hover:text-leaf-700"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-leaf-600" />
                    Shopping Cart
                  </div>
                  {cartCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold text-white bg-leaf-600 rounded-full">
                      {cartCount} items
                    </span>
                  )}
                </Link>
              )}

              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-red-600 font-semibold bg-red-50 hover:bg-red-100 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-2">
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="block text-center py-2.5 text-slate-700 font-semibold hover:bg-slate-50 rounded-xl"
              >
                Explore Roles
              </Link>
              <Link
                to="/buyer/login"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full text-center block"
              >
                Sign In / Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}

