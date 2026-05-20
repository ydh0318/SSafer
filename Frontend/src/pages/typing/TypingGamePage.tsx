import { ArrowLeft, Check, ChevronRight, List, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';

import { useUiStore } from '../../store/uiStore';

import SiteHeader from '../../components/layout/SiteHeader';
import TypingGameEnding from './TypingGameEnding';
import TypingStageReportModal from './TypingStageReportModal';
import { useAuthStore } from '../../store/authStore';

/* ─── types ─── */
type TokenTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
type CommandToken = { label: string; meaning: string; tone: TokenTone };
type TypingCommand = { id: number; command: string; description: string; xp: number; tokens: CommandToken[] };
type TypingStage = { id: string; order: number; title: string; level: string; summary: string; commands: TypingCommand[] };
type TypingRouteState = {
  returnToScanId?: string;
  projectId?: string;
};

/* ─── data ─── */
const STAGES: TypingStage[] = [
  {
    id: 's0', order: 0, title: 'SSAfer 명령어 습득하기', level: '튜토리얼',
    summary: 'SSAfer 서비스에서 프로젝트를 스캔하고 관리하기 위한 핵심 명령어들을 익힙니다.',
    commands: [
      { id: 101, command: 'ssafer version', description: '현재 설치된 SSAfer CLI 버전을 확인합니다.', xp: 10, tokens: [{ label: 'ssafer version', meaning: 'CLI 버전 출력', tone: 'sky' }] },
      { id: 102, command: 'ssafer status', description: '로그인 상태, 사용 중인 백엔드 주소, Local Agent 설정 여부를 확인합니다.', xp: 10, tokens: [{ label: 'ssafer status', meaning: '현재 인증/설정 상태', tone: 'emerald' }] },
      { id: 103, command: 'ssafer signup', description: '터미널에서 이메일 인증까지 진행해 새 SSAfer 계정을 만듭니다.', xp: 15, tokens: [{ label: 'ssafer signup', meaning: '새 계정 생성', tone: 'sky' }] },
      { id: 104, command: 'ssafer login', description: 'SSAfer 계정으로 로그인하고, 스캔 결과를 웹에 업로드할 준비를 합니다.', xp: 15, tokens: [{ label: 'ssafer login', meaning: '계정 로그인', tone: 'emerald' }] },
      { id: 105, command: 'ssafer logout', description: '현재 기기에 저장된 로그인 토큰과 현재 프로젝트의 agent 설정을 삭제합니다.', xp: 15, tokens: [{ label: 'ssafer logout', meaning: '인증 정보 초기화', tone: 'rose' }] },
      { id: 106, command: 'ssafer project-create', description: '웹에서 관리할 SSAfer 프로젝트를 새로 생성합니다.', xp: 20, tokens: [{ label: 'ssafer project-create', meaning: '신규 프로젝트 등록', tone: 'amber' }] },
      { id: 107, command: 'ssafer install-tools', description: 'Trivy처럼 SSAfer 스캔에 필요한 외부 도구를 설치합니다.', xp: 20, tokens: [{ label: 'ssafer install-tools', meaning: '스캐너 의존성 설치', tone: 'sky' }] },
      { id: 108, command: 'ssafer run', description: '현재 폴더의 .env, Dockerfile, docker-compose 파일을 점검하고 로컬 결과 JSON을 만듭니다.', xp: 20, tokens: [{ label: 'ssafer run', meaning: '로컬 인프라 스캔 실행', tone: 'emerald' }] },
      { id: 109, command: 'ssafer run --path <dir>', description: '지정한 프로젝트 폴더를 기준으로 보안 점검을 실행합니다.', xp: 25, tokens: [{ label: 'ssafer run', meaning: '스캔 실행', tone: 'emerald' }, { label: '--path <dir>', meaning: '검사할 경로 지정', tone: 'slate' }] },
      { id: 110, command: 'ssafer run --upload', description: '스캔 후 결과 JSON을 바로 백엔드/S3에 업로드해 웹에서 확인할 수 있게 합니다.', xp: 25, tokens: [{ label: 'ssafer run', meaning: '스캔 실행', tone: 'emerald' }, { label: '--upload', meaning: '웹으로 자동 업로드', tone: 'amber' }] },
      { id: 111, command: 'ssafer run --save-raw', description: 'SSAfer가 분석한 compose 설정 원본을 로컬에 함께 저장해 디버깅할 수 있게 합니다.', xp: 25, tokens: [{ label: 'ssafer run', meaning: '스캔 실행', tone: 'emerald' }, { label: '--save-raw', meaning: '원본 설정 보존', tone: 'slate' }] },
      { id: 112, command: 'ssafer report', description: '최근 로컬 스캔 결과의 요약을 확인합니다.', xp: 15, tokens: [{ label: 'ssafer report', meaning: '로컬 결과 요약 보기', tone: 'sky' }] },
      { id: 113, command: 'ssafer report --details', description: '최근 로컬 스캔의 대상 파일, 산출물 경로, finding 상세 내용을 확인합니다.', xp: 20, tokens: [{ label: 'ssafer report', meaning: '결과 보기', tone: 'sky' }, { label: '--details', meaning: '상세 내역 포함', tone: 'slate' }] },
      { id: 114, command: 'ssafer upload', description: '이미 로컬에 생성된 최근 스캔 결과 JSON을 웹으로 업로드합니다.', xp: 20, tokens: [{ label: 'ssafer upload', meaning: '로컬 결과 웹으로 전송', tone: 'amber' }] },
      { id: 115, command: 'ssafer apply', description: '로컬 analysis_result.json 안의 patch payload를 확인하고 프로젝트 파일에 적용합니다.', xp: 25, tokens: [{ label: 'ssafer apply', meaning: '수정안(패치) 반영', tone: 'emerald' }] },
      { id: 116, command: 'ssafer apply --scan-id <id>', description: '백엔드에서 해당 scanId의 analysis_result.json을 내려받아 수정안을 적용합니다.', xp: 30, tokens: [{ label: 'ssafer apply', meaning: '패치 반영', tone: 'emerald' }, { label: '--scan-id <id>', meaning: '특정 스캔의 결과 적용', tone: 'slate' }] },
      { id: 117, command: 'ssafer apply --latest --project-id <id>', description: '해당 프로젝트의 최신 완료 스캔 분석 결과를 내려받아 수정안을 적용합니다.', xp: 30, tokens: [{ label: 'ssafer apply', meaning: '패치 반영', tone: 'emerald' }, { label: '--latest', meaning: '최신 스캔 기준', tone: 'sky' }, { label: '--project-id <id>', meaning: '대상 프로젝트 지정', tone: 'slate' }] },
      { id: 118, command: 'ssafer apply --dry-run', description: '실제 파일은 바꾸지 않고 어떤 수정이 적용될지 diff만 확인합니다.', xp: 25, tokens: [{ label: 'ssafer apply', meaning: '패치 반영', tone: 'emerald' }, { label: '--dry-run', meaning: '변경사항 모의 실행', tone: 'rose' }] },
      { id: 119, command: 'ssafer agent', description: '웹에서 보낸 스캔/수정 요청을 현재 PC 또는 서버에서 처리할 수 있도록 Local Agent를 실행합니다.', xp: 25, tokens: [{ label: 'ssafer agent', meaning: '로컬 에이전트 구동', tone: 'amber' }] },
      { id: 120, command: 'ssafer server-audit', description: 'EC2 같은 실제 서버 안에서 포트, 프로세스, Docker, SSH, 방화벽, nginx 상태를 점검합니다.', xp: 30, tokens: [{ label: 'ssafer server-audit', meaning: '서버 인프라 스캔', tone: 'emerald' }] },
      { id: 121, command: 'ssafer server-audit --details', description: '서버 점검 결과의 findings, warnings, artifacts를 자세히 확인합니다.', xp: 30, tokens: [{ label: 'ssafer server-audit', meaning: '서버 스캔', tone: 'emerald' }, { label: '--details', meaning: '상세 항목 출력', tone: 'slate' }] },
      { id: 122, command: 'ssafer server-audit --include-os-packages', description: 'Trivy로 서버 OS 패키지 취약점까지 함께 점검합니다.', xp: 35, tokens: [{ label: 'ssafer server-audit', meaning: '서버 스캔', tone: 'emerald' }, { label: '--include-os-packages', meaning: 'OS 패키지 취약점 포함', tone: 'rose' }] },
      { id: 123, command: 'ssafer server-audit --upload', description: '서버 점검 결과를 백엔드/S3에 업로드해 웹에서 확인할 수 있게 합니다.', xp: 35, tokens: [{ label: 'ssafer server-audit', meaning: '서버 스캔', tone: 'emerald' }, { label: '--upload', meaning: '결과 웹으로 전송', tone: 'amber' }] },
    ],
  },
  {
    id: 's1', order: 1, title: '기본 탐색', level: '초급',
    summary: '서버에 처음 접속했을 때 현재 위치와 파일 구조를 파악하는 단계입니다.',
    commands: [
      { id: 1, command: 'pwd', description: '현재 내가 어느 디렉토리에 있는지 확인합니다.', xp: 10, tokens: [{ label: 'pwd', meaning: '현재 작업 디렉토리 출력', tone: 'emerald' }] },
      { id: 2, command: 'ls', description: '현재 위치의 파일과 폴더 목록을 빠르게 확인합니다.', xp: 10, tokens: [{ label: 'ls', meaning: '파일과 디렉토리 목록 출력', tone: 'sky' }] },
      { id: 3, command: 'ls -la', description: '숨김 파일을 포함해 권한, 크기, 수정 시각까지 자세히 확인합니다.', xp: 15, tokens: [{ label: 'ls', meaning: '파일과 디렉토리 목록 출력', tone: 'sky' }, { label: '-l', meaning: '권한, 크기, 날짜 등 상세 정보 표시', tone: 'amber' }, { label: '-a', meaning: '숨김 파일까지 포함해서 표시', tone: 'rose' }] },
      { id: 4, command: 'cd /var/log', description: '시스템 로그가 모이는 디렉토리로 이동합니다.', xp: 15, tokens: [{ label: 'cd', meaning: '다른 디렉토리로 이동', tone: 'emerald' }, { label: '/var/log', meaning: '시스템 로그 디렉토리', tone: 'slate' }] },
      { id: 5, command: 'cat /etc/hostname', description: '호스트 이름 파일 내용을 바로 출력합니다.', xp: 15, tokens: [{ label: 'cat', meaning: '파일 내용을 그대로 출력', tone: 'sky' }, { label: '/etc/hostname', meaning: '서버 호스트 이름이 저장된 파일', tone: 'slate' }] },
    ],
  },
  {
    id: 's2', order: 2, title: '파일 다루기', level: '초급',
    summary: '파일 생성, 복사, 검색, 로그 확인처럼 자주 쓰는 기본 조작을 익힙니다.',
    commands: [
      { id: 6, command: 'mkdir -p /home/user/projects', description: '중간 경로가 없어도 프로젝트 디렉토리를 한 번에 생성합니다.', xp: 15, tokens: [{ label: 'mkdir', meaning: '디렉토리 생성', tone: 'emerald' }, { label: '-p', meaning: '중간 경로가 없어도 함께 생성', tone: 'amber' }, { label: '/home/user/projects', meaning: '만들 대상 경로', tone: 'slate' }] },
      { id: 7, command: 'cp config.yaml config.yaml.bak', description: '수정 전에 설정 파일 백업본을 만들어 둡니다.', xp: 15, tokens: [{ label: 'cp', meaning: '파일 복사', tone: 'sky' }, { label: 'config.yaml', meaning: '원본 설정 파일', tone: 'slate' }, { label: 'config.yaml.bak', meaning: '백업 파일 이름', tone: 'rose' }] },
      { id: 8, command: 'grep -r "error" /var/log/', description: '로그 디렉토리 전체에서 error 문자열을 재귀적으로 검색합니다.', xp: 20, tokens: [{ label: 'grep', meaning: '문자열 패턴 검색', tone: 'emerald' }, { label: '-r', meaning: '하위 디렉토리까지 재귀 검색', tone: 'amber' }, { label: '"error"', meaning: '찾고 싶은 문자열', tone: 'rose' }, { label: '/var/log/', meaning: '검색 대상 디렉토리', tone: 'slate' }] },
      { id: 9, command: 'tail -f /var/log/syslog', description: '로그 파일 끝부분을 실시간으로 따라가며 모니터링합니다.', xp: 20, tokens: [{ label: 'tail', meaning: '파일 끝부분 출력', tone: 'sky' }, { label: '-f', meaning: '새 로그가 생기면 계속 따라감', tone: 'amber' }, { label: '/var/log/syslog', meaning: '실시간 확인할 로그 파일', tone: 'slate' }] },
      { id: 10, command: 'head -20 /etc/passwd', description: '계정 정보 파일의 앞 20줄만 빠르게 확인합니다.', xp: 20, tokens: [{ label: 'head', meaning: '파일 앞부분 출력', tone: 'emerald' }, { label: '-20', meaning: '앞 20줄만 표시', tone: 'amber' }, { label: '/etc/passwd', meaning: '사용자 계정 정보 파일', tone: 'slate' }] },
    ],
  },
  {
    id: 's3', order: 3, title: '권한과 사용자 관리', level: '중급',
    summary: '누가 읽고 쓰고 실행할 수 있는지 제어하는 서버 보안의 기본 단계입니다.',
    commands: [
      { id: 11, command: 'chmod 600 ~/.ssh/id_rsa', description: '개인 SSH 키를 소유자만 읽고 쓸 수 있게 제한합니다.', xp: 20, tokens: [{ label: 'chmod', meaning: '파일 권한 변경', tone: 'emerald' }, { label: '600', meaning: '소유자만 읽기/쓰기 허용', tone: 'rose' }, { label: '~/.ssh/id_rsa', meaning: '개인 SSH 키 파일', tone: 'slate' }] },
      { id: 12, command: 'chmod 755 /var/www/html', description: '웹 디렉토리를 소유자만 수정 가능하고 나머지는 읽기/실행만 가능하게 둡니다.', xp: 20, tokens: [{ label: 'chmod', meaning: '파일 또는 디렉토리 권한 변경', tone: 'emerald' }, { label: '755', meaning: '소유자 rwx, 그룹/기타 rx', tone: 'rose' }, { label: '/var/www/html', meaning: '웹 서비스 문서 루트', tone: 'slate' }] },
      { id: 13, command: 'chown www-data:www-data /var/www/html', description: '웹 파일 소유자를 웹 서버 계정으로 맞춥니다.', xp: 25, tokens: [{ label: 'chown', meaning: '소유자와 그룹 변경', tone: 'sky' }, { label: 'www-data:www-data', meaning: '웹 서버 사용자와 그룹', tone: 'amber' }, { label: '/var/www/html', meaning: '소유권을 바꿀 디렉토리', tone: 'slate' }] },
      { id: 14, command: 'sudo useradd -m -s /bin/bash deploy', description: '배포 전용 계정을 홈 디렉토리와 함께 생성합니다.', xp: 25, tokens: [{ label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' }, { label: 'useradd', meaning: '사용자 계정 생성', tone: 'emerald' }, { label: '-m', meaning: '홈 디렉토리 생성', tone: 'amber' }, { label: '-s /bin/bash', meaning: '로그인 셸 지정', tone: 'sky' }, { label: 'deploy', meaning: '새로 만들 사용자 이름', tone: 'slate' }] },
      { id: 15, command: 'passwd deploy', description: '새로 만든 사용자 계정의 비밀번호를 설정합니다.', xp: 20, tokens: [{ label: 'passwd', meaning: '사용자 비밀번호 설정', tone: 'emerald' }, { label: 'deploy', meaning: '비밀번호를 설정할 사용자', tone: 'slate' }] },
    ],
  },
  {
    id: 's4', order: 4, title: '프로세스와 네트워크', level: '중급',
    summary: '지금 서버에서 어떤 프로세스와 포트가 동작하는지 파악하는 단계입니다.',
    commands: [
      { id: 16, command: 'ps aux | grep nginx', description: '전체 프로세스 목록에서 nginx 관련 프로세스만 골라봅니다.', xp: 20, tokens: [{ label: 'ps aux', meaning: '전체 프로세스 목록 출력', tone: 'emerald' }, { label: '|', meaning: '앞 명령 결과를 뒤 명령 입력으로 전달', tone: 'amber' }, { label: 'grep nginx', meaning: 'nginx 문자열이 포함된 행만 필터링', tone: 'sky' }] },
      { id: 17, command: 'ss -tulnp', description: '열린 포트, 프로토콜, 연결 상태, 사용 중인 프로세스를 확인합니다.', xp: 25, tokens: [{ label: 'ss', meaning: '소켓과 포트 상태 조회', tone: 'emerald' }, { label: '-tulnp', meaning: 'TCP/UDP, listening, 프로세스 정보 포함', tone: 'rose' }] },
      { id: 18, command: 'df -h', description: '파일 시스템별 디스크 사용량을 사람이 읽기 쉬운 단위로 확인합니다.', xp: 20, tokens: [{ label: 'df', meaning: '디스크 사용량 조회', tone: 'sky' }, { label: '-h', meaning: 'GB, MB처럼 읽기 쉬운 단위로 표시', tone: 'amber' }] },
      { id: 19, command: 'free -h', description: '메모리와 스왑 사용량을 한눈에 파악합니다.', xp: 20, tokens: [{ label: 'free', meaning: '메모리 사용량 조회', tone: 'emerald' }, { label: '-h', meaning: '읽기 쉬운 단위로 출력', tone: 'amber' }] },
      { id: 20, command: 'top -bn1 | head -15', description: 'CPU와 메모리를 많이 쓰는 프로세스 상위 일부를 스냅샷으로 확인합니다.', xp: 25, tokens: [{ label: 'top', meaning: '실시간 프로세스 현황 표시', tone: 'emerald' }, { label: '-bn1', meaning: '배치 모드로 1회만 출력', tone: 'rose' }, { label: '|', meaning: '출력 결과 전달', tone: 'amber' }, { label: 'head -15', meaning: '앞 15줄만 잘라서 보기', tone: 'sky' }] },
    ],
  },
  {
    id: 's5', order: 5, title: '방화벽과 보안', level: '고급',
    summary: '서버 외부 노출과 권한 상승 위험을 실제로 점검하는 보안 심화 단계입니다.',
    commands: [
      { id: 21, command: 'sudo ufw allow 22/tcp', description: 'SSH 접속용 22번 포트를 방화벽 허용 목록에 추가합니다.', xp: 25, tokens: [{ label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' }, { label: 'ufw allow', meaning: '방화벽 허용 규칙 추가', tone: 'emerald' }, { label: '22/tcp', meaning: 'SSH용 TCP 22번 포트', tone: 'slate' }] },
      { id: 22, command: 'sudo ufw enable', description: '설정한 규칙을 기준으로 방화벽을 활성화합니다.', xp: 20, tokens: [{ label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' }, { label: 'ufw enable', meaning: 'UFW 방화벽 활성화', tone: 'emerald' }] },
      { id: 23, command: 'sudo fail2ban-client status sshd', description: 'SSH 무차별 대입 차단 상태와 jail 동작 여부를 확인합니다.', xp: 25, tokens: [{ label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' }, { label: 'fail2ban-client', meaning: 'Fail2ban 상태 조회 도구', tone: 'emerald' }, { label: 'status sshd', meaning: 'sshd jail 상태 확인', tone: 'sky' }] },
      { id: 24, command: 'sudo lastb | head -20', description: '최근 로그인 실패 기록의 앞부분만 빠르게 확인합니다.', xp: 25, tokens: [{ label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' }, { label: 'lastb', meaning: '실패한 로그인 기록 조회', tone: 'emerald' }, { label: '|', meaning: '출력 결과 전달', tone: 'amber' }, { label: 'head -20', meaning: '앞 20줄만 보기', tone: 'sky' }] },
      { id: 25, command: 'sudo find / -perm -4000 -type f', description: '권한 상승 위험이 있는 SUID 파일을 시스템 전체에서 찾습니다.', xp: 30, tokens: [{ label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' }, { label: 'find /', meaning: '루트부터 전체 파일 검색', tone: 'emerald' }, { label: '-perm -4000', meaning: 'SUID 비트가 설정된 파일 찾기', tone: 'amber' }, { label: '-type f', meaning: '일반 파일만 대상으로 제한', tone: 'sky' }] },
    ],
  },
];

/* ─── TypingLine ─── */
function TypingLine({
  command,
  onDone,
  onEnterNext,
  isDark,
  autoPlay,
  onTypeActivity,
  onStroke,
}: {
  command: string;
  onDone: () => void;
  onEnterNext: () => void;
  isDark: boolean;
  autoPlay?: boolean;
  onTypeActivity?: (cpm: number, isTyping: boolean) => void;
  onStroke?: () => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);
  const keyStamps = useRef<number[]>([]);
  const activityTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInput('');
    doneRef.current = false;
    keyStamps.current = [];
    if (onTypeActivity) onTypeActivity(0, false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [command]);

  const done = input === command;

  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [done, onDone]);

  // Ref to keep track of the latest onEnterNext without re-triggering the effect
  const onEnterNextRef = useRef(onEnterNext);
  useEffect(() => {
    onEnterNextRef.current = onEnterNext;
  }, [onEnterNext]);

  // ESC로 autoPlay가 꺼지면 즉시 input에 포커스를 돌려줌
  useEffect(() => {
    if (!autoPlay) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [autoPlay]);

  // Auto-play logic
  useEffect(() => {
    if (!autoPlay) return;
    if (!done) {
      const timer = setTimeout(() => {
        setInput((prev) => command.slice(0, prev.length + 1));
      }, 100); // typing speed (slower)
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        onEnterNextRef.current();
      }, 1500); // delay before advancing to next command
      return () => clearTimeout(timer);
    }
  }, [input, done, command, autoPlay]);

  // light: black cursor / dark: lime cursor
  const caretStyle = isDark
    ? 'border-l-[3px] border-[#d9f66f] animate-pulse'
    : 'border-l-[3px] border-black animate-pulse';
  // untyped chars
  const pendingCls = isDark ? 'text-neutral-600' : 'text-neutral-400';
  // correctly typed
  const correctCls = isDark ? 'text-neutral-200' : 'text-neutral-800';
  const wrongCls = isDark
    ? 'rounded-[4px] bg-red-900/50 text-red-400'
    : 'text-red-500';

  return (
    <div className="relative cursor-text w-full">
      <span className="pointer-events-none select-none font-mono text-2xl leading-relaxed tracking-wide">
        {command.split('').map((ch, i) => {
          // cursor sits before the current char
          const isCursor = i === input.length && !done;
          let cls = pendingCls;
          if (i < input.length) {
            cls = input[i] === ch ? correctCls : wrongCls;
          }
          return (
            <span key={i} className={`${isCursor ? caretStyle : ''} ${cls}`}>
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          );
        })}
        {/* cursor at end when all chars typed but not yet submitted */}
        {done && <span className={caretStyle}>&nbsp;</span>}
      </span>
      <input
        ref={inputRef}
        className="absolute inset-0 h-full w-full z-10 opacity-0 outline-none cursor-text"
        value={input}
        onChange={(e) => {
          if (done) return;
          const newVal = e.target.value.slice(0, command.length);
          if (newVal.length > input.length) {
            if (onStroke) onStroke();
          }
          setInput(newVal);

          if (onTypeActivity) {
            const now = Date.now();
            keyStamps.current.push(now);
            // 최근 2초 이내의 타격만 유지
            keyStamps.current = keyStamps.current.filter(t => now - t < 2000);
            
            // 2초 동안의 타수 * 30 = 분당 타수(CPM)
            const currentCpm = keyStamps.current.length * 30;
            onTypeActivity(currentCpm, true);

            if (activityTimer.current) clearTimeout(activityTimer.current);
            activityTimer.current = setTimeout(() => {
              onTypeActivity(0, false);
              keyStamps.current = [];
            }, 400); // 0.4초 동안 입력이 없으면 쉬는 상태로 간주
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && done) {
            e.preventDefault();
            onEnterNext();
          }
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}

function getTokenStyles(tone: TokenTone, isDark: boolean) {
  if (isDark) {
    switch (tone) {
      case 'emerald': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'sky': return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
      case 'amber': return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
      case 'rose': return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
      case 'slate': return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
      default: return 'border-neutral-500/30 bg-neutral-500/10 text-neutral-300';
    }
  } else {
    switch (tone) {
      case 'emerald': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'sky': return 'border-sky-200 bg-sky-50 text-sky-700';
      case 'amber': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'rose': return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'slate': return 'border-slate-200 bg-slate-50 text-slate-700';
      default: return 'border-neutral-200 bg-neutral-50 text-neutral-700';
    }
  }
}

/* ─── Main Page ─── */
export default function TypingGamePage() {
  const location = useLocation();
  const routeState = (location.state ?? {}) as TypingRouteState;
  const [stageIdx, setStageIdx] = useState(0);
  const [cmdIdx, setCmdIdx] = useState(0);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [showEnding, setShowEnding] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [eating, setEating] = useState(false);
  const [cpm, setCpm] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [stageStrokes, setStageStrokes] = useState(0);
  const [maxStageCpm, setMaxStageCpm] = useState(0);
  const [showStageReport, setShowStageReport] = useState(false);
  
  const theme = useUiStore((s) => s.theme);
  const { user } = useAuthStore();
  const username = user?.name || user?.email || 'Guest Agent';
  const isDark = theme === 'dark';
  const currentLineRef = useRef<HTMLDivElement>(null);

  const stage = STAGES[stageIdx];
  const cmd = stage.commands[cmdIdx];
  const isCurrentDone = doneIds.has(cmd.id);
  const isLastCmd = cmdIdx === stage.commands.length - 1;
  const isLastStage = stageIdx === STAGES.length - 1;

  const handleDone = () => {
    setDoneIds((prev) => new Set([...prev, cmd.id]));
    setEating(true);
    setTimeout(() => setEating(false), 800);
  };

  const goNextCmd = () => {
    if (!isLastCmd) setCmdIdx((i) => i + 1);
  };

  const goNextStage = () => {
    if (!isLastStage) { setStageIdx((i) => i + 1); setCmdIdx(0); }
  };

  // Enter key from TypingLine auto-advances
  const handleEnterNext = () => {
    if (!isLastCmd) goNextCmd();
    else if (!isLastStage) setShowStageReport(true);
    else setShowEnding(true);
  };

  const closeStageReportAndGoNext = () => {
    setShowStageReport(false);
    setStageStrokes(0);
    setMaxStageCpm(0);
    goNextStage();
  };

  const jumpTo = (si: number, ci: number) => {
    setStageIdx(si); setCmdIdx(ci); setSidebarOpen(false);
  };

  // Easter egg: Ctrl x 3
  const ctrlCount = useRef(0);
  const ctrlTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAutoPlay(false);
      }
      if (e.key === 'Control') {
        ctrlCount.current += 1;
        if (ctrlCount.current >= 3) {
          setAutoPlay(true);
          ctrlCount.current = 0;
        }
        if (ctrlTimeout.current) clearTimeout(ctrlTimeout.current);
        ctrlTimeout.current = setTimeout(() => {
          ctrlCount.current = 0;
        }, 1000);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (ctrlTimeout.current) clearTimeout(ctrlTimeout.current);
    };
  }, []);

  // Auto-scroll to the current typing line whenever the command changes
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (currentLineRef.current) {
        currentLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [cmdIdx, stageIdx]);

  // theme-aware classes
  const pageBg    = isDark ? 'bg-[#1a1a1a]' : 'bg-[#FAFAF7]';
  const borderCol = isDark ? 'border-neutral-700' : 'border-neutral-300';
  const doneCmd   = isDark ? 'text-neutral-500' : 'text-neutral-500';
  const doneDesc  = isDark ? 'text-neutral-600' : 'text-neutral-400';
  const upcomingCol = isDark ? 'text-neutral-700' : 'text-neutral-300';
  const stageTextCol = isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black';
  const summaryCol   = isDark ? 'text-neutral-500' : 'text-neutral-500';
  const btnBorder    = isDark ? 'border-neutral-500 text-neutral-400 hover:border-neutral-300 hover:text-neutral-200' : 'border-neutral-400 text-neutral-600 hover:border-neutral-700 hover:text-neutral-900';
  const nextStageBtnCls = isDark ? 'border-neutral-300 bg-neutral-200 text-neutral-900 hover:bg-white' : 'border-neutral-800 bg-neutral-800 text-white hover:bg-black';
  const currentListCls  = isDark ? 'text-neutral-500 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800';
  const descRevealCls   = isDark ? 'text-neutral-500' : 'text-neutral-500';

  // calculatons
  const totalXp = STAGES.flatMap(s => s.commands)
    .filter(c => doneIds.has(c.id))
    .reduce((sum, c) => sum + c.xp, 0);
  const progressCount = isCurrentDone ? cmdIdx + 1 : cmdIdx;
  const progressPercent = (progressCount / stage.commands.length) * 100;

  return (
    <div className={`relative flex min-h-screen flex-col ${pageBg}`}>
      <SiteHeader showSessionBar={false} />

      {/* vertically centered main — equal top/bottom space */}
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          {routeState.returnToScanId ? (
            <div className="mb-6">
              <Link
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition ${
                  isDark
                    ? 'border-neutral-600 text-neutral-300 hover:border-neutral-300 hover:text-white'
                    : 'border-neutral-300 text-neutral-600 hover:border-black hover:text-black'
                }`}
                state={{ projectId: routeState.projectId }}
                to={ROUTES.scanDetail.replace(':scanId', String(routeState.returnToScanId))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                스캔 화면으로 돌아가기
              </Link>
            </div>
          ) : null}

          {/* Top section: Goose, XP, and CURRENT LIST button */}
          <div className="flex items-end justify-between pb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex items-end h-[52px]">
                <PixelGoose 
                  mood={(eating || isTyping) ? 'eating' : isCurrentDone ? 'happy' : 'working'} 
                  size={52} 
                  className="transition-transform duration-[400ms] ease-out origin-bottom"
                  style={{ 
                    transform: `scaleX(${1 + Math.min(1.0, cpm / 600)}) scaleY(${1 + Math.min(0.5, cpm / 1200)})` 
                  }}
                />
              </div>
              <div>
                <div className={`text-base font-bold ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                  총 획득 포인트: <span className={isDark ? 'text-[#d9f66f]' : 'text-emerald-600'}>{totalXp} XP</span>
                </div>
                <div className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  현재 명령어: +{cmd.xp} XP
                </div>
              </div>
            </div>

            <button
              onClick={() => { setSidebarOpen(true); setSidebarTab(stageIdx); }}
              className={`flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-colors mb-1 ${currentListCls}`}
            >
              CURRENT LIST <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progress bar border */}
          <div className="relative h-[2px] w-full bg-neutral-200 dark:bg-neutral-800">
            <div 
              className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: isDark ? '#d9f66f' : '#000'
              }}
            />
          </div>

          {/* bordered typing box */}
          <div className={`border-b ${borderCol} py-10`}>

            {/* completed commands */}
            {stage.commands.slice(0, cmdIdx).map((c) => (
              <div key={c.id} className="mb-6">
                <p className={`font-mono text-2xl ${doneCmd}`}>{c.command}</p>
                {doneIds.has(c.id) && (
                  <div className="mt-2">
                    <p className={`text-base ${doneDesc}`}>{c.description}</p>
                    {c.tokens && c.tokens.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        {c.tokens.map((token, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${getTokenStyles(token.tone, isDark)}`}>
                              {token.label}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                              {token.meaning}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* current typing line */}
            <div ref={currentLineRef} className="mb-3 scroll-mt-32">
              <TypingLine
                command={cmd.command}
                onDone={handleDone}
                onEnterNext={handleEnterNext}
                isDark={isDark}
                autoPlay={autoPlay}
                onTypeActivity={(currentCpm, typingStatus) => {
                  setCpm(currentCpm);
                  setMaxStageCpm(prev => Math.max(prev, currentCpm));
                  setIsTyping(typingStatus);
                }}
                onStroke={() => setStageStrokes(prev => prev + 1)}
              />
            </div>

            {/* description fade-in after done */}
            <div
              className={`overflow-hidden transition-all duration-500 ${isCurrentDone ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <p className={`mt-1.5 text-base ${descRevealCls}`}>{cmd.description}</p>
              
              {/* Tokens breakdown */}
              {cmd.tokens && cmd.tokens.length > 0 && (
                <div className="mt-4 flex flex-col gap-2.5">
                  {cmd.tokens.map((token, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className={`shrink-0 inline-flex items-center justify-center rounded border px-2 py-1 font-mono text-xs font-bold ${getTokenStyles(token.tone, isDark)}`}>
                        {token.label}
                      </span>
                      <span className={`mt-0.5 text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {token.meaning}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* upcoming — grayed preview */}
            {stage.commands.slice(cmdIdx + 1).map((c) => (
              <p key={c.id} className={`mt-6 font-mono text-2xl ${upcomingCol}`}>
                {c.command}
              </p>
            ))}
          </div>

          {/* bottom stage info */}
          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <button
                onClick={goNextStage}
                disabled={isLastStage}
                className={`flex items-center gap-2 text-sm font-semibold transition-colors ${stageTextCol} ${isLastStage ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
              >
                <ChevronRight className="h-4 w-4" />
                <span>{stage.order}단계 · {stage.title}</span>
              </button>
              <p className={`mt-1 pl-6 text-sm ${summaryCol}`}>{stage.summary}</p>
            </div>

            <div className="shrink-0">
              {isCurrentDone && !isLastCmd && (
                <button
                  onClick={goNextCmd}
                  className={`flex items-center gap-1 border bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${btnBorder}`}
                >
                  다음 명령어 <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {isCurrentDone && isLastCmd && !isLastStage && (
                <button
                  onClick={goNextStage}
                  className={`flex items-center gap-1 border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${nextStageBtnCls}`}
                >
                  다음 단계 <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {isCurrentDone && isLastCmd && isLastStage && (
                <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-[#d9f66f]' : 'text-emerald-600'} animate-pulse`}>
                  <Check className="h-4 w-4" /> 엔터(Enter)를 눌러 완료하세요
                </span>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── sidebar ── */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-neutral-900/20"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className={`fixed right-0 top-0 z-50 flex h-full w-[340px] flex-col shadow-2xl ${
            isDark ? 'bg-[#1e1e1e]' : 'bg-white'
          }`}>
            {/* header */}
            <div className={`flex items-center justify-between border-b px-6 py-5 ${
              isDark ? 'border-neutral-700' : 'border-neutral-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`flex h-2.5 w-2.5 rounded-full ${isDark ? 'bg-[#d9f66f] shadow-[0_0_8px_rgba(217,246,111,0.6)]' : 'bg-[#9FCC2E] shadow-[0_0_8px_rgba(159,204,46,0.6)]'}`} />
                <span className={`text-base font-black tracking-tight ${
                  isDark ? 'text-neutral-100' : 'text-neutral-900'
                }`}>Current List</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className={`transition-colors ${
                isDark ? 'text-neutral-500 hover:text-neutral-100' : 'text-neutral-400 hover:text-black'
              }`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* stage tabs */}
            <div className={`flex overflow-x-auto border-b px-2 ${
              isDark ? 'border-neutral-700' : 'border-neutral-200'
            }`}>
              {STAGES.map((s, si) => (
                <button
                  key={s.id}
                  onClick={() => setSidebarTab(si)}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-3 text-sm transition-colors ${
                    sidebarTab === si
                      ? isDark
                        ? 'border-b-2 border-[#d9f66f] font-black text-[#d9f66f]'
                        : 'border-b-2 border-[#9FCC2E] font-black text-black'
                      : isDark
                        ? 'font-semibold text-neutral-600 hover:text-neutral-400'
                        : 'font-semibold text-neutral-400 hover:text-neutral-700'
                  }`}
                >
                  {s.order}단계
                </button>
              ))}
            </div>

            {/* stage summary */}
            <div className={`border-b px-6 py-3 ${
              isDark ? 'border-neutral-800' : 'border-neutral-100'
            }`}>
              <p className={`text-xs leading-5 ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}>{STAGES[sidebarTab].summary}</p>
            </div>

            {/* command list */}
            <div className="flex-1 overflow-y-auto">
              {STAGES[sidebarTab].commands.map((c, ci) => {
                const isCurrent = sidebarTab === stageIdx && ci === cmdIdx;
                const isDone = doneIds.has(c.id);
                const rowBg = isCurrent
                  ? isDark ? 'bg-[#d9f66f]/5' : 'bg-[#F9FDE3]'
                  : isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-50';
                return (
                  <button
                    key={c.id}
                    onClick={() => jumpTo(sidebarTab, ci)}
                    className={`relative flex w-full items-start gap-4 border-b px-6 py-4 text-left transition-colors ${
                      isDark ? 'border-neutral-800' : 'border-neutral-100'
                    } ${rowBg}`}
                  >
                    {isCurrent && (
                      <div className={`absolute left-0 top-0 h-full w-1 ${isDark ? 'bg-[#d9f66f]' : 'bg-[#9FCC2E]'}`} />
                    )}
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                        isDone
                          ? isDark ? 'border-neutral-300 bg-neutral-300 text-neutral-900' : 'border-neutral-800 bg-neutral-800 text-white'
                          : isCurrent
                            ? isDark ? 'border-2 border-[#d9f66f] bg-[#d9f66f]/20 text-[#d9f66f]' : 'border-2 border-[#9FCC2E] bg-[#D4FC64] text-black'
                            : isDark ? 'border-neutral-600 text-neutral-600' : 'border-neutral-300 text-neutral-400'
                      }`}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : ci + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-mono text-sm font-semibold ${
                        isDark ? 'text-neutral-200' : 'text-neutral-800'
                      }`}>{c.command}</p>
                      <p className={`mt-0.5 text-xs leading-5 ${
                        isDark ? 'text-neutral-500' : 'text-neutral-500'
                      }`}>{c.description}</p>
                    </div>
                    <List className={`mt-1 h-4 w-4 shrink-0 ${
                      isDark ? 'text-neutral-600' : 'text-neutral-300'
                    }`} />
                  </button>
                );
              })}
            </div>
          </aside>
        </>
      )}

      {/* Stage Report Overlay */}
      {showStageReport && (
        <TypingStageReportModal
          stageOrder={stage.order}
          stageTitle={stage.title}
          username={username}
          strokes={stageStrokes}
          maxCpm={maxStageCpm}
          isDark={isDark}
          onNext={closeStageReportAndGoNext}
        />
      )}

      {/* Ending Overlay */}
      {showEnding && <TypingGameEnding onClose={() => setShowEnding(false)} />}
    </div>
  );
}
