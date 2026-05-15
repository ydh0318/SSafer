import { AlertTriangle, ArrowRight, Check, Copy, Eye, EyeOff, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

/* ─────────────────────── 데이터 ─────────────────────── */

const guideSections = [
  {
    id: 0,
    category: 'CLI',
    title: '로컬 프로젝트 스캔',
    summary: '.env · Dockerfile · docker-compose.yml 등 설정 파일을 검사하고 웹으로 결과를 업로드합니다.',
  },
  {
    id: 1,
    category: 'AGENT',
    title: 'Agent 스캔',
    summary: 'Agent가 실행 중이면 웹 버튼 하나로 현재 서버가 스캔과 업로드를 한 번에 처리합니다.',
  },
  {
    id: 2,
    category: 'PATCH',
    title: '수정 적용',
    summary: '웹 Finding 상세에서 diff를 확인하고 패치를 승인하면 Agent가 실제 파일을 수정합니다.',
  },
  {
    id: 3,
    category: 'SERVER',
    title: '서버 점검',
    summary: '열린 포트 · 프로세스 · Docker · SSH · 방화벽 상태를 EC2 서버 내부에서 직접 점검합니다.',
  },
] as const;

const tips = [
  'ssafer run만 실행하면 로컬 .ssafer/results에만 저장됩니다. 웹에서 결과를 보려면 --upload를 붙이거나 이후 ssafer upload를 별도로 실행하세요.',
  'Agent가 ONLINE 상태일 때만 웹에서 스캔을 시작할 수 있습니다. ssafer agent 실행 후 웹에서 상태를 확인하세요.',
  '자동 수정은 patch payload가 있는 finding에만 가능합니다. patch가 없는 finding은 권장 조치 가이드만 표시됩니다.',
  'cd ~ 에서 실행을 권장합니다. /var/lib 등 권한 제한 경로에서는 결과 파일 저장에 실패할 수 있습니다.',
];

const nextSteps = [
  'ssafer login 후 프로젝트 루트에서 ssafer run --upload 로 첫 스캔을 웹에 올려보세요.',
  'ssafer agent 실행 후 웹 프로젝트 화면에서 Agent 스캔 버튼을 눌러보세요.',
  '웹 Finding 상세에서 diff를 확인하고 패치 적용 승인 버튼을 눌러보세요.',
  '홈 디렉터리에서 ssafer server --upload 로 서버 점검 결과를 웹에서 바로 확인해보세요.',
];

/* ─────────────────────── 공통 컴포넌트 ─────────────────────── */

interface CmdLine {
  comment?: string;
  cmd: string;
}

function Terminal_({ lines }: { lines: CmdLine[] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-[#0D0D0D]">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      </div>
      {/* lines */}
      <div className="px-5 py-4 space-y-0.5">
        {lines.map((line, idx) => {
          const isComment = !!line.comment;
          return (
            <div key={idx}>
              {isComment && (
                <p className="font-mono text-[11px] text-neutral-500 pt-2 first:pt-0"># {line.comment}</p>
              )}
              <div className="group flex items-center justify-between">
                <p className="font-mono text-[13px] leading-7 text-green-400">
                  <span className="text-neutral-600 select-none mr-1.5">$</span>
                  {line.cmd}
                </p>
                <button
                  onClick={() => copy(line.cmd, idx)}
                  type="button"
                  aria-label={`${line.cmd} 복사`}
                  className="ml-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-500 hover:text-[#D4FC64]"
                >
                  {copiedIdx === idx
                    ? <Check className="h-3.5 w-3.5 text-[#D4FC64]" />
                    : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      <p className="text-[12.5px] leading-relaxed text-amber-800">{children}</p>
    </div>
  );
}

interface StepProps {
  num: string;
  label: string;
  desc: string;
  isLast?: boolean;
  children: React.ReactNode;
}

function Step({ num, label, desc, isLast, children }: StepProps) {
  return (
    <div className="flex gap-5">
      {/* timeline */}
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111] ring-1 ring-neutral-200 font-mono text-[11px] font-black text-[#D4FC64]">
          {num}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-neutral-150 border-l border-dashed border-neutral-200" />}
      </div>
      {/* content */}
      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-8'}`}>
        <p className="text-[10px] font-mono font-bold tracking-[0.22em] text-neutral-400 uppercase">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">{desc}</p>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────── 섹션별 콘텐츠 ─────────────────────── */

function Section0() {
  return (
    <>
      <Step num="01" label="설치" desc="개발·검증 환경에서는 소스로 직접 설치합니다. 배포 확정 후에는 pipx를 사용합니다.">
        <Terminal_ lines={[
          { comment: '개발/검증 환경', cmd: 'cd CLI && python -m pip install -e .' },
          { comment: '최종 배포 후', cmd: 'pipx install ssafer' },
        ]} />
      </Step>
      <Step num="02" label="로그인" desc="SSAfer 계정으로 로그인하여 스캔 결과 업로드 권한을 획득합니다.">
        <Terminal_ lines={[{ cmd: 'ssafer login' }]} />
      </Step>
      <Step num="03" label="스캔 및 업로드" desc="프로젝트 루트에서 스캔을 실행합니다. --upload 없이 실행하면 로컬에만 저장됩니다." isLast>
        <Terminal_ lines={[
          { cmd: 'cd <프로젝트 루트>' },
          { cmd: 'ssafer run --upload' },
        ]} />
        <div className="mt-3">
          <Note>
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">ssafer run</code>만 실행하면 결과가 로컬{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">.ssafer/results</code>에만 저장됩니다.
            웹에서 보려면 <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">--upload</code>를 붙이거나
            이후 <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">ssafer upload</code>를 별도로 실행하세요.
          </Note>
        </div>
      </Step>
    </>
  );
}

function Section1() {
  return (
    <>
      <Step num="01" label="로그인" desc="계정 로그인 또는 게스트 토큰으로 로그인합니다. 게스트 토큰은 웹에서 발급받을 수 있습니다.">
        <Terminal_ lines={[
          { cmd: 'ssafer login' },
          { comment: '게스트로 시작하는 경우', cmd: 'ssafer login --guest' },
        ]} />
      </Step>
      <Step num="02" label="Agent 실행" desc="웹에서 보내는 스캔·패치 요청을 현재 서버에서 즉시 처리하도록 Agent를 시작합니다." isLast>
        <Terminal_ lines={[
          { comment: '점검할 디렉토리를 --path 로 지정 (기본값: 현재 디렉토리)', cmd: 'ssafer agent --path /opt/app' },
          { comment: '현재 디렉토리를 루트로 사용하는 경우', cmd: 'ssafer agent' },
        ]} />
        <div className="mt-3 space-y-2">
          <Note>
            <strong>Agent가 ONLINE 상태일 때만</strong> 웹에서 스캔을 시작할 수 있습니다.
            웹 버튼을 누르면 Agent가 스캔과 업로드를 <strong>한 번에 처리</strong>하므로 별도로{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">ssafer upload</code>를 실행할 필요가 없습니다.
          </Note>
          <Note>
            웹에서 입력하는 <strong>대상 경로</strong>는{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">--path</code>로 지정한 디렉토리 기준입니다.
            예를 들어 <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">--path /opt/app</code>으로 실행했다면
            대상 경로에 <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">.</code> 또는{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">backend</code>처럼
            해당 루트 <strong>내부 경로</strong>를 입력해야 합니다.
          </Note>
        </div>
      </Step>
    </>
  );
}

function Section2() {
  return (
    <>
      <Step num="01" label="웹에서 패치 승인" desc="Finding 상세 화면에서 수정 전/후 diff를 확인한 뒤 패치 적용 승인 버튼을 클릭합니다.">
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
          <span className="rounded bg-[#D4FC64] px-2 py-0.5 text-[11px] font-black text-black">WEB</span>
          <span className="text-neutral-700">Finding 상세 → 패치 적용 탭 → 패치 적용 승인 버튼 클릭</span>
        </div>
      </Step>
      <Step num="02" label="CLI에서 직접 적용" desc="웹 승인 없이 최근 스캔 결과의 패치를 CLI에서 직접 로컬 파일에 적용합니다.">
        <Terminal_ lines={[{ cmd: 'ssafer apply' }]} />
      </Step>
      <Step num="03" label="특정 스캔 지정 적용" desc="스캔 ID를 지정해 해당 스캔의 패치만 선택적으로 적용합니다." isLast>
        <Terminal_ lines={[{ cmd: 'ssafer apply <scanId>' }]} />
        <div className="mt-3">
          <Note>
            자동 수정은 <strong>patch payload가 있는 finding에만 가능</strong>합니다.
            patch가 없는 finding은 권장 조치 가이드만 표시됩니다.
          </Note>
        </div>
      </Step>
    </>
  );
}

function Section3() {
  return (
    <>
      <Step num="01" label="로그인" desc="웹으로 결과를 업로드하려면 먼저 로그인이 필요합니다.">
        <Terminal_ lines={[{ cmd: 'ssafer login' }]} />
      </Step>
      <Step num="02" label="서버 점검 실행" desc="홈 디렉터리에서 서버 런타임 상태를 점검합니다. --upload를 붙이면 결과를 웹에 함께 올립니다.">
        <Terminal_ lines={[
          { cmd: 'cd ~' },
          { cmd: 'ssafer server' },
          { comment: '웹으로 결과 업로드까지 함께', cmd: 'ssafer server --upload' },
        ]} />
      </Step>
      <Step num="03" label="OS 패키지 취약점 포함" desc="Trivy rootfs scan을 추가 실행해 OS 패키지 취약점까지 함께 점검합니다. 시간이 다소 걸릴 수 있습니다." isLast>
        <Terminal_ lines={[{ cmd: 'ssafer server --include-os-packages' }]} />
        <div className="mt-3">
          <Note>
            <strong>cd ~ 에서 실행을 권장합니다.</strong> 결과 파일이{' '}
            <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">~/.ssafer/server-audit</code>에 저장되는데,
            /var/lib 등 권한 제한 경로에서는 폴더 생성에 실패할 수 있습니다.
            일부 점검(방화벽·프로세스 등)은 <strong>sudo 권한이 필요</strong>할 수 있습니다.
          </Note>
        </div>
      </Step>
    </>
  );
}

/* ─────────────────────── 페이지 ─────────────────────── */

function GuidePage() {
  const [active, setActive] = useState(0);
  const current = useMemo(() => guideSections[active] ?? guideSections[0], [active]);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isGuest = isAuthenticated && !refreshToken;

  const handleCopyCommand = async () => {
    if (!accessToken) return;
    await navigator.clipboard.writeText(`ssafer login --guest-token ${accessToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sectionContent = [<Section0 />, <Section1 />, <Section2 />, <Section3 />];

  return (
    <div className="theme-guide-page min-h-screen bg-[#F7F7F5] text-black">
      <SiteHeader showSessionBar={false} />

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* 페이지 헤더 */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.32em] text-neutral-400 uppercase">SSAFER · GUIDE</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">CLI 사용 가이드</h1>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
              설치부터 서버 점검까지 — 핵심 명령어와 실행 흐름을 한눈에 정리합니다.
            </p>
          </div>
          <PixelGoose mood="working" size={72} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">

          {/* 왼쪽 사이드바 */}
          <aside className="flex flex-col gap-4">
            {/* 섹션 탭 */}
            <nav className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              {guideSections.map((s, idx) => {
                const isActive = active === idx;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActive(idx)}
                    type="button"
                    className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3.5 text-left last:border-b-0 transition-colors ${
                      isActive ? 'bg-[#111]' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                        isActive ? 'bg-[#D4FC64]' : 'bg-neutral-300'
                      }`}
                    />
                    <span className={`flex-1 text-sm font-bold ${isActive ? 'text-white' : 'text-neutral-800'}`}>
                      {s.title}
                    </span>
                    <span
                      className={`font-mono text-[9px] font-black tracking-[0.2em] ${
                        isActive ? 'text-[#D4FC64]' : 'text-neutral-400'
                      }`}
                    >
                      {s.category}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* TIP 카드 */}
            <div className="theme-guide-tip rounded-xl border border-[#D4FC64]/60 bg-[#F6FDE8] p-4">
              <div className="flex items-center gap-2 mb-2">
                <PixelGoose mood="happy" size={18} />
                <span className="font-mono text-[9px] font-black tracking-[0.26em] text-[#7AAD00]">TIP</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-neutral-600">{tips[active]}</p>
            </div>

            {/* NEXT STEP 카드 */}
            <div className="rounded-xl bg-[#111] p-4">
              <span className="font-mono text-[9px] font-black tracking-[0.26em] text-[#D4FC64]">NEXT STEP</span>
              <p className="mt-2 text-[11.5px] leading-relaxed text-neutral-300">{nextSteps[active]}</p>
              <Link
                to={ROUTES.login}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#D4FC64] px-3 py-2 text-[11px] font-black text-black transition hover:bg-[#c8f050]"
              >
                <Terminal className="h-3 w-3" />
                시작하기
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>

          {/* 오른쪽 메인 콘텐츠 */}
          <article className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
            {/* 섹션 헤더 */}
            <div className="mb-8 border-b border-neutral-100 pb-6">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#111] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.22em] text-[#D4FC64]">
                  {current.category}
                </span>
                <span className="font-mono text-[10px] text-neutral-400">0{active + 1}</span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">{current.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{current.summary}</p>
            </div>

            {/* 스텝 콘텐츠 */}
            <div>{sectionContent[active]}</div>

            {/* 게스트 CLI 연동 */}
            {isGuest && (
              <div className="mt-8 rounded-xl border border-neutral-700 bg-[#1A1A1A] p-5">
                <p className="font-mono text-[9px] font-bold tracking-[0.26em] text-neutral-500 uppercase">CLI 연동</p>
                <p className="mt-1 text-sm font-bold text-white">이 게스트 세션을 CLI에서 이어서 사용하기</p>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-700 bg-[#252525] px-4 py-3">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-[#D4FC64]">
                    ssafer login --guest-token{' '}
                    <span className="text-neutral-300">
                      {tokenVisible ? accessToken : `${accessToken?.slice(0, 12) ?? ''}${'•'.repeat(20)}`}
                    </span>
                  </code>
                  <button
                    className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
                    onClick={() => setTokenVisible((v) => !v)}
                    title={tokenVisible ? '토큰 숨기기' : '토큰 표시'}
                    type="button"
                  >
                    {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
                    onClick={() => void handleCopyCommand()}
                    title="명령어 복사"
                    type="button"
                  >
                    {copied ? <Check className="h-4 w-4 text-[#D4FC64]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-neutral-600">토큰은 타인과 공유하지 마세요. 게스트 세션이 만료되면 CLI 연결도 함께 종료됩니다.</p>
              </div>
            )}
          </article>
        </div>
      </main>
    </div>
  );
}

export default GuidePage;