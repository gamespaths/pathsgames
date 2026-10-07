import { apiClient } from './client'

// GET /api/admin/reports/kpi — v0.41.2 Step 41 F, daily UTC KPI counters per story.
// `params` may carry { storyUuid, from, to, groupBy } (dates YYYY-MM-DD, groupBy day|month|total).
export const getKpiReport = (params = {}) =>
  apiClient().get('/api/admin/reports/kpi', { params }).then(r => r.data)
