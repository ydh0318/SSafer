import { useState } from 'react';
import { Copy, Check, Terminal, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

type Mode = 'AGENT' | 'CLI_UPLOAD';

interface CliGuideBoxProps {
  mode: Mode;
}

const AGENT_COMMANDS = [
  { label: 'SSAfer 설치', cmd: 'pip install ssafer' },
  { label: '프로젝트 루트로 이동', cmd: 'cd <프로젝트 루트>' },
  { label: '백엔드 인증 로그인', cmd: 'ssafer login' },
  { label: '스캔 도구 설치 (Trivy 등)', cmd: 'ssafer tools' },
  { label: '에이전트 실행', cmd: 'ssafer agent' },
];

const CLI_UPLOAD_COMMANDS = [
  { label: 'SSAfer 설치', cmd: 'pip install ssafer' },
  { label: '프로젝트 루트로 이동', cmd: 'cd <프로젝트 루트>' },
  { label: '백엔드 인증 로그인', cmd: 'ssafer login' },
  { label: '스캔 도구 설치 (Trivy 등)', cmd: 'ssafer tools' },
  { label: '스캔 실행 및 업로드', cmd: 'ssafer run --upload' },
];

export default function CliGuideBox({ mode }: CliGuideBoxProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const isAgent = mode === 'AGENT';
  const commands = isAgent ? AGENT_COMMANDS : CLI_UPLOAD_COMMANDS;

  return (
    <div className="mt-1 min-w-0 rounded-md border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <Terminal className="h-5 w-5 shrink-0 text-blue-600" />
        <h4 className="min-w-0 text-sm font-bold text-blue-900">
          {isAgent ? 'Local Agent 연동 가이드' : 'SSAfer CLI 스캔 가이드'}
        </h4>
      </div>

      <div className="mb-4 flex min-w-0 items-start gap-2 rounded border border-blue-100 bg-white p-3 text-sm text-neutral-700">
        <span className="text-xl">📂</span>
        <p className="mt-0.5 min-w-0 leading-relaxed">
          <strong className="font-bold">작업 위치:</strong>{' '}
          {isAgent
            ? '점검할 서버(EC2 등)에 SSH로 접속한 뒤, 프로젝트 코드가 위치한 디렉터리에서 터미널을 열어주세요.'
            : '점검할 코드가 위치한 프로젝트의 최상위 폴더(Root Directory)에서 터미널을 열어주세요.'}

        </p>
      </div>

      <div className="grid gap-3">
        {commands.map((item, idx) => (
          <div key={idx} className="min-w-0">
            <div className="text-xs font-bold text-neutral-600 mb-1">{`Step ${idx + 1}. ${item.label}`}</div>
            <div className="flex min-w-0 items-start justify-between gap-3 rounded bg-black p-3 font-mono text-xs text-[#3DDC84]">
              <span className="min-w-0 break-all leading-6">{item.cmd}</span>
              <button
                onClick={() => handleCopy(item.cmd, idx)}
                className="flex shrink-0 items-center gap-1 rounded bg-[#3DDC84] px-2 py-1 text-[10px] font-bold text-black transition hover:bg-[#32b56c]"
                type="button"
                aria-label={`${item.cmd} 복사`}
              >
                {copiedIndex === idx ? <><Check className="w-3 h-3" /> 복사됨</> : <><Copy className="w-3 h-3" /> 복사</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAgent && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Agent가 <strong>ONLINE</strong> 상태일 때만 웹에서 스캔을 시작할 수 있습니다.
          웹 버튼을 누르면 Agent가 스캔과 업로드를 <strong>한 번에 처리</strong>합니다.
        </div>
      )}

      {/* Troubleshoot Accordion */}
      <div className="mt-4 pt-3 border-t border-blue-200/60">
        <button
          onClick={() => setShowTroubleshoot(!showTroubleshoot)}
          className="flex min-w-0 items-center gap-1.5 text-left text-xs font-bold text-neutral-500 transition hover:text-neutral-800"
          type="button"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">pip 명령어 오류가 발생하나요?</span>
          {showTroubleshoot ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
        </button>

        {showTroubleshoot && (
          <div className="mt-2 min-w-0 rounded border border-blue-100 bg-white/50 p-3 text-xs leading-relaxed text-neutral-600">
            Ubuntu 24.04 등 일부 환경에서는 전역 pip 설치가 제한될 수 있습니다.<br />
            이 경우 아래 명령어로 가상 환경(venv)을 만들어 설치해 보세요.<br />
            <code className="mt-2 block overflow-x-auto whitespace-pre rounded border border-neutral-200 bg-white px-2 py-1.5 font-mono text-neutral-800">
              sudo apt install -y python3-venv<br />
              python3 -m venv ~/.ssafer-venv<br />
              source ~/.ssafer-venv/bin/activate<br />
              pip install ssafer
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
