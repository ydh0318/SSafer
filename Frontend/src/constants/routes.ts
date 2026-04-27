export const ROUTES = {
  root: '/',
  login: '/login',
  projects: '/projects',
  projectDetail: '/projects/:projectId',
  scanRequest: '/projects/:projectId/scans/new',
  scanProgress: '/scans/:scanId/status',
  scanDetail: '/scans/:scanId',
  findingDetail: '/scans/:scanId/findings/:findingId',
  history: '/history',
  monitor: '/projects/:projectId/monitor',
  settings: '/settings',
} as const;
