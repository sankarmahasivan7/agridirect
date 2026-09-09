import React, { createContext, useContext, useState, useCallback } from 'react'
import * as api from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('agridirect_token'))
  const [role, setRole] = useState(() => localStorage.getItem('agridirect_role'))
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('agridirect_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getMe()
      setUser(res.data)
      localStorage.setItem('agridirect_user', JSON.stringify(res.data))
      return res.data
    } catch {
      return null
    }
  }, [])

  React.useEffect(() => {
    if (token) {
      refreshUser()
    } else {
      setUser(null)
    }
  }, [token, refreshUser])

  const applySession = useCallback((data) => {
    localStorage.setItem('agridirect_token', data.access_token)
    localStorage.setItem('agridirect_role', data.role)
    setToken(data.access_token)
    setRole(data.role)
    if (data.district || data.warehouse_name) {
      setUser((prev) => ({
        ...prev,
        district: data.district,
        warehouse_name: data.warehouse_name,
        role: data.role,
        id: data.user_id,
      }))
    }
    // Fetch full profile in background
    setTimeout(() => {
      refreshUser()
    }, 0)
  }, [refreshUser])

  const login = useCallback(async (email, password, expectedRole) => {
    const res = await api.login({ email, password, role: expectedRole })
    applySession(res.data)
    return res.data
  }, [applySession])

  const registerFarmer = useCallback(async (payload) => {
    const res = await api.registerFarmer(payload)
    applySession(res.data)
    return res.data
  }, [applySession])

  const registerBuyer = useCallback(async (payload) => {
    const res = await api.registerBuyer(payload)
    applySession(res.data)
    return res.data
  }, [applySession])

  const registerTransporter = useCallback(async (payload) => {
    const res = await api.registerTransporter(payload)
    applySession(res.data)
    return res.data
  }, [applySession])

  const logout = useCallback(() => {
    localStorage.removeItem('agridirect_token')
    localStorage.removeItem('agridirect_role')
    localStorage.removeItem('agridirect_user')
    setToken(null)
    setRole(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      token,
      role,
      user,
      district: user?.district,
      warehouseName: user?.warehouse_name,
      isAuthenticated: !!token,
      refreshUser,
      login,
      logout,
      registerFarmer,
      registerBuyer,
      registerTransporter
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
