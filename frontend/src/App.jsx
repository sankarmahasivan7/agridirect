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

import FPORegister from './pages/fpo/FPORegister.jsx'
import FPODashboard from './pages/fpo/FPODashboard.jsx'

import TransporterRegister from './pages/transporter/TransporterRegister.jsx'
import TransporterDashboard from './pages/transporter/TransporterDashboard.jsx'

import RequestTransport from './pages/transport/RequestTransport.jsx'
import MyShipments from './pages/transport/MyShipments.jsx'
import TrackShipment from './pages/transport/TrackShipment.jsx'

import AdminDashboard from './pages/admin/AdminDashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Role-specific login pages (spec section 4) */}
        <Route path="/farmer/login" element={<RoleLogin role="farmer" />} />
        <Route path="/buyer/login" element={<RoleLogin role="buyer" />} />
        <Route path="/fpo/login" element={<RoleLogin role="fpo" />} />
        <Route path="/transporter/login" element={<RoleLogin role="transporter" />} />
        <Route path="/admin/login" element={<RoleLogin role="admin" />} />

        {/* Registration (no public admin registration) */}
        <Route path="/farmer/register" element={<FarmerRegister />} />
        <Route path="/buyer/register" element={<BuyerRegister />} />
        <Route path="/fpo/register" element={<FPORegister />} />
        <Route path="/transporter/register" element={<TransporterRegister />} />

        {/* Farmer & FPO share listing management screens */}
        <Route path="/farmer/dashboard" element={<ProtectedRoute allowedRole="farmer"><FarmerDashboard /></ProtectedRoute>} />
        <Route path="/farmer/listings" element={<ProtectedRoute allowedRole={["farmer", "fpo"]}><FarmerListings /></ProtectedRoute>} />
        <Route path="/farmer/listings/new" element={<ProtectedRoute allowedRole={["farmer", "fpo"]}><NewListing /></ProtectedRoute>} />
        <Route path="/farmer/orders" element={<ProtectedRoute allowedRole="farmer"><FarmerOrders /></ProtectedRoute>} />
        <Route path="/farmer/ai-insights" element={<ProtectedRoute allowedRole="farmer"><AIInsights /></ProtectedRoute>} />

        {/* Buyer */}
        <Route path="/buyer/dashboard" element={<ProtectedRoute allowedRole="buyer"><BuyerDashboard /></ProtectedRoute>} />
        <Route path="/buyer/marketplace" element={<ProtectedRoute allowedRole="buyer"><Marketplace /></ProtectedRoute>} />
        <Route path="/buyer/product/:id" element={<ProtectedRoute allowedRole="buyer"><ProductDetail /></ProtectedRoute>} />
        <Route path="/buyer/cart" element={<ProtectedRoute allowedRole="buyer"><Cart /></ProtectedRoute>} />
        <Route path="/buyer/orders" element={<ProtectedRoute allowedRole="buyer"><BuyerOrders /></ProtectedRoute>} />
        <Route path="/buyer/bulk-order" element={<ProtectedRoute allowedRole="buyer"><BulkOrder /></ProtectedRoute>} />

        {/* FPO -- reuses the farmer listing screens, since an FPO creates/manages listings the same way */}
        <Route path="/fpo/dashboard" element={<ProtectedRoute allowedRole="fpo"><FPODashboard /></ProtectedRoute>} />

        {/* Transporter */}
        <Route path="/transporter/dashboard" element={<ProtectedRoute allowedRole="transporter"><TransporterDashboard /></ProtectedRoute>} />

        {/* Transport requests -- manual creation is FPO/admin only now (buyer/farmer transport
            is auto-created and auto-assigned the moment an order is placed); tracking stays
            available to whoever is involved in the shipment. */}
        <Route path="/transport/request" element={<ProtectedRoute allowedRole="fpo"><RequestTransport /></ProtectedRoute>} />
        <Route path="/transport/my-requests" element={<ProtectedRoute allowedRole={["farmer", "buyer", "fpo"]}><MyShipments /></ProtectedRoute>} />
        <Route path="/transport/track/:id" element={<ProtectedRoute allowedRole={["farmer", "buyer", "fpo", "transporter", "admin"]}><TrackShipment /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
