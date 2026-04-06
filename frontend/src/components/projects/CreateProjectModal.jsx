// src/components/projects/CreateProjectModal.jsx
// Modal form for creating a new infrastructure project
// Includes a mini Leaflet map for picking coordinates

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { projectService, authService } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// Lets user click the map to set project location
function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng) }
  })
  return null
}

const CATEGORIES = ['education','healthcare','road','water','electricity','housing','other']

export default function CreateProjectModal({ onClose, onCreated }) {
  const { isAdmin } = useAuth()
  const [engineers, setEngineers] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [form, setForm] = useState({
    name: '', description: '', category: 'education',
    latitude: '', longitude: '', address: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: '', budget: '', assigned_engineer_id: '',
  })

  // Load engineer list (admin only)
  useEffect(() => {
    if (isAdmin) {
      authService.listUsers()
        .then(({ data }) => setEngineers(data.users.filter(u => u.role === 'engineer')))
        .catch(() => {})
    }
  }, [isAdmin])

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const onMapClick = ({ lat, lng }) => {
    setForm(f => ({
      ...f,
      latitude:  lat.toFixed(6),
      longitude: lng.toFixed(6),
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { data } = await projectService.create({
        ...form,
        latitude:  parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        budget:    parseFloat(form.budget) || 0,
        assigned_engineer_id: form.assigned_engineer_id || undefined,
      })
      onCreated(data.project)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project.')
    } finally {
      setLoading(false)
    }
  }

  const hasCoords = form.latitude && form.longitude
  const mapCenter = hasCoords
    ? [parseFloat(form.latitude), parseFloat(form.longitude)]
    : [20.5937, 78.9629]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl
                      max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">New Infrastructure Project</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Project Name *</label>
              <input name="name" value={form.name} onChange={handle}
                className="input" placeholder="e.g. Government Primary School Block C" required />
            </div>
            <div>
              <label className="label">Category *</label>
              <select name="category" value={form.category} onChange={handle} className="input">
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            {isAdmin && engineers.length > 0 && (
              <div>
                <label className="label">Assign Engineer</label>
                <select name="assigned_engineer_id" value={form.assigned_engineer_id}
                  onChange={handle} className="input">
                  <option value="">— Unassigned —</option>
                  {engineers.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Start Date *</label>
              <input name="start_date" type="date" value={form.start_date}
                onChange={handle} className="input" required />
            </div>
            <div>
              <label className="label">Expected End Date *</label>
              <input name="expected_end_date" type="date" value={form.expected_end_date}
                onChange={handle} className="input" required />
            </div>
            <div>
              <label className="label">Budget (₹)</label>
              <input name="budget" type="number" value={form.budget}
                onChange={handle} className="input" placeholder="5000000" min="0" />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea name="description" value={form.description} onChange={handle}
              className="input h-20 resize-none" placeholder="Brief project description…" />
          </div>

          {/* Location */}
          <div>
            <label className="label">Location *</label>
            <p className="text-xs text-slate-500 mb-2">
              Click on the map to set coordinates, or enter manually below
            </p>

            {/* Mini map */}
            <div className="h-52 rounded-xl overflow-hidden border border-slate-700 mb-3">
              <MapContainer center={mapCenter} zoom={hasCoords ? 12 : 5}
                style={{ width: '100%', height: '100%' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                />
                <LocationPicker onPick={onMapClick} />
                {hasCoords && (
                  <Marker position={[parseFloat(form.latitude), parseFloat(form.longitude)]} />
                )}
              </MapContainer>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">Latitude *</label>
                <input name="latitude" type="number" step="any" value={form.latitude}
                  onChange={handle} className="input text-xs" placeholder="12.9716" required />
              </div>
              <div>
                <label className="label text-xs">Longitude *</label>
                <input name="longitude" type="number" step="any" value={form.longitude}
                  onChange={handle} className="input text-xs" placeholder="77.5946" required />
              </div>
              <div>
                <label className="label text-xs">Address / Area</label>
                <input name="address" value={form.address} onChange={handle}
                  className="input text-xs" placeholder="Bengaluru, Karnataka" />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
