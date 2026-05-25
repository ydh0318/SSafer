import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useUiStore } from '../../store/uiStore';

const COMMAND_GROUPS = [
  {
    label: '계정 및 상태',
    color: '#60a5fa',
    commands: [
      { cmd: 'ssafer version', desc: '현재 설치된 SSAFER CLI 버전을 확인합니다.' },
      { cmd: 'ssafer status', desc: '로그인 상태, 백엔드 주소, Local Agent 설정 여부를 확인합니다.' },
      { cmd: 'ssafer signup', desc: '터미널에서 이메일 인증까지 진행해 새 SSAFER 계정을 만듭니다.' },
      { cmd: 'ssafer login', desc: 'SSAFER 계정으로 로그인하고 스캔 결과를 웹에 업로드할 준비를 합니다.' },
      { cmd: 'ssafer logout', desc: '현재 기기에 저장된 로그인 토큰과 agent 설정을 삭제합니다.' },
    ],
  },
  {
    label: '프로젝트 및 도구',
    color: '#a78bfa',
    commands: [
      { cmd: 'ssafer project-create', desc: '웹에서 관리할 SSAFER 프로젝트를 새로 생성합니다.' },
      { cmd: 'ssafer install-tools', desc: 'Trivy처럼 SSAFER 스캔에 필요한 외부 도구를 설치합니다.' },
    ],
  },
  {
    label: '스캔 실행',
    color: '#34d399',
    commands: [
      { cmd: 'ssafer run', desc: '현재 폴더의 .env, Dockerfile, docker-compose 파일을 점검합니다.' },
      { cmd: 'ssafer run --path <dir>', desc: '지정한 프로젝트 폴더를 기준으로 보안 점검을 실행합니다.' },
      { cmd: 'ssafer run --upload', desc: '스캔 후 결과 JSON을 백엔드/S3에 업로드해 웹에서 확인할 수 있게 합니다.' },
      { cmd: 'ssafer run --save-raw', desc: '분석한 compose 설정 원본을 로컬에 함께 저장해 디버깅할 수 있게 합니다.' },
    ],
  },
  {
    label: '결과 확인 및 업로드',
    color: '#fbbf24',
    commands: [
      { cmd: 'ssafer report', desc: '최근 로컬 스캔 결과의 요약을 확인합니다.' },
      { cmd: 'ssafer report --details', desc: '대상 파일, 산출물 경로, finding 상세 내용을 확인합니다.' },
      { cmd: 'ssafer upload', desc: '로컬에 생성된 최근 스캔 결과 JSON을 웹으로 업로드합니다.' },
    ],
  },
  {
    label: '패치 적용',
    color: '#f87171',
    commands: [
      { cmd: 'ssafer apply', desc: '로컬 analysis_result.json의 patch payload를 프로젝트 파일에 적용합니다.' },
      { cmd: 'ssafer apply --scan-id <id>', desc: '백엔드에서 해당 scanId의 분석 결과를 내려받아 수정안을 적용합니다.' },
      { cmd: 'ssafer apply --latest --project-id <id>', desc: '해당 프로젝트의 최신 완료 스캔 분석 결과를 내려받아 수정안을 적용합니다.' },
      { cmd: 'ssafer apply --dry-run', desc: '실제 파일은 바꾸지 않고 어떤 수정이 적용될지 diff만 확인합니다.' },
    ],
  },
  {
    label: 'Agent 및 서버 점검',
    color: '#fb923c',
    commands: [
      { cmd: 'ssafer agent', desc: '웹에서 보낸 스캔/수정 요청을 현재 PC 또는 서버에서 처리하도록 Local Agent를 실행합니다.' },
      { cmd: 'ssafer server-audit', desc: 'EC2 같은 서버 안에서 포트, 프로세스, Docker, SSH, 방화벽, nginx 상태를 점검합니다.' },
      { cmd: 'ssafer server-audit --details', desc: '서버 점검 결과의 findings, warnings, artifacts를 자세히 확인합니다.' },
      { cmd: 'ssafer server-audit --include-os-packages', desc: 'Trivy로 서버 OS 패키지 취약점까지 함께 점검합니다.' },
      { cmd: 'ssafer server-audit --upload', desc: '서버 점검 결과를 백엔드/S3에 업로드해 웹에서 확인할 수 있게 합니다.' },
    ],
  },
];

export default function SsaferCommandsModal({ onClose }: { onClose: () => void }) {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const isDark = useUiStore((s) => s.theme === 'dark');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="theme-cli-modal relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.18)] border border-neutral-200 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 액센트 바 */}
        <div className="h-1 w-full shrink-0 bg-[#D4FC64]" />

        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-white border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-[#111] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.22em] text-[#D4FC64]">
              CLI
            </span>
            <span className="text-base font-black tracking-tight text-black">
              명령어 치트시트
            </span>
          </div>
          <button
            aria-label="닫기"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-black"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hero banner */}
        <div className="px-6 py-4 shrink-0 bg-white border-b border-neutral-100">
          <p className="text-xs text-neutral-400 leading-relaxed">
            🎉 숨겨진 이스터 에그를 발견했습니다. 명령어를 클릭하면 클립보드에 복사됩니다.
          </p>
        </div>

        {/* Commands */}
        <div className="theme-cli-scroll flex-1 overflow-y-auto px-4 py-4 space-y-5 bg-neutral-100">
          {COMMAND_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Category label */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-px flex-1 bg-neutral-200" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: group.color }}
                  />
                  <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-500">
                    {group.label}
                  </span>
                </div>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Command rows */}
              <div className="space-y-1">
                {group.commands.map((c) => {
                  const isCopied = copiedCmd === c.cmd;
                  return (
                    <button
                      key={c.cmd}
                      className={`group w-full text-left rounded-xl px-4 py-3 border transition-all ${
                        isCopied
                          ? isDark
                            ? 'border-[#4d7a00] bg-[#1a2e08]'
                            : 'border-[#b8e832] bg-[#F6FDE8]'
                          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                      onClick={() => void handleCopy(c.cmd)}
                      title="클릭해서 복사"
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] text-neutral-300 select-none shrink-0">$</span>
                            <span className="font-mono text-[13px] font-black text-black">
                              {c.cmd.split(' ')[0]}
                            </span>
                            {c.cmd.split(' ').slice(1).join(' ') && (
                              <span
                                className="font-mono text-[13px] font-semibold"
                                style={{ color: group.color }}
                              >
                                {c.cmd.split(' ').slice(1).join(' ')}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                            {c.desc}
                          </p>
                        </div>

                        <div
                          className={`shrink-0 mt-0.5 rounded-md p-1.5 transition-all ${
                            isCopied
                              ? isDark
                                ? 'text-[#a3d62a] bg-[#2a4a10]'
                                : 'text-[#5a9900] bg-[#D4FC64]/30'
                              : 'text-neutral-300'
                          }`}
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 shrink-0 bg-neutral-50 border-t border-neutral-200">
          <p className="text-center font-mono text-[10px] text-neutral-300 tracking-widest">
            ESC · 빨간 버튼 · 바깥 클릭으로 닫기
          </p>
        </div>
      </div>
    </div>
  );
}
