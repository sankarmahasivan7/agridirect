import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Navbar from './components/Navbar.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

import Landing from './pages/Landing.jsx'
import RoleLogin from './pages/RoleLogin.jsx'

import FarmerRegister from './pages/farmer/FarmerRegister.jsx'
import FarmerDashboard from './pages/farmer/FarmerDashboard.jsx'
import FarmerListings from './pages/farmer/FarmerListings.jsx'
import NewListing from './pages/farmer/NewListing.jsx'
import FarmerOrders from './pages/farmer/FarmerOrders.jsx'
import AIInsights from './pages/farmer/AIInsights.jsx'

import BuyerRegister from './pages/buyer/BuyerRegister.jsx'
import BuyerDashboard from './pages/buyer/BuyerDashboard.jsx'
import Marketplace from './pages/buyer/Marketplace.jsx'
import ProductDetail from './pages/buyer/ProductDetail.jsx'
import Cart from './pages/buyer/Cart.jsx'
import BuyerOrders from './pages/buyer/BuyerOrders.jsx'
import BulkOrder from './pages/buyer/BulkOrder.jsx'

import TransporterRegister from './pages/transporter/TransporterRegister.jsx'
import TransporterDashboard from './pages/transporter/TransporterDashboard.jsx'

import RequestTransport from './pages/transport/RequestTransport.jsx'
import MyShipments from './pages/transport/MyShipments.jsx'
import TrackShipment from './pages/transport/TrackShipment.jsx'

import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import MarketPrices from './pages/market/MarketPrices.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/market-prices" element={<MarketPrices />} />

        {/* Role-specific login pages */}
        <Route path="/farmer/login" element={<RoleLogin role="farmer" />} />
        <Route path="/buyer/login" element={<RoleLogin role="buyer" />} />
        <Route path="/transporter/login" element={<RoleLogin role="transporter" />} />
        <Route path="/admin/login" element={<RoleLogin role="admin" />} />

        {/* Registration */}
        <Route path="/farmer/register" element={<FarmerRegister />} />
        <Route path="/buyer/register" element={<BuyerRegister />} />
        <Route path="/transporter/register" element={<TransporterRegister />} />

        {/* Farmer listing management screens */}
        <Route path="/farmer/dashboard" element={<ProtectedRoute allowedRole="farmer"><FarmerDashboard /></ProtectedRoute>} />
        <Route path="/farmer/listings" element={<ProtectedRoute allowedRole="farmer"><FarmerListings /></ProtectedRoute>} />
        <Route path="/farmer/listings/new" element={<ProtectedRoute allowedRole="farmer"><NewListing /></ProtectedRoute>} />
        <Route path="/farmer/listings/edit/:id" element={<ProtectedRoute allowedRole="farmer"><NewListing /></ProtectedRoute>} />
        <Route path="/farmer/orders" element={<ProtectedRoute allowedRole="farmer"><FarmerOrders /></ProtectedRoute>} />
        <Route path="/farmer/ai-insights" element={<ProtectedRoute allowedRole="farmer"><AIInsights /></ProtectedRoute>} />

        {/* Buyer */}
        <Route path="/buyer/dashboard" element={<ProtectedRoute allowedRole="buyer"><BuyerDashboard /></ProtectedRoute>} />
        <Route path="/buyer/marketplace" element={<ProtectedRoute allowedRole="buyer"><Marketplace /></ProtectedRoute>} />
        <Route path="/buyer/product/:id" element={<ProtectedRoute allowedRole="buyer"><ProductDetail /></ProtectedRoute>} />
        <Route path="/buyer/cart" element={<ProtectedRoute allowedRole="buyer"><Cart /></ProtectedRoute>} />
        <Route path="/buyer/orders" element={<ProtectedRoute allowedRole="buyer"><BuyerOrders /></ProtectedRoute>} />
        <Route path="/buyer/bulk-order" element={<ProtectedRoute allowedRole="buyer"><BulkOrder /></ProtectedRoute>} />

        {/* Transporter */}
        <Route path="/transporter/dashboard" element={<ProtectedRoute allowedRole="transporter"><TransporterDashboard /></ProtectedRoute>} />

        {/* Transport requests */}
        <Route path="/transport/request" element={<ProtectedRoute allowedRole={["farmer", "admin"]}><RequestTransport /></ProtectedRoute>} />
        <Route path="/transport/my-requests" element={<ProtectedRoute allowedRole={["farmer", "buyer"]}><MyShipments /></ProtectedRoute>} />
        <Route path="/transport/track/:id" element={<ProtectedRoute allowedRole={["farmer", "buyer", "transporter", "admin"]}><TrackShipment /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
