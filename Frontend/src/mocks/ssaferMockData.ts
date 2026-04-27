export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type WorkStatus = 'DONE' | 'ANALYZING' | 'FAILED' | 'OPEN' | 'APPROVED' | 'NEW' | 'READ' | 'ONLINE' | 'OFFLINE';

export type ProjectMock = {
  id: string;
  name: string;
  owner: string;
  scans: number;
  lastStatus: WorkStatus;
  risk: RiskLevel;
  description: string;
};

export type ScanMock = {
  id: string;
  project: string;
  source: 'UPLOAD' | 'AGENT';
  status: WorkStatus;
  scannedAt: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type FindingMock = {
  id: string;
  nodeId: string;
  category: string;
  ruleId: string;
  severity: RiskLevel;
  status: WorkStatus;
  file: string;
  line: number | null;
  title: string;
  evidence: string;
  plain: string;
  whyRisky: string;
  impact: string;
  fix: string;
  before: string;
  after: string;
};

export const projects: ProjectMock[] = [
  {
    id: 'p-101',
    name: 'sample-app',
    owner: 'Guest Workspace',
    scans: 8,
    lastStatus: 'DONE',
    risk: 'HIGH',
    description: 'Dockerfile, compose, env 파일을 업로드해 빠르게 점검하는 샘플 프로젝트',
  },
  {
    id: 'p-102',
    name: 'payment-api',
    owner: 'OAuth User',
    scans: 12,
    lastStatus: 'ANALYZING',
    risk: 'CRITICAL',
    description: '에이전트 기반 점검과 배포 환경 모니터링을 함께 사용하는 결제 API',
  },
  {
    id: 'p-103',
    name: 'docker-lab',
    owner: 'Email User',
    scans: 3,
    lastStatus: 'FAILED',
    risk: 'LOW',
    description: '학습용 컨테이너 환경의 기본 보안 옵션을 반복 점검',
  },
];

export const scans: ScanMock[] = [
  { id: 'scan-a36', project: 'sample-app', source: 'UPLOAD', status: 'DONE', scannedAt: '2026-04-27 09:26', critical: 1, high: 2, medium: 2, low: 1 },
  { id: 'scan-8f1', project: 'sample-app', source: 'AGENT', status: 'ANALYZING', scannedAt: '2026-04-27 09:14', critical: 0, high: 3, medium: 1, low: 4 },
  { id: 'scan-c91', project: 'sample-app', source: 'UPLOAD', status: 'FAILED', scannedAt: '2026-04-26 18:02', critical: 0, high: 1, medium: 0, low: 0 },
];

export const findings: FindingMock[] = [
  {
    id: 'FND-0001',
    nodeId: 'env-node',
    category: 'secret',
    ruleId: 'ENV_SECRET_HARDCODED',
    severity: 'CRITICAL',
    status: 'OPEN',
    file: '.env',
    line: 12,
    title: '환경 변수 파일에 시크릿이 하드코딩됨',
    evidence: 'DB_PASSWORD=****',
    plain: 'DB 비밀번호가 프로젝트 설정 파일에 직접 들어가 있습니다.',
    whyRisky: '저장소나 배포 로그를 통해 노출될 경우 데이터베이스 접근 권한이 외부로 유출될 수 있습니다.',
    impact: '공격자는 DB에 직접 접속하거나 백업 데이터를 탈취할 수 있습니다.',
    fix: '비밀번호를 코드나 파일에 저장하지 말고 Secret Manager 또는 런타임 환경변수로 주입하세요.',
    before: 'DB_PASSWORD=mysecret123',
    after: 'DB_PASSWORD=${DB_PASSWORD}',
  },
  {
    id: 'FND-0002',
    nodeId: 'docker-node',
    category: 'dockerfile',
    ruleId: 'DOCKER_ROOT_USER',
    severity: 'HIGH',
    status: 'OPEN',
    file: 'Dockerfile',
    line: 2,
    title: "Image user should not be 'root'",
    evidence: 'USER root',
    plain: '컨테이너가 root 권한으로 실행됩니다.',
    whyRisky: '컨테이너 탈출이나 취약점 악용 시 호스트 영향 범위가 커질 수 있습니다.',
    impact: '침해 사고가 발생했을 때 파일 시스템, 네트워크, 마운트 자원 접근 피해가 커질 수 있습니다.',
    fix: '애플리케이션 실행 전용 비root 사용자를 만들고 마지막 USER 지시문을 해당 사용자로 변경하세요.',
    before: 'USER root',
    after: 'RUN adduser --disabled-password appuser\nUSER appuser',
  },
  {
    id: 'FND-0003',
    nodeId: 'compose-node',
    category: 'compose',
    ruleId: 'DOCKER_LATEST_TAG',
    severity: 'MEDIUM',
    status: 'APPROVED',
    file: 'docker-compose.yml',
    line: 4,
    title: 'image 태그가 latest로 고정되지 않음',
    evidence: 'image: postgres:latest',
    plain: '이미지 버전이 명확하지 않습니다.',
    whyRisky: '배포 시점마다 다른 이미지가 받아져 재현 가능한 배포가 어려워질 수 있습니다.',
    impact: '예상치 못한 버전 변경으로 장애나 호환성 문제가 발생할 수 있습니다.',
    fix: '명확한 버전 태그나 digest를 사용하세요.',
    before: 'image: postgres:latest',
    after: 'image: postgres:16.2',
  },
  {
    id: 'FND-0004',
    nodeId: 'docker-node',
    category: 'dockerfile',
    ruleId: 'DOCKER_HEALTHCHECK_MISSING',
    severity: 'LOW',
    status: 'OPEN',
    file: 'Dockerfile',
    line: null,
    title: 'No HEALTHCHECK defined',
    evidence: 'HEALTHCHECK instruction missing',
    plain: '컨테이너 상태 확인 명령이 없습니다.',
    whyRisky: '컨테이너가 떠 있어도 내부 애플리케이션 장애를 자동 감지하기 어렵습니다.',
    impact: '장애 대응이 늦어지거나 오케스트레이션 환경에서 비정상 인스턴스가 유지될 수 있습니다.',
    fix: '서비스 특성에 맞는 HEALTHCHECK 명령을 Dockerfile에 추가하세요.',
    before: 'CMD ["npm", "start"]',
    after: 'HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health || exit 1\nCMD ["npm", "start"]',
  },
];

export const monitorEvents = [
  { id: 'evt-001', level: 'HIGH' as RiskLevel, title: 'DB 포트 외부 노출 재발생', time: '09:32', status: 'NEW' as WorkStatus },
  { id: 'evt-002', level: 'MEDIUM' as RiskLevel, title: '최근 스캔 대비 Medium 2건 증가', time: '08:10', status: 'READ' as WorkStatus },
  { id: 'evt-003', level: 'LOW' as RiskLevel, title: 'Agent keepalive 지연', time: '어제', status: 'READ' as WorkStatus },
];

export function formatFindingLocation(finding: FindingMock) {
  return `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
}

export function countFindingSeverity(items: FindingMock[]) {
  return items.reduce(
    (acc, finding) => {
      const key = finding.severity.toLowerCase() as keyof typeof acc;
      acc[key] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}
