// src/pages/SimulationPage.jsx
// "What-if" simulation: adjust labor / budget / weather and see updated AI prediction

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { projectService, aiService } from '../services/api'
import { format } from 'date-fns'

const Slider = ({ label, name, value, min, max, step, onChange, format: fmt, help }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <span className="text-sm font-bold text-primary-400">{fmt ? fmt(value) : value}</span>
    </div>
    <input type="range" name={name} min={min} max={max} step={step} value={value}
      onChange={onChange}
      className="w-full accent-primary-500 cursor-pointer" />
    <div className="flex justify-between text-xs text-slate-600 mt-0.5">
      <span>{fmt ? fmt(min) : min}</span>
      <span>{fmt ? fmt(max) : max}</span>
    </div>
    {help && <p className="text-xs text-slate-500 mt-0.5">{help}</p>}
  </div>
)

export default function SimulationPage() {
  const { id: projectId } = useParams()
  const [project,   setProject]   = useState(null)
  const [result,    setResult]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [params, setParams] = useState({
    labor_count:    50,
    budget_ratio:   0.8,
    weather_factor: 1.0,
    notes:          '',
  })

  useEffect(() => {
    projectService.getById(projectId).then(({ data }) => {
      setProject(data.project)
      setParams(p => ({
        ...p,
        labor_count:  data.project.labor_count || 50,
      }))
    })
  }, [projectId])

  const handle = (e) => setParams(p => ({
    ...p,
    [e.target.name]: e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value
  }))

  const run = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { data } = await aiService.simulate(projectId, params)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Simulation failed. Is the AI service running?')
    } finally {
      setLoading(false)
    }
  }

  if (!project) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const weatherLabels = { 0.5: 'Extreme', 0.7: 'Bad', 1.0: 'Normal', 1.2: 'Good', 1.5: 'Ideal' }
  const weatherLabel = (v) => {
    const keys = Object.keys(weatherLabels).map(Number).sort((a,b) => a-b)
    const closest = keys.reduce((prev, curr) =>
      Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
    )
    return weatherLabels[closest] || v.toFixed(1)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link to={`/projects/${projectId}`} className="text-slate-500 hover:text-slate-300 text-sm">
          ← {project.name}
        </Link>
        <h1 className="text-xl font-bold text-white mt-3">🔮 Completion Simulator</h1>
        <p className="text-sm text-slate-400 mt-1">
          Adjust parameters to see how they affect the predicted completion date
        </p>
      </div>

      {/* Current status card */}
      <div className="card bg-slate-800/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500">Current Progress</p>
            <p className="text-2xl font-bold text-primary-400">{project.completion_percentage}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Expected End</p>
            <p className="text-base font-bold text-white">
              {format(new Date(project.expected_end_date), 'dd MMM yyyy')}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Current Workers</p>
            <p className="text-2xl font-bold text-white">{project.labor_count || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Controls */}
        <form onSubmit={run} className="card space-y-6">
          <h2 className="text-sm font-semibold text-slate-300">Simulation Parameters</h2>

          <Slider label="Labor Force" name="labor_count"
            value={params.labor_count} min={1} max={500} step={5}
            onChange={handle}
            format={v => `${v} workers`}
            help="Increase workers to speed up work rate" />

          <Slider label="Budget Availability" name="budget_ratio"
            value={params.budget_ratio} min={0.1} max={2.0} step={0.05}
            onChange={handle}
            format={v => `${(v * 100).toFixed(0)}%`}
            help="Higher budget availability unlocks more resources" />

          <Slider label="External Conditions" name="weather_factor"
            value={params.weather_factor} min={0.5} max={1.5} step={0.05}
            onChange={handle}
            format={v => weatherLabel(v)}
            help="Accounts for weather, site conditions, political factors" />

          <div>
            <label className="label">Notes (optional)</label>
            <textarea name="notes" value={params.notes} onChange={handle}
              className="input h-16 resize-none text-sm"
              placeholder="Describe scenario: e.g. 'Emergency fund released, hiring 30 more workers'" />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running simulation…
              </span>
            ) : '▶ Run Simulation'}
          </button>
        </form>

        {/* Results */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Simulation Results</h2>

          {!result ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-600">
              <span className="text-4xl mb-3">🔮</span>
              <p className="text-sm">Adjust parameters and run simulation</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main result */}
              <div className="bg-gradient-to-br from-primary-900/40 to-slate-800 rounded-xl p-5 text-center border border-primary-700/30">
                <p className="text-xs text-slate-400 mb-1">Predicted Completion Date</p>
                <p className="text-3xl font-bold text-white">
                  {result.prediction?.predicted_end_date
                    ? format(new Date(result.prediction.predicted_end_date), 'dd MMM yyyy')
                    : '—'}
                </p>
                {result.prediction?.days_saved > 0 && (
                  <p className="text-green-400 text-sm mt-2 font-medium">
                    🎉 {result.prediction.days_saved} days saved vs baseline!
                  </p>
                )}
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Delay Risk',
                    value: `${((result.prediction?.delay_probability || 0) * 100).toFixed(0)}%`,
                    color: (result.prediction?.delay_probability || 0) > 0.7 ? 'text-red-400' :
                           (result.prediction?.delay_probability || 0) > 0.4 ? 'text-yellow-400' : 'text-green-400',
                  },
                  {
                    label: 'Est. Delay',
                    value: `${result.prediction?.delay_days || 0} days`,
                    color: (result.prediction?.delay_days || 0) > 30 ? 'text-red-400' : 'text-white',
                  },
                  {
                    label: 'Risk Level',
                    value: result.prediction?.risk_level?.toUpperCase() || '—',
                    color: result.prediction?.risk_level === 'high'   ? 'text-red-400' :
                           result.prediction?.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400',
                  },
                  {
                    label: 'Confidence',
                    value: result.prediction?.confidence_score
                      ? `${(result.prediction.confidence_score * 100).toFixed(0)}%`
                      : '—',
                    color: 'text-white',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-base font-bold mt-1 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* AI Recommendation */}
              {result.prediction?.recommendation && (
                <div className="bg-slate-800/70 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-400 mb-1">AI Recommendation</p>
                  <p className="text-sm text-slate-300">{result.prediction.recommendation}</p>
                </div>
              )}

              {/* Inputs used */}
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Simulation Inputs Used</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-slate-500">Workers: </span>
                    <span className="text-slate-300">{params.labor_count}</span></div>
                  <div><span className="text-slate-500">Budget: </span>
                    <span className="text-slate-300">{(params.budget_ratio * 100).toFixed(0)}%</span></div>
                  <div><span className="text-slate-500">Conditions: </span>
                    <span className="text-slate-300">{weatherLabel(params.weather_factor)}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
