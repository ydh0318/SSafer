export const ROUTES = {
  root: '/',
  login: '/login',
  projects: '/projects',
  projectDetail: '/projects/:projectId',
  scanProgress: '/scans/:scanId/progress',
  scanDetail: '/scans/:scanId',
  resultDetail: '/results/:scanId',
} as const;
