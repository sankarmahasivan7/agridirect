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
export const registerBuyer = (data) => api.post('/api/auth/register/buyer', data)
export const login = (data) => api.post('/api/auth/login', data)
export const getMe = () => api.get('/api/auth/me')

// ---- Listings (farmer) ----
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

// ---- Payments ----
export const verifyPayment = (data) => api.post('/api/payments/verify', data)
export const confirmQrPayment = (data) => api.post('/api/payments/confirm-qr', data)
export const failPayment = (data) => api.post('/api/payments/fail', data)
export const collectCodPayment = (orderId) => api.post(`/api/payments/orders/${orderId}/collect-cod`)
export const getOrderSettlement = (orderId) => api.get(`/api/payments/orders/${orderId}/settlement`)

// ---- Transport ----
export const registerTransporter = (data) => api.post('/api/auth/register/transporter', data)
export const createTransportRequest = (data) => api.post('/api/transport', data)
export const myTransportRequests = () => api.get('/api/transport/requests/mine')
export const assignedTransportRequests = () => api.get('/api/transport/requests/assigned')
export const availableTransportJobs = () => api.get('/api/transport/jobs/available')
export const myTransportJobs = () => api.get('/api/transport/jobs/mine')
export const acceptTransportJob = (id) => api.post(`/api/transport/jobs/${id}/accept`)
export const updateTransportJobStatus = (id, newStatus) =>
  api.put(`/api/transport/jobs/${id}/status`, null, { params: { new_status: newStatus } })
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
export const adminDashboard = () => api.get('/api/dashboard/admin')

// ---- Logistics & Route Optimization ----
export const optimizeLogistics = (vehicleCapacityKg) =>
  api.post('/api/logistics/optimize', null, { params: { vehicle_capacity_kg: vehicleCapacityKg } })
export const getOptimizedRoutes = (params) =>
  api.get('/api/transport/optimize-routes', { params })
export const getAiRouteOptimization = (params) =>
  api.get('/api/ai/route-optimization', { params })

// ---- Notifications ----
export const getNotifications = (limit = 50) => api.get('/api/notifications', { params: { limit } })
export const getUnreadNotificationCount = () => api.get('/api/notifications/unread-count')
export const markNotificationRead = (id) => api.put(`/api/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.put('/api/notifications/read-all')

// ---- Batched Delivery & 3PL Allocation ----
export const triggerAutoBatch = (deliveryDistrict) =>
  api.post('/api/batches/auto-batch', null, { params: { delivery_district: deliveryDistrict } })
export const listBatches = (params) => api.get('/api/batches', { params })
export const availableBatches = () => api.get('/api/batches/available')
export const myBatches = () => api.get('/api/batches/mine')
export const batchDetail = (id) => api.get(`/api/batches/${id}`)
export const acceptBatch = (id) => api.post(`/api/batches/${id}/accept`)
export const updateBatchStatus = (id, newStatus) =>
  api.put(`/api/batches/${id}/status`, null, { params: { new_status: newStatus } })
export const batchAdminStats = () => api.get('/api/batches/admin/stats')

// ---- Customer Feedback, Ratings & Photo Upload ----
export const submitReview = (formData) =>
  api.post('/api/reviews', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
export const getOrderReviews = (orderId) => api.get(`/api/reviews/order/${orderId}`)
export const getFarmerReviews = (farmerId) => api.get(`/api/reviews/farmer/${farmerId}`)
export const getListingReviews = (listingId) => api.get(`/api/reviews/listing/${listingId}`)
export const getProductReviews = (productId) => api.get(`/api/reviews/product/${productId}`)
export const getFarmerReviewsSummary = () => api.get('/api/reviews/farmer-summary')
export const getMyReviews = () => api.get('/api/reviews/mine')

// ---- Voice Assistant & AI Logistics ----
export const interactWithVoiceAssistant = (data) => api.post('/api/ai/voice/interact', data)
export const explainAiRoute = (data) => api.post('/api/ai/logistics/explain-route', data)
export const getAiLogisticsPlans = (params) => api.get('/api/ai/logistics/plans', { params })



