import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Prevents users from accessing dashboards belonging to another role.
 * e.g. a logged-in buyer hitting /farmer/dashboard is redirected to their own dashboard.
 *
 * allowedRole can be a single role string or an array of roles.
 */
export default function ProtectedRoute({ allowedRole, children }) {
  const { isAuthenticated, role } = useAuth()
  const allowed = Array.isArray(allowedRole) ? allowedRole : [allowedRole]

  if (!isAuthenticated) {
    return <Navigate to={`/${allowed[0]}/login`} replace />
  }
  if (!allowed.includes(role)) {
    return <Navigate to={`/${role}/dashboard`} replace />
  }
  return children
}
