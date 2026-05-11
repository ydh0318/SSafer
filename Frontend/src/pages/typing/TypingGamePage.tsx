import { Check, ChevronRight, Info, List, Shield, TerminalSquare, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';

import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import SiteHeader from '../../components/layout/SiteHeader';

type TokenTone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

type CommandToken = {
  label: string;
  meaning: string;
  tone: TokenTone;
};

type TypingCommand = {
  id: number;
  command: string;
  description: string;
  xp: number;
  tokens: CommandToken[];
};

type TypingStage = {
  id: string;
  order: number;
  title: string;
  level: string;
  summary: string;
  commands: TypingCommand[];
};

const TOKEN_STYLES: Record<TokenTone, { badge: string; line: string }> = {
  emerald: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    line: 'border-emerald-300 bg-emerald-50/70',
  },
  sky: {
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    line: 'border-sky-300 bg-sky-50/70',
  },
  amber: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    line: 'border-amber-300 bg-amber-50/70',
  },
  rose: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    line: 'border-rose-300 bg-rose-50/70',
  },
  slate: {
    badge: 'border-neutral-200 bg-neutral-100 text-neutral-700',
    line: 'border-neutral-300 bg-neutral-50',
  },
};

const typingStages: TypingStage[] = [
  {
    id: 'stage-1',
    order: 1,
    title: '기본 탐색',
    level: '초급',
    summary: '서버에 처음 접속했을 때 현재 위치와 파일 구조를 파악하는 단계입니다.',
    commands: [
      {
        id: 1,
        command: 'pwd',
        description: '현재 내가 어느 디렉토리에 있는지 확인합니다.',
        xp: 10,
        tokens: [{ label: 'pwd', meaning: '현재 작업 디렉토리 출력', tone: 'emerald' }],
      },
      {
        id: 2,
        command: 'ls',
        description: '현재 위치의 파일과 폴더 목록을 빠르게 확인합니다.',
        xp: 10,
        tokens: [{ label: 'ls', meaning: '파일과 디렉토리 목록 출력', tone: 'sky' }],
      },
      {
        id: 3,
        command: 'ls -la',
        description: '숨김 파일을 포함해 권한, 크기, 수정 시각까지 자세히 확인합니다.',
        xp: 15,
        tokens: [
          { label: 'ls', meaning: '파일과 디렉토리 목록 출력', tone: 'sky' },
          { label: '-l', meaning: '권한, 크기, 날짜 등 상세 정보 표시', tone: 'amber' },
          { label: '-a', meaning: '숨김 파일까지 포함해서 표시', tone: 'rose' },
        ],
      },
      {
        id: 4,
        command: 'cd /var/log',
        description: '시스템 로그가 모이는 디렉토리로 이동합니다.',
        xp: 15,
        tokens: [
          { label: 'cd', meaning: '다른 디렉토리로 이동', tone: 'emerald' },
          { label: '/var/log', meaning: '시스템 로그 디렉토리', tone: 'slate' },
        ],
      },
      {
        id: 5,
        command: 'cat /etc/hostname',
        description: '호스트 이름 파일 내용을 바로 출력합니다.',
        xp: 15,
        tokens: [
          { label: 'cat', meaning: '파일 내용을 그대로 출력', tone: 'sky' },
          { label: '/etc/hostname', meaning: '서버 호스트 이름이 저장된 파일', tone: 'slate' },
        ],
      },
    ],
  },
  {
    id: 'stage-2',
    order: 2,
    title: '파일 다루기',
    level: '초급',
    summary: '파일 생성, 복사, 검색, 로그 확인처럼 자주 쓰는 기본 조작을 익힙니다.',
    commands: [
      {
        id: 6,
        command: 'mkdir -p /home/user/projects',
        description: '중간 경로가 없어도 프로젝트 디렉토리를 한 번에 생성합니다.',
        xp: 15,
        tokens: [
          { label: 'mkdir', meaning: '디렉토리 생성', tone: 'emerald' },
          { label: '-p', meaning: '중간 경로가 없어도 함께 생성', tone: 'amber' },
          { label: '/home/user/projects', meaning: '만들 대상 경로', tone: 'slate' },
        ],
      },
      {
        id: 7,
        command: 'cp config.yaml config.yaml.bak',
        description: '수정 전에 설정 파일 백업본을 만들어 둡니다.',
        xp: 15,
        tokens: [
          { label: 'cp', meaning: '파일 복사', tone: 'sky' },
          { label: 'config.yaml', meaning: '원본 설정 파일', tone: 'slate' },
          { label: 'config.yaml.bak', meaning: '백업 파일 이름', tone: 'rose' },
        ],
      },
      {
        id: 8,
        command: 'grep -r "error" /var/log/',
        description: '로그 디렉토리 전체에서 error 문자열을 재귀적으로 검색합니다.',
        xp: 20,
        tokens: [
          { label: 'grep', meaning: '문자열 패턴 검색', tone: 'emerald' },
          { label: '-r', meaning: '하위 디렉토리까지 재귀 검색', tone: 'amber' },
          { label: '"error"', meaning: '찾고 싶은 문자열', tone: 'rose' },
          { label: '/var/log/', meaning: '검색 대상 디렉토리', tone: 'slate' },
        ],
      },
      {
        id: 9,
        command: 'tail -f /var/log/syslog',
        description: '로그 파일 끝부분을 실시간으로 따라가며 모니터링합니다.',
        xp: 20,
        tokens: [
          { label: 'tail', meaning: '파일 끝부분 출력', tone: 'sky' },
          { label: '-f', meaning: '새 로그가 생기면 계속 따라감', tone: 'amber' },
          { label: '/var/log/syslog', meaning: '실시간 확인할 로그 파일', tone: 'slate' },
        ],
      },
      {
        id: 10,
        command: 'head -20 /etc/passwd',
        description: '계정 정보 파일의 앞 20줄만 빠르게 확인합니다.',
        xp: 20,
        tokens: [
          { label: 'head', meaning: '파일 앞부분 출력', tone: 'emerald' },
          { label: '-20', meaning: '앞 20줄만 표시', tone: 'amber' },
          { label: '/etc/passwd', meaning: '사용자 계정 정보 파일', tone: 'slate' },
        ],
      },
    ],
  },
  {
    id: 'stage-3',
    order: 3,
    title: '권한과 사용자 관리',
    level: '중급',
    summary: '누가 읽고 쓰고 실행할 수 있는지 제어하는 서버 보안의 기본 단계입니다.',
    commands: [
      {
        id: 11,
        command: 'chmod 600 ~/.ssh/id_rsa',
        description: '개인 SSH 키를 소유자만 읽고 쓸 수 있게 제한합니다.',
        xp: 20,
        tokens: [
          { label: 'chmod', meaning: '파일 권한 변경', tone: 'emerald' },
          { label: '600', meaning: '소유자만 읽기/쓰기 허용', tone: 'rose' },
          { label: '~/.ssh/id_rsa', meaning: '개인 SSH 키 파일', tone: 'slate' },
        ],
      },
      {
        id: 12,
        command: 'chmod 755 /var/www/html',
        description: '웹 디렉토리를 소유자만 수정 가능하고 나머지는 읽기/실행만 가능하게 둡니다.',
        xp: 20,
        tokens: [
          { label: 'chmod', meaning: '파일 또는 디렉토리 권한 변경', tone: 'emerald' },
          { label: '755', meaning: '소유자 rwx, 그룹/기타 rx', tone: 'rose' },
          { label: '/var/www/html', meaning: '웹 서비스 문서 루트', tone: 'slate' },
        ],
      },
      {
        id: 13,
        command: 'chown www-data:www-data /var/www/html',
        description: '웹 파일 소유자를 웹 서버 계정으로 맞춥니다.',
        xp: 25,
        tokens: [
          { label: 'chown', meaning: '소유자와 그룹 변경', tone: 'sky' },
          { label: 'www-data:www-data', meaning: '웹 서버 사용자와 그룹', tone: 'amber' },
          { label: '/var/www/html', meaning: '소유권을 바꿀 디렉토리', tone: 'slate' },
        ],
      },
      {
        id: 14,
        command: 'sudo useradd -m -s /bin/bash deploy',
        description: '배포 전용 계정을 홈 디렉토리와 함께 생성합니다.',
        xp: 25,
        tokens: [
          { label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' },
          { label: 'useradd', meaning: '사용자 계정 생성', tone: 'emerald' },
          { label: '-m', meaning: '홈 디렉토리 생성', tone: 'amber' },
          { label: '-s /bin/bash', meaning: '로그인 셸 지정', tone: 'sky' },
          { label: 'deploy', meaning: '새로 만들 사용자 이름', tone: 'slate' },
        ],
      },
      {
        id: 15,
        command: 'passwd deploy',
        description: '새로 만든 사용자 계정의 비밀번호를 설정합니다.',
        xp: 20,
        tokens: [
          { label: 'passwd', meaning: '사용자 비밀번호 설정', tone: 'emerald' },
          { label: 'deploy', meaning: '비밀번호를 설정할 사용자', tone: 'slate' },
        ],
      },
    ],
  },
  {
    id: 'stage-4',
    order: 4,
    title: '프로세스와 네트워크',
    level: '중급',
    summary: '지금 서버에서 어떤 프로세스와 포트가 동작하는지 파악하는 단계입니다.',
    commands: [
      {
        id: 16,
        command: 'ps aux | grep nginx',
        description: '전체 프로세스 목록에서 nginx 관련 프로세스만 골라봅니다.',
        xp: 20,
        tokens: [
          { label: 'ps aux', meaning: '전체 프로세스 목록 출력', tone: 'emerald' },
          { label: '|', meaning: '앞 명령 결과를 뒤 명령 입력으로 전달', tone: 'amber' },
          { label: 'grep nginx', meaning: 'nginx 문자열이 포함된 행만 필터링', tone: 'sky' },
        ],
      },
      {
        id: 17,
        command: 'ss -tulnp',
        description: '열린 포트, 프로토콜, 연결 상태, 사용 중인 프로세스를 확인합니다.',
        xp: 25,
        tokens: [
          { label: 'ss', meaning: '소켓과 포트 상태 조회', tone: 'emerald' },
          { label: '-tulnp', meaning: 'TCP/UDP, listening, 프로세스 정보 포함', tone: 'rose' },
        ],
      },
      {
        id: 18,
        command: 'df -h',
        description: '파일 시스템별 디스크 사용량을 사람이 읽기 쉬운 단위로 확인합니다.',
        xp: 20,
        tokens: [
          { label: 'df', meaning: '디스크 사용량 조회', tone: 'sky' },
          { label: '-h', meaning: 'GB, MB처럼 읽기 쉬운 단위로 표시', tone: 'amber' },
        ],
      },
      {
        id: 19,
        command: 'free -h',
        description: '메모리와 스왑 사용량을 한눈에 파악합니다.',
        xp: 20,
        tokens: [
          { label: 'free', meaning: '메모리 사용량 조회', tone: 'emerald' },
          { label: '-h', meaning: '읽기 쉬운 단위로 출력', tone: 'amber' },
        ],
      },
      {
        id: 20,
        command: 'top -bn1 | head -15',
        description: 'CPU와 메모리를 많이 쓰는 프로세스 상위 일부를 스냅샷으로 확인합니다.',
        xp: 25,
        tokens: [
          { label: 'top', meaning: '실시간 프로세스 현황 표시', tone: 'emerald' },
          { label: '-bn1', meaning: '배치 모드로 1회만 출력', tone: 'rose' },
          { label: '|', meaning: '출력 결과 전달', tone: 'amber' },
          { label: 'head -15', meaning: '앞 15줄만 잘라서 보기', tone: 'sky' },
        ],
      },
    ],
  },
  {
    id: 'stage-5',
    order: 5,
    title: '방화벽과 보안',
    level: '고급',
    summary: '서버 외부 노출과 권한 상승 위험을 실제로 점검하는 보안 심화 단계입니다.',
    commands: [
      {
        id: 21,
        command: 'sudo ufw allow 22/tcp',
        description: 'SSH 접속용 22번 포트를 방화벽 허용 목록에 추가합니다.',
        xp: 25,
        tokens: [
          { label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' },
          { label: 'ufw allow', meaning: '방화벽 허용 규칙 추가', tone: 'emerald' },
          { label: '22/tcp', meaning: 'SSH용 TCP 22번 포트', tone: 'slate' },
        ],
      },
      {
        id: 22,
        command: 'sudo ufw enable',
        description: '설정한 규칙을 기준으로 방화벽을 활성화합니다.',
        xp: 20,
        tokens: [
          { label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' },
          { label: 'ufw enable', meaning: 'UFW 방화벽 활성화', tone: 'emerald' },
        ],
      },
      {
        id: 23,
        command: 'sudo fail2ban-client status sshd',
        description: 'SSH 무차별 대입 차단 상태와 jail 동작 여부를 확인합니다.',
        xp: 25,
        tokens: [
          { label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' },
          { label: 'fail2ban-client', meaning: 'Fail2ban 상태 조회 도구', tone: 'emerald' },
          { label: 'status sshd', meaning: 'sshd jail 상태 확인', tone: 'sky' },
        ],
      },
      {
        id: 24,
        command: 'sudo lastb | head -20',
        description: '최근 로그인 실패 기록의 앞부분만 빠르게 확인합니다.',
        xp: 25,
        tokens: [
          { label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' },
          { label: 'lastb', meaning: '실패한 로그인 기록 조회', tone: 'emerald' },
          { label: '|', meaning: '출력 결과 전달', tone: 'amber' },
          { label: 'head -20', meaning: '앞 20줄만 보기', tone: 'sky' },
        ],
      },
      {
        id: 25,
        command: 'sudo find / -perm -4000 -type f',
        description: '권한 상승 위험이 있는 SUID 파일을 시스템 전체에서 찾습니다.',
        xp: 30,
        tokens: [
          { label: 'sudo', meaning: '관리자 권한으로 실행', tone: 'rose' },
          { label: 'find /', meaning: '루트부터 전체 파일 검색', tone: 'emerald' },
          { label: '-perm -4000', meaning: 'SUID 비트가 설정된 파일 찾기', tone: 'amber' },
          { label: '-type f', meaning: '일반 파일만 대상으로 제한', tone: 'sky' },
        ],
      },
      {
        id: 26,
        command: 'sudo apt update && sudo apt upgrade -y',
        description: '패키지 목록을 갱신하고 보안 패치를 포함한 시스템 업데이트를 수행합니다.',
        xp: 35,
        tokens: [
          { label: 'sudo apt update', meaning: '패키지 인덱스 갱신', tone: 'emerald' },
          { label: '&&', meaning: '앞 명령 성공 시 다음 명령 실행', tone: 'amber' },
          { label: 'sudo apt upgrade -y', meaning: '업데이트 자동 승인 후 설치', tone: 'rose' },
        ],
      },
    ],
  },
];

function TypingGamePage() {
  const [activeStageId, setActiveStageId] = useState(typingStages[0].id);
  const [activeCommandId, setActiveCommandId] = useState(typingStages[0].commands[0].id);
  const [completedCommandIds, setCompletedCommandIds] = useState<number[]>([]);

  const activeStage = useMemo(
    () => typingStages.find((stage) => stage.id === activeStageId) ?? typingStages[0],
    [activeStageId],
  );

  const activeCommand = useMemo(
    () => activeStage.commands.find((command) => command.id === activeCommandId) ?? activeStage.commands[0],
    [activeCommandId, activeStage],
  );

  const totalCommands = typingStages.reduce((sum, stage) => sum + stage.commands.length, 0);
  const totalXp = typingStages
    .flatMap((stage) => stage.commands)
    .filter((command) => completedCommandIds.includes(command.id))
    .reduce((sum, command) => sum + command.xp, 0);

  const activeStageCompleted = activeStage.commands.filter((command) =>
    completedCommandIds.includes(command.id),
  ).length;

  const handleStageSelect = (stageId: string) => {
    const nextStage = typingStages.find((stage) => stage.id === stageId);
    if (!nextStage) {
      return;
    }

    setActiveStageId(stageId);
    setActiveCommandId(nextStage.commands[0].id);
  };

  const handleCommandComplete = (commandId: number) => {
    setCompletedCommandIds((current) => (current.includes(commandId) ? current : [...current, commandId]));
  };

  const handleNextCommand = () => {
    const index = activeStage.commands.findIndex((command) => command.id === activeCommand.id);
    const nextCommand = activeStage.commands[index + 1];
    if (nextCommand) {
      setActiveCommandId(nextCommand.id);
    }
  };

  return (
    <div className="site-shell-with-nav min-h-screen bg-[#f3f1ea] text-black">
      <SiteHeader showSessionBar={false} />

      <main className="site-shell-main min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <section className="relative overflow-hidden border-2 border-black bg-[linear-gradient(135deg,#fffef6_0%,#f2efe2_48%,#ece8d7_100%)] p-8 shadow-[8px_8px_0_0_#111111]">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-[#d9f66f]" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-neutral-500">
                  <TerminalSquare className="h-3.5 w-3.5" />
                  linux security typing lab
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                  서버 명령어를 손에 익히는 단계별 타이핑 훈련
                </h1>
                <p className="mt-4 text-base leading-7 text-neutral-700">
                  단계 탭은 자유롭게 이동할 수 있고, 원하는 명령어만 골라 연습해도 됩니다. 명령어 아래에는
                  각 파트를 색상으로 나눠 한 줄씩 설명해 두어, 왜 그 옵션을 쓰는지 바로 이해할 수 있게
                  구성합니다.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="border-2 border-black bg-black px-5 py-4 text-right text-white">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d9f66f]">progress</div>
                  <div className="mt-2 text-4xl font-black">{completedCommandIds.length}</div>
                  <div className="text-xs text-neutral-400">{totalCommands}개 명령어 중 완료</div>
                </div>
                <div className="border-2 border-black bg-white px-5 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">earned xp</div>
                  <div className="mt-2 flex items-end gap-3">
                    <div className="text-4xl font-black">{totalXp}</div>
                    <div className="pb-1 text-sm text-neutral-500">포인트</div>
                  </div>
                </div>
                <PixelGoose mood="working" size={90} />
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[280px_360px_minmax(0,1fr)]">
            <aside className="space-y-6">
              <div className="border border-neutral-200 bg-white">
                <div className="border-b border-neutral-200 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Shield className="h-4 w-4" />
                    단계별 탭
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    전체 공개형 구성입니다. 원하는 단계부터 자유롭게 선택해 연습하세요.
                  </p>
                </div>

                <div className="p-3">
                  {typingStages.map((stage) => {
                    const isActive = stage.id === activeStage.id;
                    const doneCount = stage.commands.filter((command) =>
                      completedCommandIds.includes(command.id),
                    ).length;

                    return (
                      <button
                        key={stage.id}
                        onClick={() => handleStageSelect(stage.id)}
                        type="button"
                        className={`mb-2 w-full border px-4 py-4 text-left transition last:mb-0 ${
                          isActive
                            ? 'border-black bg-black text-white'
                            : 'border-neutral-200 bg-[#faf9f4] text-black hover:bg-[#f1efe6]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div
                              className={`text-[11px] font-bold uppercase tracking-[0.24em] ${
                                isActive ? 'text-[#d9f66f]' : 'text-neutral-400'
                              }`}
                            >
                              {stage.order}단계 · {stage.level}
                            </div>
                            <div className="mt-2 text-base font-black">{stage.title}</div>
                          </div>
                          <div
                            className={`min-w-fit border px-2 py-1 text-xs font-bold ${
                              isActive ? 'border-white/30 bg-white/10 text-white' : 'border-neutral-200 bg-white'
                            }`}
                          >
                            {doneCount}/{stage.commands.length}
                          </div>
                        </div>
                        <p className={`mt-3 text-sm leading-6 ${isActive ? 'text-neutral-200' : 'text-neutral-600'}`}>
                          {stage.summary}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-neutral-200 bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Trophy className="h-4 w-4" />
                  학습 메모
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">
                  <li>명령어는 순서대로 풀 필요 없이 필요한 것만 바로 연습할 수 있습니다.</li>
                  <li>복합 명령은 `|`, `&&`, 옵션까지 나눠 설명해 실무 문맥을 이해하도록 구성합니다.</li>
                  <li>다른 페이지나 API 호출과 연결되지 않는 정적 학습 화면으로 유지합니다.</li>
                </ul>
              </div>
            </aside>

            <aside className="space-y-6">
              <div className="overflow-hidden border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <List className="h-4 w-4" />
                      Current List
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">{activeStage.summary}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                      topic mode
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-700">
                      {activeStage.order}단계 · {activeStage.level}
                    </div>
                  </div>
                </div>

                <div>
                  {activeStage.commands.map((command) => {
                    const isDone = completedCommandIds.includes(command.id);
                    const isActive = command.id === activeCommand.id;

                    return (
                      <button
                        key={command.id}
                        onClick={() => setActiveCommandId(command.id)}
                        type="button"
                        className={`grid w-full grid-cols-[52px_minmax(0,1fr)_44px] items-start border-b border-neutral-200 text-left transition last:border-b-0 ${
                          isActive ? 'bg-[#f2efe6]' : 'bg-white hover:bg-[#faf9f4]'
                        }`}
                      >
                        <div className="flex h-full items-start justify-center px-3 py-5 text-xl font-black text-neutral-900">
                          {command.id}
                        </div>
                        <div className="min-w-0 border-l border-r border-neutral-200 px-4 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                              command
                            </span>
                            <span className="text-[11px] font-bold text-neutral-500">+{command.xp} XP</span>
                          </div>
                          <div className="mt-2 overflow-x-auto font-mono text-[15px] font-bold text-neutral-900">
                            {command.command}
                          </div>
                          <p className="mt-3 text-sm leading-6 text-neutral-600">{command.description}</p>
                        </div>
                        <div className="flex h-full items-center justify-center px-3 py-5">
                          <div
                            className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${
                              isDone
                                ? 'border-[#d9f66f] bg-[#d9f66f] text-black'
                                : isActive
                                  ? 'border-black bg-black text-white'
                                  : 'border-neutral-300 bg-neutral-100 text-neutral-500'
                            }`}
                          >
                            {isDone ? <Check className="h-4 w-4" /> : 'i'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border border-neutral-200 bg-white p-5">
                <div className="text-sm font-bold">현재 단계 진행도</div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full bg-[#d9f66f] transition-all"
                      style={{ width: `${(activeStageCompleted / activeStage.commands.length) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm font-bold text-neutral-700">
                    {activeStageCompleted}/{activeStage.commands.length}
                  </div>
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="border-2 border-black bg-white">
                <div className="flex flex-col gap-4 border-b-2 border-black bg-black px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d9f66f]">
                      {activeStage.order}단계 · {activeStage.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-300">
                      <span>{activeStage.level}</span>
                      <span>·</span>
                      <span>명령어 #{activeCommand.id}</span>
                      <span>·</span>
                      <span>+{activeCommand.xp} XP</span>
                    </div>
                  </div>
                  <PixelGoose mood="happy" size={44} />
                </div>

                <div className="p-6 sm:p-8">
                  <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{activeCommand.command}</h2>
                  <p className="mt-4 flex items-start gap-2 text-sm leading-7 text-neutral-700 sm:text-base">
                    <Info className="mt-1 h-4 w-4 shrink-0" />
                    <span>{activeCommand.description}</span>
                  </p>

                  <div className="mt-8">
                    <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">command box</div>
                    <div className="mt-3 overflow-x-auto border border-neutral-200 bg-[#151515] p-4 font-mono text-sm text-white sm:text-base">
                      {activeCommand.command}
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">
                      part by part
                    </div>
                    <div className="mt-4 space-y-3">
                      {activeCommand.tokens.map((token) => (
                        <div
                          key={`${activeCommand.id}-${token.label}`}
                          className={`border p-4 ${TOKEN_STYLES[token.tone].line}`}
                        >
                          <div
                            className={`inline-flex border px-2 py-1 font-mono text-xs font-bold ${TOKEN_STYLES[token.tone].badge}`}
                          >
                            {token.label}
                          </div>
                          <div className="mt-3 text-sm leading-6 text-neutral-700">{token.meaning}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">
                      type this command
                    </div>
                    <div className="mt-3">
                      <TypingBox
                        key={activeCommand.id}
                        onComplete={() => handleCommandComplete(activeCommand.id)}
                        rewardLabel={`+${activeCommand.xp} XP`}
                        snippet={activeCommand.command}
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-4 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-neutral-600">
                      원하는 명령어만 골라 연습해도 되지만, 단계 안에서 순서대로 보면 흐름을 익히기 좋습니다.
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400"
                      disabled={activeStage.commands[activeStage.commands.length - 1]?.id === activeCommand.id}
                      onClick={handleNextCommand}
                      type="button"
                    >
                      다음 명령어
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}

export default TypingGamePage;
