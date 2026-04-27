import {
  Activity,
  Bell,
  BookOpen,
  FolderKanban,
  GitCompare,
  LogIn,
  type LucideIcon,
  Radar,
  ScanLine,
  Settings,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';

export type TokenRequirement = 'X' | 'O' | 'O/G' | 'INTERNAL';
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'Socket';

export type ScreenId =
  | 'entry'
  | 'projects'
  | 'projectDetail'
  | 'scanRequest'
  | 'scanProgress'
  | 'result'
  | 'findingDetail'
  | 'history'
  | 'monitor'
  | 'settings';

export type ApiSpec = {
  domain: string;
  feature: string;
  token: TokenRequirement;
  method: HttpMethod;
  path: string;
  screen: ScreenId;
};

export type ScreenSpec = {
  id: ScreenId;
  order: string;
  label: string;
  path: string;
  icon: LucideIcon;
  domains: string[];
  summary: string;
};

export const TOKEN_LABELS: Record<TokenRequirement, string> = {
  X: '비로그인 가능',
  O: '로그인 필요',
  'O/G': '로그인 또는 게스트 가능',
  INTERNAL: '백엔드/에이전트 내부 호출',
};

export const SCREEN_SPECS: ScreenSpec[] = [
  {
    id: 'entry',
    order: '01',
    label: '게스트 / 인증 진입',
    path: '/',
    icon: LogIn,
    domains: ['게스트', '회원', '인증', '소셜로그인'],
    summary: '게스트 모드, 회원가입, 이메일 인증, 자체 로그인, OAuth, 토큰 재발급 분기',
  },
  {
    id: 'projects',
    order: '02',
    label: '프로젝트 목록',
    path: '/projects',
    icon: FolderKanban,
    domains: ['프로젝트'],
    summary: '프로젝트 생성과 목록 조회를 시작점으로 제공',
  },
  {
    id: 'projectDetail',
    order: '03',
    label: '프로젝트 상세 / 점검 옵션',
    path: '/projects/:projectId',
    icon: ShieldCheck,
    domains: ['프로젝트', '스캔'],
    summary: '프로젝트 상세, 수정/삭제, 점검 옵션, 프로젝트별 스캔 목록 조회',
  },
  {
    id: 'scanRequest',
    order: '04',
    label: '스캔 요청 분기',
    path: '/projects/:projectId/scans/new',
    icon: UploadCloud,
    domains: ['스캔', '에이전트'],
    summary: '업로드 기반 점검과 에이전트 기반 점검 요청을 분리',
  },
  {
    id: 'scanProgress',
    order: '05',
    label: '스캔 진행 상태',
    path: '/scans/:scanId/status',
    icon: Activity,
    domains: ['스캔', '내부'],
    summary: '진행 상태 조회와 내부 raw/normalized 결과 저장 흐름',
  },
  {
    id: 'result',
    order: '06',
    label: '결과 워크벤치',
    path: '/scans/:scanId',
    icon: ScanLine,
    domains: ['결과'],
    summary: '스캔 기본, 요약, Finding 리스트, 노드 기준 결과 조회',
  },
  {
    id: 'findingDetail',
    order: '07',
    label: 'Finding 상세 / 승인',
    path: '/scans/:scanId/findings/:findingId',
    icon: Radar,
    domains: ['결과', '내부'],
    summary: '상세 설명, 승인, 패치 적용 결과 보고, Before/After diff',
  },
  {
    id: 'history',
    order: '08',
    label: '히스토리 / 결과 비교',
    path: '/history',
    icon: GitCompare,
    domains: ['히스토리'],
    summary: '전체 스캔 히스토리와 base/target 결과 비교',
  },
  {
    id: 'monitor',
    order: '09',
    label: '모니터 이벤트',
    path: '/projects/:projectId/monitor',
    icon: Bell,
    domains: ['모니터'],
    summary: '이상 이벤트 목록과 상세 조회',
  },
  {
    id: 'settings',
    order: '10',
    label: '설정 / 가이드',
    path: '/settings',
    icon: Settings,
    domains: ['설정', '회원', '가이드'],
    summary: '사용자 설정, 비밀번호, 소셜 연결, 로그아웃, 탈퇴, 상세 가이드',
  },
];

export const API_SPECS: ApiSpec[] = [
  { domain: '게스트', feature: '게스트 모드 진입', token: 'X', method: 'POST', path: '/api/v1/guests/enter', screen: 'entry' },
  { domain: '회원', feature: '회원가입', token: 'X', method: 'POST', path: '/api/v1/users', screen: 'entry' },
  { domain: '회원', feature: '이메일 중복 확인', token: 'X', method: 'GET', path: '/api/v1/users/check-email?email=', screen: 'entry' },
  { domain: '회원', feature: '이메일 인증 코드 전송', token: 'X', method: 'POST', path: '/api/v1/auth/email/send-code', screen: 'entry' },
  { domain: '회원', feature: '이메일 인증 코드 확인', token: 'X', method: 'POST', path: '/api/v1/auth/email/verify-code', screen: 'entry' },
  { domain: '인증', feature: '자체 로그인', token: 'X', method: 'POST', path: '/api/v1/auth/login', screen: 'entry' },
  { domain: '인증', feature: '토큰 재발급', token: 'X', method: 'POST', path: '/api/v1/auth/refresh', screen: 'entry' },
  { domain: '소셜로그인', feature: 'Google OAuth 로그인', token: 'X', method: 'POST', path: '/api/v1/auth/oauth/google', screen: 'entry' },
  { domain: '소셜로그인', feature: 'Github OAuth 로그인', token: 'X', method: 'POST', path: '/api/v1/auth/oauth/github', screen: 'entry' },
  { domain: '프로젝트', feature: '프로젝트 생성', token: 'O/G', method: 'POST', path: '/api/v1/projects', screen: 'projects' },
  { domain: '프로젝트', feature: '프로젝트 목록 조회', token: 'O/G', method: 'GET', path: '/api/v1/projects', screen: 'projects' },
  { domain: '프로젝트', feature: '프로젝트 상세 조회', token: 'O/G', method: 'GET', path: '/api/v1/projects/{projectId}', screen: 'projectDetail' },
  { domain: '프로젝트', feature: '프로젝트 정보 수정', token: 'O/G', method: 'PATCH', path: '/api/v1/projects/{projectId}', screen: 'projectDetail' },
  { domain: '프로젝트', feature: '프로젝트 삭제', token: 'O/G', method: 'DELETE', path: '/api/v1/projects/{projectId}', screen: 'projectDetail' },
  { domain: '스캔', feature: '점검 옵션 조회', token: 'O/G', method: 'GET', path: '/api/v1/projects/{projectId}/scan-options', screen: 'projectDetail' },
  { domain: '스캔', feature: '프로젝트별 스캔 목록 조회', token: 'O/G', method: 'GET', path: '/api/v1/projects/{projectId}/scans', screen: 'projectDetail' },
  { domain: '스캔', feature: '업로드 기반 점검 요청', token: 'O/G', method: 'POST', path: '/api/v1/projects/{projectId}/scans/upload', screen: 'scanRequest' },
  { domain: '스캔', feature: '에이전트 기반 점검 요청', token: 'O/G', method: 'POST', path: '/api/v1/projects/{projectId}/scans/agent', screen: 'scanRequest' },
  { domain: '에이전트', feature: '에이전트 상태 조회', token: 'O', method: 'GET', path: '/api/v1/projects/{projectId}/agent/status', screen: 'scanRequest' },
  { domain: '에이전트', feature: '에이전트 WebSocket 연결', token: 'INTERNAL', method: 'Socket', path: '/ws/v1/internal/agents/connect', screen: 'scanRequest' },
  { domain: '에이전트', feature: '미처리 task 조회', token: 'INTERNAL', method: 'GET', path: '/api/v1/internal/agents/{agentId}/tasks', screen: 'scanRequest' },
  { domain: '스캔', feature: '스캔 진행 상태 조회', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}/status', screen: 'scanProgress' },
  { domain: '내부', feature: 'Raw 결과 업로드', token: 'INTERNAL', method: 'POST', path: '/api/v1/internal/scans/{scanId}/raw-results', screen: 'scanProgress' },
  { domain: '내부', feature: '정규화 결과 저장', token: 'INTERNAL', method: 'POST', path: '/api/v1/internal/scans/{scanId}/findings', screen: 'scanProgress' },
  { domain: '결과', feature: '스캔 기본 조회', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}', screen: 'result' },
  { domain: '결과', feature: '결과 요약 조회', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}/summary', screen: 'result' },
  { domain: '결과', feature: '결과 리스트 조회', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}/findings?severity=&category=&status=&page=&size=', screen: 'result' },
  { domain: '결과', feature: 'severity/category/status/page/size 필터', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}/findings?severity=&category=&status=&page=&size=', screen: 'result' },
  { domain: '결과', feature: '노드 기준 결과 조회', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}/nodes/{nodeId}/findings?severity=&category=&status=&page=&size=', screen: 'result' },
  { domain: '결과', feature: '결과 상세 조회', token: 'O/G', method: 'GET', path: '/api/v1/scans/{scanId}/findings/{findingId}', screen: 'findingDetail' },
  { domain: '결과', feature: '취약점 패치 승인', token: 'O/G', method: 'POST', path: '/api/v1/scans/{scanId}/findings/{findingId}/approve', screen: 'findingDetail' },
  { domain: '내부', feature: '패치 적용 결과 보고', token: 'INTERNAL', method: 'POST', path: '/api/v1/internal/scans/{scanId}/findings/{findingId}/patch-results', screen: 'findingDetail' },
  { domain: '히스토리', feature: '전체 History 조회', token: 'O', method: 'GET', path: '/api/v1/history/scans', screen: 'history' },
  { domain: '히스토리', feature: 'baseScanId / targetScanId 결과 비교', token: 'O', method: 'GET', path: '/api/v1/scans/compare?baseScanId=&targetScanId=', screen: 'history' },
  { domain: '모니터', feature: '이상 이벤트 목록 조회', token: 'O', method: 'GET', path: '/api/v1/projects/{projectId}/monitor/events', screen: 'monitor' },
  { domain: '모니터', feature: '이상 이벤트 상세 조회', token: 'O', method: 'GET', path: '/api/v1/projects/{projectId}/monitor/events/{eventId}', screen: 'monitor' },
  { domain: '설정', feature: '사용자 설정 조회', token: 'O', method: 'GET', path: '/api/v1/users/me', screen: 'settings' },
  { domain: '설정', feature: '사용자 설정 수정', token: 'O', method: 'PATCH', path: '/api/v1/users/me/profile', screen: 'settings' },
  { domain: '설정', feature: '비밀번호 변경', token: 'O', method: 'PATCH', path: '/api/v1/users/me/password', screen: 'settings' },
  { domain: '회원', feature: '소셜 계정 연결/해제', token: 'O', method: 'GET', path: '/api/v1/users/me/socials', screen: 'settings' },
  { domain: '회원', feature: 'Google 소셜 계정 연결', token: 'O', method: 'POST', path: '/api/v1/users/me/socials/google', screen: 'settings' },
  { domain: '회원', feature: 'Google 소셜 계정 연결 해제', token: 'O', method: 'DELETE', path: '/api/v1/users/me/socials/google', screen: 'settings' },
  { domain: '회원', feature: 'Github 소셜 계정 연결', token: 'O', method: 'POST', path: '/api/v1/users/me/socials/github', screen: 'settings' },
  { domain: '회원', feature: 'Github 소셜 계정 연결 해제', token: 'O', method: 'DELETE', path: '/api/v1/users/me/socials/github', screen: 'settings' },
  { domain: '인증', feature: '로그아웃', token: 'O', method: 'POST', path: '/api/v1/auth/logout', screen: 'settings' },
  { domain: '회원', feature: '회원 탈퇴', token: 'O', method: 'DELETE', path: '/api/v1/users', screen: 'settings' },
  { domain: '가이드', feature: '상세 사용 가이드 조회', token: 'X', method: 'GET', path: '/api/v1/guides', screen: 'settings' },
];

export function getApisByScreen(screen: ScreenId) {
  return API_SPECS.filter((api) => api.screen === screen);
}

export function getScreenSpec(screen: ScreenId) {
  return SCREEN_SPECS.find((item) => item.id === screen) ?? SCREEN_SPECS[0];
}

export function getScreenByPathname(pathname: string): ScreenSpec {
  if (pathname.includes('/findings/')) return getScreenSpec('findingDetail');
  if (pathname.endsWith('/status')) return getScreenSpec('scanProgress');
  if (pathname.includes('/scans/new')) return getScreenSpec('scanRequest');
  if (pathname.includes('/monitor')) return getScreenSpec('monitor');
  if (pathname.startsWith('/scans/')) return getScreenSpec('result');
  if (pathname.startsWith('/history')) return getScreenSpec('history');
  if (pathname.startsWith('/settings')) return getScreenSpec('settings');
  if (pathname.match(/^\/projects\/[^/]+$/)) return getScreenSpec('projectDetail');
  if (pathname.startsWith('/projects')) return getScreenSpec('projects');
  return getScreenSpec('entry');
}

export const GUIDE_SCREEN: ScreenSpec = {
  id: 'settings',
  order: 'API',
  label: 'API 명세 매트릭스',
  path: '/api-map',
  icon: BookOpen,
  domains: ['명세', '분기'],
  summary: '전체 API를 토큰 기준과 화면 기준으로 확인',
};
