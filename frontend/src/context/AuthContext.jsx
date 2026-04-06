// src/context/AuthContext.jsx
// Global authentication state using React Context + localStorage persistence

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // On mount, validate stored token and fetch fresh user profile
  useEffect(() => {
    const validateSession = async () => {
      const storedToken = localStorage.getItem('token')
      if (!storedToken) { setLoading(false); return }
      try {
        const { data } = await authService.getMe()
        setUser(data.user)
        setToken(storedToken)
      } catch {
        // Token invalid or expired – clear storage
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    validateSession()
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authService.login({ email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const isAdmin    = user?.role === 'admin'
  const isEngineer = user?.role === 'engineer' || isAdmin
  const isViewer   = !!user

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isEngineer, isViewer }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for easy access
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
