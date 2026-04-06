// src/pages/ProgressPage.jsx
// Daily progress log form with image upload and offline-first support

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { progressService, projectService, aiService } from '../services/api'

// ── Offline queue stored in localStorage ──────────────────
const OFFLINE_KEY = 'gis_offline_logs'

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY)) || [] }
  catch { return [] }
}

function saveOfflineQueue(q) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(q))
}

export default function ProgressPage() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [project,  setProject]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineCount, setOfflineCount] = useState(getOfflineQueue().length)
  const [previews, setPreviews] = useState([])
  const [syncing,  setSyncing]  = useState(false)

  const [form, setForm] = useState({
    completion_percentage: '',
    notes: '',
    weather_condition: 'sunny',
    labor_count: '',
    log_date: new Date().toISOString().split('T')[0],
  })

  // Monitor online/offline status
  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    projectService.getById(projectId)
      .then(({ data }) => setProject(data.project))
      .catch(() => navigate('/projects'))
  }, [projectId])

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    setPreviews(files.map(f => ({ file: f, url: URL.createObjectURL(f) })))
  }

  const analyzeImageWithAI = async () => {
    if (previews.length === 0) return
    const file = previews[0].file
    const fd = new FormData()
    fd.append('image', file)
    
    setLoading(true)
    try {
      const { data } = await aiService.analyzeImage(fd)
      if (data.success) {
        setForm(f => ({ ...f, completion_percentage: data.estimated_completion.toString() }))
        alert(`AI Suggestion: ${data.estimated_completion}% (Recognized status: ${data.recognized_stage})`)
      } else {
        alert('AI failed to analyze the image.')
      }
    } catch(err) {
      alert(err.response?.data?.message || 'Error occurred while analyzing.')
    } finally {
      setLoading(false)
    }
  }

  // Submit online: multipart form
  const submitOnline = async () => {
    const fd = new FormData()
    fd.append('project_id',            projectId)
    fd.append('completion_percentage', form.completion_percentage)
    fd.append('notes',                 form.notes)
    fd.append('weather_condition',     form.weather_condition)
    fd.append('labor_count',           form.labor_count || '0')
    fd.append('log_date',              form.log_date)

    previews.forEach(({ file }) => fd.append('images', file))

    await progressService.create(fd)
  }

  // Submit offline: save to localStorage queue
  const submitOffline = () => {
    const queue = getOfflineQueue()
    const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
    queue.push({
      local_id:             localId,
      project_id:           projectId,
      completion_percentage: parseFloat(form.completion_percentage),
      notes:                form.notes,
      weather_condition:    form.weather_condition,
      labor_count:          parseInt(form.labor_count) || 0,
      log_date:             form.log_date,
      created_offline_at:   new Date().toISOString(),
    })
    saveOfflineQueue(queue)
    setOfflineCount(queue.length)
  }

  // Sync offline queue when back online
  const syncOfflineQueue = async () => {
    const queue = getOfflineQueue()
    if (queue.length === 0) return
    setSyncing(true)
    try {
      const { data } = await progressService.syncOffline(queue)
      const synced = data.results.filter(r => r.status === 'synced').map(r => r.local_id)
      const remaining = queue.filter(l => !synced.includes(l.local_id))
      saveOfflineQueue(remaining)
      setOfflineCount(remaining.length)
      alert(`✅ Synced ${synced.length} offline log(s).`)
    } catch (err) {
      alert('Sync failed. Will retry when online.')
    } finally {
      setSyncing(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.completion_percentage) { setError('Completion percentage is required.'); return }
    setError(''); setLoading(true)
    try {
      if (isOnline) {
        await submitOnline()
      } else {
        submitOffline()
      }
      setSuccess(true)
      setTimeout(() => navigate(`/projects/${projectId}`), 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save progress.')
    } finally {
      setLoading(false)
    }
  }

  if (!project) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="text-slate-500 hover:text-slate-300 text-sm">
          ← {project.name}
        </Link>
      </div>
      <h1 className="text-xl font-bold text-white mb-1">Log Daily Progress</h1>
      <p className="text-sm text-slate-400 mb-5">{project.name} · Currently {project.completion_percentage}% complete</p>

      {/* Online/offline indicator */}
      <div className={`flex items-center justify-between p-3 rounded-lg mb-5 border
        ${isOnline ? 'bg-green-900/20 border-green-800' : 'bg-yellow-900/20 border-yellow-800'}`}>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className={isOnline ? 'text-green-300' : 'text-yellow-300'}>
            {isOnline ? 'Online – will upload immediately' : 'Offline – will save locally and sync later'}
          </span>
        </div>
        {!isOnline && offlineCount > 0 && isOnline && (
          <button onClick={syncOfflineQueue} disabled={syncing}
            className="text-xs text-yellow-300 hover:text-yellow-100">
            {syncing ? 'Syncing…' : `Sync ${offlineCount} queued`}
          </button>
        )}
        {isOnline && offlineCount > 0 && (
          <button onClick={syncOfflineQueue} disabled={syncing}
            className="text-xs btn-secondary py-1 px-2">
            {syncing ? 'Syncing…' : `Sync ${offlineCount} offline log${offlineCount > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {success ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-lg font-bold text-white">Progress logged!</p>
          <p className="text-slate-400 text-sm mt-1">
            {isOnline ? 'Saved to server.' : 'Saved offline. Will sync when connected.'}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-5">
          {/* Completion percentage */}
          <div>
            <label className="label">Overall Completion % *</label>
            <div className="flex items-center gap-4">
              <input
                name="completion_percentage" type="range"
                min={project.completion_percentage} max="100" step="1"
                value={form.completion_percentage || project.completion_percentage}
                onChange={handle}
                className="flex-1 accent-primary-500"
              />
              <div className="relative">
                <input
                  name="completion_percentage" type="number"
                  min={project.completion_percentage} max="100"
                  value={form.completion_percentage}
                  onChange={handle}
                  className="input w-20 text-center"
                  placeholder="0" required
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Must be ≥ current ({project.completion_percentage}%)
            </p>
          </div>

          {/* Date + weather */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Log Date</label>
              <input name="log_date" type="date" value={form.log_date}
                onChange={handle} className="input" />
            </div>
            <div>
              <label className="label">Weather Condition</label>
              <select name="weather_condition" value={form.weather_condition}
                onChange={handle} className="input">
                {['sunny','cloudy','rainy','stormy','foggy'].map(w =>
                  <option key={w} value={w}>{w}</option>
                )}
              </select>
            </div>
          </div>

          {/* Labor count */}
          <div>
            <label className="label">Workers on Site Today</label>
            <input name="labor_count" type="number" value={form.labor_count}
              onChange={handle} className="input" placeholder="e.g. 45" min="0" />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes / Observations</label>
            <textarea name="notes" value={form.notes} onChange={handle}
              className="input h-24 resize-none"
              placeholder="What was accomplished today? Any blockers or issues?" />
          </div>

          {/* Image upload (online only) */}
          {isOnline && (
            <div>
              <label className="label">Site Photos</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center
                           hover:border-slate-500 cursor-pointer transition-colors"
              >
                <p className="text-slate-500 text-sm">📸 Click to upload photos (max 10, 10MB each)</p>
                <p className="text-xs text-slate-600 mt-1">JPEG, PNG, WebP supported</p>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*"
                onChange={handleFiles} className="hidden" />

              {previews.length > 0 && (
                <div className="flex flex-col gap-3 mt-3">
                  <div className="flex gap-2 flex-wrap">
                    {previews.map(({ url }, i) => (
                      <div key={i} className="relative">
                        <img src={url} className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
                        <button type="button"
                          onClick={() => setPreviews(ps => ps.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full
                                     text-white text-xs flex items-center justify-center">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={analyzeImageWithAI} className="btn-secondary self-start py-1 px-3 text-sm flex items-center gap-2 text-indigo-300 border-indigo-700/50 hover:bg-indigo-900/30">
                    🤖 Auto-estimate completion % with AI
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Link to={`/projects/${projectId}`} className="btn-secondary flex-1 text-center">
              Cancel
            </Link>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving…' : isOnline ? 'Submit Progress' : '💾 Save Offline'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
