// src/services/api.js
// Centralized Axios instance with auth token injection and error handling

import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const AI_BASE  = import.meta.env.VITE_AI_URL  || 'http://localhost:8000'

// ── Main backend API instance ──────────────────────────────
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global error handler: redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── AI microservice instance ───────────────────────────────
export const aiApi = axios.create({
  baseURL: AI_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth ───────────────────────────────────────────────────
export const authService = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe:    ()     => api.get('/auth/me'),
  listUsers:()     => api.get('/auth/users'),
}

// ── Projects ───────────────────────────────────────────────
export const projectService = {
  getAll:   (params) => api.get('/projects', { params }),
  getById:  (id)     => api.get(`/projects/${id}`),
  create:   (data)   => api.post('/projects', data),
  update:   (id, data) => api.put(`/projects/${id}`, data),
  delete:   (id)     => api.delete(`/projects/${id}`),
  getStats: ()       => api.get('/projects/stats/summary'),
}

// ── Progress ───────────────────────────────────────────────
export const progressService = {
  // Uses FormData for file uploads
  create: (formData) => api.post('/progress', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getByProject: (projectId, params) =>
    api.get(`/progress/${projectId}`, { params }),
  syncOffline: (logs) => api.post('/progress/sync/offline', { logs }),
}

// ── AI predictions ─────────────────────────────────────────
export const aiService = {
  predict:       (projectId)       => api.post(`/ai/predict/${projectId}`),
  simulate:      (projectId, data) => api.post(`/ai/simulate/${projectId}`, data),
  detectDelays:  ()                => api.post('/ai/detect-delays'),
  analyzeImage:  (formData)        => api.post('/ai/analyze-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
}
