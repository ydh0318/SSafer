import { Check, Copy, X } from 'lucide-react';
import { useState } from 'react';
import PixelGoose from './PixelGoose';

const COMMANDS = [
  { cmd: 'ssafer version', desc: '현재 설치된 SSAfer CLI 버전을 확인합니다.' },
  { cmd: 'ssafer status', desc: '로그인 상태, 사용 중인 백엔드 주소, Local Agent 설정 여부를 확인합니다.' },
  { cmd: 'ssafer signup', desc: '터미널에서 이메일 인증까지 진행해 새 SSAfer 계정을 만듭니다.' },
  { cmd: 'ssafer login', desc: 'SSAfer 계정으로 로그인하고, 스캔 결과를 웹에 업로드할 준비를 합니다.' },
  { cmd: 'ssafer logout', desc: '현재 기기에 저장된 로그인 토큰과 현재 프로젝트의 agent 설정을 삭제합니다.' },
  { cmd: 'ssafer project-create', desc: '웹에서 관리할 SSAfer 프로젝트를 새로 생성합니다.' },
  { cmd: 'ssafer install-tools', desc: 'Trivy처럼 SSAfer 스캔에 필요한 외부 도구를 설치합니다.' },
  { cmd: 'ssafer run', desc: '현재 폴더의 .env, Dockerfile, docker-compose 파일을 점검하고 로컬 결과 JSON을 만듭니다.' },
  { cmd: 'ssafer run --path <dir>', desc: '지정한 프로젝트 폴더를 기준으로 보안 점검을 실행합니다.' },
  { cmd: 'ssafer run --upload', desc: '스캔 후 결과 JSON을 바로 백엔드/S3에 업로드해 웹에서 확인할 수 있게 합니다.' },
  { cmd: 'ssafer run --save-raw', desc: 'SSAfer가 분석한 compose 설정 원본을 로컬에 함께 저장해 디버깅할 수 있게 합니다.' },
  { cmd: 'ssafer report', desc: '최근 로컬 스캔 결과의 요약을 확인합니다.' },
  { cmd: 'ssafer report --details', desc: '최근 로컬 스캔의 대상 파일, 산출물 경로, finding 상세 내용을 확인합니다.' },
  { cmd: 'ssafer upload', desc: '이미 로컬에 생성된 최근 스캔 결과 JSON을 웹으로 업로드합니다.' },
  { cmd: 'ssafer apply', desc: '로컬 analysis_result.json 안의 patch payload를 확인하고 프로젝트 파일에 적용합니다.' },
  { cmd: 'ssafer apply --scan-id <id>', desc: '백엔드에서 해당 scanId의 analysis_result.json을 내려받아 수정안을 적용합니다.' },
  { cmd: 'ssafer apply --latest --project-id <id>', desc: '해당 프로젝트의 최신 완료 스캔 분석 결과를 내려받아 수정안을 적용합니다.' },
  { cmd: 'ssafer apply --dry-run', desc: '실제 파일은 바꾸지 않고 어떤 수정이 적용될지 diff만 확인합니다.' },
  { cmd: 'ssafer agent', desc: '웹에서 보낸 스캔/수정 요청을 현재 PC 또는 서버에서 처리할 수 있도록 Local Agent를 실행합니다.' },
  { cmd: 'ssafer server-audit', desc: 'EC2 같은 실제 서버 안에서 포트, 프로세스, Docker, SSH, 방화벽, nginx 상태를 점검합니다.' },
  { cmd: 'ssafer server-audit --details', desc: '서버 점검 결과의 findings, warnings, artifacts를 자세히 확인합니다.' },
  { cmd: 'ssafer server-audit --include-os-packages', desc: 'Trivy로 서버 OS 패키지 취약점까지 함께 점검합니다.' },
  { cmd: 'ssafer server-audit --upload', desc: '서버 점검 결과를 백엔드/S3에 업로드해 웹에서 확인할 수 있게 합니다.' },
];

export default function SsaferCommandsModal({ onClose }: { onClose: () => void }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative w-full max-w-4xl max-h-[80vh] bg-[#fafaf7] dark:bg-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col overflow-hidden m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#222]">
          <div className="flex items-center gap-3">
            <PixelGoose mood="happy" size={36} />
            <h2 className="text-xl font-black text-black dark:text-white">SSAfer 주요 명령어 모음집</h2>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#fafaf7] dark:bg-[#1a1a1a]">
          <div className="grid gap-3">
            {COMMANDS.map((c, i) => (
              <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#222] hover:border-[#d9f66f] dark:hover:border-[#d9f66f] transition-colors">
                <div className="font-mono text-sm font-bold text-emerald-600 dark:text-[#d9f66f] md:w-1/3 shrink-0 flex items-center justify-between group">
                  <div>
                    <span className="text-neutral-400 select-none mr-2">$</span>
                    {c.cmd}
                  </div>
                  <button
                    onClick={() => handleCopy(i, c.cmd)}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="복사하기"
                  >
                    {copiedIndex === i ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed md:w-2/3">
                  {c.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-6 py-4 bg-white dark:bg-[#222] border-t border-neutral-200 dark:border-neutral-800 text-center">
          <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">숨겨진 이스터 에그를 발견하셨군요! 🎉 SSAfer 명령어들을 마스터해 보세요.</p>
        </div>
      </div>
    </div>
  );
}
