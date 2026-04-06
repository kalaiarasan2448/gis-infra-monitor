// src/utils/helpers.js

// Format currency in Indian numbering system (Lakhs/Crores)
export function formatINR(amount) {
  if (!amount) return '₹0'
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`
  return `₹${amount.toLocaleString('en-IN')}`
}

// Get Tailwind color class for completion percentage
export function completionColor(pct) {
  if (pct >= 80) return 'text-green-400'
  if (pct >= 50) return 'text-primary-400'
  if (pct >= 25) return 'text-yellow-400'
  return 'text-red-400'
}

// Get risk level label and color
export function riskInfo(score) {
  if (!score) return { label: 'Unknown', color: 'text-slate-500', badge: 'badge-neutral' }
  if (score > 0.7) return { label: 'High Risk',    color: 'text-red-400',    badge: 'badge-danger' }
  if (score > 0.4) return { label: 'Medium Risk',  color: 'text-yellow-400', badge: 'badge-warning' }
  return               { label: 'Low Risk',     color: 'text-green-400',  badge: 'badge-success' }
}

// Shorten a UUID for display
export function shortId(uuid) {
  return uuid?.slice(0, 8) || ''
}

// Days remaining label
export function daysLabel(days) {
  if (days === null || days === undefined) return '—'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days <= 7) return `${days}d left ⚠️`
  return `${days}d remaining`
}

// Category display names
export const CATEGORY_LABELS = {
  education:   '🏫 Education',
  healthcare:  '🏥 Healthcare',
  road:        '🛣️ Roads',
  water:       '💧 Water',
  electricity: '⚡ Electricity',
  housing:     '🏠 Housing',
  other:       '🏗 Other',
}

// Status display
export const STATUS_LABELS = {
  planning:  { label: 'Planning',   badge: 'badge-neutral' },
  active:    { label: 'Active',     badge: 'badge-info' },
  on_hold:   { label: 'On Hold',    badge: 'badge-warning' },
  completed: { label: 'Completed',  badge: 'badge-success' },
  cancelled: { label: 'Cancelled',  badge: 'badge-neutral' },
}
