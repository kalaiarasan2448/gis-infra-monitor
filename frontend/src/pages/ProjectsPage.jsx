// src/pages/ProjectsPage.jsx
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { projectService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import CreateProjectModal from '../components/projects/CreateProjectModal'

const STATUS_COLORS = {
  active:    'badge-info',
  completed: 'badge-success',
  on_hold:   'badge-warning',
  planning:  'badge-neutral',
  cancelled: 'badge-neutral',
}

const CATEGORY_ICONS = {
  education: '🏫', healthcare: '🏥', road: '🛣️',
  water: '💧', electricity: '⚡', housing: '🏠', other: '🏗',
}

export default function ProjectsPage() {
  const { isAdmin, isEngineer } = useAuth()
  const [searchParams] = useSearchParams()
  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState({
    status:   searchParams.get('status') || '',
    category: '',
    search:   '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter.status)   params.status   = filter.status
      if (filter.category) params.category = filter.category
      const { data } = await projectService.getAll(params)
      setProjects(data.projects || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter.status, filter.category])

  const onProjectCreated = (newProject) => {
    setProjects(prev => [newProject, ...prev])
    setShowModal(false)
  }

  const filtered = projects.filter(p =>
    !filter.search || p.name.toLowerCase().includes(filter.search.toLowerCase())
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Infrastructure Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} projects</p>
        </div>
        {isEngineer && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            + New Project
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          className="input w-56"
          placeholder="Search by name…"
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
        />
        <select className="input w-40"
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {['planning','active','on_hold','completed','cancelled'].map(s =>
            <option key={s} value={s} className="capitalize">{s.replace('_',' ')}</option>
          )}
        </select>
        <select className="input w-40"
          value={filter.category}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="card h-44 animate-pulse bg-slate-800/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <p className="text-4xl mb-3">🏗</p>
          <p className="font-medium text-slate-400">No projects found</p>
          {isEngineer && (
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4 text-sm">
              Create first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card hover:border-slate-700 transition-colors group block"
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{CATEGORY_ICONS[p.category] || '🏗'}</span>
                  <div>
                    <p className="font-semibold text-white text-sm leading-tight group-hover:text-primary-400 transition-colors">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{p.category}</p>
                  </div>
                </div>
                <span className={STATUS_COLORS[p.status]}>{p.status.replace('_',' ')}</span>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progress</span>
                  <span className="font-medium text-slate-300">{p.completion_percentage}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${p.completion_percentage}%`,
                      background: p.completion_percentage >= 80 ? '#22c55e' :
                                  p.completion_percentage >= 40 ? '#0ea5e9' : '#f59e0b'
                    }}
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-500">Engineer</span>
                  <p className="text-slate-300 truncate">{p.engineer_name || 'Unassigned'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Due</span>
                  <p className={`${p.days_remaining < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {p.expected_end_date
                      ? format(new Date(p.expected_end_date), 'dd MMM yy')
                      : '—'}
                  </p>
                </div>
                {p.delay_risk_score > 0 && (
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-500">AI Risk: </span>
                    <span className={
                      p.delay_risk_score > 0.7 ? 'text-red-400' :
                      p.delay_risk_score > 0.4 ? 'text-yellow-400' : 'text-green-400'
                    }>
                      {(p.delay_risk_score * 100).toFixed(0)}% delay probability
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create project modal */}
      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreated={onProjectCreated}
        />
      )}
    </div>
  )
}
