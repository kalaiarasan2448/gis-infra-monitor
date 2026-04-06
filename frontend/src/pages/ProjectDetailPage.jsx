// src/pages/ProjectDetailPage.jsx
import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { projectService, aiService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format, formatDistanceToNow } from 'date-fns'

const STATUS_COLORS  = { active: 'badge-info', completed: 'badge-success', on_hold: 'badge-warning', planning: 'badge-neutral' }
const CATEGORY_ICONS = { education: '🏫', healthcare: '🏥', road: '🛣️', water: '💧', electricity: '⚡', housing: '🏠', other: '🏗' }

export default function ProjectDetailPage() {
  const { id }              = useParams()
  const navigate            = useNavigate()
  const { isAdmin, isEngineer, user } = useAuth()
  const [project,    setProject]    = useState(null)
  const [logs,       setLogs]       = useState([])
  const [prediction, setPrediction] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [aiLoading,  setAiLoading]  = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await projectService.getById(id)
        setProject(data.project)
        setLogs(data.recentLogs || [])
      } catch (err) {
        if (err.response?.status === 404) navigate('/projects')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const runPrediction = async () => {
    setAiLoading(true)
    try {
      const { data } = await aiService.predict(id)
      setPrediction(data.prediction)
      // Refresh project to get updated risk score
      const { data: updated } = await projectService.getById(id)
      setProject(updated.project)
    } catch (err) {
      alert(err.response?.data?.message || 'AI service unavailable.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      await projectService.delete(id)
      navigate('/projects')
    } catch (err) {
      alert('Delete failed.')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return null

  const p = project
  const canEdit = isAdmin || (isEngineer && p.assigned_engineer_id === user?.id)

  // Build chart data from progress logs
  const chartData = [...logs]
    .reverse()
    .map(l => ({
      date: format(new Date(l.log_date), 'dd MMM'),
      completion: parseFloat(l.completion_percentage),
      labor: l.labor_count,
    }))

  const daysRemaining = p.days_remaining
  const isOverdue = daysRemaining < 0

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/projects" className="text-slate-500 hover:text-slate-300">Projects</Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300">{p.name}</span>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link to={`/projects/${id}/progress`} className="btn-primary text-sm">
              + Log Progress
            </Link>
          )}
          <Link to={`/projects/${id}/simulate`} className="btn-secondary text-sm">
            🔮 Simulate
          </Link>
          {isAdmin && (
            <button onClick={handleDelete} className="btn-danger text-sm">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Project header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{CATEGORY_ICONS[p.category] || '🏗'}</span>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{p.name}</h1>
              <span className={STATUS_COLORS[p.status]}>{p.status.replace('_',' ')}</span>
            </div>
            {p.description && <p className="text-slate-400 mt-1 text-sm">{p.description}</p>}
            <p className="text-xs text-slate-500 mt-1">📍 {p.address || `${p.latitude}, ${p.longitude}`}</p>
          </div>

          {/* Completion donut */}
          <div className="text-center">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={p.completion_percentage >= 80 ? '#22c55e' : '#0ea5e9'}
                  strokeWidth="3"
                  strokeDasharray={`${p.completion_percentage} ${100 - p.completion_percentage}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-white">{p.completion_percentage}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Complete</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Start Date', value: format(new Date(p.start_date), 'dd MMM yyyy'), icon: '📅' },
          { label: 'Expected End', value: format(new Date(p.expected_end_date), 'dd MMM yyyy'),
            icon: '🏁', sub: isOverdue ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d remaining`,
            color: isOverdue ? 'text-red-400' : 'text-white' },
          { label: 'Budget', value: `₹${((p.budget||0)/1e5).toFixed(1)}L`,
            sub: `${((p.budget_spent||0)/(p.budget||1)*100).toFixed(0)}% used`, icon: '💰' },
          { label: 'Labor Count', value: p.labor_count || 0, icon: '👷' },
        ].map(({ label, value, sub, icon, color = 'text-white' }) => (
          <div key={label} className="card">
            <p className="text-xs text-slate-500">{icon} {label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Progress chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Progress History</h2>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Line type="monotone" dataKey="completion" stroke="#0ea5e9" strokeWidth={2}
                  dot={{ r: 3 }} name="Completion %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
              {logs.length === 0 ? 'No progress logged yet' : 'Need 2+ logs for chart'}
            </div>
          )}
        </div>

        {/* Mini map */}
        <div className="card p-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300">Location</h2>
            <p className="text-xs text-slate-500">{Number(p.latitude)?.toFixed(5)}, {Number(p.longitude)?.toFixed(5)}</p>
          </div>
          <div className="h-48">
            <MapContainer center={[Number(p.latitude), Number(p.longitude)]} zoom={13}
              style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <Marker position={[Number(p.latitude), Number(p.longitude)]}>
                <Popup>{p.name}</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      </div>

      {/* AI Prediction panel */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">🤖 AI Prediction</h2>
            {p.last_prediction_at && (
              <p className="text-xs text-slate-500">
                Last run {formatDistanceToNow(new Date(p.last_prediction_at))} ago
              </p>
            )}
          </div>
          <button onClick={runPrediction} disabled={aiLoading}
            className="btn-primary text-sm flex items-center gap-2">
            {aiLoading ? (
              <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Predicting…</>
            ) : 'Run Prediction'}
          </button>
        </div>

        {(prediction || p.delay_risk_score) ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500">Predicted End</p>
              <p className="text-base font-bold text-white mt-1">
                {prediction?.predicted_end_date
                  ? format(new Date(prediction.predicted_end_date), 'dd MMM yyyy')
                  : p.predicted_end_date ? format(new Date(p.predicted_end_date), 'dd MMM yyyy') : '—'}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500">Delay Risk</p>
              <p className={`text-base font-bold mt-1 ${
                (prediction?.delay_probability || p.delay_risk_score || 0) > 0.7 ? 'text-red-400' :
                (prediction?.delay_probability || p.delay_risk_score || 0) > 0.4 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {((prediction?.delay_probability || p.delay_risk_score || 0) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500">Est. Delay</p>
              <p className="text-base font-bold text-white mt-1">
                {prediction?.delay_days ?? '—'} days
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500">Confidence</p>
              <p className="text-base font-bold text-white mt-1">
                {prediction?.confidence_score
                  ? `${(prediction.confidence_score * 100).toFixed(0)}%`
                  : '—'}
              </p>
            </div>
            {prediction?.recommendation && (
              <div className="col-span-2 md:col-span-4 bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-300">{prediction.recommendation}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            Run a prediction to see AI-powered completion estimates
          </p>
        )}
      </div>

      {/* Recent progress logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Recent Progress Logs</h2>
          {canEdit && (
            <Link to={`/projects/${id}/progress`} className="text-xs text-primary-400 hover:text-primary-300">
              + Add Log
            </Link>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-6">No progress logged yet</p>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4 p-3 bg-slate-800 rounded-lg">
                <div className="text-center w-14 flex-shrink-0">
                  <p className="text-xs text-slate-500">{format(new Date(log.log_date), 'MMM')}</p>
                  <p className="text-lg font-bold text-white leading-tight">
                    {format(new Date(log.log_date), 'dd')}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary-400">
                      {log.completion_percentage}% complete
                    </span>
                    {log.weather_condition && (
                      <span className="badge-neutral text-xs">{log.weather_condition}</span>
                    )}
                    {log.labor_count > 0 && (
                      <span className="badge-neutral text-xs">👷 {log.labor_count}</span>
                    )}
                  </div>
                  {log.notes && <p className="text-sm text-slate-400 mt-0.5 truncate">{log.notes}</p>}
                  <p className="text-xs text-slate-600 mt-1">by {log.engineer_name}</p>
                </div>
                {log.images?.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {log.images.slice(0, 2).map((img, i) => (
                      <img key={i} src={img.file_path}
                        className="w-12 h-12 object-cover rounded-lg border border-slate-700"
                        alt="Progress"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
