import React, { createContext, useContext, useState, useCallback } from 'react'
import * as api from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('agridirect_token'))
  const [role, setRole] = useState(() => localStorage.getItem('agridirect_role'))

  const applySession = useCallback((data) => {
    localStorage.setItem('agridirect_token', data.access_token)
    localStorage.setItem('agridirect_role', data.role)
    setToken(data.access_token)
    setRole(data.role)
  }, [])

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

  const registerFPO = useCallback(async (payload) => {
    const res = await api.registerFPO(payload)
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
    setToken(null)
    setRole(null)
  }, [])

  return (
    <AuthContext.Provider value={{ token, role, isAuthenticated: !!token, login, logout, registerFarmer, registerFPO, registerBuyer, registerTransporter }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
