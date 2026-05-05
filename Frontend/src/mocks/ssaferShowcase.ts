export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingResolutionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED';
export type FindingSourceType = 'TRIVY' | 'CUSTOM_RULE' | 'AI';
export type FindingCategory = 'CONFIG' | 'SECRET' | 'CVE' | 'NETWORK';

export type ShowcaseFinding = {
  findingId: number;
  scanId: number;
  severity: FindingSeverity;
  sourceType: FindingSourceType;
  category: FindingCategory;
  ruleCode: string;
  title: string;
  description: string;
  attackScenario: string;
  remediationGuide: string;
  filePath: string;
  lineNumber: number;
  fingerprint: string;
  resolutionStatus: FindingResolutionStatus;
  before: string;
  after: string;
};

export type TypingChallenge = {
  id: number;
  level: '초급' | '중급' | '고급';
  xp: number;
  title: string;
  snippet: string;
  explain: string;
};

export const severityMeta: Record<
  FindingSeverity,
  { bg: string; fg: string; soft: string; label: string }
> = {
  CRITICAL: { bg: '#E63946', fg: '#FFFFFF', soft: '#FFE5E5', label: 'CRITICAL' },
  HIGH: { bg: '#FF8A33', fg: '#FFFFFF', soft: '#FFF1E5', label: 'HIGH' },
  MEDIUM: { bg: '#FFB627', fg: '#111111', soft: '#FFF9DB', label: 'MEDIUM' },
  LOW: { bg: '#3D5AFE', fg: '#FFFFFF', soft: '#E5EBFF', label: 'LOW' },
  INFO: { bg: '#9CA3AF', fg: '#FFFFFF', soft: '#F3F4F6', label: 'INFO' },
};

export const showcaseFindings: ShowcaseFinding[] = [
  {
    findingId: 2001,
    scanId: 1001,
    severity: 'CRITICAL',
    sourceType: 'CUSTOM_RULE',
    category: 'SECRET',
    ruleCode: 'ENV_SECRET_HARDCODED',
    title: '환경 변수 파일에 시크릿이 하드코딩되어 있습니다',
    description: 'DB_PASSWORD가 평문으로 .env 파일에 저장되어 있어 유출 시 즉시 악용될 수 있습니다.',
    attackScenario:
      '.env 파일이 저장소나 배포 산출물에 포함되면 공격자가 데이터베이스 계정을 탈취하고 내부 시스템에 접근할 수 있습니다.',
    remediationGuide:
      '평문 비밀번호를 제거하고 배포 환경의 시크릿 매니저 또는 실제 환경 변수 주입 방식으로 치환하세요.',
    filePath: '.env',
    lineNumber: 12,
    fingerprint: 'sha256:env-2001',
    resolutionStatus: 'OPEN',
    before: `DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=mysecret123
DB_NAME=production`,
    after: `DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=\${DB_PASSWORD}
DB_NAME=production`,
  },
  {
    findingId: 2002,
    scanId: 1001,
    severity: 'CRITICAL',
    sourceType: 'CUSTOM_RULE',
    category: 'CONFIG',
    ruleCode: 'DOCKER_PRIVILEGED_TRUE',
    title: 'privileged: true 가 컨테이너 격리를 무력화합니다',
    description: '컨테이너가 호스트 수준 권한에 가깝게 실행되어 공격 표면이 크게 확대됩니다.',
    attackScenario:
      '취약한 애플리케이션이 컨테이너 탈출에 성공하면 호스트 파일 시스템과 네트워크 자원까지 직접 제어할 수 있습니다.',
    remediationGuide:
      '정말 필요한 capability만 허용하고 privileged 모드를 제거하세요. 필요한 경우 read_only, user, cap_drop으로 권한을 줄이세요.',
    filePath: 'docker-compose.yml',
    lineNumber: 23,
    fingerprint: 'sha256:compose-2002',
    resolutionStatus: 'OPEN',
    before: `services:
  api:
    image: shopping-api:latest
    privileged: true`,
    after: `services:
  api:
    image: shopping-api:1.12.0
    privileged: false
    cap_drop:
      - ALL`,
  },
  {
    findingId: 2003,
    scanId: 1001,
    severity: 'HIGH',
    sourceType: 'CUSTOM_RULE',
    category: 'NETWORK',
    ruleCode: 'DOCKER_PORT_EXPOSED_PUBLIC',
    title: 'DB 포트가 0.0.0.0 으로 공개되어 있습니다',
    description: '데이터베이스 포트가 외부 전체 인터페이스에 바인딩되어 네트워크 접근 제어가 어려워집니다.',
    attackScenario:
      '클라우드 보안 그룹 또는 방화벽 오설정이 겹치면 누구나 5432 포트에 접근할 수 있습니다.',
    remediationGuide:
      'localhost 바인딩 또는 내부 네트워크 전용 포트 노출 방식으로 바꾸세요.',
    filePath: 'docker-compose.yml',
    lineNumber: 45,
    fingerprint: 'sha256:compose-2003',
    resolutionStatus: 'IN_PROGRESS',
    before: `ports:
  - "5432:5432"`,
    after: `ports:
  - "127.0.0.1:5432:5432"`,
  },
  {
    findingId: 2004,
    scanId: 1001,
    severity: 'HIGH',
    sourceType: 'TRIVY',
    category: 'CONFIG',
    ruleCode: 'DS-0002',
    title: "Dockerfile 이 root 사용자로 실행됩니다",
    description: '컨테이너 프로세스가 root 권한으로 실행되면 런타임 공격 성공 시 영향 범위가 커집니다.',
    attackScenario:
      '애플리케이션 취약점 하나만으로도 파일 시스템 수정, 패키지 설치, 내부 lateral movement 시도가 쉬워집니다.',
    remediationGuide: '전용 서비스 계정을 만들고 USER 지시어로 권한을 제한하세요.',
    filePath: 'Dockerfile',
    lineNumber: 1,
    fingerprint: 'sha256:docker-2004',
    resolutionStatus: 'OPEN',
    before: `FROM node:20
WORKDIR /app
COPY . .
CMD ["npm", "start"]`,
    after: `FROM node:20
WORKDIR /app
COPY . .
USER node
CMD ["npm", "start"]`,
  },
  {
    findingId: 2005,
    scanId: 1001,
    severity: 'HIGH',
    sourceType: 'TRIVY',
    category: 'CVE',
    ruleCode: 'CVE-2024-1234',
    title: 'lodash 4.17.20 에 알려진 취약점이 있습니다',
    description: '의존성 버전이 오래되어 prototype pollution 계열 취약점에 노출됩니다.',
    attackScenario:
      '공격자가 입력 직렬화 경로를 악용해 런타임 객체를 오염시키고 인증 우회나 데이터 조작을 유도할 수 있습니다.',
    remediationGuide: '보안 패치가 포함된 안정 버전으로 업그레이드하고 lockfile까지 함께 갱신하세요.',
    filePath: 'package.json',
    lineNumber: 0,
    fingerprint: 'sha256:pkg-2005',
    resolutionStatus: 'OPEN',
    before: `"lodash": "4.17.20"`,
    after: `"lodash": "4.17.21"`,
  },
  {
    findingId: 2006,
    scanId: 1001,
    severity: 'MEDIUM',
    sourceType: 'CUSTOM_RULE',
    category: 'CONFIG',
    ruleCode: 'DOCKER_LATEST_TAG',
    title: 'latest 태그 사용으로 배포 재현성이 낮습니다',
    description: '배포 시점마다 다른 이미지가 풀릴 수 있어 보안 검증과 롤백이 어려워집니다.',
    attackScenario:
      '신뢰하지 않은 최신 이미지가 유입되면 사전 검증 없이 운영 배포에 반영될 수 있습니다.',
    remediationGuide: '명시적 버전 또는 digest 고정 방식을 사용하세요.',
    filePath: 'docker-compose.yml',
    lineNumber: 8,
    fingerprint: 'sha256:compose-2006',
    resolutionStatus: 'RESOLVED',
    before: `image: shopping-api:latest`,
    after: `image: shopping-api:1.12.0`,
  },
  {
    findingId: 2007,
    scanId: 1001,
    severity: 'MEDIUM',
    sourceType: 'CUSTOM_RULE',
    category: 'CONFIG',
    ruleCode: 'SSHD_PASSWORD_AUTH',
    title: 'PasswordAuthentication yes 설정이 남아 있습니다',
    description: '패스워드 인증이 켜져 있으면 브루트포스와 계정 탈취 가능성이 높아집니다.',
    attackScenario:
      '봇넷이 공개 IP를 스캔해 약한 자격 증명을 무차별 대입할 수 있습니다.',
    remediationGuide: '공개키 인증만 허용하고 PasswordAuthentication 을 비활성화하세요.',
    filePath: 'sshd_config',
    lineNumber: 56,
    fingerprint: 'sha256:ssh-2007',
    resolutionStatus: 'IGNORED',
    before: `PasswordAuthentication yes`,
    after: `PasswordAuthentication no`,
  },
  {
    findingId: 2008,
    scanId: 1001,
    severity: 'LOW',
    sourceType: 'CUSTOM_RULE',
    category: 'CONFIG',
    ruleCode: 'WEAK_FILE_PERMISSION',
    title: '.env 파일 권한이 너무 넓습니다',
    description: '서비스 계정 외 다른 사용자도 민감한 설정 파일을 읽을 수 있습니다.',
    attackScenario:
      '공용 점프 서버나 다중 사용자 환경에서 내부 계정이 시크릿을 쉽게 열람할 수 있습니다.',
    remediationGuide: '권한을 0600 또는 0640 수준으로 제한하고 소유자를 명확히 지정하세요.',
    filePath: '.env',
    lineNumber: 0,
    fingerprint: 'sha256:file-2008',
    resolutionStatus: 'OPEN',
    before: `-rw-r--r-- .env`,
    after: `-rw------- .env`,
  },
  {
    findingId: 2009,
    scanId: 1001,
    severity: 'INFO',
    sourceType: 'AI',
    category: 'CONFIG',
    ruleCode: 'INFO_DEBUG_TRUE',
    title: '프로덕션 환경에서 DEBUG=true 가능성이 있습니다',
    description: '운영에서 디버그 기능이 켜져 있으면 상세 스택 트레이스와 내부 상태가 노출될 수 있습니다.',
    attackScenario:
      '에러 페이지를 통해 내부 경로, 환경 변수 이름, 쿼리 구조가 노출되어 공격 난이도가 낮아집니다.',
    remediationGuide: '프로덕션 환경에서는 DEBUG=false 로 고정하고 별도 로깅 계층으로 디버깅 정보를 보내세요.',
    filePath: '.env.production',
    lineNumber: 3,
    fingerprint: 'sha256:env-2009',
    resolutionStatus: 'OPEN',
    before: `DEBUG=true`,
    after: `DEBUG=false`,
  },
];

export const typingChallenges: TypingChallenge[] = [
  {
    id: 1,
    level: '초급',
    xp: 10,
    title: 'Dockerfile 에 USER 지정',
    snippet: 'USER node',
    explain: '컨테이너를 root 로 실행하지 않기 위한 가장 기본적인 한 줄입니다.',
  },
  {
    id: 2,
    level: '초급',
    xp: 15,
    title: 'DB 포트 로컬 바인딩',
    snippet: 'ports:\n  - "127.0.0.1:5432:5432"',
    explain: '데이터베이스 포트는 기본적으로 외부 전체 노출을 피하는 것이 좋습니다.',
  },
  {
    id: 3,
    level: '중급',
    xp: 20,
    title: '시크릿 환경 변수 참조',
    snippet: 'DB_PASSWORD=${DB_PASSWORD}',
    explain: '평문 값 대신 환경 변수 또는 시크릿 매니저 주입 방식을 사용합니다.',
  },
  {
    id: 4,
    level: '중급',
    xp: 25,
    title: 'SSHD 안전 설정',
    snippet: 'PermitRootLogin no\nPasswordAuthentication no',
    explain: '루트 로그인과 패스워드 인증을 동시에 차단해 SSH 공격 표면을 줄입니다.',
  },
  {
    id: 5,
    level: '고급',
    xp: 40,
    title: '읽기 전용 볼륨 마운트',
    snippet: 'volumes:\n  - ./config:/etc/app:ro',
    explain: '설정 파일이 런타임에 변조되지 않도록 read-only 마운트로 제한합니다.',
  },
];

export const guideSections = [
  {
    title: 'CLI 설치 가이드',
    category: 'CLI',
    headline: '로컬에서 바로 SSAfer를 돌리는 가장 빠른 시작',
    steps: [
      'pip install ssafer',
      'ssafer login --token YOUR_TOKEN',
      'ssafer run --upload --project shopping-mall-api',
    ],
  },
  {
    title: 'Local Agent 설치 가이드',
    category: 'AGENT',
    headline: '서버에 연결해 웹에서 클릭만으로 점검하는 흐름',
    steps: [
      'curl -sSL https://ssafer.io/install-agent.sh | bash',
      'projectId 와 token 을 agent.yml 에 설정',
      'systemctl start ssafer-agent && systemctl enable ssafer-agent',
    ],
  },
  {
    title: '패치 승인 흐름',
    category: 'PATCH',
    headline: '백업, 승인, 적용 결과 보고까지 한 번에',
    steps: [
      'Finding 상세에서 패치 미리보기 확인',
      'Agent 또는 CLI 적용 선택',
      '백업 생성 후 patch result 저장',
    ],
  },
];

export const historyScans: Array<{
  id: number;
  projectId: number;
  name: string;
  status: ScanStatus;
  scanMode: ScanMode;
  total: number;
  c: number;
  h: number;
  m: number;
  l: number;
  i: number;
  time: string;
}> = [
  { id: 1006, projectId: 105, name: 'media-uploader', status: 'DONE', scanMode: 'CLI', total: 17, c: 1, h: 2, m: 4, l: 9, i: 1, time: '3일 전' },
  { id: 1005, projectId: 104, name: 'payment-gateway', status: 'FAILED', scanMode: 'UPLOAD', total: 0, c: 0, h: 0, m: 0, l: 0, i: 0, time: '이틀 전' },
  { id: 1004, projectId: 101, name: 'shopping-mall-api', status: 'DONE', scanMode: 'CLI', total: 33, c: 4, h: 6, m: 8, l: 12, i: 3, time: '어제' },
  { id: 1003, projectId: 103, name: 'auth-service', status: 'RUNNING', scanMode: 'AGENT', total: 0, c: 0, h: 0, m: 0, l: 0, i: 0, time: '5분 전' },
  { id: 1002, projectId: 102, name: 'admin-dashboard', status: 'DONE', scanMode: 'UPLOAD', total: 12, c: 0, h: 1, m: 5, l: 4, i: 2, time: '2시간 전' },
  { id: 1001, projectId: 101, name: 'shopping-mall-api', status: 'DONE', scanMode: 'AGENT', total: 17, c: 2, h: 4, m: 3, l: 7, i: 1, time: '방금 전' },
];

export const monitorProjects: Array<{
  id: number;
  name: string;
  monitorEnabled: boolean;
  agentStatus: AgentStatus;
  agentId: number;
  lastSeenAt: string;
  currentTaskType: string | null;
  openCritical: number;
}> = [
  { id: 101, name: 'shopping-mall-api', monitorEnabled: true, agentStatus: 'ONLINE', agentId: 1, lastSeenAt: '5초 전', currentTaskType: null, openCritical: 2 },
  { id: 102, name: 'admin-dashboard', monitorEnabled: false, agentStatus: 'OFFLINE', agentId: 2, lastSeenAt: '3시간 전', currentTaskType: null, openCritical: 0 },
  { id: 103, name: 'auth-service', monitorEnabled: true, agentStatus: 'ONLINE', agentId: 3, lastSeenAt: '방금', currentTaskType: 'PATCH_APPLY', openCritical: 0 },
  { id: 105, name: 'media-uploader', monitorEnabled: true, agentStatus: 'ERROR', agentId: 5, lastSeenAt: '10분 전', currentTaskType: null, openCritical: 1 },
];

export const monitorFeed = [
  { time: '방금', sev: 'CRITICAL' as const, text: 'shopping-mall-api: 새 finding +1', detail: 'CVE-2024-5678' },
  { time: '5분 전', sev: 'INFO' as const, text: 'auth-service: PATCH_APPLY 시작', detail: 'findingId #2010' },
  { time: '12분 전', sev: 'HIGH' as const, text: 'media-uploader: Agent ERROR', detail: 'connection lost' },
  { time: '1시간 전', sev: 'INFO' as const, text: 'shopping-mall-api: scan #1001 완료', detail: 'findings: 17' },
  { time: '3시간 전', sev: 'INFO' as const, text: 'admin-dashboard: 12건 RESOLVED', detail: 'auto-applied' },
];

export function getShowcaseFinding(findingId: number) {
  return showcaseFindings.find((finding) => finding.findingId === findingId) ?? showcaseFindings[0];
}
import type { AgentStatus, ScanMode, ScanStatus } from '../types/scan';
