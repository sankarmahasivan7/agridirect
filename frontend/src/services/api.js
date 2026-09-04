import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({ baseURL: API_BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agridirect_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agridirect_token')
      localStorage.removeItem('agridirect_role')
    }
    return Promise.reject(err)
  }
)

// ---- Auth ----
export const registerFarmer = (data) => api.post('/api/auth/register/farmer', data)
export const registerFPO = (data) => api.post('/api/auth/register/fpo', data)
export const registerBuyer = (data) => api.post('/api/auth/register/buyer', data)
export const login = (data) => api.post('/api/auth/login', data)

// ---- Listings (farmer/fpo) ----
export const createListing = (data) => api.post('/api/listings', data)
export const myListings = () => api.get('/api/listings/mine')
export const updateListing = (id, data) => api.put(`/api/listings/${id}`, data)
export const deleteListing = (id) => api.delete(`/api/listings/${id}`)

// ---- Marketplace (buyer) ----
export const browseMarketplace = (params) => api.get('/api/marketplace', { params })
export const listingDetail = (id) => api.get(`/api/marketplace/${id}`)

// ---- Orders ----
export const createOrder = (data) => api.post('/api/orders', data)
export const myOrders = () => api.get('/api/orders/mine')
export const sellerOrders = () => api.get('/api/orders/seller')
export const updateOrderStatus = (id, newStatus) =>
  api.put(`/api/orders/${id}/status`, null, { params: { new_status: newStatus } })

// ---- Transport ----
export const registerTransporter = (data) => api.post('/api/auth/register/transporter', data)
export const createTransportRequest = (data) => api.post('/api/transport', data)
export const myTransportRequests = () => api.get('/api/transport/requests/mine')
export const assignedTransportRequests = () => api.get('/api/transport/requests/assigned')
export const updateTransportStatus = (id, newStatus) =>
  api.put(`/api/transport/requests/${id}/status`, null, { params: { new_status: newStatus } })
export const updateVehicleLocation = (data) => api.put('/api/transport/vehicle/location', data)
export const trackTransportRequest = (id) => api.get(`/api/transport/requests/${id}/track`)

// ---- Bulk ----
export const createBulkRequirement = (data) => api.post('/api/bulk-requirements', data)

// ---- AI ----
export const getDemandForecast = (productName, location) =>
  api.get('/api/ai/demand-prediction', { params: { product_name: productName, location } })
export const getPriceRecommendation = (listingId) =>
  api.get(`/api/ai/price-recommendation/${listingId}`)

// ---- Dashboards ----
export const farmerDashboard = () => api.get('/api/dashboard/farmer')
export const buyerDashboard = () => api.get('/api/dashboard/buyer')
export const fpoDashboard = () => api.get('/api/dashboard/fpo')
export const adminDashboard = () => api.get('/api/dashboard/admin')

// ---- Logistics ----
export const optimizeLogistics = (vehicleCapacityKg) =>
  api.post('/api/logistics/optimize', null, { params: { vehicle_capacity_kg: vehicleCapacityKg } })
