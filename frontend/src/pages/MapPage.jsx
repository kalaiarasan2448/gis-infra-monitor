// src/pages/MapPage.jsx
// Interactive GIS map using React-Leaflet
// Shows all projects as markers; click to see details popup

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { projectService } from '../services/api'
import { format } from 'date-fns'

// Fix Leaflet default marker icon broken by Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Create colored markers based on project status
const createMarkerIcon = (status, riskScore) => {
  const colors = {
    active:    riskScore > 0.7 ? '#ef4444' : riskScore > 0.4 ? '#f59e0b' : '#0ea5e9',
    completed: '#22c55e',
    on_hold:   '#a855f7',
    planning:  '#64748b',
    cancelled: '#374151',
  }
  const color = colors[status] || '#0ea5e9'

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 28px; height: 28px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize:   [28, 28],
    iconAnchor: [14, 28],
    popupAnchor:[0, -30],
  })
}

// Category emoji map
const ICONS = {
  education: '🏫', healthcare: '🏥', road: '🛣️',
  water: '💧', electricity: '⚡', housing: '🏠', other: '🏗',
}

// Status colors for badge
const STATUS_CLASSES = {
  active:    'badge-info',
  completed: 'badge-success',
  on_hold:   'badge-warning',
  planning:  'badge-neutral',
  cancelled: 'badge-neutral',
}

// Component: shows a click-to-drop-pin feature for new project location
function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) { if (onPick) onPick(e.latlng) }
  })
  return null
}

// Component: fly-to a location when selectedProject changes
function FlyTo({ project }) {
  const map = useMap()
  useEffect(() => {
    if (project) {
      map.flyTo([project.latitude, project.longitude], 14, { duration: 1.2 })
    }
  }, [project])
  return null
}

// ── Sidebar project list item ──────────────────────────────
function ProjectListItem({ project, isSelected, onClick }) {
  return (
    <button
      onClick={() => onClick(project)}
      className={`w-full text-left p-3 rounded-lg transition-colors text-sm
        ${isSelected ? 'bg-primary-600/20 border border-primary-600/40' : 'hover:bg-slate-800 border border-transparent'}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-base">{ICONS[project.category] || '🏗'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-200 truncate">{project.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {project.address || `${project.latitude?.toFixed(4)}, ${project.longitude?.toFixed(4)}`}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-slate-700 rounded-full h-1">
              <div className="h-1 rounded-full bg-primary-500"
                   style={{ width: `${project.completion_percentage}%` }} />
            </div>
            <span className="text-xs text-slate-400">{project.completion_percentage}%</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function MapPage() {
  const navigate    = useNavigate()
  const [projects,  setProjects]  = useState([])
  const [selected,  setSelected]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState({ status: '', category: '' })
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await projectService.getAll()
        setProjects(data.projects || [])
      } catch (err) {
        console.error('Map load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filter logic
  const visible = projects.filter(p => {
    if (filter.status   && p.status   !== filter.status)   return false
    if (filter.category && p.category !== filter.category) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const center = [20.5937, 78.9629] // India center

  return (
    <div className="flex h-full">
      {/* ── Left sidebar ── */}
      <div className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-base font-bold text-white mb-3">GIS Map</h1>

          {/* Search */}
          <input
            className="input mb-2"
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Filters */}
          <div className="flex gap-2">
            <select className="input text-xs flex-1"
              value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              {['active','completed','planning','on_hold','cancelled'].map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
            <select className="input text-xs flex-1"
              value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
              <option value="">All Types</option>
              {Object.keys(ICONS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <p className="text-xs text-slate-500 mt-2">{visible.length} project{visible.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
            ))
          ) : visible.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-8">No projects match filters</p>
          ) : (
            visible.map(p => (
              <ProjectListItem key={p.id} project={p}
                isSelected={selected?.id === p.id}
                onClick={setSelected} />
            ))
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={5}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          {/* Dark tile layer */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            maxZoom={19}
          />

          {/* Fly to selected project */}
          {selected && <FlyTo project={selected} />}

          {/* Project markers */}
          {visible.map(project => (
            <Marker
              key={project.id}
              position={[project.latitude, project.longitude]}
              icon={createMarkerIcon(project.status, project.delay_risk_score)}
              eventHandlers={{ click: () => setSelected(project) }}
            >
              <Popup maxWidth={280}>
                <div className="text-slate-100 min-w-[220px]">
                  {/* Header */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl">{ICONS[project.category] || '🏗'}</span>
                    <div>
                      <p className="font-semibold text-sm leading-tight">{project.name}</p>
                      <span className={STATUS_CLASSES[project.status] + ' mt-1'}>
                        {project.status}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="my-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Progress</span>
                      <span className="font-medium">{project.completion_percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full">
                      <div className="h-2 rounded-full bg-primary-500 transition-all"
                           style={{ width: `${project.completion_percentage}%` }} />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="text-xs text-slate-400 space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span>Engineer</span>
                      <span className="text-slate-300">{project.engineer_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Due date</span>
                      <span className="text-slate-300">
                        {project.expected_end_date
                          ? format(new Date(project.expected_end_date), 'dd MMM yyyy')
                          : '—'}
                      </span>
                    </div>
                    {project.delay_risk_score > 0 && (
                      <div className="flex justify-between">
                        <span>Delay risk</span>
                        <span className={project.delay_risk_score > 0.7 ? 'text-red-400' :
                                         project.delay_risk_score > 0.4 ? 'text-yellow-400' : 'text-green-400'}>
                          {(project.delay_risk_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="mt-3 w-full text-center text-xs bg-primary-600 hover:bg-primary-700
                               text-white py-1.5 rounded-lg transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend overlay */}
        <div className="absolute bottom-6 right-4 bg-slate-900/90 border border-slate-700
                        rounded-xl p-3 text-xs text-slate-400 backdrop-blur-sm z-[1000]">
          <p className="font-semibold text-slate-300 mb-2">Map Legend</p>
          {[
            { color: '#0ea5e9', label: 'Active (on track)' },
            { color: '#f59e0b', label: 'Active (medium risk)' },
            { color: '#ef4444', label: 'Active (high risk)' },
            { color: '#22c55e', label: 'Completed' },
            { color: '#a855f7', label: 'On Hold' },
            { color: '#64748b', label: 'Planning' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 mt-1">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
