// src/hooks/useProjects.js
// Reusable hook for project data with loading/error state

import { useState, useEffect, useCallback } from 'react'
import { projectService } from '../services/api'

export function useProjects(filters = {}) {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await projectService.getAll(filters)
      setProjects(data.projects || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)])

  useEffect(() => { load() }, [load])

  return { projects, loading, error, refetch: load }
}

export function useProject(id) {
  const [project, setProject] = useState(null)
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const { data } = await projectService.getById(id)
      setProject(data.project)
      setLogs(data.recentLogs || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Project not found')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return { project, logs, loading, error, refetch: load }
}

// src/hooks/useStats.js
import { useState, useEffect } from 'react'
import { projectService } from '../services/api'

export function useStats() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    projectService.getStats()
      .then(({ data }) => setStats(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { stats, loading, error }
}
