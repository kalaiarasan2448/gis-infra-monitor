// src/pages/LoginPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Quick-fill demo credentials
  const fillDemo = (role) => {
    const creds = {
      admin:    { email: 'admin@infra.gov',    password: 'password123' },
      engineer: { email: 'ravi@infra.gov',     password: 'password123' },
      viewer:   { email: 'viewer@district.gov',password: 'password123' },
    }
    setForm(creds[role])
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel – decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 to-slate-950
                      flex-col justify-between p-12 border-r border-slate-800">
        <div>
          <span className="text-4xl">🛰</span>
          <h1 className="mt-6 text-3xl font-bold text-white">GIS Infrastructure<br/>Monitor</h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-xs">
            Real-time infrastructure project tracking with AI-powered predictions and
            interactive geospatial maps.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { icon: '📍', text: 'Live GIS map with project geo-tagging' },
            { icon: '🤖', text: 'AI delay detection & completion forecasting' },
            { icon: '📊', text: 'Real-time dashboards & progress analytics' },
            { icon: '📱', text: 'Offline-first mobile progress uploads' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-xl">{icon}</span>
              <span className="text-slate-400 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
          <p className="text-slate-400 text-sm mb-6">Access your monitoring dashboard</p>

          {/* Demo credential buttons */}
          <div className="mb-5 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-500 mb-2">Demo accounts (password: password123)</p>
            <div className="flex gap-2">
              {['admin','engineer','viewer'].map(r => (
                <button
                  key={r}
                  onClick={() => fillDemo(r)}
                  className="flex-1 text-xs py-1 bg-slate-700 hover:bg-slate-600 text-slate-300
                             rounded transition-colors capitalize"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" value={form.email}
                onChange={handle} className="input" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input name="password" type="password" value={form.password}
                onChange={handle} className="input" placeholder="••••••••" required />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
