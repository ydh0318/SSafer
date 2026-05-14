import { Check, Copy, Terminal, X } from 'lucide-react';
import { useState } from 'react';

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
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ background: '#161616', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5">
              <button
                aria-label="닫기"
                className="h-3 w-3 rounded-full transition-opacity hover:opacity-80"
                onClick={onClose}
                style={{ background: '#ff5f57' }}
                type="button"
              />
              <div className="h-3 w-3 rounded-full" style={{ background: '#febc2e' }} />
              <div className="h-3 w-3 rounded-full" style={{ background: '#28c840' }} />
            </div>
            <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <Terminal className="h-3.5 w-3.5" style={{ color: '#D4FC64' }} />
            <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
              ssafer --help
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[10px] font-black tracking-[0.3em]"
              style={{ color: '#D4FC64' }}
            >
              SSAFER CLI
            </span>
            <button
              aria-label="닫기"
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              onClick={onClose}
              style={{ color: 'rgba(255,255,255,0.35)' }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hero banner */}
        <div
          className="px-6 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg, #0e1a00 0%, #0e0e0e 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="font-mono text-[10px] font-bold tracking-[0.35em]" style={{ color: 'rgba(212,252,100,0.5)' }}>
            CHEAT SHEET
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-white">
            SSAFER 주요 명령어 모음집
          </h2>
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            숨겨진 이스터 에그를 발견했습니다. 명령어를 클릭해 바로 복사하세요.
          </p>
        </div>

        {/* Commands */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
          style={{ scrollbarColor: 'rgba(255,255,255,0.1) transparent', scrollbarWidth: 'thin' }}
        >
          {COMMAND_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span
                  className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase shrink-0"
                  style={{ color: group.color, opacity: 0.7 }}
                >
                  {group.label}
                </span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>

              <div className="space-y-1">
                {group.commands.map((c) => {
                  const isCopied = copiedCmd === c.cmd;
                  return (
                    <button
                      key={c.cmd}
                      className="group w-full text-left rounded-xl px-4 py-3 transition-colors"
                      onClick={() => void handleCopy(c.cmd)}
                      style={{
                        background: isCopied ? 'rgba(212,252,100,0.06)' : 'rgba(255,255,255,0.03)',
                        border: isCopied
                          ? '1px solid rgba(212,252,100,0.25)'
                          : '1px solid rgba(255,255,255,0.05)',
                      }}
                      title="클릭해서 복사"
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-mono text-[10px] select-none shrink-0"
                              style={{ color: 'rgba(255,255,255,0.2)' }}
                            >
                              $
                            </span>
                            {/* Base command */}
                            <span
                              className="font-mono text-sm font-bold"
                              style={{ color: group.color }}
                            >
                              {c.cmd.split(' ')[0]}
                            </span>
                            {/* Subcommand */}
                            {c.cmd.split(' ').slice(1).join(' ') && (
                              <span className="font-mono text-sm font-semibold text-white/80">
                                {c.cmd.split(' ').slice(1).join(' ')}
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-1.5 text-xs leading-relaxed"
                            style={{ color: 'rgba(255,255,255,0.38)' }}
                          >
                            {c.desc}
                          </p>
                        </div>

                        <div
                          className="shrink-0 mt-0.5 rounded-md p-1.5 transition-all"
                          style={{
                            color: isCopied ? '#D4FC64' : 'rgba(255,255,255,0.2)',
                            background: isCopied ? 'rgba(212,252,100,0.1)' : 'transparent',
                          }}
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
        <div
          className="px-6 py-3 shrink-0"
          style={{ background: '#161616', borderTop: '1px solid rgba(255,255,255,0.07)' }}
        />
      </div>
    </div>
  );
}
