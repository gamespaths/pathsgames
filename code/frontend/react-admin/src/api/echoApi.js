import { apiClient } from './client'

// GET /api/echo/status
export const getServerStatus = () =>
  apiClient().get('/api/echo/status').then(r => r.data)
