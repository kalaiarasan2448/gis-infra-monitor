// src/components/Layout.jsx
import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard',  icon: '▦',  label: 'Dashboard' },
  { to: '/map',        icon: '🗺',  label: 'GIS Map' },
  { to: '/projects',   icon: '🏗',  label: 'Projects' },
]

export default function Layout() {
  const { user, logout, isAdmin, isEngineer } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* ── Sidebar ── */}
      <aside className={`
        flex flex-col bg-slate-900 border-r border-slate-800
        transition-all duration-200
        ${collapsed ? 'w-16' : 'w-56'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <span className="text-2xl flex-shrink-0">🛰</span>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-white leading-tight">GIS Monitor</p>
              <p className="text-xs text-slate-500">Infrastructure</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-500 hover:text-slate-300"
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-primary-600/20 text-primary-400'
                   : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                 }`
              }
            >
              <span className="text-lg flex-shrink-0">{icon}</span>
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-800">
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center
                            text-sm font-bold text-white flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="mt-2 w-full text-xs text-slate-500 hover:text-red-400 text-left px-1"
            >
              Sign out →
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
