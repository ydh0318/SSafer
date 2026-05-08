import type {
  ScanBasicData,
  ServerAuditActionViewModel,
  ServerAuditArtifactViewModel,
  ServerAuditFindingViewModel,
  ServerAuditResultViewModel,
  ServerAuditWarningViewModel,
} from '../types/scan';

const warnings: ServerAuditWarningViewModel[] = [
  {
    code: 'OPEN_PORT_5432',
    title: 'DB 포트 외부 노출 가능성',
    message: '5432 포트가 외부에 열려 있으면 인증 시도와 버전 노출 위험이 커집니다.',
    severity: 'HIGH',
  },
  {
    code: 'ROOT_CONTAINER',
    title: '루트 권한 컨테이너 실행',
    message: '일부 컨테이너가 root 권한으로 실행 중일 가능성이 있어 런타임 격리 강도가 낮습니다.',
    severity: 'MEDIUM',
  },
];

const artifacts: ServerAuditArtifactViewModel[] = [
  {
    name: 'ss-listening-ports.txt',
    kind: 'PORT_SNAPSHOT',
    description: '점검 시점의 listening port 스냅샷',
    value: '22/tcp, 80/tcp, 443/tcp, 5432/tcp',
  },
  {
    name: 'docker-ps.json',
    kind: 'CONTAINER_SNAPSHOT',
    description: '실행 중인 컨테이너 목록 요약',
    value: 'nginx, spring, postgres, redis, rabbitmq',
  },
  {
    name: 'ufw-status.txt',
    kind: 'FIREWALL_STATE',
    description: '호스트 방화벽 규칙 스냅샷',
    value: '22,80,443 allow / 5432 unknown',
  },
];

const actions: ServerAuditActionViewModel[] = [
  {
    title: '5432 포트 외부 공개 여부 확인',
    description: '운영 DB 포트가 외부에서 접근 가능하면 즉시 내부망 또는 localhost 바인딩으로 제한합니다.',
    command: 'sudo ss -lntp | grep 5432',
    impact: 'DB 노출 최소화',
    priority: 'IMMEDIATE',
  },
  {
    title: '방화벽 정책 재검토',
    description: 'UFW 또는 보안 그룹에서 운영에 필요하지 않은 inbound 규칙을 제거합니다.',
    command: 'sudo ufw status numbered',
    impact: '불필요한 외부 노출 축소',
    priority: 'HIGH',
  },
  {
    title: '컨테이너 권한 축소',
    description: 'root 컨테이너는 non-root 사용자로 전환 가능한지 검토하고 Dockerfile/user 설정을 수정합니다.',
    command: 'docker inspect <container-name>',
    impact: '런타임 권한 최소화',
    priority: 'MEDIUM',
  },
];

const findings: ServerAuditFindingViewModel[] = [
  {
    findingId: 9101,
    title: '운영 DB 포트 5432 외부 노출 가능성',
    severity: 'HIGH',
    category: 'NETWORK',
    target: 'postgres:5432',
    summary: '운영 DB 포트가 외부에서 도달 가능하면 데이터베이스 인증 시도와 버전 정보 노출 위험이 증가합니다.',
    evidence: 'ss -lntp 결과에 0.0.0.0:5432 listening 정황',
    observedAt: '2026-05-08T09:41:00+09:00',
    recommendation: 'DB 포트를 내부망 전용으로 제한하고, 애플리케이션 서버 또는 bastion을 통한 접근만 허용합니다.',
    relatedWarnings: [warnings[0]],
    relatedArtifacts: [artifacts[0], artifacts[2]],
    actions: [actions[0], actions[1]],
  },
  {
    findingId: 9102,
    title: '일부 컨테이너의 root 실행 흔적',
    severity: 'MEDIUM',
    category: 'CONTAINER',
    target: 'spring / rabbitmq runtime',
    summary: '루트 권한 컨테이너는 컨테이너 탈출이나 권한 상승 이슈가 생겼을 때 영향 범위가 더 큽니다.',
    evidence: '컨테이너 inspect 기준 User 설정 부재',
    observedAt: '2026-05-08T09:41:00+09:00',
    recommendation: '가능한 이미지부터 non-root 사용자 전환, 파일 권한 조정, capability 축소를 진행합니다.',
    relatedWarnings: [warnings[1]],
    relatedArtifacts: [artifacts[1]],
    actions: [actions[2]],
  },
];

export function buildMockServerAuditResult(scanBasic: ScanBasicData): ServerAuditResultViewModel {
  return {
    scanId: scanBasic.scanId,
    projectId: scanBasic.projectId,
    scanType: 'SERVER_AUDIT',
    status: scanBasic.status,
    targetLabel: 'EC2 Runtime Audit',
    hostLabel: 'ec2-1 / prod',
    findings,
    warnings,
    artifacts,
    actions,
    generatedAt: scanBasic.completedAt ?? scanBasic.lastUpdatedAt ?? scanBasic.requestedAt,
  };
}

export function getMockServerAuditFinding(scanId: number, findingId: number) {
  const mockResult = buildMockServerAuditResult({
    scanId,
    projectId: 0,
    scanType: 'SERVER_AUDIT',
    scanMode: 'CLI',
    status: 'DONE',
    progressStep: null,
    failureReason: null,
    rawResultPath: null,
    requestedAt: '2026-05-08T09:41:00+09:00',
    startedAt: '2026-05-08T09:42:00+09:00',
    completedAt: '2026-05-08T09:43:00+09:00',
    lastUpdatedAt: '2026-05-08T09:43:00+09:00',
  });

  return mockResult.findings.find((item) => item.findingId === findingId) ?? mockResult.findings[0];
}
