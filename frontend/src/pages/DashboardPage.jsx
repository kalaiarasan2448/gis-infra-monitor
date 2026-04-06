// src/pages/DashboardPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { projectService, aiService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

// ── Stat card ──────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-white', icon }) {
  return (
    <div className="card flex items-start gap-4">
      <div className="text-2xl mt-0.5">{icon}</div>
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Risk badge ─────────────────────────────────────────────
function RiskBadge({ score }) {
  if (!score) return <span className="badge-neutral">—</span>
  if (score > 0.7) return <span className="badge-danger">High</span>
  if (score > 0.4) return <span className="badge-warning">Medium</span>
  return <span className="badge-success">Low</span>
}

const CHART_COLORS = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#a855f7','#ec4899']

const CATEGORY_ICONS = {
  education: '🏫', healthcare: '🏥', road: '🛣️',
  water: '💧', electricity: '⚡', housing: '🏠', other: '🏗',
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const [stats,     setStats]     = useState(null)
  const [projects,  setProjects]  = useState([])
  const [atRisk,    setAtRisk]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, projRes] = await Promise.all([
          projectService.getStats(),
          projectService.getAll({ status: 'active' }),
        ])
        setStats(statsRes.data)
        setProjects(projRes.data.projects || [])

        // Sort by delay risk
        const risky = (projRes.data.projects || [])
          .filter(p => p.delay_risk_score > 0.4)
          .sort((a, b) => b.delay_risk_score - a.delay_risk_score)
          .slice(0, 5)
        setAtRisk(risky)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const s = stats?.stats || {}
  const categoryData = (stats?.categoryBreakdown || []).map(c => ({
    name: c.category,
    count: parseInt(c.count),
    completion: parseFloat(c.avg_completion),
  }))
  const monthlyData = (stats?.monthlyProgress || []).map(m => ({
    month: format(new Date(m.month), 'MMM'),
    avgCompletion: parseFloat(m.avg_completion),
    projects: parseInt(m.projects_updated),
  }))

  // Pie data for status breakdown
  const pieData = [
    { name: 'Active',    value: parseInt(s.active_projects || 0),    color: '#0ea5e9' },
    { name: 'Completed', value: parseInt(s.completed_projects || 0), color: '#22c55e' },
    { name: 'On Hold',   value: parseInt(s.on_hold_projects || 0),   color: '#f59e0b' },
    { name: 'Overdue',   value: parseInt(s.overdue_projects || 0),   color: '#ef4444' },
  ].filter(d => d.value > 0)

  const budgetUtil = s.total_budget > 0
    ? ((s.total_spent / s.total_budget) * 100).toFixed(1)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back, {user?.name} · {format(new Date(), 'EEEE, MMMM d yyyy')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => aiService.detectDelays().then(r =>
              alert(`Checked ${r.data.checked} projects. ${r.data.at_risk} at risk.`)
            )}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            🤖 Run AI Delay Scan
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🏗" label="Total Projects"   value={s.total_projects || 0}     />
        <StatCard icon="⚡" label="Active"           value={s.active_projects || 0}    color="text-primary-400" />
        <StatCard icon="✅" label="Completed"        value={s.completed_projects || 0} color="text-green-400" />
        <StatCard icon="⚠️" label="Overdue"          value={s.overdue_projects || 0}   color="text-red-400"
          sub={`${s.high_risk_projects || 0} high-risk`} />
        <StatCard icon="📊" label="Avg Completion"   value={`${s.avg_completion || 0}%`} color="text-yellow-400" />
        <StatCard icon="💰" label="Total Budget"     value={`₹${((s.total_budget||0)/1e7).toFixed(1)}Cr`} />
        <StatCard icon="💸" label="Budget Spent"     value={`₹${((s.total_spent||0)/1e7).toFixed(1)}Cr`}
          sub={`${budgetUtil}% utilization`} />
        <StatCard icon="🚨" label="High Risk"        value={s.high_risk_projects || 0} color="text-orange-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly progress trend */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Monthly Progress Trend (6 months)</h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Line type="monotone" dataKey="avgCompletion" stroke="#0ea5e9"
                  strokeWidth={2} dot={{ r: 3, fill: '#0ea5e9' }} name="Avg Completion %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
              No progress data yet
            </div>
          )}
        </div>

        {/* Status pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Project Status</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
              No data
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown + At-risk projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category bar chart */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Projects by Category</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={v => CATEGORY_ICONS[v] + ' ' + v} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="count" name="Projects" radius={[4,4,0,0]}>
                  {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
              No category data yet
            </div>
          )}
        </div>

        {/* At-risk projects table */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">⚠️ At-Risk Projects</h2>
            <Link to="/projects?status=active" className="text-xs text-primary-400 hover:text-primary-300">
              View all →
            </Link>
          </div>
          {atRisk.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
              <span className="text-3xl mb-2">✅</span>
              <p className="text-sm">No high-risk projects</p>
            </div>
          ) : (
            <div className="space-y-2">
              {atRisk.map(p => (
                <Link key={p.id} to={`/projects/${p.id}`}
                  className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                  <span className="text-lg">{CATEGORY_ICONS[p.category] || '🏗'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.completion_percentage}% complete</p>
                  </div>
                  <RiskBadge score={p.delay_risk_score} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent projects list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Active Projects</h2>
          <Link to="/projects" className="text-xs text-primary-400 hover:text-primary-300">
            All projects →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Project', 'Category', 'Progress', 'Due Date', 'Risk'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 8).map(p => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2.5 px-3">
                    <Link to={`/projects/${p.id}`} className="font-medium text-slate-200 hover:text-primary-400">
                      {p.name}
                    </Link>
                    <p className="text-xs text-slate-500">{p.address || `${p.latitude?.toFixed(3)}, ${p.longitude?.toFixed(3)}`}</p>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {CATEGORY_ICONS[p.category]} {p.category}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-primary-500"
                          style={{ width: `${p.completion_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-10 text-right">
                        {p.completion_percentage}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-400">
                    {p.expected_end_date ? format(new Date(p.expected_end_date), 'dd MMM yyyy') : '—'}
                    {p.days_remaining < 0 && (
                      <span className="ml-1 text-red-400">({Math.abs(p.days_remaining)}d overdue)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <RiskBadge score={p.delay_risk_score} />
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-600">
                    No active projects. <Link to="/projects" className="text-primary-400">Create one →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
