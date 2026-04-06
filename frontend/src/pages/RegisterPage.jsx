// src/pages/RegisterPage.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService } from '../services/api'

export default function RegisterPage() {
  const navigate  = useNavigate()
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters.'); return }
    setError(''); setLoading(true)
    try {
      await authService.register({ name: form.name, email: form.email, password: form.password })
      navigate('/login?registered=1')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <span className="text-3xl">🛰</span>
        <h2 className="mt-4 text-2xl font-bold text-white mb-1">Create account</h2>
        <p className="text-slate-400 text-sm mb-6">Join the infrastructure monitoring platform</p>

        <form onSubmit={submit} className="space-y-4">
          {[
            { name: 'name',     label: 'Full Name',       type: 'text',     ph: 'Ravi Kumar' },
            { name: 'email',    label: 'Email',           type: 'email',    ph: 'ravi@example.com' },
            { name: 'password', label: 'Password',        type: 'password', ph: '••••••••' },
            { name: 'confirm',  label: 'Confirm Password',type: 'password', ph: '••••••••' },
          ].map(f => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              <input name={f.name} type={f.type} value={form[f.name]}
                onChange={handle} className="input" placeholder={f.ph} required />
            </div>
          ))}

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300">Sign in</Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-600">
          New accounts are created as Viewer role.<br/>Contact admin to upgrade permissions.
        </p>
      </div>
    </div>
  )
}
